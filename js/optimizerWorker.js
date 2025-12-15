// optimizerWorker.js
import { Optimizer } from "./optimizer.js";

/**
 * @typedef {Object} WorkerMessage
 * @property {string} [mode='campaign'] - Optimization mode: 'campaign' or 'arena'
 * @property {Array<import('./app.js').Machine>} ownedMachines - Player's machines
 * @property {Array<import('./app.js').Hero>} ownedHeroes - Player's heroes
 * @property {number} [maxMission=90] - Maximum mission number to test
 * @property {number} [globalRarityLevels=0] - Sum of all machine rarity levels
 * @property {number} [engineerLevel=0] - Engineer level
 * @property {number} [scarabLevel=0] - Scarab level
 * @property {Array<{stat: string, values: Object}>} [artifactArray=[]] - Artifact configurations
 * @property {string} [riftRank=''] - Chaos Rift rank
 */

/**
 * Web Worker message handler for optimization calculations
 * Runs optimization in separate thread to prevent UI blocking
 * @param {MessageEvent<WorkerMessage>} e - Worker message event
 */
self.onmessage = function (e) {
	try {
		const {
			mode = "campaign",
			ownedMachines: rawMachines,
			ownedHeroes: rawHeroes,
			maxMission = 90,
			globalRarityLevels = 0,
			engineerLevel = 0,
			scarabLevel = 0,
			artifactArray = [],
			riftRank = "",
		} = e.data;

		// Create optimizer
		const optimizer = new Optimizer({
			ownedMachines: rawMachines,
			heroes: rawHeroes,
			engineerLevel,
			scarabLevel,
			artifactArray,
			globalRarityLevels,
			riftRank,
		});

		let result;

		// Run optimization based on mode
		if (mode === "arena") {
			result = optimizer.optimizeForArena(rawMachines);
			// Add mode to result
			result.mode = "arena";
		} else {
			result = optimizer.optimizeCampaignMaxStars({
				ownedMachines: rawMachines,
				maxMission,
			});
			// Add mode to result
			result.mode = "campaign";
		}

		self.postMessage(result);
	} catch (err) {
		// Catch all runtime errors and report to main thread
		const message = err?.message || String(err);
		console.error("Worker caught error:", message);
		self.postMessage({ error: message });
	}
};
