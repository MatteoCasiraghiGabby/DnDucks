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
  comics: "dnducks.comics",
  dmOnly: "dnducks.dmOnly",
};

const USER_WIDGET_COLLECTIONS = new Set(["notes", "characters", "items", "encounters", "locations", "events", "comics"]);
const CANONICAL_LOCAL_ORIGIN = "http://127.0.0.1:3000";
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

  const configuredBase = String(window.DNDUCKS_API_BASE_URL || document.querySelector?.('meta[name="dnducks-api-base"]')?.content || "").trim();
  if (configuredBase) return `${configuredBase.replace(/\/+$/, "")}${requestPath}`;

  if (window.location.protocol === "file:") return `http://127.0.0.1:3000${requestPath}`;

  const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
  const proxyCapablePorts = new Set(["", "3000", "5173"]);
  if (localHosts.has(window.location.hostname) && !proxyCapablePorts.has(window.location.port)) {
    return `${window.location.protocol}//${window.location.hostname}:3000${requestPath}`;
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

function localStorageSnapshot() {
  return Object.fromEntries(Object.values(STORAGE_KEYS).map((storageKey) => [
    storageKey,
    localStorage.getItem(storageKey),
  ]).filter(([, value]) => value !== null));
}

function redirectToCanonicalLocalOrigin() {
  if (!shouldUseCanonicalLocalOrigin()) return false;
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
  return getCampaign(DEFAULT_CAMPAIGN_ID) || upsertCampaign(DEFAULT_CAMPAIGN);
}

function resetCampaign(campaignId = DEFAULT_CAMPAIGN_ID) {
  const campaign = getCampaign(campaignId);
  const noteIdsToRemove = new Set([campaign?.campaignStartNoteId].filter(Boolean));
  const notes = getStoredCollection("notes").filter((note) => (
    !noteIdsToRemove.has(note.id) && !(note.campaignId === campaignId && note.generatedBy === "campaign-setup-start")
  ));
  saveCollection("notes", notes);
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

function classInfo(classRole = "") {
  const normalized = String(classRole).trim().toLowerCase();
  return PLAYER_CLASSES.find((item) => item.name.toLowerCase() === normalized) || null;
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
  const value = Math.max(1, Math.min(20, Number(level) || 1));
  return Math.ceil(value / 4) + 1;
}

function abilityScore(player, key) {
  return player?.abilities?.[key] ?? "";
}

function savingThrowBonus(player, abilityKey) {
  const bonus = abilityModifier(abilityScore(player, abilityKey));
  return bonus + ((player.savingThrowProficiencies || []).includes(abilityKey) ? proficiencyBonusForLevel(player.level) : 0);
}

function skillBonus(player, skill) {
  const bonus = abilityModifier(abilityScore(player, skill.ability));
  return bonus + ((player.skillProficiencies || []).includes(skill.key) ? proficiencyBonusForLevel(player.level) : 0);
}

function playerPassivePerception(player) {
  const saved = Number(player?.combat?.passivePerception);
  if (Number.isFinite(saved) && saved > 0) return saved;
  return 10 + skillBonus(player, SKILLS.find((skill) => skill.key === "perception"));
}

function languageLabel(key) {
  return LANGUAGES.find((language) => language.key === key)?.label || key;
}

function toolLabel(key) {
  return TOOLS.find((tool) => tool.key === key)?.label || key;
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
  else if (info.toolChoices === "artisanOrMusical" && info.toolLimit) tools.push(`${info.toolLimit} artisan's tools or musical instrument`);
  return tools;
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
  const backgroundTitle = backgroundFeatureBlockTitle(player);
  return featureBlocksForPlayer(player).filter((block) => (
    !backgroundTitle || normalizeEquipmentText(block.title) !== backgroundTitle
  ));
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
      <strong>${escapeHtml(block.title)}</strong>
      ${block.details.length ? `<p>${escapeHtml(block.details.join("\n"))}</p>` : ""}
    </section>`).join("")}</div>`;
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
  return Number(String(classInfo(classRole)?.hitDie || "d8").replace("d", "")) || 8;
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
  if (/elf|eladrin|sea elf|shadar kai|astral elf/.test(value)) add("Trance", "Keen Senses");
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

function armorClassFromEquipment(dexterityScore, equipment = "", classRole = "", abilities = {}) {
  const dexMod = abilityModifier(dexterityScore);
  const armor = armorFormulaFromEquipment(equipment);
  const shieldBonus = /\bshield\b/i.test(String(equipment)) ? 2 : 0;
  const homebrewArmorBonus = homebrewArmorClassBonusFromEquipment(equipment, armor);
  const hasArmor = armor.base !== 10;
  if (!hasArmor) {
    const normalizedClass = String(classRole).toLowerCase();
    if (normalizedClass === "barbarian") return 10 + dexMod + abilityModifier(abilities.constitution) + shieldBonus + homebrewArmorBonus;
    if (normalizedClass === "monk") return 10 + dexMod + abilityModifier(abilities.wisdom) + homebrewArmorBonus;
  }
  const dexBonus = armor.dex === "none" ? 0 : armor.dex === "max2" ? Math.min(dexMod, 2) : dexMod;
  return armor.base + dexBonus + shieldBonus + homebrewArmorBonus;
}

function derivedCombatStats({ level, classRole, race, abilities, equipment, hitPointMaximum }) {
  const dexMod = abilityModifier(abilities?.dexterity);
  const sides = hitDieSides(classRole);
  const conMod = abilityModifier(abilities?.constitution);
  const fixedHitPoints = Math.max(1, sides + conMod);
  const savedHitPoints = Number(hitPointMaximum);
  const hitPoints = Number.isFinite(savedHitPoints) && savedHitPoints > 0 ? savedHitPoints : fixedHitPoints;
  return {
    armorClass: armorClassFromEquipment(abilities?.dexterity, equipment, classRole, abilities),
    initiative: dexMod,
    speed: raceSpeed(race),
    hitPointMaximum: hitPoints,
    currentHitPoints: hitPoints,
    temporaryHitPoints: "",
    hitDice: classHitDice(level, classRole),
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
  const level = numberFormValue(form, "#player-level");
  const classRole = formValue(form, "#player-class-role");
  const baseAbilities = Object.fromEntries(ABILITIES.map((ability) => [ability.key, numberFormValue(form, `#player-${ability.key}`)]));
  const lineageAbilityBonuses = lineageAbilityBonusesFromForm(form);
  const backgroundAbilityBonuses = backgroundAbilityBonusesFromForm(form);
  const abilities = applyBackgroundBonusesToScores(baseAbilities, combineAbilityBonuses(lineageAbilityBonuses, backgroundAbilityBonuses));
  const proficiencyBonus = proficiencyBonusForLevel(level || 1);
  const backgroundSkillProficiencies = splitListInput(formValue(form, "#player-background-skills"));
  const skillProficiencies = uniqueTextList([
    ...checkedFormValues(form, "player-skill-proficiencies"),
    ...backgroundSkillProficiencies,
  ]);
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
    }),
    hitPointsRolled: Boolean(hitPointMaximum),
    passivePerception,
  };
  const features = appendUniqueTextBlock(
    appendUniqueTextBlock(formValue(form, "#player-features"), formValue(form, "#player-lineage-traits")),
    homebrewFeatureTextForEquipment(equipment)
  );
  return {
    id: createId("player"),
    campaignId: DEFAULT_CAMPAIGN_ID,
    playerName,
    characterName,
    classRole,
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
      ...derivedToolProficienciesForClass(classRole),
      ...splitListInput(formValue(form, "#player-tool-proficiencies")),
    ]),
    combat,
    attacks: [...equipmentAttacks, ...manualAttacks],
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
  return errors;
}

function savePlayerToCampaign(campaignId, player) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  const savedPlayer = { ...player, avatarUrl: player.avatarUrl || player.imageDataUrl || "" };
  return upsertCampaign({ ...campaign, players: [...campaign.players, savedPlayer] });
}

function deletePlayerFromCampaign(campaignId, playerId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  return upsertCampaign({ ...campaign, players: campaign.players.filter((player) => player.id !== playerId) });
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
  const notes = getStoredCollection("notes");
  const existingId = campaign.campaignStartNoteId;
  return notes.find((note) => note.id === existingId || (note.campaignId === campaign.id && note.generatedBy === "campaign-setup-start"));
}

function campaignReady(campaign) {
  return Boolean(campaign?.setupCompleted && getCampaignStartNote(campaign)?.campaignStartDate);
}

function saveCampaignStartNote(campaign, noteData = {}) {
  const notes = getStoredCollection("notes");
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
  saveCollection("notes", nextNotes);
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

function dashboardHref() {
  return "index.html#dashboard";
}

function updateTopNavActivePage(page) {
  const nav = document.querySelector(".topnav");
  if (!nav) return;
  const normalizedPage = page || document.body?.dataset?.page || "dashboard";
  const activeHrefByPage = {
    dashboard: "index.html",
    media: "index.html#/media",
    maps: "index.html#/maps",
    comics: "index.html#/comics",
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
  if (id) return { ...entry, id };

  const identity = [
    entry.name,
    entry.title,
    entry.type,
    entry.category,
    entry.createdAt,
  ].map(storageIdSegment).filter(Boolean).join("-");
  return { ...entry, id: `legacy-${key}-${identity || "entry"}-${index + 1}` };
}

function getStoredCollection(key) {
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

function saveCollection(key, collection) {
  const nextCollection = USER_WIDGET_COLLECTIONS.has(key)
    ? collection.map((entry, index) => normalizeUserCollectionEntry(key, entry, index)).filter(Boolean)
    : collection;
  setStoredJson(STORAGE_KEYS[key], nextCollection);
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
    return Number(event.year) * 10000 + Number(event.monthIndex) * 100 + Number(event.day);
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
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) formData.append(key, value);
  });
  const payload = await fetchJson("/api/uploads/images", { method: "POST", body: formData });
  return payload.images || [];
}

async function listImages(filters = {}) {
  const payload = await fetchJson("/api/uploads/images");
  return payload.images || [];
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
  const imageUrl = entry.imageUrl || entry.imageDataUrl || entry.image?.url;
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
  const imageUrl = entry.imageUrl || entry.imageDataUrl || entry.image?.url;

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
    preview.src = normalized.url;
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
  return [
    `${lineage.name} (Lineage traits)`,
    `Speed: ${lineage.speed} ft.`,
    lineage.languages?.length ? `Languages: ${lineage.languages.map(languageLabel).join(", ")}${lineage.extraLanguages ? ` plus ${lineage.extraLanguages} choice` : ""}.` : "",
    lineage.traits?.length ? `Traits: ${lineage.traits.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
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
  const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
  if (!suggestions.length) {
    panel.innerHTML = `<div class="suggestion-empty">No strong suggestions yet. Add more concrete motives, history, habits, or appearance details.</div>`;
    panel.hidden = false;
    return;
  }

  panel.innerHTML = `
    <div class="suggestion-panel-heading">
      <div>
        <h3>Suggested mechanical traits</h3>
        <p>Review mechanical suggestions before adding them to Features and traits.</p>
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
            <label class="suggestion-edit-label">Edit suggestion<textarea rows="2" data-suggestion-edit>${escapeHtml(suggestionApplyText(suggestion))}</textarea></label>
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
      resetCampaign(DEFAULT_CAMPAIGN_ID);
      renderDashboard();
      renderCampaignCalendar();
    });
  }
}

function imagePreviewMarkup(image, label = "") {
  const title = image.title || image.originalFilename || label || "Uploaded image";
  return `
    <figure class="image-preview">
      <img src="${escapeHtml(image.url)}" alt="${escapeHtml(title)}" loading="lazy" />
      <figcaption>${escapeHtml(title)}</figcaption>
    </figure>`;
}

function mediaImageCardMarkup(image, options = {}) {
  const title = image.title || image.originalFilename || "Uploaded image";
  const selectable = Boolean(options.selectable);
  return `
    <article class="content-card entry-card image-card" data-image-card="${escapeHtml(image.id)}">
      ${imagePreviewMarkup(image, title)}
      <div class="card-kicker"><span class="status-badge status-active">Image</span><span>${escapeHtml(formatBytes(image.fileSize))}</span></div>
      <h3>${escapeHtml(title)}</h3>
      ${widgetTagsMarkup([formatUploadedAt(image.uploadedAt)])}
      <div class="entry-actions">
        ${selectable ? `<button class="btn btn-primary" type="button" data-select-media-image="${escapeHtml(image.id)}">Select</button>` : ""}
        <a class="btn btn-secondary" href="${escapeHtml(image.url)}" target="_blank" rel="noopener">Preview</a>
        ${selectable ? "" : `<button class="btn btn-secondary" type="button" data-edit-image="${escapeHtml(image.id)}">Edit</button>`}
        <button class="btn btn-danger" type="button" data-delete-image="${escapeHtml(image.id)}">Delete</button>
      </div>
    </article>`;
}

function imageUploadMarkup({ submitLabel = "Upload image" } = {}) {
  return `
    <form class="panel form-grid image-upload-form" data-image-upload-form>
      <label class="full-width">Title<input name="title" type="text" placeholder="Image title" /></label>
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
    background.originFeat ? `Granted by the ${background.label} background.` : "",
  ];
  if (background.description) lines.push(background.description);
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
      preview.src = imageUrl;
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
  const imageUrl = entry.imageUrl || entry.imageDataUrl || entry.image?.url;
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
          ${widgetImageMarkup(event, event.title)}
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
      button.href = "#dashboard";
      button.textContent = "Open Campaign";
    } else if (campaign.players.length) {
      button.href = campaignStartNoteHref(campaign.id);
      button.textContent = "Open Campaign";
    } else {
      button.href = campaignSetupHref(campaign.id);
      button.textContent = "Start Campaign";
    }
  });
  const widgetTitle = document.getElementById("campaign-widget-title");
  if (widgetTitle) widgetTitle.textContent = campaign.name;
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
    const title = document.getElementById("event-title").value.trim();
    const image = selectedMediaImageFromForm(form);
    const event = {
      id: createId("event"),
      title,
      monthIndex,
      day,
      year,
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
    const materials = await fetchJson("/api/materials");
    if (count) count.textContent = `${materials.length} saved material${materials.length === 1 ? "" : "s"}`;
    if (!materials.length) {
      list.innerHTML = `<div class="empty-state">No uploaded materials yet. Upload a map, NPC portrait, PDF handout, or campaign note to persist it locally.</div>`;
      return;
    }

    list.innerHTML = materials.map((material) => {
      const searchable = textForSearch([material.title, material.originalFilename, material.category, material.description, material.tags?.join(" "), "material file map handout"]);
      const preview = isPreviewableImage(material)
        ? `<a class="material-preview" href="${escapeHtml(material.downloadUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(material.downloadUrl)}" alt="Preview of ${escapeHtml(material.title || material.originalFilename)}" loading="lazy" /></a>`
        : `<a class="material-preview material-preview-file" href="${escapeHtml(material.downloadUrl)}" target="_blank" rel="noopener"><span>${escapeHtml((material.originalFilename || "file").split(".").pop().toUpperCase())}</span></a>`;
      return `
        <article class="content-card entry-card material-card" data-widget-origin="user" data-searchable="${escapeHtml(searchable)}" data-status="active">
          ${preview}
          <div class="card-kicker"><span class="status-badge status-active">${escapeHtml(material.category || "other")}</span><span>${escapeHtml(material.mimeType)}</span></div>
          <h3>${escapeHtml(material.title || material.originalFilename)}</h3>
          ${widgetDescriptionMarkup(material.description)}
          ${widgetTagsMarkup([formatBytes(material.fileSize), formatUploadedAt(material.uploadedAt), ...(material.tags || [])])}
          <div class="entry-actions">
            <a class="btn btn-secondary" href="${escapeHtml(material.downloadUrl)}" target="_blank" rel="noopener">Open / Download</a>
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
    list.innerHTML = images.length
      ? images.map((image) => mediaImageCardMarkup(image, { selectable: false })).join("")
      : `<div class="empty-state">No media images yet. Upload images below, then select them from dashboard widgets.</div>`;
  } catch (error) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    if (count) count.textContent = "Backend offline";
  }
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
    const title = new FormData(uploadForm).get("title")?.toString().trim() || "";
    if (status) {
      status.textContent = "Uploading image...";
      status.classList.remove("error");
    }
    try {
      const images = await uploadImages(input?.files || [], { title, source: "media" });
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
      const title = prompt("Image title", currentTitle);
      if (title === null) return;
      try {
        await updateImageMetadata(editId, { title });
        await loadMediaLibrary();
      } catch (error) {
        alert(error.message);
      }
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
  const imageUrl = comicPageImageUrl(page);
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
  return fetchJson("/api/maps", { method: "POST", body: formData });
}

async function listInteractiveMaps() {
  const payload = await fetchJson("/api/maps");
  return payload.maps || [];
}

async function getInteractiveMap(mapId) {
  return fetchJson(`/api/maps/${encodeURIComponent(mapId)}`);
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
  return `
    <article class="content-card entry-card map-card" data-map-card="${escapeHtml(map.id)}">
      <a class="map-card-preview" href="${escapeHtml(mapDetailHref(map.id))}">
        <img src="${escapeHtml(map.imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" />
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

function interactiveMapViewerMarkup(map, cities = [], options = {}) {
  const title = map.title || map.originalFilename || "Map";
  return `
    <div class="interactive-map-shell" data-map-viewer>
      <div class="interactive-map-toolbar">
        <button class="btn btn-secondary" type="button" data-map-zoom-out>Zoom out</button>
        <button class="btn btn-secondary" type="button" data-map-zoom-reset>Reset</button>
        <button class="btn btn-secondary" type="button" data-map-zoom-in>Zoom in</button>
      </div>
      <div class="interactive-map-viewport">
        <div class="interactive-map-canvas" style="--map-scale: 1;" data-map-canvas>
          <img data-map-image src="${escapeHtml(map.imageUrl)}" alt="${escapeHtml(title)}" />
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
      <div class="form-message full-width" id="city-pin-status" aria-live="polite">Click the map to choose a city location.</div>
      <button class="btn btn-primary" type="submit">Save city pin</button>
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
  const x = Math.round(normalizedX * (Number(map.imageWidth) || 0));
  const y = Math.round(normalizedY * (Number(map.imageHeight) || 0));
  const fields = {
    "city-x": x,
    "city-y": y,
    "city-normalized-x": normalizedX,
    "city-normalized-y": normalizedY,
  };
  Object.entries(fields).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = String(value);
  });
  const status = document.getElementById("city-pin-status");
  if (status) {
    status.textContent = `Pin selected at ${Math.round(normalizedX * 100)}%, ${Math.round(normalizedY * 100)}% on the map.`;
    status.classList.remove("error");
  }
  const marker = document.querySelector("[data-map-click-marker]");
  if (marker) {
    marker.style.left = `${normalizedX * 100}%`;
    marker.style.top = `${normalizedY * 100}%`;
    marker.hidden = false;
  }
}

function initMapDetailPage(map, cities) {
  let zoom = 1;
  const canvas = document.querySelector("[data-map-canvas]");
  const image = document.querySelector("[data-map-image]");
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

  image?.addEventListener("click", (event) => {
    const rect = image.getBoundingClientRect();
    const normalizedX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const normalizedY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    setCityPinFormPoint(map, normalizedX, normalizedY);
    document.getElementById("city-name")?.focus();
  });

  document.getElementById("city-pin-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("city-pin-status");
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
      await createMapCity(map.id, payload);
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
      const cityName = prompt("City name", city?.cityName || "");
      if (cityName === null) return;
      try {
        await updateMapCity(map.id, editId, { cityName });
        renderMapDetailPage(map.id);
      } catch (error) {
        alert(error.message);
      }
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
  return `
    <div class="map-preview">
      <div class="interactive-map-canvas" style="--map-scale: 1;">
        <img src="${escapeHtml(map.imageUrl)}" alt="${escapeHtml(map.title || "Map preview")}" />
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
        ${widgetTagsMarkup([`Player: ${player.playerName}`, player.classRole, player.level ? `Level ${player.level}` : "", player.race, player.alignment])}`,
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
        <h3>${escapeHtml(player.background || "Choose a background")}</h3>
        ${backgroundNarrative ? `<p class="background-widget-narrative">${escapeHtml(backgroundNarrative)}</p>` : ""}
        ${widgetTagsMarkup(backgroundEffects)}`,
    },
    {
      key: "abilities",
      title: "Abilities",
      complete: abilitySectionComplete(player),
      body: `${backgroundBonusTags.length ? `<div class="passive-perception-pill"><span>Background bonuses</span><strong>${escapeHtml(backgroundBonusTags.join(", "))}</strong></div>` : ""}
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

function playerCharacterFormMarkup() {
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
        <label>Race<input id="player-race" type="text" list="player-race-options" placeholder="Human" /></label>
        <label>Alignment<input id="player-alignment" type="text" list="player-alignment-options" placeholder="Neutral Good" /></label>
        <div class="sheet-derived-grid full-width" id="player-lineage-ability-controls" hidden></div>
        <div class="passive-perception-pill full-width"><span>Lineage ability bonuses</span><strong id="player-lineage-ability-bonus-summary">Choose a lineage to assign bonuses.</strong></div>
        <input id="player-lineage-ability-bonuses" type="hidden" />
        <textarea id="player-lineage-traits" hidden aria-hidden="true"></textarea>
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
          <button class="btn btn-secondary" type="button" id="analyze-character-description">Suggest backgrounds and traits</button>
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
        <button class="btn btn-secondary" type="button" id="add-another-player">ADD ANOTHER PLAYER</button>
        <button class="btn btn-primary" type="button" id="go-on-campaign">GO ON</button>
      </div>
    </form>`;
}

function updatePlayerFormDerivedFields(form) {
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
  });
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
  const level = Math.max(1, Math.min(20, Number(numberFormValue(form, "#player-level")) || 1));
  const classRole = formValue(form, "#player-class-role");
  const constitution = applyBackgroundBonusesToScores({
    constitution: numberFormValue(form, "#player-constitution"),
  }, combineAbilityBonuses(lineageAbilityBonusesFromForm(form), backgroundAbilityBonusesFromForm(form))).constitution;
  const sides = hitDieSides(classRole);
  const conMod = abilityModifier(constitution);
  const baseHitPoints = Math.max(1, sides + conMod);
  if (level <= 1) {
    clearRolledHitPoints(form);
    return baseHitPoints;
  }
  const extraHitPoints = Array.from({ length: level - 1 }, () => {
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
  const limit = info?.skillLimit || checked.length;
  checked.forEach((input, index) => {
    if (index >= limit) input.checked = false;
  });
  if (!info) return;
  const allowedSkills = allowedSkillKeysForClass(info);
  const selectedCount = skillInputs.filter((input) => input.checked && input.dataset.backgroundFixed !== "true").length;
  const limitReached = selectedCount >= limit;
  skillInputs.forEach((input) => {
    if (input.dataset.backgroundFixed === "true") return;
    if (!allowedSkills.has(input.value)) return;
    const disabled = !input.checked && limitReached;
    input.disabled = disabled;
    input.closest("label")?.classList.toggle("is-disabled", disabled);
  });
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
  form.querySelectorAll?.('input[name="player-skill-proficiencies"]').forEach((input) => {
    if (input.dataset.backgroundFixed === "true") {
      input.checked = true;
      input.disabled = true;
      input.closest("label")?.classList.add("is-fixed");
      input.closest("label")?.classList.remove("is-disabled");
      return;
    }
    const isAllowed = allowedSkills.has(input.value);
    input.disabled = !isAllowed;
    input.checked = input.checked && isAllowed;
    input.closest("label")?.classList.toggle("is-disabled", !isAllowed);
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
      const editedText = card?.querySelector("[data-suggestion-edit]")?.value.trim() || "";
      applyCharacterSuggestion(form, suggestion, editedText);
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
        if (suggestion) applyCharacterSuggestion(form, suggestion, card.querySelector("[data-suggestion-edit]")?.value.trim() || "");
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
    if (["player-class-role", "player-level", "player-constitution"].includes(event.target?.id)) clearRolledHitPoints(form);
    if (event.target?.id === "player-class-role" || event.target?.id === "player-race") applyClassRestrictions(form);
    updatePlayerFormDerivedFields(form);
    refreshPlayerSectionSummary(form);
  });
  form.addEventListener("change", (event) => {
    if (["player-class-role", "player-level", "player-constitution"].includes(event.target?.id)) clearRolledHitPoints(form);
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
  if (campaignReady(campaign)) {
    goToDashboard();
    return;
  }
  if (campaign.setupCompleted && campaign.players.length) {
    window.location.href = campaignStartNoteHref(campaign.id);
    return;
  }
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell setup-page">
      <div class="page-hero">
        <p class="eyebrow">Start campaign</p>
        <h1>${escapeHtml(campaign.name)}</h1>
        <p>Create the party one character sheet at a time before entering the live campaign dashboard.</p>
      </div>
      <div class="setup-grid">
        <section class="setup-form-panel">
          <div class="section-heading"><div><p class="eyebrow">Party builder</p><h2>Add a player character</h2></div></div>
          ${playerCharacterFormMarkup()}
        </section>
        <aside class="setup-summary-panel">
          <div class="section-heading"><div><p class="eyebrow">Already added</p><h2>Party so far</h2></div></div>
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

function sheetField(label, value) {
  const display = value === 0 ? 0 : (value || "—");
  return `<div class="sheet-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(display)}</strong></div>`;
}

function sheetTextBlock(label, value) {
  return `<section class="sheet-box"><h3>${escapeHtml(label)}</h3><p>${escapeHtml(value || "—")}</p></section>`;
}

function playerSheetAttacks(player = {}) {
  const equipmentAttacks = derivedWeaponAttacks({
    equipment: player.equipment,
    abilities: player.abilities || {},
    level: player.level || 1,
  });
  const manualAttacks = (player.attacks || []).filter((attack) => !attack.generatedFromEquipment);
  return [...equipmentAttacks, ...manualAttacks];
}

function playerAttackRows(player) {
  const sheetAttacks = playerSheetAttacks(player);
  const attacks = sheetAttacks.length ? sheetAttacks : [{ name: "", attackBonus: "", damageType: "" }];
  return attacks.map((attack) => `
    <tr>
      <td>${escapeHtml(attack.name || "—")}</td>
      <td>${escapeHtml(attack.attackBonus || "—")}</td>
      <td>${escapeHtml(attack.damageType || "—")}</td>
    </tr>`).join("");
}

function characterSheetMarkup(player) {
  const proficiencyBonus = player.proficiencyBonus || proficiencyBonusForLevel(player.level);
  const combat = player.combat || {};
  const equipmentText = [
    player.equipment,
    Number(player.gold) > 0 ? `Gold: ${player.gold} GP` : "",
  ].filter(hasText).join("\n");
  const proficiencyText = [
    (player.languages || []).length ? `Languages: ${(player.languages || []).map(languageLabel).join(", ")}` : "",
    (player.toolProficiencies || []).length ? `Tools: ${(player.toolProficiencies || []).map(toolLabel).join(", ")}` : "",
  ].filter(hasText).join("\n");
  return `
    <article class="character-sheet-paper">
      <header class="sheet-header-grid">
        ${sheetField("Character Name", player.characterName)}
        ${sheetField("Class & Level", `${player.classRole || "—"}${player.level ? ` ${player.level}` : ""}`)}
        ${sheetField("Player Name", player.playerName)}
        ${sheetField("Race", player.race)}
        ${sheetField("Alignment", player.alignment)}
      </header>

      <div class="sheet-main-grid">
        <aside class="sheet-column sheet-left-column">
          <div class="ability-sheet-grid">
            ${ABILITIES.map((ability) => `
              <div class="ability-score-box">
                <span>${escapeHtml(ability.label)}</span>
                <strong>${escapeHtml(abilityScore(player, ability.key) || "10")}</strong>
                <small>${signedModifier(abilityModifier(abilityScore(player, ability.key)))}</small>
              </div>`).join("")}
          </div>
          <section class="sheet-box">
            <h3>Saving Throws <small>PB ${signedModifier(proficiencyBonus)}</small></h3>
            <div class="sheet-check-list">
              ${ABILITIES.map((ability) => `
                <div><span>${(player.savingThrowProficiencies || []).includes(ability.key) ? "●" : "○"}</span><strong>${signedModifier(savingThrowBonus(player, ability.key))}</strong>${escapeHtml(ability.label)}</div>`).join("")}
            </div>
          </section>
          <section class="sheet-box">
            <h3>Skills</h3>
            <div class="sheet-check-list">
              ${SKILLS.map((skill) => `
                <div><span>${(player.skillProficiencies || []).includes(skill.key) ? "●" : "○"}</span><strong>${signedModifier(skillBonus(player, skill))}</strong>${escapeHtml(skill.label)} <small>(${escapeHtml(skill.ability.slice(0, 3).toUpperCase())})</small></div>`).join("")}
            </div>
          </section>
          ${sheetField("Passive Wisdom (Perception)", playerPassivePerception(player))}
          ${sheetTextBlock("Other Proficiencies & Languages", proficiencyText)}
        </aside>

        <section class="sheet-column">
          <div class="combat-sheet-grid">
            ${sheetField("Armor Class", combat.armorClass)}
            ${sheetField("Initiative", signedModifier(combat.initiative ?? abilityModifier(abilityScore(player, "dexterity"))))}
            ${sheetField("Speed", combat.speed ? `${combat.speed} ft.` : "")}
          </div>
          <div class="hit-point-grid">
            ${sheetField("Hit Points", combat.hitPointMaximum)}
            ${sheetField("Hit Dice", combat.hitDice)}
          </div>
          <section class="sheet-box">
            <h3>Attacks & Spellcasting</h3>
            <table class="sheet-table">
              <thead><tr><th>Name</th><th>Atk Bonus</th><th>Damage / Type</th></tr></thead>
              <tbody>${playerAttackRows(player)}</tbody>
            </table>
          </section>
          ${sheetTextBlock("Equipment", equipmentText)}
        </section>

        <section class="sheet-column">
          ${sheetTextBlock("Personality Traits", player.personality?.traits)}
          ${sheetTextBlock("Ideals", player.personality?.ideals)}
          ${sheetTextBlock("Bonds", player.personality?.bonds)}
          ${sheetTextBlock("Flaws", player.personality?.flaws)}
          ${sheetTextBlock("Features & Traits", featureTextForPlayer(player))}
          ${sheetTextBlock("Backstory / Notes", player.notes)}
        </section>
      </div>
    </article>`;
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
      ${characterSheetMarkup(player)}
    </section>`;
  document.getElementById("back-to-dashboard-button").addEventListener("click", goToDashboard);
}

function initCampaignRoutes() {
  const parts = routeParts();
  if (parts[0] !== "campaigns") return false;
  updateTopNavActivePage("dashboard");
  const campaignId = parts[1] || DEFAULT_CAMPAIGN_ID;
  if (parts[2] === "setup") {
    renderCampaignSetupPage(campaignId);
    return true;
  }
  if (parts[2] === "start-note") {
    renderCampaignStartNotePage(campaignId);
    return true;
  }
  if (parts[2] === "players" && parts[3]) {
    renderPlayerCharacterPage(campaignId, parts[3]);
    return true;
  }
  renderNotFoundPage("This campaign route is not available yet.");
  return true;
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
    const dayEvents = monthEvents.filter((event) => Number(event.day) === day);
    const forecast = weather[weatherKey(settings.currentYear, settings.currentMonthIndex, day)] || "No forecast";
    return `<article class="calendar-day">
      <div class="calendar-day-top"><strong>${day}</strong><span>${escapeHtml(forecast)}</span></div>
      <div class="calendar-day-events">
        ${dayEvents.map((event) => `<button type="button" class="calendar-event-pill" data-calendar-event-id="${escapeHtml(event.id)}">${escapeHtml(event.title)}</button>`).join("")}
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
  body.innerHTML = `
    <div class="card-kicker"><span class="status-badge status-prepared">Calendar event</span><span>${escapeHtml(eventDateLabel(event))}</span></div>
    <h2 id="event-detail-title">${escapeHtml(event.title)}</h2>
    <p>${escapeHtml(event.description)}</p>
    <div class="tag-row"><span class="tag">${escapeHtml(eventWeather(event))}</span><span class="tag">Created ${escapeHtml(event.createdAt || "Unknown")}</span></div>
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

if (!redirectToCanonicalLocalOrigin()) {
  importCanonicalLocalStoragePayload();
  initMobileNavigation();
  initWeaponPropertyInfo();
  if (!initAppRoutes()) {
    updateTopNavActivePage(document.body?.dataset?.page || "dashboard");
    initCommandInterface();
    initImagePickers();
    populateCalendarFormDefaults();
    initDashboardForms();
    initCalendarPage();
    initMaterials();
    initAiPlaceholder();
    renderDashboard();
  }
  window.addEventListener("hashchange", () => {
    if (window.location.hash.startsWith("#/")) initAppRoutes();
    else if (document.querySelector(".character-page, .setup-page, .media-page, .map-page, .map-detail-page, .city-page, .comic-page")) window.location.reload();
  });
}

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
