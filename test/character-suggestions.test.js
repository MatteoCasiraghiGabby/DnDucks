const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  ALLOWED_CHARACTER_SUGGESTIONS,
  backgroundSuggestionFromPayload,
  parseSuggestionTable,
  upsertSuggestionInFile,
} = require("../src/characterSuggestionData");

test("character suggestions load from the editable TSV file", () => {
  assert.equal(ALLOWED_CHARACTER_SUGGESTIONS.racialTraits, undefined);
  assert.equal(ALLOWED_CHARACTER_SUGGESTIONS.backgroundFeatures, undefined);
  assert.equal(ALLOWED_CHARACTER_SUGGESTIONS.backgrounds.length, 16);
  assert.equal(ALLOWED_CHARACTER_SUGGESTIONS.feats.length, 83);
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.feats.some((item) => item.id === "feat-alert" && item.tags.includes("watchful")));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.feats.some((item) => item.id === "feat-great-weapon-master" && item.tags.includes("heavy weapon")));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.backgrounds.some((item) => item.id === "background-acolyte" && item.mechanics.includes("Magic Initiate (Cleric)")));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.backgrounds.some((item) => item.id === "background-wayfarer" && item.mechanics.includes("2 Daggers")));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.feats.every((item) => item.source === ""));
});

test("manual TSV entries parse into suggestion categories", () => {
  const parsed = parseSuggestionTable([
    "category\tid\tlabel\tdescription\tmechanics\tsource\ttags",
    "feats\tfeat-duelist\tDuelist\tPrecise weapon talent.\tUse table-approved dueling benefits.\tManual\tduel; sword; noble",
  ].join("\n"));

  assert.deepEqual(parsed.feats, [{
    id: "feat-duelist",
    label: "Duelist",
    description: "Precise weapon talent.",
    mechanics: "Use table-approved dueling benefits.",
    source: "Manual",
    tags: ["duel", "sword", "noble"],
  }]);
});

test("homebrew backgrounds can be written into the suggestion TSV", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnducks-suggestions-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const filePath = path.join(tempDir, "character-suggestions.tsv");
  fs.writeFileSync(filePath, "category\tid\tlabel\tdescription\tmechanics\tsource\ttags\n");

  const suggestion = backgroundSuggestionFromPayload({
    label: "Wayfarer",
    description: "Street-raised survivor.",
    abilityScores: ["Dexterity", "Wisdom", "Charisma"],
    originFeat: "Lucky",
    skills: ["Insight", "Stealth"],
    toolProficiency: "Thieves' Tools",
    equipment: "Two Daggers, Thieves' Tools, and 16 GP.",
    tags: ["street", "survivor", "stealth"],
  });
  upsertSuggestionInFile(suggestion, filePath);

  const parsed = parseSuggestionTable(fs.readFileSync(filePath, "utf8"));
  assert.deepEqual(parsed.backgrounds[0], {
    id: "background-wayfarer",
    label: "Wayfarer",
    description: "Street-raised survivor.",
    mechanics: "Ability scores: Dexterity/Wisdom/Charisma. Origin feat: Lucky. Skills: Insight, Stealth. Tool: Thieves' Tools. Equipment: Two Daggers, Thieves' Tools, and 16 GP.",
    source: "Homebrew",
    tags: ["street", "survivor", "stealth"],
  });

  upsertSuggestionInFile({ ...suggestion, description: "Updated survivor." }, filePath);
  const reparsed = parseSuggestionTable(fs.readFileSync(filePath, "utf8"));
  assert.equal(reparsed.backgrounds.length, 1);
  assert.equal(reparsed.backgrounds[0].description, "Updated survivor.");
});
