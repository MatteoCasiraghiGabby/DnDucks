const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createServer } = require("../server");
const { MaterialStore } = require("../src/materialStore");
const { ImageStorageService } = require("../src/imageStorageService");

process.env.OPENAI_API_KEY = "";

async function withServer(t) {
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnducks-materials-"));
  const imageUploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnducks-images-"));
  const store = new MaterialStore(uploadDir);
  const imageStore = new ImageStorageService(imageUploadDir);
  const server = await createServer(store, imageStore);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(uploadDir, { recursive: true, force: true });
    await fs.rm(imageUploadDir, { recursive: true, force: true });
  });
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, uploadDir, imageUploadDir };
}

async function uploadMaterial(baseUrl, filename = "map.txt", content = "hidden gate") {
  const form = new FormData();
  form.set("title", "Blackfen Map");
  form.set("category", "map");
  form.set("campaignId", "ashen-crown");
  form.set("file", new Blob([content], { type: "text/plain" }), filename);
  const response = await fetch(`${baseUrl}/api/materials/upload`, { method: "POST", body: form });
  return { response, body: await response.json() };
}

test("upload creates a file and metadata, list returns it, and download streams it", async (t) => {
  const { baseUrl, uploadDir } = await withServer(t);
  const { response, body } = await uploadMaterial(baseUrl);

  assert.equal(response.status, 201);
  assert.equal(body.originalFilename, "map.txt");
  assert.equal(body.category, "map");
  assert.equal(body.campaignId, "ashen-crown");

  const stored = await fs.readFile(path.join(uploadDir, body.storedFilename), "utf8");
  assert.equal(stored, "hidden gate");

  const list = await fetch(`${baseUrl}/api/materials?campaignId=ashen-crown`).then((res) => res.json());
  assert.equal(list.length, 1);
  assert.equal(list[0].id, body.id);

  const download = await fetch(`${baseUrl}${body.downloadUrl}`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "text/plain");
  assert.equal(await download.text(), "hidden gate");
});

test("delete removes metadata and the stored file", async (t) => {
  const { baseUrl, uploadDir } = await withServer(t);
  const { body } = await uploadMaterial(baseUrl, "handout.md", "# Clue");

  const deletion = await fetch(`${baseUrl}/api/materials/${body.id}`, { method: "DELETE" });
  assert.equal(deletion.status, 200);
  await assert.rejects(fs.access(path.join(uploadDir, body.storedFilename)), /ENOENT/);

  const list = await fetch(`${baseUrl}/api/materials`).then((res) => res.json());
  assert.equal(list.length, 0);
});

test("unsafe path filenames are rejected", async (t) => {
  const { baseUrl } = await withServer(t);
  const boundary = "----dnducks-test-boundary";
  const body = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="../../secret.txt"',
    "Content-Type: text/plain",
    "",
    "secret",
    `--${boundary}--`,
    "",
  ].join("\r\n"));

  const response = await fetch(`${baseUrl}/api/materials/upload`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(payload.error, /Unsafe filenames/);
});

test("metadata persists when a new store reads the same upload directory", async () => {
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnducks-materials-persist-"));
  try {
    const firstStore = new MaterialStore(uploadDir);
    const created = await firstStore.create({
      file: { originalFilename: "npc.txt", mimeType: "text/plain", buffer: Buffer.from("portrait notes") },
      fields: { title: "NPC Portrait Notes", sessionId: "session-12" },
    });

    const secondStore = new MaterialStore(uploadDir);
    const found = await secondStore.get(created.id);
    assert.equal(found.originalFilename, "npc.txt");
    assert.equal(found.sessionId, "session-12");
    assert.equal(await fs.readFile(path.join(uploadDir, found.storedFilename), "utf8"), "portrait notes");
  } finally {
    await fs.rm(uploadDir, { recursive: true, force: true });
  }
});

test("concurrent uploads preserve every metadata record", async () => {
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnducks-materials-concurrent-"));
  try {
    const store = new MaterialStore(uploadDir);
    const uploads = Array.from({ length: 12 }, (_, index) =>
      store.create({
        file: {
          originalFilename: `material-${index}.txt`,
          mimeType: "text/plain",
          buffer: Buffer.from(`content ${index}`),
        },
        fields: { title: `Material ${index}` },
      }),
    );

    const created = await Promise.all(uploads);
    const listed = await store.list();

    assert.equal(listed.length, created.length);
    assert.deepEqual(
      new Set(listed.map((material) => material.id)),
      new Set(created.map((material) => material.id)),
    );
    await Promise.all(created.map((material, index) =>
      fs.readFile(path.join(uploadDir, material.storedFilename), "utf8").then((content) => {
        assert.equal(content, `content ${index}`);
      }),
    ));
  } finally {
    await fs.rm(uploadDir, { recursive: true, force: true });
  }
});


test("image upload endpoint accepts multiple images and serves public URLs", async (t) => {
  const { baseUrl, imageUploadDir } = await withServer(t);
  const form = new FormData();
  form.append("images", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "map.png");
  form.append("images", new Blob(["portrait"], { type: "image/webp" }), "npc.webp");

  const response = await fetch(`${baseUrl}/api/uploads/images`, { method: "POST", body: form });
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.count, 2);
  assert.equal(payload.images[0].originalFilename, "map.png");
  assert.match(payload.images[0].savedFilename, /^[0-9]+-[0-9a-f-]+\.png$/);
  assert.equal(payload.images[0].url, `/uploads/images/${encodeURIComponent(payload.images[0].savedFilename)}`);
  assert.equal(await fs.readFile(path.join(imageUploadDir, payload.images[1].savedFilename), "utf8"), "portrait");

  const served = await fetch(`${baseUrl}${payload.images[0].url}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/png");
});

test("image upload rejects non-image files", async (t) => {
  const { baseUrl } = await withServer(t);
  const form = new FormData();
  form.append("images", new Blob(["not an image"], { type: "text/plain" }), "notes.txt");

  const response = await fetch(`${baseUrl}/api/uploads/images`, { method: "POST", body: form });
  const payload = await response.json();

  assert.equal(response.status, 415);
  assert.match(payload.error, /Only jpg/);
});

test("image upload returns a clear error when no image file is provided", async (t) => {
  const { baseUrl } = await withServer(t);
  const form = new FormData();
  form.set("caption", "no file here");

  const response = await fetch(`${baseUrl}/api/uploads/images`, { method: "POST", body: form });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error, /requires at least one image field/);
});

test("character analysis endpoint completes a story with SRD-style background features", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/api/characters/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterName: "Mira",
      description: "A brave village rebel who protected common folk from a tyrant.",
      notes: "Her family farm still needs help and she is reckless about justice.",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.background, "Folk Hero");
  assert.match(payload.features, /Rustic Hospitality/);
  assert.deepEqual(payload.suggestedSkills, ["animalHandling", "survival"]);
  assert.equal(payload.source, "local-srd-reference");
});

test("character analysis endpoint accepts the frontend POST method with a trailing slash", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/api/characters/analyze/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterName: "Tamsin",
      description: "A sailor from a storm-battered crew who still trusts the sea.",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.background, "Sailor");
  assert.equal(payload.source, "local-srd-reference");
});


test("character analysis endpoint accepts simple text payloads for diagnostics", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/api/characters/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Test text about a brave sailor who trusts the sea." }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.source, "local-srd-reference");
});

test("character analysis endpoint returns a clear 405 for unsupported methods", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/api/characters/analyze`, { method: "GET" });
  const payload = await response.json();

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST, OPTIONS");
  assert.equal(payload.code, "METHOD_NOT_ALLOWED");
  assert.equal(payload.error, "METHOD_NOT_ALLOWED");
  assert.match(payload.message, /Use POST or OPTIONS/);
  assert.equal(payload.method, "GET");
  assert.equal(payload.pathname, "/api/characters/analyze");
  assert.equal(payload.branch, "character-analysis-method-guard");
  assert.deepEqual(payload.allow, ["POST", "OPTIONS"]);
  assert.match(payload.requestId, /^analysis-/);
});

test("character analysis endpoint accepts a proxy-stripped API prefix alias", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/characters/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Test text about a brave village hero." }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-route-branch"), "character-analysis-alias-route");
  assert.equal(payload.source, "local-srd-reference");
});

test("static file guard returns diagnostic 405 metadata", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/not-an-api-route`, { method: "POST" });
  const payload = await response.json();

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
  assert.equal(payload.error, "METHOD_NOT_ALLOWED");
  assert.equal(payload.method, "POST");
  assert.equal(payload.pathname, "/not-an-api-route");
  assert.equal(payload.branch, "static-file-guard");
  assert.deepEqual(payload.allow, ["GET", "HEAD"]);
});

test("character analysis endpoint asks for story text", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/api/characters/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterName: "Blank" }),
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, "EMPTY_STORY");
});

test("character analysis endpoint rejects non-object JSON with clear error metadata", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/api/characters/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(null),
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, "INVALID_ANALYSIS_PAYLOAD");
  assert.match(payload.requestId, /^analysis-/);
});

test("character analysis endpoint answers CORS preflight for split frontend/backend dev servers", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/api/characters/analyze`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.match(response.headers.get("access-control-allow-methods"), /POST/);
  assert.match(response.headers.get("access-control-allow-headers"), /content-type/i);
});
