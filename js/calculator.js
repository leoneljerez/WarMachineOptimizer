// calculator.js
import Decimal from "./vendor/break_eternity.esm.js"; // v2.1.3

/**
 * Calculator utility class for all game calculations
 * Handles stat calculations, damage computation, and power metrics
 * @class
 */
export class Calculator {
	/**
	 * Ensures that any value is converted to a Decimal object
	 * @param {*} value - Value to convert (number, string, or Decimal)
	 * @returns {Decimal} Decimal instance
	 */
	static toDecimal(value) {
		if (value instanceof Decimal) {
			return value;
		}
		return new Decimal(value);
	}

	/**
	 * Rarity level mappings for machines
	 * Maps rarity names to numeric levels for calculations
	 * @type {Object.<string, number>}
	 * @readonly
	 */
	static RARITY_LEVELS = {
		common: 0,
		uncommon: 1,
		rare: 2,
		epic: 3,
		legendary: 4,
		mythic: 5,
		titan: 6,
		angel: 7,
		celestial: 8,
	};

	/**
	 * Base stat values for enemy calculations
	 * @type {{damage: Decimal, health: Decimal, armor: Decimal}}
	 * @readonly
	 */
	static BASE = {
		damage: new Decimal(260),
		health: new Decimal(1560),
		armor: new Decimal(30),
	};

	/**
	 * Difficulty multipliers for mission calculations
	 * Each difficulty applies a different scaling factor to enemy stats
	 * @type {Object.<string, Decimal>}
	 * @readonly
	 */
	static DIFFICULTY_MULTIPLIERS = {
		easy: new Decimal(1),
		normal: new Decimal(360),
		hard: new Decimal(2478600),
		insane: new Decimal("5.8e+12"),
		nightmare: new Decimal("2.92e+18"),
	};

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
		return Iterator.from(ownedMachines)
			.map((machine) => {
				const rarity = machine.rarity?.toLowerCase() ?? "common";
				return Calculator.RARITY_LEVELS[rarity] ?? 0;
			})
			.reduce((sum, level) => sum + level, 0);
	}

	/**
	 * Calculates overdrive value for a machine based on rarity
	 * Formula: 0.25 + (rarity_level * 0.03)
	 * @param {import('./optimizer.js').Machine} machine - Machine object
	 * @returns {number} Overdrive value (decimal multiplier)
	 */
	static calculateOverdrive(machine) {
		//console.log("machine in overdrive is: ", machine);
		const rarity = machine.rarity?.toLowerCase() ?? "common";
		const raritylevel = Calculator.RARITY_LEVELS[rarity];
		const startingOverdrive = 0.25;
		const multiplier = 0.03;

		if (rarity === 0) return startingOverdrive;

		return startingOverdrive + (raritylevel * multiplier);
	}

	/**
	 * Gets enemy attributes for a specific mission and difficulty
	 * Applies mission scaling (1.2^mission) and milestone scaling (3^(mission/10))
	 * @param {number} missionNumber - Mission number (1-90)
	 * @param {string} difficulty - Difficulty level (easy, normal, hard, insane, nightmare)
	 * @param {number} milestoneBase - 3 or 2 for the power multiplier - 3 for regular (default), 2 for mission power requirement
	 * @returns {{damage: Decimal, health: Decimal, armor: Decimal}} Enemy stats
	 */
	static enemyAttributes(missionNumber, difficulty, milestoneBase = 3) {
		const diffMultiplier = this.DIFFICULTY_MULTIPLIERS[difficulty];
		const missionNum = missionNumber - 1;
		const milestoneCount = Math.floor(missionNum / 10);

		const missionFactor = new Decimal(1.2).pow(missionNum);
		const milestoneFactor = new Decimal(milestoneBase).pow(milestoneCount);

		const finalMultiplier = diffMultiplier.mul(missionFactor).mul(milestoneFactor);

		return {
			damage: this.BASE.damage.mul(finalMultiplier),
			health: this.BASE.health.mul(finalMultiplier),
			armor: this.BASE.armor.mul(finalMultiplier),
		};
	}

	/**
	 * Creates an enemy team for a mission
	 * Generates 5 identical enemies with stats for the given mission/difficulty
	 * @param {number} missionNumber - Mission number (1-90)
	 * @param {string} difficulty - Difficulty level
	 * @returns {Array<{name: string, baseStats: Object, battleStats: import('./app.js').MachineStats, isDead: boolean}>} Array of 5 enemy objects
	 */
	static getEnemyTeamForMission(missionNumber, difficulty, milestoneBase = 3) {
		const enemyStats = Calculator.enemyAttributes(missionNumber, difficulty, milestoneBase);

		/*
		 * ES2025+ ITERATOR HELPERS (Stage 4 - Production Ready)
		 * Once browser support reaches 95%+ (estimated Q2 2026), replace with:
		 *
		 * return Iterator.range(0, 5)
		 *     .map(i => ({
		 *         name: `Enemy${i + 1}`,
		 *         baseStats: {
		 *             damage: enemyStats.damage,
		 *             health: enemyStats.health,
		 *             armor: enemyStats.armor,
		 *         },
		 *         battleStats: {
		 *             damage: enemyStats.damage,
		 *             health: enemyStats.health,
		 *             maxHealth: enemyStats.health,
		 *             armor: enemyStats.armor,
		 *         },
		 *         isDead: false,
		 *     }))
		 *     .toArray();
		 *
		 * Benefits:
		 * - Iterator.range is built-in (no Array.from)
		 * - More declarative
		 * - Slightly more performant
		 *
		 * Note: Iterator.range is Stage 3 (not yet Stage 4)
		 * Expected in ES2026 or ES2027
		 */

		return Array.from({ length: 5 }, (_, i) => ({
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
	 * Uses difficulty-based percentage thresholds (30% for early easy, 50% for mid easy, 80% default)
	 * @param {number} missionNumber - Mission number (1-90)
	 * @param {string} difficulty - Difficulty level
	 * @returns {Decimal} Required power value to clear the mission
	 */
	static requiredPowerForMission(missionNumber, difficulty) {
		const enemyTeam = Calculator.getEnemyTeamForMission(missionNumber, difficulty, 2);
		const enemyPower = Calculator.computeSquadPower(enemyTeam, "campaign");

		let reqPct = 0.8;
		if (difficulty === "easy") {
			if (missionNumber <= 10) reqPct = 0.3;
			else if (missionNumber <= 30) reqPct = 0.5;
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
		const bonuses = Iterator.from(crewList ?? [])
			.filter((hero) => hero?.percentages)
			.reduce(
				(acc, hero) => {
					const dmgPct = hero.percentages.damage || 0;
					const hpPct = hero.percentages.health || 0;
					const armPct = hero.percentages.armor || 0;

					return {
						dmg: acc.dmg.add(dmgPct > 0 ? dmgPct / 100 : 0),
						hp: acc.hp.add(hpPct > 0 ? hpPct / 100 : 0),
						arm: acc.arm.add(armPct > 0 ? armPct / 100 : 0),
					};
				},
				{ dmg: new Decimal(0), hp: new Decimal(0), arm: new Decimal(0) }
			);

		return bonuses;
	}

	/**
	 * Calculates a single attribute with all bonuses applied
	 * Formula: base * (1 + level) * (1 + engineer) * (1 + blueprint) * (1 + rarity) * (1 + sacred) * (1 + inscription) * (1 + artifact)
	 * All bonuses are multiplicative
	 * @param {number|Decimal} base - Base stat value
	 * @param {number|Decimal} levelBonus - Level bonus multiplier (decimal, e.g., 0.5 for 50%)
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
	 * @returns {Decimal} Total artifact bonus as decimal multiplier (e.g., 0.5 for 50% increase)
	 */
	static computeArtifactBonus(artifactArray, stat) {
		return Iterator.from(artifactArray ?? [])
			.filter((a) => a.stat === stat && a.values)
			.flatMap((a) => Object.entries(a.values))
			.filter(([, quantity]) => quantity && quantity > 0)
			.map(([percentStr, quantity]) => {
				const percent = Number(percentStr);
				return new Decimal(1).add(percent / 100).pow(quantity);
			})
			.reduce((total, mult) => total.mul(mult), new Decimal(1))
			.sub(1);
	}

	/**
	 * Calculates arena attributes with special logarithmic scaling
	 * Arena stats use log scaling: base * (log10(battle/base) + 1)^2
	 * Then applies Mech Fury, Scarab, and Rift bonuses (multiplicative)
	 * @param {import('./optimizer.js').Machine} machine - Machine with battle stats already calculated
	 * @param {number} [globalRarityLevels=0] - Sum of all rarity levels (for Mech Fury bonus)
	 * @param {number} [scarabLevel=0] - Scarab level (affects bonus calculation)
	 * @param {string} [riftRank=''] - Chaos Rift rank (bronze, silver, gold, pearl, sapphire, emerald, ruby, platinum, diamond)
	 * @returns {{damage: Decimal, health: Decimal, armor: Decimal}} Arena stats
	 */
	static calculateArenaAttributes(machine, globalRarityLevels = 0, scarabLevel = 0, riftRank = "") {
		const base105 = new Decimal(1.05);

		// Scarab bonus: min(max(floor((scarabLevel - 3) / 2) + 1, 0) * 0.002, 1)
		const scarabBonus = Decimal.min(Decimal.max(new Decimal(scarabLevel).sub(3).div(2).floor().add(1), 0).mul(0.002), 1);

		/*
		 * ES2025+ PATTERN MATCHING (Stage 1 - Not Ready Yet)
		 * This is a future Stage 1 proposal. DO NOT USE YET.
		 * Estimated availability: ES2028-2029
		 *
		 * Once pattern matching reaches Stage 4, replace switch with:
		 *
		 * const riftBonus = match (String(riftRank).toLowerCase()) {
		 *     when "sapphire" -> new Decimal(0.01),
		 *     when "emerald" -> new Decimal(0.02),
		 *     when "ruby" -> new Decimal(0.03),
		 *     when "platinum" -> new Decimal(0.04),
		 *     when "diamond" -> new Decimal(0.05),
		 *     default -> new Decimal(0)
		 * };
		 *
		 * Benefits:
		 * - Expression instead of statement
		 * - No fall-through bugs
		 * - More concise
		 * - Better type inference (with TypeScript)
		 */

		// Rift rank bonuses (multiplicative)
		let riftBonus = new Decimal(0);
		switch (String(riftRank).toLowerCase()) {
			case "sapphire":
				riftBonus = new Decimal(0.01);
				break;
			case "emerald":
				riftBonus = new Decimal(0.02);
				break;
			case "ruby":
				riftBonus = new Decimal(0.03);
				break;
			case "platinum":
				riftBonus = new Decimal(0.04);
				break;
			case "diamond":
				riftBonus = new Decimal(0.05);
				break;
			default:
				riftBonus = new Decimal(0);
		}

		// Mech Fury bonus: 1.05^globalRarityLevels - 1
		const mechFuryBonus = base105.pow(globalRarityLevels).sub(1);

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
	 * Combines level, engineer, blueprint, rarity, sacred card, inscription card, artifact, and crew bonuses
	 * Most bonuses are multiplicative; crew bonuses are additive at the end
	 * Formula per stat: base * bonuses * (1 + crew_bonus)
	 * @param {import('./optimizer.js').Machine} machine - Machine object with base stats
	 * @param {Array<import('./optimizer.js').Hero>} [crewList=[]] - Array of crew members
	 * @param {number} [globalRarityLevels=0] - Sum of all rarity levels
	 * @param {Array<{stat: string, values: Object}>} [artifactArray=[]] - Artifact configurations
	 * @param {number} [engineerLevel=0] - Engineer level
	 * @returns {{damage: Decimal, health: Decimal, armor: Decimal}} Battle stats
	 */
	static calculateBattleAttributes(machine, crewList = [], globalRarityLevels = 0, artifactArray = [], engineerLevel = 0) {
		const base105 = new Decimal(1.05);

		// Level bonus: 1.05^(level - 1) - 1
		const levelBonus = base105.pow(machine.level - 1).sub(1);

		// Engineer bonus: 1.05^(engineer_level - 1) - 1
		const engineerBonus = base105.pow(engineerLevel - 1).sub(1);

		// Blueprint bonus: 1.05^blueprint_level - 1
		const dmgBPBonus = base105.pow(machine.blueprints.damage).sub(1);
		const hpBPBonus = base105.pow(machine.blueprints.health).sub(1);
		const armBPBonus = base105.pow(machine.blueprints.armor).sub(1);

		// Rarity bonus: 1.05^(machine_rarity + global_rarity) - 1
		const rarityLevel = Calculator.RARITY_LEVELS[machine.rarity?.toLowerCase()] || 0;
		const rarityBonus = base105.pow(rarityLevel + globalRarityLevels).sub(1);

		// Card bonuses: 1.05^card_level - 1
		const sacredBonus = base105.pow(machine.sacredLevel).sub(1);
		const inscriptionBonus = base105.pow(machine.inscriptionLevel).sub(1);

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
	 * Formula: ((10 * damage)^0.7) + ((1 * health)^0.7) + ((10 * armor)^0.7)
	 * Uses power scaling to balance stats appropriately
	 * @param {import('./optimizer.js').MachineStats} stats - Machine stats (battle or arena)
	 * @returns {Decimal} Total power value
	 */
	static computeMachinePower(stats) {
		const dmgVal = Calculator.toDecimal(stats.damage);
		const hpVal = Calculator.toDecimal(stats.health);
		const armVal = Calculator.toDecimal(stats.armor);

		const dmgPower = dmgVal.mul(10).pow(0.7);
		const hpPower = hpVal.mul(1).pow(0.7);
		const armPower = armVal.mul(10).pow(0.7);

		return dmgPower.add(hpPower).add(armPower);
	}

	/**
	 * Computes total squad power (sum of all machine powers)
	 * @param {Array<import('./optimizer.js').Machine>} [machines=[]] - Array of machines
	 * @param {string} [mode='campaign'] - Mode to use: 'campaign' (battleStats) or 'arena' (arenaStats)
	 * @returns {Decimal} Total squad power
	 */
	static computeSquadPower(machines = [], mode = "campaign") {
		//let totalPower = new Decimal(0);

		return Iterator.from(machines)
			.map((machine) => {
				const stats = mode === "arena" ? machine.arenaStats : machine.battleStats;
				if (!stats) {
					console.warn(`Machine missing ${mode}Stats:`, machine.name);
					return new Decimal(0);
				}
				return Calculator.computeMachinePower(stats);
			})
			.reduce((total, power) => total.add(power), new Decimal(0));
	}

	/**
	 * Calculates maximum crew slots based on engineer level
	 * Level 1-29: 4 slots
	 * Level 30-59: 5 slots
	 * Level 60+: 6 slots
	 * @param {number} engineerLevel - Engineer level
	 * @returns {number} Maximum crew slots (4, 5, or 6)
	 */
	static maxCrewSlots(engineerLevel) {
		if (engineerLevel >= 60) return 6;
		if (engineerLevel >= 30) return 5;
		return 4;
	}
}
