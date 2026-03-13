// utils/upgradeAnalyzer.js
import { Calculator } from "../calculator.js";
import { BattleEngine } from "../battleengine.js";
import { AppConfig } from "../config.js";
import Decimal from "../vendor/break_eternity.esm.js";

/**
 * @typedef {Object} SingleUpgrade
 * @property {number} machineId
 * @property {string} machineName
 * @property {string} upgradeType - "level" | "damage" | "health" | "armor"
 * @property {number} currentValue
 * @property {number} requiredValue
 */

/**
 * @typedef {Object} UpgradePath
 * @property {SingleUpgrade[]} upgrades
 * @property {Decimal}         totalPowerGain
 * @property {number}          totalUpgradeAmount - Weighted cost (levels count 2×)
 */

/**
 * @typedef {Object} UpgradeAnalysis
 * @property {string}        nextDifficulty
 * @property {number}        nextMission
 * @property {UpgradePath[]} paths
 * @property {boolean}       canPass
 */

/**
 * Analyses a formation to find the minimum upgrades needed to earn the next campaign star.
 */
export class UpgradeAnalyzer {
	/**
	 * @param {Object} config
	 * @param {number} config.engineerLevel
	 * @param {number} config.scarabLevel
	 * @param {Array}  config.artifactArray
	 * @param {number} config.globalRarityLevels
	 * @param {string} config.riftRank
	 */
	constructor({ engineerLevel, scarabLevel, artifactArray, globalRarityLevels, riftRank }) {
		this.engineerLevel = engineerLevel;
		this.scarabLevel = scarabLevel;
		this.artifactArray = artifactArray;
		this.globalRarityLevels = globalRarityLevels;
		this.riftRank = riftRank;
		this.battleEngine = new BattleEngine();
	}

	// ─────────────────────────────────────────────
	// Public API
	// ─────────────────────────────────────────────

	/**
	 * Finds the next uncompleted star and returns upgrade paths that unlock it.
	 * Returns null when in arena mode, when the formation is empty, or when
	 * the campaign is fully completed.
	 * @param {Object[]} formation
	 * @param {Object}   lastCleared - difficulty → last cleared mission number
	 * @param {"campaign"|"arena"} [mode="campaign"]
	 * @returns {UpgradeAnalysis|null}
	 */
	analyzeUpgrades(formation, lastCleared, mode = "campaign") {
		if (mode === "arena" || !formation?.length) return null;

		const nextTarget = this.findNextTarget(lastCleared, formation);
		if (!nextTarget) return null;

		const paths = this.findUpgradePaths(formation, nextTarget.mission, nextTarget.difficulty);

		return {
			nextDifficulty: nextTarget.difficulty,
			nextMission: nextTarget.mission,
			paths,
			canPass: paths.length > 0,
		};
	}

	/**
	 * Finds the next mission with the smallest total power deficit
	 * (requirement gap + enemy power gap).
	 * @param {Object}   lastCleared
	 * @param {Object[]} formation
	 * @returns {{difficulty: string, mission: number, requiredPower: Decimal, enemyPower: Decimal, totalDeficit: Decimal}|null}
	 */
	findNextTarget(lastCleared, formation) {
		const ourPower = Calculator.computeSquadPower(formation, "campaign");
		const candidates = [];

		for (const diff of AppConfig.DIFFICULTIES) {
			const cleared = lastCleared?.[diff.key] || 0;
			if (cleared >= AppConfig.MAX_MISSIONS_PER_DIFFICULTY) continue;

			const mission = cleared + 1;
			const requiredPower = Calculator.requiredPowerForMission(mission, diff.key);
			const enemyPower = Calculator.computeSquadPower(Calculator.getEnemyTeamForMission(mission, diff.key), "campaign");

			const requirementDeficit = requiredPower.gt(ourPower) ? requiredPower.sub(ourPower) : new Decimal(0);
			const enemyDeficit = enemyPower.gt(ourPower) ? enemyPower.sub(ourPower) : new Decimal(0);

			candidates.push({
				difficulty: diff.key,
				mission,
				requiredPower,
				enemyPower,
				totalDeficit: requirementDeficit.add(enemyDeficit),
			});
		}

		if (candidates.length === 0) return null;

		candidates.sort((a, b) => a.totalDeficit.cmp(b.totalDeficit));
		return candidates[0];
	}

	/**
	 * Returns upgrade paths (up to 4 upgrades) that allow passing the given mission.
	 * @param {Object[]} formation
	 * @param {number}   mission
	 * @param {string}   difficulty
	 * @returns {UpgradePath[]}
	 */
	findUpgradePaths(formation, mission, difficulty) {
		const topMachines = this.getTopMachines(formation, 2);
		if (topMachines.length === 0) return [];

		const paths = [];

		// Single machine strategies
		for (const machine of topMachines) {
			paths.push(...this.findSingleUpgradePaths(formation, machine, mission, difficulty));
			paths.push(...this.findCombinedUpgradePaths(formation, machine, mission, difficulty));
		}

		// Two-machine strategy — combinatorial spec generation
		if (topMachines.length >= 2) {
			paths.push(...this.findOptimalMultiMachineUpgrades(formation, topMachines.slice(0, 2), mission, difficulty));
		}

		const unique = this._deduplicatePaths(paths);
		unique.sort((a, b) => a.totalUpgradeAmount - b.totalUpgradeAmount);

		// Keep only the best path per upgrade-count bucket (1–4)
		const bestByCount = new Map();
		for (const path of unique) {
			const n = path.upgrades.length;
			if (n >= 1 && n <= 4 && !bestByCount.has(n)) bestByCount.set(n, path);
		}

		return Array.from({ length: 4 }, (_, i) => bestByCount.get(i + 1)).filter(Boolean);
	}

	// ─────────────────────────────────────────────
	// Single-machine strategies
	// ─────────────────────────────────────────────

	/**
	 * Finds the cheapest single-stat or single-level upgrade on one machine.
	 * Delegates to `findMinimumCombinedUpgrade` with a one-element type array,
	 * avoiding a separate code path.
	 * @param {Object[]} formation
	 * @param {Object}   machine
	 * @param {number}   mission
	 * @param {string}   difficulty
	 * @returns {UpgradePath[]}
	 */
	findSingleUpgradePaths(formation, machine, mission, difficulty) {
		const paths = [];
		const stats = machine.role === "tank" ? ["health", "armor"] : ["damage", "health"];

		for (const type of ["level", ...stats]) {
			const path = this.findMinimumCombinedUpgrade(formation, machine, [type], mission, difficulty);
			if (path) paths.push(path);
		}

		return paths;
	}

	/**
	 * Finds combined multi-stat upgrades on a single machine.
	 * @param {Object[]} formation
	 * @param {Object}   machine
	 * @param {number}   mission
	 * @param {string}   difficulty
	 * @returns {UpgradePath[]}
	 */
	findCombinedUpgradePaths(formation, machine, mission, difficulty) {
		const paths = [];
		const stats = machine.role === "tank" ? ["health", "armor"] : ["damage", "health"];

		// Level + one blueprint
		for (const stat of stats) {
			const path = this.findMinimumCombinedUpgrade(formation, machine, ["level", stat], mission, difficulty);
			if (path) paths.push(path);
		}

		// Both primary blueprints together
		if (stats.length >= 2) {
			const path = this.findMinimumCombinedUpgrade(formation, machine, stats, mission, difficulty);
			if (path) paths.push(path);
		}

		return paths;
	}

	// ─────────────────────────────────────────────
	// Multi-machine strategy
	// ─────────────────────────────────────────────

	/**
	 * Generates all 2- to 4-upgrade combinations across two machines and finds
	 * the minimum increment distribution that passes the mission for each.
	 *
	 * Combinations are built programmatically to avoid the original hardcoded
	 * array approach — adding more machines or upgrade types requires no changes here.
	 *
	 * @param {Object[]} formation
	 * @param {Object[]} topMachines - Exactly 2 machines
	 * @param {number}   mission
	 * @param {string}   difficulty
	 * @returns {UpgradePath[]}
	 */
	findOptimalMultiMachineUpgrades(formation, topMachines, mission, difficulty) {
		const [m1, m2] = topMachines;
		const s1 = m1.role === "tank" ? "health" : "damage";
		const s2 = m2.role === "tank" ? "health" : "damage";

		// All possible (machine, upgradeType) atoms
		const atoms = [
			{ machine: m1, type: "level" },
			{ machine: m1, type: s1 },
			{ machine: m2, type: "level" },
			{ machine: m2, type: s2 },
		];

		const paths = [];

		// Generate all unique subsets of size 2–4 from the atom list
		for (let size = 4; size >= 2; size--) {
			for (const combo of this._combinations(atoms, size)) {
				const result = this.findOptimalIncrementDistribution(formation, combo, mission, difficulty);
				if (result) paths.push(result);
			}
		}

		return paths;
	}

	// ─────────────────────────────────────────────
	// Increment distribution solver
	// ─────────────────────────────────────────────

	/**
	 * Finds the cheapest increment distribution across a set of upgrade specs
	 * that allows the formation to pass the mission.
	 * @param {Object[]} formation
	 * @param {Array<{machine: Object, type: string}>} upgradeSpecs
	 * @param {number}   mission
	 * @param {string}   difficulty
	 * @returns {UpgradePath|null}
	 */
	findOptimalIncrementDistribution(formation, upgradeSpecs, mission, difficulty) {
		const MAX_COST = 200;

		for (let targetCost = upgradeSpecs.length; targetCost <= MAX_COST; targetCost++) {
			for (const distribution of this._generateDistributions(targetCost, upgradeSpecs)) {
				const result = this._applyDistribution(formation, upgradeSpecs, distribution, mission, difficulty);
				if (result) return result;
			}
		}

		return null;
	}

	/**
	 * Applies one increment distribution to the formation, tests it, and returns
	 * an UpgradePath if it passes — null otherwise.
	 * @private
	 */
	_applyDistribution(formation, upgradeSpecs, distribution, mission, difficulty) {
		const machineUpgradeMap = new Map();
		const upgradesList = [];
		let exceedsCap = false;

		for (let i = 0; i < upgradeSpecs.length; i++) {
			const { machine, type } = upgradeSpecs[i];
			const increment = distribution[i];

			if (!machineUpgradeMap.has(machine.id)) {
				machineUpgradeMap.set(machine.id, { machine, upgrade: {}, upgrades: [] });
			}
			const entry = machineUpgradeMap.get(machine.id);

			if (type === "level") {
				const newLevel = machine.level + increment;
				entry.upgrade.level = newLevel;
				entry.upgrades.push({ machineId: machine.id, machineName: machine.name, upgradeType: "level", currentValue: machine.level, requiredValue: newLevel });
			} else {
				const current = machine.blueprints[type];
				const newValue = current + increment;
				const checkLevel = entry.upgrade.level ?? machine.level;

				if (newValue > Calculator.getMaxBlueprintLevel(checkLevel)) {
					exceedsCap = true;
					break;
				}

				if (!entry.upgrade.blueprints) entry.upgrade.blueprints = { ...machine.blueprints };
				entry.upgrade.blueprints[type] = newValue;
				entry.upgrades.push({ machineId: machine.id, machineName: machine.name, upgradeType: type, currentValue: current, requiredValue: newValue });
			}
		}

		if (exceedsCap) return null;

		const machineUpgrades = [];
		for (const { machine, upgrade, upgrades } of machineUpgradeMap.values()) {
			machineUpgrades.push({ machine, upgrade });
			upgradesList.push(...upgrades);
		}

		if (!this.canPassWithUpgrades(formation, machineUpgrades, mission, difficulty)) return null;

		let totalPowerGain = new Decimal(0);
		for (const { machine, upgrade } of machineUpgrades) {
			totalPowerGain = totalPowerGain.add(this.calculateUpgradePowerGain(machine, upgrade));
		}

		const actualCost = upgradesList.reduce((sum, u) => {
			return sum + (u.requiredValue - u.currentValue) * (u.upgradeType === "level" ? 2 : 1);
		}, 0);

		return { upgrades: upgradesList, totalPowerGain, totalUpgradeAmount: actualCost };
	}

	/**
	 * Generates all increment distributions that sum to `targetCost`,
	 * accounting for the 2× cost of level upgrades.
	 * Uses backtracking with an in-place array — the array is copied
	 * on each valid solution push so callers receive independent arrays.
	 * @param {number} targetCost
	 * @param {Array<{type: string}>} upgradeSpecs
	 * @returns {number[][]}
	 * @private
	 */
	_generateDistributions(targetCost, upgradeSpecs) {
		const distributions = [];
		const n = upgradeSpecs.length;
		const multipliers = upgradeSpecs.map((s) => (s.type === "level" ? 2 : 1));
		const current = new Array(n).fill(0);

		const recurse = (index, remaining) => {
			if (index === n) {
				if (remaining === 0) distributions.push([...current]);
				return;
			}

			const max = Math.floor(remaining / multipliers[index]);
			for (let inc = 1; inc <= max; inc++) {
				current[index] = inc;
				recurse(index + 1, remaining - inc * multipliers[index]);
			}
			current[index] = 0; // explicit backtrack for clarity
		};

		recurse(0, targetCost);
		return distributions;
	}

	// ─────────────────────────────────────────────
	// Minimum upgrade search
	// ─────────────────────────────────────────────

	/**
	 * Finds the minimum combined increment on a set of upgrade types for one machine
	 * that allows passing the mission.
	 * Single-type upgrades call this with a one-element array, eliminating the
	 * separate `findMinimumUpgrade` function.
	 * @param {Object[]}  formation
	 * @param {Object}    machine
	 * @param {string[]}  upgradeTypes
	 * @param {number}    mission
	 * @param {string}    difficulty
	 * @returns {UpgradePath|null}
	 */
	findMinimumCombinedUpgrade(formation, machine, upgradeTypes, mission, difficulty) {
		for (let increment = 1; increment <= 100; increment++) {
			const upgrades = [];
			const upgrade = {};
			let exceedsCap = false;

			for (const type of upgradeTypes) {
				if (type === "level") {
					const newLevel = machine.level + increment;
					upgrade.level = newLevel;
					upgrades.push({ machineId: machine.id, machineName: machine.name, upgradeType: "level", currentValue: machine.level, requiredValue: newLevel });
				} else {
					const current = machine.blueprints[type];
					const newValue = current + increment;
					const checkLevel = upgrade.level ?? machine.level;

					if (newValue > Calculator.getMaxBlueprintLevel(checkLevel)) {
						exceedsCap = true;
						break;
					}

					if (!upgrade.blueprints) upgrade.blueprints = { ...machine.blueprints };
					upgrade.blueprints[type] = newValue;
					upgrades.push({ machineId: machine.id, machineName: machine.name, upgradeType: type, currentValue: current, requiredValue: newValue });
				}
			}

			if (exceedsCap) continue;

			if (this.canPassWithUpgrades(formation, [{ machine, upgrade }], mission, difficulty)) {
				const actualCost = upgrades.reduce((sum, u) => {
					return sum + (u.requiredValue - u.currentValue) * (u.upgradeType === "level" ? 2 : 1);
				}, 0);

				return {
					upgrades,
					totalPowerGain: this.calculateUpgradePowerGain(machine, upgrade),
					totalUpgradeAmount: actualCost,
				};
			}
		}

		return null;
	}

	// ─────────────────────────────────────────────
	// Battle test
	// ─────────────────────────────────────────────

	/**
	 * Returns true if the formation (with upgrades applied) can pass the mission.
	 * First checks the power requirement; runs up to 50 simulations if it passes.
	 * @param {Object[]} formation
	 * @param {Array<{machine: Object, upgrade: Object}>} machineUpgrades
	 * @param {number}   mission
	 * @param {string}   difficulty
	 * @returns {boolean}
	 */
	canPassWithUpgrades(formation, machineUpgrades, mission, difficulty) {
		const upgradeMap = new Map(machineUpgrades.map(({ machine, upgrade }) => [machine.id, upgrade]));

		const upgraded = formation.map((m) => {
			const upg = upgradeMap.get(m.id);
			if (!upg) return m;

			const upgradedMachine = {
				...m,
				level: upg.level !== undefined ? upg.level : m.level,
				blueprints: upg.blueprints !== undefined ? { ...m.blueprints, ...upg.blueprints } : { ...m.blueprints },
			};

			const stats = Calculator.calculateBattleAttributes(upgradedMachine, m.crew || [], this.globalRarityLevels, this.artifactArray, this.engineerLevel);

			return {
				...upgradedMachine,
				battleStats: { damage: stats.damage, health: stats.health, maxHealth: stats.health, armor: stats.armor },
			};
		});

		if (Calculator.computeSquadPower(upgraded, "campaign").lt(Calculator.requiredPowerForMission(mission, difficulty))) {
			return false;
		}

		const enemies = Calculator.getEnemyTeamForMission(mission, difficulty);
		for (let i = 0; i < 50; i++) {
			if (this.battleEngine.runBattle(upgraded, enemies, AppConfig.MAX_BATTLE_ROUNDS, true).playerWon) return true;
		}

		return false;
	}

	// ─────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────

	/**
	 * Returns the top N machines from the formation by campaign battle power.
	 * Power is computed here — not re-used from a stale cache on each machine.
	 * @param {Object[]} formation
	 * @param {number}   count
	 * @returns {Object[]}
	 */
	getTopMachines(formation, count) {
		return formation
			.map((machine) => ({
				machine,
				power: Calculator.computeMachinePower(machine.battleStats),
			}))
			.sort((a, b) => b.power.cmp(a.power))
			.slice(0, count)
			.map(({ machine }) => machine);
	}

	/**
	 * Calculates the power gain from applying an upgrade to a machine.
	 * @param {Object} machine
	 * @param {Object} upgrade - May contain `level` and/or `blueprints`
	 * @returns {Decimal}
	 */
	calculateUpgradePowerGain(machine, upgrade) {
		const upgraded = {
			...machine,
			level: upgrade.level !== undefined ? upgrade.level : machine.level,
			blueprints: upgrade.blueprints !== undefined ? { ...machine.blueprints, ...upgrade.blueprints } : { ...machine.blueprints },
		};

		const upgradedStats = Calculator.calculateBattleAttributes(upgraded, machine.crew || [], this.globalRarityLevels, this.artifactArray, this.engineerLevel);
		return Calculator.computeMachinePower(upgradedStats).sub(Calculator.computeMachinePower(machine.battleStats));
	}

	/**
	 * Removes duplicate paths using a signature based on upgrade details.
	 * @param {UpgradePath[]} paths
	 * @returns {UpgradePath[]}
	 * @private
	 */
	_deduplicatePaths(paths) {
		const seen = new Set();
		const unique = [];

		for (const path of paths) {
			const sig = path.upgrades
				.map((u) => `${u.machineId}:${u.upgradeType}:${u.requiredValue}`)
				.sort()
				.join("|");
			if (!seen.has(sig)) {
				seen.add(sig);
				unique.push(path);
			}
		}

		return unique;
	}

	/**
	 * Generates all size-k combinations from an array.
	 * @template T
	 * @param {T[]}    arr
	 * @param {number} k
	 * @returns {T[][]}
	 * @private
	 */
	_combinations(arr, k) {
		if (k === 0) return [[]];
		if (arr.length < k) return [];

		const [first, ...rest] = arr;
		const withFirst = this._combinations(rest, k - 1).map((c) => [first, ...c]);
		const withoutFirst = this._combinations(rest, k);
		return [...withFirst, ...withoutFirst];
	}
}
