const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createFrontendSandbox(options = {}) {
  const storage = new Map();
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
    FormData,
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    document: documentStub,
    window: {
      location: {
        protocol: options.protocol || "http:",
        hostname: options.hostname || "localhost",
        port: options.port || "3000",
        origin: `${options.protocol || "http:"}//${options.hostname || "localhost"}${options.port ? `:${options.port}` : ":3000"}`,
        pathname: "/",
        href: "/",
        hash: "",
        reload: () => {},
      },
      addEventListener: () => {},
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
  assert.match(script, /data-player-card-href/);
});

test("notes are returned in campaign chronology order", () => {
  const app = createFrontendSandbox();

  app.saveCollection("notes", [
    { id: "note-2000-later", title: "Later", category: "Session Note", content: "Later", createdAt: "May 20, 2026", sortAt: 2000 },
    { id: "note-1000-first", title: "First", category: "Session Note", content: "First", createdAt: "May 15, 2026", sortAt: 1000 },
  ]);

  assert.deepEqual(Array.from(app.sortedNotes().map((note) => note.title)), ["First", "Later"]);
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
