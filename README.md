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

### Development-only storage note

Local filesystem storage is intended for this draft/development platform. A production version should move material files to durable object storage such as S3, Supabase Storage, Cloudinary, Firebase Storage, or a similar managed service, with database-backed metadata and authentication/authorization checks.

## Testing

```bash
npm test
```

The tests create an isolated temporary upload directory and verify upload, list, download, delete, persistence metadata behavior, and unsafe filename rejection.
