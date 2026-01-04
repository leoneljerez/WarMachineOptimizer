// js/settings.js
import { AppConfig } from "../config.js";
import { showToast } from "./notifications.js";

/**
 * Settings manager for app-level preferences
 * Stores in localStorage (separate from profile data)
 */
export class SettingsManager {
	static STORAGE_KEY = "wmo_app_settings";

	/**
	 * Loads settings from localStorage
	 * @returns {Object} Settings object
	 */
	static loadSettings() {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY);
			if (!stored) return this.getDefaultSettings();

			const settings = JSON.parse(stored);

			// Merge with defaults to handle new settings
			return {
				...this.getDefaultSettings(),
				...settings,
				heroScoring: {
					...this.getDefaultSettings().heroScoring,
					...settings.heroScoring,
				},
			};
		} catch (error) {
			console.error("Failed to load settings:", error);
			return this.getDefaultSettings();
		}
	}

	/**
	 * Saves settings to localStorage
	 * @param {Object} settings - Settings to save
	 */
	static saveSettings(settings) {
		try {
			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
			console.log("Settings saved to localStorage:", settings);
		} catch (error) {
			console.error("Failed to save settings:", error);
			showToast("Failed to save settings", "danger");
		}
	}

	static factoryDefaults = null;
	/**
	 * Gets default settings from AppConfig
	 * @returns {Object} Default settings
	 */
	static getDefaultSettings() {
		if (!this.factoryDefaults) {
			this.factoryDefaults = JSON.parse(JSON.stringify(AppConfig.HERO_SCORING));
		}

		const d = this.factoryDefaults;
		return {
			heroScoring: {
				campaign: {
					tank: { ...d.CAMPAIGN.TANK },
					dps: { ...d.CAMPAIGN.DPS },
				},
				arena: {
					tank: { ...d.ARENA.TANK },
					dps: { ...d.ARENA.DPS },
				},
			},
		};
	}

	/**
	 * Applies settings to AppConfig (modifies in place)
	 * This ensures optimizer always reads the latest values
	 * @param {Object} settings - Settings to apply
	 */
	static applySettings(settings) {
		if (settings.heroScoring) {
			// Update each property individually to maintain references
			const campaignTank = settings.heroScoring.campaign.tank;
			const campaignDps = settings.heroScoring.campaign.dps;
			const arenaTank = settings.heroScoring.arena.tank;
			const arenaDps = settings.heroScoring.arena.dps;

			// Campaign Tank
			AppConfig.HERO_SCORING.CAMPAIGN.TANK.damage = campaignTank.damage;
			AppConfig.HERO_SCORING.CAMPAIGN.TANK.health = campaignTank.health;
			AppConfig.HERO_SCORING.CAMPAIGN.TANK.armor = campaignTank.armor;

			// Campaign DPS
			AppConfig.HERO_SCORING.CAMPAIGN.DPS.damage = campaignDps.damage;
			AppConfig.HERO_SCORING.CAMPAIGN.DPS.health = campaignDps.health;
			AppConfig.HERO_SCORING.CAMPAIGN.DPS.armor = campaignDps.armor;

			// Arena Tank
			AppConfig.HERO_SCORING.ARENA.TANK.damage = arenaTank.damage;
			AppConfig.HERO_SCORING.ARENA.TANK.health = arenaTank.health;
			AppConfig.HERO_SCORING.ARENA.TANK.armor = arenaTank.armor;

			// Arena DPS
			AppConfig.HERO_SCORING.ARENA.DPS.damage = arenaDps.damage;
			AppConfig.HERO_SCORING.ARENA.DPS.health = arenaDps.health;
			AppConfig.HERO_SCORING.ARENA.DPS.armor = arenaDps.armor;

			console.log("Settings applied to AppConfig.HERO_SCORING:", AppConfig.HERO_SCORING);
		}
	}

	/**
	 * Resets settings to defaults
	 */
	static resetToDefaults() {
		const defaults = this.getDefaultSettings();
		this.saveSettings(defaults);
		this.applySettings(defaults);
		return defaults;
	}
}

/**
 * Renders the settings modal
 */
export function renderSettingsModal() {
	const settings = SettingsManager.loadSettings();

	const container = document.getElementById("settingsModalBody");
	if (!container) return;

	container.replaceChildren();

	// Info alert
	const alert = document.createElement("div");
	alert.className = "alert alert-info";

	const icon = document.createElement("i");
	icon.className = "bi bi-info-circle me-2";

	const strong = document.createElement("strong");
	strong.textContent = "Hero Scoring Weights: ";

	const text = document.createTextNode(
		"These values control how heroes are prioritized when assigning crew for each mode. Higher values mean that stat is more important for that role. Changes apply to future optimizations."
	);

	alert.append(icon, strong, text);
	container.appendChild(alert);

	// Create tabs for Campaign and Arena
	const tabsNav = document.createElement("ul");
	tabsNav.className = "nav nav-tabs mb-3";
	tabsNav.id = "settingsTabs";
	tabsNav.setAttribute("role", "tablist");

	const campaignTab = createTab("Campaign", "campaignSettings", true);
	const arenaTab = createTab("Arena", "arenaSettings", false);

	tabsNav.append(campaignTab, arenaTab);

	// Create tab content
	const tabContent = document.createElement("div");
	tabContent.className = "tab-content";

	const campaignPane = createSettingsPane("campaign", settings.heroScoring.campaign, true);
	const arenaPane = createSettingsPane("arena", settings.heroScoring.arena, false);

	tabContent.append(campaignPane, arenaPane);

	container.append(tabsNav, tabContent);
}

/**
 * Creates a tab button
 * @param {string} label - Tab label
 * @param {string} target - Target pane ID
 * @param {boolean} active - Whether tab is active
 * @returns {HTMLElement} Tab element
 */
function createTab(label, target, active) {
	const li = document.createElement("li");
	li.className = "nav-item";
	li.setAttribute("role", "presentation");

	const button = document.createElement("button");
	button.className = `nav-link ${active ? "active" : ""}`;
	button.id = `${target}-tab`;
	button.setAttribute("data-bs-toggle", "tab");
	button.setAttribute("data-bs-target", `#${target}`);
	button.setAttribute("type", "button");
	button.setAttribute("role", "tab");
	button.textContent = label;

	li.appendChild(button);
	return li;
}

/**
 * Creates a settings pane for a mode
 * @param {string} mode - "campaign" or "arena"
 * @param {Object} weights - Weight values
 * @param {boolean} active - Whether pane is active
 * @returns {HTMLElement} Pane element
 */
function createSettingsPane(mode, weights, active) {
	const pane = document.createElement("div");
	pane.className = `tab-pane fade ${active ? "show active" : ""}`;
	pane.id = `${mode}Settings`;
	pane.setAttribute("role", "tabpanel");

	// Tank section
	const tankCard = createWeightCard("Tank", mode, "tank", weights.tank);

	// DPS section
	const dpsCard = createWeightCard("DPS/Healer", mode, "dps", weights.dps);

	pane.append(tankCard, dpsCard);
	return pane;
}

/**
 * Creates a weight configuration card
 * @param {string} label - Card label
 * @param {string} mode - Mode (campaign/arena)
 * @param {string} role - Role (tank/dps)
 * @param {Object} weights - Weight values
 * @returns {HTMLElement} Card element
 */
function createWeightCard(label, mode, role, weights) {
	const card = document.createElement("div");
	card.className = "card mb-3";

	const cardHeader = document.createElement("div");
	cardHeader.className = "card-header";

	const headerTitle = document.createElement("h6");
	headerTitle.className = "mb-0";
	headerTitle.textContent = `${label} Weights`;
	cardHeader.appendChild(headerTitle);

	const cardBody = document.createElement("div");
	cardBody.className = "card-body";

	//maybe its cleaner to do it this way?
	/* const description = document.createElement("p");
	description.className = "text-secondary small mb-3";
	description.textContent = "Higher values prioritize that stat when assigning crew. These weights determine how heroes are scored for this role.";
	cardBody.appendChild(description);*/

	// Create inputs for each stat
	const stats = ["damage", "health", "armor"];
	const row = document.createElement("div");
	row.className = "row g-3";

	stats.forEach((stat) => {
		const col = document.createElement("div");
		col.className = "col-md-4";

		const label = document.createElement("label");
		label.className = "form-label text-capitalize";
		label.textContent = stat;
		label.htmlFor = `${mode}-${role}-${stat}`;

		const input = document.createElement("input");
		input.type = "number";
		input.className = "form-control";
		input.id = `${mode}-${role}-${stat}`;
		input.min = "0";
		input.step = "0.1";
		input.value = weights[stat];
		input.setAttribute("data-mode", mode);
		input.setAttribute("data-role", role);
		input.setAttribute("data-stat", stat);

		col.append(label, input);
		row.appendChild(col);
	});

	cardBody.appendChild(row);
	card.append(cardHeader, cardBody);

	return card;
}

/**
 * Saves settings from the modal
 */
export function saveSettingsFromModal() {
	const settings = SettingsManager.loadSettings();

	// Collect all input values
	const inputs = document.querySelectorAll("#settingsModalBody input[type='number']");

	inputs.forEach((input) => {
		const mode = input.getAttribute("data-mode");
		const role = input.getAttribute("data-role");
		const stat = input.getAttribute("data-stat");
		const value = parseFloat(input.value) || 0;

		settings.heroScoring[mode][role][stat] = value;
	});

	// Save and apply
	SettingsManager.saveSettings(settings);
	SettingsManager.applySettings(settings);

	showToast("Settings saved! They will be used in the next optimization.", "success");
}

/**
 * Resets settings to defaults
 */
export function resetSettingsToDefaults() {
	if (!confirm("Reset all settings to default values?")) return;

	const defaults = SettingsManager.resetToDefaults();

	// Update modal inputs
	const inputs = document.querySelectorAll("#settingsModalBody input[type='number']");
	inputs.forEach((input) => {
		const mode = input.getAttribute("data-mode");
		const role = input.getAttribute("data-role");
		const stat = input.getAttribute("data-stat");
		input.value = defaults.heroScoring[mode][role][stat];
	});

	showToast("Settings reset to defaults", "success");
}

/**
 * Initializes settings on app startup
 */
export function initializeSettings() {
	const settings = SettingsManager.loadSettings();
	SettingsManager.applySettings(settings);
	console.log("Settings initialized and applied to AppConfig");
}
