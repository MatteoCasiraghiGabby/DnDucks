const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
loadEnvFile();

const { MaterialStore, MAX_FILE_SIZE_BYTES, resolveUploadDir } = require("./src/materialStore");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = process.cwd();
const store = new MaterialStore(resolveUploadDir());

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

async function createServer(materialStore = store) {
  await materialStore.ensureReady();

  return http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      if (requestUrl.pathname.startsWith("/api/materials")) {
        await handleMaterialsApi(req, res, requestUrl, materialStore);
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        await serveStatic(req, res, requestUrl);
        return;
      }

      sendJson(res, 405, { error: "Method not allowed." });
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) console.error(error);
      sendJson(res, error.statusCode || 500, { error: error.message || "Unexpected server error." });
    }
  });
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

async function parseMultipart(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i);
  if (!boundaryMatch) {
    throw Object.assign(new Error("Expected multipart/form-data."), { statusCode: 400 });
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const chunks = [];
  let total = 0;
  const maxBodySize = MAX_FILE_SIZE_BYTES + 1024 * 1024;

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
        file = {
          fieldName: name[1],
          originalFilename: filename[1],
          mimeType: type ? type[1].trim().toLowerCase() : "application/octet-stream",
          buffer: content,
        };
      } else {
        fields[name[1]] = content.toString("utf8");
      }
    }
    cursor = nextDelimiter;
  }

  return { file, fields };
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
      sendText(res, 404, "Not found");
      return;
    }
    throw error;
  }
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
    });
  });
}

module.exports = { createServer, parseMultipart };
