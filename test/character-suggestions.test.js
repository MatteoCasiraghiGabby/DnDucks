const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ALLOWED_CHARACTER_SUGGESTIONS,
  parseSuggestionTable,
} = require("../src/characterSuggestionData");

test("character suggestions load from the editable TSV file", () => {
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.racialTraits.some((item) => item.id === "racial-trait-darkvision-60"));
  assert.equal(ALLOWED_CHARACTER_SUGGESTIONS.backgroundFeatures, undefined);
  assert.equal(ALLOWED_CHARACTER_SUGGESTIONS.backgrounds.length, 16);
  assert.equal(ALLOWED_CHARACTER_SUGGESTIONS.feats.length, 83);
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.feats.some((item) => item.id === "feat-alert" && item.tags.includes("watchful")));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.feats.some((item) => item.id === "feat-great-weapon-master" && item.tags.includes("heavy weapon")));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.backgrounds.some((item) => item.id === "background-acolyte" && item.mechanics.includes("Magic Initiate (Cleric)")));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.backgrounds.some((item) => item.id === "background-wayfarer" && item.mechanics.includes("Thieves' Tools")));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.feats.every((item) => item.source === ""));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.racialTraits.every((item) => item.source === ""));
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
