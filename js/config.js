// config.js
/**
 * Centralized configuration for War Machine Optimizer
 * All game constants and magic numbers should be defined here
 */

import Decimal from "./vendor/break_eternity.esm.js";

export const AppConfig = {
	// ========================================
	// Application Settings
	// ========================================

	/**
	 * Application version for save compatibility tracking
	 * @type {string}
	 */
	APP_VERSION: "1.0.0",

	/**
	 * Maximum number of profiles allowed
	 * @type {number}
	 */
	MAX_PROFILES: 5,

	/**
	 * Default profile name for first profile
	 * @type {string}
	 */
	DEFAULT_PROFILE_NAME: "Main Account",

	// ========================================
	// Campaign Settings
	// ========================================

	/**
	 * Difficulty levels with display properties and multipliers
	 * Order matters: used for progression display and "highest clear" logic
	 * @type {DifficultyConfig[]}
	 */
	DIFFICULTIES: [
		{ key: "easy", label: "Easy", color: "success", multiplier: new Decimal(1) },
		{ key: "normal", label: "Normal", color: "info", multiplier: new Decimal(360) },
		{ key: "hard", label: "Hard", color: "warning", multiplier: new Decimal(2478600) },
		{ key: "insane", label: "Insane", color: "danger", multiplier: new Decimal("5.8e+12") },
		{ key: "nightmare", label: "Nightmare", color: "light", multiplier: new Decimal("2.92e+18") },
	],

	/**
	 * Maximum number of missions per difficulty level
	 * @type {number}
	 */
	MAX_MISSIONS_PER_DIFFICULTY: 90,

	/**
	 * Gets total possible stars (calculated from difficulties and missions)
	 * @returns {number}
	 */
	get MAX_TOTAL_STARS() {
		return this.DIFFICULTIES.length * this.MAX_MISSIONS_PER_DIFFICULTY;
	},

	/**
	 * Gets difficulty multiplier by key
	 * @param {string} difficultyKey - Difficulty key (e.g., "easy", "hard")
	 * @returns {Decimal} Multiplier for that difficulty
	 */
	getDifficultyMultiplier(difficultyKey) {
		const difficulty = this.DIFFICULTIES.find((d) => d.key === difficultyKey);
		return difficulty ? difficulty.multiplier : new Decimal(1);
	},

	/**
	 * Gets all difficulty keys in order
	 * @returns {string[]}
	 */
	get DIFFICULTY_KEYS() {
		return this.DIFFICULTIES.map((d) => d.key);
	},

	// ========================================
	// Battle Settings
	// ========================================

	/**
	 * Maximum number of combat rounds before battle is considered a draw
	 * @type {number}
	 */
	MAX_BATTLE_ROUNDS: 20,

	/**
	 * Attack order for targeting enemies (position indices 0-4)
	 * @type {number[]}
	 */
	ATTACK_ORDER: [0, 1, 2, 4, 3],

	/**
	 * Number of machines in a formation
	 * @type {number}
	 */
	FORMATION_SIZE: 5,

	// ========================================
	// Optimization Settings
	// ========================================

	/**
	 * How often to reoptimize crew assignments during campaign push
	 * @type {number}
	 */
	REOPTIMIZE_INTERVAL: 5,

	/**
	 * Number of Monte Carlo simulations per mission/difficulty test
	 * Higher = more accurate but slower
	 * @type {number}
	 */
	MONTE_CARLO_SIMULATIONS: 20000,

	/**
	 * Maximum consecutive failures before stopping difficulty progression
	 * @type {number}
	 */
	MAX_CONSECUTIVE_FAILURES: 2,

	// ========================================
	// Crew & Hero Settings
	// ========================================

	/**
	 * Crew slot thresholds based on engineer level
	 * @type {Array<{minLevel: number, slots: number}>}
	 */
	CREW_SLOT_THRESHOLDS: [
		{ minLevel: 60, slots: 6 },
		{ minLevel: 30, slots: 5 },
		{ minLevel: 0, slots: 4 },
	],

	/**
	 * Calculates maximum crew slots based on engineer level
	 * @param {number} engineerLevel - Engineer level
	 * @returns {number} Maximum crew slots (4, 5, or 6)
	 */
	getMaxCrewSlots(engineerLevel) {
		const threshold = this.CREW_SLOT_THRESHOLDS.find((t) => engineerLevel >= t.minLevel);
		return threshold ? threshold.slots : 4;
	},

	/**
	 * Hero scoring weights for optimization
	 * Used in Optimizer.scoreHeroForMachine()
	 */
	HERO_SCORING: {
		CAMPAIGN: {
			TANK: { damage: 0.1, health: 12.0, armor: 8.0 },
			DPS: { damage: 15.0, health: 0.1, armor: 0.1 },
		},
		ARENA: {
			TANK: { damage: 1.0, health: 6.0, armor: 3.0 },
			DPS: { damage: 6.0, health: 3.0, armor: 1.0 },
		},
	},

	// ========================================
	// Stat Calculation Constants
	// ========================================

	/**
	 * Base enemy stats for mission 1
	 * All enemies scale from these values
	 */
	BASE_ENEMY_STATS: {
		damage: new Decimal(260),
		health: new Decimal(1560),
		armor: new Decimal(30),
	},

	/**
	 * Mission scaling factor (per mission)
	 * Each mission multiplies stats by this value
	 * @type {number}
	 */
	MISSION_SCALE_FACTOR: 1.2,

	/**
	 * Milestone scaling factor
	 * Applied every 10 missions for regular enemy scaling
	 * @type {number}
	 */
	MILESTONE_SCALE_FACTOR: 3,

	/**
	 * Milestone scaling factor for power requirements
	 * Lower than regular milestone scaling to make power checks more lenient
	 * @type {number}
	 */
	POWER_REQUIREMENT_MILESTONE_FACTOR: 2,

	/**
	 * Level bonus base multiplier
	 * Each level adds (1.05^level - 1) as bonus
	 * @type {number}
	 */
	LEVEL_BONUS_BASE: 1.05,

	/**
	 * Overdrive base chance (for ability triggers)
	 * @type {number}
	 */
	OVERDRIVE_BASE: 0.25,

	/**
	 * Overdrive increase per rarity level
	 * @type {number}
	 */
	OVERDRIVE_PER_RARITY: 0.03,

	/**
	 * Power calculation weights and exponents
	 * Used in Calculator.computeMachinePower()
	 */
	POWER_CALCULATION: {
		DAMAGE_WEIGHT: 10,
		HEALTH_WEIGHT: 1,
		ARMOR_WEIGHT: 10,
		SCALING_EXPONENT: 0.7,
	},

	/**
	 * Mission win power requirement percentages
	 * Used in Calculator.requiredPowerForMission()
	 */
	POWER_REQUIREMENTS: {
		EASY_EARLY: { maxMission: 10, percentage: 0.3 }, // Missions 1-10
		EASY_MID: { maxMission: 30, percentage: 0.5 }, // Missions 11-30
		DEFAULT: { percentage: 0.8 }, // All others
	},

	// ========================================
	// Rarity/Evolution System
	// ========================================

	/**
	 * Rarity/Evolution level mappings
	 * Used for stat calculations and UI display
	 * @type {Array<{key: string, label: string, level: number}>}
	 */
	RARITIES: [
		{ key: "common", label: "Common", level: 0 },
		{ key: "uncommon", label: "Uncommon", level: 1 },
		{ key: "rare", label: "Rare", level: 2 },
		{ key: "epic", label: "Epic", level: 3 },
		{ key: "legendary", label: "Legendary", level: 4 },
		{ key: "mythic", label: "Mythic", level: 5 },
		{ key: "titan", label: "Titan", level: 6 },
		{ key: "angel", label: "Angel", level: 7 },
		{ key: "celestial", label: "Celestial", level: 8 },
	],

	GUARDIAN_RARITIES: [
		{ key: "common", label: "Common", level: 0 },
		{ key: "uncommon", label: "Uncommon", level: 1 },
		{ key: "rare", label: "Rare", level: 2 },
		{ key: "epic", label: "Epic", level: 3 },
		{ key: "legendary", label: "Legendary", level: 4 },
		{ key: "mythic", label: "Mythic", level: 5 },
		{ key: "titan", label: "Titan", level: 6 },
		{ key: "angel", label: "Angel", level: 7 },
	],

	/**
	 * Icon rank tiers matching the game
	 * Each tier represents a different visual style/color of the icon
	 */
	ICON_RANK_TIERS: [
		{ key: "bronze", label: "Bronze" },
		{ key: "silver", label: "Silver" },
		{ key: "gold", label: "Gold" },
		{ key: "platinum", label: "Platinum" },
		{ key: "ruby", label: "Ruby" },
		{ key: "sapphire", label: "Sapphire" },
		{ key: "pearl", label: "Pearl" },
		{ key: "diamond", label: "Diamond" },
		{ key: "starlight", label: "Starlight" },
		{ key: "starlightPlus", label: "Starlight Plus" },
	],

	/**
	 * Guardian evolution categories for rank selection
	 */
	GUARDIAN_EVOLUTIONS: [
		{ key: "bronze", label: "Bronze" },
		{ key: "silver", label: "Silver" },
		{ key: "gold", label: "Gold" },
		{ key: "platinum", label: "Platinum" },
		{ key: "ruby", label: "Ruby" },
		{ key: "sapphire", label: "Sapphire" },
		{ key: "pearl", label: "Pearl" },
		{ key: "diamond", label: "Diamond" },
		{ key: "starlight", label: "Starlight" },
		{ key: "starlight_plus", label: "Starlight Plus" },
	],

	/**
	 * Guardian rank progression array (for calculator)
	 * Used to determine rank order and indices
	 */
	GUARDIAN_RANK_PROGRESSION: [
		{ key: "1star", label: "1 Star" },
		{ key: "2star", label: "2 Stars" },
		{ key: "3star", label: "3 Stars" },
		{ key: "4star", label: "4 Stars" },
		{ key: "5star", label: "5 Stars" },
		{ key: "1crown", label: "1 Crown" },
		{ key: "2crown", label: "2 Crowns" },
		{ key: "3crown", label: "3 Crowns" },
		{ key: "4crown", label: "4 Crowns" },
		{ key: "5crown", label: "5 Crowns" },
	],

	/**
	 * Guardian evolution category order (for calculator)
	 */
	GUARDIAN_EVOLUTION_CATEGORIES: ["bronze", "silver", "gold", "platinum", "ruby", "sapphire", "pearl", "diamond", "starlight", "starlight_plus"],

	/**
	 * Machine rank configuration
	 * Machines progress through Stars (1-50) -> Crowns (51-100) -> Wings (101-150)
	 */
	MACHINE_RANKS: {
		STARS: {
			type: "Star",
			minLevel: 1,
			maxLevel: 50,
			// tiers reference will be added dynamically
		},
		CROWNS: {
			type: "Crown",
			minLevel: 51,
			maxLevel: 100,
			// tiers reference will be added dynamically
		},
		WINGS: {
			type: "Wings",
			minLevel: 101,
			maxLevel: 150,
			// tiers reference will be added dynamically
		},
	},

	/**
	 * Guardian rank configuration (no Wings, only Stars and Crowns)
	 */
	GUARDIAN_RANKS: {
		STARS: {
			type: "Star",
			// tiers reference will be added dynamically
		},
		CROWNS: {
			type: "Crown",
			// tiers reference will be added dynamically
		},
	},

	GUARDIAN_EXP_TABLE: {
		// Only Bronze stars need lookup (irregular pattern)
		bronze: {
			"1star": [90, 190, 300, 420, 580, 690, 780, 865, 950],
			"2star": [1357, 1459, 1561, 1660, 1770, 1860, 1960, 2070, 2180],
			"3star": [2800, 2910, 3030, 3150, 3270, 3390, 3510, 3600, 3750],
			"4star": [4400, 4700, 4830, 5000, 5140, 5280, 5420, 5560, 5700],
			"5star": [5710, 5720, 5730, 5740, 5750, 5760, 5770, 5780, 5800],
		},
	},

	/**
	 * Evolution costs (shards required to evolve)
	 * Format: { category: { fromRank: cost } }
	 */
	GUARDIAN_EVOLUTION_COSTS: {
		bronze: { "1star": 300, "2star": 500, "3star": 600, "4star": 800, "5star": 1000, "1crown": 800, "2crown": 1000, "3crown": 1150, "4crown": 1300, "5crown": 1500 },
		silver: { "1star": 350, "2star": 550, "3star": 650, "4star": 850, "5star": 1050, "1crown": 850, "2crown": 1050, "3crown": 1200, "4crown": 1350, "5crown": 1550 },
		gold: { "1star": 400, "2star": 600, "3star": 700, "4star": 900, "5star": 1100, "1crown": 900, "2crown": 1100, "3crown": 1250, "4crown": 1400, "5crown": 1600 },
		platinum: { "1star": 450, "2star": 650, "3star": 750, "4star": 950, "5star": 1150, "1crown": 950, "2crown": 1150, "3crown": 1300, "4crown": 1450, "5crown": 1650 },
		ruby: { "1star": 500, "2star": 700, "3star": 800, "4star": 1000, "5star": 1200, "1crown": 1050, "2crown": 1200, "3crown": 1350, "4crown": 1500, "5crown": 1700 },
		sapphire: { "1star": 550, "2star": 750, "3star": 900, "4star": 1050, "5star": 1250, "1crown": 1100, "2crown": 1250, "3crown": 1400, "4crown": 1550, "5crown": 1750 },
		pearl: { "1star": 600, "2star": 800, "3star": 950, "4star": 1100, "5star": 1300, "1crown": 1150, "2crown": 1300, "3crown": 1450, "4crown": 1600, "5crown": 1800 },
		diamond: { "1star": 650, "2star": 850, "3star": 1000, "4star": 1150, "5star": 1350, "1crown": 1200, "2crown": 1350, "3crown": 1500, "4crown": 1650, "5crown": 1850 },
		starlight: { "1star": 700, "2star": 900, "3star": 1050, "4star": 1200, "5star": 1400, "1crown": 1250, "2crown": 1400, "3crown": 1550, "4crown": 1700, "5crown": 1900 },
		starlight_plus: { "1star": 750, "2star": 950, "3star": 1100, "4star": 1250, "5star": 1450, "1crown": 1300, "2crown": 1450, "3crown": 1600, "4crown": 1750, "5crown": 1950 },
	},

	/**
	 * Gets rarity/evolution level by key
	 * @param {string} rarityKey - Rarity key (e.g., "epic")
	 * @returns {number} Rarity level (0-8)
	 */
	getRarityLevel(rarityKey) {
		const rarity = this.RARITIES.find((r) => r.key === rarityKey.toLowerCase());
		return rarity ? rarity.level : 0;
	},

	getGuardianRarityLevel(rarityKey) {
		const rarity = this.GUARDIAN_RARITIES.find((r) => r.key === rarityKey.toLowerCase());
		return rarity ? rarity.level : 0;
	},

	getGuardianEvolutionLevel(evolutionKey) {
		const evolution = this.GUARDIAN_EVOLUTIONS.find((e) => e.key === evolutionKey.toLowerCase());
		return evolution ? evolution.level : 0;
	},

	/**
	 * Gets all rarity labels for UI display
	 * @returns {string[]}
	 */
	get RARITY_LABELS() {
		return this.RARITIES.map((r) => r.label);
	},

	get GUARDIAN_RARITY_LABELS() {
		return this.GUARDIAN_RARITIES.map((r) => r.label);
	},

	get GUARDIAN_EVOLUTION_LABELS() {
		return this.GUARDIAN_EVOLUTIONS.map((e) => e.label);
	},

	STRANGE_DUST_EXP: 120,

	// ========================================
	// Chaos Rift Ranks
	// ========================================

	/**
	 * Chaos Rift rank bonuses
	 * Used in arena stat calculations
	 * @type {Array<{key: string, label: string, bonus: number}>}
	 */
	RIFT_RANKS: [
		{ key: "bronze", label: "Bronze", bonus: 0 },
		{ key: "silver", label: "Silver", bonus: 0 },
		{ key: "gold", label: "Gold", bonus: 0 },
		{ key: "pearl", label: "Pearl", bonus: 0 },
		{ key: "sapphire", label: "Sapphire", bonus: 0.01 },
		{ key: "emerald", label: "Emerald", bonus: 0.02 },
		{ key: "ruby", label: "Ruby", bonus: 0.03 },
		{ key: "platinum", label: "Platinum", bonus: 0.04 },
		{ key: "diamond", label: "Diamond", bonus: 0.05 },
	],

	/**
	 * Gets rift rank bonus by key
	 * @param {string} riftRankKey - Rift rank key (e.g., "diamond")
	 * @returns {number} Bonus multiplier (0 - 0.05)
	 */
	getRiftBonus(riftRankKey) {
		const rank = this.RIFT_RANKS.find((r) => r.key === riftRankKey.toLowerCase());
		return rank ? rank.bonus : 0;
	},

	/**
	 * Gets all rift rank labels for UI display
	 * @returns {string[]}
	 */
	get RIFT_RANK_LABELS() {
		return this.RIFT_RANKS.map((r) => r.label);
	},

	// ========================================
	// Artifact System
	// ========================================

	/**
	 * Artifact stat types
	 * @type {string[]}
	 */
	ARTIFACT_STATS: ["damage", "health", "armor"],

	/**
	 * Artifact percentage tiers
	 * @type {number[]}
	 */
	ARTIFACT_PERCENTAGES: [30, 35, 40, 45, 50, 55, 60, 65],

	// ========================================
	// Default Values
	// ========================================

	/**
	 * Default application state values
	 */
	DEFAULTS: {
		ENGINEER_LEVEL: 0,
		SCARAB_LEVEL: 0,
		RIFT_RANK: "bronze",
		OPTIMIZE_MODE: "campaign",
		RARITY: "common",
		LEVEL: 0,
		BLUEPRINT_LEVEL: 0,
		CARD_LEVEL: 0,
		HERO_PERCENTAGE: 0,
	},
};

AppConfig.MACHINE_RANKS = {
	STARS: {
		type: "Star",
		minLevel: 1,
		maxLevel: 50,
		tiers: AppConfig.ICON_RANK_TIERS,
	},
	CROWNS: {
		type: "Crown",
		minLevel: 51,
		maxLevel: 100,
		tiers: AppConfig.ICON_RANK_TIERS,
	},
	WINGS: {
		type: "Wings",
		minLevel: 101,
		maxLevel: 150,
		tiers: AppConfig.ICON_RANK_TIERS,
	},
};

AppConfig.GUARDIAN_RANKS = {
	STARS: {
		type: "Star",
		tiers: AppConfig.ICON_RANK_TIERS,
	},
	CROWNS: {
		type: "Crown",
		tiers: AppConfig.ICON_RANK_TIERS,
	},
};
