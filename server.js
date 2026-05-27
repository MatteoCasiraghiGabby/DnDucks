const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
loadEnvFile();

const { MaterialStore, MAX_FILE_SIZE_BYTES, resolveUploadDir } = require("./src/materialStore");
const { ImageStorageService, IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MAX_FILES, resolveImageUploadDir } = require("./src/imageStorageService");
const { MapStorageService, MAP_UPLOAD_FIELD_NAMES, MAP_UPLOAD_MAX_BYTES, resolveMapUploadDir } = require("./src/mapStorageService");
const { processMapImage } = require("./src/mapProcessingService");
const {
  ALLOWED_CHARACTER_SUGGESTIONS,
  allAllowedSuggestionIds,
  backgroundSuggestionFromPayload,
  findAllowedSuggestion,
  upsertSuggestionInFile,
} = require("./src/characterSuggestionData");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = process.cwd();
const store = new MaterialStore(resolveUploadDir());
const imageStore = new ImageStorageService(resolveImageUploadDir());
const mapStore = new MapStorageService(resolveMapUploadDir());

const API_CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const CHARACTER_ANALYSIS_MODEL = process.env.OPENAI_CHARACTER_MODEL || "gpt-4o-mini";
const CHARACTER_ANALYSIS_RATE_LIMIT_WINDOW_MS = positiveInteger(process.env.CHARACTER_ANALYSIS_RATE_LIMIT_WINDOW_MS, 60_000);
const CHARACTER_ANALYSIS_RATE_LIMIT_MAX = positiveInteger(process.env.CHARACTER_ANALYSIS_RATE_LIMIT_MAX, 12);
const characterAnalysisRateLimits = new Map();
const VERBOSE_REQUEST_LOGS = process.env.DNDUCKS_VERBOSE_REQUESTS === "1";

const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function createServer(materialStore = store, uploadedImageStore = imageStore, interactiveMapStore = mapStore, options = {}) {
  await Promise.all([materialStore.ensureReady(), uploadedImageStore.ensureReady(), interactiveMapStore.ensureReady()]);
  const characterSuggestionsFilePath = options.characterSuggestionsFilePath;

  return http.createServer(async (req, res) => {
    let pathname = "";
    try {
      if (VERBOSE_REQUEST_LOGS) console.log("[REQ]", req.method, req.url);
      const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      pathname = normalizeApiPathname(requestUrl.pathname);
      if (VERBOSE_REQUEST_LOGS) console.log("[ROUTE]", { method: req.method, url: req.url, pathname });
      res.on("finish", () => {
        if (VERBOSE_REQUEST_LOGS) console.log("[RES]", { method: req.method, url: req.url, pathname, status: res.statusCode, branch: res.getHeader("X-Route-Branch") || "unknown" });
      });

      if (pathname.startsWith("/api/")) setApiCorsHeaders(req, res);

      if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
        res.setHeader("X-Route-Branch", "api-preflight");
        res.writeHead(204);
        res.end();
        return;
      }

      if (pathname.startsWith("/api/uploads/images")) {
        res.setHeader("X-Route-Branch", "image-upload-route");
        requestUrl.pathname = pathname;
        await handleImageUploadsApi(req, res, uploadedImageStore, requestUrl);
        return;
      }

      if (pathname.startsWith("/api/maps")) {
        res.setHeader("X-Route-Branch", "maps-route");
        requestUrl.pathname = pathname;
        await handleMapsApi(req, res, requestUrl, interactiveMapStore);
        return;
      }

      if (pathname === "/api/characters/analyze") {
        res.setHeader("X-Route-Branch", "character-analysis-route");
        await handleCharacterAnalysisApi(req, res, pathname);
        return;
      }

      if (pathname === "/api/character-suggestions/backgrounds") {
        res.setHeader("X-Route-Branch", "character-background-suggestion-route");
        await handleCharacterBackgroundSuggestionApi(req, res, pathname, characterSuggestionsFilePath);
        return;
      }

      if (pathname.startsWith("/api/materials")) {
        res.setHeader("X-Route-Branch", "materials-route");
        requestUrl.pathname = pathname;
        await handleMaterialsApi(req, res, requestUrl, materialStore);
        return;
      }

      if (pathname.startsWith("/api/")) {
        res.setHeader("X-Route-Branch", "api-route-not-found");
        sendJson(res, 404, { error: "API route not found.", code: "API_ROUTE_NOT_FOUND", method: req.method, pathname, branch: "api-route-not-found" });
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        if (requestUrl.pathname.startsWith("/uploads/images/")) {
          await serveUploadedImage(req, res, requestUrl, uploadedImageStore);
        } else if (requestUrl.pathname.startsWith("/uploads/maps/")) {
          await serveUploadedMapImage(req, res, requestUrl, interactiveMapStore);
        } else {
          await serveStatic(req, res, requestUrl);
        }
        return;
      }

      sendMethodNotAllowed(req, res, ["GET", "HEAD"], { pathname, branch: "static-file-guard" });
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) console.error(error);
      sendJson(res, error.statusCode || 500, { error: error.message || "Unexpected server error.", ...(error.code ? { code: error.code } : {}), ...(error.requestId ? { requestId: error.requestId } : {}) });
    }
  });
}

function normalizeApiPathname(pathname) {
  if (!pathname.startsWith("/api/")) return pathname;
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function sendMethodNotAllowed(req, res, allowedMethods, extra = {}) {
  const allow = [...allowedMethods];
  const branch = extra.branch || "unknown";
  res.setHeader("Allow", allow.join(", "));
  res.setHeader("X-Route-Branch", branch);
  sendJson(res, 405, {
    error: "METHOD_NOT_ALLOWED",
    code: "METHOD_NOT_ALLOWED",
    message: `Method not allowed. Use ${allow.join(" or ")}.`,
    method: req.method,
    pathname: extra.pathname || null,
    branch,
    allow,
    ...extra,
  });
}

function setApiCorsHeaders(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", API_CORS_ORIGIN === "*" ? "*" : (origin && API_CORS_ORIGIN.split(",").map((value) => value.trim()).includes(origin) ? origin : API_CORS_ORIGIN));
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Vary", "Origin");
}

async function handleImageUploadsApi(req, res, uploadedImageStore, requestUrl) {
  const parts = requestUrl.pathname.split("/").filter(Boolean);
  const id = parts[3];

  if (req.method === "POST" && requestUrl.pathname === "/api/uploads/images") {
    const { files, fields } = await parseMultipart(req, {
      maxBodySize: IMAGE_UPLOAD_MAX_BYTES * IMAGE_UPLOAD_MAX_FILES + 1024 * 1024,
    });
    const images = await uploadedImageStore.saveMany(files, fields);
    sendJson(res, 201, { images, count: images.length });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/uploads/images") {
    const images = await uploadedImageStore.list();
    sendJson(res, 200, { images, count: images.length });
    return;
  }

  if (req.method === "GET" && id) {
    const image = await uploadedImageStore.get(id);
    if (!image) {
      sendJson(res, 404, { error: "Image not found.", code: "IMAGE_NOT_FOUND" });
      return;
    }
    sendJson(res, 200, image);
    return;
  }

  if ((req.method === "PATCH" || req.method === "PUT") && id) {
    const fields = await parseJsonBody(req, { maxBodySize: 16 * 1024 });
    const image = await uploadedImageStore.update(id, fields);
    if (!image) {
      sendJson(res, 404, { error: "Image not found.", code: "IMAGE_NOT_FOUND" });
      return;
    }
    sendJson(res, 200, image);
    return;
  }

  if (req.method === "DELETE" && id) {
    const image = await uploadedImageStore.delete(id);
    if (!image) {
      sendJson(res, 404, { error: "Image not found.", code: "IMAGE_NOT_FOUND" });
      return;
    }
    sendJson(res, 200, { ok: true, deleted: image });
    return;
  }

  if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    sendMethodNotAllowed(req, res, ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"], { pathname: requestUrl.pathname, branch: "image-upload-method-guard" });
    return;
  }

  sendJson(res, 404, { error: "API route not found.", code: "API_ROUTE_NOT_FOUND", pathname: requestUrl.pathname });
}

async function handleMapsApi(req, res, requestUrl, interactiveMapStore) {
  const parts = requestUrl.pathname.split("/").filter(Boolean);
  const mapId = parts[2];
  const action = parts[3];
  const cityId = parts[4];
  const cityAction = parts[5];
  const noteId = parts[6];

  if (req.method === "POST" && requestUrl.pathname === "/api/maps") {
    const { files, fields } = await parseMultipart(req, {
      maxBodySize: MAP_UPLOAD_MAX_BYTES + 1024 * 1024,
    });
    const file = files.find((item) => MAP_UPLOAD_FIELD_NAMES.has(item.fieldName));
    if (!file) {
      sendJson(res, 400, { error: "Upload requires one map image field named map, image, or file.", code: "MISSING_MAP_IMAGE" });
      return;
    }
    const map = await interactiveMapStore.createMap({ file, fields });
    const processing = await processMapImage(interactiveMapStore, map.id);
    sendJson(res, 201, { map: processing.map, processing });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/maps") {
    const maps = await interactiveMapStore.listMaps();
    sendJson(res, 200, { maps, count: maps.length });
    return;
  }

  if (!mapId) {
    sendJson(res, 404, { error: "API route not found.", code: "API_ROUTE_NOT_FOUND", pathname: requestUrl.pathname });
    return;
  }

  if (req.method === "GET" && !action) {
    const map = await interactiveMapStore.getMap(mapId);
    if (!map) {
      sendJson(res, 404, { error: "Map not found.", code: "MAP_NOT_FOUND" });
      return;
    }
    const cities = await interactiveMapStore.listCities(mapId);
    sendJson(res, 200, { map, cities });
    return;
  }

  if (req.method === "DELETE" && !action) {
    const map = await interactiveMapStore.deleteMap(mapId);
    if (!map) {
      sendJson(res, 404, { error: "Map not found.", code: "MAP_NOT_FOUND" });
      return;
    }
    sendJson(res, 200, { ok: true, deleted: map });
    return;
  }

  if (req.method === "POST" && action === "process" && !cityId) {
    const processing = await processMapImage(interactiveMapStore, mapId);
    sendJson(res, 200, processing);
    return;
  }

  if (action === "cities" && !cityId) {
    if (req.method === "GET") {
      const map = await interactiveMapStore.getMap(mapId);
      if (!map) {
        sendJson(res, 404, { error: "Map not found.", code: "MAP_NOT_FOUND" });
        return;
      }
      const cities = await interactiveMapStore.listCities(mapId);
      sendJson(res, 200, { cities, count: cities.length });
      return;
    }

    if (req.method === "POST") {
      const fields = await parseJsonBody(req, { maxBodySize: 32 * 1024 });
      const city = await interactiveMapStore.createCity(mapId, fields);
      if (!city) {
        sendJson(res, 404, { error: "Map not found.", code: "MAP_NOT_FOUND" });
        return;
      }
      sendJson(res, 201, city);
      return;
    }
  }

  if (action === "cities" && cityId && !cityAction) {
    if (req.method === "GET") {
      const city = await interactiveMapStore.getCity(mapId, cityId);
      if (!city) {
        sendJson(res, 404, { error: "City not found.", code: "CITY_NOT_FOUND" });
        return;
      }
      sendJson(res, 200, city);
      return;
    }

    if (req.method === "PATCH" || req.method === "PUT") {
      const fields = await parseJsonBody(req, { maxBodySize: 32 * 1024 });
      const city = await interactiveMapStore.updateCity(mapId, cityId, fields);
      if (!city) {
        sendJson(res, 404, { error: "City not found.", code: "CITY_NOT_FOUND" });
        return;
      }
      sendJson(res, 200, city);
      return;
    }

    if (req.method === "DELETE") {
      const city = await interactiveMapStore.deleteCity(mapId, cityId);
      if (!city) {
        sendJson(res, 404, { error: "City not found.", code: "CITY_NOT_FOUND" });
        return;
      }
      sendJson(res, 200, { ok: true, deleted: city });
      return;
    }
  }

  if (action === "cities" && cityId && cityAction === "notes" && !noteId) {
    const city = await interactiveMapStore.getCity(mapId, cityId);
    if (!city) {
      sendJson(res, 404, { error: "City not found.", code: "CITY_NOT_FOUND" });
      return;
    }

    if (req.method === "GET") {
      const notes = await interactiveMapStore.listNotes(cityId);
      sendJson(res, 200, { notes, count: notes.length });
      return;
    }

    if (req.method === "POST") {
      const fields = await parseJsonBody(req, { maxBodySize: 64 * 1024 });
      const note = await interactiveMapStore.createNote(cityId, fields);
      sendJson(res, 201, note);
      return;
    }
  }

  if (action === "cities" && cityId && cityAction === "notes" && noteId) {
    const city = await interactiveMapStore.getCity(mapId, cityId);
    if (!city) {
      sendJson(res, 404, { error: "City not found.", code: "CITY_NOT_FOUND" });
      return;
    }

    if (req.method === "PATCH" || req.method === "PUT") {
      const fields = await parseJsonBody(req, { maxBodySize: 64 * 1024 });
      const note = await interactiveMapStore.updateNote(cityId, noteId, fields);
      if (!note) {
        sendJson(res, 404, { error: "City note not found.", code: "CITY_NOTE_NOT_FOUND" });
        return;
      }
      sendJson(res, 200, note);
      return;
    }

    if (req.method === "DELETE") {
      const note = await interactiveMapStore.deleteNote(cityId, noteId);
      if (!note) {
        sendJson(res, 404, { error: "City note not found.", code: "CITY_NOTE_NOT_FOUND" });
        return;
      }
      sendJson(res, 200, { ok: true, deleted: note });
      return;
    }
  }

  if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    sendMethodNotAllowed(req, res, ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"], { pathname: requestUrl.pathname, branch: "maps-method-guard" });
    return;
  }

  sendJson(res, 404, { error: "API route not found.", code: "API_ROUTE_NOT_FOUND", pathname: requestUrl.pathname });
}

async function handleMaterialsApi(req, res, requestUrl, materialStore) {
  const parts = requestUrl.pathname.split("/").filter(Boolean);
  const id = parts[2];
  const action = parts[3];

  if (req.method === "POST" && requestUrl.pathname === "/api/materials/upload") {
    const { file, fields } = await parseMultipart(req);
    if (!file || file.fieldName !== "file") {
      sendJson(res, 400, { error: "Upload requires one file field named file." });
      return;
    }
    const material = await materialStore.create({ file, fields });
    sendJson(res, 201, material);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/materials") {
    const materials = await materialStore.list({
      campaignId: requestUrl.searchParams.get("campaignId"),
      sessionId: requestUrl.searchParams.get("sessionId"),
    });
    sendJson(res, 200, materials);
    return;
  }

  if (req.method === "GET" && id && !action) {
    const material = await materialStore.get(id);
    if (!material) {
      sendJson(res, 404, { error: "Material not found." });
      return;
    }
    sendJson(res, 200, material);
    return;
  }

  if (req.method === "GET" && id && action === "download") {
    const record = await materialStore.filePathFor(id);
    if (!record) {
      sendJson(res, 404, { error: "Material not found." });
      return;
    }
    await streamMaterial(res, record.material, record.filePath);
    return;
  }

  if (req.method === "DELETE" && id && !action) {
    const deleted = await materialStore.delete(id);
    if (!deleted) {
      sendJson(res, 404, { error: "Material not found." });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "API route not found." });
}

async function handleCharacterAnalysisApi(req, res, pathname) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(req, res, ["POST", "OPTIONS"], { pathname, branch: "character-analysis-method-guard" });
    return;
  }

  const rateLimit = checkCharacterAnalysisRateLimit(req);
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    sendJson(res, 429, {
      error: "Too many character analysis requests. Try again shortly.",
      code: "CHARACTER_ANALYSIS_RATE_LIMITED",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return;
  }

  const body = await parseJsonBody(req, { maxBodySize: 32 * 1024 });
  const description = String(body.description || "").trim();
  if (description.length < 12) {
    sendJson(res, 400, { error: "Write a longer character description before requesting suggestions.", code: "DESCRIPTION_TOO_SHORT" });
    return;
  }

  const context = {
    characterName: String(body.characterName || "").trim(),
    classRole: String(body.classRole || "").trim(),
    race: String(body.race || "").trim(),
    background: String(body.background || "").trim(),
    notes: String(body.notes || "").trim(),
  };
  const rawSuggestions = process.env.OPENAI_API_KEY
    ? await suggestCharacterDetailsWithOpenAI({ description, context })
    : localCharacterSuggestions({ description, context });
  const suggestions = validateCharacterSuggestions(rawSuggestions);

  sendJson(res, 200, {
    suggestions,
    allowed: ALLOWED_CHARACTER_SUGGESTIONS,
    model: process.env.OPENAI_API_KEY ? CHARACTER_ANALYSIS_MODEL : "local-keyword-matcher",
  });
}

async function handleCharacterBackgroundSuggestionApi(req, res, pathname, filePath) {
  if (req.method !== "POST" && req.method !== "PUT") {
    sendMethodNotAllowed(req, res, ["POST", "PUT", "OPTIONS"], { pathname, branch: "character-background-suggestion-method-guard" });
    return;
  }

  const body = await parseJsonBody(req, { maxBodySize: 24 * 1024 });
  const suggestion = upsertSuggestionInFile(backgroundSuggestionFromPayload(body), filePath);
  const backgrounds = ALLOWED_CHARACTER_SUGGESTIONS.backgrounds || [];
  const existingIndex = backgrounds.findIndex((item) => item.id === suggestion.id);
  const nextSuggestion = {
    id: suggestion.id,
    label: suggestion.label,
    description: suggestion.description,
    mechanics: suggestion.mechanics,
    source: suggestion.source,
    tags: suggestion.tags,
  };
  if (existingIndex >= 0) backgrounds[existingIndex] = nextSuggestion;
  else backgrounds.push(nextSuggestion);
  ALLOWED_CHARACTER_SUGGESTIONS.backgrounds = backgrounds;
  sendJson(res, existingIndex >= 0 ? 200 : 201, { ok: true, suggestion: nextSuggestion });
}

async function parseJsonBody(req, options = {}) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw Object.assign(new Error("Expected application/json."), { statusCode: 415 });
  }

  const chunks = [];
  let total = 0;
  const maxBodySize = options.maxBodySize || 1024 * 1024;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBodySize) {
      throw Object.assign(new Error("JSON request body is too large."), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
}

async function suggestCharacterDetailsWithOpenAI({ description, context }) {
  const schema = characterSuggestionSchema();
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHARACTER_ANALYSIS_MODEL,
      input: [
        {
          role: "system",
          content: [
            "You analyze Dungeons & Dragons character descriptions for a DM character sheet.",
            "Return JSON only through the supplied schema.",
            "Choose only ids from the allowed lists. Do not invent backgrounds, feats, talents, racial traits, species traits, or mechanics.",
            "Use the character's personality, ideals, flaws, and backstory as evidence for mechanical recommendations.",
            "Suggest only rules-bearing or table-actionable options from the allowed background packages and feat-style talents.",
            "Do not suggest racial or species traits; those are applied automatically from the selected race or lineage.",
            "Prefer a small, high-confidence set: up to two backgrounds and two feats.",
            "If the description does not support a category, leave that category out.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            description,
            context,
            allowedSuggestions: ALLOWED_CHARACTER_SUGGESTIONS,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "character_suggestions",
          strict: true,
          schema,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || response.statusText || "OpenAI request failed.";
    throw Object.assign(new Error(`OpenAI character analysis failed: ${message}`), { statusCode: 502, code: "OPENAI_ANALYSIS_FAILED" });
  }

  const refusal = extractOpenAIRefusal(payload);
  if (refusal) {
    throw Object.assign(new Error(`OpenAI refused the character analysis request: ${refusal}`), { statusCode: 422, code: "OPENAI_REFUSAL" });
  }

  const outputText = payload?.output_text || extractOpenAIOutputText(payload);
  if (!outputText) {
    throw Object.assign(new Error("OpenAI did not return a JSON response."), { statusCode: 502, code: "OPENAI_EMPTY_OUTPUT" });
  }

  try {
    return JSON.parse(outputText);
  } catch {
    throw Object.assign(new Error("OpenAI returned invalid JSON."), { statusCode: 502, code: "OPENAI_INVALID_JSON" });
  }
}

function characterSuggestionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        maxItems: 7,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["category", "id", "confidence", "explanation"],
          properties: {
            category: { type: "string", enum: Object.keys(ALLOWED_CHARACTER_SUGGESTIONS) },
            id: { type: "string", enum: allAllowedSuggestionIds() },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            explanation: { type: "string" },
          },
        },
      },
    },
  };
}

function extractOpenAIOutputText(payload) {
  return (payload?.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text" || content.type === "text")
    .map((content) => content.text)
    .filter(Boolean)
    .join("");
}

function extractOpenAIRefusal(payload) {
  return (payload?.output || [])
    .flatMap((item) => item.content || [])
    .find((content) => content.type === "refusal")?.refusal || "";
}

function validateCharacterSuggestions(raw) {
  const seen = new Set();
  const suggestions = Array.isArray(raw?.suggestions) ? raw.suggestions : [];
  return suggestions.reduce((valid, suggestion) => {
    const category = String(suggestion?.category || "");
    const id = String(suggestion?.id || "");
    const allowed = findAllowedSuggestion(category, id);
    if (!allowed || seen.has(`${category}:${id}`)) return valid;
    seen.add(`${category}:${id}`);
    valid.push({
      category,
      id,
      label: allowed.label,
      description: allowed.description,
      mechanics: allowed.mechanics,
      source: allowed.source,
      confidence: clampNumber(suggestion.confidence, 0, 1),
      explanation: cleanShortText(suggestion.explanation) || localExplanation(category, allowed),
    });
    return valid;
  }, []);
}

function localCharacterSuggestions({ description, context }) {
  const text = `${description} ${Object.values(context || {}).join(" ")}`.toLowerCase();
  const tokens = text.match(/[a-z0-9']+/g) || [];
  const suggestions = Object.entries(ALLOWED_CHARACTER_SUGGESTIONS)
    .flatMap(([category, items]) => scoreSuggestionCategory(category, items, text, tokens))
    .sort((a, b) => b.score - a.score);
  const perCategoryLimit = { backgrounds: 2, feats: 2 };
  const used = {};
  return {
    suggestions: suggestions.filter((suggestion) => {
      if (suggestion.score <= 0) return false;
      used[suggestion.category] = used[suggestion.category] || 0;
      if (used[suggestion.category] >= perCategoryLimit[suggestion.category]) return false;
      used[suggestion.category] += 1;
      return true;
    }).map((suggestion) => ({
      category: suggestion.category,
      id: suggestion.id,
      confidence: Math.min(0.94, 0.54 + suggestion.score * 0.08),
      explanation: suggestion.explanation,
    })),
  };
}

function scoreSuggestionCategory(category, items, text, tokens) {
  return items.map((item) => {
    const matched = (item.tags || []).filter((tag) => tagMatchesText(tag, text, tokens));
    const labelWords = item.label.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
    const labelMatches = labelWords.filter((word) => tagMatchesText(word, text, tokens));
    const score = matched.length + labelMatches.length * 1.5;
    return {
      category,
      id: item.id,
      score,
      explanation: matched.length
        ? `Matched description cues: ${matched.slice(0, 3).join(", ")}.`
        : localExplanation(category, item),
    };
  });
}

function tagMatchesText(tag, text, tokens) {
  const normalized = String(tag || "").toLowerCase().trim();
  if (!normalized) return false;
  if (normalized.includes(" ")) return text.includes(normalized);
  return tokens.some((token) => token === normalized || (normalized.length > 3 && token.startsWith(normalized)));
}

function localExplanation(category, item) {
  return `${item.label} fits the ${category.replace(/s$/, "")} signals in the character description.`;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function cleanShortText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function checkCharacterAnalysisRateLimit(req) {
  const now = Date.now();
  const key = rateLimitKey(req);
  const windowMs = positiveInteger(process.env.CHARACTER_ANALYSIS_RATE_LIMIT_WINDOW_MS, CHARACTER_ANALYSIS_RATE_LIMIT_WINDOW_MS);
  const maxRequests = positiveInteger(process.env.CHARACTER_ANALYSIS_RATE_LIMIT_MAX, CHARACTER_ANALYSIS_RATE_LIMIT_MAX);
  for (const [entryKey, entry] of characterAnalysisRateLimits) {
    if (entry.resetAt <= now) characterAnalysisRateLimits.delete(entryKey);
  }

  const entry = characterAnalysisRateLimits.get(key) || {
    count: 0,
    resetAt: now + windowMs,
  };
  if (entry.resetAt <= now) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }

  entry.count += 1;
  characterAnalysisRateLimits.set(key, entry);
  if (entry.count <= maxRequests) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

function rateLimitKey(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwardedFor || req.socket?.remoteAddress || "unknown";
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

async function parseMultipart(req, options = {}) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i);
  if (!boundaryMatch) {
    throw Object.assign(new Error("Expected multipart/form-data."), { statusCode: 400 });
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const chunks = [];
  let total = 0;
  const maxBodySize = options.maxBodySize || MAX_FILE_SIZE_BYTES + 1024 * 1024;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBodySize) {
      throw Object.assign(new Error("Upload request is too large."), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks);
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = [];
  let file;
  let cursor = body.indexOf(delimiter);

  while (cursor !== -1) {
    cursor += delimiter.length;
    if (body.slice(cursor, cursor + 2).toString() === "--") break;
    if (body.slice(cursor, cursor + 2).toString() === "\r\n") cursor += 2;

    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (headerEnd === -1) break;
    const headerText = body.slice(cursor, headerEnd).toString("utf8");
    const nextDelimiter = body.indexOf(delimiter, headerEnd + 4);
    if (nextDelimiter === -1) break;

    let content = body.slice(headerEnd + 4, nextDelimiter);
    if (content.slice(-2).toString() === "\r\n") content = content.slice(0, -2);

    const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i);
    const name = disposition && disposition[1].match(/name="([^"]+)"/i);
    const filename = disposition && disposition[1].match(/filename="([^"]*)"/i);
    const type = headerText.match(/content-type:\s*([^\r\n]+)/i);

    if (name) {
      if (filename && filename[1]) {
        const parsedFile = {
          fieldName: name[1],
          originalFilename: filename[1],
          mimeType: type ? type[1].trim().toLowerCase() : "application/octet-stream",
          buffer: content,
        };
        files.push(parsedFile);
        if (!file) file = parsedFile;
      } else {
        fields[name[1]] = content.toString("utf8");
      }
    }
    cursor = nextDelimiter;
  }

  return { file, files, fields };
}

async function serveUploadedImage(req, res, requestUrl, uploadedImageStore) {
  const encodedName = requestUrl.pathname.slice("/uploads/images/".length);
  let savedFilename;
  try {
    savedFilename = decodeURIComponent(encodedName);
  } catch {
    sendText(res, 404, "Not found");
    return;
  }

  if (!/^[0-9]+-[0-9a-f-]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(savedFilename)) {
    sendText(res, 404, "Not found");
    return;
  }

  const filePath = uploadedImageStore.resolveStoredPath(savedFilename);
  try {
    const stats = await fsp.stat(filePath);
    if (!stats.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": STATIC_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stats.size,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

async function serveUploadedMapImage(req, res, requestUrl, interactiveMapStore) {
  const encodedName = requestUrl.pathname.slice("/uploads/maps/".length);
  let savedFilename;
  try {
    savedFilename = decodeURIComponent(encodedName);
  } catch {
    sendText(res, 404, "Not found");
    return;
  }

  if (!/^[0-9]+-[0-9a-f-]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(savedFilename)) {
    sendText(res, 404, "Not found");
    return;
  }

  const filePath = interactiveMapStore.resolveStoredPath(savedFilename);
  try {
    const stats = await fsp.stat(filePath);
    if (!stats.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": STATIC_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stats.size,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

async function streamMaterial(res, material, filePath) {
  try {
    const stats = await fsp.stat(filePath);
    res.writeHead(200, {
      "Content-Type": material.mimeType || "application/octet-stream",
      "Content-Length": stats.size,
      "Content-Disposition": `${isPreviewable(material.mimeType) ? "inline" : "attachment"}; filename="${encodeHeaderFilename(material.originalFilename)}"`,
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(res, 404, { error: "Stored file not found." });
      return;
    }
    throw error;
  }
}

function isPreviewable(mimeType = "") {
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/");
}

function encodeHeaderFilename(filename) {
  return String(filename).replace(/["\r\n]/g, "_");
}

async function serveStatic(req, res, requestUrl) {
  const pathname = requestUrl.pathname === "/" ? "/index.html" : decodeURIComponent(requestUrl.pathname);
  const filePath = path.resolve(PUBLIC_DIR, `.${pathname}`);
  const blockedRoots = [".git", "storage", "src", "test", "node_modules"];
  const topLevel = pathname.split("/").filter(Boolean)[0];

  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`) || blockedRoots.includes(topLevel)) {
    sendText(res, 404, "Not found");
    return;
  }

  try {
    const stats = await fsp.stat(filePath);
    if (!stats.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": STATIC_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === "ENOENT") {
      if (isFrontendRoute(pathname)) {
        await serveIndexFallback(req, res);
        return;
      }
      sendText(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

function isFrontendRoute(pathname) {
  return pathname === "/campaigns" || pathname.startsWith("/campaigns/");
}

async function serveIndexFallback(req, res) {
  const indexPath = path.join(PUBLIC_DIR, "index.html");
  res.writeHead(200, { "Content-Type": STATIC_TYPES[".html"] });
  if (req.method === "HEAD") res.end();
  else fs.createReadStream(indexPath).pipe(res);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = String(match[2] || "").replace(/^['"]|['"]$/g, "");
  }
}

if (require.main === module) {
  createServer().then((server) => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Backend listening on ${PORT}`);
      console.log(`Campaign material uploads stored in ${resolveUploadDir()}`);
      console.log(`Image uploads stored in ${resolveImageUploadDir()}`);
      console.log(`Interactive maps stored in ${resolveMapUploadDir()}`);
    });
  });
}

module.exports = { createServer, parseMultipart };
