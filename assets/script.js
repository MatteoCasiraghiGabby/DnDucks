// DnDucks Phase 1 frontend behavior. Data is intentionally local-only until a backend is added.
const STORAGE_KEYS = {
  notes: "dnducks.notes",
  characters: "dnducks.characters",
  items: "dnducks.items",
  encounters: "dnducks.encounters",
  locations: "dnducks.locations",
  events: "dnducks.events",
  calendarSettings: "dnducks.calendarSettings",
  weather: "dnducks.weather",
  campaigns: "dnducks.campaigns",
  activeCampaign: "dnducks.activeCampaign",
  comics: "dnducks.comics",
  dmOnly: "dnducks.dmOnly",
  combatEncounter: "dnducks.combatEncounter",
};

const USER_WIDGET_COLLECTIONS = new Set(["notes", "characters", "items", "encounters", "locations", "events", "comics"]);
const CANONICAL_LOCAL_ORIGIN = "http://127.0.0.1:3000";
const LOCAL_BACKEND_PORT = "3000";
const CANONICAL_LOCAL_HEALTH_PATH = "/index.html";
const LOCAL_STORAGE_IMPORT_PARAM = "dnducksImport";
const LOCAL_STORAGE_IMPORT_TOKEN = "windowName";
const LOCAL_IMAGE_MAX_DIMENSION = 960;
const LOCAL_IMAGE_QUALITY = 0.72;
const LOCAL_IMAGE_MAX_DATA_URL_LENGTH = 750000;
const WIDGET_FORM_LABELS = {
  encounters: "Encounter",
  locations: "Location",
  notes: "Note",
  characters: "Character",
  items: "Item",
  events: "Event",
};

const DEFAULT_CAMPAIGN_ID = "local";
const DEFAULT_CAMPAIGN = {
  id: DEFAULT_CAMPAIGN_ID,
  name: "Your campaign",
  description: "Create campaign notes, NPCs, encounters, items, events, and player characters in this local workspace.",
  status: "active",
  workspaceLabel: "Local workspace",
  players: [],
  setupCompleted: false,
  campaignStartNoteId: "",
  createdAt: "Local draft",
  updatedAt: "Local draft",
};

function resolveApiUrl(url) {
  const requestPath = String(url || "");
  if (!requestPath.startsWith("/api/")) return requestPath;

  const configuredBase = configuredBackendBaseUrl();
  if (configuredBase) return `${configuredBase.replace(/\/+$/, "")}${requestPath}`;

  if (window.location.protocol === "file:") return `http://127.0.0.1:3000${requestPath}`;

  const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
  const proxyCapablePorts = new Set(["", "3000", "5173"]);
  if (localHosts.has(window.location.hostname) && !proxyCapablePorts.has(window.location.port)) {
    return `${localBackendOrigin()}${requestPath}`;
  }

  return requestPath;
}

function configuredBackendBaseUrl() {
  return String(window.DNDUCKS_API_BASE_URL || document.querySelector?.('meta[name="dnducks-api-base"]')?.content || "").trim().replace(/\/+$/, "");
}

function localBackendOrigin() {
  const configuredBase = configuredBackendBaseUrl();
  if (configuredBase) return configuredBase;
  if (window.location.protocol === "file:") return CANONICAL_LOCAL_ORIGIN;
  if (!isLocalAppHost(window.location.hostname)) return "";
  const hostname = window.location.hostname.includes(":") && !window.location.hostname.startsWith("[")
    ? `[${window.location.hostname}]`
    : window.location.hostname;
  return `${window.location.protocol}//${hostname}:${LOCAL_BACKEND_PORT}`;
}

function resolveBackendUrl(url) {
  const requestPath = String(url || "");
  if (!requestPath) return "";
  if (/^(?:data:|blob:|https?:|mailto:|tel:|#)/i.test(requestPath)) return requestPath;
  if (requestPath.startsWith("/api/")) return resolveApiUrl(requestPath);
  if (requestPath.startsWith("/uploads/")) {
    if (window.location.protocol === "http:" && isLocalAppHost(window.location.hostname) && window.location.port === LOCAL_BACKEND_PORT && !configuredBackendBaseUrl()) {
      return requestPath;
    }
    const backendOrigin = localBackendOrigin();
    return backendOrigin ? `${backendOrigin}${requestPath}` : requestPath;
  }
  return requestPath;
}

function isLocalAppHost(hostname = window.location.hostname) {
  return new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]).has(hostname);
}

function canonicalLocalUrl() {
  const target = new URL(CANONICAL_LOCAL_ORIGIN);
  target.pathname = canonicalLocalPath(window.location.pathname || "/");
  target.searchParams.set(LOCAL_STORAGE_IMPORT_PARAM, LOCAL_STORAGE_IMPORT_TOKEN);
  target.hash = window.location.hash || "";
  return target.href;
}

function canonicalLocalPath(pathname = "/") {
  const cleanPath = String(pathname || "/").split(/[?#]/)[0];
  const filename = decodeURIComponent(cleanPath.split("/").filter(Boolean).pop() || "index.html").toLowerCase();
  if (filename === "calendar.html") return "/calendar.html";
  if (filename === "about.html") return "/about.html";
  if (filename === "items.html") return "/items.html";
  if (filename === "spells.html") return "/spells.html";
  if (filename === "beast-shapes.html") return "/beast-shapes.html";
  return "/index.html";
}

function shouldUseCanonicalLocalOrigin() {
  if (window.DNDUCKS_DISABLE_CANONICAL_REDIRECT) return false;
  if (new URLSearchParams(window.location.search || "").get(LOCAL_STORAGE_IMPORT_PARAM)) return false;
  if (window.location.protocol === "file:") return true;
  if (window.location.protocol !== "http:") return false;
  if (!isLocalAppHost(window.location.hostname)) return false;
  return window.location.hostname !== "127.0.0.1" || window.location.port !== "3000";
}

async function canonicalLocalOriginReachable() {
  if (window.location.protocol === "http:" && isLocalAppHost(window.location.hostname) && window.location.port === LOCAL_BACKEND_PORT) {
    return true;
  }
  try {
    await fetch(`${CANONICAL_LOCAL_ORIGIN}${CANONICAL_LOCAL_HEALTH_PATH}`, {
      cache: "no-store",
      mode: "no-cors",
    });
    return true;
  } catch (error) {
    return false;
  }
}

function localStorageSnapshot() {
  return Object.fromEntries(Object.values(STORAGE_KEYS).map((storageKey) => [
    storageKey,
    localStorage.getItem(storageKey),
  ]).filter(([, value]) => value !== null));
}

async function redirectToCanonicalLocalOrigin() {
  if (!shouldUseCanonicalLocalOrigin()) return false;
  if (!await canonicalLocalOriginReachable()) return false;
  window.name = JSON.stringify({
    source: "dnducks-local-storage",
    origin: window.location.origin || window.location.href,
    savedAt: new Date().toISOString(),
    storage: localStorageSnapshot(),
  });
  const target = canonicalLocalUrl();
  if (typeof window.location.replace === "function") window.location.replace(target);
  else window.location.href = target;
  return true;
}

const PLAYER_CLASSES = [
  { name: "Artificer", hitDie: "d8", primary: "Intelligence", saves: ["constitution", "intelligence"], skillLimit: 2, skillChoices: ["arcana", "history", "investigation", "medicine", "nature", "perception", "sleightOfHand"], fixedTools: ["thievesTools", "tinkersTools"], toolLimit: 1, toolChoices: "artisan" },
  { name: "Barbarian", hitDie: "d12", primary: "Strength", saves: ["strength", "constitution"], skillLimit: 2, skillChoices: ["animalHandling", "athletics", "intimidation", "nature", "perception", "survival"], fixedTools: [], toolLimit: 0, toolChoices: [] },
  { name: "Bard", hitDie: "d8", primary: "Charisma", saves: ["dexterity", "charisma"], skillLimit: 3, skillChoices: "any", fixedTools: [], toolLimit: 3, toolChoices: "musical" },
  { name: "Cleric", hitDie: "d8", primary: "Wisdom", saves: ["wisdom", "charisma"], skillLimit: 2, skillChoices: ["history", "insight", "medicine", "persuasion", "religion"], fixedTools: [], toolLimit: 0, toolChoices: [] },
  { name: "Druid", hitDie: "d8", primary: "Wisdom", saves: ["intelligence", "wisdom"], skillLimit: 2, skillChoices: ["arcana", "animalHandling", "insight", "medicine", "nature", "perception", "religion", "survival"], fixedTools: ["herbalismKit"], toolLimit: 0, toolChoices: [] },
  { name: "Fighter", hitDie: "d10", primary: "Strength or Dexterity", saves: ["strength", "constitution"], skillLimit: 2, skillChoices: ["acrobatics", "animalHandling", "athletics", "history", "insight", "intimidation", "perception", "survival"], fixedTools: [], toolLimit: 0, toolChoices: [] },
  { name: "Monk", hitDie: "d8", primary: "Dexterity and Wisdom", saves: ["strength", "dexterity"], skillLimit: 2, skillChoices: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"], fixedTools: [], toolLimit: 1, toolChoices: "artisanOrMusical" },
  { name: "Paladin", hitDie: "d10", primary: "Strength and Charisma", saves: ["wisdom", "charisma"], skillLimit: 2, skillChoices: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"], fixedTools: [], toolLimit: 0, toolChoices: [] },
  { name: "Ranger", hitDie: "d10", primary: "Dexterity and Wisdom", saves: ["strength", "dexterity"], skillLimit: 3, skillChoices: ["animalHandling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"], fixedTools: [], toolLimit: 0, toolChoices: [] },
  { name: "Rogue", hitDie: "d8", primary: "Dexterity", saves: ["dexterity", "intelligence"], skillLimit: 4, skillChoices: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleightOfHand", "stealth"], fixedTools: ["thievesTools"], toolLimit: 0, toolChoices: [] },
  { name: "Sorcerer", hitDie: "d6", primary: "Charisma", saves: ["constitution", "charisma"], skillLimit: 2, skillChoices: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"], fixedTools: [], toolLimit: 0, toolChoices: [] },
  { name: "Warlock", hitDie: "d8", primary: "Charisma", saves: ["wisdom", "charisma"], skillLimit: 2, skillChoices: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"], fixedTools: [], toolLimit: 0, toolChoices: [] },
  { name: "Wizard", hitDie: "d6", primary: "Intelligence", saves: ["intelligence", "wisdom"], skillLimit: 2, skillChoices: ["arcana", "history", "insight", "investigation", "medicine", "religion"], fixedTools: [], toolLimit: 0, toolChoices: [] },
];

const CHARACTER_ADVANCEMENT_LEVELS = {
  1: { proficiencyBonus: 2 },
  2: { proficiencyBonus: 2 },
  3: { proficiencyBonus: 2 },
  4: { proficiencyBonus: 2 },
  5: { proficiencyBonus: 3 },
  6: { proficiencyBonus: 3 },
  7: { proficiencyBonus: 3 },
  8: { proficiencyBonus: 3 },
  9: { proficiencyBonus: 4 },
  10: { proficiencyBonus: 4 },
  11: { proficiencyBonus: 4 },
  12: { proficiencyBonus: 4 },
  13: { proficiencyBonus: 5 },
  14: { proficiencyBonus: 5 },
  15: { proficiencyBonus: 5 },
  16: { proficiencyBonus: 5 },
  17: { proficiencyBonus: 6 },
  18: { proficiencyBonus: 6 },
  19: { proficiencyBonus: 6 },
  20: { proficiencyBonus: 6 },
};

const SPELLCASTING_CLASS_RULES = {
  Artificer: { kind: "artificer", ability: "Intelligence", recovery: "long", cantrips: { 1: 2, 10: 3, 14: 4 }, prepared: { abilityKey: "intelligence", levelMultiplier: 0.5, minimum: 1, label: "Intelligence modifier + half Artificer level" } },
  Bard: { kind: "full", ability: "Charisma", recovery: "long", cantrips: { 1: 2, 4: 3, 10: 4 }, known: { 1: 4, 2: 5, 3: 6, 4: 7, 5: 9, 6: 10, 7: 11, 8: 12, 9: 14, 10: 15, 11: 16, 12: 16, 13: 17, 14: 17, 15: 18, 16: 18, 17: 19, 18: 20, 19: 21, 20: 22 }, modeLabel: "Prepared spells" },
  Cleric: { kind: "full", ability: "Wisdom", recovery: "long", cantrips: { 1: 3, 4: 4, 10: 5 }, prepared: { abilityKey: "wisdom", levelMultiplier: 1, minimum: 1, label: "Wisdom modifier + Cleric level" } },
  Druid: { kind: "full", ability: "Wisdom", recovery: "long", cantrips: { 1: 2, 4: 3, 10: 4 }, prepared: { abilityKey: "wisdom", levelMultiplier: 1, minimum: 1, label: "Wisdom modifier + Druid level" } },
  Paladin: { kind: "half", ability: "Charisma", recovery: "long", cantrips: {}, prepared: { abilityKey: "charisma", levelMultiplier: 0.5, minimum: 1, label: "Charisma modifier + half Paladin level" }, startsAt: 2 },
  Ranger: { kind: "half", ability: "Wisdom", recovery: "long", cantrips: {}, known: { 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 6, 10: 6, 11: 7, 12: 7, 13: 8, 14: 8, 15: 9, 16: 9, 17: 10, 18: 10, 19: 11, 20: 11 }, startsAt: 2 },
  Sorcerer: { kind: "full", ability: "Charisma", recovery: "long", cantrips: { 1: 4, 4: 5, 10: 6 }, known: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 12, 12: 12, 13: 13, 14: 13, 15: 14, 16: 14, 17: 15, 18: 15, 19: 15, 20: 15 } },
  Warlock: { kind: "pact", ability: "Charisma", recovery: "short", cantrips: { 1: 2, 4: 3, 10: 4 }, known: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 10, 11: 11, 12: 11, 13: 12, 14: 12, 15: 13, 16: 13, 17: 14, 18: 14, 19: 15, 20: 15 } },
  Wizard: { kind: "full", ability: "Intelligence", recovery: "long", cantrips: { 1: 3, 4: 4, 10: 5 }, prepared: { abilityKey: "intelligence", levelMultiplier: 1, minimum: 1, label: "Intelligence modifier + Wizard level" }, spellbook: (level) => 6 + Math.max(0, Number(level) - 1) * 2 },
};

const FULL_CASTER_SLOTS = {
  1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3],
  7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1], 10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1],
  14: [4, 3, 3, 3, 2, 1, 1], 15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

const HALF_CASTER_SLOTS = {
  2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3],
  9: [4, 3, 2], 10: [4, 3, 2], 11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1],
  14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2], 17: [4, 3, 3, 3, 1],
  18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2],
};

const ARTIFICER_SLOTS = {
  1: [2], 2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3],
  9: [4, 3, 2], 10: [4, 3, 2], 11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1],
  14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2], 17: [4, 3, 3, 3, 1],
  18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2],
};

const WARLOCK_PACT_SLOTS = {
  1: { slots: 1, level: 1 }, 2: { slots: 2, level: 1 }, 3: { slots: 2, level: 2 }, 4: { slots: 2, level: 2 },
  5: { slots: 2, level: 3 }, 6: { slots: 2, level: 3 }, 7: { slots: 2, level: 4 }, 8: { slots: 2, level: 4 },
  9: { slots: 2, level: 5 }, 10: { slots: 2, level: 5 }, 11: { slots: 3, level: 5 }, 12: { slots: 3, level: 5 },
  13: { slots: 3, level: 5 }, 14: { slots: 3, level: 5 }, 15: { slots: 3, level: 5 }, 16: { slots: 3, level: 5 },
  17: { slots: 4, level: 5 }, 18: { slots: 4, level: 5 }, 19: { slots: 4, level: 5 }, 20: { slots: 4, level: 5 },
};

const BARD_FEATURE_PROGRESSION = [
  { id: "bardic-inspiration", level: 1, title: "Bardic Inspiration", summary: "As a Bonus Action, inspire one creature within 60 feet. It can add your Bardic die after failing a d20 test within the next hour.", usage: { key: "bardic-inspiration", label: "Bardic Inspiration", max: "charismaModifierMinimumOne", recovery: "longUntilBard5ThenShort" }, dynamic: "bardicDie" },
  { id: "bard-spellcasting", level: 1, title: "Spellcasting", summary: "Charisma powers your Bard spells. Prepared spells and spell slots follow the Bard progression table.", dynamic: "spellcasting" },
  { id: "bard-expertise-2", level: 2, title: "Expertise", summary: "Choose two proficient skills and double your Proficiency Bonus for checks with them.", choice: "Choose 2 skills" },
  { id: "jack-of-all-trades", level: 2, title: "Jack of All Trades", summary: "Add half your Proficiency Bonus to ability checks that do not already include your Proficiency Bonus." },
  { id: "bard-subclass", level: 3, title: "Bard Subclass", summary: "Choose a Bard College. You gain its features for your Bard level or lower.", choice: "Choose a Bard College" },
  { id: "bard-asi-4", level: 4, title: "Ability Score Improvement", summary: "Gain an Ability Score Improvement feat or another qualifying feat.", choice: "ASI or feat" },
  { id: "font-of-inspiration", level: 5, title: "Font of Inspiration", summary: "Bardic Inspiration returns on a Short or Long Rest. You can also spend a spell slot to regain one expended Bardic Inspiration use." },
  { id: "countercharm", level: 7, title: "Countercharm", summary: "As a Reaction, let yourself or a creature within 30 feet reroll a failed save against being Charmed or Frightened, with Advantage." },
  { id: "bard-asi-8", level: 8, title: "Ability Score Improvement", summary: "Gain another Ability Score Improvement feat or another qualifying feat.", choice: "ASI or feat" },
  { id: "bard-expertise-9", level: 9, title: "Expertise", summary: "Choose two more proficient skills for Expertise.", choice: "Choose 2 more skills" },
  { id: "magical-secrets", level: 10, title: "Magical Secrets", summary: "New and replaced Bard prepared spells can come from the Bard, Cleric, Druid, or Wizard lists." },
  { id: "bard-asi-12", level: 12, title: "Ability Score Improvement", summary: "Gain another Ability Score Improvement feat or another qualifying feat.", choice: "ASI or feat" },
  { id: "bard-asi-16", level: 16, title: "Ability Score Improvement", summary: "Gain another Ability Score Improvement feat or another qualifying feat.", choice: "ASI or feat" },
  { id: "superior-inspiration", level: 18, title: "Superior Inspiration", summary: "When you roll Initiative, regain Bardic Inspiration uses until you have two if you had fewer than two." },
  { id: "epic-boon", level: 19, title: "Epic Boon", summary: "Gain an Epic Boon feat or another qualifying feat.", choice: "Epic Boon or feat" },
  { id: "words-of-creation", level: 20, title: "Words of Creation", summary: "Power Word Heal and Power Word Kill are always prepared, and each can affect a second nearby target when cast." },
];

const BARD_SUBCLASSES = [
  {
    id: "college-of-dance",
    name: "College of Dance",
    source: "Player's Handbook 2024",
    theme: "Mobile skirmisher and battlefield movement",
    features: [
      { id: "dance-dazzling-footwork", level: 3, title: "Dazzling Footwork", summary: "Your dancing style improves performance, unarmed strikes, and defense while you move without armor or a shield. Your Bardic die supports the damage scaling." },
      { id: "dance-inspiring-movement", level: 6, title: "Inspiring Movement", summary: "Spend Bardic Inspiration to help yourself and an ally move through danger without provoking opportunity attacks.", cost: "Bardic Inspiration" },
      { id: "dance-tandem-footwork", level: 6, title: "Tandem Footwork", summary: "When you roll Initiative, spend Bardic Inspiration and roll the die. You and nearby allies who can see or hear you add the result to Initiative.", cost: "Bardic Inspiration" },
      { id: "dance-leading-evasion", level: 14, title: "Leading Evasion", summary: "Your reflexive movement helps you and nearby allies avoid area effects more reliably." },
    ],
  },
  {
    id: "college-of-glamour",
    name: "College of Glamour",
    source: "Player's Handbook 2024",
    theme: "Fey enchantment, charm, and ally support",
    features: [
      { id: "glamour-beguiling-magic", level: 3, title: "Beguiling Magic", summary: "Charm Person and Mirror Image are always prepared. After casting an Enchantment or Illusion spell with a slot, you can try to charm or frighten a creature that saw you cast it.", usage: { key: "glamour-beguiling-magic", label: "Beguiling Magic", max: 1, recovery: "long" }, recoveryCost: "Bardic Inspiration" },
      { id: "glamour-mantle-of-inspiration", level: 3, title: "Mantle of Inspiration", summary: "Spend Bardic Inspiration as a Bonus Action to grant nearby allies Temporary Hit Points and let them move as a Reaction without opportunity attacks.", cost: "Bardic Inspiration" },
      { id: "glamour-mantle-of-majesty", level: 6, title: "Mantle of Majesty", summary: "Wrap yourself in commanding fey magic to direct enemies with magically forceful words.", usage: { key: "glamour-mantle-of-majesty", label: "Mantle of Majesty", max: 1, recovery: "long" } },
      { id: "glamour-unbreakable-majesty", level: 14, title: "Unbreakable Majesty", summary: "Your presence makes it difficult for enemies to attack you, and failed attempts can leave them vulnerable to your magic." },
    ],
  },
  {
    id: "college-of-lore",
    name: "College of Lore",
    source: "D&D Beyond Bard class page",
    theme: "Skill mastery and magical secrets",
    features: [
      { id: "lore-bonus-proficiencies", level: 3, title: "Bonus Proficiencies", summary: "Gain proficiency with three skills of your choice.", choice: "Choose 3 skills" },
      { id: "lore-cutting-words", level: 3, title: "Cutting Words", summary: "As a Reaction, spend Bardic Inspiration to subtract your Bardic die from a visible creature's successful attack roll, ability check, or damage roll.", cost: "Bardic Inspiration" },
      { id: "lore-magical-discoveries", level: 6, title: "Magical Discoveries", summary: "Learn two extra prepared spells from the Cleric, Druid, or Wizard lists. They can be cantrips or spells you have slots for.", choice: "Choose 2 spells" },
      { id: "lore-peerless-skill", level: 14, title: "Peerless Skill", summary: "When you fail an ability check or attack roll, spend Bardic Inspiration to add your Bardic die. If the roll still fails, the use is not spent.", cost: "Bardic Inspiration" },
    ],
  },
  {
    id: "college-of-valor",
    name: "College of Valor",
    source: "Player's Handbook 2024",
    theme: "Battlefield support and weapon casting",
    features: [
      { id: "valor-martial-training", level: 3, title: "Martial Training", summary: "Gain sturdier combat training, including martial weapons, medium armor, and shields. You can use a weapon as a Bard spellcasting focus." },
      { id: "valor-combat-inspiration", level: 3, title: "Combat Inspiration", summary: "A creature with your Bardic Inspiration can improve combat results, such as defense or damage, with your Bardic die.", cost: "Bardic Inspiration" },
      { id: "valor-extra-attack", level: 6, title: "Extra Attack", summary: "Attack twice when you take the Attack action, and one attack can be replaced with a Bard cantrip that has an action casting time." },
      { id: "valor-battle-magic", level: 14, title: "Battle Magic", summary: "Blend weapon attacks and spellcasting more fluidly, keeping martial pressure while using Bard magic." },
    ],
  },
];

const MULTICLASS_CLASS_RULES = {
  Artificer: { prerequisites: [["intelligence"]], multiclassProficiencies: ["Thieves' Tools", "Tinker's Tools", "Light armor", "Medium armor", "Shields"], multiclassTools: ["Thieves' Tools", "Tinker's Tools"] },
  Barbarian: { prerequisites: [["strength"]], multiclassProficiencies: ["Martial weapons", "Shields"], extraAttackLevel: 5 },
  Bard: { prerequisites: [["charisma"]], multiclassProficiencies: ["One skill of your choice", "One musical instrument", "Light armor"], multiclassSkillLimit: 1, multiclassTools: ["1 musical instrument"] },
  Cleric: { prerequisites: [["wisdom"]], multiclassProficiencies: ["Light armor", "Medium armor", "Shields"] },
  Druid: { prerequisites: [["wisdom"]], multiclassProficiencies: ["Light armor", "Shields"] },
  Fighter: { prerequisites: [["strength", "dexterity"]], multiclassProficiencies: ["Martial weapons", "Light armor", "Medium armor", "Shields"], extraAttackLevel: 5 },
  Monk: { prerequisites: [["dexterity"], ["wisdom"]], multiclassProficiencies: [], extraAttackLevel: 5 },
  Paladin: { prerequisites: [["strength"], ["charisma"]], multiclassProficiencies: ["Martial weapons", "Light armor", "Medium armor", "Shields"], extraAttackLevel: 5 },
  Ranger: { prerequisites: [["dexterity"], ["wisdom"]], multiclassProficiencies: ["Martial weapons", "One skill from the Ranger skill list", "Light armor", "Medium armor", "Shields"], multiclassSkillLimit: 1, extraAttackLevel: 5 },
  Rogue: { prerequisites: [["dexterity"]], multiclassProficiencies: ["One skill from the Rogue skill list", "Thieves' Tools", "Light armor"], multiclassSkillLimit: 1, multiclassTools: ["Thieves' Tools"] },
  Sorcerer: { prerequisites: [["charisma"]], multiclassProficiencies: [] },
  Warlock: { prerequisites: [["charisma"]], multiclassProficiencies: ["Light armor"] },
  Wizard: { prerequisites: [["intelligence"]], multiclassProficiencies: [] },
};

PLAYER_CLASSES.forEach((playerClass) => Object.assign(playerClass, MULTICLASS_CLASS_RULES[playerClass.name] || {}));

const PLAYER_RACES = [
  "Aarakocra", "Aasimar", "Aetherborn", "Astral Elf", "Autognome", "Aven", "Bugbear", "Centaur", "Changeling", "Custom",
  "Deep Gnome", "Dhampir", "Dragonborn", "Duergar", "Dwarf", "Eladrin", "Elf", "Fairy", "Firbolg",
  "Genasi (Air)", "Genasi (Earth)", "Genasi (Fire)", "Genasi (Water)", "Giff", "Githyanki", "Githzerai", "Glitchling", "Gnome", "Goblin", "Goliath", "Grung",
  "Hadozee", "Half-Elf", "Half-Orc", "Halfling", "Harengon", "Hexblood", "Hobgoblin", "Human",
  "Kalashtar", "Kender", "Kenku", "Khenra", "Kobold", "Kor", "Leonin", "Lizardfolk", "Locathah", "Loxodon",
  "Merfolk", "Minotaur", "Naga", "Orc", "Owlin", "Owlfolk", "Plasmoid", "Rabbitfolk", "Reborn", "Revenant",
  "Satyr", "Sea Elf", "Shadar-Kai", "Shifter", "Simic Hybrid", "Siren", "Tabaxi", "Thri-kreen", "Tiefling", "Tortle", "Triton",
  "Vampire", "Vedalken", "Verdan", "Viashino", "Warforged", "Yuan-Ti",
];

const LINEAGE_FIXED_ASI = {
  aetherborn: { charisma: 2 },
  aven: { dexterity: 2 },
  custom: { choose: 2 },
  dragonborn: { strength: 2, charisma: 1 },
  dwarf: { constitution: 2 },
  elf: { dexterity: 2 },
  gnome: { intelligence: 2 },
  grung: { dexterity: 2, constitution: 1 },
  halfelf: { charisma: 2, choose: 2 },
  halforc: { strength: 2, constitution: 1 },
  halfling: { dexterity: 2 },
  human: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
  kalashtar: { wisdom: 2, charisma: 1 },
  khenra: { dexterity: 2, strength: 1 },
  kor: { dexterity: 2, wisdom: 1 },
  leonin: { constitution: 2, strength: 1 },
  locathah: { strength: 2, dexterity: 1 },
  loxodon: { constitution: 2, wisdom: 1 },
  merfolk: { charisma: 1 },
  naga: { constitution: 2, intelligence: 1 },
  simichybrid: { constitution: 2 },
  siren: { charisma: 2 },
  tiefling: { charisma: 2, intelligence: 1 },
  vampire: { charisma: 2 },
  vedalken: { intelligence: 2, wisdom: 1 },
  verdan: { charisma: 2, constitution: 1 },
  viashino: { dexterity: 2, strength: 1 },
  warforged: { constitution: 2 },
};
const PLAYER_ALIGNMENTS = ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "True Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil", "Unaligned"];

const LANGUAGES = [
  { key: "common", label: "Common" },
  { key: "dwarvish", label: "Dwarvish" },
  { key: "elvish", label: "Elvish" },
  { key: "giant", label: "Giant" },
  { key: "gnomish", label: "Gnomish" },
  { key: "goblin", label: "Goblin" },
  { key: "halfling", label: "Halfling" },
  { key: "orc", label: "Orc" },
  { key: "abyssal", label: "Abyssal" },
  { key: "celestial", label: "Celestial" },
  { key: "deepSpeech", label: "Deep Speech" },
  { key: "draconic", label: "Draconic" },
  { key: "infernal", label: "Infernal" },
  { key: "primordial", label: "Primordial" },
  { key: "sylvan", label: "Sylvan" },
  { key: "undercommon", label: "Undercommon" },
];

const TOOLS = [
  { key: "thievesTools", label: "Thieves' tools", type: "tool" },
  { key: "herbalismKit", label: "Herbalism kit", type: "tool" },
  { key: "alchemistsSupplies", label: "Alchemist's supplies", type: "artisan" },
  { key: "brewersSupplies", label: "Brewer's supplies", type: "artisan" },
  { key: "calligraphersSupplies", label: "Calligrapher's supplies", type: "artisan" },
  { key: "carpentersTools", label: "Carpenter's tools", type: "artisan" },
  { key: "cooksUtensils", label: "Cook's utensils", type: "artisan" },
  { key: "paintersSupplies", label: "Painter's supplies", type: "artisan" },
  { key: "smithsTools", label: "Smith's tools", type: "artisan" },
  { key: "tinkersTools", label: "Tinker's tools", type: "artisan" },
  { key: "weaversTools", label: "Weaver's tools", type: "artisan" },
  { key: "woodcarversTools", label: "Woodcarver's tools", type: "artisan" },
  { key: "drum", label: "Drum", type: "musical" },
  { key: "flute", label: "Flute", type: "musical" },
  { key: "lute", label: "Lute", type: "musical" },
  { key: "lyre", label: "Lyre", type: "musical" },
  { key: "horn", label: "Horn", type: "musical" },
  { key: "panFlute", label: "Pan flute", type: "musical" },
  { key: "viol", label: "Viol", type: "musical" },
];

const ABILITIES = [
  { key: "strength", label: "Strength", short: "STR" },
  { key: "dexterity", label: "Dexterity", short: "DEX" },
  { key: "constitution", label: "Constitution", short: "CON" },
  { key: "intelligence", label: "Intelligence", short: "INT" },
  { key: "wisdom", label: "Wisdom", short: "WIS" },
  { key: "charisma", label: "Charisma", short: "CHA" },
];

const SKILLS = [
  { key: "acrobatics", label: "Acrobatics", ability: "dexterity" },
  { key: "animalHandling", label: "Animal Handling", ability: "wisdom" },
  { key: "arcana", label: "Arcana", ability: "intelligence" },
  { key: "athletics", label: "Athletics", ability: "strength" },
  { key: "deception", label: "Deception", ability: "charisma" },
  { key: "history", label: "History", ability: "intelligence" },
  { key: "insight", label: "Insight", ability: "wisdom" },
  { key: "intimidation", label: "Intimidation", ability: "charisma" },
  { key: "investigation", label: "Investigation", ability: "intelligence" },
  { key: "medicine", label: "Medicine", ability: "wisdom" },
  { key: "nature", label: "Nature", ability: "intelligence" },
  { key: "perception", label: "Perception", ability: "wisdom" },
  { key: "performance", label: "Performance", ability: "charisma" },
  { key: "persuasion", label: "Persuasion", ability: "charisma" },
  { key: "religion", label: "Religion", ability: "intelligence" },
  { key: "sleightOfHand", label: "Sleight of Hand", ability: "dexterity" },
  { key: "stealth", label: "Stealth", ability: "dexterity" },
  { key: "survival", label: "Survival", ability: "wisdom" },
];

const BACKGROUND_PACKAGES = [
  { label: "Acolyte", description: "Temple-trained servant of faith, rites, doctrine, and divine service.", abilityScores: ["Intelligence", "Wisdom", "Charisma"], originFeat: "Magic Initiate (Cleric)", skills: ["Insight", "Religion"], toolProficiency: "Calligrapher's Supplies", equipment: "Calligrapher's Supplies, Book (prayers), Holy Symbol, Parchment (10 sheets), Robe, 8 GP" },
  { label: "Artisan", description: "Workshop-trained craftsperson with practical trade skill, customer sense, and a careful eye for detail.", abilityScores: ["Strength", "Dexterity", "Intelligence"], originFeat: "Crafter", skills: ["Investigation", "Persuasion"], toolProficiency: "one artisan's tool", equipment: "Artisan's Tools, 2 Pouches, Traveler's Clothes, 32 GP" },
  { label: "Charlatan", description: "Tavern-wise deceiver, swindler, forger, or social manipulator who learned to sell convincing lies.", abilityScores: ["Dexterity", "Constitution", "Charisma"], originFeat: "Skilled", skills: ["Deception", "Sleight of Hand"], toolProficiency: "Forgery Kit", equipment: "Forgery Kit, Costume, Fine Clothes, 15 GP" },
  { label: "Criminal", description: "Streetwise lawbreaker, burglar, cutpurse, gang member, or lone operator shaped by the underworld.", abilityScores: ["Dexterity", "Constitution", "Intelligence"], originFeat: "Alert", skills: ["Sleight of Hand", "Stealth"], toolProficiency: "Thieves' Tools", equipment: "2 Daggers, Thieves' Tools, Crowbar, 2 Pouches, Traveler's Clothes, 16 GP" },
  { label: "Entertainer", description: "Performer raised around fairs, carnivals, stages, music, acrobatics, poetry, and applause.", abilityScores: ["Strength", "Dexterity", "Charisma"], originFeat: "Musician", skills: ["Acrobatics", "Performance"], toolProficiency: "one musical instrument", equipment: "Musical Instrument, 2 Costumes, Mirror, Perfume, Traveler's Clothes, 11 GP" },
  { label: "Farmer", description: "Land-raised worker shaped by animals, crops, patience, physical endurance, and respect for nature.", abilityScores: ["Strength", "Constitution", "Wisdom"], originFeat: "Tough", skills: ["Animal Handling", "Nature"], toolProficiency: "Carpenter's Tools", equipment: "Sickle, Carpenter's Tools, Healer's Kit, Iron Pot, Shovel, Traveler's Clothes, 30 GP" },
  { label: "Guard", description: "Watch-trained protector used to patrols, walls, gates, troublemakers, raids, and public order.", abilityScores: ["Strength", "Intelligence", "Wisdom"], originFeat: "Alert", skills: ["Athletics", "Perception"], toolProficiency: "one gaming set", equipment: "Spear, Light Crossbow, 20 Bolts, Gaming Set, Hooded Lantern, Manacles, Quiver, Traveler's Clothes, 12 GP" },
  { label: "Guide", description: "Wilderness-raised pathfinder, scout, and survivalist trained by travel, danger, maps, and nature magic.", abilityScores: ["Dexterity", "Constitution", "Wisdom"], originFeat: "Magic Initiate (Druid)", skills: ["Stealth", "Survival"], toolProficiency: "Cartographer's Tools", equipment: "Shortbow, 20 Arrows, Cartographer's Tools, Bedroll, Quiver, Tent, Traveler's Clothes, 3 GP" },
  { label: "Hermit", description: "Secluded contemplative shaped by solitude, medicine, religion, forest life, and mysteries of creation.", abilityScores: ["Constitution", "Wisdom", "Charisma"], originFeat: "Healer", skills: ["Medicine", "Religion"], toolProficiency: "Herbalism Kit", equipment: "Quarterstaff, Herbalism Kit, Bedroll, Book (philosophy), Lamp, Oil (3 flasks), Traveler's Clothes, 16 GP" },
  { label: "Merchant", description: "Trader, shop apprentice, caravan worker, or traveling seller trained in commerce and negotiation.", abilityScores: ["Constitution", "Intelligence", "Charisma"], originFeat: "Lucky", skills: ["Animal Handling", "Persuasion"], toolProficiency: "Navigator's Tools", equipment: "Navigator's Tools, 2 Pouches, Traveler's Clothes, 22 GP" },
  { label: "Noble", description: "Castle-raised aristocrat educated around privilege, courtly politics, history, persuasion, and leadership.", abilityScores: ["Strength", "Intelligence", "Charisma"], originFeat: "Skilled", skills: ["History", "Persuasion"], toolProficiency: "one gaming set", equipment: "Gaming Set, Fine Clothes, Perfume, 29 GP" },
  { label: "Sage", description: "Library-shaped scholar, researcher, archivist, or arcane student hungry for lore and deeper knowledge.", abilityScores: ["Constitution", "Intelligence", "Wisdom"], originFeat: "Magic Initiate (Wizard)", skills: ["Arcana", "History"], toolProficiency: "Calligrapher's Supplies", equipment: "Quarterstaff, Calligrapher's Supplies, Book (history), Parchment (8 sheets), Robe, 8 GP" },
  { label: "Sailor", description: "Seafarer shaped by ports, ships, storms, ropework, deck life, stories, and ocean travel.", abilityScores: ["Strength", "Dexterity", "Wisdom"], originFeat: "Tavern Brawler", skills: ["Acrobatics", "Perception"], toolProficiency: "Navigator's Tools", equipment: "Dagger, Navigator's Tools, Rope, Traveler's Clothes, 20 GP" },
  { label: "Scribe", description: "Copyist, clerk, poet, archivist, or government writer trained in documents and exacting detail.", abilityScores: ["Dexterity", "Intelligence", "Wisdom"], originFeat: "Skilled", skills: ["Investigation", "Perception"], toolProficiency: "Calligrapher's Supplies", equipment: "Calligrapher's Supplies, Fine Clothes, Lamp, Oil (3 flasks), Parchment (12 sheets), 23 GP" },
  { label: "Soldier", description: "Battle-trained warrior, veteran, militia member, or disciplined recruit shaped by drill and war.", abilityScores: ["Strength", "Dexterity", "Constitution"], originFeat: "Savage Attacker", skills: ["Athletics", "Intimidation"], toolProficiency: "one gaming set", equipment: "Spear, Shortbow, 20 Arrows, Gaming Set, Healer's Kit, Quiver, Traveler's Clothes, 14 GP" },
  { label: "Wayfarer", description: "Street-raised survivor of hardship, odd jobs, hunger, theft, pride, and stubborn hope.", abilityScores: ["Dexterity", "Wisdom", "Charisma"], originFeat: "Lucky", skills: ["Insight", "Stealth"], toolProficiency: "Thieves' Tools", equipment: "2 Daggers, Thieves' Tools, Gaming Set, Bedroll, 2 Pouches, Traveler's Clothes, 16 GP" },
];

const BACKGROUND_GOLD_OPTION = 50;

const FEAT_DESCRIPTIONS = {
  alert: "Gain a major bonus to Initiative. You cannot be surprised while conscious, and unseen attackers do not gain advantage from being hidden from you.",
  crafter: "Gain practical crafting benefits, including faster work with artisan's tools and a discount when buying nonmagical items.",
  healer: "Use a healer's kit to stabilize and restore allies more effectively, including a stronger emergency heal.",
  lucky: "Gain luck points that can reroll your d20 rolls or interfere with attack rolls made against you.",
  magicinitiate: "Learn two cantrips and one 1st-level spell from a chosen class spell list, with limited free casting.",
  musician: "Gain musical instrument training and inspire allies after a rest so they can use that inspiration later.",
  savageattacker: "Once per turn when you hit with a melee weapon attack, reroll the weapon damage dice and use either total.",
  skilled: "Gain proficiency with any combination of three skills or tools.",
  tavernbrawler: "Improve Strength or Constitution by 1. Gain improvised weapon proficiency, stronger unarmed strikes, and a bonus grapple after hitting.",
  tough: "Your hit point maximum increases by twice your level and grows further as you level up.",
};

const LINEAGE_TRAIT_DESCRIPTIONS = {
  amorphous: "Move through narrow openings, squeeze through tight spaces, and reshape your body in ways most creatures cannot.",
  amphibious: "You can breathe both air and water.",
  astralspark: "Channel astral force into a weapon attack for extra damage a limited number of times.",
  brave: "You have advantage on saving throws you make to avoid or end being frightened.",
  breathweapon: "Exhale destructive energy tied to your draconic ancestry as an action or attack replacement, depending on your rules set.",
  catsclaws: "Your claws help with climbing and can serve as natural weapons.",
  catstalent: "Your feline instincts grant extra skill proficiencies.",
  chameleoncarapace: "Change the color of your carapace to blend in, and use it as natural protection.",
  changelinginstincts: "Gain social skill proficiencies suited to reading and deceiving others.",
  constructedresilience: "You resist many hazards that affect living bodies, such as disease, poison, hunger, or sleep.",
  damageresistance: "You resist the damage type associated with your ancestry or supernatural origin.",
  darkvision: "You can see in dim light and darkness better than most creatures.",
  deathlessnature: "Your unusual state of life reduces ordinary bodily needs and protects you from some mortal dangers.",
  dexterousfeet: "Use your feet with unusual precision for simple object interactions.",
  draconicancestry: "Choose a draconic ancestry that shapes your breath weapon and damage resistance.",
  dualmind: "Your disciplined mind gives you extra protection against Wisdom saving throw threats.",
  dwarvenresilience: "You have advantage on saves against poison and resist poison damage.",
  eerietoken: "Create a small token that can carry messages or help you perceive through it at a distance.",
  elementallegacy: "Your elemental ancestry grants innate magic tied to air, earth, fire, or water.",
  elementalresistance: "You resist a damage type tied to your elemental ancestry.",
  felineagility: "Move with sudden bursts of speed when you need to cross the battlefield quickly.",
  feyancestry: "You have advantage on saving throws against being charmed, and magic cannot put you to sleep.",
  feat: "Choose a feat approved for your custom lineage.",
  fearless: "You have advantage on saving throws you make to avoid or end being frightened.",
  firearmsmastery: "You handle firearms with unusual ease, including ignoring some loading complications.",
  flight: "You have a flying speed when your armor and circumstances allow it.",
  gnomecunning: "You have advantage on Intelligence, Wisdom, and Charisma saving throws against magic.",
  glide: "Slow your fall and move horizontally while descending.",
  goringrush: "After moving quickly toward a target, strike with your horns as part of the charge.",
  hadozeedodge: "Use a reaction to reduce incoming damage with agile movement.",
  halflingnimbleness: "Move through the space of creatures larger than you.",
  hammeringhorns: "Use your horns to push creatures after you hit them.",
  haretrigger: "Add your proficiency bonus to Initiative.",
  hellishresistance: "You have resistance to fire damage.",
  hexmagic: "Gain innate magic shaped by your eerie fey transformation.",
  hippobuild: "Count as larger for carrying, pushing, dragging, and lifting, and gain extra weapon steadiness.",
  horns: "Your horns are natural weapons for close combat.",
  infernallegacy: "You know infernal magic, gaining limited spellcasting as you gain levels.",
  integratedprotection: "Your body includes protective plating that improves your defense.",
  keensenses: "You gain proficiency in the Perception skill.",
  kenderaptitude: "Gain skill talent shaped by your curious nature.",
  kenkurecall: "Call on memory and mimicry to improve trained checks.",
  knowledgefromapastlife: "Add flashes of remembered experience to ability checks a limited number of times.",
  leporinesenses: "Gain proficiency in Perception.",
  lineagetraits: "Use the traits granted by your selected lineage.",
  lucky: "When you roll a 1 on a d20 for an attack roll, ability check, or saving throw, reroll it.",
  luckyfootwork: "React to danger with quick footwork that can improve a Dexterity saving throw.",
  mentalormagicalresilience: "You have extra protection against mental or magical effects.",
  mimicry: "Imitate sounds and voices you have heard.",
  mindlink: "Communicate telepathically with another creature for a limited time.",
  mountainborn: "You are adapted to high altitude and cold environments.",
  naturalarmor: "Your body provides a natural Armor Class option.",
  powerfulbuild: "Count as larger for carrying capacity and for pushing, dragging, or lifting objects.",
  rabbithop: "Jump a short distance as a bonus action without provoking opportunity attacks.",
  relentlessendurance: "When damage would drop you to 0 hit points, you can drop to 1 hit point instead once before resting.",
  resourceful: "Gain extra heroic resourcefulness or inspiration depending on your rules set.",
  secondaryarms: "Use secondary arms for simple tasks and light objects.",
  sentrysrest: "Remain aware while taking a motionless rest instead of ordinary sleep.",
  severedfromdreams: "You are immune to magical dreaming and similar dream-based effects.",
  shapechanger: "Change your appearance and voice to pass as another humanoid form.",
  shapeself: "Alter your body's basic shape and surface details.",
  skillful: "Gain an extra skill proficiency.",
  skillversatility: "Gain proficiency in two skills of your choice.",
  sleepless: "You do not require sleep and can remain conscious during rest.",
  spiderclimb: "Climb difficult surfaces, including walls and ceilings, once the trait is fully available.",
  stonecunning: "Gain special insight or senses related to stonework.",
  stonesendurance: "Use a reaction to reduce damage you take.",
  swim: "You have a swimming speed.",
  taunt: "Distract or needle a foe, making it harder for them to attack anyone but you.",
  telepathy: "Communicate mentally with nearby creatures that understand a language.",
  trance: "You do not need to sleep; a short meditative trance can give you the benefit of a long rest.",
  variabletrait: "Choose a flexible trait option approved for your custom lineage.",
  vampiricbite: "Use your bite as a natural weapon and draw strength from it in limited ways.",
  versatile: "Gain flexible training or a feat-like option depending on your rules set.",
};

const WEAPONS = [
  { name: "Club", aliases: ["club"], damage: "1d4", type: "bludgeoning", mode: "melee" },
  { name: "Dagger", aliases: ["dagger"], damage: "1d4", type: "piercing", mode: "finesse" },
  { name: "Greatclub", aliases: ["greatclub"], damage: "1d8", type: "bludgeoning", mode: "melee" },
  { name: "Handaxe", aliases: ["handaxe", "hand axe"], damage: "1d6", type: "slashing", mode: "melee" },
  { name: "Javelin", aliases: ["javelin"], damage: "1d6", type: "piercing", mode: "melee" },
  { name: "Light Hammer", aliases: ["light hammer"], damage: "1d4", type: "bludgeoning", mode: "melee" },
  { name: "Mace", aliases: ["mace"], damage: "1d6", type: "bludgeoning", mode: "melee" },
  { name: "Quarterstaff", aliases: ["quarterstaff", "staff"], damage: "1d6", type: "bludgeoning", mode: "melee" },
  { name: "Sickle", aliases: ["sickle"], damage: "1d4", type: "slashing", mode: "melee" },
  { name: "Spear", aliases: ["spear"], damage: "1d6", type: "piercing", mode: "melee" },
  { name: "Light Crossbow", aliases: ["light crossbow"], damage: "1d8", type: "piercing", mode: "ranged" },
  { name: "Dart", aliases: ["dart"], damage: "1d4", type: "piercing", mode: "ranged" },
  { name: "Shortbow", aliases: ["shortbow", "short bow"], damage: "1d6", type: "piercing", mode: "ranged" },
  { name: "Sling", aliases: ["sling"], damage: "1d4", type: "bludgeoning", mode: "ranged" },
  { name: "Battleaxe", aliases: ["battleaxe", "battle axe"], damage: "1d8", type: "slashing", mode: "melee" },
  { name: "Flail", aliases: ["flail"], damage: "1d8", type: "bludgeoning", mode: "melee" },
  { name: "Glaive", aliases: ["glaive"], damage: "1d10", type: "slashing", mode: "melee" },
  { name: "Greataxe", aliases: ["greataxe", "great axe"], damage: "1d12", type: "slashing", mode: "melee" },
  { name: "Greatsword", aliases: ["greatsword", "great sword"], damage: "2d6", type: "slashing", mode: "melee" },
  { name: "Halberd", aliases: ["halberd"], damage: "1d10", type: "slashing", mode: "melee" },
  { name: "Lance", aliases: ["lance"], damage: "1d12", type: "piercing", mode: "melee" },
  { name: "Longsword", aliases: ["longsword", "long sword"], damage: "1d8", type: "slashing", mode: "melee" },
  { name: "Maul", aliases: ["maul"], damage: "2d6", type: "bludgeoning", mode: "melee" },
  { name: "Morningstar", aliases: ["morningstar", "morning star"], damage: "1d8", type: "piercing", mode: "melee" },
  { name: "Pike", aliases: ["pike"], damage: "1d10", type: "piercing", mode: "melee" },
  { name: "Rapier", aliases: ["rapier"], damage: "1d8", type: "piercing", mode: "finesse" },
  { name: "Scimitar", aliases: ["scimitar"], damage: "1d6", type: "slashing", mode: "finesse" },
  { name: "Shortsword", aliases: ["shortsword", "short sword"], damage: "1d6", type: "piercing", mode: "finesse" },
  { name: "Trident", aliases: ["trident"], damage: "1d6", type: "piercing", mode: "melee" },
  { name: "War Pick", aliases: ["war pick"], damage: "1d8", type: "piercing", mode: "melee" },
  { name: "Warhammer", aliases: ["warhammer", "war hammer"], damage: "1d8", type: "bludgeoning", mode: "melee" },
  { name: "Whip", aliases: ["whip"], damage: "1d4", type: "slashing", mode: "finesse" },
  { name: "Blowgun", aliases: ["blowgun"], damage: "1", type: "piercing", mode: "ranged" },
  { name: "Hand Crossbow", aliases: ["hand crossbow"], damage: "1d6", type: "piercing", mode: "ranged" },
  { name: "Heavy Crossbow", aliases: ["heavy crossbow"], damage: "1d10", type: "piercing", mode: "ranged" },
  { name: "Longbow", aliases: ["longbow", "long bow"], damage: "1d8", type: "piercing", mode: "ranged" },
  { name: "Net", aliases: ["net"], damage: "", type: "special", mode: "ranged" },
];

const WEAPON_PROPERTY_OPTIONS = [
  { key: "ammunition", label: "Ammunition", icon: "AM", detail: "Uses ammunition and the listed normal/long range for ranged attacks." },
  { key: "finesse", label: "Finesse", icon: "FI", detail: "Melee attacks use the better modifier between Strength and Dexterity." },
  { key: "heavy", label: "Heavy", icon: "HV", detail: "Marked as a heavy weapon." },
  { key: "light", label: "Light", icon: "LI", detail: "Marked as a light weapon." },
  { key: "loading", label: "Loading", icon: "LD", detail: "Marked as a loading weapon." },
  { key: "range", label: "Range", icon: "RG", detail: "Uses the listed normal/long range." },
  { key: "reach", label: "Reach", icon: "RE", detail: "Adds 5 feet to reach when attacking with it." },
  { key: "special", label: "Special", icon: "SP", detail: "Uses special rules described in the weapon feature or description." },
  { key: "thrown", label: "Thrown", icon: "TH", detail: "Can be thrown; a melee weapon keeps its melee ability modifier when thrown." },
  { key: "two-handed", label: "Two-Handed", icon: "2H", detail: "Requires two hands when attacking with it." },
  { key: "versatile", label: "Versatile", icon: "VS", detail: "Can be used one-handed or two-handed, with separate damage values." },
];

const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
const COMBATANT_TYPES = ["player", "npc", "monster"];
const COMBATANT_STATUSES = ["active", "defeated", "hidden"];
const COMBAT_CONDITIONS = [
  "blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated", "invisible",
  "paralyzed", "poisoned", "prone", "restrained", "stunned", "unconscious",
];

const DEFAULT_COMBAT_ENCOUNTER = {
  id: "active-combat",
  name: "Active combat",
  combatants: [],
  currentRound: 1,
  currentTurnIndex: 0,
  activeCombatantId: "",
  combatStarted: false,
  skipDefeated: true,
  manualOrder: false,
};

function normalizeCampaign(campaign = {}) {
  return {
    ...DEFAULT_CAMPAIGN,
    ...campaign,
    id: String(campaign.id || DEFAULT_CAMPAIGN.id),
    players: Array.isArray(campaign.players) ? campaign.players.filter(Boolean) : [],
    setupCompleted: Boolean(campaign.setupCompleted),
  };
}

function getCampaigns() {
  const raw = localStorage.getItem(STORAGE_KEYS.campaigns);
  if (!raw) return [normalizeCampaign(DEFAULT_CAMPAIGN)];
  try {
    const parsed = JSON.parse(raw);
    const campaigns = Array.isArray(parsed) ? parsed.map(normalizeCampaign) : [];
    return campaigns.length ? campaigns : [normalizeCampaign(DEFAULT_CAMPAIGN)];
  } catch (error) {
    console.warn("Could not parse campaigns from localStorage", error);
    return [normalizeCampaign(DEFAULT_CAMPAIGN)];
  }
}

function saveCampaigns(campaigns) {
  setStoredJson(STORAGE_KEYS.campaigns, campaigns.map(normalizeCampaign));
}

function getCampaign(campaignId = DEFAULT_CAMPAIGN_ID) {
  return getCampaigns().find((campaign) => campaign.id === campaignId) || null;
}

function getActiveCampaignId() {
  const savedId = localStorage.getItem(STORAGE_KEYS.activeCampaign);
  if (savedId && getCampaign(savedId)) return savedId;
  return getCampaigns()[0]?.id || DEFAULT_CAMPAIGN_ID;
}

function setActiveCampaign(campaignId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  setStoredText(STORAGE_KEYS.activeCampaign, campaign.id);
  return campaign;
}

function upsertCampaign(nextCampaign) {
  const normalized = normalizeCampaign({ ...nextCampaign, updatedAt: readableDate() });
  const campaigns = getCampaigns();
  const index = campaigns.findIndex((campaign) => campaign.id === normalized.id);
  if (index >= 0) campaigns[index] = normalized;
  else campaigns.unshift(normalized);
  saveCampaigns(campaigns);
  return normalized;
}

function currentCampaign() {
  return getCampaign(getActiveCampaignId()) || upsertCampaign(DEFAULT_CAMPAIGN);
}

function uniqueCampaignId(name = "campaign") {
  const base = storageIdSegment(name) || "campaign";
  const existingIds = new Set(getCampaigns().map((campaign) => campaign.id));
  if (!existingIds.has(base)) return base;
  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function createCampaign(campaignData = {}) {
  const name = String(campaignData.name || "").trim() || "Untitled campaign";
  const campaign = upsertCampaign({
    ...DEFAULT_CAMPAIGN,
    id: uniqueCampaignId(name),
    name,
    description: String(campaignData.description || "").trim() || "A new campaign workspace.",
    workspaceLabel: "Local campaign",
    players: [],
    setupCompleted: false,
    campaignStartNoteId: "",
    createdAt: readableDate(),
  });
  setActiveCampaign(campaign.id);
  return campaign;
}

function deleteCampaign(campaignId) {
  const campaigns = getCampaigns().filter((campaign) => campaign.id !== campaignId);
  saveCampaigns(campaigns.length ? campaigns : [normalizeCampaign(DEFAULT_CAMPAIGN)]);
  USER_WIDGET_COLLECTIONS.forEach((key) => {
    const remaining = getAllStoredCollection(key).filter((entry) => entry.campaignId !== campaignId);
    setStoredJson(STORAGE_KEYS[key], remaining);
  });
  const nextCampaign = getCampaigns()[0];
  setActiveCampaign(nextCampaign.id);
  return nextCampaign;
}

function resetCampaign(campaignId = DEFAULT_CAMPAIGN_ID) {
  const campaign = getCampaign(campaignId);
  const noteIdsToRemove = new Set([campaign?.campaignStartNoteId].filter(Boolean));
  const notes = getStoredCollection("notes", campaignId).filter((note) => (
    !noteIdsToRemove.has(note.id) && !(note.campaignId === campaignId && note.generatedBy === "campaign-setup-start")
  ));
  saveCollection("notes", notes, campaignId);
  return upsertCampaign({ ...DEFAULT_CAMPAIGN, id: campaignId });
}

function playerDisplayName(player) {
  return firstDisplayText([player.characterName, player.playerName], "Unnamed hero");
}

function formValue(form, selector) {
  return form.querySelector(selector)?.value.trim() || "";
}

function numberFormValue(form, selector) {
  const value = formValue(form, selector);
  return value ? Number(value) : "";
}

function checkedFormValues(form, name) {
  return Array.from(form.querySelectorAll?.(`input[name="${name}"]:checked`) || []).map((input) => input.value);
}

function checkedFormValue(form, selector) {
  return Boolean(form.querySelector(selector)?.checked);
}

function classInfo(classRole = "") {
  const normalized = String(classRole).trim().toLowerCase();
  return PLAYER_CLASSES.find((item) => item.name.toLowerCase() === normalized) || null;
}

function classNameForValue(value = "") {
  const info = classInfo(value);
  return info?.name || String(value || "").trim();
}

function classLevelEntriesFromParts(parts = []) {
  const byClass = new Map();
  parts.forEach((part, index) => {
    const className = classNameForValue(part.className || part.classRole);
    const level = Math.max(0, Math.floor(Number(part.level) || 0));
    if (!className || level < 1) return;
    const key = normalizeRulesText(className);
    const existing = byClass.get(key);
    if (existing) existing.level += level;
    else byClass.set(key, { className, level, order: index });
  });
  return Array.from(byClass.values())
    .sort((a, b) => a.order - b.order)
    .map(({ className, level }) => ({ className, level }));
}

function classLevelEntriesFromForm(form) {
  const primaryClass = formValue(form, "#player-class-role");
  const totalLevel = numberFormValue(form, "#player-level");
  if (!checkedFormValue(form, "#player-multiclass-enabled")) {
    return classLevelEntriesFromParts([{ className: primaryClass, level: totalLevel || 1 }]);
  }
  const primaryLevel = numberFormValue(form, "#player-primary-class-level") || totalLevel || 1;
  return classLevelEntriesFromParts([
    { className: primaryClass, level: primaryLevel },
    { className: formValue(form, "#player-multiclass-2-class"), level: numberFormValue(form, "#player-multiclass-2-level") },
    { className: formValue(form, "#player-multiclass-3-class"), level: numberFormValue(form, "#player-multiclass-3-level") },
  ]);
}

function classLevelEntriesForPlayer(player = {}) {
  if (Array.isArray(player.classLevels) && player.classLevels.length) {
    return classLevelEntriesFromParts(player.classLevels);
  }
  return classLevelEntriesFromParts([{ className: player.classRole, level: player.level || 1 }]);
}

function totalLevelForClassLevels(classLevels = []) {
  return classLevels.reduce((total, entry) => total + (Number(entry.level) || 0), 0);
}

function isMulticlassClassLevelSet(classLevels = []) {
  return classLevels.filter((entry) => entry.className && Number(entry.level) > 0).length > 1;
}

function classLevelFor(player = {}, className = "") {
  const normalized = normalizeRulesText(className);
  return classLevelEntriesForPlayer(player).find((entry) => normalizeRulesText(entry.className) === normalized)?.level || 0;
}

function bardLevelForClassLevels(classLevels = []) {
  return classLevelEntriesFromParts(classLevels)
    .filter((entry) => classNameForValue(entry.className) === "Bard")
    .reduce((total, entry) => total + Number(entry.level || 0), 0);
}

function bardLevelForPlayer(player = {}) {
  return bardLevelForClassLevels(classLevelEntriesForPlayer(player));
}

function bardSubclassById(id = "") {
  const normalized = normalizeRulesText(id);
  return BARD_SUBCLASSES.find((subclass) => normalizeRulesText(subclass.id) === normalized || normalizeRulesText(subclass.name) === normalized) || null;
}

function bardSubclassIdFromForm(form) {
  return formValue(form, "#player-bard-subclass");
}

function bardSubclassIdForPlayer(player = {}) {
  const saved = player.subclasses?.Bard || player.subclasses?.bard || player.bardSubclass || player.subclass || "";
  return bardSubclassById(saved)?.id || "";
}

function classSubclassMapFromForm(form, classLevels = classLevelEntriesFromForm(form)) {
  const subclasses = {};
  if (bardLevelForClassLevels(classLevels) >= 3) {
    const bardSubclass = bardSubclassById(bardSubclassIdFromForm(form));
    if (bardSubclass) subclasses.Bard = bardSubclass.id;
  }
  return subclasses;
}

function bardSubclassRequiredForClassLevels(classLevels = []) {
  return bardLevelForClassLevels(classLevels) >= 3;
}

function bardSubclassValidationError(classLevels = [], subclasses = {}) {
  if (!bardSubclassRequiredForClassLevels(classLevels)) return "";
  return bardSubclassById(subclasses.Bard || subclasses.bard) ? "" : "Choose a Bard College for Bard level 3 or higher.";
}

function bardicInspirationDie(level = 1) {
  const bardLevel = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  if (bardLevel >= 15) return "d12";
  if (bardLevel >= 10) return "d10";
  if (bardLevel >= 5) return "d8";
  return "d6";
}

function bardPreparedSpellsAtLevel(level = 1) {
  return Number(progressionValueAtLevel(SPELLCASTING_CLASS_RULES.Bard.known, level)) || 0;
}

function bardFeatureDynamicDetails(feature = {}, player = {}) {
  const bardLevel = bardLevelForPlayer(player);
  const runtime = spellcastingRuntimeForPlayer(player);
  if (feature.dynamic === "bardicDie") {
    return [
      `Bardic die: ${bardicInspirationDie(bardLevel)}.`,
      `Uses: ${classFeatureUsageMaximum(feature, player)} per ${bardLevel >= 5 ? "short or long rest" : "long rest"}.`,
    ];
  }
  if (feature.dynamic === "spellcasting") {
    return [
      "Spellcasting ability: Charisma.",
      `Prepared spells: ${bardPreparedSpellsAtLevel(bardLevel)}.`,
      `Spell slots: ${spellSlotSummaryParts(runtime).join(", ") || "none"}.`,
    ];
  }
  if (feature.id === "jack-of-all-trades") {
    return [`Unproficient ability checks and Initiative: ${signedModifier(jackOfAllTradesBonusForPlayer(player))}.`];
  }
  if (feature.id === "valor-martial-training") {
    return ["Armor training: Medium armor and Shields.", "Weapon proficiency: Martial weapons."];
  }
  if (feature.id === "valor-extra-attack") {
    return [`Attacks per Attack action: ${attacksPerActionForPlayer(player)}.`];
  }
  if (feature.id === "glamour-beguiling-magic") {
    return ["Always prepared: Charm Person and Mirror Image."];
  }
  if (feature.id === "words-of-creation") {
    return ["Always prepared: Power Word Heal and Power Word Kill."];
  }
  return [];
}

function bardBaseFeaturesForLevel(level = 1) {
  const bardLevel = Math.max(0, Math.min(20, Math.floor(Number(level) || 0)));
  return BARD_FEATURE_PROGRESSION.filter((feature) => feature.level <= bardLevel);
}

function bardSubclassFeaturesForPlayer(player = {}) {
  const bardLevel = bardLevelForPlayer(player);
  const subclass = bardSubclassById(bardSubclassIdForPlayer(player));
  if (!subclass || bardLevel < 3) return [];
  return subclass.features
    .filter((feature) => feature.level <= bardLevel)
    .map((feature) => ({ ...feature, subclassName: subclass.name, source: feature.source || subclass.source }));
}

function classFeaturesForPlayer(player = {}) {
  const bardLevel = bardLevelForPlayer(player);
  const bardSubclass = bardSubclassById(bardSubclassIdForPlayer(player));
  const bardBase = bardLevel
    ? bardBaseFeaturesForLevel(bardLevel).map((feature) => ({
      ...feature,
      className: "Bard",
      source: "D&D Beyond Bard class page",
    }))
    : [];
  return [
    ...bardBase,
    ...(bardSubclass ? [{ id: `bard-subclass-${bardSubclass.id}`, level: 3, title: bardSubclass.name, summary: bardSubclass.theme, className: "Bard", source: bardSubclass.source }] : []),
    ...bardSubclassFeaturesForPlayer(player).map((feature) => ({ ...feature, className: "Bard" })),
  ].sort((a, b) => (Number(a.level) - Number(b.level)) || String(a.title).localeCompare(String(b.title)));
}

function classFeatureUsageMaximum(feature = {}, player = {}) {
  const max = feature.usage?.max;
  if (max === "charismaModifierMinimumOne") return Math.max(1, abilityModifier(player.abilities?.charisma));
  return Number(max) || 0;
}

function classFeatureUsageRecovery(feature = {}, player = {}) {
  const recovery = feature.usage?.recovery || "";
  if (recovery === "longUntilBard5ThenShort") return bardLevelForPlayer(player) >= 5 ? "Short or Long Rest" : "Long Rest";
  if (recovery === "long") return "Long Rest";
  if (recovery === "short") return "Short Rest";
  return "";
}

function classFeatureUsageKey(feature = {}) {
  return feature.usage?.key || feature.id || "";
}

function classFeatureUsageUsed(player = {}, feature = {}) {
  const key = classFeatureUsageKey(feature);
  return Math.max(0, Math.floor(Number(player.featureUsage?.[key]) || 0));
}

function setPlayerFeatureUsage(player = {}, featureKey = "", used = 0) {
  return {
    ...player,
    featureUsage: {
      ...(player.featureUsage || {}),
      [featureKey]: Math.max(0, Math.floor(Number(used) || 0)),
    },
  };
}

function recoverPlayerClassFeatures(player = {}, restType = "long") {
  const nextUsage = { ...(player.featureUsage || {}) };
  classFeaturesForPlayer(player).forEach((feature) => {
    if (!feature.usage) return;
    const recovery = classFeatureUsageRecovery(feature, player).toLowerCase();
    if (restType === "long" || (restType === "short" && recovery.includes("short"))) {
      nextUsage[classFeatureUsageKey(feature)] = 0;
    }
  });
  return { ...player, featureUsage: nextUsage };
}

function recoverBardicInspirationWithSpellSlot(player = {}, level = 1) {
  if (bardLevelForPlayer(player) < 5) return player;
  const feature = classFeaturesForPlayer(player).find((item) => item.id === "bardic-inspiration");
  const slotLevel = Math.max(1, Math.floor(Number(level) || 1));
  const runtime = spellcastingRuntimeForPlayer(player);
  const maximum = runtime?.normalSlots?.[slotLevel - 1] || 0;
  const currentSlotUsage = runtime?.slotUsage?.normal?.[slotLevel] || 0;
  const inspirationUsed = feature ? classFeatureUsageUsed(player, feature) : 0;
  if (!feature || inspirationUsed <= 0 || currentSlotUsage >= maximum) return player;
  return setPlayerFeatureUsage(
    setPlayerSpellSlotUsage(player, "normal", slotLevel, currentSlotUsage + 1),
    classFeatureUsageKey(feature),
    inspirationUsed - 1
  );
}

function applySuperiorInspiration(player = {}) {
  if (bardLevelForPlayer(player) < 18) return player;
  const feature = classFeaturesForPlayer(player).find((item) => item.id === "bardic-inspiration");
  if (!feature) return player;
  const maximum = classFeatureUsageMaximum(feature, player);
  const used = classFeatureUsageUsed(player, feature);
  return setPlayerFeatureUsage(player, classFeatureUsageKey(feature), Math.min(used, Math.max(0, maximum - 2)));
}

function spendBardicInspiration(player = {}) {
  const feature = classFeaturesForPlayer(player).find((item) => item.id === "bardic-inspiration");
  if (!feature) return player;
  const maximum = classFeatureUsageMaximum(feature, player);
  const used = classFeatureUsageUsed(player, feature);
  return used >= maximum ? player : setPlayerFeatureUsage(player, classFeatureUsageKey(feature), used + 1);
}

function restoreClassFeatureWithBardicInspiration(player = {}, featureKey = "") {
  const feature = classFeaturesForPlayer(player).find((item) => classFeatureUsageKey(item) === featureKey);
  const inspiration = classFeaturesForPlayer(player).find((item) => item.id === "bardic-inspiration");
  if (!feature || feature.recoveryCost !== "Bardic Inspiration" || !inspiration || classFeatureUsageUsed(player, feature) <= 0) return player;
  const inspirationUsed = classFeatureUsageUsed(player, inspiration);
  const inspirationMaximum = classFeatureUsageMaximum(inspiration, player);
  if (inspirationUsed >= inspirationMaximum) return player;
  return setPlayerFeatureUsage(
    setPlayerFeatureUsage(player, classFeatureUsageKey(inspiration), inspirationUsed + 1),
    classFeatureUsageKey(feature),
    0
  );
}

function bardSubclassSelectMarkup({ id = "player-bard-subclass", value = "", required = false } = {}) {
  const normalizedValue = bardSubclassById(value)?.id || "";
  return `
    <label>Bard College
      <select id="${escapeHtml(id)}" name="${escapeHtml(id)}" ${required ? "required" : ""}>
        <option value="">Choose Bard College</option>
        ${BARD_SUBCLASSES.map((subclass) => `<option value="${escapeHtml(subclass.id)}" ${subclass.id === normalizedValue ? "selected" : ""}>${escapeHtml(subclass.name)}</option>`).join("")}
      </select>
    </label>`;
}

function bardSubclassChoiceSummary(id = "") {
  const subclass = bardSubclassById(id);
  if (!subclass) return "Choose a Bard College when Bard reaches level 3.";
  return `${subclass.name}: ${subclass.theme}`;
}

function bardFeaturesUnlockedBetween(fromLevel = 0, toLevel = 0, subclassId = "") {
  const subclass = bardSubclassById(subclassId);
  const base = BARD_FEATURE_PROGRESSION
    .filter((feature) => feature.level > fromLevel && feature.level <= toLevel)
    .map((feature) => feature.title);
  const subclassFeatures = subclass?.features
    ?.filter((feature) => feature.level > fromLevel && feature.level <= toLevel)
    .map((feature) => `${subclass.name}: ${feature.title}`) || [];
  return [...base, ...subclassFeatures];
}

function bardExpertiseRequiredCount(level = 0) {
  const bardLevel = Math.max(0, Math.min(20, Math.floor(Number(level) || 0)));
  if (bardLevel >= 9) return 4;
  if (bardLevel >= 2) return 2;
  return 0;
}

function bardChoiceList(value) {
  return uniqueTextList(Array.isArray(value) ? value : splitListInput(value));
}

function bardSpellChoiceId(value = "") {
  const normalized = normalizeRulesText(value);
  if (!normalized) return "";
  const spell = spellById(value) || spellCollection().find((item) => normalizeRulesText(item.name) === normalized);
  return spell?.id || String(value).trim();
}

function bardSpellChoiceIds(value) {
  return uniqueTextList(bardChoiceList(value).map(bardSpellChoiceId).filter(Boolean));
}

function bardSpellChoiceNames(value) {
  return bardSpellChoiceIds(value).map((spellId) => spellById(spellId)?.name || spellId);
}

function bardChoicesForPlayer(player = {}) {
  const choices = player.classChoices?.Bard || player.classChoices?.bard || {};
  return {
    expertise: bardChoiceList(choices.expertise),
    loreBonusProficiencies: bardChoiceList(choices.loreBonusProficiencies),
    loreMagicalDiscoveries: bardSpellChoiceIds(choices.loreMagicalDiscoveries),
    magicalSecrets: bardSpellChoiceIds(choices.magicalSecrets),
    asiNotes: String(choices.asiNotes || "").trim(),
  };
}

function selectedBardSpellChoicesFromForm(form, prefix, legacySelector) {
  const selectValues = [1, 2]
    .map((index) => formValue(form, `#${prefix}-${index}`))
    .filter(Boolean);
  return bardSpellChoiceIds(selectValues.length ? selectValues : splitListInput(formValue(form, legacySelector)));
}

function bardChoicesFromForm(form, classLevels = classLevelEntriesFromForm(form)) {
  if (!bardLevelForClassLevels(classLevels)) return null;
  const choices = {
    expertise: checkedFormValues(form, "player-bard-expertise"),
    loreBonusProficiencies: checkedFormValues(form, "player-bard-lore-bonus-skills"),
    loreMagicalDiscoveries: selectedBardSpellChoicesFromForm(form, "player-bard-lore-magical-discovery", "#player-bard-lore-magical-discoveries"),
    magicalSecrets: splitListInput(formValue(form, "#player-bard-magical-secrets")),
    asiNotes: formValue(form, "#player-bard-asi-notes"),
  };
  return choices;
}

function bardChoicesFromLevelUpForm(form) {
  return {
    expertise: checkedFormValues(form, "level-up-bard-expertise"),
    loreBonusProficiencies: checkedFormValues(form, "level-up-bard-lore-bonus-skills"),
    loreMagicalDiscoveries: selectedBardSpellChoicesFromForm(form, "level-up-bard-lore-magical-discovery", "#level-up-bard-lore-magical-discoveries"),
    magicalSecrets: splitListInput(formValue(form, "#level-up-bard-magical-secrets")),
    asiNotes: formValue(form, "#level-up-bard-asi-notes"),
  };
}

function mergeBardChoices(existing = {}, incoming = {}) {
  return {
    expertise: uniqueTextList([...(existing.expertise || []), ...(incoming.expertise || [])]),
    loreBonusProficiencies: uniqueTextList([...(existing.loreBonusProficiencies || []), ...(incoming.loreBonusProficiencies || [])]),
    loreMagicalDiscoveries: bardSpellChoiceIds([...(existing.loreMagicalDiscoveries || []), ...(incoming.loreMagicalDiscoveries || [])]),
    magicalSecrets: bardSpellChoiceIds([...(existing.magicalSecrets || []), ...(incoming.magicalSecrets || [])]),
    asiNotes: [existing.asiNotes, incoming.asiNotes].filter(hasText).join("\n"),
  };
}

function classChoicesFromForm(form, classLevels = classLevelEntriesFromForm(form)) {
  const choices = {};
  const bardChoices = bardChoicesFromForm(form, classLevels);
  if (bardChoices) choices.Bard = bardChoices;
  return choices;
}

function classChoicesForLevelUp(player = {}, options = {}) {
  const current = { ...(player.classChoices || {}) };
  const existingBard = bardChoicesForPlayer(player);
  const incomingBard = options.bardChoices || {};
  const mergedBard = mergeBardChoices(existingBard, incomingBard);
  if (bardLevelForPlayer(player) || classNameForValue(options.className) === "Bard") {
    current.Bard = mergedBard;
  }
  return current;
}

function selectedSkillProficienciesWithBardChoices(skillProficiencies = [], bardChoices = {}) {
  return uniqueTextList([
    ...(skillProficiencies || []),
    ...(bardChoices.loreBonusProficiencies || []),
  ]);
}

function expertiseSkillKeysForPlayer(player = {}) {
  const proficient = new Set(player.skillProficiencies || []);
  return bardChoicesForPlayer(player).expertise.filter((skillKey) => proficient.has(skillKey));
}

function bardLoreMagicalDiscoverySpells(level = 0) {
  const bardLevel = Math.max(0, Math.floor(Number(level) || 0));
  const maxLevel = maxSpellLevelForClassEntry({
    className: "Bard",
    level: bardLevel,
    rule: spellcastingRule("Bard"),
  });
  return spellCollection()
    .filter((spell) => {
      const spellLevel = Number(spell.level) || 0;
      const eligibleClass = ["Cleric", "Druid", "Wizard"].some((className) => spellClassMatches(spell, className));
      return eligibleClass && (spellLevel === 0 || spellLevel <= maxLevel);
    })
    .sort((a, b) => (Number(a.level) - Number(b.level)) || a.name.localeCompare(b.name));
}

function bardBonusSpellIds(player = {}) {
  const bardLevel = bardLevelForPlayer(player);
  if (!bardLevel) return [];
  const ids = [];
  const subclassId = bardSubclassIdForPlayer(player);
  if (subclassId === "college-of-lore" && bardLevel >= 6) {
    ids.push(...bardChoicesForPlayer(player).loreMagicalDiscoveries);
  }
  if (subclassId === "college-of-glamour" && bardLevel >= 3) {
    ["Charm Person", "Mirror Image"].forEach((name) => {
      const spell = spellCollection().find((item) => normalizeRulesText(item.name) === normalizeRulesText(name));
      if (spell) ids.push(spell.id);
    });
  }
  if (bardLevel >= 20) {
    ["Power Word: Heal", "Power Word: Kill"].forEach((name) => {
      const spell = spellCollection().find((item) => normalizeRulesText(item.name) === normalizeRulesText(name));
      if (spell) ids.push(spell.id);
    });
  }
  return uniqueTextList(ids);
}

function bardArmorTrainingForPlayer(player = {}) {
  return bardSubclassIdForPlayer(player) === "college-of-valor" && bardLevelForPlayer(player) >= 3
    ? ["Medium armor", "Shields"]
    : [];
}

function bardWeaponProficienciesForPlayer(player = {}) {
  return bardSubclassIdForPlayer(player) === "college-of-valor" && bardLevelForPlayer(player) >= 3
    ? ["Martial weapons"]
    : [];
}

function attacksPerActionForPlayer(player = {}) {
  return bardSubclassIdForPlayer(player) === "college-of-valor" && bardLevelForPlayer(player) >= 6 ? 2 : 1;
}

function jackOfAllTradesBonusForPlayer(player = {}) {
  return bardLevelForPlayer(player) >= 2 ? Math.floor(proficiencyBonusForLevel(player.level || 1) / 2) : 0;
}

function initiativeBonusForPlayer(player = {}) {
  return abilityModifier(abilityScore(player, "dexterity")) + jackOfAllTradesBonusForPlayer(player);
}

function bardChoiceValidationErrors(player = {}) {
  const errors = [];
  const bardLevel = bardLevelForPlayer(player);
  if (!bardLevel) return errors;
  const choices = bardChoicesForPlayer(player);
  const proficient = new Set(player.skillProficiencies || []);
  const expertiseRequired = bardExpertiseRequiredCount(bardLevel);
  if (expertiseRequired && choices.expertise.length !== expertiseRequired) {
    errors.push(`Choose exactly ${expertiseRequired} Bard Expertise skill${expertiseRequired === 1 ? "" : "s"}.`);
  }
  const invalidExpertise = choices.expertise.filter((skillKey) => !proficient.has(skillKey));
  if (invalidExpertise.length) errors.push(`Bard Expertise must use proficient skills: ${invalidExpertise.map(skillLabel).join(", ")}.`);
  const subclass = bardSubclassById(bardSubclassIdForPlayer(player));
  if (subclass?.id === "college-of-lore" && bardLevel >= 3) {
    if (choices.loreBonusProficiencies.length !== 3) errors.push("Choose exactly 3 College of Lore bonus skill proficiencies.");
    const duplicated = choices.loreBonusProficiencies.filter((skillKey, index, list) => list.indexOf(skillKey) !== index);
    if (duplicated.length) errors.push("College of Lore bonus skill proficiencies cannot be duplicated.");
  }
  if (subclass?.id === "college-of-lore" && bardLevel >= 6) {
    if (choices.loreMagicalDiscoveries.length !== 2) {
      errors.push("Choose exactly 2 College of Lore Magical Discoveries spells.");
    } else {
      const eligibleIds = new Set(bardLoreMagicalDiscoverySpells(bardLevel).map((spell) => spell.id));
      if (choices.loreMagicalDiscoveries.some((spellId) => !eligibleIds.has(spellId))) {
        errors.push("College of Lore Magical Discoveries must be eligible Cleric, Druid, or Wizard spells.");
      }
    }
  }
  return errors;
}

function classLevelSummary(classLevels = []) {
  const entries = classLevels.filter((entry) => entry.className && Number(entry.level) > 0);
  return entries.map((entry) => `${entry.className} ${entry.level}`).join(" / ");
}

function classRoleSummary(classLevels = [], fallback = "") {
  const entries = classLevels.filter((entry) => entry.className && Number(entry.level) > 0);
  return entries.length > 1 ? entries.map((entry) => entry.className).join(" / ") : (entries[0]?.className || fallback);
}

function hitDieSidesForClassName(className = "") {
  return Number(String(classInfo(className)?.hitDie || "d8").replace("d", "")) || 8;
}

function classHitDiceFromClassLevels(classLevels = []) {
  const diceBySides = new Map();
  classLevels.forEach((entry) => {
    const level = Number(entry.level) || 0;
    if (!entry.className || level < 1) return;
    const sides = hitDieSidesForClassName(entry.className);
    diceBySides.set(sides, (diceBySides.get(sides) || 0) + level);
  });
  const dice = Array.from(diceBySides.entries()).sort((a, b) => b[0] - a[0]);
  return dice.length ? dice.map(([sides, count]) => `${count}d${sides}`).join(" + ") : "1d8";
}

function classHasLevel(player = {}, className = "") {
  return classLevelFor(player, className) > 0;
}

function spellcastingRule(className = "") {
  return SPELLCASTING_CLASS_RULES[classNameForValue(className)] || null;
}

function spellcastingClassEntries(classLevels = []) {
  return classLevelEntriesFromParts(classLevels)
    .map((entry) => ({ ...entry, rule: spellcastingRule(entry.className) }))
    .filter((entry) => entry.rule && Number(entry.level) >= (entry.rule.startsAt || 1));
}

function progressionValueAtLevel(table = {}, level = 1) {
  const numericLevel = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  return Object.keys(table)
    .map(Number)
    .filter((breakpoint) => breakpoint <= numericLevel)
    .sort((a, b) => b - a)
    .map((breakpoint) => table[breakpoint])[0] || 0;
}

function spellSlotsForClassEntry(entry = {}) {
  const level = Math.max(1, Math.min(20, Math.floor(Number(entry.level) || 1)));
  if (entry.rule?.kind === "full") return FULL_CASTER_SLOTS[level] || [];
  if (entry.rule?.kind === "half") return HALF_CASTER_SLOTS[level] || [];
  if (entry.rule?.kind === "artificer") return ARTIFICER_SLOTS[level] || [];
  if (entry.rule?.kind === "pact") return [];
  return [];
}

function normalSpellSlotsForClassLevels(classLevels = []) {
  const entries = spellcastingClassEntries(classLevels).filter((entry) => entry.rule.kind !== "pact");
  if (!entries.length) return [];
  if (entries.length === 1) return spellSlotsForClassEntry(entries[0]);
  const casterLevel = entries.reduce((total, entry) => {
    if (entry.rule.kind === "full") return total + Number(entry.level);
    if (entry.rule.kind === "half") return total + Math.floor(Number(entry.level) / 2);
    if (entry.rule.kind === "artificer") return total + Math.ceil(Number(entry.level) / 2);
    return total;
  }, 0);
  return FULL_CASTER_SLOTS[Math.max(1, Math.min(20, casterLevel))] || [];
}

function pactMagicForClassLevels(classLevels = []) {
  const warlockLevel = classLevelEntriesFromParts(classLevels)
    .filter((entry) => classNameForValue(entry.className) === "Warlock")
    .reduce((total, entry) => total + Number(entry.level || 0), 0);
  return warlockLevel > 0 ? WARLOCK_PACT_SLOTS[Math.max(1, Math.min(20, warlockLevel))] : null;
}

function maxSpellLevelForClassEntry(entry = {}) {
  if (entry.rule?.kind === "pact") return pactMagicForClassLevels([entry])?.level || 0;
  return spellSlotsForClassEntry(entry).length;
}

function spellClassMatches(spell = {}, className = "") {
  const canonical = classNameForValue(className);
  return (spell.classes || []).some((spellClass) => spellClass === canonical);
}

function availableSpellsForClassLevels(classLevels = []) {
  const entries = spellcastingClassEntries(classLevels);
  const byId = new Map();
  entries.forEach((entry) => {
    const maxLevel = maxSpellLevelForClassEntry(entry);
    const cantripsAllowed = Number(progressionValueAtLevel(entry.rule.cantrips || {}, entry.level)) > 0;
    const bardMagicalSecrets = entry.className === "Bard" && Number(entry.level) >= 10;
    spellCollection().forEach((spell) => {
      const spellLevel = Number(spell.level) || 0;
      const classMatch = spellClassMatches(spell, entry.className)
        || (bardMagicalSecrets && ["Cleric", "Druid", "Wizard"].some((className) => spellClassMatches(spell, className)));
      if (!classMatch) return;
      if (spellLevel === 0 && !cantripsAllowed) return;
      if (spellLevel > 0 && spellLevel > maxLevel) return;
      byId.set(spell.id, spell);
    });
  });
  return Array.from(byId.values()).sort((a, b) => (Number(a.level) - Number(b.level)) || a.name.localeCompare(b.name));
}

function selectedSpellIdsFromForm(form) {
  return uniqueTextList(checkedFormValues(form, "player-spells"));
}

function spellById(spellId = "") {
  return spellCollection().find((spell) => spell.id === spellId) || null;
}

function selectedSpellsForPlayer(player = {}) {
  return uniqueTextList([
    ...(player.spellcasting?.spells || []),
    ...bardBonusSpellIds(player),
  ]).map(spellById).filter(Boolean);
}

function abilityScoresFromForm(form) {
  const baseScores = Object.fromEntries(ABILITIES.map((ability) => [ability.key, numberFormValue(form, `#player-${ability.key}`)]));
  return applyBackgroundBonusesToScores(
    baseScores,
    combineAbilityBonuses(lineageAbilityBonusesFromForm(form), backgroundAbilityBonusesFromForm(form))
  );
}

function preparedSpellLabel(prepared) {
  if (!prepared) return "";
  return typeof prepared === "string" ? prepared : prepared.label || "";
}

function preparedSpellLimitForEntry(entry = {}, abilities = {}) {
  const prepared = entry.rule?.prepared;
  if (!prepared || typeof prepared === "string") return 0;
  const level = Math.max(1, Math.min(20, Math.floor(Number(entry.level) || 1)));
  const multiplier = Number(prepared.levelMultiplier);
  const levelPart = multiplier === 0.5 ? Math.floor(level / 2) : Math.floor(level * (Number.isFinite(multiplier) ? multiplier : 1));
  const modifier = abilityModifier(abilities[prepared.abilityKey]);
  return Math.max(Number(prepared.minimum) || 1, levelPart + modifier);
}

function spellSelectionBudgetForClassLevels(classLevels = [], abilities = {}) {
  const entries = spellcastingClassEntries(classLevels);
  return entries.reduce((budget, entry) => {
    const cantrips = Number(progressionValueAtLevel(entry.rule?.cantrips || {}, entry.level)) || 0;
    const known = Number(progressionValueAtLevel(entry.rule?.known || {}, entry.level)) || 0;
    const prepared = preparedSpellLimitForEntry(entry, abilities);
    const spellbook = typeof entry.rule?.spellbook === "function" ? Number(entry.rule.spellbook(entry.level)) || 0 : 0;
    const leveled = spellbook || known || prepared;
    budget.cantrips += cantrips;
    budget.leveled += leveled;
    const knownLabel = entry.rule.modeLabel || "Known spells";
    budget.lines.push([
      `${entry.className} ${entry.level}`,
      cantrips ? `${cantrips} cantrip${cantrips === 1 ? "" : "s"}` : "",
      known ? `${known} ${knownLabel.toLowerCase()}` : "",
      spellbook ? `${spellbook} spellbook spell${spellbook === 1 ? "" : "s"}` : "",
      prepared && !spellbook ? `${prepared} prepared spell${prepared === 1 ? "" : "s"}` : "",
    ].filter(Boolean).join(": "));
    return budget;
  }, { cantrips: 0, leveled: 0, lines: [] });
}

function spellSelectionModeLabel(classLevels = [], abilities = {}) {
  const entries = spellcastingClassEntries(classLevels);
  const hasSpellbook = entries.some((entry) => typeof entry.rule?.spellbook === "function");
  const hasPrepared = entries.some((entry) => preparedSpellLimitForEntry(entry, abilities) > 0);
  const hasKnown = entries.some((entry) => Number(progressionValueAtLevel(entry.rule?.known || {}, entry.level)) > 0);
  const explicitLabels = uniqueTextList(entries.map((entry) => entry.rule?.modeLabel).filter(Boolean));
  if (explicitLabels.length === 1 && !hasPrepared && !hasSpellbook) return explicitLabels[0];
  if (hasSpellbook && entries.length === 1) return "Spellbook spells";
  if (hasPrepared && !hasKnown && !hasSpellbook) return "Prepared spells";
  if (hasKnown && !hasPrepared && !hasSpellbook) return "Known spells";
  return "Leveled spells";
}

function selectedSpellCounts(spellIds = []) {
  return uniqueTextList(spellIds).reduce((counts, spellId) => {
    const spell = spellById(spellId);
    if (!spell) return counts;
    if (Number(spell.level) === 0) counts.cantrips += 1;
    else counts.leveled += 1;
    return counts;
  }, { cantrips: 0, leveled: 0 });
}

function spellSelectionErrors(spellIds = [], classLevels = [], abilities = {}, player = {}) {
  const summary = spellcastingSummaryForClassLevels(classLevels, abilities);
  if (!summary) return spellIds.length ? ["This character class does not have spellcasting."] : [];
  const budget = spellSelectionBudgetForClassLevels(classLevels, abilities);
  const bonusIds = new Set(bardBonusSpellIds(player));
  const budgetedSpellIds = uniqueTextList(spellIds).filter((spellId) => !bonusIds.has(spellId));
  const counts = selectedSpellCounts(budgetedSpellIds);
  const availableIds = new Set([
    ...availableSpellsForClassLevels(classLevels).map((spell) => spell.id),
    ...bonusIds,
  ]);
  const errors = [];
  if (counts.cantrips > budget.cantrips) errors.push(`Choose no more than ${budget.cantrips} cantrip${budget.cantrips === 1 ? "" : "s"}.`);
  if (counts.leveled > budget.leveled) errors.push(`Choose no more than ${budget.leveled} leveled spell${budget.leveled === 1 ? "" : "s"} for this class and level.`);
  if (spellIds.some((spellId) => !availableIds.has(spellId))) errors.push("Remove spells that are not available to this character's class and level.");
  return errors;
}

function spellcastingGuidanceLine(entry = {}, abilities = {}) {
  const cantrips = progressionValueAtLevel(entry.rule?.cantrips || {}, entry.level);
  const known = progressionValueAtLevel(entry.rule?.known || {}, entry.level);
  const prepared = preparedSpellLabel(entry.rule?.prepared);
  const preparedLimit = preparedSpellLimitForEntry(entry, abilities);
  const spellbook = typeof entry.rule?.spellbook === "function" ? entry.rule.spellbook(entry.level) : 0;
  const knownLabel = entry.rule?.modeLabel || "known spells";
  return [
    `${entry.className} ${entry.level}`,
    cantrips ? `${cantrips} cantrip${cantrips === 1 ? "" : "s"}` : "",
    known ? `${known} ${knownLabel.toLowerCase()}` : "",
    prepared ? `prepare ${preparedLimit ? `${preparedLimit} spell${preparedLimit === 1 ? "" : "s"}` : prepared}` : "",
    spellbook ? `${spellbook} spellbook spell${spellbook === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(": ");
}

function spellcastingSummaryForClassLevels(classLevels = [], abilities = {}) {
  const entries = spellcastingClassEntries(classLevels);
  if (!entries.length) return null;
  return {
    entries,
    normalSlots: normalSpellSlotsForClassLevels(classLevels),
    pact: pactMagicForClassLevels(classLevels),
    guidance: entries.map((entry) => spellcastingGuidanceLine(entry, abilities)),
  };
}

function buildSpellcastingFromForm(form, classLevels = [], abilities = {}, bardContext = {}) {
  const summary = spellcastingSummaryForClassLevels(classLevels, abilities);
  const spells = uniqueTextList([
    ...selectedSpellIdsFromForm(form),
    ...bardBonusSpellIds({
      level: totalLevelForClassLevels(classLevels),
      classLevels,
      subclasses: bardContext.subclasses || {},
      classChoices: bardContext.classChoices || {},
    }),
  ]);
  if (!summary && !spells.length) return null;
  return {
    classes: (summary?.entries || []).map((entry) => ({
      className: entry.className,
      level: entry.level,
      ability: entry.rule.ability,
      kind: entry.rule.kind,
    })),
    spells,
    slotUsage: { normal: {}, pact: 0 },
  };
}

function clampSlotUsage(value, maximum) {
  return Math.max(0, Math.min(Number(maximum) || 0, Math.floor(Number(value) || 0)));
}

function spellcastingRuntimeForPlayer(player = {}) {
  const summary = spellcastingSummaryForClassLevels(classLevelEntriesForPlayer(player), player.abilities || {});
  if (!summary && !selectedSpellsForPlayer(player).length) return null;
  const usage = player.spellcasting?.slotUsage || {};
  const normalUsage = {};
  (summary?.normalSlots || []).forEach((maximum, index) => {
    normalUsage[index + 1] = clampSlotUsage(usage.normal?.[index + 1], maximum);
  });
  const pactUsage = summary?.pact ? clampSlotUsage(usage.pact, summary.pact.slots) : 0;
  return {
    ...(summary || { entries: [], normalSlots: [], pact: null, guidance: [] }),
    spells: selectedSpellsForPlayer(player),
    slotUsage: { normal: normalUsage, pact: pactUsage },
  };
}

function abilityKeyForLabel(label = "") {
  const normalized = normalizeRulesText(label);
  return ABILITIES.find((ability) => normalizeRulesText(ability.label) === normalized || normalizeRulesText(ability.short) === normalized)?.key || normalized;
}

function spellcastingAbilityRows(player = {}, runtime = null) {
  const proficiencyBonus = player.proficiencyBonus || proficiencyBonusForLevel(player.level || 1);
  return (runtime?.entries || []).map((entry) => {
    const abilityKey = abilityKeyForLabel(entry.rule?.ability || "");
    const modifier = abilityModifier(player.abilities?.[abilityKey]);
    return {
      className: entry.className,
      ability: entry.rule?.ability || "",
      saveDc: 8 + proficiencyBonus + modifier,
      attackBonus: proficiencyBonus + modifier,
    };
  });
}

function spellMetadata(spell = {}) {
  const castingTime = String(spell.castingTime || "");
  const duration = String(spell.duration || "");
  const components = String(spell.components || "");
  const materialMatch = components.match(/M\s*\(([^)]+)\)/i);
  return {
    level: Number(spell.level) || 0,
    levelLabel: spell.levelName || spellLevelLabel(spell.level),
    concentration: /concentration/i.test(duration),
    ritual: /ritual/i.test(castingTime),
    instantaneous: /^instantaneous$/i.test(duration.trim()),
    verbal: /\bV\b/i.test(components),
    somatic: /\bS\b/i.test(components),
    material: /\bM\b/i.test(components),
    materialText: spell.material || spell.materialComponent || spell.materials || materialMatch?.[1] || "",
  };
}

function spellFeatureBadgesMarkup(spell = {}, options = {}) {
  const meta = spellMetadata(spell);
  const badges = [
    meta.concentration ? { label: "Concentration", className: "is-concentration" } : null,
    meta.ritual ? { label: "Ritual", className: "is-ritual" } : null,
    meta.instantaneous ? { label: "Instantaneous", className: "is-instantaneous" } : null,
    meta.verbal ? { label: "V", title: "Verbal component" } : null,
    meta.somatic ? { label: "S", title: "Somatic component" } : null,
    meta.material ? { label: "M", title: meta.materialText ? `Material: ${meta.materialText}` : "Material component" } : null,
  ].filter(Boolean);
  const limit = Number(options.limit) || badges.length;
  return badges.slice(0, limit).map((badge) => (
    `<span class="spell-badge ${escapeHtml(badge.className || "")}" ${badge.title ? `title="${escapeHtml(badge.title)}"` : ""}>${escapeHtml(badge.label)}</span>`
  )).join("");
}

function spellSlotSummaryParts(summary = null) {
  if (!summary) return [];
  return [
    ...(summary.normalSlots || []).map((amount, index) => `Level ${index + 1}: ${amount}`),
    summary.pact ? [`Pact level ${summary.pact.level}: ${summary.pact.slots}`] : [],
  ].flat();
}

function spellsGroupedByLevel(spells = []) {
  return Array.from({ length: 10 }, (_, level) => ({
    level,
    label: level === 0 ? "Cantrips" : `Level ${level} Spells`,
    spells: spells.filter((spell) => Number(spell.level) === level),
  })).filter((group) => group.spells.length);
}

function selectedSpellIdsByLevel(spellIds = []) {
  return uniqueTextList(spellIds).reduce((counts, spellId) => {
    const level = Number(spellById(spellId)?.level) || 0;
    counts[level] = (counts[level] || 0) + 1;
    return counts;
  }, {});
}

function abilityModifier(score) {
  if (score === "" || score === null || score === undefined) return 0;
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.floor((value - 10) / 2);
}

function signedModifier(value) {
  const number = Number(value) || 0;
  return number >= 0 ? `+${number}` : String(number);
}

function proficiencyBonusForLevel(level) {
  const value = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  return CHARACTER_ADVANCEMENT_LEVELS[value]?.proficiencyBonus || 2;
}

function abilityScore(player, key) {
  return player?.abilities?.[key] ?? "";
}

function levelUpClassLevelOptions(player = {}) {
  const currentEntries = classLevelEntriesForPlayer(player);
  const primaryClass = currentEntries[0]?.className || player.classRole || PLAYER_CLASSES[0].name;
  const currentNames = new Set(currentEntries.map((entry) => normalizeRulesText(entry.className)));
  return PLAYER_CLASSES.map((item) => {
    const existingLevel = currentEntries.find((entry) => normalizeRulesText(entry.className) === normalizeRulesText(item.name))?.level || 0;
    return {
      className: item.name,
      existingLevel,
      isCurrentClass: currentNames.has(normalizeRulesText(item.name)),
      isPrimary: normalizeRulesText(item.name) === normalizeRulesText(primaryClass),
      hitDieSides: hitDieSidesForClassName(item.name),
    };
  }).sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.isCurrentClass !== b.isCurrentClass) return a.isCurrentClass ? -1 : 1;
    return a.className.localeCompare(b.className);
  });
}

function nextClassLevelsForLevelUp(player = {}, className = "") {
  const selectedClass = classNameForValue(className || classLevelEntriesForPlayer(player)[0]?.className || player.classRole);
  const entries = classLevelEntriesForPlayer(player);
  const nextEntries = entries.map((entry) => (
    normalizeRulesText(entry.className) === normalizeRulesText(selectedClass)
      ? { ...entry, level: (Number(entry.level) || 0) + 1 }
      : entry
  ));
  if (!nextEntries.some((entry) => normalizeRulesText(entry.className) === normalizeRulesText(selectedClass))) {
    nextEntries.push({ className: selectedClass, level: 1 });
  }
  return classLevelEntriesFromParts(nextEntries);
}

function fixedLevelUpHitPoints(className = "", constitutionScore = "") {
  const sides = hitDieSidesForClassName(className);
  return Math.max(1, Math.floor(sides / 2) + 1 + abilityModifier(constitutionScore));
}

function levelUpPreviewForPlayer(player = {}, className = "") {
  const currentClassLevels = classLevelEntriesForPlayer(player);
  const currentLevel = Math.max(1, totalLevelForClassLevels(currentClassLevels) || Number(player.level) || 1);
  const selectedClass = classNameForValue(className || currentClassLevels[0]?.className || player.classRole);
  const nextClassLevels = currentLevel >= 20 ? currentClassLevels : nextClassLevelsForLevelUp(player, selectedClass);
  const nextLevel = totalLevelForClassLevels(nextClassLevels) || Math.min(20, currentLevel + 1);
  const nextSpellcasting = spellcastingSummaryForClassLevels(nextClassLevels, player.abilities || {});
  return {
    selectedClass,
    currentLevel,
    nextLevel,
    currentClassLevels,
    nextClassLevels,
    hitDieSides: hitDieSidesForClassName(selectedClass),
    fixedHitPoints: fixedLevelUpHitPoints(selectedClass, player.abilities?.constitution),
    currentProficiencyBonus: proficiencyBonusForLevel(currentLevel),
    nextProficiencyBonus: proficiencyBonusForLevel(nextLevel),
    nextHitDice: classHitDiceFromClassLevels(nextClassLevels),
    nextSpellcasting,
  };
}

function abilityDeltasFromLevelUpOptions(options = {}) {
  return Object.fromEntries(ABILITIES.map((ability) => {
    const raw = options.abilityDeltas?.[ability.key] ?? options[`ability-${ability.key}`] ?? 0;
    return [ability.key, Math.max(0, Math.floor(Number(raw) || 0))];
  }));
}

function applyAbilityDeltasForLevelUp(scores = {}, deltas = {}) {
  return Object.fromEntries(ABILITIES.map((ability) => {
    const current = numberOrBlank(scores?.[ability.key]);
    const delta = Number(deltas?.[ability.key]) || 0;
    if (current === "") return [ability.key, delta > 0 ? Math.min(20, delta) : ""];
    return [ability.key, delta > 0 ? Math.min(20, current + delta) : current];
  }));
}

function levelUpSpellcastingForPlayer(player = {}, classLevels = [], abilities = {}, bardContext = {}) {
  const summary = spellcastingSummaryForClassLevels(classLevels, abilities);
  const spells = uniqueTextList([
    ...(player.spellcasting?.spells || []),
    ...bardBonusSpellIds({
      ...player,
      level: totalLevelForClassLevels(classLevels),
      classLevels,
      subclasses: bardContext.subclasses || player.subclasses || {},
      classChoices: bardContext.classChoices || player.classChoices || {},
    }),
  ]);
  if (!summary && !spells.length) return null;
  return {
    classes: (summary?.entries || []).map((entry) => ({
      className: entry.className,
      level: entry.level,
      ability: entry.rule.ability,
      kind: entry.rule.kind,
    })),
    spells,
    slotUsage: player.spellcasting?.slotUsage || { normal: {}, pact: 0 },
  };
}

function levelUpFeatureBlock(details = {}) {
  const abilityLines = ABILITIES
    .map((ability) => {
      const delta = Number(details.abilityDeltas?.[ability.key]) || 0;
      return delta ? `${ability.short} +${delta}` : "";
    })
    .filter(Boolean);
  const lines = [
    `Level ${details.nextLevel} Advancement`,
    `Advanced ${details.className} to character level ${details.nextLevel}.`,
    `Hit points +${details.totalHitPointGain}. Hit Dice ${details.nextHitDice}. Proficiency bonus ${signedModifier(details.nextProficiencyBonus)}.`,
    details.subclassName ? `Subclass: ${details.subclassName}.` : "",
    details.unlockedFeatures?.length ? `Unlocked features: ${details.unlockedFeatures.join(", ")}.` : "",
    abilityLines.length ? `Ability score increases: ${abilityLines.join(", ")}.` : "",
    details.notes ? `Notes: ${details.notes}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function subclassesForLevelUp(player = {}, preview = levelUpPreviewForPlayer(player), options = {}) {
  const current = { ...(player.subclasses || {}) };
  const next = { ...current };
  const selectedBardSubclass = bardSubclassById(options.bardSubclass || options.subclasses?.Bard || current.Bard || current.bard);
  if (bardSubclassRequiredForClassLevels(preview.nextClassLevels) && selectedBardSubclass) {
    next.Bard = selectedBardSubclass.id;
  }
  return next;
}

function applyPlayerLevelUp(player = {}, options = {}) {
  const preview = levelUpPreviewForPlayer(player, options.className);
  if (preview.currentLevel >= 20) return { player, errors: ["This character is already level 20."] };
  const abilityDeltas = abilityDeltasFromLevelUpOptions(options);
  const currentAbilities = Object.fromEntries(ABILITIES.map((ability) => [ability.key, numberOrBlank(player.abilities?.[ability.key])]));
  const nextAbilities = applyAbilityDeltasForLevelUp(currentAbilities, abilityDeltas);
  const prerequisiteFailures = multiclassPrerequisiteFailures(preview.nextClassLevels, nextAbilities);
  if (prerequisiteFailures.length) return { player, errors: [`Multiclass prerequisites not met: ${prerequisiteFailures.join("; ")}.`] };
  const nextSubclasses = subclassesForLevelUp(player, preview, options);
  const subclassError = bardSubclassValidationError(preview.nextClassLevels, nextSubclasses);
  if (subclassError) return { player, errors: [subclassError] };
  const nextClassChoices = classChoicesForLevelUp(player, { ...options, className: preview.selectedClass });
  const nextSkillProficiencies = selectedSkillProficienciesWithBardChoices(player.skillProficiencies || [], nextClassChoices.Bard || {});
  const choiceErrors = bardChoiceValidationErrors({
    ...player,
    classLevels: preview.nextClassLevels,
    subclasses: nextSubclasses,
    classChoices: nextClassChoices,
    skillProficiencies: nextSkillProficiencies,
  });
  if (choiceErrors.length) return { player, errors: choiceErrors };
  const currentConMod = abilityModifier(currentAbilities.constitution);
  const nextConMod = abilityModifier(nextAbilities.constitution);
  const defaultHpGain = fixedLevelUpHitPoints(preview.selectedClass, currentAbilities.constitution);
  const requestedHpGain = Math.floor(Number(options.hitPointGain) || 0);
  const hpGain = Math.max(1, requestedHpGain || defaultHpGain);
  const constitutionRetroactiveHitPoints = Math.max(0, nextConMod - currentConMod) * preview.nextLevel;
  const totalHitPointGain = hpGain + constitutionRetroactiveHitPoints;
  const currentHitPointMaximum = numberOrBlank(player.combat?.hitPointMaximum) || fixedHitPointsForClassLevels(preview.currentClassLevels, currentAbilities.constitution);
  const nextHitPointMaximum = currentHitPointMaximum + totalHitPointGain;
  const nextClassRole = classRoleSummary(preview.nextClassLevels, player.classRole);
  const nextProficiencyBonus = proficiencyBonusForLevel(preview.nextLevel);
  const nextCombat = {
    ...(player.combat || {}),
    ...derivedCombatStats({
      level: preview.nextLevel,
      classRole: nextClassRole,
      race: player.race,
      abilities: nextAbilities,
      equipment: player.equipment,
      hitPointMaximum: nextHitPointMaximum,
      classLevels: preview.nextClassLevels,
    }),
    hitPointsRolled: true,
  };
  const currentHitPoints = numberOrBlank(player.combat?.currentHitPoints);
  nextCombat.currentHitPoints = currentHitPoints === "" ? nextHitPointMaximum : Math.min(nextHitPointMaximum, currentHitPoints + totalHitPointGain);
  const nextBaseAbilities = {
    ...(player.baseAbilities || currentAbilities),
  };
  ABILITIES.forEach((ability) => {
    const delta = Number(abilityDeltas[ability.key]) || 0;
    if (delta > 0) nextBaseAbilities[ability.key] = Math.min(20, (Number(nextBaseAbilities[ability.key]) || currentAbilities[ability.key] || 0) + delta);
  });
  const generatedAttacks = derivedWeaponAttacks({
    equipment: player.equipment,
    abilities: nextAbilities,
    level: preview.nextLevel,
  });
  const manualAttacks = (player.attacks || []).filter((attack) => !attack.generatedFromEquipment);
  const previousBardLevel = bardLevelForClassLevels(preview.currentClassLevels);
  const nextBardLevel = bardLevelForClassLevels(preview.nextClassLevels);
  const bardSubclass = bardSubclassById(nextSubclasses.Bard);
  const unlockedFeatures = nextBardLevel > previousBardLevel
    ? bardFeaturesUnlockedBetween(previousBardLevel, nextBardLevel, bardSubclass?.id)
    : [];
  const advancement = {
    id: createId("level-up"),
    advancedAt: readableDate(),
    className: preview.selectedClass,
    fromLevel: preview.currentLevel,
    toLevel: preview.nextLevel,
    hitPointGain: hpGain,
    constitutionRetroactiveHitPoints,
    totalHitPointGain,
    abilityDeltas,
    subclassName: bardSubclass?.name || "",
    unlockedFeatures,
    notes: String(options.notes || "").trim(),
  };
  const nextBardContext = {
    ...player,
    level: preview.nextLevel,
    classLevels: preview.nextClassLevels,
    subclasses: nextSubclasses,
    classChoices: nextClassChoices,
  };
  const nextPlayer = {
    ...player,
    classRole: nextClassRole,
    classLevels: preview.nextClassLevels,
    subclasses: nextSubclasses,
    classChoices: nextClassChoices,
    level: preview.nextLevel,
    abilities: nextAbilities,
    baseAbilities: nextBaseAbilities,
    proficiencyBonus: nextProficiencyBonus,
    skillProficiencies: nextSkillProficiencies,
    armorTraining: uniqueTextList([...(player.armorTraining || []), ...bardArmorTrainingForPlayer(nextBardContext)]),
    weaponProficiencies: uniqueTextList([...(player.weaponProficiencies || []), ...bardWeaponProficienciesForPlayer(nextBardContext)]),
    combat: nextCombat,
    attacks: [...generatedAttacks, ...manualAttacks],
    spellcasting: levelUpSpellcastingForPlayer(player, preview.nextClassLevels, nextAbilities, {
      subclasses: nextSubclasses,
      classChoices: nextClassChoices,
    }),
    features: appendUniqueTextBlock(player.features, levelUpFeatureBlock({
      ...advancement,
      nextLevel: preview.nextLevel,
      nextHitDice: classHitDiceFromClassLevels(preview.nextClassLevels),
      nextProficiencyBonus,
    })),
    levelHistory: [...(Array.isArray(player.levelHistory) ? player.levelHistory : []), advancement],
    updatedAt: readableDate(),
  };
  return { player: nextPlayer, errors: [], advancement };
}

function savingThrowBonus(player, abilityKey) {
  const bonus = abilityModifier(abilityScore(player, abilityKey));
  return bonus + ((player.savingThrowProficiencies || []).includes(abilityKey) ? proficiencyBonusForLevel(player.level) : 0);
}

function skillBonus(player, skill) {
  const bonus = abilityModifier(abilityScore(player, skill.ability));
  const proficient = (player.skillProficiencies || []).includes(skill.key);
  const expertise = expertiseSkillKeysForPlayer(player).includes(skill.key);
  const proficiency = proficiencyBonusForLevel(player.level);
  const jackOfAllTrades = !proficient ? jackOfAllTradesBonusForPlayer(player) : 0;
  return bonus + (proficient ? proficiency : 0) + (expertise ? proficiency : 0) + jackOfAllTrades;
}

function playerPassivePerception(player) {
  const saved = Number(player?.combat?.passivePerception);
  if (Number.isFinite(saved) && saved > 0) return saved;
  return 10 + skillBonus(player, SKILLS.find((skill) => skill.key === "perception"));
}

const WILD_SHAPE_PHYSICAL_ABILITIES = ["strength", "dexterity", "constitution"];
const WILD_SHAPE_MENTAL_ABILITIES = ["intelligence", "wisdom", "charisma"];

function characterHasWildShapeAccess(player = {}) {
  return classLevelFor(player, "Druid") >= 2;
}

function isDruidCharacter(player = {}) {
  return classHasLevel(player, "Druid");
}

function wildShapeCrLimit(level = 1) {
  const value = Number(level) || 1;
  if (value >= 8) return 1;
  if (value >= 4) return 0.5;
  if (value >= 2) return 0.25;
  return -1;
}

function wildShapeLimitText(player = {}) {
  const level = classLevelFor(player, "Druid") || 1;
  if (level < 2) return "Wild Shape unlocks at Druid 2.";
  if (level < 4) return "Max CR 1/4, no swim or fly speed.";
  if (level < 8) return "Max CR 1/2, no fly speed.";
  return "Max CR 1.";
}

function wildShapeBeastAllowed(player = {}, shape = {}) {
  if (!characterHasWildShapeAccess(player)) return false;
  const level = classLevelFor(player, "Druid") || 1;
  if ((Number(shape.crValue) || 0) > wildShapeCrLimit(level)) return false;
  if (level < 4 && beastShapeHasMovement(shape.swim)) return false;
  if (level < 8 && beastShapeHasMovement(shape.fly)) return false;
  return true;
}

function wildShapeAvailableBeasts(player = {}) {
  return beastShapeCollection().filter((shape) => wildShapeBeastAllowed(player, shape));
}

function wildShapeBeastById(beastId = "") {
  return beastShapeCollection().find((shape) => shape.id === beastId) || null;
}

function wildShapeMovementSummary(shape = {}) {
  return [
    beastShapeHasMovement(shape.speed) ? `Walk ${shape.speed}` : "",
    beastShapeHasMovement(shape.swim) ? `Swim ${shape.swim}` : "",
    beastShapeHasMovement(shape.fly) ? `Fly ${shape.fly}` : "",
  ].filter(Boolean).join(", ") || "No movement listed";
}

function wildShapeHitDice(shape = {}) {
  return shape.hitDice || shape.hitDiceText || "Source stat block";
}

function wildShapeSenses(shape = {}) {
  const explicit = shape.senses || shape.senseText;
  if (explicit) return explicit;
  const senses = beastShapeTraits(shape).filter((trait) => /blindsight|darkvision|tremorsense|truesight|telepathy/i.test(trait));
  return senses.length ? senses.join(", ") : "No special senses listed";
}

function wildShapeBonusMap(value = {}) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, bonus]) => [normalizeRulesText(key), Number(bonus)]));
  }
  return String(value).split(",").reduce((map, entry) => {
    const match = entry.trim().match(/^(.+?)\s*([+-]\d+)$/);
    if (match) map[normalizeRulesText(match[1])] = Number(match[2]);
    return map;
  }, {});
}

function wildShapeSaveBonuses(shape = {}) {
  return wildShapeBonusMap(shape.savingThrows || shape.saves || shape.saveBonuses);
}

function wildShapeSaveBonus(shape = {}, abilityKey = "") {
  const bonuses = wildShapeSaveBonuses(shape);
  const ability = ABILITIES.find((item) => item.key === abilityKey);
  return bonuses[normalizeRulesText(abilityKey)]
    ?? bonuses[normalizeRulesText(ability?.label)]
    ?? bonuses[normalizeRulesText(ability?.short)];
}

function wildShapeSkillBonuses(shape = {}) {
  return wildShapeBonusMap(shape.skills || shape.skillBonuses);
}

function wildShapeBeastAbilityScore(shape = {}, abilityKey = "") {
  return shape[abilityKey] ?? "";
}

function wildShapeAbilityScore(player = {}, shape = {}, abilityKey = "") {
  if (WILD_SHAPE_PHYSICAL_ABILITIES.includes(abilityKey)) return wildShapeBeastAbilityScore(shape, abilityKey) || abilityScore(player, abilityKey);
  return abilityScore(player, abilityKey);
}

function wildShapeSavingThrowBonus(player = {}, shape = {}, abilityKey = "") {
  const ownProficient = (player.savingThrowProficiencies || []).includes(abilityKey);
  const ownBonus = abilityModifier(wildShapeAbilityScore(player, shape, abilityKey)) + (ownProficient ? proficiencyBonusForLevel(player.level) : 0);
  const beastBonus = wildShapeSaveBonus(shape, abilityKey);
  return Number.isFinite(beastBonus) ? Math.max(ownBonus, beastBonus) : ownBonus;
}

function wildShapeSkillBonus(player = {}, shape = {}, skill = {}) {
  const ownProficient = (player.skillProficiencies || []).includes(skill.key);
  const ownBonus = abilityModifier(wildShapeAbilityScore(player, shape, skill.ability)) + (ownProficient ? proficiencyBonusForLevel(player.level) : 0);
  const beastBonuses = wildShapeSkillBonuses(shape);
  const beastBonus = beastBonuses[normalizeRulesText(skill.key)] ?? beastBonuses[normalizeRulesText(skill.label)];
  return Number.isFinite(beastBonus) ? Math.max(ownBonus, beastBonus) : ownBonus;
}

function parseWildShapeDamageFormula(formula = "") {
  const match = String(formula).trim().match(/^(\d+d\d+(?:\s*[+-]\s*\d+)?)$/i);
  if (!match) return { dice: "", bonus: "", formula: String(formula || "").trim() };
  const bonusMatch = match[1].match(/([+-])\s*(\d+)$/);
  const dice = match[1].replace(/\s*[+-]\s*\d+$/, "").trim();
  return {
    dice,
    bonus: bonusMatch ? `${bonusMatch[1]}${bonusMatch[2]}` : "",
    formula: match[1].replace(/\s+/g, " ").trim(),
  };
}

function parseWildShapeAttackAction(action = {}) {
  const description = String(action.description || "");
  const attackMatch = description.match(/(?:Melee|Ranged|Melee or Ranged)\s+Weapon Attack:\s*([+-]\d+)\s+to hit,?\s*([\s\S]*?)(?=\s*Hit:|$)/i);
  const hitMatch = description.match(/Hit:\s*(?:\d+\s*)?\(([^)]+)\)\s+([a-z]+)\s+damage\.?/i);
  const fallbackHitMatch = description.match(/Hit:\s*([^.]*)/i);
  const parsedDamage = parseWildShapeDamageFormula(hitMatch?.[1] || "");
  const damageType = hitMatch?.[2] || "";
  const consumed = [attackMatch?.[0], hitMatch?.[0], fallbackHitMatch && !hitMatch ? fallbackHitMatch[0] : ""].filter(Boolean);
  const notes = consumed.reduce((text, part) => text.replace(part, ""), description).trim();
  return {
    name: action.name || "Action",
    attackBonus: attackMatch?.[1] || "",
    reachRange: attackMatch?.[2]?.replace(/\.$/, "").trim() || "",
    damageDice: parsedDamage.dice,
    damageBonus: parsedDamage.bonus,
    damageFormula: parsedDamage.formula,
    damageType,
    damageTypeText: parsedDamage.formula && damageType ? `${parsedDamage.formula} ${damageType}` : (fallbackHitMatch?.[1]?.trim() || ""),
    notes: notes.replace(/\s+/g, " ").replace(/^\s*[,.]\s*/, ""),
    description,
    isAttack: Boolean(attackMatch || hitMatch),
  };
}

function wildShapeAttackActions(shape = {}) {
  return beastShapeActions(shape)
    .filter((action) => !/legendary|lair/i.test(action.name || ""))
    .map(parseWildShapeAttackAction);
}

function wildShapeActionSummary(action = {}) {
  return [
    action.attackBonus ? `${action.attackBonus} to hit` : "",
    action.damageTypeText,
    action.reachRange,
  ].filter(Boolean).join(" · ") || action.description || "No action details listed.";
}

function wildShapeOverlayForPlayer(player = {}, shape = {}, activeState = {}) {
  const abilities = Object.fromEntries(ABILITIES.map((ability) => [ability.key, wildShapeAbilityScore(player, shape, ability.key)]));
  return {
    source: "Wild Shape",
    beastId: shape.id,
    beastName: shape.name,
    sizeType: `${shape.size || "Unknown"} beast`,
    cr: shape.cr,
    armorClass: shape.ac,
    hitPointMaximum: shape.hp,
    currentHp: Number.isFinite(Number(activeState.currentHp)) ? Number(activeState.currentHp) : shape.hp,
    hitDice: wildShapeHitDice(shape),
    speed: wildShapeMovementSummary(shape),
    abilities,
    savingThrows: Object.fromEntries(ABILITIES.map((ability) => [ability.key, wildShapeSavingThrowBonus(player, shape, ability.key)])),
    skills: Object.fromEntries(SKILLS.map((skill) => [skill.key, wildShapeSkillBonus(player, shape, skill)])),
    senses: wildShapeSenses(shape),
    traits: beastShapeTraits(shape),
    actions: wildShapeAttackActions(shape),
    spellcastingDisabled: true,
    concentrationRetained: true,
    speechHandsLimited: true,
    equipmentMode: activeState.equipmentMode || "merged",
    excessDamagePending: Number(activeState.excessDamagePending) || 0,
  };
}

function wildShapeOriginalSnapshot(player = {}) {
  return {
    abilities: { ...(player.abilities || {}) },
    combat: { ...(player.combat || {}) },
    hitPointMaximum: player.combat?.hitPointMaximum || "",
    capturedAt: new Date().toISOString(),
  };
}

function applyWildShapeOverlay(player = {}, shape = {}) {
  if (!shape?.id) return player;
  const activeWildShape = {
    beastId: shape.id,
    beastName: shape.name,
    activatedAt: new Date().toISOString(),
    currentHp: shape.hp,
    maxHp: shape.hp,
    excessDamagePending: 0,
    equipmentMode: "merged",
  };
  return {
    ...player,
    activeWildShape,
    wildShapeOriginalSnapshot: player.wildShapeOriginalSnapshot || wildShapeOriginalSnapshot(player),
    wildShapeOverlay: wildShapeOverlayForPlayer(player, shape, activeWildShape),
  };
}

function revertWildShape(player = {}) {
  const { activeWildShape, wildShapeOriginalSnapshot: _snapshot, wildShapeOverlay, ...normalForm } = player;
  return normalForm;
}

function updateWildShapeHitPoints(player = {}, currentHp = 0) {
  if (!player.activeWildShape) return player;
  const numericHp = Number(currentHp);
  const excessDamagePending = Number.isFinite(numericHp) && numericHp < 0 ? Math.abs(numericHp) : 0;
  const activeWildShape = {
    ...player.activeWildShape,
    currentHp: Math.max(0, Number.isFinite(numericHp) ? numericHp : player.activeWildShape.currentHp || 0),
    excessDamagePending,
  };
  const shape = wildShapeBeastById(activeWildShape.beastId);
  return {
    ...player,
    activeWildShape,
    wildShapeOverlay: shape ? wildShapeOverlayForPlayer(player, shape, activeWildShape) : player.wildShapeOverlay,
  };
}

function useWildShape(player = {}) {
  const active = player.activeWildShape || null;
  const beast = active?.beastId ? wildShapeBeastById(active.beastId) : null;
  return {
    isDruid: isDruidCharacter(player),
    hasWildShapeAccess: characterHasWildShapeAccess(player),
    active,
    beast,
    overlay: active && beast ? wildShapeOverlayForPlayer(player, beast, active) : null,
    availableBeasts: wildShapeAvailableBeasts(player),
  };
}

function languageLabel(key) {
  return LANGUAGES.find((language) => language.key === key)?.label || key;
}

function toolLabel(key) {
  return TOOLS.find((tool) => tool.key === key)?.label || key;
}

function skillLabel(key) {
  return SKILLS.find((skill) => skill.key === key)?.label || key;
}

function normalizeRulesText(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueTextList(values = []) {
  const seen = new Set();
  return values.map((value) => String(value || "").trim()).filter((value) => {
    if (!value) return false;
    const key = normalizeRulesText(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function abilityKeyForLabel(value = "") {
  const normalized = normalizeRulesText(value);
  return ABILITIES.find((ability) => (
    normalizeRulesText(ability.key) === normalized
    || normalizeRulesText(ability.label) === normalized
    || normalizeRulesText(ability.short) === normalized
  ))?.key || "";
}

function abilityLabelForValue(value = "") {
  const key = abilityKeyForLabel(value);
  return ABILITIES.find((ability) => ability.key === key)?.label || String(value || "").trim();
}

function skillKeyForLabel(value = "") {
  const normalized = normalizeRulesText(value);
  return SKILLS.find((skill) => (
    normalizeRulesText(skill.key) === normalized
    || normalizeRulesText(skill.label) === normalized
  ))?.key || "";
}

function skillKeysForLabels(values = []) {
  return values.map(skillKeyForLabel).filter(Boolean);
}

function lineageKey(value = "") {
  return normalizeRulesText(value).replace(/[^a-z0-9]/g, "");
}

function lineagePackageForName(name = "") {
  const normalized = normalizeRulesText(name);
  if (!normalized) return null;
  const display = PLAYER_RACES.find((race) => normalizeRulesText(race) === normalized);
  if (!display) return null;
  const key = lineageKey(display);
  return {
    name: display,
    key,
    asi: LINEAGE_FIXED_ASI[key] || "choice",
    traits: lineageTraitNamesForRace(display),
    speed: lineageSpeed(display),
    languages: lineageLanguages(display),
    extraLanguages: lineageExtraLanguageLimit(display),
  };
}

function featDescriptionForName(name = "") {
  const value = String(name || "").trim();
  if (!value) return "";
  const exact = FEAT_DESCRIPTIONS[lineageKey(value)];
  if (exact) return exact;
  const baseName = value.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const base = FEAT_DESCRIPTIONS[lineageKey(baseName)];
  if (!base) return "";
  const option = value.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (lineageKey(baseName) === "magicinitiate" && option) {
    return `Learn two cantrips and one 1st-level ${option} spell, with limited free casting.`;
  }
  return base;
}

function lineageTraitDescription(trait = "") {
  const label = String(trait || "").trim();
  if (!label) return "";
  return LINEAGE_TRAIT_DESCRIPTIONS[lineageKey(label)] || `${label} is a lineage trait from your selected race. Add table-specific rules text here if your source uses a variant.`;
}

function lineageLanguages(race = "") {
  const value = normalizeRulesText(race);
  const fixed = ["common"];
  const add = (language) => { if (language) fixed.push(language); };
  if (value.includes("dragonborn") || value.includes("kobold") || value.includes("lizardfolk") || value.includes("viashino") || value.includes("yuan ti")) add("draconic");
  else if (value.includes("dwarf") || value.includes("duergar")) add("dwarvish");
  else if (value.includes("elf") || value.includes("eladrin") || value.includes("shadar kai") || value.includes("simic")) add("elvish");
  else if (value.includes("gith")) add("gith");
  else if (value.includes("gnome")) add("gnomish");
  else if (value.includes("goblin") || value.includes("hobgoblin") || value.includes("bugbear") || value.includes("verdan")) add("goblin");
  else if (value.includes("goliath") || value.includes("firbolg")) add("giant");
  else if (value.includes("halfling")) add("halfling");
  else if (value.includes("orc")) add("orc");
  else if (value.includes("tiefling")) add("infernal");
  else if (value.includes("aasimar")) add("celestial");
  else if (value.includes("fairy") || value.includes("satyr") || value.includes("centaur")) add("sylvan");
  else if (value.includes("genasi") || value.includes("triton")) add("primordial");
  else if (value.includes("plasmoid") || value.includes("thri kreen")) add("deepSpeech");
  return Array.from(new Set(fixed));
}

function lineageExtraLanguageLimit(race = "") {
  const value = normalizeRulesText(race);
  if (value.includes("human") || value.includes("half elf")) return 1;
  return 0;
}

function languageRulesForRace(race = "") {
  const lineage = lineagePackageForName(race);
  return { fixed: lineage?.languages || ["common"], extraLimit: lineage?.extraLanguages || 0 };
}

function derivedToolProficienciesForClass(classRole = "") {
  const info = classInfo(classRole);
  if (!info) return [];
  const tools = (info.fixedTools || []).map(toolLabel);
  if (info.toolChoices === "musical" && info.toolLimit) tools.push(`${info.toolLimit} musical instruments`);
  else if (info.toolChoices === "artisan" && info.toolLimit) tools.push(`${info.toolLimit} artisan's tools`);
  else if (info.toolChoices === "artisanOrMusical" && info.toolLimit) tools.push(`${info.toolLimit} artisan's tools or musical instrument`);
  return tools;
}

function derivedToolProficienciesForClassLevels(classLevels = []) {
  const [primary, ...additional] = classLevels;
  return uniqueTextList([
    ...derivedToolProficienciesForClass(primary?.className || ""),
    ...additional.flatMap((entry) => classInfo(entry.className)?.multiclassTools || []),
  ]);
}

function multiclassAdditionalProficiencyLines(classLevels = []) {
  return classLevels.slice(1).map((entry) => {
    const info = classInfo(entry.className);
    const proficiencies = info?.multiclassProficiencies || [];
    return `${entry.className}: ${proficiencies.length ? proficiencies.join(", ") : "Hit Point Die only"}`;
  });
}

function classFeatureProgressionLines(classLevels = []) {
  if (!isMulticlassClassLevelSet(classLevels)) return [];
  const entries = classLevels.map((entry) => `${entry.className} features through level ${entry.level}`);
  return [`Class features: ${entries.join("; ")}.`];
}

function extraAttackMulticlassLine(classLevels = []) {
  const classesWithExtraAttack = classLevels.filter((entry) => {
    const info = classInfo(entry.className);
    return info?.extraAttackLevel && Number(entry.level) >= info.extraAttackLevel;
  });
  if (classesWithExtraAttack.length <= 1) return "";
  return "Extra Attack: multiple Extra Attack features do not add together.";
}

function multiclassRulesFeatureText(classLevels = []) {
  if (!isMulticlassClassLevelSet(classLevels)) return "";
  const additionalProficiencies = multiclassAdditionalProficiencyLines(classLevels);
  const lines = [
    "Multiclassing (Character option)",
    `Class levels: ${classLevelSummary(classLevels)}.`,
    "Proficiency Bonus uses total character level.",
    `Hit Dice pool: ${classHitDiceFromClassLevels(classLevels)}.`,
    ...classFeatureProgressionLines(classLevels),
    additionalProficiencies.length ? `Additional class proficiencies: ${additionalProficiencies.join("; ")}.` : "",
    "Armor Class: if more than one feature gives a different AC calculation, choose one method; they do not combine.",
    extraAttackMulticlassLine(classLevels),
  ].filter(Boolean);
  return lines.join("\n");
}

function multiclassSkillChoiceLimit(classLevels = []) {
  return classLevels.slice(1).reduce((total, entry) => total + (Number(classInfo(entry.className)?.multiclassSkillLimit) || 0), 0);
}

function equipmentItems(equipment = "") {
  return String(equipment)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEquipmentText(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function weaponForEquipmentItem(item = "") {
  const normalized = ` ${normalizeEquipmentText(item)} `;
  return WEAPONS.find((weapon) => weapon.aliases.some((alias) => normalized.includes(` ${normalizeEquipmentText(alias)} `))) || null;
}

function homebrewItemForEquipmentItem(item = "") {
  const normalized = normalizeEquipmentText(item);
  if (!normalized) return null;
  return getStoredCollection("items").find((homebrewItem) => (
    normalizeEquipmentText(homebrewItem?.name) === normalized
  )) || null;
}

function homebrewItemStatistics(item) {
  return item?.statistics && typeof item.statistics === "object" && !Array.isArray(item.statistics)
    ? item.statistics
    : {};
}

function homebrewItemAnalysisText(item) {
  if (!item) return "";
  const stats = homebrewItemStatistics(item);
  return [
    item.name,
    item.type,
    item.description,
    stats.damage,
    stats.range,
    stats.attack,
    stats.attackBonus,
    stats.damageBonus,
    stats.bonus,
    weaponPropertiesText(stats.properties),
  ].filter(Boolean).join(" ");
}

function signedNumberFromText(value = "") {
  const text = String(value).trim();
  const match = text.match(/([+-]\s*\d+)/);
  if (match) return Number(match[1].replace(/\s+/g, ""));
  return /^\d+$/.test(text) ? Number(text) : 0;
}

function gpFromText(value = "") {
  const match = String(value || "").match(/(\d+)\s*GP\b/i);
  return match ? Number(match[1]) || 0 : 0;
}

function extractDamageText(value = "") {
  const text = String(value || "");
  const typePattern = DAMAGE_TYPES.join("|");
  const match = text.match(new RegExp(`(\\d+d\\d+(?:\\s*[+-]\\s*\\d+)?)(?:\\s*(?:points?\\s+of\\s+)?(${typePattern}))?`, "i"));
  if (!match) return "";
  const dice = match[1].replace(/\s+/g, "");
  return [dice, match[2]?.toLowerCase()].filter(Boolean).join(" ");
}

function damageDiceFromStats(stats = {}) {
  const dice = String(stats.damageDice || "").trim();
  if (dice) return dice;
  return String(stats.damage || "").match(/\d+d\d+(?:\s*[+-]\s*\d+)?/i)?.[0]?.replace(/\s+/g, "") || "";
}

function damageTypeFromStats(stats = {}) {
  const type = String(stats.damageType || "").trim().toLowerCase();
  if (type) return type;
  const typePattern = DAMAGE_TYPES.join("|");
  return String(stats.damage || "").match(new RegExp(`\\b(${typePattern})\\b`, "i"))?.[1]?.toLowerCase() || "";
}

function normalizeWeaponProperty(value = "") {
  const normalized = normalizeEquipmentText(value).replace(/\s+/g, "-");
  const option = WEAPON_PROPERTY_OPTIONS.find((property) => (
    property.key === normalized || normalizeEquipmentText(property.label).replace(/\s+/g, "-") === normalized
  ));
  return option?.key || "";
}

function weaponPropertyKeys(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "").split(/[,;]+/);
  return Array.from(new Set(values.map(normalizeWeaponProperty).filter(Boolean)));
}

function weaponPropertyLabels(value) {
  const keys = weaponPropertyKeys(value);
  return keys.map((key) => WEAPON_PROPERTY_OPTIONS.find((property) => property.key === key)?.label || key);
}

function weaponPropertyDetails(value, item = null) {
  const stats = homebrewItemStatistics(item);
  return weaponPropertyKeys(value).map((key) => {
    const property = WEAPON_PROPERTY_OPTIONS.find((option) => option.key === key);
    if (!property) return null;
    let detail = property.detail;
    if (key === "versatile") {
      const versatileDamage = String(stats.versatileDamage || "").trim();
      detail = versatileDamage
        ? `Can be used one-handed or two-handed. Two-handed damage: ${versatileDamage}.`
        : property.detail;
    }
    if ((key === "range" || key === "ammunition" || key === "thrown") && stats.range) {
      const rangeText = String(stats.range).trim().replace(/\.+$/, "");
      detail = `${detail} Range: ${rangeText}.`;
    }
    return { key, label: property.label, icon: property.icon, detail };
  }).filter(Boolean);
}

function weaponPropertiesText(value) {
  return weaponPropertyLabels(value).join(", ");
}

function weaponPropertyIconMarkup(property) {
  if (!property) return "";
  return `<button class="weapon-property-icon" type="button" data-property-info data-property-label="${escapeHtml(property.label)}" data-property-detail="${escapeHtml(property.detail)}" aria-label="${escapeHtml(`${property.label} property details`)}" title="${escapeHtml(property.label)}">${escapeHtml(property.icon || property.label.slice(0, 2).toUpperCase())}</button>`;
}

function weaponPropertyIconListMarkup(properties = []) {
  const icons = properties.map(weaponPropertyIconMarkup).join("");
  return icons ? `<div class="weapon-property-icons" aria-label="Weapon properties">${icons}</div>` : "";
}

function weaponModeKeys(stats = {}) {
  const properties = weaponPropertyKeys(stats.properties);
  if (properties.includes("ammunition") || properties.includes("range")) return ["ranged"];
  return ["melee"];
}

function weaponNeedsRange(stats = {}) {
  const properties = weaponPropertyKeys(stats.properties);
  return properties.some((property) => ["ammunition", "range", "thrown"].includes(property));
}

function weaponNeedsVersatileDamage(stats = {}) {
  return weaponPropertyKeys(stats.properties).includes("versatile");
}

function homebrewWeaponBaseDamageText(item) {
  const stats = homebrewItemStatistics(item);
  const dice = damageDiceFromStats(stats);
  const type = damageTypeFromStats(stats);
  if (dice) return [dice, type].filter(Boolean).join(" ");
  return String(stats.damage || extractDamageText(stats.damage || "") || "").trim();
}

function isHomebrewWeaponItem(item) {
  return String(item?.type || "").trim().toLowerCase() === "weapon";
}

function isHomebrewArmorItem(item) {
  const type = String(item?.type || "").trim().toLowerCase();
  return type === "armor" || type === "armour";
}

function homebrewWeaponMode(item) {
  const stats = homebrewItemStatistics(item);
  const properties = weaponPropertyKeys(stats.properties);
  if (properties.includes("finesse")) return "finesse";
  if (weaponModeKeys(stats)[0] === "ranged") return "ranged";
  return "melee";
}

function homebrewWeaponAbilityModifier(item, abilities = {}) {
  return weaponAbilityModifier({ mode: homebrewWeaponMode(item) }, abilities);
}

function homebrewMeleeAbility(item, abilities = {}) {
  const properties = weaponPropertyKeys(homebrewItemStatistics(item).properties);
  const strength = abilityModifier(abilities.strength);
  const dexterity = abilityModifier(abilities.dexterity);
  if (properties.includes("finesse") && dexterity > strength) {
    return { key: "dexterity", label: "Dexterity", modifier: dexterity };
  }
  return { key: "strength", label: "Strength", modifier: strength };
}

function homebrewWeaponAttackItemBonus(item) {
  const stats = homebrewItemStatistics(item);
  return signedNumberFromText(stats.attackBonus ?? stats.attack ?? stats.bonus);
}

function homebrewWeaponDamageItemBonus(item) {
  const stats = homebrewItemStatistics(item);
  return signedNumberFromText(stats.damageBonus ?? stats.bonus);
}

function homebrewWeaponAttackBonus(item, abilities = {}, level = 1) {
  const itemBonus = homebrewWeaponAttackItemBonus(item);
  return signedModifier(homebrewWeaponAbilityModifier(item, abilities) + proficiencyBonusForLevel(level || 1) + itemBonus);
}

function applyDamageModifiers(damage = "", abilityBonus = 0, itemBonus = 0) {
  const text = String(damage || "").trim();
  const totalBonus = (Number(abilityBonus) || 0) + (Number(itemBonus) || 0);
  if (!text || !totalBonus) return text;
  const match = text.match(/^(\d+d\d+)([+-]\d+)?(?:\s+(.+))?$/i);
  if (!match) return text;
  const existingBonus = Number(match[2] || 0);
  const nextBonus = existingBonus + totalBonus;
  return `${match[1]}${nextBonus ? signedModifier(nextBonus) : ""}${match[3] ? ` ${match[3]}` : ""}`;
}

function homebrewWeaponDamageText(item, abilities = {}) {
  const stats = homebrewItemStatistics(item);
  const properties = weaponPropertyKeys(stats.properties);
  const damage = homebrewWeaponBaseDamageText(item);
  const modifier = homebrewWeaponAbilityModifier(item, abilities);
  const itemBonus = homebrewWeaponDamageItemBonus(item);
  const versatileDamage = String(stats.versatileDamage || "").trim();
  if (damage && properties.includes("versatile") && versatileDamage) {
    const damageType = damageTypeFromStats(stats);
    const oneHandDamage = applyDamageModifiers(damageDiceFromStats(stats), modifier, itemBonus);
    const twoHandDamage = applyDamageModifiers(versatileDamage, modifier, itemBonus);
    return `${oneHandDamage} / ${twoHandDamage}${damageType ? ` ${damageType}` : ""}`;
  }
  if (damage) return applyDamageModifiers(damage, modifier, itemBonus);
  return String(item?.description || "Homebrew weapon").trim();
}

function homebrewWeaponModeText(item) {
  const mode = homebrewWeaponMode(item);
  if (mode === "finesse") return "Melee or Dexterity";
  return mode === "ranged" ? "Ranged" : "Melee";
}

function homebrewItemFeatureText(item) {
  if (!item?.name) return "";
  if (isHomebrewWeaponItem(item)) return "";
  const stats = homebrewItemStatistics(item);
  const lines = [`${item.name} (Homebrew item)`];
  [
    ["Type", item.type],
    ["Damage", stats.damage],
    ["Range", stats.range],
    ["Attack bonus", stats.attackBonus ?? stats.attack ?? stats.bonus],
    ["Damage bonus", stats.damageBonus ?? stats.bonus],
    ["Properties", weaponPropertiesText(stats.properties)],
  ].forEach(([label, value]) => {
    const text = String(value || "").trim();
    if (text) lines.push(`${label}: ${text}`);
  });
  itemFeatureList(item.features).forEach((feature) => {
    const title = feature.title || "Feature";
    lines.push(feature.description ? `${title}: ${feature.description}` : title);
  });
  const description = String(item.description || "").trim();
  if (description) lines.push(`Description: ${description}`);
  return lines.join("\n");
}

function appendUniqueTextBlock(value = "", block = "") {
  const current = String(value || "").trim();
  const next = String(block || "").trim();
  if (!next) return current;
  const nextTitle = normalizeEquipmentText(next.split(/\n+/)[0]);
  const hasTitle = String(current || "")
    .split(/\n+/)
    .some((line) => normalizeEquipmentText(line) === nextTitle);
  if (hasTitle) return current;
  return [current, next].filter(Boolean).join("\n");
}

function homebrewFeatureTextForEquipment(equipment = "") {
  return equipmentItems(equipment).reduce((text, item) => {
    const homebrewItem = homebrewItemForEquipmentItem(item);
    return appendUniqueTextBlock(text, homebrewItemFeatureText(homebrewItem));
  }, "");
}

function weaponAbilityModifier(weapon, abilities = {}) {
  const strength = abilityModifier(abilities.strength);
  const dexterity = abilityModifier(abilities.dexterity);
  if (weapon.mode === "ranged") return dexterity;
  if (weapon.mode === "finesse") return Math.max(strength, dexterity);
  return strength;
}

function weaponDamageText(weapon, modifier) {
  if (!weapon.damage) return weapon.type;
  const modifierText = modifier > 0 ? `+${modifier}` : modifier < 0 ? String(modifier) : "";
  return `${weapon.damage}${modifierText} ${weapon.type}`;
}

function derivedWeaponAttacks({ equipment, abilities, level }) {
  const seen = new Set();
  return equipmentItems(equipment).map((item) => {
    const homebrewItem = homebrewItemForEquipmentItem(item);
    if (homebrewItem) {
      const key = `homebrew:${homebrewItem.id || normalizeEquipmentText(homebrewItem.name)}`;
      if (!isHomebrewWeaponItem(homebrewItem) || seen.has(key)) return null;
      seen.add(key);
      return {
        name: homebrewItem.name,
        attackBonus: homebrewWeaponAttackBonus(homebrewItem, abilities, level),
        damageType: homebrewWeaponDamageText(homebrewItem, abilities),
        generatedFromEquipment: true,
        homebrew: true,
      };
    }
    const weapon = weaponForEquipmentItem(item);
    const key = `weapon:${weapon?.name}`;
    if (!weapon || seen.has(key)) return null;
    seen.add(key);
    const modifier = weaponAbilityModifier(weapon, abilities);
    return {
      name: weapon.name,
      attackBonus: signedModifier(modifier + proficiencyBonusForLevel(level || 1)),
      damageType: weaponDamageText(weapon, modifier),
      generatedFromEquipment: true,
    };
  }).filter(Boolean);
}

function equipmentWeaponSummaries(player = {}) {
  const seen = new Set();
  return equipmentItems(player.equipment).map((item) => {
    const homebrewItem = homebrewItemForEquipmentItem(item);
    if (homebrewItem) {
      const key = `homebrew:${homebrewItem.id || normalizeEquipmentText(homebrewItem.name)}`;
      if (!isHomebrewWeaponItem(homebrewItem) || seen.has(key)) return null;
      seen.add(key);
      return {
        item: homebrewItem.name,
        name: homebrewItem.name,
        mode: homebrewWeaponModeText(homebrewItem),
        attackBonus: homebrewWeaponAttackBonus(homebrewItem, player.abilities || {}, player.level || 1),
        damageType: homebrewWeaponDamageText(homebrewItem, player.abilities || {}),
        range: String(homebrewItemStatistics(homebrewItem).range || "").trim(),
        properties: weaponPropertyDetails(homebrewItemStatistics(homebrewItem).properties, homebrewItem),
        features: itemFeatureList(homebrewItem.features),
        homebrew: true,
      };
    }
    const weapon = weaponForEquipmentItem(item);
    const key = `weapon:${weapon?.name}`;
    if (!weapon || seen.has(key)) return null;
    seen.add(key);
    const modifier = weaponAbilityModifier(weapon, player.abilities || {});
    return {
      item,
      name: weapon.name,
      mode: weapon.mode === "finesse" ? "Melee or Dexterity" : weapon.mode,
      attackBonus: signedModifier(modifier + proficiencyBonusForLevel(player.level || 1)),
      damageType: weaponDamageText(weapon, modifier),
    };
  }).filter(Boolean);
}

function equipmentHomebrewItemSummaries(player = {}) {
  const seen = new Set();
  return equipmentItems(player.equipment).map((item) => {
    const homebrewItem = homebrewItemForEquipmentItem(item);
    if (!homebrewItem || isHomebrewWeaponItem(homebrewItem)) return null;
    const key = homebrewItem.id || normalizeEquipmentText(homebrewItem.name);
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      name: homebrewItem.name,
      type: homebrewItem.type || "Homebrew item",
      description: homebrewItem.description || "",
      features: itemFeatureList(homebrewItem.features),
    };
  }).filter(Boolean);
}

function featureBlocks(features = "") {
  const blocks = [];
  let current = null;
  const titlePattern = /\([^)]+\)$/;
  String(features)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (/^source\s*:/i.test(line)) return;
      const isTitle = titlePattern.test(line) || !current;
      if (isTitle) {
        if (current) blocks.push(current);
        current = { title: line, details: [] };
        return;
      }
      current.details.push(line);
    });
  if (current) blocks.push(current);
  return blocks;
}

function homebrewFeatureBlockTitlesForEquipment(equipment = "") {
  return new Set(equipmentItems(equipment).map((item) => {
    const homebrewItem = homebrewItemForEquipmentItem(item);
    return normalizeEquipmentText(homebrewItemFeatureText(homebrewItem).split(/\n+/)[0]);
  }).filter(Boolean));
}

function featureBlocksForPlayer(player = {}) {
  const hiddenTitles = homebrewFeatureBlockTitlesForEquipment(player.equipment);
  return featureBlocks(player.features).filter((block) => !hiddenTitles.has(normalizeEquipmentText(block.title)));
}

function backgroundFeatureBlockTitle(player = {}) {
  const background = backgroundPackageForName(player.background);
  return background?.originFeat ? normalizeEquipmentText(`${background.originFeat} (Feat)`) : "";
}

function featureBlocksForSectionWidget(player = {}) {
  return featureBlocksForPlayer(player);
}

function featureTextForPlayer(player = {}) {
  return featureBlocksForPlayer(player).map((block) => (
    [block.title, ...block.details].filter(Boolean).join("\n")
  )).join("\n");
}

function featureBlocksMarkup(features = "", blocksOverride = null) {
  const blocks = blocksOverride || featureBlocks(features);
  if (!blocks.length) return "";
  return `<div class="feature-widget-list">${blocks.map((block) => `
    <section class="feature-widget-card">
      <span class="feature-widget-icon" aria-hidden="true">${escapeHtml(featureIconText(block.title))}</span>
      <div>
        <strong>${escapeHtml(block.title)}</strong>
        ${block.details.length ? `<p>${escapeHtml(block.details.join("\n"))}</p>` : ""}
      </div>
    </section>`).join("")}</div>`;
}

function featureIconText(title = "") {
  const cleaned = String(title || "").replace(/\([^)]*\)/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : cleaned.slice(0, 2) || "FT").toUpperCase();
}

function equipmentWeaponCardsMarkup(player = {}) {
  const weapons = equipmentWeaponSummaries(player);
  if (!weapons.length) return "";
  return `<div class="equipment-weapon-list">${weapons.map((weapon) => `
    <article class="equipment-weapon-card">
      <span class="equipment-weapon-icon" aria-hidden="true">${escapeHtml(weapon.name.slice(0, 2).toUpperCase())}</span>
      <div>
        <strong>${escapeHtml(weapon.name)}</strong>
        <dl>
          <div><dt>Attack</dt><dd>${escapeHtml(weapon.attackBonus)}</dd></div>
          <div><dt>Damage</dt><dd>${escapeHtml(weapon.damageType)}</dd></div>
          <div><dt>Mode</dt><dd>${escapeHtml(weapon.mode)}</dd></div>
          ${weapon.range ? `<div><dt>Range</dt><dd>${escapeHtml(weapon.range)}</dd></div>` : ""}
        </dl>
        ${weapon.properties?.length ? `<div class="equipment-detail-row"><span>Properties</span>${weaponPropertyIconListMarkup(weapon.properties)}</div>` : ""}
        ${weapon.features?.length ? `<div class="equipment-detail-row"><span>Features</span>${weapon.features.map((feature) => `
          <article class="equipment-feature-card">
            <strong>${escapeHtml(feature.title || "Feature")}</strong>
            ${feature.description ? `<p>${escapeHtml(feature.description)}</p>` : ""}
          </article>`).join("")}</div>` : ""}
      </div>
    </article>`).join("")}</div>`;
}

function equipmentHomebrewCardsMarkup(player = {}) {
  const items = equipmentHomebrewItemSummaries(player);
  if (!items.length) return "";
  return `<div class="equipment-homebrew-list">${items.map((item) => `
    <article class="equipment-homebrew-card">
      <div class="card-kicker"><span>${escapeHtml(item.type)}</span></div>
      <strong>${escapeHtml(item.name)}</strong>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
      ${item.features.length ? `<div class="equipment-detail-row"><span>Features</span>${item.features.map((feature) => `
        <article class="equipment-feature-card">
          <strong>${escapeHtml(feature.title || "Feature")}</strong>
          ${feature.description ? `<p>${escapeHtml(feature.description)}</p>` : ""}
        </article>`).join("")}</div>` : ""}
    </article>`).join("")}</div>`;
}

function hitDieSides(classRole = "") {
  return hitDieSidesForClassName(classRole);
}

function classHitDice(level, classRole = "") {
  return `${Math.max(1, Number(level) || 1)}d${hitDieSides(classRole)}`;
}

function lineageSpeed(race = "") {
  const value = normalizeRulesText(race);
  if (value.includes("wood elf")) return 35;
  if (value.includes("aarakocra") || value.includes("satyr") || value.includes("dhampir") || value.includes("firbolg") || value.includes("harengon") || value.includes("khenra") || value.includes("leonin")) return 35;
  if (value.includes("centaur")) return 40;
  if (value.includes("dwarf") || value.includes("gnome") || value.includes("halfling") || value.includes("grung") || value.includes("siren")) return 25;
  return 30;
}

function raceSpeed(race = "") {
  return lineagePackageForName(race)?.speed || lineageSpeed(race);
}

function lineageTraitNamesForRace(race = "") {
  const value = normalizeRulesText(race);
  const isHalfElf = /\bhalf elf\b/.test(value);
  const traits = [];
  const add = (...items) => items.forEach((item) => { if (item) traits.push(item); });
  if (/elf|eladrin|shadar kai|fairy|firbolg|satyr|centaur|hobgoblin|goblin|bugbear/.test(value)) add("Fey Ancestry");
  if (/dwarf|elf|gnome|tiefling|aasimar|kobold|orc|half orc|bugbear|goblin|hobgoblin|leonin|shifter|tabaxi|yuan ti|plasmoid|thri kreen|dhampir|hexblood|deep gnome/.test(value)) add("Darkvision");
  if (/duergar|deep gnome|gith|kalashtar|vedalken|yuan ti|satyr/.test(value)) add("Mental or magical resilience");
  if (/aarakocra|fairy|owlin|owlfolk|aven|siren/.test(value)) add("Flight");
  if (/genasi/.test(value)) add("Elemental legacy", "Elemental resistance");
  if (/dragonborn/.test(value)) add("Draconic Ancestry", "Breath Weapon", "Damage Resistance");
  if (/tiefling/.test(value)) add("Hellish Resistance", "Infernal Legacy");
  if (/dwarf|duergar/.test(value)) add("Dwarven Resilience", "Stonecunning");
  if (!isHalfElf && /elf|eladrin|sea elf|shadar kai|astral elf/.test(value)) add("Trance", "Keen Senses");
  if (/gnome/.test(value)) add("Gnome Cunning");
  if (/halfling/.test(value)) add("Lucky", "Brave", "Halfling Nimbleness");
  if (/half elf/.test(value)) add("Skill Versatility");
  if (/half orc|orc/.test(value)) add("Relentless Endurance", "Powerful Build");
  if (/human/.test(value)) add("Resourceful", "Skillful", "Versatile");
  if (/changeling/.test(value)) add("Shapechanger", "Changeling Instincts");
  if (/warforged|autognome|glitchling/.test(value)) add("Constructed Resilience", "Sentry's Rest", "Integrated Protection");
  if (/dhampir/.test(value)) add("Deathless Nature", "Spider Climb", "Vampiric Bite");
  if (/hexblood/.test(value)) add("Eerie Token", "Hex Magic");
  if (/reborn|revenant/.test(value)) add("Deathless Nature", "Knowledge from a Past Life");
  if (/goliath/.test(value)) add("Stone's Endurance", "Mountain Born", "Powerful Build");
  if (/lizardfolk|tortle|loxodon|locathah/.test(value)) add("Natural Armor");
  if (/triton|locathah|grung|merfolk|genasi water/.test(value)) add("Amphibious", "Swim");
  if (/giff/.test(value)) add("Hippo Build", "Firearms Mastery", "Astral Spark");
  if (/hadozee/.test(value)) add("Dexterous Feet", "Glide", "Hadozee Dodge");
  if (/kenku/.test(value)) add("Kenku Recall", "Mimicry");
  if (/harengon|rabbitfolk/.test(value)) add("Hare-Trigger", "Leporine Senses", "Lucky Footwork", "Rabbit Hop");
  if (/tabaxi/.test(value)) add("Feline Agility", "Cat's Claws", "Cat's Talent");
  if (/minotaur/.test(value)) add("Horns", "Goring Rush", "Hammering Horns");
  if (/plasmoid/.test(value)) add("Amorphous", "Shape Self");
  if (/thri kreen/.test(value)) add("Chameleon Carapace", "Secondary Arms", "Sleepless", "Telepathy");
  if (/kender/.test(value)) add("Fearless", "Kender Aptitude", "Taunt");
  if (/kalashtar/.test(value)) add("Dual Mind", "Mind Link", "Severed from Dreams");
  if (/custom/.test(value)) add("Feat", "Variable Trait");
  if (!traits.length) add("Lineage Traits");
  return Array.from(new Set(traits));
}

const ARMOR_FORMULAS = [
  { match: "studded leather", base: 12, dex: "full" },
  { match: "leather", base: 11, dex: "full" },
  { match: "padded", base: 11, dex: "full" },
  { match: "half plate", base: 15, dex: "max2" },
  { match: "breastplate", base: 14, dex: "max2" },
  { match: "scale mail", base: 14, dex: "max2" },
  { match: "chain shirt", base: 13, dex: "max2" },
  { match: "hide", base: 12, dex: "max2" },
  { match: "plate", base: 18, dex: "none" },
  { match: "splint", base: 17, dex: "none" },
  { match: "chain mail", base: 16, dex: "none" },
  { match: "ring mail", base: 14, dex: "none" },
];

function dexRuleFromArmorText(text = "") {
  const value = String(text || "").toLowerCase();
  if (/\b(no|without)\s+dex(?:terity)?\b|\bdex(?:terity)?\s+(?:modifier\s+)?(?:does not apply|not applied|none)\b/.test(value)) return "none";
  if (/\bmax(?:imum)?\s*(?:of\s*)?\+?2\b|\bdex(?:terity)?[^.]{0,24}(?:max|maximum)\s*(?:of\s*)?\+?2\b/.test(value)) return "max2";
  if (/\+\s*(?:your\s+)?dex(?:terity)?|\bdexterity modifier\b|\bdex modifier\b/.test(value)) return "full";
  return "full";
}

function homebrewArmorFormula(item) {
  if (!isHomebrewArmorItem(item)) return null;
  const text = homebrewItemAnalysisText(item);
  const lowerText = text.toLowerCase();
  const builtin = ARMOR_FORMULAS.find((armor) => lowerText.includes(armor.match));
  const baseMatch = text.match(/(?:base\s*)?(?:ac|armor class|armour class)(?:\s*(?:is|=|of|equals?))?\s*(\d{1,2})/i)
    || text.match(/\b(\d{1,2})\s*\+\s*(?:your\s+)?dex(?:terity)?(?:\s+modifier)?/i);
  const bonus = signedNumberFromText(text.match(/([+-]\s*\d+)\s+(?:bonus\s+)?to\s+(?:ac|armor class|armour class)/i)?.[0] || "");
  if (builtin) return { ...builtin, bonus, homebrew: true };
  if (baseMatch) return {
    base: Number(baseMatch[1]),
    dex: dexRuleFromArmorText(text),
    bonus,
    homebrew: true,
  };
  if (/\bshield\b/i.test(text)) return { base: 10, dex: "full", bonus, shield: true, homebrew: true };
  if (bonus) return { base: 10, dex: "full", bonus, homebrew: true };
  return null;
}

function homebrewArmorFormulasFromEquipment(equipment = "") {
  return equipmentItems(equipment)
    .map((item) => homebrewItemForEquipmentItem(item))
    .filter(Boolean)
    .map(homebrewArmorFormula)
    .filter(Boolean);
}

function armorFormulaFromEquipment(equipment = "") {
  const text = String(equipment).toLowerCase();
  const builtin = ARMOR_FORMULAS.find((armor) => text.includes(armor.match));
  const homebrewArmors = homebrewArmorFormulasFromEquipment(equipment).filter((armor) => armor.base && !armor.shield);
  const strongestHomebrew = homebrewArmors.sort((a, b) => (b.base || 10) - (a.base || 10))[0];
  return strongestHomebrew || builtin || { base: 10, dex: "full" };
}

function homebrewArmorClassBonusFromEquipment(equipment = "", selectedArmor = {}) {
  return homebrewArmorFormulasFromEquipment(equipment).reduce((total, armor) => {
    if (armor.shield) return total + (armor.bonus || 0);
    if (armor.homebrew && armor.base === selectedArmor.base && armor.dex === selectedArmor.dex) return total + (armor.bonus || 0);
    if (!armor.base || armor.base === 10) return total + (armor.bonus || 0);
    return total;
  }, 0);
}

function armorClassFromEquipment(dexterityScore, equipment = "", classRole = "", abilities = {}, classLevels = []) {
  const dexMod = abilityModifier(dexterityScore);
  const armor = armorFormulaFromEquipment(equipment);
  const shieldBonus = /\bshield\b/i.test(String(equipment)) ? 2 : 0;
  const homebrewArmorBonus = homebrewArmorClassBonusFromEquipment(equipment, armor);
  const hasArmor = armor.base !== 10;
  if (!hasArmor) {
    const normalizedClass = String(classRole).toLowerCase();
    const classes = classLevels.length ? classLevels : classLevelEntriesFromParts([{ className: classRole, level: 1 }]);
    const hasBarbarian = normalizedClass === "barbarian" || classes.some((entry) => normalizeRulesText(entry.className) === "barbarian");
    const hasMonk = normalizedClass === "monk" || classes.some((entry) => normalizeRulesText(entry.className) === "monk");
    const armorClassOptions = [10 + dexMod + shieldBonus + homebrewArmorBonus];
    if (hasBarbarian) armorClassOptions.push(10 + dexMod + abilityModifier(abilities.constitution) + shieldBonus + homebrewArmorBonus);
    if (hasMonk && !shieldBonus) armorClassOptions.push(10 + dexMod + abilityModifier(abilities.wisdom) + homebrewArmorBonus);
    return Math.max(...armorClassOptions);
  }
  const dexBonus = armor.dex === "none" ? 0 : armor.dex === "max2" ? Math.min(dexMod, 2) : dexMod;
  return armor.base + dexBonus + shieldBonus + homebrewArmorBonus;
}

function fixedHitPointsForClassLevels(classLevels = [], constitutionScore = "") {
  const conMod = abilityModifier(constitutionScore);
  const entries = classLevels.filter((entry) => entry.className && Number(entry.level) > 0);
  if (!entries.length) return Math.max(1, 8 + conMod);
  return entries.reduce((total, entry, index) => {
    const sides = hitDieSidesForClassName(entry.className);
    const level = Math.max(1, Number(entry.level) || 1);
    const firstLevelHitPoints = index === 0 ? Math.max(1, sides + conMod) : 0;
    const higherLevelCount = index === 0 ? level - 1 : level;
    const higherLevelHitPoints = Array.from({ length: higherLevelCount }, () => Math.max(1, Math.floor(sides / 2) + 1 + conMod))
      .reduce((subtotal, value) => subtotal + value, 0);
    return total + firstLevelHitPoints + higherLevelHitPoints;
  }, 0);
}

function derivedCombatStats({ level, classRole, race, abilities, equipment, hitPointMaximum, classLevels = [] }) {
  const dexMod = abilityModifier(abilities?.dexterity);
  const levels = classLevels.length ? classLevels : classLevelEntriesFromParts([{ className: classRole, level: level || 1 }]);
  const fixedHitPoints = fixedHitPointsForClassLevels(levels, abilities?.constitution);
  const savedHitPoints = Number(hitPointMaximum);
  const hitPoints = Number.isFinite(savedHitPoints) && savedHitPoints > 0 ? savedHitPoints : fixedHitPoints;
  return {
    armorClass: armorClassFromEquipment(abilities?.dexterity, equipment, classRole, abilities, levels),
    initiative: dexMod + (bardLevelForClassLevels(levels) >= 2 ? Math.floor(proficiencyBonusForLevel(level) / 2) : 0),
    speed: raceSpeed(race),
    hitPointMaximum: hitPoints,
    currentHitPoints: hitPoints,
    temporaryHitPoints: "",
    hitDice: classHitDiceFromClassLevels(levels),
  };
}

function datalistMarkup(id, options) {
  return `<datalist id="${escapeHtml(id)}">${options.map((option) => `<option value="${escapeHtml(option)}"></option>`).join("")}</datalist>`;
}

function equipmentOptionNames() {
  const builtinWeapons = WEAPONS.map((weapon) => weapon.name);
  const homebrewItems = getStoredCollection("items")
    .map((item) => String(item?.name || "").trim())
    .filter(Boolean);
  return Array.from(new Set([...builtinWeapons, ...homebrewItems])).sort((a, b) => a.localeCompare(b));
}

function checkboxMarkup(name, options, selected = []) {
  const selectedSet = new Set(selected);
  return options.map((option) => `
    <label class="checkbox-row">
      <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(option.key)}" ${selectedSet.has(option.key) ? "checked" : ""} />
      <span>${escapeHtml(option.label)}${option.ability ? ` <small>(${escapeHtml(option.ability.slice(0, 3).toUpperCase())})</small>` : ""}</span>
    </label>`).join("");
}

function buildPlayerCharacter(form) {
  const playerName = formValue(form, "#player-name");
  const characterName = formValue(form, "#player-character-name");
  const classLevels = classLevelEntriesFromForm(form);
  const multiclassEnabled = checkedFormValue(form, "#player-multiclass-enabled") && isMulticlassClassLevelSet(classLevels);
  const level = multiclassEnabled ? totalLevelForClassLevels(classLevels) : numberFormValue(form, "#player-level");
  const classRole = multiclassEnabled ? classRoleSummary(classLevels, formValue(form, "#player-class-role")) : formValue(form, "#player-class-role");
  const subclasses = classSubclassMapFromForm(form, classLevels);
  const baseAbilities = Object.fromEntries(ABILITIES.map((ability) => [ability.key, numberFormValue(form, `#player-${ability.key}`)]));
  const lineageAbilityBonuses = lineageAbilityBonusesFromForm(form);
  const backgroundAbilityBonuses = backgroundAbilityBonusesFromForm(form);
  const abilities = applyBackgroundBonusesToScores(baseAbilities, combineAbilityBonuses(lineageAbilityBonuses, backgroundAbilityBonuses));
  const proficiencyBonus = proficiencyBonusForLevel(level || 1);
  const backgroundSkillProficiencies = splitListInput(formValue(form, "#player-background-skills"));
  const baseSkillProficiencies = uniqueTextList([
    ...checkedFormValues(form, "player-skill-proficiencies"),
    ...backgroundSkillProficiencies,
  ]);
  const classChoices = classChoicesFromForm(form, classLevels);
  const skillProficiencies = selectedSkillProficienciesWithBardChoices(baseSkillProficiencies, classChoices.Bard || {});
  const passivePerception = numberFormValue(form, "#player-passive-perception") || (10 + abilityModifier(abilities.wisdom) + (skillProficiencies.includes("perception") ? proficiencyBonus : 0));
  const race = formValue(form, "#player-race");
  const equipment = formValue(form, "#player-equipment");
  const hitPointMaximum = numberFormValue(form, "#player-hp-max");
  const equipmentAttacks = derivedWeaponAttacks({ equipment, abilities, level });
  const manualAttacks = [1, 2, 3].map((index) => ({
    name: formValue(form, `#player-attack-${index}-name`),
    attackBonus: formValue(form, `#player-attack-${index}-bonus`),
    damageType: formValue(form, `#player-attack-${index}-damage`),
  })).filter((attack) => attack.name || attack.attackBonus || attack.damageType);
  const combat = {
    ...derivedCombatStats({
      level,
      classRole,
      race,
      abilities,
      equipment,
      hitPointMaximum,
      classLevels,
    }),
    hitPointsRolled: Boolean(hitPointMaximum),
    passivePerception,
  };
  const features = appendUniqueTextBlock(
    appendUniqueTextBlock(
      appendUniqueTextBlock(formValue(form, "#player-features"), formValue(form, "#player-lineage-traits")),
      multiclassRulesFeatureText(classLevels)
    ),
    homebrewFeatureTextForEquipment(equipment)
  );
  const spellcasting = buildSpellcastingFromForm(form, classLevels, abilities, { subclasses, classChoices });
  const bardPlayerContext = { level, classLevels, subclasses, classChoices };
  return {
    id: createId("player"),
    campaignId: DEFAULT_CAMPAIGN_ID,
    playerName,
    characterName,
    classRole,
    classLevels,
    subclasses,
    classChoices,
    level,
    race,
    background: formValue(form, "#player-background"),
    alignment: formValue(form, "#player-alignment"),
    experience: numberFormValue(form, "#player-experience"),
    abilities,
    baseAbilities,
    lineageAbilityBonuses,
    backgroundAbilityBonuses,
    proficiencyBonus,
    savingThrowProficiencies: checkedFormValues(form, "player-saving-throws"),
    skillProficiencies,
    languages: checkedFormValues(form, "player-languages"),
    toolProficiencies: uniqueTextList([
      ...derivedToolProficienciesForClassLevels(classLevels),
      ...splitListInput(formValue(form, "#player-tool-proficiencies")),
    ]),
    armorTraining: bardArmorTrainingForPlayer(bardPlayerContext),
    weaponProficiencies: bardWeaponProficienciesForPlayer(bardPlayerContext),
    combat,
    attacks: [...equipmentAttacks, ...manualAttacks],
    spellcasting,
    personality: {
      traits: formValue(form, "#player-personality-traits"),
      ideals: formValue(form, "#player-ideals"),
      bonds: formValue(form, "#player-bonds"),
      flaws: formValue(form, "#player-flaws"),
    },
    equipment,
    gold: numberFormValue(form, "#player-gold"),
    features,
    description: formValue(form, "#player-description"),
    notes: formValue(form, "#player-notes"),
    avatarUrl: "",
    createdAt: readableDate(),
    updatedAt: readableDate(),
  };
}

function playerFormHasData(form) {
  return Array.from(form.querySelectorAll?.("input, textarea") || [])
    .some((field) => field.type !== "hidden" && (field.type === "checkbox" ? field.checked : String(field.value || "").trim()));
}

function validatePlayerCharacter(player, requireData = true) {
  const errors = [];
  if (!requireData && !player.playerName && !player.characterName && !player.classRole && !player.level && !player.race && !player.background && !player.description && !player.notes) return errors;
  if (!player.playerName) errors.push("Player name is required.");
  if (!player.characterName) errors.push("Character name is required.");
  if (player.level !== "" && (!Number.isFinite(player.level) || player.level < 1)) errors.push("Level must be a number greater than 0.");
  const classLevels = classLevelEntriesForPlayer(player);
  if (isMulticlassClassLevelSet(classLevels)) {
    if (totalLevelForClassLevels(classLevels) > 20) errors.push("Multiclass total level cannot exceed 20.");
    const failedPrerequisites = multiclassPrerequisiteFailures(classLevels, player.abilities || {});
    if (failedPrerequisites.length) errors.push(`Multiclass prerequisites not met: ${failedPrerequisites.join("; ")}.`);
  }
  const subclassError = bardSubclassValidationError(classLevels, player.subclasses || {});
  if (subclassError) errors.push(subclassError);
  errors.push(...bardChoiceValidationErrors(player));
  if (player.spellcasting?.spells?.length) {
    errors.push(...spellSelectionErrors(player.spellcasting.spells, classLevels, player.abilities || {}, player));
  }
  return errors;
}

function multiclassPrerequisiteFailures(classLevels = [], abilities = {}) {
  return classLevels.map((entry) => {
    const info = classInfo(entry.className);
    const failedGroups = (info?.prerequisites || []).filter((group) => (
      !group.some((abilityKey) => Number(abilities[abilityKey]) >= 13)
    ));
    if (!failedGroups.length) return "";
    return `${entry.className} requires ${failedGroups.map(prerequisiteGroupLabel).join(" and ")}`;
  }).filter(Boolean);
}

function prerequisiteGroupLabel(group = []) {
  return `${group.map((abilityKey) => ABILITIES.find((ability) => ability.key === abilityKey)?.label || abilityKey).join(" or ")} 13`;
}

function savePlayerToCampaign(campaignId, player) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  const savedPlayer = {
    ...player,
    campaignId,
    avatarUrl: player.avatarUrl || player.imageDataUrl || "",
  };
  return upsertCampaign({ ...campaign, players: [...campaign.players, savedPlayer] });
}

function deletePlayerFromCampaign(campaignId, playerId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  return upsertCampaign({ ...campaign, players: campaign.players.filter((player) => player.id !== playerId) });
}

function updatePlayerInCampaign(campaignId, playerId, transform) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  let updatedPlayer = null;
  const players = (campaign.players || []).map((player) => {
    if (player.id !== playerId) return player;
    updatedPlayer = typeof transform === "function" ? transform(player) : player;
    return updatedPlayer;
  });
  if (!updatedPlayer) return null;
  const nextCampaign = upsertCampaign({ ...campaign, players });
  return { campaign: nextCampaign, player: updatedPlayer };
}

function updatePlayerImage(campaignId, playerId, image) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  const nextImageFields = imageFields(image);
  return upsertCampaign({
    ...campaign,
    players: campaign.players.map((player) => (
      player.id === playerId
        ? { ...player, ...nextImageFields, avatarUrl: nextImageFields.imageUrl || "" }
        : player
    )),
  });
}

function campaignStartContent(description = "") {
  return description.trim() || "The campaign has started.";
}

function getCampaignStartNote(campaign) {
  const notes = getStoredCollection("notes", campaign.id);
  const existingId = campaign.campaignStartNoteId;
  return notes.find((note) => note.id === existingId || (note.campaignId === campaign.id && note.generatedBy === "campaign-setup-start"));
}

function campaignReady(campaign) {
  return Boolean(campaign?.setupCompleted && getCampaignStartNote(campaign)?.campaignStartDate);
}

function saveCampaignStartNote(campaign, noteData = {}) {
  const notes = getStoredCollection("notes", campaign.id);
  const existing = getCampaignStartNote(campaign);
  const startDate = noteData.startDate || currentIsoDate();
  const title = noteData.title?.trim() || campaign.name;
  const description = noteData.description?.trim() || "";
  const note = {
    ...(existing || {}),
    id: existing?.id || createId("note"),
    campaignId: campaign.id,
    generatedBy: "campaign-setup-start",
    title,
    category: "Session Note",
    content: campaignStartContent(description),
    campaignStartDate: startDate,
    createdAt: readableDateFromIso(startDate),
    sortAt: Date.parse(`${startDate}T00:00:00`),
  };
  const nextNotes = existing
    ? notes.map((item) => item.id === existing.id ? note : item)
    : [...notes, note];
  saveCollection("notes", nextNotes, campaign.id);
  return { notes: nextNotes, noteId: note.id };
}

function completeCampaignSetup(campaignId, noteData = {}) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  const campaignName = noteData.title?.trim() || campaign.name;
  const campaignDescription = noteData.description?.trim() || campaign.description;
  const nextCampaign = { ...campaign, name: campaignName, description: campaignDescription };
  const { noteId } = saveCampaignStartNote(nextCampaign, noteData);
  return upsertCampaign({ ...nextCampaign, setupCompleted: true, campaignStartNoteId: noteId });
}

function campaignSetupHref(campaignId) {
  return `index.html#/campaigns/${encodeURIComponent(campaignId)}/setup`;
}

function campaignStartNoteHref(campaignId) {
  return `index.html#/campaigns/${encodeURIComponent(campaignId)}/start-note`;
}

function playerCharacterHref(campaignId, playerId) {
  return `index.html#/campaigns/${encodeURIComponent(campaignId)}/players/${encodeURIComponent(playerId)}`;
}

function playerSpellbookHref(campaignId, playerId) {
  return `index.html#/campaigns/${encodeURIComponent(campaignId)}/players/${encodeURIComponent(playerId)}/spells`;
}

function playerLevelUpHref(campaignId, playerId) {
  return `index.html#/campaigns/${encodeURIComponent(campaignId)}/players/${encodeURIComponent(playerId)}/level-up`;
}

function campaignLibraryHref() {
  return "index.html";
}

function dashboardHref(campaignId = getActiveCampaignId()) {
  return `index.html#/campaigns/${encodeURIComponent(campaignId)}/dashboard`;
}

function combatHref() {
  return "index.html#/combat";
}

function detailNumberFromText(value = "", patterns = []) {
  const text = String(value || "");
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return "";
}

function monsterStatisticNumber(item = {}, keys = [], patterns = []) {
  const stats = item.statistics || {};
  for (const key of keys) {
    const value = numberOrBlank(stats[key] ?? item[key]);
    if (value !== "") return value;
  }
  return detailNumberFromText([item.description, stats.description, stats.notes].filter(Boolean).join(" "), patterns);
}

function repeatedCombatantName(encounter = {}, baseName = "", type = "monster", entityId = "") {
  const name = String(baseName || "Combatant").trim();
  if (type !== "monster") return name;
  const normalizedName = normalizeRulesText(name);
  const count = (encounter.combatants || []).filter((combatant) => (
    (entityId && combatant.entityId === entityId) || normalizeRulesText(combatant.name).replace(/\s+\d+$/, "") === normalizedName
  )).length;
  return `${name} ${count + 1}`;
}

function combatantFromPlayer(player = {}, campaignId = DEFAULT_CAMPAIGN_ID, encounter = getCombatEncounter()) {
  const combat = player.combat || {};
  const name = playerDisplayName(player);
  const maxHp = numberOrBlank(combat.hitPointMaximum);
  return normalizeCombatant({
    id: createId("combatant-player"),
    entityId: player.id,
    type: "player",
    name,
    avatarUrl: combatantAvatarUrl({ ...player, imageUrl: player.avatarUrl, imageDataUrl: player.avatarUrl }),
    armorClass: armorClassForPlayer(player),
    currentHp: numberOrBlank(combat.currentHitPoints) || maxHp,
    maxHp,
    initiativeModifier: initiativeBonusForPlayer(player),
    status: "active",
    conditions: [],
    detailRoute: playerCharacterHref(campaignId, player.id),
    sourceLabel: player.playerName || "Player character",
  }, encounter.combatants?.length || 0);
}

function combatantFromNpc(npc = {}, encounter = getCombatEncounter()) {
  const name = firstDisplayText([npc.name, npc.title], "NPC");
  const ac = numberOrBlank(npc.armorClass ?? npc.ac) || detailNumberFromText(npc.notes, [/\bAC\s*(\d+)/i, /\barmor class\s*(\d+)/i]);
  const maxHp = numberOrBlank(npc.maxHp ?? npc.hp ?? npc.hitPoints) || detailNumberFromText(npc.notes, [/\bHP\s*(\d+)/i, /\bhit points?\s*(\d+)/i]);
  return normalizeCombatant({
    id: createId("combatant-npc"),
    entityId: npc.id,
    type: "npc",
    name,
    avatarUrl: combatantAvatarUrl(npc),
    armorClass: ac,
    currentHp: numberOrBlank(npc.currentHp) || maxHp,
    maxHp,
    initiativeModifier: numberOrBlank(npc.initiativeModifier) || 0,
    status: "active",
    conditions: [],
    sourceLabel: npc.role || npc.faction || "NPC",
  }, encounter.combatants?.length || 0);
}

function combatantFromMonster(item = {}, encounter = getCombatEncounter()) {
  const stats = item.statistics || {};
  const baseName = firstDisplayText([item.name], "Monster");
  const name = repeatedCombatantName(encounter, baseName, "monster", item.id);
  const ac = monsterStatisticNumber(item, ["armorClass", "ac"], [/\bAC\s*(\d+)/i, /\barmor class\s*(\d+)/i]);
  const maxHp = monsterStatisticNumber(item, ["maxHp", "hp", "hitPoints"], [/\bHP\s*(\d+)/i, /\bhit points?\s*(\d+)/i]);
  const dexterity = numberOrBlank(stats.dexterity ?? item.dexterity);
  return normalizeCombatant({
    id: createId("combatant-monster"),
    entityId: item.id,
    type: "monster",
    name,
    avatarUrl: combatantAvatarUrl(item),
    armorClass: ac,
    currentHp: maxHp,
    maxHp,
    initiativeModifier: numberOrBlank(stats.initiativeModifier ?? item.initiativeModifier) || abilityModifier(dexterity),
    status: "active",
    conditions: [],
    sourceLabel: item.type || "Monster",
  }, encounter.combatants?.length || 0);
}

function combatantSources() {
  const campaign = currentCampaign();
  return {
    players: (campaign.players || []).map((player) => ({
      id: player.id,
      label: playerDisplayName(player),
      sublabel: [player.classRole, player.level ? `Level ${player.level}` : ""].filter(Boolean).join(" · "),
      type: "player",
      combatant: combatantFromPlayer(player, campaign.id, getCombatEncounter()),
    })),
    npcs: getStoredCollection("characters").map((npc) => ({
      id: npc.id,
      label: firstDisplayText([npc.name], "NPC"),
      sublabel: [npc.role, npc.faction].filter(Boolean).join(" · "),
      type: "npc",
      combatant: combatantFromNpc(npc, getCombatEncounter()),
    })),
    monsters: getStoredCollection("items")
      .filter((item) => String(item?.type || "").trim().toLowerCase() === "monster")
      .map((monster) => ({
        id: monster.id,
        label: firstDisplayText([monster.name], "Monster"),
        sublabel: monster.description || "Homebrew monster",
        type: "monster",
        combatant: combatantFromMonster(monster, getCombatEncounter()),
      })),
  };
}

function updateTopNavActivePage(page) {
  const nav = document.querySelector(".topnav");
  if (!nav) return;
  const normalizedPage = page || document.body?.dataset?.page || "dashboard";
  const activeHrefByPage = {
    dashboard: "index.html",
    media: "index.html#/media",
    maps: "index.html#/maps",
    combat: "index.html#/combat",
    comics: "index.html#/comics",
    items: "items.html",
    spells: "spells.html",
    "beast-shapes": "beast-shapes.html",
    calendar: "calendar.html",
    about: "about.html",
  };
  nav.querySelectorAll("a").forEach((link) => {
    const isActive = link.getAttribute("href") === activeHrefByPage[normalizedPage];
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (document.body?.dataset) document.body.dataset.page = normalizedPage;
}

function goToDashboard() {
  window.location.href = dashboardHref();
  window.location.reload();
}

function routeParts() {
  const hashPath = window.location.hash && window.location.hash.startsWith("#/")
    ? window.location.hash.slice(1)
    : "";
  const routePath = hashPath || window.location.pathname;
  return routePath.split("/").filter(Boolean).map(decodeURIComponent);
}

function storageIdSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeUserCollectionEntry(key, entry, index = 0) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const id = String(entry.id || "").trim();
  if (id.startsWith("demo-")) return null;
  if (id) return { ...entry, id, campaignId: String(entry.campaignId || DEFAULT_CAMPAIGN_ID) };

  const identity = [
    entry.name,
    entry.title,
    entry.type,
    entry.category,
    entry.createdAt,
  ].map(storageIdSegment).filter(Boolean).join("-");
  return {
    ...entry,
    id: `legacy-${key}-${identity || "entry"}-${index + 1}`,
    campaignId: String(entry.campaignId || DEFAULT_CAMPAIGN_ID),
  };
}

function getAllStoredCollection(key) {
  const raw = localStorage.getItem(STORAGE_KEYS[key]);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return USER_WIDGET_COLLECTIONS.has(key)
      ? parsed.map((entry, index) => normalizeUserCollectionEntry(key, entry, index)).filter(Boolean)
      : parsed;
  } catch (error) {
    console.warn(`Could not parse ${key} from localStorage`, error);
    return [];
  }
}

function getStoredCollection(key, campaignId = getActiveCampaignId()) {
  const collection = getAllStoredCollection(key);
  if (!USER_WIDGET_COLLECTIONS.has(key)) return collection;
  return collection.filter((entry) => entry.campaignId === campaignId);
}

function saveCollection(key, collection, campaignId = getActiveCampaignId()) {
  const nextCollection = USER_WIDGET_COLLECTIONS.has(key)
    ? collection.map((entry, index) => normalizeUserCollectionEntry(key, {
      ...entry,
      campaignId: entry?.campaignId || campaignId,
    }, index)).filter(Boolean)
    : collection;
  if (!USER_WIDGET_COLLECTIONS.has(key)) {
    setStoredJson(STORAGE_KEYS[key], nextCollection);
    return;
  }
  const otherCampaigns = getAllStoredCollection(key).filter((entry) => entry.campaignId !== campaignId);
  setStoredJson(STORAGE_KEYS[key], [...otherCampaigns, ...nextCollection]);
}

function numberOrBlank(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function combatantAvatarUrl(source = {}) {
  return source.avatarUrl || source.imageUrl || source.imageDataUrl || source.image?.url || "";
}

function combatantInitials(name = "") {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

function normalizeCombatant(combatant = {}, index = 0) {
  const type = COMBATANT_TYPES.includes(combatant.type) ? combatant.type : "monster";
  const maxHp = numberOrBlank(combatant.maxHp);
  const currentHp = numberOrBlank(combatant.currentHp);
  const initiativeModifier = Number(combatant.initiativeModifier) || 0;
  const initiativeRoll = numberOrBlank(combatant.initiativeRoll);
  const initiativeScore = numberOrBlank(combatant.initiativeScore);
  const status = COMBATANT_STATUSES.includes(combatant.status) ? combatant.status : "active";
  return {
    id: String(combatant.id || createId("combatant")),
    entityId: String(combatant.entityId || ""),
    type,
    name: String(combatant.name || `${type} ${index + 1}`).trim(),
    avatarUrl: String(combatant.avatarUrl || ""),
    armorClass: numberOrBlank(combatant.armorClass),
    currentHp: currentHp === "" ? maxHp : currentHp,
    maxHp,
    initiativeModifier,
    initiativeRoll,
    initiativeScore,
    status,
    conditions: Array.isArray(combatant.conditions)
      ? combatant.conditions.map((condition) => String(condition || "").trim().toLowerCase()).filter(Boolean)
      : [],
    isTemporary: Boolean(combatant.isTemporary),
    detailRoute: String(combatant.detailRoute || ""),
    sourceLabel: String(combatant.sourceLabel || ""),
  };
}

function normalizeCombatEncounter(encounter = {}) {
  const combatants = Array.isArray(encounter.combatants)
    ? encounter.combatants.map(normalizeCombatant)
    : [];
  const requestedActiveIndex = combatants.findIndex((combatant) => combatant.id === encounter.activeCombatantId);
  const currentTurnIndex = requestedActiveIndex >= 0
    ? requestedActiveIndex
    : Math.max(0, Math.min(combatants.length - 1, Number(encounter.currentTurnIndex) || 0));
  const activeCombatantId = combatants[currentTurnIndex]?.id || "";
  return {
    ...DEFAULT_COMBAT_ENCOUNTER,
    ...encounter,
    id: String(encounter.id || DEFAULT_COMBAT_ENCOUNTER.id),
    name: String(encounter.name || DEFAULT_COMBAT_ENCOUNTER.name),
    combatants,
    currentRound: Math.max(1, Number(encounter.currentRound) || 1),
    currentTurnIndex,
    activeCombatantId,
    combatStarted: Boolean(encounter.combatStarted),
    skipDefeated: encounter.skipDefeated !== false,
    manualOrder: Boolean(encounter.manualOrder),
  };
}

function getCombatEncounter() {
  const raw = localStorage.getItem(STORAGE_KEYS.combatEncounter);
  if (!raw) return normalizeCombatEncounter(DEFAULT_COMBAT_ENCOUNTER);
  try {
    return normalizeCombatEncounter(JSON.parse(raw));
  } catch (error) {
    console.warn("Could not parse combat encounter from localStorage", error);
    return normalizeCombatEncounter(DEFAULT_COMBAT_ENCOUNTER);
  }
}

function saveCombatEncounter(encounter) {
  const normalized = normalizeCombatEncounter(encounter);
  setStoredJson(STORAGE_KEYS.combatEncounter, normalized);
  return normalized;
}

function resetCombatEncounter(name = "Active combat") {
  return saveCombatEncounter({ ...DEFAULT_COMBAT_ENCOUNTER, name });
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function rollInitiativeForCombatant(combatant, roller = rollD20) {
  const initiativeRoll = Math.max(1, Math.min(20, Number(roller(combatant)) || 1));
  const initiativeModifier = Number(combatant.initiativeModifier) || 0;
  return {
    ...normalizeCombatant(combatant),
    initiativeRoll,
    initiativeModifier,
    initiativeScore: initiativeRoll + initiativeModifier,
  };
}

function sortCombatantsByInitiative(combatants = []) {
  return combatants.map(normalizeCombatant).sort((left, right) => {
    const leftScore = Number.isFinite(Number(left.initiativeScore)) ? Number(left.initiativeScore) : -999;
    const rightScore = Number.isFinite(Number(right.initiativeScore)) ? Number(right.initiativeScore) : -999;
    if (rightScore !== leftScore) return rightScore - leftScore;
    if ((Number(right.initiativeModifier) || 0) !== (Number(left.initiativeModifier) || 0)) {
      return (Number(right.initiativeModifier) || 0) - (Number(left.initiativeModifier) || 0);
    }
    return String(left.name).localeCompare(String(right.name)) || String(left.id).localeCompare(String(right.id));
  });
}

function rollInitiativeForAll(encounter = getCombatEncounter(), roller = rollD20) {
  const normalized = normalizeCombatEncounter(encounter);
  const combatants = sortCombatantsByInitiative(normalized.combatants.map((combatant) => rollInitiativeForCombatant(combatant, roller)));
  return normalizeCombatEncounter({
    ...normalized,
    combatants,
    currentRound: normalized.combatStarted ? normalized.currentRound : 1,
    currentTurnIndex: 0,
    activeCombatantId: combatants[0]?.id || "",
    manualOrder: false,
  });
}

function combatantIsTurnEligible(combatant, skipDefeated = true) {
  if (!combatant) return false;
  if (!skipDefeated) return true;
  return !["defeated", "hidden"].includes(combatant.status);
}

function nextTurnIndex(encounter = {}, direction = 1) {
  const normalized = normalizeCombatEncounter(encounter);
  const combatants = normalized.combatants;
  if (!combatants.length) return { index: 0, round: normalized.currentRound };
  if (!combatants.some((combatant) => combatantIsTurnEligible(combatant, normalized.skipDefeated))) {
    return { index: normalized.currentTurnIndex, round: normalized.currentRound };
  }

  let index = normalized.currentTurnIndex;
  let round = normalized.currentRound;
  for (let attempts = 0; attempts < combatants.length; attempts += 1) {
    index += direction;
    if (index >= combatants.length) {
      index = 0;
      round += 1;
    }
    if (index < 0) {
      if (round <= 1) {
        index = 0;
        round = 1;
        break;
      }
      index = combatants.length - 1;
      round -= 1;
    }
    if (combatantIsTurnEligible(combatants[index], normalized.skipDefeated)) break;
  }
  return { index, round: Math.max(1, round) };
}

function startCombatEncounter(encounter = getCombatEncounter(), roller = rollD20) {
  const normalized = normalizeCombatEncounter(encounter);
  if (!normalized.combatants.length) return normalized;
  const hasInitiative = normalized.combatants.every((combatant) => Number.isFinite(Number(combatant.initiativeScore)));
  const withInitiative = hasInitiative ? normalized : rollInitiativeForAll(normalized, roller);
  const firstEligibleIndex = withInitiative.combatants.findIndex((combatant) => combatantIsTurnEligible(combatant, withInitiative.skipDefeated));
  const currentTurnIndex = Math.max(0, firstEligibleIndex);
  return normalizeCombatEncounter({
    ...withInitiative,
    currentRound: 1,
    currentTurnIndex,
    activeCombatantId: withInitiative.combatants[currentTurnIndex]?.id || "",
    combatStarted: true,
  });
}

function advanceCombatTurn(encounter = getCombatEncounter()) {
  const normalized = normalizeCombatEncounter(encounter);
  if (!normalized.combatStarted) return normalized;
  const next = nextTurnIndex(normalized, 1);
  return normalizeCombatEncounter({
    ...normalized,
    currentRound: next.round,
    currentTurnIndex: next.index,
    activeCombatantId: normalized.combatants[next.index]?.id || "",
  });
}

function previousCombatTurn(encounter = getCombatEncounter()) {
  const normalized = normalizeCombatEncounter(encounter);
  if (!normalized.combatStarted) return normalized;
  const previous = nextTurnIndex(normalized, -1);
  return normalizeCombatEncounter({
    ...normalized,
    currentRound: previous.round,
    currentTurnIndex: previous.index,
    activeCombatantId: normalized.combatants[previous.index]?.id || "",
  });
}

function moveCombatant(encounter = getCombatEncounter(), combatantId = "", delta = 0) {
  const normalized = normalizeCombatEncounter(encounter);
  const index = normalized.combatants.findIndex((combatant) => combatant.id === combatantId);
  if (index < 0) return normalized;
  const targetIndex = Math.max(0, Math.min(normalized.combatants.length - 1, index + delta));
  if (targetIndex === index) return normalized;
  const combatants = [...normalized.combatants];
  const [combatant] = combatants.splice(index, 1);
  combatants.splice(targetIndex, 0, combatant);
  const activeCombatantId = normalized.activeCombatantId || normalized.combatants[normalized.currentTurnIndex]?.id;
  const currentTurnIndex = Math.max(0, combatants.findIndex((item) => item.id === activeCombatantId));
  return normalizeCombatEncounter({ ...normalized, combatants, currentTurnIndex, activeCombatantId, manualOrder: true });
}

function moveCombatantBefore(encounter = getCombatEncounter(), combatantId = "", beforeCombatantId = "") {
  const normalized = normalizeCombatEncounter(encounter);
  if (!combatantId || combatantId === beforeCombatantId) return normalized;
  const combatants = [...normalized.combatants];
  const fromIndex = combatants.findIndex((combatant) => combatant.id === combatantId);
  const toIndex = combatants.findIndex((combatant) => combatant.id === beforeCombatantId);
  if (fromIndex < 0 || toIndex < 0) return normalized;
  const [combatant] = combatants.splice(fromIndex, 1);
  combatants.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, combatant);
  const activeCombatantId = normalized.activeCombatantId || normalized.combatants[normalized.currentTurnIndex]?.id;
  const currentTurnIndex = Math.max(0, combatants.findIndex((item) => item.id === activeCombatantId));
  return normalizeCombatEncounter({ ...normalized, combatants, currentTurnIndex, activeCombatantId, manualOrder: true });
}

function removeCombatantFromEncounter(encounter = getCombatEncounter(), combatantId = "") {
  const normalized = normalizeCombatEncounter(encounter);
  const combatants = normalized.combatants.filter((combatant) => combatant.id !== combatantId);
  const currentTurnIndex = Math.max(0, Math.min(combatants.length - 1, normalized.currentTurnIndex));
  return normalizeCombatEncounter({
    ...normalized,
    combatants,
    currentTurnIndex,
    activeCombatantId: combatants[currentTurnIndex]?.id || "",
    combatStarted: combatants.length ? normalized.combatStarted : false,
  });
}

function updateCombatantInEncounter(encounter = getCombatEncounter(), combatantId = "", updater = (combatant) => combatant) {
  const normalized = normalizeCombatEncounter(encounter);
  return normalizeCombatEncounter({
    ...normalized,
    combatants: normalized.combatants.map((combatant) => (
      combatant.id === combatantId ? normalizeCombatant(updater(combatant)) : combatant
    )),
  });
}

function addCombatantToEncounter(encounter = getCombatEncounter(), combatant = {}) {
  const normalized = normalizeCombatEncounter(encounter);
  const nextCombatant = normalizeCombatant(combatant, normalized.combatants.length);
  return normalizeCombatEncounter({
    ...normalized,
    combatants: [...normalized.combatants, nextCombatant],
    activeCombatantId: normalized.activeCombatantId || nextCombatant.id,
  });
}

function hpAdjustedCombatant(combatant = {}, amount = 0) {
  const maxHp = numberOrBlank(combatant.maxHp);
  const currentHp = numberOrBlank(combatant.currentHp);
  const nextHp = Math.max(0, Math.min(maxHp === "" ? 9999 : maxHp, (Number(currentHp) || 0) + Number(amount || 0)));
  return {
    ...combatant,
    currentHp: nextHp,
    status: nextHp <= 0 ? "defeated" : (combatant.status === "defeated" ? "active" : combatant.status),
  };
}

function setCombatantCondition(combatant = {}, condition = "", enabled = true) {
  const normalizedCondition = String(condition || "").trim().toLowerCase();
  if (!normalizedCondition) return combatant;
  const conditions = new Set(combatant.conditions || []);
  if (enabled) conditions.add(normalizedCondition);
  else conditions.delete(normalizedCondition);
  return { ...combatant, conditions: Array.from(conditions).sort() };
}

function combatantDetailTarget(combatant = {}) {
  if (combatant.isTemporary || !combatant.entityId) return { kind: "temporary", combatantId: combatant.id };
  if (combatant.detailRoute) return { kind: "navigate", route: combatant.detailRoute };
  if (combatant.type === "npc") return { kind: "widget", collectionKey: "characters", entityId: combatant.entityId };
  if (combatant.type === "monster") return { kind: "widget", collectionKey: "items", entityId: combatant.entityId };
  return { kind: "temporary", combatantId: combatant.id };
}

function parseStoredJsonValue(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function mergeById(existing = [], incoming = []) {
  const byId = new Map();
  existing.filter(Boolean).forEach((entry, index) => {
    const id = String(entry.id || `existing-${index}`);
    byId.set(id, entry);
  });
  incoming.filter(Boolean).forEach((entry, index) => {
    const id = String(entry.id || `incoming-${index}`);
    byId.set(id, { ...(byId.get(id) || {}), ...entry });
  });
  return Array.from(byId.values());
}

function mergeCampaignRecord(existing = {}, incoming = {}) {
  return normalizeCampaign({
    ...existing,
    ...incoming,
    players: mergeById(existing.players || [], incoming.players || []),
    setupCompleted: Boolean(existing.setupCompleted || incoming.setupCompleted),
    campaignStartNoteId: existing.campaignStartNoteId || incoming.campaignStartNoteId || "",
  });
}

function mergeCampaignCollections(existing = [], incoming = []) {
  const byId = new Map();
  existing.map(normalizeCampaign).forEach((campaign) => byId.set(campaign.id, campaign));
  incoming.map(normalizeCampaign).forEach((campaign) => {
    byId.set(campaign.id, mergeCampaignRecord(byId.get(campaign.id), campaign));
  });
  return Array.from(byId.values());
}

function mergeStoredCollectionValues(key, existingValue, incomingValue) {
  const existing = parseStoredJsonValue(existingValue, []);
  const incoming = parseStoredJsonValue(incomingValue, []);
  if (!Array.isArray(existing) || !Array.isArray(incoming)) return existingValue || incomingValue;
  const merged = mergeById(
    existing.map((entry, index) => normalizeUserCollectionEntry(key, entry, index)).filter(Boolean),
    incoming.map((entry, index) => normalizeUserCollectionEntry(key, entry, index)).filter(Boolean),
  );
  return JSON.stringify(merged);
}

function mergeObjectStorageValues(existingValue, incomingValue) {
  const existing = parseStoredJsonValue(existingValue, {});
  const incoming = parseStoredJsonValue(incomingValue, {});
  return JSON.stringify({ ...existing, ...incoming });
}

function mergeImportedStorage(storage = {}) {
  Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
    const incomingValue = storage[storageKey];
    if (incomingValue === undefined || incomingValue === null) return;
    const existingValue = localStorage.getItem(storageKey);
    if (USER_WIDGET_COLLECTIONS.has(key)) {
      localStorage.setItem(storageKey, mergeStoredCollectionValues(key, existingValue, incomingValue));
    } else if (key === "campaigns") {
      const existingCampaigns = parseStoredJsonValue(existingValue, []);
      const incomingCampaigns = parseStoredJsonValue(incomingValue, []);
      localStorage.setItem(storageKey, JSON.stringify(mergeCampaignCollections(existingCampaigns, incomingCampaigns)));
    } else if (key === "activeCampaign") {
      if (!existingValue) localStorage.setItem(storageKey, incomingValue);
    } else if (key === "calendarSettings") {
      localStorage.setItem(storageKey, incomingValue);
    } else {
      localStorage.setItem(storageKey, mergeObjectStorageValues(existingValue, incomingValue));
    }
  });
}

function importCanonicalLocalStoragePayload() {
  const params = new URLSearchParams(window.location.search || "");
  if (params.get(LOCAL_STORAGE_IMPORT_PARAM) !== LOCAL_STORAGE_IMPORT_TOKEN) return false;
  const payloadText = window.name || "";
  params.delete(LOCAL_STORAGE_IMPORT_PARAM);
  const cleanUrl = `${window.location.pathname || "/"}${params.toString() ? `?${params}` : ""}${window.location.hash || ""}`;
  if (history?.replaceState) history.replaceState(null, "", cleanUrl);
  if (!payloadText) return false;
  try {
    const payload = JSON.parse(payloadText);
    if (payload?.source === "dnducks-local-storage" && payload.storage) {
      mergeImportedStorage(payload.storage);
      window.name = "";
      return true;
    }
  } catch (error) {
    console.warn("Could not import local DnDucks data from another local origin.", error);
  }
  return false;
}

function isQuotaExceededError(error) {
  return error?.name === "QuotaExceededError"
    || error?.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || error?.code === 22
    || error?.code === 1014
    || /quota/i.test(error?.message || "");
}

function setStoredJson(storageKey, value) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;
    throw new Error("Browser storage is full. Start the backend with npm start for file-backed image uploads, delete some local widgets, or choose a smaller image.");
  }
}

function setStoredText(storageKey, value) {
  try {
    localStorage.setItem(storageKey, String(value));
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;
    throw new Error("Browser storage is full. Start the backend with npm start for file-backed image uploads, delete some local widgets, or choose a smaller image.");
  }
}

const DEFAULT_CALENDAR_SETTINGS = {
  weekLength: 7,
  weekdays: ["Moonday", "Tirsday", "Windsday", "Thundersday", "Fireday", "Starday", "Sunday"],
  months: ["Bloomwane", "Highsun", "Goldleaf", "Frostwane"],
  daysPerMonth: 30,
  yearName: "DR",
  currentYear: 1492,
  currentMonthIndex: 0,
  weatherProbabilities: {},
};

const WEATHER_OPTIONS = [
  "Clear skies", "Light rain", "Heavy rain", "Silver fog", "Cold wind", "Thunderheads",
  "Warm breeze", "Ashfall", "Glittering frost", "Oppressive heat", "Moonlit calm", "Arcane aurora",
];

const DEFAULT_WEATHER_WEIGHT = 1;
const MAX_WEATHER_WEIGHT = 10;

function defaultWeatherWeights() {
  return Object.fromEntries(WEATHER_OPTIONS.map((weather) => [weather, DEFAULT_WEATHER_WEIGHT]));
}

function normalizeWeatherProbabilities(rawProbabilities = {}, monthCount = DEFAULT_CALENDAR_SETTINGS.months.length) {
  const source = rawProbabilities && typeof rawProbabilities === "object" ? rawProbabilities : {};
  const probabilities = {};
  for (let monthIndex = 0; monthIndex < monthCount; monthIndex += 1) {
    const monthWeights = source[monthIndex] && typeof source[monthIndex] === "object" ? source[monthIndex] : {};
    probabilities[monthIndex] = Object.fromEntries(WEATHER_OPTIONS.map((weather) => {
      const weight = Number(monthWeights[weather]);
      return [weather, Number.isFinite(weight) ? Math.min(Math.max(weight, 0), MAX_WEATHER_WEIGHT) : DEFAULT_WEATHER_WEIGHT];
    }));
  }
  return probabilities;
}

function weatherWeightsForMonth(settings, monthIndex = settings.currentMonthIndex) {
  const probabilities = normalizeWeatherProbabilities(settings.weatherProbabilities, settings.months.length);
  return probabilities[Math.min(Math.max(0, Number(monthIndex) || 0), settings.months.length - 1)] || defaultWeatherWeights();
}

function randomWeatherForMonth(settings, monthIndex = settings.currentMonthIndex) {
  const weights = weatherWeightsForMonth(settings, monthIndex);
  const weightedOptions = WEATHER_OPTIONS
    .map((weather) => ({ weather, weight: Number(weights[weather]) || 0 }))
    .filter((option) => option.weight > 0);
  const totalWeight = weightedOptions.reduce((total, option) => total + option.weight, 0);
  if (totalWeight <= 0) return WEATHER_OPTIONS[Math.floor(Math.random() * WEATHER_OPTIONS.length)];

  let roll = Math.random() * totalWeight;
  for (const option of weightedOptions) {
    roll -= option.weight;
    if (roll <= 0) return option.weather;
  }
  return weightedOptions[weightedOptions.length - 1].weather;
}

const COMIC_PAGE_WIDTH = 900;
const COMIC_PAGE_HEIGHT = 1350;
const COMIC_LAYOUTS = [
  {
    id: "splash",
    label: "Splash page",
    description: "One full-page panel for a reveal, title moment, or location establishing shot.",
    panels: [{ x: 4, y: 4, w: 92, h: 92 }],
  },
  {
    id: "four-grid",
    label: "Four panel grid",
    description: "A stable 2 x 2 page for dialogue beats, parallel action, and simple rhythm.",
    panels: [
      { x: 4, y: 4, w: 44, h: 44 },
      { x: 52, y: 4, w: 44, h: 44 },
      { x: 4, y: 52, w: 44, h: 44 },
      { x: 52, y: 52, w: 44, h: 44 },
    ],
  },
  {
    id: "six-grid",
    label: "Six panel grid",
    description: "A classic two-column, three-tier page with steady pacing.",
    panels: [
      { x: 4, y: 4, w: 44, h: 28 },
      { x: 52, y: 4, w: 44, h: 28 },
      { x: 4, y: 36, w: 44, h: 28 },
      { x: 52, y: 36, w: 44, h: 28 },
      { x: 4, y: 68, w: 44, h: 28 },
      { x: 52, y: 68, w: 44, h: 28 },
    ],
  },
  {
    id: "nine-grid",
    label: "Nine panel grid",
    description: "A formal 3 x 3 page for controlled time, clues, and repeated framing.",
    panels: [
      { x: 4, y: 4, w: 28, h: 28 },
      { x: 36, y: 4, w: 28, h: 28 },
      { x: 68, y: 4, w: 28, h: 28 },
      { x: 4, y: 36, w: 28, h: 28 },
      { x: 36, y: 36, w: 28, h: 28 },
      { x: 68, y: 36, w: 28, h: 28 },
      { x: 4, y: 68, w: 28, h: 28 },
      { x: 36, y: 68, w: 28, h: 28 },
      { x: 68, y: 68, w: 28, h: 28 },
    ],
  },
  {
    id: "wide-tiers",
    label: "Wide tiers",
    description: "Horizontal story bands, useful for landscape travel and cinematic exchanges.",
    panels: [
      { x: 4, y: 4, w: 92, h: 24 },
      { x: 4, y: 32, w: 44, h: 28 },
      { x: 52, y: 32, w: 44, h: 28 },
      { x: 4, y: 64, w: 28, h: 32 },
      { x: 36, y: 64, w: 28, h: 32 },
      { x: 68, y: 64, w: 28, h: 32 },
    ],
  },
  {
    id: "manga-stack",
    label: "Manga stack",
    description: "Tall vertical beats with one wide impact panel.",
    panels: [
      { x: 4, y: 4, w: 42, h: 34 },
      { x: 50, y: 4, w: 46, h: 18 },
      { x: 50, y: 26, w: 46, h: 30 },
      { x: 4, y: 42, w: 42, h: 26 },
      { x: 4, y: 72, w: 92, h: 24 },
    ],
  },
  {
    id: "overlap-action",
    label: "Overlapping action",
    description: "A main panel with overlapping reaction and impact panels for chaotic action.",
    panels: [
      { x: 4, y: 4, w: 64, h: 55, z: 1 },
      { x: 56, y: 10, w: 40, h: 30, z: 3, rotate: 1.5 },
      { x: 10, y: 53, w: 38, h: 29, z: 2, rotate: -1.25 },
      { x: 46, y: 61, w: 50, h: 35, z: 1 },
    ],
  },
  {
    id: "inset-reveal",
    label: "Inset reveal",
    description: "A large establishing panel with small inset close-ups for clues or reactions.",
    panels: [
      { x: 4, y: 4, w: 92, h: 58, z: 1 },
      { x: 8, y: 47, w: 26, h: 20, z: 3 },
      { x: 66, y: 47, w: 26, h: 20, z: 3 },
      { x: 4, y: 70, w: 44, h: 26, z: 1 },
      { x: 52, y: 70, w: 44, h: 26, z: 1 },
    ],
  },
];

function getCalendarSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.calendarSettings);
  if (!raw) return {
    ...DEFAULT_CALENDAR_SETTINGS,
    weekdays: [...DEFAULT_CALENDAR_SETTINGS.weekdays],
    months: [...DEFAULT_CALENDAR_SETTINGS.months],
    weatherProbabilities: normalizeWeatherProbabilities(DEFAULT_CALENDAR_SETTINGS.weatherProbabilities, DEFAULT_CALENDAR_SETTINGS.months.length),
  };
  try {
    const parsed = JSON.parse(raw);
    const weekLength = Math.max(1, Number(parsed.weekLength) || DEFAULT_CALENDAR_SETTINGS.weekLength);
    const weekdays = Array.isArray(parsed.weekdays) && parsed.weekdays.length
      ? parsed.weekdays.map((day) => String(day).trim()).filter(Boolean).slice(0, weekLength)
      : DEFAULT_CALENDAR_SETTINGS.weekdays.slice(0, weekLength);
    while (weekdays.length < weekLength) weekdays.push(`Day ${weekdays.length + 1}`);
    const storedMonths = Array.isArray(parsed.months) && parsed.months.length
      ? parsed.months.map((month) => String(month).trim()).filter(Boolean)
      : [];
    const months = storedMonths.length ? storedMonths : [...DEFAULT_CALENDAR_SETTINGS.months];
    return {
      ...DEFAULT_CALENDAR_SETTINGS,
      ...parsed,
      weekLength,
      weekdays,
      months,
      daysPerMonth: Math.max(1, Number(parsed.daysPerMonth) || DEFAULT_CALENDAR_SETTINGS.daysPerMonth),
      currentYear: Number(parsed.currentYear) || DEFAULT_CALENDAR_SETTINGS.currentYear,
      currentMonthIndex: Math.min(Math.max(0, Number(parsed.currentMonthIndex) || 0), months.length - 1),
      yearName: String(parsed.yearName || DEFAULT_CALENDAR_SETTINGS.yearName).trim() || DEFAULT_CALENDAR_SETTINGS.yearName,
      weatherProbabilities: normalizeWeatherProbabilities(parsed.weatherProbabilities, months.length),
    };
  } catch (error) {
    console.warn("Could not parse campaign calendar settings", error);
    return {
      ...DEFAULT_CALENDAR_SETTINGS,
      weekdays: [...DEFAULT_CALENDAR_SETTINGS.weekdays],
      months: [...DEFAULT_CALENDAR_SETTINGS.months],
      weatherProbabilities: normalizeWeatherProbabilities(DEFAULT_CALENDAR_SETTINGS.weatherProbabilities, DEFAULT_CALENDAR_SETTINGS.months.length),
    };
  }
}

function saveCalendarSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.calendarSettings, JSON.stringify(settings));
}

function getWeatherMap() {
  const raw = localStorage.getItem(STORAGE_KEYS.weather);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (error) { console.warn("Could not parse weather", error); return {}; }
}

function saveWeatherMap(weather) {
  localStorage.setItem(STORAGE_KEYS.weather, JSON.stringify(weather));
}

function weatherKey(year, monthIndex, day) {
  return `${year}-${monthIndex}-${day}`;
}

function eventDateLabel(event, settings = getCalendarSettings()) {
  if (Number.isFinite(Number(event.day)) && Number.isFinite(Number(event.monthIndex)) && Number.isFinite(Number(event.year))) {
    const monthName = settings.months[Number(event.monthIndex)] || `Month ${Number(event.monthIndex) + 1}`;
    return `${event.day} ${monthName}, ${event.year} ${settings.yearName}`.trim();
  }
  return displayText(event.date, "Unscheduled");
}

function eventSortValue(event) {
  if (Number.isFinite(Number(event.day)) && Number.isFinite(Number(event.monthIndex)) && Number.isFinite(Number(event.year))) {
    const hour = Number.isFinite(Number(event.hour)) ? Number(event.hour) : 24;
    return Number(event.year) * 1000000 + Number(event.monthIndex) * 10000 + Number(event.day) * 100 + hour;
  }
  return Number.MAX_SAFE_INTEGER;
}

function sortedEvents() {
  return getStoredCollection("events").filter(Boolean).sort((a, b) => eventSortValue(a) - eventSortValue(b));
}

function nextImminentEvent() {
  const settings = getCalendarSettings();
  const current = settings.currentYear * 10000 + settings.currentMonthIndex * 100 + 1;
  return sortedEvents().find((event) => eventSortValue(event) >= current) || sortedEvents()[0];
}

function eventWeather(event) {
  if (!event || !Number.isFinite(Number(event.day))) return "Weather unknown";
  return getWeatherMap()[weatherKey(event.year, event.monthIndex, event.day)] || "Weather not generated";
}

function eventTimeDisplay(event) {
  if (!event) return "";
  if (Number.isFinite(Number(event.hour))) {
    return `${String(event.hour).padStart(2, "0")}:00`;
  }
  return "";
}

function populateCalendarFormDefaults() {
  const settings = getCalendarSettings();
  document.querySelectorAll("#event-month").forEach((select) => {
    const selected = select.value || String(settings.currentMonthIndex);
    select.innerHTML = settings.months.map((month, index) => `<option value="${index}">${escapeHtml(month)}</option>`).join("");
    select.value = selected;
  });
  document.querySelectorAll("#event-year").forEach((input) => { if (!input.value) input.value = settings.currentYear; });
  document.querySelectorAll("#event-day").forEach((input) => { input.max = settings.daysPerMonth; });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function uploadImages(files, metadata = {}) {
  const selected = Array.from(files || []).filter(Boolean);
  if (!selected.length) return [];
  const formData = new FormData();
  selected.forEach((file) => formData.append("images", file));
  Object.entries({ campaignId: getActiveCampaignId(), ...metadata }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) formData.append(key, value);
  });
  const payload = await fetchJson("/api/uploads/images", { method: "POST", body: formData });
  return payload.images || [];
}

async function listImages(filters = {}) {
  const campaignId = filters.campaignId || getActiveCampaignId();
  const payload = await fetchJson(`/api/uploads/images?campaignId=${encodeURIComponent(campaignId)}`);
  return (payload.images || []).filter((image) => String(image.campaignId || DEFAULT_CAMPAIGN_ID) === campaignId);
}

async function deleteImage(imageId) {
  return fetchJson(`/api/uploads/images/${encodeURIComponent(imageId)}`, { method: "DELETE" });
}

async function updateImageMetadata(imageId, metadata) {
  return fetchJson(`/api/uploads/images/${encodeURIComponent(imageId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
}

async function imageFromFileInput(fileInput, metadata = {}) {
  const file = fileInput?.files?.[0];
  if (!file) return null;
  if (!file.type.startsWith("image/")) {
    throw new Error("Widget images must be image files.");
  }
  try {
    const [image] = await uploadImages([file], metadata);
    return image || null;
  } catch (error) {
    if (!canUseLocalImageFallback(error)) throw error;
    return localImageFromFile(file, metadata);
  }
}

async function imageToDataUrl(fileInput) {
  const file = fileInput?.files?.[0];
  return file ? fileToDataUrl(file) : "";
}

function imageFields(image) {
  if (!image) return {};
  return {
    imageId: image.id || "",
    imageUrl: image.url || "",
    imageDataUrl: image.url || "",
    image,
  };
}

function canUseLocalImageFallback(error) {
  return /Network error while contacting .*\/api\/uploads\/images/.test(error?.message || "");
}

function fileToDataUrl(file) {
  if (typeof FileReader === "undefined") {
    return Promise.reject(new Error("This browser cannot save local image previews without the backend."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read the selected image.")));
    reader.readAsDataURL(file);
  });
}

function canCompressLocalImage() {
  return typeof document !== "undefined"
    && typeof document.createElement === "function"
    && typeof Image !== "undefined"
    && typeof URL !== "undefined"
    && typeof URL.createObjectURL === "function"
    && typeof URL.revokeObjectURL === "function";
}

async function compressedImageDataUrl(file) {
  if (!canCompressLocalImage()) return fileToDataUrl(file);

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.addEventListener("load", () => {
      try {
        const sourceWidth = image.naturalWidth || image.width || LOCAL_IMAGE_MAX_DIMENSION;
        const sourceHeight = image.naturalHeight || image.height || LOCAL_IMAGE_MAX_DIMENSION;
        const scale = Math.min(1, LOCAL_IMAGE_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("This browser cannot prepare local image previews without the backend."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", LOCAL_IMAGE_QUALITY));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }, { once: true });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read the selected image."));
    }, { once: true });
    image.src = objectUrl;
  });
}

function assertLocalImageFitsStorage(dataUrl) {
  if (String(dataUrl || "").length <= LOCAL_IMAGE_MAX_DATA_URL_LENGTH) return;
  throw new Error("Selected image is too large for browser-only storage. Start the backend with npm start for file-backed uploads, or choose a smaller image.");
}

async function localImageFromFile(file, metadata = {}) {
  const url = await compressedImageDataUrl(file);
  assertLocalImageFitsStorage(url);
  const title = String(metadata.title || file.name || "Local widget image").trim();
  return {
    id: createId("local-image"),
    title,
    originalFilename: file.name || title,
    fileSize: file.size || 0,
    mimeType: file.type || "",
    url,
    path: url,
    localOnly: true,
    uploadedAt: new Date().toISOString(),
  };
}

function displayText(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function firstDisplayText(values, fallback) {
  const found = values.find((value) => String(value ?? "").trim());
  return displayText(found, fallback);
}

function widgetImageMarkup(entry, label) {
  const title = displayText(label, "Widget");
  const alt = escapeHtml(entry.image?.title || `${title} image`);
  const imageUrl = resolveBackendUrl(entry.imageUrl || entry.imageDataUrl || entry.image?.url);
  const imageActionLabel = imageUrl ? `Change image for ${title}` : `Add image for ${title}`;
  const actionAttributes = entry.id
    ? `button type="button" data-image-upload-id="${escapeHtml(entry.id)}" aria-label="${escapeHtml(imageActionLabel)}" title="${escapeHtml(imageActionLabel)}"`
    : `div aria-label="No image upload target available"`;
  const closeTag = entry.id ? "button" : "div";

  if (imageUrl) {
    return `
    <${actionAttributes} class="widget-media widget-media-action widget-media-filled">
      <img src="${escapeHtml(imageUrl)}" alt="${alt}" loading="lazy" />
      <span class="widget-media-overlay">Change image</span>
    </${closeTag}>`;
  }

  return `
    <${actionAttributes} class="widget-media widget-media-empty widget-media-action">
      <span aria-hidden="true">＋</span>
      <small>Add image</small>
    </${closeTag}>`;
}

function widgetImageDisplayMarkup(entry, label) {
  const title = displayText(label, "Widget");
  const alt = escapeHtml(entry.image?.title || `${title} image`);
  const imageUrl = resolveBackendUrl(entry.imageUrl || entry.imageDataUrl || entry.image?.url);

  if (imageUrl) {
    return `
    <div class="widget-media widget-media-filled">
      <img src="${escapeHtml(imageUrl)}" alt="${alt}" loading="lazy" />
    </div>`;
  }

  return `
    <div class="widget-media widget-media-empty" aria-hidden="true">
      <span>＋</span>
      <small>No image</small>
    </div>`;
}

function widgetDescriptionMarkup(value) {
  const text = String(value || "").trim();
  return text ? `<p class="widget-description">${escapeHtml(text)}</p>` : "";
}

function entryTags(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",").map((tag) => tag.trim());
  return [];
}

function widgetTagsMarkup(tags) {
  const tagMarkup = tags
    .map((tag) => String(tag ?? "").trim())
    .filter(Boolean)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
  return tagMarkup ? `<div class="tag-row widget-tags">${tagMarkup}</div>` : "";
}

function itemFeatureList(value) {
  const normalizeFeature = (feature) => {
    if (feature && typeof feature === "object") {
      const title = String(feature.title || feature.name || "").trim();
      const description = String(feature.description || feature.effect || "").trim();
      return title || description ? { title, description } : null;
    }
    const title = String(feature || "").trim();
    return title ? { title, description: "" } : null;
  };

  const features = Array.isArray(value)
    ? value
    : String(value || "").split(",").map((feature) => feature.trim()).filter(Boolean);
  return features.map(normalizeFeature).filter(Boolean);
}

function itemWeaponStatsMarkup(item) {
  if (item.type !== "Weapon") return "";
  const stats = item.statistics || {};
  const statItems = [
    ["DMG", homebrewWeaponBaseDamageText(item)],
    ["MODE", homebrewWeaponModeText(item)],
    ["RNG", stats.range],
    ["ATK", stats.attackBonus ?? stats.attack ?? stats.bonus],
    ["DMG+", stats.damageBonus ?? stats.bonus],
    ["VERS", stats.versatileDamage],
    ["PROP", weaponPropertiesText(stats.properties)],
  ].filter(([, value]) => String(value || "").trim());
  if (!statItems.length) return "";
  return `
          <div class="item-stat-icons" aria-label="Weapon statistics">
            ${statItems.map(([label, value]) => `
              <span class="item-stat-icon"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>
            `).join("")}
          </div>`;
}

function itemBackgroundStatsMarkup(item) {
  if (item.type !== "Background") return "";
  const stats = backgroundStatistics(item);
  const abilityScores = backgroundStatList(stats.abilityScores);
  const skills = backgroundStatList(stats.skills);
  const rows = [
    ["Ability Scores", abilityScores.join(", ")],
    ["Origin Feat", stats.originFeat],
    ["Skill Proficiencies", skills.join(", ")],
    ["Tool Proficiency", stats.toolProficiency],
    ["Equipment", stats.equipment],
  ].filter(([, value]) => hasText(value));
  if (!rows.length) return "";
  return `<dl class="background-detail-list">${rows.map(([label, value]) => `
            <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
          </dl>`;
}

function itemWeaponPropertyBlocksMarkup(item) {
  if (item.type !== "Weapon") return "";
  const properties = weaponPropertyDetails(item.statistics?.properties, item);
  if (!properties.length) return "";
  return `
          <div class="equipment-detail-row item-property-detail-row" aria-label="Weapon property details">
            <span>Properties</span>
            ${weaponPropertyIconListMarkup(properties)}
          </div>`;
}

function itemFeatureBlocksMarkup(item) {
  const features = itemFeatureList(item.features);
  if (!features.length) return "";
  return `
          <div class="item-feature-list" aria-label="Weapon features">
            ${features.map((feature, index) => {
              const description = feature.description || (index === 0 ? String(item.description || "").trim() : "");
              const title = feature.title || "Feature";
              return `
              <article class="item-feature-block">
                <span class="item-feature-icon">${escapeHtml(title)}</span>
                ${description ? `<p>${escapeHtml(description)}</p>` : ""}
              </article>`;
            }).join("")}
          </div>`;
}

function isUserProducedEntry(entry) {
  return Boolean(entry?.id) && !String(entry.id).startsWith("demo-");
}

function widgetOriginAttribute(entry) {
  return `data-widget-origin="${isUserProducedEntry(entry) ? "user" : "permanent"}"`;
}

function widgetDmId(collectionKey, entry, fallback = "widget") {
  const entryId = String(entry?.id || entry?.title || entry?.name || fallback || "widget").trim();
  return `${collectionKey}:${entryId || fallback}`;
}

function widgetDmAttribute(collectionKey, entry, fallback) {
  return `data-dm-widget-id="${escapeHtml(widgetDmId(collectionKey, entry, fallback))}"`;
}

function widgetEditAttribute(collectionKey, entry) {
  if (!isUserProducedEntry(entry)) return "";
  return `data-edit-key="${escapeHtml(collectionKey)}" data-edit-id="${escapeHtml(entry.id)}"`;
}

function getDmOnlyTargets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.dmOnly) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveDmOnlyTargets(targets) {
  setStoredJson(STORAGE_KEYS.dmOnly, targets);
}

function setDmOnlyTarget(target, isDmOnly = true) {
  const cleanTarget = String(target || "").trim();
  if (!cleanTarget) return;
  const targets = getDmOnlyTargets();
  if (isDmOnly) targets[cleanTarget] = true;
  else delete targets[cleanTarget];
  saveDmOnlyTargets(targets);
}

function toggleDmOnlyTarget(target) {
  const cleanTarget = String(target || "").trim();
  if (!cleanTarget) return;
  setDmOnlyTarget(cleanTarget, !isDmOnlyTarget(cleanTarget));
}

function isDmOnlyTarget(target, targets = getDmOnlyTargets()) {
  return Boolean(targets[String(target || "")]);
}

function widgetActionMarkup(entry, labels = {}) {
  if (!isUserProducedEntry(entry)) return "";
  const editLabel = labels.edit || "Modify widget";
  const deleteLabel = labels.delete || "Delete widget";

  return `
          <div class="entry-actions">
            <button class="btn btn-secondary" type="button" data-edit-action-id="${escapeHtml(entry.id)}">${escapeHtml(editLabel)}</button>
            <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(entry.id)}">${escapeHtml(deleteLabel)}</button>
          </div>`;
}

function upsertCollectionEntry(collection, entry, editId = "") {
  if (!editId) return [entry, ...collection];
  let updated = false;
  const nextCollection = collection.map((item) => {
    if (item.id !== editId) return item;
    updated = true;
    return { ...item, ...entry, id: item.id, createdAt: item.createdAt || entry.createdAt };
  });
  return updated ? nextCollection : [entry, ...collection];
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readableDate() {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
}

function currentIsoDate() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function readableDateFromIso(value) {
  if (!value) return readableDate();
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function noteChronologyValue(note) {
  if (note?.campaignStartDate) return Date.parse(`${note.campaignStartDate}T00:00:00`);
  if (note?.sortAt) return Number(note.sortAt);
  const idTimestamp = Number(String(note?.id || "").split("-")[1]);
  if (Number.isFinite(idTimestamp)) return idTimestamp;
  const parsedDate = Date.parse(note?.createdAt || "");
  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

function sortedNotes() {
  return getStoredCollection("notes").sort((a, b) => noteChronologyValue(a) - noteChronologyValue(b));
}

function textForSearch(values) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function isPreviewableImage(material) {
  return String(material.mimeType || "").startsWith("image/");
}

function statusBadgeClass(status) {
  return {
    active: "status-active",
    prepared: "status-prepared",
    hidden: "status-hidden",
    completed: "status-completed",
  }[status] || "status-active";
}

function statusLabel(status) {
  return {
    active: "Active",
    prepared: "Prepared",
    hidden: "DM-only",
    completed: "Completed",
  }[status] || "Active";
}

function resetImagePickers(root) {
  const pickers = root.matches?.("[data-image-picker]") ? [root] : Array.from(root.querySelectorAll("[data-image-picker]"));
  pickers.forEach((picker) => {
    const status = picker.querySelector("[data-image-status]");
    const preview = picker.querySelector("[data-image-preview]");
    if (status) {
      status.textContent = "No image chosen";
      status.classList.remove("error");
    }
    if (preview) {
      preview.removeAttribute("src");
      preview.hidden = true;
    }
  });
  const mediaPickers = root.matches?.("[data-media-select]") ? [root] : Array.from(root.querySelectorAll("[data-media-select]"));
  mediaPickers.forEach((picker) => setMediaSelectImage(picker, null));
}

function selectedFilePreviews(files) {
  return Array.from(files || []).filter((file) => file.type.startsWith("image/")).map((file) => ({
    url: URL.createObjectURL(file),
    originalFilename: file.name,
    fileSize: file.size,
    previewOnly: true,
  }));
}

function initImagePickers(root = document) {
  root.querySelectorAll("[data-image-picker]").forEach((picker) => {
    if (picker.dataset.imagePickerReady === "true") return;
    const input = picker.querySelector('input[type="file"]');
    const trigger = picker.querySelector("[data-image-trigger]");
    const status = picker.querySelector("[data-image-status]");
    const preview = picker.querySelector("[data-image-preview]");
    const maxFiles = Number(picker.dataset.maxFiles || input?.dataset.maxFiles || 0);
    if (!input || !trigger) return;
    picker.dataset.imagePickerReady = "true";

    trigger.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      if (maxFiles && files.length > maxFiles) {
        input.value = "";
        if (status) {
          status.textContent = `Choose ${maxFiles} image${maxFiles === 1 ? "" : "s"} or fewer.`;
          status.classList.add("error");
        }
        return;
      }
      if (status) {
        status.textContent = files.length ? `${files.length} image${files.length === 1 ? "" : "s"} ready.` : "No image chosen";
        status.classList.remove("error");
      }
      const previews = selectedFilePreviews(files);
      if (preview) {
        if (!previews[0]) {
          preview.removeAttribute("src");
          preview.hidden = true;
          return;
        }
        preview.src = previews[0].url;
        preview.hidden = false;
      }
    });
  });
  initMediaSelectPickers(root);
}

function imageFromEntry(entry = {}) {
  const source = entry.image && typeof entry.image === "object" ? entry.image : entry;
  const url = source.url || entry.imageUrl || entry.imageDataUrl || "";
  if (!url) return null;
  return {
    id: source.id || entry.imageId || "",
    url,
    title: source.title || source.originalFilename || entry.title || entry.name || "Selected image",
    originalFilename: source.originalFilename || "",
    fileSize: source.fileSize || 0,
    uploadedAt: source.uploadedAt || "",
  };
}

function setMediaSelectImage(picker, image, statusText = "") {
  if (!picker) return;
  const normalized = imageFromEntry(image || {});
  const status = picker.querySelector("[data-image-status]");
  const preview = picker.querySelector("[data-image-preview]");
  const clear = picker.querySelector("[data-media-clear]");

  if (!normalized) {
    delete picker.dataset.selectedImage;
    if (status) {
      status.textContent = "No image chosen";
      status.classList.remove("error");
    }
    if (preview) {
      preview.removeAttribute("src");
      preview.hidden = true;
    }
    if (clear) clear.hidden = true;
    return;
  }

  picker.dataset.selectedImage = JSON.stringify(normalized);
  if (status) {
    status.textContent = statusText || `Selected: ${normalized.title}`;
    status.classList.remove("error");
  }
  if (preview) {
    preview.src = resolveBackendUrl(normalized.url);
    preview.hidden = false;
  }
  if (clear) clear.hidden = false;
}

function selectedMediaImageFromPicker(picker) {
  if (!picker?.dataset?.selectedImage) return null;
  try {
    return JSON.parse(picker.dataset.selectedImage);
  } catch (error) {
    return null;
  }
}

function selectedMediaImageFromForm(form) {
  return selectedMediaImageFromPicker(form?.querySelector("[data-media-select]"));
}

function initMediaSelectPickers(root = document) {
  root.querySelectorAll("[data-media-select]").forEach((picker) => {
    if (picker.dataset.mediaSelectReady === "true") return;
    const trigger = picker.querySelector("[data-media-select-trigger]");
    const clear = picker.querySelector("[data-media-clear]");
    const status = picker.querySelector("[data-image-status]");
    if (!trigger) return;
    picker.dataset.mediaSelectReady = "true";

    trigger.addEventListener("click", async () => {
      const previous = selectedMediaImageFromPicker(picker);
      if (status) {
        status.textContent = "Opening media library...";
        status.classList.remove("error");
      }
      try {
        const image = await chooseWidgetImage();
        if (image) {
          setMediaSelectImage(picker, image);
        } else if (previous) {
          setMediaSelectImage(picker, previous);
        } else if (status) {
          status.textContent = "No image chosen";
        }
      } catch (error) {
        if (status) {
          status.textContent = error.message;
          status.classList.add("error");
        } else {
          alert(error.message);
        }
      }
    });

    clear?.addEventListener("click", () => setMediaSelectImage(picker, null));
  });
}

async function fetchJson(url, options = {}) {
  const requestUrl = resolveApiUrl(url);
  const requestMethod = options.method || "GET";
  let response;
  try {
    response = await fetch(requestUrl, options);
  } catch (error) {
    throw new Error(`Network error while contacting ${requestUrl}: ${error.message || "request could not be sent"}. Check that the backend is running and reachable.`);
  }

  const text = await response.text();
  const payload = parseJsonResponse(text);
  if (!response.ok) {
    const branch = response.headers.get("x-route-branch");
    const allow = response.headers.get("allow");
    const details = [payload?.error || response.statusText || "Request failed."];
    if (payload?.message && payload.message !== payload.error) details.push(payload.message);
    if (payload?.code) details.push(`Code: ${payload.code}.`);
    if (branch) details.push(`Route branch: ${branch}.`);
    if (allow) details.push(`Allow: ${allow}.`);
    if (!branch && String(url || "").startsWith("/api/")) details.push("No X-Route-Branch header was returned, so this response may not be from server.js.");
    if (payload?.requestId) details.push(`Request ID: ${payload.requestId}.`);
    throw new Error(`HTTP ${response.status} ${requestMethod} ${requestUrl}: ${details.join(" ")}`);
  }
  return payload;
}

function parseJsonResponse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("The backend returned a non-JSON response. Check the endpoint URL, proxy configuration, and backend logs.");
  }
}

const CHARACTER_SUGGESTION_TARGETS = {
  backgrounds: "#player-features",
  feats: "#player-features",
};

const CHARACTER_SUGGESTION_LABELS = {
  backgrounds: "Background package",
  feats: "Feat or talent",
};

function collectCharacterSuggestionPayload(form) {
  return {
    description: [
      formValue(form, "#player-description"),
      formValue(form, "#player-notes"),
      formValue(form, "#player-personality-traits"),
      formValue(form, "#player-ideals"),
      formValue(form, "#player-flaws"),
    ].filter(Boolean).join("\n\n"),
    characterName: formValue(form, "#player-character-name"),
    classRole: formValue(form, "#player-class-role"),
    race: formValue(form, "#player-race"),
    background: formValue(form, "#player-background"),
    notes: formValue(form, "#player-notes"),
  };
}

async function requestCharacterSuggestions(form) {
  return fetchJson("/api/characters/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(collectCharacterSuggestionPayload(form)),
  });
}

function suggestionApplyText(suggestion) {
  if (suggestion.category === "feats") {
    return [
      `${suggestion.label} (Feat)`,
      suggestion.mechanics || featDescriptionForName(suggestion.label) || suggestion.description,
    ].filter(Boolean).join("\n");
  }
  return [
    `${suggestion.label} (${CHARACTER_SUGGESTION_LABELS[suggestion.category] || "Suggestion"})`,
    suggestion.description,
    suggestion.mechanics ? `Mechanics: ${suggestion.mechanics}` : "",
  ].filter(Boolean).join("\n");
}

function appendTextareaValue(textarea, value) {
  const nextValue = String(value || "").trim();
  if (!textarea || !nextValue) return;
  const current = String(textarea.value || "").trim();
  if (current.toLowerCase().includes(nextValue.toLowerCase())) return;
  textarea.value = current ? `${current}\n${nextValue}` : nextValue;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function appendUniqueTextareaLines(textarea, lines = []) {
  if (!textarea) return;
  const current = String(textarea.value || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const next = uniqueTextList([...current, ...lines]);
  textarea.value = next.join("\n");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function addToHiddenListField(form, selector, values = []) {
  const field = form.querySelector(selector);
  if (!field) return;
  const current = splitListInput(field.value);
  field.value = uniqueTextList([...current, ...values]).join(", ");
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function removeFromHiddenListField(form, selector, values = []) {
  const field = form.querySelector(selector);
  if (!field || !values.length) return;
  const remove = new Set(values.map(normalizeRulesText));
  field.value = splitListInput(field.value).filter((value) => !remove.has(normalizeRulesText(value))).join(", ");
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function removeTextareaLines(textarea, lines = []) {
  if (!textarea || !lines.length) return;
  const remove = new Set(lines.map(normalizeRulesText));
  textarea.value = String(textarea.value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !remove.has(normalizeRulesText(line)))
    .join("\n");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function removeTextareaBlock(textarea, block = "") {
  if (!textarea || !block) return;
  const current = String(textarea.value || "");
  if (current.includes(block)) {
    textarea.value = current.replace(block, "").split(/\n+/).map((line) => line.trim()).filter(Boolean).join("\n");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  const currentBlocks = String(textarea.value || "").split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);
  const removeKey = normalizeRulesText(block);
  textarea.value = currentBlocks.filter((value) => normalizeRulesText(value) !== removeKey).join("\n\n");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function setBackgroundSkillCheckboxes(form, skillKeys = []) {
  const fixed = new Set(skillKeys);
  form.querySelectorAll?.('input[name="player-skill-proficiencies"]').forEach((input) => {
    if (!fixed.has(input.value)) return;
    input.checked = true;
    input.dataset.backgroundFixed = "true";
    input.closest("label")?.classList.add("is-fixed");
  });
}

function clearBackgroundSkillCheckboxes(form, skillKeys = []) {
  const remove = new Set(skillKeys);
  form.querySelectorAll?.('input[name="player-skill-proficiencies"]').forEach((input) => {
    if (!remove.has(input.value) || input.dataset.backgroundFixed !== "true") return;
    input.checked = false;
    input.disabled = false;
    delete input.dataset.backgroundFixed;
    input.closest("label")?.classList.remove("is-fixed");
  });
}

function clearManagedBackgroundPackage(form) {
  const previousEquipment = splitListInput(form.dataset.backgroundEquipment || "");
  const previousSkills = splitListInput(form.dataset.backgroundSkills || "");
  const previousTools = splitListInput(form.dataset.backgroundTools || "");
  removeTextareaLines(form.querySelector("#player-equipment"), previousEquipment);
  removeTextareaBlock(form.querySelector("#player-features"), form.dataset.backgroundFeatureText || "");
  removeFromHiddenListField(form, "#player-background-skills", previousSkills);
  removeFromHiddenListField(form, "#player-tool-proficiencies", previousTools);
  clearBackgroundSkillCheckboxes(form, previousSkills);
  delete form.dataset.backgroundEquipment;
  delete form.dataset.backgroundFeatureText;
  delete form.dataset.backgroundSkills;
  delete form.dataset.backgroundTools;
  delete form.dataset.backgroundEquipmentPackage;
  delete form.dataset.backgroundEquipmentGold;
  delete form.dataset.backgroundEquipmentChoice;
  const bonusField = form.querySelector("#player-background-ability-bonuses");
  if (bonusField) bonusField.value = "";
  const goldField = form.querySelector("#player-gold");
  if (goldField) goldField.value = "";
  const equipmentControls = form.querySelector("#player-background-equipment-controls");
  if (equipmentControls) {
    equipmentControls.hidden = true;
    equipmentControls.innerHTML = "";
  }
}

function applyBackgroundAbilityBonuses(form, bonuses = {}) {
  const field = form.querySelector("#player-background-ability-bonuses");
  if (field) {
    field.value = serializeAbilityBonuses(bonuses);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const controls = form.querySelector("#player-background-ability-controls");
  if (controls) {
    controls.dataset.applied = "true";
    controls.classList?.add("is-applied");
  }
}

function backgroundAbilityOptionMarkup(abilities = [], selected = "") {
  return abilities.map((ability) => {
    const key = abilityKeyForLabel(ability);
    const label = abilityLabelForValue(ability);
    return `<option value="${escapeHtml(key)}" ${key === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function backgroundAbilityMechanicsText(abilities = []) {
  const shorts = abilities.map((ability) => {
    const key = abilityKeyForLabel(ability);
    const short = ABILITIES.find((item) => item.key === key)?.short;
    return short ? `${short.slice(0, 1)}${short.slice(1).toLowerCase()}` : abilityLabelForValue(ability);
  }).filter(Boolean);
  return shorts.length ? `Choose from ${shorts.join("/")} (+2/+1 or +1/+1/+1)` : "";
}

function parseAbilityBonuses(value = "") {
  const bonuses = {};
  String(value || "").split(/[;,]/).forEach((part) => {
    const [rawKey, rawAmount] = part.split(":");
    const key = abilityKeyForLabel(rawKey);
    const amount = Number(rawAmount);
    if (key && Number.isFinite(amount) && amount) bonuses[key] = amount;
  });
  return bonuses;
}

function serializeAbilityBonuses(bonuses = {}) {
  return ABILITIES
    .map((ability) => [ability.key, Number(bonuses[ability.key]) || 0])
    .filter(([, amount]) => amount)
    .map(([key, amount]) => `${key}:${amount}`)
    .join(", ");
}

function backgroundAbilityBonusesFromForm(form) {
  return parseAbilityBonuses(formValue(form, "#player-background-ability-bonuses"));
}

function lineageAbilityBonusesFromForm(form) {
  return parseAbilityBonuses(formValue(form, "#player-lineage-ability-bonuses"));
}

function combineAbilityBonuses(...bonusSets) {
  return bonusSets.reduce((combined, bonuses) => {
    ABILITIES.forEach((ability) => {
      const amount = Number(bonuses?.[ability.key]) || 0;
      if (amount) combined[ability.key] = (Number(combined[ability.key]) || 0) + amount;
    });
    return combined;
  }, {});
}

function applyBackgroundBonusesToScores(scores = {}, bonuses = {}) {
  return Object.fromEntries(ABILITIES.map((ability) => {
    const base = Number(scores[ability.key]) || 0;
    const bonus = Number(bonuses[ability.key]) || 0;
    return [ability.key, base ? Math.min(20, base + bonus) : bonus || ""];
  }));
}

function renderBackgroundAbilityControls(form, background = {}) {
  const controls = form.querySelector("#player-background-ability-controls");
  if (!controls) return;
  const abilityKeys = background.abilityScores.map(abilityKeyForLabel).filter(Boolean);
  delete controls.dataset.abilityKeys;
  delete controls.dataset.boostMode;
  if (!abilityKeys.length) {
    controls.hidden = true;
    controls.innerHTML = "";
    return;
  }
  if (abilityKeys.length <= 2) {
    applyBackgroundAbilityBonuses(form, Object.fromEntries(abilityKeys.map((key) => [key, abilityKeys.length === 1 ? 2 : 1])));
    controls.hidden = true;
    controls.innerHTML = "";
    return;
  }
  controls.hidden = false;
  controls.dataset.applied = "false";
  controls.dataset.abilityKeys = abilityKeys.join(",");
  const mechanicsText = backgroundAbilityMechanicsText(background.abilityScores);
  controls.innerHTML = `
    <div class="background-ability-mechanics"><span>Mechanics: ability scores</span><p>${escapeHtml(mechanicsText)}</p></div>
    <div class="background-ability-mode-grid">
      <button class="btn btn-secondary" type="button" data-apply-background-ability-boosts aria-expanded="false" aria-controls="player-background-boost-fields">+2/+1</button>
      <button class="btn btn-secondary" type="button" data-apply-background-even-boosts>+1/+1/+1</button>
    </div>
    <div class="background-ability-select-grid" id="player-background-boost-fields" hidden>
      <label>+2
        <select id="player-background-boost-primary">${backgroundAbilityOptionMarkup(background.abilityScores, abilityKeys[0])}</select>
      </label>
      <label>+1
        <select id="player-background-boost-secondary">${backgroundAbilityOptionMarkup(background.abilityScores, abilityKeys[1])}</select>
      </label>
    </div>`;
}

function backgroundAbilityBonusSummary(form) {
  const bonuses = backgroundAbilityBonusesFromForm(form);
  return abilityBonusSummaryFromBonuses(bonuses);
}

function abilityBonusSummaryFromBonuses(bonuses = {}) {
  const parts = ABILITIES.map((ability) => {
    const amount = Number(bonuses[ability.key]) || 0;
    return amount ? `${ability.short} ${signedModifier(amount)}` : "";
  }).filter(Boolean);
  return parts.join(", ");
}

function applySelectedBackgroundAbilityBoosts(form) {
  setBackgroundAbilityBoostMode(form, "split");
  const primary = form.querySelector("#player-background-boost-primary")?.value;
  const secondarySelect = form.querySelector("#player-background-boost-secondary");
  let secondary = secondarySelect?.value;
  if (primary && secondary && primary === secondary) {
    secondary = Array.from(secondarySelect?.options || []).map((option) => option.value).find((value) => value && value !== primary);
    if (secondarySelect && secondary) secondarySelect.value = secondary;
  }
  if (!primary || !secondary || primary === secondary) return;
  applyBackgroundAbilityBonuses(form, { [primary]: 2, [secondary]: 1 });
}

function applyEvenBackgroundAbilityBoosts(form) {
  const controls = form.querySelector("#player-background-ability-controls");
  setBackgroundAbilityBoostMode(form, "even");
  const storedKeys = String(controls?.dataset?.abilityKeys || "").split(",").filter(Boolean);
  const keys = storedKeys.length ? storedKeys : Array.from(controls?.querySelectorAll("select") || [])
    .flatMap((select) => Array.from(select.options || []).map((option) => option.value))
    .filter(Boolean);
  applyBackgroundAbilityBonuses(form, Object.fromEntries(Array.from(new Set(keys)).slice(0, 3).map((key) => [key, 1])));
}

function setBackgroundAbilityBoostMode(form, mode) {
  const controls = form.querySelector("#player-background-ability-controls");
  if (controls?.dataset) controls.dataset.boostMode = mode;
  const splitFields = form.querySelector("#player-background-boost-fields");
  const splitButton = form.querySelector("[data-apply-background-ability-boosts]");
  const evenButton = form.querySelector("[data-apply-background-even-boosts]");
  if (splitFields) splitFields.hidden = mode !== "split";
  if (splitButton) {
    splitButton.setAttribute?.("aria-expanded", mode === "split" ? "true" : "false");
    splitButton.classList?.toggle("is-selected", mode === "split");
  }
  if (evenButton) evenButton.classList?.toggle("is-selected", mode === "even");
}

function setHiddenAbilityBonuses(form, selector, bonuses = {}) {
  const field = form.querySelector(selector);
  if (field) {
    field.value = serializeAbilityBonuses(bonuses);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function renderLineageAbilityControls(form, lineage = {}) {
  const controls = form.querySelector("#player-lineage-ability-controls");
  if (!controls) return;
  const asi = lineage.asi || "choice";
  if (asi !== "choice") {
    const fixed = Object.fromEntries(Object.entries(asi).filter(([key, amount]) => (
      ABILITIES.some((ability) => ability.key === key) && Number(amount)
    )));
    setHiddenAbilityBonuses(form, "#player-lineage-ability-bonuses", fixed);
    controls.hidden = true;
    controls.innerHTML = "";
    return;
  }
  controls.hidden = false;
  controls.innerHTML = `
    <div class="background-ability-mechanics"><span>Lineage ability scores</span><p>Choose any abilities (+2/+1 or +1/+1/+1)</p></div>
    <div class="background-ability-mode-grid">
      <button class="btn btn-secondary" type="button" data-apply-lineage-ability-boosts aria-expanded="false" aria-controls="player-lineage-boost-fields">+2/+1</button>
      <button class="btn btn-secondary" type="button" data-apply-lineage-even-boosts>+1/+1/+1</button>
    </div>
    <div class="background-ability-select-grid" id="player-lineage-boost-fields" hidden>
      <label>+2
        <select id="player-lineage-boost-primary">${ABILITIES.map((ability) => `<option value="${escapeHtml(ability.key)}">${escapeHtml(ability.label)}</option>`).join("")}</select>
      </label>
      <label>+1
        <select id="player-lineage-boost-secondary">${ABILITIES.map((ability, index) => `<option value="${escapeHtml(ability.key)}" ${index === 1 ? "selected" : ""}>${escapeHtml(ability.label)}</option>`).join("")}</select>
      </label>
    </div>`;
  applySelectedLineageAbilityBoosts(form);
}

function setLineageAbilityBoostMode(form, mode) {
  const splitFields = form.querySelector("#player-lineage-boost-fields");
  const splitButton = form.querySelector("[data-apply-lineage-ability-boosts]");
  const evenButton = form.querySelector("[data-apply-lineage-even-boosts]");
  if (splitFields) splitFields.hidden = mode !== "split";
  if (splitButton) {
    splitButton.setAttribute?.("aria-expanded", mode === "split" ? "true" : "false");
    splitButton.classList?.toggle("is-selected", mode === "split");
  }
  if (evenButton) evenButton.classList?.toggle("is-selected", mode === "even");
}

function applySelectedLineageAbilityBoosts(form) {
  setLineageAbilityBoostMode(form, "split");
  const primary = form.querySelector("#player-lineage-boost-primary")?.value;
  const secondarySelect = form.querySelector("#player-lineage-boost-secondary");
  let secondary = secondarySelect?.value;
  if (primary && secondary && primary === secondary) {
    secondary = Array.from(secondarySelect?.options || []).map((option) => option.value).find((value) => value && value !== primary);
    if (secondarySelect && secondary) secondarySelect.value = secondary;
  }
  if (!primary || !secondary || primary === secondary) return;
  setHiddenAbilityBonuses(form, "#player-lineage-ability-bonuses", { [primary]: 2, [secondary]: 1 });
}

function applyEvenLineageAbilityBoosts(form) {
  setLineageAbilityBoostMode(form, "even");
  setHiddenAbilityBonuses(form, "#player-lineage-ability-bonuses", Object.fromEntries(ABILITIES.slice(0, 3).map((ability) => [ability.key, 1])));
}

function lineageTraitTextForRace(race = "") {
  const lineage = lineagePackageForName(race);
  if (!lineage) return "";
  return (lineage.traits || [])
    .map((trait) => [
      `${trait} (Lineage trait)`,
      lineageTraitDescription(trait),
    ].filter(Boolean).join("\n"))
    .join("\n");
}

function applyLineagePackageToForm(form, lineage = {}) {
  if (!lineage?.name) return;
  const raceInput = form.querySelector("#player-race");
  if (raceInput) raceInput.value = lineage.name;
  const traitsField = form.querySelector("#player-lineage-traits");
  if (traitsField) {
    traitsField.value = lineageTraitTextForRace(lineage.name);
    traitsField.dispatchEvent(new Event("input", { bubbles: true }));
  }
  renderLineageAbilityControls(form, lineage);
  applyClassRestrictions(form);
  updatePlayerFormDerivedFields(form);
}

function renderBackgroundEquipmentControls(form, background = {}, equipmentParts = {}) {
  const controls = form.querySelector("#player-background-equipment-controls");
  if (!controls) return;
  const listedGold = Number(equipmentParts.gold) || 0;
  const listedItems = equipmentParts.items || [];
  controls.hidden = false;
  controls.innerHTML = `
    <div><span>Starting gold</span><strong>${escapeHtml(listedGold)} GP assigned</strong></div>
    <label class="background-equipment-option">
      <input type="radio" name="player-background-equipment-mode" value="package" checked />
      <span>Use listed equipment${listedItems.length ? ` (${escapeHtml(listedItems.length)} items)` : ""}</span>
    </label>
    <label class="background-equipment-option">
      <input type="radio" name="player-background-equipment-mode" value="gold" />
      <span>Take +${escapeHtml(BACKGROUND_GOLD_OPTION)} GP instead of the listed equipment</span>
    </label>`;
}

function syncBackgroundEquipmentChoiceControls(form, choice = "package") {
  form.querySelectorAll?.('input[name="player-background-equipment-mode"]').forEach((input) => {
    input.checked = input.value === choice;
  });
}

function applyBackgroundEquipmentChoice(form, choice = "package") {
  const selectedChoice = choice === "gold" ? "gold" : "package";
  const previousEquipment = splitListInput(form.dataset.backgroundEquipment || "");
  const packageEquipment = splitListInput(form.dataset.backgroundEquipmentPackage || "");
  const packageGold = Number(form.dataset.backgroundEquipmentGold) || 0;
  removeTextareaLines(form.querySelector("#player-equipment"), previousEquipment);
  const nextEquipment = selectedChoice === "gold" ? [] : packageEquipment;
  appendEquipmentItemsToSheet(form, nextEquipment);
  const goldField = form.querySelector("#player-gold");
  if (goldField) {
    goldField.value = String(selectedChoice === "gold" ? packageGold + BACKGROUND_GOLD_OPTION : packageGold);
    goldField.dispatchEvent(new Event("input", { bubbles: true }));
  }
  form.dataset.backgroundEquipment = nextEquipment.join(", ");
  form.dataset.backgroundEquipmentChoice = selectedChoice;
  syncBackgroundEquipmentChoiceControls(form, selectedChoice);
}

function applyBackgroundPackageToForm(form, background = {}) {
  const packageData = normalizeBackgroundPackage(background);
  if (!packageData.label) return;
  clearManagedBackgroundPackage(form);
  const backgroundInput = form.querySelector("#player-background");
  if (backgroundInput) {
    backgroundInput.value = packageData.label;
  }
  const skillKeys = skillKeysForLabels(packageData.skills);
  const equipmentParts = backgroundEquipmentParts(packageData.equipment);
  const equipmentItems = equipmentParts.items;
  const featureText = backgroundFeatureText(packageData);
  addToHiddenListField(form, "#player-background-skills", skillKeys);
  setBackgroundSkillCheckboxes(form, skillKeys);
  addToHiddenListField(form, "#player-tool-proficiencies", [packageData.toolProficiency]);
  appendTextareaValue(form.querySelector("#player-features"), featureText);
  form.dataset.backgroundEquipmentPackage = equipmentItems.join(", ");
  form.dataset.backgroundEquipmentGold = String(equipmentParts.gold || 0);
  form.dataset.backgroundFeatureText = featureText;
  form.dataset.backgroundSkills = skillKeys.join(", ");
  form.dataset.backgroundTools = packageData.toolProficiency;
  renderBackgroundEquipmentControls(form, packageData, equipmentParts);
  applyBackgroundEquipmentChoice(form, "package");
  renderBackgroundAbilityControls(form, packageData);
  applyClassRestrictions(form);
  updatePlayerFormDerivedFields(form);
}

function applyCharacterSuggestion(form, suggestion, textOverride = "") {
  if (suggestion.category === "racialTraits") return;
  if (suggestion.category === "backgrounds") {
    applyBackgroundPackageToForm(form, backgroundPackageFromSuggestion(suggestion));
    return;
  }
  const targetSelector = CHARACTER_SUGGESTION_TARGETS[suggestion.category];
  const target = targetSelector ? form.querySelector(targetSelector) : null;
  appendTextareaValue(target, textOverride || suggestionApplyText(suggestion));
}

function suggestionConfidenceLabel(value) {
  const percent = Math.round((Number(value) || 0) * 100);
  return `${percent}% match`;
}

function renderCharacterSuggestions(panel, payload = {}) {
  if (!panel) return;
  const suggestions = (Array.isArray(payload.suggestions) ? payload.suggestions : [])
    .filter((suggestion) => suggestion?.category === "backgrounds" || suggestion?.category === "feats");
  if (!suggestions.length) {
    panel.innerHTML = `<div class="suggestion-empty">No strong suggestions yet. Add more concrete motives, history, habits, or appearance details.</div>`;
    panel.hidden = false;
    return;
  }

  panel.innerHTML = `
    <div class="suggestion-panel-heading">
      <div>
        <h3>Suggested backgrounds and feats</h3>
        <p>Review mechanical suggestions before adding them to the sheet.</p>
      </div>
      <span>${escapeHtml(payload.model || "model")}</span>
    </div>
    <div class="suggestion-list">
      ${suggestions.map((suggestion, index) => `
        <article class="suggestion-card" data-suggestion-index="${escapeHtml(index)}">
          <div>
            <span class="suggestion-category">${escapeHtml(CHARACTER_SUGGESTION_LABELS[suggestion.category] || suggestion.category)}</span>
            <h4>${escapeHtml(suggestion.label)}</h4>
            <p>${escapeHtml(suggestion.description)}</p>
            ${suggestion.mechanics ? `<p><strong>Mechanics:</strong> ${escapeHtml(suggestion.mechanics)}</p>` : ""}
            <small>${escapeHtml(suggestion.explanation)} ${escapeHtml(suggestionConfidenceLabel(suggestion.confidence))}</small>
          </div>
          <div class="suggestion-actions">
            <button class="btn btn-secondary" type="button" data-apply-suggestion="${escapeHtml(index)}">Accept</button>
            <button class="btn btn-ghost" type="button" data-dismiss-suggestion="${escapeHtml(index)}">Reject</button>
          </div>
        </article>`).join("")}
    </div>
    <div class="suggestion-footer">
      <button class="btn btn-secondary" type="button" data-apply-all-suggestions>Accept all</button>
    </div>`;
  panel.dataset.suggestions = JSON.stringify(suggestions);
  panel.hidden = false;
}

function characterSuggestionsFromPanel(panel) {
  try {
    return JSON.parse(panel?.dataset.suggestions || "[]");
  } catch {
    return [];
  }
}

function cardVisualLabel(value) {
  return escapeHtml(
    String(value || "DM")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
  );
}

function initMobileNavigation() {
  const toggle = document.querySelector(".mobile-menu-toggle");
  const nav = document.querySelector(".topnav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function initCommandInterface() {
  const search = document.getElementById("global-search");
  const dmOnlyToggle = document.querySelector("[data-dm-only-toggle]");
  const deleteCampaignButton = document.getElementById("delete-campaign-button");
  let dmOnlyMode = false;

  function applyFilters() {
    const query = search ? search.value.trim().toLowerCase() : "";
    const dmOnlyTargets = getDmOnlyTargets();
    document.body.classList.toggle("dm-only-mode", dmOnlyMode);
    if (dmOnlyToggle) {
      dmOnlyToggle.classList.toggle("is-active", dmOnlyMode);
      dmOnlyToggle.setAttribute("aria-pressed", String(dmOnlyMode));
    }

    document.querySelectorAll("[data-searchable]").forEach((card) => {
      const matchesQuery = !query || (card.dataset.searchable || "").includes(query);
      const cardTarget = card.dataset.dmWidgetId;
      const isDmOnlyCard = isDmOnlyTarget(cardTarget, dmOnlyTargets);
      card.classList.toggle("is-filtered-out", !matchesQuery || (!dmOnlyMode && isDmOnlyCard));
      card.classList.toggle("is-dm-only", isDmOnlyCard);
    });

    document.querySelectorAll("[data-dm-part-target]").forEach((part) => {
      const isDmOnlyPart = isDmOnlyTarget(part.dataset.dmPartTarget, dmOnlyTargets);
      part.classList.toggle("is-filtered-out", !dmOnlyMode && isDmOnlyPart);
      part.classList.toggle("is-dm-only", isDmOnlyPart);
      part.setAttribute("aria-hidden", String(!dmOnlyMode && isDmOnlyPart));
    });
  }

  function markDmOnlyFromEvent(event) {
    if (!dmOnlyMode) return;
    const interactive = event.target.closest("a, button, input, select, textarea");
    const part = event.target.closest("[data-dm-part-target]");
    const card = event.target.closest("[data-dm-widget-id]");
    if (!part && !card) return;
    if (interactive && !part) return;

    event.preventDefault();
    event.stopPropagation();
    const target = part?.dataset.dmPartTarget || card?.dataset.dmWidgetId;
    toggleDmOnlyTarget(target);
    applyFilters();
  }

  if (search) search.addEventListener("input", applyFilters);
  document.addEventListener("dashboard:rendered", applyFilters);
  document.addEventListener("click", markDmOnlyFromEvent, true);

  if (dmOnlyToggle) {
    dmOnlyToggle.addEventListener("click", () => {
      dmOnlyMode = !dmOnlyMode;
      applyFilters();
    });
  }

  if (deleteCampaignButton) {
    deleteCampaignButton.addEventListener("click", () => {
      const campaign = currentCampaign();
      if (!confirm(`Delete "${campaign.name}" and all of its widgets?`)) return;
      deleteCampaign(campaign.id);
      window.location.href = campaignLibraryHref();
      window.location.reload();
    });
  }
}

function imagePreviewMarkup(image, label = "") {
  const title = image.title || image.originalFilename || label || "Uploaded image";
  const imageUrl = resolveBackendUrl(image.url);
  return `
    <figure class="image-preview">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" />
      <figcaption>${escapeHtml(title)}</figcaption>
    </figure>`;
}

function mediaImageCardMarkup(image, options = {}) {
  const title = image.title || image.originalFilename || "Uploaded image";
  const selectable = Boolean(options.selectable);
  const mediaType = image.mediaType || "Uncategorized";
  return `
    <article class="content-card entry-card image-card" data-image-card="${escapeHtml(image.id)}">
      ${imagePreviewMarkup(image, title)}
      <div class="card-kicker"><span class="status-badge status-active">${escapeHtml(mediaType)}</span><span>${escapeHtml(formatBytes(image.fileSize))}</span></div>
      <h3>${escapeHtml(title)}</h3>
      ${widgetTagsMarkup([formatUploadedAt(image.uploadedAt)])}
      <div class="entry-actions">
        ${selectable ? `<button class="btn btn-primary" type="button" data-select-media-image="${escapeHtml(image.id)}">Select</button>` : ""}
        <a class="btn btn-secondary" href="${escapeHtml(resolveBackendUrl(image.url))}" target="_blank" rel="noopener">Preview</a>
        ${selectable ? "" : `<button class="btn btn-secondary" type="button" data-edit-image="${escapeHtml(image.id)}">Edit</button>`}
        <button class="btn btn-danger" type="button" data-delete-image="${escapeHtml(image.id)}">Delete</button>
      </div>
    </article>`;
}

function imageUploadMarkup({ submitLabel = "Upload image" } = {}) {
  return `
    <form class="panel form-grid image-upload-form" data-image-upload-form>
      <label class="full-width">Title<input name="title" type="text" placeholder="Image title" /></label>
      <label class="full-width">Type<select name="mediaType" required>
        <option value="">Select a type...</option>
        <option value="Character">Character</option>
        <option value="Item">Item</option>
        <option value="Comic">Comic</option>
        <option value="Object">Object</option>
      </select></label>
      <div class="file-picker image-picker full-width" data-image-picker>
        <label>Image file</label>
        <input class="image-input" name="images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required />
        <button class="btn btn-secondary image-picker-button" type="button" data-image-trigger>Choose image</button>
        <span class="image-picker-status" data-image-status>No image chosen</span>
        <img class="image-picker-preview" data-image-preview alt="Selected image preview" hidden />
      </div>
      <div class="form-message full-width" data-image-upload-status aria-live="polite"></div>
      <button class="btn btn-primary" type="submit">${escapeHtml(submitLabel)}</button>
    </form>`;
}

async function chooseWidgetImage() {
  return openMediaPicker();
}

async function openMediaPicker() {
  const modal = document.createElement("div");
  modal.className = "media-picker-modal";
  modal.innerHTML = `
    <div class="media-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
      <div class="media-picker-header">
        <div><p class="eyebrow">Media picker</p><h2 id="media-picker-title">Choose an image</h2></div>
        <button class="btn btn-ghost" type="button" data-close-media-picker>Close</button>
      </div>
      <section>
        <div class="media-toolbar">
          <button class="btn btn-secondary" type="button" data-refresh-media-picker>Refresh</button>
        </div>
        <div class="media-library-grid" data-media-picker-list></div>
      </section>
    </div>`;
  document.body.appendChild(modal);

  return new Promise((resolve, reject) => {
    const close = (value) => {
      modal.remove();
      resolve(value || null);
    };
    const list = modal.querySelector("[data-media-picker-list]");

    async function loadPickerImages() {
      list.innerHTML = `<div class="empty-state">Loading images...</div>`;
      try {
        const images = await listImages();
        list.innerHTML = images.length
          ? images.map((image) => mediaImageCardMarkup(image, { selectable: true })).join("")
          : `<div class="empty-state">No media images yet. Upload images from the Media page, then select them here.</div>`;
      } catch (error) {
        list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      }
    }

    modal.addEventListener("click", async (event) => {
      if (event.target === modal || event.target.closest("[data-close-media-picker]")) close(null);
      const selectId = event.target?.dataset?.selectMediaImage;
      if (selectId) {
        try {
          close(await fetchJson(`/api/uploads/images/${encodeURIComponent(selectId)}`));
        } catch (error) {
          reject(error);
          modal.remove();
        }
      }
    });
    modal.querySelector("[data-refresh-media-picker]").addEventListener("click", loadPickerImages);
    loadPickerImages();
  });
}

function wireDmOnlyWidgetTargets(root = document) {
  root.querySelectorAll("[data-dm-widget-id]").forEach((card) => {
    const widgetTarget = card.dataset.dmWidgetId;
    if (!widgetTarget) return;
    card.setAttribute("title", "Click to edit. In DM-only mode, select or unselect this widget for player visibility");
    card.querySelectorAll(".widget-media, .widget-description").forEach((part) => {
      part.dataset.dmPartTarget = `${widgetTarget}:details`;
      part.setAttribute("title", "Click to edit. In DM-only mode, select or unselect this icon and description for player visibility");
    });
    card.querySelectorAll(".item-stat-icons").forEach((part) => {
      part.dataset.dmPartTarget = `${widgetTarget}:stats`;
      part.setAttribute("title", "DM-only mode: select or unselect these statistics for player visibility");
    });
    card.querySelectorAll(".item-feature-block").forEach((part, index) => {
      part.dataset.dmPartTarget = `${widgetTarget}:feature:${index}`;
      part.setAttribute("title", "DM-only mode: select or unselect this feature for player visibility");
    });
  });
}

function formIdForCollection(key) {
  return `${String(key || "").replace(/s$/, "")}-form`;
}

function setFieldValue(selector, value) {
  const field = document.querySelector(selector);
  if (field) field.value = value ?? "";
}

function commaTags(value) {
  return entryTags(value).join(", ");
}

function firstItemFeature(item) {
  return itemFeatureList(item.features)[0] || {};
}

function splitListInput(value = "") {
  return String(value || "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function backgroundStatistics(item = {}) {
  return item?.statistics && typeof item.statistics === "object" && !Array.isArray(item.statistics)
    ? item.statistics
    : {};
}

function backgroundStatList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : splitListInput(value);
}

function backgroundMechanicsText(stats = {}) {
  const abilityScores = backgroundStatList(stats.abilityScores);
  const skills = backgroundStatList(stats.skills);
  return [
    abilityScores.length ? `Ability scores: ${abilityScores.join("/")}.` : "",
    stats.originFeat ? `Origin feat: ${stats.originFeat}.` : "",
    skills.length ? `Skills: ${skills.join(", ")}.` : "",
    stats.toolProficiency ? `Tool: ${stats.toolProficiency}.` : "",
    stats.equipment ? `Equipment: ${stats.equipment}` : "",
  ].filter(Boolean).join(" ");
}

function normalizeBackgroundPackage(background = {}) {
  return {
    label: String(background.label || background.name || "").trim(),
    description: String(background.description || "").trim(),
    abilityScores: backgroundStatList(background.abilityScores).map(abilityLabelForValue).filter(Boolean),
    originFeat: String(background.originFeat || "").trim(),
    skills: backgroundStatList(background.skills),
    toolProficiency: String(background.toolProficiency || "").trim(),
    equipment: String(background.equipment || "").replace(/^Choose A or B:\s*\(A\)\s*/i, "").replace(/;\s*or\s*\(B\)\s*50\s*GP\.?$/i, "").trim(),
  };
}

function parseBackgroundMechanics(mechanics = "") {
  const text = String(mechanics || "");
  const matchSection = (label, nextLabels = []) => {
    const nextPattern = nextLabels.length ? `(?=\\s+(?:${nextLabels.join("|")}):|$)` : "$";
    const match = text.match(new RegExp(`${label}:\\s*([\\s\\S]*?)${nextPattern}`, "i"));
    return match?.[1]?.trim().replace(/\.$/, "") || "";
  };
  return normalizeBackgroundPackage({
    abilityScores: splitListInput(matchSection("Ability scores?", ["Origin feat", "Feat", "Skills?", "Skill Proficiencies", "Tool", "Equipment"]).replace(/\//g, ",")),
    originFeat: matchSection("(?:Origin feat|Feat)", ["Skills?", "Skill Proficiencies", "Tool", "Equipment"]),
    skills: splitListInput(matchSection("(?:Skills?|Skill Proficiencies)", ["Tool", "Equipment"]).replace(/\s+and\s+/gi, ", ")),
    toolProficiency: matchSection("Tool(?: Proficiency)?", ["Equipment"]),
    equipment: matchSection("Equipment"),
  });
}

function backgroundPackageFromSuggestion(suggestion = {}) {
  const standard = backgroundPackageForName(suggestion.label);
  if (standard) {
    return normalizeBackgroundPackage({
      ...standard,
      description: suggestion.description || standard.description,
    });
  }
  const parsed = parseBackgroundMechanics(suggestion.mechanics);
  return normalizeBackgroundPackage({
    ...parsed,
    label: suggestion.label,
    description: suggestion.description,
  });
}

function backgroundPackageForName(name = "") {
  const normalized = normalizeRulesText(name);
  if (!normalized) return null;
  const standard = BACKGROUND_PACKAGES.find((background) => normalizeRulesText(background.label) === normalized);
  if (standard) return normalizeBackgroundPackage(standard);
  const homebrew = getStoredCollection("items").find((item) => (
    String(item?.type || "").trim().toLowerCase() === "background"
    && normalizeRulesText(item?.name) === normalized
  ));
  if (!homebrew) return null;
  return normalizeBackgroundPackage({
    label: homebrew.name,
    description: homebrew.description,
    ...backgroundStatistics(homebrew),
  });
}

function backgroundOptionNames() {
  const standard = BACKGROUND_PACKAGES.map((background) => background.label);
  const homebrew = getStoredCollection("items")
    .filter((item) => String(item?.type || "").trim().toLowerCase() === "background")
    .map((item) => String(item?.name || "").trim())
    .filter(Boolean);
  return Array.from(new Set([...standard, ...homebrew])).sort((a, b) => a.localeCompare(b));
}

function backgroundFeatureText(background = {}) {
  const lines = [
    background.originFeat ? `${background.originFeat} (Feat)` : "",
    background.originFeat ? featDescriptionForName(background.originFeat) : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function backgroundNarrativeDescription(background = {}) {
  return String(background.description || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^(source|date|package|mechanics|ability scores?|origin feat|skills?|skill proficienc(?:y|ies)|tool proficienc(?:y|ies)|equipment)\s*:/i.test(line))
    .join("\n");
}

function backgroundEffectTags(background = {}, backgroundBonusTags = []) {
  const skills = (background.skills || []).filter(Boolean).join(", ");
  const gold = gpFromText(background.equipment);
  return [
    background.originFeat ? `Feat: ${background.originFeat}` : "",
    backgroundBonusTags.length ? `Ability bonuses: ${backgroundBonusTags.join(", ")}` : "",
    skills ? `Skills: ${skills}` : "",
    background.toolProficiency ? `Tool: ${background.toolProficiency}` : "",
    gold ? `Starting gold: ${gold} GP` : "",
  ].filter(Boolean);
}

function backgroundEquipmentParts(equipment = "") {
  const items = splitListInput(equipment).filter((item) => !/\b\d+\s*GP\b/i.test(item));
  return { items, gold: gpFromText(equipment) };
}

async function syncBackgroundSuggestionFile(entry = {}) {
  if (entry.type !== "Background") return null;
  const stats = backgroundStatistics(entry);
  try {
    return await fetchJson("/api/character-suggestions/backgrounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: entry.name,
        description: entry.description,
        abilityScores: stats.abilityScores || [],
        originFeat: stats.originFeat || "",
        skills: stats.skills || [],
        toolProficiency: stats.toolProficiency || "",
        equipment: stats.equipment || "",
        tags: entry.tags || [],
      }),
    });
  } catch (error) {
    console.warn("Could not sync background to character suggestions file", error);
    return null;
  }
}

function syncFormImagePreview(form, entry = {}) {
  const mediaPicker = form?.querySelector("[data-media-select]");
  if (mediaPicker) {
    const image = imageFromEntry(entry);
    setMediaSelectImage(mediaPicker, image, image ? "Existing media image kept" : "No image chosen");
    return;
  }

  const picker = form?.querySelector("[data-image-picker]");
  if (!picker) return;
  const status = picker.querySelector("[data-image-status]");
  const preview = picker.querySelector("[data-image-preview]");
  const imageUrl = entry.imageUrl || entry.imageDataUrl || entry.image?.url;
  if (status) {
    status.textContent = imageUrl ? "Existing image kept" : "No image chosen";
    status.classList.remove("error");
  }
  if (preview) {
    if (imageUrl) {
      preview.src = resolveBackendUrl(imageUrl);
      preview.hidden = false;
    } else {
      preview.removeAttribute("src");
      preview.hidden = true;
    }
  }
}

function populateWidgetForm(key, entry) {
  if (key === "encounters") {
    setFieldValue("#encounter-title", firstDisplayText([entry.title, entry.name], ""));
    setFieldValue("#encounter-tier", firstDisplayText([entry.tier, entry.type, entry.sceneType], ""));
    setFieldValue("#encounter-status", entry.status || "prepared");
    setFieldValue("#encounter-tags", commaTags(entry.tags));
    setFieldValue("#encounter-description", firstDisplayText([entry.description, entry.notes, entry.content], ""));
  } else if (key === "locations") {
    setFieldValue("#location-name", firstDisplayText([entry.name, entry.title], ""));
    setFieldValue("#location-type", firstDisplayText([entry.type, entry.regionType], ""));
    setFieldValue("#location-status", entry.status || "active");
    setFieldValue("#location-tags", commaTags(entry.tags));
    setFieldValue("#location-description", firstDisplayText([entry.description, entry.notes, entry.content], ""));
  } else if (key === "notes") {
    setFieldValue("#note-title", entry.title || "");
    setFieldValue("#note-category", entry.category || "Session Note");
    setFieldValue("#note-content", entry.content || "");
  } else if (key === "characters") {
    setFieldValue("#character-name", entry.name || "");
    setFieldValue("#character-role", entry.role || "");
    setFieldValue("#character-faction", entry.faction || "");
    setFieldValue("#character-notes", entry.notes || "");
  } else if (key === "items") {
    const feature = firstItemFeature(entry);
    const stats = entry.statistics || {};
    const selectedProperties = new Set(weaponPropertyKeys(stats.properties));
    setFieldValue("#item-name", entry.name || "");
    setFieldValue("#item-type", entry.type || "Weapon");
    document.getElementById("item-type")?.dispatchEvent(new Event("change", { bubbles: true }));
    setFieldValue("#item-weapon-damage", damageDiceFromStats(stats));
    setFieldValue("#item-weapon-damage-type", damageTypeFromStats(stats));
    setFieldValue("#item-weapon-range", stats.range || "");
    setFieldValue("#item-weapon-attack", stats.attackBonus ?? stats.attack ?? stats.bonus ?? "");
    setFieldValue("#item-weapon-damage-bonus", stats.damageBonus ?? stats.bonus ?? "");
    setFieldValue("#item-weapon-versatile-damage", stats.versatileDamage || "");
    document.querySelectorAll('input[name="item-weapon-properties"]').forEach((input) => {
      input.checked = selectedProperties.has(input.value);
    });
    document.getElementById("item-weapon-section")?.dispatchEvent(new Event("change", { bubbles: true }));
    setFieldValue("#item-weapon-feature-title", feature.title || "");
    setFieldValue("#item-weapon-feature-description", feature.description || "");
    setFieldValue("#item-background-abilities", backgroundStatList(stats.abilityScores).join(", "));
    setFieldValue("#item-background-origin-feat", stats.originFeat || "");
    setFieldValue("#item-background-skills", backgroundStatList(stats.skills).join(", "));
    setFieldValue("#item-background-tool", stats.toolProficiency || "");
    setFieldValue("#item-background-equipment", stats.equipment || "");
    setFieldValue("#item-background-tags", commaTags(entry.tags));
    setFieldValue("#item-description", entry.description || "");
  } else if (key === "events") {
    populateCalendarFormDefaults();
    setFieldValue("#event-title", entry.title || "");
    setFieldValue("#event-month", String(entry.monthIndex ?? getCalendarSettings().currentMonthIndex));
    setFieldValue("#event-day", entry.day || 1);
    setFieldValue("#event-year", entry.year || getCalendarSettings().currentYear);
    setFieldValue("#event-hour", Number.isFinite(Number(entry.hour)) ? entry.hour : "");
    setFieldValue("#event-description", entry.description || "");
  }
}

function setFormEditState(form, key, entry) {
  const label = WIDGET_FORM_LABELS[key] || "Widget";
  const submit = form.querySelector('button[type="submit"]');
  form.dataset.editId = entry.id;
  form.dataset.editKey = key;
  form.classList.add("is-editing");
  if (submit) {
    if (!submit.dataset.defaultText) submit.dataset.defaultText = submit.textContent;
    submit.textContent = `Update ${label}`;
  }
  const cancelButton = form.querySelector("[data-cancel-edit]");
  if (cancelButton) cancelButton.hidden = false;
}

function resetFormEditState(form) {
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  delete form.dataset.editId;
  delete form.dataset.editKey;
  form.classList.remove("is-editing");
  if (submit?.dataset.defaultText) submit.textContent = submit.dataset.defaultText;
  const cancelButton = form.querySelector("[data-cancel-edit]");
  if (cancelButton) cancelButton.hidden = true;
}

function cancelWidgetEdit(form) {
  form.reset();
  resetImagePickers(form);
  resetFormEditState(form);
  populateCalendarFormDefaults();
}

function ensureEditCancelButton(form, key) {
  if (form.querySelector("[data-cancel-edit]")) return;
  const submit = form.querySelector('button[type="submit"]');
  if (!submit) return;
  if (!submit.dataset.defaultText) submit.dataset.defaultText = submit.textContent;
  const cancel = document.createElement("button");
  cancel.className = "btn btn-secondary";
  cancel.type = "button";
  cancel.hidden = true;
  cancel.dataset.cancelEdit = key;
  cancel.textContent = "Cancel edit";
  cancel.addEventListener("click", () => cancelWidgetEdit(form));
  submit.insertAdjacentElement("afterend", cancel);
}

function startEditingWidget(key, entryId) {
  const entry = getStoredCollection(key).find((item) => item.id === entryId);
  const form = document.getElementById(formIdForCollection(key));
  if (!entry || !form) return;
  form.reset();
  resetImagePickers(form);
  populateWidgetForm(key, entry);
  syncFormImagePreview(form, entry);
  setFormEditState(form, key, entry);
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  const firstField = form.querySelector("input, select, textarea");
  firstField?.focus({ preventScroll: true });
}

function widgetDetailTitle(key, entry = {}) {
  if (key === "encounters") return firstDisplayText([entry.title, entry.name], "Untitled encounter");
  if (key === "locations") return firstDisplayText([entry.name, entry.title], "Untitled location");
  if (key === "notes") return firstDisplayText([entry.title], "Untitled note");
  if (key === "characters") return firstDisplayText([entry.name], "Untitled character");
  if (key === "items") return firstDisplayText([entry.name], "Untitled item");
  if (key === "events") return firstDisplayText([entry.title], "Untitled event");
  return firstDisplayText([entry.title, entry.name], "Widget");
}

function widgetDetailRows(rows = []) {
  return rows
    .filter(([, value]) => String(value ?? "").trim())
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
}

function widgetDetailDescription(label, value) {
  const text = String(value || "").trim();
  return text ? `<section class="widget-detail-section"><h3>${escapeHtml(label)}</h3><p>${escapeHtml(text)}</p></section>` : "";
}

function widgetDetailContent(key, entry = {}) {
  if (key === "items") {
    return widgetDetailDescription("Description", entry.description);
  }

  if (key === "encounters") {
    return `
      <dl class="widget-detail-meta">${widgetDetailRows([
        ["Tier", firstDisplayText([entry.tier, entry.type, entry.sceneType], "")],
        ["Status", statusLabel(entry.status || "prepared")],
        ["Tags", entryTags(entry.tags).join(", ")],
        ["Created", entry.createdAt],
      ])}</dl>
      ${widgetDetailDescription("Description", firstDisplayText([entry.description, entry.notes, entry.content], ""))}`;
  }

  if (key === "locations") {
    return `
      <dl class="widget-detail-meta">${widgetDetailRows([
        ["Type", firstDisplayText([entry.type, entry.regionType], "")],
        ["Status", statusLabel(entry.status || "active")],
        ["Tags", entryTags(entry.tags).join(", ")],
        ["Created", entry.createdAt],
      ])}</dl>
      ${widgetDetailDescription("Description", firstDisplayText([entry.description, entry.notes, entry.content], ""))}`;
  }

  if (key === "characters") {
    return `
      <dl class="widget-detail-meta">${widgetDetailRows([
        ["Role", entry.role],
        ["Faction", entry.faction || "Unaligned"],
        ["Created", entry.createdAt],
      ])}</dl>
      ${widgetDetailDescription("Notes", entry.notes)}`;
  }

  if (key === "events") {
    return `
      <dl class="widget-detail-meta">${widgetDetailRows([
        ["Date", eventDateLabel(entry)],
        ["Created", entry.createdAt],
      ])}</dl>
      ${widgetDetailDescription("Description", entry.description)}`;
  }

  return `
    <dl class="widget-detail-meta">${widgetDetailRows([
      ["Category", entry.category],
      ["Created", entry.createdAt],
    ])}</dl>
    ${widgetDetailDescription("Content", entry.content || entry.description || entry.notes)}`;
}

function openWidgetDetail(key, entryId) {
  const entry = getStoredCollection(key).find((item) => item.id === entryId);
  if (!entry) return;
  const title = widgetDetailTitle(key, entry);
  const imageUrl = resolveBackendUrl(entry.imageUrl || entry.imageDataUrl || entry.image?.url);
  const modal = document.createElement("div");
  modal.className = "modal-backdrop widget-detail-modal";
  modal.innerHTML = `
    <button class="widget-detail-close" type="button" data-close-widget-detail aria-label="Close widget detail">×</button>
    <article class="event-detail-dialog widget-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="widget-detail-title">
      <div class="widget-detail-layout ${imageUrl ? "has-media" : ""}">
        <div class="widget-detail-main">
          <p class="eyebrow">${escapeHtml(WIDGET_FORM_LABELS[key] || "Widget")}</p>
          <h2 id="widget-detail-title">${escapeHtml(title)}</h2>
          ${widgetDetailContent(key, entry)}
        </div>
        ${imageUrl ? `
        <aside class="widget-detail-media" aria-label="${escapeHtml(title)} image">
          <img class="widget-detail-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)} image" />
        </aside>` : ""}
      </div>
    </article>`;

  function close() {
    modal.remove();
    document.body.classList.remove("widget-detail-open");
    document.removeEventListener("keydown", onKeydown);
  }

  function onKeydown(event) {
    if (event.key === "Escape") close();
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-close-widget-detail]")) close();
  });
  document.addEventListener("keydown", onKeydown);
  document.body.classList.add("widget-detail-open");
  document.body.appendChild(modal);
  modal.querySelector("[data-close-widget-detail]")?.focus();
}

function openWeaponPropertyOverlay(label = "", detail = "") {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop weapon-property-modal";
  modal.innerHTML = `
    <article class="weapon-property-dialog" role="dialog" aria-modal="true" aria-labelledby="weapon-property-title">
      <button class="modal-close" type="button" data-close-property-info aria-label="Close property details">×</button>
      <p class="eyebrow">Weapon property</p>
      <h2 id="weapon-property-title">${escapeHtml(label || "Property")}</h2>
      <p>${escapeHtml(detail || "No property description available.")}</p>
    </article>`;

  function close() {
    modal.remove();
    document.removeEventListener("keydown", onKeydown);
  }

  function onKeydown(event) {
    if (event.key === "Escape") close();
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-close-property-info]")) close();
  });
  document.addEventListener("keydown", onKeydown);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-property-info]")?.focus();
}

function initWeaponPropertyInfo() {
  if (document.body?.dataset.weaponPropertyInfoReady === "true") return;
  if (document.body?.dataset) document.body.dataset.weaponPropertyInfoReady = "true";
  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-property-info]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    openWeaponPropertyOverlay(button.dataset.propertyLabel, button.dataset.propertyDetail);
  });
}

function wireWidgetInteractions(list, key) {
  list.querySelectorAll("[data-edit-key][data-edit-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (document.body.classList.contains("dm-only-mode")) return;
      if (event.target.closest("a, button, input, select, textarea")) return;
      openWidgetDetail(card.dataset.editKey, card.dataset.editId);
    });
  });

  list.querySelectorAll("[data-edit-action-id]").forEach((button) => {
    button.addEventListener("click", () => startEditingWidget(key, button.dataset.editActionId));
  });
}

function renderCollection({ key, listId, emptyText, template, getCollection }) {
  const list = document.getElementById(listId);
  if (!list) return;

  const collection = (getCollection ? getCollection() : getStoredCollection(key)).filter(Boolean);
  if (!collection.length) {
    list.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  list.innerHTML = collection.map((entry) => template(entry)).join("");
  wireWidgetInteractions(list, key);

  list.querySelectorAll("[data-image-upload-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const image = await chooseWidgetImage();
        if (!image) return;
        const nextCollection = getStoredCollection(key).map((entry) => (
          entry.id === button.dataset.imageUploadId ? { ...entry, ...imageFields(image) } : entry
        ));
        saveCollection(key, nextCollection);
        renderDashboard();
        renderCampaignCalendar();
      } catch (error) {
        alert(error.message);
      }
    });
  });

  list.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextCollection = getStoredCollection(key).filter((entry) => entry.id !== button.dataset.deleteId);
      saveCollection(key, nextCollection);
      renderDashboard();
      renderCampaignCalendar();
    });
  });
}

function playerCharacterCard(player) {
  const title = playerDisplayName(player);
  const searchable = textForSearch([player.playerName, player.characterName, player.classRole, player.race, player.background, "player character party"]);
  const imageEntry = { id: player.id, imageUrl: player.avatarUrl, imageDataUrl: player.avatarUrl, image: player.image };
  const campaignId = player.campaignId || DEFAULT_CAMPAIGN_ID;
  const armorClass = player.combat?.armorClass || "AC";
  const hitPoints = player.combat?.hitPointMaximum || "HP";
  const passive = playerPassivePerception(player);
  const sheetHref = playerCharacterHref(campaignId, player.id);
  const levelUpHref = playerLevelUpHref(campaignId, player.id);
  return `
    <article class="content-card entry-card widget-card player-card player-preview-card" ${widgetDmAttribute("players", player)} data-searchable="${escapeHtml(searchable)}" data-status="active">
      <div class="player-preview-details">
        <div class="card-kicker"><span class="status-badge status-active">Player</span><span>${escapeHtml(player.classRole || "Party member")}</span></div>
        <h3>${escapeHtml(title)}</h3>
        ${widgetDescriptionMarkup(player.description)}
        <dl class="player-preview-stats">
          <div><dt>Level</dt><dd>${escapeHtml(player.level || "1")}</dd></div>
          <div><dt>AC</dt><dd>${escapeHtml(armorClass)}</dd></div>
          <div><dt>HP</dt><dd>${escapeHtml(hitPoints)}</dd></div>
          <div><dt>Passive</dt><dd>${escapeHtml(passive)}</dd></div>
        </dl>
        ${widgetTagsMarkup([`Player: ${player.playerName}`, player.race, player.background])}
        <div class="entry-actions">
          <a class="btn btn-primary" href="${escapeHtml(levelUpHref)}">Level up</a>
          <a class="btn btn-secondary" href="${escapeHtml(sheetHref)}">Open sheet</a>
          <button class="btn btn-danger" type="button" data-delete-player-id="${escapeHtml(player.id)}" data-campaign-id="${escapeHtml(campaignId)}">Delete player</button>
        </div>
      </div>
      <div class="player-preview-media-column">
        ${widgetImageMarkup(imageEntry, title)}
      </div>
    </article>`;
}

function renderDashboardOverview() {
  const grid = document.getElementById("campaigns");
  if (!grid) return;
  const campaign = currentCampaign();
  const section = grid.closest(".campaign-party-overview");
  const ready = campaignReady(campaign);
  if (section) section.hidden = !ready;
  if (!ready) {
    grid.innerHTML = "";
    return;
  }
  const playerCards = (campaign.players || []).map(playerCharacterCard);
  grid.innerHTML = playerCards.length
    ? playerCards.join("")
    : `<div class="empty-state">No player widgets yet. Create player characters to populate this campaign overview.</div>`;
  grid.querySelectorAll("[data-image-upload-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const image = await chooseWidgetImage();
        if (!image) return;
        updatePlayerImage(campaign.id, button.dataset.imageUploadId, image);
        renderDashboard();
      } catch (error) {
        alert(error.message);
      }
    });
  });
  wireDmOnlyWidgetTargets(grid);
  grid.querySelectorAll("[data-delete-player-id]").forEach((button) => {
    button.addEventListener("click", () => {
      deletePlayerFromCampaign(button.dataset.campaignId || DEFAULT_CAMPAIGN_ID, button.dataset.deletePlayerId);
      renderDashboard();
    });
  });
}

function renderDashboard() {
  renderDashboardOverview();

  renderCollection({
    key: "encounters",
    listId: "encounters-list",
    emptyText: "No encounters yet. Add one to prepare a scene, hazard, or combat card.",
    template: (encounter) => {
      const status = encounter.status || "prepared";
      const title = firstDisplayText([encounter.title, encounter.name], "Untitled encounter");
      const tier = firstDisplayText([encounter.tier, encounter.type, encounter.sceneType], "Encounter");
      const description = firstDisplayText([encounter.description, encounter.notes, encounter.content], "Add creatures, hazards, clues, terrain, and rewards for this encounter.");
      const tags = entryTags(encounter.tags);
      const searchable = textForSearch([title, tier, description, tags.join(" "), "encounter scene combat"]);
      return `
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(encounter)} ${widgetDmAttribute("encounters", encounter)} ${widgetEditAttribute("encounters", encounter)} data-searchable="${escapeHtml(searchable)}" data-status="${escapeHtml(status)}">
          ${widgetImageMarkup(encounter, title)}
          <div class="card-kicker"><span class="status-badge ${statusBadgeClass(status)}">${statusLabel(status)}</span><span>${escapeHtml(tier)}</span></div>
          <h3>${escapeHtml(title)}</h3>
          ${widgetDescriptionMarkup(description)}
          ${widgetTagsMarkup([encounter.createdAt, ...tags])}
${widgetActionMarkup(encounter, { edit: "Modify encounter", delete: "Delete encounter" })}
        </article>`;
    },
  });

  renderCollection({
    key: "locations",
    listId: "locations-list",
    emptyText: "No locations yet. Add a place, faction site, region, or route.",
    template: (location) => {
      const status = location.status || "active";
      const name = firstDisplayText([location.name, location.title], "Untitled location");
      const type = firstDisplayText([location.type, location.regionType], "Location");
      const description = firstDisplayText([location.description, location.notes, location.content], "Add terrain, factions, secrets, routes, and hooks for this location.");
      const tags = entryTags(location.tags);
      const searchable = textForSearch([name, type, description, tags.join(" "), "location atlas place faction"]);
      return `
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(location)} ${widgetDmAttribute("locations", location)} ${widgetEditAttribute("locations", location)} data-searchable="${escapeHtml(searchable)}" data-status="${escapeHtml(status)}">
          ${widgetImageMarkup(location, name)}
          <div class="card-kicker"><span class="status-badge ${statusBadgeClass(status)}">${statusLabel(status)}</span><span>${escapeHtml(type)}</span></div>
          <h3>${escapeHtml(name)}</h3>
          ${widgetDescriptionMarkup(description)}
          ${widgetTagsMarkup([location.createdAt, ...tags])}
${widgetActionMarkup(location, { edit: "Modify location", delete: "Delete location" })}
        </article>`;
    },
  });

  renderCollection({
    key: "notes",
    listId: "notes-list",
    emptyText: "No saved notes yet. Add one above to begin your campaign wiki.",
    getCollection: sortedNotes,
    template: (note) => {
      const searchable = textForSearch([note.title, note.category, note.content, note.createdAt, "note campaign wiki"]);
      const noteDate = note.campaignStartDate ? `Campaign begins ${note.createdAt}` : note.createdAt;
      return `
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(note)} ${widgetDmAttribute("notes", note)} ${widgetEditAttribute("notes", note)} data-searchable="${escapeHtml(searchable)}" data-status="active">
          <div class="card-kicker"><span class="status-badge status-active">${escapeHtml(note.category)}</span><span>Note</span></div>
          <h3>${escapeHtml(note.title)}</h3>
          ${widgetDescriptionMarkup(note.content)}
          ${widgetTagsMarkup([noteDate, "Backlinks soon"])}
${widgetActionMarkup(note, { edit: "Modify note", delete: "Delete note" })}
        </article>`;
    },
  });

  renderCollection({
    key: "characters",
    listId: "characters-list",
    emptyText: "No saved characters yet. Add an NPC, ally, villain, or faction contact.",
    template: (character) => {
      const searchable = textForSearch([character.name, character.role, character.faction, character.notes, "npc character"]);
      return `
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(character)} ${widgetDmAttribute("characters", character)} ${widgetEditAttribute("characters", character)} data-searchable="${escapeHtml(searchable)}" data-status="active">
          ${widgetImageMarkup(character, character.name)}
          <div class="card-kicker"><span class="status-badge status-active">NPC</span><span>${escapeHtml(character.role)}</span></div>
          <h3>${escapeHtml(character.name)}</h3>
          ${widgetDescriptionMarkup(character.notes)}
          ${widgetTagsMarkup([`Faction: ${character.faction || "Unaligned"}`, character.createdAt, "NPC"])}
${widgetActionMarkup(character, { edit: "Modify NPC", delete: "Delete NPC" })}
        </article>`;
    },
  });

  renderCollection({
    key: "items",
    listId: "items-list",
    emptyText: "No saved homebrew yet. Add a weapon, spell, monster, background, or magic item.",
    template: (item) => {
      const status = item.type === "Monster" ? "prepared" : "active";
      const statusLabel = item.type === "Monster" ? "Prepared" : "Active";
      const stats = item.statistics || {};
      const features = itemFeatureList(item.features);
      const featureSearch = features.map((feature) => `${feature.title} ${feature.description}`).join(" ");
      const showDescription = item.type !== "Weapon" || !features.length;
      const tags = entryTags(item.tags);
      const backgroundText = item.type === "Background" ? backgroundMechanicsText(stats) : "";
      const searchable = textForSearch([item.name, item.type, item.description, stats.damage, stats.damageDice, stats.damageType, stats.range, stats.attackBonus, stats.damageBonus, stats.bonus, stats.attack, weaponPropertiesText(stats.properties), backgroundText, tags.join(" "), featureSearch, "item homebrew monster loot background"]);
      return `
        <article class="content-card entry-card widget-card item-card" ${widgetOriginAttribute(item)} ${widgetDmAttribute("items", item)} ${widgetEditAttribute("items", item)} data-searchable="${escapeHtml(searchable)}" data-status="${status}">
          <div class="item-card-details">
            <div class="card-kicker"><span class="status-badge ${status === "prepared" ? "status-prepared" : "status-active"}">${statusLabel}</span><span>${escapeHtml(item.type)}</span></div>
            <h3>${escapeHtml(item.name)}</h3>
            ${itemWeaponStatsMarkup(item)}
            ${itemBackgroundStatsMarkup(item)}
            ${itemWeaponPropertyBlocksMarkup(item)}
            ${showDescription ? widgetDescriptionMarkup(item.description) : ""}
            ${itemFeatureBlocksMarkup(item)}
            ${widgetTagsMarkup([item.createdAt, item.type === "Background" ? "Character background" : "Loot & rules", ...tags])}
${widgetActionMarkup(item, { edit: "Modify item", delete: "Delete item" })}
          </div>
          <div class="item-card-media">
            ${widgetImageMarkup(item, item.name)}
          </div>
        </article>`;
    },
  });

  renderCollection({
    key: "events",
    listId: "events-list",
    emptyText: "No saved calendar events yet. Add an in-world date to keep pressure on the party.",
    template: (event) => {
      const searchable = textForSearch([event.title, eventDateLabel(event), event.description, "session calendar event"]);
      return `
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(event)} ${widgetDmAttribute("events", event)} ${widgetEditAttribute("events", event)} data-searchable="${escapeHtml(searchable)}" data-status="prepared">
          <div class="card-kicker"><span class="status-badge status-prepared">Prepared</span><span>${escapeHtml(eventDateLabel(event))}</span></div>
          <h3>${escapeHtml(event.title)}</h3>
          ${widgetDescriptionMarkup(event.description)}
          ${widgetTagsMarkup([event.createdAt, "Session timeline", "Calendar"])}
${widgetActionMarkup(event, { edit: "Modify event", delete: "Delete event" })}
        </article>`;
    },
  });

  wireDmOnlyWidgetTargets(document);
  updateSummaryCards();
  document.dispatchEvent(new Event("dashboard:rendered"));
}

function updateSummaryCards() {
  const notes = getStoredCollection("notes");
  const characters = getStoredCollection("characters");
  const events = getStoredCollection("events");

  const noteTitle = document.getElementById("recent-note-title");
  const noteSummary = document.getElementById("recent-note-summary");
  const eventTitle = document.getElementById("next-event-title");
  const eventSummary = document.getElementById("next-event-summary");
  const eventDate = document.getElementById("next-event-date");
  const eventWeatherText = document.getElementById("next-event-weather");
  const previewTitle = document.getElementById("preview-next-event-title");
  const previewSummary = document.getElementById("preview-next-event-summary");
  const previewDate = document.getElementById("preview-next-event-date");
  const previewWeather = document.getElementById("preview-next-event-weather");
  const statNotes = document.getElementById("stat-notes");
  const statCharacters = document.getElementById("stat-characters");
  const statEvents = document.getElementById("stat-events");
  const statPlayers = document.getElementById("stat-players");
  const campaign = currentCampaign();

  if (notes[0] && noteTitle && noteSummary) {
    noteTitle.textContent = notes[0].title;
    noteSummary.textContent = notes[0].content.slice(0, 120);
  } else {
    if (noteTitle) noteTitle.textContent = "No notes yet";
    if (noteSummary) noteSummary.textContent = "Create your first note to populate this summary.";
  }
  const nextEvent = nextImminentEvent();
  if (nextEvent) {
    const dateLabel = eventDateLabel(nextEvent);
    const weatherLabel = eventWeather(nextEvent);
    if (eventTitle) eventTitle.textContent = nextEvent.title;
    if (eventSummary) eventSummary.textContent = `${dateLabel}: ${nextEvent.description.slice(0, 95)}`;
    if (eventDate) eventDate.textContent = dateLabel;
    if (eventWeatherText) eventWeatherText.textContent = weatherLabel;
    if (previewTitle) previewTitle.textContent = nextEvent.title;
    if (previewSummary) previewSummary.textContent = nextEvent.description.slice(0, 140);
    if (previewDate) previewDate.textContent = dateLabel;
    if (previewWeather) previewWeather.textContent = weatherLabel;
  } else {
    if (eventTitle) eventTitle.textContent = "No events yet";
    if (eventSummary) eventSummary.textContent = "Add an event to schedule the campaign timeline.";
    if (eventDate) eventDate.textContent = "Calendar";
    if (eventWeatherText) eventWeatherText.textContent = "Weather pending";
    if (previewTitle) previewTitle.textContent = "No upcoming event";
    if (previewSummary) previewSummary.textContent = "Saved events appear on the full calendar page and update this dashboard preview.";
    if (previewDate) previewDate.textContent = "No date set";
    if (previewWeather) previewWeather.textContent = "Weather unknown";
  }
  if (statNotes) statNotes.textContent = notes.length;
  if (statCharacters) statCharacters.textContent = characters.length;
  if (statEvents) statEvents.textContent = events.length;
  if (statPlayers) statPlayers.textContent = campaign.players.length;
  document.querySelectorAll(".campaign-action-button").forEach((button) => {
    if (campaignReady(campaign)) {
      button.href = dashboardHref(campaign.id);
      button.textContent = "Open Campaign";
    } else if (campaign.players.length) {
      button.href = campaignStartNoteHref(campaign.id);
      button.textContent = "Open Campaign";
    } else {
      button.href = campaignSetupHref(campaign.id);
      button.textContent = "Start Campaign";
    }
  });
  document.querySelectorAll(".campaign-add-player-button").forEach((button) => {
    button.href = campaignSetupHref(campaign.id);
    button.hidden = !campaignReady(campaign);
  });
  const widgetTitle = document.getElementById("campaign-widget-title");
  if (widgetTitle) widgetTitle.textContent = campaign.name;
  document.querySelectorAll("[data-campaign-library-link]").forEach((link) => {
    link.href = campaignLibraryHref();
  });
  const featureRune = document.getElementById("campaign-feature-rune");
  if (featureRune) featureRune.textContent = "🦆";
}

function wireForm(formId, key, buildEntry) {
  const form = document.getElementById(formId);
  if (!form) return;
  ensureEditCancelButton(form, key);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    try {
      const collection = getStoredCollection(key);
      const editId = form.dataset.editId || "";
      const existingEntry = editId ? collection.find((entry) => entry.id === editId) : null;
      const entry = await buildEntry(existingEntry);
      saveCollection(key, upsertCollectionEntry(collection, entry, editId));
      form.reset();
      resetImagePickers(form);
      resetFormEditState(form);
      populateCalendarFormDefaults();
      renderDashboard();
      renderCampaignCalendar();
    } catch (error) {
      alert(error.message);
    }
  });
}

function initItemWeaponOptions() {
  const typeSelect = document.getElementById("item-type");
  const weaponSection = document.getElementById("item-weapon-section");
  const backgroundSection = document.getElementById("item-background-section");
  if (!typeSelect || !weaponSection) return;

  const weaponStatsFromForm = () => ({
    properties: checkedFormValues(typeSelect.form, "item-weapon-properties"),
  });

  const syncWeaponDependentFields = () => {
    const stats = weaponStatsFromForm();
    [
      ["range", weaponNeedsRange(stats)],
      ["versatile", weaponNeedsVersatileDamage(stats)],
    ].forEach(([key, isVisible]) => {
      const wrapper = weaponSection.querySelector(`[data-weapon-extra="${key}"]`);
      const field = wrapper?.querySelector("input, select, textarea");
      if (!wrapper || !field) return;
      wrapper.hidden = !isVisible;
      field.disabled = !isVisible || typeSelect.value !== "Weapon";
      if (!isVisible) field.value = "";
    });
  };

  const sync = () => {
    const isWeapon = typeSelect.value === "Weapon";
    const isBackground = typeSelect.value === "Background";
    weaponSection.hidden = !isWeapon;
    weaponSection.querySelectorAll("input, select, textarea").forEach((field) => {
      field.disabled = !isWeapon;
      if (!isWeapon) {
        if (field.type === "checkbox" || field.type === "radio") field.checked = false;
        else field.value = "";
      }
    });
    if (backgroundSection) {
      backgroundSection.hidden = !isBackground;
      backgroundSection.querySelectorAll("input, select, textarea").forEach((field) => {
        field.disabled = !isBackground;
        if (!isBackground) field.value = "";
      });
    }
    syncWeaponDependentFields();
  };

  typeSelect.addEventListener("change", sync);
  weaponSection.addEventListener("change", syncWeaponDependentFields);
  typeSelect.form?.addEventListener("reset", () => requestAnimationFrame(sync));
  sync();
}

function initDashboardForms() {
  initItemWeaponOptions();

  wireForm("encounter-form", "encounters", async () => {
    const form = document.getElementById("encounter-form");
    const title = document.getElementById("encounter-title").value.trim();
    const image = selectedMediaImageFromForm(form);
    return {
      id: createId("encounter"),
      title,
      tier: document.getElementById("encounter-tier").value.trim(),
      status: document.getElementById("encounter-status").value,
      description: document.getElementById("encounter-description").value.trim(),
      tags: document.getElementById("encounter-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
      ...imageFields(image),
      createdAt: readableDate(),
    };
  });

  wireForm("location-form", "locations", async () => {
    const form = document.getElementById("location-form");
    const name = document.getElementById("location-name").value.trim();
    const image = selectedMediaImageFromForm(form);
    return {
      id: createId("location"),
      name,
      type: document.getElementById("location-type").value.trim(),
      status: document.getElementById("location-status").value,
      description: document.getElementById("location-description").value.trim(),
      tags: document.getElementById("location-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
      ...imageFields(image),
      createdAt: readableDate(),
    };
  });

  wireForm("note-form", "notes", async () => ({
    id: createId("note"),
    title: document.getElementById("note-title").value.trim(),
    category: document.getElementById("note-category").value,
    content: document.getElementById("note-content").value.trim(),
    createdAt: readableDate(),
    sortAt: Date.now(),
  }));

  wireForm("character-form", "characters", async () => {
    const form = document.getElementById("character-form");
    const name = document.getElementById("character-name").value.trim();
    const image = selectedMediaImageFromForm(form);
    return {
      id: createId("character"),
      name,
      role: document.getElementById("character-role").value.trim(),
      faction: document.getElementById("character-faction").value.trim(),
      notes: document.getElementById("character-notes").value.trim(),
      ...imageFields(image),
      createdAt: readableDate(),
    };
  });

  wireForm("item-form", "items", async () => {
    const form = document.getElementById("item-form");
    const name = document.getElementById("item-name").value.trim();
    const type = document.getElementById("item-type").value;
    const image = selectedMediaImageFromForm(form);
    const damageDice = document.getElementById("item-weapon-damage").value.trim();
    const damageType = document.getElementById("item-weapon-damage-type")?.value.trim() || "";
    const attackBonus = document.getElementById("item-weapon-attack").value.trim();
    const damageBonus = document.getElementById("item-weapon-damage-bonus")?.value.trim() || "";
    const properties = checkedFormValues(form, "item-weapon-properties");
    const weaponStats = { properties };
    const backgroundStats = type === "Background" ? {
      abilityScores: splitListInput(document.getElementById("item-background-abilities")?.value),
      originFeat: document.getElementById("item-background-origin-feat")?.value.trim() || "",
      skills: splitListInput(document.getElementById("item-background-skills")?.value),
      toolProficiency: document.getElementById("item-background-tool")?.value.trim() || "",
      equipment: document.getElementById("item-background-equipment")?.value.trim() || "",
    } : {};
    const statistics = type === "Weapon" ? {
      damage: [damageDice, damageType].filter(Boolean).join(" "),
      damageDice,
      damageType,
      range: weaponNeedsRange(weaponStats) ? document.getElementById("item-weapon-range").value.trim() : "",
      attackBonus,
      damageBonus,
      versatileDamage: weaponNeedsVersatileDamage(weaponStats) ? document.getElementById("item-weapon-versatile-damage")?.value.trim() || "" : "",
      properties,
    } : backgroundStats;
    const feature = type === "Weapon" ? {
      title: document.getElementById("item-weapon-feature-title").value.trim(),
      description: document.getElementById("item-weapon-feature-description").value.trim(),
    } : null;
    const entry = {
      id: createId("item"),
      name,
      type,
      statistics,
      features: feature && (feature.title || feature.description) ? [feature] : [],
      description: document.getElementById("item-description").value.trim(),
      tags: type === "Background" ? splitListInput(document.getElementById("item-background-tags")?.value) : [],
      ...imageFields(image),
      createdAt: readableDate(),
    };
    await syncBackgroundSuggestionFile(entry);
    return entry;
  });

  wireForm("event-form", "events", async () => {
    const form = document.getElementById("event-form");
    const settings = getCalendarSettings();
    const monthIndex = Number(document.getElementById("event-month")?.value ?? settings.currentMonthIndex);
    const day = Number(document.getElementById("event-day")?.value ?? 1);
    const year = Number(document.getElementById("event-year")?.value ?? settings.currentYear);
    const hour = document.getElementById("event-hour")?.value?.trim();
    const title = document.getElementById("event-title").value.trim();
    const image = selectedMediaImageFromForm(form);
    const event = {
      id: createId("event"),
      title,
      monthIndex,
      day,
      year,
      hour: hour && Number.isFinite(Number(hour)) ? Number(hour) : undefined,
      description: document.getElementById("event-description").value.trim(),
      ...imageFields(image),
      createdAt: readableDate(),
    };
    event.date = eventDateLabel(event, settings);
    return event;
  });
}

async function loadMaterials() {
  const list = document.getElementById("materials-list");
  const count = document.getElementById("material-count");
  if (!list) return;

  try {
    const campaignId = getActiveCampaignId();
    const materials = await fetchJson(`/api/materials?campaignId=${encodeURIComponent(campaignId)}`);
    if (count) count.textContent = `${materials.length} saved material${materials.length === 1 ? "" : "s"}`;
    if (!materials.length) {
      list.innerHTML = `<div class="empty-state">No uploaded materials yet. Upload a map, NPC portrait, PDF handout, or campaign note to persist it locally.</div>`;
      return;
    }

    list.innerHTML = materials.map((material) => {
      const searchable = textForSearch([material.title, material.originalFilename, material.category, material.description, material.tags?.join(" "), "material file map handout"]);
      const downloadUrl = resolveBackendUrl(material.downloadUrl);
      const preview = isPreviewableImage(material)
        ? `<a class="material-preview" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(downloadUrl)}" alt="Preview of ${escapeHtml(material.title || material.originalFilename)}" loading="lazy" /></a>`
        : `<a class="material-preview material-preview-file" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener"><span>${escapeHtml((material.originalFilename || "file").split(".").pop().toUpperCase())}</span></a>`;
      return `
        <article class="content-card entry-card material-card" data-widget-origin="user" data-searchable="${escapeHtml(searchable)}" data-status="active">
          ${preview}
          <div class="card-kicker"><span class="status-badge status-active">${escapeHtml(material.category || "other")}</span><span>${escapeHtml(material.mimeType)}</span></div>
          <h3>${escapeHtml(material.title || material.originalFilename)}</h3>
          ${widgetDescriptionMarkup(material.description)}
          ${widgetTagsMarkup([formatBytes(material.fileSize), formatUploadedAt(material.uploadedAt), ...(material.tags || [])])}
          <div class="entry-actions">
            <a class="btn btn-secondary" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Open / Download</a>
            <button class="btn btn-danger" type="button" data-delete-material="${escapeHtml(material.id)}">Delete file</button>
          </div>
        </article>`;
    }).join("");

    list.querySelectorAll("[data-delete-material]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this material and remove the stored file from disk?")) return;
        try {
          await fetchJson(`/api/materials/${button.dataset.deleteMaterial}`, { method: "DELETE" });
          await loadMaterials();
        } catch (error) {
          alert(error.message);
        }
      });
    });
    document.dispatchEvent(new Event("dashboard:rendered"));
  } catch (error) {
    list.innerHTML = `<div class="empty-state">Materials API unavailable. Start the local backend with <code>npm start</code> to upload and view persistent files.</div>`;
    if (count) count.textContent = "Backend offline";
  }
}

function initMaterials() {
  const form = document.getElementById("material-form");
  const fileInput = document.getElementById("material-file");
  const status = document.getElementById("material-status");
  if (!form || !fileInput) return;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (status) status.textContent = file ? `Ready to upload ${file.name} (${formatBytes(file.size)}).` : "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const formData = new FormData(form);
    formData.set("campaignId", getActiveCampaignId());
    if (status) {
      status.textContent = "Uploading material...";
      status.classList.remove("error");
    }
    try {
      const material = await fetchJson("/api/materials/upload", { method: "POST", body: formData });
      form.reset();
      if (status) status.textContent = `Uploaded ${material.originalFilename}.`;
      await loadMaterials();
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.classList.add("error");
      }
    }
  });

  loadMaterials();
}

function renderMediaLibraryShell() {
  updateTopNavActivePage("media");
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell media-page">
      <div class="page-hero">
        <p class="eyebrow">Media library</p>
        <h1>Image Library</h1>
        <p>Upload campaign images here, then reuse them from dashboard widgets.</p>
      </div>
      <div class="media-page-grid media-page-grid-single">
        <section class="setup-summary-panel">
          <div class="section-heading">
            <div><p class="eyebrow">Library</p><h2>Images</h2></div>
            <span id="media-count" class="muted"></span>
          </div>
          <div class="media-toolbar">
            <button class="btn btn-secondary" type="button" id="media-refresh">Refresh</button>
          </div>
          <div class="media-library-grid" id="media-library-list" aria-live="polite"></div>
          <div class="media-upload-block">
            <div class="section-heading">
              <div><p class="eyebrow">Upload</p><h2>Add image to media</h2></div>
            </div>
            ${imageUploadMarkup({ submitLabel: "Upload to media" })}
          </div>
        </section>
      </div>
    </section>`;
  initMediaLibraryPage();
}

async function loadMediaLibrary() {
  const list = document.getElementById("media-library-list");
  const count = document.getElementById("media-count");
  if (!list) return;
  list.innerHTML = `<div class="empty-state">Loading images...</div>`;
  try {
    const images = await listImages();
    if (count) count.textContent = `${images.length} image${images.length === 1 ? "" : "s"}`;
    if (!images.length) {
      list.innerHTML = `<div class="empty-state">No media images yet. Upload images below, then select them from dashboard widgets.</div>`;
      return;
    }
    
    const typeGroups = groupMediaByType(images);
    const groupOrder = ["Character", "Item", "Comic", "Object", "Uncategorized"];
    let html = "";
    
    groupOrder.forEach((type) => {
      if (typeGroups[type] && typeGroups[type].length > 0) {
        html += `<div class="media-type-group">
          <h3 class="media-type-heading">${escapeHtml(type)}</h3>
          <div class="media-type-grid">
            ${typeGroups[type].map((image) => mediaImageCardMarkup(image, { selectable: false })).join("")}
          </div>
        </div>`;
      }
    });
    
    list.innerHTML = html;
  } catch (error) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    if (count) count.textContent = "Backend offline";
  }
}

function groupMediaByType(images) {
  const groups = {
    Character: [],
    Item: [],
    Comic: [],
    Object: [],
    Uncategorized: [],
  };
  
  images.forEach((image) => {
    const type = image.mediaType || "Uncategorized";
    if (groups[type]) {
      groups[type].push(image);
    } else {
      groups.Uncategorized.push(image);
    }
  });
  
  return groups;
}

function initMediaLibraryPage() {
  initImagePickers(document.querySelector(".media-page") || document);
  document.getElementById("media-refresh")?.addEventListener("click", () => loadMediaLibrary());
  const uploadForm = document.querySelector("[data-image-upload-form]");
  uploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!uploadForm.checkValidity()) {
      uploadForm.reportValidity();
      return;
    }
    const status = uploadForm.querySelector("[data-image-upload-status]");
    const input = uploadForm.querySelector('input[name="images"]');
    const formData = new FormData(uploadForm);
    const title = formData.get("title")?.toString().trim() || "";
    const mediaType = formData.get("mediaType")?.toString().trim() || "";
    if (status) {
      status.textContent = "Uploading image...";
      status.classList.remove("error");
    }
    try {
      const images = await uploadImages(input?.files || [], { title, mediaType, source: "media" });
      uploadForm.reset();
      resetImagePickers(uploadForm);
      if (status) status.textContent = `Uploaded ${images.length} image${images.length === 1 ? "" : "s"}.`;
      await loadMediaLibrary();
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.classList.add("error");
      } else {
        alert(error.message);
      }
    }
  });
  document.getElementById("media-library-list")?.addEventListener("click", async (event) => {
    const deleteId = event.target?.dataset?.deleteImage;
    const editId = event.target?.dataset?.editImage;
    if (editId) {
      const card = event.target.closest("[data-image-card]");
      const currentTitle = card?.querySelector("h3")?.textContent || "";
      const currentBadge = card?.querySelector(".status-badge")?.textContent || "Uncategorized";
      const currentMediaType = (currentBadge === "Image") ? "Uncategorized" : currentBadge;
      
      const modal = document.createElement("div");
      modal.className = "modal-backdrop";
      modal.innerHTML = `
        <article class="panel" style="max-width: 400px;">
          <h2>Edit image</h2>
          <div style="display: grid; gap: 16px; margin: 16px 0;">
            <label>Title<input id="edit-title" type="text" value="${escapeHtml(currentTitle)}" /></label>
            <label>Type<select id="edit-type">
              <option value="Character" ${currentMediaType === "Character" ? "selected" : ""}>Character</option>
              <option value="Item" ${currentMediaType === "Item" ? "selected" : ""}>Item</option>
              <option value="Comic" ${currentMediaType === "Comic" ? "selected" : ""}>Comic</option>
              <option value="Object" ${currentMediaType === "Object" ? "selected" : ""}>Object</option>
              <option value="Uncategorized" ${currentMediaType === "Uncategorized" ? "selected" : ""}>Uncategorized</option>
            </select></label>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button class="btn btn-secondary" type="button" id="edit-cancel">Cancel</button>
            <button class="btn btn-primary" type="button" id="edit-save">Save</button>
          </div>
        </article>`;
      document.body.appendChild(modal);
      
      let done = false;
      const cleanup = () => {
        if (!done) {
          done = true;
          modal.remove();
        }
      };
      
      modal.addEventListener("click", (e) => {
        if (e.target === modal) cleanup();
      });
      
      document.getElementById("edit-cancel").addEventListener("click", cleanup);
      document.getElementById("edit-save").addEventListener("click", async () => {
        const newTitle = document.getElementById("edit-title").value.trim() || currentTitle;
        const newMediaType = document.getElementById("edit-type").value;
        try {
          await updateImageMetadata(editId, { title: newTitle, mediaType: newMediaType });
          cleanup();
          await loadMediaLibrary();
        } catch (error) {
          alert(error.message);
        }
      });
    }
    if (deleteId) {
      if (!confirm("Delete this image and remove the stored file from disk?")) return;
      try {
        await deleteImage(deleteId);
        await loadMediaLibrary();
      } catch (error) {
        alert(error.message);
      }
    }
  });
  loadMediaLibrary();
}

function comicLayoutById(layoutId) {
  return COMIC_LAYOUTS.find((layout) => layout.id === layoutId) || COMIC_LAYOUTS[0];
}

function panelStyle(panel) {
  return [
    `left:${panel.x}%`,
    `top:${panel.y}%`,
    `width:${panel.w}%`,
    `height:${panel.h}%`,
    `z-index:${panel.z || 1}`,
    `transform:rotate(${panel.rotate || 0}deg)`,
  ].join(";");
}

function comicPageImageUrl(page) {
  return page.imageUrl || page.imageDataUrl || page.image?.url || "";
}

function comicPageCardMarkup(page) {
  const title = page.title || "Untitled comic page";
  const imageUrl = resolveBackendUrl(comicPageImageUrl(page));
  return `
    <article class="content-card entry-card comic-card" data-comic-page="${escapeHtml(page.id)}">
      <a class="comic-page-thumb" href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener">
        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" />` : `<span>No page image</span>`}
      </a>
      <div class="card-kicker"><span class="status-badge status-active">Comic</span><span>${escapeHtml(page.source || "Saved page")}</span></div>
      <h3>${escapeHtml(title)}</h3>
      ${widgetTagsMarkup([page.layoutLabel, page.createdAt])}
      <div class="entry-actions">
        ${imageUrl ? `<a class="btn btn-secondary" href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener">Preview</a>` : ""}
        <button class="btn btn-danger" type="button" data-delete-comic="${escapeHtml(page.id)}">Delete</button>
      </div>
    </article>`;
}

function renderComicBuilderPanels(state) {
  const layout = comicLayoutById(state.layoutId);
  const stage = document.getElementById("comic-builder-stage");
  const description = document.getElementById("comic-layout-description");
  if (description) description.textContent = layout.description;
  if (!stage) return;

  stage.innerHTML = layout.panels.map((panel, index) => {
    const panelImage = state.panelImages[index];
    return `
      <button class="comic-builder-panel${state.selectedPanel === index ? " is-selected" : ""}${panelImage ? " has-image" : ""}" type="button" data-comic-panel="${index}" style="${panelStyle(panel)}" aria-label="Panel ${index + 1}">
        ${panelImage ? `<img src="${escapeHtml(panelImage.url)}" alt="Panel ${index + 1} preview" />` : `<span>${index + 1}</span>`}
      </button>`;
  }).join("");

  const panelStatus = document.getElementById("comic-panel-status");
  if (panelStatus) {
    const count = Object.keys(state.panelImages).length;
    panelStatus.textContent = `${count} of ${layout.panels.length} panel${layout.panels.length === 1 ? "" : "s"} filled.`;
  }
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.92) {
  return new Promise((resolve, reject) => {
    if (!canvas.toBlob) {
      const dataUrl = canvas.toDataURL(type, quality);
      const byteString = atob(dataUrl.split(",")[1] || "");
      const bytes = new Uint8Array(byteString.length);
      for (let index = 0; index < byteString.length; index += 1) bytes[index] = byteString.charCodeAt(index);
      resolve(new Blob([bytes], { type }));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not prepare the comic page image."));
    }, type, quality);
  });
}

function loadCanvasImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Could not load one of the panel images.")), { once: true });
    image.src = url;
  });
}

function drawImageCover(context, image, x, y, width, height) {
  const sourceWidth = image.naturalWidth || image.width || width;
  const sourceHeight = image.naturalHeight || image.height || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function renderComicPageCanvas(state) {
  const layout = comicLayoutById(state.layoutId);
  const canvas = document.createElement("canvas");
  canvas.width = COMIC_PAGE_WIDTH;
  canvas.height = COMIC_PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot render comic pages.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const orderedPanels = layout.panels
    .map((panel, index) => ({ panel, index }))
    .sort((a, b) => (a.panel.z || 1) - (b.panel.z || 1));

  for (const { panel, index } of orderedPanels) {
    const x = Math.round((panel.x / 100) * canvas.width);
    const y = Math.round((panel.y / 100) * canvas.height);
    const width = Math.round((panel.w / 100) * canvas.width);
    const height = Math.round((panel.h / 100) * canvas.height);
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const rotation = ((panel.rotate || 0) * Math.PI) / 180;
    const panelImage = state.panelImages[index];

    context.save();
    context.translate(centerX, centerY);
    context.rotate(rotation);
    context.translate(-centerX, -centerY);
    context.fillStyle = "#ffffff";
    context.fillRect(x, y, width, height);
    if (panelImage?.url) {
      context.save();
      context.beginPath();
      context.rect(x, y, width, height);
      context.clip();
      drawImageCover(context, await loadCanvasImage(panelImage.url), x, y, width, height);
      context.restore();
    }
    context.lineWidth = 10;
    context.strokeStyle = "#111111";
    context.strokeRect(x, y, width, height);
    context.restore();
  }

  return canvas;
}

async function uploadRenderedComicPage(canvas, title) {
  const blob = await canvasToBlob(canvas, "image/jpeg", LOCAL_IMAGE_QUALITY);
  const filename = `${storageIdSegment(title) || "comic-page"}.jpg`;
  const file = new File([blob], filename, { type: "image/jpeg" });
  try {
    const [image] = await uploadImages([file], { title, category: "comic" });
    return image || null;
  } catch (error) {
    if (!canUseLocalImageFallback(error)) throw error;
    const dataUrl = canvas.toDataURL("image/jpeg", LOCAL_IMAGE_QUALITY);
    assertLocalImageFitsStorage(dataUrl);
    return {
      id: createId("local-comic-image"),
      title,
      originalFilename: filename,
      fileSize: blob.size || dataUrl.length,
      mimeType: "image/jpeg",
      url: dataUrl,
      path: dataUrl,
      localOnly: true,
      uploadedAt: new Date().toISOString(),
    };
  }
}

function saveComicPageRecord(page) {
  saveCollection("comics", [page, ...getStoredCollection("comics")]);
}

function loadComicPages() {
  const list = document.getElementById("comic-pages-list");
  const count = document.getElementById("comic-pages-count");
  if (!list) return;
  const pages = getStoredCollection("comics");
  if (count) count.textContent = `${pages.length} page${pages.length === 1 ? "" : "s"}`;
  list.innerHTML = pages.length
    ? pages.map(comicPageCardMarkup).join("")
    : `<div class="empty-state">No comic pages saved yet. Upload a finished page or build one panel by panel.</div>`;
}

function renderComicsPage() {
  updateTopNavActivePage("comics");
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell comic-page">
      <div class="page-hero comic-hero">
        <p class="eyebrow">Campaign comics</p>
        <h1>Shots from the Campaign</h1>
        <p>Save complete comic pages, or compose a page from separate panel images using classic and dynamic comic grids.</p>
      </div>

      <div class="comic-workbench-grid">
        <section class="setup-form-panel">
          <div class="section-heading"><div><p class="eyebrow">Finished page</p><h2>Upload a comic page</h2></div></div>
          <form class="panel form-grid" id="comic-upload-form">
            <label class="full-width">Page title<input id="comic-upload-title" type="text" placeholder="Session 12: Gatehouse ambush" required /></label>
            <div class="file-picker image-picker full-width" data-image-picker>
              <label for="comic-upload-image">Page image</label>
              <input id="comic-upload-image" class="image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required />
              <button class="btn btn-secondary image-picker-button" type="button" data-image-trigger="comic-upload-image">Choose page</button>
              <span class="image-picker-status" data-image-status>No image chosen</span>
              <img class="image-picker-preview comic-upload-preview" data-image-preview alt="Selected comic page preview" hidden />
            </div>
            <div class="form-message full-width" id="comic-upload-status" aria-live="polite"></div>
            <button class="btn btn-primary" type="submit">Save Uploaded Page</button>
          </form>
        </section>

        <section class="setup-summary-panel comic-builder-panel-shell">
          <div class="section-heading">
            <div><p class="eyebrow">Panel builder</p><h2>Build a page</h2></div>
            <span class="muted" id="comic-panel-status"></span>
          </div>
          <form class="panel form-grid comic-builder-controls" id="comic-builder-form">
            <label>Page title<input id="comic-builder-title" type="text" placeholder="The chase through Low Lantern" required /></label>
            <label>Grid preset<select id="comic-layout-select">
              ${COMIC_LAYOUTS.map((layout) => `<option value="${escapeHtml(layout.id)}">${escapeHtml(layout.label)}</option>`).join("")}
            </select></label>
            <p class="full-width muted" id="comic-layout-description"></p>
            <div class="comic-builder-actions full-width">
              <button class="btn btn-secondary" type="button" id="comic-clear-panels">Clear panels</button>
              <button class="btn btn-primary" type="submit">Save Built Page</button>
            </div>
            <input id="comic-panel-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden />
          </form>
          <div class="comic-page-stage-wrap">
            <div class="comic-page-stage" id="comic-builder-stage" aria-label="Comic page builder"></div>
          </div>
        </section>
      </div>

      <section class="workspace-section">
        <div class="section-heading">
          <div><p class="eyebrow">Saved shots</p><h2>Comic pages</h2></div>
          <span id="comic-pages-count" class="muted"></span>
        </div>
        <div class="comic-gallery-grid" id="comic-pages-list" aria-live="polite"></div>
      </section>
    </section>`;
  initComicsPage();
}

function initComicsPage() {
  initImagePickers(document.querySelector(".comic-page") || document);
  const state = { layoutId: COMIC_LAYOUTS[0].id, selectedPanel: 0, panelImages: {} };
  const layoutSelect = document.getElementById("comic-layout-select");
  const panelFileInput = document.getElementById("comic-panel-file");
  const uploadStatus = document.getElementById("comic-upload-status");
  const builderForm = document.getElementById("comic-builder-form");
  const uploadForm = document.getElementById("comic-upload-form");

  renderComicBuilderPanels(state);

  layoutSelect?.addEventListener("change", () => {
    state.layoutId = layoutSelect.value;
    state.selectedPanel = 0;
    state.panelImages = {};
    renderComicBuilderPanels(state);
  });

  document.getElementById("comic-builder-stage")?.addEventListener("click", (event) => {
    const panelButton = event.target.closest("[data-comic-panel]");
    if (!panelButton) return;
    state.selectedPanel = Number(panelButton.dataset.comicPanel);
    renderComicBuilderPanels(state);
    panelFileInput?.click();
  });

  panelFileInput?.addEventListener("change", () => {
    const file = panelFileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Choose a jpg, png, webp, or gif image for this panel.");
      panelFileInput.value = "";
      return;
    }
    const previous = state.panelImages[state.selectedPanel];
    if (previous?.url?.startsWith("blob:")) URL.revokeObjectURL(previous.url);
    state.panelImages[state.selectedPanel] = {
      file,
      url: URL.createObjectURL(file),
      title: file.name,
    };
    panelFileInput.value = "";
    renderComicBuilderPanels(state);
  });

  document.getElementById("comic-clear-panels")?.addEventListener("click", () => {
    Object.values(state.panelImages).forEach((panelImage) => {
      if (panelImage?.url?.startsWith("blob:")) URL.revokeObjectURL(panelImage.url);
    });
    state.panelImages = {};
    renderComicBuilderPanels(state);
  });

  uploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!uploadForm.checkValidity()) {
      uploadForm.reportValidity();
      return;
    }
    const title = document.getElementById("comic-upload-title").value.trim();
    if (uploadStatus) {
      uploadStatus.textContent = "Saving comic page...";
      uploadStatus.classList.remove("error");
    }
    try {
      const image = await imageFromFileInput(document.getElementById("comic-upload-image"), { title, category: "comic" });
      saveComicPageRecord({
        id: createId("comic"),
        title,
        source: "Uploaded page",
        layoutLabel: "Page image",
        ...imageFields(image),
        createdAt: readableDate(),
      });
      uploadForm.reset();
      resetImagePickers(uploadForm);
      if (uploadStatus) uploadStatus.textContent = "Comic page saved.";
      loadComicPages();
    } catch (error) {
      if (uploadStatus) {
        uploadStatus.textContent = error.message;
        uploadStatus.classList.add("error");
      } else {
        alert(error.message);
      }
    }
  });

  builderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!builderForm.checkValidity()) {
      builderForm.reportValidity();
      return;
    }
    const status = document.getElementById("comic-panel-status");
    const title = document.getElementById("comic-builder-title").value.trim();
    try {
      if (status) status.textContent = "Rendering page...";
      const canvas = await renderComicPageCanvas(state);
      const image = await uploadRenderedComicPage(canvas, title);
      const layout = comicLayoutById(state.layoutId);
      saveComicPageRecord({
        id: createId("comic"),
        title,
        source: "Built page",
        layoutId: layout.id,
        layoutLabel: layout.label,
        ...imageFields(image),
        createdAt: readableDate(),
      });
      builderForm.reset();
      state.layoutId = COMIC_LAYOUTS[0].id;
      state.selectedPanel = 0;
      state.panelImages = {};
      if (layoutSelect) layoutSelect.value = state.layoutId;
      renderComicBuilderPanels(state);
      loadComicPages();
    } catch (error) {
      alert(error.message);
      renderComicBuilderPanels(state);
    }
  });

  document.getElementById("comic-pages-list")?.addEventListener("click", (event) => {
    const deleteId = event.target?.dataset?.deleteComic;
    if (!deleteId) return;
    if (!confirm("Delete this saved comic page?")) return;
    saveCollection("comics", getStoredCollection("comics").filter((page) => page.id !== deleteId));
    loadComicPages();
  });

  loadComicPages();
}

function mapDetailHref(mapId) {
  return `index.html#/maps/${encodeURIComponent(mapId)}`;
}

function cityDetailHref(mapId, cityId) {
  return `index.html#/maps/${encodeURIComponent(mapId)}/cities/${encodeURIComponent(cityId)}`;
}

async function uploadInteractiveMap(formData) {
  formData.set("campaignId", getActiveCampaignId());
  return fetchJson("/api/maps", { method: "POST", body: formData });
}

async function listInteractiveMaps() {
  const campaignId = getActiveCampaignId();
  const payload = await fetchJson(`/api/maps?campaignId=${encodeURIComponent(campaignId)}`);
  return (payload.maps || []).filter((map) => String(map.campaignId || DEFAULT_CAMPAIGN_ID) === campaignId);
}

async function getInteractiveMap(mapId) {
  const result = await fetchJson(`/api/maps/${encodeURIComponent(mapId)}`);
  if (String(result.map?.campaignId || DEFAULT_CAMPAIGN_ID) !== getActiveCampaignId()) {
    throw new Error("That map belongs to a different campaign.");
  }
  return result;
}

async function deleteInteractiveMap(mapId) {
  return fetchJson(`/api/maps/${encodeURIComponent(mapId)}`, { method: "DELETE" });
}

async function processInteractiveMap(mapId) {
  return fetchJson(`/api/maps/${encodeURIComponent(mapId)}/process`, { method: "POST" });
}

async function createMapCity(mapId, city) {
  return fetchJson(`/api/maps/${encodeURIComponent(mapId)}/cities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(city),
  });
}

async function updateMapCity(mapId, cityId, city) {
  return fetchJson(`/api/maps/${encodeURIComponent(mapId)}/cities/${encodeURIComponent(cityId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(city),
  });
}

async function deleteMapCity(mapId, cityId) {
  return fetchJson(`/api/maps/${encodeURIComponent(mapId)}/cities/${encodeURIComponent(cityId)}`, { method: "DELETE" });
}

async function listCityNotes(mapId, cityId) {
  const payload = await fetchJson(`/api/maps/${encodeURIComponent(mapId)}/cities/${encodeURIComponent(cityId)}/notes`);
  return payload.notes || [];
}

async function createCityNote(mapId, cityId, note) {
  return fetchJson(`/api/maps/${encodeURIComponent(mapId)}/cities/${encodeURIComponent(cityId)}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  });
}

async function updateCityNote(mapId, cityId, noteId, note) {
  return fetchJson(`/api/maps/${encodeURIComponent(mapId)}/cities/${encodeURIComponent(cityId)}/notes/${encodeURIComponent(noteId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  });
}

async function deleteCityNote(mapId, cityId, noteId) {
  return fetchJson(`/api/maps/${encodeURIComponent(mapId)}/cities/${encodeURIComponent(cityId)}/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
}

function mapUploadFormMarkup() {
  return `
    <form class="panel form-grid map-upload-form" id="map-upload-form">
      <label>Map title<input id="map-title" name="title" type="text" placeholder="Sword Coast region" required /></label>
      <div class="file-picker map-file-picker full-width">
        <label>Map image</label>
        <input id="map-file" name="map" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required />
        <button class="btn btn-secondary" type="button" id="map-file-trigger">Choose map image</button>
        <span class="image-picker-status" id="map-file-status">No map image chosen</span>
        <img class="image-picker-preview" id="map-file-preview" alt="Selected map preview" hidden />
      </div>
      <div class="form-message full-width" id="map-upload-status" aria-live="polite"></div>
      <button class="btn btn-primary" type="submit">Upload map</button>
    </form>`;
}

function mapCardMarkup(map) {
  const title = map.title || map.originalFilename || "Untitled map";
  const imageUrl = resolveBackendUrl(map.imageUrl);
  return `
    <article class="content-card entry-card map-card" data-map-card="${escapeHtml(map.id)}">
      <a class="map-card-preview" href="${escapeHtml(mapDetailHref(map.id))}">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" />
      </a>
      <div class="card-kicker"><span class="status-badge status-active">${escapeHtml(map.status || "ready")}</span><span>${escapeHtml(formatBytes(map.fileSize))}</span></div>
      <h3>${escapeHtml(title)}</h3>
      ${widgetTagsMarkup([map.imageWidth && map.imageHeight ? `${map.imageWidth} x ${map.imageHeight}` : "Dimensions pending", formatUploadedAt(map.createdAt)])}
      <div class="entry-actions">
        <a class="btn btn-primary" href="${escapeHtml(mapDetailHref(map.id))}">Open map</a>
        <button class="btn btn-secondary" type="button" data-process-map="${escapeHtml(map.id)}">Process</button>
        <button class="btn btn-danger" type="button" data-delete-map="${escapeHtml(map.id)}">Delete</button>
      </div>
    </article>`;
}

function renderMapsOverviewPage() {
  updateTopNavActivePage("maps");
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell map-page">
      <div class="page-hero">
        <p class="eyebrow">Interactive maps</p>
        <h1>Map Studio</h1>
        <p>Upload world, region, or city maps here. This module stores maps, city pins, and city notes separately from the general media library.</p>
      </div>
      <div class="map-page-grid">
        <section class="setup-form-panel">
          <div class="section-heading"><div><p class="eyebrow">Upload</p><h2>New map</h2></div></div>
          ${mapUploadFormMarkup()}
        </section>
        <section class="setup-summary-panel">
          <div class="section-heading">
            <div><p class="eyebrow">Maps</p><h2>Uploaded maps</h2></div>
            <span id="map-count" class="muted"></span>
          </div>
          <div class="media-toolbar">
            <button class="btn btn-secondary" type="button" id="map-refresh">Refresh</button>
          </div>
          <div class="map-list-grid" id="map-list" aria-live="polite"></div>
        </section>
      </div>
    </section>`;
  initMapsOverviewPage();
}

async function loadMapsOverview() {
  const list = document.getElementById("map-list");
  const count = document.getElementById("map-count");
  if (!list) return;
  list.innerHTML = `<div class="empty-state">Loading maps...</div>`;
  try {
    const maps = await listInteractiveMaps();
    if (count) count.textContent = `${maps.length} map${maps.length === 1 ? "" : "s"}`;
    list.innerHTML = maps.length
      ? maps.map(mapCardMarkup).join("")
      : `<div class="empty-state">No interactive maps yet. Upload a map image to create the first map viewer.</div>`;
  } catch (error) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    if (count) count.textContent = "Backend offline";
  }
}

function initMapFilePreview() {
  const input = document.getElementById("map-file");
  const trigger = document.getElementById("map-file-trigger");
  const status = document.getElementById("map-file-status");
  const preview = document.getElementById("map-file-preview");
  if (!input || !trigger) return;

  trigger.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (status) {
      status.textContent = file ? `${file.name} ready (${formatBytes(file.size)}).` : "No map image chosen";
      status.classList.toggle("error", Boolean(file && !file.type.startsWith("image/")));
    }
    if (!preview) return;
    if (!file || !file.type.startsWith("image/")) {
      preview.removeAttribute("src");
      preview.hidden = true;
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
}

function initMapsOverviewPage() {
  initMapFilePreview();
  document.getElementById("map-refresh")?.addEventListener("click", loadMapsOverview);
  document.getElementById("map-list")?.addEventListener("click", async (event) => {
    const deleteId = event.target?.dataset?.deleteMap;
    const processId = event.target?.dataset?.processMap;
    if (deleteId) {
      if (!confirm("Delete this interactive map, its city pins, notes, and stored image?")) return;
      try {
        await deleteInteractiveMap(deleteId);
        await loadMapsOverview();
      } catch (error) {
        alert(error.message);
      }
    }
    if (processId) {
      try {
        await processInteractiveMap(processId);
        await loadMapsOverview();
      } catch (error) {
        alert(error.message);
      }
    }
  });

  document.getElementById("map-upload-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById("map-upload-status");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const file = document.getElementById("map-file")?.files?.[0];
    if (!file?.type?.startsWith("image/")) {
      if (status) {
        status.textContent = "Choose a jpg, png, webp, or gif map image.";
        status.classList.add("error");
      }
      return;
    }
    if (status) {
      status.textContent = "Uploading and preparing map...";
      status.classList.remove("error");
    }
    try {
      const payload = await uploadInteractiveMap(new FormData(form));
      if (status) status.textContent = payload.processing?.message || "Map ready for city pins.";
      form.reset();
      const preview = document.getElementById("map-file-preview");
      if (preview) {
        preview.removeAttribute("src");
        preview.hidden = true;
      }
      const fileStatus = document.getElementById("map-file-status");
      if (fileStatus) fileStatus.textContent = "No map image chosen";
      await loadMapsOverview();
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.classList.add("error");
      }
    }
  });

  loadMapsOverview();
}

function mapPinMarkup(city, options = {}) {
  const selected = options.selectedCityId === city.id;
  return `
    <a class="map-pin${selected ? " is-selected" : ""}" href="${escapeHtml(cityDetailHref(city.mapId, city.id))}" style="left:${Number(city.normalizedX) * 100}%;top:${Number(city.normalizedY) * 100}%;" title="${escapeHtml(city.cityName)}">
      <span></span>
      <strong>${escapeHtml(city.cityName)}</strong>
    </a>`;
}

function mapCanvasStyle(map) {
  const width = Number(map?.imageWidth) || 16;
  const height = Number(map?.imageHeight) || 9;
  return `--map-scale: 1; aspect-ratio: ${width} / ${height};`;
}

function interactiveMapViewerMarkup(map, cities = [], options = {}) {
  const title = map.title || map.originalFilename || "Map";
  const imageUrl = resolveBackendUrl(map.imageUrl);
  return `
    <div class="interactive-map-shell" data-map-viewer>
      <div class="interactive-map-toolbar">
        <button class="btn btn-secondary" type="button" data-map-zoom-out>Zoom out</button>
        <button class="btn btn-secondary" type="button" data-map-zoom-reset>Reset</button>
        <button class="btn btn-secondary" type="button" data-map-zoom-in>Zoom in</button>
      </div>
      <div class="interactive-map-viewport">
        <div class="interactive-map-canvas" style="${escapeHtml(mapCanvasStyle(map))}" data-map-canvas>
          <img data-map-image src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" draggable="false" />
          ${cities.map((city) => mapPinMarkup(city, options)).join("")}
          <button class="map-click-marker" type="button" data-map-click-marker hidden></button>
        </div>
      </div>
    </div>`;
}

function cityPinFormMarkup() {
  return `
    <form class="panel form-grid city-pin-form" id="city-pin-form">
      <label class="full-width">City name<input id="city-name" type="text" placeholder="Neverwinter" required /></label>
      <input id="city-x" type="hidden" />
      <input id="city-y" type="hidden" />
      <input id="city-normalized-x" type="hidden" />
      <input id="city-normalized-y" type="hidden" />
      <input id="city-edit-id" type="hidden" />
      <div class="form-message full-width" id="city-pin-status" aria-live="polite">Click the map to choose a city location.</div>
      <button class="btn btn-primary" type="submit" id="city-pin-submit">Save city pin</button>
      <button class="btn btn-secondary" type="button" id="city-pin-cancel-edit" hidden>Cancel edit</button>
    </form>`;
}

function cityListMarkup(map, cities) {
  if (!cities.length) return `<div class="empty-state">No city pins yet. Click the map image to place the first city.</div>`;
  return cities.map((city) => `
    <article class="city-list-item" data-city-id="${escapeHtml(city.id)}">
      <div>
        <h3>${escapeHtml(city.cityName)}</h3>
        <p>${Math.round(Number(city.normalizedX) * 100)}%, ${Math.round(Number(city.normalizedY) * 100)}% on map</p>
      </div>
      <div class="entry-actions">
        <a class="btn btn-primary" href="${escapeHtml(cityDetailHref(map.id, city.id))}">Open</a>
        <button class="btn btn-secondary" type="button" data-edit-city="${escapeHtml(city.id)}">Edit</button>
        <button class="btn btn-danger" type="button" data-delete-city="${escapeHtml(city.id)}">Delete</button>
      </div>
    </article>`).join("");
}

async function renderMapDetailPage(mapId) {
  updateTopNavActivePage("maps");
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell map-detail-page">
      <div class="page-hero">
        <p class="eyebrow">Interactive map</p>
        <h1>Loading map...</h1>
        <p>Preparing city pins and notes.</p>
      </div>
    </section>`;

  try {
    const { map, cities = [] } = await getInteractiveMap(mapId);
    const title = map.title || map.originalFilename || "Map";
    document.querySelector("main").innerHTML = `
      <section class="page-layout section-shell map-detail-page">
        <div class="page-hero">
          <p class="eyebrow">Interactive map</p>
          <h1>${escapeHtml(title)}</h1>
          <p>${map.status === "ready" ? "Click the map to add city pins. Existing pins open dedicated city note pages." : `Map status: ${escapeHtml(map.status)}.`}</p>
          <div class="hero-actions">
            <a class="btn btn-secondary" href="index.html#/maps">Back to maps</a>
            <button class="btn btn-secondary" type="button" id="process-current-map">Process map</button>
          </div>
        </div>
        <div class="map-detail-grid">
          <section class="map-view-panel">
            ${interactiveMapViewerMarkup(map, cities)}
          </section>
          <aside class="map-side-panel">
            <div class="section-heading"><div><p class="eyebrow">Manual pins</p><h2>Add a city</h2></div></div>
            ${cityPinFormMarkup()}
            <div class="section-heading"><div><p class="eyebrow">Cities</p><h2>City pins</h2></div></div>
            <div class="city-list" id="city-list" aria-live="polite">${cityListMarkup(map, cities)}</div>
          </aside>
        </div>
      </section>`;
    initMapDetailPage(map, cities);
  } catch (error) {
    renderNotFoundPage(error.message);
  }
}

function setCityPinFormPoint(map, normalizedX, normalizedY) {
  const pointX = Math.max(0, Math.min(1, Number(normalizedX)));
  const pointY = Math.max(0, Math.min(1, Number(normalizedY)));
  const x = Math.round(pointX * (Number(map.imageWidth) || 0));
  const y = Math.round(pointY * (Number(map.imageHeight) || 0));
  const fields = {
    "city-x": x,
    "city-y": y,
    "city-normalized-x": pointX,
    "city-normalized-y": pointY,
  };
  Object.entries(fields).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = String(value);
  });
  const status = document.getElementById("city-pin-status");
  if (status) {
    status.textContent = `Pin selected at ${Math.round(pointX * 100)}%, ${Math.round(pointY * 100)}% on the map.`;
    status.classList.remove("error");
  }
  const marker = document.querySelector("[data-map-click-marker]");
  if (marker) {
    marker.style.left = `${pointX * 100}%`;
    marker.style.top = `${pointY * 100}%`;
    marker.hidden = false;
  }
}

function mapPointFromCanvasEvent(event, canvas) {
  const rect = canvas?.getBoundingClientRect?.();
  if (!rect?.width || !rect?.height) return null;
  return {
    normalizedX: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    normalizedY: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}

function setCityPinFormEditState(city = null) {
  const editInput = document.getElementById("city-edit-id");
  const nameInput = document.getElementById("city-name");
  const submit = document.getElementById("city-pin-submit");
  const cancel = document.getElementById("city-pin-cancel-edit");
  if (editInput) editInput.value = city?.id || "";
  if (nameInput) nameInput.value = city?.cityName || "";
  if (submit) submit.textContent = city ? "Update city pin" : "Save city pin";
  if (cancel) cancel.hidden = !city;
}

function initMapDetailPage(map, cities) {
  let zoom = 1;
  const canvas = document.querySelector("[data-map-canvas]");
  const applyZoom = () => {
    if (canvas) canvas.style.setProperty("--map-scale", String(zoom));
  };

  document.querySelector("[data-map-zoom-in]")?.addEventListener("click", () => {
    zoom = Math.min(2.5, Math.round((zoom + 0.25) * 100) / 100);
    applyZoom();
  });
  document.querySelector("[data-map-zoom-out]")?.addEventListener("click", () => {
    zoom = Math.max(0.75, Math.round((zoom - 0.25) * 100) / 100);
    applyZoom();
  });
  document.querySelector("[data-map-zoom-reset]")?.addEventListener("click", () => {
    zoom = 1;
    applyZoom();
  });
  document.getElementById("process-current-map")?.addEventListener("click", async () => {
    try {
      const result = await processInteractiveMap(map.id);
      alert(result.message || "Map processing finished.");
      renderMapDetailPage(map.id);
    } catch (error) {
      alert(error.message);
    }
  });

  canvas?.addEventListener("click", (event) => {
    if (event.target?.closest?.(".map-pin")) return;
    const point = mapPointFromCanvasEvent(event, canvas);
    if (!point) return;
    setCityPinFormPoint(map, point.normalizedX, point.normalizedY);
    document.getElementById("city-name")?.focus();
  });

  document.getElementById("city-pin-cancel-edit")?.addEventListener("click", () => {
    setCityPinFormEditState(null);
    const marker = document.querySelector("[data-map-click-marker]");
    if (marker) marker.hidden = true;
    const status = document.getElementById("city-pin-status");
    if (status) {
      status.textContent = "Click the map to choose a city location.";
      status.classList.remove("error");
    }
  });

  document.getElementById("city-pin-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("city-pin-status");
    const editId = document.getElementById("city-edit-id")?.value;
    const payload = {
      cityName: document.getElementById("city-name")?.value.trim(),
      x: Number(document.getElementById("city-x")?.value),
      y: Number(document.getElementById("city-y")?.value),
      normalizedX: Number(document.getElementById("city-normalized-x")?.value),
      normalizedY: Number(document.getElementById("city-normalized-y")?.value),
    };
    if (!payload.cityName || !Number.isFinite(payload.normalizedX) || !Number.isFinite(payload.normalizedY)) {
      if (status) {
        status.textContent = "Click the map and enter a city name before saving.";
        status.classList.add("error");
      }
      return;
    }
    try {
      if (editId) await updateMapCity(map.id, editId, payload);
      else await createMapCity(map.id, payload);
      renderMapDetailPage(map.id);
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.classList.add("error");
      }
    }
  });

  document.getElementById("city-list")?.addEventListener("click", async (event) => {
    const editId = event.target?.dataset?.editCity;
    const deleteId = event.target?.dataset?.deleteCity;
    if (editId) {
      const city = cities.find((item) => item.id === editId);
      if (!city) return;
      setCityPinFormEditState(city);
      setCityPinFormPoint(map, Number(city.normalizedX), Number(city.normalizedY));
      document.getElementById("city-name")?.focus();
    }
    if (deleteId) {
      if (!confirm("Delete this city pin and its notes?")) return;
      try {
        await deleteMapCity(map.id, deleteId);
        renderMapDetailPage(map.id);
      } catch (error) {
        alert(error.message);
      }
    }
  });
}

function mapPreviewMarkup(map, cities, selectedCity) {
  const imageUrl = resolveBackendUrl(map.imageUrl);
  return `
    <div class="map-preview">
      <div class="interactive-map-canvas" style="${escapeHtml(mapCanvasStyle(map))}">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(map.title || "Map preview")}" draggable="false" />
        ${cities.map((city) => mapPinMarkup(city, { selectedCityId: selectedCity.id })).join("")}
      </div>
    </div>`;
}

function cityNoteEditorMarkup() {
  return `
    <form class="panel form-grid city-note-form" id="city-note-form">
      <label>Note title<input id="city-note-title" type="text" placeholder="Faction, rumor, district, quest..." required /></label>
      <label class="full-width">Content<textarea id="city-note-content" rows="4" placeholder="Notes for this city..." required></textarea></label>
      <input id="city-note-edit-id" type="hidden" />
      <div class="form-message full-width" id="city-note-status" aria-live="polite"></div>
      <button class="btn btn-primary" type="submit">Save city note</button>
      <button class="btn btn-secondary" type="button" id="city-note-cancel-edit" hidden>Cancel edit</button>
    </form>`;
}

function cityNotesListMarkup(notes) {
  if (!notes.length) return `<div class="empty-state">No notes for this city yet.</div>`;
  return notes.map((note) => `
    <article class="content-card entry-card city-note-card" data-city-note-id="${escapeHtml(note.id)}">
      <div class="card-kicker"><span class="status-badge status-active">City note</span><span>${escapeHtml(formatUploadedAt(note.updatedAt || note.createdAt))}</span></div>
      <h3>${escapeHtml(note.title)}</h3>
      ${widgetDescriptionMarkup(note.content)}
      <div class="entry-actions">
        <button class="btn btn-secondary" type="button" data-edit-city-note="${escapeHtml(note.id)}">Edit</button>
        <button class="btn btn-danger" type="button" data-delete-city-note="${escapeHtml(note.id)}">Delete</button>
      </div>
    </article>`).join("");
}

async function renderCityDetailPage(mapId, cityId) {
  updateTopNavActivePage("maps");
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell city-page">
      <div class="page-hero">
        <p class="eyebrow">City notes</p>
        <h1>Loading city...</h1>
      </div>
    </section>`;

  try {
    const { map, cities = [] } = await getInteractiveMap(mapId);
    const city = cities.find((item) => item.id === cityId);
    if (!city) {
      renderNotFoundPage("That city pin is not saved on this map.");
      return;
    }
    const notes = await listCityNotes(mapId, cityId);
    document.querySelector("main").innerHTML = `
      <section class="page-layout section-shell city-page">
        <div class="page-hero">
          <p class="eyebrow">Map city</p>
          <h1>${escapeHtml(city.cityName)}</h1>
          <p>${escapeHtml(map.title || "Map")} city notes and map preview.</p>
          <div class="hero-actions">
            <a class="btn btn-secondary" href="${escapeHtml(mapDetailHref(map.id))}">Back to map</a>
            <a class="btn btn-ghost" href="index.html#/maps">All maps</a>
          </div>
        </div>
        <div class="city-page-grid">
          <aside class="city-preview-panel">
            <div class="section-heading"><div><p class="eyebrow">Location</p><h2>Map preview</h2></div></div>
            ${mapPreviewMarkup(map, cities, city)}
          </aside>
          <section class="city-notes-panel">
            <div class="section-heading"><div><p class="eyebrow">Notes</p><h2>City notes</h2></div></div>
            ${cityNoteEditorMarkup()}
            <div class="collection-grid city-notes-list" id="city-notes-list" aria-live="polite">${cityNotesListMarkup(notes)}</div>
          </section>
        </div>
      </section>`;
    initCityDetailPage(map, city, notes);
  } catch (error) {
    renderNotFoundPage(error.message);
  }
}

function setCityNoteForm(note = null) {
  const idInput = document.getElementById("city-note-edit-id");
  const titleInput = document.getElementById("city-note-title");
  const contentInput = document.getElementById("city-note-content");
  const cancel = document.getElementById("city-note-cancel-edit");
  if (idInput) idInput.value = note?.id || "";
  if (titleInput) titleInput.value = note?.title || "";
  if (contentInput) contentInput.value = note?.content || "";
  if (cancel) cancel.hidden = !note;
}

function initCityDetailPage(map, city, notes) {
  document.getElementById("city-note-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("city-note-status");
    const noteId = document.getElementById("city-note-edit-id")?.value;
    const payload = {
      title: document.getElementById("city-note-title")?.value.trim(),
      content: document.getElementById("city-note-content")?.value.trim(),
    };
    if (status) {
      status.textContent = "Saving city note...";
      status.classList.remove("error");
    }
    try {
      if (noteId) await updateCityNote(map.id, city.id, noteId, payload);
      else await createCityNote(map.id, city.id, payload);
      renderCityDetailPage(map.id, city.id);
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.classList.add("error");
      }
    }
  });

  document.getElementById("city-note-cancel-edit")?.addEventListener("click", () => setCityNoteForm(null));
  document.getElementById("city-notes-list")?.addEventListener("click", async (event) => {
    const editId = event.target?.dataset?.editCityNote;
    const deleteId = event.target?.dataset?.deleteCityNote;
    if (editId) {
      const note = notes.find((item) => item.id === editId);
      setCityNoteForm(note);
      document.getElementById("city-note-title")?.focus();
    }
    if (deleteId) {
      if (!confirm("Delete this city note?")) return;
      try {
        await deleteCityNote(map.id, city.id, deleteId);
        renderCityDetailPage(map.id, city.id);
      } catch (error) {
        alert(error.message);
      }
    }
  });
}

function initAiPlaceholder() {
  const form = document.getElementById("ai-form");
  const question = document.getElementById("ai-question");
  const response = document.getElementById("ai-response");
  if (!form || !question || !response) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const asked = question.value.trim();
    if (!asked) return;

    response.innerHTML = `
      <h3>Assistant response unavailable</h3>
      <p>AI analysis is not connected yet. When available, it will retrieve user-created notes, NPCs, factions, items, maps, and calendar events before answering.</p>
      <ul class="compact-list">
        <li>Save the relevant campaign widgets before asking for context-aware analysis.</li>
        <li>Keep private notes marked DM-only when player visibility matters.</li>
        <li>Review linked calendar events before making timeline changes.</li>
      </ul>
      <p class="muted">Question received: "${escapeHtml(asked)}"</p>
    `;
  });
}

function campaignDestinationHref(campaign) {
  if (campaignReady(campaign)) return dashboardHref(campaign.id);
  if ((campaign.players || []).length) return campaignStartNoteHref(campaign.id);
  return campaignSetupHref(campaign.id);
}

function campaignWidgetCounts(campaignId) {
  const counts = Object.fromEntries(Array.from(USER_WIDGET_COLLECTIONS).map((key) => [
    key,
    getAllStoredCollection(key).filter((entry) => entry.campaignId === campaignId).length,
  ]));
  return {
    widgets: Object.values(counts).reduce((total, count) => total + count, 0),
    notes: counts.notes || 0,
    characters: counts.characters || 0,
    events: counts.events || 0,
  };
}

function campaignLibraryCardMarkup(campaign) {
  const counts = campaignWidgetCounts(campaign.id);
  const ready = campaignReady(campaign);
  const status = ready ? "Active campaign" : (campaign.players.length ? "Setup in progress" : "New campaign");
  return `
    <article class="content-card campaign-library-card" data-campaign-card="${escapeHtml(campaign.id)}">
      <div class="card-kicker">
        <span class="status-badge ${ready ? "status-active" : "status-prepared"}">${escapeHtml(status)}</span>
        <span>${escapeHtml(campaign.workspaceLabel || "Local campaign")}</span>
      </div>
      <h2>${escapeHtml(campaign.name)}</h2>
      <p>${escapeHtml(campaign.description || "Campaign workspace")}</p>
      <dl class="campaign-library-stats">
        <div><dt>Widgets</dt><dd>${counts.widgets}</dd></div>
        <div><dt>Players</dt><dd>${campaign.players.length}</dd></div>
        <div><dt>Notes</dt><dd>${counts.notes}</dd></div>
        <div><dt>NPCs</dt><dd>${counts.characters}</dd></div>
      </dl>
      <div class="entry-actions">
        <a class="btn btn-primary" href="${escapeHtml(campaignDestinationHref(campaign))}" data-open-campaign="${escapeHtml(campaign.id)}">${ready ? "Open dashboard" : "Continue setup"}</a>
        <button class="btn btn-danger" type="button" data-delete-campaign="${escapeHtml(campaign.id)}">Delete</button>
      </div>
    </article>`;
}

function renderCampaignLibraryPage() {
  updateTopNavActivePage("dashboard");
  const main = document.querySelector("main");
  if (!main) return;
  const campaigns = getCampaigns();
  main.innerHTML = `
    <section class="page-layout section-shell campaign-library-page">
      <div class="page-hero campaign-library-hero">
        <p class="eyebrow">Campaign library</p>
        <h1>Choose the world you want to run.</h1>
        <p>Each campaign has its own dashboard, players, notes, NPCs, encounters, locations, items, events, and comics. New widgets are saved only to the campaign you open.</p>
      </div>
      <div class="campaign-library-layout">
        <section>
          <div class="section-heading">
            <div><p class="eyebrow">Saved campaigns</p><h2>Your campaign sections</h2></div>
          </div>
          <div class="campaign-library-grid" id="campaign-library-grid">
            ${campaigns.map(campaignLibraryCardMarkup).join("")}
          </div>
        </section>
        <aside class="panel campaign-create-panel">
          <div>
            <p class="eyebrow">New campaign</p>
            <h2>Create a separate workspace</h2>
            <p>After creation, only that campaign's widgets will appear while it is active.</p>
          </div>
          <form class="form-grid" id="campaign-create-form">
            <label>Campaign name<input id="new-campaign-name" type="text" placeholder="The Ashen Crown" required /></label>
            <label class="full-width">Description<textarea id="new-campaign-description" rows="4" placeholder="Premise, setting, or table context..."></textarea></label>
            <button class="btn btn-primary" type="submit">Create campaign</button>
          </form>
        </aside>
      </div>
    </section>`;

  document.getElementById("campaign-create-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const campaign = createCampaign({
      name: document.getElementById("new-campaign-name")?.value,
      description: document.getElementById("new-campaign-description")?.value,
    });
    window.location.href = campaignSetupHref(campaign.id);
  });

  document.querySelectorAll("[data-open-campaign]").forEach((link) => {
    link.addEventListener("click", () => setActiveCampaign(link.dataset.openCampaign));
  });
  document.querySelectorAll("[data-delete-campaign]").forEach((button) => {
    button.addEventListener("click", () => {
      const campaign = getCampaign(button.dataset.deleteCampaign);
      if (!campaign || !confirm(`Delete "${campaign.name}" and all of its widgets?`)) return;
      deleteCampaign(campaign.id);
      renderCampaignLibraryPage();
    });
  });
}

function renderNotFoundPage(message) {
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell">
      <div class="page-hero">
        <p class="eyebrow">Not found</p>
        <h1>We could not find that page.</h1>
        <p>${escapeHtml(message)}</p>
        <a class="btn btn-primary" href="index.html">Back to dashboard</a>
      </div>
    </section>`;
}

function renderAddedPlayersSummary(campaign) {
  const list = document.getElementById("added-players-summary");
  if (!list) return;
  const players = campaign.players || [];
  const form = document.getElementById("player-character-form");
  const draftPlayer = form ? buildPlayerCharacter(form) : null;
  const groups = players.map((player, index) => playerSectionGroupMarkup(player, index + 1, false));
  const draftGroup = draftPlayer && playerHasCompletedSection(draftPlayer)
    ? playerSectionGroupMarkup(draftPlayer, players.length + 1, true)
    : "";
  if (!groups.length && !draftGroup) {
    list.innerHTML = `<div class="empty-state">No player characters added yet. Save the first hero to build the party.</div>`;
    return;
  }
  list.innerHTML = [...groups, draftGroup].filter(Boolean).join("");
  bindPlayerSummaryControls(form);
}

function hasNumber(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function hasText(value) {
  return Boolean(String(value ?? "").trim());
}

function abilitySectionComplete(player) {
  return ABILITIES.every((ability) => hasNumber(player.abilities?.[ability.key]));
}

function playerSectionDefinitions(player, options = {}) {
  const combat = player.combat || {};
  const classLevels = classLevelEntriesForPlayer(player);
  const classSummary = classLevelSummary(classLevels);
  const personality = player.personality || {};
  const storyBlocks = [
    ["Short description", player.description],
    ["Personality traits", personality.traits],
    ["Ideals", personality.ideals],
    ["Bonds", personality.bonds],
    ["Flaws", personality.flaws],
    ["Backstory and notes", player.notes],
  ].filter(([, value]) => hasText(value));
  const languageTags = (player.languages || []).map(languageLabel);
  const toolTags = (player.toolProficiencies || []).map(toolLabel);
  const equipmentTags = equipmentItems(player.equipment);
  const backgroundBonuses = player.backgroundAbilityBonuses || {};
  const backgroundBonusTags = ABILITIES.map((ability) => {
    const amount = Number(backgroundBonuses[ability.key]) || 0;
    return amount ? `${ability.short} ${signedModifier(amount)}` : "";
  }).filter(Boolean);
  const lineageBonuses = player.lineageAbilityBonuses || {};
  const lineageBonusTags = ABILITIES.map((ability) => {
    const amount = Number(lineageBonuses[ability.key]) || 0;
    return amount ? `${ability.short} ${signedModifier(amount)}` : "";
  }).filter(Boolean);
  const abilityBonusTags = [
    lineageBonusTags.length ? `Race: ${lineageBonusTags.join(", ")}` : "",
    backgroundBonusTags.length ? `Background: ${backgroundBonusTags.join(", ")}` : "",
  ].filter(Boolean);
  const backgroundPackage = backgroundPackageForName(player.background) || {};
  const backgroundNarrative = backgroundNarrativeDescription(backgroundPackage);
  const backgroundEffects = backgroundEffectTags(backgroundPackage, backgroundBonusTags);
  const hasWeapons = equipmentWeaponSummaries(player).length > 0;
  const homebrewEquipmentItems = equipmentHomebrewItemSummaries(player);
  const featureBlocksVisible = featureBlocksForSectionWidget(player);
  const nonWeaponEquipmentTags = equipmentTags.filter((item) => {
    const homebrewItem = homebrewItemForEquipmentItem(item);
    return !homebrewItem && !weaponForEquipmentItem(item);
  });
  const hasGold = Number(player.gold) > 0;
  const equipmentComplete = equipmentTags.length > 0 || hasText(player.features) || hasGold;
  const equipmentStarted = equipmentComplete || languageTags.length || toolTags.length || equipmentTags.length;
  const combatStarted = hasText(player.classRole) || hasText(player.race) || ABILITIES.some((ability) => hasNumber(player.abilities?.[ability.key])) || equipmentStarted;
  const combatComplete = Boolean(abilitySectionComplete(player) && hasText(player.classRole) && hasText(player.race) && equipmentComplete);
  const canRollHitPoints = Boolean(options.isDraft && Number(player.level) > 1 && !combat.hitPointsRolled);
  return [
    {
      key: "identity",
      title: "Character sheet header",
      complete: hasText(player.playerName) && hasText(player.characterName),
      body: `
        <h3>${escapeHtml(player.characterName || "Unnamed hero")}</h3>
        ${widgetTagsMarkup([`Player: ${player.playerName}`, classSummary || player.classRole, player.level ? `Level ${player.level}` : "", player.race, player.alignment])}`,
    },
    {
      key: "personality",
      title: "Personality and story",
      complete: storyBlocks.length > 0,
      body: `<div class="story-widget-grid">${storyBlocks.map(([label, value]) => `
        <section>
          <h4>${escapeHtml(label)}</h4>
          <p>${escapeHtml(value)}</p>
        </section>`).join("")}</div>`,
    },
    {
      key: "background",
      title: "Background",
      complete: hasText(player.background),
      body: `
        <section class="background-widget-card">
          <h3>${escapeHtml(player.background || "Choose a background")}</h3>
          ${backgroundNarrative ? `<p class="background-widget-narrative">${escapeHtml(backgroundNarrative)}</p>` : ""}
        </section>
        ${widgetTagsMarkup(backgroundEffects)}`,
    },
    {
      key: "abilities",
      title: "Abilities",
      complete: abilitySectionComplete(player),
      body: `${abilityBonusTags.length ? `<div class="passive-perception-pill ability-bonus-pill"><span>Ability bonuses</span><strong>${escapeHtml(abilityBonusTags.join(" · "))}</strong></div>` : ""}
      <dl class="section-widget-stat-grid">${ABILITIES.map((ability) => `
        <div><dt>${escapeHtml(ability.short)}</dt><dd>${escapeHtml(player.abilities?.[ability.key])} <small>${signedModifier(abilityModifier(player.abilities?.[ability.key]))}</small></dd></div>`).join("")}</dl>`,
    },
    {
      key: "proficiency",
      title: "Proficiency and skills",
      complete: Boolean((player.savingThrowProficiencies || []).length || (player.skillProficiencies || []).length),
      body: `
        <div class="passive-perception-pill"><span>Passive Perception</span><strong>${escapeHtml(playerPassivePerception(player))}</strong></div>
        <h3>Saving Throws</h3>
        <div class="skill-chip-grid saving-throw-chip-grid">
          ${ABILITIES.filter((ability) => (player.savingThrowProficiencies || []).includes(ability.key)).map((ability) => `<span class="is-proficient">${escapeHtml(ability.label)} <strong>${signedModifier(savingThrowBonus(player, ability.key))}</strong></span>`).join("")}
        </div>
        <h3>Skills</h3>
        <div class="skill-chip-grid">
          ${SKILLS.filter((skill) => (player.skillProficiencies || []).includes(skill.key)).map((skill) => `<span class="is-proficient">${escapeHtml(skill.label)} <strong>${signedModifier(skillBonus(player, skill))}</strong></span>`).join("")}
        </div>`,
    },
    {
      key: "combat",
      title: "Combat",
      complete: combatStarted,
      status: combatComplete ? "complete" : "partial",
      body: `<dl class="player-preview-stats">
        <div><dt>AC</dt><dd>${escapeHtml(combat.armorClass || "—")}</dd></div>
        <div><dt>Init</dt><dd>${escapeHtml(signedModifier(combat.initiative || 0))}</dd></div>
        <div><dt>HP</dt><dd>${escapeHtml(combat.hitPointMaximum || "—")}</dd></div>
        <div><dt>Speed</dt><dd>${escapeHtml(combat.speed ? `${combat.speed} ft.` : "—")}</dd></div>
        <div><dt>Hit Dice</dt><dd>${escapeHtml(combat.hitDice || "—")}</dd></div>
      </dl>
      ${canRollHitPoints ? `<button class="btn btn-secondary hp-widget-roll" type="button" data-roll-hit-points>Roll HP for levels 2-${escapeHtml(player.level)}</button>` : ""}`,
    },
    {
      key: "equipment",
      title: "Equipment and features",
      complete: equipmentStarted,
      status: equipmentComplete ? "complete" : "partial",
      body: `<div class="equipment-widget-sections">
        ${languageTags.length ? `<section><h4>Languages</h4>${widgetTagsMarkup(languageTags)}</section>` : ""}
        ${toolTags.length ? `<section><h4>Tool proficiencies</h4>${widgetTagsMarkup(toolTags)}</section>` : ""}
        ${hasWeapons ? `<section><h4>Weapons</h4>${equipmentWeaponCardsMarkup(player)}</section>` : ""}
        ${homebrewEquipmentItems.length ? `<section><h4>Homebrew items</h4>${equipmentHomebrewCardsMarkup(player)}</section>` : ""}
        ${nonWeaponEquipmentTags.length ? `<section><h4>Equipment</h4>${widgetTagsMarkup(nonWeaponEquipmentTags)}</section>` : ""}
        ${featureBlocksVisible.length ? `<section><h4>Features and traits</h4>${featureBlocksMarkup("", featureBlocksVisible)}</section>` : ""}
        <section><h4>Gold</h4><button class="btn btn-secondary gp-shop-button" type="button" data-open-equipment-shop>${escapeHtml(player.gold || 0)} GP</button></section>
      </div>`,
    },
  ];
}

function playerCompletedSections(player, options = {}) {
  return playerSectionDefinitions(player, options).filter((section) => section.complete);
}

function playerHasCompletedSection(player) {
  return playerCompletedSections(player).length > 0;
}

function playerSectionGroupMarkup(player, playerNumber, isDraft) {
  const sections = playerCompletedSections(player, { isDraft });
  if (!sections.length) return "";
  return `
    <section class="player-widget-group">
      <div class="player-widget-group-title">
        <span>${escapeHtml(isDraft ? "Draft" : "Saved")}</span>
        <h3>Player ${escapeHtml(playerNumber)}</h3>
      </div>
      ${sections.map((section) => `
        <article class="content-card compact-player-card section-summary-card" data-section-key="${escapeHtml(section.key)}">
          <div class="card-kicker"><span class="status-badge ${section.status === "partial" ? "status-prepared" : "status-active"}">${section.status === "partial" ? "Partial" : "Complete"}</span><span>${escapeHtml(section.title)}</span></div>
          ${section.body}
        </article>`).join("")}
    </section>`;
}

function abilityInputMarkup(ability) {
  return `
    <label class="ability-entry" data-ability-entry="${escapeHtml(ability.key)}">
      <span>${escapeHtml(ability.label)}</span>
      <input id="player-${escapeHtml(ability.key)}" type="number" min="1" max="30" step="1" placeholder="10" data-ability-score="${escapeHtml(ability.key)}" />
      <button class="btn btn-secondary ability-roll-button" type="button" data-roll-ability="${escapeHtml(ability.key)}">Roll</button>
      <small id="player-${escapeHtml(ability.key)}-modifier">+0</small>
    </label>`;
}

function attackInputMarkup(index) {
  return `
    <div class="attack-row">
      <label>Name<input id="player-attack-${index}-name" type="text" placeholder="Longsword, Fire Bolt..." /></label>
      <label>Atk Bonus<input id="player-attack-${index}-bonus" type="text" placeholder="+5" /></label>
      <label>Damage / Type<input id="player-attack-${index}-damage" type="text" placeholder="1d8+3 slashing" /></label>
    </div>`;
}

function playerSpellcastingFormMarkup() {
  return `
    <fieldset class="sheet-form-section spellcasting-form-section" id="player-spellcasting-section" hidden>
      <legend>Starting spells</legend>
      <div class="spellcasting-form-summary full-width" id="player-spellcasting-summary"></div>
      <label class="full-width">Search spells<input id="player-spell-search" type="search" placeholder="Filter by spell name, school, level, or casting time..." /></label>
      <div class="spell-picker-count full-width" id="player-spell-picker-count"></div>
      <div class="spell-picker-list full-width" id="player-spell-picker-list"></div>
    </fieldset>`;
}

function spellPickerCardMarkup(spell, selectedSet) {
  const searchText = [spell.name, spell.levelName, spell.school, spell.castingTime, spell.range, spell.duration, (spell.classes || []).join(" ")].join(" ");
  const meta = spellMetadata(spell);
  const selected = selectedSet.has(spell.id);
  return `
    <article class="spell-picker-card ${selected ? "is-selected" : ""}" data-spell-picker-card data-spell-level="${escapeHtml(meta.level)}" data-searchable="${escapeHtml(normalizeRulesText(searchText))}">
      <label class="spell-picker-card-main">
        <input type="checkbox" name="player-spells" value="${escapeHtml(spell.id)}" ${selected ? "checked" : ""} />
        <span class="spell-picker-card-copy">
          <span class="spell-picker-card-title">
            <strong>${escapeHtml(spell.name)}</strong>
            <em>${selected ? "Selected" : "Choose"}</em>
          </span>
          <small>${escapeHtml(meta.levelLabel)} · ${escapeHtml(spell.school || "Unknown school")}</small>
        </span>
      </label>
      <div class="spell-picker-card-meta">
        <span>${escapeHtml(spell.castingTime || "Unknown time")}</span>
        <span>${escapeHtml(spell.range || "Unknown range")}</span>
        <span>${escapeHtml(spell.components || "No components listed")}</span>
      </div>
      <div class="spell-badge-row">${spellFeatureBadgesMarkup(spell)}</div>
      <p class="spell-unavailable-reason" data-spell-unavailable-reason hidden></p>
      <details class="spell-picker-details">
        <summary>Details</summary>
        <p>${escapeHtml(spell.description || "No spell summary available.")}</p>
      </details>
    </article>`;
}

function spellPickerSelectionSummaryMarkup(summary = null, classLevels = [], abilities = {}, selectedIds = []) {
  if (!summary) return "";
  const budget = spellSelectionBudgetForClassLevels(classLevels, abilities);
  const counts = selectedSpellCounts(selectedIds);
  const modeLabel = spellSelectionModeLabel(classLevels, abilities);
  const slotParts = spellSlotSummaryParts(summary);
  return `
    <div class="spell-picker-summary-grid">
      <div class="spell-picker-summary-card ${counts.cantrips > budget.cantrips ? "is-warning" : ""}">
        <span>Cantrips selected</span>
        <strong>${escapeHtml(counts.cantrips)} / ${escapeHtml(budget.cantrips)}</strong>
      </div>
      <div class="spell-picker-summary-card ${counts.leveled > budget.leveled ? "is-warning" : ""}">
        <span>${escapeHtml(modeLabel)}</span>
        <strong>${escapeHtml(counts.leveled)} / ${escapeHtml(budget.leveled)}</strong>
      </div>
      <div class="spell-picker-summary-card spell-picker-slot-card">
        <span>Spell slots</span>
        <strong>${slotParts.length ? escapeHtml(slotParts.join(", ")) : "None"}</strong>
      </div>
    </div>
    <div class="spell-picker-guidance">${widgetTagsMarkup(summary.entries.map((entry) => `${entry.className} spellcasting (${entry.rule.ability})`))}</div>`;
}

function spellPickerLevelGroupMarkup(group, selectedSet, selectedCountsByLevel) {
  const selectedCount = selectedCountsByLevel[group.level] || 0;
  return `
    <section class="spell-picker-level-group ${group.level === 0 ? "is-cantrip-group" : ""}" data-spell-picker-level-group data-spell-picker-level="${escapeHtml(group.level)}">
      <header class="spell-picker-level-heading">
        <div>
          <h3>${escapeHtml(group.label)}</h3>
          <p>${escapeHtml(group.level === 0 ? "No spell slots required." : `${group.spells.length} available at this spell level.`)}</p>
        </div>
        <strong>${escapeHtml(selectedCount)} selected</strong>
      </header>
      <div class="spell-picker-grid">
        ${group.spells.map((spell) => spellPickerCardMarkup(spell, selectedSet)).join("")}
      </div>
    </section>`;
}

function spellPickerEmptyStateMarkup(summary = null) {
  return `
    <div class="empty-state spell-picker-empty-state">
      ${summary
        ? "This class and level does not have selectable starting spells yet."
        : "Choose a spellcasting class and level to unlock the spell menu."}
    </div>`;
}

function inactiveSpellcastingClassNotice(classLevels = []) {
  const inactive = classLevelEntriesFromParts(classLevels)
    .map((entry) => ({ ...entry, rule: spellcastingRule(entry.className) }))
    .filter((entry) => entry.rule && Number(entry.level) < (entry.rule.startsAt || 1));
  if (!inactive.length) return "";
  return inactive.map((entry) => `${entry.className} starts spellcasting at level ${entry.rule.startsAt || 1}.`).join(" ");
}

function updateSpellPickerGroupCounters(form) {
  const selectedCountsByLevel = selectedSpellIdsByLevel(selectedSpellIdsFromForm(form));
  form.querySelectorAll?.("[data-spell-picker-level-group]").forEach((group) => {
    const level = Number(group.dataset.spellPickerLevel) || 0;
    const count = selectedCountsByLevel[level] || 0;
    const output = group.querySelector(".spell-picker-level-heading strong");
    if (output) output.textContent = `${count} selected`;
  });
}

function selectedSpellLimitReason(spell = {}, budget = {}, counts = {}) {
  const isCantrip = Number(spell.level) === 0;
  if (isCantrip && counts.cantrips >= budget.cantrips) return "Cantrip limit reached";
  if (!isCantrip && counts.leveled >= budget.leveled) return `${budget.modeLabel || "Spell"} limit reached`;
  return "";
}

function setSpellPickerCardState(input, spell = {}, selectedSet, budget = {}, counts = {}) {
  const card = input.closest("[data-spell-picker-card]");
  const selected = selectedSet.has(input.value);
  const reason = selected ? "" : selectedSpellLimitReason(spell, budget, counts);
  const reasonTarget = card?.querySelector("[data-spell-unavailable-reason]");
  input.checked = selected;
  input.disabled = Boolean(reason);
  card?.classList.toggle("is-selected", selected);
  card?.classList.toggle("is-disabled", Boolean(reason));
  card?.setAttribute("title", reason || "");
  if (reasonTarget) {
    reasonTarget.textContent = reason;
    reasonTarget.hidden = !reason;
  }
}

function updateSpellPickerCount(form) {
  const count = form.querySelector("#player-spell-picker-count");
  if (!count) return;
  const selectedSpellIds = selectedSpellIdsFromForm(form);
  const classLevels = classLevelEntriesFromForm(form);
  const abilities = abilityScoresFromForm(form);
  const summary = spellcastingSummaryForClassLevels(classLevels, abilities);
  const budget = spellSelectionBudgetForClassLevels(classLevels, abilities);
  const counts = selectedSpellCounts(selectedSpellIds);
  const modeLabel = spellSelectionModeLabel(classLevels, abilities);
  const cantripText = budget.cantrips ? `${counts.cantrips}/${budget.cantrips} cantrips` : "";
  const leveledText = budget.leveled ? `${counts.leveled}/${budget.leveled} ${modeLabel.toLowerCase()}` : "";
  const overLimit = counts.cantrips > budget.cantrips || counts.leveled > budget.leveled;
  count.textContent = [cantripText, leveledText, spellSlotSummaryParts(summary).length ? `Spell slots: ${spellSlotSummaryParts(summary).join(", ")}` : ""].filter(Boolean).join(" | ");
  count.classList.toggle("is-warning", overLimit);
  updateSpellPickerGroupCounters(form);
}

function filterSpellPicker(form) {
  const query = normalizeRulesText(form.querySelector("#player-spell-search")?.value || "");
  form.querySelectorAll?.("[data-spell-picker-card]").forEach((card) => {
    card.hidden = Boolean(query) && !String(card.dataset.searchable || "").includes(query);
  });
  form.querySelectorAll?.("[data-spell-picker-level-group]").forEach((group) => {
    const visibleCards = Array.from(group.querySelectorAll?.("[data-spell-picker-card]") || []).filter((card) => !card.hidden);
    group.hidden = !visibleCards.length;
  });
}

function enforceSpellSelectionLimits(form) {
  const classLevels = classLevelEntriesFromForm(form);
  const abilities = abilityScoresFromForm(form);
  const budget = {
    ...spellSelectionBudgetForClassLevels(classLevels, abilities),
    modeLabel: spellSelectionModeLabel(classLevels, abilities),
  };
  const counts = selectedSpellCounts(selectedSpellIdsFromForm(form));
  const selectedSet = new Set(selectedSpellIdsFromForm(form));
  form.querySelectorAll?.('input[name="player-spells"]').forEach((input) => {
    setSpellPickerCardState(input, spellById(input.value), selectedSet, budget, counts);
  });
}

function updatePlayerSpellPicker(form) {
  const section = form.querySelector("#player-spellcasting-section");
  const summaryTarget = form.querySelector("#player-spellcasting-summary");
  const list = form.querySelector("#player-spell-picker-list");
  if (!section || !summaryTarget || !list) return;
  const classLevels = classLevelEntriesFromForm(form);
  const abilities = abilityScoresFromForm(form);
  const summary = spellcastingSummaryForClassLevels(classLevels, abilities);
  const inactiveNotice = inactiveSpellcastingClassNotice(classLevels);
  const selectedSet = new Set(selectedSpellIdsFromForm(form));
  const spells = availableSpellsForClassLevels(classLevels);
  section.hidden = !summary && !inactiveNotice;
  if (!summary) {
    summaryTarget.innerHTML = "";
    list.innerHTML = inactiveNotice
      ? `<div class="empty-state spell-picker-empty-state">${escapeHtml(inactiveNotice)}</div>`
      : spellPickerEmptyStateMarkup(null);
    return;
  }
  summaryTarget.innerHTML = spellPickerSelectionSummaryMarkup(summary, classLevels, abilities, selectedSpellIdsFromForm(form));
  if (!spellCollection().length) {
    list.innerHTML = `<div class="empty-state">Spell data is still loading. Save the character after the compendium finishes loading.</div>`;
    return;
  }
  if (!spells.length) {
    list.innerHTML = spellPickerEmptyStateMarkup(summary);
    return;
  }
  const selectedCountsByLevel = selectedSpellIdsByLevel(selectedSpellIdsFromForm(form));
  list.innerHTML = spellsGroupedByLevel(spells).map((group) => spellPickerLevelGroupMarkup(group, selectedSet, selectedCountsByLevel)).join("");
  filterSpellPicker(form);
  enforceSpellSelectionLimits(form);
  updateSpellPickerCount(form);
}

function playerCharacterFormMarkup(options = {}) {
  const saveLabel = options.saveLabel || "ADD ANOTHER PLAYER";
  const continueLabel = options.continueLabel || "GO ON";
  return `
    <form class="panel player-character-form" id="player-character-form" novalidate>
      ${datalistMarkup("player-class-options", PLAYER_CLASSES.map((item) => item.name))}
      ${datalistMarkup("player-race-options", PLAYER_RACES)}
      ${datalistMarkup("player-alignment-options", PLAYER_ALIGNMENTS)}
      ${datalistMarkup("player-background-options", backgroundOptionNames())}
      ${datalistMarkup("player-equipment-options", equipmentOptionNames())}

      <fieldset class="sheet-form-section sheet-form-identity">
        <legend>Character sheet header</legend>
        <label>Player name<input id="player-name" type="text" placeholder="Player name" required /></label>
        <label>Character name<input id="player-character-name" type="text" placeholder="Character name" required /></label>
        <label>Class<input id="player-class-role" type="text" list="player-class-options" placeholder="Fighter" /></label>
        <label>Level<input id="player-level" type="number" min="1" max="20" step="1" placeholder="1" /></label>
        <label class="checkbox-row multiclass-toggle full-width"><input id="player-multiclass-enabled" type="checkbox" /><span>Multiclass</span></label>
        <div class="multiclass-builder full-width" id="player-multiclass-builder" hidden>
          <div class="multiclass-builder-heading">
            <h3>Class levels</h3>
            <strong id="player-multiclass-total">Level 1</strong>
          </div>
          <div class="multiclass-row">
            <label>Primary class levels<input id="player-primary-class-level" type="number" min="1" max="20" step="1" placeholder="1" /></label>
            <label>Second class<input id="player-multiclass-2-class" type="text" list="player-class-options" placeholder="Rogue" /></label>
            <label>Second class levels<input id="player-multiclass-2-level" type="number" min="1" max="20" step="1" placeholder="1" /></label>
            <label>Third class<input id="player-multiclass-3-class" type="text" list="player-class-options" placeholder="Wizard" /></label>
            <label>Third class levels<input id="player-multiclass-3-level" type="number" min="1" max="20" step="1" placeholder="1" /></label>
          </div>
          <div class="multiclass-rule-summary" id="player-multiclass-summary"></div>
        </div>
        <label>Race<input id="player-race" type="text" list="player-race-options" placeholder="Human" /></label>
        <label>Alignment<input id="player-alignment" type="text" list="player-alignment-options" placeholder="Neutral Good" /></label>
        <div class="sheet-derived-grid full-width" id="player-lineage-ability-controls" hidden></div>
        <input id="player-lineage-ability-bonuses" type="hidden" />
        <textarea id="player-lineage-traits" hidden aria-hidden="true"></textarea>
      </fieldset>

      <fieldset class="sheet-form-section bard-subclass-section" id="player-bard-subclass-section" hidden>
        <legend>Bard College</legend>
        ${bardSubclassSelectMarkup({ id: "player-bard-subclass" })}
        <div class="class-feature-preview" id="player-bard-subclass-summary"></div>
      </fieldset>

      <fieldset class="sheet-form-section">
        <legend>Personality and story</legend>
        <label class="full-width">Short description<textarea id="player-description" rows="3" placeholder="What should the table know about this hero?"></textarea></label>
        <label>Personality traits<textarea id="player-personality-traits" rows="3" placeholder="How they behave at the table and in the world..."></textarea></label>
        <label>Ideals<textarea id="player-ideals" rows="3" placeholder="What principles guide them?"></textarea></label>
        <label>Bonds<textarea id="player-bonds" rows="3" placeholder="Who or what keeps them moving?"></textarea></label>
        <label>Flaws<textarea id="player-flaws" rows="3" placeholder="What can create trouble or drama?"></textarea></label>
        <label class="full-width">Backstory and notes<textarea id="player-notes" rows="4" placeholder="Where they come from, what they want, and what the DM should remember..."></textarea></label>
        <div class="character-suggestion-workflow full-width">
          <button class="btn btn-secondary" type="button" id="analyze-character-description">Suggest backgrounds and feats</button>
          <span id="character-suggestion-status" aria-live="polite"></span>
          <div class="character-suggestion-panel" id="character-suggestion-panel" hidden></div>
        </div>
      </fieldset>

      <fieldset class="sheet-form-section">
        <legend>Background</legend>
        <label class="full-width">Background<input id="player-background" type="text" list="player-background-options" placeholder="Acolyte" /></label>
        <div class="sheet-derived-grid full-width" id="player-background-ability-controls" hidden></div>
        <div class="sheet-derived-grid background-equipment-choice-grid full-width" id="player-background-equipment-controls" hidden></div>
        <input id="player-background-ability-bonuses" type="hidden" />
      </fieldset>

      <fieldset class="sheet-form-section">
        <legend>Abilities</legend>
        <div class="ability-form-grid full-width">
          ${ABILITIES.map(abilityInputMarkup).join("")}
        </div>
      </fieldset>

      <fieldset class="sheet-form-section">
        <legend>Proficiency and skills</legend>
        <div class="sheet-derived-grid full-width">
          <div><span>Proficiency Bonus</span><strong id="player-proficiency-bonus">+2</strong></div>
          <div><span>Passive Wisdom (Perception)</span><strong id="player-passive-perception-preview">10</strong></div>
        </div>
        <input id="player-passive-perception" type="hidden" />
        <input id="player-hp-max" type="hidden" />
        <div class="proficiency-columns full-width">
          <div>
            <h3>Saving throw proficiencies</h3>
            <div class="checkbox-grid compact-checkbox-grid">
              ${checkboxMarkup("player-saving-throws", ABILITIES)}
            </div>
          </div>
          <div>
            <h3>Skill proficiencies</h3>
            <div class="checkbox-grid">
              ${checkboxMarkup("player-skill-proficiencies", SKILLS)}
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset class="sheet-form-section bard-feature-choice-section" id="player-bard-feature-choice-section" hidden>
        <legend>Bard feature choices</legend>
        <div class="class-feature-choice-list full-width" id="player-bard-feature-choice-list"></div>
      </fieldset>

      ${playerSpellcastingFormMarkup()}

      <fieldset class="sheet-form-section">
        <legend>Equipment and features</legend>
        <div class="equipment-subsection full-width">
          <h3>Languages</h3>
          <div class="checkbox-grid">
            ${checkboxMarkup("player-languages", LANGUAGES)}
          </div>
        </div>
        <label class="full-width">Equipment<input id="player-equipment-entry" type="text" list="player-equipment-options" placeholder="Write an item, then press Enter: dagger, leather armor, thieves' tools..." /></label>
        <textarea id="player-equipment" hidden aria-hidden="true"></textarea>
        <textarea id="player-features" hidden aria-hidden="true"></textarea>
        <input id="player-background-skills" type="hidden" />
        <input id="player-tool-proficiencies" type="hidden" />
        <input id="player-gold" type="hidden" />
        <div class="equipment-gold-control full-width">
          <span>Gold</span>
          <button class="btn btn-secondary gp-shop-button" type="button" id="player-gold-shop-button" data-open-equipment-shop>0 GP</button>
        </div>
        <div class="equipment-shop-panel full-width" id="equipment-shop-panel" hidden></div>
      </fieldset>

      <div class="form-message full-width" id="player-form-message" aria-live="polite"></div>
      <div class="setup-actions full-width">
        <button class="btn btn-secondary" type="button" id="add-another-player">${escapeHtml(saveLabel)}</button>
        <button class="btn btn-primary" type="button" id="go-on-campaign">${escapeHtml(continueLabel)}</button>
      </div>
    </form>`;
}

function syncMulticlassControls(form) {
  const enabled = checkedFormValue(form, "#player-multiclass-enabled");
  const builder = form.querySelector("#player-multiclass-builder");
  if (builder) builder.hidden = !enabled;
  if (!enabled) return classLevelEntriesFromForm(form);
  const totalLevelField = form.querySelector("#player-level");
  const primaryLevelField = form.querySelector("#player-primary-class-level");
  if (primaryLevelField && !String(primaryLevelField.value || "").trim()) {
    primaryLevelField.value = String(numberFormValue(form, "#player-level") || 1);
  }
  const classLevels = classLevelEntriesFromForm(form);
  const total = Math.min(20, Math.max(1, totalLevelForClassLevels(classLevels) || 1));
  if (totalLevelField) totalLevelField.value = String(total);
  return classLevels;
}

function multiclassSummaryMarkup(classLevels = [], abilities = {}) {
  if (!isMulticlassClassLevelSet(classLevels)) return `<span>Add another class to build a multiclass split.</span>`;
  const failedPrerequisites = multiclassPrerequisiteFailures(classLevels, abilities);
  const proficiencyLines = multiclassAdditionalProficiencyLines(classLevels);
  const extraAttackLine = extraAttackMulticlassLine(classLevels);
  return `
    <span>${escapeHtml(classLevelSummary(classLevels))}</span>
    <span>PB ${escapeHtml(signedModifier(proficiencyBonusForLevel(totalLevelForClassLevels(classLevels))))} · Hit Dice ${escapeHtml(classHitDiceFromClassLevels(classLevels))}</span>
    ${proficiencyLines.length ? `<span>Added proficiencies: ${escapeHtml(proficiencyLines.join("; "))}</span>` : ""}
    <span>Features follow each class level.</span>
    <span>AC methods are chosen, not stacked.${extraAttackLine ? ` ${escapeHtml(extraAttackLine)}` : ""}</span>
    ${failedPrerequisites.length ? `<strong>${escapeHtml(`Prerequisites: ${failedPrerequisites.join("; ")}`)}</strong>` : ""}`;
}

function updateBardSubclassControls(form, classLevels = classLevelEntriesFromForm(form)) {
  const section = form.querySelector("#player-bard-subclass-section");
  const select = form.querySelector("#player-bard-subclass");
  const summary = form.querySelector("#player-bard-subclass-summary");
  const bardLevel = bardLevelForClassLevels(classLevels);
  const required = bardLevel >= 3;
  if (section) section.hidden = !required;
  if (select) {
    select.required = required;
    if (!required) select.value = "";
  }
  if (summary) {
    const subclass = bardSubclassById(select?.value);
    const unlocks = subclass
      ? subclass.features.filter((feature) => feature.level <= bardLevel).map((feature) => `Level ${feature.level}: ${feature.title}`)
      : [];
    summary.innerHTML = required
      ? `
        <strong>${escapeHtml(bardSubclassChoiceSummary(select?.value || ""))}</strong>
        ${unlocks.length ? `<span>${escapeHtml(unlocks.join(" · "))}</span>` : "<span>Choose a college to see unlocked subclass features.</span>"}`
      : "";
  }
}

function skillChoiceCheckboxMarkup(name, skills = [], selected = [], options = {}) {
  const selectedSet = new Set(selected || []);
  if (!skills.length) return `<div class="empty-state">${escapeHtml(options.emptyText || "No eligible skills yet.")}</div>`;
  return `<div class="checkbox-grid compact-checkbox-grid bard-choice-checkbox-grid">${skills.map((skill) => {
    const disabled = options.disabledSet?.has(skill.key);
    const checked = selectedSet.has(skill.key) && !disabled;
    return `
      <label class="checkbox-row ${disabled ? "is-disabled" : ""}">
        <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(skill.key)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
        <span>${escapeHtml(skill.label)} <small>(${escapeHtml(skill.ability.slice(0, 3).toUpperCase())})</small></span>
      </label>`;
  }).join("")}</div>`;
}

function bardSpellChoiceSelectMarkup(prefix = "player", spells = [], selected = []) {
  if (!spells.length) return `<div class="empty-state">Spell data is still loading.</div>`;
  const selectedIds = bardSpellChoiceIds(selected);
  return `<div class="bard-spell-choice-grid">${[0, 1].map((index) => `
    <label>Discovery ${index + 1}
      <select id="${escapeHtml(prefix)}-bard-lore-magical-discovery-${index + 1}">
        <option value="">Choose an eligible spell</option>
        ${spells.map((spell) => `
          <option value="${escapeHtml(spell.id)}" ${selectedIds[index] === spell.id ? "selected" : ""}>
            ${escapeHtml(`${spellLevelLabel(spell.level)} · ${spell.name}`)}
          </option>`).join("")}
      </select>
    </label>`).join("")}</div>`;
}

function bardFeatureChoicesMarkup({ prefix = "player", bardLevel = 0, minimumLevel = 0, subclassId = "", skillProficiencies = [], selected = {} } = {}) {
  const subclass = bardSubclassById(subclassId);
  const expertiseRequired = bardExpertiseRequiredCount(bardLevel);
  const selectedLoreSkills = bardChoiceList(selected.loreBonusProficiencies);
  const baseSkillSet = new Set(skillProficiencies || []);
  const proficientWithLore = new Set([...baseSkillSet, ...selectedLoreSkills]);
  const expertiseSkills = SKILLS.filter((skill) => proficientWithLore.has(skill.key));
  const loreBonusSkills = SKILLS.filter((skill) => !baseSkillSet.has(skill.key));
  const loreActive = subclass?.id === "college-of-lore" && bardLevel >= 3;
  const loreDiscoveriesActive = subclass?.id === "college-of-lore" && bardLevel >= 6;
  const magicalSecretsActive = bardLevel >= 10;
  const asiActive = [4, 8, 12, 16, 19].some((level) => bardLevel >= level);
  const expertiseUnlocked = (bardLevel >= 2 && minimumLevel < 2) || (bardLevel >= 9 && minimumLevel < 9);
  const asiUnlocked = [4, 8, 12, 16, 19].some((level) => level > minimumLevel && level <= bardLevel);
  const parts = [];
  if (expertiseRequired && expertiseUnlocked) {
    parts.push(`
      <section class="class-feature-choice-card">
        <h3>Expertise</h3>
        <p>Choose ${escapeHtml(expertiseRequired)} proficient skill${expertiseRequired === 1 ? "" : "s"} to double your Proficiency Bonus.</p>
        ${skillChoiceCheckboxMarkup(`${prefix}-bard-expertise`, expertiseSkills, selected.expertise, { emptyText: "Select Bard skill proficiencies first, then choose Expertise." })}
      </section>`);
  }
  if (loreActive && minimumLevel < 3) {
    parts.push(`
      <section class="class-feature-choice-card">
        <h3>College of Lore: Bonus Proficiencies</h3>
        <p>Choose 3 additional skill proficiencies from skills you do not already have.</p>
        ${skillChoiceCheckboxMarkup(`${prefix}-bard-lore-bonus-skills`, loreBonusSkills, selectedLoreSkills, { emptyText: "All skills are already proficient." })}
      </section>`);
  }
  if (loreDiscoveriesActive && minimumLevel < 6) {
    parts.push(`
      <section class="class-feature-choice-card">
        <h3>College of Lore: Magical Discoveries</h3>
        <p>Choose 2 extra prepared spells from the Cleric, Druid, or Wizard spell lists.</p>
        ${bardSpellChoiceSelectMarkup(prefix, bardLoreMagicalDiscoverySpells(bardLevel), selected.loreMagicalDiscoveries)}
      </section>`);
  }
  if (magicalSecretsActive && minimumLevel < 10) {
    parts.push(`
      <section class="class-feature-choice-card">
        <h3>Magical Secrets</h3>
        <p>The main spell picker now includes eligible Cleric, Druid, and Wizard spells. These choices use your normal prepared-spell limit.</p>
      </section>`);
  }
  if (asiActive && asiUnlocked) {
    parts.push(`
      <section class="class-feature-choice-card">
        <h3>Ability Score Improvements and Feats</h3>
        <p>Record Bard ASI or feat decisions made at Bard levels 4, 8, 12, 16, and 19.</p>
        <textarea id="${escapeHtml(prefix)}-bard-asi-notes" rows="3" placeholder="ASI or feat notes">${escapeHtml(selected.asiNotes || "")}</textarea>
      </section>`);
  }
  return parts.join("");
}

function currentBardChoiceSelectionsFromForm(form) {
  return {
    expertise: checkedFormValues(form, "player-bard-expertise"),
    loreBonusProficiencies: checkedFormValues(form, "player-bard-lore-bonus-skills"),
    loreMagicalDiscoveries: selectedBardSpellChoicesFromForm(form, "player-bard-lore-magical-discovery", "#player-bard-lore-magical-discoveries"),
    magicalSecrets: splitListInput(formValue(form, "#player-bard-magical-secrets")),
    asiNotes: formValue(form, "#player-bard-asi-notes"),
  };
}

function updateBardFeatureChoiceControls(form, classLevels = classLevelEntriesFromForm(form)) {
  const section = form.querySelector("#player-bard-feature-choice-section");
  const list = form.querySelector("#player-bard-feature-choice-list");
  if (!section || !list) return;
  const bardLevel = bardLevelForClassLevels(classLevels);
  const subclassId = bardSubclassIdFromForm(form);
  const baseSkillProficiencies = uniqueTextList([
    ...checkedFormValues(form, "player-skill-proficiencies"),
    ...splitListInput(formValue(form, "#player-background-skills")),
  ]);
  const selected = currentBardChoiceSelectionsFromForm(form);
  const markup = bardFeatureChoicesMarkup({
    prefix: "player",
    bardLevel,
    subclassId,
    skillProficiencies: baseSkillProficiencies,
    selected,
  });
  section.hidden = !markup;
  list.innerHTML = markup || "";
}

function updatePlayerFormDerivedFields(form) {
  const classLevels = syncMulticlassControls(form);
  const level = numberFormValue(form, "#player-level") || 1;
  const proficiencyBonus = proficiencyBonusForLevel(level);
  const baseScores = Object.fromEntries(ABILITIES.map((ability) => [ability.key, numberFormValue(form, `#player-${ability.key}`)]));
  const lineageBonuses = lineageAbilityBonusesFromForm(form);
  const backgroundBonuses = backgroundAbilityBonusesFromForm(form);
  const scores = applyBackgroundBonusesToScores(baseScores, combineAbilityBonuses(lineageBonuses, backgroundBonuses));
  const classRole = formValue(form, "#player-class-role");
  const race = formValue(form, "#player-race");
  const equipment = formValue(form, "#player-equipment");
  if (level <= 1) clearRolledHitPoints(form);
  ABILITIES.forEach((ability) => {
    const output = document.getElementById(`player-${ability.key}-modifier`);
    const bonus = (Number(lineageBonuses[ability.key]) || 0) + (Number(backgroundBonuses[ability.key]) || 0);
    if (output) output.textContent = `${signedModifier(abilityModifier(scores[ability.key]))}${bonus ? ` (${signedModifier(bonus)} bonus)` : ""}`;
  });
  const lineageSummary = document.getElementById("player-lineage-ability-bonus-summary");
  if (lineageSummary) lineageSummary.textContent = abilityBonusSummaryFromBonuses(lineageBonuses) || "Choose a lineage to assign bonuses.";
  const bonusSummary = document.getElementById("player-background-ability-bonus-summary");
  if (bonusSummary) bonusSummary.textContent = backgroundAbilityBonusSummary(form) || "Choose a background to assign bonuses.";
  const goldButton = document.getElementById("player-gold-shop-button");
  if (goldButton) goldButton.textContent = `${numberFormValue(form, "#player-gold") || 0} GP`;
  const proficiencyOutput = document.getElementById("player-proficiency-bonus");
  if (proficiencyOutput) proficiencyOutput.textContent = signedModifier(proficiencyBonus);
  const hasPerception = uniqueTextList([
    ...checkedFormValues(form, "player-skill-proficiencies"),
    ...splitListInput(formValue(form, "#player-background-skills")),
  ]).includes("perception");
  const passivePerception = 10 + abilityModifier(scores.wisdom) + (hasPerception ? proficiencyBonus : 0);
  const passiveInput = document.getElementById("player-passive-perception");
  const passiveOutput = document.getElementById("player-passive-perception-preview");
  if (passiveInput) passiveInput.value = String(passivePerception);
  if (passiveOutput) passiveOutput.textContent = String(passivePerception);
  const combat = derivedCombatStats({
    level,
    classRole,
    race,
    abilities: scores,
    equipment,
    hitPointMaximum: numberFormValue(form, "#player-hp-max"),
    classLevels,
  });
  const multiclassTotal = document.getElementById("player-multiclass-total");
  if (multiclassTotal) multiclassTotal.textContent = `Level ${totalLevelForClassLevels(classLevels) || level}`;
  const multiclassSummary = document.getElementById("player-multiclass-summary");
  if (multiclassSummary) multiclassSummary.innerHTML = multiclassSummaryMarkup(classLevels, scores);
  updateBardSubclassControls(form, classLevels);
  updateBardFeatureChoiceControls(form, classLevels);
  updatePlayerSpellPicker(form);
}

function rollAbilityScore() {
  return Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((total, value) => total + value, 0);
}

function clearRolledHitPoints(form) {
  const input = form.querySelector("#player-hp-max");
  if (input) input.value = "";
}

function rollHitPointsForLevel(form) {
  const classLevels = classLevelEntriesFromForm(form);
  const level = Math.max(1, Math.min(20, Number(numberFormValue(form, "#player-level")) || 1));
  const classRole = formValue(form, "#player-class-role");
  const constitution = applyBackgroundBonusesToScores({
    constitution: numberFormValue(form, "#player-constitution"),
  }, combineAbilityBonuses(lineageAbilityBonusesFromForm(form), backgroundAbilityBonusesFromForm(form))).constitution;
  const conMod = abilityModifier(constitution);
  const primarySides = hitDieSides(classRole);
  const baseHitPoints = Math.max(1, primarySides + conMod);
  if (level <= 1) {
    clearRolledHitPoints(form);
    return baseHitPoints;
  }
  const rollEntries = isMulticlassClassLevelSet(classLevels)
    ? classLevels.flatMap((entry, index) => Array.from({ length: index === 0 ? Math.max(0, entry.level - 1) : entry.level }, () => hitDieSidesForClassName(entry.className)))
    : Array.from({ length: level - 1 }, () => primarySides);
  const extraHitPoints = rollEntries.map((sides) => {
    const roll = Math.floor(Math.random() * sides) + 1;
    return Math.max(1, roll + conMod);
  }).reduce((total, value) => total + value, 0);
  const total = baseHitPoints + extraHitPoints;
  const input = form.querySelector("#player-hp-max");
  if (input) input.value = String(total);
  return total;
}

function bindPlayerSummaryControls(form) {
  if (!form) return;
  document.querySelectorAll("[data-roll-hit-points]").forEach((button) => {
    button.addEventListener("click", () => {
      rollHitPointsForLevel(form);
      updatePlayerFormDerivedFields(form);
      refreshPlayerSectionSummary(form);
    });
  });
  document.querySelectorAll("[data-open-equipment-shop]").forEach((button) => {
    button.addEventListener("click", () => {
      renderEquipmentShop(form);
      form.querySelector("#equipment-shop-panel")?.scrollIntoView?.({ block: "nearest" });
    });
  });
}

function refreshPlayerSectionSummary(form) {
  renderAddedPlayersSummary(getCampaign(form.dataset.campaignId) || currentCampaign());
}

function appendEquipmentItemsToSheet(form, items = []) {
  const equipment = form.querySelector("#player-equipment");
  const features = form.querySelector("#player-features");
  const nextItems = items.map((item) => {
    const text = item.trim();
    const homebrewItem = homebrewItemForEquipmentItem(text);
    return {
      equipmentText: homebrewItem?.name || text,
      featureText: homebrewItemFeatureText(homebrewItem),
    };
  }).filter((item) => item.equipmentText);
  if (!equipment || !nextItems.length) return;
  const currentItems = equipmentItems(equipment.value);
  equipment.value = uniqueTextList([...currentItems, ...nextItems.map((item) => item.equipmentText)]).join("\n");
  equipment.dispatchEvent(new Event("input", { bubbles: true }));
  if (features) {
    features.value = nextItems.reduce((value, item) => appendUniqueTextBlock(value, item.featureText), features.value);
    features.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function commitEquipmentDraft(form, { includeCurrent = false } = {}) {
  const draft = form.querySelector("#player-equipment-entry");
  if (!draft) return;
  const lines = String(draft.value || "").split(/\n+/);
  const completed = includeCurrent ? lines : lines.slice(0, -1);
  appendEquipmentItemsToSheet(form, completed);
  draft.value = includeCurrent ? "" : (lines.at(-1) || "");
}

function homebrewShopItems() {
  return getStoredCollection("items")
    .filter((item) => String(item?.type || "").trim().toLowerCase() !== "background")
    .map((item) => {
      const stats = item?.statistics && typeof item.statistics === "object" ? item.statistics : {};
      const price = gpFromText([stats.price, stats.cost, stats.value, stats.gold, item.description].filter(Boolean).join(" "));
      return {
        name: item.name,
        type: item.type || "Item",
        description: item.description || "",
        price,
      };
    })
    .filter((item) => item.name);
}

function equipmentShopMarkup(form, query = "") {
  const gold = numberFormValue(form, "#player-gold");
  const normalizedQuery = normalizeRulesText(query);
  const items = homebrewShopItems().filter((item) => {
    if (!normalizedQuery) return true;
    return normalizeRulesText([item.name, item.type, item.description].join(" ")).includes(normalizedQuery);
  });
  return `
    <div class="equipment-shop-heading">
      <div><h3>Homebrew shop</h3><p>${escapeHtml(gold)} GP available</p></div>
      <button class="btn btn-ghost" type="button" data-close-equipment-shop>Close</button>
    </div>
    <label>Search inventory<input id="equipment-shop-search" type="search" value="${escapeHtml(query)}" placeholder="Search homebrew items..." /></label>
    <div class="equipment-shop-list">
      ${items.length ? items.map((item) => {
        const canBuy = item.price <= gold;
        return `<article class="equipment-shop-item">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.type)}${item.price ? ` · ${escapeHtml(item.price)} GP` : " · Free"}</span>
            ${item.description ? `<p>${escapeHtml(item.description.slice(0, 140))}</p>` : ""}
          </div>
          <button class="btn btn-secondary" type="button" data-buy-homebrew-item="${escapeHtml(item.name)}" ${canBuy ? "" : "disabled"}>${canBuy ? "Buy" : "Too expensive"}</button>
        </article>`;
      }).join("") : `<div class="empty-state">No homebrew inventory items match this search.</div>`}
    </div>`;
}

function renderEquipmentShop(form, query = "") {
  const panel = form.querySelector("#equipment-shop-panel");
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = equipmentShopMarkup(form, query);
}

function buyHomebrewItemFromShop(form, itemName = "") {
  const item = homebrewShopItems().find((candidate) => normalizeRulesText(candidate.name) === normalizeRulesText(itemName));
  if (!item) return;
  const goldField = form.querySelector("#player-gold");
  const gold = numberFormValue(form, "#player-gold");
  if (item.price > gold) return;
  appendEquipmentItemsToSheet(form, [item.name]);
  if (goldField) {
    goldField.value = String(Math.max(0, gold - item.price));
    goldField.dispatchEvent(new Event("input", { bubbles: true }));
  }
  renderEquipmentShop(form, form.querySelector("#equipment-shop-search")?.value || "");
}

function allowedSkillKeysForClass(info) {
  if (!info) return new Set(SKILLS.map((skill) => skill.key));
  if (info.skillChoices === "any") return new Set(SKILLS.map((skill) => skill.key));
  return new Set(info.skillChoices || []);
}

function enforceSkillLimit(form, info) {
  const skillInputs = Array.from(form.querySelectorAll?.('input[name="player-skill-proficiencies"]') || []);
  const backgroundFixed = skillInputs.filter((input) => input.dataset.backgroundFixed === "true");
  backgroundFixed.forEach((input) => {
    input.checked = true;
    input.disabled = true;
    input.closest("label")?.classList.add("is-fixed");
    input.closest("label")?.classList.remove("is-disabled");
  });
  const checked = skillInputs.filter((input) => input.checked && input.dataset.backgroundFixed !== "true");
  const extraLimit = extraSkillChoiceLimitForForm(form);
  const allowedSkills = allowedSkillKeysForClass(info);
  const classLimit = info?.skillLimit ?? checked.length;
  let selectedClass = 0;
  let selectedExtra = 0;
  checked.forEach((input) => {
    const isClassAllowed = allowedSkills.has(input.value);
    if (isClassAllowed && selectedClass < classLimit) {
      selectedClass += 1;
      return;
    }
    if (selectedExtra < extraLimit) {
      selectedExtra += 1;
      return;
    }
    input.checked = false;
  });
  skillInputs.forEach((input) => {
    if (input.dataset.backgroundFixed === "true") return;
    const isClassAllowed = allowedSkills.has(input.value);
    const classFull = selectedClass >= classLimit;
    const extraFull = selectedExtra >= extraLimit;
    const disabled = !input.checked && ((isClassAllowed && classFull && extraFull) || (!isClassAllowed && extraFull));
    input.disabled = disabled;
    input.closest("label")?.classList.toggle("is-disabled", disabled);
  });
}

function extraSkillChoiceLimitForForm(form) {
  const background = backgroundPackageForName(formValue(form, "#player-background"));
  const originFeat = normalizeRulesText(background?.originFeat || "");
  const lineageTraits = normalizeRulesText(formValue(form, "#player-lineage-traits"));
  const features = normalizeRulesText(formValue(form, "#player-features"));
  const classLevels = checkedFormValue(form, "#player-multiclass-enabled") ? classLevelEntriesFromForm(form) : [];
  let limit = 0;
  if (originFeat === "skilled" || /\bskilled feat\b/.test(features)) limit += 3;
  if (lineageTraits.includes("skill versatility")) limit += 2;
  limit += multiclassSkillChoiceLimit(classLevels);
  return limit;
}

function enforceLanguageRestrictions(form) {
  const inputs = Array.from(form.querySelectorAll?.('input[name="player-languages"]') || []);
  const race = formValue(form, "#player-race");
  if (!race) {
    inputs.forEach((input) => {
      input.checked = false;
      input.disabled = false;
      input.closest("label")?.classList.remove("is-disabled", "is-fixed");
    });
    return;
  }
  const rules = languageRulesForRace(race);
  const fixed = new Set(rules.fixed);
  inputs.forEach((input) => {
    if (fixed.has(input.value)) input.checked = true;
  });
  let extraSelected = inputs.filter((input) => input.checked && !fixed.has(input.value));
  extraSelected.forEach((input, index) => {
    if (index >= rules.extraLimit) input.checked = false;
  });
  extraSelected = inputs.filter((input) => input.checked && !fixed.has(input.value));
  const limitReached = extraSelected.length >= rules.extraLimit;
  inputs.forEach((input) => {
    const isFixed = fixed.has(input.value);
    const disabled = isFixed || (!input.checked && (rules.extraLimit === 0 || limitReached));
    input.disabled = disabled;
    input.closest("label")?.classList.toggle("is-fixed", isFixed);
    input.closest("label")?.classList.toggle("is-disabled", disabled && !isFixed);
  });
}

function applyClassRestrictions(form) {
  const info = classInfo(formValue(form, "#player-class-role"));
  if (!info) {
    form.querySelectorAll?.('input[name="player-saving-throws"]').forEach((input) => {
      input.disabled = false;
      input.closest("label")?.classList.remove("is-disabled", "is-fixed");
    });
    form.querySelectorAll?.('input[name="player-skill-proficiencies"]').forEach((input) => {
      if (input.dataset.backgroundFixed === "true") {
        input.checked = true;
        input.disabled = true;
        input.closest("label")?.classList.add("is-fixed");
        input.closest("label")?.classList.remove("is-disabled");
        return;
      }
      input.disabled = false;
      input.closest("label")?.classList.remove("is-disabled");
    });
    enforceLanguageRestrictions(form);
    return;
  }
  form.querySelectorAll?.('input[name="player-saving-throws"]').forEach((input) => {
    const isFixed = info.saves.includes(input.value);
    input.checked = isFixed;
    input.disabled = true;
    input.closest("label")?.classList.toggle("is-fixed", isFixed);
    input.closest("label")?.classList.toggle("is-disabled", !isFixed);
  });
  const allowedSkills = allowedSkillKeysForClass(info);
  const hasExtraSkillChoices = extraSkillChoiceLimitForForm(form) > 0;
  form.querySelectorAll?.('input[name="player-skill-proficiencies"]').forEach((input) => {
    if (input.dataset.backgroundFixed === "true") {
      input.checked = true;
      input.disabled = true;
      input.closest("label")?.classList.add("is-fixed");
      input.closest("label")?.classList.remove("is-disabled");
      return;
    }
    const isAllowed = allowedSkills.has(input.value);
    input.disabled = !isAllowed && !hasExtraSkillChoices;
    input.checked = input.checked && (isAllowed || hasExtraSkillChoices);
    input.closest("label")?.classList.toggle("is-disabled", input.disabled);
  });
  enforceSkillLimit(form, info);
  enforceLanguageRestrictions(form);
}

function initPlayerCharacterForm(form) {
  updatePlayerFormDerivedFields(form);
  applyClassRestrictions(form);
  refreshPlayerSectionSummary(form);
  const suggestionButton = document.getElementById("analyze-character-description");
  const suggestionStatus = document.getElementById("character-suggestion-status");
  const suggestionPanel = document.getElementById("character-suggestion-panel");
  suggestionButton?.addEventListener("click", async () => {
    if (suggestionStatus) {
      suggestionStatus.textContent = "Analyzing mechanics...";
      suggestionStatus.classList.remove("error");
    }
    suggestionButton.disabled = true;
    try {
      const payload = await requestCharacterSuggestions(form);
      renderCharacterSuggestions(suggestionPanel, payload);
      if (suggestionStatus) suggestionStatus.textContent = "Mechanical suggestions ready.";
    } catch (error) {
      if (suggestionStatus) {
        suggestionStatus.textContent = error.message;
        suggestionStatus.classList.add("error");
      }
    } finally {
      suggestionButton.disabled = false;
    }
  });
  suggestionPanel?.addEventListener("click", (event) => {
    const suggestions = characterSuggestionsFromPanel(suggestionPanel);
    const applyIndex = event.target?.dataset?.applySuggestion;
    const dismissIndex = event.target?.dataset?.dismissSuggestion;
    if (applyIndex !== undefined) {
      const suggestion = suggestions[Number(applyIndex)];
      if (!suggestion) return;
      const card = event.target.closest(".suggestion-card");
      applyCharacterSuggestion(form, suggestion);
      card?.remove();
      refreshPlayerSectionSummary(form);
    }
    if (dismissIndex !== undefined) {
      event.target.closest(".suggestion-card")?.remove();
    }
    if (event.target?.matches("[data-apply-all-suggestions]")) {
      suggestionPanel.querySelectorAll(".suggestion-card").forEach((card) => {
        const index = Number(card.dataset.suggestionIndex);
        const suggestion = suggestions[index];
        if (suggestion) applyCharacterSuggestion(form, suggestion);
      });
      suggestionPanel.innerHTML = `<div class="suggestion-empty">Suggestions added to the sheet. Edit the text fields as needed.</div>`;
      refreshPlayerSectionSummary(form);
    }
  });
  form.querySelectorAll("[data-roll-ability]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(`player-${button.dataset.rollAbility}`);
      if (input) input.value = String(rollAbilityScore());
      if (button.dataset.rollAbility === "constitution") clearRolledHitPoints(form);
      updatePlayerFormDerivedFields(form);
      refreshPlayerSectionSummary(form);
    });
  });
  form.addEventListener("click", (event) => {
    if (event.target?.matches("[data-apply-background-ability-boosts]")) {
      applySelectedBackgroundAbilityBoosts(form);
      updatePlayerFormDerivedFields(form);
      refreshPlayerSectionSummary(form);
    }
    if (event.target?.matches("[data-apply-background-even-boosts]")) {
      applyEvenBackgroundAbilityBoosts(form);
      updatePlayerFormDerivedFields(form);
      refreshPlayerSectionSummary(form);
    }
    if (event.target?.matches("[data-apply-lineage-ability-boosts]")) {
      applySelectedLineageAbilityBoosts(form);
      updatePlayerFormDerivedFields(form);
      refreshPlayerSectionSummary(form);
    }
    if (event.target?.matches("[data-apply-lineage-even-boosts]")) {
      applyEvenLineageAbilityBoosts(form);
      updatePlayerFormDerivedFields(form);
      refreshPlayerSectionSummary(form);
    }
    if (event.target?.matches("[data-close-equipment-shop]")) {
      const panel = form.querySelector("#equipment-shop-panel");
      if (panel) panel.hidden = true;
    }
    if (event.target?.matches("[data-open-equipment-shop]")) {
      renderEquipmentShop(form);
      form.querySelector("#equipment-shop-panel")?.scrollIntoView?.({ block: "nearest" });
    }
    if (event.target?.dataset?.buyHomebrewItem) {
      buyHomebrewItemFromShop(form, event.target.dataset.buyHomebrewItem);
      updatePlayerFormDerivedFields(form);
      refreshPlayerSectionSummary(form);
    }
  });
  form.addEventListener("keydown", (event) => {
    if (event.target?.id !== "player-equipment-entry" || event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    commitEquipmentDraft(form, { includeCurrent: true });
    updatePlayerFormDerivedFields(form);
    refreshPlayerSectionSummary(form);
  });
  form.addEventListener("input", (event) => {
    if (event.target?.id === "player-equipment-entry" && String(event.target.value || "").includes("\n")) {
      commitEquipmentDraft(form);
    }
    if (event.target?.id === "equipment-shop-search") {
      renderEquipmentShop(form, event.target.value);
      return;
    }
    if (["player-bard-lore-magical-discoveries", "player-bard-magical-secrets", "player-bard-asi-notes"].includes(event.target?.id)) {
      refreshPlayerSectionSummary(form);
      return;
    }
    if (["player-class-role", "player-level", "player-constitution", "player-primary-class-level", "player-multiclass-2-class", "player-multiclass-2-level", "player-multiclass-3-class", "player-multiclass-3-level"].includes(event.target?.id)) clearRolledHitPoints(form);
    if (event.target?.id === "player-class-role" || event.target?.id === "player-race") applyClassRestrictions(form);
    updatePlayerFormDerivedFields(form);
    refreshPlayerSectionSummary(form);
  });
  form.addEventListener("change", (event) => {
    if (["player-class-role", "player-level", "player-constitution", "player-multiclass-enabled", "player-primary-class-level", "player-multiclass-2-class", "player-multiclass-2-level", "player-multiclass-3-class", "player-multiclass-3-level"].includes(event.target?.id)) clearRolledHitPoints(form);
    if (event.target?.id === "player-background") {
      const background = backgroundPackageForName(event.target.value);
      if (background) applyBackgroundPackageToForm(form, background);
    }
    if (event.target?.id === "player-race") {
      const lineage = lineagePackageForName(event.target.value);
      if (lineage) applyLineagePackageToForm(form, lineage);
    }
    if (event.target?.id === "player-background-boost-primary" || event.target?.id === "player-background-boost-secondary") {
      applySelectedBackgroundAbilityBoosts(form);
    }
    if (event.target?.id === "player-lineage-boost-primary" || event.target?.id === "player-lineage-boost-secondary") {
      applySelectedLineageAbilityBoosts(form);
    }
    if (event.target?.name === "player-background-equipment-mode") {
      applyBackgroundEquipmentChoice(form, event.target.value);
    }
    if (
	      event.target?.id === "player-class-role"
	      || event.target?.id === "player-multiclass-enabled"
	      || event.target?.id === "player-multiclass-2-class"
	      || event.target?.id === "player-multiclass-3-class"
	      || event.target?.id === "player-bard-subclass"
	      || event.target?.id === "player-race"
	      || event.target?.name === "player-skill-proficiencies"
	      || event.target?.name === "player-languages"
	    ) {
      applyClassRestrictions(form);
    }
    updatePlayerFormDerivedFields(form);
    refreshPlayerSectionSummary(form);
  });
}

async function saveCurrentPlayerFromSetup(form, { requireData }) {
  const message = document.getElementById("player-form-message");
  const campaignId = form.dataset.campaignId;
  commitEquipmentDraft(form, { includeCurrent: true });
  const player = buildPlayerCharacter(form);
  const hasData = playerFormHasData(form);
  if (!requireData && !hasData) return { saved: false, campaign: getCampaign(campaignId) };
  const errors = validatePlayerCharacter(player, requireData);
  if (errors.length) {
    if (message) {
      message.textContent = errors.join(" ");
      message.classList.add("error");
    }
    return { saved: false, errors };
  }
  const avatar = await imageFromFileInput(document.getElementById("player-avatar"), {
    title: player.characterName,
  });
  if (avatar) {
    player.avatarImageId = avatar.id;
    player.avatarUrl = avatar.url;
    player.image = avatar;
  }
  const campaign = savePlayerToCampaign(campaignId, player);
  form.reset();
  resetImagePickers(form);
  applyClassRestrictions(form);
  updatePlayerFormDerivedFields(form);
  if (message) {
    message.textContent = `${player.characterName} has joined the party.`;
    message.classList.remove("error");
  }
  return { saved: true, campaign };
}

function renderCampaignSetupPage(campaignId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) {
    renderNotFoundPage("The requested campaign does not exist in local storage.");
    return;
  }
  const ready = campaignReady(campaign);
  if (!ready && campaign.setupCompleted && campaign.players.length) {
    window.location.href = campaignStartNoteHref(campaign.id);
    return;
  }
  const setupCopy = ready
    ? {
      eyebrow: "Modify campaign",
      lead: "Add another player character to this campaign, then return to the dashboard.",
      formEyebrow: "Party editor",
      formTitle: "Add a player character",
      summaryEyebrow: "Current party",
      saveLabel: "ADD PLAYER",
      continueLabel: "BACK TO CAMPAIGN",
    }
    : {
      eyebrow: "Start campaign",
      lead: "Create the party one character sheet at a time before entering the live campaign dashboard.",
      formEyebrow: "Party builder",
      formTitle: "Add a player character",
      summaryEyebrow: "Already added",
      saveLabel: "ADD ANOTHER PLAYER",
      continueLabel: "GO ON",
    };
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell setup-page">
      <div class="page-hero">
        <p class="eyebrow">${escapeHtml(setupCopy.eyebrow)}</p>
        <h1>${escapeHtml(campaign.name)}</h1>
        <p>${escapeHtml(setupCopy.lead)}</p>
      </div>
      <div class="setup-grid">
        <section class="setup-form-panel">
          <div class="section-heading"><div><p class="eyebrow">${escapeHtml(setupCopy.formEyebrow)}</p><h2>${escapeHtml(setupCopy.formTitle)}</h2></div></div>
          ${playerCharacterFormMarkup({ saveLabel: setupCopy.saveLabel, continueLabel: setupCopy.continueLabel })}
        </section>
        <aside class="setup-summary-panel">
          <div class="section-heading"><div><p class="eyebrow">${escapeHtml(setupCopy.summaryEyebrow)}</p><h2>Party so far</h2></div></div>
          <div class="collection-grid setup-player-list" id="added-players-summary" aria-live="polite"></div>
        </aside>
      </div>
    </section>`;
  const form = document.getElementById("player-character-form");
  form.dataset.campaignId = campaign.id;
  initImagePickers();
  initPlayerCharacterForm(form);
  renderAddedPlayersSummary(campaign);
  document.getElementById("add-another-player").addEventListener("click", async () => {
    const result = await saveCurrentPlayerFromSetup(form, { requireData: true });
    if (result.campaign) renderAddedPlayersSummary(result.campaign);
  });
  document.getElementById("go-on-campaign").addEventListener("click", async () => {
    const result = await saveCurrentPlayerFromSetup(form, { requireData: false });
    if (result.errors) return;
    if (ready) {
      goToDashboard();
      return;
    }
    const nextCampaign = result.campaign || getCampaign(campaign.id);
    if (!nextCampaign.players.length) {
      const message = document.getElementById("player-form-message");
      if (message) {
        message.textContent = "Add at least one player character before starting the campaign.";
        message.classList.add("error");
      }
      return;
    }
    window.location.href = campaignStartNoteHref(campaign.id);
  });
}

function renderCampaignStartNotePage(campaignId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) {
    renderNotFoundPage("The requested campaign does not exist in local storage.");
    return;
  }
  if (!campaign.players.length) {
    renderCampaignSetupPage(campaign.id);
    return;
  }
  if (campaignReady(campaign)) {
    goToDashboard();
    return;
  }
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell setup-page">
      <div class="page-hero">
        <p class="eyebrow">Campaign beginning</p>
        <h1>Write the first note.</h1>
        <p>Set the campaign title, beginning date, and opening description before entering the dashboard.</p>
      </div>
      <form class="panel form-grid campaign-start-note-form" id="campaign-start-note-form">
        <label>Campaign title<input id="campaign-start-title" type="text" value="${escapeHtml(campaign.name)}" required /></label>
        <label>Beginning date<input id="campaign-start-date" type="date" value="${currentIsoDate()}" required /></label>
        <label class="full-width">Description<textarea id="campaign-start-description" rows="5" placeholder="Write the opening note, premise, first scene, or table context..." required></textarea></label>
        <div class="form-message full-width" id="campaign-start-note-message" aria-live="polite"></div>
        <div class="setup-actions full-width">
          <a class="btn btn-secondary" href="${escapeHtml(campaignSetupHref(campaign.id))}">BACK TO PLAYERS</a>
          <button class="btn btn-primary" type="submit">OPEN CAMPAIGN</button>
        </div>
      </form>
    </section>`;
  const form = document.getElementById("campaign-start-note-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const completed = completeCampaignSetup(campaign.id, {
      title: document.getElementById("campaign-start-title").value.trim(),
      startDate: document.getElementById("campaign-start-date").value,
      description: document.getElementById("campaign-start-description").value.trim(),
    });
    if (!completed) {
      const message = document.getElementById("campaign-start-note-message");
      if (message) {
        message.textContent = "Could not save the campaign beginning.";
        message.classList.add("error");
      }
      return;
    }
    goToDashboard();
  });
}

function combatTypeLabel(type = "") {
  return { player: "Player", npc: "NPC", monster: "Monster" }[type] || "Monster";
}

function combatantHpText(combatant = {}) {
  const current = combatant.currentHp === "" ? "—" : combatant.currentHp;
  const max = combatant.maxHp === "" ? "—" : combatant.maxHp;
  return `${current}/${max}`;
}

function activeCombatant(encounter = getCombatEncounter()) {
  const normalized = normalizeCombatEncounter(encounter);
  return normalized.combatants[normalized.currentTurnIndex] || null;
}

function combatantAvatarMarkup(combatant = {}, options = {}) {
  const imageUrl = resolveBackendUrl(combatant.avatarUrl);
  const label = `${combatant.name} details`;
  return `
    <button class="combatant-avatar ${options.large ? "is-large" : ""}" type="button" data-combatant-detail="${escapeHtml(combatant.id)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(combatant.name)}" />` : `<span>${escapeHtml(combatantInitials(combatant.name))}</span>`}
    </button>`;
}

function combatantConditionMarkup(combatant = {}) {
  const conditions = combatant.conditions || [];
  return conditions.length
    ? `<div class="combat-condition-row">${conditions.map((condition) => `<button type="button" data-remove-condition="${escapeHtml(condition)}">${escapeHtml(condition)}</button>`).join("")}</div>`
    : `<span class="combat-empty-note">No conditions</span>`;
}

function initiativeTimelineMarkup(encounter = getCombatEncounter()) {
  const activeId = encounter.activeCombatantId || encounter.combatants[encounter.currentTurnIndex]?.id;
  if (!encounter.combatants.length) return `<div class="empty-state">No combatants yet. Add players, NPCs, or monsters to build the initiative line.</div>`;
  return `<ol class="combat-timeline" aria-label="Initiative order">
    ${encounter.combatants.map((combatant, index) => {
      const isActive = combatant.id === activeId;
      return `
      <li class="combat-timeline-item ${isActive ? "is-active" : ""} is-${escapeHtml(combatant.status)}" draggable="true" data-combatant-id="${escapeHtml(combatant.id)}">
        <div class="combat-timeline-position">${escapeHtml(index + 1)}</div>
        ${combatantAvatarMarkup(combatant)}
        <div class="combat-timeline-main">
          <div><strong>${escapeHtml(combatant.name)}</strong><span>${escapeHtml(combatTypeLabel(combatant.type))}</span></div>
          <small>Init ${escapeHtml(combatant.initiativeScore === "" ? "—" : combatant.initiativeScore)} · HP ${escapeHtml(combatantHpText(combatant))}</small>
        </div>
        <span class="status-badge ${combatant.status === "defeated" ? "status-completed" : combatant.status === "hidden" ? "status-hidden" : "status-active"}">${escapeHtml(combatant.status)}</span>
        <div class="combat-order-actions">
          <button type="button" class="btn btn-ghost" data-move-combatant="${escapeHtml(combatant.id)}" data-move-delta="-1" aria-label="Move ${escapeHtml(combatant.name)} up">↑</button>
          <button type="button" class="btn btn-ghost" data-move-combatant="${escapeHtml(combatant.id)}" data-move-delta="1" aria-label="Move ${escapeHtml(combatant.name)} down">↓</button>
        </div>
      </li>`;
    }).join("")}
  </ol>`;
}

function activeCombatantPanelMarkup(encounter = getCombatEncounter()) {
  const combatant = activeCombatant(encounter);
  if (!combatant) return `<section class="panel combat-active-panel"><div class="empty-state">Add combatants to see the active turn controls.</div></section>`;
  return `
    <section class="panel combat-active-panel" aria-label="Active combatant controls">
      <div class="combat-active-header">
        ${combatantAvatarMarkup(combatant, { large: true })}
        <div>
          <p class="eyebrow">Active turn</p>
          <h2>${escapeHtml(combatant.name)}</h2>
          <div class="tag-row">
            <span class="tag">${escapeHtml(combatTypeLabel(combatant.type))}</span>
            <span class="tag">AC ${escapeHtml(combatant.armorClass || "—")}</span>
            <span class="tag">HP ${escapeHtml(combatantHpText(combatant))}</span>
            <span class="tag">Initiative ${escapeHtml(combatant.initiativeScore === "" ? "—" : combatant.initiativeScore)}</span>
          </div>
        </div>
      </div>
      <div class="combat-hp-controls">
        <label>Amount<input id="combat-hp-amount" type="number" step="1" min="0" value="1" /></label>
        <button class="btn btn-danger" type="button" data-active-hp-action="damage">Damage</button>
        <button class="btn btn-secondary" type="button" data-active-hp-action="heal">Heal</button>
        <button class="btn btn-secondary" type="button" data-active-hp-action="set">Set HP</button>
      </div>
      <div class="combat-status-controls">
        <label>Status<select id="combat-active-status">
          ${COMBATANT_STATUSES.map((status) => `<option value="${escapeHtml(status)}" ${combatant.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
        </select></label>
        <label>Condition<select id="combat-condition-select">
          ${COMBAT_CONDITIONS.map((condition) => `<option value="${escapeHtml(condition)}">${escapeHtml(condition)}</option>`).join("")}
        </select></label>
        <button class="btn btn-secondary" type="button" data-add-condition>Add condition</button>
      </div>
      ${combatantConditionMarkup(combatant)}
    </section>`;
}

function combatantCardMarkup(combatant = {}, activeId = "") {
  const isActive = combatant.id === activeId;
  return `
    <article class="combatant-card ${isActive ? "is-active" : ""} is-${escapeHtml(combatant.status)}" data-combatant-id="${escapeHtml(combatant.id)}">
      ${combatantAvatarMarkup(combatant)}
      <div>
        <strong>${escapeHtml(combatant.name)}</strong>
        <span>${escapeHtml(combatTypeLabel(combatant.type))} · Init ${escapeHtml(combatant.initiativeScore === "" ? "—" : combatant.initiativeScore)} · HP ${escapeHtml(combatantHpText(combatant))}</span>
        ${combatant.conditions?.length ? `<small>${escapeHtml(combatant.conditions.join(", "))}</small>` : ""}
      </div>
      <div class="combatant-card-actions">
        <button class="btn btn-ghost" type="button" data-select-active-combatant="${escapeHtml(combatant.id)}">Turn</button>
        <button class="btn btn-danger" type="button" data-remove-combatant="${escapeHtml(combatant.id)}">Remove</button>
      </div>
    </article>`;
}

function sourceListMarkup(title = "", sources = [], emptyText = "") {
  return `
    <section class="combat-source-group">
      <h3>${escapeHtml(title)}</h3>
      ${sources.length ? sources.map((source) => `
        <article class="combat-source-card">
          <div><strong>${escapeHtml(source.label)}</strong><span>${escapeHtml(source.sublabel || combatTypeLabel(source.type))}</span></div>
          <button class="btn btn-secondary" type="button" data-add-source-type="${escapeHtml(source.type)}" data-add-source-id="${escapeHtml(source.id)}">Add</button>
        </article>`).join("") : `<div class="empty-state">${escapeHtml(emptyText)}</div>`}
    </section>`;
}

function addCombatantPanelMarkup() {
  const sources = combatantSources();
  return `
    <aside class="panel combat-add-panel">
      <div class="section-heading"><div><p class="eyebrow">Roster</p><h2>Add combatants</h2></div></div>
      ${sourceListMarkup("Players", sources.players, "No player characters saved yet.")}
      ${sourceListMarkup("NPCs", sources.npcs, "No saved NPCs yet.")}
      ${sourceListMarkup("Monsters", sources.monsters, "No homebrew monsters yet.")}
      <form class="combat-temp-form" id="combat-temp-form">
        <h3>Temporary combatant</h3>
        <label>Name<input id="combat-temp-name" type="text" placeholder="Goblin, Bandit, Lair hazard..." required /></label>
        <label>Type<select id="combat-temp-type"><option value="monster">Monster</option><option value="npc">NPC</option><option value="player">Player</option></select></label>
        <label>Armor Class<input id="combat-temp-ac" type="number" min="0" step="1" placeholder="15" /></label>
        <label>Max HP<input id="combat-temp-hp" type="number" min="0" step="1" placeholder="7" /></label>
        <label>Initiative Mod<input id="combat-temp-init" type="number" step="1" placeholder="2" /></label>
        <button class="btn btn-primary" type="submit">Add temporary</button>
      </form>
    </aside>`;
}

function combatantFromSource(type = "", entityId = "", encounter = getCombatEncounter()) {
  if (type === "player") {
    const campaign = currentCampaign();
    const player = (campaign.players || []).find((item) => item.id === entityId);
    return player ? combatantFromPlayer(player, campaign.id, encounter) : null;
  }
  if (type === "npc") {
    const npc = getStoredCollection("characters").find((item) => item.id === entityId);
    return npc ? combatantFromNpc(npc, encounter) : null;
  }
  if (type === "monster") {
    const monster = getStoredCollection("items").find((item) => item.id === entityId);
    return monster ? combatantFromMonster(monster, encounter) : null;
  }
  return null;
}

function temporaryCombatantFromForm(form, encounter = getCombatEncounter()) {
  const type = formValue(form, "#combat-temp-type") || "monster";
  const name = repeatedCombatantName(encounter, formValue(form, "#combat-temp-name") || combatTypeLabel(type), type);
  const maxHp = numberFormValue(form, "#combat-temp-hp");
  return normalizeCombatant({
    id: createId("combatant-temp"),
    type,
    name,
    armorClass: numberFormValue(form, "#combat-temp-ac"),
    currentHp: maxHp,
    maxHp,
    initiativeModifier: numberFormValue(form, "#combat-temp-init") || 0,
    status: "active",
    conditions: [],
    isTemporary: true,
    sourceLabel: "Temporary",
  }, encounter.combatants.length);
}

function renderTemporaryCombatantDetail(combatant = {}) {
  const panel = document.getElementById("combat-temp-detail");
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = `
    <div class="combat-detail-drawer">
      <button class="widget-detail-close" type="button" data-close-temp-detail aria-label="Close temporary combatant detail">×</button>
      <p class="eyebrow">Temporary combatant</p>
      <h2>${escapeHtml(combatant.name)}</h2>
      <dl class="widget-detail-meta">${widgetDetailRows([
        ["Type", combatTypeLabel(combatant.type)],
        ["Armor Class", combatant.armorClass],
        ["Hit Points", combatantHpText(combatant)],
        ["Initiative", combatant.initiativeScore === "" ? "Not rolled" : combatant.initiativeScore],
        ["Status", combatant.status],
        ["Conditions", (combatant.conditions || []).join(", ")],
      ])}</dl>
    </div>`;
}

function activateCombatantDetail(combatant = {}) {
  const target = combatantDetailTarget(combatant);
  if (target.kind === "navigate") {
    window.location.href = target.route;
    return target;
  }
  if (target.kind === "widget") {
    openWidgetDetail(target.collectionKey, target.entityId);
    return target;
  }
  renderTemporaryCombatantDetail(combatant);
  return target;
}

function saveCombatAndRender(encounter) {
  saveCombatEncounter(encounter);
  renderCombatPage();
}

function renderCombatPage() {
  updateTopNavActivePage("combat");
  const encounter = getCombatEncounter();
  const combatant = activeCombatant(encounter);
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell combat-page">
      <div class="page-hero combat-hero">
        <div>
          <p class="eyebrow">Combat tracker</p>
          <h1>${escapeHtml(encounter.name)}</h1>
          <p>${escapeHtml(combatant ? `Active: ${combatant.name}` : "Build an initiative order, roll once, and run turns from one screen.")}</p>
        </div>
        <div class="combat-hero-stats">
          <div><span>Round</span><strong>${escapeHtml(encounter.currentRound)}</strong></div>
          <div><span>Turn</span><strong>${escapeHtml(encounter.combatants.length ? encounter.currentTurnIndex + 1 : 0)} / ${escapeHtml(encounter.combatants.length)}</strong></div>
        </div>
      </div>

      <div class="combat-control-bar panel">
        <label>Encounter name<input id="combat-encounter-name" type="text" value="${escapeHtml(encounter.name)}" /></label>
        <label class="checkbox-row"><input id="combat-skip-defeated" type="checkbox" ${encounter.skipDefeated ? "checked" : ""} /><span>Skip defeated and hidden</span></label>
        <button class="btn btn-secondary" type="button" id="combat-roll-all">Roll initiative</button>
        <button class="btn btn-primary" type="button" id="combat-start" ${encounter.combatants.length ? "" : "disabled"}>${encounter.combatStarted ? "Restart" : "Start Combat"}</button>
        <button class="btn btn-secondary" type="button" id="combat-prev" ${encounter.combatStarted ? "" : "disabled"}>Previous Turn</button>
        <button class="btn btn-primary" type="button" id="combat-next" ${encounter.combatStarted ? "" : "disabled"}>Next Turn</button>
        <button class="btn btn-danger" type="button" id="combat-reset">End / Reset</button>
        <div class="form-message" id="combat-message" aria-live="polite"></div>
      </div>

      <div class="combat-layout">
        <section class="combat-main">
          <section class="panel combat-timeline-panel">
            <div class="section-heading"><div><p class="eyebrow">Initiative</p><h2>Turn order</h2></div></div>
            ${initiativeTimelineMarkup(encounter)}
          </section>
          ${activeCombatantPanelMarkup(encounter)}
        </section>
        ${addCombatantPanelMarkup()}
      </div>

      <section class="panel combat-roster-panel">
        <div class="section-heading"><div><p class="eyebrow">Encounter roster</p><h2>All combatants</h2></div></div>
        <div class="combatant-card-list">
          ${encounter.combatants.length ? encounter.combatants.map((item) => combatantCardMarkup(item, encounter.activeCombatantId)).join("") : `<div class="empty-state">No combatants added yet.</div>`}
        </div>
      </section>
      <aside class="combat-temp-detail" id="combat-temp-detail" hidden></aside>
    </section>`;
  bindCombatPageInteractions();
}

function bindCombatPageInteractions() {
  const encounter = getCombatEncounter();
  const message = document.getElementById("combat-message");
  const save = (nextEncounter) => saveCombatAndRender(nextEncounter);

  document.getElementById("combat-encounter-name")?.addEventListener("input", (event) => {
    saveCombatEncounter({ ...getCombatEncounter(), name: event.target.value.trim() || "Active combat" });
  });
  document.getElementById("combat-skip-defeated")?.addEventListener("change", (event) => {
    save({ ...getCombatEncounter(), skipDefeated: event.target.checked });
  });
  document.getElementById("combat-roll-all")?.addEventListener("click", () => save(rollInitiativeForAll(getCombatEncounter())));
  document.getElementById("combat-start")?.addEventListener("click", () => {
    const current = getCombatEncounter();
    if (!current.combatants.length) {
      if (message) {
        message.textContent = "Add at least one combatant before starting combat.";
        message.classList.add("error");
      }
      return;
    }
    save(startCombatEncounter(current));
  });
  document.getElementById("combat-next")?.addEventListener("click", () => save(advanceCombatTurn(getCombatEncounter())));
  document.getElementById("combat-prev")?.addEventListener("click", () => save(previousCombatTurn(getCombatEncounter())));
  document.getElementById("combat-reset")?.addEventListener("click", () => save(resetCombatEncounter(getCombatEncounter().name)));

  document.querySelectorAll("[data-add-source-type][data-add-source-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = getCombatEncounter();
      const combatant = combatantFromSource(button.dataset.addSourceType, button.dataset.addSourceId, current);
      if (combatant) save(addCombatantToEncounter(current, combatant));
    });
  });

  document.getElementById("combat-temp-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const current = getCombatEncounter();
    const combatant = temporaryCombatantFromForm(event.currentTarget, current);
    save(addCombatantToEncounter(current, combatant));
  });

  document.querySelectorAll("[data-move-combatant]").forEach((button) => {
    button.addEventListener("click", () => save(moveCombatant(getCombatEncounter(), button.dataset.moveCombatant, Number(button.dataset.moveDelta))));
  });
  document.querySelectorAll("[data-remove-combatant]").forEach((button) => {
    button.addEventListener("click", () => save(removeCombatantFromEncounter(getCombatEncounter(), button.dataset.removeCombatant)));
  });
  document.querySelectorAll("[data-select-active-combatant]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = getCombatEncounter();
      const index = current.combatants.findIndex((combatant) => combatant.id === button.dataset.selectActiveCombatant);
      if (index >= 0) save({ ...current, currentTurnIndex: index, activeCombatantId: current.combatants[index].id });
    });
  });

  document.querySelectorAll("[data-combatant-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const combatant = getCombatEncounter().combatants.find((item) => item.id === button.dataset.combatantDetail);
      if (combatant) activateCombatantDetail(combatant);
    });
  });

  document.querySelectorAll("[data-combatant-id][draggable='true']").forEach((item) => {
    item.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", item.dataset.combatantId);
    });
    item.addEventListener("dragover", (event) => event.preventDefault());
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedId = event.dataTransfer?.getData("text/plain");
      if (draggedId) save(moveCombatantBefore(getCombatEncounter(), draggedId, item.dataset.combatantId));
    });
  });

  document.querySelector("[data-active-hp-action]")?.closest(".combat-active-panel")?.addEventListener("click", (event) => {
    const active = activeCombatant(getCombatEncounter());
    if (!active) return;
    const action = event.target?.dataset?.activeHpAction;
    if (action) {
      const amount = Number(document.getElementById("combat-hp-amount")?.value) || 0;
      save(updateCombatantInEncounter(getCombatEncounter(), active.id, (combatant) => {
        if (action === "damage") return hpAdjustedCombatant(combatant, -amount);
        if (action === "heal") return hpAdjustedCombatant(combatant, amount);
        return { ...combatant, currentHp: Math.max(0, amount), status: amount <= 0 ? "defeated" : combatant.status };
      }));
    }
    if (event.target?.matches("[data-add-condition]")) {
      const condition = document.getElementById("combat-condition-select")?.value || "";
      save(updateCombatantInEncounter(getCombatEncounter(), active.id, (combatant) => setCombatantCondition(combatant, condition, true)));
    }
    if (event.target?.dataset?.removeCondition) {
      save(updateCombatantInEncounter(getCombatEncounter(), active.id, (combatant) => setCombatantCondition(combatant, event.target.dataset.removeCondition, false)));
    }
  });
  document.getElementById("combat-active-status")?.addEventListener("change", (event) => {
    const active = activeCombatant(getCombatEncounter());
    if (active) save(updateCombatantInEncounter(getCombatEncounter(), active.id, (combatant) => ({ ...combatant, status: event.target.value })));
  });
  document.getElementById("combat-temp-detail")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-temp-detail]")) {
      const panel = document.getElementById("combat-temp-detail");
      if (panel) panel.hidden = true;
    }
  });
}

function sheetField(label, value) {
  const display = value === 0 ? 0 : (value || "—");
  return `<div class="sheet-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(display)}</strong></div>`;
}

function WildShapeBadge(label = "Wild Shape") {
  return `<span class="wild-shape-badge">${escapeHtml(label)}</span>`;
}

function WildShapeSourceChip(label = "Beast", variant = "beast") {
  return `<span class="wild-shape-source-chip is-${escapeHtml(variant)}">${escapeHtml(label)}</span>`;
}

function WildShapeButton(player = {}) {
  if (!isDruidCharacter(player)) return "";
  const wildShape = useWildShape(player);
  const active = Boolean(wildShape.overlay);
  const disabled = characterHasWildShapeAccess(player) ? "" : " disabled";
  return `
    <section class="sheet-box wild-shape-control ${active ? "is-active" : ""}">
      <div>
        <h3><span>Druid Wild Shape</span>${WildShapeBadge(active ? "Active" : (characterHasWildShapeAccess(player) ? "Available" : "Locked"))}</h3>
        <p>${escapeHtml(active ? "Choose another legal beast form or revert from the active form below." : wildShapeLimitText(player))}</p>
      </div>
      <button class="btn ${active ? "btn-secondary" : "btn-primary"}" type="button" data-open-wild-shape-selector${disabled}>${active ? "Change Form" : "Wild Shape"}</button>
    </section>`;
}

function WildShapeStatWidget(label, originalValue, beastValue, options = {}) {
  const original = originalValue === 0 ? 0 : (originalValue || "—");
  const beast = beastValue === 0 ? 0 : (beastValue || "—");
  const sourceLabel = options.sourceLabel || "Beast";
  const sourceVariant = options.sourceVariant || "beast";
  return `
    <div class="sheet-field wild-shape-stat-widget ${options.compact ? "is-compact" : ""} is-${escapeHtml(sourceVariant)}">
      <span>${escapeHtml(label)} ${WildShapeSourceChip(sourceLabel, sourceVariant)}</span>
      <strong>${escapeHtml(beast)}</strong>
      <small>Original: ${escapeHtml(original)}</small>
    </div>`;
}

function StatOverrideCard(player = {}, ability = {}, wildShape = {}) {
  const overlay = wildShape.overlay;
  const original = abilityScore(player, ability.key) || "10";
  if (!overlay) {
    return `
      <div class="ability-score-box">
        <span>${escapeHtml(ability.label)}</span>
        <strong>${escapeHtml(original)}</strong>
        <small>${signedModifier(abilityModifier(original))}</small>
      </div>`;
  }
  const retained = WILD_SHAPE_MENTAL_ABILITIES.includes(ability.key);
  const current = retained ? original : (overlay.abilities[ability.key] || original);
  const changed = String(current) !== String(original);
  return `
    <div class="ability-score-box stat-override-card ${retained ? "is-retained" : "is-overridden"} ${changed ? "has-change" : ""}">
      <div class="stat-override-card__top">
        <span>${escapeHtml(ability.short || ability.label)}</span>
        ${WildShapeSourceChip(retained ? "Retained" : "Beast", retained ? "retained" : "beast")}
      </div>
      <strong>${escapeHtml(current)}</strong>
      <small>${signedModifier(abilityModifier(current))}</small>
      <em>Original ${escapeHtml(original)}</em>
    </div>`;
}

function WildShapeAbilityBox(player = {}, ability = {}, wildShape = {}) {
  return StatOverrideCard(player, ability, wildShape);
}

function WildShapeBanner(player = {}, wildShape = {}) {
  const overlay = wildShape.overlay;
  if (!overlay) return "";
  const chips = [
    overlay.sizeType || "Beast form",
    `CR ${overlay.cr || "—"}`,
    overlay.speed || "",
    "Concentration retained",
  ].filter(hasText);
  return `
    <div class="wild-shape-banner">
      <div class="wild-shape-banner__status">
        <span class="wild-shape-status-dot" aria-hidden="true"></span>
        <span>Wild Shape Active</span>
      </div>
      <div class="wild-shape-banner__main">
        <div>
          <h2>${escapeHtml(overlay.beastName)}</h2>
          <p>${escapeHtml(player.characterName || "Character")} is using a temporary beast form.</p>
        </div>
        <div class="wild-shape-chip-row" aria-label="Active form details">
          ${chips.map((chip) => `<span class="wild-shape-chip">${escapeHtml(chip)}</span>`).join("")}
        </div>
      </div>
      <button class="btn btn-secondary wild-shape-revert-button" type="button" data-revert-wild-shape>Revert</button>
    </div>`;
}

function BeastHpPanel(player = {}, wildShape = {}) {
  const overlay = wildShape.overlay;
  if (!overlay) return "";
  const maxHp = Number(overlay.hitPointMaximum) || 0;
  const currentHp = Number(overlay.currentHp) || 0;
  const originalHp = player.combat?.hitPointMaximum || player.wildShapeOriginalSnapshot?.combat?.hitPointMaximum || "—";
  const hpPercent = maxHp ? Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100))) : 0;
  const zeroWarning = currentHp <= 0;
  return `
    <section class="beast-hp-panel" aria-labelledby="beast-hp-title">
      <div class="beast-hp-panel__summary">
        <span id="beast-hp-title">Beast vitality</span>
        <strong>${escapeHtml(currentHp)} / ${escapeHtml(maxHp || "—")} HP</strong>
        <small>Separate from character HP. Original max: ${escapeHtml(originalHp)}</small>
      </div>
      <div class="beast-hp-meter" role="meter" aria-label="Beast hit points" aria-valuemin="0" aria-valuemax="${escapeHtml(maxHp || 0)}" aria-valuenow="${escapeHtml(Math.max(0, currentHp))}">
        <span style="width: ${escapeHtml(hpPercent)}%"></span>
      </div>
      <div class="beast-hp-panel__controls">
        <label>
          <span>Current HP</span>
          <input type="number" data-wild-shape-hp value="${escapeHtml(currentHp)}" min="-999" max="${escapeHtml(maxHp || 999)}" />
        </label>
        <button class="btn btn-secondary" type="button" data-update-wild-shape-hp>Update</button>
      </div>
      ${zeroWarning ? `<p class="wild-shape-warning">Beast form is at 0 HP. Prepare to carry over ${escapeHtml(overlay.excessDamagePending || 0)} excess damage on revert.</p>` : ""}
    </section>`;
}

function TransformationEffectList(wildShape = {}) {
  const overlay = wildShape.overlay;
  if (!overlay) return "";
  const effects = [
    ["Spellcasting", "Disabled while transformed; concentration is retained."],
    ["Equipment", `${overlay.equipmentMode || "Merged"} placeholder for this form.`],
    ["Anatomy", "Speech and hand-required actions depend on the beast body."],
  ];
  return `
    <section class="transformation-effects" aria-label="Transformation effects">
      ${effects.map(([label, text]) => `
        <div class="transformation-effect">
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(text)}</span>
        </div>`).join("")}
    </section>`;
}

function WildShapeOverlay(player = {}, wildShape = useWildShape(player)) {
  if (!wildShape.overlay) return "";
  return `
    <section class="wild-shape-active-panel">
      ${WildShapeBanner(player, wildShape)}
      <div class="wild-shape-active-panel__body">
        ${BeastHpPanel(player, wildShape)}
        ${TransformationEffectList(wildShape)}
      </div>
    </section>`;
}

function WildShapeActionMarkup(action = {}) {
  return `
    <article class="wild-shape-action-card">
      <strong>${escapeHtml(action.name || "Action")}</strong>
      <dl>
        <div><dt>To hit</dt><dd>${escapeHtml(action.attackBonus || "—")}</dd></div>
        <div><dt>Damage</dt><dd>${escapeHtml(action.damageTypeText || "—")}</dd></div>
        ${action.reachRange ? `<div><dt>Reach/Range</dt><dd>${escapeHtml(action.reachRange)}</dd></div>` : ""}
      </dl>
      ${action.notes ? `<p>${escapeHtml(action.notes)}</p>` : ""}
    </article>`;
}

function WildShapeAttackOverlay(player = {}, wildShape = useWildShape(player)) {
  const actions = wildShape.overlay?.actions || [];
  if (!wildShape.overlay) return "";
  return `
    <section class="wild-shape-action-panel">
      <h4>${WildShapeBadge("Wild Shape")} Beast Actions</h4>
      ${actions.length ? `<div class="wild-shape-action-list">${actions.map(WildShapeActionMarkup).join("")}</div>` : `<p>No beast actions are listed for this form.</p>`}
      <p class="wild-shape-limited-note">Original attacks, spellcasting, speech, and hand-required actions are limited while transformed. Legendary and lair actions are not shown.</p>
    </section>`;
}

function WildShapeBeastActionsWidget(player = {}, wildShape = useWildShape(player)) {
  if (!wildShape.overlay) return "";
  const actions = wildShape.overlay.actions || [];
  return `
    <section class="sheet-box wild-shape-actions-widget">
      <h3><span>Beast Actions</span>${WildShapeSourceChip("Replaces equipment", "beast")}</h3>
      <p class="wild-shape-limited-note">Normal equipment is ${escapeHtml(wildShape.overlay.equipmentMode)} while transformed. Use the beast stat block actions below.</p>
      ${actions.length ? `<div class="wild-shape-action-list">${actions.map(WildShapeActionMarkup).join("")}</div>` : `<p>No beast actions are listed for this form.</p>`}
    </section>`;
}

function BeastShapeSelector(player = {}) {
  const wildShape = useWildShape(player);
  const beasts = wildShape.availableBeasts;
  return `
    <div class="sheet-modal wild-shape-selector-modal" id="wild-shape-selector-modal" hidden>
      <button class="sheet-modal-backdrop" type="button" data-close-wild-shape-selector aria-label="Close Beast Shape selector"></button>
      <article class="sheet-modal-dialog wild-shape-selector-dialog" role="dialog" aria-modal="true" aria-labelledby="wild-shape-selector-title">
        <button class="sheet-modal-close" type="button" data-close-wild-shape-selector aria-label="Close">&times;</button>
        <p class="eyebrow">Beast selection</p>
        <h2 id="wild-shape-selector-title">Choose Wild Shape form</h2>
        <p>${escapeHtml(wildShapeLimitText(player))}</p>
        <label class="search-control wild-shape-selector-search" for="wild-shape-selector-search">
          <span aria-hidden="true">Search</span>
          <input id="wild-shape-selector-search" type="search" placeholder="Name, action, trait..." />
        </label>
        <div class="wild-shape-selector-grid" id="wild-shape-selector-grid">
          ${beasts.length ? beasts.map((shape) => BeastShapeSelectorCard(shape, player)).join("") : `<div class="empty-state">No legal Beast Shape forms are available for this Druid level.</div>`}
        </div>
      </article>
    </div>`;
}

function BeastShapeSelectorCard(shape = {}, player = {}) {
  const actions = beastShapeActions(shape).map((action) => action.name).filter(Boolean).slice(0, 4);
  const searchable = beastShapeSearchText(shape);
  const abilityPreview = [
    `STR ${shape.strength || "—"}`,
    `DEX ${shape.dexterity || "—"}`,
    `CON ${shape.constitution || "—"}`,
    `INT ${abilityScore(player, "intelligence") || "—"}`,
    `WIS ${abilityScore(player, "wisdom") || "—"}`,
    `CHA ${abilityScore(player, "charisma") || "—"}`,
  ].join(" · ");
  return `
    <article class="wild-shape-selector-card" data-searchable="${escapeHtml(searchable)}">
      <div class="card-kicker">
        <span class="status-badge status-prepared">CR ${escapeHtml(shape.cr)}</span>
        <span>${escapeHtml(shape.size || "Unknown")} beast</span>
      </div>
      <h3>${escapeHtml(shape.name)}</h3>
      <dl>
        <div><dt>AC</dt><dd>${escapeHtml(shape.ac || "—")}</dd></div>
        <div><dt>HP</dt><dd>${escapeHtml(shape.hp || "—")}</dd></div>
        <div><dt>Hit Dice</dt><dd>${escapeHtml(wildShapeHitDice(shape))}</dd></div>
        <div><dt>Speed</dt><dd>${escapeHtml(wildShapeMovementSummary(shape))}</dd></div>
        <div><dt>Abilities</dt><dd>${escapeHtml(abilityPreview)}</dd></div>
        <div><dt>Saves</dt><dd>${escapeHtml(Object.keys(wildShapeSaveBonuses(shape)).join(", ") || "Character proficiencies + beast if listed")}</dd></div>
        <div><dt>Skills</dt><dd>${escapeHtml(Object.keys(wildShapeSkillBonuses(shape)).join(", ") || "Character proficiencies + beast if listed")}</dd></div>
        <div><dt>Senses</dt><dd>${escapeHtml(wildShapeSenses(shape))}</dd></div>
        <div><dt>Traits</dt><dd>${escapeHtml(beastShapeTraits(shape).join(", ") || "—")}</dd></div>
        <div><dt>Actions</dt><dd>${escapeHtml(actions.join(", ") || "No actions listed")}</dd></div>
      </dl>
      <button class="btn btn-primary" type="button" data-select-wild-shape="${escapeHtml(shape.id)}">Assume Form</button>
    </article>`;
}

function sheetEditButton(label, path) {
  if (!path) return "";
  return `<button class="sheet-edit-button" type="button" data-edit-sheet-field="${escapeHtml(path)}" aria-label="Edit ${escapeHtml(label)}">Edit</button>`;
}

function sheetTextBlock(label, value, editPath = "") {
  const widgetAttribute = editPath ? ` data-sheet-widget="${escapeHtml(editPath)}"` : "";
  return `<section class="sheet-box sheet-widget"${widgetAttribute}><h3><span>${escapeHtml(label)}</span>${sheetEditButton(label, editPath)}</h3><p>${escapeHtml(value || "—")}</p></section>`;
}

function sheetSkillGroupsMarkup(player, wildShape = useWildShape(player)) {
  const proficientSaves = player.savingThrowProficiencies || [];
  const proficientSkills = player.skillProficiencies || [];
  const expertiseSkills = new Set(expertiseSkillKeysForPlayer(player));
  const shape = wildShape.beast;
  const overlay = wildShape.overlay;
  return `
    <section class="sheet-box sheet-skill-widget ${overlay ? "wild-shape-skill-widget" : ""}">
      <h3><span>Saving Throws &amp; Skills</span><small>${overlay ? "Wild Shape" : `PB ${signedModifier(player.proficiencyBonus || proficiencyBonusForLevel(player.level))}`}</small></h3>
      <div class="sheet-skill-groups">
        ${ABILITIES.map((ability) => {
          const abilitySkills = SKILLS.filter((skill) => skill.ability === ability.key);
          const wildSaveBonus = overlay && shape ? wildShapeSavingThrowBonus(player, shape, ability.key) : null;
          return `
            <div class="sheet-skill-group">
              <div class="sheet-skill-group-header">
                <span>${escapeHtml(ability.short)}</span>
                <strong>${escapeHtml(ability.label)}</strong>
              </div>
              <div class="sheet-skill-row sheet-save-row ${overlay ? "is-wild-shape-row" : ""}">
                <span>${proficientSaves.includes(ability.key) ? "●" : "○"}</span>
                <strong>${signedModifier(overlay ? wildSaveBonus : savingThrowBonus(player, ability.key))}</strong>
                <em>Saving throw${overlay ? ` <small>Original ${signedModifier(savingThrowBonus(player, ability.key))}</small>` : ""}</em>
              </div>
              ${abilitySkills.map((skill) => {
                const wildBonus = overlay && shape ? wildShapeSkillBonus(player, shape, skill) : null;
                return `
                <div class="sheet-skill-row ${overlay ? "is-wild-shape-row" : ""}">
                  <span>${proficientSkills.includes(skill.key) ? "●" : "○"}</span>
                  <strong>${signedModifier(overlay ? wildBonus : skillBonus(player, skill))}</strong>
                  <em>${escapeHtml(skill.label)}${expertiseSkills.has(skill.key) && !overlay ? " <small>Expertise</small>" : ""}${overlay ? ` <small>Original ${signedModifier(skillBonus(player, skill))}</small>` : ""}</em>
                </div>`;
              }).join("")}
            </div>`;
        }).join("")}
      </div>
    </section>`;
}

function traitIconLabel(title = "") {
  const words = String(title || "Trait").match(/[A-Za-z0-9]+/g) || ["Trait"];
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function sheetTraitButtonsMarkup(player, wildShape = useWildShape(player)) {
  const beastTraits = wildShape.overlay?.traits || [];
  const blocks = wildShape.overlay
    ? beastTraits.map((trait) => ({ title: trait, details: beastTraitDescription(trait) }))
    : featureBlocksForPlayer(player);
  return `
    <section class="sheet-box sheet-widget sheet-traits-widget ${wildShape.overlay ? "wild-shape-traits-widget" : ""}" data-sheet-widget="features">
      <h3><span>${wildShape.overlay ? "Beast Traits" : "Traits"}</span>${wildShape.overlay ? WildShapeSourceChip("Beast", "beast") : sheetEditButton("Traits", "features")}</h3>
      ${blocks.length ? `
        <div class="sheet-trait-grid">
          ${blocks.map((block, index) => `
            <button class="sheet-trait-button" type="button" data-sheet-trait-index="${index}" data-trait-title="${escapeHtml(block.title)}" data-trait-details="${escapeHtml(block.details || block.title)}" title="${escapeHtml(block.title)}">
              <span class="sheet-trait-icon">${escapeHtml(traitIconLabel(block.title))}</span>
              <span>${escapeHtml(block.title)}</span>
            </button>`).join("")}
        </div>` : `<p>—</p>`}
    </section>`;
}

function sheetClassFeatureMeta(feature = {}, player = {}) {
  const details = [
    `Level ${feature.level}`,
    feature.subclassName || feature.className || "",
    feature.choice ? `Choice: ${feature.choice}` : "",
    feature.cost ? `Cost: ${feature.cost}` : "",
    ...bardFeatureDynamicDetails(feature, player),
  ].filter(Boolean);
  return details;
}

function sheetClassFeatureChoiceDetails(feature = {}, player = {}) {
  const choices = bardChoicesForPlayer(player);
  if (/^bard-expertise/.test(feature.id)) {
    return choices.expertise.length ? `Expertise: ${choices.expertise.map(skillLabel).join(", ")}` : "Expertise choices not selected.";
  }
  if (feature.id === "lore-bonus-proficiencies") {
    return choices.loreBonusProficiencies.length ? `Bonus skills: ${choices.loreBonusProficiencies.map(skillLabel).join(", ")}` : "Bonus skill choices not selected.";
  }
  if (feature.id === "lore-magical-discoveries") {
    return choices.loreMagicalDiscoveries.length ? `Magical Discoveries: ${bardSpellChoiceNames(choices.loreMagicalDiscoveries).join(", ")}` : "Magical Discoveries not selected.";
  }
  if (feature.id === "magical-secrets") {
    return choices.magicalSecrets.length ? `Magical Secrets: ${choices.magicalSecrets.join(", ")}` : "";
  }
  if (/^bard-asi-|^epic-boon$/.test(feature.id)) return choices.asiNotes || "";
  return "";
}

function fontOfInspirationControlsMarkup(player = {}) {
  if (bardLevelForPlayer(player) < 5) return "";
  const feature = classFeaturesForPlayer(player).find((item) => item.id === "bardic-inspiration");
  const used = feature ? classFeatureUsageUsed(player, feature) : 0;
  const runtime = spellcastingRuntimeForPlayer(player);
  if (!feature || used <= 0 || !runtime) return "";
  const availableLevels = runtime.normalSlots
    .map((total, index) => ({ level: index + 1, available: total - (runtime.slotUsage.normal[index + 1] || 0) }))
    .filter((entry) => entry.available > 0);
  if (!availableLevels.length) return `<div class="class-feature-cost">No available spell slot can restore Bardic Inspiration.</div>`;
  return `
    <div class="class-feature-usage-actions">
      ${availableLevels.map((entry) => `
        <button class="btn btn-secondary" type="button" data-font-inspiration-slot="${escapeHtml(entry.level)}">
          Spend level ${escapeHtml(entry.level)} slot
        </button>`).join("")}
    </div>`;
}

function superiorInspirationControlsMarkup(player = {}) {
  if (bardLevelForPlayer(player) < 18) return "";
  const feature = classFeaturesForPlayer(player).find((item) => item.id === "bardic-inspiration");
  if (!feature) return "";
  const max = classFeatureUsageMaximum(feature, player);
  const available = Math.max(0, max - classFeatureUsageUsed(player, feature));
  return `<button class="btn btn-secondary" type="button" data-superior-inspiration ${available >= Math.min(2, max) ? "disabled" : ""}>Apply initiative recovery</button>`;
}

function sheetClassFeatureUsageMarkup(feature = {}, player = {}) {
  if (!feature.usage) {
    const bardicInspiration = classFeaturesForPlayer(player).find((item) => item.id === "bardic-inspiration");
    const bardicUsed = bardicInspiration ? classFeatureUsageUsed(player, bardicInspiration) : 0;
    const bardicMaximum = bardicInspiration ? classFeatureUsageMaximum(bardicInspiration, player) : 0;
    const bardicCost = feature.cost === "Bardic Inspiration"
      ? `
        <div class="class-feature-usage">
          <div class="class-feature-cost">${escapeHtml(Math.max(0, bardicMaximum - bardicUsed))} / ${escapeHtml(bardicMaximum)} Bardic Inspiration left</div>
          <button class="btn btn-secondary" type="button" data-spend-bardic-inspiration ${bardicUsed >= bardicMaximum ? "disabled" : ""}>Spend</button>
        </div>`
      : "";
    return [
      feature.cost && !bardicCost ? `<div class="class-feature-cost">Uses ${escapeHtml(feature.cost)}</div>` : "",
      bardicCost,
      feature.id === "font-of-inspiration" ? fontOfInspirationControlsMarkup(player) : "",
      feature.id === "superior-inspiration" ? superiorInspirationControlsMarkup(player) : "",
    ].join("");
  }
  const key = classFeatureUsageKey(feature);
  const max = classFeatureUsageMaximum(feature, player);
  const used = Math.min(max, classFeatureUsageUsed(player, feature));
  const left = Math.max(0, max - used);
  const inspiration = classFeaturesForPlayer(player).find((item) => item.id === "bardic-inspiration");
  const inspirationLeft = inspiration
    ? classFeatureUsageMaximum(inspiration, player) - classFeatureUsageUsed(player, inspiration)
    : 0;
  return `
    <div class="class-feature-usage">
      <div>
        <span>${escapeHtml(feature.usage.label || feature.title)}</span>
        <strong>${escapeHtml(left)} / ${escapeHtml(max)} left</strong>
        <small>${escapeHtml(classFeatureUsageRecovery(feature, player))}</small>
      </div>
      <div class="class-feature-usage-actions">
        <button class="btn btn-secondary" type="button" data-class-feature-use="${escapeHtml(key)}" data-class-feature-used="${escapeHtml(Math.min(max, used + 1))}" ${left <= 0 ? "disabled" : ""}>Use</button>
        <button class="btn btn-secondary" type="button" data-class-feature-use="${escapeHtml(key)}" data-class-feature-used="0" ${used <= 0 ? "disabled" : ""}>Reset</button>
        ${feature.recoveryCost === "Bardic Inspiration" ? `<button class="btn btn-secondary" type="button" data-restore-feature-with-inspiration="${escapeHtml(key)}" ${used <= 0 || inspirationLeft <= 0 ? "disabled" : ""}>Restore with Inspiration</button>` : ""}
      </div>
    </div>`;
}

function sheetClassFeatureCardMarkup(feature = {}, player = {}) {
  const meta = sheetClassFeatureMeta(feature, player);
  const choiceDetails = sheetClassFeatureChoiceDetails(feature, player);
  const detailText = [feature.summary, choiceDetails, ...meta].filter(Boolean).join("\n");
  return `
    <article class="class-feature-card">
      <button class="class-feature-main" type="button" data-sheet-trait-index="class-${escapeHtml(feature.id)}" data-trait-title="${escapeHtml(feature.title)}" data-trait-details="${escapeHtml(detailText)}" title="${escapeHtml(feature.title)}">
        <span class="sheet-trait-icon">${escapeHtml(traitIconLabel(feature.title))}</span>
        <span>
          <strong>${escapeHtml(feature.title)}</strong>
          <small>${escapeHtml(meta.join(" · "))}</small>
        </span>
      </button>
      <p>${escapeHtml(feature.summary)}</p>
      ${choiceDetails ? `<div class="class-feature-choice-summary">${escapeHtml(choiceDetails)}</div>` : ""}
      ${sheetClassFeatureUsageMarkup(feature, player)}
    </article>`;
}

function sheetClassFeaturesMarkup(player = {}, wildShape = useWildShape(player)) {
  if (wildShape.overlay) return "";
  const features = classFeaturesForPlayer(player);
  if (!features.length) return "";
  const bardSubclass = bardSubclassById(bardSubclassIdForPlayer(player));
  return `
    <section class="sheet-box sheet-widget sheet-class-features-widget" data-sheet-widget="classFeatures">
      <h3><span>Class Features</span><small>${escapeHtml(classLevelSummary(classLevelEntriesForPlayer(player)) || "Adventurer")}</small></h3>
      ${bardLevelForPlayer(player) >= 3 && !bardSubclass ? `<div class="empty-state">Choose a Bard College to show subclass features.</div>` : ""}
      <div class="class-feature-grid">
        ${features.map((feature) => sheetClassFeatureCardMarkup(feature, player)).join("")}
      </div>
      <div class="class-feature-rest-actions">
        <button class="btn btn-secondary" type="button" data-class-feature-rest="short">Short rest</button>
        <button class="btn btn-secondary" type="button" data-class-feature-rest="long">Long rest</button>
      </div>
    </section>`;
}

function sheetEquipmentItemPreview(item = "", homebrewItem = null, weapon = null) {
  if (homebrewItem?.description) return homebrewItem.description;
  if (homebrewItem) return homebrewItem.type || "Homebrew item";
  if (weapon) return `${weapon.mode === "finesse" ? "Finesse" : weapon.mode || "Weapon"} weapon`;
  return item;
}

function sheetEquipmentItemDetails(item = "", player = {}) {
  const homebrewItem = homebrewItemForEquipmentItem(item);
  if (homebrewItem) {
    const stats = homebrewItemStatistics(homebrewItem);
    return [
      homebrewItem.description,
      stats.damage ? `Damage: ${stats.damage}` : "",
      stats.attackBonus || stats.attack ? `Attack bonus: ${stats.attackBonus ?? stats.attack}` : "",
      stats.damageBonus ? `Damage bonus: ${stats.damageBonus}` : "",
      weaponPropertiesText(stats.properties) ? `Properties: ${weaponPropertiesText(stats.properties)}` : "",
    ].filter(hasText).join("\n");
  }

  const weapon = weaponForEquipmentItem(item);
  if (weapon) {
    const modifier = weaponAbilityModifier(weapon, player.abilities || {});
    return [
      item !== weapon.name ? `Matched weapon: ${weapon.name}` : "",
      `Attack: ${signedModifier(modifier + proficiencyBonusForLevel(player.level || 1))}`,
      `Damage: ${weaponDamageText(weapon, modifier)}`,
      `Mode: ${weapon.mode === "finesse" ? "Melee or Dexterity" : weapon.mode}`,
    ].filter(hasText).join("\n");
  }

  return `Saved equipment entry: ${item}`;
}

function sheetEquipmentItemsMarkup(player, equipmentText = "", wildShape = useWildShape(player)) {
  if (wildShape.overlay) return WildShapeBeastActionsWidget(player, wildShape);
  const items = equipmentItems(player.equipment);
  const goldLine = Number(player.gold) > 0 ? `${player.gold} GP` : "";
  if (!items.length && !goldLine) return sheetTextBlock("Equipment", equipmentText, "equipment");
  return `
    <section class="sheet-box sheet-widget sheet-equipment-widget" data-sheet-widget="equipment">
      <h3><span>Equipment</span>${sheetEditButton("Equipment", "equipment")}</h3>
      ${items.length ? `
        <div class="sheet-equipment-grid">
          ${items.map((item, index) => {
            const homebrewItem = homebrewItemForEquipmentItem(item);
            const weapon = weaponForEquipmentItem(item);
            const title = homebrewItem?.name || item;
            const type = homebrewItem?.type || (weapon ? "Weapon" : "Equipment");
            const preview = sheetEquipmentItemPreview(item, homebrewItem, weapon);
            const details = sheetEquipmentItemDetails(item, player);
            return `
              <button class="sheet-equipment-card ${homebrewItem ? "is-homebrew" : ""}" type="button" data-sheet-equipment-index="${index}" ${homebrewItem?.id ? `data-homebrew-item-id="${escapeHtml(homebrewItem.id)}"` : ""} data-equipment-title="${escapeHtml(title)}" data-equipment-type="${escapeHtml(type)}" data-equipment-details="${escapeHtml(details)}">
                <span class="sheet-equipment-icon">${escapeHtml(traitIconLabel(title))}</span>
                <strong>${escapeHtml(title)}</strong>
                <small>${escapeHtml(type)}</small>
                <em>${escapeHtml(preview)}</em>
              </button>`;
          }).join("")}
        </div>` : ""}
      ${goldLine ? `<div class="sheet-gold-widget"><span>Gold</span><strong>${escapeHtml(goldLine)}</strong></div>` : ""}
    </section>`;
}

function spellSlotButtonsMarkup({ kind, level, total, used }) {
  return `
    <div class="spell-slot-row">
      <span>${escapeHtml(kind === "pact" ? `Pact ${spellLevelLabel(level)}` : spellLevelLabel(level))}</span>
      <div class="spell-slot-buttons">
        ${Array.from({ length: total }, (_, index) => {
          const slotNumber = index + 1;
          const isUsed = slotNumber <= used;
          return `<button class="spell-slot-button ${isUsed ? "is-used" : ""}" type="button" data-spell-slot-kind="${escapeHtml(kind)}" data-spell-slot-level="${escapeHtml(level)}" data-spell-slot-used="${escapeHtml(isUsed ? slotNumber - 1 : slotNumber)}" title="${escapeHtml(isUsed ? "Mark slot available" : "Mark slot used")}">${escapeHtml(slotNumber)}</button>`;
        }).join("")}
      </div>
      <strong>${escapeHtml(Math.max(0, total - used))}/${escapeHtml(total)} left</strong>
    </div>`;
}

function sheetSpellCardMarkup(spell) {
  const meta = spellMetadata(spell);
  const materialLine = meta.materialText ? `<em title="${escapeHtml(meta.materialText)}">Material: ${escapeHtml(meta.materialText)}</em>` : "";
  return `
    <button class="sheet-spell-card" type="button" data-sheet-spell-id="${escapeHtml(spell.id)}">
      <span class="sheet-spell-card-top">
        <strong>${escapeHtml(spell.name)}</strong>
        <small>${escapeHtml(meta.levelLabel)}</small>
      </span>
      <span>${escapeHtml(spell.school || "Unknown school")}</span>
      <span class="sheet-spell-fast-line">${escapeHtml(spell.castingTime || "Unknown time")} · ${escapeHtml(spell.range || "Unknown range")}</span>
      <span class="sheet-spell-fast-line">${escapeHtml(spell.duration || "Unknown duration")}</span>
      <span class="spell-badge-row">${spellFeatureBadgesMarkup(spell)}</span>
      ${materialLine}
    </button>`;
}

function sheetSpellLevelGroupMarkup(group) {
  return `
    <section class="sheet-spell-level-group ${group.level === 0 ? "is-cantrip-group" : ""}">
      <header>
        <h4>${escapeHtml(group.label)}</h4>
        <span>${escapeHtml(group.spells.length)} selected</span>
      </header>
      <div class="sheet-spell-grid">${group.spells.map(sheetSpellCardMarkup).join("")}</div>
    </section>`;
}

function sheetSpellcastingSummaryMarkup(player = {}, runtime = null) {
  const classRows = spellcastingAbilityRows(player, runtime);
  const budget = spellSelectionBudgetForClassLevels(classLevelEntriesForPlayer(player), player.abilities || {});
  const counts = selectedSpellCounts(player.spellcasting?.spells || []);
  const modeLabel = spellSelectionModeLabel(classLevelEntriesForPlayer(player), player.abilities || {});
  return `
    <div class="sheet-spellcasting-summary-grid">
      ${classRows.map((row) => `
        <article>
          <span>${escapeHtml(row.className)}</span>
          <strong>${escapeHtml(row.ability)}</strong>
          <small>Save DC ${escapeHtml(row.saveDc)} · Attack ${escapeHtml(signedModifier(row.attackBonus))}</small>
        </article>`).join("")}
      <article>
        <span>Cantrips</span>
        <strong>${escapeHtml(counts.cantrips)} / ${escapeHtml(budget.cantrips)}</strong>
        <small>Known at this level</small>
      </article>
      <article>
        <span>${escapeHtml(modeLabel)}</span>
        <strong>${escapeHtml(counts.leveled)} / ${escapeHtml(budget.leveled)}</strong>
        <small>Chosen for this sheet</small>
      </article>
    </div>`;
}

function sheetSpellbookMarkup(player, wildShape = useWildShape(player), campaignId = DEFAULT_CAMPAIGN_ID, playerId = player?.id) {
  const runtime = spellcastingRuntimeForPlayer(player);
  if (!runtime || wildShape.overlay) return "";
  return `
    <section class="sheet-box sheet-widget sheet-spellbook-page" data-sheet-widget="spellcasting">
      <h3><span>Spellbook</span><small>${escapeHtml(runtime.spells.length)} chosen</small></h3>
      <div class="sheet-spellbook-actions">
        <a class="btn btn-primary" href="${escapeHtml(playerSpellbookHref(campaignId, playerId || ""))}">Spells</a>
      </div>
    </section>`;
}

function playerSpellbookMarkup(player = {}) {
  const runtime = spellcastingRuntimeForPlayer(player);
  if (!runtime) {
    return `
      <section class="sheet-box sheet-widget sheet-spellbook-page character-spellbook-panel" data-sheet-widget="spellcasting">
        <h3><span>Chosen Spells</span><small>0 available</small></h3>
        <div class="empty-state">No spellcasting is available for this character.</div>
      </section>`;
  }
  const grouped = spellsGroupedByLevel(runtime.spells);
  return `
    <section class="sheet-box sheet-widget sheet-spellbook-page character-spellbook-panel" data-sheet-widget="spellcasting">
      <h3><span>Chosen Spells</span><small>${escapeHtml(runtime.spells.length)} available</small></h3>
      ${sheetSpellcastingSummaryMarkup(player, runtime)}
      <div class="sheet-spell-list">
        ${grouped.length ? grouped.map(sheetSpellLevelGroupMarkup).join("") : `<p>No starting spells selected.</p>`}
      </div>
    </section>`;
}

function spellDetailMarkup(spell = {}) {
  const meta = spellMetadata(spell);
  const rows = [
    ["Level", meta.levelLabel],
    ["School", spell.school],
    ["Casting time", spell.castingTime],
    ["Range", spell.range],
    ["Duration", spell.duration],
    ["Components", spell.components],
    ["Classes", spellClasses(spell).join(", ")],
  ].filter(([, value]) => hasText(value));
  const higherLevel = spell.higherLevel || spell.higherLevels || spell.atHigherLevels || spell.upcast || "";
  return `
    <div class="sheet-spell-detail-body">
      <div class="spell-badge-row sheet-spell-detail-badges">${spellFeatureBadgesMarkup(spell)}</div>
      <dl class="widget-detail-meta spell-detail-meta">
        ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
      </dl>
      ${meta.materialText ? `<section><h3>Material</h3><p>${escapeHtml(meta.materialText)}</p></section>` : ""}
      <section><h3>Description</h3><p>${escapeHtml(spell.description || "No spell details available.")}</p></section>
      ${higherLevel ? `<section><h3>At Higher Levels</h3><p>${escapeHtml(higherLevel)}</p></section>` : ""}
      ${spell.sourceUrl ? `<div class="tag-row spell-detail-actions"><a class="btn btn-secondary" href="${escapeHtml(spell.sourceUrl)}" target="_blank" rel="noreferrer">Open Source Page</a></div>` : ""}
    </div>`;
}

function sheetSpellcastingMarkup(player, wildShape = useWildShape(player)) {
  const runtime = spellcastingRuntimeForPlayer(player);
  if (!runtime) return "";
  if (wildShape.overlay) {
    return `
      <section class="sheet-box sheet-widget sheet-spellcasting-widget wild-shape-spellcasting-widget" data-sheet-widget="spellcasting">
        <h3><span>Spellcasting</span>${WildShapeSourceChip("Disabled", "override")}</h3>
        <p>Wild Shape prevents casting spells in beast form. Existing concentration is retained, and spell slots are not changed by this temporary state.</p>
      </section>`;
  }
  const normalSlotRows = runtime.normalSlots.map((total, index) => spellSlotButtonsMarkup({
    kind: "normal",
    level: index + 1,
    total,
    used: runtime.slotUsage.normal[index + 1] || 0,
  })).join("");
  const pactSlotRows = runtime.pact ? spellSlotButtonsMarkup({
    kind: "pact",
    level: runtime.pact.level,
    total: runtime.pact.slots,
    used: runtime.slotUsage.pact || 0,
  }) : "";
  return `
    <section class="sheet-box sheet-widget sheet-spellcasting-widget" data-sheet-widget="spellcasting">
      <h3><span>Spellcasting</span><small>${escapeHtml(runtime.entries.map((entry) => `${entry.className} ${entry.rule.ability}`).join(" / "))}</small></h3>
      ${sheetSpellcastingSummaryMarkup(player, runtime)}
      <div class="spell-slot-panel">
        ${normalSlotRows || pactSlotRows ? `
          ${normalSlotRows}
          ${pactSlotRows}` : `<p>No spell slots at this level.</p>`}
      </div>
      <div class="spell-recovery-note">
        <p>Normal spell slots recover when you finish a long rest.</p>
        ${runtime.pact ? `<p>Warlock Pact Magic slots recover when you finish a short or long rest.</p>` : ""}
        <div class="spell-rest-actions">
          <button class="btn btn-secondary" type="button" data-spell-rest="short">Short rest</button>
          <button class="btn btn-secondary" type="button" data-spell-rest="long">Long rest</button>
        </div>
      </div>
    </section>`;
}

function characterSheetOverlays(player = {}) {
  return `
    ${BeastShapeSelector(player)}
    <div class="sheet-modal" id="sheet-trait-modal" hidden>
      <button class="sheet-modal-backdrop" type="button" data-close-sheet-trait aria-label="Close trait details"></button>
      <article class="sheet-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="sheet-trait-title">
        <button class="sheet-modal-close" type="button" data-close-sheet-trait aria-label="Close">&times;</button>
        <p class="eyebrow">Trait</p>
        <h2 id="sheet-trait-title"></h2>
        <p id="sheet-trait-details"></p>
      </article>
    </div>
    <div class="sheet-modal" id="sheet-edit-modal" hidden>
      <button class="sheet-modal-backdrop" type="button" data-close-sheet-edit aria-label="Close editor"></button>
      <form class="sheet-modal-dialog sheet-edit-dialog" id="sheet-edit-form" role="dialog" aria-modal="true" aria-labelledby="sheet-edit-title">
        <button class="sheet-modal-close" type="button" data-close-sheet-edit aria-label="Close">&times;</button>
        <p class="eyebrow">Edit sheet widget</p>
        <h2 id="sheet-edit-title"></h2>
        <textarea id="sheet-edit-value" rows="9"></textarea>
        <div class="sheet-edit-actions">
          <button class="btn btn-secondary" type="button" data-close-sheet-edit>Cancel</button>
          <button class="btn btn-primary" type="submit">Save</button>
        </div>
      </form>
    </div>
    <div class="sheet-modal" id="sheet-equipment-modal" hidden>
      <button class="sheet-modal-backdrop" type="button" data-close-sheet-equipment aria-label="Close equipment details"></button>
      <article class="sheet-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="sheet-equipment-title">
        <button class="sheet-modal-close" type="button" data-close-sheet-equipment aria-label="Close">&times;</button>
        <p class="eyebrow" id="sheet-equipment-type">Equipment</p>
        <h2 id="sheet-equipment-title"></h2>
        <p id="sheet-equipment-details"></p>
      </article>
    </div>
    <div class="sheet-modal" id="sheet-spell-modal" hidden>
      <button class="sheet-modal-backdrop" type="button" data-close-sheet-spell aria-label="Close spell details"></button>
      <article class="sheet-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="sheet-spell-title">
        <button class="sheet-modal-close" type="button" data-close-sheet-spell aria-label="Close">&times;</button>
        <p class="eyebrow" id="sheet-spell-level">Spell</p>
        <h2 id="sheet-spell-title"></h2>
        <div id="sheet-spell-details"></div>
      </article>
    </div>`;
}

function playerSheetAttacks(player = {}) {
  const equipmentAttacks = derivedWeaponAttacks({
    equipment: player.equipment,
    abilities: player.abilities || {},
    level: player.level || 1,
  });
  const manualAttacks = (player.attacks || []).filter((attack) => !attack.generatedFromEquipment);
  const danceAttack = bardSubclassIdForPlayer(player) === "college-of-dance" && bardLevelForPlayer(player) >= 3
    ? [{
      name: "Dazzling Footwork (Unarmed)",
      attackBonus: signedModifier(proficiencyBonusForLevel(player.level || 1) + abilityModifier(player.abilities?.dexterity)),
      damageType: `${bardicInspirationDie(bardLevelForPlayer(player))} ${signedModifier(abilityModifier(player.abilities?.dexterity))} Bludgeoning`,
      generatedFromBardFeature: true,
    }]
    : [];
  return [...equipmentAttacks, ...danceAttack, ...manualAttacks];
}

function armorClassForPlayer(player = {}) {
  const saved = numberOrBlank(player.combat?.armorClass);
  const danceActive = bardSubclassIdForPlayer(player) === "college-of-dance" && bardLevelForPlayer(player) >= 3;
  const hasArmor = armorFormulaFromEquipment(player.equipment).base !== 10;
  const hasShield = /\bshield\b/i.test(String(player.equipment || ""));
  if (!danceActive || hasArmor || hasShield) return saved === "" ? 10 + abilityModifier(player.abilities?.dexterity) : saved;
  return Math.max(
    saved === "" ? 0 : saved,
    10 + abilityModifier(player.abilities?.dexterity) + abilityModifier(player.abilities?.charisma)
  );
}

function wildShapeAttackRows(wildShape = {}) {
  const attacks = wildShape.overlay?.actions || [];
  if (!attacks.length) {
    return `<tr><td colspan="3">No beast attacks are listed for this form.</td></tr>`;
  }
  return attacks.map((attack) => `
    <tr class="wild-shape-attack-row">
      <td>
        <strong>${escapeHtml(attack.name || "Action")}</strong>
        ${attack.reachRange ? `<small>${escapeHtml(attack.reachRange)}</small>` : ""}
      </td>
      <td>${escapeHtml(attack.attackBonus || "—")}</td>
      <td>
        ${escapeHtml(attack.damageTypeText || "—")}
        ${attack.notes ? `<small>${escapeHtml(attack.notes)}</small>` : ""}
      </td>
    </tr>`).join("");
}

function playerAttackRows(player, wildShape = useWildShape(player)) {
  if (wildShape.overlay) return wildShapeAttackRows(wildShape);
  const sheetAttacks = playerSheetAttacks(player);
  const attacks = sheetAttacks.length ? sheetAttacks : [{ name: "", attackBonus: "", damageType: "" }];
  return attacks.map((attack) => `
    <tr>
      <td>${escapeHtml(attack.name || "—")}</td>
      <td>${escapeHtml(attack.attackBonus || "—")}</td>
      <td>${escapeHtml(attack.damageType || "—")}</td>
    </tr>`).join("");
}

function WildShapeMechanicCard(label, currentValue, sourceLabel, originalValue = "", options = {}) {
  const sourceVariant = options.sourceVariant || (sourceLabel === "Character" ? "retained" : "beast");
  const current = currentValue === 0 ? 0 : (currentValue || "—");
  const original = originalValue === 0 ? 0 : originalValue;
  return `
    <div class="wild-shape-mechanic-card is-${escapeHtml(sourceVariant)}">
      <div>
        <span>${escapeHtml(label)}</span>
        ${WildShapeSourceChip(sourceLabel, sourceVariant)}
      </div>
      <strong>${escapeHtml(current)}</strong>
      ${original !== "" && original !== undefined ? `<small>Original ${escapeHtml(original)}</small>` : ""}
    </div>`;
}

function WildShapeMechanicsGrid(player = {}, wildShape = useWildShape(player), combat = player.combat || {}) {
  const overlay = wildShape.overlay;
  if (!overlay) return "";
  const originalInitiative = signedModifier(initiativeBonusForPlayer(player));
  const beastInitiative = signedModifier(abilityModifier(overlay.abilities.dexterity));
  return `
    <section class="sheet-box wild-shape-mechanics-widget">
      <h3><span>Transformed Mechanics</span>${WildShapeSourceChip("Temporary", "override")}</h3>
      <div class="wild-shape-mechanics-grid">
        ${WildShapeMechanicCard("Armor Class", overlay.armorClass, "Beast", combat.armorClass)}
        ${WildShapeMechanicCard("Initiative", beastInitiative, "Beast", originalInitiative)}
        ${WildShapeMechanicCard("Speed", overlay.speed, "Beast", combat.speed ? `${combat.speed} ft.` : "")}
        ${WildShapeMechanicCard("Hit Points", `${overlay.currentHp} / ${overlay.hitPointMaximum}`, "Beast", combat.hitPointMaximum)}
        ${WildShapeMechanicCard("Hit Dice", overlay.hitDice, "Beast", combat.hitDice)}
        ${WildShapeMechanicCard("Senses", overlay.senses, "Beast")}
        ${WildShapeMechanicCard("Passive Perception", 10 + (overlay.skills?.perception ?? skillBonus(player, SKILLS.find((skill) => skill.key === "perception"))), "Merged", playerPassivePerception(player), { sourceVariant: "override" })}
      </div>
    </section>`;
}

function characterSheetMarkup(player, options = {}) {
  const combat = player.combat || {};
  const classLevels = classLevelEntriesForPlayer(player);
  const classSummary = classLevelSummary(classLevels);
  const wildShape = useWildShape(player);
  const overlay = wildShape.overlay;
  const campaignId = options.campaignId || DEFAULT_CAMPAIGN_ID;
  const playerId = options.playerId || player.id || "";
  const equipmentText = [
    player.equipment,
    Number(player.gold) > 0 ? `Gold: ${player.gold} GP` : "",
  ].filter(hasText).join("\n");
  const proficiencyText = [
    (player.languages || []).length ? `Languages: ${(player.languages || []).map(languageLabel).join(", ")}` : "",
    (player.toolProficiencies || []).length ? `Tools: ${(player.toolProficiencies || []).map(toolLabel).join(", ")}` : "",
    uniqueTextList([...(player.armorTraining || []), ...bardArmorTrainingForPlayer(player)]).length
      ? `Armor training: ${uniqueTextList([...(player.armorTraining || []), ...bardArmorTrainingForPlayer(player)]).join(", ")}`
      : "",
    uniqueTextList([...(player.weaponProficiencies || []), ...bardWeaponProficienciesForPlayer(player)]).length
      ? `Weapons: ${uniqueTextList([...(player.weaponProficiencies || []), ...bardWeaponProficienciesForPlayer(player)]).join(", ")}`
      : "",
  ].filter(hasText).join("\n");
  return `
    <article class="character-sheet-paper ${overlay ? "is-wild-shape-active" : ""}">
      <header class="sheet-header-grid">
        ${sheetField("Character Name", player.characterName)}
        ${sheetField("Class & Level", classSummary || `${player.classRole || "—"}${player.level ? ` ${player.level}` : ""}`)}
        ${sheetField("Player Name", player.playerName)}
        ${sheetField("Race", player.race)}
        ${sheetField("Alignment", player.alignment)}
      </header>
      ${WildShapeButton(player)}
      ${WildShapeOverlay(player, wildShape)}

      <div class="sheet-main-grid">
        <aside class="sheet-column sheet-left-column">
          <div class="ability-sheet-grid">
            ${ABILITIES.map((ability) => WildShapeAbilityBox(player, ability, wildShape)).join("")}
          </div>
          ${sheetSkillGroupsMarkup(player, wildShape)}
          ${overlay ? "" : sheetField("Passive Wisdom (Perception)", playerPassivePerception(player))}
          ${sheetTextBlock("Other Proficiencies & Languages", proficiencyText)}
        </aside>

        <section class="sheet-column">
          ${overlay ? WildShapeMechanicsGrid(player, wildShape, combat) : `
          <div class="combat-sheet-grid">
            ${sheetField("Armor Class", armorClassForPlayer(player))}
            ${sheetField("Initiative", signedModifier(initiativeBonusForPlayer(player)))}
            ${sheetField("Speed", combat.speed ? `${combat.speed} ft.` : "")}
            ${attacksPerActionForPlayer(player) > 1 ? sheetField("Attacks / Action", attacksPerActionForPlayer(player)) : ""}
          </div>
          <div class="hit-point-grid">
            ${sheetField("Hit Points", combat.hitPointMaximum)}
            ${sheetField("Hit Dice", combat.hitDice)}
          </div>`}
          <section class="sheet-box ${overlay ? "wild-shape-attacks-table" : ""}">
            <h3>${overlay ? `<span>Beast Attacks</span>${WildShapeSourceChip("Actions", "beast")}` : "Attacks &amp; Spellcasting"}</h3>
            <table class="sheet-table">
              <thead><tr><th>Name</th><th>Atk Bonus</th><th>Damage / Type</th></tr></thead>
              <tbody>${playerAttackRows(player, wildShape)}</tbody>
            </table>
            ${overlay ? `<p class="wild-shape-limited-note">These are parsed from the beast stat block. Character weapons and spell attacks are hidden while transformed.</p>` : ""}
          </section>
          ${sheetSpellcastingMarkup(player, wildShape)}
          ${sheetSpellbookMarkup(player, wildShape, campaignId, playerId)}
          ${sheetEquipmentItemsMarkup(player, equipmentText, wildShape)}
        </section>

        <section class="sheet-column">
          ${sheetTextBlock("Personality Traits", player.personality?.traits, "personality.traits")}
          ${sheetTextBlock("Ideals", player.personality?.ideals, "personality.ideals")}
          ${sheetTextBlock("Bonds", player.personality?.bonds, "personality.bonds")}
          ${sheetTextBlock("Flaws", player.personality?.flaws, "personality.flaws")}
          ${sheetClassFeaturesMarkup(player, wildShape)}
          ${sheetTraitButtonsMarkup(player, wildShape)}
          ${sheetTextBlock("Backstory / Notes", player.notes, "notes")}
        </section>
      </div>
      ${characterSheetOverlays(player)}
    </article>`;
}

function playerSheetFieldValue(player, path) {
  if (!path) return "";
  return path.split(".").reduce((value, key) => (value && value[key] !== undefined ? value[key] : ""), player) || "";
}

function setPlayerSheetFieldValue(player, path, value) {
  const keys = String(path || "").split(".").filter(Boolean);
  if (!keys.length) return player;
  const nextPlayer = { ...player };
  let target = nextPlayer;
  keys.slice(0, -1).forEach((key) => {
    target[key] = { ...(target[key] || {}) };
    target = target[key];
  });
  target[keys[keys.length - 1]] = value;
  return nextPlayer;
}

function updatePlayerSheetField(campaignId, playerId, path, value) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  return upsertCampaign({
    ...campaign,
    players: (campaign.players || []).map((player) => (
      player.id === playerId ? setPlayerSheetFieldValue(player, path, value) : player
    )),
  });
}

function updatePlayerWildShapeState(campaignId, playerId, transform) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  return upsertCampaign({
    ...campaign,
    players: (campaign.players || []).map((player) => (
      player.id === playerId ? transform(player) : player
    )),
  });
}

function updatePlayerSpellcastingState(campaignId, playerId, transform) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  return upsertCampaign({
    ...campaign,
    players: (campaign.players || []).map((player) => (
      player.id === playerId ? transform(player) : player
    )),
  });
}

function updatePlayerFeatureState(campaignId, playerId, transform) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  return upsertCampaign({
    ...campaign,
    players: (campaign.players || []).map((player) => (
      player.id === playerId ? transform(player) : player
    )),
  });
}

function setPlayerSpellSlotUsage(player = {}, kind = "normal", level = 1, used = 0) {
  const next = {
    ...player,
    spellcasting: {
      ...(player.spellcasting || {}),
      slotUsage: {
        normal: { ...(player.spellcasting?.slotUsage?.normal || {}) },
        pact: Number(player.spellcasting?.slotUsage?.pact) || 0,
      },
    },
  };
  if (kind === "pact") next.spellcasting.slotUsage.pact = Math.max(0, Math.floor(Number(used) || 0));
  else next.spellcasting.slotUsage.normal[level] = Math.max(0, Math.floor(Number(used) || 0));
  return next;
}

function recoverPlayerSpellSlots(player = {}, restType = "long") {
  const next = {
    ...player,
    spellcasting: {
      ...(player.spellcasting || {}),
      slotUsage: {
        normal: { ...(player.spellcasting?.slotUsage?.normal || {}) },
        pact: 0,
      },
    },
  };
  if (restType === "long") next.spellcasting.slotUsage.normal = {};
  return next;
}

function bindCharacterSheetInteractions(campaignId, playerId) {
  const sheet = document.querySelector(".character-sheet-paper");
  if (!sheet) return;
  const selectorModal = sheet.querySelector("#wild-shape-selector-modal");
  const selectorSearch = sheet.querySelector("#wild-shape-selector-search");
  const traitModal = sheet.querySelector("#sheet-trait-modal");
  const traitTitle = sheet.querySelector("#sheet-trait-title");
  const traitDetails = sheet.querySelector("#sheet-trait-details");
  const editModal = sheet.querySelector("#sheet-edit-modal");
  const editForm = sheet.querySelector("#sheet-edit-form");
  const editTitle = sheet.querySelector("#sheet-edit-title");
  const editValue = sheet.querySelector("#sheet-edit-value");
  const equipmentModal = sheet.querySelector("#sheet-equipment-modal");
  const equipmentTitle = sheet.querySelector("#sheet-equipment-title");
  const equipmentType = sheet.querySelector("#sheet-equipment-type");
  const equipmentDetails = sheet.querySelector("#sheet-equipment-details");
  const spellModal = sheet.querySelector("#sheet-spell-modal");
  const spellTitle = sheet.querySelector("#sheet-spell-title");
  const spellLevel = sheet.querySelector("#sheet-spell-level");
  const spellDetails = sheet.querySelector("#sheet-spell-details");
  let activeEditPath = "";

  sheet.querySelector("[data-open-wild-shape-selector]")?.addEventListener("click", () => {
    if (!selectorModal) return;
    selectorModal.hidden = false;
    selectorSearch?.focus();
  });

  sheet.querySelectorAll("[data-close-wild-shape-selector]").forEach((button) => {
    button.addEventListener("click", () => { selectorModal.hidden = true; });
  });

  selectorSearch?.addEventListener("input", () => {
    const query = selectorSearch.value.trim().toLowerCase();
    sheet.querySelectorAll(".wild-shape-selector-card").forEach((card) => {
      card.hidden = Boolean(query) && !card.dataset.searchable.includes(query);
    });
  });

  sheet.querySelectorAll("[data-select-wild-shape]").forEach((button) => {
    button.addEventListener("click", () => {
      const beast = wildShapeBeastById(button.dataset.selectWildShape);
      if (!beast) return;
      updatePlayerWildShapeState(campaignId, playerId, (player) => applyWildShapeOverlay(player, beast));
      renderPlayerCharacterPage(campaignId, playerId);
    });
  });

  sheet.querySelector("[data-revert-wild-shape]")?.addEventListener("click", () => {
    updatePlayerWildShapeState(campaignId, playerId, revertWildShape);
    renderPlayerCharacterPage(campaignId, playerId);
  });

  sheet.querySelector("[data-update-wild-shape-hp]")?.addEventListener("click", () => {
    const hpInput = sheet.querySelector("[data-wild-shape-hp]");
    updatePlayerWildShapeState(campaignId, playerId, (player) => updateWildShapeHitPoints(player, hpInput?.value));
    renderPlayerCharacterPage(campaignId, playerId);
  });

  sheet.querySelectorAll("[data-sheet-trait-index]").forEach((button) => {
    button.addEventListener("click", () => {
      traitTitle.textContent = button.dataset.traitTitle || "Trait";
      traitDetails.textContent = button.dataset.traitDetails || "";
      traitModal.hidden = false;
    });
  });

  sheet.querySelectorAll("[data-close-sheet-trait]").forEach((button) => {
    button.addEventListener("click", () => { traitModal.hidden = true; });
  });

  sheet.querySelectorAll("[data-sheet-equipment-index]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.homebrewItemId) {
        openWidgetDetail("items", button.dataset.homebrewItemId);
        return;
      }
      equipmentTitle.textContent = button.dataset.equipmentTitle || "Equipment";
      equipmentType.textContent = button.dataset.equipmentType || "Equipment";
      equipmentDetails.textContent = button.dataset.equipmentDetails || "No equipment details available.";
      equipmentModal.hidden = false;
    });
  });

  sheet.querySelectorAll("[data-close-sheet-equipment]").forEach((button) => {
    button.addEventListener("click", () => { equipmentModal.hidden = true; });
  });

  sheet.querySelectorAll("[data-sheet-spell-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const spell = spellById(button.dataset.sheetSpellId) || {};
      const meta = spellMetadata(spell);
      spellTitle.textContent = spell.name || "Spell";
      spellLevel.textContent = [meta.levelLabel, spell.school].filter(Boolean).join(" · ") || "Spell";
      spellDetails.innerHTML = spellDetailMarkup(spell);
      spellModal.hidden = false;
    });
  });

  sheet.querySelectorAll("[data-close-sheet-spell]").forEach((button) => {
    button.addEventListener("click", () => { spellModal.hidden = true; });
  });

  sheet.querySelectorAll("[data-spell-slot-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      updatePlayerSpellcastingState(campaignId, playerId, (player) => setPlayerSpellSlotUsage(
        player,
        button.dataset.spellSlotKind,
        button.dataset.spellSlotLevel,
        button.dataset.spellSlotUsed
      ));
      renderPlayerCharacterPage(campaignId, playerId);
    });
  });

  sheet.querySelectorAll("[data-spell-rest]").forEach((button) => {
    button.addEventListener("click", () => {
      updatePlayerSpellcastingState(campaignId, playerId, (player) => recoverPlayerSpellSlots(player, button.dataset.spellRest));
      renderPlayerCharacterPage(campaignId, playerId);
    });
  });

  sheet.querySelectorAll("[data-class-feature-use]").forEach((button) => {
    button.addEventListener("click", () => {
      updatePlayerFeatureState(campaignId, playerId, (player) => setPlayerFeatureUsage(
        player,
        button.dataset.classFeatureUse,
        button.dataset.classFeatureUsed
      ));
      renderPlayerCharacterPage(campaignId, playerId);
    });
  });

  sheet.querySelectorAll("[data-class-feature-rest]").forEach((button) => {
    button.addEventListener("click", () => {
      updatePlayerFeatureState(campaignId, playerId, (player) => recoverPlayerClassFeatures(player, button.dataset.classFeatureRest));
      renderPlayerCharacterPage(campaignId, playerId);
    });
  });

  sheet.querySelectorAll("[data-font-inspiration-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      updatePlayerFeatureState(campaignId, playerId, (player) => recoverBardicInspirationWithSpellSlot(
        player,
        button.dataset.fontInspirationSlot
      ));
      renderPlayerCharacterPage(campaignId, playerId);
    });
  });

  sheet.querySelector("[data-superior-inspiration]")?.addEventListener("click", () => {
    updatePlayerFeatureState(campaignId, playerId, applySuperiorInspiration);
    renderPlayerCharacterPage(campaignId, playerId);
  });

  sheet.querySelectorAll("[data-spend-bardic-inspiration]").forEach((button) => {
    button.addEventListener("click", () => {
      updatePlayerFeatureState(campaignId, playerId, spendBardicInspiration);
      renderPlayerCharacterPage(campaignId, playerId);
    });
  });

  sheet.querySelectorAll("[data-restore-feature-with-inspiration]").forEach((button) => {
    button.addEventListener("click", () => {
      updatePlayerFeatureState(campaignId, playerId, (player) => restoreClassFeatureWithBardicInspiration(
        player,
        button.dataset.restoreFeatureWithInspiration
      ));
      renderPlayerCharacterPage(campaignId, playerId);
    });
  });

  sheet.querySelectorAll("[data-edit-sheet-field]").forEach((button) => {
    button.addEventListener("click", () => {
      const campaign = getCampaign(campaignId);
      const player = (campaign?.players || []).find((item) => item.id === playerId);
      activeEditPath = button.dataset.editSheetField || "";
      editTitle.textContent = button.closest(".sheet-box")?.querySelector("h3 span")?.textContent || "Sheet widget";
      editValue.value = playerSheetFieldValue(player || {}, activeEditPath);
      editModal.hidden = false;
      editValue.focus();
    });
  });

  sheet.querySelectorAll("[data-close-sheet-edit]").forEach((button) => {
    button.addEventListener("click", () => { editModal.hidden = true; });
  });

  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activeEditPath) return;
    updatePlayerSheetField(campaignId, playerId, activeEditPath, editValue.value.trim());
    renderPlayerCharacterPage(campaignId, playerId);
  });
}

function bindPlayerSpellbookInteractions() {
  const page = document.querySelector(".character-spellbook-page");
  if (!page) return;
  const spellModal = page.querySelector("#sheet-spell-modal");
  const spellTitle = page.querySelector("#sheet-spell-title");
  const spellLevel = page.querySelector("#sheet-spell-level");
  const spellDetails = page.querySelector("#sheet-spell-details");

  page.querySelectorAll("[data-sheet-spell-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const spell = spellById(button.dataset.sheetSpellId) || {};
      const meta = spellMetadata(spell);
      spellTitle.textContent = spell.name || "Spell";
      spellLevel.textContent = [meta.levelLabel, spell.school].filter(Boolean).join(" · ") || "Spell";
      spellDetails.innerHTML = spellDetailMarkup(spell);
      spellModal.hidden = false;
    });
  });

  page.querySelectorAll("[data-close-sheet-spell]").forEach((button) => {
    button.addEventListener("click", () => { spellModal.hidden = true; });
  });
}

function levelUpSummaryCard(label, value, detail = "") {
  return `
    <article class="level-up-summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>`;
}

function levelUpClassSelectMarkup(player = {}) {
  const preview = levelUpPreviewForPlayer(player);
  return `
    <label>Class gaining this level
      <select id="level-up-class" name="className">
        ${levelUpClassLevelOptions(player).map((option) => {
          const label = option.existingLevel
            ? `${option.className} - currently level ${option.existingLevel}`
            : `${option.className} - new multiclass`;
          return `<option value="${escapeHtml(option.className)}" ${normalizeRulesText(option.className) === normalizeRulesText(preview.selectedClass) ? "selected" : ""}>${escapeHtml(label)}</option>`;
        }).join("")}
      </select>
    </label>`;
}

function levelUpAbilityInputsMarkup(player = {}) {
  return `
    <div class="level-up-ability-grid">
      ${ABILITIES.map((ability) => `
        <label>
          <span>${escapeHtml(ability.short)} <small>${escapeHtml(abilityScore(player, ability.key) || 0)}</small></span>
          <input type="number" min="0" max="2" step="1" value="0" id="level-up-ability-${escapeHtml(ability.key)}" name="ability-${escapeHtml(ability.key)}" />
        </label>`).join("")}
    </div>`;
}

function levelUpPreviewMarkup(player = {}, selectedClass = "", selectedBardSubclass = "") {
  const preview = levelUpPreviewForPlayer(player, selectedClass);
  const slots = spellSlotSummaryParts(preview.nextSpellcasting).join(", ") || "No spell slots";
  const spellGuidance = preview.nextSpellcasting?.guidance?.join(" | ") || "No class spellcasting at this level.";
  const currentBardLevel = bardLevelForClassLevels(preview.currentClassLevels);
  const nextBardLevel = bardLevelForClassLevels(preview.nextClassLevels);
  const selectedSubclass = bardSubclassById(selectedBardSubclass || player.subclasses?.Bard || player.subclasses?.bard);
  const unlocks = nextBardLevel > currentBardLevel
    ? bardFeaturesUnlockedBetween(currentBardLevel, nextBardLevel, selectedSubclass?.id)
    : [];
  return `
    <div class="level-up-summary-grid" id="level-up-preview">
      ${levelUpSummaryCard("Level", `${preview.currentLevel} -> ${preview.nextLevel}`, classLevelSummary(preview.nextClassLevels))}
      ${levelUpSummaryCard("Proficiency", `${signedModifier(preview.currentProficiencyBonus)} -> ${signedModifier(preview.nextProficiencyBonus)}`, "Based on total character level")}
      ${levelUpSummaryCard("Hit Die", `d${preview.hitDieSides}`, `${preview.selectedClass} level gained`)}
      ${levelUpSummaryCard("Hit Dice", preview.nextHitDice, "After this level")}
      ${levelUpSummaryCard("Fixed HP", `+${preview.fixedHitPoints}`, "Class average plus current CON modifier")}
      ${levelUpSummaryCard("Spell slots", slots, spellGuidance)}
      ${levelUpSummaryCard("New Features", unlocks.length ? unlocks.join(", ") : "None", nextBardLevel >= 3 && !selectedSubclass ? "Choose a Bard College below to preview subclass features." : "")}
    </div>`;
}

function levelUpBardSubclassMarkup(player = {}, preview = levelUpPreviewForPlayer(player)) {
  const currentBardLevel = bardLevelForPlayer(player);
  const nextBardLevel = bardLevelForClassLevels(preview.nextClassLevels);
  if (currentBardLevel < 2 || bardSubclassIdForPlayer(player)) return "";
  return `
    <fieldset class="level-up-panel full-width" id="level-up-bard-subclass-panel" ${nextBardLevel >= 3 ? "" : "hidden"}>
      <legend>Bard College</legend>
      ${bardSubclassSelectMarkup({ id: "level-up-bard-subclass", required: true })}
      <p class="level-up-help" id="level-up-bard-subclass-summary">Choose the Bard College unlocked at Bard level 3.</p>
    </fieldset>`;
}

function levelUpBardFeatureChoicesMarkup(player = {}, preview = levelUpPreviewForPlayer(player), selectedBardSubclass = "") {
  const currentBardLevel = bardLevelForPlayer(player);
  const nextBardLevel = bardLevelForClassLevels(preview.nextClassLevels);
  if (nextBardLevel <= currentBardLevel || !nextBardLevel) return "";
  const subclassId = selectedBardSubclass || bardSubclassIdForPlayer(player);
  const markup = bardFeatureChoicesMarkup({
    prefix: "level-up",
    bardLevel: nextBardLevel,
    minimumLevel: currentBardLevel,
    subclassId,
    skillProficiencies: player.skillProficiencies || [],
    selected: bardChoicesForPlayer(player),
  });
  if (!markup) return "";
  return `
    <fieldset class="level-up-panel full-width" id="level-up-bard-feature-choice-panel">
      <legend>Bard choices unlocked now</legend>
      <div class="class-feature-choice-list">${markup}</div>
    </fieldset>`;
}

function playerLevelUpMarkup(player = {}, campaignId = DEFAULT_CAMPAIGN_ID) {
  const preview = levelUpPreviewForPlayer(player);
  if (preview.currentLevel >= 20) {
    return `
      <section class="level-up-panel sheet-box">
        <h3><span>Level Cap</span><small>20 / 20</small></h3>
        <div class="empty-state">This character is already level 20.</div>
        <a class="btn btn-secondary" href="${escapeHtml(playerCharacterHref(campaignId, player.id || ""))}">Back to character sheet</a>
      </section>`;
  }
  return `
    <form class="level-up-form" id="level-up-form">
      <section class="level-up-panel sheet-box">
        <h3><span>Advancement Preview</span><small>XP ignored</small></h3>
        ${levelUpPreviewMarkup(player)}
      </section>

      <section class="level-up-grid">
        <fieldset class="level-up-panel">
          <legend>Class Level</legend>
          ${levelUpClassSelectMarkup(player)}
          <p class="level-up-help">Advancing a new class uses multiclass rules and will be validated against ability prerequisites before saving.</p>
        </fieldset>

        <fieldset class="level-up-panel">
          <legend>Hit Points</legend>
          <div class="level-up-hp-row">
            <label>HP gained
              <input type="number" min="1" step="1" id="level-up-hp-gain" name="hitPointGain" value="${escapeHtml(preview.fixedHitPoints)}" />
            </label>
            <button class="btn btn-secondary" type="button" id="level-up-roll-hp">Roll d${escapeHtml(preview.hitDieSides)}</button>
          </div>
          <p class="level-up-help">Default is the fixed class average plus current Constitution modifier. If Constitution increases below, the retroactive HP adjustment is added automatically.</p>
        </fieldset>

        ${levelUpBardSubclassMarkup(player, preview)}
        ${levelUpBardFeatureChoicesMarkup(player, preview)}

        <fieldset class="level-up-panel full-width" id="level-up-asi-panel">
          <legend>Ability Score Increase</legend>
          ${levelUpAbilityInputsMarkup(player)}
          <p class="level-up-help">Use these fields for an ASI gained at this level. Scores are capped at 20.</p>
        </fieldset>

        <fieldset class="level-up-panel full-width">
          <legend>Features and Notes</legend>
          <textarea id="level-up-notes" name="notes" rows="5" placeholder="Subclass feature, feat choice, spell changes, class feature reminders..."></textarea>
        </fieldset>
      </section>

      <div class="form-message" id="level-up-message" aria-live="polite"></div>
      <div class="setup-actions">
        <a class="btn btn-secondary" href="${escapeHtml(playerCharacterHref(campaignId, player.id || ""))}">Cancel</a>
        <button class="btn btn-primary" type="submit">Apply level up</button>
      </div>
    </form>`;
}

function levelUpPayloadFromForm(form) {
  return {
    className: formValue(form, "#level-up-class"),
    hitPointGain: numberFormValue(form, "#level-up-hp-gain"),
    notes: formValue(form, "#level-up-notes"),
    bardSubclass: formValue(form, "#level-up-bard-subclass"),
    bardChoices: bardChoicesFromLevelUpForm(form),
    abilityDeltas: Object.fromEntries(ABILITIES.map((ability) => [ability.key, numberFormValue(form, `#level-up-ability-${ability.key}`) || 0])),
  };
}

function bindPlayerLevelUpInteractions(campaignId, playerId, player) {
  const form = document.getElementById("level-up-form");
  if (!form) return;
  const classSelect = form.querySelector("#level-up-class");
  const bardSubclassPanel = form.querySelector("#level-up-bard-subclass-panel");
  const bardSubclassSelect = form.querySelector("#level-up-bard-subclass");
  const bardSubclassSummary = form.querySelector("#level-up-bard-subclass-summary");
  const hpInput = form.querySelector("#level-up-hp-gain");
  const rollButton = form.querySelector("#level-up-roll-hp");
  const message = form.querySelector("#level-up-message");

  const refreshPreview = () => {
    const preview = levelUpPreviewForPlayer(player, classSelect?.value);
    const previewContainer = form.querySelector("#level-up-preview");
    if (previewContainer) previewContainer.outerHTML = levelUpPreviewMarkup(player, classSelect?.value, bardSubclassSelect?.value);
    const nextChoiceMarkup = levelUpBardFeatureChoicesMarkup(player, preview, bardSubclassSelect?.value);
    const featureChoicePanel = form.querySelector("#level-up-bard-feature-choice-panel");
    const asiPanel = form.querySelector("#level-up-asi-panel");
    if (featureChoicePanel) {
      if (nextChoiceMarkup) featureChoicePanel.outerHTML = nextChoiceMarkup;
      else featureChoicePanel.remove();
    } else if (nextChoiceMarkup && asiPanel) {
      asiPanel.insertAdjacentHTML("beforebegin", nextChoiceMarkup);
    }
    if (hpInput && hpInput.dataset.touched !== "true") hpInput.value = String(preview.fixedHitPoints);
    if (rollButton) rollButton.textContent = `Roll d${preview.hitDieSides}`;
    const requiresBardSubclass = bardSubclassRequiredForClassLevels(preview.nextClassLevels) && !bardSubclassIdForPlayer(player);
    if (bardSubclassPanel) bardSubclassPanel.hidden = !requiresBardSubclass;
    if (bardSubclassSelect) bardSubclassSelect.required = requiresBardSubclass;
    if (bardSubclassSummary) {
      bardSubclassSummary.textContent = bardSubclassChoiceSummary(bardSubclassSelect?.value || "");
    }
  };

  classSelect?.addEventListener("change", () => {
    if (hpInput) hpInput.dataset.touched = "";
    refreshPreview();
  });
  hpInput?.addEventListener("input", () => { hpInput.dataset.touched = "true"; });
  bardSubclassSelect?.addEventListener("change", refreshPreview);
  rollButton?.addEventListener("click", () => {
    const preview = levelUpPreviewForPlayer(player, classSelect?.value);
    const roll = Math.floor(Math.random() * preview.hitDieSides) + 1;
    if (hpInput) {
      hpInput.value = String(Math.max(1, roll + abilityModifier(player.abilities?.constitution)));
      hpInput.dataset.touched = "true";
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = applyPlayerLevelUp(player, levelUpPayloadFromForm(form));
    if (result.errors?.length) {
      if (message) message.textContent = result.errors.join(" ");
      return;
    }
    updatePlayerInCampaign(campaignId, playerId, () => result.player);
    window.location.href = playerCharacterHref(campaignId, playerId);
  });
}

function renderPlayerCharacterPage(campaignId, playerId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) {
    renderNotFoundPage("The requested campaign does not exist in local storage.");
    return;
  }
  const player = (campaign.players || []).find((item) => item.id === playerId);
  if (!player) {
    renderNotFoundPage("That player character is not saved in this campaign.");
    return;
  }
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell character-page">
      <div class="page-hero character-hero">
        <div>
          <p class="eyebrow">Player character</p>
          <h1>${escapeHtml(player.characterName)}</h1>
          <p>Played by ${escapeHtml(player.playerName)} in ${escapeHtml(campaign.name)}.</p>
          <button class="btn btn-secondary" type="button" id="back-to-dashboard-button">Back to campaign dashboard</button>
        </div>
        ${player.avatarUrl ? `<img class="character-avatar" src="${escapeHtml(player.avatarUrl)}" alt="${escapeHtml(player.characterName)} avatar" />` : `<div class="card-visual character-avatar-placeholder" aria-hidden="true"><span>${cardVisualLabel(player.characterName)}</span></div>`}
      </div>
      ${characterSheetMarkup(player, { campaignId, playerId })}
    </section>`;
  document.getElementById("back-to-dashboard-button").addEventListener("click", goToDashboard);
  bindCharacterSheetInteractions(campaignId, playerId);
}

function renderPlayerSpellbookPage(campaignId, playerId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) {
    renderNotFoundPage("The requested campaign does not exist in local storage.");
    return;
  }
  const player = (campaign.players || []).find((item) => item.id === playerId);
  if (!player) {
    renderNotFoundPage("That player character is not saved in this campaign.");
    return;
  }
  const runtime = spellcastingRuntimeForPlayer(player);
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell character-page character-spellbook-page">
      <div class="page-hero character-hero">
        <div>
          <p class="eyebrow">Spellbook</p>
          <h1>${escapeHtml(player.characterName)} Spells</h1>
          <p>${escapeHtml(runtime?.spells.length || 0)} chosen spell widgets in ${escapeHtml(campaign.name)}.</p>
          <a class="btn btn-secondary" href="${escapeHtml(playerCharacterHref(campaignId, playerId))}">Back to character sheet</a>
        </div>
        ${player.avatarUrl ? `<img class="character-avatar" src="${escapeHtml(player.avatarUrl)}" alt="${escapeHtml(player.characterName)} avatar" />` : `<div class="card-visual character-avatar-placeholder" aria-hidden="true"><span>${cardVisualLabel(player.characterName)}</span></div>`}
      </div>
      ${playerSpellbookMarkup(player)}
      <div class="sheet-modal" id="sheet-spell-modal" hidden>
        <button class="sheet-modal-backdrop" type="button" data-close-sheet-spell aria-label="Close spell details"></button>
        <article class="sheet-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="sheet-spell-title">
          <button class="sheet-modal-close" type="button" data-close-sheet-spell aria-label="Close">&times;</button>
          <p class="eyebrow" id="sheet-spell-level">Spell</p>
          <h2 id="sheet-spell-title"></h2>
          <div id="sheet-spell-details"></div>
        </article>
      </div>
    </section>`;
  bindPlayerSpellbookInteractions();
}

function renderPlayerLevelUpPage(campaignId, playerId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) {
    renderNotFoundPage("The requested campaign does not exist in local storage.");
    return;
  }
  const player = (campaign.players || []).find((item) => item.id === playerId);
  if (!player) {
    renderNotFoundPage("That player character is not saved in this campaign.");
    return;
  }
  const preview = levelUpPreviewForPlayer(player);
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell character-page character-level-up-page">
      <div class="page-hero character-hero">
        <div>
          <p class="eyebrow">Character advancement</p>
          <h1>Level Up ${escapeHtml(player.characterName || playerDisplayName(player))}</h1>
          <p>${escapeHtml(classLevelSummary(preview.currentClassLevels) || player.classRole || "Adventurer")} in ${escapeHtml(campaign.name)}. Experience points are not used in this flow.</p>
          <a class="btn btn-secondary" href="${escapeHtml(playerCharacterHref(campaignId, playerId))}">Back to character sheet</a>
        </div>
        ${player.avatarUrl ? `<img class="character-avatar" src="${escapeHtml(player.avatarUrl)}" alt="${escapeHtml(player.characterName)} avatar" />` : `<div class="card-visual character-avatar-placeholder" aria-hidden="true"><span>${cardVisualLabel(player.characterName)}</span></div>`}
      </div>
      ${playerLevelUpMarkup(player, campaignId)}
    </section>`;
  bindPlayerLevelUpInteractions(campaignId, playerId, player);
}

function initCampaignRoutes() {
  const parts = routeParts();
  if (parts[0] !== "campaigns") return false;
  updateTopNavActivePage("dashboard");
  const campaignId = parts[1] || DEFAULT_CAMPAIGN_ID;
  if (!setActiveCampaign(campaignId)) {
    renderNotFoundPage("The requested campaign does not exist in local storage.");
    return true;
  }
  if (parts[2] === "dashboard") {
    if (document.querySelector(".campaign-library-page")) {
      window.location.reload();
      return true;
    }
    return false;
  }
  if (parts[2] === "setup") {
    renderCampaignSetupPage(campaignId);
    return true;
  }
  if (parts[2] === "start-note") {
    renderCampaignStartNotePage(campaignId);
    return true;
  }
  if (parts[2] === "players" && parts[3] && parts[4] === "spells") {
    renderPlayerSpellbookPage(campaignId, parts[3]);
    return true;
  }
  if (parts[2] === "players" && parts[3] && parts[4] === "level-up") {
    renderPlayerLevelUpPage(campaignId, parts[3]);
    return true;
  }
  if (parts[2] === "players" && parts[3]) {
    renderPlayerCharacterPage(campaignId, parts[3]);
    return true;
  }
  renderNotFoundPage("This campaign route is not available yet.");
  return true;
}

const WONDROUS_ITEM_RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Unique", "???"];

function wondrousItemCollection() {
  return Array.isArray(globalThis.DNDUCKS_WONDROUS_ITEMS) ? globalThis.DNDUCKS_WONDROUS_ITEMS : [];
}

function wondrousItemSearchText(item = {}) {
  return textForSearch([
    item.name,
    item.category,
    item.rarity,
    item.sourceCode,
    item.source,
    item.attunement,
    item.cost,
    item.summary,
    item.description,
  ]);
}

function wondrousItemCardSearchText(item = {}) {
  return textForSearch([
    item.name,
    item.category,
    item.rarity,
    item.sourceCode,
    item.source,
    item.attunement,
    item.cost,
    item.summary,
  ]);
}

function wondrousItemRarities() {
  const rarities = [...new Set(wondrousItemCollection().map((item) => item.rarity).filter(Boolean))];
  return rarities.sort((left, right) => {
    const leftIndex = WONDROUS_ITEM_RARITY_ORDER.indexOf(left);
    const rightIndex = WONDROUS_ITEM_RARITY_ORDER.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    return left.localeCompare(right);
  });
}

function wondrousItemCostMatches(item = {}, filter = "") {
  if (!filter) return true;
  const min = Number(item.costMin);
  const max = Number(item.costMax);
  if (filter === "unlisted") return !Number.isFinite(min);
  if (!Number.isFinite(min)) return false;
  if (filter === "under-500") return min <= 500;
  if (filter === "501-5000") return min >= 501 && min <= 5000;
  if (filter === "5001-plus") return min >= 5001 || (Number.isFinite(max) && max >= 5001);
  return true;
}

function filteredWondrousItems() {
  const query = document.getElementById("wondrous-item-search")?.value.trim().toLowerCase() || "";
  const rarity = document.getElementById("wondrous-item-rarity-filter")?.value || "";
  const attunement = document.getElementById("wondrous-item-attunement-filter")?.value || "";
  const cost = document.getElementById("wondrous-item-cost-filter")?.value || "";
  const category = document.getElementById("wondrous-item-category-filter")?.value || "";
  return wondrousItemCollection().filter((item) => {
    const queryMatches = !query || wondrousItemSearchText(item).includes(query);
    const rarityMatches = !rarity || item.rarity === rarity;
    const attunementMatches = !attunement || (attunement === "required" ? item.attunementRequired : !item.attunementRequired);
    const costMatches = wondrousItemCostMatches(item, cost);
    const categoryMatches = !category || item.category === category;
    return queryMatches && rarityMatches && attunementMatches && costMatches && categoryMatches;
  });
}

function wondrousItemRarityBadge(item = {}) {
  const rarityClass = normalizeRulesText(item.rarity || "unknown").replace(/\s+/g, "-") || "unknown";
  return `<span class="status-badge item-rarity-badge is-${escapeHtml(rarityClass)}">${escapeHtml(item.rarity || "Unknown")}</span>`;
}

function wondrousItemCostBadge(item = {}) {
  return `<span class="item-cost-badge ${item.costEstimated ? "is-estimated" : ""}">${escapeHtml(item.cost || "Cost not listed")}</span>`;
}

function wondrousItemCostBasis(item = {}) {
  if (item.costEstimated) return "Estimated";
  if (!item.cost || item.cost === "Cost not listed") return "Unlisted";
  return "Exact";
}

function wondrousItemCardMarkup(item = {}) {
  return `
    <button class="content-card wondrous-item-card" type="button" data-wondrous-item-id="${escapeHtml(item.id)}" data-searchable="${escapeHtml(wondrousItemCardSearchText(item))}">
      <span class="spell-card-topline">
        ${wondrousItemRarityBadge(item)}
        <span>${escapeHtml(item.category || "Wondrous Item")}</span>
      </span>
      <strong>${escapeHtml(item.name)}</strong>
      <span class="spell-class-tags item-badge-row" aria-label="Item metadata">
        <span>${escapeHtml(item.attunementRequired ? "Attunement" : "No attunement")}</span>
        <span>${escapeHtml(item.sourceCode || item.source || "Source")}</span>
      </span>
      <span class="spell-card-summary">${escapeHtml(item.summary || "No summary available.")}</span>
      <span class="spell-card-meta">
        ${wondrousItemCostBadge(item)}
        <span>${escapeHtml(wondrousItemCostBasis(item))}</span>
      </span>
    </button>`;
}

function renderWondrousItemTabs() {
  const tabs = document.getElementById("wondrous-item-rarity-tabs");
  if (!tabs) return;
  const currentRarity = document.getElementById("wondrous-item-rarity-filter")?.value || "";
  const allCount = wondrousItemCollection().length;
  tabs.innerHTML = [
    `<button class="chip-button ${currentRarity === "" ? "is-active" : ""}" type="button" data-wondrous-item-rarity-tab="">All <span>${allCount}</span></button>`,
    ...wondrousItemRarities().map((rarity) => {
      const count = wondrousItemCollection().filter((item) => item.rarity === rarity).length;
      return `<button class="chip-button ${currentRarity === rarity ? "is-active" : ""}" type="button" data-wondrous-item-rarity-tab="${escapeHtml(rarity)}">${escapeHtml(rarity)} <span>${count}</span></button>`;
    }),
  ].join("");
  tabs.querySelectorAll("[data-wondrous-item-rarity-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = document.getElementById("wondrous-item-rarity-filter");
      if (filter) filter.value = button.dataset.wondrousItemRarityTab || "";
      renderWondrousItems();
    });
  });
}

function populateWondrousItemFilters() {
  const rarityFilter = document.getElementById("wondrous-item-rarity-filter");
  const categoryFilter = document.getElementById("wondrous-item-category-filter");
  if (rarityFilter && rarityFilter.options.length <= 1) {
    rarityFilter.insertAdjacentHTML("beforeend", wondrousItemRarities().map((rarity) => `<option value="${escapeHtml(rarity)}">${escapeHtml(rarity)}</option>`).join(""));
  }
  if (categoryFilter && categoryFilter.options.length <= 1) {
    const categories = [...new Set(wondrousItemCollection().map((item) => item.category).filter(Boolean))].sort();
    categoryFilter.insertAdjacentHTML("beforeend", categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join(""));
  }
}

function renderWondrousItems() {
  const list = document.getElementById("wondrous-item-list");
  const title = document.getElementById("wondrous-item-results-title");
  const count = document.getElementById("wondrous-item-results-count");
  if (!list) return;

  const items = filteredWondrousItems();
  const rarity = document.getElementById("wondrous-item-rarity-filter")?.value || "";
  const attunement = document.getElementById("wondrous-item-attunement-filter")?.value || "";
  const cost = document.getElementById("wondrous-item-cost-filter")?.value || "";
  if (title) {
    title.textContent = [
      rarity || "All Wondrous Items",
      attunement === "required" ? "Requires attunement" : attunement === "none" ? "No attunement" : "",
      cost ? "Filtered by cost" : "",
    ].filter(Boolean).join(" - ");
  }
  if (count) count.textContent = `${items.length} of ${wondrousItemCollection().length} item widgets`;
  list.innerHTML = items.length
    ? items.map(wondrousItemCardMarkup).join("")
    : `<div class="empty-state">No Wondrous Items match the current filters.</div>`;
  list.querySelectorAll("[data-wondrous-item-id]").forEach((button) => {
    button.addEventListener("click", () => openWondrousItemDetail(button.dataset.wondrousItemId));
  });
  renderWondrousItemTabs();
}

function wondrousItemDetailRows(item = {}) {
  return [
    ["Rarity", item.rarity],
    ["Category", item.category],
    ["Cost", item.cost],
    ["Cost basis", item.costEstimated ? "Estimated by rarity" : wondrousItemCostBasis(item)],
    ["Attunement", item.attunement],
    ["Source", item.sourceCode ? `${item.source} (${item.sourceCode})` : item.source],
  ].map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || "Unknown")}</dd>
    </div>`).join("");
}

function openWondrousItemDetail(itemId) {
  const item = wondrousItemCollection().find((entry) => entry.id === itemId);
  const modal = document.getElementById("wondrous-item-detail-modal");
  const body = document.getElementById("wondrous-item-detail-body");
  if (!item || !modal || !body) return;
  body.innerHTML = `
    <div class="card-kicker">
      ${wondrousItemRarityBadge(item)}
      <span>${escapeHtml(item.category || "Wondrous Item")}</span>
    </div>
    <h2 id="wondrous-item-detail-title">${escapeHtml(item.name)}</h2>
    <dl class="widget-detail-meta spell-detail-meta">${wondrousItemDetailRows(item)}</dl>
    <section class="widget-detail-section">
      <h3>Description</h3>
      <p>${escapeHtml(item.description || item.summary || "No item description available.")}</p>
    </section>
    <div class="tag-row spell-detail-actions">
      <a class="btn btn-secondary" href="${escapeHtml(item.sourceUrl || "https://dnd5e.wikidot.com/wondrous-items")}" target="_blank" rel="noreferrer">Open Source Page</a>
    </div>`;
  modal.hidden = false;
  document.body.classList.add("spell-detail-open");
  modal.querySelector("[data-close-wondrous-item-modal]")?.focus();
}

function initWondrousItemsPage() {
  const list = document.getElementById("wondrous-item-list");
  if (!list) return;
  updateTopNavActivePage("items");
  populateWondrousItemFilters();
  renderWondrousItemTabs();
  renderWondrousItems();

  ["wondrous-item-search", "wondrous-item-rarity-filter", "wondrous-item-attunement-filter", "wondrous-item-cost-filter", "wondrous-item-category-filter"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", renderWondrousItems);
    document.getElementById(id)?.addEventListener("change", renderWondrousItems);
  });

  document.getElementById("wondrous-item-clear-filters")?.addEventListener("click", () => {
    ["wondrous-item-search", "wondrous-item-rarity-filter", "wondrous-item-attunement-filter", "wondrous-item-cost-filter", "wondrous-item-category-filter"].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.value = "";
    });
    renderWondrousItems();
  });

  const modal = document.getElementById("wondrous-item-detail-modal");
  if (modal) {
    const close = () => {
      modal.hidden = true;
      document.body.classList.remove("spell-detail-open");
    };
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-close-wondrous-item-modal]")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) close();
    });
  }
}

const SPELL_LEVEL_LABELS = ["Cantrip", "1st Level", "2nd Level", "3rd Level", "4th Level", "5th Level", "6th Level", "7th Level", "8th Level", "9th Level"];

function spellCollection() {
  return Array.isArray(globalThis.DNDUCKS_SPELLS) ? globalThis.DNDUCKS_SPELLS : [];
}

function spellLevelLabel(level) {
  return SPELL_LEVEL_LABELS[Number(level)] || `${level}th Level`;
}

function spellClasses(spell) {
  return Array.isArray(spell.classes) ? spell.classes.filter(Boolean) : [];
}

function spellSearchText(spell) {
  return textForSearch([
    spell.name,
    spell.levelName,
    spell.school,
    ...spellClasses(spell),
    spell.castingTime,
    spell.range,
    spell.duration,
    spell.components,
    spell.description,
  ]);
}

function spellCardMarkup(spell) {
  const searchable = spellSearchText(spell);
  const concentration = /concentration/i.test(spell.duration || "");
  const classes = spellClasses(spell);
  const classPreview = classes.slice(0, 3);
  const hiddenClassCount = Math.max(0, classes.length - classPreview.length);
  return `
    <button class="content-card spell-card" type="button" data-spell-id="${escapeHtml(spell.id)}" data-searchable="${escapeHtml(searchable)}">
      <span class="spell-card-topline">
        <span class="status-badge status-prepared">${escapeHtml(spell.levelName || spellLevelLabel(spell.level))}</span>
        <span>${escapeHtml(spell.school)}</span>
      </span>
      <strong>${escapeHtml(spell.name)}</strong>
      ${classes.length ? `
        <span class="spell-class-tags" aria-label="Spell classes">
          ${classPreview.map((className) => `<span>${escapeHtml(className)}</span>`).join("")}
          ${hiddenClassCount ? `<span>+${hiddenClassCount}</span>` : ""}
        </span>` : ""}
      <span class="spell-card-summary">${escapeHtml(spell.description)}</span>
      <span class="spell-card-meta">
        <span>${escapeHtml(spell.castingTime)}</span>
        <span>${escapeHtml(spell.range)}</span>
        <span>${escapeHtml(spell.components)}</span>
        ${concentration ? "<span>Concentration</span>" : ""}
      </span>
    </button>`;
}

function filteredSpells() {
  const query = document.getElementById("spell-search")?.value.trim().toLowerCase() || "";
  const school = document.getElementById("spell-school-filter")?.value || "";
  const spellClass = document.getElementById("spell-class-filter")?.value || "";
  const level = document.getElementById("spell-level-filter")?.value || "";
  return spellCollection().filter((spell) => {
    const schoolMatches = !school || spell.school === school;
    const classMatches = !spellClass || spellClasses(spell).includes(spellClass);
    const levelMatches = level === "" || String(spell.level) === level;
    const queryMatches = !query || spellSearchText(spell).includes(query);
    return schoolMatches && classMatches && levelMatches && queryMatches;
  });
}

function renderSpellTabs() {
  const tabs = document.getElementById("spell-level-tabs");
  if (!tabs) return;
  const currentLevel = document.getElementById("spell-level-filter")?.value || "";
  const allCount = spellCollection().length;
  tabs.innerHTML = [
    `<button class="chip-button ${currentLevel === "" ? "is-active" : ""}" type="button" data-spell-tab="">All <span>${allCount}</span></button>`,
    ...SPELL_LEVEL_LABELS.map((label, level) => {
      const count = spellCollection().filter((spell) => Number(spell.level) === level).length;
      return `<button class="chip-button ${currentLevel === String(level) ? "is-active" : ""}" type="button" data-spell-tab="${level}">${escapeHtml(label)} <span>${count}</span></button>`;
    }),
  ].join("");

  tabs.querySelectorAll("[data-spell-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const levelFilter = document.getElementById("spell-level-filter");
      if (levelFilter) levelFilter.value = button.dataset.spellTab || "";
      renderSpells();
    });
  });
}

function populateSpellFilters() {
  const schoolFilter = document.getElementById("spell-school-filter");
  const classFilter = document.getElementById("spell-class-filter");
  const levelFilter = document.getElementById("spell-level-filter");
  const schools = [...new Set(spellCollection().map((spell) => spell.school).filter(Boolean))].sort();
  const classes = [...new Set(spellCollection().flatMap(spellClasses))].sort();
  if (schoolFilter && schoolFilter.options.length <= 1) {
    schoolFilter.insertAdjacentHTML("beforeend", schools.map((school) => `<option value="${escapeHtml(school)}">${escapeHtml(school)}</option>`).join(""));
  }
  if (classFilter && classFilter.options.length <= 1) {
    classFilter.insertAdjacentHTML("beforeend", classes.map((className) => `<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`).join(""));
  }
  if (levelFilter && levelFilter.options.length <= 1) {
    levelFilter.insertAdjacentHTML("beforeend", SPELL_LEVEL_LABELS.map((label, level) => `<option value="${level}">${escapeHtml(label)}</option>`).join(""));
  }
}

function renderSpells() {
  const list = document.getElementById("spell-list");
  const title = document.getElementById("spell-results-title");
  const count = document.getElementById("spell-results-count");
  if (!list) return;

  const spells = filteredSpells();
  const level = document.getElementById("spell-level-filter")?.value || "";
  const school = document.getElementById("spell-school-filter")?.value || "";
  const spellClass = document.getElementById("spell-class-filter")?.value || "";
  if (title) {
    const titleParts = [
      level === "" ? "All spells" : spellLevelLabel(level),
      spellClass || "",
      school ? `${school} magic` : "",
    ].filter(Boolean);
    title.textContent = titleParts.join(" - ");
  }
  if (count) count.textContent = `${spells.length} of ${spellCollection().length} spell widgets`;

  list.innerHTML = spells.length
    ? spells.map(spellCardMarkup).join("")
    : `<div class="empty-state">No spell widgets match the current filters.</div>`;
  list.querySelectorAll("[data-spell-id]").forEach((button) => {
    button.addEventListener("click", () => openSpellDetail(button.dataset.spellId));
  });
  renderSpellTabs();
}

function spellDetailRows(spell) {
  return [
    ["Level", spell.levelName || spellLevelLabel(spell.level)],
    ["School", spell.school],
    ["Classes", spellClasses(spell).join(", ")],
    ["Casting time", spell.castingTime],
    ["Range", spell.range],
    ["Duration", spell.duration],
    ["Components", spell.components],
  ].map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || "Unknown")}</dd>
    </div>`).join("");
}

function openSpellDetail(spellId) {
  const spell = spellCollection().find((item) => item.id === spellId);
  const modal = document.getElementById("spell-detail-modal");
  const body = document.getElementById("spell-detail-body");
  if (!spell || !modal || !body) return;

  body.innerHTML = `
    <div class="card-kicker">
      <span class="status-badge status-prepared">${escapeHtml(spell.levelName || spellLevelLabel(spell.level))}</span>
      <span>${escapeHtml(spell.school)}</span>
    </div>
    <h2 id="spell-detail-title">${escapeHtml(spell.name)}</h2>
    <dl class="widget-detail-meta spell-detail-meta">${spellDetailRows(spell)}</dl>
    <section class="widget-detail-section">
      <h3>Summary</h3>
      <p>${escapeHtml(spell.description)}</p>
    </section>
    <div class="tag-row spell-detail-actions">
      <a class="btn btn-secondary" href="${escapeHtml(spell.sourceUrl)}" target="_blank" rel="noreferrer">Open Source Page</a>
    </div>`;
  modal.hidden = false;
  document.body.classList.add("spell-detail-open");
  modal.querySelector("[data-close-spell-modal]")?.focus();
}

function initSpellsPage() {
  const list = document.getElementById("spell-list");
  if (!list) return;
  updateTopNavActivePage("spells");
  populateSpellFilters();
  renderSpellTabs();
  renderSpells();

  ["spell-search", "spell-school-filter", "spell-class-filter", "spell-level-filter"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", renderSpells);
    document.getElementById(id)?.addEventListener("change", renderSpells);
  });

  document.getElementById("spell-clear-filters")?.addEventListener("click", () => {
    const search = document.getElementById("spell-search");
    const school = document.getElementById("spell-school-filter");
    const spellClass = document.getElementById("spell-class-filter");
    const level = document.getElementById("spell-level-filter");
    if (search) search.value = "";
    if (school) school.value = "";
    if (spellClass) spellClass.value = "";
    if (level) level.value = "";
    renderSpells();
  });

  const modal = document.getElementById("spell-detail-modal");
  if (modal) {
    const close = () => {
      modal.hidden = true;
      document.body.classList.remove("spell-detail-open");
    };
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-close-spell-modal]")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) close();
    });
  }
}

function beastShapeCollection() {
  return Array.isArray(globalThis.DNDUCKS_BEAST_SHAPES) ? globalThis.DNDUCKS_BEAST_SHAPES : [];
}

const BEAST_TRAIT_DESCRIPTIONS = {
  "aether scent": "The beast can track creatures by unusual scent traces that ordinary beasts would miss.",
  amphibious: "The beast can function both in air and in water.",
  "beast of burden": "The beast counts as stronger for carrying, dragging, or pulling heavy loads.",
  "bladed hide": "The beast's body can punish nearby attackers with sharp natural growths.",
  "blood frenzy": "The beast is especially dangerous against wounded creatures.",
  camouflage: "The beast can blend into its usual terrain and is harder to spot there.",
  charge: "After moving straight toward a target, the beast can hit harder or knock the target down.",
  "dive attack": "The beast can strike harder after diving down toward a target.",
  drone: "The beast can create a distracting or numbing sound.",
  echolocation: "The beast relies on sound to perceive nearby creatures and objects.",
  flyby: "The beast can move past enemies without provoking the usual opportunity attack from its flight.",
  "hold breath": "The beast can stay underwater or without air for an extended time.",
  illumination: "The beast can shed light from its body.",
  "innate spellcasting": "The beast has limited built-in magic.",
  mimicry: "The beast can imitate sounds it has heard.",
  multiattack: "The beast can make more than one attack with the same action.",
  "pack tactics": "The beast fights better when an ally is threatening the same target.",
  pounce: "After charging a target, the beast can knock it down and follow up with another attack.",
  quickness: "The beast has an extra burst of speed or action economy.",
  "raking charge": "The beast can make a more punishing attack after rushing forward.",
  rampage: "After dropping a target, the beast can quickly move and attack again.",
  relentless: "The beast can stay standing through a blow that would normally drop it.",
  "running leap": "The beast can jump farther after a running start.",
  "salt osmosis": "The beast is adapted to saltwater environments.",
  "shell camouflage": "The beast can hide by blending its shell into natural surroundings.",
  "siege monster": "The beast deals extra damage to objects and structures.",
  "spider climb": "The beast can climb difficult surfaces, including ceilings, without normal checks.",
  stable: "The beast is hard to knock prone.",
  "standing leap": "The beast can jump unusually far without a running start.",
  stench: "Nearby creatures can be sickened by the beast's smell.",
  "sure-footed": "The beast has advantage or extra resilience against being knocked prone.",
  "telepathic shroud": "The beast resists telepathic detection or mental intrusion.",
  "trampling charge": "After moving straight toward a target, the beast can knock it down and trample it.",
  "underwater camouflage": "The beast is harder to spot while underwater.",
  "water breathing": "The beast can breathe underwater.",
  "web sense": "The beast can sense creatures touching its webs.",
  "web walker": "The beast ignores movement restrictions from webs.",
};

function beastShapeCrs() {
  return [...new Set(beastShapeCollection().map((shape) => shape.cr).filter(Boolean))]
    .sort((left, right) => {
      const leftShape = beastShapeCollection().find((shape) => shape.cr === left);
      const rightShape = beastShapeCollection().find((shape) => shape.cr === right);
      return (leftShape?.crValue ?? 0) - (rightShape?.crValue ?? 0);
    });
}

function beastShapeHasMovement(value) {
  return Boolean(value) && value !== "—" && !/^0\s*ft\.?$/i.test(String(value).trim());
}

function beastShapeMovementTypes(shape) {
  return [
    beastShapeHasMovement(shape.speed) ? "walk" : "",
    beastShapeHasMovement(shape.swim) ? "swim" : "",
    beastShapeHasMovement(shape.fly) ? "fly" : "",
  ].filter(Boolean);
}

function beastShapeTraits(shape) {
  return String(shape.traits || "")
    .replace(/\)\s+(Blindsight|Darkvision)/g, "), $1")
    .split(",")
    .map((trait) => trait.trim())
    .filter((trait) => trait && trait !== "—");
}

function beastShapeActions(shape) {
  return Array.isArray(shape.actions) ? shape.actions.filter((action) => action?.name || action?.description) : [];
}

function beastTraitKey(traitName = "") {
  return String(traitName).toLowerCase().replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

function beastTraitDescription(traitName = "") {
  const key = beastTraitKey(traitName);
  if (/^blindsight/.test(key)) return "The beast can perceive nearby creatures and objects without relying on sight.";
  if (/^darkvision/.test(key)) return "The beast can see in darkness within the listed range.";
  if (/^telepathy/.test(key)) return "The beast can communicate mentally within the listed range.";
  if (/^burrow/.test(key)) return "The beast has a burrowing speed and can move through suitable ground.";
  if (/^climb/.test(key)) return "The beast has a climbing speed and handles vertical surfaces better than ordinary movement.";
  if (/^keen/.test(key)) {
    return `The beast has heightened ${key.replace(/^keen\s+/, "")}, improving checks that rely on those senses.`;
  }
  return BEAST_TRAIT_DESCRIPTIONS[key] || "This trait changes how the beast moves, senses, fights, or survives. Open the source page for the full table wording.";
}

function beastTraitIconLabel(traitName = "") {
  const clean = String(traitName).replace(/\([^)]*\)/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return (words.length === 1 ? words[0].slice(0, 2) : words.slice(0, 2).map((word) => word[0]).join("")).toUpperCase();
}

function beastTraitButtonsMarkup(shape) {
  const traits = beastShapeTraits(shape);
  if (!traits.length) return "";
  return `
    <span class="beast-trait-buttons" aria-label="Beast traits">
      ${traits.map((trait) => `
        <button class="beast-trait-button" type="button" data-beast-trait="${escapeHtml(trait)}" data-beast-trait-source="${escapeHtml(shape.sourceUrl)}" data-beast-trait-beast="${escapeHtml(shape.name)}" title="${escapeHtml(trait)}" aria-label="${escapeHtml(`${trait} trait details`)}">
          <span aria-hidden="true">${escapeHtml(beastTraitIconLabel(trait))}</span>
        </button>`).join("")}
    </span>`;
}

function beastShapeSearchText(shape) {
  return textForSearch([
    shape.name,
    shape.cr,
    shape.size,
    shape.formType,
    shape.speed,
    shape.swim,
    shape.fly,
    shape.traits,
    ...beastShapeTraits(shape).map(beastTraitDescription),
    ...beastShapeActions(shape).flatMap((action) => [action.name, action.description]),
    ...beastShapeMovementTypes(shape),
  ]);
}

function beastShapeCardMarkup(shape) {
  const movement = [
    beastShapeHasMovement(shape.speed) ? `Walk ${shape.speed}` : "",
    beastShapeHasMovement(shape.swim) ? `Swim ${shape.swim}` : "",
    beastShapeHasMovement(shape.fly) ? `Fly ${shape.fly}` : "",
  ].filter(Boolean);
  return `
    <article class="content-card beast-shape-card" data-searchable="${escapeHtml(beastShapeSearchText(shape))}">
      <span class="spell-card-topline">
        <span class="status-badge status-prepared">CR ${escapeHtml(shape.cr)}</span>
        <span>${escapeHtml(shape.formType)}</span>
      </span>
      <strong>${escapeHtml(shape.name)}</strong>
      <span class="spell-class-tags" aria-label="Beast shape stats">
        <span>${escapeHtml(shape.size)}</span>
        <span>${escapeHtml(`${shape.hp} HP`)}</span>
        <span>${escapeHtml(`AC ${shape.ac}`)}</span>
      </span>
      ${beastTraitButtonsMarkup(shape)}
      <span class="spell-card-meta">
        ${movement.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </span>
      <button class="btn btn-secondary beast-shape-detail-button" type="button" data-beast-shape-id="${escapeHtml(shape.id)}">Details</button>
    </article>`;
}

function filteredBeastShapes() {
  const query = document.getElementById("beast-shape-search")?.value.trim().toLowerCase() || "";
  const cr = document.getElementById("beast-shape-cr-filter")?.value || "";
  const size = document.getElementById("beast-shape-size-filter")?.value || "";
  const movement = document.getElementById("beast-shape-movement-filter")?.value || "";
  const formType = document.getElementById("beast-shape-form-filter")?.value || "";
  return beastShapeCollection().filter((shape) => {
    const queryMatches = !query || beastShapeSearchText(shape).includes(query);
    const crMatches = !cr || shape.cr === cr;
    const sizeMatches = !size || shape.size === size;
    const movementMatches = !movement || beastShapeMovementTypes(shape).includes(movement);
    const formMatches = !formType || shape.formType === formType;
    return queryMatches && crMatches && sizeMatches && movementMatches && formMatches;
  });
}

function renderBeastShapeTabs() {
  const tabs = document.getElementById("beast-shape-cr-tabs");
  if (!tabs) return;
  const currentCr = document.getElementById("beast-shape-cr-filter")?.value || "";
  const allCount = beastShapeCollection().length;
  tabs.innerHTML = [
    `<button class="chip-button ${currentCr === "" ? "is-active" : ""}" type="button" data-beast-shape-cr-tab="">All <span>${allCount}</span></button>`,
    ...beastShapeCrs().map((cr) => {
      const count = beastShapeCollection().filter((shape) => shape.cr === cr).length;
      return `<button class="chip-button ${currentCr === cr ? "is-active" : ""}" type="button" data-beast-shape-cr-tab="${escapeHtml(cr)}">CR ${escapeHtml(cr)} <span>${count}</span></button>`;
    }),
  ].join("");

  tabs.querySelectorAll("[data-beast-shape-cr-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const crFilter = document.getElementById("beast-shape-cr-filter");
      if (crFilter) crFilter.value = button.dataset.beastShapeCrTab || "";
      renderBeastShapes();
    });
  });
}

function populateBeastShapeFilters() {
  const crFilter = document.getElementById("beast-shape-cr-filter");
  const sizeFilter = document.getElementById("beast-shape-size-filter");
  const formFilter = document.getElementById("beast-shape-form-filter");
  if (crFilter && crFilter.options.length <= 1) {
    crFilter.insertAdjacentHTML("beforeend", beastShapeCrs().map((cr) => `<option value="${escapeHtml(cr)}">CR ${escapeHtml(cr)}</option>`).join(""));
  }
  if (sizeFilter && sizeFilter.options.length <= 1) {
    const sizes = [...new Set(beastShapeCollection().map((shape) => shape.size).filter(Boolean))].sort();
    sizeFilter.insertAdjacentHTML("beforeend", sizes.map((size) => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join(""));
  }
  if (formFilter && formFilter.options.length <= 1) {
    const formTypes = [...new Set(beastShapeCollection().map((shape) => shape.formType).filter(Boolean))].sort();
    formFilter.insertAdjacentHTML("beforeend", formTypes.map((formType) => `<option value="${escapeHtml(formType)}">${escapeHtml(formType)}</option>`).join(""));
  }
}

function renderBeastShapes() {
  const list = document.getElementById("beast-shape-list");
  const title = document.getElementById("beast-shape-results-title");
  const count = document.getElementById("beast-shape-results-count");
  if (!list) return;

  const shapes = filteredBeastShapes();
  const cr = document.getElementById("beast-shape-cr-filter")?.value || "";
  const size = document.getElementById("beast-shape-size-filter")?.value || "";
  const movement = document.getElementById("beast-shape-movement-filter")?.value || "";
  const formType = document.getElementById("beast-shape-form-filter")?.value || "";
  if (title) {
    title.textContent = [
      cr ? `CR ${cr}` : "All beast shapes",
      size,
      movement ? `${movement[0].toUpperCase()}${movement.slice(1)} movement` : "",
      formType,
    ].filter(Boolean).join(" - ");
  }
  if (count) count.textContent = `${shapes.length} of ${beastShapeCollection().length} beast shapes`;

  list.innerHTML = shapes.length
    ? shapes.map(beastShapeCardMarkup).join("")
    : `<div class="empty-state">No beast shapes match the current filters.</div>`;
  list.querySelectorAll("[data-beast-shape-id]").forEach((button) => {
    button.addEventListener("click", () => openBeastShapeDetail(button.dataset.beastShapeId));
  });
  list.querySelectorAll("[data-beast-trait]").forEach((button) => {
    button.addEventListener("click", () => openBeastTraitDetail(
      button.dataset.beastTrait,
      button.dataset.beastTraitSource,
      button.dataset.beastTraitBeast
    ));
  });
  renderBeastShapeTabs();
}

function beastShapeDetailRows(shape) {
  return [
    ["List", shape.formType],
    ["CR", shape.cr],
    ["Size", shape.size],
    ["HP", shape.hp],
    ["AC", shape.ac],
    ["Abilities", `STR ${shape.strength}, DEX ${shape.dexterity}, CON ${shape.constitution}`],
    ["Speed", shape.speed],
    ["Swim", shape.swim],
    ["Fly", shape.fly],
  ].map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || "Unknown")}</dd>
    </div>`).join("");
}

function beastShapeActionsMarkup(shape) {
  const actions = beastShapeActions(shape);
  if (!actions.length) return `<p>No actions are listed on this source page.</p>`;
  return `
    <div class="beast-action-list">
      ${actions.map((action) => `
        <article class="beast-action-item">
          <h4>${escapeHtml(action.name || "Action")}</h4>
          <p>${escapeHtml(action.description || "No action details listed.")}</p>
        </article>`).join("")}
    </div>`;
}

function openBeastShapeDetail(shapeId) {
  const shape = beastShapeCollection().find((item) => item.id === shapeId);
  const modal = document.getElementById("beast-shape-detail-modal");
  const body = document.getElementById("beast-shape-detail-body");
  if (!shape || !modal || !body) return;

  body.innerHTML = `
    <div class="card-kicker">
      <span class="status-badge status-prepared">CR ${escapeHtml(shape.cr)}</span>
      <span>${escapeHtml(shape.formType)}</span>
    </div>
    <h2 id="beast-shape-detail-title">${escapeHtml(shape.name)}</h2>
    <dl class="widget-detail-meta beast-shape-detail-meta">${beastShapeDetailRows(shape)}</dl>
    <section class="widget-detail-section">
      <h3>Traits</h3>
      ${beastTraitButtonsMarkup(shape) || "<p>No listed traits.</p>"}
    </section>
    <section class="widget-detail-section">
      <h3>Actions</h3>
      ${beastShapeActionsMarkup(shape)}
    </section>
    <div class="tag-row spell-detail-actions">
      <a class="btn btn-secondary" href="${escapeHtml(shape.sourceUrl)}" target="_blank" rel="noreferrer">Open Source Page</a>
    </div>`;
  modal.hidden = false;
  document.body.classList.add("spell-detail-open");
  modal.querySelector("[data-close-beast-shape-modal]")?.focus();
  body.querySelectorAll("[data-beast-trait]").forEach((button) => {
    button.addEventListener("click", () => openBeastTraitDetail(
      button.dataset.beastTrait,
      button.dataset.beastTraitSource,
      button.dataset.beastTraitBeast
    ));
  });
}

function closeBeastTraitDetail() {
  const modal = document.getElementById("beast-trait-modal");
  if (!modal) return;
  modal.hidden = true;
  const beastDetailModal = document.getElementById("beast-shape-detail-modal");
  if (!beastDetailModal || beastDetailModal.hidden) document.body.classList.remove("spell-detail-open");
}

function openBeastTraitDetail(traitName = "", sourceUrl = "", beastName = "") {
  const modal = document.getElementById("beast-trait-modal");
  const body = document.getElementById("beast-trait-body");
  if (!modal || !body || !traitName) return;
  body.innerHTML = `
    <div class="card-kicker">
      <span class="status-badge status-prepared">Trait</span>
      <span>${escapeHtml(beastName || "Beast shape")}</span>
    </div>
    <h2 id="beast-trait-title">${escapeHtml(traitName)}</h2>
    <section class="widget-detail-section">
      <p>${escapeHtml(beastTraitDescription(traitName))}</p>
    </section>
    <div class="tag-row spell-detail-actions">
      <a class="btn btn-secondary" href="${escapeHtml(sourceUrl || "https://dnd-5e.fandom.com/wiki/Beast_Shapes")}" target="_blank" rel="noreferrer">Open Source Page</a>
    </div>`;
  modal.hidden = false;
  document.body.classList.add("spell-detail-open");
  modal.querySelector("[data-close-beast-trait-modal]")?.focus();
}

function initBeastShapesPage() {
  const list = document.getElementById("beast-shape-list");
  if (!list) return;
  updateTopNavActivePage("beast-shapes");
  populateBeastShapeFilters();
  renderBeastShapeTabs();
  renderBeastShapes();

  ["beast-shape-search", "beast-shape-cr-filter", "beast-shape-size-filter", "beast-shape-movement-filter", "beast-shape-form-filter"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", renderBeastShapes);
    document.getElementById(id)?.addEventListener("change", renderBeastShapes);
  });

  document.getElementById("beast-shape-clear-filters")?.addEventListener("click", () => {
    ["beast-shape-search", "beast-shape-cr-filter", "beast-shape-size-filter", "beast-shape-movement-filter", "beast-shape-form-filter"].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.value = "";
    });
    renderBeastShapes();
  });

  const modal = document.getElementById("beast-shape-detail-modal");
  if (modal) {
    const close = () => {
      modal.hidden = true;
      if (document.getElementById("beast-trait-modal")?.hidden !== false) {
        document.body.classList.remove("spell-detail-open");
      }
    };
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-close-beast-shape-modal]")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !document.getElementById("beast-trait-modal")?.hidden) closeBeastTraitDetail();
      else if (event.key === "Escape" && !modal.hidden) close();
    });
  }
  const traitModal = document.getElementById("beast-trait-modal");
  traitModal?.addEventListener("click", (event) => {
    if (event.target === traitModal || event.target.closest("[data-close-beast-trait-modal]")) closeBeastTraitDetail();
  });
}

function initAppRoutes() {
  const parts = routeParts();
  if (parts[0] === "campaigns") return initCampaignRoutes();
  if (parts[0] === "media") {
    renderMediaLibraryShell();
    return true;
  }
  if (parts[0] === "maps") {
    if (parts[1] && parts[2] === "cities" && parts[3]) {
      renderCityDetailPage(parts[1], parts[3]);
      return true;
    }
    if (parts[1]) {
      renderMapDetailPage(parts[1]);
      return true;
    }
    renderMapsOverviewPage();
    return true;
  }
  if (parts[0] === "combat") {
    renderCombatPage();
    return true;
  }
  if (parts[0] === "comics") {
    renderComicsPage();
    return true;
  }
  return false;
}

function renderCampaignCalendar() {
  const grid = document.getElementById("calendar-grid");
  const title = document.getElementById("calendar-current-title");
  if (!grid) return;
  const settings = getCalendarSettings();
  const weather = getWeatherMap();
  const monthName = settings.months[settings.currentMonthIndex] || `Month ${settings.currentMonthIndex + 1}`;
  if (title) title.textContent = `${monthName} ${settings.currentYear} ${settings.yearName}`;

  const monthEvents = sortedEvents().filter((event) => (
    Number(event.year) === settings.currentYear && Number(event.monthIndex) === settings.currentMonthIndex
  ));
  const headers = settings.weekdays.map((day) => `<div class="calendar-weekday">${escapeHtml(day)}</div>`).join("");
  const days = Array.from({ length: settings.daysPerMonth }, (_, index) => {
    const day = index + 1;
    const dayEvents = monthEvents.filter((event) => Number(event.day) === day).sort((a, b) => {
      const aHour = Number.isFinite(Number(a.hour)) ? Number(a.hour) : 24;
      const bHour = Number.isFinite(Number(b.hour)) ? Number(b.hour) : 24;
      return aHour - bHour;
    });
    const forecast = weather[weatherKey(settings.currentYear, settings.currentMonthIndex, day)] || "No forecast";
    const eventPills = dayEvents.map((event) => {
      return `<button type="button" class="calendar-event-pill" data-calendar-event-id="${escapeHtml(event.id)}">${escapeHtml(event.title)}</button>`;
    }).join("");
    return `<article class="calendar-day">
      <div class="calendar-day-top"><strong>${day}</strong><span>${escapeHtml(forecast)}</span></div>
      <div class="calendar-day-events">
        ${eventPills}
      </div>
    </article>`;
  }).join("");
  grid.style.setProperty("--calendar-week-length", settings.weekLength);
  grid.innerHTML = headers + days;
  grid.querySelectorAll("[data-calendar-event-id]").forEach((button) => {
    button.addEventListener("click", () => openEventDetail(button.dataset.calendarEventId));
  });
}

function openEventDetail(eventId) {
  const modal = document.getElementById("event-detail-modal");
  const body = document.getElementById("event-detail-body");
  if (!modal || !body) return;
  const event = getStoredCollection("events").find((item) => item.id === eventId);
  if (!event) return;
  const timeDisplay = eventTimeDisplay(event);
  const timeSection = timeDisplay ? `<span class="tag">${timeDisplay}</span>` : "";
  body.innerHTML = `
    <div class="card-kicker"><span class="status-badge status-prepared">Calendar event</span><span>${escapeHtml(eventDateLabel(event))}</span></div>
    <h2 id="event-detail-title">${escapeHtml(event.title)}</h2>
    <p>${escapeHtml(event.description)}</p>
    <div class="tag-row">${timeSection}<span class="tag">${escapeHtml(eventWeather(event))}</span><span class="tag">Created ${escapeHtml(event.createdAt || "Unknown")}</span></div>
  `;
  modal.hidden = false;
}

function renderWeatherProbabilityEditor(selectedMonthIndex) {
  const monthSelect = document.getElementById("weather-probability-month");
  const list = document.getElementById("weather-probability-list");
  if (!monthSelect || !list) return;

  const settings = getCalendarSettings();
  const selected = Number.isFinite(Number(selectedMonthIndex))
    ? Number(selectedMonthIndex)
    : Number(monthSelect.value || settings.currentMonthIndex);
  const monthIndex = Math.min(Math.max(0, selected), settings.months.length - 1);
  const weights = weatherWeightsForMonth(settings, monthIndex);

  monthSelect.innerHTML = settings.months.map((month, index) => `<option value="${index}">${escapeHtml(month)}</option>`).join("");
  monthSelect.value = String(monthIndex);
  list.innerHTML = "";

  WEATHER_OPTIONS.forEach((weather) => {
    const row = document.createElement("label");
    row.className = "weather-probability-row";

    const name = document.createElement("span");
    name.className = "weather-probability-name";
    name.textContent = weather;

    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = String(MAX_WEATHER_WEIGHT);
    input.step = "1";
    input.value = String(weights[weather] ?? DEFAULT_WEATHER_WEIGHT);
    input.dataset.weatherOption = weather;

    const value = document.createElement("output");
    value.className = "weather-probability-value";
    value.value = input.value;
    value.textContent = input.value;

    input.addEventListener("input", () => {
      value.value = input.value;
      value.textContent = input.value;
    });

    row.append(name, input, value);
    list.append(row);
  });
}

function saveWeatherProbabilitiesForSelectedMonth(monthSelect, list) {
  const settings = getCalendarSettings();
  const monthIndex = Math.min(Math.max(0, Number(monthSelect.value) || 0), settings.months.length - 1);
  const probabilities = normalizeWeatherProbabilities(settings.weatherProbabilities, settings.months.length);
  probabilities[monthIndex] = defaultWeatherWeights();
  list.querySelectorAll("[data-weather-option]").forEach((input) => {
    probabilities[monthIndex][input.dataset.weatherOption] = Math.min(Math.max(Number(input.value) || 0, 0), MAX_WEATHER_WEIGHT);
  });
  saveCalendarSettings({ ...settings, weatherProbabilities: probabilities });
  renderWeatherProbabilityEditor(monthIndex);
}

function initCalendarPage() {
  const settingsForm = document.getElementById("calendar-settings-form");
  const prev = document.getElementById("calendar-prev");
  const next = document.getElementById("calendar-next");
  const weatherButton = document.getElementById("weather-generate");
  const weatherProbabilityForm = document.getElementById("weather-probability-form");
  const weatherProbabilityMonth = document.getElementById("weather-probability-month");
  const weatherProbabilityList = document.getElementById("weather-probability-list");
  const weatherProbabilityReset = document.getElementById("weather-probability-reset");
  const modal = document.getElementById("event-detail-modal");
  const settings = getCalendarSettings();

  populateCalendarFormDefaults();
  if (settingsForm) {
    document.getElementById("calendar-week-length").value = settings.weekLength;
    document.getElementById("calendar-weekdays").value = settings.weekdays.join(", ");
    document.getElementById("calendar-months").value = settings.months.join("\n");
    document.getElementById("calendar-days-per-month").value = settings.daysPerMonth;
    document.getElementById("calendar-year-name").value = settings.yearName;
    document.getElementById("calendar-active-year").value = settings.currentYear;

    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const weekLength = Math.max(1, Number(document.getElementById("calendar-week-length").value) || 7);
      const months = document.getElementById("calendar-months").value.split(/\n|,/).map((month) => month.trim()).filter(Boolean);
      const weekdays = document.getElementById("calendar-weekdays").value.split(",").map((day) => day.trim()).filter(Boolean).slice(0, weekLength);
      while (weekdays.length < weekLength) weekdays.push(`Day ${weekdays.length + 1}`);
      const nextMonths = months.length ? months : [...DEFAULT_CALENDAR_SETTINGS.months];
      const currentSettings = getCalendarSettings();
      saveCalendarSettings({
        ...currentSettings,
        weekLength,
        weekdays,
        months: nextMonths,
        daysPerMonth: Math.max(1, Number(document.getElementById("calendar-days-per-month").value) || 30),
        yearName: document.getElementById("calendar-year-name").value.trim() || "Year",
        currentYear: Number(document.getElementById("calendar-active-year").value) || settings.currentYear,
        currentMonthIndex: 0,
        weatherProbabilities: normalizeWeatherProbabilities(currentSettings.weatherProbabilities, nextMonths.length),
      });
      populateCalendarFormDefaults();
      renderCampaignCalendar();
      renderWeatherProbabilityEditor(0);
      renderDashboard();
    });
  }

  if (prev) prev.addEventListener("click", () => {
    const current = getCalendarSettings();
    current.currentMonthIndex -= 1;
    if (current.currentMonthIndex < 0) { current.currentMonthIndex = current.months.length - 1; current.currentYear -= 1; }
    saveCalendarSettings(current); populateCalendarFormDefaults(); renderCampaignCalendar(); renderWeatherProbabilityEditor(current.currentMonthIndex); renderDashboard();
  });
  if (next) next.addEventListener("click", () => {
    const current = getCalendarSettings();
    current.currentMonthIndex += 1;
    if (current.currentMonthIndex >= current.months.length) { current.currentMonthIndex = 0; current.currentYear += 1; }
    saveCalendarSettings(current); populateCalendarFormDefaults(); renderCampaignCalendar(); renderWeatherProbabilityEditor(current.currentMonthIndex); renderDashboard();
  });
  if (weatherButton) weatherButton.addEventListener("click", () => {
    const current = getCalendarSettings();
    const weather = getWeatherMap();
    for (let day = 1; day <= current.daysPerMonth; day += 1) {
      weather[weatherKey(current.currentYear, current.currentMonthIndex, day)] = randomWeatherForMonth(current, current.currentMonthIndex);
    }
    saveWeatherMap(weather); renderCampaignCalendar(); renderDashboard();
  });
  if (weatherProbabilityMonth) {
    weatherProbabilityMonth.addEventListener("change", () => renderWeatherProbabilityEditor(Number(weatherProbabilityMonth.value)));
  }
  if (weatherProbabilityForm && weatherProbabilityMonth && weatherProbabilityList) {
    weatherProbabilityForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveWeatherProbabilitiesForSelectedMonth(weatherProbabilityMonth, weatherProbabilityList);
    });
  }
  if (weatherProbabilityReset && weatherProbabilityMonth) {
    weatherProbabilityReset.addEventListener("click", () => {
      const settings = getCalendarSettings();
      const monthIndex = Math.min(Math.max(0, Number(weatherProbabilityMonth.value) || 0), settings.months.length - 1);
      const probabilities = normalizeWeatherProbabilities(settings.weatherProbabilities, settings.months.length);
      probabilities[monthIndex] = defaultWeatherWeights();
      saveCalendarSettings({ ...settings, weatherProbabilities: probabilities });
      renderWeatherProbabilityEditor(monthIndex);
    });
  }
  if (modal) {
    modal.addEventListener("click", (event) => { if (event.target === modal || event.target.matches("[data-close-modal]")) modal.hidden = true; });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") modal.hidden = true; });
  }
  renderCampaignCalendar();
  renderWeatherProbabilityEditor(settings.currentMonthIndex);
}

async function bootApp() {
  if (await redirectToCanonicalLocalOrigin()) return;
  importCanonicalLocalStoragePayload();
  initMobileNavigation();
  initWeaponPropertyInfo();
  window.addEventListener("hashchange", () => {
    if (window.location.hash.startsWith("#/")) initAppRoutes();
    else if (document.querySelector(".character-page, .setup-page, .media-page, .map-page, .map-detail-page, .city-page, .comic-page")) window.location.reload();
  });
  if (!initAppRoutes()) {
    updateTopNavActivePage(document.body?.dataset?.page || "dashboard");
    if (document.body?.dataset?.page === "dashboard" && !window.location.hash) {
      renderCampaignLibraryPage();
      return;
    }
    initCommandInterface();
    initImagePickers();
    populateCalendarFormDefaults();
    initDashboardForms();
    initCalendarPage();
    initMaterials();
    initWondrousItemsPage();
    initSpellsPage();
    initBeastShapesPage();
    initAiPlaceholder();
    renderDashboard();
  }
}

window.DNDUCKS_BOOT_PROMISE = window.DNDUCKS_SKIP_AUTO_BOOT ? Promise.resolve(false) : bootApp();

/*
Backend roadmap summary:
Phase 2: add user accounts with React/Next.js, Node/Express or API routes, PostgreSQL/Supabase, and managed auth.
Phase 3: add database tables for users, campaigns, sessions, notes, characters, locations, factions, quests, items, maps, calendar_events, files, document_links, and ai_suggestions.
Phase 4: add local backend-managed uploads for draft persistence, then Supabase Storage, Firebase Storage, AWS S3, or Cloudinary for production.
Phase 5: add a markdown/rich text editor, autosave, tags, search, and backlinks.
Phase 6: add AI with embeddings, vector search, RAG, contradiction detection, summaries, and user-controlled context access.
Phase 7: add uploaded maps, pins, linked annotations, and saved map state.
Phase 8: add collaboration roles for Dungeon Masters, Players, and Viewers.
*/
