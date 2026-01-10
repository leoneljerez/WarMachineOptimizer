// ui/results.js
import { Calculator } from "../calculator.js";
import { AppConfig } from "../config.js";
import { createMachineRankDisplay, RarityColors } from "../utils/ranks.js";

// Use WeakMap to avoid memory leaks from direct property assignment
const machineCardRegistry = new WeakMap();

// Store cleanup functions for better memory management
const cleanupRegistry = new WeakMap();

/**
 * Formats a Decimal as a localized integer string or exponential notation
 * @param {*} decimal - Serialized decimal to format
 * @returns {string} Formatted string
 */
function formatPower(decimal) {
	const value = Calculator.toDecimal(decimal);
	if (value.lessThan(999000000)) {
		return Math.trunc(value.toNumber()).toLocaleString("en-US");
	}
	return value.toExponential(2);
}

/**
 * Updates stats display for a single machine card
 * @param {HTMLElement} card - Machine card element
 * @param {string} mode - "battle" or "arena"
 */
function updateMachineStats(card, mode) {
	const machine = machineCardRegistry.get(card);
	if (!machine) return;

	const stats = mode === "arena" ? machine.arenaStats : machine.battleStats;

	// Use cached elements for better performance
	const damageEl = card.querySelector(".damage .value");
	const healthEl = card.querySelector(".health .value");
	const armorEl = card.querySelector(".armor .value");

	if (damageEl) damageEl.textContent = Calculator.toDecimal(stats.damage).toExponential(2);
	if (healthEl) healthEl.textContent = Calculator.toDecimal(stats.health).toExponential(2);
	if (armorEl) armorEl.textContent = Calculator.toDecimal(stats.armor).toExponential(2);
}

/**
 * Creates a crew member image element with error handling
 * @param {import('../app.js').Hero} hero - Hero object
 * @returns {HTMLImageElement} Image element
 */
function createCrewImage(hero) {
	const img = document.createElement("img");
	img.src = hero.image || "img/heroes/placeholder.png";
	img.alt = hero.name;
	img.title = hero.name;

	// Add error handler for missing images
	img.addEventListener(
		"error",
		() => {
			img.src = "img/heroes/placeholder.png";
		},
		{ once: true }
	);

	return img;
}

/**
 * Creates a machine card for the formation display
 * @param {import('../app.js').Machine} machine - Machine object
 * @param {HTMLTemplateElement} machineTemplate - Template element
 * @returns {DocumentFragment} Cloned template fragment
 */
function createMachineCard(machine, machineTemplate) {
	const clone = machineTemplate.content.cloneNode(true);
	const card = clone.querySelector(".machine-card");

	// Use WeakMap to track machine data without direct property assignment
	machineCardRegistry.set(card, machine);

	// Get rarity color for accent
	const rarityKey = machine.rarity?.toLowerCase() || "common";
	const rarityColor = RarityColors[rarityKey] || RarityColors.common;

	// Apply rarity accent to card
	card.style.borderTop = `3px solid ${rarityColor}`;
	card.style.background = `linear-gradient(to bottom, ${rarityColor}08, transparent 60%)`;

	// Add particle effects for special ranks (Celestial, Titan, Angel)
	const specialRanks = ["celestial", "titan", "angel"];
	const isSpecialRank = specialRanks.includes(rarityKey);

	if (isSpecialRank) {
		card.classList.add("special-rank-card");

		// Create particle container
		const particleContainer = document.createElement("div");
		particleContainer.className = "rank-particles";

		// Generate 6 particles with random positions and timings
		for (let i = 0; i < 6; i++) {
			const particle = document.createElement("div");
			particle.className = `rank-particle ${rarityKey}`;

			// Random horizontal position (5% to 95%)
			const leftPos = 5 + Math.random() * 85;
			particle.style.left = `${leftPos}%`;

			// Random animation duration (2.5s to 4.5s)
			const duration = 2.5 + Math.random() * 2;
			particle.style.animationDuration = `${duration}s`;

			// Random delay (0s to 3s)
			const delay = Math.random() * 3;
			particle.style.animationDelay = `${delay}s`;

			particleContainer.appendChild(particle);
		}

		card.appendChild(particleContainer);
	}

	const img = clone.querySelector(".machine-image");
	img.src = machine.image || "img/machines/placeholder.png";
	img.alt = machine.name;

	// Subtle glow effect on image
	img.style.boxShadow = `0 4px 12px ${rarityColor}25, 0 0 20px ${rarityColor}15`;

	// Add error handler
	img.addEventListener(
		"error",
		() => {
			img.src = "img/machines/placeholder.png";
		},
		{ once: true }
	);

	// Machine name section
	const nameElement = clone.querySelector(".machine-name");
	nameElement.innerHTML = ""; // Clear template content

	// Title
	const title = document.createElement("div");
	title.className = "fw-bold fs-6 mb-2 text-white";
	title.textContent = machine.name;

	// Level and rarity badge with rarity color accent
	const badge = document.createElement("div");
	badge.className = "d-inline-flex align-items-center gap-2 px-3 py-1 rounded-2";
	badge.style.background = `linear-gradient(135deg, ${rarityColor}15, ${rarityColor}08)`;
	badge.style.border = `1px solid ${rarityColor}40`;
	badge.style.fontSize = "0.75rem";

	const levelText = document.createElement("span");
	levelText.className = "text-white-50";
	levelText.textContent = `Lv. ${machine.level}`;

	const separator = document.createElement("span");
	separator.className = "text-white-50";
	separator.textContent = "•";

	const rarityText = document.createElement("span");
	rarityText.className = "fw-semibold text-white-50";
	rarityText.textContent = machine.rarity;

	badge.append(levelText, separator, rarityText);

	// Add rank display
	const rankContainer = document.createElement("div");
	rankContainer.className = "mt-2";

	if (machine.level > 0) {
		const rankDisplay = createMachineRankDisplay(machine.level, "small");
		rankContainer.appendChild(rankDisplay);
	}

	nameElement.append(title, badge, rankContainer);

	// Stats section
	const statsContainer = clone.querySelector(".machine-stats");
	statsContainer.className = "stats-grid";
	statsContainer.innerHTML = ""; // Clear template

	// Create stat items with icons
	const statTypes = [
		{ key: "damage", icon: "img/ui/damage.webp", label: "Damage" },
		{ key: "health", icon: "img/ui/health.webp", label: "Health" },
		{ key: "armor", icon: "img/ui/armor.webp", label: "Armor" },
	];

	statTypes.forEach(({ key, icon, label }) => {
		const statItem = document.createElement("div");
		statItem.className = `stat ${key} stat-item`;

		const iconEl = document.createElement("img");
		iconEl.src = icon;
		iconEl.alt = label;
		iconEl.title = label;
		iconEl.className = "stat-icon";

		const valueEl = document.createElement("span");
		valueEl.className = "value stat-value";
		valueEl.textContent = "0.00e+00"; // Placeholder to reserve width

		statItem.append(iconEl, valueEl);
		statsContainer.appendChild(statItem);
	});

	// Set initial stats
	updateMachineStats(card, "battle");

	// Crew section with better visual organization
	const crewDiv = clone.querySelector(".crew");
	crewDiv.className = "crew-section mt-3 pt-3";
	crewDiv.style.borderTop = "1px solid rgba(255, 255, 255, 0.1)";

	const crewFragment = document.createDocumentFragment();

	// Crew members
	const crewMembers = document.createElement("div");
	crewMembers.className = "crew-members d-flex flex-wrap justify-content-center gap-2";

	if (machine.crew && machine.crew.length > 0) {
		machine.crew.forEach((hero) => {
			crewMembers.appendChild(createCrewImage(hero));
		});
	} else {
		const emptyState = document.createElement("div");
		emptyState.className = "text-white-50 small fst-italic py-2";
		emptyState.textContent = "No crew assigned";
		crewMembers.appendChild(emptyState);
	}

	crewFragment.appendChild(crewMembers);
	crewDiv.appendChild(crewFragment);

	return clone;
}

/**
 * Creates a single stat card element
 * @param {string} title - Card title
 * @param {string} value - Main value to display
 * @param {string} subtext - Subtext below value
 * @param {string} valueClass - CSS class for value styling
 * @returns {HTMLElement} Card element
 */
function createStatCard(title, value, subtext, valueClass = "text-primary") {
	const col = document.createElement("div");
	col.className = "col-md-4";

	const card = document.createElement("div");
	card.className = "card text-center h-100";

	const body = document.createElement("div");
	body.className = "card-body";

	const titleEl = document.createElement("h6");
	titleEl.className = "text-secondary mb-2";
	titleEl.textContent = title;

	const valueEl = document.createElement("div");
	valueEl.className = `fs-2 fw-bold ${valueClass}`;
	valueEl.textContent = value;

	const subtextEl = document.createElement("small");
	subtextEl.className = "text-secondary";
	subtextEl.textContent = subtext;

	body.append(titleEl, valueEl, subtextEl);
	card.appendChild(body);
	col.appendChild(card);

	return col;
}

/**
 * Creates a progress bar for a single difficulty
 * @param {Object} difficulty - Difficulty configuration from AppConfig
 * @param {number} mission - Mission number cleared
 * @returns {HTMLElement} Progress row element
 */
function createProgressBar(difficulty, mission) {
	const percentage = (mission / AppConfig.MAX_MISSIONS_PER_DIFFICULTY) * 100;

	const row = document.createElement("div");
	row.className = "mb-3";

	// Label row
	const labelRow = document.createElement("div");
	labelRow.className = "d-flex justify-content-between align-items-center mb-1";

	const label = document.createElement("span");
	label.className = "fw-semibold text-capitalize";
	label.textContent = difficulty.label;

	const missionText = document.createElement("span");
	missionText.className = "text-secondary small";
	missionText.textContent = mission > 0 ? `${mission} / ${AppConfig.MAX_MISSIONS_PER_DIFFICULTY}` : "Not Started";

	labelRow.append(label, missionText);

	// Progress bar
	const progressContainer = document.createElement("div");
	progressContainer.className = "progress";
	progressContainer.style.height = "8px";

	const progressBar = document.createElement("div");
	progressBar.className = `progress-bar bg-${difficulty.color}`;
	progressBar.style.width = `${percentage}%`;
	progressBar.setAttribute("role", "progressbar");
	progressBar.setAttribute("aria-valuenow", mission);
	progressBar.setAttribute("aria-valuemin", "0");
	progressBar.setAttribute("aria-valuemax", AppConfig.MAX_MISSIONS_PER_DIFFICULTY);

	progressContainer.appendChild(progressBar);
	row.append(labelRow, progressContainer);

	return row;
}

/**
 * Creates a progress bar display for campaign progression
 * @param {Object} lastCleared - Object mapping difficulty to last mission cleared
 * @returns {HTMLElement} Progress display element
 */
function createProgressionDisplay(lastCleared) {
	const container = document.createElement("div");
	container.className = "campaign-progression";

	// Use fragment to batch DOM operations
	const fragment = document.createDocumentFragment();

	AppConfig.DIFFICULTIES.forEach((diff) => {
		const mission = lastCleared?.[diff.key] ?? 0;
		fragment.appendChild(createProgressBar(diff, mission));
	});

	container.appendChild(fragment);
	return container;
}

/**
 * Creates summary stats cards for campaign mode
 * @param {*} result - Optimization result
 * @returns {HTMLElement} Stats container with three cards
 */
function createCampaignStats(result) {
	const container = document.createElement("div");
	container.className = "row g-3 mb-4";

	// Find highest cleared mission
	let highestMission = 0;
	let highestDifficulty = "None";

	for (let i = AppConfig.DIFFICULTIES.length - 1; i >= 0; i--) {
		const diff = AppConfig.DIFFICULTIES[i];
		const mission = result.lastCleared?.[diff.key] ?? 0;
		if (mission > 0) {
			highestMission = mission;
			highestDifficulty = diff.label;
			break;
		}
	}

	// Build all cards using fragment
	const fragment = document.createDocumentFragment();

	// Total Stars Card
	fragment.appendChild(createStatCard("Total Stars", String(result.totalStars || 0), `out of ${AppConfig.MAX_TOTAL_STARS}`, "text-warning"));

	// Highest Clear Card
	fragment.appendChild(createStatCard("Highest Clear", highestMission > 0 ? String(highestMission) : "None", highestDifficulty, ""));

	// Power Card (with special classes for updating)
	const powerCard = createStatCard("Battle Power", formatPower(result.battlePower), "Total Squad", "text-primary powerResult");
	powerCard.querySelector("h6").classList.add("powerTitle");
	fragment.appendChild(powerCard);

	container.appendChild(fragment);
	return container;
}

/**
 * Creates summary stats cards for arena mode
 * @param {*} result - Optimization result
 * @returns {HTMLElement} Stats container with one card
 */
function createArenaStats(result) {
	const container = document.createElement("div");
	container.className = "row g-3 mb-4";

	const powerCard = createStatCard("Arena Power", formatPower(result.arenaPower), "Total Squad", "text-primary powerResult");
	powerCard.querySelector("h6").classList.add("powerTitle");
	powerCard.className = "col-12"; // Full width for arena

	container.appendChild(powerCard);
	return container;
}

/**
 * Creates summary stats cards based on mode
 * @param {*} result - Optimization result
 * @param {string} optimizeMode - "campaign" or "arena"
 * @returns {HTMLElement} Stats container
 */
function createSummaryStats(result, optimizeMode) {
	return optimizeMode === "campaign" ? createCampaignStats(result) : createArenaStats(result);
}

/**
 * Creates the campaign progression section
 * @param {Object} lastCleared - Last cleared missions by difficulty
 * @returns {HTMLElement} Section element
 */
function createProgressionSection(lastCleared) {
	const section = document.createElement("div");
	section.className = "card mb-4";

	const header = document.createElement("div");
	header.className = "card-header";

	const title = document.createElement("h6");
	title.className = "mb-0";
	title.textContent = "Campaign Progression";

	header.appendChild(title);

	const body = document.createElement("div");
	body.className = "card-body";
	body.appendChild(createProgressionDisplay(lastCleared));

	section.append(header, body);
	return section;
}

/**
 * Creates the upgrade suggestions section with a generate button
 * @param {string} optimizeMode - Current optimization mode
 * @param {Object} result - Optimization result
 * @param {Object} upgradeConfig - Upgrade configuration
 * @returns {HTMLElement|null} Section element or null
 */
function createUpgradeSuggestionsSection(optimizeMode, result, upgradeConfig) {
	if (optimizeMode !== "campaign") {
		return null;
	}

	// Check if campaign is complete
	const isComplete = AppConfig.DIFFICULTIES.every((diff) => (result.lastCleared?.[diff.key] || 0) >= AppConfig.MAX_MISSIONS_PER_DIFFICULTY);

	if (isComplete) {
		return null; // Campaign complete, no upgrades needed
	}

	const section = document.createElement("div");
	section.className = "upgrade-suggestions-section mt-4 mb-5";
	section.id = "upgradeSuggestionsSection";

	// Create button container
	const buttonContainer = document.createElement("div");
	buttonContainer.className = "text-center mb-3";

	const generateBtn = document.createElement("button");
	generateBtn.type = "button";
	generateBtn.className = "btn btn-primary btn-lg";
	generateBtn.innerHTML = '<i class="me-2"></i>Generate Upgrade Suggestions';

	// Loading spinner (hidden by default)
	const spinner = document.createElement("span");
	spinner.className = "spinner-border spinner-border-sm ms-2 d-none";
	spinner.setAttribute("role", "status");
	spinner.setAttribute("aria-hidden", "true");

	// Results container (empty initially)
	const resultsContainer = document.createElement("div");
	resultsContainer.id = "upgradeSuggestionsResults";

	// Click handler
	generateBtn.addEventListener("click", async () => {
		// Disable button and show spinner
		generateBtn.disabled = true;
		spinner.classList.remove("d-none");
		generateBtn.innerHTML = '<i class="me-2"></i>Generating...';
		generateBtn.appendChild(spinner);

		try {
			// Import analyzer
			const { UpgradeAnalyzer } = await import("../utils/upgradeAnalyzer.js");
			const { renderUpgradeSuggestions } = await import("./upgradeSuggestions.js");

			// Create analyzer
			const analyzer = new UpgradeAnalyzer(upgradeConfig);

			// Analyze upgrades
			const analysis = analyzer.analyzeUpgrades(result.formation, result.lastCleared, optimizeMode);

			// Render results
			resultsContainer.replaceChildren();
			if (analysis) {
				renderUpgradeSuggestions(analysis, resultsContainer);

				// Hide button after successful generation
				buttonContainer.classList.add("d-none");
			} else {
				const noResult = document.createElement("div");
				noResult.className = "alert alert-info";
				noResult.innerHTML = '<i class="bi bi-info-circle me-2"></i>No upgrade suggestions available.';
				resultsContainer.appendChild(noResult);
			}
		} catch (error) {
			console.error("Failed to generate upgrade suggestions:", error);

			// Show error message
			resultsContainer.replaceChildren();
			const errorMsg = document.createElement("div");
			errorMsg.className = "alert alert-danger";
			errorMsg.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>Failed to generate suggestions: ${error.message}`;
			resultsContainer.appendChild(errorMsg);

			// Re-enable button
			generateBtn.disabled = false;
			spinner.classList.add("d-none");
			generateBtn.innerHTML = '<i class="bi bi-lightbulb me-2"></i>Try Again';
		}
	});

	buttonContainer.appendChild(generateBtn);
	section.append(buttonContainer, resultsContainer);

	return section;
}

/**
 * Creates the stats toggle control
 * @param {string} optimizeMode - Initial mode ("campaign" or "arena")
 * @returns {HTMLElement} Toggle control element
 */
function createStatsToggle(optimizeMode) {
	const statsToggle = document.createElement("div");
	statsToggle.className = "mode-selector gap-2 p-2 rounded-3";
	statsToggle.id = "statsToggle";

	const battleRadio = document.createElement("input");
	battleRadio.type = "radio";
	battleRadio.id = "battleStats";
	battleRadio.name = "statsMode";
	battleRadio.value = "battle";
	battleRadio.checked = optimizeMode === "campaign";

	const battleLabel = document.createElement("label");
	battleLabel.htmlFor = "battleStats";
	battleLabel.className = "px-4 py-2 rounded-2 fw-medium user-select-none";
	battleLabel.textContent = "Battle Stats";

	const arenaRadio = document.createElement("input");
	arenaRadio.type = "radio";
	arenaRadio.id = "arenaStats";
	arenaRadio.name = "statsMode";
	arenaRadio.value = "arena";
	arenaRadio.checked = optimizeMode === "arena";

	const arenaLabel = document.createElement("label");
	arenaLabel.htmlFor = "arenaStats";
	arenaLabel.className = "px-4 py-2 rounded-2 fw-medium user-select-none";
	arenaLabel.textContent = "Arena Stats";

	statsToggle.append(battleRadio, battleLabel, arenaRadio, arenaLabel);
	return statsToggle;
}

/**
 * Creates the formation header with title and toggle
 * @param {string} optimizeMode - Current optimization mode
 * @returns {HTMLElement} Header element
 */
function createFormationHeader(optimizeMode) {
	const header = document.createElement("div");
	header.className = "d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 gap-2";

	const title = document.createElement("h5");
	title.className = "mb-0";
	title.textContent = "Formation";

	header.append(title, createStatsToggle(optimizeMode));
	return header;
}

/**
 * Creates a machine slot element
 * @param {string} position - Position number (1-5)
 * @returns {HTMLElement} Slot element
 */
function createMachineSlot(position) {
	const slot = document.createElement("div");
	slot.className = "machine-slot card-hover";
	slot.setAttribute("data-position", position);
	slot.style.minHeight = "150px";
	return slot;
}

/**
 * Creates the formation grid structure
 * @returns {HTMLElement} Formation container
 */
function createFormationGrid() {
	const container = document.createElement("div");
	container.className = "row g-3 justify-content-center";
	container.id = "formationContainer";

	// Left Column (Positions 5, 4, 3)
	const leftCol = document.createElement("div");
	leftCol.className = "col-12 col-md-auto order-2 order-md-1";

	const leftColumn = document.createElement("div");
	leftColumn.className = "d-flex flex-column gap-2 left-column";

	leftColumn.append(createMachineSlot("5"), createMachineSlot("4"), createMachineSlot("3"));
	leftCol.appendChild(leftColumn);

	// Right Column (Positions 2, 1)
	const rightCol = document.createElement("div");
	rightCol.className = "col-12 col-md-auto order-1 order-md-2";

	const rightColumn = document.createElement("div");
	rightColumn.className = "d-flex flex-column gap-2 justify-content-center right-column";
	rightColumn.style.height = "100%";

	rightColumn.append(createMachineSlot("2"), createMachineSlot("1"));
	rightCol.appendChild(rightColumn);

	container.append(leftCol, rightCol);
	return container;
}

/**
 * Populates formation slots with machine cards
 * @param {HTMLElement} container - Formation container
 * @param {Array} formation - Formation array
 * @param {HTMLTemplateElement} machineTemplate - Machine card template
 */
function populateFormation(container, formation, machineTemplate) {
	if (!formation || formation.length === 0) {
		const emptyMsg = document.createElement("div");
		emptyMsg.className = "col-12 text-center text-secondary";
		emptyMsg.textContent = "No machines in formation";
		container.appendChild(emptyMsg);
		return;
	}

	// Build position map
	const slots = container.querySelectorAll(".machine-slot[data-position]");
	const positionMap = new Map();

	slots.forEach((slot) => {
		const position = slot.getAttribute("data-position");
		positionMap.set(position, slot);
	});

	// Populate slots
	formation.forEach((machine, index) => {
		const position = String(index + 1);
		const slot = positionMap.get(position);

		if (slot) {
			const machineCard = createMachineCard(machine, machineTemplate);
			slot.appendChild(machineCard);
		}
	});
}

/**
 * Sets up the stats toggle event listener with proper cleanup
 * @param {*} result - Optimization result
 * @param {HTMLElement} container - Results container element
 */
function setupStatsToggle(result, container) {
	const toggle = document.getElementById("statsToggle");
	if (!toggle) return;

	const controller = new AbortController();

	// Store controller for cleanup
	const existingController = cleanupRegistry.get(container);
	if (existingController) {
		existingController.abort();
	}
	cleanupRegistry.set(container, controller);

	toggle.addEventListener(
		"change",
		(e) => {
			const mode = e.target.value;

			// Update all machine card stats
			const machineCards = document.querySelectorAll(".machine-card");
			machineCards.forEach((card) => {
				updateMachineStats(card, mode);
			});

			// Update power display
			const power = mode === "arena" ? result.arenaPower : result.battlePower;
			const title = mode === "arena" ? "Arena Power" : "Battle Power";

			const powerResult = document.querySelector(".powerResult");
			const powerTitle = document.querySelector(".powerTitle");

			if (powerResult) powerResult.textContent = formatPower(power);
			if (powerTitle) powerTitle.textContent = title;
		},
		{ signal: controller.signal }
	);
}

/**
 * Cleans up old machine cards and event listeners to prevent memory leaks
 * @param {HTMLElement} container - Results container element
 */
function cleanupResults(container) {
	// Abort any existing event listeners
	const controller = cleanupRegistry.get(container);
	if (controller) {
		controller.abort();
	}

	// Clear container DOM to release references
	container.replaceChildren();
}

/**
 * Main render function for optimization results
 * @param {*} result - Optimization result object
 * @param {string} optimizeMode - "campaign" or "arena"
 * @param {Object} upgradeConfig - Configuration for upgrade analyzer
 */
export function renderResults(result, optimizeMode = "campaign", upgradeConfig = null) {
	const container = document.getElementById("resultsContainer");
	cleanupResults(container);

	if (!result || !result.formation) {
		const noResult = document.createElement("p");
		noResult.className = "text-secondary";
		noResult.textContent = "No results available. Click 'Optimize' to generate results.";
		container.appendChild(noResult);
		return;
	}

	const fragment = document.createDocumentFragment();
	const resultCard = document.createElement("div");
	resultCard.className = "result-card mt-4";

	// Summary stats
	resultCard.appendChild(createSummaryStats(result, optimizeMode));

	// Campaign progression
	if (optimizeMode === "campaign") {
		resultCard.appendChild(createProgressionSection(result.lastCleared));
	}

	// Upgrade suggestions section (with button)
	if (optimizeMode === "campaign" && upgradeConfig) {
		const upgradeSection = createUpgradeSuggestionsSection(optimizeMode, result, upgradeConfig);
		if (upgradeSection) {
			resultCard.appendChild(upgradeSection);
		}
	}

	// Formation section
	resultCard.appendChild(createFormationHeader(optimizeMode));

	const formationGrid = document.createElement("div");
	formationGrid.className = "results-view";

	const formationContainer = createFormationGrid();
	const machineTemplate = document.getElementById("machineTemplate");

	populateFormation(formationContainer, result.formation, machineTemplate);

	formationGrid.appendChild(formationContainer);
	resultCard.appendChild(formationGrid);

	fragment.appendChild(resultCard);
	container.appendChild(fragment);

	// Update stats and setup toggle
	const initialMode = optimizeMode === "arena" ? "arena" : "battle";
	const machineCards = document.querySelectorAll(".machine-card");
	machineCards.forEach((card) => {
		updateMachineStats(card, initialMode);
	});

	setupStatsToggle(result, container);
}
