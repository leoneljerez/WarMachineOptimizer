export const abilitiesData = {
  dmg_1x_150: {
    description: "Deals 150% of its damage to 1 enemy.",
    effect: "damage",
    targets: "enemy",
    targeting: "random",
    numTargets: 1,
    scaleStat: "damage",
    multiplier: 1.5,
  },

  dmg_1x_160: {
    description: "Deals 160% of its damage to 1 enemy.",
    effect: "damage",
    targets: "enemy",
    targeting: "random",
    numTargets: 1,
    scaleStat: "damage",
    multiplier: 1.6,
  },

  dmg_1x_200: {
    description: "Deals 200% of its damage to 1 enemy.",
    effect: "damage",
    targets: "enemy",
    targeting: "random",
    numTargets: 1,
    scaleStat: "damage",
    multiplier: 2.0,
  },

  dmg_2x_60: {
    description: "Deals 60% of its damage to 2 random enemies.",
    effect: "damage",
    targets: "enemy",
    targeting: "random",
    numTargets: 2,
    scaleStat: "damage",
    multiplier: 0.6,
  },

  dmg_2x_130: {
    description: "Deals 130% of its damage to 2 random enemies.",
    effect: "damage",
    targets: "enemy",
    targeting: "random",
    numTargets: 2,
    scaleStat: "damage",
    multiplier: 1.3,
  },

  dmg_3x_120: {
    description: "Deals 120% of its damage to 3 random enemies.",
    effect: "damage",
    targets: "enemy",
    targeting: "random",
    numTargets: 3,
    scaleStat: "damage",
    multiplier: 1.2,
  },

  dmg_all_60: {
    description: "Deals 60% of its damage to all enemies.",
    effect: "damage",
    targets: "enemy",
    targeting: "all",
    numTargets: 5,
    scaleStat: "damage",
    multiplier: 0.6,
  },

  dmg_all_80: {
    description: "Deals 80% of its damage to all enemies.",
    effect: "damage",
    targets: "enemy",
    targeting: "all",
    numTargets: 5,
    scaleStat: "damage",
    multiplier: 0.8,
  },

  heal_lowest_1x_300: {
    description: "Heals the lowest-health ally for 300% of its damage.",
    effect: "heal",
    targets: "ally",
    targeting: "lowest",
    numTargets: 1,
    scaleStat: "damage",
    multiplier: 3.0,
  },

  heal_random_2x_360: {
    description: "Heals 2 random allies for 360% of its damage.",
    effect: "heal",
    targets: "ally",
    targeting: "random",
    numTargets: 2,
    scaleStat: "damage",
    multiplier: 3.6,
  },

  heal_all_150: {
    description: "Heals all allies for 150% of its damage.",
    effect: "heal",
    targets: "ally",
    targeting: "all",
    numTargets: 5,
    scaleStat: "damage",
    multiplier: 1.5,
  },

  heal_self_hp_10: {
    description: "Heals itself for 10% of its maximum health.",
    effect: "heal",
    targets: "self",
    targeting: "self",
    numTargets: 1,
    scaleStat: "health",
    multiplier: 0.1,
  },
};
