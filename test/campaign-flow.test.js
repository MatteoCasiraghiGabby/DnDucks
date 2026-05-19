const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createFrontendSandbox(options = {}) {
  const storage = new Map();
  Object.entries(options.initialStorage || {}).forEach(([key, value]) => {
    storage.set(key, String(value));
  });
  const location = {
    protocol: options.protocol || "http:",
    hostname: options.hostname || "localhost",
    port: options.port || "3000",
    origin: `${options.protocol || "http:"}//${options.hostname || "localhost"}${options.port ? `:${options.port}` : ":3000"}`,
    pathname: options.pathname || "/",
    search: options.search || "",
    href: options.href || "/",
    hash: options.hash || "",
    reload: () => {},
    replace(url) {
      this.href = url;
      try {
        const parsed = new URL(url);
        this.protocol = parsed.protocol;
        this.hostname = parsed.hostname;
        this.port = parsed.port;
        this.origin = parsed.origin;
        this.pathname = parsed.pathname;
        this.search = parsed.search;
        this.hash = parsed.hash;
      } catch (error) {
        this.href = url;
      }
    },
  };
  const documentStub = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {},
    dispatchEvent: () => {},
  };
  const sandbox = {
    console,
    Intl,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    URL,
    URLSearchParams,
    FormData,
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    document: documentStub,
    window: {
      location,
      addEventListener: () => {},
      name: options.name || "",
      DNDUCKS_DISABLE_CANONICAL_REDIRECT: options.disableCanonicalRedirect !== false,
    },
    history: {
      replaceState: (_state, _title, url) => {
        location.href = url;
        const parsed = new URL(url, location.origin);
        location.pathname = parsed.pathname;
        location.search = parsed.search;
        location.hash = parsed.hash;
      },
    },
    Event: class Event { constructor(type) { this.type = type; } },
    fetch: async () => { throw new Error("fetch should not be called in campaign flow unit tests"); },
    alert: () => {},
    confirm: () => true,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8"), sandbox);
  return sandbox;
}

function mockPlayerForm(values) {
  return {
    querySelector(selector) {
      return { value: values[selector] ?? "" };
    },
  };
}

test("player character validation requires player and character names and numeric levels", () => {
  const app = createFrontendSandbox();
  const invalid = app.buildPlayerCharacter(mockPlayerForm({ "#player-level": "zero" }));
  assert.deepEqual(Array.from(app.validatePlayerCharacter(invalid)), [
    "Player name is required.",
    "Character name is required.",
    "Level must be a number greater than 0.",
  ]);

  const valid = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Alex",
    "#player-character-name": "Mira",
    "#player-level": "3",
  }));
  assert.deepEqual(Array.from(app.validatePlayerCharacter(valid)), []);
  assert.equal(valid.level, 3);
});

test("saving players persists them on the local campaign", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Sam",
    "#player-character-name": "Thorn",
    "#player-class-role": "Ranger",
    "#player-level": "2",
  }));

  const campaign = app.savePlayerToCampaign("local", player);
  assert.equal(campaign.players.length, 1);
  assert.equal(app.getCampaign("local").players[0].characterName, "Thorn");
});

test("deleting players removes them from the local campaign", () => {
  const app = createFrontendSandbox();
  const first = app.savePlayerToCampaign("local", app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Sam",
    "#player-character-name": "Thorn",
  })));
  const second = app.savePlayerToCampaign("local", app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
  })));

  assert.equal(second.players.length, 2);
  const nextCampaign = app.deletePlayerFromCampaign("local", first.players[0].id);
  assert.equal(nextCampaign.players.length, 1);
  assert.equal(nextCampaign.players[0].characterName, "Bramble");
});

test("resetting a campaign restores the neutral campaign state", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
  }));
  app.savePlayerToCampaign("local", player);
  app.completeCampaignSetup("local", {
    title: "The Verdant Road",
    startDate: "2026-05-15",
    description: "The party meets at the city gate.",
  });
  app.saveCollection("notes", [
    ...app.getStoredCollection("notes"),
    { id: "note-unrelated", title: "Keep me", category: "Lore", content: "Manual note", createdAt: "May 16, 2026" },
  ]);

  const reset = app.resetCampaign("local");
  assert.equal(reset.name, "Your campaign");
  assert.equal(reset.setupCompleted, false);
  assert.equal(reset.campaignStartNoteId, "");
  assert.equal(reset.players.length, 0);
  assert.deepEqual(Array.from(app.getStoredCollection("notes").map((note) => note.title)), ["Keep me"]);
});

test("completing setup saves the first campaign note only once", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
    "#player-class-role": "Druid",
    "#player-level": "4",
  }));
  app.savePlayerToCampaign("local", player);

  const completed = app.completeCampaignSetup("local", {
    title: "The Verdant Road",
    startDate: "2026-05-15",
    description: "The party meets at the city gate.",
  });
  assert.equal(completed.setupCompleted, true);
  assert.equal(completed.name, "The Verdant Road");
  assert.equal(app.campaignReady(completed), true);
  let notes = app.getStoredCollection("notes");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, "The Verdant Road");
  assert.equal(notes[0].campaignStartDate, "2026-05-15");
  assert.match(notes[0].content, /The party meets at the city gate/);
  assert.doesNotMatch(notes[0].content, /Riley|Bramble|Druid level 4/);
  assert.equal(completed.description, "The party meets at the city gate.");

  app.completeCampaignSetup("local", {
    title: "The Verdant Road",
    startDate: "2026-05-15",
    description: "Updated opening.",
  });
  notes = app.getStoredCollection("notes");
  assert.equal(notes.length, 1);
  assert.match(notes[0].content, /Updated opening/);
});

test("old auto-completed campaigns still require the explicit first note", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
  }));
  const campaign = app.savePlayerToCampaign("local", player);
  app.saveCollection("notes", [{
    id: "note-old-start",
    campaignId: "local",
    generatedBy: "campaign-setup-start",
    title: "Campaign Start",
    category: "Session Note",
    content: "Old automatic note.",
    createdAt: "May 15, 2026",
  }]);
  const migrated = app.upsertCampaign({ ...campaign, setupCompleted: true, campaignStartNoteId: "note-old-start" });

  assert.equal(app.campaignReady(migrated), false);
});

test("campaign setup links use hash routes that static servers can serve", () => {
  const app = createFrontendSandbox();

  assert.equal(app.campaignSetupHref("local"), "index.html#/campaigns/local/setup");
  assert.equal(app.campaignStartNoteHref("local"), "index.html#/campaigns/local/start-note");
  assert.equal(app.dashboardHref(), "index.html#dashboard");
  app.window.location.hash = "#/campaigns/local/setup";
  assert.deepEqual(Array.from(app.routeParts()), ["campaigns", "local", "setup"]);
  app.window.location.hash = "#/campaigns/local/start-note";
  assert.deepEqual(Array.from(app.routeParts()), ["campaigns", "local", "start-note"]);

  const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const script = fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8");
  assert.match(html, /href="index\.html#\/campaigns\/local\/setup"/);
  assert.match(html, /id="campaigns"/);
  assert.doesNotMatch(html, /href="\/campaigns\/local\/setup"/);
  assert.match(script, /id="back-to-dashboard-button"/);
  assert.match(script, /addEventListener\("click", goToDashboard\)/);
  assert.match(script, /Open sheet/);
  assert.doesNotMatch(script, /data-player-card-href/);
});

test("notes are returned in campaign chronology order", () => {
  const app = createFrontendSandbox();

  app.saveCollection("notes", [
    { id: "note-2000-later", title: "Later", category: "Session Note", content: "Later", createdAt: "May 20, 2026", sortAt: 2000 },
    { id: "note-1000-first", title: "First", category: "Session Note", content: "First", createdAt: "May 15, 2026", sortAt: 1000 },
  ]);

  assert.deepEqual(Array.from(app.sortedNotes().map((note) => note.title)), ["First", "Later"]);
});

test("legacy homebrew items without ids survive storage normalization", () => {
  const app = createFrontendSandbox();

  app.localStorage.setItem("dnducks.items", JSON.stringify([
    { name: "Moonlit Blade", type: "Weapon", description: "A silvered sword.", createdAt: "May 19, 2026" },
  ]));

  const items = app.getStoredCollection("items");
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Moonlit Blade");
  assert.match(items[0].id, /^legacy-items-moonlit-blade-weapon-may-19-2026-1$/);

  app.saveCollection("items", items);
  const persisted = JSON.parse(app.localStorage.getItem("dnducks.items"));
  assert.equal(persisted[0].id, items[0].id);
});

test("homebrew dashboard weapons are recognized from character equipment", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-blood-spear",
    name: "Blood Spear",
    type: "Weapon",
    description: "A cursed frozen spear.",
    statistics: {
      damage: "1d8 cold",
      range: "Melee",
      attack: "+1",
      properties: "Cursed, icy",
    },
    features: [{ title: "Bound Spirit", description: "The spirit haunts the wielder." }],
  }]));

  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "3",
    "#player-equipment": "Blood Spear",
  }));
  const summaries = app.equipmentWeaponSummaries(player);
  const formMarkup = app.playerCharacterFormMarkup();

  assert.equal(player.attacks.length, 1);
  assert.equal(player.attacks[0].name, "Blood Spear");
  assert.equal(player.attacks[0].attackBonus, "+1");
  assert.equal(player.attacks[0].damageType, "1d8 cold");
  assert.equal(player.attacks[0].homebrew, true);
  assert.match(player.features, /Blood Spear \(Homebrew item\)/);
  assert.match(player.features, /Damage: 1d8 cold/);
  assert.match(player.features, /Bound Spirit: The spirit haunts the wielder\./);
  assert.equal(summaries[0].name, "Blood Spear");
  assert.equal(summaries[0].mode, "Melee");
  assert.match(formMarkup, /id="player-equipment-entry" type="text" list="player-equipment-options"/);
  assert.match(formMarkup, /<option value="Blood Spear"><\/option>/);
});

test("equipment entry imports homebrew item details into the hidden sheet fields", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-blood-spear",
    name: "Blood Spear",
    type: "Weapon",
    statistics: { damage: "1d8 cold", attack: "+1" },
    features: [{ title: "Bound Spirit", description: "The spirit haunts the wielder." }],
  }]));
  const fields = {
    "#player-equipment": { value: "", dispatchEvent(event) { this.lastEvent = event.type; } },
    "#player-features": { value: "", dispatchEvent(event) { this.lastEvent = event.type; } },
  };
  const form = {
    querySelector(selector) {
      return fields[selector] || null;
    },
  };

  app.appendEquipmentItemsToSheet(form, ["blood spear"]);

  assert.equal(fields["#player-equipment"].value, "Blood Spear");
  assert.equal(fields["#player-equipment"].lastEvent, "input");
  assert.match(fields["#player-features"].value, /Blood Spear \(Homebrew item\)/);
  assert.match(fields["#player-features"].value, /Attack: \+1/);
  assert.match(fields["#player-features"].value, /Bound Spirit: The spirit haunts the wielder\./);
});

test("widget image picker falls back to local data urls when backend uploads are unavailable", async () => {
  const app = createFrontendSandbox();
  app.fetch = async () => { throw new Error("Load failed"); };
  app.FileReader = class FileReader {
    constructor() {
      this.listeners = {};
      this.result = "";
    }

    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }

    readAsDataURL(file) {
      this.result = `data:${file.type};base64,bW9vbg==`;
      this.listeners.load();
    }
  };

  const image = await app.imageFromFileInput({
    files: [{ name: "moon.png", type: "image/png", size: 4 }],
  }, { title: "Moonlit Blade" });

  assert.equal(image.localOnly, true);
  assert.equal(image.title, "Moonlit Blade");
  assert.equal(image.url, "data:image/png;base64,bW9vbg==");
  assert.match(image.id, /^local-image-/);
});

test("oversized local fallback images show a clear storage message", async () => {
  const app = createFrontendSandbox();
  app.fetch = async () => { throw new Error("Load failed"); };
  app.FileReader = class FileReader {
    constructor() {
      this.listeners = {};
      this.result = "";
    }

    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }

    readAsDataURL(file) {
      this.result = `data:${file.type};base64,${"a".repeat(760000)}`;
      this.listeners.load();
    }
  };

  await assert.rejects(
    app.imageFromFileInput({ files: [{ name: "giant.png", type: "image/png", size: 2000000 }] }),
    /too large for browser-only storage/
  );
});

test("dashboard widget image fields select from media instead of uploading files", () => {
  const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const script = fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8");

  assert.match(html, /data-media-select/);
  assert.match(html, /Choose from media/);
  assert.doesNotMatch(html, /id="encounter-image"|id="location-image"|id="character-image"|id="item-image"|id="event-image"/);
  assert.match(script, /selectedMediaImageFromForm\(form\)/);
  assert.doesNotMatch(script, /imageFromFileInput\(document\.getElementById\("encounter-image"/);
  assert.doesNotMatch(script, /imageFromFileInput\(document\.getElementById\("location-image"/);
  assert.doesNotMatch(script, /imageFromFileInput\(document\.getElementById\("character-image"/);
  assert.doesNotMatch(script, /imageFromFileInput\(document\.getElementById\("item-image"/);
  assert.doesNotMatch(script, /imageFromFileInput\(document\.getElementById\("event-image"/);
});

test("media library owns reusable image uploads", () => {
  const script = fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8");
  const styles = fs.readFileSync(path.join(process.cwd(), "assets/styles.css"), "utf8");

  assert.match(script, /imageUploadMarkup\(\{ submitLabel: "Upload to media" \}\)/);
  assert.match(script, /uploadImages\(input\?\.files \|\| \[\], \{ title, source: "media" \}\)/);
  assert.match(script, /Upload images below, then select them from dashboard widgets\./);
  assert.match(script, /Upload images from the Media page, then select them here\./);
  assert.match(styles, /\.media-upload-block \{/);
});

test("media selection controls keep the selected media image on the form", () => {
  const app = createFrontendSandbox();
  const status = { textContent: "", classList: { add: () => {}, remove: () => {} } };
  const preview = {
    src: "",
    hidden: true,
    removeAttribute(name) {
      if (name === "src") this.src = "";
    },
  };
  const clear = { hidden: true };
  const picker = {
    dataset: {},
    querySelector(selector) {
      return {
        "[data-image-status]": status,
        "[data-image-preview]": preview,
        "[data-media-clear]": clear,
      }[selector] || null;
    },
  };
  const form = { querySelector: (selector) => selector === "[data-media-select]" ? picker : null };

  app.setMediaSelectImage(picker, { id: "img-1", url: "/uploads/images/img-1.png", title: "ORWELL" });
  assert.equal(status.textContent, "Selected: ORWELL");
  assert.equal(preview.src, "/uploads/images/img-1.png");
  assert.equal(preview.hidden, false);
  assert.equal(clear.hidden, false);
  assert.equal(JSON.stringify(app.selectedMediaImageFromForm(form)), JSON.stringify({
    id: "img-1",
    url: "/uploads/images/img-1.png",
    title: "ORWELL",
    originalFilename: "",
    fileSize: 0,
    uploadedAt: "",
  }));
});

test("quota errors while saving collections explain how to recover", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem = () => {
    const error = new Error("The quota has been exceeded.");
    error.name = "QuotaExceededError";
    throw error;
  };

  assert.throws(
    () => app.saveCollection("items", [{ id: "item-1", name: "Moonlit Blade" }]),
    /Browser storage is full/
  );
});

test("collection edit updates an existing widget instead of duplicating it", () => {
  const app = createFrontendSandbox();
  const existing = { id: "item-1", name: "Moonlit Blade", createdAt: "May 19, 2026", description: "Old" };
  const edited = { id: "item-new", name: "Moonlit Blade +1", createdAt: "May 20, 2026", description: "Updated" };

  const next = app.upsertCollectionEntry([existing], edited, "item-1");

  assert.equal(next.length, 1);
  assert.equal(next[0].id, "item-1");
  assert.equal(next[0].createdAt, "May 19, 2026");
  assert.equal(next[0].description, "Updated");
});

test("user NPC widgets are not hidden by default status filtering", () => {
  const script = fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8");

  assert.doesNotMatch(script, /card\.dataset\.status === "hidden"/);
  assert.match(script, /widgetEditAttribute\("characters", character\)/);
  assert.match(script, /data-status="active">\s*\$\{widgetImageMarkup\(character, character\.name\)\}/);
});

test("homebrew weapon features render the feature name inside a bordered icon panel", () => {
  const app = createFrontendSandbox();
  const markup = app.itemFeatureBlocksMarkup({
    type: "Weapon",
    features: [{ title: "Vampire Touch", description: "Regain hit points after a critical hit." }],
  });

  assert.match(markup, /<article class="item-feature-block">/);
  assert.match(markup, /<span class="item-feature-icon">Vampire Touch<\/span>/);
  assert.match(markup, /Regain hit points after a critical hit\./);
});

test("DM-only targeting keeps homebrew features visible in DM mode and hidden in standard mode", () => {
  const script = fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8");
  const styles = fs.readFileSync(path.join(process.cwd(), "assets/styles.css"), "utf8");

  assert.match(script, /querySelectorAll\("\.item-feature-block"\)/);
  assert.match(script, /part\.classList\.toggle\("is-filtered-out", !dmOnlyMode && isDmOnlyPart\)/);
  assert.doesNotMatch(script, /setDmOnlyTargetLabel|syncDmOnlyFeatureIcon|data-dm-feature-label/);
  assert.doesNotMatch(styles, /\.dm-only-mode \.item-feature-block\.is-dm-only \{ display: none; \}/);
});

test("user widgets expose modify actions and card clicks open detail overlay", () => {
  const app = createFrontendSandbox();
  const actions = app.widgetActionMarkup({ id: "item-1" }, { edit: "Modify item", delete: "Delete item" });
  const script = fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8");
  const styles = fs.readFileSync(path.join(process.cwd(), "assets/styles.css"), "utf8");
  const detail = app.widgetDetailContent("items", {
    type: "Weapon",
    description: "This full item description is shown in the detail page.",
    statistics: { damage: "1d8" },
    features: [{ title: "Vampire Touch", description: "Feature details." }],
  });

  assert.match(actions, /data-edit-action-id="item-1"/);
  assert.match(actions, /Modify item/);
  assert.match(actions, /data-delete-id="item-1"/);
  assert.match(script, /openWidgetDetail\(card\.dataset\.editKey, card\.dataset\.editId\)/);
  assert.match(script, /startEditingWidget\(key, button\.dataset\.editActionId\)/);
  assert.match(script, /widget-detail-layout \$\{imageUrl \? "has-media" : ""\}/);
  assert.match(script, /<aside class="widget-detail-media"/);
  assert.match(script, /document\.body\.classList\.add\("widget-detail-open"\)/);
  assert.match(script, /document\.body\.classList\.remove\("widget-detail-open"\)/);
  assert.match(detail, /This full item description is shown in the detail page\./);
  assert.doesNotMatch(detail, /Vampire Touch|Feature details|<dl class="widget-detail-meta">/);
  assert.match(styles, /body\.widget-detail-open \{ overflow: hidden; \}/);
  assert.match(styles, /\.widget-detail-modal \.widget-detail-layout\.has-media \{\s*grid-template-columns: minmax\(0, 1fr\) minmax\(180px, 26%\);/);
  assert.match(styles, /\.widget-detail-modal \.widget-detail-main \{[\s\S]*overflow-y: auto;/);
  assert.match(styles, /\.widget-detail-modal \.widget-detail-image \{[\s\S]*object-fit: contain;/);
  assert.match(styles, /\.widget-detail-modal \.widget-detail-media \{[\s\S]*border-left: 0 !important;/);
  assert.match(styles, /\.widget-detail-modal \.widget-detail-media::before,[\s\S]*content: none !important;/);
  assert.match(script, /class="widget-detail-close"/);
  assert.match(styles, /\.widget-detail-close \{[\s\S]*position: fixed;[\s\S]*z-index: 1100;[\s\S]*width: 42px;/);
});

test("non-canonical local origins redirect with local storage for import", () => {
  const app = createFrontendSandbox({
    hostname: "127.0.0.1",
    port: "5500",
    pathname: "/index.html",
    hash: "#items",
    disableCanonicalRedirect: false,
    initialStorage: {
      "dnducks.items": JSON.stringify([{ id: "item-live", name: "Live Server Blade" }]),
    },
  });

  assert.match(app.window.location.href, /^http:\/\/127\.0\.0\.1:3000\/index\.html\?dnducksImport=windowName#items$/);
  const payload = JSON.parse(app.window.name);
  assert.equal(payload.source, "dnducks-local-storage");
  assert.match(payload.storage["dnducks.items"], /Live Server Blade/);
});

test("nested Live Server paths redirect to the canonical app entry point", () => {
  const app = createFrontendSandbox({
    hostname: "127.0.0.1",
    port: "5500",
    pathname: "/github/git-github-masterclass-starter-project-1/index.html",
    disableCanonicalRedirect: false,
    initialStorage: {
      "dnducks.characters": JSON.stringify([{ id: "npc-orwell", name: "ORWELL" }]),
    },
  });

  assert.match(app.window.location.href, /^http:\/\/127\.0\.0\.1:3000\/index\.html\?dnducksImport=windowName$/);
  const payload = JSON.parse(app.window.name);
  assert.match(payload.storage["dnducks.characters"], /ORWELL/);
});

test("canonical import merges split widgets from another local origin", () => {
  const payload = {
    source: "dnducks-local-storage",
    storage: {
      "dnducks.campaigns": JSON.stringify([{
        id: "local",
        name: "Live Campaign",
        setupCompleted: true,
        players: [{ id: "player-orwell", characterName: "Orwell", playerName: "M" }],
      }]),
      "dnducks.items": JSON.stringify([{ id: "item-live", name: "Live Server Blade" }]),
    },
  };
  const app = createFrontendSandbox({
    hostname: "127.0.0.1",
    port: "3000",
    pathname: "/index.html",
    search: "?dnducksImport=windowName",
    name: JSON.stringify(payload),
    initialStorage: {
      "dnducks.items": JSON.stringify([{ id: "item-preview", name: "Preview Spear" }]),
    },
  });

  assert.equal(app.window.name, "");
  assert.equal(app.window.location.search, "");
  assert.deepEqual(
    Array.from(app.getStoredCollection("items").map((item) => item.name).sort()),
    ["Live Server Blade", "Preview Spear"]
  );
  assert.equal(app.getCampaign("local").players[0].characterName, "Orwell");
});

test("personality story analysis workflow is available on the player form", () => {
  const script = fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8");

  assert.match(script, /id="analyze-character-description"/);
  assert.match(script, /\/api\/characters\/analyze/);
  assert.match(script, /collectCharacterSuggestionPayload/);
});

test("API URL resolver keeps backend requests relative", () => {
  const app = createFrontendSandbox({ hostname: "localhost", port: "3000" });

  assert.equal(app.resolveApiUrl("/api/materials"), "/api/materials");
});

test("API URL resolver targets the backend when served from a static local port", () => {
  const app = createFrontendSandbox({ hostname: "127.0.0.1", port: "5500" });

  assert.equal(app.resolveApiUrl("/api/characters/analyze"), "http://127.0.0.1:3000/api/characters/analyze");
});
