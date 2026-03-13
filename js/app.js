// app.js
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
import { autoSave, autoLoad, resetAll } from "./storage.js";
import { showToast } from "./ui/notifications.js";
import { AppConfig } from "./config.js";
import { db } from "./db.js";
import Decimal from "./vendor/break_eternity.esm.js";
import { initializeProfiles, renderProfileManagement } from "./profiles.js";
import { SettingsManager } from "./ui/settings.js";
import { initPWA } from "./pwa.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/**
 * @typedef {Object} MachineBlueprints
 * @property {number} damage
 * @property {number} health
 * @property {number} armor
 */

/**
 * @typedef {Object} StatBlock
 * @property {number|Decimal} damage
 * @property {number|Decimal} health
 * @property {number|Decimal} armor
 * @property {number|Decimal} maxHealth
 */

/**
 * @typedef {Object} Machine
 * @property {number}            id
 * @property {string}            name
 * @property {string}            image
 * @property {string}            role             - "tank" or "dps"
 * @property {string[]}          tags
 * @property {Object}            ability          - Resolved ability object from abilitiesData
 * @property {string}            rarity
 * @property {number}            level
 * @property {MachineBlueprints} blueprints
 * @property {number}            inscriptionLevel
 * @property {number}            sacredLevel
 * @property {StatBlock}         battleStats      - Cached campaign stats; recomputed by optimizer
 * @property {StatBlock}         arenaStats       - Cached arena stats; recomputed by optimizer
 * @property {Object[]}          crew             - Assigned heroes; populated by optimizer
 */

/**
 * @typedef {Object} HeroPercentages
 * @property {number} damage
 * @property {number} health
 * @property {number} armor
 */

/**
 * @typedef {Object} Hero
 * @property {number}          id
 * @property {string}          name
 * @property {string}          image
 * @property {HeroPercentages} percentages
 */

/**
 * @typedef {Object} AppStore
 * @property {Machine[]} machines
 * @property {Hero[]}    heroes
 * @property {Object}    artifacts     - { [stat: string]: { [pct: number]: number } }
 * @property {number}    engineerLevel
 * @property {number}    scarabLevel
 * @property {string}    riftRank
 * @property {string}    optimizeMode  - "campaign" | "arena"
 */

// ─────────────────────────────────────────────
// Store factory
// ─────────────────────────────────────────────

/**
 * Returns a fresh store with all values at their defaults.
 * Called on startup to seed the live store, and passed as a factory to
 * storage.resetAll() and profiles._resetStoreUI() whenever a full reset
 * is needed.
 *
 * Abilities are resolved eagerly here so the rest of the app never needs to
 * look them up by key. battleStats/arenaStats/crew are zeroed placeholders;
 * the optimizer populates them on each run.
 *
 * @returns {AppStore}
 */
export function createInitialStore() {
	const d = AppConfig.DEFAULTS;

	return {
		machines: machinesData.map((machine) => ({
			...machine,
			ability: abilitiesData[machine.ability.key],
			rarity: d.RARITY,
			level: d.LEVEL,
			blueprints: {
				damage: d.BLUEPRINT_LEVEL,
				health: d.BLUEPRINT_LEVEL,
				armor: d.BLUEPRINT_LEVEL,
			},
			inscriptionLevel: d.CARD_LEVEL,
			sacredLevel: d.CARD_LEVEL,
			battleStats: { damage: 0, health: 0, armor: 0, maxHealth: 0 },
			arenaStats: { damage: 0, health: 0, armor: 0, maxHealth: 0 },
			crew: [],
		})),
		heroes: heroesData.map((hero) => ({
			...hero,
			percentages: {
				damage: d.HERO_PERCENTAGE,
				health: d.HERO_PERCENTAGE,
				armor: d.HERO_PERCENTAGE,
			},
		})),
		artifacts: {
			damage: Object.fromEntries(AppConfig.ARTIFACT_PERCENTAGES.map((p) => [p, 0])),
			health: Object.fromEntries(AppConfig.ARTIFACT_PERCENTAGES.map((p) => [p, 0])),
			armor: Object.fromEntries(AppConfig.ARTIFACT_PERCENTAGES.map((p) => [p, 0])),
		},
		engineerLevel: d.ENGINEER_LEVEL,
		scarabLevel: d.SCARAB_LEVEL,
		riftRank: d.RIFT_RANK,
		optimizeMode: d.OPTIMIZE_MODE,
	};
}

// ─────────────────────────────────────────────
// Live store (module singleton)
// ─────────────────────────────────────────────

/**
 * The single live application store.
 * Exported so ui/machines.js and ui/heroes.js can read and mutate it directly.
 * The object reference is intentionally stable for the lifetime of the page.
 * @type {AppStore}
 */
export const store = createInitialStore();

// ─────────────────────────────────────────────
// Auto-save (debounced)
// ─────────────────────────────────────────────

/** @type {ReturnType<typeof setTimeout>|null} */
let _autoSaveTimer = null;

/**
 * Schedules an auto-save 500 ms after the last call.
 * Exported for use by ui/machines.js and ui/heroes.js after each user input.
 * The debounce prevents a DB write on every keystroke.
 * @param {AppStore} appStore
 */
export function triggerAutoSave(appStore) {
	clearTimeout(_autoSaveTimer);
	_autoSaveTimer = setTimeout(() => autoSave(appStore), 500);
}

// ─────────────────────────────────────────────
// Decimal re-hydration (worker boundary)
// ─────────────────────────────────────────────

/**
 * Returns true if `val` is a plain Decimal DTO — an object with a `mag` field
 * rather than a live Decimal instance. structuredClone (used by postMessage)
 * strips prototypes, so results from the worker arrive as DTOs.
 * @param {*} val
 * @returns {boolean}
 */
function _isDto(val) {
	return val && typeof val === "object" && "mag" in val && !(val instanceof Decimal);
}

/**
 * Reconstructs a live Decimal from a plain DTO, or returns Decimal(0) for
 * missing/null values.
 * @param {Object|Decimal|null|undefined} d
 * @returns {Decimal}
 */
function _dtoToDecimal(d) {
	if (!d || typeof d !== "object") return new Decimal(0);
	if (d instanceof Decimal) return d;
	return Decimal.fromComponents(d.sign, d.layer, d.mag);
}

/**
 * Re-hydrates all Decimal DTOs in a single stat block.
 * @param {Object|null} stats
 * @returns {StatBlock|null}
 */
function _reconstructStatBlock(stats) {
	if (!stats) return stats;
	return {
		damage: _dtoToDecimal(stats.damage),
		health: _dtoToDecimal(stats.health),
		armor: _dtoToDecimal(stats.armor),
		maxHealth: _dtoToDecimal(stats.maxHealth ?? stats.health),
	};
}

/**
 * Walks an optimizer result and re-hydrates every Decimal DTO back into a live
 * Decimal instance. Must be called before passing the result to renderResults(),
 * which expects live Decimals for formatting.
 * @param {Object} result - Raw result from the optimizer worker
 * @returns {Object} The same object, mutated in-place
 */
function _reconstructDecimals(result) {
	if (_isDto(result.battlePower)) result.battlePower = _dtoToDecimal(result.battlePower);
	if (_isDto(result.arenaPower)) result.arenaPower = _dtoToDecimal(result.arenaPower);

	if (Array.isArray(result.formation)) {
		result.formation = result.formation.map((machine) => ({
			...machine,
			battleStats: _reconstructStatBlock(machine.battleStats),
			arenaStats: _reconstructStatBlock(machine.arenaStats),
		}));
	}

	return result;
}

// ─────────────────────────────────────────────
// Optimization helpers
// ─────────────────────────────────────────────

/**
 * Resolves each machine's ability key to the full ability object so the worker
 * never needs to import abilitiesData.
 * @param {Machine[]} machines
 * @returns {Object[]}
 */
function _resolveAbilities(machines) {
	return machines.map((m) => ({
		...m,
		resolvedAbility: abilitiesData[m.ability?.key] ?? null,
	}));
}

/**
 * Returns all machines the user has configured (any non-default value).
 * Used to decide whether optimization can proceed and to compute global
 * rarity levels for the worker payload.
 * @returns {Machine[]}
 */
function _getOwnedMachines() {
	return store.machines.filter(({ rarity, level, blueprints, inscriptionLevel, sacredLevel }) => {
		const hasBlueprints = Object.values(blueprints).some((v) => v > 0);
		const hasCards = inscriptionLevel > 0 || sacredLevel > 0;
		return hasBlueprints || hasCards || level > 0 || rarity.toLowerCase() !== "common";
	});
}

/**
 * Returns all heroes with at least one non-zero percentage.
 * @returns {Hero[]}
 */
function _getOwnedHeroes() {
	return store.heroes.filter((hero) => Object.values(hero.percentages).some((v) => v > 0));
}

/**
 * Converts the artifact store to the array format expected by the optimizer
 * and upgrade analyzer.
 * @returns {Array<{stat: string, values: Object}>}
 */
function _getArtifactArray() {
	return Object.keys(store.artifacts).map((stat) => ({
		stat,
		values: store.artifacts[stat],
	}));
}

/**
 * Checks that the user has configured at least one machine and one hero.
 * @returns {{valid: boolean, message: string}}
 */
function _validateOptimizationInputs() {
	if (_getOwnedMachines().length === 0) {
		return {
			valid: false,
			message: "Please configure at least one machine before optimizing. Set its level, rarity, or blueprints in the Machines tab.",
		};
	}

	if (_getOwnedHeroes().length === 0) {
		return {
			valid: false,
			message: "Please configure at least one hero before optimizing. Set percentage bonuses in the Heroes tab.",
		};
	}

	return { valid: true, message: "" };
}

/**
 * Assembles the payload object for the optimizer worker.
 * Extracted from the click handler so the shape is visible at a glance.
 * @returns {Object}
 */
function _buildWorkerPayload() {
	const ownedMachines = _getOwnedMachines();
	const globalRarityLevels = Calculator.getGlobalRarityLevels(ownedMachines);

	return {
		mode: store.optimizeMode,
		ownedMachines: _resolveAbilities(store.machines),
		ownedHeroes: _getOwnedHeroes(),
		maxMission: 90,
		globalRarityLevels,
		engineerLevel: store.engineerLevel,
		scarabLevel: store.scarabLevel,
		artifactArray: _getArtifactArray(),
		riftRank: store.riftRank,
		heroScoring: {
			campaign: {
				tank: { ...AppConfig.HERO_SCORING.CAMPAIGN.TANK },
				dps: { ...AppConfig.HERO_SCORING.CAMPAIGN.DPS },
			},
			arena: {
				tank: { ...AppConfig.HERO_SCORING.ARENA.TANK },
				dps: { ...AppConfig.HERO_SCORING.ARENA.DPS },
			},
		},
	};
}

// ─────────────────────────────────────────────
// Optimization — worker lifecycle
// ─────────────────────────────────────────────

/** @type {Worker|null} Active optimizer worker, or null when idle. */
let _currentWorker = null;

/**
 * Removes event listeners and terminates a worker instance.
 * @param {Worker} worker
 */
function _disposeWorker(worker) {
	if (!worker) return;
	worker.onmessage = null;
	worker.onerror = null;
	worker.terminate();
}

/**
 * Updates the optimize button and body cursor to reflect loading state.
 * @param {boolean} isLoading
 */
function _setLoading(isLoading) {
	const btn = document.getElementById("optimizeBtn");
	if (!btn) return;

	document.body.style.cursor = isLoading ? "wait" : "default";
	btn.disabled = isLoading;

	if (isLoading) {
		btn.textContent = "Optimizing...";
	} else {
		_updateOptimizeButtonText();
	}
}

/**
 * Syncs the optimize button label to the current mode.
 */
function _updateOptimizeButtonText() {
	const btn = document.getElementById("optimizeBtn");
	if (btn) btn.textContent = store.optimizeMode === "arena" ? "Optimize for Arena" : "Optimize for Campaign";
}

/**
 * Navigates to the results tab using Bootstrap's Tab API.
 */
function _switchToResultsTab() {
	const link = document.querySelector('a[href="#resultsTab"]');
	if (link) {
		// eslint-disable-next-line no-undef
		new bootstrap.Tab(link).show();
	}
}

/**
 * Validates inputs, spawns a worker, and orchestrates the optimization run.
 * Cancels any in-progress run before starting a new one.
 */
function _runOptimization() {
	const validation = _validateOptimizationInputs();
	if (!validation.valid) {
		showToast(validation.message, "warning");
		return;
	}

	if (_currentWorker) {
		_disposeWorker(_currentWorker);
		_currentWorker = null;
		showToast("Previous optimization cancelled", "info");
	}

	_setLoading(true);

	const worker = new Worker("./js/optimizerWorker.js", { type: "module" });
	_currentWorker = worker;

	worker.postMessage(_buildWorkerPayload());

	worker.onmessage = async (e) => {
		const workerRef = _currentWorker;
		_currentWorker = null;

		const rawResult = e.data;

		if (rawResult.error) {
			console.error(new Error("Optimization failed", { cause: rawResult.error }));
			showToast("Optimization failed. Please try again.", "danger");
			_setLoading(false);
			_disposeWorker(workerRef);
			return;
		}

		try {
			await db.saveResult(store.optimizeMode, rawResult);
		} catch (err) {
			console.warn("Failed to cache result:", err);
		}

		const upgradeConfig = {
			engineerLevel: store.engineerLevel,
			scarabLevel: store.scarabLevel,
			artifactArray: _getArtifactArray(),
			globalRarityLevels: Calculator.getGlobalRarityLevels(_getOwnedMachines()),
			riftRank: store.riftRank,
		};

		const result = _reconstructDecimals(rawResult);

		renderResults(result, store.optimizeMode, upgradeConfig);
		_switchToResultsTab();
		_setLoading(false);
		_disposeWorker(workerRef);
	};

	worker.onerror = (err) => {
		const workerRef = _currentWorker;
		_currentWorker = null;

		console.error(new Error("Worker error", { cause: err }));
		showToast("Optimization failed. Please try again.", "danger");
		_setLoading(false);
		_disposeWorker(workerRef);
	};
}

// ─────────────────────────────────────────────
// UI setup
// ─────────────────────────────────────────────

/**
 * Populates the Rift Rank `<select>` from AppConfig and selects the current value.
 */
function _populateRiftRankSelect() {
	const select = document.getElementById("riftRank");
	if (!select) return;

	select.replaceChildren();

	for (const rank of AppConfig.RIFT_RANKS) {
		const option = document.createElement("option");
		option.value = rank.key;
		option.textContent = rank.label;
		option.selected = rank.key === store.riftRank;
		select.appendChild(option);
	}
}

/**
 * Wires all DOM event listeners for the application.
 * Called once after initial render so that every element already exists in the DOM.
 */
function _setupEventListeners() {
	// ── General settings ────────────────────────

	const engineerInput = document.getElementById("engineerLevel");
	if (engineerInput) {
		engineerInput.value = store.engineerLevel;
		engineerInput.addEventListener("input", (e) => {
			store.engineerLevel = parseInt(e.target.value, 10) || 0;
			triggerAutoSave(store);
		});
	}

	const scarabInput = document.getElementById("scarabLevel");
	if (scarabInput) {
		scarabInput.value = store.scarabLevel;
		scarabInput.addEventListener("input", (e) => {
			store.scarabLevel = parseInt(e.target.value, 10) || 0;
			triggerAutoSave(store);
		});
	}

	const riftInput = document.getElementById("riftRank");
	if (riftInput) {
		riftInput.addEventListener("change", (e) => {
			store.riftRank = e.target.value;
			triggerAutoSave(store);
		});
	}

	// ── Optimize mode ────────────────────────────

	const campaignRadio = document.getElementById("campaignMode");
	const arenaRadio = document.getElementById("arenaMode");

	if (campaignRadio && arenaRadio) {
		campaignRadio.addEventListener("change", (e) => {
			if (e.target.checked) {
				store.optimizeMode = "campaign";
				_updateOptimizeButtonText();
			}
		});
		arenaRadio.addEventListener("change", (e) => {
			if (e.target.checked) {
				store.optimizeMode = "arena";
				_updateOptimizeButtonText();
			}
		});
	}

	// ── Tavern sub-tab ───────────────────────────

	const tavernRadio = document.getElementById("tavernSubTab");
	const scarabRadio = document.getElementById("scarabSubTab");
	const tavernContainer = document.getElementById("tavernCardsContainer");
	const scarabContainer = document.getElementById("scarabCardsContainer");

	if (tavernRadio && scarabRadio) {
		tavernRadio.addEventListener("change", (e) => {
			if (e.target.checked) {
				tavernContainer.classList.remove("d-none");
				scarabContainer.classList.add("d-none");
			}
		});
		scarabRadio.addEventListener("change", (e) => {
			if (e.target.checked) {
				tavernContainer.classList.add("d-none");
				scarabContainer.classList.remove("d-none");
			}
		});
	}

	// ── Optimize button ──────────────────────────

	const optimizeBtn = document.getElementById("optimizeBtn");
	if (optimizeBtn) optimizeBtn.addEventListener("click", _runOptimization);

	// ── Save / Load modal focus management ───────
	// Restores focus to the triggering element after the modal closes,
	// and clears the textarea on hide to avoid stale data on reopen.

	const saveLoadModal = document.getElementById("saveLoadModal");
	if (saveLoadModal) {
		let _modalTrigger = null;

		saveLoadModal.addEventListener("show.bs.modal", (e) => {
			_modalTrigger = e.relatedTarget || document.activeElement;
		});

		saveLoadModal.addEventListener("hide.bs.modal", () => {
			const textarea = document.getElementById("saveLoadBox");
			if (textarea) textarea.value = "";
			if (saveLoadModal.contains(document.activeElement)) document.activeElement.blur();
		});

		saveLoadModal.addEventListener("hidden.bs.modal", () => {
			if (_modalTrigger && _modalTrigger !== document.body && document.contains(_modalTrigger)) {
				_modalTrigger.focus();
			}
			_modalTrigger = null;
		});

		saveLoadModal.addEventListener("shown.bs.modal", () => {
			document.getElementById("saveLoadBox")?.focus();
		});
	}

	// ── Profile management modal ─────────────────

	const manageProfilesModal = document.getElementById("manageProfilesModal");
	if (manageProfilesModal) {
		manageProfilesModal.addEventListener("shown.bs.modal", async () => {
			await renderProfileManagement(store);
		});
	}

	// ── Save / Load buttons ──────────────────────

	const saveBtn = document.getElementById("saveBtn");
	if (saveBtn) saveBtn.addEventListener("click", () => SaveLoad.save(store));

	const loadBtn = document.getElementById("loadBtn");
	if (loadBtn) {
		loadBtn.addEventListener("click", async () => {
			await SaveLoad.load(store);
			triggerAutoSave(store);
		});
	}

	// ── Reset artifacts ──────────────────────────

	const resetArtifactsBtn = document.getElementById("resetArtifacts");
	if (resetArtifactsBtn) {
		resetArtifactsBtn.addEventListener("click", () => {
			if (confirm("Reset all artifact values to 0?")) {
				resetAllArtifacts(store.artifacts);
				renderArtifacts(store.artifacts);
				triggerAutoSave(store);
			}
		});
	}

	// ── Reset all ────────────────────────────────

	const resetAllBtn = document.getElementById("resetAllBtn");
	if (resetAllBtn) {
		resetAllBtn.addEventListener("click", () => {
			if (confirm("Reset ALL data in this profile to default values? This cannot be undone.")) {
				resetAll(store, createInitialStore);
			}
		});
	}

	// ── Settings modal ───────────────────────────

	const settingsModal = document.getElementById("settingsModal");
	if (settingsModal) {
		settingsModal.addEventListener("show.bs.modal", () => {
			SettingsManager.renderModal();
		});
	}

	const saveSettingsBtn = document.getElementById("saveSettingsBtn");
	if (saveSettingsBtn) {
		saveSettingsBtn.addEventListener("click", () => {
			SettingsManager.saveFromModal();
			// eslint-disable-next-line no-undef
			const modal = bootstrap.Modal.getInstance(document.getElementById("settingsModal"));
			if (modal) modal.hide();
		});
	}

	const resetSettingsBtn = document.getElementById("resetSettingsBtn");
	if (resetSettingsBtn) {
		resetSettingsBtn.addEventListener("click", () => {
			SettingsManager.resetModalToDefaults();
		});
	}

	// ── Bulk edit ────────────────────────────────

	const bulkEditMachinesBtn = document.getElementById("bulkEditMachinesBtn");
	if (bulkEditMachinesBtn) {
		bulkEditMachinesBtn.addEventListener("click", async () => {
			const { switchToBulkEditMachines } = await import("./ui/machines.js");
			switchToBulkEditMachines(store.machines);
		});
	}

	const bulkEditHeroesBtn = document.getElementById("bulkEditHeroesBtn");
	if (bulkEditHeroesBtn) {
		bulkEditHeroesBtn.addEventListener("click", async () => {
			const { switchToBulkEditHeroes } = await import("./ui/heroes.js");
			switchToBulkEditHeroes(store.heroes);
		});
	}
}

// ─────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────

/**
 * Application entry point.
 *
 * Order of operations:
 *   1. Open IndexedDB
 *   2. Apply persisted settings (hero scoring weights)
 *   3. Populate static dropdowns
 *   4. Bootstrap profiles (creates a default profile if none exist)
 *   5. Verify an active profile exists
 *   6. Load the active profile's saved state into the store
 *   7. Render all panels
 *   8. Wire event listeners
 */
async function init() {
	try {
		await db.open();

		SettingsManager.initialize();
		_populateRiftRankSelect();

		await initializeProfiles(store);

		const activeProfile = await db.getActiveProfile();
		if (!activeProfile) throw new Error("No active profile after initialization");

		const loaded = await autoLoad(store);
		if (loaded) showToast("Previous session restored", "info");

		renderMachines(store.machines);
		renderHeroes(store.heroes);
		renderArtifacts(store.artifacts);
		renderTavernCards(store.machines);

		_setupEventListeners();
		_updateOptimizeButtonText();

		await initPWA();
	} catch (error) {
		console.error("Init failed:", error);
		showToast("Initialization failed. Please refresh.", "danger");
	}
}

// ─────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────

// ES modules defer by default, but this guard preserves correct behaviour in
// environments where the script may be injected before DOMContentLoaded fires.
if (document.readyState === "loading") {
	await new Promise((resolve) => {
		document.addEventListener("DOMContentLoaded", resolve, { once: true });
	});
}

await init();
