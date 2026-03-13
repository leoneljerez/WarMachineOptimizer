// ui/settings.js
import { AppConfig } from "../config.js";
import { showToast } from "./notifications.js";

/**
 * Settings manager for app-level preferences.
 *
 * Stored in localStorage (not IndexedDB) because settings are global to the
 * app, not scoped to a profile. This is intentional and differs from all
 * other persistence which uses Dexie.
 */
export class SettingsManager {
	static STORAGE_KEY = "wmo_app_settings";

	/**
	 * @type {Object|null} Cached deep copy of factory defaults to avoid
	 * repeated JSON round-trips.
	 */
	static _factoryDefaults = null;

	// ─────────────────────────────────────────────
	// Default settings
	// ─────────────────────────────────────────────

	/**
	 * Returns the default settings derived from AppConfig.HERO_SCORING.
	 * Result is cached after the first call.
	 * @returns {Object}
	 */
	static getDefaultSettings() {
		if (!this._factoryDefaults) {
			// structuredClone produces a clean deep copy without JSON round-trip
			this._factoryDefaults = structuredClone(AppConfig.HERO_SCORING);
		}
		const d = this._factoryDefaults;
		return {
			heroScoring: {
				campaign: {
					tank: { ...d.CAMPAIGN.TANK },
					dps:  { ...d.CAMPAIGN.DPS  },
				},
				arena: {
					tank: { ...d.ARENA.TANK },
					dps:  { ...d.ARENA.DPS  },
				},
			},
		};
	}

	// ─────────────────────────────────────────────
	// Load / save
	// ─────────────────────────────────────────────

	/**
	 * Loads settings from localStorage, merging with defaults for any missing keys.
	 * @returns {Object}
	 */
	static loadSettings() {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY);
			if (!stored) return this.getDefaultSettings();

			const settings = JSON.parse(stored);
			const defaults = this.getDefaultSettings();

			return {
				...defaults,
				...settings,
				heroScoring: {
					...defaults.heroScoring,
					...settings.heroScoring,
				},
			};
		} catch (error) {
			console.error("Failed to load settings:", error);
			return this.getDefaultSettings();
		}
	}

	/**
	 * Persists settings to localStorage.
	 * @param {Object} settings
	 */
	static saveSettings(settings) {
		try {
			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
		} catch (error) {
			console.error("Failed to save settings:", error);
			showToast("Failed to save settings", "danger");
		}
	}

	// ─────────────────────────────────────────────
	// Apply to AppConfig
	// ─────────────────────────────────────────────

	/**
	 * Writes hero scoring weights from `settings` into AppConfig.HERO_SCORING.
	 * Mutates in place so the Optimizer always reads the latest user-defined values
	 * without requiring a page reload or re-import.
	 * @param {Object} settings
	 */
	static applySettings(settings) {
		if (!settings.heroScoring) return;

		const { campaign, arena } = settings.heroScoring;
		const hs = AppConfig.HERO_SCORING;

		Object.assign(hs.CAMPAIGN.TANK, campaign.tank);
		Object.assign(hs.CAMPAIGN.DPS,  campaign.dps);
		Object.assign(hs.ARENA.TANK,    arena.tank);
		Object.assign(hs.ARENA.DPS,     arena.dps);
	}

	// ─────────────────────────────────────────────
	// Reset
	// ─────────────────────────────────────────────

	/**
	 * Resets settings to factory defaults, persists them, and applies to AppConfig.
	 * @returns {Object} The new default settings
	 */
	static resetToDefaults() {
		const defaults = this.getDefaultSettings();
		this.saveSettings(defaults);
		this.applySettings(defaults);
		return defaults;
	}

	// ─────────────────────────────────────────────
	// Modal rendering
	// ─────────────────────────────────────────────

	/**
	 * Renders the settings modal body with Campaign and Arena tabs.
	 * Static because it has no per-instance state.
	 */
	static renderModal() {
		const body = document.getElementById("settingsModalBody");
		if (!body) return;

		const settings = this.loadSettings();
		const fragment = document.createDocumentFragment();

		const alert  = document.createElement("div");
		alert.className = "alert alert-info";
		const icon   = document.createElement("i");
		icon.className = "bi bi-info-circle me-2";
		icon.setAttribute("aria-hidden", "true");
		const strong = document.createElement("strong");
		strong.textContent = "Hero Scoring Weights: ";
		const text   = document.createTextNode(
			"These values control how heroes are prioritised for each role and mode. Changes apply to the next optimization.",
		);
		alert.append(icon, strong, text);
		fragment.appendChild(alert);

		const tabsNav = document.createElement("ul");
		tabsNav.className = "nav nav-tabs mb-3";
		tabsNav.id = "settingsTabs";
		tabsNav.setAttribute("role", "tablist");
		tabsNav.append(_createTab("Campaign", "campaignSettings", true), _createTab("Arena", "arenaSettings", false));

		const tabContent = document.createElement("div");
		tabContent.className = "tab-content";
		tabContent.append(
			_createSettingsPane("campaign", settings.heroScoring.campaign, true),
			_createSettingsPane("arena",    settings.heroScoring.arena,    false),
		);

		fragment.append(tabsNav, tabContent);
		body.replaceChildren(fragment);
	}

	/**
	 * Reads input values from the modal and saves + applies them.
	 * Static because it operates only on DOM state and localStorage.
	 */
	static saveFromModal() {
		const body     = document.getElementById("settingsModalBody");
		const settings = this.loadSettings();

		for (const input of body.querySelectorAll("input[type='number']")) {
			const mode  = input.dataset.mode;
			const role  = input.dataset.role;
			const stat  = input.dataset.stat;
			const value = parseFloat(input.value) || 0;
			settings.heroScoring[mode][role][stat] = value;
		}

		this.saveSettings(settings);
		this.applySettings(settings);
		showToast("Settings saved! They will be used in the next optimization.", "success");
	}

	/**
	 * Resets all settings to defaults and updates the modal inputs.
	 * Static because it operates only on DOM state and localStorage.
	 */
	static resetModalToDefaults() {
		if (!confirm("Reset all settings to default values?")) return;

		const defaults = this.resetToDefaults();
		const body     = document.getElementById("settingsModalBody");

		for (const input of body.querySelectorAll("input[type='number']")) {
			input.value = defaults.heroScoring[input.dataset.mode][input.dataset.role][input.dataset.stat];
		}

		showToast("Settings reset to defaults", "success");
	}

	// ─────────────────────────────────────────────
	// Initialization
	// ─────────────────────────────────────────────

	/**
	 * Loads and applies persisted settings on app startup.
	 */
	static initialize() {
		this.applySettings(this.loadSettings());
	}
}

// ─────────────────────────────────────────────
// Private DOM builders
// ─────────────────────────────────────────────

/**
 * Creates a Bootstrap nav-item tab button.
 * @param {string}  label
 * @param {string}  target - Pane ID
 * @param {boolean} active
 * @returns {HTMLElement}
 * @private
 */
function _createTab(label, target, active) {
	const li  = document.createElement("li");
	li.className = "nav-item";
	li.setAttribute("role", "presentation");

	const btn = document.createElement("button");
	btn.className = `nav-link ${active ? "active" : ""}`;
	btn.id = `${target}-tab`;
	btn.setAttribute("data-bs-toggle",  "tab");
	btn.setAttribute("data-bs-target",  `#${target}`);
	btn.setAttribute("type",            "button");
	btn.setAttribute("role",            "tab");
	btn.setAttribute("aria-controls",   target);
	btn.setAttribute("aria-selected",   active ? "true" : "false");
	btn.textContent = label;

	li.appendChild(btn);
	return li;
}

/**
 * Creates a tab pane with Tank and DPS weight cards for a given mode.
 * @param {"campaign"|"arena"} mode
 * @param {Object}  weights - { tank: {...}, dps: {...} }
 * @param {boolean} active
 * @returns {HTMLElement}
 * @private
 */
function _createSettingsPane(mode, weights, active) {
	const pane = document.createElement("div");
	pane.className = `tab-pane fade ${active ? "show active" : ""}`;
	pane.id = `${mode}Settings`;
	pane.setAttribute("role", "tabpanel");
	pane.setAttribute("aria-labelledby", `${mode}Settings-tab`);
	pane.append(
		_createWeightCard("Tank",        mode, "tank", weights.tank),
		_createWeightCard("DPS/Healer",  mode, "dps",  weights.dps),
	);
	return pane;
}

/**
 * Creates a card with three stat weight inputs for a role.
 * Each input carries data-mode, data-role, and data-stat for the save handler.
 * @param {string} label
 * @param {string} mode
 * @param {string} role
 * @param {Object} weights - { damage, health, armor }
 * @returns {HTMLElement}
 * @private
 */
function _createWeightCard(label, mode, role, weights) {
	const card = document.createElement("div");
	card.className = "card mb-3";

	const cardHeader = document.createElement("div");
	cardHeader.className = "card-header";
	const title = document.createElement("h6");
	title.className = "mb-0";
	title.textContent = `${label} Weights`;
	cardHeader.appendChild(title);

	const cardBody = document.createElement("div");
	cardBody.className = "card-body";

	const row      = document.createElement("div");
	row.className  = "row g-3";
	const fragment = document.createDocumentFragment();

	for (const stat of ["damage", "health", "armor"]) {
		const inputId = `${mode}-${role}-${stat}`;

		const col = document.createElement("div");
		col.className = "col-md-4";

		const labelEl = document.createElement("label");
		labelEl.className = "form-label text-capitalize";
		labelEl.textContent = stat;
		labelEl.htmlFor = inputId;

		const input = document.createElement("input");
		input.type  = "number";
		input.className = "form-control";
		input.id    = inputId;
		input.min   = "0";
		input.step  = "0.1";
		input.value = weights[stat];
		input.setAttribute("data-mode", mode);
		input.setAttribute("data-role", role);
		input.setAttribute("data-stat", stat);
		input.setAttribute("aria-label", `${label} ${stat} weight`);

		col.append(labelEl, input);
		fragment.appendChild(col);
	}

	row.appendChild(fragment);
	cardBody.appendChild(row);
	card.append(cardHeader, cardBody);
	return card;
}