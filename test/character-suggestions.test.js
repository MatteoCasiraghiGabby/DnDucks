const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ALLOWED_CHARACTER_SUGGESTIONS,
  parseSuggestionTable,
} = require("../src/characterSuggestionData");

test("character suggestions load from the editable TSV file", () => {
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.backgroundFeatures.some((item) => item.id === "background-feature-researcher"));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.racialTraits.some((item) => item.id === "racial-trait-darkvision"));
  assert.ok(ALLOWED_CHARACTER_SUGGESTIONS.feats.some((item) => item.tags.includes("watch")));
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
