const fs = require("node:fs");
const path = require("node:path");

const CHARACTER_SUGGESTION_CATEGORIES = {
  backgrounds: "Background package",
  backgroundFeatures: "Background feature",
  racialTraits: "Species or racial trait",
  feats: "Feat or talent",
};

const CHARACTER_SUGGESTIONS_FILE = path.join(__dirname, "..", "data", "character-suggestions.tsv");

function cleanCell(value = "") {
  return String(value || "").trim();
}

function splitTags(value = "") {
  return cleanCell(value)
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseSuggestionTable(text = "") {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"));
  if (!lines.length) return {};

  const headers = lines[0].split("\t").map(cleanCell);
  const allowedCategories = new Set(Object.keys(CHARACTER_SUGGESTION_CATEGORIES));
  const suggestions = Object.fromEntries(Object.keys(CHARACTER_SUGGESTION_CATEGORIES).map((category) => [category, []]));

  lines.slice(1).forEach((line) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, cleanCell(line.split("\t")[index])]));
    if (!allowedCategories.has(row.category) || !row.id || !row.label) return;
    suggestions[row.category].push({
      id: row.id,
      label: row.label,
      description: row.description || row.label,
      mechanics: row.mechanics || "",
      source: row.source || "",
      tags: splitTags(row.tags),
    });
  });

  return suggestions;
}

function loadAllowedCharacterSuggestions(filePath = CHARACTER_SUGGESTIONS_FILE) {
  try {
    const suggestions = parseSuggestionTable(fs.readFileSync(filePath, "utf8"));
    return Object.fromEntries(Object.entries(suggestions).map(([category, items]) => [category, items || []]));
  } catch (error) {
    throw new Error(`Could not load character suggestions from ${filePath}: ${error.message}`);
  }
}

const ALLOWED_CHARACTER_SUGGESTIONS = loadAllowedCharacterSuggestions();

function allAllowedSuggestionIds() {
  return Object.values(ALLOWED_CHARACTER_SUGGESTIONS)
    .flat()
    .map((item) => item.id);
}

function findAllowedSuggestion(category, id) {
  return ALLOWED_CHARACTER_SUGGESTIONS[category]?.find((item) => item.id === id) || null;
}

module.exports = {
  ALLOWED_CHARACTER_SUGGESTIONS,
  CHARACTER_SUGGESTION_CATEGORIES,
  CHARACTER_SUGGESTIONS_FILE,
  allAllowedSuggestionIds,
  findAllowedSuggestion,
  loadAllowedCharacterSuggestions,
  parseSuggestionTable,
};
