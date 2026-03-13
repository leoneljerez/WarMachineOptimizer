// storage.js
import { db } from "./db.js";
import { renderArtifacts } from "./ui/artifacts.js";
import { renderHeroes } from "./ui/heroes.js";
import { renderMachines } from "./ui/machines.js";
import { renderTavernCards } from "./ui/tavern.js";
import { showToast } from "./ui/notifications.js";

// ─────────────────────────────────────────────
// Canonical store-application helper
// ─────────────────────────────────────────────

/**
 * Applies a persisted state object to the live store.
 * This is the single canonical implementation — saveload.js imports and
 * calls this function rather than maintaining its own copy.
 *
 * Machines and heroes are matched by ID (not array index) so that future
 * additions to the master list never silently corrupt existing data.
 *
 * @param {Object} store - Live application store
 * @param {Object} state - State object from IndexedDB or save-file load
 * @param {number}   [state.engineerLevel]
 * @param {number}   [state.scarabLevel]
 * @param {string}   [state.riftRank]
 * @param {Object[]} [state.machines]
 * @param {Object[]} [state.heroes]
 * @param {Object}   [state.artifacts]
 */
export function applyStateToStore(store, state) {
	// General settings
	if (state.engineerLevel !== undefined) store.engineerLevel = state.engineerLevel;
	if (state.scarabLevel !== undefined) store.scarabLevel = state.scarabLevel;
	if (state.riftRank !== undefined) store.riftRank = state.riftRank;

	// Machines — match by ID
	if (state.machines?.length) {
		const machineMap = new Map(store.machines.map((m) => [m.id, m]));

		for (const saved of state.machines) {
			const machine = machineMap.get(saved.id);
			if (!machine) continue;
			machine.rarity = saved.rarity;
			machine.level = saved.level;
			machine.blueprints.damage = saved.blueprints.damage;
			machine.blueprints.health = saved.blueprints.health;
			machine.blueprints.armor = saved.blueprints.armor;
			machine.inscriptionLevel = saved.inscriptionLevel || 0;
			machine.sacredLevel = saved.sacredLevel || 0;
		}
	}

	// Heroes — match by ID
	if (state.heroes?.length) {
		const heroMap = new Map(store.heroes.map((h) => [h.id, h]));

		for (const saved of state.heroes) {
			const hero = heroMap.get(saved.id);
			if (!hero) continue;
			hero.percentages.damage = saved.percentages.damage;
			hero.percentages.health = saved.percentages.health;
			hero.percentages.armor = saved.percentages.armor;
		}
	}

	// Artifacts — store keys are numbers, saved keys may be strings
	if (state.artifacts && Object.keys(state.artifacts).length) {
		for (const [stat, percentages] of Object.entries(state.artifacts)) {
			if (!store.artifacts[stat]) store.artifacts[stat] = {};

			for (const [pct, quantity] of Object.entries(percentages)) {
				const numKey = Number(pct);
				if (!isNaN(numKey)) store.artifacts[stat][numKey] = quantity;
			}
		}
	}
}

// ─────────────────────────────────────────────
// Shared UI refresh helpers
// ─────────────────────────────────────────────

/**
 * Updates the three general-settings inputs from the store.
 * @param {Object} store
 */
export function updateUIInputs(store) {
	const engineerInput = document.getElementById("engineerLevel");
	const scarabInput = document.getElementById("scarabLevel");
	const riftInput = document.getElementById("riftRank");
	if (engineerInput) engineerInput.value = store.engineerLevel;
	if (scarabInput) scarabInput.value = store.scarabLevel;
	if (riftInput) riftInput.value = store.riftRank;
}

/**
 * Re-renders all entity panels from the current store state.
 * @param {Object} store
 */
export function renderAllPanels(store) {
	renderMachines(store.machines);
	renderHeroes(store.heroes);
	renderArtifacts(store.artifacts);
	renderTavernCards(store.machines);
}

// ─────────────────────────────────────────────
// Auto-save
// ─────────────────────────────────────────────

/**
 * Persists the current store to IndexedDB.
 * Shows a warning toast on the first failure only, to avoid spam.
 * @param {Object} store
 */
export async function autoSave(store) {
	try {
		const activeProfile = await db.getActiveProfile();
		if (!activeProfile) {
			console.warn("No active profile — skipping auto-save");
			return;
		}

		if (!Array.isArray(store.machines)) throw new Error("Invalid machines data");
		if (!Array.isArray(store.heroes)) throw new Error("Invalid heroes data");
		if (typeof store.artifacts !== "object") throw new Error("Invalid artifacts data");

		await db.saveState({
			engineerLevel: store.engineerLevel,
			scarabLevel: store.scarabLevel,
			riftRank: store.riftRank,
			machines: store.machines,
			heroes: store.heroes,
			artifacts: store.artifacts,
		});

		autoSave._hasShownError = false;
	} catch (error) {
		console.error("Auto-save failed:", error);
		if (!autoSave._hasShownError) {
			showToast(`Auto-save failed: ${error.message}`, "warning");
			autoSave._hasShownError = true;
		}
	}
}

/** @type {boolean} */
autoSave._hasShownError = false;

// ─────────────────────────────────────────────
// Auto-load
// ─────────────────────────────────────────────

/**
 * Loads saved data from IndexedDB and applies it to the store.
 * @param {Object} store
 * @returns {Promise<boolean>} True if data was loaded
 */
export async function autoLoad(store) {
	try {
		const state = await db.loadState();
		if (!state) return false;

		applyStateToStore(store, state);
		updateUIInputs(store);
		renderAllPanels(store);
		return true;
	} catch (error) {
		console.error("Auto-load failed:", error);
		showToast("Failed to load saved data.", "danger");
		return false;
	}
}

// ─────────────────────────────────────────────
// Reset
// ─────────────────────────────────────────────

/**
 * Resets store fields to match the default store values.
 * Machines and heroes are matched by array index because the default store
 * is always created with the same ordering as the live store.
 * @param {Object} store
 * @param {Object} defaults - Result of createInitialStore()
 * @private
 */
function _resetStoreToDefaults(store, defaults) {
	store.engineerLevel = defaults.engineerLevel;
	store.scarabLevel = defaults.scarabLevel;
	store.riftRank = defaults.riftRank;
	store.optimizeMode = defaults.optimizeMode;

	for (let i = 0; i < store.machines.length; i++) {
		const m = store.machines[i];
		const d = defaults.machines[i];
		m.rarity = d.rarity;
		m.level = d.level;
		m.blueprints.damage = d.blueprints.damage;
		m.blueprints.health = d.blueprints.health;
		m.blueprints.armor = d.blueprints.armor;
		m.inscriptionLevel = d.inscriptionLevel;
		m.sacredLevel = d.sacredLevel;
	}

	for (let i = 0; i < store.heroes.length; i++) {
		const h = store.heroes[i];
		const d = defaults.heroes[i];
		h.percentages.damage = d.percentages.damage;
		h.percentages.health = d.percentages.health;
		h.percentages.armor = d.percentages.armor;
	}

	for (const [stat, percentages] of Object.entries(store.artifacts)) {
		for (const pct of Object.keys(percentages)) {
			store.artifacts[stat][pct] = 0;
		}
	}
}

/**
 * Clears all saved data and resets the store and UI to defaults.
 * @param {Object}   store
 * @param {Function} createInitialStore - Factory for the default store
 */
export async function resetAll(store, createInitialStore) {
	try {
		await db.clearProfileData();
		_resetStoreToDefaults(store, createInitialStore());
		updateUIInputs(store);
		renderAllPanels(store);
		showToast("All data reset to default values", "success");
	} catch (error) {
		console.error("Reset failed:", error);
		showToast("Failed to reset data", "danger");
	}
}
