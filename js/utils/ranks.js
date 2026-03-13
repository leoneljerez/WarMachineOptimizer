// utils/ranks.js
import { AppConfig, RANK_FILE_MAP } from "../config.js";
import { createPicture } from "../ui/formHelpers.js";

/**
 * Rarity border-color map for subtle UI highlights.
 * @type {Record<string, string>}
 */
export const RarityColors = {
	common: "#6B4423",
	uncommon: "#2D5016",
	rare: "#1E3A8A",
	epic: "#6B21A8",
	legendary: "#C2410C",
	mythic: "#0891B2",
	titan: "#CA8A04",
	angel: "#B91C1C",
	celestial: "#60A5FA",
};

// ─────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────

/**
 * Converts a GUARDIAN_EVOLUTIONS key to the capitalised tier label used in RANK_FILE_MAP.
 * Reads directly from AppConfig.GUARDIAN_EVOLUTIONS so there is only one source of truth.
 * @param {string} evolutionKey - e.g. "starlight_plus"
 * @returns {string} e.g. "StarlightPlus"
 * @private
 */
function _evolutionKeyToTier(evolutionKey) {
	const entry = AppConfig.GUARDIAN_EVOLUTIONS.find((e) => e.key === evolutionKey);
	if (!entry) return "Bronze";
	// Convert label to PascalCase tier key used by RANK_FILE_MAP ("Starlight Plus" → "StarlightPlus")
	return entry.label.replace(/\s+/g, "");
}

/**
 * Returns the base image path (without extension) for a rank type + tier combination.
 * @param {"Star"|"Crown"|"Wings"} type
 * @param {string} tier - PascalCase tier key (e.g. "Sapphire", "StarlightPlus")
 * @returns {string|null}
 * @private
 */
function _getRankBasePath(type, tier) {
	const fileName = RANK_FILE_MAP[type]?.[tier];
	if (!fileName) {
		console.warn(`Missing rank file mapping for type="${type}" tier="${tier}"`);
		return null;
	}
	return `img/ui/ranks/${fileName}`;
}

/**
 * Creates a row of rank icon <picture> elements.
 * @param {string} basePath - Image base path
 * @param {"Star"|"Crown"|"Wings"} type - Used as alt text
 * @param {number} count - Number of icons to render
 * @param {number} iconSize - CSS pixel size per icon
 * @returns {HTMLElement} flex container
 * @private
 */
function _createIconRow(basePath, type, count, iconSize) {
	const row = document.createElement("div");
	row.className = "d-flex align-items-center gap-1";

	for (let i = 0; i < count; i++) {
		const picture = createPicture(basePath, type, `width: ${iconSize}px; height: ${iconSize}px; object-fit: contain;`, "rank-icon");
		picture.setAttribute("aria-hidden", "true");
		picture.querySelector("img").addEventListener(
			"error",
			() => {
				picture.style.display = "none";
				console.warn(`Missing rank icon: ${basePath}`);
			},
			{ once: true },
		);
		row.appendChild(picture);
	}

	return row;
}

// ─────────────────────────────────────────────
// Machine rank display
// ─────────────────────────────────────────────

/**
 * Derives rank type, tier, and icon count from a machine level (1–150+).
 * @param {number} level
 * @returns {{type: "Star"|"Crown"|"Wings", tier: string, count: number, displayText: string}}
 */
export function getMachineRank(level) {
	if (level < 1) {
		return { type: "Star", tier: "Bronze", count: 0, displayText: "No Rank" };
	}

	let rankConfig;
	let adjustedLevel;

	if (level <= 50) {
		rankConfig = AppConfig.MACHINE_RANKS.STARS;
		adjustedLevel = level;
	} else if (level <= 100) {
		rankConfig = AppConfig.MACHINE_RANKS.CROWNS;
		adjustedLevel = level - 50;
	} else if (level <= 150) {
		rankConfig = AppConfig.MACHINE_RANKS.WINGS;
		adjustedLevel = level - 100;
	} else {
		return { type: "Wings", tier: "StarlightPlus", count: 5, displayText: "5 Starlight Plus Wings (Max)" };
	}

	const count = ((adjustedLevel - 1) % 5) + 1;
	const tierIndex = Math.floor((adjustedLevel - 1) / 5);
	const tierConfig = rankConfig.tiers[tierIndex] || rankConfig.tiers[rankConfig.tiers.length - 1];
	const tier = tierConfig.key.charAt(0).toUpperCase() + tierConfig.key.slice(1);

	return {
		type: rankConfig.type,
		tier,
		count,
		displayText: `${count} ${tierConfig.label} ${rankConfig.type}${count > 1 ? "s" : ""}`,
	};
}

/**
 * Creates a flex container of rank icons for a machine level.
 * @param {number} level
 * @param {"small"|"medium"|"large"} [size="medium"]
 * @returns {HTMLElement}
 */
export function createMachineRankDisplay(level, size = "medium") {
	const rank = getMachineRank(level);
	const sizeMap = { small: 20, medium: 30, large: 40 };
	const iconSize = sizeMap[size] || 30;

	const container = document.createElement("div");
	container.className = "d-flex align-items-center gap-1";
	container.setAttribute("title", rank.displayText);

	const basePath = _getRankBasePath(rank.type, rank.tier);
	if (!basePath) return container;

	container.appendChild(_createIconRow(basePath, rank.type, rank.count, iconSize));
	return container;
}

// ─────────────────────────────────────────────
// Guardian rank selector
// ─────────────────────────────────────────────

const STAR_RANKS = ["1star", "2star", "3star", "4star", "5star"];
const CROWN_RANKS = ["1crown", "2crown", "3crown", "4crown", "5crown"];

/**
 * Creates a custom guardian rank selector (hidden <select> + visual dropdown).
 * The dropdown uses a single delegated click listener on its container —
 * no per-option listeners are created.
 *
 * @param {string} currentEvolution - e.g. "bronze"
 * @param {string} currentRank      - e.g. "3star"
 * @param {string} inputId          - ID for the hidden <select>
 * @returns {HTMLElement}
 */
export function createGuardianRankSelector(currentEvolution, currentRank, inputId) {
	const container = document.createElement("div");
	container.className = "guardian-rank-selector-container";

	// Hidden <select> holds the value for form/event purposes
	const select = _buildHiddenSelect(currentEvolution, currentRank, inputId);

	// Visual trigger button
	const displayBtn = document.createElement("button");
	displayBtn.type = "button";
	displayBtn.className = "btn btn-outline-secondary w-100 text-start guardian-rank-display";
	displayBtn.id = `${inputId}-display`;
	_updateDisplayBtn(displayBtn, currentEvolution, currentRank);

	// Dropdown panel
	const dropdownMenu = document.createElement("div");
	dropdownMenu.className = "guardian-rank-dropdown";
	dropdownMenu.style.display = "none";
	dropdownMenu.appendChild(_buildDropdownContent());

	// Toggle on button click
	displayBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		dropdownMenu.style.display = dropdownMenu.style.display === "none" ? "block" : "none";
	});

	// Close on outside click
	document.addEventListener(
		"click",
		(e) => {
			if (!container.contains(e.target)) dropdownMenu.style.display = "none";
		},
		true,
	);

	// Single delegated click handler for all rank options
	dropdownMenu.addEventListener("click", (e) => {
		const option = e.target.closest("[data-evolution][data-rank]");
		if (!option) return;

		const evolution = option.dataset.evolution;
		const rank = option.dataset.rank;

		select.value = `${evolution}|${rank}`;
		_updateDisplayBtn(displayBtn, evolution, rank);
		dropdownMenu.style.display = "none";
		select.dispatchEvent(new Event("change", { bubbles: true }));
	});

	container.append(select, displayBtn, dropdownMenu);
	return container;
}

/**
 * Parses a combined guardian rank selector value.
 * @param {string} value - e.g. "bronze|3star"
 * @returns {{evolution: string, rank: string}}
 */
export function parseGuardianRankValue(value) {
	const [evolution, rank] = value.split("|");
	return { evolution, rank };
}

/**
 * Creates a standalone guardian rank icon display (no selector UI).
 * @param {string} evolution
 * @param {string} rank - e.g. "2crown"
 * @param {"small"|"medium"|"large"} [size="medium"]
 * @returns {HTMLElement}
 */
export function createGuardianRankDisplay(evolution, rank, size = "medium") {
	const sizeMap = { small: 20, medium: 30, large: 40 };
	const iconSize = sizeMap[size] || 30;
	const isCrown = rank.includes("crown");
	const type = isCrown ? "Crown" : "Star";
	const count = parseInt(rank.charAt(0), 10);
	const tier = _evolutionKeyToTier(evolution);
	const basePath = _getRankBasePath(type, tier);

	const container = document.createElement("div");
	container.className = "d-flex align-items-center gap-1";

	if (basePath) container.appendChild(_createIconRow(basePath, type, count, iconSize));

	const evolutionConfig = AppConfig.GUARDIAN_EVOLUTIONS.find((e) => e.key === evolution);
	const label = document.createElement("span");
	label.className = "ms-2";
	label.textContent = evolutionConfig ? evolutionConfig.label : evolution.replace("_", " ");
	container.appendChild(label);

	return container;
}

// ─────────────────────────────────────────────
// Private guardian selector helpers
// ─────────────────────────────────────────────

/**
 * Builds the hidden <select> element with all evolution × rank options.
 * @private
 */
function _buildHiddenSelect(currentEvolution, currentRank, inputId) {
	const select = document.createElement("select");
	select.className = "guardian-rank-select";
	select.id = inputId;
	select.style.display = "none";

	for (const evolution of AppConfig.GUARDIAN_EVOLUTIONS) {
		for (const rank of [...STAR_RANKS, ...CROWN_RANKS]) {
			const option = document.createElement("option");
			option.value = `${evolution.key}|${rank}`;
			option.selected = evolution.key === currentEvolution && rank === currentRank;

			const isCrown = rank.includes("crown");
			const count = parseInt(rank.charAt(0), 10);
			option.textContent = `${evolution.label} - ${count} ${isCrown ? "Crown" : "Star"}${count > 1 ? "s" : ""}`;

			select.appendChild(option);
		}
	}

	return select;
}

/**
 * Builds the full dropdown menu content (Stars section + Crowns section).
 * Each option button carries `data-evolution` and `data-rank` so the
 * delegated handler can identify selections without closure captures.
 * @private
 */
function _buildDropdownContent() {
	const fragment = document.createDocumentFragment();

	for (const [sectionLabel, ranks] of [
		["Stars", STAR_RANKS],
		["Crowns", CROWN_RANKS],
	]) {
		const header = document.createElement("div");
		header.className = "guardian-rank-type-header";
		header.textContent = sectionLabel;
		fragment.appendChild(header);

		for (const evolution of AppConfig.GUARDIAN_EVOLUTIONS) {
			const subHeader = document.createElement("div");
			subHeader.className = "guardian-rank-evolution-subheader";
			subHeader.textContent = evolution.label;
			fragment.appendChild(subHeader);

			const ranksContainer = document.createElement("div");
			ranksContainer.className = "guardian-rank-options";

			for (const rank of ranks) {
				const btn = _buildOptionButton(evolution.key, rank);
				ranksContainer.appendChild(btn);
			}

			fragment.appendChild(ranksContainer);
		}
	}

	return fragment;
}

/**
 * Creates a single visual rank option button.
 * Data attributes carry identity for the delegated handler.
 * @private
 */
function _buildOptionButton(evolutionKey, rank) {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "guardian-rank-option";
	btn.dataset.evolution = evolutionKey;
	btn.dataset.rank = rank;

	const isCrown = rank.includes("crown");
	const type = isCrown ? "Crown" : "Star";
	const count = parseInt(rank.charAt(0), 10);
	const tier = _evolutionKeyToTier(evolutionKey);
	const basePath = _getRankBasePath(type, tier);

	const iconRow = document.createElement("div");
	iconRow.className = "d-flex align-items-center gap-1";

	for (let i = 0; i < count; i++) {
		iconRow.appendChild(createPicture(basePath, type, "width: 20px; height: 20px; object-fit: contain;"));
	}

	btn.appendChild(iconRow);
	return btn;
}

/**
 * Replaces the display button content with icons + label for the given selection.
 * @private
 */
function _updateDisplayBtn(button, evolution, rank) {
	button.replaceChildren();

	const isCrown = rank.includes("crown");
	const type = isCrown ? "Crown" : "Star";
	const count = parseInt(rank.charAt(0), 10);
	const tier = _evolutionKeyToTier(evolution);
	const basePath = _getRankBasePath(type, tier);

	const wrapper = document.createElement("div");
	wrapper.className = "d-flex align-items-center justify-content-between w-100";

	const iconRow = document.createElement("div");
	iconRow.className = "d-flex align-items-center gap-1";
	for (let i = 0; i < count; i++) {
		iconRow.appendChild(createPicture(basePath, type, "width: 24px; height: 24px; object-fit: contain;"));
	}

	const evolutionConfig = AppConfig.GUARDIAN_EVOLUTIONS.find((e) => e.key === evolution);
	const label = document.createElement("span");
	label.className = "ms-2";
	label.textContent = evolutionConfig ? evolutionConfig.label : evolution.replace("_", " ");

	const caret = document.createElement("i");
	caret.className = "bi bi-chevron-down ms-auto";

	wrapper.append(iconRow, label, caret);
	button.appendChild(wrapper);
}
