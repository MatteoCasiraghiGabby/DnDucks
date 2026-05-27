const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createServer } = require("../server");
const { MaterialStore } = require("../src/materialStore");
const { ImageStorageService } = require("../src/imageStorageService");
const { MapStorageService } = require("../src/mapStorageService");

async function withServer(t, options = {}) {
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnducks-materials-"));
  const imageUploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnducks-images-"));
  const mapUploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnducks-maps-"));
  const store = new MaterialStore(uploadDir);
  const imageStore = new ImageStorageService(imageUploadDir);
  const mapStore = new MapStorageService(mapUploadDir);
  const server = await createServer(store, imageStore, mapStore, options);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(uploadDir, { recursive: true, force: true });
    await fs.rm(imageUploadDir, { recursive: true, force: true });
    await fs.rm(mapUploadDir, { recursive: true, force: true });
  });
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, uploadDir, imageUploadDir, mapUploadDir };
}

function pngHeader(width = 800, height = 600) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = 2;
  return buffer;
}

async function uploadMap(baseUrl, filename = "world.png") {
  const form = new FormData();
  form.set("title", "Ashen Coast");
  form.set("map", new Blob([pngHeader(1000, 500)], { type: "image/png" }), filename);
  const response = await fetch(`${baseUrl}/api/maps`, { method: "POST", body: form });
  return { response, body: await response.json() };
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
  form.set("title", "Encounter Splash");
  form.append("images", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "map.png");
  form.append("images", new Blob(["portrait"], { type: "image/webp" }), "npc.webp");

  const response = await fetch(`${baseUrl}/api/uploads/images`, { method: "POST", body: form });
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.count, 2);
  assert.ok(payload.images[0].id);
  assert.equal(payload.images[0].originalFilename, "map.png");
  assert.equal(payload.images[0].title, "Encounter Splash");
  assert.equal(payload.images[0].category, undefined);
  assert.equal(payload.images[0].altText, undefined);
  assert.equal(payload.images[0].description, undefined);
  assert.match(payload.images[0].savedFilename, /^[0-9]+-[0-9a-f-]+\.png$/);
  assert.equal(payload.images[0].url, `/uploads/images/${encodeURIComponent(payload.images[0].savedFilename)}`);
  assert.equal(await fs.readFile(path.join(imageUploadDir, payload.images[1].savedFilename), "utf8"), "portrait");

  const served = await fetch(`${baseUrl}${payload.images[0].url}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/png");
});

test("image library lists, updates title, gets, and deletes image records", async (t) => {
  const { baseUrl, imageUploadDir } = await withServer(t);
  const form = new FormData();
  form.set("title", "Sunken Vault Map");
  form.append("images", new Blob(["map-bytes"], { type: "image/png" }), "vault.png");

  const createdResponse = await fetch(`${baseUrl}/api/uploads/images`, { method: "POST", body: form });
  const createdPayload = await createdResponse.json();
  const image = createdPayload.images[0];

  const list = await fetch(`${baseUrl}/api/uploads/images`).then((res) => res.json());
  assert.equal(list.count, 1);
  assert.equal(list.images[0].id, image.id);

  const fetched = await fetch(`${baseUrl}/api/uploads/images/${image.id}`).then((res) => res.json());
  assert.equal(fetched.title, "Sunken Vault Map");

  const updatedResponse = await fetch(`${baseUrl}/api/uploads/images/${image.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Flooded Vault Map" }),
  });
  const updated = await updatedResponse.json();
  assert.equal(updated.title, "Flooded Vault Map");
  assert.equal(updated.altText, undefined);

  const deletion = await fetch(`${baseUrl}/api/uploads/images/${image.id}`, { method: "DELETE" });
  assert.equal(deletion.status, 200);
  await assert.rejects(fs.access(path.join(imageUploadDir, image.savedFilename)), /ENOENT/);
  const afterDelete = await fetch(`${baseUrl}/api/uploads/images`).then((res) => res.json());
  assert.equal(afterDelete.count, 0);
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

test("dedicated map upload processes to manual-ready status without using media routes", async (t) => {
  const { baseUrl, mapUploadDir } = await withServer(t);
  const { response, body } = await uploadMap(baseUrl);

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-route-branch"), "maps-route");
  assert.equal(body.map.title, "Ashen Coast");
  assert.equal(body.map.originalFilename, "world.png");
  assert.equal(body.map.imageWidth, 1000);
  assert.equal(body.map.imageHeight, 500);
  assert.equal(body.map.status, "ready");
  assert.equal(body.processing.detectionImplemented, false);
  assert.match(body.map.imageUrl, /^\/uploads\/maps\//);
  assert.ok(await fs.readFile(path.join(mapUploadDir, body.map.savedFilename)));

  const mediaList = await fetch(`${baseUrl}/api/uploads/images`).then((res) => res.json());
  assert.equal(mediaList.count, 0);

  const served = await fetch(`${baseUrl}${body.map.imageUrl}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/png");
});

test("map city pins and city notes use dedicated map records", async (t) => {
  const { baseUrl } = await withServer(t);
  const { body } = await uploadMap(baseUrl);
  const mapId = body.map.id;

  const cityResponse = await fetch(`${baseUrl}/api/maps/${mapId}/cities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cityName: "Brightwater", x: 250, y: 125 }),
  });
  const city = await cityResponse.json();
  assert.equal(cityResponse.status, 201);
  assert.equal(city.cityName, "Brightwater");
  assert.equal(city.x, 250);
  assert.equal(city.y, 125);
  assert.equal(city.normalizedX, 0.25);
  assert.equal(city.normalizedY, 0.25);

  const noteResponse = await fetch(`${baseUrl}/api/maps/${mapId}/cities/${city.id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Harbor rumor", content: "The old bell rings before storms." }),
  });
  const note = await noteResponse.json();
  assert.equal(noteResponse.status, 201);
  assert.equal(note.mapCityId, city.id);

  const detail = await fetch(`${baseUrl}/api/maps/${mapId}`).then((res) => res.json());
  assert.equal(detail.cities.length, 1);
  assert.equal(detail.cities[0].id, city.id);

  const notes = await fetch(`${baseUrl}/api/maps/${mapId}/cities/${city.id}/notes`).then((res) => res.json());
  assert.equal(notes.count, 1);
  assert.equal(notes.notes[0].title, "Harbor rumor");

  const updated = await fetch(`${baseUrl}/api/maps/${mapId}/cities/${city.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cityName: "Brightwater Port", normalizedX: 0.5, normalizedY: 0.6 }),
  }).then((res) => res.json());
  assert.equal(updated.cityName, "Brightwater Port");
  assert.equal(updated.x, 500);
  assert.equal(updated.y, 300);

  const deleted = await fetch(`${baseUrl}/api/maps/${mapId}/cities/${city.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 200);
  const afterDelete = await fetch(`${baseUrl}/api/maps/${mapId}/cities`).then((res) => res.json());
  assert.equal(afterDelete.count, 0);
});

test("deleting a map removes its stored file and nested map records", async (t) => {
  const { baseUrl, mapUploadDir } = await withServer(t);
  const { body } = await uploadMap(baseUrl);
  const map = body.map;

  const city = await fetch(`${baseUrl}/api/maps/${map.id}/cities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cityName: "Stoneford", normalizedX: 0.4, normalizedY: 0.5 }),
  }).then((res) => res.json());
  await fetch(`${baseUrl}/api/maps/${map.id}/cities/${city.id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Gatehouse", content: "Locked at sundown." }),
  });

  const deletion = await fetch(`${baseUrl}/api/maps/${map.id}`, { method: "DELETE" });
  assert.equal(deletion.status, 200);
  await assert.rejects(fs.access(path.join(mapUploadDir, map.savedFilename)), /ENOENT/);

  const maps = await fetch(`${baseUrl}/api/maps`).then((res) => res.json());
  assert.equal(maps.count, 0);
  const missing = await fetch(`${baseUrl}/api/maps/${map.id}`);
  assert.equal(missing.status, 404);
});

test("map upload rejects non-image files", async (t) => {
  const { baseUrl } = await withServer(t);
  const form = new FormData();
  form.set("title", "Bad map");
  form.set("map", new Blob(["not a map"], { type: "text/plain" }), "notes.txt");

  const response = await fetch(`${baseUrl}/api/maps`, { method: "POST", body: form });
  const payload = await response.json();

  assert.equal(response.status, 415);
  assert.match(payload.error, /Only jpg/);
});

test("character analysis API returns validated suggestions without exposing OpenAI to the browser", async (t) => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/api/characters/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterName: "Seren",
      description: "A devout temple healer with visible scars who protects poor families and carries a holy token.",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-route-branch"), "character-analysis-route");
  assert.equal(payload.model, "local-keyword-matcher");
  assert.ok(payload.suggestions.length > 0);
  assert.ok(payload.suggestions.every((suggestion) => suggestion.id && suggestion.label && suggestion.explanation));
  assert.ok(payload.suggestions.every((suggestion) => ["backgrounds", "feats"].includes(suggestion.category)));
});

test("background suggestion API writes homebrew backgrounds to TSV", async (t) => {
  const suggestionDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnducks-character-suggestions-"));
  const suggestionFile = path.join(suggestionDir, "character-suggestions.tsv");
  await fs.writeFile(suggestionFile, "category\tid\tlabel\tdescription\tmechanics\tsource\ttags\n");
  t.after(async () => {
    await fs.rm(suggestionDir, { recursive: true, force: true });
  });

  const { baseUrl } = await withServer(t, { characterSuggestionsFilePath: suggestionFile });
  const response = await fetch(`${baseUrl}/api/character-suggestions/backgrounds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label: "Mist Cartographer",
      description: "Mapmaker of haunted roads.",
      abilityScores: ["Dexterity", "Wisdom", "Charisma"],
      originFeat: "Lucky",
      skills: ["Insight", "Stealth"],
      toolProficiency: "Thieves' Tools",
      equipment: "Two Daggers, Thieves' Tools, and 16 GP.",
      tags: ["street", "survivor", "stealth"],
    }),
  });
  const payload = await response.json();
  const tsv = await fs.readFile(suggestionFile, "utf8");

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-route-branch"), "character-background-suggestion-route");
  assert.equal(payload.suggestion.id, "background-mist-cartographer");
  assert.match(tsv, /backgrounds\tbackground-mist-cartographer\tMist Cartographer\tMapmaker of haunted roads\./);
  assert.match(tsv, /Ability scores: Dexterity\/Wisdom\/Charisma/);
  assert.match(tsv, /street; survivor; stealth/);
});

test("character analysis API rate limits repeated requests", async (t) => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousMax = process.env.CHARACTER_ANALYSIS_RATE_LIMIT_MAX;
  delete process.env.OPENAI_API_KEY;
  process.env.CHARACTER_ANALYSIS_RATE_LIMIT_MAX = "1";
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousMax === undefined) delete process.env.CHARACTER_ANALYSIS_RATE_LIMIT_MAX;
    else process.env.CHARACTER_ANALYSIS_RATE_LIMIT_MAX = previousMax;
  });

  const { baseUrl } = await withServer(t);
  const request = () => fetch(`${baseUrl}/api/characters/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.77" },
    body: JSON.stringify({ description: "A devout healer protects a village and carries a sacred token." }),
  });

  assert.equal((await request()).status, 200);
  const limited = await request();
  const payload = await limited.json();
  assert.equal(limited.status, 429);
  assert.equal(payload.code, "CHARACTER_ANALYSIS_RATE_LIMITED");
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
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
