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
};

const USER_WIDGET_COLLECTIONS = new Set(["notes", "characters", "items", "encounters", "locations", "events"]);

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

const PLAYER_RACES = ["Dragonborn", "Dwarf", "Elf", "Gnome", "Half-Elf", "Halfling", "Half-Orc", "Human", "Tiefling"];
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
  localStorage.setItem(STORAGE_KEYS.campaigns, JSON.stringify(campaigns.map(normalizeCampaign)));
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

function languageRulesForRace(race = "") {
  const value = String(race).toLowerCase();
  const fixed = ["common"];
  let extraLimit = 0;
  if (value.includes("dragonborn")) fixed.push("draconic");
  else if (value.includes("half-elf")) {
    fixed.push("elvish");
    extraLimit = 1;
  } else if (value.includes("half-orc")) fixed.push("orc");
  else if (value.includes("dwarf")) fixed.push("dwarvish");
  else if (value.includes("elf")) fixed.push("elvish");
  else if (value.includes("gnome")) fixed.push("gnomish");
  else if (value.includes("halfling")) fixed.push("halfling");
  else if (value.includes("human")) extraLimit = 1;
  else if (value.includes("tiefling")) fixed.push("infernal");
  return { fixed: Array.from(new Set(fixed)), extraLimit };
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
    const weapon = weaponForEquipmentItem(item);
    if (!weapon || seen.has(weapon.name)) return null;
    seen.add(weapon.name);
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
    const weapon = weaponForEquipmentItem(item);
    if (!weapon || seen.has(weapon.name)) return null;
    seen.add(weapon.name);
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

function featureBlocksMarkup(features = "") {
  const blocks = featureBlocks(features);
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
        </dl>
      </div>
    </article>`).join("")}</div>`;
}

function hitDieSides(classRole = "") {
  return Number(String(classInfo(classRole)?.hitDie || "d8").replace("d", "")) || 8;
}

function classHitDice(level, classRole = "") {
  return `${Math.max(1, Number(level) || 1)}d${hitDieSides(classRole)}`;
}

function raceSpeed(race = "") {
  const value = String(race).toLowerCase();
  if (value.includes("wood elf")) return 35;
  if (value.includes("dwarf") || value.includes("gnome") || value.includes("halfling")) return 25;
  return 30;
}

function armorFormulaFromEquipment(equipment = "") {
  const text = String(equipment).toLowerCase();
  const armors = [
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
  return armors.find((armor) => text.includes(armor.match)) || { base: 10, dex: "full" };
}

function armorClassFromEquipment(dexterityScore, equipment = "", classRole = "", abilities = {}) {
  const dexMod = abilityModifier(dexterityScore);
  const armor = armorFormulaFromEquipment(equipment);
  const shieldBonus = /\bshield\b/i.test(String(equipment)) ? 2 : 0;
  const hasArmor = armor.base !== 10;
  if (!hasArmor) {
    const normalizedClass = String(classRole).toLowerCase();
    if (normalizedClass === "barbarian") return 10 + dexMod + abilityModifier(abilities.constitution) + shieldBonus;
    if (normalizedClass === "monk") return 10 + dexMod + abilityModifier(abilities.wisdom);
  }
  const dexBonus = armor.dex === "none" ? 0 : armor.dex === "max2" ? Math.min(dexMod, 2) : dexMod;
  return armor.base + dexBonus + shieldBonus;
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
  const abilities = Object.fromEntries(ABILITIES.map((ability) => [ability.key, numberFormValue(form, `#player-${ability.key}`)]));
  const proficiencyBonus = proficiencyBonusForLevel(level || 1);
  const skillProficiencies = checkedFormValues(form, "player-skill-proficiencies");
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
    proficiencyBonus,
    savingThrowProficiencies: checkedFormValues(form, "player-saving-throws"),
    skillProficiencies,
    languages: checkedFormValues(form, "player-languages"),
    toolProficiencies: derivedToolProficienciesForClass(classRole),
    combat,
    attacks: [...equipmentAttacks, ...manualAttacks],
    personality: {
      traits: formValue(form, "#player-personality-traits"),
      ideals: formValue(form, "#player-ideals"),
      bonds: formValue(form, "#player-bonds"),
      flaws: formValue(form, "#player-flaws"),
    },
    equipment,
    features: formValue(form, "#player-features"),
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

function campaignStartContent(players, description = "") {
  const summary = players.length
    ? `\n\nParty summary:\n${players.map((player) => `- ${player.playerName}: ${player.characterName}${player.classRole ? `, ${player.classRole}` : ""}${player.level ? ` level ${player.level}` : ""}`).join("\n")}`
    : "";
  const intro = description.trim() || "The campaign has started. Party members have been created and are ready for the adventure.";
  return `${intro}${summary}`;
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
    content: campaignStartContent(campaign.players, description),
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
  const nextCampaign = { ...campaign, name: campaignName };
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

function getStoredCollection(key) {
  const raw = localStorage.getItem(STORAGE_KEYS[key]);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return USER_WIDGET_COLLECTIONS.has(key) ? parsed.filter(isUserProducedEntry) : parsed;
  } catch (error) {
    console.warn(`Could not parse ${key} from localStorage`, error);
    return [];
  }
}

function saveCollection(key, collection) {
  const nextCollection = USER_WIDGET_COLLECTIONS.has(key) ? collection.filter(isUserProducedEntry) : collection;
  localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(nextCollection));
}

const DEFAULT_CALENDAR_SETTINGS = {
  weekLength: 7,
  weekdays: ["Moonday", "Tirsday", "Windsday", "Thundersday", "Fireday", "Starday", "Sunday"],
  months: ["Bloomwane", "Highsun", "Goldleaf", "Frostwane"],
  daysPerMonth: 30,
  yearName: "DR",
  currentYear: 1492,
  currentMonthIndex: 0,
};

const WEATHER_OPTIONS = [
  "Clear skies", "Light rain", "Heavy rain", "Silver fog", "Cold wind", "Thunderheads",
  "Warm breeze", "Ashfall", "Glittering frost", "Oppressive heat", "Moonlit calm", "Arcane aurora",
];

function getCalendarSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.calendarSettings);
  if (!raw) return { ...DEFAULT_CALENDAR_SETTINGS, weekdays: [...DEFAULT_CALENDAR_SETTINGS.weekdays], months: [...DEFAULT_CALENDAR_SETTINGS.months] };
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
    };
  } catch (error) {
    console.warn("Could not parse campaign calendar settings", error);
    return { ...DEFAULT_CALENDAR_SETTINGS, weekdays: [...DEFAULT_CALENDAR_SETTINGS.weekdays], months: [...DEFAULT_CALENDAR_SETTINGS.months] };
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

async function uploadImages(files) {
  const selected = Array.from(files || []).filter(Boolean);
  if (!selected.length) return [];
  const formData = new FormData();
  selected.forEach((file) => formData.append("images", file));
  const payload = await fetchJson("/api/uploads/images", { method: "POST", body: formData });
  return payload.images || [];
}

async function imageToDataUrl(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return "";
  if (!file.type.startsWith("image/")) {
    throw new Error("Widget images must be image files.");
  }
  const [image] = await uploadImages([file]);
  return image?.url || "";
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
  const alt = escapeHtml(`${title} image`);
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
  const alt = escapeHtml(`${title} image`);
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

function isUserProducedEntry(entry) {
  return Boolean(entry?.id) && !String(entry.id).startsWith("demo-");
}

function widgetOriginAttribute(entry) {
  return `data-widget-origin="${isUserProducedEntry(entry) ? "user" : "permanent"}"`;
}

function widgetDeleteActionMarkup(entry, label) {
  if (!isUserProducedEntry(entry)) return "";

  return `
          <div class="entry-actions">
            <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(entry.id)}">${escapeHtml(label)}</button>
          </div>`;
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
}

function selectedFilePreviews(files) {
  return Array.from(files || []).filter((file) => file.type.startsWith("image/")).map((file) => ({
    url: URL.createObjectURL(file),
    originalFilename: file.name,
    fileSize: file.size,
    previewOnly: true,
  }));
}

function initImagePickers() {
  document.querySelectorAll("[data-image-picker]").forEach((picker) => {
    const input = picker.querySelector('input[type="file"]');
    const trigger = picker.querySelector("[data-image-trigger]");
    const status = picker.querySelector("[data-image-status]");
    const preview = picker.querySelector("[data-image-preview]");
    const maxFiles = Number(picker.dataset.maxFiles || input?.dataset.maxFiles || 0);
    if (!input || !trigger) return;

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
  backgroundFeatures: "#player-features",
  racialTraits: "#player-features",
  feats: "#player-features",
};

const CHARACTER_SUGGESTION_LABELS = {
  backgrounds: "Background package",
  backgroundFeatures: "Background feature",
  racialTraits: "Species or racial trait",
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

function applyCharacterSuggestion(form, suggestion, textOverride = "") {
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
  const filterToggle = document.getElementById("filter-toggle");
  const filterPanel = document.getElementById("filter-panel");
  const statusButtons = document.querySelectorAll("[data-status-filter]");
  const deleteCampaignButton = document.getElementById("delete-campaign-button");
  let activeStatus = "all";

  function applyFilters() {
    const query = search ? search.value.trim().toLowerCase() : "";
    document.querySelectorAll("[data-searchable]").forEach((card) => {
      const cardStatus = card.dataset.status || "active";
      const matchesStatus = activeStatus === "all" || cardStatus === activeStatus;
      const matchesQuery = !query || (card.dataset.searchable || "").includes(query);
      card.classList.toggle("is-filtered-out", !matchesStatus || !matchesQuery);
    });
  }

  if (search) search.addEventListener("input", applyFilters);
  document.addEventListener("dashboard:rendered", applyFilters);

  statusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeStatus = button.dataset.statusFilter || "all";
      statusButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      applyFilters();
    });
  });

  if (filterToggle && filterPanel) {
    filterToggle.addEventListener("click", () => {
      const isHidden = filterPanel.hasAttribute("hidden");
      filterPanel.toggleAttribute("hidden", !isHidden);
      filterToggle.setAttribute("aria-expanded", String(isHidden));
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

function chooseWidgetImage() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.addEventListener("change", async () => {
      try {
        resolve(await imageToDataUrl(input));
      } catch (error) {
        reject(error);
      }
    }, { once: true });
    input.click();
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

  list.querySelectorAll("[data-image-upload-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const imageDataUrl = await chooseWidgetImage();
        if (!imageDataUrl) return;
        const nextCollection = getStoredCollection(key).map((entry) => (
          entry.id === button.dataset.imageUploadId ? { ...entry, imageDataUrl } : entry
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
  const imageEntry = { imageUrl: player.avatarUrl, imageDataUrl: player.avatarUrl };
  const campaignId = player.campaignId || DEFAULT_CAMPAIGN_ID;
  const armorClass = player.combat?.armorClass || "AC";
  const hitPoints = player.combat?.hitPointMaximum || "HP";
  const passive = playerPassivePerception(player);
  return `
    <article class="content-card entry-card widget-card player-card player-preview-card" data-searchable="${escapeHtml(searchable)}" data-status="active">
      ${widgetImageDisplayMarkup(imageEntry, title)}
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
        <a class="btn btn-secondary" href="${escapeHtml(playerCharacterHref(campaignId, player.id))}">Open sheet</a>
        <button class="btn btn-danger" type="button" data-delete-player-id="${escapeHtml(player.id)}" data-campaign-id="${escapeHtml(campaignId)}">Delete player</button>
      </div>
    </article>`;
}

function renderDashboardOverview() {
  const grid = document.getElementById("campaigns");
  if (!grid) return;
  const campaign = currentCampaign();
  const playerCards = (campaign.players || []).map(playerCharacterCard);
  grid.innerHTML = playerCards.length
    ? playerCards.join("")
    : `<div class="empty-state">No player widgets yet. Create player characters to populate this campaign overview.</div>`;
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
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(encounter)} data-searchable="${escapeHtml(searchable)}" data-status="${escapeHtml(status)}">
          ${widgetImageMarkup(encounter, title)}
          <div class="card-kicker"><span class="status-badge ${statusBadgeClass(status)}">${statusLabel(status)}</span><span>${escapeHtml(tier)}</span></div>
          <h3>${escapeHtml(title)}</h3>
          ${widgetDescriptionMarkup(description)}
          ${widgetTagsMarkup([encounter.createdAt, ...tags])}
${widgetDeleteActionMarkup(encounter, "Delete encounter")}
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
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(location)} data-searchable="${escapeHtml(searchable)}" data-status="${escapeHtml(status)}">
          ${widgetImageMarkup(location, name)}
          <div class="card-kicker"><span class="status-badge ${statusBadgeClass(status)}">${statusLabel(status)}</span><span>${escapeHtml(type)}</span></div>
          <h3>${escapeHtml(name)}</h3>
          ${widgetDescriptionMarkup(description)}
          ${widgetTagsMarkup([location.createdAt, ...tags])}
${widgetDeleteActionMarkup(location, "Delete location")}
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
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(note)} data-searchable="${escapeHtml(searchable)}" data-status="active">
          <div class="card-kicker"><span class="status-badge status-active">${escapeHtml(note.category)}</span><span>Note</span></div>
          <h3>${escapeHtml(note.title)}</h3>
          ${widgetDescriptionMarkup(note.content)}
          ${widgetTagsMarkup([noteDate, "Backlinks soon"])}
${widgetDeleteActionMarkup(note, "Delete note")}
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
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(character)} data-searchable="${escapeHtml(searchable)}" data-status="hidden">
          ${widgetImageMarkup(character, character.name)}
          <div class="card-kicker"><span class="status-badge status-hidden">DM-only</span><span>${escapeHtml(character.role)}</span></div>
          <h3>${escapeHtml(character.name)}</h3>
          ${widgetDescriptionMarkup(character.notes)}
          ${widgetTagsMarkup([`Faction: ${character.faction || "Unaligned"}`, character.createdAt, "NPC"])}
${widgetDeleteActionMarkup(character, "Delete NPC")}
        </article>`;
    },
  });

  renderCollection({
    key: "items",
    listId: "items-list",
    emptyText: "No saved homebrew yet. Add a weapon, spell, monster, rule, or magic item.",
    template: (item) => {
      const status = item.type === "Monster" ? "prepared" : "active";
      const statusLabel = item.type === "Monster" ? "Prepared" : "Active";
      const searchable = textForSearch([item.name, item.type, item.description, "item homebrew monster loot"]);
      return `
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(item)} data-searchable="${escapeHtml(searchable)}" data-status="${status}">
          ${widgetImageMarkup(item, item.name)}
          <div class="card-kicker"><span class="status-badge ${status === "prepared" ? "status-prepared" : "status-active"}">${statusLabel}</span><span>${escapeHtml(item.type)}</span></div>
          <h3>${escapeHtml(item.name)}</h3>
          ${widgetDescriptionMarkup(item.description)}
          ${widgetTagsMarkup([item.createdAt, "Loot & rules"])}
${widgetDeleteActionMarkup(item, "Delete item")}
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
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(event)} data-searchable="${escapeHtml(searchable)}" data-status="prepared">
          ${widgetImageMarkup(event, event.title)}
          <div class="card-kicker"><span class="status-badge status-prepared">Prepared</span><span>${escapeHtml(eventDateLabel(event))}</span></div>
          <h3>${escapeHtml(event.title)}</h3>
          ${widgetDescriptionMarkup(event.description)}
          ${widgetTagsMarkup([event.createdAt, "Session timeline", "Calendar"])}
${widgetDeleteActionMarkup(event, "Delete event")}
        </article>`;
    },
  });

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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    try {
      const collection = getStoredCollection(key);
      collection.unshift(await buildEntry());
      saveCollection(key, collection);
      form.reset();
      resetImagePickers(form);
      populateCalendarFormDefaults();
      renderDashboard();
      renderCampaignCalendar();
    } catch (error) {
      alert(error.message);
    }
  });
}

function initDashboardForms() {
  wireForm("encounter-form", "encounters", async () => ({
    id: createId("encounter"),
    title: document.getElementById("encounter-title").value.trim(),
    tier: document.getElementById("encounter-tier").value.trim(),
    status: document.getElementById("encounter-status").value,
    description: document.getElementById("encounter-description").value.trim(),
    tags: document.getElementById("encounter-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    imageDataUrl: await imageToDataUrl(document.getElementById("encounter-image")),
    createdAt: readableDate(),
  }));

  wireForm("location-form", "locations", async () => ({
    id: createId("location"),
    name: document.getElementById("location-name").value.trim(),
    type: document.getElementById("location-type").value.trim(),
    status: document.getElementById("location-status").value,
    description: document.getElementById("location-description").value.trim(),
    tags: document.getElementById("location-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    imageDataUrl: await imageToDataUrl(document.getElementById("location-image")),
    createdAt: readableDate(),
  }));

  wireForm("note-form", "notes", async () => ({
    id: createId("note"),
    title: document.getElementById("note-title").value.trim(),
    category: document.getElementById("note-category").value,
    content: document.getElementById("note-content").value.trim(),
    createdAt: readableDate(),
    sortAt: Date.now(),
  }));

  wireForm("character-form", "characters", async () => ({
    id: createId("character"),
    name: document.getElementById("character-name").value.trim(),
    role: document.getElementById("character-role").value.trim(),
    faction: document.getElementById("character-faction").value.trim(),
    notes: document.getElementById("character-notes").value.trim(),
    imageDataUrl: await imageToDataUrl(document.getElementById("character-image")),
    createdAt: readableDate(),
  }));

  wireForm("item-form", "items", async () => ({
    id: createId("item"),
    name: document.getElementById("item-name").value.trim(),
    type: document.getElementById("item-type").value,
    description: document.getElementById("item-description").value.trim(),
    imageDataUrl: await imageToDataUrl(document.getElementById("item-image")),
    createdAt: readableDate(),
  }));

  wireForm("event-form", "events", async () => {
    const settings = getCalendarSettings();
    const monthIndex = Number(document.getElementById("event-month")?.value ?? settings.currentMonthIndex);
    const day = Number(document.getElementById("event-day")?.value ?? 1);
    const year = Number(document.getElementById("event-year")?.value ?? settings.currentYear);
    const event = {
      id: createId("event"),
      title: document.getElementById("event-title").value.trim(),
      monthIndex,
      day,
      year,
      description: document.getElementById("event-description").value.trim(),
      imageDataUrl: await imageToDataUrl(document.getElementById("event-image")),
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
        <h1>We could not find that campaign page.</h1>
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
  const hasWeapons = equipmentWeaponSummaries(player).length > 0;
  const nonWeaponEquipmentTags = equipmentTags.filter((item) => !weaponForEquipmentItem(item));
  const equipmentComplete = hasText(player.equipment) && hasText(player.features);
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
      key: "abilities",
      title: "Abilities",
      complete: abilitySectionComplete(player),
      body: `<dl class="section-widget-stat-grid">${ABILITIES.map((ability) => `
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
      key: "equipment",
      title: "Equipment and features",
      complete: equipmentStarted,
      status: equipmentComplete ? "complete" : "partial",
      body: `<div class="equipment-widget-sections">
        ${languageTags.length ? `<section><h4>Languages</h4>${widgetTagsMarkup(languageTags)}</section>` : ""}
        ${toolTags.length ? `<section><h4>Tool proficiencies</h4>${widgetTagsMarkup(toolTags)}</section>` : ""}
        ${hasWeapons ? `<section><h4>Weapons</h4>${equipmentWeaponCardsMarkup(player)}</section>` : ""}
        ${nonWeaponEquipmentTags.length ? `<section><h4>Equipment</h4>${widgetTagsMarkup(nonWeaponEquipmentTags)}</section>` : ""}
        ${hasText(player.features) ? `<section><h4>Features and traits</h4>${featureBlocksMarkup(player.features)}</section>` : ""}
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

      <fieldset class="sheet-form-section sheet-form-identity">
        <legend>Character sheet header</legend>
        <label>Player name<input id="player-name" type="text" placeholder="Player name" required /></label>
        <label>Character name<input id="player-character-name" type="text" placeholder="Character name" required /></label>
        <label>Class<input id="player-class-role" type="text" list="player-class-options" placeholder="Fighter" /></label>
        <label>Level<input id="player-level" type="number" min="1" max="20" step="1" placeholder="1" /></label>
        <label>Race<input id="player-race" type="text" list="player-race-options" placeholder="Human" /></label>
        <label>Alignment<input id="player-alignment" type="text" list="player-alignment-options" placeholder="Neutral Good" /></label>
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
        <legend>Personality and story</legend>
        <label class="full-width">Short description<textarea id="player-description" rows="3" placeholder="What should the table know about this hero?"></textarea></label>
        <label>Personality traits<textarea id="player-personality-traits" rows="3" placeholder="How they behave at the table and in the world..."></textarea></label>
        <label>Ideals<textarea id="player-ideals" rows="3" placeholder="What principles guide them?"></textarea></label>
        <label>Flaws<textarea id="player-flaws" rows="3" placeholder="What can create trouble or drama?"></textarea></label>
        <div class="character-suggestion-workflow full-width">
          <button class="btn btn-secondary" type="button" id="analyze-character-description">Suggest background features and traits</button>
          <span id="character-suggestion-status" aria-live="polite"></span>
          <div class="character-suggestion-panel" id="character-suggestion-panel" hidden></div>
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
        <label class="full-width">Equipment<textarea id="player-equipment-entry" rows="2" placeholder="Write an item, then press Enter: dagger, leather armor, thieves' tools..."></textarea></label>
        <textarea id="player-equipment" hidden aria-hidden="true"></textarea>
        <textarea id="player-features" hidden aria-hidden="true"></textarea>
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
  const scores = Object.fromEntries(ABILITIES.map((ability) => [ability.key, numberFormValue(form, `#player-${ability.key}`)]));
  const classRole = formValue(form, "#player-class-role");
  const race = formValue(form, "#player-race");
  const equipment = formValue(form, "#player-equipment");
  if (level <= 1) clearRolledHitPoints(form);
  ABILITIES.forEach((ability) => {
    const output = document.getElementById(`player-${ability.key}-modifier`);
    if (output) output.textContent = signedModifier(abilityModifier(scores[ability.key]));
  });
  const proficiencyOutput = document.getElementById("player-proficiency-bonus");
  if (proficiencyOutput) proficiencyOutput.textContent = signedModifier(proficiencyBonus);
  const hasPerception = checkedFormValues(form, "player-skill-proficiencies").includes("perception");
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
  const constitution = numberFormValue(form, "#player-constitution");
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
}

function refreshPlayerSectionSummary(form) {
  renderAddedPlayersSummary(getCampaign(form.dataset.campaignId) || currentCampaign());
}

function appendEquipmentItemsToSheet(form, items = []) {
  const equipment = form.querySelector("#player-equipment");
  const nextItems = items.map((item) => item.trim()).filter(Boolean);
  if (!equipment || !nextItems.length) return;
  const currentItems = equipmentItems(equipment.value);
  equipment.value = [...currentItems, ...nextItems].join("\n");
  equipment.dispatchEvent(new Event("input", { bubbles: true }));
}

function commitEquipmentDraft(form, { includeCurrent = false } = {}) {
  const draft = form.querySelector("#player-equipment-entry");
  if (!draft) return;
  const lines = String(draft.value || "").split(/\n+/);
  const completed = includeCurrent ? lines : lines.slice(0, -1);
  appendEquipmentItemsToSheet(form, completed);
  draft.value = includeCurrent ? "" : (lines.at(-1) || "");
}

function allowedSkillKeysForClass(info) {
  if (!info) return new Set(SKILLS.map((skill) => skill.key));
  if (info.skillChoices === "any") return new Set(SKILLS.map((skill) => skill.key));
  return new Set(info.skillChoices || []);
}

function enforceSkillLimit(form, info) {
  const skillInputs = Array.from(form.querySelectorAll?.('input[name="player-skill-proficiencies"]') || []);
  const checked = skillInputs.filter((input) => input.checked);
  const limit = info?.skillLimit || checked.length;
  checked.forEach((input, index) => {
    if (index >= limit) input.checked = false;
  });
  if (!info) return;
  const allowedSkills = allowedSkillKeysForClass(info);
  const selectedCount = skillInputs.filter((input) => input.checked).length;
  const limitReached = selectedCount >= limit;
  skillInputs.forEach((input) => {
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
    if (["player-class-role", "player-level", "player-constitution"].includes(event.target?.id)) clearRolledHitPoints(form);
    if (event.target?.id === "player-class-role" || event.target?.id === "player-race") applyClassRestrictions(form);
    updatePlayerFormDerivedFields(form);
    refreshPlayerSectionSummary(form);
  });
  form.addEventListener("change", (event) => {
    if (["player-class-role", "player-level", "player-constitution"].includes(event.target?.id)) clearRolledHitPoints(form);
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
  player.avatarUrl = await imageToDataUrl(document.getElementById("player-avatar"));
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

function playerAttackRows(player) {
  const attacks = player.attacks?.length ? player.attacks : [{ name: "", attackBonus: "", damageType: "" }];
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
          ${sheetTextBlock("Equipment", player.equipment)}
        </section>

        <section class="sheet-column">
          ${sheetTextBlock("Personality Traits", player.personality?.traits)}
          ${sheetTextBlock("Ideals", player.personality?.ideals)}
          ${sheetTextBlock("Bonds", player.personality?.bonds)}
          ${sheetTextBlock("Flaws", player.personality?.flaws)}
          ${sheetTextBlock("Features & Traits", player.features)}
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

function initCalendarPage() {
  const settingsForm = document.getElementById("calendar-settings-form");
  const prev = document.getElementById("calendar-prev");
  const next = document.getElementById("calendar-next");
  const weatherButton = document.getElementById("weather-generate");
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
      saveCalendarSettings({
        ...getCalendarSettings(),
        weekLength,
        weekdays,
        months: months.length ? months : [...DEFAULT_CALENDAR_SETTINGS.months],
        daysPerMonth: Math.max(1, Number(document.getElementById("calendar-days-per-month").value) || 30),
        yearName: document.getElementById("calendar-year-name").value.trim() || "Year",
        currentYear: Number(document.getElementById("calendar-active-year").value) || settings.currentYear,
        currentMonthIndex: 0,
      });
      populateCalendarFormDefaults();
      renderCampaignCalendar();
      renderDashboard();
    });
  }

  if (prev) prev.addEventListener("click", () => {
    const current = getCalendarSettings();
    current.currentMonthIndex -= 1;
    if (current.currentMonthIndex < 0) { current.currentMonthIndex = current.months.length - 1; current.currentYear -= 1; }
    saveCalendarSettings(current); populateCalendarFormDefaults(); renderCampaignCalendar(); renderDashboard();
  });
  if (next) next.addEventListener("click", () => {
    const current = getCalendarSettings();
    current.currentMonthIndex += 1;
    if (current.currentMonthIndex >= current.months.length) { current.currentMonthIndex = 0; current.currentYear += 1; }
    saveCalendarSettings(current); populateCalendarFormDefaults(); renderCampaignCalendar(); renderDashboard();
  });
  if (weatherButton) weatherButton.addEventListener("click", () => {
    const current = getCalendarSettings();
    const weather = getWeatherMap();
    for (let day = 1; day <= current.daysPerMonth; day += 1) {
      weather[weatherKey(current.currentYear, current.currentMonthIndex, day)] = WEATHER_OPTIONS[Math.floor(Math.random() * WEATHER_OPTIONS.length)];
    }
    saveWeatherMap(weather); renderCampaignCalendar(); renderDashboard();
  });
  if (modal) {
    modal.addEventListener("click", (event) => { if (event.target === modal || event.target.matches("[data-close-modal]")) modal.hidden = true; });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") modal.hidden = true; });
  }
  renderCampaignCalendar();
}

initMobileNavigation();
if (!initCampaignRoutes()) {
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
  if (window.location.hash.startsWith("#/campaigns")) initCampaignRoutes();
  else if (document.querySelector(".character-page, .setup-page")) window.location.reload();
});

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
