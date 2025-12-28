// storage.js
import { db } from "./db.js";
import { renderArtifacts } from "./ui/artifacts.js";
import { renderHeroes } from "./ui/heroes.js";
import { renderMachines } from "./ui/machines.js";
import { renderTavernCards } from "./ui/tavern.js";
import { showToast } from "./ui/notifications.js";

/**
 * Auto-saves store to IndexedDB using Dexie
 * Uses bulk operations for optimal performance
 * @param {import('./app.js').Store} store - Application store
 */
export async function autoSave(store) {
	try {
		// Verify we have an active profile before saving
		const activeProfile = await db.getActiveProfile();
		if (!activeProfile) {
			console.warn("No active profile - skipping auto-save");
			return;
		}

		console.log("Auto-saving to profile:", activeProfile.id, activeProfile.name);

		// Validate data before saving
		if (!store.machines || !Array.isArray(store.machines)) {
			throw new Error("Invalid machines data");
		}
		if (!store.heroes || !Array.isArray(store.heroes)) {
			throw new Error("Invalid heroes data");
		}
		if (!store.artifacts || typeof store.artifacts !== "object") {
			throw new Error("Invalid artifacts data");
		}

		await db.saveState({
			engineerLevel: store.engineerLevel,
			scarabLevel: store.scarabLevel,
			riftRank: store.riftRank,
			machines: store.machines,
			heroes: store.heroes,
			artifacts: store.artifacts,
		});

		console.log("Auto-save successful");

		// Reset error flag on success
		autoSave._hasShownError = false;
	} catch (error) {
		console.error("Auto-save failed:", error);
		console.error("Error details:", error.message, error.stack);

		// Only show toast on first failure to avoid spam
		if (!autoSave._hasShownError) {
			showToast(`Auto-save failed: ${error.message}`, "warning");
			autoSave._hasShownError = true;
		}
	}
}

// Track if we've shown an error to avoid spam
autoSave._hasShownError = false;

/**
 * Applies loaded state to the store
 * @param {import('./app.js').Store} store - Application store
 * @param {Object} state - Loaded state
 */
function applyStateToStore(store, state) {
	// Apply config
	if (state.engineerLevel !== undefined) store.engineerLevel = state.engineerLevel;
	if (state.scarabLevel !== undefined) store.scarabLevel = state.scarabLevel;
	if (state.riftRank !== undefined) store.riftRank = state.riftRank;

	// Apply machines
	if (state.machines && state.machines.length > 0) {
		const machineMap = new Map(store.machines.map((m) => [m.id, m]));

		for (let i = 0; i < state.machines.length; i++) {
			const savedMachine = state.machines[i];
			const machine = machineMap.get(savedMachine.id);

			if (machine) {
				machine.rarity = savedMachine.rarity;
				machine.level = savedMachine.level;
				machine.blueprints.damage = savedMachine.blueprints.damage;
				machine.blueprints.health = savedMachine.blueprints.health;
				machine.blueprints.armor = savedMachine.blueprints.armor;
				machine.inscriptionLevel = savedMachine.inscriptionLevel || 0;
				machine.sacredLevel = savedMachine.sacredLevel || 0;
			}
		}
	}

	// Apply heroes
	if (state.heroes && state.heroes.length > 0) {
		const heroMap = new Map(store.heroes.map((h) => [h.id, h]));

		for (let i = 0; i < state.heroes.length; i++) {
			const savedHero = state.heroes[i];
			const hero = heroMap.get(savedHero.id);

			if (hero) {
				hero.percentages.damage = savedHero.percentages.damage;
				hero.percentages.health = savedHero.percentages.health;
				hero.percentages.armor = savedHero.percentages.armor;
			}
		}
	}

	// Apply artifacts
	if (state.artifacts && Object.keys(state.artifacts).length > 0) {
		const stats = Object.keys(state.artifacts);
		for (let i = 0; i < stats.length; i++) {
			const stat = stats[i];
			const percentages = Object.keys(state.artifacts[stat]);

			for (let j = 0; j < percentages.length; j++) {
				const pct = percentages[j];
				const numKey = Number(pct);
				if (!isNaN(numKey)) {
					store.artifacts[stat][numKey] = state.artifacts[stat][pct];
				}
			}
		}
	}
}

/**
 * Updates UI inputs with loaded values
 * @param {import('./app.js').Store} store - Application store
 */
function updateUIInputs(store) {
	const engineerInput = document.getElementById("engineerLevel");
	const scarabInput = document.getElementById("scarabLevel");
	const riftInput = document.getElementById("riftRank");

	if (engineerInput) engineerInput.value = store.engineerLevel;
	if (scarabInput) scarabInput.value = store.scarabLevel;
	if (riftInput) riftInput.value = store.riftRank;
}

/**
 * Loads saved data from IndexedDB
 * @param {import('./app.js').Store} store - Application store
 * @returns {Promise<boolean>} True if data was loaded successfully
 */
export async function autoLoad(store) {
	try {
		const state = await db.loadState();

		if (!state) {
			return false;
		}

		// Apply loaded state to store
		applyStateToStore(store, state);

		// Update UI
		updateUIInputs(store);

		// Re-render UI components
		renderMachines(store.machines);
		renderHeroes(store.heroes);
		renderArtifacts(store.artifacts);
		renderTavernCards(store.machines);

		return true;
	} catch (error) {
		console.error("Auto-load failed:", error);
		showToast("Failed to load saved data.", "danger");
		return false;
	}
}

/**
 * Resets store to default values
 * @param {import('./app.js').Store} store - Application store
 * @param {Object} defaults - Default values
 */
function resetStoreToDefaults(store, defaults) {
	store.engineerLevel = defaults.engineerLevel;
	store.scarabLevel = defaults.scarabLevel;
	store.riftRank = defaults.riftRank;
	store.optimizeMode = defaults.optimizeMode;

	// Reset machines
	for (let i = 0; i < store.machines.length; i++) {
		const machine = store.machines[i];
		const defaultMachine = defaults.machines[i];
		machine.rarity = defaultMachine.rarity;
		machine.level = defaultMachine.level;
		machine.blueprints.damage = defaultMachine.blueprints.damage;
		machine.blueprints.health = defaultMachine.blueprints.health;
		machine.blueprints.armor = defaultMachine.blueprints.armor;
		machine.inscriptionLevel = defaultMachine.inscriptionLevel;
		machine.sacredLevel = defaultMachine.sacredLevel;
	}

	// Reset heroes
	for (let i = 0; i < store.heroes.length; i++) {
		const hero = store.heroes[i];
		const defaultHero = defaults.heroes[i];
		hero.percentages.damage = defaultHero.percentages.damage;
		hero.percentages.health = defaultHero.percentages.health;
		hero.percentages.armor = defaultHero.percentages.armor;
	}

	// Reset artifacts
	const stats = Object.keys(store.artifacts);
	for (let i = 0; i < stats.length; i++) {
		const stat = stats[i];
		const percentages = Object.keys(store.artifacts[stat]);
		for (let j = 0; j < percentages.length; j++) {
			const pct = percentages[j];
			store.artifacts[stat][pct] = 0;
		}
	}
}

/**
 * Clears all saved data and resets to defaults
 * @param {import('./app.js').Store} store - Application store
 * @param {Function} createInitialStore - Function to create default store
 */
export async function resetAll(store, createInitialStore) {
	try {
		// Clear database
		await db.clearAllData();

		// Reset store to defaults
		const defaults = createInitialStore();
		resetStoreToDefaults(store, defaults);

		// Update UI
		updateUIInputs(store);

		// Re-render UI components
		renderMachines(store.machines);
		renderHeroes(store.heroes);
		renderArtifacts(store.artifacts);
		renderTavernCards(store.machines);

		showToast("All data reset to default values", "success");
	} catch (error) {
		console.error("Reset failed:", error);
		showToast("Failed to reset data", "danger");
	}
}
