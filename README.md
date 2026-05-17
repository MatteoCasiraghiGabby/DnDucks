# DnDucks

DnDucks is a draft Dungeon Master command center for campaigns, sessions, NPCs, notes, maps, handouts, and table prep.

## Running locally

This repo now includes a small backend so the static frontend can simulate persistent campaign material uploads.

```bash
npm start
```

Open <http://localhost:3000>. The backend serves the existing HTML/CSS/JS and exposes the materials API under `/api/materials`.

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
- The response is normalized as `{ images, count }`. Each image includes `originalFilename`, `savedFilename`, `url`, `path`, `fileSize`, `mimeType`, and `uploadedAt`.
- Public image display is limited to generated filenames under `/uploads/images/:savedFilename`; arbitrary local filesystem paths are never exposed.

Example response:

```json
{
  "count": 1,
  "images": [
    {
      "originalFilename": "npc.png",
      "savedFilename": "1710000000000-00000000-0000-4000-8000-000000000000.png",
      "url": "/uploads/images/1710000000000-00000000-0000-4000-8000-000000000000.png",
      "path": "/uploads/images/1710000000000-00000000-0000-4000-8000-000000000000.png",
      "fileSize": 12345,
      "mimeType": "image/png",
      "uploadedAt": "2026-05-14T00:00:00.000Z"
    }
  ]
}
```

### Frontend use

The frontend uses one vanilla JavaScript upload service, `uploadImages(files)`, which sends selected files with `FormData` to `/api/uploads/images`. Widget forms use the same image picker pattern and now persist uploaded image URLs instead of embedding new images as base64 data.

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

## Character story completion

The party setup flow includes a **Complete personality widget** button under **Personality and story**. The browser sends the written description, traits, ideals, bonds, flaws, and backstory to `POST /api/characters/analyze`.

If `OPENAI_API_KEY` is available, the server asks the configured OpenAI model to infer SRD/basic-rules-style background, feature, personality fields, skill suggestions, language choices, and feature icons. If the model is unavailable or the request fails, the server uses a local SRD-style reference matcher so the button still completes the widget offline.

Optional configuration:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

The analysis output is intentionally concise and should be reviewed by the DM/player before saving the character.

## Development-only storage note

Local filesystem storage is intended for this draft/development platform. A production version should move material files to durable object storage such as S3, Supabase Storage, Cloudinary, Firebase Storage, or a similar managed service, with database-backed metadata and authentication/authorization checks.

## Testing

```bash
npm test
```

The tests create isolated temporary upload directories and verify upload, list, download, delete, persistence metadata behavior, unsafe filename rejection, image URL serving, invalid image rejection, and missing-image errors.
