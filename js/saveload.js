// saveload.js
import { db } from "./db.js";
import { renderArtifacts } from "./ui/artifacts.js";
import { renderHeroes } from "./ui/heroes.js";
import { renderMachines } from "./ui/machines.js";
import { renderTavernCards } from "./ui/tavern.js";
import { showToast } from "./ui/notifications.js";

/**
 * Detects if save data is legacy format (your old saves)
 * @param {Object} data - Parsed save data
 * @returns {boolean} True if legacy format
 */
function isLegacyFormat(data) {
	// Legacy format has engineerLevel, scarabLevel, riftRank at root level
	// New format wraps them in config array
	return (
		typeof data.engineerLevel === "number" &&
		typeof data.scarabLevel === "number" &&
		typeof data.riftRank === "string" &&
		!data.version
	);
}

/**
 * Converts legacy save format to new format
 * @param {Object} legacyData - Legacy save data
 * @returns {Object} New format save data
 */
function convertLegacyToNewFormat(legacyData) {
	return {
		version: 1,
		timestamp: Date.now(),
		config: [
			{ key: "engineerLevel", value: legacyData.engineerLevel },
			{ key: "scarabLevel", value: legacyData.scarabLevel },
			{ key: "riftRank", value: legacyData.riftRank },
		],
		machines: legacyData.machines,
		heroes: legacyData.heroes,
		artifacts: Object.keys(legacyData.artifacts).map((stat) => ({
			stat,
			values: legacyData.artifacts[stat],
		})),
	};
}

/**
 * Validates loaded save data structure
 * @param {Object} data - Data to validate
 * @returns {string[]} Array of error messages
 */
function validateSaveData(data) {
	const errors = [];

	// Allow legacy format
	if (isLegacyFormat(data)) {
		// Validate legacy format
		if (typeof data.engineerLevel !== "number") {
			errors.push("Invalid engineerLevel");
		}
		if (typeof data.scarabLevel !== "number") {
			errors.push("Invalid scarabLevel");
		}
		if (typeof data.riftRank !== "string") {
			errors.push("Invalid riftRank");
		}
	} else {
		// Validate new format
		if (data.version !== 1) {
			errors.push("Incompatible save data version");
		}

		if (!data.timestamp || typeof data.timestamp !== "number") {
			errors.push("Invalid or missing timestamp");
		}

		if (!Array.isArray(data.config)) {
			errors.push("config must be an array");
		}

		if (!Array.isArray(data.artifacts)) {
			errors.push("artifacts must be an array in new format");
		}
	}

	// Validate machines (same in both formats)
	if (!Array.isArray(data.machines)) {
		errors.push("machines must be an array");
	} else {
		for (let i = 0; i < data.machines.length; i++) {
			const machine = data.machines[i];
			if (machine.id === undefined || machine.id === null) {
				errors.push(`Machine ${i} missing id`);
			}
			if (typeof machine.rarity !== "string") {
				errors.push(`Machine ${i} missing valid rarity`);
			}
			if (typeof machine.level !== "number") {
				errors.push(`Machine ${i} missing valid level`);
			}
			if (!machine.blueprints || typeof machine.blueprints !== "object") {
				errors.push(`Machine ${i} missing blueprints object`);
			}
		}
	}

	// Validate heroes (same in both formats)
	if (!Array.isArray(data.heroes)) {
		errors.push("heroes must be an array");
	} else {
		for (let i = 0; i < data.heroes.length; i++) {
			const hero = data.heroes[i];
			if (hero.id === undefined || hero.id === null) {
				errors.push(`Hero ${i} missing id`);
			}
			if (!hero.percentages || typeof hero.percentages !== "object") {
				errors.push(`Hero ${i} missing percentages object`);
			}
		}
	}

	return errors;
}

/**
 * Applies loaded data to store
 * @param {import('./app.js').Store} store - Application store
 * @param {Object} data - Save data to apply (new format)
 */
function applyLoadedDataToStore(store, data) {
	// Apply config
	const configMap = new Map(data.config.map((c) => [c.key, c.value]));

	if (configMap.has("engineerLevel")) store.engineerLevel = configMap.get("engineerLevel");
	if (configMap.has("scarabLevel")) store.scarabLevel = configMap.get("scarabLevel");
	if (configMap.has("riftRank")) store.riftRank = configMap.get("riftRank");

	// Apply machines
	const machineMap = new Map(store.machines.map((m) => [m.id, m]));

	for (let i = 0; i < data.machines.length; i++) {
		const savedMachine = data.machines[i];
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

	// Apply heroes
	const heroMap = new Map(store.heroes.map((h) => [h.id, h]));

	for (let i = 0; i < data.heroes.length; i++) {
		const savedHero = data.heroes[i];
		const hero = heroMap.get(savedHero.id);
		if (hero) {
			hero.percentages.damage = savedHero.percentages.damage;
			hero.percentages.health = savedHero.percentages.health;
			hero.percentages.armor = savedHero.percentages.armor;
		}
	}

	// Apply artifacts
	for (let i = 0; i < data.artifacts.length; i++) {
		const artifact = data.artifacts[i];
		const stat = artifact.stat;
		const percentages = Object.keys(artifact.values);

		for (let j = 0; j < percentages.length; j++) {
			const pct = percentages[j];
			const numKey = Number(pct);
			if (!isNaN(numKey)) {
				store.artifacts[stat][numKey] = artifact.values[pct];
			}
		}
	}
}

/**
 * Updates UI after loading data
 * @param {import('./app.js').Store} store - Application store
 */
function updateUIAfterLoad(store) {
	const engineerInput = document.getElementById("engineerLevel");
	const scarabInput = document.getElementById("scarabLevel");
	const riftInput = document.getElementById("riftRank");

	if (engineerInput) engineerInput.value = store.engineerLevel;
	if (scarabInput) scarabInput.value = store.scarabLevel;
	if (riftInput) riftInput.value = store.riftRank;

	renderMachines(store.machines);
	renderHeroes(store.heroes);
	renderArtifacts(store.artifacts);
	renderTavernCards(store.machines);
}

export const SaveLoad = {
	/**
	 * Saves the current store to JSON using Dexie export
	 * @param {import('./app.js').Store} store - Application store
	 */
	// eslint-disable-next-line no-unused-vars
	async save(store) {
		try {
			const json = await db.exportData();
			document.getElementById("saveLoadBox").value = json;
			showToast("Data prepared for saving. Copy the JSON from the text box.", "success");
		} catch (error) {
			console.error("Save failed:", error);
			showToast("Failed to save data. Please try again.", "danger");
		}
	},

	/**
	 * Loads JSON data into the store using Dexie import
	 * Supports both legacy and new save formats
	 * @param {import('./app.js').Store} store - Application store
	 */
	async load(store) {
		const textarea = document.getElementById("saveLoadBox");
		const content = textarea.value.trim();

		if (!content) {
			showToast("Please paste save data into the text box first.", "warning");
			return;
		}

		try {
			let data = JSON.parse(content);

			// Validate data structure
			const errors = validateSaveData(data);
			if (errors.length > 0) {
				console.error("Invalid save data:", errors);
				showToast(`Invalid save data: ${errors[0]}`, "danger");
				return;
			}

			// Convert legacy format to new format if needed
			let wasLegacy = false;
			if (isLegacyFormat(data)) {
				console.log("Detected legacy save format - converting to new format");
				data = convertLegacyToNewFormat(data);
				wasLegacy = true;
			}

			// Import to database
			await db.importData(JSON.stringify(data));

			// Apply to store
			applyLoadedDataToStore(store, data);

			// Update UI
			updateUIAfterLoad(store);

			if (wasLegacy) {
				showToast("Legacy save loaded and converted to new format!", "success");
			} else {
				showToast("Data loaded successfully!", "success");
			}
			textarea.value = "";
		} catch (error) {
			if (error instanceof SyntaxError) {
				console.error("Invalid JSON:", error);
				showToast("Invalid JSON format. Please check your save data.", "danger");
			} else {
				console.error("Load failed:", error);
				showToast(`Failed to load data: ${error.message}`, "danger");
			}
		}
	},
};