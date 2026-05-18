const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_MAP_UPLOAD_DIR = "./uploads/maps";
const MAP_METADATA_FILENAME = "index.json";
const MAP_UPLOAD_MAX_BYTES = Number(process.env.MAP_UPLOAD_MAX_BYTES || process.env.UPLOAD_MAX_BYTES || 12 * 1024 * 1024);
const MAP_UPLOAD_FIELD_NAMES = new Set(["map", "image", "file"]);
const ALLOWED_MAP_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const ALLOWED_MAP_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAP_STATUSES = new Set(["uploaded", "processing", "ready", "failed"]);

function resolveMapUploadDir(uploadDir = process.env.MAP_UPLOAD_DIR || DEFAULT_MAP_UPLOAD_DIR) {
  return path.resolve(process.cwd(), uploadDir);
}

function sanitizeOriginalFilename(filename) {
  const basename = path.basename(String(filename || "")).replace(/[\0\r\n]/g, "").trim();
  return basename.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(0, 180);
}

function cleanText(value, maxLength = 240) {
  return String(value || "").replace(/[\0\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function mapExtensionFor(mimeType, extension) {
  if (extension === ".jpg") return ".jpg";
  if (ALLOWED_MAP_EXTENSIONS.has(extension)) return extension;
  return {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  }[mimeType] || "";
}

function validateMapUpload(file) {
  const original = String(file?.originalFilename || "").trim();
  const safeOriginal = sanitizeOriginalFilename(original);
  if (!safeOriginal || safeOriginal === "." || safeOriginal === "..") {
    throw Object.assign(new Error("A map image filename is required."), { statusCode: 400, code: "MISSING_MAP_FILENAME" });
  }
  if (safeOriginal !== original || original.includes("/") || original.includes("\\")) {
    throw Object.assign(new Error("Unsafe filenames and paths are not allowed for map uploads."), { statusCode: 400, code: "UNSAFE_MAP_FILENAME" });
  }

  const mimeType = String(file.mimeType || "").toLowerCase();
  const extension = path.extname(safeOriginal).toLowerCase();
  if (!ALLOWED_MAP_MIME_TYPES.has(mimeType) || !ALLOWED_MAP_EXTENSIONS.has(extension)) {
    throw Object.assign(new Error("Only jpg, jpeg, png, webp, and gif map images are allowed."), { statusCode: 415, code: "INVALID_MAP_TYPE" });
  }

  const size = file.buffer?.length || 0;
  if (!size) {
    throw Object.assign(new Error("Uploaded map image is empty."), { statusCode: 400, code: "EMPTY_MAP_IMAGE" });
  }
  if (size > MAP_UPLOAD_MAX_BYTES) {
    throw Object.assign(new Error(`Map images must be ${MAP_UPLOAD_MAX_BYTES} bytes or smaller.`), { statusCode: 413, code: "MAP_IMAGE_TOO_LARGE" });
  }

  return { safeOriginal, extension: mapExtensionFor(mimeType, extension), mimeType, size };
}

function mapPublicUrl(savedFilename) {
  return `/uploads/maps/${encodeURIComponent(savedFilename)}`;
}

function readImageDimensions(buffer, mimeType = "") {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) return { width: 0, height: 0 };

  if (mimeType === "image/png" && buffer.length >= 24 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (mimeType === "image/gif" && buffer.length >= 10 && ["GIF87a", "GIF89a"].includes(buffer.slice(0, 6).toString("ascii"))) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  if (mimeType === "image/webp" && buffer.length >= 30 && buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") {
    const chunk = buffer.slice(12, 16).toString("ascii");
    if (chunk === "VP8X" && buffer.length >= 30) {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
    if (chunk === "VP8 " && buffer.length >= 30) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
  }

  if (mimeType === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }

  return { width: 0, height: 0 };
}

function normalizeMetadata(raw) {
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    return {
      maps: Array.isArray(raw.maps) ? raw.maps.filter((map) => map?.id && map?.savedFilename) : [],
      cities: Array.isArray(raw.cities) ? raw.cities.filter((city) => city?.id && city?.mapId) : [],
      notes: Array.isArray(raw.notes) ? raw.notes.filter((note) => note?.id && note?.mapCityId) : [],
    };
  }
  return { maps: [], cities: [], notes: [] };
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function coordinateSet(fields, map) {
  const imageWidth = Number(map.imageWidth) || 0;
  const imageHeight = Number(map.imageHeight) || 0;
  const hasNormalized = fields.normalizedX !== undefined || fields.normalizedY !== undefined;
  let normalizedX = hasNormalized && fields.normalizedX !== undefined ? clamp(fields.normalizedX, 0, 1) : null;
  let normalizedY = hasNormalized && fields.normalizedY !== undefined ? clamp(fields.normalizedY, 0, 1) : null;
  let x = fields.x !== undefined ? clamp(fields.x, 0, imageWidth || Number.MAX_SAFE_INTEGER) : null;
  let y = fields.y !== undefined ? clamp(fields.y, 0, imageHeight || Number.MAX_SAFE_INTEGER) : null;

  if (normalizedX === null && x !== null && imageWidth) normalizedX = clamp(x / imageWidth, 0, 1);
  if (normalizedY === null && y !== null && imageHeight) normalizedY = clamp(y / imageHeight, 0, 1);
  if (hasNormalized && normalizedX !== null && imageWidth) x = Math.round(normalizedX * imageWidth);
  if (hasNormalized && normalizedY !== null && imageHeight) y = Math.round(normalizedY * imageHeight);
  if (x === null && normalizedX !== null && imageWidth) x = Math.round(normalizedX * imageWidth);
  if (y === null && normalizedY !== null && imageHeight) y = Math.round(normalizedY * imageHeight);

  if (normalizedX === null || normalizedY === null) {
    throw Object.assign(new Error("City pins require x/y coordinates or normalized coordinates."), { statusCode: 400, code: "MISSING_CITY_COORDINATES" });
  }

  return {
    x: Math.round(x ?? normalizedX),
    y: Math.round(y ?? normalizedY),
    normalizedX,
    normalizedY,
  };
}

class MapStorageService {
  constructor(uploadDir = resolveMapUploadDir()) {
    this.uploadDir = uploadDir;
    this.indexPath = path.join(uploadDir, MAP_METADATA_FILENAME);
    this.metadataQueue = Promise.resolve();
  }

  async ensureReady() {
    await fs.mkdir(this.uploadDir, { recursive: true });
    try {
      await fs.access(this.indexPath);
    } catch {
      await this.writeAll({ maps: [], cities: [], notes: [] });
    }
  }

  async withMetadataLock(operation) {
    const run = this.metadataQueue.then(operation, operation);
    this.metadataQueue = run.catch(() => {});
    return run;
  }

  resolveStoredPath(savedFilename) {
    const fullPath = path.resolve(this.uploadDir, savedFilename);
    if (!fullPath.startsWith(`${this.uploadDir}${path.sep}`)) {
      throw Object.assign(new Error("Stored map path is outside upload directory."), { statusCode: 400 });
    }
    return fullPath;
  }

  async readAll() {
    await this.ensureReady();
    try {
      const raw = await fs.readFile(this.indexPath, "utf8");
      return normalizeMetadata(JSON.parse(raw || "{}"));
    } catch (error) {
      if (error.code === "ENOENT") return { maps: [], cities: [], notes: [] };
      if (error instanceof SyntaxError) {
        throw Object.assign(new Error("Map metadata index is corrupted."), { statusCode: 500, code: "MAP_INDEX_CORRUPTED" });
      }
      throw error;
    }
  }

  async writeAll(records) {
    await fs.mkdir(this.uploadDir, { recursive: true });
    const tempPath = `${this.indexPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(normalizeMetadata(records), null, 2)}\n`);
    await fs.rename(tempPath, this.indexPath);
  }

  async createMap({ file, fields = {} }) {
    const { safeOriginal, extension, mimeType, size } = validateMapUpload(file);
    const id = crypto.randomUUID();
    const savedFilename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const destination = this.resolveStoredPath(savedFilename);
    const dimensions = readImageDimensions(file.buffer, mimeType);
    const now = new Date().toISOString();
    const map = {
      id,
      title: cleanText(fields.title || fields.name || safeOriginal),
      originalFilename: safeOriginal,
      savedFilename,
      imageUrl: mapPublicUrl(savedFilename),
      storedImagePath: `/uploads/maps/${savedFilename}`,
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,
      fileSize: size,
      mimeType,
      status: "uploaded",
      createdAt: now,
      updatedAt: now,
    };

    await fs.writeFile(destination, file.buffer, { flag: "wx" });
    try {
      await this.withMetadataLock(async () => {
        const records = await this.readAll();
        records.maps.unshift(map);
        await this.writeAll(records);
      });
    } catch (error) {
      await fs.unlink(destination).catch(() => {});
      throw error;
    }
    return map;
  }

  async listMaps() {
    const records = await this.readAll();
    return records.maps;
  }

  async getMap(id) {
    const records = await this.readAll();
    return records.maps.find((map) => map.id === id) || null;
  }

  async updateMapStatus(id, status) {
    if (!MAP_STATUSES.has(status)) {
      throw Object.assign(new Error("Invalid map status."), { statusCode: 400, code: "INVALID_MAP_STATUS" });
    }
    return this.withMetadataLock(async () => {
      const records = await this.readAll();
      const index = records.maps.findIndex((map) => map.id === id);
      if (index === -1) return null;
      records.maps[index] = { ...records.maps[index], status, updatedAt: new Date().toISOString() };
      await this.writeAll(records);
      return records.maps[index];
    });
  }

  async deleteMap(id) {
    return this.withMetadataLock(async () => {
      const records = await this.readAll();
      const map = records.maps.find((item) => item.id === id);
      if (!map) return null;
      records.maps = records.maps.filter((item) => item.id !== id);
      const cityIds = new Set(records.cities.filter((city) => city.mapId === id).map((city) => city.id));
      records.cities = records.cities.filter((city) => city.mapId !== id);
      records.notes = records.notes.filter((note) => !cityIds.has(note.mapCityId));
      await this.writeAll(records);
      await fs.unlink(this.resolveStoredPath(map.savedFilename)).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
      return map;
    });
  }

  async listCities(mapId) {
    const records = await this.readAll();
    return records.cities.filter((city) => city.mapId === mapId);
  }

  async getCity(mapId, cityId) {
    const records = await this.readAll();
    return records.cities.find((city) => city.mapId === mapId && city.id === cityId) || null;
  }

  async createCity(mapId, fields = {}) {
    return this.withMetadataLock(async () => {
      const records = await this.readAll();
      const map = records.maps.find((item) => item.id === mapId);
      if (!map) return null;
      const cityName = cleanText(fields.cityName || fields.name, 120);
      if (!cityName) {
        throw Object.assign(new Error("City name is required."), { statusCode: 400, code: "MISSING_CITY_NAME" });
      }
      const now = new Date().toISOString();
      const city = {
        id: crypto.randomUUID(),
        mapId,
        cityName,
        ...coordinateSet(fields, map),
        ...(fields.confidence !== undefined ? { confidence: clamp(fields.confidence, 0, 1) } : {}),
        createdAt: now,
        updatedAt: now,
      };
      records.cities.push(city);
      await this.writeAll(records);
      return city;
    });
  }

  async updateCity(mapId, cityId, fields = {}) {
    return this.withMetadataLock(async () => {
      const records = await this.readAll();
      const map = records.maps.find((item) => item.id === mapId);
      const index = records.cities.findIndex((city) => city.mapId === mapId && city.id === cityId);
      if (!map || index === -1) return null;
      const next = { ...records.cities[index] };
      if (fields.cityName !== undefined || fields.name !== undefined) {
        const cityName = cleanText(fields.cityName || fields.name, 120);
        if (!cityName) {
          throw Object.assign(new Error("City name is required."), { statusCode: 400, code: "MISSING_CITY_NAME" });
        }
        next.cityName = cityName;
      }
      if (fields.x !== undefined || fields.y !== undefined || fields.normalizedX !== undefined || fields.normalizedY !== undefined) {
        Object.assign(next, coordinateSet({ ...next, ...fields }, map));
      }
      if (fields.confidence !== undefined) next.confidence = clamp(fields.confidence, 0, 1);
      next.updatedAt = new Date().toISOString();
      records.cities[index] = next;
      await this.writeAll(records);
      return next;
    });
  }

  async deleteCity(mapId, cityId) {
    return this.withMetadataLock(async () => {
      const records = await this.readAll();
      const city = records.cities.find((item) => item.mapId === mapId && item.id === cityId);
      if (!city) return null;
      records.cities = records.cities.filter((item) => !(item.mapId === mapId && item.id === cityId));
      records.notes = records.notes.filter((note) => note.mapCityId !== cityId);
      await this.writeAll(records);
      return city;
    });
  }

  async listNotes(mapCityId) {
    const records = await this.readAll();
    return records.notes.filter((note) => note.mapCityId === mapCityId);
  }

  async createNote(mapCityId, fields = {}) {
    return this.withMetadataLock(async () => {
      const records = await this.readAll();
      const city = records.cities.find((item) => item.id === mapCityId);
      if (!city) return null;
      const title = cleanText(fields.title, 160);
      const content = cleanText(fields.content, 4000);
      if (!title || !content) {
        throw Object.assign(new Error("City notes require a title and content."), { statusCode: 400, code: "MISSING_CITY_NOTE_FIELDS" });
      }
      const now = new Date().toISOString();
      const note = {
        id: crypto.randomUUID(),
        mapCityId,
        title,
        content,
        createdAt: now,
        updatedAt: now,
      };
      records.notes.unshift(note);
      await this.writeAll(records);
      return note;
    });
  }

  async updateNote(mapCityId, noteId, fields = {}) {
    return this.withMetadataLock(async () => {
      const records = await this.readAll();
      const index = records.notes.findIndex((note) => note.mapCityId === mapCityId && note.id === noteId);
      if (index === -1) return null;
      const note = { ...records.notes[index] };
      if (fields.title !== undefined) note.title = cleanText(fields.title, 160);
      if (fields.content !== undefined) note.content = cleanText(fields.content, 4000);
      if (!note.title || !note.content) {
        throw Object.assign(new Error("City notes require a title and content."), { statusCode: 400, code: "MISSING_CITY_NOTE_FIELDS" });
      }
      note.updatedAt = new Date().toISOString();
      records.notes[index] = note;
      await this.writeAll(records);
      return note;
    });
  }

  async deleteNote(mapCityId, noteId) {
    return this.withMetadataLock(async () => {
      const records = await this.readAll();
      const note = records.notes.find((item) => item.mapCityId === mapCityId && item.id === noteId);
      if (!note) return null;
      records.notes = records.notes.filter((item) => !(item.mapCityId === mapCityId && item.id === noteId));
      await this.writeAll(records);
      return note;
    });
  }
}

module.exports = {
  ALLOWED_MAP_EXTENSIONS,
  ALLOWED_MAP_MIME_TYPES,
  MAP_METADATA_FILENAME,
  MAP_UPLOAD_FIELD_NAMES,
  MAP_UPLOAD_MAX_BYTES,
  MapStorageService,
  readImageDimensions,
  resolveMapUploadDir,
  sanitizeOriginalFilename,
  validateMapUpload,
};
