const CHARACTER_SUGGESTION_CATEGORIES = {
  backgrounds: "Background package",
  backgroundFeatures: "Background feature",
  racialTraits: "Species or racial trait",
  feats: "Feat or talent",
};

const ALLOWED_CHARACTER_SUGGESTIONS = {
  backgrounds: [
    {
      id: "background-acolyte",
      label: "Acolyte",
      description: "A faith-shaped background for characters tied to temples, orders, gods, or ritual service.",
      mechanics: "Suggest Insight and Religion proficiency, plus two extra languages or equivalent table-approved choices.",
      source: "SRD 5.1 / SRD 5.2",
      tags: ["acolyte", "temple", "faith", "god", "priest", "prayer", "religion", "divine", "ritual", "sacred"],
    },
    {
      id: "background-criminal",
      label: "Criminal",
      description: "A background for characters shaped by crime, espionage, smuggling, or underworld contacts.",
      mechanics: "Suggest Deception and Stealth proficiency, plus thieves' tools when appropriate.",
      source: "SRD 5.2",
      tags: ["criminal", "crime", "thief", "steal", "smuggle", "spy", "underworld", "gang", "lock", "secret"],
    },
    {
      id: "background-sage",
      label: "Sage",
      description: "A knowledge-focused background for scholars, researchers, archivists, and arcane students.",
      mechanics: "Suggest Arcana and History proficiency, plus scholarly tools or languages when appropriate.",
      source: "SRD 5.2",
      tags: ["sage", "scholar", "library", "book", "study", "research", "arcane", "history", "wizard", "university", "lore"],
    },
    {
      id: "background-soldier",
      label: "Soldier",
      description: "A military background for veterans, guards, mercenaries, officers, or trained fighters.",
      mechanics: "Suggest Athletics and Intimidation proficiency, plus military contacts, gaming set, or vehicle training if your table uses them.",
      source: "SRD 5.2",
      tags: ["soldier", "army", "guard", "war", "battle", "veteran", "mercenary", "commander", "rank", "patrol"],
    },
  ],
  backgroundFeatures: [
    {
      id: "background-feature-shelter-faithful",
      label: "Shelter of the Faithful",
      description: "Faith communities recognize the character and can offer modest aid or sanctuary.",
      mechanics: "Use as a social-access feature tied to temples, shrines, priests, and worshippers.",
      source: "SRD 5.1",
      tags: ["temple", "faith", "shelter", "sanctuary", "priest", "religion", "pilgrim", "sacred", "church"],
    },
    {
      id: "background-feature-underworld-contact",
      label: "Underworld Contact",
      description: "The character knows how to reach criminal intermediaries, fences, spies, or smugglers.",
      mechanics: "Use as a contact-network feature for illicit information, favors, or black-market access.",
      source: "5E-compatible custom feature",
      tags: ["criminal", "contact", "spy", "smuggler", "fence", "thief", "underworld", "secret", "blackmail"],
    },
    {
      id: "background-feature-researcher",
      label: "Researcher",
      description: "The character knows where to look for lore and who might hold obscure information.",
      mechanics: "Use as a knowledge-access feature for libraries, sages, archives, and specialists.",
      source: "5E-compatible custom feature",
      tags: ["research", "library", "archive", "sage", "book", "lore", "history", "knowledge", "scholar"],
    },
    {
      id: "background-feature-military-rank",
      label: "Military Rank",
      description: "The character's service record carries weight with soldiers or military institutions.",
      mechanics: "Use as an authority/contact feature for guards, armies, veterans, and chain-of-command scenes.",
      source: "5E-compatible custom feature",
      tags: ["soldier", "rank", "army", "guard", "officer", "veteran", "commander", "military", "war"],
    },
  ],
  racialTraits: [
    {
      id: "racial-trait-darkvision",
      label: "Darkvision",
      description: "A strong fit for characters from underground, nocturnal, infernal, elven, dwarven, or shadow-touched origins.",
      mechanics: "Suggest limited vision in darkness if the chosen species supports it.",
      source: "SRD 5.1 racial traits",
      tags: ["dark", "night", "underground", "cave", "dwarf", "elf", "tiefling", "shadow", "nocturnal"],
    },
    {
      id: "racial-trait-fey-ancestry",
      label: "Fey Ancestry",
      description: "A fit for characters with elven, fey, dreamlike, or enchantment-resistant heritage.",
      mechanics: "Suggest resistance against charm or sleep-style magic if the chosen species supports it.",
      source: "SRD 5.1 racial traits",
      tags: ["elf", "fey", "dream", "charm", "enchantment", "trance", "forest", "ancient"],
    },
    {
      id: "racial-trait-draconic-ancestry",
      label: "Draconic Ancestry",
      description: "A fit for characters marked by dragon blood, scales, breath, or elemental heritage.",
      mechanics: "Suggest a dragon-linked damage type, breath weapon, or resistance if the chosen species supports it.",
      source: "SRD 5.1 racial traits",
      tags: ["dragon", "draconic", "scale", "breath", "fire", "acid", "lightning", "cold", "poison"],
    },
    {
      id: "racial-trait-relentless-endurance",
      label: "Relentless Endurance",
      description: "A fit for characters described as refusing to fall, surviving impossible wounds, or fighting past collapse.",
      mechanics: "Suggest a once-per-rest survival-at-the-edge trait if the chosen species supports it.",
      source: "SRD 5.1 racial traits",
      tags: ["endure", "survive", "wound", "collapse", "orc", "half-orc", "tough", "stubborn", "death"],
    },
    {
      id: "racial-trait-lucky",
      label: "Lucky",
      description: "A fit for characters whose story repeatedly turns on unlikely fortune or narrow escapes.",
      mechanics: "Suggest reroll-style luck mechanics if the chosen species or table options support them.",
      source: "SRD 5.1 racial traits",
      tags: ["lucky", "luck", "fortune", "escape", "chance", "halfling", "gamble", "miracle"],
    },
  ],
  feats: [
    {
      id: "feat-alert",
      label: "Alert",
      description: "A talent for characters who are watchful, paranoid, tactical, or hard to ambush.",
      mechanics: "Suggest initiative or surprise-related benefits if your rules version/table allows this feat.",
      source: "SRD 5.2 feat",
      tags: ["alert", "watch", "ambush", "paranoid", "scout", "guard", "initiative", "danger", "ready"],
    },
    {
      id: "feat-magic-initiate",
      label: "Magic Initiate",
      description: "A talent for characters with minor magical training, a supernatural mentor, or awakened power.",
      mechanics: "Suggest a small spell package from an appropriate magical tradition if your table allows this feat.",
      source: "SRD 5.2 feat",
      tags: ["magic", "spell", "cantrip", "mentor", "arcane", "divine", "druid", "warlock", "power"],
    },
    {
      id: "feat-savage-attacker",
      label: "Savage Attacker",
      description: "A talent for brutal melee combatants, duelists, raiders, or characters defined by weapon violence.",
      mechanics: "Suggest weapon damage reliability or reroll-style melee benefits if your table allows this feat.",
      source: "SRD 5.2 feat",
      tags: ["savage", "weapon", "melee", "brutal", "raider", "berserk", "axe", "sword", "violence"],
    },
    {
      id: "feat-grappler",
      label: "Grappler",
      description: "A talent for wrestlers, brawlers, pit fighters, guards, or characters who control enemies physically.",
      mechanics: "Suggest grapple-focused combat benefits if your table allows this feat.",
      source: "SRD 5.1 feat",
      tags: ["grapple", "wrestle", "brawl", "hold", "pin", "pit", "fighter", "guard", "strong"],
    },
    {
      id: "feat-ability-score-improvement",
      label: "Ability Score Improvement",
      description: "A broad talent for characters whose description strongly emphasizes training, discipline, or innate aptitude.",
      mechanics: "Suggest improving one or two ability scores based on the character concept if your rules version/table allows it.",
      source: "SRD 5.2 feat",
      tags: ["training", "discipline", "strong", "smart", "wise", "agile", "charismatic", "tough", "practice"],
    },
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
