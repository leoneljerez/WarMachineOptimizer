// db.js
import Dexie from "https://cdn.jsdelivr.net/npm/dexie@4.0.10/+esm";

/**
 * War Machine Optimizer Database
 * Uses Dexie.js 4.2.1 for IndexedDB management
 */
class WMDatabase extends Dexie {
	constructor() {
		super("WarMachineOptimizer");

		// Version 1 - Initial schema
		this.version(1).stores({
			// General settings (single record with key 'settings')
			general: "key",

			// Machine configurations (primary key: id)
			machines: "id, rarity, level, sacredLevel, inscriptionLevel",

			// Hero configurations (primary key: id)
			heroes: "id",

			// Artifact configurations (primary key: stat)
			artifacts: "stat",

			// Optimization results cache (auto-increment id, indexed by mode)
			results: "++id, mode",
		});
	}

	// ========================================
	// General Settings Methods
	// ========================================

	/**
	 * Saves all general settings at once
	 * @param {Object} settings - Settings object
	 * @param {number} settings.engineerLevel
	 * @param {number} settings.scarabLevel
	 * @param {string} settings.riftRank
	 */
	async saveGeneral(settings) {
		await this.general.put({
			key: "settings",
			engineerLevel: settings.engineerLevel,
			scarabLevel: settings.scarabLevel,
			riftRank: settings.riftRank,
		});
	}

	/**
	 * Loads general settings
	 * @returns {Promise<Object|null>} Settings object or null
	 */
	async loadGeneral() {
		const record = await this.general.get("settings");
		if (!record) return null;

		return {
			engineerLevel: record.engineerLevel,
			scarabLevel: record.scarabLevel,
			riftRank: record.riftRank,
		};
	}

	// ========================================
	// Machine Methods
	// ========================================

	/**
	 * Saves all machine configurations in bulk
	 * @param {Array<Object>} machines - Machine array
	 */
	async saveMachines(machines) {
		const records = machines.map((machine) => ({
			id: machine.id,
			rarity: machine.rarity,
			level: machine.level,
			blueprints: {
				damage: machine.blueprints.damage,
				health: machine.blueprints.health,
				armor: machine.blueprints.armor,
			},
			inscriptionLevel: machine.inscriptionLevel || 0,
			sacredLevel: machine.sacredLevel || 0,
		}));

		await this.machines.bulkPut(records);
	}

	/**
	 * Loads all machine configurations
	 * @returns {Promise<Array<Object>>} Machine configurations
	 */
	async loadMachines() {
		return await this.machines.toArray();
	}

	// ========================================
	// Hero Methods
	// ========================================

	/**
	 * Saves all hero configurations in bulk
	 * @param {Array<Object>} heroes - Hero array
	 */
	async saveHeroes(heroes) {
		const records = heroes.map((hero) => ({
			id: hero.id,
			percentages: {
				damage: hero.percentages.damage,
				health: hero.percentages.health,
				armor: hero.percentages.armor,
			},
		}));

		await this.heroes.bulkPut(records);
	}

	/**
	 * Loads all hero configurations
	 * @returns {Promise<Array<Object>>} Hero configurations
	 */
	async loadHeroes() {
		return await this.heroes.toArray();
	}

	// ========================================
	// Artifact Methods
	// ========================================

	/**
	 * Saves artifact configurations
	 * @param {Object} artifacts - Artifact object {damage: {30: 5, 35: 3}, health: {...}, armor: {...}}
	 */
	async saveArtifacts(artifacts) {
		const records = Object.keys(artifacts).map((stat) => ({
			stat,
			values: artifacts[stat],
		}));

		await this.artifacts.bulkPut(records);
	}

	/**
	 * Loads artifact configurations
	 * @returns {Promise<Object>} Artifact object {damage: {...}, health: {...}, armor: {...}}
	 */
	async loadArtifacts() {
		const records = await this.artifacts.toArray();

		// Convert back to original structure
		const artifacts = {};
		for (let i = 0; i < records.length; i++) {
			const record = records[i];
			artifacts[record.stat] = record.values;
		}

		return artifacts;
	}

	// ========================================
	// Result Caching Methods
	// ========================================

	/**
	 * Saves optimization result (replaces any existing result for this mode)
	 * @param {string} mode - "campaign" or "arena"
	 * @param {Object} result - Optimization result
	 */
	async saveResult(mode, result) {
		// Use transaction for atomic operations
		await this.transaction("rw", this.results, async () => {
			// Delete all existing results for this mode
			await this.results.where("mode").equals(mode).delete();

			// Add new result
			await this.results.add({
				mode,
				result,
			});
		});
	}

	/**
	 * Gets the most recent optimization result for a mode
	 * @param {string} mode - "campaign" or "arena"
	 * @returns {Promise<Object|null>} Most recent result or null
	 */
	async getLatestResult(mode) {
		const result = await this.results.where("mode").equals(mode).first();
		return result ? result.result : null;
	}

	// ========================================
	// Bulk Operations
	// ========================================

	/**
	 * Saves entire application state in a single transaction
	 * @param {Object} state - Application state
	 * @param {number} state.engineerLevel
	 * @param {number} state.scarabLevel
	 * @param {string} state.riftRank
	 * @param {Array} state.machines
	 * @param {Array} state.heroes
	 * @param {Object} state.artifacts
	 */
	async saveState(state) {
		await this.transaction("rw", [this.general, this.machines, this.heroes, this.artifacts], async () => {
			// Save general settings
			await this.saveGeneral({
				engineerLevel: state.engineerLevel,
				scarabLevel: state.scarabLevel,
				riftRank: state.riftRank,
			});

			// Save machines, heroes, artifacts
			await Promise.all([this.saveMachines(state.machines), this.saveHeroes(state.heroes), this.saveArtifacts(state.artifacts)]);
		});
	}

	/**
	 * Loads entire application state in a single transaction
	 * @returns {Promise<Object|null>} Application state or null if no data
	 */
	async loadState() {
		// Check if we have any data
		const count = await this.machines.count();
		if (count === 0) return null;

		const [general, machines, heroes, artifacts] = await Promise.all([this.loadGeneral(), this.loadMachines(), this.loadHeroes(), this.loadArtifacts()]);

		if (!general) return null;

		return {
			engineerLevel: general.engineerLevel,
			scarabLevel: general.scarabLevel,
			riftRank: general.riftRank,
			machines,
			heroes,
			artifacts,
		};
	}

	// ========================================
	// Import/Export Methods
	// ========================================

	/**
	 * Exports all data as JSON for save/load feature
	 * @returns {Promise<string>} JSON string
	 */
	async exportData() {
		const state = await this.loadState();

		if (!state) {
			// Return minimal valid structure if no data
			return JSON.stringify(
				{
					version: 1,
					general: {
						engineerLevel: 0,
						scarabLevel: 0,
						riftRank: "bronze",
					},
					machines: [],
					heroes: [],
					artifacts: {
						damage: {},
						health: {},
						armor: {},
					},
				},
				null,
				2
			);
		}

		const data = {
			version: 1,
			general: {
				engineerLevel: state.engineerLevel,
				scarabLevel: state.scarabLevel,
				riftRank: state.riftRank,
			},
			machines: state.machines,
			heroes: state.heroes,
			artifacts: state.artifacts,
		};

		return JSON.stringify(data, null, 2);
	}

	/**
	 * Imports data from JSON for save/load feature
	 * @param {string} jsonString - JSON string to import
	 * @throws {Error} If data is invalid or incompatible version
	 */
	async importData(jsonString) {
		const data = JSON.parse(jsonString);

		// Validate version
		if (data.version !== 1) {
			throw new Error("Incompatible save data version");
		}

		// Validate structure
		if (!data.general || typeof data.general !== "object") {
			throw new Error("Invalid general settings");
		}

		if (!Array.isArray(data.machines) || !Array.isArray(data.heroes)) {
			throw new Error("Invalid save data structure");
		}

		if (!data.artifacts || typeof data.artifacts !== "object") {
			throw new Error("Invalid artifacts data");
		}

		// Import in single transaction for atomicity
		await this.transaction("rw", [this.general, this.machines, this.heroes, this.artifacts], async () => {
			// Clear existing data
			await Promise.all([this.general.clear(), this.machines.clear(), this.heroes.clear(), this.artifacts.clear()]);

			// Import new data
			const promises = [];

			promises.push(this.saveGeneral(data.general));

			if (data.machines.length > 0) {
				promises.push(this.machines.bulkAdd(data.machines));
			}

			if (data.heroes.length > 0) {
				promises.push(this.heroes.bulkAdd(data.heroes));
			}

			promises.push(this.saveArtifacts(data.artifacts));

			await Promise.all(promises);
		});
	}

	// ========================================
	// Utility Methods
	// ========================================

	/**
	 * Clears all data (for reset functionality)
	 */
	async clearAllData() {
		await this.transaction("rw", [this.general, this.machines, this.heroes, this.artifacts], async () => {
			await Promise.all([this.general.clear(), this.machines.clear(), this.heroes.clear(), this.artifacts.clear()]);
		});
	}

	/**
	 * Gets database statistics
	 * @returns {Promise<Object>} Statistics object
	 */
	async getStats() {
		const [generalCount, machineCount, heroCount, artifactCount, resultCount] = await Promise.all([
			this.general.count(),
			this.machines.count(),
			this.heroes.count(),
			this.artifacts.count(),
			this.results.count(),
		]);

		return {
			general: generalCount,
			machines: machineCount,
			heroes: heroCount,
			artifacts: artifactCount,
			cachedResults: resultCount,
		};
	}
}

// Create and export singleton instance
export const db = new WMDatabase();
