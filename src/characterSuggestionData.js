const fs = require("node:fs");
const path = require("node:path");

const CHARACTER_SUGGESTION_CATEGORIES = {
  backgrounds: "Background package",
  feats: "Feat or talent",
};

const CHARACTER_SUGGESTIONS_FILE = path.join(__dirname, "..", "data", "character-suggestions.tsv");
const SUGGESTION_HEADERS = ["category", "id", "label", "description", "mechanics", "source", "tags"];

function cleanCell(value = "") {
  return String(value || "").trim();
}

function splitTags(value = "") {
  return cleanCell(value)
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function suggestionIdSegment(value = "") {
  return cleanCell(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function tsvCell(value = "") {
  return cleanCell(value).replace(/[\t\r\n]+/g, " ");
}

function backgroundSuggestionFromPayload(payload = {}) {
  const label = cleanCell(payload.label || payload.name);
  if (!label) throw Object.assign(new Error("Background name is required."), { statusCode: 400, code: "BACKGROUND_NAME_REQUIRED" });

  const abilityScores = Array.isArray(payload.abilityScores)
    ? payload.abilityScores.map(cleanCell).filter(Boolean)
    : splitTags(payload.abilityScores);
  const skills = Array.isArray(payload.skills)
    ? payload.skills.map(cleanCell).filter(Boolean)
    : splitTags(payload.skills);
  const providedTags = Array.isArray(payload.tags)
    ? payload.tags.map(cleanCell).filter(Boolean)
    : splitTags(payload.tags);
  const tags = providedTags.length
    ? providedTags
    : splitTags([label, ...abilityScores, ...skills, payload.originFeat, payload.toolProficiency].filter(Boolean).join("; "));

  const mechanics = [
    abilityScores.length ? `Ability scores: ${abilityScores.join("/")}.` : "",
    payload.originFeat ? `Origin feat: ${cleanCell(payload.originFeat)}.` : "",
    skills.length ? `Skills: ${skills.join(", ")}.` : "",
    payload.toolProficiency ? `Tool: ${cleanCell(payload.toolProficiency)}.` : "",
    payload.equipment ? `Equipment: ${cleanCell(payload.equipment)}` : "Equipment package or 50 GP.",
  ].filter(Boolean).join(" ");

  return {
    category: "backgrounds",
    id: `background-${suggestionIdSegment(label)}`,
    label,
    description: cleanCell(payload.description) || label,
    mechanics,
    source: cleanCell(payload.source || "Homebrew"),
    tags,
  };
}

function upsertSuggestionInFile(suggestion, filePath = CHARACTER_SUGGESTIONS_FILE) {
  const currentText = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : `${SUGGESTION_HEADERS.join("\t")}\n`;
  const lines = currentText.split(/\r?\n/);
  const headerLine = lines.find((line) => line.trim() && !line.trimStart().startsWith("#")) || SUGGESTION_HEADERS.join("\t");
  const headers = headerLine.split("\t").map(cleanCell);
  const nextRow = headers.map((header) => {
    if (header === "tags") return tsvCell((suggestion.tags || []).join("; "));
    return tsvCell(suggestion[header]);
  }).join("\t");

  let replaced = false;
  const nextLines = lines.map((line) => {
    if (!line.trim() || line.trimStart().startsWith("#") || line === headerLine) return line;
    const row = Object.fromEntries(headers.map((header, index) => [header, cleanCell(line.split("\t")[index])]));
    if (row.category === suggestion.category && row.id === suggestion.id) {
      replaced = true;
      return nextRow;
    }
    return line;
  });

  if (!replaced) {
    if (nextLines.length && !nextLines[nextLines.length - 1]) nextLines[nextLines.length - 1] = nextRow;
    else nextLines.push(nextRow);
  }

  fs.writeFileSync(filePath, `${nextLines.join("\n").replace(/\n*$/, "")}\n`);
  return suggestion;
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
  backgroundSuggestionFromPayload,
  findAllowedSuggestion,
  loadAllowedCharacterSuggestions,
  parseSuggestionTable,
  upsertSuggestionInFile,
};
