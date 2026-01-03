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
	 * @returns {Decimal} Score value (higher is better)
	 */
	scoreHeroForMachine(hero, machine, currentStats, mode = "campaign") {
		const role = machine.role === "tank" ? "tank" : "dps";

		const dmgBonus = new Decimal(hero.percentages.damage).div(100);
		const hpBonus = new Decimal(hero.percentages.health).div(100);
		const armBonus = new Decimal(hero.percentages.armor).div(100);

		if (dmgBonus.eq(0) && hpBonus.eq(0) && armBonus.eq(0)) {
			return new Decimal(0);
		}

		const currentDmg = Calculator.toDecimal(currentStats.damage);
		const currentHp = Calculator.toDecimal(currentStats.health);
		const currentArm = Calculator.toDecimal(currentStats.armor);

		const dmgGain = dmgBonus.mul(currentDmg);
		const hpGain = hpBonus.mul(currentHp);
		const armGain = armBonus.mul(currentArm);

		const weights = mode === "campaign" ? AppConfig.HERO_SCORING.CAMPAIGN : AppConfig.HERO_SCORING.ARENA;
		const roleWeights = role === "tank" ? weights.TANK : weights.DPS;

		const score = dmgGain.mul(roleWeights.damage).add(hpGain.mul(roleWeights.health)).add(armGain.mul(roleWeights.armor));

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
	 * Calculates total benefit score for a machine's entire crew
	 * @param {import('./app.js').Machine} machine - Machine to score
	 * @param {import('./app.js').Hero[]} crew - Crew members
	 * @param {string} mode - "campaign" or "arena"
	 * @returns {Decimal} Total score for this crew assignment
	 */
	scoreCrewForMachine(machine, crew, mode) {
		// Get base stats (without crew)
		const baseStats = this.calculateAllStats(machine, []);
		const baseForScoring = mode === "arena" ? baseStats.arenaStats : baseStats.battleStats;

		let totalScore = new Decimal(0);

		// Sum up scores for each crew member
		for (const hero of crew) {
			const score = this.scoreHeroForMachine(hero, machine, baseForScoring, mode);
			totalScore = totalScore.add(score);
		}

		return totalScore;
	}

	/**
	 * Greedy assignment algorithm that assigns heroes to slots by highest score
	 * Simple, fast, and gives near-optimal results
	 * @param {import('./app.js').Hero[]} heroes - Available heroes
	 * @param {Array<{machine: import('./app.js').Machine, slotIndex: number}>} machineSlots - Available slots
	 * @param {Map} precomputedStats - Precomputed stats for each machine
	 * @param {string} mode - "campaign" or "arena"
	 * @returns {Map<number, import('./app.js').Hero[]>} Map of machine.id to assigned crew
	 */
	greedyAssignment(heroes, machineSlots, precomputedStats, mode) {
		// Build all possible (hero, slot) pairs with their scores
		const assignments = [];

		for (let h = 0; h < heroes.length; h++) {
			const hero = heroes[h];

			for (let s = 0; s < machineSlots.length; s++) {
				// eslint-disable-next-line no-unused-vars
				const { machine, slotIndex } = machineSlots[s];
				const stats = precomputedStats.get(machine.id);
				const currentStats = mode === "arena" ? stats.arenaStats : stats.battleStats;
				const score = this.scoreHeroForMachine(hero, machine, currentStats, mode);

				assignments.push({
					heroIndex: h,
					hero,
					slotIndex: s,
					machine,
					score,
				});
			}
		}

		// Sort by score (descending - highest scores first)
		assignments.sort((a, b) => b.score.cmp(a.score));

		// Greedily assign heroes to slots
		const usedHeroes = new Set();
		const usedSlots = new Set();
		const machineCrewMap = new Map();

		for (const assignment of assignments) {
			// Skip if hero or slot already used
			if (usedHeroes.has(assignment.heroIndex)) continue;
			if (usedSlots.has(assignment.slotIndex)) continue;

			// Assign this hero to this slot
			if (!machineCrewMap.has(assignment.machine.id)) {
				machineCrewMap.set(assignment.machine.id, []);
			}
			machineCrewMap.get(assignment.machine.id).push(assignment.hero);

			usedHeroes.add(assignment.heroIndex);
			usedSlots.add(assignment.slotIndex);

			// Stop when all heroes or all slots are assigned
			if (usedHeroes.size === heroes.length || usedSlots.size === machineSlots.length) {
				break;
			}
		}

		return machineCrewMap;
	}

	/**
	 * Improves greedy solution with local 2-opt swaps using proper scoring
	 * Tries swapping pairs of hero assignments to see if total score improves
	 * @param {import('./app.js').Machine[]} machines - Machines with current crew assignments
	 * @param {import('./app.js').Hero[]} heroes - All heroes
	 * @param {string} mode - "campaign" or "arena"
	 * @param {number} maxIterations - Maximum swap iterations
	 * @returns {import('./app.js').Machine[]} Machines with improved crew
	 */
	localOptimization(machines, heroes, mode, maxIterations = 100) {
		let improved = true;
		let iterations = 0;

		while (improved && iterations < maxIterations) {
			improved = false;
			iterations++;

			// Try swapping crew between all pairs of machines
			for (let i = 0; i < machines.length; i++) {
				for (let j = i + 1; j < machines.length; j++) {
					const machineA = machines[i];
					const machineB = machines[j];

					if (!machineA.crew || !machineB.crew) continue;
					if (machineA.crew.length === 0 || machineB.crew.length === 0) continue;

					// Calculate current total score using proper scoring function
					const currentScoreA = this.scoreCrewForMachine(machineA, machineA.crew, mode);
					const currentScoreB = this.scoreCrewForMachine(machineB, machineB.crew, mode);
					const currentTotal = currentScoreA.add(currentScoreB);

					// Try swapping each crew member from A with each from B
					for (let ca = 0; ca < machineA.crew.length; ca++) {
						for (let cb = 0; cb < machineB.crew.length; cb++) {
							// Create swapped crew arrays
							const crewA = [...machineA.crew];
							const crewB = [...machineB.crew];
							const temp = crewA[ca];
							crewA[ca] = crewB[cb];
							crewB[cb] = temp;

							// Calculate new scores with swapped crew
							const newScoreA = this.scoreCrewForMachine(machineA, crewA, mode);
							const newScoreB = this.scoreCrewForMachine(machineB, crewB, mode);
							const newTotal = newScoreA.add(newScoreB);

							// If swap improves total score, apply it
							if (newTotal.gt(currentTotal)) {
								// Apply the swap
								machineA.crew = crewA;
								machineB.crew = crewB;

								// Recalculate full stats for both machines
								const newStatsA = this.calculateAllStats(machineA, crewA);
								const newStatsB = this.calculateAllStats(machineB, crewB);

								machineA.battleStats = newStatsA.battleStats;
								machineA.arenaStats = newStatsA.arenaStats;

								machineB.battleStats = newStatsB.battleStats;
								machineB.arenaStats = newStatsB.arenaStats;

								improved = true;
								break;
							}
						}
						if (improved) break;
					}
					if (improved) break;
				}
				if (improved) break;
			}
		}

		return machines;
	}

	/**
	 * Optimizes crew assignments globally using greedy algorithm with local optimization
	 * @param {import('./app.js').Machine[]} machines - Machines to optimize
	 * @param {string} mode - "campaign" or "arena"
	 * @returns {import('./app.js').Machine[]} Machines with optimized crew
	 */
	optimizeCrewGlobally(machines, mode = "campaign") {
		if (!this.heroes?.length || !machines?.length) return machines;

		const heroes = this.heroes;
		const maxSlots = this.maxSlots;

		// Step 1: Expand machines into slots
		const machineSlots = [];
		for (const machine of machines) {
			for (let s = 0; s < maxSlots; s++) {
				machineSlots.push({ machine, slotIndex: s });
			}
		}

		// Step 2: Precompute base stats for all machines (without crew)
		const precomputedStats = new Map();
		for (const machine of machines) {
			const stats = this.calculateAllStats(machine, []);
			precomputedStats.set(machine.id, stats);
		}

		// Step 3: Greedy assignment - assign heroes to slots by highest score
		const machineCrewMap = this.greedyAssignment(heroes, machineSlots, precomputedStats, mode);

		// Step 4: Apply crew assignments and recalculate stats
		let optimizedMachines = machines.map((machine) => {
			const crew = machineCrewMap.get(machine.id) ?? [];
			const stats = this.calculateAllStats(machine, crew);

			return {
				...machine,
				crew,
				battleStats: stats.battleStats,
				arenaStats: stats.arenaStats,
			};
		});

		// Step 5: Apply local optimization (2-opt swaps) using proper scoring
		optimizedMachines = this.localOptimization(optimizedMachines, heroes, mode, 100);

		return optimizedMachines;
	}

	/**
	 * Selects the best five machines based on power
	 * @param {import('./app.js').Machine[]} optimizedMachines - Machines to select from
	 * @param {string} mode - "campaign" or "arena"
	 * @returns {import('./app.js').Machine[]} Top 5 machines
	 */
	selectBestFive(ownedMachines, mode = "campaign") {
		if (ownedMachines.length === 0) return [];

		const machinesWithPower = ownedMachines.map((machine) => {
			const stats = this.calculateAllStats(machine, []);
			const power = Calculator.computeMachinePower(mode === "arena" ? stats.arenaStats : stats.battleStats);

			return {
				machine,
				stats,
				power,
			};
		});

		machinesWithPower.sort((a, b) => b.power.cmp(a.power));

		return machinesWithPower.slice(0, 5).map((m) => ({
			...m.machine,
			crew: [],
			battleStats: m.stats.battleStats,
			arenaStats: m.stats.arenaStats,
		}));
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
				const allOptimized = this.selectBestFive(ownedMachines, "campaign");
				currentBestTeam = this.optimizeCrewGlobally(allOptimized, "campaign");

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

		const topFive = this.selectBestFive(ownedMachines, "arena");
		let allOptimized = this.optimizeCrewGlobally(topFive, "arena");

		allOptimized = this.arrangeByRole(allOptimized, 1, "easy");

		const arenaPower = Calculator.computeSquadPower(allOptimized, "arena");
		const battlePower = Calculator.computeSquadPower(allOptimized, "campaign");

		return { formation: allOptimized, arenaPower, battlePower };
	}
}
