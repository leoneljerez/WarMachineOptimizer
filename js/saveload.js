// saveload.js
import { db } from "./db.js";
import { renderArtifacts } from "./ui/artifacts.js";
import { renderHeroes } from "./ui/heroes.js";
import { renderMachines } from "./ui/machines.js";
import { renderTavernCards } from "./ui/tavern.js";
import { showToast } from "./ui/notifications.js";

/**
 * Detects save format version
 * @param {Object} data - Parsed save data
 * @returns {"legacy"|"intermediate"|"final"} Format type
 */
function detectSaveFormat(data) {
	// Legacy format (original localStorage format)
	if (typeof data.engineerLevel === "number" && typeof data.scarabLevel === "number" && typeof data.riftRank === "string" && !data.version && data.artifacts && !Array.isArray(data.artifacts)) {
		return "legacy";
	}

	// Intermediate format (first Dexie version with timestamp and config array)
	if (data.version === 1 && Array.isArray(data.config) && data.timestamp) {
		return "intermediate";
	}

	// Final format (current version with general object)
	if (data.version === 1 && data.general && typeof data.general === "object") {
		return "final";
	}

	return "unknown";
}

/**
 * Converts legacy format to final format
 * @param {Object} legacyData - Legacy save data
 * @returns {Object} Final format save data
 */
function convertLegacyToFinal(legacyData) {
	return {
		version: 1,
		general: {
			engineerLevel: legacyData.engineerLevel,
			scarabLevel: legacyData.scarabLevel,
			riftRank: legacyData.riftRank,
		},
		machines: legacyData.machines,
		heroes: legacyData.heroes,
		artifacts: legacyData.artifacts,
	};
}

/**
 * Converts intermediate format to final format
 * @param {Object} intermediateData - Intermediate save data
 * @returns {Object} Final format save data
 */
function convertIntermediateToFinal(intermediateData) {
	// Extract config array into general object
	const configMap = new Map(intermediateData.config.map((c) => [c.key, c.value]));

	// Convert artifacts array back to object structure
	const artifacts = {};
	for (let i = 0; i < intermediateData.artifacts.length; i++) {
		const artifact = intermediateData.artifacts[i];
		artifacts[artifact.stat] = artifact.values;
	}

	return {
		version: 1,
		general: {
			engineerLevel: configMap.get("engineerLevel") || 0,
			scarabLevel: configMap.get("scarabLevel") || 0,
			riftRank: configMap.get("riftRank") || "bronze",
		},
		machines: intermediateData.machines,
		heroes: intermediateData.heroes,
		artifacts,
	};
}

/**
 * Validates loaded save data structure
 * @param {Object} data - Data to validate
 * @param {string} format - Format type
 * @returns {string[]} Array of error messages
 */
function validateSaveData(data, format) {
	const errors = [];

	// Format-specific validation
	if (format === "final") {
		if (!data.general || typeof data.general !== "object") {
			errors.push("Invalid general settings");
		} else {
			if (typeof data.general.engineerLevel !== "number") {
				errors.push("Invalid engineerLevel");
			}
			if (typeof data.general.scarabLevel !== "number") {
				errors.push("Invalid scarabLevel");
			}
			if (typeof data.general.riftRank !== "string") {
				errors.push("Invalid riftRank");
			}
		}

		if (!data.artifacts || typeof data.artifacts !== "object" || Array.isArray(data.artifacts)) {
			errors.push("Invalid artifacts structure (should be object, not array)");
		}
	} else if (format === "intermediate") {
		if (!Array.isArray(data.config)) {
			errors.push("Invalid config array");
		}

		if (!Array.isArray(data.artifacts)) {
			errors.push("Invalid artifacts array");
		}
	} else if (format === "legacy") {
		if (typeof data.engineerLevel !== "number") {
			errors.push("Invalid engineerLevel");
		}
		if (typeof data.scarabLevel !== "number") {
			errors.push("Invalid scarabLevel");
		}
		if (typeof data.riftRank !== "string") {
			errors.push("Invalid riftRank");
		}
	}

	// Common validation (all formats)
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
 * Applies loaded data to store (final format)
 * @param {import('./app.js').Store} store - Application store
 * @param {Object} data - Save data (final format)
 */
function applyLoadedDataToStore(store, data) {
	// Apply general settings
	store.engineerLevel = data.general.engineerLevel;
	store.scarabLevel = data.general.scarabLevel;
	store.riftRank = data.general.riftRank;

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
	const stats = Object.keys(data.artifacts);
	for (let i = 0; i < stats.length; i++) {
		const stat = stats[i];
		const percentages = Object.keys(data.artifacts[stat]);

		for (let j = 0; j < percentages.length; j++) {
			const pct = percentages[j];
			const numKey = Number(pct);
			if (!isNaN(numKey)) {
				store.artifacts[stat][numKey] = data.artifacts[stat][pct];
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
	 * Loads JSON data into the store
	 * Supports legacy, intermediate, and final save formats
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

			// Detect format
			const format = detectSaveFormat(data);

			if (format === "unknown") {
				showToast("Unknown save format. Cannot load this data.", "danger");
				return;
			}

			// Validate before conversion
			const preValidationErrors = validateSaveData(data, format);
			if (preValidationErrors.length > 0) {
				console.error("Invalid save data:", preValidationErrors);
				showToast(`Invalid save data: ${preValidationErrors[0]}`, "danger");
				return;
			}

			// Convert to final format if needed
			let convertedData = data;
			let conversionMessage = "";

			if (format === "legacy") {
				console.log("Converting legacy format to final format");
				convertedData = convertLegacyToFinal(data);
				conversionMessage = " (converted from legacy format)";
			} else if (format === "intermediate") {
				console.log("Converting intermediate format to final format");
				convertedData = convertIntermediateToFinal(data);
				conversionMessage = " (converted from intermediate format)";
			}

			// Import to database
			await db.importData(JSON.stringify(convertedData));

			// Apply to store
			applyLoadedDataToStore(store, convertedData);

			// Update UI
			updateUIAfterLoad(store);

			showToast(`Data loaded successfully${conversionMessage}!`, "success");
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
