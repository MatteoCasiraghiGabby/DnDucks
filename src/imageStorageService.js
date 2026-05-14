const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_IMAGE_UPLOAD_DIR = "./uploads/images";
const IMAGE_UPLOAD_MAX_BYTES = Number(process.env.IMAGE_UPLOAD_MAX_BYTES || process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const IMAGE_UPLOAD_MAX_FILES = Number(process.env.IMAGE_UPLOAD_MAX_FILES || 12);
const IMAGE_UPLOAD_FIELD_NAMES = new Set(["image", "images", "file", "files"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function resolveImageUploadDir(uploadDir = process.env.IMAGE_UPLOAD_DIR || DEFAULT_IMAGE_UPLOAD_DIR) {
  return path.resolve(process.cwd(), uploadDir);
}

function sanitizeOriginalFilename(filename) {
  const basename = path.basename(String(filename || "")).replace(/[\0\r\n]/g, "").trim();
  return basename.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(0, 180);
}

function imageExtensionFor(mimeType, extension) {
  if (extension === ".jpg") return ".jpg";
  if (ALLOWED_IMAGE_EXTENSIONS.has(extension)) return extension;
  return {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  }[mimeType] || "";
}

function validateImageUpload(file) {
  const original = String(file?.originalFilename || "").trim();
  const safeOriginal = sanitizeOriginalFilename(original);
  if (!safeOriginal || safeOriginal === "." || safeOriginal === "..") {
    throw Object.assign(new Error("An image filename is required."), { statusCode: 400, code: "MISSING_IMAGE_FILENAME" });
  }
  if (safeOriginal !== original || original.includes("/") || original.includes("\\")) {
    throw Object.assign(new Error("Unsafe filenames and paths are not allowed."), { statusCode: 400, code: "UNSAFE_IMAGE_FILENAME" });
  }

  const mimeType = String(file.mimeType || "").toLowerCase();
  const extension = path.extname(safeOriginal).toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType) || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    throw Object.assign(new Error("Only jpg, jpeg, png, webp, and gif images are allowed."), { statusCode: 415, code: "INVALID_IMAGE_TYPE" });
  }

  const size = file.buffer?.length || 0;
  if (!size) {
    throw Object.assign(new Error("Uploaded image is empty."), { statusCode: 400, code: "EMPTY_IMAGE" });
  }
  if (size > IMAGE_UPLOAD_MAX_BYTES) {
    throw Object.assign(new Error(`Images must be ${IMAGE_UPLOAD_MAX_BYTES} bytes or smaller.`), { statusCode: 413, code: "IMAGE_TOO_LARGE" });
  }

  return { safeOriginal, extension: imageExtensionFor(mimeType, extension), mimeType, size };
}

class ImageStorageService {
  constructor(uploadDir = resolveImageUploadDir()) {
    this.uploadDir = uploadDir;
  }

  async ensureReady() {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  resolveStoredPath(savedFilename) {
    const fullPath = path.resolve(this.uploadDir, savedFilename);
    if (!fullPath.startsWith(`${this.uploadDir}${path.sep}`)) {
      throw Object.assign(new Error("Stored image path is outside upload directory."), { statusCode: 400 });
    }
    return fullPath;
  }

  async save(file) {
    const { safeOriginal, extension, mimeType, size } = validateImageUpload(file);
    const savedFilename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const destination = this.resolveStoredPath(savedFilename);
    await fs.writeFile(destination, file.buffer, { flag: "wx" });
    return {
      originalFilename: safeOriginal,
      savedFilename,
      url: `/uploads/images/${encodeURIComponent(savedFilename)}`,
      path: `/uploads/images/${savedFilename}`,
      fileSize: size,
      mimeType,
      uploadedAt: new Date().toISOString(),
    };
  }

  async saveMany(files) {
    const imageFiles = files.filter((file) => IMAGE_UPLOAD_FIELD_NAMES.has(file.fieldName));
    if (!imageFiles.length) {
      throw Object.assign(new Error("Upload requires at least one image field named images, image, files, or file."), { statusCode: 400, code: "MISSING_IMAGES" });
    }
    if (imageFiles.length > IMAGE_UPLOAD_MAX_FILES) {
      throw Object.assign(new Error(`Upload up to ${IMAGE_UPLOAD_MAX_FILES} images at a time.`), { statusCode: 400, code: "TOO_MANY_IMAGES" });
    }

    const saved = [];
    try {
      for (const file of imageFiles) saved.push(await this.save(file));
      return saved;
    } catch (error) {
      await Promise.all(saved.map((image) => fs.unlink(this.resolveStoredPath(image.savedFilename)).catch(() => {})));
      throw error;
    }
  }
}

module.exports = {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  IMAGE_UPLOAD_FIELD_NAMES,
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_MAX_FILES,
  ImageStorageService,
  resolveImageUploadDir,
  sanitizeOriginalFilename,
  validateImageUpload,
};
