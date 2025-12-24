// calculator.js
import Decimal from "./vendor/break_eternity.esm.js";
import { AppConfig } from "./config.js";

/**
 * Calculator utility class for all game calculations
 * Handles stat calculations, damage computation, and power metrics
 * @class
 */
export class Calculator {
	/** @type {Decimal} */
	static ZERO = new Decimal(0);

	/**
	 * Ensures that any value is converted to a Decimal object
	 * @param {*} value - Value to convert (number, string, or Decimal)
	 * @returns {Decimal} Decimal instance
	 */
	static toDecimal(value) {
		if (value instanceof Decimal) {
			return value;
		} else if (value && typeof value === "object" && "sign" in value && "layer" in value && "mag" in value) {
			return Decimal.fromComponents(value.sign, value.layer, value.mag);
		}

		return new Decimal(value);
	}

	/**
	 * Computes the damage taken by a character after armor reduction
	 * If armor >= damage, returns 0 (no damage taken)
	 * @param {number|Decimal} enemyDamage - Enemy's damage value
	 * @param {number|Decimal} characterArmor - Character's armor value
	 * @returns {Decimal} Damage taken (0 if armor >= damage)
	 */
	static computeDamageTaken(enemyDamage, characterArmor) {
		const dmg = Calculator.toDecimal(enemyDamage);
		const armor = Calculator.toDecimal(characterArmor);

		if (armor.gte(dmg)) return new Decimal(0);

		return dmg.sub(armor).max(0);
	}

	/**
	 * Gets the global rarity level by summing all machine rarity levels
	 * Used for calculating global bonuses that scale with total collection
	 * @param {Array<import('./optimizer.js').Machine>} ownedMachines - Array of owned machines
	 * @returns {number} Sum of all rarity levels
	 */
	static getGlobalRarityLevels(ownedMachines) {
		let sum = 0;
		for (let i = 0; i < ownedMachines.length; i++) {
			const rarity = ownedMachines[i].rarity?.toLowerCase() ?? "common";
			sum += AppConfig.getRarityLevel(rarity);
		}
		return sum;
	}

	/**
	 * Calculates overdrive value for a machine based on rarity
	 * Formula: OVERDRIVE_BASE + (rarity_level * OVERDRIVE_PER_RARITY)
	 * @param {import('./optimizer.js').Machine} machine - Machine object
	 * @returns {number} Overdrive value (decimal multiplier)
	 */
	static calculateOverdrive(machine) {
		const rarity = machine.rarity?.toLowerCase() ?? "common";
		const rarityLevel = AppConfig.getRarityLevel(rarity);

		if (rarityLevel === 0) return AppConfig.OVERDRIVE_BASE;

		return AppConfig.OVERDRIVE_BASE + rarityLevel * AppConfig.OVERDRIVE_PER_RARITY;
	}

	/**
	 * Gets enemy attributes for a specific mission and difficulty
	 * Applies mission scaling and milestone scaling
	 * @param {number} missionNumber - Mission number (1-90)
	 * @param {string} difficulty - Difficulty level (easy, normal, hard, insane, nightmare)
	 * @param {number} milestoneBase - Milestone scaling factor (default: 3 for regular, 2 for power requirements)
	 * @returns {{damage: Decimal, health: Decimal, armor: Decimal}} Enemy stats
	 */
	static enemyAttributes(missionNumber, difficulty, milestoneBase = AppConfig.MILESTONE_SCALE_FACTOR) {
		const diffMultiplier = AppConfig.getDifficultyMultiplier(difficulty);
		const missionNum = missionNumber - 1;
		const milestoneCount = Math.floor(missionNum / 10);

		const missionFactor = new Decimal(AppConfig.MISSION_SCALE_FACTOR).pow(missionNum);
		const milestoneFactor = new Decimal(milestoneBase).pow(milestoneCount);

		const finalMultiplier = diffMultiplier.mul(missionFactor).mul(milestoneFactor);

		return {
			damage: AppConfig.BASE_ENEMY_STATS.damage.mul(finalMultiplier),
			health: AppConfig.BASE_ENEMY_STATS.health.mul(finalMultiplier),
			armor: AppConfig.BASE_ENEMY_STATS.armor.mul(finalMultiplier),
		};
	}

	/**
	 * Creates an enemy team for a mission
	 * Generates identical enemies with stats for the given mission/difficulty
	 * @param {number} missionNumber - Mission number (1-90)
	 * @param {string} difficulty - Difficulty level
	 * @param {number} milestoneBase - Milestone scaling factor
	 * @returns {Array<{name: string, baseStats: Object, battleStats: import('./app.js').MachineStats, isDead: boolean}>} Array of enemy objects
	 */
	static getEnemyTeamForMission(missionNumber, difficulty, milestoneBase = AppConfig.MILESTONE_SCALE_FACTOR) {
		const enemyStats = Calculator.enemyAttributes(missionNumber, difficulty, milestoneBase);

		return Array.from({ length: AppConfig.FORMATION_SIZE }, (_, i) => ({
			name: `Enemy${i + 1}`,
			baseStats: {
				damage: enemyStats.damage,
				health: enemyStats.health,
				armor: enemyStats.armor,
			},
			battleStats: {
				damage: enemyStats.damage,
				health: enemyStats.health,
				maxHealth: enemyStats.health,
				armor: enemyStats.armor,
			},
			isDead: false,
		}));
	}

	/**
	 * Calculates required power to complete a mission
	 * Uses difficulty-based percentage thresholds from AppConfig
	 * @param {number} missionNumber - Mission number (1-90)
	 * @param {string} difficulty - Difficulty level
	 * @returns {Decimal} Required power value to clear the mission
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

	/**
	 * Computes total crew bonus from a list of heroes
	 * Sums all hero percentage bonuses (additive)
	 * @param {Array<import('./optimizer.js').Hero>} crewList - Array of crew members
	 * @returns {{dmg: Decimal, hp: Decimal, arm: Decimal}} Total bonuses as decimal multipliers
	 */
	static computeCrewBonus(crewList) {
		if (!crewList || crewList.length === 0) {
			return { dmg: this.ZERO, hp: this.ZERO, arm: this.ZERO };
		}

		let dmg = this.ZERO;
		let hp = this.ZERO;
		let arm = this.ZERO;

		for (let i = 0; i < crewList.length; i++) {
			const hero = crewList[i];
			if (!hero?.percentages) continue;

			const dmgPct = hero.percentages.damage || 0;
			const hpPct = hero.percentages.health || 0;
			const armPct = hero.percentages.armor || 0;

			if (dmgPct > 0) dmg = dmg.add(dmgPct / 100);
			if (hpPct > 0) hp = hp.add(hpPct / 100);
			if (armPct > 0) arm = arm.add(armPct / 100);
		}

		return { dmg, hp, arm };
	}

	/**
	 * Calculates a single attribute with all bonuses applied
	 * All bonuses are multiplicative
	 * @param {number|Decimal} base - Base stat value
	 * @param {number|Decimal} levelBonus - Level bonus multiplier
	 * @param {number|Decimal} engineerBonus - Engineer bonus multiplier
	 * @param {number|Decimal} blueprintBonus - Blueprint bonus multiplier
	 * @param {number|Decimal} rarityBonus - Rarity bonus multiplier
	 * @param {number|Decimal} sacredBonus - Sacred card bonus multiplier
	 * @param {number|Decimal} inscriptionBonus - Inscription card bonus multiplier
	 * @param {number|Decimal} artifactBonus - Artifact bonus multiplier
	 * @returns {Decimal} Final calculated attribute value
	 */
	static computeBasicAttribute(base, levelBonus, engineerBonus, blueprintBonus, rarityBonus, sacredBonus, inscriptionBonus, artifactBonus) {
		return Calculator.toDecimal(base)
			.mul(new Decimal(1).add(levelBonus))
			.mul(new Decimal(1).add(engineerBonus))
			.mul(new Decimal(1).add(blueprintBonus))
			.mul(new Decimal(1).add(rarityBonus))
			.mul(new Decimal(1).add(sacredBonus))
			.mul(new Decimal(1).add(inscriptionBonus))
			.mul(new Decimal(1).add(artifactBonus));
	}

	/**
	 * Computes artifact bonus for a specific stat
	 * Artifacts are multiplicative: (1 + pct)^quantity for each tier
	 * @param {Array<{stat: string, values: Object.<string, number>}>} artifactArray - Array of artifact configurations
	 * @param {string} stat - Stat type (damage, health, armor)
	 * @returns {Decimal} Total artifact bonus as decimal multiplier
	 */
	static computeArtifactBonus(artifactArray, stat) {
		let total = new Decimal(1);

		for (let i = 0; i < artifactArray.length; i++) {
			const artifact = artifactArray[i];
			if (artifact.stat !== stat || !artifact.values) continue;

			const entries = Object.entries(artifact.values);
			for (let j = 0; j < entries.length; j++) {
				const [percentStr, quantity] = entries[j];
				if (!quantity || quantity <= 0) continue;

				const percent = Number(percentStr);
				const multiplier = new Decimal(1).add(percent / 100).pow(quantity);
				total = total.mul(multiplier);
			}
		}

		return total.sub(1);
	}

	/**
	 * Calculates arena attributes with special logarithmic scaling
	 * Then applies Mech Fury, Scarab, and Rift bonuses (multiplicative)
	 * @param {import('./optimizer.js').Machine} machine - Machine with battle stats already calculated
	 * @param {number} [globalRarityLevels=0] - Sum of all rarity levels (for Mech Fury bonus)
	 * @param {number} [scarabLevel=0] - Scarab level (affects bonus calculation)
	 * @param {string} [riftRank=''] - Chaos Rift rank
	 * @returns {{damage: Decimal, health: Decimal, armor: Decimal}} Arena stats
	 */
	static calculateArenaAttributes(machine, globalRarityLevels = 0, scarabLevel = 0, riftRank = "") {
		const base = new Decimal(AppConfig.LEVEL_BONUS_BASE);

		// Scarab bonus: min(max(floor((scarabLevel - 3) / 2) + 1, 0) * 0.002, 1)
		const scarabBonus = Decimal.min(Decimal.max(new Decimal(scarabLevel).sub(3).div(2).floor().add(1), 0).mul(0.002), 1);

		// Rift rank bonuses
		const riftBonus = new Decimal(AppConfig.getRiftBonus(riftRank));

		// Mech Fury bonus: 1.05^globalRarityLevels - 1
		const mechFuryBonus = base.pow(globalRarityLevels).sub(1);

		const baseDamage = Calculator.toDecimal(machine.baseStats.damage);
		const baseHealth = Calculator.toDecimal(machine.baseStats.health);
		const baseArmor = Calculator.toDecimal(machine.baseStats.armor);

		const battleDamage = Calculator.toDecimal(machine.battleStats.damage);
		const battleHealth = Calculator.toDecimal(machine.battleStats.health);
		const battleArmor = Calculator.toDecimal(machine.battleStats.armor);

		// Ratio of battle stats to base stats
		const divDmg = battleDamage.div(baseDamage);
		const divHp = battleHealth.div(baseHealth);
		const divArm = battleArmor.div(baseArmor);

		// Arena formula: base * (log10(ratio) + 1)^2 * bonuses
		const arenaDmg = baseDamage.mul(Decimal.log10(divDmg).add(1).pow(2)).mul(mechFuryBonus.add(1)).mul(scarabBonus.add(1)).mul(riftBonus.add(1));
		const arenaHp = baseHealth.mul(Decimal.log10(divHp).add(1).pow(2)).mul(mechFuryBonus.add(1)).mul(scarabBonus.add(1)).mul(riftBonus.add(1));
		const arenaArm = baseArmor.mul(Decimal.log10(divArm).add(1).pow(2)).mul(mechFuryBonus.add(1)).mul(scarabBonus.add(1)).mul(riftBonus.add(1));

		return {
			damage: arenaDmg,
			health: arenaHp,
			armor: arenaArm,
		};
	}

	/**
	 * Calculates battle attributes with all bonuses applied
	 * @param {import('./optimizer.js').Machine} machine - Machine object with base stats
	 * @param {Array<import('./optimizer.js').Hero>} [crewList=[]] - Array of crew members
	 * @param {number} [globalRarityLevels=0] - Sum of all rarity levels
	 * @param {Array<{stat: string, values: Object}>} [artifactArray=[]] - Artifact configurations
	 * @param {number} [engineerLevel=0] - Engineer level
	 * @returns {{damage: Decimal, health: Decimal, armor: Decimal}} Battle stats
	 */
	static calculateBattleAttributes(machine, crewList = [], globalRarityLevels = 0, artifactArray = [], engineerLevel = 0) {
		const base = new Decimal(AppConfig.LEVEL_BONUS_BASE);

		// Level bonus: 1.05^(level - 1) - 1
		const levelBonus = base.pow(machine.level - 1).sub(1);

		// Engineer bonus: 1.05^(engineer_level - 1) - 1
		const engineerBonus = base.pow(engineerLevel - 1).sub(1);

		// Blueprint bonus: 1.05^blueprint_level - 1
		const dmgBPBonus = base.pow(machine.blueprints.damage).sub(1);
		const hpBPBonus = base.pow(machine.blueprints.health).sub(1);
		const armBPBonus = base.pow(machine.blueprints.armor).sub(1);

		// Rarity bonus: 1.05^(machine_rarity + global_rarity) - 1
		const rarityLevel = AppConfig.getRarityLevel(machine.rarity?.toLowerCase() || "common");
		const rarityBonus = base.pow(rarityLevel + globalRarityLevels).sub(1);

		// Card bonuses: 1.05^card_level - 1
		const sacredBonus = base.pow(machine.sacredLevel).sub(1);
		const inscriptionBonus = base.pow(machine.inscriptionLevel).sub(1);

		// Artifact bonuses (multiplicative)
		const artifactBonusDmg = Calculator.computeArtifactBonus(artifactArray, "damage");
		const artifactBonusHp = Calculator.computeArtifactBonus(artifactArray, "health");
		const artifactBonusArm = Calculator.computeArtifactBonus(artifactArray, "armor");

		// Base stats
		const baseDamage = Calculator.toDecimal(machine.baseStats.damage);
		const baseHealth = Calculator.toDecimal(machine.baseStats.health);
		const baseArmor = Calculator.toDecimal(machine.baseStats.armor);

		// Calculate basic attributes (before crew)
		const basicDmg = Calculator.computeBasicAttribute(baseDamage, levelBonus, engineerBonus, dmgBPBonus, rarityBonus, sacredBonus, inscriptionBonus, artifactBonusDmg);
		const basicHp = Calculator.computeBasicAttribute(baseHealth, levelBonus, engineerBonus, hpBPBonus, rarityBonus, sacredBonus, inscriptionBonus, artifactBonusHp);
		const basicArm = Calculator.computeBasicAttribute(baseArmor, levelBonus, engineerBonus, armBPBonus, rarityBonus, sacredBonus, inscriptionBonus, artifactBonusArm);

		// Crew bonuses (additive)
		const crewBonus = Calculator.computeCrewBonus(crewList);

		// Final battle attributes: basic * (1 + crew_bonus)
		return {
			damage: basicDmg.mul(new Decimal(1).add(crewBonus.dmg)),
			health: basicHp.mul(new Decimal(1).add(crewBonus.hp)),
			armor: basicArm.mul(new Decimal(1).add(crewBonus.arm)),
		};
	}

	/**
	 * Computes machine power for ranking/comparison
	 * Uses power scaling to balance stats appropriately
	 * @param {import('./optimizer.js').MachineStats} stats - Machine stats (battle or arena)
	 * @returns {Decimal} Total power value
	 */
	static computeMachinePower(stats) {
		const dmgVal = Calculator.toDecimal(stats.damage);
		const hpVal = Calculator.toDecimal(stats.health);
		const armVal = Calculator.toDecimal(stats.armor);

		const { DAMAGE_WEIGHT, HEALTH_WEIGHT, ARMOR_WEIGHT, SCALING_EXPONENT } = AppConfig.POWER_CALCULATION;

		const dmgPower = dmgVal.mul(DAMAGE_WEIGHT).pow(SCALING_EXPONENT);
		const hpPower = hpVal.mul(HEALTH_WEIGHT).pow(SCALING_EXPONENT);
		const armPower = armVal.mul(ARMOR_WEIGHT).pow(SCALING_EXPONENT);

		return dmgPower.add(hpPower).add(armPower);
	}

	/**
	 * Computes total squad power (sum of all machine powers)
	 * @param {Array<import('./optimizer.js').Machine>} [machines=[]] - Array of machines
	 * @param {string} [mode='campaign'] - Mode to use: 'campaign' (battleStats) or 'arena' (arenaStats)
	 * @returns {Decimal} Total squad power
	 */
	static computeSquadPower(machines = [], mode = "campaign") {
		let total = new Decimal(0);
		for (let i = 0; i < machines.length; i++) {
			const machine = machines[i];
			const stats = mode === "arena" ? machine.arenaStats : machine.battleStats;
			if (!stats) {
				console.warn(`Machine missing ${mode}Stats:`, machine.name);
				continue;
			}
			total = total.add(Calculator.computeMachinePower(stats)).floor();
		}
		return total;
	}

	/**
	 * Calculates maximum crew slots based on engineer level
	 * @param {number} engineerLevel - Engineer level
	 * @returns {number} Maximum crew slots (4, 5, or 6)
	 */
	static maxCrewSlots(engineerLevel) {
		return AppConfig.getMaxCrewSlots(engineerLevel);
	}
}
