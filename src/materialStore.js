const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_UPLOAD_DIR = "./storage/uploads";
const MAX_FILE_SIZE_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 10 * 1024 * 1024);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".txt", ".md", ".json", ".csv"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "application/csv",
  "application/octet-stream",
]);

function resolveUploadDir(uploadDir = process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR) {
  return path.resolve(process.cwd(), uploadDir);
}

function sanitizeOriginalFilename(filename) {
  const basename = path.basename(String(filename || "")).replace(/[\0\r\n]/g, "").trim();
  return basename.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(0, 180);
}

function assertSafeFilename(originalFilename) {
  const filename = sanitizeOriginalFilename(originalFilename);
  if (!filename || filename === "." || filename === "..") {
    throw Object.assign(new Error("A safe filename is required."), { statusCode: 400 });
  }
  if (filename !== String(originalFilename || "").trim() || originalFilename.includes("/") || originalFilename.includes("\\")) {
    throw Object.assign(new Error("Unsafe filenames and paths are not allowed."), { statusCode: 400 });
  }
  return filename;
}

function validateUpload({ originalFilename, mimeType, fileSize }) {
  const safeOriginal = assertSafeFilename(originalFilename);
  const extension = path.extname(safeOriginal).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw Object.assign(new Error("Unsupported file type."), { statusCode: 415 });
  }
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw Object.assign(new Error("Unsupported content type."), { statusCode: 415 });
  }
  if (!fileSize || fileSize > MAX_FILE_SIZE_BYTES) {
    throw Object.assign(new Error(`File must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes.`), { statusCode: 413 });
  }
  return { safeOriginal, extension };
}

class MaterialStore {
  constructor(uploadDir = resolveUploadDir()) {
    this.uploadDir = uploadDir;
    this.indexPath = path.join(uploadDir, "index.json");
  }

  async ensureReady() {
    await fs.mkdir(this.uploadDir, { recursive: true });
    try {
      await fs.access(this.indexPath);
    } catch {
      await fs.writeFile(this.indexPath, "[]\n");
    }
  }

  async readAll() {
    await this.ensureReady();
    try {
      const raw = await fs.readFile(this.indexPath, "utf8");
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async writeAll(materials) {
    await this.ensureReady();
    await fs.writeFile(this.indexPath, `${JSON.stringify(materials, null, 2)}\n`);
  }

  async list(filters = {}) {
    const materials = await this.readAll();
    return materials.filter((material) => {
      if (filters.campaignId && material.campaignId !== filters.campaignId) return false;
      if (filters.sessionId && material.sessionId !== filters.sessionId) return false;
      return true;
    });
  }

  async get(id) {
    const materials = await this.readAll();
    return materials.find((material) => material.id === id) || null;
  }

  async create({ file, fields = {} }) {
    const { safeOriginal, extension } = validateUpload({
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      fileSize: file.buffer.length,
    });
    const id = crypto.randomUUID();
    const storedFilename = `${Date.now()}-${id}${extension}`;
    const relativePath = storedFilename;
    const destination = this.resolveStoredPath(storedFilename);
    await fs.writeFile(destination, file.buffer, { flag: "wx" });

    const material = {
      id,
      campaignId: cleanOptional(fields.campaignId),
      sessionId: cleanOptional(fields.sessionId),
      originalFilename: safeOriginal,
      storedFilename,
      mimeType: file.mimeType || "application/octet-stream",
      fileSize: file.buffer.length,
      relativePath,
      downloadUrl: `/api/materials/${id}/download`,
      publicUrl: `/api/materials/${id}/download`,
      uploadedAt: new Date().toISOString(),
      title: cleanOptional(fields.title) || safeOriginal,
      description: cleanOptional(fields.description),
      tags: parseTags(fields.tags),
      category: cleanOptional(fields.category) || inferCategory(file.mimeType, extension),
    };

    const materials = await this.readAll();
    materials.unshift(material);
    await this.writeAll(materials);
    return material;
  }

  resolveStoredPath(storedFilename) {
    const fullPath = path.resolve(this.uploadDir, storedFilename);
    if (!fullPath.startsWith(`${this.uploadDir}${path.sep}`)) {
      throw Object.assign(new Error("Stored path is outside upload directory."), { statusCode: 400 });
    }
    return fullPath;
  }

  async filePathFor(id) {
    const material = await this.get(id);
    if (!material) return null;
    const filePath = this.resolveStoredPath(material.storedFilename);
    return { material, filePath };
  }

  async delete(id) {
    const materials = await this.readAll();
    const material = materials.find((item) => item.id === id);
    if (!material) return false;
    const remaining = materials.filter((item) => item.id !== id);
    await this.writeAll(remaining);
    try {
      await fs.unlink(this.resolveStoredPath(material.storedFilename));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return true;
  }
}

function cleanOptional(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 240) : undefined;
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function inferCategory(mimeType, extension) {
  if (String(mimeType || "").startsWith("image/")) return "image";
  if (extension === ".pdf") return "handout";
  if ([".txt", ".md"].includes(extension)) return "note";
  if ([".json", ".csv"].includes(extension)) return "data";
  return "other";
}

module.exports = {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MaterialStore,
  resolveUploadDir,
  sanitizeOriginalFilename,
  validateUpload,
};
