// saveload.js
import { db } from "./db.js";
import { AppConfig } from "./config.js";
import { showToast } from "./ui/notifications.js";
import { applyStateToStore, updateUIInputs, renderAllPanels } from "./storage.js";

// ─────────────────────────────────────────────
// Format detection
// ─────────────────────────────────────────────

/**
 * @typedef {"legacy"|"intermediate"|"final"|"unknown"} SaveFormat
 */

/**
 * Detects which save format a parsed data object belongs to.
 * Uses duck-typing on distinctive fields.
 * @param {Object} data
 * @returns {SaveFormat}
 */
function detectSaveFormat(data) {
	if (typeof data.engineerLevel === "number" && !data.version && data.artifacts && !Array.isArray(data.artifacts)) {
		return "legacy";
	}
	if (data.version === 1 && Array.isArray(data.config) && data.timestamp) {
		return "intermediate";
	}
	if (data.version === 1 && data.general && typeof data.general === "object") {
		return "final";
	}
	return "unknown";
}

// ─────────────────────────────────────────────
// Format converters
// ─────────────────────────────────────────────

/**
 * Converts legacy format (original localStorage layout) to the final format.
 * @param {Object} data
 * @returns {Object}
 */
function convertLegacyToFinal(data) {
	return {
		version: 2,
		appVersion: AppConfig.APP_VERSION,
		general: {
			engineerLevel: data.engineerLevel,
			scarabLevel: data.scarabLevel,
			riftRank: data.riftRank,
		},
		machines: data.machines,
		heroes: data.heroes,
		artifacts: data.artifacts,
	};
}

/**
 * Converts intermediate format (first Dexie version with config array) to the final format.
 * @param {Object} data
 * @returns {Object}
 */
function convertIntermediateToFinal(data) {
	const configMap = new Map(data.config.map((c) => [c.key, c.value]));

	const artifacts = {};
	for (const artifact of data.artifacts) {
		artifacts[artifact.stat] = artifact.values;
	}

	return {
		version: 1,
		appVersion: AppConfig.APP_VERSION,
		general: {
			engineerLevel: configMap.get("engineerLevel") ?? AppConfig.DEFAULTS.ENGINEER_LEVEL,
			scarabLevel: configMap.get("scarabLevel") ?? AppConfig.DEFAULTS.SCARAB_LEVEL,
			riftRank: configMap.get("riftRank") ?? AppConfig.DEFAULTS.RIFT_RANK,
		},
		machines: data.machines,
		heroes: data.heroes,
		artifacts,
	};
}

/**
 * Fills any missing artifact stats or percentages with zero-defaults.
 * Ensures forward compatibility when new artifact types are added.
 * @param {Object} data
 * @returns {Object}
 */
function fillMissingDefaults(data) {
	const artifacts = { ...data.artifacts };

	for (const stat of AppConfig.ARTIFACT_STATS) {
		if (!artifacts[stat]) {
			artifacts[stat] = Object.fromEntries(AppConfig.ARTIFACT_PERCENTAGES.map((p) => [p, 0]));
		} else {
			for (const pct of AppConfig.ARTIFACT_PERCENTAGES) {
				if (artifacts[stat][pct] === undefined) artifacts[stat][pct] = 0;
			}
		}
	}

	return { ...data, artifacts };
}

/**
 * Normalizes data from any supported format into the final format with defaults filled.
 * Returns null (and shows an error toast) if the format is unknown or invalid.
 * @param {Object} raw
 * @returns {{ data: Object, wasConverted: boolean, needsUpdate: boolean } | null}
 */
function normalizeData(raw) {
	const format = detectSaveFormat(raw);

	if (format === "unknown") {
		showToast("Unknown save format. Cannot load this data.", "danger");
		return null;
	}

	const preErrors = validateSaveData(raw, format);
	if (preErrors.length > 0) {
		console.error("Invalid save data:", preErrors);
		showToast(`Invalid save data: ${preErrors[0]}`, "danger");
		return null;
	}

	let data = raw;
	let wasConverted = false;
	let needsUpdate = false;

	if (format === "legacy") {
		data = convertLegacyToFinal(raw);
		wasConverted = true;
		needsUpdate = true;
	} else if (format === "intermediate") {
		data = convertIntermediateToFinal(raw);
		wasConverted = true;
		needsUpdate = true;
	}

	if (data.appVersion && data.appVersion !== AppConfig.APP_VERSION) {
		needsUpdate = true;
	}

	return { data: fillMissingDefaults(data), wasConverted, needsUpdate };
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

/**
 * Validates the top-level structure of save data.
 * Returns an array of human-readable error strings (empty = valid).
 * @param {Object}     data
 * @param {SaveFormat} format
 * @returns {string[]}
 */
function validateSaveData(data, format) {
	const errors = [];

	if (format === "final") {
		if (!data.general || typeof data.general !== "object") {
			errors.push("Invalid general settings");
		} else {
			if (typeof data.general.engineerLevel !== "number") errors.push("Invalid engineerLevel");
			if (typeof data.general.scarabLevel !== "number") errors.push("Invalid scarabLevel");
			if (typeof data.general.riftRank !== "string") errors.push("Invalid riftRank");
		}
		if (!data.artifacts || typeof data.artifacts !== "object" || Array.isArray(data.artifacts)) {
			errors.push("Invalid artifacts structure");
		}
	} else if (format === "intermediate") {
		if (!Array.isArray(data.config)) errors.push("Invalid config array");
		if (!Array.isArray(data.artifacts)) errors.push("Invalid artifacts array");
	} else if (format === "legacy") {
		if (typeof data.engineerLevel !== "number") errors.push("Invalid engineerLevel");
		if (typeof data.scarabLevel !== "number") errors.push("Invalid scarabLevel");
		if (typeof data.riftRank !== "string") errors.push("Invalid riftRank");
	}

	if (!Array.isArray(data.machines)) {
		errors.push("machines must be an array");
	} else {
		for (let i = 0; i < data.machines.length; i++) {
			const m = data.machines[i];
			if (m.id == null) errors.push(`Machine ${i} missing id`);
			if (typeof m.rarity !== "string") errors.push(`Machine ${i} missing valid rarity`);
			if (typeof m.level !== "number") errors.push(`Machine ${i} missing valid level`);
			if (!m.blueprints || typeof m.blueprints !== "object") errors.push(`Machine ${i} missing blueprints`);
		}
	}

	if (!Array.isArray(data.heroes)) {
		errors.push("heroes must be an array");
	} else {
		for (let i = 0; i < data.heroes.length; i++) {
			const h = data.heroes[i];
			if (h.id == null) errors.push(`Hero ${i} missing id`);
			if (!h.percentages || typeof h.percentages !== "object") errors.push(`Hero ${i} missing percentages`);
		}
	}

	return errors;
}

// ─────────────────────────────────────────────
// Public SaveLoad object
// ─────────────────────────────────────────────

export const SaveLoad = {
	/**
	 * Exports the current profile to JSON and places it in the save/load textarea.
	 * Reads directly from IndexedDB — no store parameter needed.
	 */
	async save() {
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
	 * Loads JSON from the textarea, normalizes it to the final format,
	 * imports it to IndexedDB, applies it to the store, and refreshes the UI.
	 *
	 * Supports legacy, intermediate, and final save formats.
	 * @param {Object} store
	 */
	async load(store) {
		const textarea = document.getElementById("saveLoadBox");
		const content = textarea.value.trim();

		if (!content) {
			showToast("Please paste save data into the text box first.", "warning");
			return;
		}

		try {
			const raw = JSON.parse(content);
			const normalized = normalizeData(raw);
			if (!normalized) return; // error already shown by normalizeData

			const { data, wasConverted, needsUpdate } = normalized;

			// Report new machines/heroes that weren't in the save
			const savedMachineIds = new Set(data.machines.map((m) => m.id));
			const savedHeroIds = new Set(data.heroes.map((h) => h.id));
			const newMachineCount = store.machines.filter((m) => !savedMachineIds.has(m.id)).length;
			const newHeroCount = store.heroes.filter((h) => !savedHeroIds.has(h.id)).length;

			await db.importData(JSON.stringify(data));

			// Convert final-format "general" wrapper to the flat shape applyStateToStore expects
			applyStateToStore(store, {
				...data.general,
				machines: data.machines,
				heroes: data.heroes,
				artifacts: data.artifacts,
			});

			updateUIInputs(store);
			renderAllPanels(store);

			showToast(wasConverted ? "Data loaded and converted to current format!" : "Data loaded successfully!", "success");

			if (newMachineCount > 0 || newHeroCount > 0) {
				const parts = [];
				if (newMachineCount > 0) parts.push(`${newMachineCount} new machine${newMachineCount > 1 ? "s" : ""}`);
				if (newHeroCount > 0) parts.push(`${newHeroCount} new hero${newHeroCount > 1 ? "es" : ""}`);
				setTimeout(() => showToast(`Found ${parts.join(" and ")} — using default values`, "info"), 1500);
			} else if (needsUpdate) {
				setTimeout(() => showToast("Tip: Generate a new save to use the latest format.", "info"), 1500);
			}

			textarea.value = "";
		} catch (error) {
			if (error instanceof SyntaxError) {
				showToast("Invalid JSON format. Please check your save data.", "danger");
			} else {
				showToast(`Failed to load data: ${error.message}`, "danger");
			}
			console.error("Load failed:", error);
		}
	},
};
