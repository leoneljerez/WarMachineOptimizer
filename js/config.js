// config.js
/**
 * Centralized configuration for War Machine Optimizer
 * All game constants and magic numbers should be defined here
 */

/**
 * Campaign difficulty configuration
 * @typedef {Object} DifficultyConfig
 * @property {string} key - Unique identifier
 * @property {string} label - Display name
 * @property {string} color - Bootstrap color class
 * @property {import('./vendor/break_eternity.esm.js').default} multiplier - Stat multiplier for enemies
 */

import Decimal from "./vendor/break_eternity.esm.js";

export const AppConfig = {
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
	MONTE_CARLO_SIMULATIONS: 2500,

	/**
	 * Minimum win rate required to consider a mission clearable
	 * 0.001 = 0.1% win rate
	 * @type {number}
	 */
	MONTE_CARLO_WIN_RATE: 0.001,

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
			TANK: { damage: 0.3, health: 5.0, armor: 3.0 },
			DPS: { damage: 10.0, health: 0.55, armor: 0.3 },
		},
		ARENA: {
			TANK: { damage: 0.3, health: 5.0, armor: 3.0 },
			DPS: { damage: 10.0, health: 0.55, armor: 0.3 },
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
	// Rarity System
	// ========================================

	/**
	 * Rarity level mappings
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

	/**
	 * Gets rarity level by key
	 * @param {string} rarityKey - Rarity key (e.g., "epic")
	 * @returns {number} Rarity level (0-8)
	 */
	getRarityLevel(rarityKey) {
		const rarity = this.RARITIES.find((r) => r.key === rarityKey.toLowerCase());
		return rarity ? rarity.level : 0;
	},

	/**
	 * Gets all rarity labels for UI display
	 * @returns {string[]}
	 */
	get RARITY_LABELS() {
		return this.RARITIES.map((r) => r.label);
	},

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
