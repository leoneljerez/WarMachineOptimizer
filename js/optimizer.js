// optimizer.js
import { Calculator } from "./calculator.js";
import { BattleEngine } from "./battleengine.js";
import Decimal from "./vendor/break_eternity.esm.js";
import { AppConfig } from "./config.js";

/**
 * @typedef {Object} OptimizerConfig
 * @property {import('./app.js').Machine[]} ownedMachines - Array of owned machines
 * @property {import('./app.js').Hero[]} heroes - Array of heroes
 * @property {number} engineerLevel - Engineer level
 * @property {number} scarabLevel - Scarab level
 * @property {Array<{stat: string, values: Object}>} artifactArray - Array of artifact configurations
 * @property {number} globalRarityLevels - Sum of all machine rarity levels
 * @property {string} riftRank - Chaos Rift rank
 */

/**
 * @typedef {Object} CampaignResult
 * @property {number} totalStars - Total stars earned
 * @property {number} lastCleared - Last mission cleared
 * @property {import('./app.js').Machine[]} formation - Optimal formation
 * @property {Decimal} battlePower - Total battle power
 * @property {Decimal} arenaPower - Total arena power
 */

/**
 * @typedef {Object} ArenaResult
 * @property {import('./app.js').Machine[]} formation - Optimal formation
 * @property {Decimal} arenaPower - Total arena power
 * @property {Decimal} battlePower - Total battle power
 */

/**
 * Optimizer class for finding optimal machine formations and crew assignments
 */
export class Optimizer {
	/**
	 * Creates an Optimizer instance
	 * @param {OptimizerConfig} config - Optimizer configuration
	 */
	constructor({ ownedMachines, heroes, engineerLevel, scarabLevel, artifactArray, globalRarityLevels, riftRank }) {
		this.ownedMachines = ownedMachines;
		this.heroes = heroes;
		this.engineerLevel = engineerLevel;
		this.scarabLevel = scarabLevel;
		this.artifactArray = artifactArray;
		this.globalRarityLevels = globalRarityLevels;
		this.riftRank = riftRank;
		this.battleEngine = new BattleEngine();
		this.maxSlots = Calculator.maxCrewSlots(engineerLevel);
	}

	/**
	 * Scores a hero for a specific machine based on role and current stats
	 * @param {import('./app.js').Hero} hero - Hero to score
	 * @param {import('./app.js').Machine} machine - Machine to score for
	 * @param {import('./app.js').MachineStats} currentStats - Current machine stats
	 * @param {string} mode - "campaign" or "arena"
	 * @returns {number} Score value (higher is better)
	 */
	scoreHeroForMachine(hero, machine, currentStats, mode = "campaign") {
		const role = machine.role === "tank" ? "tank" : "dps";

		const dmgBonus = hero.percentages.damage / 100;
		const hpBonus = hero.percentages.health / 100;
		const armBonus = hero.percentages.armor / 100;

		if (dmgBonus === 0 && hpBonus === 0 && armBonus === 0) {
			return 0;
		}

		const currentDmg = Calculator.toDecimal(currentStats.damage).toNumber();
		const currentHp = Calculator.toDecimal(currentStats.health).toNumber();
		const currentArm = Calculator.toDecimal(currentStats.armor).toNumber();

		const dmgGain = dmgBonus * currentDmg;
		const hpGain = hpBonus * currentHp;
		const armGain = armBonus * currentArm;

		let score = 0;

		const weights = mode === "campaign" ? AppConfig.HERO_SCORING.CAMPAIGN : AppConfig.HERO_SCORING.ARENA;
		const roleWeights = role === "tank" ? weights.TANK : weights.DPS;

		score = dmgGain * roleWeights.damage + hpGain * roleWeights.health + armGain * roleWeights.armor;

		return score;
	}

	/**
	 * Calculates both battle and arena stats for a machine with crew
	 * @param {import('./app.js').Machine} machine - Machine to calculate for
	 * @param {import('./app.js').Hero[]} crew - Crew members
	 * @returns {{battleStats: import('./app.js').MachineStats, arenaStats: import('./app.js').MachineStats}}
	 */
	calculateAllStats(machine, crew) {
		const battleStats = Calculator.calculateBattleAttributes(machine, crew, this.globalRarityLevels, this.artifactArray, this.engineerLevel);

		const machineWithBattleStats = {
			...machine,
			battleStats: {
				damage: battleStats.damage,
				health: battleStats.health,
				maxHealth: battleStats.health,
				armor: battleStats.armor,
			},
		};

		const arenaStats = Calculator.calculateArenaAttributes(machineWithBattleStats, this.globalRarityLevels, this.scarabLevel, this.riftRank);

		return {
			battleStats: {
				damage: battleStats.damage,
				health: battleStats.health,
				maxHealth: battleStats.health,
				armor: battleStats.armor,
			},
			arenaStats: {
				damage: arenaStats.damage,
				health: arenaStats.health,
				maxHealth: arenaStats.health,
				armor: arenaStats.armor,
			},
		};
	}

	/**
	 * Optimizes crew assignments globally across all machines
	 * @param {import('./app.js').Machine[]} machines - Machines to optimize
	 * @param {string} mode - "campaign" or "arena"
	 * @returns {import('./app.js').Machine[]} Machines with optimized crew
	 */
	optimizeCrewGlobally(machines, mode = "campaign") {
		// Use Set for O(1) removal instead of array splice
		const availableHeroIds = new Set(this.heroes.map((h) => h.id));
		const heroMap = new Map(this.heroes.map((h) => [h.id, h]));

		const machineStates = machines.map((machine) => {
			const stats = this.calculateAllStats(machine, []);
			const power = Calculator.computeMachinePower(mode === "arena" ? stats.arenaStats : stats.battleStats);
			return {
				machine,
				crew: [],
				stats,
				power,
			};
		});

		machineStates.sort((a, b) => b.power.cmp(a.power));

		// Partition tanks/dps
		const tanks = [];
		const dps = [];
		for (let i = 0; i < machineStates.length; i++) {
			const ms = machineStates[i];
			if (ms.machine.role === "tank") {
				tanks.push(ms);
			} else {
				dps.push(ms);
			}
		}

		// Priority order
		const priorityOrder = [];
		if (dps.length > 0) priorityOrder.push(dps[0]);
		if (tanks.length > 0) priorityOrder.push(tanks[0]);

		const priorityIds = new Set(priorityOrder.map((ms) => ms.machine.id));
		for (let i = 0; i < machineStates.length; i++) {
			const ms = machineStates[i];
			if (!priorityIds.has(ms.machine.id)) {
				priorityOrder.push(ms);
			}
		}

		// Assign crew
		for (let i = 0; i < priorityOrder.length; i++) {
			const machineState = priorityOrder[i];

			while (machineState.crew.length < this.maxSlots && availableHeroIds.size > 0) {
				const currentStats = mode === "arena" ? machineState.stats.arenaStats : machineState.stats.battleStats;

				let bestHeroId = null;
				let bestScore = 0;

				// Iterate through available hero IDs
				for (const heroId of availableHeroIds) {
					const hero = heroMap.get(heroId);
					const score = this.scoreHeroForMachine(hero, machineState.machine, currentStats, mode);

					if (score > bestScore) {
						bestScore = score;
						bestHeroId = heroId;
					}
				}

				if (bestHeroId === null || bestScore === 0) break;

				const hero = heroMap.get(bestHeroId);
				machineState.crew.push(hero);
				availableHeroIds.delete(bestHeroId);

				machineState.stats = this.calculateAllStats(machineState.machine, machineState.crew);
			}
		}

		return machineStates.map((ms) => ({
			...ms.machine,
			crew: ms.crew,
			battleStats: ms.stats.battleStats,
			arenaStats: ms.stats.arenaStats,
		}));
	}

	/**
	 * Selects the best five machines based on power
	 * @param {import('./app.js').Machine[]} optimizedMachines - Machines to select from
	 * @param {string} mode - "campaign" or "arena"
	 * @returns {import('./app.js').Machine[]} Top 5 machines
	 */
	selectBestFive(optimizedMachines, mode = "campaign") {
		if (optimizedMachines.length === 0) return [];

		const machinesWithPower = optimizedMachines.map((m) => {
			const stats = mode === "arena" ? m.arenaStats : m.battleStats;
			const power = Calculator.computeMachinePower(stats);
			return { machine: m, power };
		});

		machinesWithPower.sort((a, b) => b.power.cmp(a.power));

		return machinesWithPower.slice(0, 5).map((x) => x.machine);
	}

	/**
	 * Arranges team by role for optimal positioning
	 * @param {import('./app.js').Machine[]} team - Team to arrange
	 * @param {number} mission - Mission number
	 * @param {string} difficulty - Difficulty level
	 * @param {Object|null} enemyStats - Pre-calculated enemy stats (optional, for performance)
	 * @returns {import('./app.js').Machine[]} Arranged team
	 */
	arrangeByRole(team, mission = 1, difficulty = "easy", enemyStats = null) {
		if (!team || team.length === 0) return [];

		// Calculate only if not provided
		const stats = enemyStats || Calculator.enemyAttributes(mission, difficulty);

		// Pre-categorize machines
		const categorized = team.reduce((acc, machine) => {
			let category;

			if (machine.role === "tank") {
				const potentialDamage = Calculator.computeDamageTaken(stats.damage, machine.battleStats.armor);
				category = potentialDamage.gt(machine.battleStats.health.mul(0.5)) ? "useless" : "tank";
			} else {
				const dmgDealt = Calculator.computeDamageTaken(machine.battleStats.damage, stats.armor);
				category = dmgDealt.eq(0) ? "useless" : "remaining";
			}

			(acc[category] ??= []).push(machine);
			return acc;
		}, {});

		const useless = (categorized.useless ?? []).toSorted((a, b) => b.battleStats.health.cmp(a.battleStats.health));
		const tanks = (categorized.tank ?? []).toSorted((a, b) => a.battleStats.health.cmp(b.battleStats.health));
		let remaining = (categorized.remaining ?? []).toSorted((a, b) => a.battleStats.damage.cmp(b.battleStats.damage));

		let strongestDPS = null;
		if (remaining.length > 0 && team.length === 5) {
			strongestDPS = remaining.at(-1);
			remaining = remaining.slice(0, -1);
		}

		const formation = [...useless, ...tanks, ...remaining];

		if (strongestDPS) {
			formation.splice(formation.length - 1, 0, strongestDPS);
		}

		return formation;
	}

	/**
	 * Runs Monte Carlo simulations with early stopping
	 * @param {import('./app.js').Machine[]} team - Team to test
	 * @param {number} mission - Mission number
	 * @param {string} difficulty - Difficulty level
	 * @param {number} maxSimulations - Maximum number of simulations to run
	 * @param {Array<Object>|null} enemyFormation - Pre-calculated enemy formation (optional, for performance)
	 * @returns {{clearable: boolean, simulations: number, winRate: number}} Result
	 */
	runMonteCarloSimulation(team, mission, difficulty, maxSimulations = AppConfig.MONTE_CARLO_SIMULATIONS, enemyFormation = null) {
		// Calculate only if not provided
		const enemies = enemyFormation || Calculator.getEnemyTeamForMission(mission, difficulty);

		for (let i = 0; i < maxSimulations; i++) {
			const result = this.battleEngine.runBattle(team, enemies, AppConfig.MAX_BATTLE_ROUNDS, true);

			if (result.playerWon) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Pushes star levels using Monte Carlo simulations
	 * @param {import('./app.js').Machine[]} formation - Current best formation
	 * @param {Object} lastMissionByDifficulty - Map of difficulty -> last mission cleared (e.g., {easy: 40, normal: 20, hard: 1})
	 * @param {string[]} difficulties - Difficulty levels
	 * @returns {{additionalStars: number, lastMissionByDifficulty: Object}} Additional stars earned and updated mission tracker
	 */
	pushStarsWithMonteCarlo(formation, lastMissionByDifficulty, difficulties = AppConfig.DIFFICULTY_KEYS) {
		if (formation.length === 0) {
			return { additionalStars: 0, lastMissionByDifficulty };
		}

		let additionalStars = 0;
		const updatedLastMissions = { ...lastMissionByDifficulty };
		const ourPower = Calculator.computeSquadPower(formation, "campaign");

		for (let diffIdx = 0; diffIdx < difficulties.length; diffIdx++) {
			const difficulty = difficulties[diffIdx];
			const lastMission = updatedLastMissions[difficulty] || 0;

			for (let mission = lastMission + 1; mission <= AppConfig.MAX_MISSIONS_PER_DIFFICULTY; mission++) {
				const requiredPower = Calculator.requiredPowerForMission(mission, difficulty);
				if (ourPower.lt(requiredPower)) break;

				const enemyFormation = Calculator.getEnemyTeamForMission(mission, difficulty);
				const enemyStats = {
					damage: enemyFormation[0].baseStats.damage,
					health: enemyFormation[0].baseStats.health,
					armor: enemyFormation[0].baseStats.armor,
				};

				const arranged = this.arrangeByRole(formation, mission, difficulty, enemyStats);
				const result = this.runMonteCarloSimulation(arranged, mission, difficulty, AppConfig.MONTE_CARLO_SIMULATIONS, enemyFormation);

				if (result) {
					additionalStars++;
					updatedLastMissions[difficulty] = mission;
				}
			}
		}

		return {
			additionalStars,
			lastMissionByDifficulty: updatedLastMissions,
		};
	}

	/**
	 * Optimizes campaign formation for maximum stars
	 * @param {Object} config - Configuration object
	 * @param {import('./app.js').Machine[]} config.ownedMachines - Owned machines
	 * @param {number} config.maxMission - Maximum mission to test
	 * @param {string[]} config.difficulties - Difficulty levels to test
	 * @returns {CampaignResult} Optimization result
	 */
	optimizeCampaignMaxStars({ ownedMachines, maxMission = AppConfig.MAX_MISSIONS_PER_DIFFICULTY, difficulties = AppConfig.DIFFICULTY_KEYS }) {
		let totalStars = 0;
		let lastWinningTeam = [];

		// Track last mission cleared per difficulty: {easy: 40, normal: 20, hard: 1, insane: null, nightmare: null}
		const lastMissionByDifficulty = {};
		difficulties.forEach((diff) => (lastMissionByDifficulty[diff] = null));

		if (!ownedMachines?.length) {
			return { totalStars, lastCleared: 0, formation: [], battlePower: new Decimal(0), arenaPower: new Decimal(0) };
		}

		let currentBestTeam = null;
		let lastOptimizedMission = 0;

		// Phase 1: Standard optimization with basic battle simulation
		for (let mission = 1; mission <= maxMission; mission++) {
			const shouldReoptimize = !currentBestTeam || mission - lastOptimizedMission >= AppConfig.REOPTIMIZE_INTERVAL;

			if (shouldReoptimize) {
				const allOptimized = this.optimizeCrewGlobally(ownedMachines, "campaign");
				currentBestTeam = this.selectBestFive(allOptimized, "campaign");

				if (currentBestTeam.length === 0) break;

				lastOptimizedMission = mission;
			}

			let missionHasClears = false;

			for (const difficulty of difficulties) {
				// Calculate enemy formation once
				const enemyFormation = Calculator.getEnemyTeamForMission(mission, difficulty);

				// Extract stats from enemy formation (all enemies are identical)
				const enemyStats = {
					damage: enemyFormation[0].baseStats.damage,
					health: enemyFormation[0].baseStats.health,
					armor: enemyFormation[0].baseStats.armor,
				};

				// Pass enemyStats to avoid recalculation
				const arrangedTeam = this.arrangeByRole(currentBestTeam, mission, difficulty, enemyStats);

				const requiredPower = Calculator.requiredPowerForMission(mission, difficulty);
				const ourPower = Calculator.computeSquadPower(arrangedTeam, "campaign");

				if (ourPower.lt(requiredPower)) {
					break;
				}

				// Reuse enemyFormation for battle
				const result = this.battleEngine.runBattle(arrangedTeam, enemyFormation, AppConfig.MAX_BATTLE_ROUNDS, true);

				if (result.playerWon) {
					totalStars++;
					missionHasClears = true;
					lastMissionByDifficulty[difficulty] = mission;

					lastWinningTeam = arrangedTeam.map((m) => ({
						...m,
						crew: [...m.crew],
					}));
				} else {
					break;
				}
			}

			// Stop if we can't clear any difficulty on this mission
			if (!missionHasClears && mission > 1) {
				break;
			}
		}

		// Phase 2: Monte Carlo simulation to push stars further
		const monteCarloResult = this.pushStarsWithMonteCarlo(lastWinningTeam, lastMissionByDifficulty, difficulties);

		totalStars += monteCarloResult.additionalStars;

		const battlePower = Calculator.computeSquadPower(lastWinningTeam, "campaign");
		const arenaPower = Calculator.computeSquadPower(lastWinningTeam, "arena");

		return {
			totalStars,
			lastCleared: monteCarloResult.lastMissionByDifficulty,
			formation: lastWinningTeam,
			battlePower,
			arenaPower,
		};
	}

	/**
	 * Optimizes formation for arena mode
	 * @param {import('./app.js').Machine[]} ownedMachines - Owned machines
	 * @returns {ArenaResult} Optimization result
	 */
	optimizeForArena(ownedMachines) {
		if (!ownedMachines?.length) {
			return { formation: [], totalPower: new Decimal(0) };
		}

		const allOptimized = this.optimizeCrewGlobally(ownedMachines, "arena");

		let bestTeam = this.selectBestFive(allOptimized, "arena");
		bestTeam = this.arrangeByRole(bestTeam, 1, "easy");

		const arenaPower = Calculator.computeSquadPower(bestTeam, "arena");
		const battlePower = Calculator.computeSquadPower(bestTeam, "campaign");

		return { formation: bestTeam, arenaPower, battlePower };
	}
}
