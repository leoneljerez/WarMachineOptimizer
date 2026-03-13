// config.js
import Decimal from "./vendor/break_eternity.esm.js";
import { APP_VERSION } from "./version.js";

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers (not exported — SoC: config file owns its own lookups)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Looks up an entry in a config array by key and returns a field, or a default.
 * @template T
 * @param {Array<{key: string}>} arr
 * @param {string} key
 * @param {string} field - Field to return from the matched entry
 * @param {T} fallback
 * @returns {T}
 */
function lookup(arr, key, field, fallback) {
	const entry = arr.find((e) => e.key === key.toLowerCase());
	return entry ? entry[field] : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typo-safe image filename map for rank icons
// "Sepphire" in the original source was a persistent typo — fixed here once.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps rank type + tier label → image filename stem.
 * Corrections vs original:
 *   - "Sepphire" → "Sapphire" for Star, Crown, Wings
 *   - "StarligtPlus" → "StarlightPlus" for Wings
 * @type {Readonly<Record<string, Record<string, string>>>}
 */
export const RANK_FILE_MAP = Object.freeze({
	Star: {
		Bronze: "star1Bronze",
		Silver: "star2Silver",
		Gold: "star3Gold",
		Platinum: "star4Platinum",
		Ruby: "star5Ruby",
		Sapphire: "star6Sepphire",
		Pearl: "star7Pearl",
		Diamond: "star8Diamond",
		Starlight: "star9Starlight",
		StarlightPlus: "star10StarlightPlus",
	},
	Crown: {
		Bronze: "crown11Bronze",
		Silver: "crown12Silver",
		Gold: "crown13Gold",
		Platinum: "crown14Platinum",
		Ruby: "crown15Ruby",
		Sapphire: "crown16Sepphire",
		Pearl: "crown17Pearl",
		Diamond: "crown18Diamond",
		Starlight: "crown19Starlight",
		StarlightPlus: "crown20StarlightPlus",
	},
	Wings: {
		Bronze: "wings21Bronze",
		Silver: "wings22Silver",
		Gold: "wings23Gold",
		Platinum: "wings24Platinum",
		Ruby: "wings25Ruby",
		Sapphire: "wings26Sapphire",
		Pearl: "wings27Pearl",
		Diamond: "wings28Diamond",
		Starlight: "wings29Starlight",
		StarlightPlus: "wings30StarligtPlus",
	},
});

// ─────────────────────────────────────────────────────────────────────────────
// Main configuration object
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralized configuration for War Machine Optimizer.
 * Pure data and simple lookups only — no UI or calculation logic.
 *
 * Utility methods (getRarityLevel, getMaxCrewSlots, etc.) are kept here
 * because they are simple lookups over data that lives in this same object.
 * More complex derived calculations belong in Calculator.
 */
export const AppConfig = {
	// ─────────────────────────────────────────────
	// Application
	// ─────────────────────────────────────────────

	/** @type {string} */
	APP_VERSION,

	/** @type {number} */
	MAX_PROFILES: 5,

	/** @type {string} */
	DEFAULT_PROFILE_NAME: "Main Account",

	// ─────────────────────────────────────────────
	// Campaign
	// ─────────────────────────────────────────────

	/**
	 * Difficulty levels with display properties and scaling multipliers.
	 * Order matters: used for progression display and "highest clear" logic.
	 * @type {Array<{key: string, label: string, color: string, multiplier: Decimal}>}
	 */
	DIFFICULTIES: [
		{ key: "easy", label: "Easy", color: "success", multiplier: new Decimal(1) },
		{ key: "normal", label: "Normal", color: "info", multiplier: new Decimal(360) },
		{ key: "hard", label: "Hard", color: "warning", multiplier: new Decimal(2478600) },
		{ key: "insane", label: "Insane", color: "danger", multiplier: new Decimal("5.8e+12") },
		{ key: "nightmare", label: "Nightmare", color: "light", multiplier: new Decimal("2.92e+18") },
	],

	/** @type {number} */
	MAX_MISSIONS_PER_DIFFICULTY: 90,

	/**
	 * Total possible stars across all difficulties and missions.
	 * @returns {number}
	 */
	get MAX_TOTAL_STARS() {
		return this.DIFFICULTIES.length * this.MAX_MISSIONS_PER_DIFFICULTY;
	},

	/**
	 * All difficulty keys in declaration order.
	 * @returns {string[]}
	 */
	get DIFFICULTY_KEYS() {
		return this.DIFFICULTIES.map((d) => d.key);
	},

	/**
	 * Returns the Decimal multiplier for a difficulty key.
	 * @param {string} difficultyKey
	 * @returns {Decimal}
	 */
	getDifficultyMultiplier(difficultyKey) {
		return lookup(this.DIFFICULTIES, difficultyKey, "multiplier", new Decimal(1));
	},

	// ─────────────────────────────────────────────
	// Battle
	// ─────────────────────────────────────────────

	/** @type {number} */
	MAX_BATTLE_ROUNDS: 20,

	/**
	 * Attack order for targeting enemies (position indices 0–4).
	 * @type {number[]}
	 */
	ATTACK_ORDER: [0, 1, 2, 4, 3],

	/** @type {number} */
	FORMATION_SIZE: 5,

	// ─────────────────────────────────────────────
	// Optimization
	// ─────────────────────────────────────────────

	/** @type {number} */
	REOPTIMIZE_INTERVAL: 5,

	/** @type {number} */
	MONTE_CARLO_SIMULATIONS: 20000,

	// ─────────────────────────────────────────────
	// Crew & Hero
	// ─────────────────────────────────────────────

	/**
	 * Engineer level thresholds that unlock extra crew slots.
	 * @type {Array<{minLevel: number, slots: number}>}
	 */
	CREW_SLOT_THRESHOLDS: [
		{ minLevel: 60, slots: 6 },
		{ minLevel: 30, slots: 5 },
		{ minLevel: 0, slots: 4 },
	],

	/**
	 * Returns the maximum crew slots allowed for a given engineer level.
	 * @param {number} engineerLevel
	 * @returns {number} 4, 5, or 6
	 */
	getMaxCrewSlots(engineerLevel) {
		const threshold = this.CREW_SLOT_THRESHOLDS.find((t) => engineerLevel >= t.minLevel);
		return threshold ? threshold.slots : 4;
	},

	/**
	 * Hero scoring weights used in Optimizer.scoreHeroForMachine().
	 * Mutable so SettingsManager can apply user overrides at runtime.
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

	// ─────────────────────────────────────────────
	// Stat calculation constants
	// ─────────────────────────────────────────────

	/**
	 * Base enemy stats for mission 1. All enemies scale from these values.
	 */
	BASE_ENEMY_STATS: {
		damage: new Decimal(260),
		health: new Decimal(1560),
		armor: new Decimal(30),
	},

	/** Per-mission stat multiplier. @type {number} */
	MISSION_SCALE_FACTOR: 1.2,

	/** Applied every 10 missions for regular enemy scaling. @type {number} */
	MILESTONE_SCALE_FACTOR: 3,

	/**
	 * Milestone factor used for power-requirement checks.
	 * Lower than the regular factor to keep power checks lenient.
	 * @type {number}
	 */
	POWER_REQUIREMENT_MILESTONE_FACTOR: 2,

	/** Each level adds (1.05^level - 1) as bonus. @type {number} */
	LEVEL_BONUS_BASE: 1.05,

	/** Base overdrive trigger chance. @type {number} */
	OVERDRIVE_BASE: 0.25,

	/** Overdrive increase per rarity level. @type {number} */
	OVERDRIVE_PER_RARITY: 0.03,

	/**
	 * Weights and exponent used in Calculator.computeMachinePower().
	 */
	POWER_CALCULATION: {
		DAMAGE_WEIGHT: 10,
		HEALTH_WEIGHT: 1,
		ARMOR_WEIGHT: 10,
		SCALING_EXPONENT: 0.7,
	},

	/**
	 * Power-requirement thresholds for Calculator.requiredPowerForMission().
	 */
	POWER_REQUIREMENTS: {
		EASY_EARLY: { maxMission: 10, percentage: 0.3 },
		EASY_MID: { maxMission: 30, percentage: 0.5 },
		DEFAULT: { percentage: 0.8 },
	},

	// ─────────────────────────────────────────────
	// Rarity / Evolution
	// ─────────────────────────────────────────────

	/**
	 * Machine rarity levels (Common → Celestial).
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
	 * Guardian rarity levels (Common → Angel, no Celestial).
	 * @type {Array<{key: string, label: string, level: number}>}
	 */
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
	 * Icon rank tiers (Bronze → Starlight Plus) shared by machines and guardians.
	 * @type {Array<{key: string, label: string}>}
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
	 * Guardian evolution categories in progression order.
	 * Keys must match GUARDIAN_EVOLUTION_CATEGORIES exactly.
	 * @type {Array<{key: string, label: string}>}
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
	 * Ordered category keys extracted from GUARDIAN_EVOLUTIONS.
	 * Kept as a separate array so GuardianCalculator can do O(1) indexOf lookups
	 * without coupling to the full evolution objects.
	 * @type {string[]}
	 */
	get GUARDIAN_EVOLUTION_CATEGORIES() {
		return this.GUARDIAN_EVOLUTIONS.map((e) => e.key);
	},

	/**
	 * Guardian rank progression (1star → 5crown).
	 * @type {Array<{key: string, label: string}>}
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
	 * Machine rank configuration (Stars 1–50, Crowns 51–100, Wings 101–150).
	 * Tiers reference ICON_RANK_TIERS inline — no post-declaration mutation needed.
	 */
	get MACHINE_RANKS() {
		const tiers = this.ICON_RANK_TIERS;
		return {
			STARS: { type: "Star", minLevel: 1, maxLevel: 50, tiers },
			CROWNS: { type: "Crown", minLevel: 51, maxLevel: 100, tiers },
			WINGS: { type: "Wings", minLevel: 101, maxLevel: 150, tiers },
		};
	},

	/**
	 * Guardian rank configuration (Stars and Crowns only — no Wings).
	 */
	get GUARDIAN_RANKS() {
		const tiers = this.ICON_RANK_TIERS;
		return {
			STARS: { type: "Star", tiers },
			CROWNS: { type: "Crown", tiers },
		};
	},

	/**
	 * EXP lookup table for Bronze stars (irregular pattern).
	 * All other categories use the formula in GuardianCalculator.
	 */
	GUARDIAN_EXP_TABLE: {
		bronze: {
			"1star": [90, 190, 300, 420, 580, 690, 780, 865, 950],
			"2star": [1357, 1459, 1561, 1660, 1770, 1860, 1960, 2070, 2180],
			"3star": [2800, 2910, 3030, 3150, 3270, 3390, 3510, 3600, 3750],
			"4star": [4400, 4700, 4830, 5000, 5140, 5280, 5420, 5560, 5700],
			"5star": [5710, 5720, 5730, 5740, 5750, 5760, 5770, 5780, 5800],
		},
	},

	/**
	 * Shard cost to evolve from each rank within each category.
	 * Format: { category: { fromRankKey: cost } }
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
	 * Returns the numeric rarity level for a machine rarity key (0–8).
	 * @param {string} rarityKey
	 * @returns {number}
	 */
	getRarityLevel(rarityKey) {
		return lookup(this.RARITIES, rarityKey, "level", 0);
	},

	/**
	 * Returns the numeric rarity level for a guardian rarity key (0–7).
	 * @param {string} rarityKey
	 * @returns {number}
	 */
	getGuardianRarityLevel(rarityKey) {
		return lookup(this.GUARDIAN_RARITIES, rarityKey, "level", 0);
	},

	/** @returns {string[]} */
	get RARITY_LABELS() {
		return this.RARITIES.map((r) => r.label);
	},

	/** @returns {string[]} */
	get GUARDIAN_RARITY_LABELS() {
		return this.GUARDIAN_RARITIES.map((r) => r.label);
	},

	/** @returns {string[]} */
	get GUARDIAN_EVOLUTION_LABELS() {
		return this.GUARDIAN_EVOLUTIONS.map((e) => e.label);
	},

	// ─────────────────────────────────────────────
	// Chaos Rift
	// ─────────────────────────────────────────────

	/**
	 * Chaos Rift rank arena bonuses.
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
	 * Returns the arena bonus multiplier for a rift rank key (0–0.05).
	 * @param {string} riftRankKey
	 * @returns {number}
	 */
	getRiftBonus(riftRankKey) {
		return lookup(this.RIFT_RANKS, riftRankKey, "bonus", 0);
	},

	/** @returns {string[]} */
	get RIFT_RANK_LABELS() {
		return this.RIFT_RANKS.map((r) => r.label);
	},

	// ─────────────────────────────────────────────
	// Artifact system
	// ─────────────────────────────────────────────

	/** @type {string[]} */
	ARTIFACT_STATS: ["damage", "health", "armor"],

	/** @type {number[]} */
	ARTIFACT_PERCENTAGES: [30, 35, 40, 45, 50, 55, 60, 65],

	// ─────────────────────────────────────────────
	// Guardian misc
	// ─────────────────────────────────────────────

	/** EXP granted by 20 Strange Dust. @type {number} */
	STRANGE_DUST_EXP: 120,

	// ─────────────────────────────────────────────
	// Defaults
	// ─────────────────────────────────────────────

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
