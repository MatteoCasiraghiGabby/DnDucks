# DnDucks

DnDucks is a draft Dungeon Master command center for campaigns, sessions, NPCs, notes, maps, handouts, and table prep.

## Running locally

This repo now includes a small backend so the static frontend can simulate persistent campaign material uploads.

```bash
npm start
```

Open <http://localhost:3000>. The backend serves the existing HTML/CSS/JS and exposes the materials API under `/api/materials`.

If you serve the frontend from the Vite dev server (for example `localhost:5173`), keep the Node backend running on port `3000`. The frontend sends relative `/api/*` requests, and Vite proxies those requests to the backend.

## Local campaign material uploads

Uploads are backend-managed. The browser never receives access to arbitrary folders on your computer. Instead, the backend accepts a file, validates it, writes it to a configured local upload directory, stores metadata in `index.json`, and returns safe API URLs for previews/downloads.

### Storage location

By default, files are stored in:

```bash
./storage/uploads
```

Configure another local folder with:

```bash
UPLOAD_DIR=./storage/uploads npm start
```

You can also put this in a local `.env` file:

```bash
UPLOAD_DIR=./storage/uploads
UPLOAD_MAX_BYTES=10485760
PORT=3000
```

The upload directory is created automatically on startup. User uploads and the generated metadata index are ignored by Git; only `storage/uploads/.gitkeep` is tracked to preserve the folder shape.

### File type and size limits

The draft upload service accepts these material types:

- Images: `jpg`, `jpeg`, `png`, `webp`, `gif`
- Documents/notes: `pdf`, `txt`, `md`
- Optional data aids: `json`, `csv`

The default maximum file size is 10 MB. Override it with `UPLOAD_MAX_BYTES`.

### Materials API

- `POST /api/materials/upload` uploads one multipart field named `file` and creates metadata.
- `GET /api/materials` lists uploaded materials. Optional query filters: `campaignId`, `sessionId`.
- `GET /api/materials/:id` returns one metadata record.
- `GET /api/materials/:id/download` streams the registered file only.
- `DELETE /api/materials/:id` removes metadata and deletes the stored file.

## Widget image uploads

DnDucks also includes a dedicated image upload system for widget art.

### Storage location

Dedicated image uploads are saved outside the static app bundle in:

```bash
./uploads/images
```

The folder is created automatically when the server starts. Uploaded files are ignored by Git; only `uploads/images/.gitkeep` is tracked. Configure the folder and limits with:

```bash
IMAGE_UPLOAD_DIR=./uploads/images
IMAGE_UPLOAD_MAX_BYTES=5242880
IMAGE_UPLOAD_MAX_FILES=12
```

If `IMAGE_UPLOAD_MAX_BYTES` is not set, the image service falls back to `UPLOAD_MAX_BYTES`, then to 5 MB per image.

### Image upload API

- `POST /api/uploads/images` accepts `multipart/form-data` fields named `images`, `image`, `files`, or `file`.
- The endpoint supports one or multiple images in the same request.
- Accepted formats are `jpg`, `jpeg`, `png`, `webp`, and `gif` with matching image MIME types.
- The response is normalized as `{ images, count }`. Each image includes `id`, `originalFilename`, `savedFilename`, `url`, `path`, `fileSize`, `mimeType`, `title`, and upload/update timestamps.
- Public image display is limited to generated filenames under `/uploads/images/:savedFilename`; arbitrary local filesystem paths are never exposed.
- Image metadata is persisted in `uploads/images/index.json`.
- `GET /api/uploads/images` lists uploaded images.
- `GET /api/uploads/images/:id` returns one image metadata record.
- `PATCH /api/uploads/images/:id` updates `title`.
- `DELETE /api/uploads/images/:id` removes metadata and deletes the stored image file.

Example response:

```json
{
  "count": 1,
  "images": [
    {
      "id": "00000000-0000-4000-8000-000000000000",
      "originalFilename": "npc.png",
      "savedFilename": "1710000000000-00000000-0000-4000-8000-000000000000.png",
      "url": "/uploads/images/1710000000000-00000000-0000-4000-8000-000000000000.png",
      "path": "/uploads/images/1710000000000-00000000-0000-4000-8000-000000000000.png",
      "fileSize": 12345,
      "mimeType": "image/png",
      "title": "NPC portrait",
      "uploadedAt": "2026-05-14T00:00:00.000Z",
      "updatedAt": "2026-05-14T00:00:00.000Z"
    }
  ]
}
```

### Frontend use

The frontend uses one vanilla JavaScript upload service, `uploadImages(files, metadata)`, which sends selected files with `FormData` to `/api/uploads/images`. Widget forms use the same image picker pattern and now persist uploaded image ids plus uploaded image URLs instead of embedding new images as base64 data.

Open `index.html#/media` for the reusable image library. Widgets can upload directly or select an existing image through the shared media picker.

To place an image picker in a page or widget, follow the existing `data-image-picker` pattern:

```html
<div class="file-picker image-picker" data-image-picker>
  <label for="my-image">Optional widget image</label>
  <input id="my-image" class="image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
  <button class="btn btn-secondary" type="button" data-image-trigger="my-image">Choose image</button>
  <span class="image-picker-status" data-image-status aria-live="polite">No image chosen</span>
  <img class="image-picker-preview" data-image-preview alt="Selected image preview" hidden />
</div>
```

## Interactive maps

Interactive maps are a separate module from the general media/image library. Map uploads do not use `/api/uploads/images`, media metadata, media categories, or the shared media picker.

### Storage location

Dedicated map images and map metadata are stored in:

```bash
./uploads/maps
```

Configure the folder and limit with:

```bash
MAP_UPLOAD_DIR=./uploads/maps
MAP_UPLOAD_MAX_BYTES=12582912
```

The map index stores three dedicated record groups: `maps`, `cities`, and `notes`.

### Maps API

- `POST /api/maps` uploads one multipart map image field named `map`, `image`, or `file`, creates a map record, and runs the map processing service.
- `GET /api/maps` lists maps.
- `GET /api/maps/:mapId` returns one map with its cities.
- `DELETE /api/maps/:mapId` deletes the map image, map record, cities, and city notes.
- `POST /api/maps/:mapId/process` runs map processing again.
- `GET /api/maps/:mapId/cities` lists city pins.
- `POST /api/maps/:mapId/cities` creates a city pin with pixel and normalized coordinates.
- `GET /api/maps/:mapId/cities/:cityId` returns one city pin.
- `PATCH /api/maps/:mapId/cities/:cityId` updates the city name or coordinates.
- `DELETE /api/maps/:mapId/cities/:cityId` deletes the city pin and its notes.
- `GET /api/maps/:mapId/cities/:cityId/notes` lists city notes.
- `POST /api/maps/:mapId/cities/:cityId/notes` creates a city note.
- `PATCH /api/maps/:mapId/cities/:cityId/notes/:noteId` updates a city note.
- `DELETE /api/maps/:mapId/cities/:cityId/notes/:noteId` deletes a city note.

The current map processing service is intentionally isolated in `src/mapProcessingService.js`. It marks uploaded maps as `ready` for manual pin placement and does not fake OCR/computer-vision city detection. Future detection should be added inside that service and should create `MapCity` records with pixel and normalized coordinates.

### Frontend use

Open `index.html#/maps` for the dedicated Map Studio. From there users can upload maps, open an interactive map viewer, click the map image to place city pins, and open city pages for notes. City pins store both image pixel coordinates and normalized coordinates so pins stay aligned as the map resizes.

## Character story suggestions

The campaign setup player form can suggest personality traits, ideals, bonds, flaws, and appearance/behavior features from a backend allow-list.

- Edit `data/character-suggestions.tsv` to manually add background packages, racial traits, or feats without changing code.
- See `data/README.md` for the allowed categories and row format.
- `POST /api/characters/analyze` accepts JSON with `description`, optional character context, and returns validated suggestions.
- Set `OPENAI_API_KEY` in `.env` to use OpenAI structured outputs.
- Set `OPENAI_CHARACTER_MODEL` to override the default model.
- Set `CHARACTER_ANALYSIS_RATE_LIMIT_MAX` and `CHARACTER_ANALYSIS_RATE_LIMIT_WINDOW_MS` to tune the in-memory per-client rate limit.
- Without `OPENAI_API_KEY`, the backend uses a deterministic local keyword matcher so the workflow remains testable during development.

Example `.env`:

```bash
OPENAI_API_KEY=sk-...
OPENAI_CHARACTER_MODEL=gpt-4o-mini
CHARACTER_ANALYSIS_RATE_LIMIT_MAX=12
CHARACTER_ANALYSIS_RATE_LIMIT_WINDOW_MS=60000
```

## Development-only storage note

Local filesystem storage is intended for this draft/development platform. A production version should move material files to durable object storage such as S3, Supabase Storage, Cloudinary, Firebase Storage, or a similar managed service, with database-backed metadata and authentication/authorization checks.

## Testing

```bash
npm test
```

The tests create isolated temporary upload directories and verify upload, list, download, delete, persistence metadata behavior, unsafe filename rejection, image URL serving, invalid image rejection, and missing-image errors.
