// calculator.js
import Decimal from "./vendor/break_eternity.esm.js";
import { AppConfig } from "./config.js";

/**
 * @typedef {Object} BasicAttributeParams
 * @property {number|Decimal} base
 * @property {number|Decimal} levelBonus
 * @property {number|Decimal} engineerBonus
 * @property {number|Decimal} blueprintBonus
 * @property {number|Decimal} rarityBonus
 * @property {number|Decimal} sacredBonus
 * @property {number|Decimal} inscriptionBonus
 * @property {number|Decimal} artifactBonus
 */

/**
 * @typedef {{damage: Decimal, health: Decimal, armor: Decimal}} StatTriple
 */

/**
 * Pure calculation utilities for War Machine Optimizer.
 * All methods are static — no state is stored on instances.
 *
 * Cache note: `enemyStatsCache` grows for the lifetime of the page because
 * the set of possible (mission, difficulty, milestoneBase) tuples is small
 * and bounded (~90 × 5 × 2 = 900 entries max). No eviction is needed.
 */
export class Calculator {
	/** @type {Decimal} */
	static ZERO = new Decimal(0);
	/** @type {Decimal} */
	static ONE = new Decimal(1);

	/**
	 * Cache for enemy attribute lookups.
	 * Key format: `"${mission}:${difficulty}:${milestoneBase}"`.
	 * Intentionally never cleared — see class-level note above.
	 * @type {Map<string, StatTriple>}
	 */
	static enemyStatsCache = new Map();

	// ─────────────────────────────────────────────
	// Type conversion
	// ─────────────────────────────────────────────

	/**
	 * Ensures a value is a Decimal instance.
	 * Accepts numbers, strings, and Decimal transfer objects (from worker postMessage).
	 * @param {number|string|Decimal|{sign:number,layer:number,mag:number}} value
	 * @returns {Decimal}
	 */
	static toDecimal(value) {
		if (value instanceof Decimal) return value;
		if (typeof value === "number") return new Decimal(value);
		if (value && typeof value === "object" && "mag" in value) {
			return Decimal.fromComponents(value.sign, value.layer, value.mag);
		}
		return new Decimal(value);
	}

	// ─────────────────────────────────────────────
	// Basic stat helpers
	// ─────────────────────────────────────────────

	/**
	 * Returns damage taken after subtracting armor.
	 * Returns 0 when armor fully absorbs the hit.
	 * @param {number|Decimal} enemyDamage
	 * @param {number|Decimal} characterArmor
	 * @returns {Decimal}
	 */
	static computeDamageTaken(enemyDamage, characterArmor) {
		const dmg = Calculator.toDecimal(enemyDamage);
		const armor = Calculator.toDecimal(characterArmor);
		return armor.gte(dmg) ? Calculator.ZERO : dmg.sub(armor);
	}

	/**
	 * Sums all machine rarity levels for global-bonus calculations.
	 * @param {Object[]} ownedMachines
	 * @returns {number}
	 */
	static getGlobalRarityLevels(ownedMachines) {
		let sum = 0;
		for (let i = 0; i < ownedMachines.length; i++) {
			sum += AppConfig.getRarityLevel(ownedMachines[i].rarity?.toLowerCase() ?? "common");
		}
		return sum;
	}

	/**
	 * Returns the overdrive trigger probability for a machine.
	 * Formula: OVERDRIVE_BASE + (rarityLevel × OVERDRIVE_PER_RARITY)
	 * @param {Object} machine
	 * @returns {number}
	 */
	static calculateOverdrive(machine) {
		const rarityLevel = AppConfig.getRarityLevel(machine.rarity?.toLowerCase() ?? "common");
		return AppConfig.OVERDRIVE_BASE + rarityLevel * AppConfig.OVERDRIVE_PER_RARITY;
	}

	// ─────────────────────────────────────────────
	// Enemy scaling
	// ─────────────────────────────────────────────

	/**
	 * Returns the scaled enemy stats for a given mission and difficulty.
	 * Results are cached by `"mission:difficulty:milestoneBase"`.
	 * @param {number} missionNumber - 1–90
	 * @param {string} difficulty
	 * @param {number} [milestoneBase=AppConfig.MILESTONE_SCALE_FACTOR]
	 * @returns {StatTriple}
	 */
	static enemyAttributes(missionNumber, difficulty, milestoneBase = AppConfig.MILESTONE_SCALE_FACTOR) {
		const cacheKey = `${missionNumber}:${difficulty}:${milestoneBase}`;
		const cached = Calculator.enemyStatsCache.get(cacheKey);
		if (cached) return cached;

		const diffMultiplier = AppConfig.getDifficultyMultiplier(difficulty);
		const missionIdx = missionNumber - 1;
		const milestoneCount = Math.floor(missionIdx / 10);

		const missionFactor = new Decimal(AppConfig.MISSION_SCALE_FACTOR).pow(missionIdx);
		const milestoneFactor = new Decimal(milestoneBase).pow(milestoneCount);
		const total = diffMultiplier.mul(missionFactor).mul(milestoneFactor);

		const result = {
			damage: AppConfig.BASE_ENEMY_STATS.damage.mul(total),
			health: AppConfig.BASE_ENEMY_STATS.health.mul(total),
			armor: AppConfig.BASE_ENEMY_STATS.armor.mul(total),
		};

		Calculator.enemyStatsCache.set(cacheKey, result);
		return result;
	}

	/**
	 * Creates a 5-enemy team for a given mission and difficulty.
	 * All enemies are identical; each gets a shallow-spread of the template
	 * so their battleStats objects are independent.
	 * @param {number} missionNumber
	 * @param {string} difficulty
	 * @param {number} [milestoneBase=AppConfig.MILESTONE_SCALE_FACTOR]
	 * @returns {Object[]}
	 */
	static getEnemyTeamForMission(missionNumber, difficulty, milestoneBase = AppConfig.MILESTONE_SCALE_FACTOR) {
		const s = Calculator.enemyAttributes(missionNumber, difficulty, milestoneBase);

		const template = {
			baseStats: { damage: s.damage, health: s.health, armor: s.armor },
			battleStats: { damage: s.damage, health: s.health, maxHealth: s.health, armor: s.armor },
			isDead: false,
		};

		return Array.from({ length: AppConfig.FORMATION_SIZE }, (_, i) => ({
			...template,
			name: `Enemy${i + 1}`,
		}));
	}

	/**
	 * Returns the minimum power a team must reach to attempt a mission.
	 * @param {number} missionNumber
	 * @param {string} difficulty
	 * @returns {Decimal}
	 */
	static requiredPowerForMission(missionNumber, difficulty) {
		const enemyTeam = Calculator.getEnemyTeamForMission(missionNumber, difficulty, AppConfig.POWER_REQUIREMENT_MILESTONE_FACTOR);
		const enemyPower = Calculator.computeSquadPower(enemyTeam, "campaign");

		let reqPct = AppConfig.POWER_REQUIREMENTS.DEFAULT.percentage;

		if (difficulty === "easy") {
			if (missionNumber <= AppConfig.POWER_REQUIREMENTS.EASY_EARLY.maxMission) {
				reqPct = AppConfig.POWER_REQUIREMENTS.EASY_EARLY.percentage;
			} else if (missionNumber <= AppConfig.POWER_REQUIREMENTS.EASY_MID.maxMission) {
				reqPct = AppConfig.POWER_REQUIREMENTS.EASY_MID.percentage;
			}
		}

		return enemyPower.mul(reqPct).div(100).floor().mul(100);
	}

	// ─────────────────────────────────────────────
	// Bonus calculations
	// ─────────────────────────────────────────────

	/**
	 * Sums all crew percentage bonuses (additive).
	 * @param {Object[]} crewList
	 * @returns {{dmg: Decimal, hp: Decimal, arm: Decimal}}
	 */
	static computeCrewBonus(crewList) {
		if (!crewList?.length) {
			return { dmg: this.ZERO, hp: this.ZERO, arm: this.ZERO };
		}

		let dmg = this.ZERO;
		let hp = this.ZERO;
		let arm = this.ZERO;

		for (let i = 0; i < crewList.length; i++) {
			const { percentages } = crewList[i] ?? {};
			if (!percentages) continue;
			if (percentages.damage > 0) dmg = dmg.add(percentages.damage / 100);
			if (percentages.health > 0) hp = hp.add(percentages.health / 100);
			if (percentages.armor > 0) arm = arm.add(percentages.armor / 100);
		}

		return { dmg, hp, arm };
	}

	/**
	 * Calculates a single stat with all multiplicative bonuses applied.
	 * All bonus parameters are additive fractions (e.g. 0.2 = +20%).
	 * @param {BasicAttributeParams} params
	 * @returns {Decimal}
	 */
	static computeBasicAttribute({ base, levelBonus, engineerBonus, blueprintBonus, rarityBonus, sacredBonus, inscriptionBonus, artifactBonus }) {
		return Calculator.toDecimal(base)
			.mul(Calculator.ONE.add(levelBonus))
			.mul(Calculator.ONE.add(engineerBonus))
			.mul(Calculator.ONE.add(blueprintBonus))
			.mul(Calculator.ONE.add(rarityBonus))
			.mul(Calculator.ONE.add(sacredBonus))
			.mul(Calculator.ONE.add(inscriptionBonus))
			.mul(Calculator.ONE.add(artifactBonus));
	}

	/**
	 * Computes the total artifact bonus for one stat across all artifact slots.
	 * Artifacts are multiplicative: each (percentage, quantity) pair contributes
	 * `(1 + pct)^quantity`, then all tiers are multiplied together.
	 * Returns the combined bonus as a fraction (e.g. 0.5 = +50%).
	 * @param {Array<{stat: string, values: Record<string, number>}>} artifactArray
	 * @param {string} stat - "damage" | "health" | "armor"
	 * @returns {Decimal}
	 */
	static computeArtifactBonus(artifactArray, stat) {
		let total = Calculator.ONE;

		for (let i = 0; i < artifactArray.length; i++) {
			const artifact = artifactArray[i];
			if (artifact.stat !== stat || !artifact.values) continue;

			for (const [percentStr, quantity] of Object.entries(artifact.values)) {
				if (!quantity || quantity <= 0) continue;
				const multiplier = Calculator.ONE.add(Number(percentStr) / 100).pow(quantity);
				total = total.mul(multiplier);
			}
		}

		return total.sub(1);
	}

	// ─────────────────────────────────────────────
	// Full stat calculators
	// ─────────────────────────────────────────────

	/**
	 * Calculates arena attributes with logarithmic scaling plus Mech Fury,
	 * Scarab, and Rift bonuses (all multiplicative).
	 * Requires `machine.battleStats` and `machine.baseStats` to be populated.
	 * @param {Object} machine
	 * @param {number} [globalRarityLevels=0]
	 * @param {number} [scarabLevel=0]
	 * @param {string} [riftRank=""]
	 * @returns {StatTriple}
	 */
	static calculateArenaAttributes(machine, globalRarityLevels = 0, scarabLevel = 0, riftRank = "") {
		const base = new Decimal(AppConfig.LEVEL_BONUS_BASE);

		const scarabBonus = Decimal.min(Decimal.max(new Decimal(scarabLevel).sub(3).div(2).floor().add(1), 0).mul(0.002), 1);
		const riftBonus = new Decimal(AppConfig.getRiftBonus(riftRank));
		const mechFuryBonus = base.pow(globalRarityLevels).sub(1);
		const totalBonus = Calculator.ONE.add(mechFuryBonus).mul(Calculator.ONE.add(scarabBonus)).mul(Calculator.ONE.add(riftBonus));

		const baseDmg = Calculator.toDecimal(machine.baseStats.damage);
		const baseHp = Calculator.toDecimal(machine.baseStats.health);
		const baseArm = Calculator.toDecimal(machine.baseStats.armor);

		const battleDmg = Calculator.toDecimal(machine.battleStats.damage);
		const battleHp = Calculator.toDecimal(machine.battleStats.health);
		const battleArm = Calculator.toDecimal(machine.battleStats.armor);

		return {
			damage: baseDmg.mul(Decimal.log10(battleDmg.div(baseDmg)).add(1).pow(2)).mul(totalBonus),
			health: baseHp.mul(Decimal.log10(battleHp.div(baseHp)).add(1).pow(2)).mul(totalBonus),
			armor: baseArm.mul(Decimal.log10(battleArm.div(baseArm)).add(1).pow(2)).mul(totalBonus),
		};
	}

	/**
	 * Calculates battle attributes for a machine with all bonuses applied.
	 * @param {Object} machine - Must have baseStats, level, blueprints, rarity, sacredLevel, inscriptionLevel
	 * @param {Object[]} [crewList=[]]
	 * @param {number}   [globalRarityLevels=0]
	 * @param {Array}    [artifactArray=[]]
	 * @param {number}   [engineerLevel=0]
	 * @returns {StatTriple}
	 */
	static calculateBattleAttributes(machine, crewList = [], globalRarityLevels = 0, artifactArray = [], engineerLevel = 0) {
		const base = new Decimal(AppConfig.LEVEL_BONUS_BASE);

		const levelBonus = base.pow(machine.level - 1).sub(1);
		const engineerBonus = base.pow(engineerLevel - 1).sub(1);
		const rarityLevel = AppConfig.getRarityLevel(machine.rarity?.toLowerCase() || "common");
		const rarityBonus = base.pow(rarityLevel + globalRarityLevels).sub(1);
		const sacredBonus = base.pow(machine.sacredLevel).sub(1);
		const inscriptionBonus = base.pow(machine.inscriptionLevel).sub(1);

		const dmgBPBonus = base.pow(machine.blueprints.damage).sub(1);
		const hpBPBonus = base.pow(machine.blueprints.health).sub(1);
		const armBPBonus = base.pow(machine.blueprints.armor).sub(1);

		const artifactBonusDmg = Calculator.computeArtifactBonus(artifactArray, "damage");
		const artifactBonusHp = Calculator.computeArtifactBonus(artifactArray, "health");
		const artifactBonusArm = Calculator.computeArtifactBonus(artifactArray, "armor");

		const crewBonus = Calculator.computeCrewBonus(crewList);

		const commonParams = { levelBonus, engineerBonus, rarityBonus, sacredBonus, inscriptionBonus };

		const dmg = Calculator.computeBasicAttribute({ base: machine.baseStats.damage, blueprintBonus: dmgBPBonus, artifactBonus: artifactBonusDmg, ...commonParams });
		const hp = Calculator.computeBasicAttribute({ base: machine.baseStats.health, blueprintBonus: hpBPBonus, artifactBonus: artifactBonusHp, ...commonParams });
		const arm = Calculator.computeBasicAttribute({ base: machine.baseStats.armor, blueprintBonus: armBPBonus, artifactBonus: artifactBonusArm, ...commonParams });

		return {
			damage: dmg.mul(Calculator.ONE.add(crewBonus.dmg)),
			health: hp.mul(Calculator.ONE.add(crewBonus.hp)),
			armor: arm.mul(Calculator.ONE.add(crewBonus.arm)),
		};
	}

	// ─────────────────────────────────────────────
	// Power metrics
	// ─────────────────────────────────────────────

	/**
	 * Computes power score for a single machine's stats.
	 * Uses weighted, exponent-scaled combination of damage, health, and armor.
	 * @param {StatTriple} stats
	 * @returns {Decimal}
	 */
	static computeMachinePower(stats) {
		const { DAMAGE_WEIGHT, HEALTH_WEIGHT, ARMOR_WEIGHT, SCALING_EXPONENT } = AppConfig.POWER_CALCULATION;
		return Calculator.toDecimal(stats.damage)
			.mul(DAMAGE_WEIGHT)
			.pow(SCALING_EXPONENT)
			.add(Calculator.toDecimal(stats.health).mul(HEALTH_WEIGHT).pow(SCALING_EXPONENT))
			.add(Calculator.toDecimal(stats.armor).mul(ARMOR_WEIGHT).pow(SCALING_EXPONENT));
	}

	/**
	 * Sums power scores for an entire squad.
	 * @param {Object[]} [machines=[]]
	 * @param {"campaign"|"arena"} [mode="campaign"] - Which stats to use
	 * @returns {Decimal}
	 */
	static computeSquadPower(machines = [], mode = "campaign") {
		const useArena = mode === "arena";
		let total = Calculator.ZERO;

		for (let i = 0; i < machines.length; i++) {
			const stats = useArena ? machines[i].arenaStats : machines[i].battleStats;
			if (!stats) {
				console.warn(`Machine missing ${mode}Stats:`, machines[i].name);
				continue;
			}
			total = total.add(Calculator.computeMachinePower(stats));
		}

		return total;
	}

	// ─────────────────────────────────────────────
	// Miscellaneous
	// ─────────────────────────────────────────────

	/**
	 * Returns the maximum crew slots for an engineer level.
	 * Delegates to AppConfig — provided here for call-site convenience.
	 * @param {number} engineerLevel
	 * @returns {number}
	 */
	static maxCrewSlots(engineerLevel) {
		return AppConfig.getMaxCrewSlots(engineerLevel);
	}

	/**
	 * Returns the maximum blueprint level allowed at a given machine level.
	 * Formula: 5 + floor(level / 5) × 5
	 * @param {number} machineLevel
	 * @returns {number}
	 */
	static getMaxBlueprintLevel(machineLevel) {
		return 5 + Math.floor(machineLevel / 5) * 5;
	}
}
