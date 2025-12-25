// storage.js
import { renderArtifacts } from "./ui/artifacts.js";
import { renderHeroes } from "./ui/heroes.js";
import { renderMachines } from "./ui/machines.js";
import { renderTavernCards } from "./ui/tavern.js";
import { showToast } from "./ui/notifications.js";

const STORAGE_KEY = "wm_optimizer_data";
const STORAGE_VERSION = 1;

/**
 * Auto-saves store to localStorage
 * @param {import('./app.js').Store} store - Application store
 */
export function autoSave(store) {
	try {
		const saveData = {
			version: STORAGE_VERSION,
			timestamp: Date.now(),
			engineerLevel: store.engineerLevel,
			scarabLevel: store.scarabLevel,
			riftRank: store.riftRank,
			machines: store.machines.map((machine) => ({
				id: machine.id,
				rarity: machine.rarity,
				level: machine.level,
				blueprints: {
					damage: machine.blueprints.damage,
					health: machine.blueprints.health,
					armor: machine.blueprints.armor,
				},
				inscriptionLevel: machine.inscriptionLevel,
				sacredLevel: machine.sacredLevel,
			})),
			heroes: store.heroes.map((hero) => ({
				id: hero.id,
				percentages: {
					damage: hero.percentages.damage,
					health: hero.percentages.health,
					armor: hero.percentages.armor,
				},
			})),
			artifacts: {
				damage: { ...store.artifacts.damage },
				health: { ...store.artifacts.health },
				armor: { ...store.artifacts.armor },
			},
		};

		localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
	} catch (error) {
		console.error("Auto-save failed:", error);
		showToast("Auto-save failed", "danger");
	}
}

/**
 * Loads saved data from localStorage
 * @param {import('./app.js').Store} store - Application store
 * @returns {boolean} True if data was loaded successfully
 */
export function autoLoad(store) {
	try {
		const savedData = localStorage.getItem(STORAGE_KEY);
		if (!savedData) return false;

		const data = JSON.parse(savedData);

		// Version check for future migrations
		if (data.version !== STORAGE_VERSION) {
			console.warn("Storage version mismatch, clearing old data");
			localStorage.removeItem(STORAGE_KEY);
			return false;
		}

		// Apply loaded data
		store.engineerLevel = data.engineerLevel;
		store.scarabLevel = data.scarabLevel;
		store.riftRank = data.riftRank;

		const machineMap = new Map(store.machines.map((m) => [String(m.id), m]));
		const heroMap = new Map(store.heroes.map((h) => [String(h.id), h]));

		data.machines.forEach((savedMachine) => {
			const machine = machineMap.get(String(savedMachine.id));
			if (machine) {
				machine.rarity = savedMachine.rarity;
				machine.level = savedMachine.level;
				machine.blueprints.damage = savedMachine.blueprints.damage;
				machine.blueprints.health = savedMachine.blueprints.health;
				machine.blueprints.armor = savedMachine.blueprints.armor;
				machine.inscriptionLevel = savedMachine.inscriptionLevel || 0;
				machine.sacredLevel = savedMachine.sacredLevel || 0;
			}
		});

		data.heroes.forEach((savedHero) => {
			const hero = heroMap.get(String(savedHero.id));
			if (hero) {
				hero.percentages.damage = savedHero.percentages.damage;
				hero.percentages.health = savedHero.percentages.health;
				hero.percentages.armor = savedHero.percentages.armor;
			}
		});

		Object.keys(data.artifacts).forEach((stat) => {
			Object.keys(data.artifacts[stat]).forEach((pct) => {
				const numKey = Number(pct);
				if (!isNaN(numKey)) {
					store.artifacts[stat][numKey] = data.artifacts[stat][pct];
				}
			});
		});

		// Update UI inputs
		document.getElementById("engineerLevel").value = store.engineerLevel;
		document.getElementById("scarabLevel").value = store.scarabLevel;
		document.getElementById("riftRank").value = store.riftRank;

		// Re-render UI
		renderMachines(store.machines);
		renderHeroes(store.heroes);
		renderArtifacts(store.artifacts);
		renderTavernCards(store.machines);

		return true;
	} catch (error) {
		console.error("Auto-load failed:", error);
		localStorage.removeItem(STORAGE_KEY);
		return false;
	}
}

/**
 * Clears all saved data and resets to defaults
 * @param {import('./app.js').Store} store - Application store
 * @param {Function} createInitialStore - Function to create default store
 */
export function resetAll(store, createInitialStore) {
	try {
		localStorage.removeItem(STORAGE_KEY);

		// Reset store to defaults
		const defaults = createInitialStore();
		
		store.engineerLevel = defaults.engineerLevel;
		store.scarabLevel = defaults.scarabLevel;
		store.riftRank = defaults.riftRank;
		store.optimizeMode = defaults.optimizeMode;

		// Reset machines
		store.machines.forEach((machine, idx) => {
			const defaultMachine = defaults.machines[idx];
			machine.rarity = defaultMachine.rarity;
			machine.level = defaultMachine.level;
			machine.blueprints.damage = defaultMachine.blueprints.damage;
			machine.blueprints.health = defaultMachine.blueprints.health;
			machine.blueprints.armor = defaultMachine.blueprints.armor;
			machine.inscriptionLevel = defaultMachine.inscriptionLevel;
			machine.sacredLevel = defaultMachine.sacredLevel;
		});

		// Reset heroes
		store.heroes.forEach((hero, idx) => {
			const defaultHero = defaults.heroes[idx];
			hero.percentages.damage = defaultHero.percentages.damage;
			hero.percentages.health = defaultHero.percentages.health;
			hero.percentages.armor = defaultHero.percentages.armor;
		});

		// Reset artifacts
		Object.keys(store.artifacts).forEach((stat) => {
			Object.keys(store.artifacts[stat]).forEach((pct) => {
				store.artifacts[stat][pct] = 0;
			});
		});

		// Update UI inputs
		document.getElementById("engineerLevel").value = store.engineerLevel;
		document.getElementById("scarabLevel").value = store.scarabLevel;
		document.getElementById("riftRank").value = store.riftRank;

		// Re-render UI
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