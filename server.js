const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
loadEnvFile();

const { MaterialStore, MAX_FILE_SIZE_BYTES, resolveUploadDir } = require("./src/materialStore");
const { ImageStorageService, IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MAX_FILES, resolveImageUploadDir } = require("./src/imageStorageService");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = process.cwd();
const store = new MaterialStore(resolveUploadDir());
const imageStore = new ImageStorageService(resolveImageUploadDir());

const JSON_BODY_LIMIT_BYTES = 64 * 1024;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ANALYSIS_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 15000);
const API_CORS_ORIGIN = process.env.CORS_ORIGIN || "*";


const BACKGROUND_REFERENCES = [
  { name: "Acolyte", keywords: ["temple", "shrine", "faith", "priest", "god", "religion", "cult"], feature: "Shelter of the Faithful", skills: ["insight", "religion"], languages: 2, icon: "⛪" },
  { name: "Charlatan", keywords: ["con", "false identity", "disguise", "scam", "forgery", "trick"], feature: "False Identity", skills: ["deception", "sleightOfHand"], tools: ["disguiseKit", "forgeryKit"], icon: "🎭" },
  { name: "Criminal", keywords: ["thief", "crime", "gang", "spy", "smuggler", "blackmail", "underworld"], feature: "Criminal Contact", skills: ["deception", "stealth"], tools: ["thievesTools", "gamingSet"], icon: "🗝️" },
  { name: "Entertainer", keywords: ["perform", "stage", "music", "dance", "circus", "actor", "bard"], feature: "By Popular Demand", skills: ["acrobatics", "performance"], tools: ["disguiseKit", "musicalInstrument"], icon: "🎻" },
  { name: "Folk Hero", keywords: ["village", "common folk", "tyrant", "rebel", "hero", "farm", "humble"], feature: "Rustic Hospitality", skills: ["animalHandling", "survival"], tools: ["artisanTools", "vehiclesLand"], icon: "🌾" },
  { name: "Guild Artisan", keywords: ["guild", "craft", "merchant", "artisan", "trade", "apprentice"], feature: "Guild Membership", skills: ["insight", "persuasion"], tools: ["artisanTools"], languages: 1, icon: "⚒️" },
  { name: "Hermit", keywords: ["hermit", "exile", "secluded", "monastery", "revelation", "alone"], feature: "Discovery", skills: ["medicine", "religion"], tools: ["herbalismKit"], languages: 1, icon: "🕯️" },
  { name: "Noble", keywords: ["noble", "lord", "lady", "court", "estate", "heir", "aristocrat"], feature: "Position of Privilege", skills: ["history", "persuasion"], tools: ["gamingSet"], languages: 1, icon: "👑" },
  { name: "Outlander", keywords: ["wild", "wilderness", "tribe", "nomad", "hunter", "frontier", "exile"], feature: "Wanderer", skills: ["athletics", "survival"], tools: ["musicalInstrument"], languages: 1, icon: "🏕️" },
  { name: "Sage", keywords: ["scholar", "library", "study", "arcane", "wizard", "research", "student"], feature: "Researcher", skills: ["arcana", "history"], languages: 2, icon: "📚" },
  { name: "Sailor", keywords: ["ship", "sea", "sailor", "pirate", "crew", "harbor", "ocean"], feature: "Ship's Passage", skills: ["athletics", "perception"], tools: ["navigatorTools", "vehiclesWater"], icon: "⚓" },
  { name: "Soldier", keywords: ["army", "war", "battle", "soldier", "guard", "mercenary", "veteran"], feature: "Military Rank", skills: ["athletics", "intimidation"], tools: ["gamingSet", "vehiclesLand"], icon: "🛡️" },
  { name: "Urchin", keywords: ["street", "orphan", "city", "urchin", "beggar", "rooftop", "alley"], feature: "City Secrets", skills: ["sleightOfHand", "stealth"], tools: ["disguiseKit", "thievesTools"], icon: "🏙️" },
];

const TRAIT_PATTERNS = [
  { key: "traits", label: "Personality Traits", icon: "✨", patterns: ["curious", "brave", "kind", "sarcastic", "honest", "quiet", "reckless", "patient", "suspicious", "cheerful"] },
  { key: "ideals", label: "Ideals", icon: "🧭", patterns: ["freedom", "justice", "faith", "power", "knowledge", "redemption", "tradition", "change", "charity", "glory"] },
  { key: "bonds", label: "Bonds", icon: "🔗", patterns: ["family", "mentor", "friend", "home", "village", "temple", "guild", "crew", "sibling", "parent"] },
  { key: "flaws", label: "Flaws", icon: "⚠️", patterns: ["greedy", "vengeful", "coward", "secret", "debt", "addict", "arrogant", "impulsive", "haunted", "fear"] },
];

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

async function createServer(materialStore = store, uploadedImageStore = imageStore) {
  await Promise.all([materialStore.ensureReady(), uploadedImageStore.ensureReady()]);

  return http.createServer(async (req, res) => {
    let pathname = "";
    try {
      console.log("[REQ]", req.method, req.url);
      const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      pathname = normalizeApiPathname(requestUrl.pathname);
      console.log("[ROUTE]", { method: req.method, url: req.url, pathname });
      res.on("finish", () => {
        console.log("[RES]", { method: req.method, url: req.url, pathname, status: res.statusCode, branch: res.getHeader("X-Route-Branch") || "unknown" });
      });

      if (pathname.startsWith("/api/")) setApiCorsHeaders(req, res);
      if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
        res.setHeader("X-Route-Branch", "api-preflight");
        res.writeHead(204);
        res.end();
        return;
      }

      if (pathname === "/api/characters/analyze" || pathname === "/characters/analyze") {
        const branch = pathname.startsWith("/api/") ? "character-analysis-route" : "character-analysis-alias-route";
        if (!pathname.startsWith("/api/")) setApiCorsHeaders(req, res);
        res.setHeader("X-Route-Branch", branch);
        await handleCharacterAnalysisApi(req, res, pathname);
        return;
      }

      if (pathname === "/api/uploads/images") {
        res.setHeader("X-Route-Branch", "image-upload-route");
        await handleImageUploadsApi(req, res, uploadedImageStore, pathname);
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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Vary", "Origin");
}

async function handleImageUploadsApi(req, res, uploadedImageStore, pathname) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(req, res, ["POST", "OPTIONS"], { pathname, branch: "image-upload-method-guard" });
    return;
  }

  const { files } = await parseMultipart(req, {
    maxBodySize: IMAGE_UPLOAD_MAX_BYTES * IMAGE_UPLOAD_MAX_FILES + 1024 * 1024,
  });
  const images = await uploadedImageStore.saveMany(files);
  sendJson(res, 201, { images, count: images.length });
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
  const requestId = makeRequestId();
  if (req.method !== "POST") {
    sendMethodNotAllowed(req, res, ["POST", "OPTIONS"], { pathname, branch: "character-analysis-method-guard", requestId });
    return;
  }

  const payload = await parseJsonBody(req, { requestId });
  validateCharacterAnalysisPayload(payload, requestId);
  const storyText = getCharacterStoryText(payload);
  if (!storyText) {
    console.info(`[analysis:${requestId}] rejected empty story text`);
    sendJson(res, 400, { error: "Add personality or story text before completing the character widget.", code: "EMPTY_STORY", requestId });
    return;
  }

  console.info(`[analysis:${requestId}] received story analysis request storyChars=${storyText.length} hasOpenAIKey=${Boolean(process.env.OPENAI_API_KEY)} model=${OPENAI_MODEL}`);
  const fallback = analyzeCharacterStoryLocally(payload);
  const aiAnalysis = await analyzeCharacterStoryWithOpenAI(payload, fallback, requestId);
  const analysis = aiAnalysis || fallback;
  console.info(`[analysis:${requestId}] completed source=${analysis.source} background=${analysis.background || "unknown"}`);
  sendJson(res, 200, { ...analysis, requestId });
}

function validateCharacterAnalysisPayload(payload, requestId) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw Object.assign(new Error("Character analysis request body must be a JSON object."), { statusCode: 400, code: "INVALID_ANALYSIS_PAYLOAD", requestId });
  }
}

function getCharacterStoryText(payload = {}) {
  return [payload.text, payload.description, payload.traits, payload.ideals, payload.bonds, payload.flaws, payload.notes]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function makeRequestId() {
  return `analysis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function parseJsonBody(req, options = {}) {
  const contentType = req.headers["content-type"] || "";
  const errorMetadata = options.requestId ? { requestId: options.requestId } : {};
  if (!contentType.toLowerCase().includes("application/json")) {
    throw Object.assign(new Error("Expected application/json."), { statusCode: 400, code: "INVALID_CONTENT_TYPE", ...errorMetadata });
  }
  const chunks = [];
  let total = 0;
  const maxBodySize = options.maxBodySize || JSON_BODY_LIMIT_BYTES;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBodySize) throw Object.assign(new Error("JSON request is too large."), { statusCode: 413, code: "JSON_TOO_LARGE", ...errorMetadata });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw Object.assign(new Error("Could not parse JSON request body."), { statusCode: 400, code: "INVALID_JSON", ...errorMetadata });
  }
}

async function analyzeCharacterStoryWithOpenAI(payload, fallback, requestId = "unknown") {
  if (!process.env.OPENAI_API_KEY) {
    console.info(`[analysis:${requestId}] OPENAI_API_KEY not configured; using local SRD fallback`);
    return null;
  }
  if (typeof fetch !== "function") {
    console.warn(`[analysis:${requestId}] global fetch is unavailable; using local SRD fallback`);
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: "You complete D&D 5e character sheet widgets from player-written story. Use SRD/basic-rules style categories only. Return strict JSON matching the provided fallback shape. Keep text concise, do not quote rulebook passages, and prefer inferred options that match the story.",
          },
          {
            role: "user",
            content: JSON.stringify({ character: payload, fallback, validBackgrounds: BACKGROUND_REFERENCES.map(({ name, feature, skills, icon }) => ({ name, feature, skills, icon })) }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "character_story_analysis",
            strict: true,
            schema: characterAnalysisJsonSchema(),
          },
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const providerError = await safeReadProviderError(response);
      console.warn(`[analysis:${requestId}] OpenAI request failed status=${response.status} code=${providerError.code || "unknown"}; using local SRD fallback`);
      return null;
    }
    const data = await response.json();
    const content = extractOpenAIText(data);
    if (!content) {
      console.warn(`[analysis:${requestId}] OpenAI response did not contain output text; using local SRD fallback`);
      return null;
    }
    return normalizeCharacterAnalysis(JSON.parse(content), fallback);
  } catch (error) {
    console.warn(`[analysis:${requestId}] OpenAI analysis error=${error.name || "Error"}: ${error.message}; using local SRD fallback`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function safeReadProviderError(response) {
  try {
    const payload = await response.json();
    return {
      code: payload?.error?.code || payload?.error?.type || "",
      message: payload?.error?.message || "",
    };
  } catch {
    return { code: "", message: "" };
  }
}

function extractOpenAIText(data = {}) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((item) => item.text || item.output_text || "")
    .filter(Boolean)
    .join("\n");
}

function analyzeCharacterStoryLocally(payload = {}) {
  const text = [payload.text, payload.description, payload.traits, payload.ideals, payload.bonds, payload.flaws, payload.notes]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  const lower = text.toLowerCase();
  const scoredBackgrounds = BACKGROUND_REFERENCES.map((background) => ({
    ...background,
    score: background.keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const background = scoredBackgrounds[0]?.score ? scoredBackgrounds[0] : BACKGROUND_REFERENCES.find((item) => item.name === "Folk Hero");
  const fields = Object.fromEntries(TRAIT_PATTERNS.map((group) => {
    const matched = group.patterns.filter((pattern) => lower.includes(pattern));
    return [group.key, String(payload[group.key] || "").trim() || (matched.length ? `${group.icon} ${matched.slice(0, 3).join(", ")}` : "")];
  }));
  const featureLines = [
    `${background.icon} Background: ${background.name}`,
    `🎖️ Background feature: ${background.feature}`,
    ...(background.skills || []).map((skill) => `✅ Skill proficiency: ${skill}`),
    ...(background.tools || []).map((tool) => `🧰 Tool proficiency: ${tool}`),
    ...(background.languages ? [`🗣️ Choose ${background.languages} extra language${background.languages > 1 ? "s" : ""}`] : []),
  ];
  return normalizeCharacterAnalysis({
    background: background.name,
    backgroundFeature: background.feature,
    confidence: Math.min(0.95, 0.55 + (background.score * 0.1)),
    ...fields,
    features: featureLines.join("\n"),
    suggestedSkills: background.skills || [],
    suggestedTools: background.tools || [],
    suggestedLanguages: background.languages || 0,
    icons: [background.icon, "✨", "🧭", "🔗", "⚠️"],
    summary: `Matched the story to the ${background.name} background and prepared SRD-style personality, feature, proficiency, and language prompts.`,
    source: "local-srd-reference",
  });
}

function normalizeCharacterAnalysis(analysis = {}, fallback = {}) {
  return {
    background: String(analysis.background || fallback.background || "").slice(0, 80),
    backgroundFeature: String(analysis.backgroundFeature || fallback.backgroundFeature || "").slice(0, 120),
    traits: String(analysis.traits || fallback.traits || "").slice(0, 600),
    ideals: String(analysis.ideals || fallback.ideals || "").slice(0, 600),
    bonds: String(analysis.bonds || fallback.bonds || "").slice(0, 600),
    flaws: String(analysis.flaws || fallback.flaws || "").slice(0, 600),
    features: String(analysis.features || fallback.features || "").slice(0, 1600),
    suggestedSkills: sanitizeStringArray(analysis.suggestedSkills || fallback.suggestedSkills),
    suggestedTools: sanitizeStringArray(analysis.suggestedTools || fallback.suggestedTools),
    suggestedLanguages: Math.max(0, Math.min(3, Number(analysis.suggestedLanguages || fallback.suggestedLanguages || 0))),
    icons: sanitizeStringArray(analysis.icons || fallback.icons).slice(0, 8),
    summary: String(analysis.summary || fallback.summary || "").slice(0, 500),
    confidence: Math.max(0, Math.min(1, Number(analysis.confidence || fallback.confidence || 0.5))),
    source: String(analysis.source || fallback.source || "openai").slice(0, 80),
  };
}

function sanitizeStringArray(values = []) {
  return Array.isArray(values) ? values.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 12) : [];
}

function characterAnalysisJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      background: { type: "string" },
      backgroundFeature: { type: "string" },
      traits: { type: "string" },
      ideals: { type: "string" },
      bonds: { type: "string" },
      flaws: { type: "string" },
      features: { type: "string" },
      suggestedSkills: { type: "array", items: { type: "string" } },
      suggestedTools: { type: "array", items: { type: "string" } },
      suggestedLanguages: { type: "number" },
      icons: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      confidence: { type: "number" },
      source: { type: "string" },
    },
    required: ["background", "backgroundFeature", "traits", "ideals", "bonds", "flaws", "features", "suggestedSkills", "suggestedTools", "suggestedLanguages", "icons", "summary", "confidence", "source"],
  };
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
    server.listen(PORT, () => {
      console.log(`DnDucks running at http://localhost:${PORT}`);
      console.log(`Campaign material uploads stored in ${resolveUploadDir()}`);
      console.log(`Image uploads stored in ${resolveImageUploadDir()}`);
    });
  });
}

module.exports = { createServer, parseMultipart, analyzeCharacterStoryLocally };
