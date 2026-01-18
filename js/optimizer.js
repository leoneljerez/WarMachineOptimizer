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
	scoreHeroForMachine(hero, machine, currentStats, mode) {
		const role = machine.role === "tank" ? "tank" : "dps";
		const weights = mode === "campaign" ? AppConfig.HERO_SCORING.CAMPAIGN : AppConfig.HERO_SCORING.ARENA;
		const roleWeights = role === "tank" ? weights.TANK : weights.DPS;

		// 1. Stat Gain (Relative to 100%)
		const dmgScore = new Decimal(hero.percentages.damage).div(100).mul(roleWeights.damage);
		const hpScore = new Decimal(hero.percentages.health).div(100).mul(roleWeights.health);
		const armScore = new Decimal(hero.percentages.armor).div(100).mul(roleWeights.armor);

		let baseScore = dmgScore.add(hpScore).add(armScore);
		if (baseScore.lte(0)) return new Decimal(0);

		// 2. Power Tier Multiplier (Uses log to keep numbers manageable)
		const power = Calculator.computeMachinePower(currentStats);
		const logPower = power.gt(0) ? power.log10().add(1) : new Decimal(1);

		if (mode === "campaign") return baseScore.mul(logPower).pow(2);

		return baseScore.mul(logPower);
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
	 * Kuhn-Munkres (Hungarian) Algorithm for Optimal Assignment.
	 * Solves the Maximum Weight Perfect Matching problem in a bipartite graph to find the
	 * global maximum benefit for assigning heroes to machine slots based on calculated scores.
	 * @param {Array<Object>} heroes - Array of hero objects to be assigned.
	 * @param {Array<Object>} machineSlots - Array of available machine slot objects.
	 * @param {Map<string, Object>} modeContextStats - Map of machine IDs to their current environmental/mode stats.
	 * @param {string} mode - The current game mode (e.g., 'campaign' or 'arena') used for scoring.
	 * @returns {Map<string, Array<Object>>} A Map where keys are machine IDs and values are arrays of assigned hero objects.
	 */
	kmAssignment(heroes, machineSlots, modeContextStats, mode) {
		const n = heroes.length;
		const m = machineSlots.length;
		const size = Math.max(n, m);

		let weight = Array.from({ length: size + 1 }, () => Array(size + 1).fill(new Decimal(0)));
		let lx = Array(size + 1).fill(new Decimal(0));
		let ly = Array(size + 1).fill(new Decimal(0));
		let matchY = Array(size + 1).fill(0);
		let slack = Array(size + 1).fill(new Decimal(0));
		let pre = Array(size + 1).fill(0);
		let visY = Array(size + 1).fill(false);

		for (let i = 1; i <= n; i++) {
			for (let j = 1; j <= m; j++) {
				const { machine } = machineSlots[j - 1];
				const currentStats = modeContextStats.get(machine.id);
				const score = this.scoreHeroForMachine(heroes[i - 1], machine, currentStats, mode);
				weight[i][j] = score;
				if (score.gt(lx[i])) lx[i] = score;
			}
		}

		for (let i = 1; i <= size; i++) {
			slack.fill(new Decimal("1e308"));
			visY.fill(false);
			pre.fill(0);
			let curY = 0;
			matchY[0] = i;

			do {
				visY[curY] = true;
				let curX = matchY[curY],
					delta = new Decimal("1e308"),
					nextY = 0;
				for (let y = 1; y <= size; y++) {
					if (!visY[y]) {
						let curDiff = lx[curX].add(ly[y]).sub(weight[curX][y]);
						if (curDiff.lt(slack[y])) {
							slack[y] = curDiff;
							pre[y] = curY;
						}
						if (slack[y].lt(delta)) {
							delta = slack[y];
							nextY = y;
						}
					}
				}
				// Precision Guard for break_eternity.js
				if (delta.lt(1e-12)) delta = new Decimal(0);
				if (delta.gt(0)) {
					for (let j = 0; j <= size; j++) {
						if (visY[j]) {
							lx[matchY[j]] = lx[matchY[j]].sub(delta);
							ly[j] = ly[j].add(delta);
						} else slack[j] = slack[j].sub(delta);
					}
				}
				curY = nextY;
			} while (matchY[curY] !== 0);

			while (curY !== 0) {
				let prevY = pre[curY];
				matchY[curY] = matchY[prevY];
				curY = prevY;
			}
		}

		const machineCrewMap = new Map();
		for (let j = 1; j <= m; j++) {
			const heroIdx = matchY[j] - 1;
			if (heroIdx >= 0 && heroIdx < n) {
				const machineId = machineSlots[j - 1].machine.id;
				if (!machineCrewMap.has(machineId)) machineCrewMap.set(machineId, []);
				machineCrewMap.get(machineId).push(heroes[heroIdx]);
			}
		}
		return machineCrewMap;
	}

	/**
	 * Optimizes crew assignments globally using greedy algorithm with local optimization
	 * @param {import('./app.js').Machine[]} machines - Machines to optimize
	 * @param {string} mode - "campaign" or "arena"
	 * @returns {import('./app.js').Machine[]} Machines with optimized crew
	 */
	optimizeCrewGlobally(machines, mode = "campaign") {
		if (!this.heroes?.length || !machines?.length) return machines;

		// 1. Filter to top heroes to keep KM performance snappy (N^3 complexity)
		const requiredSlots = machines.length * this.maxSlots;
		const sortedHeroes = [...this.heroes]
			.sort((a, b) => {
				const sumA = new Decimal(a.percentages.damage).add(a.percentages.health);
				const sumB = new Decimal(b.percentages.damage).add(b.percentages.health);
				return sumB.cmp(sumA);
			})
			.slice(0, requiredSlots + 20);

		const machineSlots = [];
		for (const machine of machines) {
			for (let s = 0; s < this.maxSlots; s++) {
				machineSlots.push({ machine, slotIndex: s });
			}
		}

		// 2. Precompute the correct stat block for the mode
		const modeContextStats = new Map();
		for (const machine of machines) {
			const stats = this.calculateAllStats(machine, []);
			// Assign the correct stat object based on mode
			const relevantStats = mode === "arena" ? stats.arenaStats : stats.battleStats;
			modeContextStats.set(machine.id, relevantStats);
		}

		// 3. Run the KM Algorithm
		const machineCrewMap = this.kmAssignment(sortedHeroes, machineSlots, modeContextStats, mode);

		// 4. Map results back to the machine objects
		return machines.map((machine) => {
			const crew = machineCrewMap.get(machine.id) ?? [];
			const stats = this.calculateAllStats(machine, crew);
			return {
				...machine,
				crew,
				battleStats: stats.battleStats,
				arenaStats: stats.arenaStats,
			};
		});
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

		//in cases with low stat values, level was a better way to pick
		machinesWithPower.sort((a, b) => b.machine.level - a.machine.level);

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

		// Sort tanks: Goliath first, then by health (descending - strongest tanks first)
		const tanks = (categorized.tank ?? []).toSorted((a, b) => {
			// Goliath always goes first
			if (a.name === "Goliath" && b.name !== "Goliath") return -1;
			if (b.name === "Goliath" && a.name !== "Goliath") return 1;

			// Otherwise sort by health (descending - strongest first)
			return b.battleStats.health.cmp(a.battleStats.health);
		});

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
