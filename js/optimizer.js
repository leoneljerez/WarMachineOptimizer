// optimizer.js
import { Calculator } from "./calculator.js";
import { BattleEngine } from "./battleengine.js";
import Decimal from "./vendor/break_eternity.esm.js";
import { AppConfig } from "./config.js";

/**
 * Name of the Goliath machine, which receives special formation positioning.
 * Defined as a constant so a future rename only requires one change.
 * @type {string}
 */
const GOLIATH_NAME = "Goliath";

/**
 * @typedef {Object} OptimizerConfig
 * @property {Object[]} ownedMachines
 * @property {Object[]} heroes
 * @property {number}   engineerLevel
 * @property {number}   scarabLevel
 * @property {Array}    artifactArray
 * @property {number}   globalRarityLevels
 * @property {string}   riftRank
 */

/**
 * @typedef {Object} CampaignResult
 * @property {number}   totalStars
 * @property {Object}   lastCleared - Map of difficulty → last cleared mission number
 * @property {Object[]} formation
 * @property {Decimal}  battlePower
 * @property {Decimal}  arenaPower
 */

/**
 * @typedef {Object} ArenaResult
 * @property {Object[]} formation
 * @property {Decimal}  arenaPower
 * @property {Decimal}  battlePower
 */

/**
 * Finds optimal machine formations and crew assignments.
 */
export class Optimizer {
	/**
	 * @param {OptimizerConfig} config
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

	// ─────────────────────────────────────────────
	// Scoring
	// ─────────────────────────────────────────────

	/**
	 * Scores a hero for a machine slot based on role weights and machine power.
	 * @param {Object} hero
	 * @param {Object} machine
	 * @param {Object} machineStats - Pre-computed stats for this machine in the current mode
	 * @param {"campaign"|"arena"} mode
	 * @returns {Decimal}
	 */
	scoreHeroForMachine(hero, machine, machineStats, mode) {
		const role = machine.role === "tank" ? "TANK" : "DPS";
		const modeKey = mode === "campaign" ? "CAMPAIGN" : "ARENA";
		const weights = AppConfig.HERO_SCORING[modeKey][role];

		const dmgScore = new Decimal(hero.percentages.damage).div(100).mul(weights.damage);
		const hpScore = new Decimal(hero.percentages.health).div(100).mul(weights.health);
		const armScore = new Decimal(hero.percentages.armor).div(100).mul(weights.armor);
		const base = dmgScore.add(hpScore).add(armScore);

		if (base.lte(0)) return new Decimal(0);

		const power = Calculator.computeMachinePower(machineStats);
		const logPower = power.gt(0) ? power.log10().add(1) : new Decimal(1);

		return mode === "campaign" ? base.mul(logPower).pow(2) : base.mul(logPower);
	}

	// ─────────────────────────────────────────────
	// Stat calculation
	// ─────────────────────────────────────────────

	/**
	 * Calculates both battle and arena stats for a machine with a given crew.
	 * @param {Object}   machine
	 * @param {Object[]} crew
	 * @returns {{battleStats: Object, arenaStats: Object}}
	 */
	calculateAllStats(machine, crew) {
		const raw = Calculator.calculateBattleAttributes(machine, crew, this.globalRarityLevels, this.artifactArray, this.engineerLevel);

		const battleStats = {
			damage: raw.damage,
			health: raw.health,
			maxHealth: raw.health,
			armor: raw.armor,
		};

		const arena = Calculator.calculateArenaAttributes({ ...machine, battleStats, baseStats: machine.baseStats }, this.globalRarityLevels, this.scarabLevel, this.riftRank);

		return {
			battleStats,
			arenaStats: {
				damage: arena.damage,
				health: arena.health,
				maxHealth: arena.health,
				armor: arena.armor,
			},
		};
	}

	// ─────────────────────────────────────────────
	// Crew assignment — Kuhn-Munkres (Hungarian) algorithm
	// ─────────────────────────────────────────────

	/**
	 * Solves Maximum Weight Perfect Matching to assign heroes to machine slots globally.
	 *
	 * Variable naming follows standard Hungarian algorithm pseudocode:
	 *   lx[i]    — label (potential) for left node i (hero)
	 *   ly[j]    — label (potential) for right node j (slot)
	 *   matchY[j]— which left node is matched to right node j (0 = unmatched)
	 *   slack[j] — minimum label slack for unvisited right node j
	 *   pre[j]   — previous right node in augmenting path to j
	 *   visY[j]  — whether right node j has been visited in this augmentation
	 *
	 * @param {Object[]} heroes
	 * @param {Array<{machine: Object, slotIndex: number}>} machineSlots
	 * @param {Map<string, Object>} modeStats - machineId → pre-computed stats for the current mode
	 * @param {"campaign"|"arena"} mode
	 * @returns {Map<string, Object[]>} machineId → assigned heroes
	 */
	kmAssignment(heroes, machineSlots, modeStats, mode) {
		const n = heroes.length;
		const m = machineSlots.length;
		const size = Math.max(n, m);

		const weight = Array.from({ length: size + 1 }, () => Array(size + 1).fill(new Decimal(0)));
		const lx = Array(size + 1).fill(new Decimal(0)); // hero labels
		const ly = Array(size + 1).fill(new Decimal(0)); // slot labels
		const matchY = Array(size + 1).fill(0); // slot → hero index
		const slack = Array(size + 1).fill(new Decimal(0)); // min slack for each slot
		const pre = Array(size + 1).fill(0); // augmenting path predecessor
		const visY = Array(size + 1).fill(false); // visited flags

		// Build weight matrix and initialise hero labels with row maxima
		for (let i = 1; i <= n; i++) {
			for (let j = 1; j <= m; j++) {
				const { machine } = machineSlots[j - 1];
				const score = this.scoreHeroForMachine(heroes[i - 1], machine, modeStats.get(machine.id), mode);
				weight[i][j] = score;
				if (score.gt(lx[i])) lx[i] = score;
			}
		}

		const EPSILON = new Decimal(1e-12);
		const INF = new Decimal("1e308");

		for (let i = 1; i <= size; i++) {
			slack.fill(INF);
			visY.fill(false);
			pre.fill(0);

			let curY = 0;
			matchY[0] = i;

			do {
				visY[curY] = true;
				const curX = matchY[curY];
				let delta = INF;
				let nextY = 0;

				for (let y = 1; y <= size; y++) {
					if (visY[y]) continue;
					const curDiff = lx[curX].add(ly[y]).sub(weight[curX][y]);
					if (curDiff.lt(slack[y])) {
						slack[y] = curDiff;
						pre[y] = curY;
					}
					if (slack[y].lt(delta)) {
						delta = slack[y];
						nextY = y;
					}
				}

				if (delta.lt(EPSILON)) delta = new Decimal(0);

				if (delta.gt(0)) {
					for (let j = 0; j <= size; j++) {
						if (visY[j]) {
							lx[matchY[j]] = lx[matchY[j]].sub(delta);
							ly[j] = ly[j].add(delta);
						} else {
							slack[j] = slack[j].sub(delta);
						}
					}
				}

				curY = nextY;
			} while (matchY[curY] !== 0);

			// Trace back augmenting path
			while (curY !== 0) {
				const prevY = pre[curY];
				matchY[curY] = matchY[prevY];
				curY = prevY;
			}
		}

		// Build result map
		const result = new Map();
		for (let j = 1; j <= m; j++) {
			const heroIdx = matchY[j] - 1;
			if (heroIdx < 0 || heroIdx >= n) continue;
			const { machine } = machineSlots[j - 1];
			if (!result.has(machine.id)) result.set(machine.id, []);
			result.get(machine.id).push(heroes[heroIdx]);
		}
		return result;
	}

	// ─────────────────────────────────────────────
	// Crew optimisation
	// ─────────────────────────────────────────────

	/**
	 * Assigns the globally optimal crew to each machine in the formation.
	 * @param {Object[]} machines
	 * @param {"campaign"|"arena"} [mode="campaign"]
	 * @returns {Object[]} Machines with crew and stats populated
	 */
	optimizeCrewGlobally(machines, mode = "campaign") {
		if (!this.heroes?.length || !machines?.length) return machines;

		const requiredSlots = machines.length * this.maxSlots;

		// Pre-select heroes with highest combined damage+health potential
		const sortedHeroes = [...this.heroes]
			.sort((a, b) => {
				const sumA = new Decimal(a.percentages.damage).add(a.percentages.health);
				const sumB = new Decimal(b.percentages.damage).add(b.percentages.health);
				return sumB.cmp(sumA);
			})
			.slice(0, requiredSlots + 20);

		// Expand each machine into one slot-entry per crew slot
		const machineSlots = machines.flatMap((machine) => Array.from({ length: this.maxSlots }, (_, s) => ({ machine, slotIndex: s })));

		// Compute baseline stats (no crew) for each machine to seed scoring
		const modeStats = new Map();
		for (const machine of machines) {
			const stats = this.calculateAllStats(machine, []);
			modeStats.set(machine.id, mode === "arena" ? stats.arenaStats : stats.battleStats);
		}

		const crewMap = this.kmAssignment(sortedHeroes, machineSlots, modeStats, mode);

		return machines.map((machine) => {
			const crew = crewMap.get(machine.id) ?? [];
			const stats = this.calculateAllStats(machine, crew);
			return { ...machine, crew, battleStats: stats.battleStats, arenaStats: stats.arenaStats };
		});
	}

	// ─────────────────────────────────────────────
	// Formation selection
	// ─────────────────────────────────────────────

	/**
	 * Returns the five highest-power machines from the owned collection.
	 * Power is computed using the requested mode's stats.
	 * @param {Object[]} ownedMachines
	 * @param {"campaign"|"arena"} [mode="campaign"]
	 * @returns {Object[]}
	 */
	selectBestFive(ownedMachines, mode = "campaign") {
		if (ownedMachines.length === 0) return [];

		const useArena = mode === "arena";

		return ownedMachines
			.map((machine) => {
				const stats = this.calculateAllStats(machine, []);
				const power = Calculator.computeMachinePower(useArena ? stats.arenaStats : stats.battleStats);
				return { machine, stats, power };
			})
			.sort((a, b) => b.power.cmp(a.power))
			.slice(0, 5)
			.map(({ machine, stats }) => ({
				...machine,
				crew: [],
				battleStats: stats.battleStats,
				arenaStats: stats.arenaStats,
			}));
	}

	/**
	 * Arranges a team into the optimal battle formation based on role and enemy stats.
	 * Goliath always occupies the central tank position when present.
	 * @param {Object[]}    team
	 * @param {number}      [mission=1]
	 * @param {string}      [difficulty="easy"]
	 * @param {Object|null} [enemyStats=null] - Pre-computed enemy stats (avoids redundant lookup)
	 * @returns {Object[]}
	 */
	arrangeByRole(team, mission = 1, difficulty = "easy", enemyStats = null) {
		if (!team?.length) return [];

		const stats = enemyStats || Calculator.enemyAttributes(mission, difficulty);

		// Categorise each machine as tank, remaining (DPS that can deal damage), or useless
		const categorized = team.reduce((acc, machine) => {
			let category;

			if (machine.role === "tank") {
				const potentialDamage = Calculator.computeDamageTaken(stats.damage, machine.battleStats.armor);
				category = potentialDamage.gt(machine.battleStats.health.mul(0.4)) ? "useless" : "tank";
			} else {
				const dmgDealt = Calculator.computeDamageTaken(machine.battleStats.damage, stats.armor);
				category = dmgDealt.eq(0) ? "useless" : "remaining";
			}

			(acc[category] ??= []).push(machine);
			return acc;
		}, {});

		const useless = (categorized.useless ?? []).toSorted((a, b) => b.battleStats.health.cmp(a.battleStats.health));

		// Split tanks: Goliath is placed centrally; others sorted by can-deal-damage, then HP
		const tankList = categorized.tank ?? [];
		let goliath = null;
		const tanksCanHit = [];
		const tanksMiss = [];

		for (const tank of tankList) {
			if (tank.name === GOLIATH_NAME) {
				goliath = tank;
				continue;
			}
			const dmgDealt = Calculator.computeDamageTaken(tank.battleStats.damage, stats.armor);
			(dmgDealt.gt(0) ? tanksCanHit : tanksMiss).push(tank);
		}

		const byHealth = (a, b) => b.battleStats.health.cmp(a.battleStats.health);
		tanksCanHit.sort(byHealth);
		tanksMiss.sort(byHealth);

		const tanks = [...tanksMiss];
		if (goliath) tanks.push(goliath);
		tanks.push(...tanksCanHit);

		// Strongest DPS goes into the protected back position when team is full
		let remaining = (categorized.remaining ?? []).toSorted((a, b) => a.battleStats.damage.cmp(b.battleStats.damage));
		let strongestDPS = null;
		if (remaining.length > 0 && team.length === AppConfig.FORMATION_SIZE) {
			strongestDPS = remaining.pop();
		}

		const formation = [...useless, ...tanks, ...remaining];
		if (strongestDPS) {
			formation.splice(formation.length - 1, 0, strongestDPS);
		}

		return formation;
	}

	// ─────────────────────────────────────────────
	// Monte Carlo simulation
	// ─────────────────────────────────────────────

	/**
	 * Runs up to `maxSimulations` battles; returns true on the first win.
	 * @param {Object[]}    team
	 * @param {number}      mission
	 * @param {string}      difficulty
	 * @param {number}      [maxSimulations=AppConfig.MONTE_CARLO_SIMULATIONS]
	 * @param {Object[]|null} [enemyFormation=null]
	 * @returns {boolean}
	 */
	runMonteCarloSimulation(team, mission, difficulty, maxSimulations = AppConfig.MONTE_CARLO_SIMULATIONS, enemyFormation = null) {
		const enemies = enemyFormation || Calculator.getEnemyTeamForMission(mission, difficulty);

		for (let i = 0; i < maxSimulations; i++) {
			if (this.battleEngine.runBattle(team, enemies, AppConfig.MAX_BATTLE_ROUNDS, true).playerWon) {
				return true;
			}
		}
		return false;
	}

	// ─────────────────────────────────────────────
	// Campaign optimisation
	// ─────────────────────────────────────────────

	/**
	 * Extends the deterministic campaign result with Monte Carlo star pushes.
	 * Stops attempting a difficulty as soon as a power check fails.
	 * @param {Object[]} formation
	 * @param {Object}   lastMissionByDifficulty
	 * @param {string[]} [difficulties=AppConfig.DIFFICULTY_KEYS]
	 * @returns {{additionalStars: number, lastMissionByDifficulty: Object}}
	 */
	pushStarsWithMonteCarlo(formation, lastMissionByDifficulty, difficulties = AppConfig.DIFFICULTY_KEYS) {
		if (formation.length === 0) return { additionalStars: 0, lastMissionByDifficulty };

		let additionalStars = 0;
		const updatedLastMissions = { ...lastMissionByDifficulty };
		const ourPower = Calculator.computeSquadPower(formation, "campaign");

		for (const difficulty of difficulties) {
			const lastMission = updatedLastMissions[difficulty] || 0;

			for (let mission = lastMission + 1; mission <= AppConfig.MAX_MISSIONS_PER_DIFFICULTY; mission++) {
				if (ourPower.lt(Calculator.requiredPowerForMission(mission, difficulty))) break;

				const enemyFormation = Calculator.getEnemyTeamForMission(mission, difficulty);
				const enemyStats = enemyFormation[0].baseStats;
				const arranged = this.arrangeByRole(formation, mission, difficulty, enemyStats);

				if (this.runMonteCarloSimulation(arranged, mission, difficulty, AppConfig.MONTE_CARLO_SIMULATIONS, enemyFormation)) {
					additionalStars++;
					updatedLastMissions[difficulty] = mission;
				}
			}
		}

		return { additionalStars, lastMissionByDifficulty: updatedLastMissions };
	}

	/**
	 * Finds the formation that earns the most campaign stars.
	 * Reoptimizes crew every REOPTIMIZE_INTERVAL missions.
	 * @param {Object} config
	 * @param {Object[]} config.ownedMachines
	 * @param {number}   [config.maxMission=AppConfig.MAX_MISSIONS_PER_DIFFICULTY]
	 * @param {string[]} [config.difficulties=AppConfig.DIFFICULTY_KEYS]
	 * @returns {CampaignResult}
	 */
	optimizeCampaignMaxStars({ ownedMachines, maxMission = AppConfig.MAX_MISSIONS_PER_DIFFICULTY, difficulties = AppConfig.DIFFICULTY_KEYS }) {
		const empty = { totalStars: 0, lastCleared: 0, formation: [], battlePower: new Decimal(0), arenaPower: new Decimal(0) };

		if (!ownedMachines?.length) return empty;

		let totalStars = 0;
		let lastWinningTeam = [];
		let currentBestTeam = null;
		let lastOptimizedMission = 0;

		const lastMissionByDifficulty = Object.fromEntries(difficulties.map((d) => [d, null]));

		for (let mission = 1; mission <= maxMission; mission++) {
			const shouldReoptimize = !currentBestTeam || mission - lastOptimizedMission >= AppConfig.REOPTIMIZE_INTERVAL;

			if (shouldReoptimize) {
				const top = this.selectBestFive(ownedMachines, "campaign");
				currentBestTeam = this.optimizeCrewGlobally(top, "campaign");
				if (currentBestTeam.length === 0) break;
				lastOptimizedMission = mission;
			}

			let missionHasClears = false;

			for (const difficulty of difficulties) {
				const enemyFormation = Calculator.getEnemyTeamForMission(mission, difficulty);
				const enemyStats = enemyFormation[0].baseStats;
				const arranged = this.arrangeByRole(currentBestTeam, mission, difficulty, enemyStats);

				if (Calculator.computeSquadPower(arranged, "campaign").lt(Calculator.requiredPowerForMission(mission, difficulty))) {
					break;
				}

				if (this.battleEngine.runBattle(arranged, enemyFormation, AppConfig.MAX_BATTLE_ROUNDS, true).playerWon) {
					totalStars++;
					missionHasClears = true;
					lastMissionByDifficulty[difficulty] = mission;
					lastWinningTeam = arranged.map((m) => ({ ...m, crew: [...m.crew] }));
				} else {
					break;
				}
			}

			if (!missionHasClears && mission > 1) break;
		}

		const mc = this.pushStarsWithMonteCarlo(lastWinningTeam, lastMissionByDifficulty, difficulties);
		totalStars += mc.additionalStars;

		return {
			totalStars,
			lastCleared: mc.lastMissionByDifficulty,
			formation: lastWinningTeam,
			battlePower: Calculator.computeSquadPower(lastWinningTeam, "campaign"),
			arenaPower: Calculator.computeSquadPower(lastWinningTeam, "arena"),
		};
	}

	/**
	 * Finds the formation that maximises arena power.
	 * @param {Object[]} ownedMachines
	 * @returns {ArenaResult}
	 */
	optimizeForArena(ownedMachines) {
		if (!ownedMachines?.length) {
			return { formation: [], arenaPower: new Decimal(0), battlePower: new Decimal(0) };
		}

		const topFive = this.selectBestFive(ownedMachines, "arena");
		const optimized = this.arrangeByRole(this.optimizeCrewGlobally(topFive, "arena"), 1, "easy");

		return {
			formation: optimized,
			arenaPower: Calculator.computeSquadPower(optimized, "arena"),
			battlePower: Calculator.computeSquadPower(optimized, "campaign"),
		};
	}
}
