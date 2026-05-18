const CHARACTER_SUGGESTION_CATEGORIES = {
  traits: "Personality traits",
  ideals: "Ideals",
  bonds: "Bonds",
  flaws: "Flaws",
  features: "Appearance and behavior features",
};

const ALLOWED_CHARACTER_SUGGESTIONS = {
  traits: [
    { id: "trait-devout", label: "Devout", description: "Openly guided by faith, ritual, or sacred duty.", tags: ["faith", "temple", "god", "prayer", "sacred", "religion", "divine"] },
    { id: "trait-curious", label: "Curious", description: "Drawn toward mysteries, old lore, and unexplained signs.", tags: ["curious", "question", "mystery", "research", "lore", "book", "investigate"] },
    { id: "trait-guarded", label: "Guarded", description: "Slow to trust and careful about revealing motives.", tags: ["secret", "alone", "trust", "guarded", "quiet", "hidden", "cautious"] },
    { id: "trait-bold", label: "Bold", description: "Takes the first step when danger or opportunity appears.", tags: ["brave", "bold", "reckless", "charge", "fearless", "danger", "hero"] },
    { id: "trait-compassionate", label: "Compassionate", description: "Notices suffering and tries to protect vulnerable people.", tags: ["kind", "mercy", "protect", "heal", "help", "orphan", "poor", "innocent"] },
    { id: "trait-pragmatic", label: "Pragmatic", description: "Values workable plans over perfect principles.", tags: ["practical", "survive", "survival", "efficient", "plan", "work", "trade"] },
    { id: "trait-proud", label: "Proud", description: "Protects reputation, lineage, skill, or personal honor.", tags: ["pride", "proud", "honor", "lineage", "noble", "reputation", "legacy"] },
    { id: "trait-mischievous", label: "Mischievous", description: "Uses humor, tricks, or charm to shape tense moments.", tags: ["joke", "trick", "charm", "laugh", "mischief", "prank", "perform"] },
  ],
  ideals: [
    { id: "ideal-duty", label: "Duty", description: "Personal choices are measured against a responsibility to others.", tags: ["duty", "oath", "serve", "service", "responsibility", "order", "law"] },
    { id: "ideal-freedom", label: "Freedom", description: "Chains, tyrants, and forced obedience should be broken.", tags: ["freedom", "liberty", "escape", "rebel", "chains", "tyrant", "oppression"] },
    { id: "ideal-knowledge", label: "Knowledge", description: "Truth and understanding are worth risk and sacrifice.", tags: ["knowledge", "truth", "learn", "secret", "study", "library", "arcane"] },
    { id: "ideal-redemption", label: "Redemption", description: "A person can atone for old mistakes through action.", tags: ["redemption", "guilt", "atone", "forgive", "sin", "mistake", "past"] },
    { id: "ideal-power", label: "Power", description: "Strength, influence, or magic is the surest path to safety.", tags: ["power", "strong", "control", "ambition", "influence", "magic", "dominate"] },
    { id: "ideal-community", label: "Community", description: "A life matters most through the people it protects and supports.", tags: ["family", "village", "home", "community", "friends", "people", "kin"] },
  ],
  bonds: [
    { id: "bond-family", label: "Family or Found Family", description: "A living family, adopted kin, or chosen group anchors the character.", tags: ["family", "sibling", "parent", "child", "clan", "kin", "crew"] },
    { id: "bond-lost-home", label: "Lost Home", description: "A destroyed, stolen, or unreachable home still defines the character.", tags: ["home", "village", "destroyed", "exile", "homeland", "burned", "lost"] },
    { id: "bond-sacred-cause", label: "Sacred Cause", description: "A temple, order, prophecy, or vow binds the character to action.", tags: ["temple", "order", "prophecy", "vow", "sacred", "faith", "relic"] },
    { id: "bond-mentor", label: "Mentor or Patron", description: "A teacher, patron, commander, or benefactor remains important.", tags: ["mentor", "teacher", "master", "patron", "commander", "trainer", "elder"] },
    { id: "bond-rival", label: "Rival or Enemy", description: "A named rival, enemy, or betrayer shapes the next move.", tags: ["rival", "enemy", "betray", "revenge", "nemesis", "hunter", "vendetta"] },
    { id: "bond-treasure", label: "Heirloom or Relic", description: "An object, keepsake, map, weapon, or relic carries emotional weight.", tags: ["heirloom", "relic", "weapon", "ring", "map", "keepsake", "artifact"] },
  ],
  flaws: [
    { id: "flaw-vengeful", label: "Vengeful", description: "Old wounds can override caution or mercy.", tags: ["revenge", "vengeance", "hate", "anger", "betray", "enemy", "punish"] },
    { id: "flaw-naive", label: "Naive", description: "Trusts appearances, promises, or hopeful stories too readily.", tags: ["naive", "trust", "innocent", "believe", "hope", "sheltered", "gullible"] },
    { id: "flaw-greedy", label: "Greedy", description: "Treasure, status, or rare knowledge can bend judgment.", tags: ["gold", "money", "treasure", "greed", "rich", "reward", "status"] },
    { id: "flaw-secretive", label: "Secretive", description: "Hides important truths even when honesty would help.", tags: ["secret", "lie", "hidden", "mask", "past", "cover", "spy"] },
    { id: "flaw-reckless", label: "Reckless", description: "Acts before the danger is fully understood.", tags: ["reckless", "rush", "charge", "danger", "impulsive", "gamble", "risk"] },
    { id: "flaw-arrogant", label: "Arrogant", description: "Underestimates others and overvalues personal skill or rank.", tags: ["arrogant", "proud", "noble", "better", "superior", "rank", "ego"] },
  ],
  features: [
    { id: "feature-scarred", label: "Visible scars", description: "Marks of battle, punishment, accident, or survival.", tags: ["scar", "scarred", "burn", "wound", "battle", "survivor", "injury"] },
    { id: "feature-ritual-marks", label: "Ritual marks or tattoos", description: "Body marks tied to vows, culture, magic, or devotion.", tags: ["tattoo", "mark", "rune", "ritual", "symbol", "ink", "brand"] },
    { id: "feature-worn-gear", label: "Worn practical gear", description: "Clothing and tools show travel, work, and hard survival.", tags: ["worn", "travel", "cloak", "gear", "boots", "pack", "survival"] },
    { id: "feature-noble-bearing", label: "Noble bearing", description: "Speech, posture, or dress suggests courtly training or high status.", tags: ["noble", "court", "elegant", "fine", "posture", "status", "house"] },
    { id: "feature-restless-habit", label: "Restless habit", description: "A repeated gesture reveals nerves, impatience, or constant alertness.", tags: ["nervous", "fidget", "restless", "watch", "alert", "twitch", "habit"] },
    { id: "feature-symbolic-token", label: "Symbolic token", description: "Carries a keepsake, holy sign, trophy, or reminder of a bond.", tags: ["token", "amulet", "keepsake", "holy", "symbol", "locket", "trophy"] },
    { id: "feature-quiet-watchful", label: "Quiet and watchful", description: "Body language shows observation before action.", tags: ["quiet", "watch", "observe", "silent", "cautious", "listen", "shadow"] },
    { id: "feature-bright-presence", label: "Bright presence", description: "Memorable voice, color, smile, or performance energy fills a room.", tags: ["bright", "color", "smile", "loud", "song", "perform", "charm"] },
  ],
};

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
  allAllowedSuggestionIds,
  findAllowedSuggestion,
};
