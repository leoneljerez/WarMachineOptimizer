// js/utils/ranks.js
import { AppConfig } from "../config.js";

/**
 * Rarity color configuration for subtle borders
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

/**
 * Calculates machine rank info from level
 * @param {number} level - Machine level (1-150+)
 * @returns {{type: string, tier: string, count: number, displayText: string}} Rank information
 */
export function getMachineRank(level) {
	if (level < 1) {
		return { type: "Star", tier: "Bronze", count: 0, displayText: "No Rank" };
	}

	let rankConfig;
	let adjustedLevel = level;

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
		// Beyond 150, show max wings
		return {
			type: "Wings",
			tier: "StarlightPlus",
			count: 5,
			displayText: "5 Starlight Plus Wings (Max)",
		};
	}

	// Calculate count (1-5) and tier based on level
	const count = ((adjustedLevel - 1) % 5) + 1;
	const tierIndex = Math.floor((adjustedLevel - 1) / 5);
	const tierConfig = rankConfig.tiers[tierIndex] || rankConfig.tiers[rankConfig.tiers.length - 1];
	const tier = tierConfig.key.charAt(0).toUpperCase() + tierConfig.key.slice(1);
	const tierLabel = tierConfig.label;

	const displayText = `${count} ${tierLabel} ${rankConfig.type}${count > 1 ? "s" : ""}`;

	return { type: rankConfig.type, tier, count, displayText };
}

/**
 * Creates rank icon display element for machines
 * @param {number} level - Machine level
 * @param {string} size - Icon size: 'small' (20px), 'medium' (30px), 'large' (40px)
 * @returns {HTMLElement} Container with rank icons
 */
export function createMachineRankDisplay(level, size = "medium") {
	const rank = getMachineRank(level);
	const container = document.createElement("div");
	container.className = "d-flex align-items-center gap-1";
	container.setAttribute("title", rank.displayText);

	const sizeMap = { small: 20, medium: 30, large: 40 };
	const iconSize = sizeMap[size] || 30;

	// Create icons for each star/crown/wing
	for (let i = 0; i < rank.count; i++) {
		const img = document.createElement("img");
		img.src = `img/ui/ranks/${rank.type}Icon${rank.tier}.webp`;
		img.alt = rank.type;
		img.className = "rank-icon";
		img.style.cssText = `width: ${iconSize}px; height: ${iconSize}px; object-fit: contain;`;
		img.setAttribute("aria-hidden", "true");

		// Error handling for missing images
		img.addEventListener(
			"error",
			() => {
				img.style.display = "none";
				console.warn(`Missing rank icon: ${img.src}`);
			},
			{ once: true }
		);

		container.appendChild(img);
	}

	return container;
}

/**
 * Creates guardian rank option with images
 * @param {string} evolution - Evolution category
 * @param {string} rank - Rank (1star-5crown)
 * @param {boolean} selected - Whether this option is selected
 * @returns {HTMLElement} Option element with images
 */
function createGuardianRankOption(evolution, rank, selected) {
	const option = document.createElement("option");
	option.value = `${evolution}|${rank}`;
	option.selected = selected;

	const isCrown = rank.includes("crown");
	const type = isCrown ? "Crown" : "Star";
	const count = parseInt(rank.charAt(0));

	// Map evolution key to tier key for image path
	const evolutionToTier = {
		bronze: "Bronze",
		silver: "Silver",
		gold: "Gold",
		platinum: "Platinum",
		ruby: "Ruby",
		sapphire: "Sapphire",
		pearl: "Pearl",
		diamond: "Diamond",
		starlight: "Starlight",
		starlight_plus: "StarlightPlus",
	};

	const tier = evolutionToTier[evolution];
	const evolutionConfig = AppConfig.GUARDIAN_EVOLUTIONS.find((e) => e.key === evolution);
	const evolutionLabel = evolutionConfig ? evolutionConfig.label : evolution.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());

	// Store metadata for custom rendering
	option.setAttribute("data-type", type);
	option.setAttribute("data-tier", tier);
	option.setAttribute("data-count", count);
	option.setAttribute("data-evolution", evolutionLabel);

	// Set text content as fallback
	option.textContent = `${evolutionLabel} - ${count} ${type}${count > 1 ? "s" : ""}`;

	return option;
}

/**
 * Creates a combined guardian rank selector with image rendering
 * Organized by Stars first, then Crowns
 * @param {string} currentEvolution - Current evolution category
 * @param {string} currentRank - Current rank (1star-5crown)
 * @param {string} inputId - Input ID
 * @returns {HTMLElement} Container with select and custom display
 */
export function createGuardianRankSelector(currentEvolution, currentRank, inputId) {
	const container = document.createElement("div");
	container.className = "guardian-rank-selector-container";

	// Create hidden select for form data
	const select = document.createElement("select");
	select.className = "guardian-rank-select";
	select.id = inputId;
	select.style.display = "none";

	const starRanks = ["1star", "2star", "3star", "4star", "5star"];
	const crownRanks = ["1crown", "2crown", "3crown", "4crown", "5crown"];

	// Build select options
	AppConfig.GUARDIAN_EVOLUTIONS.forEach((evolution) => {
		[...starRanks, ...crownRanks].forEach((rank) => {
			const option = createGuardianRankOption(evolution.key, rank, evolution.key === currentEvolution && rank === currentRank);
			select.appendChild(option);
		});
	});

	// Create custom display button
	const displayBtn = document.createElement("button");
	displayBtn.type = "button";
	displayBtn.className = "btn btn-outline-secondary w-100 text-start guardian-rank-display";
	displayBtn.id = `${inputId}-display`;

	// Render initial display
	updateGuardianRankDisplay(displayBtn, currentEvolution, currentRank);

	// Create dropdown menu - organized by rank type (Stars, then Crowns)
	const dropdownMenu = document.createElement("div");
	dropdownMenu.className = "guardian-rank-dropdown";
	dropdownMenu.style.display = "none";

	// STARS SECTION
	const starsHeader = document.createElement("div");
	starsHeader.className = "guardian-rank-type-header";
	starsHeader.textContent = "Stars";
	dropdownMenu.appendChild(starsHeader);

	AppConfig.GUARDIAN_EVOLUTIONS.forEach((evolution) => {
		const subHeader = document.createElement("div");
		subHeader.className = "guardian-rank-evolution-subheader";
		subHeader.textContent = evolution.label;
		dropdownMenu.appendChild(subHeader);

		const ranksContainer = document.createElement("div");
		ranksContainer.className = "guardian-rank-options";

		starRanks.forEach((rank) => {
			const option = createGuardianRankOptionVisual(evolution.key, rank);
			option.addEventListener("click", () => {
				select.value = `${evolution.key}|${rank}`;
				updateGuardianRankDisplay(displayBtn, evolution.key, rank);
				dropdownMenu.style.display = "none";
				select.dispatchEvent(new Event("change", { bubbles: true }));
			});
			ranksContainer.appendChild(option);
		});

		dropdownMenu.appendChild(ranksContainer);
	});

	// CROWNS SECTION
	const crownsHeader = document.createElement("div");
	crownsHeader.className = "guardian-rank-type-header";
	crownsHeader.textContent = "Crowns";
	dropdownMenu.appendChild(crownsHeader);

	AppConfig.GUARDIAN_EVOLUTIONS.forEach((evolution) => {
		const subHeader = document.createElement("div");
		subHeader.className = "guardian-rank-evolution-subheader";
		subHeader.textContent = evolution.label;
		dropdownMenu.appendChild(subHeader);

		const ranksContainer = document.createElement("div");
		ranksContainer.className = "guardian-rank-options";

		crownRanks.forEach((rank) => {
			const option = createGuardianRankOptionVisual(evolution.key, rank);
			option.addEventListener("click", () => {
				select.value = `${evolution.key}|${rank}`;
				updateGuardianRankDisplay(displayBtn, evolution.key, rank);
				dropdownMenu.style.display = "none";
				select.dispatchEvent(new Event("change", { bubbles: true }));
			});
			ranksContainer.appendChild(option);
		});

		dropdownMenu.appendChild(ranksContainer);
	});

	// Toggle dropdown
	displayBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		dropdownMenu.style.display = dropdownMenu.style.display === "none" ? "block" : "none";
	});

	// Close dropdown when clicking outside
	document.addEventListener("click", () => {
		dropdownMenu.style.display = "none";
	});

	container.append(select, displayBtn, dropdownMenu);
	return container;
}

/**
 * Creates visual option for guardian rank dropdown
 * @param {string} evolution - Evolution category
 * @param {string} rank - Rank
 * @returns {HTMLElement} Option element
 */
function createGuardianRankOptionVisual(evolution, rank) {
	const option = document.createElement("button");
	option.type = "button";
	option.className = "guardian-rank-option";

	const isCrown = rank.includes("crown");
	const type = isCrown ? "Crown" : "Star";
	const count = parseInt(rank.charAt(0));

	const evolutionToTier = {
		bronze: "Bronze",
		silver: "Silver",
		gold: "Gold",
		platinum: "Platinum",
		ruby: "Ruby",
		sapphire: "Sapphire",
		pearl: "Pearl",
		diamond: "Diamond",
		starlight: "Starlight",
		starlight_plus: "StarlightPlus",
	};

	const tier = evolutionToTier[evolution];

	// Create icon container
	const iconContainer = document.createElement("div");
	iconContainer.className = "d-flex align-items-center gap-1";

	for (let i = 0; i < count; i++) {
		const img = document.createElement("img");
		img.src = `img/ui/ranks/${type}Icon${tier}.webp`;
		img.alt = type;
		img.style.cssText = "width: 20px; height: 20px; object-fit: contain;";
		iconContainer.appendChild(img);
	}

	option.appendChild(iconContainer);
	return option;
}

/**
 * Updates the guardian rank display button
 * @param {HTMLElement} button - Display button
 * @param {string} evolution - Evolution category
 * @param {string} rank - Rank
 */
function updateGuardianRankDisplay(button, evolution, rank) {
	button.replaceChildren();

	const isCrown = rank.includes("crown");
	const type = isCrown ? "Crown" : "Star";
	const count = parseInt(rank.charAt(0));

	const evolutionToTier = {
		bronze: "Bronze",
		silver: "Silver",
		gold: "Gold",
		platinum: "Platinum",
		ruby: "Ruby",
		sapphire: "Sapphire",
		pearl: "Pearl",
		diamond: "Diamond",
		starlight: "Starlight",
		starlight_plus: "StarlightPlus",
	};

	const tier = evolutionToTier[evolution];
	const evolutionConfig = AppConfig.GUARDIAN_EVOLUTIONS.find((e) => e.key === evolution);
	const evolutionLabel = evolutionConfig ? evolutionConfig.label : evolution.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());

	const container = document.createElement("div");
	container.className = "d-flex align-items-center justify-content-between w-100";

	const iconContainer = document.createElement("div");
	iconContainer.className = "d-flex align-items-center gap-1";

	for (let i = 0; i < count; i++) {
		const img = document.createElement("img");
		img.src = `img/ui/ranks/${type}Icon${tier}.webp`;
		img.alt = type;
		img.style.cssText = "width: 24px; height: 24px; object-fit: contain;";
		iconContainer.appendChild(img);
	}

	const label = document.createElement("span");
	label.textContent = evolutionLabel;
	label.className = "ms-2";

	const caret = document.createElement("i");
	caret.className = "bi bi-chevron-down ms-auto";

	container.append(iconContainer, label, caret);
	button.appendChild(container);
}

/**
 * Parses the combined guardian rank value
 * @param {string} value - Combined value like "bronze|3star"
 * @returns {{evolution: string, rank: string}} Parsed values
 */
export function parseGuardianRankValue(value) {
	const [evolution, rank] = value.split("|");
	return { evolution, rank };
}

/**
 * Creates guardian rank icon display
 * @param {string} evolution - Evolution category
 * @param {string} rank - Rank (1star-5crown)
 * @param {string} size - Icon size
 * @returns {HTMLElement} Container with rank icons
 */
export function createGuardianRankDisplay(evolution, rank, size = "medium") {
	const container = document.createElement("div");
	container.className = "d-flex align-items-center gap-1";

	const sizeMap = { small: 20, medium: 30, large: 40 };
	const iconSize = sizeMap[size] || 30;

	// Determine type and count
	const isCrown = rank.includes("crown");
	const type = isCrown ? "Crown" : "Star";
	const count = parseInt(rank.charAt(0));

	// Map evolution to icon tier
	const evolutionToTier = {
		bronze: "Bronze",
		silver: "Silver",
		gold: "Gold",
		platinum: "Platinum",
		ruby: "Ruby",
		sapphire: "Sapphire",
		pearl: "Pearl",
		diamond: "Diamond",
		starlight: "Starlight",
		starlight_plus: "StarlightPlus",
	};

	const tier = evolutionToTier[evolution] || "Bronze";

	// Create icons
	for (let i = 0; i < count; i++) {
		const img = document.createElement("img");
		img.src = `img/ui/ranks/${type}Icon${tier}.webp`;
		img.alt = type;
		img.className = "rank-icon";
		img.style.cssText = `width: ${iconSize}px; height: ${iconSize}px; object-fit: contain;`;
		img.setAttribute("aria-hidden", "true");

		img.addEventListener(
			"error",
			() => {
				img.style.display = "none";
				console.warn(`Missing rank icon: ${img.src}`);
			},
			{ once: true }
		);

		container.appendChild(img);
	}

	const evolutionConfig = AppConfig.GUARDIAN_EVOLUTIONS.find((e) => e.key === evolution);
	const label = document.createElement("span");
	label.className = "ms-2";
	label.textContent = evolutionConfig ? evolutionConfig.label : evolution.replace("_", " ");
	container.appendChild(label);

	return container;
}
