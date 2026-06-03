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
      DNDUCKS_SKIP_AUTO_BOOT: options.skipAutoBoot !== false,
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
    fetch: options.fetch || (async () => { throw new Error("fetch should not be called in campaign flow unit tests"); }),
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

function createCharacterFormStub(initialValues = {}) {
  const makeClassList = () => ({ add() {}, remove() {}, toggle() {} });
  const fields = {};
  [
    "#player-name", "#player-character-name", "#player-class-role", "#player-level", "#player-race",
    "#player-multiclass-enabled", "#player-primary-class-level", "#player-multiclass-2-class", "#player-multiclass-2-level",
    "#player-multiclass-3-class", "#player-multiclass-3-level",
    "#player-background", "#player-alignment", "#player-experience", "#player-equipment",
    "#player-equipment-entry", "#player-features", "#player-background-skills", "#player-tool-proficiencies",
    "#player-bonds", "#player-notes",
    "#player-lineage-ability-controls", "#player-lineage-ability-bonuses", "#player-lineage-traits",
    "#player-background-ability-bonuses", "#player-background-equipment-controls", "#player-gold", "#player-gold-shop-button", "#equipment-shop-panel", "#equipment-shop-search",
    "#player-passive-perception", "#player-hp-max",
    "#player-strength", "#player-dexterity", "#player-constitution", "#player-intelligence", "#player-wisdom", "#player-charisma",
  ].forEach((selector) => {
    fields[selector] = {
      value: initialValues[selector] ?? "",
      checked: Boolean(initialValues[`${selector}:checked`]),
      dataset: {},
      hidden: false,
      innerHTML: "",
      dispatchEvent(event) { this.lastEvent = event.type; },
      querySelectorAll: () => [],
      querySelector: () => null,
      scrollIntoView: () => {},
    };
  });
  const skillInputs = [
    "acrobatics", "animalHandling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
    "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightOfHand",
    "stealth", "survival",
  ].map((value) => ({
    value,
    name: "player-skill-proficiencies",
    checked: false,
    disabled: false,
    dataset: {},
    closest: () => ({ classList: makeClassList() }),
  }));
  const languageInputs = [];
  const spellInputs = (initialValues["player-spells"] || []).map((value) => ({
    value,
    name: "player-spells",
    checked: true,
    disabled: false,
    dataset: {},
    closest: () => ({ classList: makeClassList() }),
  }));
  fields["#player-background-ability-controls"] = {
    value: "",
    dataset: {},
    hidden: true,
    innerHTML: "",
    dispatchEvent() {},
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  return {
    dataset: {},
    fields,
    skillInputs,
    querySelector(selector) {
      return fields[selector] || null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="player-skill-proficiencies"]') return skillInputs;
      if (selector === 'input[name="player-languages"]') return languageInputs;
      if (selector === 'input[name="player-saving-throws"]') return [];
      if (selector === 'input[name="player-spells"]:checked') return spellInputs.filter((input) => input.checked);
      if (selector === 'input[name="player-spells"]') return spellInputs;
      return [];
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

test("player character creation supports multiclass level splits", () => {
  const app = createFrontendSandbox();
  const form = createCharacterFormStub({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-class-role": "Fighter",
    "#player-level": "5",
    "#player-multiclass-enabled:checked": true,
    "#player-primary-class-level": "3",
    "#player-multiclass-2-class": "Rogue",
    "#player-multiclass-2-level": "2",
    "#player-strength": "14",
    "#player-dexterity": "14",
    "#player-constitution": "12",
  });

  const player = app.buildPlayerCharacter(form);
  const markup = app.characterSheetMarkup(player);

  assert.equal(player.level, 5);
  assert.equal(player.classRole, "Fighter / Rogue");
  assert.deepEqual(JSON.parse(JSON.stringify(player.classLevels)), [{ className: "Fighter", level: 3 }, { className: "Rogue", level: 2 }]);
  assert.equal(player.proficiencyBonus, 3);
  assert.equal(player.combat.hitDice, "3d10 + 2d8");
  assert.equal(player.combat.hitPointMaximum, 37);
  assert.ok(player.toolProficiencies.includes("Thieves' Tools"));
  assert.match(player.features, /Multiclassing \(Character option\)[\s\S]*Class levels: Fighter 3 \/ Rogue 2/);
  assert.match(player.features, /Proficiency Bonus uses total character level/);
  assert.match(markup, /Fighter 3 \/ Rogue 2/);
  assert.deepEqual(Array.from(app.validatePlayerCharacter(player)), []);
});

test("multiclass validation enforces class prerequisites", () => {
  const app = createFrontendSandbox();
  const form = createCharacterFormStub({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-class-role": "Paladin",
    "#player-level": "2",
    "#player-multiclass-enabled:checked": true,
    "#player-primary-class-level": "1",
    "#player-multiclass-2-class": "Wizard",
    "#player-multiclass-2-level": "1",
    "#player-strength": "13",
    "#player-charisma": "10",
    "#player-intelligence": "12",
  });

  const player = app.buildPlayerCharacter(form);
  const errors = app.validatePlayerCharacter(player);

  assert.equal(player.level, 2);
  assert.match(errors.join(" "), /Paladin requires Charisma 13/);
  assert.match(errors.join(" "), /Wizard requires Intelligence 13/);
});

test("combat initiative rolling sorts by score and modifier ties", () => {
  const app = createFrontendSandbox();
  const encounter = app.normalizeCombatEncounter({
    combatants: [
      { id: "slow", name: "Slow", type: "monster", initiativeModifier: 2 },
      { id: "quick", name: "Quick", type: "monster", initiativeModifier: 4 },
      { id: "high", name: "High", type: "player", initiativeModifier: 1 },
    ],
  });
  const rolls = { slow: 10, quick: 8, high: 15 };
  const rolled = app.rollInitiativeForAll(encounter, (combatant) => rolls[combatant.id]);

  assert.deepEqual(Array.from(rolled.combatants.map((combatant) => combatant.id)), ["high", "quick", "slow"]);
  assert.equal(rolled.combatants[1].initiativeScore, 12);
  assert.equal(rolled.combatants[2].initiativeScore, 12);
});

test("combat turns advance rounds and can move backward", () => {
  const app = createFrontendSandbox();
  const started = app.startCombatEncounter({
    combatants: [
      { id: "a", name: "A", type: "player", initiativeScore: 18, initiativeModifier: 4 },
      { id: "b", name: "B", type: "monster", initiativeScore: 12, initiativeModifier: 1 },
    ],
  });

  const secondTurn = app.advanceCombatTurn(started);
  const nextRound = app.advanceCombatTurn(secondTurn);
  const previous = app.previousCombatTurn(nextRound);
  const floor = app.previousCombatTurn(started);

  assert.equal(started.currentRound, 1);
  assert.equal(started.activeCombatantId, "a");
  assert.equal(secondTurn.activeCombatantId, "b");
  assert.equal(secondTurn.currentRound, 1);
  assert.equal(nextRound.activeCombatantId, "a");
  assert.equal(nextRound.currentRound, 2);
  assert.equal(previous.activeCombatantId, "b");
  assert.equal(previous.currentRound, 1);
  assert.equal(floor.currentRound, 1);
  assert.equal(floor.activeCombatantId, "a");
});

test("combat can skip defeated and hidden combatants", () => {
  const app = createFrontendSandbox();
  const encounter = app.startCombatEncounter({
    skipDefeated: true,
    combatants: [
      { id: "active", name: "Active", type: "player", initiativeScore: 18 },
      { id: "down", name: "Down", type: "monster", initiativeScore: 15, status: "defeated" },
      { id: "hidden", name: "Hidden", type: "npc", initiativeScore: 12, status: "hidden" },
      { id: "ready", name: "Ready", type: "monster", initiativeScore: 10 },
    ],
  });

  const next = app.advanceCombatTurn(encounter);

  assert.equal(next.activeCombatantId, "ready");
  assert.equal(next.currentRound, 1);
});

test("combat manual reordering and removal preserve a usable active turn", () => {
  const app = createFrontendSandbox();
  const encounter = app.normalizeCombatEncounter({
    combatStarted: true,
    currentTurnIndex: 1,
    activeCombatantId: "b",
    combatants: [
      { id: "a", name: "A", type: "player" },
      { id: "b", name: "B", type: "monster" },
      { id: "c", name: "C", type: "npc" },
    ],
  });
  const moved = app.moveCombatant(encounter, "c", -2);
  const removed = app.removeCombatantFromEncounter(moved, "b");

  assert.deepEqual(Array.from(moved.combatants.map((combatant) => combatant.id)), ["c", "a", "b"]);
  assert.equal(moved.manualOrder, true);
  assert.equal(moved.activeCombatantId, "b");
  assert.deepEqual(Array.from(removed.combatants.map((combatant) => combatant.id)), ["c", "a"]);
  assert.equal(removed.activeCombatantId, "a");
});

test("combatant avatar actions route saved entities and keep temporary details local", () => {
  const app = createFrontendSandbox();
  const playerCombatant = {
    id: "combatant-player",
    entityId: "player-mira",
    type: "player",
    name: "Mira",
    detailRoute: app.playerCharacterHref("local", "player-mira"),
  };
  const npcCombatant = { id: "combatant-npc", entityId: "npc-orwell", type: "npc", name: "Orwell" };
  const monsterCombatant = { id: "combatant-monster", entityId: "item-goblin", type: "monster", name: "Goblin 1" };
  const temporaryCombatant = { id: "combatant-temp", type: "monster", name: "Lair hazard", isTemporary: true };
  const markup = app.initiativeTimelineMarkup(app.normalizeCombatEncounter({ combatants: [playerCombatant, temporaryCombatant] }));

  assert.deepEqual(JSON.parse(JSON.stringify(app.combatantDetailTarget(playerCombatant))), { kind: "navigate", route: "index.html#/campaigns/local/players/player-mira" });
  assert.deepEqual(JSON.parse(JSON.stringify(app.combatantDetailTarget(npcCombatant))), { kind: "widget", collectionKey: "characters", entityId: "npc-orwell" });
  assert.deepEqual(JSON.parse(JSON.stringify(app.combatantDetailTarget(monsterCombatant))), { kind: "widget", collectionKey: "items", entityId: "item-goblin" });
  assert.deepEqual(JSON.parse(JSON.stringify(app.combatantDetailTarget(temporaryCombatant))), { kind: "temporary", combatantId: "combatant-temp" });
  assert.match(markup, /data-combatant-detail="combatant-player"/);
  assert.match(markup, /data-combatant-detail="combatant-temp"/);
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

test("completed campaigns can reopen player setup to add more characters", () => {
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

  const main = { innerHTML: "" };
  const form = createCharacterFormStub();
  form.addEventListener = () => {};
  form.reset = () => {};
  const addedPlayers = { innerHTML: "" };
  const button = { addEventListener: () => {} };
  const elementMap = new Map([
    ["player-character-form", form],
    ["added-players-summary", addedPlayers],
    ["add-another-player", button],
    ["go-on-campaign", button],
  ]);
  app.document.querySelector = (selector) => selector === "main" ? main : null;
  app.document.querySelectorAll = () => [];
  app.document.getElementById = (id) => elementMap.get(id) || {
    textContent: "",
    classList: { add() {}, remove() {} },
    addEventListener() {},
  };

  app.renderCampaignSetupPage("local");

  assert.match(main.innerHTML, /Modify campaign/);
  assert.match(main.innerHTML, /ADD PLAYER/);
  assert.match(main.innerHTML, /BACK TO CAMPAIGN/);
  assert.match(addedPlayers.innerHTML, /Bramble/);
  assert.notEqual(app.window.location.href, app.dashboardHref());
});

test("campaign setup links use hash routes that static servers can serve", () => {
  const app = createFrontendSandbox();

  assert.equal(app.campaignSetupHref("local"), "index.html#/campaigns/local/setup");
  assert.equal(app.campaignStartNoteHref("local"), "index.html#/campaigns/local/start-note");
  assert.equal(app.playerSpellbookHref("local", "player-mira"), "index.html#/campaigns/local/players/player-mira/spells");
  assert.equal(app.dashboardHref(), "index.html#dashboard");
  assert.match(app.playerCharacterFormMarkup({ saveLabel: "ADD PLAYER", continueLabel: "BACK TO CAMPAIGN" }), /ADD PLAYER[\s\S]*BACK TO CAMPAIGN/);
  app.window.location.hash = "#/campaigns/local/setup";
  assert.deepEqual(Array.from(app.routeParts()), ["campaigns", "local", "setup"]);
  app.window.location.hash = "#/campaigns/local/start-note";
  assert.deepEqual(Array.from(app.routeParts()), ["campaigns", "local", "start-note"]);
  app.window.location.hash = "#/campaigns/local/players/player-mira/spells";
  assert.deepEqual(Array.from(app.routeParts()), ["campaigns", "local", "players", "player-mira", "spells"]);

  const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const script = fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8");
  assert.match(html, /href="index\.html#\/campaigns\/local\/setup"/);
  assert.match(html, /campaign-add-player-button/);
  assert.match(html, /id="campaigns"/);
  assert.doesNotMatch(html, /href="\/campaigns\/local\/setup"/);
  assert.match(script, /id="back-to-dashboard-button"/);
  assert.match(script, /addEventListener\("click", goToDashboard\)/);
  assert.match(script, /button\.hidden = !campaignReady\(campaign\)/);
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
      damageDice: "1d8",
      damageType: "cold",
      mode: "melee",
      range: "20/60 ft.",
      attackBonus: "+1",
      damageBonus: "+2",
      properties: ["reach", "thrown"],
    },
    features: [{ title: "Bound Spirit", description: "The spirit haunts the wielder." }],
  }]));

  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "3",
    "#player-strength": "16",
    "#player-equipment": "Blood Spear",
  }));
  const summaries = app.equipmentWeaponSummaries(player);
  const formMarkup = app.playerCharacterFormMarkup();

  assert.equal(player.attacks.length, 1);
  assert.equal(player.attacks[0].name, "Blood Spear");
  assert.equal(player.attacks[0].attackBonus, "+6");
  assert.equal(player.attacks[0].damageType, "1d8+5 cold");
  assert.equal(player.attacks[0].homebrew, true);
  assert.doesNotMatch(player.features, /Bound Spirit/);
  assert.equal(summaries[0].name, "Blood Spear");
  assert.equal(summaries[0].mode, "Melee");
  assert.deepEqual(Array.from(summaries[0].properties.map((property) => property.label)), ["Reach", "Thrown"]);
  assert.equal(summaries[0].features[0].title, "Bound Spirit");
  const weaponMarkup = app.equipmentWeaponCardsMarkup(player);
  assert.match(weaponMarkup, /Properties[\s\S]*data-property-label="Reach"[\s\S]*>RE<\/button>[\s\S]*data-property-label="Thrown"[\s\S]*>TH<\/button>[\s\S]*Bound Spirit/);
  assert.match(weaponMarkup, /data-property-detail="Adds 5 feet/);
  assert.doesNotMatch(weaponMarkup, /<p>Adds 5 feet|<p>Can be thrown/);
  assert.match(formMarkup, /id="player-equipment-entry" type="text" list="player-equipment-options"/);
  assert.match(formMarkup, /<option value="Blood Spear"><\/option>/);
});

test("character creation equipment widgets add numeric homebrew attack and damage bonuses", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-ember-axe",
    name: "Ember Axe",
    type: "Weapon",
    statistics: {
      damageDice: "1d12",
      damageType: "fire",
      attackBonus: "1",
      damageBonus: "2",
      properties: [],
    },
  }]));

  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "3",
    "#player-strength": "16",
    "#player-equipment": "Ember Axe",
  }));
  const markup = app.equipmentWeaponCardsMarkup(player);

  assert.equal(player.attacks[0].attackBonus, "+6");
  assert.equal(player.attacks[0].damageType, "1d12+5 fire");
  assert.match(markup, /Attack[\s\S]*\+6[\s\S]*Damage[\s\S]*1d12\+5 fire/);
});

test("equipment entry imports homebrew weapon names without duplicating weapon details into generic features", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-blood-spear",
    name: "Blood Spear",
    type: "Weapon",
    statistics: { damageDice: "1d8", damageType: "cold", attackBonus: "+1", properties: ["reach"] },
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
  assert.equal(fields["#player-features"].value, "");
});

test("homebrew weapons use structured weapon properties instead of description inference", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-storm-needle",
    name: "Storm Needle",
    type: "Weapon",
    description: "A finesse weapon. You gain a +1 bonus to attack and damage rolls. It deals 1d8 piercing damage.",
    statistics: {
      damageDice: "1d8",
      damageType: "piercing",
      mode: "melee",
      attackBonus: "+1",
      damageBonus: "+1",
      properties: ["finesse", "light"],
    },
    features: [{ title: "Storm Lash", description: "On a hit, sparks crawl across the target." }],
  }]));

  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "5",
    "#player-strength": "12",
    "#player-dexterity": "16",
    "#player-equipment": "Storm Needle",
  }));
  const summaries = app.equipmentWeaponSummaries(player);

  assert.equal(player.attacks.length, 1);
  assert.equal(player.attacks[0].name, "Storm Needle");
  assert.equal(player.attacks[0].attackBonus, "+7");
  assert.equal(player.attacks[0].damageType, "1d8+4 piercing");
  assert.equal(summaries[0].mode, "Melee or Dexterity");
  assert.deepEqual(Array.from(summaries[0].properties.map((property) => property.label)), ["Finesse", "Light"]);
  assert.doesNotMatch(player.features, /Description: A finesse weapon/);
});

test("homebrew versatile weapons use one computed attack summary", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-sentinel-spear",
    name: "Sentinel Spear",
    type: "Weapon",
    statistics: {
      damageDice: "1d6",
      damageType: "piercing",
      range: "20/60 ft.",
      attackBonus: "+1",
      damageBonus: "+2",
      properties: ["thrown", "versatile"],
      versatileDamage: "1d8",
    },
  }]));

  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "3",
    "#player-strength": "16",
    "#player-dexterity": "10",
    "#player-equipment": "Sentinel Spear",
  }));
  const summaries = app.equipmentWeaponSummaries(player);
  const markup = app.equipmentWeaponCardsMarkup(player);

  assert.equal(player.attacks.length, 1);
  assert.equal(player.attacks[0].name, "Sentinel Spear");
  assert.equal(player.attacks[0].attackBonus, "+6");
  assert.equal(player.attacks[0].damageType, "1d6+5 / 1d8+5 piercing");
  assert.equal(summaries[0].mode, "Melee");
  assert.match(markup, /Attack[\s\S]*\+6[\s\S]*Damage[\s\S]*1d6\+5 \/ 1d8\+5 piercing[\s\S]*20\/60 ft\./);
  assert.doesNotMatch(markup, /<dt>Ability<\/dt>|One-handed:/);
  assert.match(markup, /data-property-label="Versatile"[\s\S]*>VS<\/button>/);
  assert.match(markup, /data-property-detail="Can be used one-handed or two-handed\. Two-handed damage: 1d8\./);
  assert.doesNotMatch(markup, /<p>Can be used one-handed/);
});

test("character sheet recomputes homebrew weapon damage bonuses from equipment", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-blood-spear",
    name: "Blood Spear",
    type: "Weapon",
    statistics: {
      damageDice: "1d8",
      damageType: "cold",
      attackBonus: "+1",
      damageBonus: "+2",
      properties: [],
    },
  }]));

  const player = {
    characterName: "Mira",
    level: 3,
    abilities: { strength: 16, dexterity: 10 },
    equipment: "Blood Spear",
    attacks: [
      { name: "Blood Spear", attackBonus: "+5", damageType: "1d8 cold", generatedFromEquipment: true },
      { name: "Breath", attackBonus: "+4", damageType: "2d6 fire" },
    ],
  };
  const rows = app.playerAttackRows(player);

  assert.match(rows, /Blood Spear[\s\S]*\+6[\s\S]*1d8\+5 cold/);
  assert.doesNotMatch(rows, /1d8 cold/);
  assert.match(rows, /Breath[\s\S]*\+4[\s\S]*2d6 fire/);
});

test("weapon form extras are tied to selected properties", () => {
  const app = createFrontendSandbox();
  const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const script = fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8");
  const styles = fs.readFileSync(path.join(process.cwd(), "assets/styles.css"), "utf8");
  const propertyMarkup = app.itemWeaponPropertyBlocksMarkup({
    type: "Weapon",
    statistics: { properties: ["reach"], range: "" },
  });

  assert.equal(app.weaponNeedsVersatileDamage({ properties: ["versatile"] }), true);
  assert.equal(app.weaponNeedsVersatileDamage({ properties: ["finesse"] }), false);
  assert.equal(app.weaponNeedsRange({ properties: ["range"] }), true);
  assert.equal(app.weaponNeedsRange({ properties: ["thrown"] }), true);
  assert.equal(app.weaponNeedsRange({ properties: ["finesse"] }), false);
  assert.doesNotMatch(html, /item-weapon-modes|Weapon modes/);
  assert.match(html, /data-weapon-extra="range"/);
  assert.match(html, /data-weapon-extra="versatile"/);
  assert.match(html, /id="item-weapon-attack"/);
  assert.match(html, /id="item-weapon-damage-bonus"/);
  assert.match(script, /syncWeaponDependentFields/);
  assert.match(script, /wrapper\.hidden = !isVisible/);
  assert.match(script, /if \(!isVisible\) field\.value = ""/);
  assert.match(script, /function openWeaponPropertyOverlay/);
  assert.match(script, /data-property-info/);
  assert.match(styles, /\.weapon-property-icon/);
  assert.match(styles, /\.weapon-property-modal/);
  assert.match(propertyMarkup, /data-property-label="Reach"[\s\S]*>RE<\/button>/);
  assert.doesNotMatch(propertyMarkup, /<p>Adds 5 feet/);
});

test("homebrew form offers backgrounds instead of rules", () => {
  const app = createFrontendSandbox();
  const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const formMarkup = app.playerCharacterFormMarkup();
  const backgroundMarkup = app.itemBackgroundStatsMarkup({
    type: "Background",
    statistics: {
      abilityScores: ["Dexterity", "Wisdom", "Charisma"],
      originFeat: "Lucky",
      skills: ["Insight", "Stealth"],
      toolProficiency: "Thieves' Tools",
      equipment: "Two Daggers and 16 GP.",
    },
  });

  assert.match(html, /<option value="Background">Backgrounds<\/option>/);
  assert.doesNotMatch(html, /<option>Rule<\/option>/);
  assert.match(html, /id="item-background-abilities"/);
  assert.match(formMarkup, /id="player-background" type="text" list="player-background-options"/);
  assert.match(formMarkup, /id="player-bonds"/);
  assert.match(formMarkup, /id="player-notes"/);
  assert.match(formMarkup, /id="player-background-ability-controls"/);
  assert.doesNotMatch(formMarkup, /Background ability bonuses/);
  assert.match(formMarkup, /id="player-background-equipment-controls"/);
  assert.match(formMarkup, /id="player-gold"/);
  assert.match(formMarkup, /id="player-gold-shop-button"[\s\S]*0 GP/);
  assert.match(formMarkup, /id="equipment-shop-panel"/);
  assert.match(backgroundMarkup, /Ability Scores[\s\S]*Dexterity, Wisdom, Charisma/);
  assert.match(backgroundMarkup, /Origin Feat[\s\S]*Lucky/);
  assert.match(backgroundMarkup, /Tool Proficiency[\s\S]*Thieves&#039; Tools/);
});

test("lineages replace racial trait suggestions and apply traits automatically", () => {
  const app = createFrontendSandbox();
  const form = createCharacterFormStub({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "1",
    "#player-strength": "10",
    "#player-dexterity": "10",
    "#player-constitution": "10",
    "#player-intelligence": "10",
    "#player-wisdom": "10",
    "#player-charisma": "10",
  });
  const markup = app.playerCharacterFormMarkup();

  assert.match(markup, /value="Aarakocra"/);
  assert.match(markup, /value="Warforged"/);
  assert.match(markup, /id="player-lineage-ability-controls"/);
  assert.match(markup, /id="player-lineage-traits"/);
  assert.doesNotMatch(markup, /Lineage ability bonuses/);

  app.applyLineagePackageToForm(form, app.lineagePackageForName("Tiefling"));
  const player = app.buildPlayerCharacter(form);

  assert.equal(form.fields["#player-lineage-ability-bonuses"].value, "intelligence:1, charisma:2");
  assert.match(form.fields["#player-lineage-traits"].value, /Darkvision \(Lineage trait\)[\s\S]*Infernal Legacy \(Lineage trait\)/);
  assert.doesNotMatch(form.fields["#player-lineage-traits"].value, /Tiefling \(Lineage traits\)|Languages:|Traits:/);
  assert.equal(player.abilities.charisma, 12);
  assert.equal(player.abilities.intelligence, 11);
  assert.match(player.features, /Darkvision \(Lineage trait\)/);
  assert.match(player.features, /Infernal Legacy \(Lineage trait\)/);
  assert.doesNotMatch(player.features, /Tiefling \(Lineage traits\)|Languages:|Traits:/);

  app.applyLineagePackageToForm(form, app.lineagePackageForName("Half-Elf"));
  const halfElf = app.buildPlayerCharacter(form);
  const equipmentSection = app.playerSectionDefinitions(halfElf).find((section) => section.key === "equipment");
  assert.match(equipmentSection.body, /Fey Ancestry \(Lineage trait\)/);
  assert.match(equipmentSection.body, /Darkvision \(Lineage trait\)/);
  assert.match(equipmentSection.body, /Skill Versatility \(Lineage trait\)/);
  assert.doesNotMatch(equipmentSection.body, /Trance \(Lineage trait\)|Keen Senses \(Lineage trait\)/);
  assert.doesNotMatch(equipmentSection.body, /Half-Elf \(Lineage traits\)|Languages:|Traits:/);
});

test("suggestion cards only show backgrounds and feats without editable textareas", () => {
  const app = createFrontendSandbox();
  const panel = { innerHTML: "", dataset: {}, hidden: true };

  app.renderCharacterSuggestions(panel, {
    model: "local",
    suggestions: [{
      category: "racialTraits",
      label: "Darkvision",
      description: "Already granted by lineage.",
      mechanics: "You can see in darkness.",
      explanation: "Matches Half-Elf.",
      confidence: 0.95,
    }, {
      category: "feats",
      label: "Alert",
      description: "Watchful talent.",
      mechanics: "Gain initiative benefits.",
      explanation: "Matches watchful behavior.",
      confidence: 0.7,
    }],
  });

  assert.match(panel.innerHTML, /Suggested backgrounds and feats/);
  assert.match(panel.innerHTML, /Feat or talent/);
  assert.doesNotMatch(panel.innerHTML, /Darkvision|racial trait|Species or racial|Edit suggestion|data-suggestion-edit/i);
  assert.equal(app.characterSuggestionsFromPanel(panel).length, 1);
});

test("bonus skill choices are not limited to the class skill subgroup", () => {
  const app = createFrontendSandbox();
  const form = createCharacterFormStub({
    "#player-class-role": "Wizard",
    "#player-race": "Half-Elf",
  });
  app.applyLineagePackageToForm(form, app.lineagePackageForName("Half-Elf"));
  form.skillInputs.find((input) => input.value === "arcana").checked = true;
  form.skillInputs.find((input) => input.value === "history").checked = true;
  const athletics = form.skillInputs.find((input) => input.value === "athletics");
  athletics.checked = true;

  app.applyClassRestrictions(form);

  assert.equal(athletics.checked, true);
  assert.equal(athletics.disabled, false);
});

test("chosen backgrounds decompose into character sheet sections", () => {
  const app = createFrontendSandbox();
  const form = createCharacterFormStub({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "1",
    "#player-strength": "10",
    "#player-dexterity": "10",
    "#player-constitution": "10",
    "#player-intelligence": "10",
    "#player-wisdom": "10",
    "#player-charisma": "10",
  });

  app.applyBackgroundPackageToForm(form, app.backgroundPackageForName("Criminal"));
  const player = app.buildPlayerCharacter(form);

  assert.equal(form.fields["#player-background"].value, "Criminal");
  assert.match(form.fields["#player-features"].value, /Alert \(Feat\)/);
  assert.match(form.fields["#player-equipment"].value, /2 Daggers[\s\S]*Thieves' Tools[\s\S]*Crowbar/);
  assert.doesNotMatch(form.fields["#player-equipment"].value, /16 GP/);
  assert.equal(form.fields["#player-gold"].value, "16");
  assert.equal(form.fields["#player-background-skills"].value, "sleightOfHand, stealth");
  assert.equal(form.fields["#player-tool-proficiencies"].value, "Thieves' Tools");
  assert.equal(form.skillInputs.find((input) => input.value === "sleightOfHand").checked, true);
  assert.equal(form.skillInputs.find((input) => input.value === "stealth").checked, true);
  assert.equal(form.fields["#player-background-ability-controls"].hidden, false);
  assert.doesNotMatch(form.fields["#player-background-ability-controls"].innerHTML, /Apply \+2\/\+1/);
  assert.match(form.fields["#player-background-ability-controls"].innerHTML, /data-apply-background-ability-boosts[\s\S]*>\+2\/\+1<\/button>/);
  assert.match(form.fields["#player-background-ability-controls"].innerHTML, /data-apply-background-even-boosts[\s\S]*>\+1\/\+1\/\+1<\/button>/);
  assert.match(form.fields["#player-background-ability-controls"].innerHTML, /id="player-background-boost-fields" hidden/);
  assert.match(form.fields["#player-background-ability-controls"].innerHTML, /Choose from Dex\/Con\/Int \(\+2\/\+1 or \+1\/\+1\/\+1\)/);
  assert.equal(form.fields["#player-background-equipment-controls"].hidden, false);
  assert.match(form.fields["#player-background-equipment-controls"].innerHTML, /Starting gold[\s\S]*16 GP assigned/);
  assert.match(form.fields["#player-background-equipment-controls"].innerHTML, /Take \+50 GP instead/);
  app.applyEvenBackgroundAbilityBoosts(form);
  assert.equal(form.fields["#player-background-ability-bonuses"].value, "dexterity:1, constitution:1, intelligence:1");
  form.fields["#player-background-boost-primary"] = { value: "dexterity" };
  form.fields["#player-background-boost-secondary"] = { value: "constitution" };
  app.applySelectedBackgroundAbilityBoosts(form);
  assert.equal(form.fields["#player-background-ability-bonuses"].value, "dexterity:2, constitution:1");
  assert.equal(player.background, "Criminal");
  assert.equal(player.gold, 16);
  assert.ok(player.skillProficiencies.includes("sleightOfHand"));
  assert.ok(player.skillProficiencies.includes("stealth"));
  assert.ok(player.toolProficiencies.includes("Thieves' Tools"));
  assert.match(form.fields["#player-features"].value, /Gain a major bonus to Initiative/);
  assert.doesNotMatch(form.fields["#player-features"].value, /Granted by the Criminal background|Streetwise lawbreaker/);

  const sections = app.playerSectionDefinitions(player);
  const backgroundSection = sections.find((section) => section.key === "background");
  const equipmentSection = sections.find((section) => section.key === "equipment");
  assert.match(backgroundSection.body, /Streetwise lawbreaker/);
  assert.match(backgroundSection.body, /background-widget-card[\s\S]*Criminal[\s\S]*Streetwise lawbreaker/);
  assert.match(backgroundSection.body, /Feat: Alert/);
  assert.match(backgroundSection.body, /Starting gold: 16 GP/);
  assert.doesNotMatch(backgroundSection.body, /Ability scores:|Equipment:|source|date/i);
  assert.match(equipmentSection.body, /Alert \(Feat\)[\s\S]*Gain a major bonus to Initiative/);
  assert.doesNotMatch(equipmentSection.body, /Granted by the Criminal background|Streetwise lawbreaker/);
});

test("ability widgets summarize lineage and background bonuses together", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "1",
    "#player-strength": "10",
    "#player-dexterity": "10",
    "#player-constitution": "10",
    "#player-intelligence": "10",
    "#player-wisdom": "10",
    "#player-charisma": "10",
    "#player-lineage-ability-bonuses": "charisma:2",
    "#player-background-ability-bonuses": "dexterity:2, constitution:1",
  }));
  const abilitySection = app.playerSectionDefinitions(player).find((section) => section.key === "abilities");

  assert.match(abilitySection.body, /Ability bonuses/);
  assert.match(abilitySection.body, /Race: CHA \+2/);
  assert.match(abilitySection.body, /Background: DEX \+2, CON \+1/);
});

test("background equipment can be exchanged for starting gold", () => {
  const app = createFrontendSandbox();
  const form = createCharacterFormStub({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "1",
  });

  app.applyBackgroundPackageToForm(form, app.backgroundPackageForName("Criminal"));
  app.applyBackgroundEquipmentChoice(form, "gold");
  const player = app.buildPlayerCharacter(form);

  assert.equal(form.fields["#player-gold"].value, "66");
  assert.equal(form.fields["#player-equipment"].value, "");
  assert.equal(player.gold, 66);
  assert.ok(player.toolProficiencies.includes("Thieves' Tools"));
  assert.ok(player.skillProficiencies.includes("sleightOfHand"));
  assert.doesNotMatch(player.equipment, /Daggers|Crowbar|Thieves' Tools/);
  const equipmentSection = app.playerSectionDefinitions(player).find((section) => section.key === "equipment");
  assert.match(equipmentSection.body, /66 GP/);
});

test("background suggestions use the same package path as direct background selection", () => {
  const app = createFrontendSandbox();
  const form = createCharacterFormStub({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "1",
  });

  app.applyCharacterSuggestion(form, {
    category: "backgrounds",
    label: "Criminal",
    description: "Streetwise lawbreaker.",
    mechanics: "Ability scores: Con/Dex/Int. Origin feat: Alert. Skills: Sleight of Hand, Stealth. Tool: Thieves' Tools. Equipment: 2 Daggers, Thieves' Tools, Crowbar, 2 Pouches, Traveler's Clothes, 16 GP.",
  });

  assert.equal(form.fields["#player-background"].value, "Criminal");
  assert.equal(form.fields["#player-gold"].value, "16");
  assert.match(form.fields["#player-background-ability-controls"].innerHTML, /Choose from Dex\/Con\/Int \(\+2\/\+1 or \+1\/\+1\/\+1\)/);
  assert.match(form.fields["#player-background-equipment-controls"].innerHTML, /Starting gold[\s\S]*16 GP assigned/);
  assert.match(form.fields["#player-background-equipment-controls"].innerHTML, /Take \+50 GP instead/);
});

test("feat suggestions add rules text instead of suggestion metadata", () => {
  const app = createFrontendSandbox();
  const form = createCharacterFormStub();

  app.applyCharacterSuggestion(form, {
    category: "feats",
    label: "Alert",
    description: "Feat for watchful, tactical, or quick-reacting characters.",
    mechanics: "Gain a major bonus to Initiative.",
  });

  assert.match(form.fields["#player-features"].value, /Alert \(Feat\)[\s\S]*Gain a major bonus to Initiative/);
  assert.doesNotMatch(form.fields["#player-features"].value, /Feat for watchful|Mechanics:/);
});

test("skill-granting background feats unlock additional skill choices", () => {
  const app = createFrontendSandbox();
  const sageForm = createCharacterFormStub({ "#player-class-role": "Wizard" });
  app.applyBackgroundPackageToForm(sageForm, app.backgroundPackageForName("Sage"));
  assert.equal(sageForm.skillInputs.find((input) => input.value === "performance").disabled, true);

  const nobleForm = createCharacterFormStub({ "#player-class-role": "Wizard" });
  app.applyBackgroundPackageToForm(nobleForm, app.backgroundPackageForName("Noble"));
  assert.equal(nobleForm.skillInputs.find((input) => input.value === "performance").disabled, false);
});

test("changing backgrounds replaces generated background parts", () => {
  const app = createFrontendSandbox();
  const form = createCharacterFormStub({ "#player-level": "1" });

  app.applyBackgroundPackageToForm(form, app.backgroundPackageForName("Criminal"));
  app.applyBackgroundPackageToForm(form, app.backgroundPackageForName("Sage"));

  assert.equal(form.fields["#player-background"].value, "Sage");
  assert.doesNotMatch(form.fields["#player-features"].value, /Alert \(Feat\)/);
  assert.match(form.fields["#player-features"].value, /Magic Initiate \(Wizard\) \(Feat\)/);
  assert.doesNotMatch(form.fields["#player-equipment"].value, /Crowbar|Thieves' Tools/);
  assert.match(form.fields["#player-equipment"].value, /Quarterstaff[\s\S]*Calligrapher's Supplies/);
  assert.equal(form.fields["#player-gold"].value, "8");
  assert.equal(form.fields["#player-background-skills"].value, "arcana, history");
  assert.equal(form.fields["#player-tool-proficiencies"].value, "Calligrapher's Supplies");
});

test("backgrounds with fixed ability scores apply the increase automatically", () => {
  const app = createFrontendSandbox();
  const form = createCharacterFormStub({
    "#player-name": "Sam",
    "#player-character-name": "Mira",
    "#player-level": "1",
    "#player-strength": "10",
  });

  app.applyBackgroundPackageToForm(form, {
    label: "Stoneborn",
    abilityScores: ["Strength"],
    originFeat: "Tough",
    skills: [],
    equipment: "",
  });

  const player = app.buildPlayerCharacter(form);

  assert.equal(form.fields["#player-strength"].value, "10");
  assert.equal(form.fields["#player-background-ability-bonuses"].value, "strength:2");
  assert.equal(player.abilities.strength, 12);
  assert.equal(form.fields["#player-background-ability-controls"].hidden, true);
});

test("homebrew shop spends background gold and adds bought items", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-orwell",
    name: "ORWELL",
    type: "Magic Item",
    description: "A suspicious eye. Price: 5 GP.",
  }]));
  const form = createCharacterFormStub({
    "#player-level": "1",
    "#player-gold": "16",
  });

  app.renderEquipmentShop(form);
  assert.equal(form.fields["#equipment-shop-panel"].hidden, false);
  assert.match(form.fields["#equipment-shop-panel"].innerHTML, /ORWELL[\s\S]*5 GP/);

  app.buyHomebrewItemFromShop(form, "ORWELL");

  assert.equal(form.fields["#player-gold"].value, "11");
  assert.match(form.fields["#player-equipment"].value, /ORWELL/);
});

test("homebrew armor descriptions increase character armor class", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-moon-guard",
    name: "Moon Guard",
    type: "Armor",
    description: "Base AC is 13 + Dexterity modifier, maximum of +2. The enchantment gives a +1 bonus to AC.",
  }]));

  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
    "#player-level": "4",
    "#player-dexterity": "16",
    "#player-equipment": "Moon Guard",
  }));

  assert.equal(player.combat.armorClass, 16);
  assert.equal(player.attacks.length, 0);
  assert.match(player.features, /Moon Guard \(Homebrew item\)/);
  assert.match(player.features, /Description: Base AC is 13/);
});

test("homebrew equipment details are not duplicated in character feature widgets", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-moon-guard",
    name: "Moon Guard",
    type: "Armor",
    description: "Base AC is 13 + Dexterity modifier.",
  }]));

  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
    "#player-level": "4",
    "#player-equipment": "Moon Guard",
    "#player-features": "Alert (Feat)\nAlways ready for danger.",
  }));
  const equipmentSection = app.playerSectionDefinitions(player).find((section) => section.key === "equipment");
  const sheetMarkup = app.characterSheetMarkup(player);
  const featureWidget = equipmentSection.body.split("<h4>Features and traits</h4>")[1] || "";
  const sheetFeatures = sheetMarkup.split("sheet-traits-widget")[1] || "";

  assert.match(equipmentSection.body, /Homebrew items[\s\S]*Moon Guard/);
  assert.match(featureWidget, /Alert \(Feat\)/);
  assert.doesNotMatch(featureWidget, /Moon Guard \(Homebrew item\)|Base AC is 13/);
  assert.match(sheetFeatures, /Alert \(Feat\)/);
  assert.doesNotMatch(sheetFeatures, /Moon Guard \(Homebrew item\)|Base AC is 13/);
});

test("character sheet groups skills under their saving throw ability", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
    "#player-level": "4",
    "#player-saving-throws": ["strength"],
    "#player-skills": ["athletics", "stealth"],
  }));
  const sheetMarkup = app.characterSheetMarkup(player);
  const strengthGroup = sheetMarkup.match(/<div class="sheet-skill-group">[\s\S]*?<strong>Strength<\/strong>[\s\S]*?<\/div>\s*<\/div>/)?.[0] || "";
  const dexterityGroup = sheetMarkup.match(/<div class="sheet-skill-group">[\s\S]*?<strong>Dexterity<\/strong>[\s\S]*?<\/div>\s*<\/div>/)?.[0] || "";

  assert.match(sheetMarkup, /Saving Throws &amp; Skills/);
  assert.match(strengthGroup, /Saving throw/);
  assert.match(strengthGroup, /Athletics/);
  assert.doesNotMatch(strengthGroup, /Stealth/);
  assert.match(dexterityGroup, /Stealth/);
});

test("character sheet renders trait icons with overlay data", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
    "#player-level": "4",
    "#player-features": "Alert (Feat)\nAlways ready for danger.",
  }));
  const sheetMarkup = app.characterSheetMarkup(player);

  assert.match(sheetMarkup, /sheet-trait-button/);
  assert.match(sheetMarkup, /data-trait-title="Alert \(Feat\)"/);
  assert.match(sheetMarkup, /Always ready for danger/);
  assert.match(sheetMarkup, /id="sheet-trait-modal"/);
  assert.match(sheetMarkup, /data-edit-sheet-field="features"/);
});

test("player widgets expose a level up action", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(createCharacterFormStub({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
    "#player-class-role": "Fighter",
    "#player-level": "4",
  }));
  const markup = app.playerCharacterCard({ ...player, campaignId: "local" });

  assert.match(markup, /Level up/);
  assert.match(markup, /href="index\.html#\/campaigns\/local\/players\/[^"]+\/level-up"/);
});

test("level up applies class level, hit points, proficiency, abilities, and feature notes", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(createCharacterFormStub({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
    "#player-class-role": "Fighter",
    "#player-level": "4",
    "#player-race": "Human",
    "#player-strength": "16",
    "#player-dexterity": "12",
    "#player-constitution": "14",
    "#player-equipment": "Longsword",
    "#player-hp-max": "32",
  }));
  const result = app.applyPlayerLevelUp(player, {
    className: "Fighter",
    hitPointGain: 7,
    abilityDeltas: { strength: 2 },
    notes: "Extra Attack",
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.player.level, 5);
  assert.equal(result.player.classLevels.length, 1);
  assert.equal(result.player.classLevels[0].className, "Fighter");
  assert.equal(result.player.classLevels[0].level, 5);
  assert.equal(result.player.proficiencyBonus, 3);
  assert.equal(result.player.abilities.strength, 18);
  assert.equal(result.player.combat.hitPointMaximum, 39);
  assert.equal(result.player.combat.hitDice, "5d10");
  assert.match(result.player.features, /Level 5 Advancement/);
  assert.match(result.player.features, /Extra Attack/);
  assert.match(result.player.attacks.find((attack) => attack.name === "Longsword").attackBonus, /\+7/);
});

test("level up handles constitution increases with retroactive hit points", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(createCharacterFormStub({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
    "#player-class-role": "Fighter",
    "#player-level": "7",
    "#player-strength": "16",
    "#player-constitution": "17",
    "#player-hp-max": "60",
  }));
  const result = app.applyPlayerLevelUp(player, {
    className: "Fighter",
    hitPointGain: 9,
    abilityDeltas: { constitution: 1 },
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.player.level, 8);
  assert.equal(result.player.abilities.constitution, 18);
  assert.equal(result.advancement.constitutionRetroactiveHitPoints, 8);
  assert.equal(result.player.combat.hitPointMaximum, 77);
});

test("level up validates new multiclass prerequisites", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(createCharacterFormStub({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
    "#player-class-role": "Fighter",
    "#player-level": "4",
    "#player-strength": "16",
    "#player-dexterity": "12",
    "#player-charisma": "8",
  }));
  const result = app.applyPlayerLevelUp(player, { className: "Sorcerer", hitPointGain: 4 });

  assert.match(result.errors.join(" "), /Sorcerer requires Charisma 13/);
});

test("level up page markup previews advancement and spell slots", () => {
  const app = createFrontendSandbox();
  const player = app.buildPlayerCharacter(createCharacterFormStub({
    "#player-name": "Riley",
    "#player-character-name": "Mira",
    "#player-class-role": "Wizard",
    "#player-level": "4",
    "#player-intelligence": "16",
    "#player-constitution": "12",
  }));
  const markup = app.playerLevelUpMarkup(player, "local");

  assert.match(markup, /Advancement Preview/);
  assert.match(markup, /4 -&gt; 5/);
  assert.match(markup, /Spell slots/);
  assert.match(markup, /Level 1: 4, Level 2: 3, Level 3: 2/);
  assert.match(markup, /Apply level up/);
});

test("character sheet divides equipment into item widgets with homebrew detail links", () => {
  const app = createFrontendSandbox();
  app.localStorage.setItem("dnducks.items", JSON.stringify([{
    id: "item-blood-spear",
    name: "Blood Spear",
    type: "Weapon",
    description: "A spear with a frozen blood shaft.",
    statistics: { damage: "1d6 piercing", attackBonus: "+1", damageBonus: "+2" },
  }]));
  const player = app.buildPlayerCharacter(mockPlayerForm({
    "#player-name": "Riley",
    "#player-character-name": "Bramble",
    "#player-level": "4",
    "#player-equipment": "Blood Spear\nDagger\nRope",
  }));
  const sheetMarkup = app.characterSheetMarkup(player);
  const script = fs.readFileSync(path.join(process.cwd(), "assets/script.js"), "utf8");

  assert.match(sheetMarkup, /sheet-equipment-widget/);
  assert.match(sheetMarkup, /sheet-equipment-card is-homebrew/);
  assert.match(sheetMarkup, /data-homebrew-item-id="item-blood-spear"/);
  assert.match(sheetMarkup, /data-equipment-title="Dagger"/);
  assert.match(sheetMarkup, /Attack:/);
  assert.match(sheetMarkup, /id="sheet-equipment-modal"/);
  assert.match(script, /openWidgetDetail\("items", button\.dataset\.homebrewItemId\)/);
});

test("spellcasting classes choose starting spells and render slot tracking", () => {
  const app = createFrontendSandbox();
  app.DNDUCKS_SPELLS = [
    { id: "0-fire-bolt", name: "Fire Bolt", level: 0, levelName: "Cantrip", school: "Evocation", castingTime: "1 Action", range: "120 feet", duration: "Instantaneous", description: "A ranged spell attack.", classes: ["Wizard", "Sorcerer"] },
    { id: "1-magic-missile", name: "Magic Missile", level: 1, levelName: "1st Level", school: "Evocation", castingTime: "1 Action", range: "120 feet", duration: "Instantaneous", description: "Force darts hit automatically.", classes: ["Wizard", "Sorcerer"] },
    { id: "1-hex", name: "Hex", level: 1, levelName: "1st Level", school: "Enchantment", castingTime: "1 Bonus Action", range: "90 feet", duration: "Concentration, up to 1 hour", description: "A curse empowered by pact magic.", classes: ["Warlock"] },
  ];
  const player = app.buildPlayerCharacter(createCharacterFormStub({
    "#player-name": "Riley",
    "#player-character-name": "Mira",
    "#player-class-role": "Wizard",
    "#player-level": "1",
    "player-spells": ["0-fire-bolt", "1-magic-missile"],
  }));
  const sheetMarkup = app.characterSheetMarkup(player);
  const runtime = app.spellcastingRuntimeForPlayer(player);

  assert.deepEqual(player.spellcasting.spells, ["0-fire-bolt", "1-magic-missile"]);
  assert.deepEqual(Array.from(runtime.normalSlots), [2]);
  assert.match(sheetMarkup, /Spellcasting/);
  assert.match(sheetMarkup, /sheet-spellbook-page/);
  assert.match(sheetMarkup, /href="index\.html#\/campaigns\/local\/players\/[^"]+\/spells"/);
  assert.match(sheetMarkup, />Spells</);
  assert.match(sheetMarkup, /Cantrips/);
  assert.doesNotMatch(sheetMarkup, /Magic Missile/);
  assert.match(sheetMarkup, /Normal spell slots recover when you finish a long rest/);
  assert.match(sheetMarkup, /data-spell-slot-kind="normal"/);
  assert.match(sheetMarkup, /id="sheet-spell-modal"/);
  const spellbookMarkup = app.playerSpellbookMarkup(player);
  assert.match(spellbookMarkup, /Cantrips/);
  assert.match(spellbookMarkup, /1st Level/);
  assert.match(spellbookMarkup, /Magic Missile/);
  assert.match(spellbookMarkup, /spell-badge/);
  assert.match(app.spellDetailMarkup(app.DNDUCKS_SPELLS[1]), /Description/);
  assert.match(app.spellDetailMarkup(app.DNDUCKS_SPELLS[1]), /Classes/);
});

test("spell picker renders grouped summaries for cantrips and leveled spells", () => {
  const app = createFrontendSandbox();
  app.DNDUCKS_SPELLS = [
    { id: "0-fire-bolt", name: "Fire Bolt", level: 0, levelName: "Cantrip", school: "Evocation", castingTime: "1 Action", range: "120 feet", duration: "Instantaneous", components: "V, S", description: "A ranged spell attack.", classes: ["Wizard"] },
    { id: "1-magic-missile", name: "Magic Missile", level: 1, levelName: "1st Level", school: "Evocation", castingTime: "1 Action", range: "120 feet", duration: "Instantaneous", components: "V, S", description: "Force darts hit automatically.", classes: ["Wizard"] },
  ];
  const classLevels = [{ className: "Wizard", level: 1 }];
  const summary = app.spellcastingSummaryForClassLevels(classLevels, { intelligence: 16 });
  const selectedIds = ["0-fire-bolt", "1-magic-missile"];
  const selectionSummary = app.spellPickerSelectionSummaryMarkup(summary, classLevels, { intelligence: 16 }, selectedIds);
  const groups = app.spellsGroupedByLevel(app.availableSpellsForClassLevels(classLevels));
  const groupMarkup = groups.map((group) => app.spellPickerLevelGroupMarkup(group, new Set(selectedIds), app.selectedSpellIdsByLevel(selectedIds))).join("");

  assert.match(selectionSummary, /Cantrips selected/);
  assert.match(selectionSummary, /Spellbook spells/);
  assert.match(selectionSummary, /Spell slots/);
  assert.match(groupMarkup, /Cantrips/);
  assert.match(groupMarkup, /Level 1 Spells/);
  assert.match(groupMarkup, /spell-picker-card is-selected/);
  assert.match(groupMarkup, /Details/);
});

test("spell selection validates class cantrip limits", () => {
  const app = createFrontendSandbox();
  app.DNDUCKS_SPELLS = [
    { id: "0-fire-bolt", name: "Fire Bolt", level: 0, levelName: "Cantrip", school: "Evocation", castingTime: "1 Action", range: "120 feet", duration: "Instantaneous", description: "A ranged spell attack.", classes: ["Wizard"] },
    { id: "0-light", name: "Light", level: 0, levelName: "Cantrip", school: "Evocation", castingTime: "1 Action", range: "Touch", duration: "1 hour", description: "Light from an object.", classes: ["Wizard"] },
    { id: "0-mage-hand", name: "Mage Hand", level: 0, levelName: "Cantrip", school: "Conjuration", castingTime: "1 Action", range: "30 feet", duration: "1 minute", description: "A spectral hand.", classes: ["Wizard"] },
    { id: "0-message", name: "Message", level: 0, levelName: "Cantrip", school: "Transmutation", castingTime: "1 Action", range: "120 feet", duration: "1 round", description: "A whispered message.", classes: ["Wizard"] },
  ];
  const player = app.buildPlayerCharacter(createCharacterFormStub({
    "#player-name": "Riley",
    "#player-character-name": "Mira",
    "#player-class-role": "Wizard",
    "#player-level": "1",
    "#player-intelligence": "16",
    "player-spells": ["0-fire-bolt", "0-light", "0-mage-hand", "0-message"],
  }));

  assert.match(app.validatePlayerCharacter(player).join(" "), /Choose no more than 3 cantrips/);
});

test("artificer spellcasting uses prepared limits and first-level slots", () => {
  const app = createFrontendSandbox();
  app.DNDUCKS_SPELLS = [
    { id: "0-mending", name: "Mending", level: 0, levelName: "Cantrip", school: "Transmutation", castingTime: "1 Minute", range: "Touch", duration: "Instantaneous", description: "Repairs an object.", classes: ["Artificer"] },
    { id: "1-cure-wounds", name: "Cure Wounds", level: 1, levelName: "1st Level", school: "Evocation", castingTime: "1 Action", range: "Touch", duration: "Instantaneous", description: "Restores hit points.", classes: ["Artificer"] },
    { id: "1-faerie-fire", name: "Faerie Fire", level: 1, levelName: "1st Level", school: "Evocation", castingTime: "1 Action", range: "60 feet", duration: "Concentration, up to 1 minute", description: "Outlines creatures.", classes: ["Artificer"] },
    { id: "1-feather-fall", name: "Feather Fall", level: 1, levelName: "1st Level", school: "Transmutation", castingTime: "1 Reaction", range: "60 feet", duration: "1 minute", description: "Slows falling.", classes: ["Artificer"] },
    { id: "1-grease", name: "Grease", level: 1, levelName: "1st Level", school: "Conjuration", castingTime: "1 Action", range: "60 feet", duration: "1 minute", description: "Creates slick grease.", classes: ["Artificer"] },
  ];
  const valid = app.buildPlayerCharacter(createCharacterFormStub({
    "#player-name": "Riley",
    "#player-character-name": "Mira",
    "#player-class-role": "Artificer",
    "#player-level": "1",
    "#player-intelligence": "16",
    "player-spells": ["0-mending", "1-cure-wounds", "1-faerie-fire", "1-feather-fall"],
  }));
  const invalid = app.buildPlayerCharacter(createCharacterFormStub({
    "#player-name": "Riley",
    "#player-character-name": "Mira",
    "#player-class-role": "Artificer",
    "#player-level": "1",
    "#player-intelligence": "16",
    "player-spells": ["1-cure-wounds", "1-faerie-fire", "1-feather-fall", "1-grease"],
  }));

  assert.deepEqual(Array.from(app.spellcastingRuntimeForPlayer(valid).normalSlots), [2]);
  assert.deepEqual(Array.from(app.validatePlayerCharacter(valid)), []);
  assert.match(app.validatePlayerCharacter(invalid).join(" "), /Choose no more than 3 leveled spells/);
});

test("warlock pact slots are tracked separately and recover on short rest", () => {
  const app = createFrontendSandbox();
  app.DNDUCKS_SPELLS = [
    { id: "1-hex", name: "Hex", level: 1, levelName: "1st Level", school: "Enchantment", castingTime: "1 Bonus Action", range: "90 feet", duration: "Concentration, up to 1 hour", description: "A curse empowered by pact magic.", classes: ["Warlock"] },
  ];
  const player = app.buildPlayerCharacter(createCharacterFormStub({
    "#player-name": "Riley",
    "#player-character-name": "Mira",
    "#player-class-role": "Warlock",
    "#player-level": "2",
    "player-spells": ["1-hex"],
  }));
  const used = app.setPlayerSpellSlotUsage(player, "pact", 1, 1);
  const rested = app.recoverPlayerSpellSlots(used, "short");
  const sheetMarkup = app.characterSheetMarkup(used);

  assert.equal(app.spellcastingRuntimeForPlayer(used).slotUsage.pact, 1);
  assert.equal(app.spellcastingRuntimeForPlayer(rested).slotUsage.pact, 0);
  assert.match(sheetMarkup, /Pact 1st Level/);
  assert.match(sheetMarkup, /Warlock Pact Magic slots recover when you finish a short or long rest/);
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
  assert.match(script, /uploadImages\(input\?\.files \|\| \[\], \{ title, mediaType, source: "media" \}\)/);
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

test("interactive maps use image-coordinate canvas and centered pins", () => {
  const app = createFrontendSandbox();
  const styles = fs.readFileSync(path.join(process.cwd(), "assets/styles.css"), "utf8");
  const map = {
    id: "map-1",
    title: "Sword Coast",
    imageUrl: "/uploads/maps/sword-coast.png",
    imageWidth: 1000,
    imageHeight: 500,
  };
  const city = {
    id: "city-1",
    mapId: "map-1",
    cityName: "Brightwater",
    normalizedX: 0.25,
    normalizedY: 0.5,
  };

  const html = app.interactiveMapViewerMarkup(map, [city]);
  assert.match(html, /aspect-ratio: 1000 \/ 500/);
  assert.match(html, /data-map-canvas/);
  assert.match(html, /draggable="false"/);
  assert.match(app.cityPinFormMarkup(), /id="city-edit-id"/);
  assert.match(app.cityPinFormMarkup(), /id="city-pin-cancel-edit" hidden/);
  assert.match(styles, /\.map-pin span \{[\s\S]*transform: translate\(-50%, -50%\);/);
  assert.match(styles, /\.map-click-marker \{[\s\S]*transform: translate\(-50%, -50%\);/);

  const point = app.mapPointFromCanvasEvent(
    { clientX: 250, clientY: 125 },
    { getBoundingClientRect: () => ({ left: 50, top: 25, width: 800, height: 400 }) }
  );
  assert.equal(point.normalizedX, 0.25);
  assert.equal(point.normalizedY, 0.25);
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

test("local app origins stay put when the canonical backend is unreachable", async () => {
  const app = createFrontendSandbox({
    hostname: "127.0.0.1",
    port: "5500",
    pathname: "/index.html",
    hash: "#items",
    skipAutoBoot: false,
    initialStorage: {
      "dnducks.items": JSON.stringify([{ id: "item-live", name: "Live Server Blade" }]),
    },
  });

  await app.window.DNDUCKS_BOOT_PROMISE;
  assert.equal(app.window.location.pathname, "/index.html");
  assert.equal(app.window.location.port, "5500");
  assert.equal(app.window.name, "");
});

test("reachable canonical local origin redirects with local storage import", async () => {
  const app = createFrontendSandbox({
    hostname: "127.0.0.1",
    port: "5500",
    pathname: "/index.html",
    hash: "#items",
    disableCanonicalRedirect: false,
    fetch: async () => ({}),
    skipAutoBoot: false,
    initialStorage: {
      "dnducks.items": JSON.stringify([{ id: "item-live", name: "Live Server Blade" }]),
    },
  });

  await app.window.DNDUCKS_BOOT_PROMISE;
  assert.match(app.window.location.href, /^http:\/\/127\.0\.0\.1:3000\/index\.html\?dnducksImport=windowName#items$/);
  const payload = JSON.parse(app.window.name);
  assert.equal(payload.source, "dnducks-local-storage");
  assert.match(payload.storage["dnducks.items"], /Live Server Blade/);
});

test("nested Live Server paths redirect to the canonical app entry point when reachable", async () => {
  const app = createFrontendSandbox({
    hostname: "127.0.0.1",
    port: "5500",
    pathname: "/github/git-github-masterclass-starter-project-1/index.html",
    disableCanonicalRedirect: false,
    fetch: async () => ({}),
    skipAutoBoot: false,
    initialStorage: {
      "dnducks.characters": JSON.stringify([{ id: "npc-orwell", name: "ORWELL" }]),
    },
  });

  await app.window.DNDUCKS_BOOT_PROMISE;
  assert.match(app.window.location.href, /^http:\/\/127\.0\.0\.1:3000\/index\.html\?dnducksImport=windowName$/);
  const payload = JSON.parse(app.window.name);
  assert.match(payload.storage["dnducks.characters"], /ORWELL/);
});

test("canonical import merges split widgets from another local origin", async () => {
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
    skipAutoBoot: false,
    initialStorage: {
      "dnducks.items": JSON.stringify([{ id: "item-preview", name: "Preview Spear" }]),
    },
  });

  await app.window.DNDUCKS_BOOT_PROMISE;
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

test("wild shape overlay preserves original character data and renders temporary beast widgets", () => {
  const app = createFrontendSandbox();
  app.DNDUCKS_BEAST_SHAPES = [{
    id: "standard-wolf",
    name: "Wolf",
    cr: "1/4",
    crValue: 0.25,
    size: "Medium",
    hp: 11,
    ac: 13,
    strength: 12,
    dexterity: 15,
    constitution: 12,
    speed: "40 ft.",
    swim: "—",
    fly: "—",
    traits: "Keen Hearing and Smell, Pack Tactics",
    formType: "Standard",
    sourceUrl: "https://dnd-5e.fandom.com/wiki/Wolf",
    skills: { perception: 3, stealth: 4 },
    actions: [{ name: "Bite", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage." }],
  }];
  const druid = {
    id: "player-druid",
    playerName: "M",
    characterName: "Thorn",
    classRole: "Druid",
    level: 2,
    race: "Human",
    alignment: "Neutral",
    abilities: { strength: 8, dexterity: 10, constitution: 12, intelligence: 14, wisdom: 16, charisma: 11 },
    savingThrowProficiencies: ["intelligence", "wisdom"],
    skillProficiencies: ["perception"],
    combat: { armorClass: 11, speed: 30, hitPointMaximum: 19, hitDice: "2d8" },
    attacks: [],
  };

  const transformed = app.applyWildShapeOverlay(druid, app.DNDUCKS_BEAST_SHAPES[0]);
  assert.equal(transformed.abilities.strength, 8);
  assert.equal(transformed.activeWildShape.beastId, "standard-wolf");
  assert.equal(transformed.wildShapeOverlay.abilities.strength, 12);
  assert.equal(transformed.wildShapeOverlay.abilities.wisdom, 16);
  assert.equal(transformed.wildShapeOverlay.armorClass, 13);
  assert.equal(transformed.wildShapeOverlay.spellcastingDisabled, true);
  assert.equal(transformed.wildShapeOverlay.actions[0].attackBonus, "+4");
  assert.equal(transformed.wildShapeOverlay.actions[0].damageDice, "2d4");
  assert.equal(transformed.wildShapeOverlay.actions[0].damageBonus, "+2");
  assert.equal(transformed.wildShapeOverlay.actions[0].damageType, "piercing");

  const markup = app.characterSheetMarkup(transformed);
  assert.match(markup, /wild-shape-active-panel/);
  assert.match(markup, /wild-shape-banner/);
  assert.match(markup, /beast-hp-panel/);
  assert.match(markup, /wild-shape-mechanics-grid/);
  assert.match(markup, /Beast Actions/);
  assert.match(markup, /Beast Traits/);
  assert.doesNotMatch(markup, /Quarterstaff/);
  assert.match(markup, /Original 8/);

  const reverted = app.revertWildShape(transformed);
  assert.equal(reverted.activeWildShape, undefined);
  assert.deepEqual(reverted.abilities, druid.abilities);
  assert.deepEqual(reverted.combat, druid.combat);
});

test("API URL resolver keeps backend requests relative", () => {
  const app = createFrontendSandbox({ hostname: "localhost", port: "3000" });

  assert.equal(app.resolveApiUrl("/api/materials"), "/api/materials");
});

test("API URL resolver targets the backend when served from a static local port", () => {
  const app = createFrontendSandbox({ hostname: "127.0.0.1", port: "5500" });

  assert.equal(app.resolveApiUrl("/api/characters/analyze"), "http://127.0.0.1:3000/api/characters/analyze");
});

test("backend asset resolver keeps upload URLs on the backend origin from static ports", () => {
  const app = createFrontendSandbox({ hostname: "127.0.0.1", port: "5500" });

  assert.equal(app.resolveBackendUrl("/uploads/images/example.png"), "http://127.0.0.1:3000/uploads/images/example.png");
  assert.equal(app.resolveBackendUrl("/uploads/maps/world.png"), "http://127.0.0.1:3000/uploads/maps/world.png");
  assert.equal(app.resolveBackendUrl("/api/materials/abc/download"), "http://127.0.0.1:3000/api/materials/abc/download");
});

test("backend asset resolver leaves backend-served upload URLs relative on port 3000", () => {
  const app = createFrontendSandbox({ hostname: "127.0.0.1", port: "3000" });

  assert.equal(app.resolveBackendUrl("/uploads/images/example.png"), "/uploads/images/example.png");
});
