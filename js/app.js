// js/app.js
import { renderMachines } from "./ui/machines.js";
import { renderHeroes } from "./ui/heroes.js";
import { renderArtifacts, resetAllArtifacts } from "./ui/artifacts.js";
import { renderTavernCards } from "./ui/tavern.js";
import { renderResults } from "./ui/results.js";
import { machinesData } from "./data/machines.js";
import { heroesData } from "./data/heroes.js";
import { abilitiesData } from "./data/abilities.js";
import { Calculator } from "./calculator.js";
import { SaveLoad } from "./saveload.js";
import { showToast } from "./ui/notifications.js";
import { AppConfig } from "./config.js";

/**
 * @typedef {Object} MachineBlueprints
 * @property {number} damage - Damage blueprint level
 * @property {number} health - Health blueprint level
 * @property {number} armor - Armor blueprint level
 */

/**
 * @typedef {Object} MachineStats
 * @property {number|import('./vendor/break_eternity.esm.js').default} damage
 * @property {number|import('./vendor/break_eternity.esm.js').default} health
 * @property {number|import('./vendor/break_eternity.esm.js').default} armor
 * @property {number|import('./vendor/break_eternity.esm.js').default} maxHealth
 */

/**
 * @typedef {Object} Machine
 * @property {number} id
 * @property {string} name
 * @property {string} role
 * @property {string[]} tags
 * @property {string} image
 * @property {Object} ability
 * @property {MachineStats} baseStats
 * @property {string} rarity
 * @property {number} level
 * @property {MachineBlueprints} blueprints
 * @property {number} inscriptionLevel
 * @property {number} sacredLevel
 * @property {MachineStats} battleStats
 * @property {MachineStats} arenaStats
 * @property {Hero[]} crew
 */

/**
 * @typedef {Object} HeroPercentages
 * @property {number} damage
 * @property {number} health
 * @property {number} armor
 */

/**
 * @typedef {Object} Hero
 * @property {number} id
 * @property {string} name
 * @property {string} role
 * @property {string} image
 * @property {HeroPercentages} percentages
 */

/**
 * @typedef {Object} ArtifactValues
 * @property {number} 30
 * @property {number} 35
 * @property {number} 40
 * @property {number} 45
 * @property {number} 50
 * @property {number} 55
 * @property {number} 60
 * @property {number} 65
 */

/**
 * @typedef {Object} Artifacts
 * @property {ArtifactValues} damage
 * @property {ArtifactValues} health
 * @property {ArtifactValues} armor
 */

/**
 * @typedef {Object} Store
 * @property {Machine[]} machines
 * @property {Hero[]} heroes
 * @property {Artifacts} artifacts
 * @property {number} engineerLevel
 * @property {number} scarabLevel
 * @property {string} riftRank
 * @property {string} optimizeMode
 */

// ---------------------------
// Data Store
// ---------------------------

/**
 * Creates the initial application store
 * @returns {Store}
 */
function createInitialStore() {
	return {
		machines: machinesData.map((machine) => ({
			...machine,
			ability: abilitiesData[machine.ability.key],
			rarity: AppConfig.DEFAULTS.RARITY,
			level: AppConfig.DEFAULTS.LEVEL,
			blueprints: {
				damage: AppConfig.DEFAULTS.BLUEPRINT_LEVEL,
				health: AppConfig.DEFAULTS.BLUEPRINT_LEVEL,
				armor: AppConfig.DEFAULTS.BLUEPRINT_LEVEL,
			},
			inscriptionLevel: AppConfig.DEFAULTS.CARD_LEVEL,
			sacredLevel: AppConfig.DEFAULTS.CARD_LEVEL,
			battleStats: {
				damage: 0,
				health: 0,
				armor: 0,
				maxHealth: 0,
			},
			arenaStats: {
				damage: 0,
				health: 0,
				armor: 0,
				maxHealth: 0,
			},
			crew: [],
		})),
		heroes: heroesData.map((hero) => ({
			...hero,
			percentages: {
				damage: AppConfig.DEFAULTS.HERO_PERCENTAGE,
				health: AppConfig.DEFAULTS.HERO_PERCENTAGE,
				armor: AppConfig.DEFAULTS.HERO_PERCENTAGE,
			},
		})),
		artifacts: {
			damage: Object.fromEntries(AppConfig.ARTIFACT_PERCENTAGES.map((p) => [p, 0])),
			health: Object.fromEntries(AppConfig.ARTIFACT_PERCENTAGES.map((p) => [p, 0])),
			armor: Object.fromEntries(AppConfig.ARTIFACT_PERCENTAGES.map((p) => [p, 0])),
		},
		engineerLevel: AppConfig.DEFAULTS.ENGINEER_LEVEL,
		scarabLevel: AppConfig.DEFAULTS.SCARAB_LEVEL,
		riftRank: AppConfig.DEFAULTS.RIFT_RANK,
		optimizeMode: AppConfig.DEFAULTS.OPTIMIZE_MODE,
	};
}

export const store = createInitialStore();

// ---------------------------
// UI
// ---------------------------

/**
 * Sets the loading state of the UI
 * @param {boolean} isLoading
 */
function setLoading(isLoading) {
	const body = document.body;
	const optimizeBtn = document.getElementById("optimizeBtn");

	if (isLoading) {
		body.style.cursor = "wait";
		optimizeBtn.disabled = true;
		optimizeBtn.textContent = "Optimizing...";
	} else {
		body.style.cursor = "default";
		optimizeBtn.disabled = false;
		updateOptimizeButtonText();
	}
}

/**
 * Updates the optimize button text based on current mode
 */
function updateOptimizeButtonText() {
	const optimizeBtn = document.getElementById("optimizeBtn");
	const mode = store.optimizeMode;

	if (mode === "arena") {
		optimizeBtn.textContent = "Optimize for Arena";
	} else {
		optimizeBtn.textContent = "Optimize for Campaign";
	}
}

/**
 * Switches to the results tab
 */
function switchToResultsTab() {
	const resultsTabLink = document.querySelector('a[href="#resultsTab"]');
	if (resultsTabLink) {
		// eslint-disable-next-line no-undef
		const tab = new bootstrap.Tab(resultsTabLink);
		tab.show();
	}
}

// ---------------------------
// Validation
// ---------------------------

/**
 * Validates that the user has configured at least some data before optimization
 * @returns {{valid: boolean, message: string}} Validation result
 */
function validateOptimizationInputs() {
	const ownedMachines = getOwnedMachines();
	const ownedHeroes = getOwnedHeroes();

	// Check if user has any machines configured
	if (ownedMachines.length === 0) {
		return {
			valid: false,
			message: "Please configure at least one machine before optimizing. Set its level, rarity, or blueprints in the Machines tab.",
		};
	}

	// Check if user has any heroes configured
	if (ownedHeroes.length === 0) {
		return {
			valid: false,
			message: "Please configure at least one hero before optimizing. Set percentage bonuses in the Heroes tab.",
		};
	}

	return { valid: true, message: "" };
}

// ---------------------------
// Optimize
// ---------------------------

/**
 * Gets all owned machines (non-default configuration)
 * @returns {Machine[]}
 */
function getOwnedMachines() {
	return store.machines.filter((machine) => {
		const { rarity, level, blueprints, inscriptionLevel, sacredLevel } = machine;
		const hasBlueprints = Object.values(blueprints).some((v) => v > 0);
		const hasCards = inscriptionLevel > 0 || sacredLevel > 0;
		const hasLevel = level > 0;
		const hasRarity = rarity.toLowerCase() !== "common";
		return hasBlueprints || hasCards || hasLevel || hasRarity;
	});
}

/**
 * Gets all owned heroes (non-zero percentages)
 * @returns {Hero[]}
 */
function getOwnedHeroes() {
	return store.heroes.filter((hero) => Object.values(hero.percentages).some((v) => v > 0));
}

/**
 * Converts artifact store to array format
 * @returns {Array<{stat: string, values: ArtifactValues}>}
 */
function getArtifactArray() {
	return Object.keys(store.artifacts).map((stat) => ({
		stat,
		values: store.artifacts[stat],
	}));
}

/**
 * Runs the optimization in a web worker
 */
function runOptimization() {
	// Validate inputs before starting
	const validation = validateOptimizationInputs();
	if (!validation.valid) {
		showToast(validation.message, "warning");
		return;
	}

	setLoading(true);

	const ownedMachines = getOwnedMachines();
	const ownedHeroes = getOwnedHeroes();
	const artifactArray = getArtifactArray();
	const globalRarityLevels = Calculator.getGlobalRarityLevels(ownedMachines);

	const worker = new Worker("js/optimizerWorker.js", { type: "module" });

	worker.postMessage({
		mode: store.optimizeMode,
		ownedMachines,
		ownedHeroes,
		maxMission: 90,
		globalRarityLevels,
		engineerLevel: store.engineerLevel,
		scarabLevel: store.scarabLevel,
		artifactArray,
		riftRank: store.riftRank,
	});

	worker.onmessage = function (e) {
		const result = e.data;

		if (result.error) {
			const error = new Error("Optimization failed", { cause: result.error });
			console.error(error);
			showToast("Optimization failed. Please try again.", "danger");
			setLoading(false);
			return;
		}

		renderResults(result, store.optimizeMode);
		switchToResultsTab();
		setLoading(false);
	};

	worker.onerror = function (err) {
		const error = new Error("Worker error occurred", { cause: err });
		console.error(error);
		showToast("Optimization failed. Please try again.", "danger");
		setLoading(false);
	};
}

// ---------------------------
// Event Listeners
// ---------------------------

/**
 * Sets up all event listeners for the application
 */
function setupEventListeners() {
	// Engineer level
	const engineerInput = document.getElementById("engineerLevel");
	if (engineerInput) {
		engineerInput.value = store.engineerLevel;
		engineerInput.addEventListener("input", (e) => {
			store.engineerLevel = parseInt(e.target.value) || 0;
		});
	}

	// Scarab level
	const scarabInput = document.getElementById("scarabLevel");
	if (scarabInput) {
		scarabInput.value = store.scarabLevel;
		scarabInput.addEventListener("input", (e) => {
			store.scarabLevel = parseInt(e.target.value) || 0;
		});
	}

	// Chaos Rift Rank
	const riftInput = document.getElementById("riftRank");
	if (riftInput) {
		riftInput.value = store.riftRank;
		riftInput.addEventListener("change", (e) => {
			store.riftRank = e.target.value;
		});
	}

	// Optimize mode toggle
	const campaignModeRadio = document.getElementById("campaignMode");
	const arenaModeRadio = document.getElementById("arenaMode");

	if (campaignModeRadio && arenaModeRadio) {
		campaignModeRadio.addEventListener("change", (e) => {
			if (e.target.checked) {
				store.optimizeMode = "campaign";
				updateOptimizeButtonText();
			}
		});

		arenaModeRadio.addEventListener("change", (e) => {
			if (e.target.checked) {
				store.optimizeMode = "arena";
				updateOptimizeButtonText();
			}
		});
	}

	// Tavern sub-tab toggle
	const tavernSubRadio = document.getElementById("tavernSubTab");
	const scarabSubRadio = document.getElementById("scarabSubTab");
	const tavernContainer = document.getElementById("tavernCardsContainer");
	const scarabContainer = document.getElementById("scarabCardsContainer");

	if (tavernSubRadio && scarabSubRadio) {
		tavernSubRadio.addEventListener("change", (e) => {
			if (e.target.checked) {
				tavernContainer.classList.remove("d-none");
				scarabContainer.classList.add("d-none");
			}
		});

		scarabSubRadio.addEventListener("change", (e) => {
			if (e.target.checked) {
				tavernContainer.classList.add("d-none");
				scarabContainer.classList.remove("d-none");
			}
		});
	}

	// Optimize button
	const optimizeBtn = document.getElementById("optimizeBtn");
	if (optimizeBtn) {
		optimizeBtn.addEventListener("click", runOptimization);
	}

	const saveLoadModal = document.getElementById("saveLoadModal");
	const saveLoadBtn = document.getElementById("saveLoadBtn");

	if (saveLoadModal && saveLoadBtn) {
		// BEFORE aria-hidden gets applied
		saveLoadModal.addEventListener("hide.bs.modal", () => {
			if (saveLoadModal.contains(document.activeElement)) {
				document.activeElement.blur();
			}
		});

		// AFTER modal is fully hidden
		saveLoadModal.addEventListener("hidden.bs.modal", () => {
			saveLoadBtn.focus();
		});

		saveLoadModal.addEventListener("shown.bs.modal", () => {
			// Focus first input when opened
			document.getElementById("saveLoadBox").focus();
		});
	}

	// Save/Load buttons
	const saveBtn = document.getElementById("saveBtn");
	const loadBtn = document.getElementById("loadBtn");

	if (saveBtn) {
		saveBtn.addEventListener("click", () => SaveLoad.save(store));
	}

	if (loadBtn) {
		loadBtn.addEventListener("click", () => SaveLoad.load(store));
	}

	const resetArtifactsBtn = document.getElementById("resetArtifacts");
	if (resetArtifactsBtn) {
		resetArtifactsBtn.addEventListener("click", () => {
			if (confirm("Reset all artifact values to 0?")) {
				resetAllArtifacts(store.artifacts);
				renderArtifacts(store.artifacts);
			}
		});
	}
}

function populateRiftRankSelect() {
	const riftSelect = document.getElementById("riftRank");
	if (!riftSelect) return;

	// Clear existing options
	riftSelect.replaceChildren();

	// Add options from config
	AppConfig.RIFT_RANKS.forEach((rank) => {
		const option = document.createElement("option");
		option.value = rank.key;
		option.textContent = rank.label;
		option.selected = rank.key === store.riftRank;
		riftSelect.appendChild(option);
	});
}

// ---------------------------
// Init
// ---------------------------
/**
 * Initializes the application
 */
function init() {
	populateRiftRankSelect();
	// Render initial UI
	renderMachines(store.machines);
	renderHeroes(store.heroes);
	renderArtifacts(store.artifacts);
	renderTavernCards(store.machines);

	// Setup event listeners
	setupEventListeners();

	// Set initial button text
	updateOptimizeButtonText();
}

if (document.readyState === "loading") {
	await new Promise((resolve) => {
		document.addEventListener("DOMContentLoaded", resolve, { once: true });
	});
}

init();
