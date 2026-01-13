// js/utils/upgradeAnalyzer.js
import { Calculator } from "../calculator.js";
import { BattleEngine } from "../battleengine.js";
import { AppConfig } from "../config.js";
import Decimal from "../vendor/break_eternity.esm.js";

/**
 * @typedef {Object} SingleUpgrade
 * @property {number} machineId - Machine ID to upgrade
 * @property {string} machineName - Machine name
 * @property {string} upgradeType - "level" | "damage" | "health" | "armor"
 * @property {number} currentValue - Current value
 * @property {number} requiredValue - Value needed
 */

/**
 * @typedef {Object} UpgradePath
 * @property {SingleUpgrade[]} upgrades - List of upgrades in this path
 * @property {Decimal} totalPowerGain - Total power gained from all upgrades
 * @property {number} totalUpgradeAmount - Sum of all upgrade amounts (for sorting)
 */

/**
 * @typedef {Object} UpgradeAnalysis
 * @property {string} nextDifficulty - Next difficulty to attempt
 * @property {number} nextMission - Next mission number
 * @property {UpgradePath[]} paths - Different upgrade paths that allow passing
 * @property {boolean} canPass - Whether any upgrade path allows passing
 */

export class UpgradeAnalyzer {
	/**
	 * Creates an UpgradeAnalyzer instance
	 * @param {Object} config
	 * @param {number} config.engineerLevel - Engineer level
	 * @param {number} config.scarabLevel - Scarab level
	 * @param {Array} config.artifactArray - Artifact configurations
	 * @param {number} config.globalRarityLevels - Sum of all machine rarity levels
	 * @param {string} config.riftRank - Chaos Rift rank
	 */
	constructor({ engineerLevel, scarabLevel, artifactArray, globalRarityLevels, riftRank }) {
		this.engineerLevel = engineerLevel;
		this.scarabLevel = scarabLevel;
		this.artifactArray = artifactArray;
		this.globalRarityLevels = globalRarityLevels;
		this.riftRank = riftRank;
		this.battleEngine = new BattleEngine();
	}

	/**
	 * Calculates the maximum blueprint level allowed for a machine at its current level
	 * Formula: 5 + floor(level / 5) * 5
	 * @param {number} machineLevel - Current machine level
	 * @returns {number} Maximum allowed blueprint level
	 */
	static getMaxBlueprintLevel(machineLevel) {
		return 5 + Math.floor(machineLevel / 5) * 5;
	}

	/**
	 * Finds the next star to earn and determines upgrade paths needed
	 * @param {Array} formation - Current optimized formation
	 * @param {Object} lastCleared - Last cleared missions by difficulty
	 * @param {string} mode - "campaign" or "arena"
	 * @returns {UpgradeAnalysis | null}
	 */
	analyzeUpgrades(formation, lastCleared, mode = "campaign") {
		if (mode === "arena") {
			return null;
		}

		if (!formation || formation.length === 0) {
			return null;
		}

		// Find next uncompleted star (weakest enemy)
		const nextTarget = this.findNextTarget(lastCleared, formation);
		if (!nextTarget) {
			return null; // Campaign complete!
		}

		// Find all upgrade paths that allow passing
		const paths = this.findUpgradePaths(formation, nextTarget.mission, nextTarget.difficulty);

		return {
			nextDifficulty: nextTarget.difficulty,
			nextMission: nextTarget.mission,
			paths,
			canPass: paths.length > 0,
		};
	}

	/**
	 * Finds the next uncompleted mission/difficulty by considering both power requirement and enemy power
	 * Calculates the total power deficit (requirement gap + enemy gap) and picks the lowest
	 * @param {Object} lastCleared - Last cleared missions by difficulty
	 * @param {Array} formation - Current formation to calculate our power
	 * @returns {{difficulty: string, mission: number, requiredPower: Decimal, enemyPower: Decimal, totalDeficit: Decimal} | null}
	 */
	findNextTarget(lastCleared, formation) {
		const candidates = [];

		// Calculate our current power once
		const ourPower = Calculator.computeSquadPower(formation, "campaign");

		// Collect all next missions across difficulties
		for (let i = 0; i < AppConfig.DIFFICULTIES.length; i++) {
			const diff = AppConfig.DIFFICULTIES[i];
			const cleared = lastCleared?.[diff.key] || 0;

			if (cleared < AppConfig.MAX_MISSIONS_PER_DIFFICULTY) {
				const nextMission = cleared + 1;

				// Get required power to start the mission
				const requiredPower = Calculator.requiredPowerForMission(nextMission, diff.key);

				// Get enemy team power
				const enemyFormation = Calculator.getEnemyTeamForMission(nextMission, diff.key);
				const enemyPower = Calculator.computeSquadPower(enemyFormation, "campaign");

				// Calculate deficits (how much we're lacking)
				// If we exceed the requirement/enemy, the deficit is 0
				const requirementDeficit = requiredPower.gt(ourPower) ? requiredPower.sub(ourPower) : new Decimal(0);

				const enemyDeficit = enemyPower.gt(ourPower) ? enemyPower.sub(ourPower) : new Decimal(0);

				// Total deficit is the sum of both gaps
				const totalDeficit = requirementDeficit.add(enemyDeficit);

				candidates.push({
					difficulty: diff.key,
					mission: nextMission,
					requiredPower,
					enemyPower,
					totalDeficit,
				});
			}
		}

		if (candidates.length === 0) {
			return null; // Campaign complete
		}

		// Sort by total deficit (lowest first) - this is the easiest to reach
		candidates.sort((a, b) => a.totalDeficit.cmp(b.totalDeficit));

		return candidates[0];
	}

	/**
	 * Finds multiple upgrade paths that allow passing the mission
	 * @param {Array} formation - Current formation
	 * @param {number} mission - Mission number
	 * @param {string} difficulty - Difficulty level
	 * @returns {UpgradePath[]}
	 */
	findUpgradePaths(formation, mission, difficulty) {
		const paths = [];
		const topMachines = this.getTopMachines(formation, 2);

		if (topMachines.length === 0) {
			return paths;
		}

		// Strategy 1: Single machine, single stat upgrades
		for (const machine of topMachines) {
			const singlePaths = this.findSingleUpgradePaths(formation, machine, mission, difficulty);
			paths.push(...singlePaths);
		}

		// Strategy 2: Single machine, combined stats
		for (const machine of topMachines) {
			const combinedPaths = this.findCombinedUpgradePaths(formation, machine, mission, difficulty);
			paths.push(...combinedPaths);
		}

		// Strategy 3: Two machines upgraded simultaneously (optimized distribution)
		if (topMachines.length >= 2) {
			const multiPaths = this.findOptimalMultiMachineUpgrades(formation, topMachines.slice(0, 2), mission, difficulty);
			paths.push(...multiPaths);
		}

		// Remove duplicates and sort by total upgrade cost (with levels counting as 2x)
		const uniquePaths = this.deduplicatePaths(paths);
		uniquePaths.sort((a, b) => a.totalUpgradeAmount - b.totalUpgradeAmount);

		// Get best path of each type (1, 2, 3, 4 upgrades)
		const bestByType = new Map();

		for (const path of uniquePaths) {
			const upgradeCount = path.upgrades.length;

			// Only consider 1-4 upgrade paths
			if (upgradeCount >= 1 && upgradeCount <= 4) {
				if (!bestByType.has(upgradeCount)) {
					bestByType.set(upgradeCount, path);
				}
			}
		}

		// Return in order: single, 2, 3, 4 upgrades
		const topPaths = [];
		for (let i = 1; i <= 4; i++) {
			if (bestByType.has(i)) {
				topPaths.push(bestByType.get(i));
			}
		}

		return topPaths;
	}

	/**
	 * Removes duplicate upgrade paths
	 * @param {UpgradePath[]} paths - Paths to deduplicate
	 * @returns {UpgradePath[]} Unique paths
	 */
	deduplicatePaths(paths) {
		const seen = new Set();
		const unique = [];

		for (const path of paths) {
			// Create signature: sort upgrades by machineId+type, create string
			const signature = path.upgrades
				.map((u) => `${u.machineId}:${u.upgradeType}:${u.requiredValue}`)
				.sort()
				.join("|");

			if (!seen.has(signature)) {
				seen.add(signature);
				unique.push(path);
			}
		}

		return unique;
	}

	/**
	 * Finds single upgrade paths (one stat on one machine)
	 * @param {Array} formation - Current formation
	 * @param {Object} machine - Machine to upgrade
	 * @param {number} mission - Mission number
	 * @param {string} difficulty - Difficulty level
	 * @returns {UpgradePath[]}
	 */
	findSingleUpgradePaths(formation, machine, mission, difficulty) {
		const paths = [];
		const isTank = machine.role === "tank";
		const upgradeStats = isTank ? ["health", "armor"] : ["damage", "health"];

		// Test level upgrade
		const levelUpgrade = this.findMinimumUpgrade(formation, machine, "level", machine.level, mission, difficulty);

		if (levelUpgrade) {
			const powerGain = this.calculateUpgradePowerGain(machine, { level: levelUpgrade.requiredValue });
			const levelIncrements = levelUpgrade.requiredValue - levelUpgrade.currentValue;
			const actualCost = levelIncrements * 2; // Levels cost 2x

			paths.push({
				upgrades: [levelUpgrade],
				totalPowerGain: powerGain,
				totalUpgradeAmount: actualCost,
			});
		}

		// Test blueprint upgrades
		for (const stat of upgradeStats) {
			const blueprintUpgrade = this.findMinimumUpgrade(formation, machine, stat, machine.blueprints[stat], mission, difficulty);

			if (blueprintUpgrade) {
				const upgrade = {
					blueprints: {
						...machine.blueprints,
						[stat]: blueprintUpgrade.requiredValue,
					},
				};
				const powerGain = this.calculateUpgradePowerGain(machine, upgrade);
				const blueprintIncrements = blueprintUpgrade.requiredValue - blueprintUpgrade.currentValue;

				paths.push({
					upgrades: [blueprintUpgrade],
					totalPowerGain: powerGain,
					totalUpgradeAmount: blueprintIncrements, // Blueprints cost 1x
				});
			}
		}

		return paths;
	}

	/**
	 * Finds combined upgrade paths (multiple stats on one machine)
	 * @param {Array} formation - Current formation
	 * @param {Object} machine - Machine to upgrade
	 * @param {number} mission - Mission number
	 * @param {string} difficulty - Difficulty level
	 * @returns {UpgradePath[]}
	 */
	findCombinedUpgradePaths(formation, machine, mission, difficulty) {
		const paths = [];
		const isTank = machine.role === "tank";
		const upgradeStats = isTank ? ["health", "armor"] : ["damage", "health"];

		// Try: Level + one blueprint
		for (const stat of upgradeStats) {
			const combined = this.findMinimumCombinedUpgrade(formation, machine, ["level", stat], mission, difficulty);

			if (combined) {
				paths.push(combined);
			}
		}

		// Try: Two blueprints together
		if (upgradeStats.length >= 2) {
			const combined = this.findMinimumCombinedUpgrade(formation, machine, upgradeStats, mission, difficulty);

			if (combined) {
				paths.push(combined);
			}
		}

		return paths;
	}

	/**
	 * Finds optimal multi-machine upgrade paths by testing different increment distributions
	 * Tests 4-upgrade combinations FIRST since they're usually most efficient
	 * @param {Array} formation - Current formation
	 * @param {Array} topMachines - Top 2 machines to upgrade
	 * @param {number} mission - Mission number
	 * @param {string} difficulty - Difficulty level
	 * @returns {UpgradePath[]}
	 */
	findOptimalMultiMachineUpgrades(formation, topMachines, mission, difficulty) {
		const paths = [];
		const machine1 = topMachines[0];
		const machine2 = topMachines[1];

		const isTank1 = machine1.role === "tank";
		const isTank2 = machine2.role === "tank";
		const stat1 = isTank1 ? "health" : "damage";
		const stat2 = isTank2 ? "health" : "damage";

		// TEST 4-UPGRADE COMBINATION FIRST (usually most efficient)
		const fourCombo = [
			{ machine: machine1, type: "level" },
			{ machine: machine1, type: stat1 },
			{ machine: machine2, type: "level" },
			{ machine: machine2, type: stat2 },
		];

		const fourResult = this.findOptimalIncrementDistribution(formation, fourCombo, mission, difficulty);

		if (fourResult) {
			paths.push(fourResult);
		}

		// Test 3-upgrade combinations
		const threeCombos = [
			// Machine 1: level + blueprint, Machine 2: level
			[
				{ machine: machine1, type: "level" },
				{ machine: machine1, type: stat1 },
				{ machine: machine2, type: "level" },
			],
			// Machine 1: level + blueprint, Machine 2: blueprint
			[
				{ machine: machine1, type: "level" },
				{ machine: machine1, type: stat1 },
				{ machine: machine2, type: stat2 },
			],
			// Machine 1: level, Machine 2: level + blueprint
			[
				{ machine: machine1, type: "level" },
				{ machine: machine2, type: "level" },
				{ machine: machine2, type: stat2 },
			],
			// Machine 1: blueprint, Machine 2: level + blueprint
			[
				{ machine: machine1, type: stat1 },
				{ machine: machine2, type: "level" },
				{ machine: machine2, type: stat2 },
			],
		];

		for (const combo of threeCombos) {
			const result = this.findOptimalIncrementDistribution(formation, combo, mission, difficulty);

			if (result) {
				paths.push(result);
			}
		}

		// Test 2-upgrade combinations (less efficient but still useful)
		const twoCombos = [
			// Both levels
			[
				{ machine: machine1, type: "level" },
				{ machine: machine2, type: "level" },
			],
			// Level + Blueprint
			[
				{ machine: machine1, type: "level" },
				{ machine: machine2, type: stat2 },
			],
			[
				{ machine: machine1, type: stat1 },
				{ machine: machine2, type: "level" },
			],
			// Both blueprints
			[
				{ machine: machine1, type: stat1 },
				{ machine: machine2, type: stat2 },
			],
		];

		for (const combo of twoCombos) {
			const result = this.findOptimalIncrementDistribution(formation, combo, mission, difficulty);

			if (result) {
				paths.push(result);
			}
		}

		return paths;
	}

	/**
	 * Finds the optimal distribution of increments across multiple upgrades
	 * Tests different distributions to minimize total COST (not increments)
	 */
	findOptimalIncrementDistribution(formation, upgradeSpecs, mission, difficulty) {
		const maxCost = 200; // Max total COST to test (not increments)
		const numUpgrades = upgradeSpecs.length;

		// Test different total costs (starting from minimum possible)
		// Minimum cost is numUpgrades (if all are blueprints with 1 increment each)
		for (let targetCost = numUpgrades; targetCost <= maxCost; targetCost++) {
			// Generate all possible distributions that achieve this cost
			const distributions = this.generateDistributionsForCost(targetCost, upgradeSpecs);

			for (const distribution of distributions) {
				const machineUpgrades = [];
				const upgradesList = [];
				let exceedsCap = false;

				// Track upgrades per machine to merge them
				const machineUpgradeMap = new Map();

				for (let i = 0; i < upgradeSpecs.length; i++) {
					const spec = upgradeSpecs[i];
					const increment = distribution[i];
					const { machine, type } = spec;

					// Get or create upgrade object for this machine
					let upgradeObj = machineUpgradeMap.get(machine.id);
					if (!upgradeObj) {
						upgradeObj = {
							machine,
							upgrade: {},
							upgrades: [],
						};
						machineUpgradeMap.set(machine.id, upgradeObj);
					}

					if (type === "level") {
						const currentLevel = machine.level;
						const newLevel = currentLevel + increment;

						upgradeObj.upgrade.level = newLevel;
						upgradeObj.upgrades.push({
							machineId: machine.id,
							machineName: machine.name,
							upgradeType: "level",
							currentValue: currentLevel,
							requiredValue: newLevel,
						});
					} else {
						const currentValue = machine.blueprints[type];
						const newValue = currentValue + increment;

						// Check blueprint cap (use new level if being upgraded)
						const checkLevel = upgradeObj.upgrade.level || machine.level;
						const blueprintCap = UpgradeAnalyzer.getMaxBlueprintLevel(checkLevel);

						if (newValue > blueprintCap) {
							exceedsCap = true;
							break;
						}

						if (!upgradeObj.upgrade.blueprints) {
							upgradeObj.upgrade.blueprints = { ...machine.blueprints };
						}
						upgradeObj.upgrade.blueprints[type] = newValue;

						upgradeObj.upgrades.push({
							machineId: machine.id,
							machineName: machine.name,
							upgradeType: type,
							currentValue,
							requiredValue: newValue,
						});
					}
				}

				if (exceedsCap) {
					continue;
				}

				// Build final arrays
				for (const [, upgradeObj] of machineUpgradeMap) {
					machineUpgrades.push({
						machine: upgradeObj.machine,
						upgrade: upgradeObj.upgrade,
					});
					upgradesList.push(...upgradeObj.upgrades);
				}

				// Test if this passes
				if (this.canPassWithUpgrades(formation, machineUpgrades, mission, difficulty)) {
					let totalPowerGain = new Decimal(0);
					for (const { machine, upgrade } of machineUpgrades) {
						const gain = this.calculateUpgradePowerGain(machine, upgrade);
						totalPowerGain = totalPowerGain.add(gain);
					}

					// Calculate actual cost
					const actualCost = upgradesList.reduce((sum, u) => {
						const increment = u.requiredValue - u.currentValue;
						const cost = u.upgradeType === "level" ? increment * 2 : increment;
						return sum + cost;
					}, 0);

					// Return first solution at this cost level
					return {
						upgrades: upgradesList,
						totalPowerGain,
						totalUpgradeAmount: actualCost,
					};
				}
			}
		}

		return null;
	}

	/**
	 * Generates all possible distributions that achieve a target cost
	 * Accounts for levels costing 2x
	 * @param {number} targetCost - Target total cost
	 * @param {Array} upgradeSpecs - Upgrade specifications
	 * @returns {Array<Array<number>>} All valid distributions
	 */
	generateDistributionsForCost(targetCost, upgradeSpecs) {
		const distributions = [];
		const n = upgradeSpecs.length;

		// Calculate cost multipliers (2 for level, 1 for blueprints)
		const multipliers = upgradeSpecs.map((spec) => (spec.type === "level" ? 2 : 1));

		// Recursive function to generate distributions
		const generate = (index, remaining, current) => {
			if (index === n) {
				if (remaining === 0) {
					distributions.push([...current]);
				}
				return;
			}

			const multiplier = multipliers[index];
			const maxIncrement = Math.floor(remaining / multiplier);

			// Try each possible increment for this position
			for (let increment = 1; increment <= maxIncrement; increment++) {
				current[index] = increment;
				generate(index + 1, remaining - increment * multiplier, current);
			}

			current[index] = 0;
		};

		generate(0, targetCost, new Array(n).fill(0));

		return distributions;
	}

	/**
	 * Finds minimum single upgrade needed (respects blueprint caps)
	 * @param {Array} formation - Current formation
	 * @param {Object} machine - Machine to upgrade
	 * @param {string} upgradeType - Type of upgrade
	 * @param {number} currentValue - Current value
	 * @param {number} mission - Mission number
	 * @param {string} difficulty - Difficulty level
	 * @returns {SingleUpgrade | null}
	 */
	findMinimumUpgrade(formation, machine, upgradeType, currentValue, mission, difficulty) {
		const maxAttempts = 100;

		// Test incrementally from current + 1
		for (let testValue = currentValue + 1; testValue <= currentValue + maxAttempts; testValue++) {
			let upgrade;

			if (upgradeType === "level") {
				upgrade = { level: testValue };
			} else {
				// Check blueprint cap for this level
				const blueprintCap = UpgradeAnalyzer.getMaxBlueprintLevel(machine.level);

				if (testValue > blueprintCap) {
					// Blueprint would exceed cap - skip this upgrade type
					return null;
				}

				upgrade = { blueprints: { ...machine.blueprints, [upgradeType]: testValue } };
			}

			if (this.canPassWithUpgrades(formation, [{ machine, upgrade }], mission, difficulty)) {
				return {
					machineId: machine.id,
					machineName: machine.name,
					upgradeType,
					currentValue,
					requiredValue: testValue,
				};
			}
		}

		return null;
	}

	/**
	 * Finds minimum combined upgrade (multiple stats on one machine, respects caps)
	 * @param {Array} formation - Current formation
	 * @param {Object} machine - Machine to upgrade
	 * @param {Array<string>} upgradeTypes - Types to upgrade together
	 * @param {number} mission - Mission number
	 * @param {string} difficulty - Difficulty level
	 * @returns {UpgradePath | null}
	 */
	findMinimumCombinedUpgrade(formation, machine, upgradeTypes, mission, difficulty) {
		const maxAttempts = 50;

		for (let increment = 1; increment <= maxAttempts; increment++) {
			const upgrades = [];
			const upgrade = {};
			let exceedsCap = false;

			for (const type of upgradeTypes) {
				if (type === "level") {
					const currentLevel = machine.level;
					const newLevel = currentLevel + increment;

					upgrade.level = newLevel;
					upgrades.push({
						machineId: machine.id,
						machineName: machine.name,
						upgradeType: "level",
						currentValue: currentLevel,
						requiredValue: newLevel,
					});
				} else {
					const currentValue = machine.blueprints[type];
					const newValue = currentValue + increment;

					// Check if this would exceed the cap at the NEW level (if level is being upgraded)
					const checkLevel = upgrade.level || machine.level;
					const blueprintCap = UpgradeAnalyzer.getMaxBlueprintLevel(checkLevel);

					if (newValue > blueprintCap) {
						exceedsCap = true;
						break;
					}

					if (!upgrade.blueprints) {
						upgrade.blueprints = { ...machine.blueprints };
					}
					upgrade.blueprints[type] = newValue;

					upgrades.push({
						machineId: machine.id,
						machineName: machine.name,
						upgradeType: type,
						currentValue,
						requiredValue: newValue,
					});
				}
			}

			// Skip this increment if it exceeds caps
			if (exceedsCap) {
				continue;
			}

			if (this.canPassWithUpgrades(formation, [{ machine, upgrade }], mission, difficulty)) {
				const powerGain = this.calculateUpgradePowerGain(machine, upgrade);

				// Calculate actual cost (levels = 2x, blueprints = 1x)
				const actualCost = upgrades.reduce((sum, u) => {
					const increment = u.requiredValue - u.currentValue;
					const cost = u.upgradeType === "level" ? increment * 2 : increment;
					return sum + cost;
				}, 0);

				return {
					upgrades,
					totalPowerGain: powerGain,
					totalUpgradeAmount: actualCost,
				};
			}
		}

		return null;
	}

	/**
	 * Tests if team can pass with upgrades
	 * First checks power requirement, then runs 200 battle simulations
	 * @param {Array} formation - Current formation
	 * @param {Array} machineUpgrades - Array of {machine, upgrade} objects
	 * @param {number} mission - Mission number
	 * @param {string} difficulty - Difficulty level
	 * @returns {boolean}
	 */
	canPassWithUpgrades(formation, machineUpgrades, mission, difficulty) {
		// Create map of machine IDs to upgrades
		const upgradeMap = new Map();
		for (const { machine, upgrade } of machineUpgrades) {
			upgradeMap.set(machine.id, { machine, upgrade });
		}

		// Create upgraded formation
		const upgradedFormation = formation.map((m) => {
			const machineUpgrade = upgradeMap.get(m.id);

			if (!machineUpgrade) {
				return m;
			}

			// Apply upgrade - need to merge level and blueprints properly
			// CRITICAL: Only update the blueprints that are being upgraded, keep others at current values
			const upgradedMachine = {
				...m,
				level: machineUpgrade.upgrade.level !== undefined ? machineUpgrade.upgrade.level : m.level,
				blueprints: machineUpgrade.upgrade.blueprints ? { ...m.blueprints, ...machineUpgrade.upgrade.blueprints } : { ...m.blueprints },
			};

			// Recalculate battle stats with upgraded values
			const newBattleStats = Calculator.calculateBattleAttributes(upgradedMachine, m.crew || [], this.globalRarityLevels, this.artifactArray, this.engineerLevel);

			return {
				...upgradedMachine,
				battleStats: {
					damage: newBattleStats.damage,
					health: newBattleStats.health,
					maxHealth: newBattleStats.health,
					armor: newBattleStats.armor,
				},
			};
		});

		// CRITICAL: Check power requirement first
		const ourPower = Calculator.computeSquadPower(upgradedFormation, "campaign");
		const requiredPower = Calculator.requiredPowerForMission(mission, difficulty);

		if (ourPower.gte(requiredPower)) {
			// Run 50 battle simulations - need at least one win
			const enemyFormation = Calculator.getEnemyTeamForMission(mission, difficulty);

			for (let i = 0; i < 50; i++) {
				const result = this.battleEngine.runBattle(upgradedFormation, enemyFormation, AppConfig.MAX_BATTLE_ROUNDS, true);

				if (result.playerWon) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Gets top N machines by power
	 * @param {Array} formation - Formation to analyze
	 * @param {number} count - Number to return
	 * @returns {Array}
	 */
	getTopMachines(formation, count) {
		const machinesWithPower = formation.map((machine) => {
			const stats = {
				damage: machine.battleStats.damage,
				health: machine.battleStats.health,
				armor: machine.battleStats.armor,
			};
			const power = Calculator.computeMachinePower(stats);

			return { machine, power };
		});

		machinesWithPower.sort((a, b) => b.power.cmp(a.power));

		return machinesWithPower.slice(0, count).map((item) => item.machine);
	}

	/**
	 * Calculates power gain from upgrade
	 * @param {Object} machine - Original machine
	 * @param {Object} upgrade - Upgrade to apply (may contain level and/or blueprints)
	 * @returns {Decimal}
	 */
	calculateUpgradePowerGain(machine, upgrade) {
		const upgradedMachine = {
			...machine,
			level: upgrade.level !== undefined ? upgrade.level : machine.level,
			blueprints: upgrade.blueprints ? { ...machine.blueprints, ...upgrade.blueprints } : { ...machine.blueprints },
		};

		const upgradedStats = Calculator.calculateBattleAttributes(upgradedMachine, machine.crew || [], this.globalRarityLevels, this.artifactArray, this.engineerLevel);

		const originalPower = Calculator.computeMachinePower(machine.battleStats);
		const upgradedPower = Calculator.computeMachinePower(upgradedStats);

		return upgradedPower.sub(originalPower);
	}
}
