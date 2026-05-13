const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createServer } = require("../server");
const { MaterialStore } = require("../src/materialStore");

async function withServer(t) {
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnducks-materials-"));
  const store = new MaterialStore(uploadDir);
  const server = await createServer(store);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(uploadDir, { recursive: true, force: true });
  });
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, uploadDir };
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
