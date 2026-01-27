export const abilitiesData = {
	dmg_1x_150: {
		description: "Throws a fireball that deals 150% of its damage.",
		effect: "damage",
		targets: "enemy",
		targeting: "random",
		numTargets: 1,
		scaleStat: "damage",
		multiplier: 1.5,
	},

	dmg_1x_160: {
		description: "Activates an energy beam that deals 160% of its damage.",
		effect: "damage",
		targets: "enemy",
		targeting: "random",
		numTargets: 1,
		scaleStat: "damage",
		multiplier: 1.6,
	},

	dmg_1x_200: {
		description: "Launches a rocket that deals 200% of its damage.",
		effect: "damage",
		targets: "enemy",
		targeting: "random",
		numTargets: 1,
		scaleStat: "damage",
		multiplier: 2.0,
	},

	dmg_2x_60: {
		description: "Fires cannonballs at 2 random war machines that deal 60% of its damage.",
		effect: "damage",
		targets: "enemy",
		targeting: "random",
		numTargets: 2,
		scaleStat: "damage",
		multiplier: 0.6,
	},

	dmg_2x_130: {
		description: "Attack the last 2 war machines in the enemy formation with an energy beam that deals 130% of its damage.",
		effect: "damage",
		targets: "enemy",
		targeting: "last",
		numTargets: 2,
		scaleStat: "damage",
		multiplier: 1.3,
	},

	dmg_3x_120: {
		description: "Electrifies 3 random war machines for 120% of its damage.",
		effect: "damage",
		targets: "enemy",
		targeting: "random",
		numTargets: 3,
		scaleStat: "damage",
		multiplier: 1.2,
	},

	dmg_all_60: {
		description: "Launches rockets that deal 60% of its damage to all enemy war machines.",
		effect: "damage",
		targets: "enemy",
		targeting: "all",
		numTargets: 5,
		scaleStat: "damage",
		multiplier: 0.6,
	},

	dmg_all_80: {
		description: "Slams the ground and causes an earthquake that deals 80% of its damage to all enemy war machines.",
		effect: "damage",
		targets: "enemy",
		targeting: "all",
		numTargets: 5,
		scaleStat: "damage",
		multiplier: 0.8,
	},

	heal_lowest_1x_300: {
		description: "Heals the ally war machine with the lowest percentage of health for 300% of its damage.",
		effect: "heal",
		targets: "ally",
		targeting: "lowest",
		numTargets: 1,
		scaleStat: "damage",
		multiplier: 3.0,
	},

	heal_random_2x_350: {
		description: "Heals 2 random ally war machines for 350% of its damage.",
		effect: "heal",
		targets: "ally",
		targeting: "random",
		numTargets: 2,
		scaleStat: "damage",
		multiplier: 3.5,
	},

	heal_all_150: {
		description: "Heals all your war machines for 150% of its damage.",
		effect: "heal",
		targets: "ally",
		targeting: "all",
		numTargets: 5,
		scaleStat: "damage",
		multiplier: 1.5,
	},

	heal_self_hp_10: {
		description: "Restores 10% of your maximum health.",
		effect: "heal",
		targets: "self",
		targeting: "self",
		numTargets: 1,
		scaleStat: "health",
		multiplier: 0.1,
	},
};
