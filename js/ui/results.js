// ui/results.js
import Decimal from "../vendor/break_eternity.esm.js";

/**
 * @typedef {Object} SerializedDecimal
 * @property {number} sign
 * @property {number} layer
 * @property {number} mag
 */

/**
 * @typedef {Object} OptimizationResult
 * @property {number} totalStars
 * @property {Object} lastCleared - Object mapping difficulty to last mission cleared
 * @property {import('../app.js').Machine[]} formation
 * @property {SerializedDecimal} battlePower
 * @property {SerializedDecimal} arenaPower
 * @property {string} mode
 */

// Constants
const DIFFICULTIES = [
	{ key: "easy", label: "Easy", color: "success" },
	{ key: "normal", label: "Normal", color: "info" },
	{ key: "hard", label: "Hard", color: "warning" },
	{ key: "insane", label: "Insane", color: "danger" },
	{ key: "nightmare", label: "Nightmare", color: "dark" },
];

const MAX_MISSIONS_PER_DIFFICULTY = 90;
const MAX_TOTAL_STARS = 450; // 5 difficulties × 90 missions

// Use WeakMap to avoid memory leaks from direct property assignment
const machineCardRegistry = new WeakMap();

/**
 * Converts a serialized Decimal to a Decimal instance
 * @param {SerializedDecimal} serialized - Serialized decimal object
 * @returns {Decimal} Decimal instance
 */
function toDecimal(serialized) {
	return Decimal.fromComponents(serialized.sign, serialized.layer, serialized.mag);
}

/**
 * Formats a Decimal as a localized integer string or exponential notation
 * @param {SerializedDecimal} decimal - Serialized decimal to format
 * @returns {string} Formatted string
 */
function formatPower(decimal) {
	if (toDecimal(decimal).lessThan(999000000)) {
		return Math.trunc(toDecimal(decimal).toNumber()).toLocaleString("en-US");
	}
	return toDecimal(decimal).toExponential(2);
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

	card.querySelector(".damage .value").textContent = toDecimal(stats.damage).toExponential(2);
	card.querySelector(".health .value").textContent = toDecimal(stats.health).toExponential(2);
	card.querySelector(".armor .value").textContent = toDecimal(stats.armor).toExponential(2);
}

/**
 * Creates a crew member image element
 * @param {import('../app.js').Hero} hero - Hero object
 * @returns {HTMLImageElement} Image element
 */
function createCrewImage(hero) {
	const img = document.createElement("img");
	img.src = hero.image || "hero-placeholder.png";
	img.alt = hero.name;
	img.title = hero.name;
	img.className = "rounded border";
	img.style.cssText = "width: 30px; height: 30px; object-fit: cover;";
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

	const img = clone.querySelector(".machine-image");
	img.src = machine.image || "placeholder.png";
	img.alt = machine.name;

	clone.querySelector(".machine-name").textContent = `${machine.name} (Lv ${machine.level}, ${machine.rarity})`;

	updateMachineStats(card, "battle");

	const crewDiv = clone.querySelector(".crew");
	const crewFragment = document.createDocumentFragment();

	machine.crew.forEach((hero) => {
		crewFragment.appendChild(createCrewImage(hero));
	});

	crewDiv.appendChild(crewFragment);

	return clone;
}

/**
 * Creates a progress bar for campaign progression
 * @param {Object} lastCleared - Object mapping difficulty to last mission cleared
 * @returns {HTMLElement} Progress display element
 */
function createProgressionDisplay(lastCleared) {
	const container = document.createElement("div");
	container.className = "campaign-progression";

	const fragment = document.createDocumentFragment();

	DIFFICULTIES.forEach((diff) => {
		const mission = lastCleared?.[diff.key] ?? 0;
		const percentage = (mission / MAX_MISSIONS_PER_DIFFICULTY) * 100;

		// Row container
		const row = document.createElement("div");
		row.className = "mb-3";

		// Label and mission count
		const labelRow = document.createElement("div");
		labelRow.className = "d-flex justify-content-between align-items-center mb-1";

		const label = document.createElement("span");
		label.className = "fw-semibold text-capitalize";
		label.textContent = diff.label;

		const missionText = document.createElement("span");
		missionText.className = "text-secondary small";
		missionText.textContent = mission > 0 ? `${mission} / ${MAX_MISSIONS_PER_DIFFICULTY}` : "Not Started";

		labelRow.appendChild(label);
		labelRow.appendChild(missionText);

		// Progress bar
		const progressContainer = document.createElement("div");
		progressContainer.className = "progress";
		progressContainer.style.height = "8px";

		const progressBar = document.createElement("div");
		progressBar.className = `progress-bar bg-${diff.color}`;
		progressBar.style.width = `${percentage}%`;
		progressBar.setAttribute("role", "progressbar");
		progressBar.setAttribute("aria-valuenow", mission);
		progressBar.setAttribute("aria-valuemin", "0");
		progressBar.setAttribute("aria-valuemax", MAX_MISSIONS_PER_DIFFICULTY);

		progressContainer.appendChild(progressBar);

		row.appendChild(labelRow);
		row.appendChild(progressContainer);
		fragment.appendChild(row);
	});

	container.appendChild(fragment);
	return container;
}

/**
 * Creates summary stats cards
 * @param {OptimizationResult} result - Optimization result
 * @param {string} optimizeMode - "campaign" or "arena"
 * @returns {HTMLElement} Stats container
 */
function createSummaryStats(result, optimizeMode) {
	const container = document.createElement("div");
	container.className = "row g-3 mb-4";

	if (optimizeMode === "campaign") {
		// Total Stars Card
		const starsCol = document.createElement("div");
		starsCol.className = "col-md-4";

		const starsCard = document.createElement("div");
		starsCard.className = "card text-center h-100";

		const starsBody = document.createElement("div");
		starsBody.className = "card-body";

		const starsTitle = document.createElement("h6");
		starsTitle.className = "text-secondary mb-2";
		starsTitle.textContent = "Total Stars";

		const starsValue = document.createElement("div");
		starsValue.className = "fs-2 fw-bold text-warning";
		starsValue.textContent = result.totalStars || 0;

		const starsSubtext = document.createElement("small");
		starsSubtext.className = "text-secondary";
		starsSubtext.textContent = `out of ${MAX_TOTAL_STARS}`;

		starsBody.appendChild(starsTitle);
		starsBody.appendChild(starsValue);
		starsBody.appendChild(starsSubtext);
		starsCard.appendChild(starsBody);
		starsCol.appendChild(starsCard);

		// Highest Mission Card
		let highestMission = 0;
		let highestDifficulty = "None";

		// Iterate in reverse order (nightmare to easy) to find highest
		for (let i = DIFFICULTIES.length - 1; i >= 0; i--) {
			const diff = DIFFICULTIES[i];
			const mission = result.lastCleared?.[diff.key] ?? 0;
			if (mission > 0) {
				highestMission = mission;
				highestDifficulty = diff.label;
				break;
			}
		}

		const missionCol = document.createElement("div");
		missionCol.className = "col-md-4";

		const missionCard = document.createElement("div");
		missionCard.className = "card text-center h-100";

		const missionBody = document.createElement("div");
		missionBody.className = "card-body";

		const missionTitle = document.createElement("h6");
		missionTitle.className = "text-secondary mb-2";
		missionTitle.textContent = "Highest Clear";

		const missionValue = document.createElement("div");
		missionValue.className = "fs-2 fw-bold";
		missionValue.textContent = highestMission > 0 ? highestMission : "None";

		const missionSubtext = document.createElement("small");
		missionSubtext.className = "text-secondary";
		missionSubtext.textContent = highestDifficulty;

		missionBody.appendChild(missionTitle);
		missionBody.appendChild(missionValue);
		missionBody.appendChild(missionSubtext);
		missionCard.appendChild(missionBody);
		missionCol.appendChild(missionCard);

		// Power Card
		const initialPower = result.battlePower;
		const powerCol = document.createElement("div");
		powerCol.className = "col-md-4";

		const powerCard = document.createElement("div");
		powerCard.className = "card text-center h-100";

		const powerBody = document.createElement("div");
		powerBody.className = "card-body";

		const powerTitle = document.createElement("h6");
		powerTitle.className = "text-secondary mb-2 powerTitle";
		powerTitle.textContent = "Battle Power";

		const powerValue = document.createElement("div");
		powerValue.className = "fs-2 fw-bold text-primary powerResult";
		powerValue.textContent = formatPower(initialPower);

		const powerSubtext = document.createElement("small");
		powerSubtext.className = "text-secondary";
		powerSubtext.textContent = "Total Squad";

		powerBody.appendChild(powerTitle);
		powerBody.appendChild(powerValue);
		powerBody.appendChild(powerSubtext);
		powerCard.appendChild(powerBody);
		powerCol.appendChild(powerCard);

		container.appendChild(starsCol);
		container.appendChild(missionCol);
		container.appendChild(powerCol);
	} else {
		// Arena mode - just show power
		const initialPower = result.arenaPower;
		const powerCol = document.createElement("div");
		powerCol.className = "col-12";

		const powerCard = document.createElement("div");
		powerCard.className = "card text-center";

		const powerBody = document.createElement("div");
		powerBody.className = "card-body";

		const powerTitle = document.createElement("h6");
		powerTitle.className = "text-secondary mb-2 powerTitle";
		powerTitle.textContent = "Arena Power";

		const powerValue = document.createElement("div");
		powerValue.className = "fs-2 fw-bold text-primary powerResult";
		powerValue.textContent = formatPower(initialPower);

		const powerSubtext = document.createElement("small");
		powerSubtext.className = "text-secondary";
		powerSubtext.textContent = "Total Squad";

		powerBody.appendChild(powerTitle);
		powerBody.appendChild(powerValue);
		powerBody.appendChild(powerSubtext);
		powerCard.appendChild(powerBody);
		powerCol.appendChild(powerCard);

		container.appendChild(powerCol);
	}

	return container;
}

/**
 * Cleans up old machine cards and event listeners to prevent memory leaks
 * @param {HTMLElement} container - Results container element
 */
function cleanupResults(container) {
	// Abort any existing event listeners
	if (container.__statsController) {
		container.__statsController.abort();
		container.__statsController = null;
	}

	// Clean up WeakMap references for old machine cards
	const oldCards = container.querySelectorAll(".machine-card");
	oldCards.forEach((card) => {
		machineCardRegistry.delete(card);
	});

	// Clear container DOM to release references
	container.replaceChildren();
}

/**
 * Sets up the battle/arena stats toggle with proper cleanup
 * @param {OptimizationResult} result - Optimization result
 * @param {HTMLElement} container - Results container element
 */
function setupStatsToggle(result, container) {
	const toggle = document.getElementById("statsToggle");
	if (!toggle) return;

	const controller = new AbortController();
	container.__statsController = controller;

	toggle.addEventListener(
		"change",
		(e) => {
			const mode = e.target.value;

			// Update all machine card stats
			document.querySelectorAll(".machine-card").forEach((card) => {
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
 * Main render function for optimization results
 * @param {OptimizationResult} result - Optimization result object
 * @param {string} optimizeMode - "campaign" or "arena"
 */
export function renderResults(result, optimizeMode = "campaign") {
	const container = document.getElementById("resultsContainer");

	// Clean up old results and event listeners
	cleanupResults(container);

	if (!result) {
		const noResult = document.createElement("p");
		noResult.className = "text-secondary";
		noResult.textContent = "No results available.";
		container.appendChild(noResult);
		return;
	}

	// Create main result container
	const resultCard = document.createElement("div");
	resultCard.className = "result-card mt-4";

	// Add summary stats
	resultCard.appendChild(createSummaryStats(result, optimizeMode));

	// Add campaign progression (only for campaign mode)
	if (optimizeMode === "campaign") {
		const progressionSection = document.createElement("div");
		progressionSection.className = "card mb-4";

		const progressionHeader = document.createElement("div");
		progressionHeader.className = "card-header";

		const progressionTitle = document.createElement("h6");
		progressionTitle.className = "mb-0";
		progressionTitle.textContent = "Campaign Progression";

		progressionHeader.appendChild(progressionTitle);

		const progressionBody = document.createElement("div");
		progressionBody.className = "card-body";
		progressionBody.appendChild(createProgressionDisplay(result.lastCleared));

		progressionSection.appendChild(progressionHeader);
		progressionSection.appendChild(progressionBody);
		resultCard.appendChild(progressionSection);
	}

	// Formation section header with stats toggle
	const formationHeader = document.createElement("div");
	formationHeader.className = "d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 gap-2";

	const formationTitle = document.createElement("h5");
	formationTitle.className = "mb-0";
	formationTitle.textContent = "Formation";

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

	statsToggle.appendChild(battleRadio);
	statsToggle.appendChild(battleLabel);
	statsToggle.appendChild(arenaRadio);
	statsToggle.appendChild(arenaLabel);

	formationHeader.appendChild(formationTitle);
	formationHeader.appendChild(statsToggle);
	resultCard.appendChild(formationHeader);

	// Formation grid
	const formationGrid = document.createElement("div");
	formationGrid.className = "results-view";

	const formationContainer = document.createElement("div");
	formationContainer.className = "row g-3 justify-content-center";
	formationContainer.id = "formationContainer";

	// Left Column (Positions 5, 4, 3)
	const leftCol = document.createElement("div");
	leftCol.className = "col-12 col-md-auto order-2 order-md-1";

	const leftColumn = document.createElement("div");
	leftColumn.className = "d-flex flex-column gap-2 left-column";

	const slot5 = document.createElement("div");
	slot5.className = "machine-slot card-hover";
	slot5.setAttribute("data-position", "5");
	slot5.style.minHeight = "150px";

	const slot4 = document.createElement("div");
	slot4.className = "machine-slot card-hover";
	slot4.setAttribute("data-position", "4");
	slot4.style.minHeight = "150px";

	const slot3 = document.createElement("div");
	slot3.className = "machine-slot card-hover";
	slot3.setAttribute("data-position", "3");
	slot3.style.minHeight = "150px";

	leftColumn.appendChild(slot5);
	leftColumn.appendChild(slot4);
	leftColumn.appendChild(slot3);
	leftCol.appendChild(leftColumn);

	// Right Column (Positions 2, 1)
	const rightCol = document.createElement("div");
	rightCol.className = "col-12 col-md-auto order-1 order-md-2";

	const rightColumn = document.createElement("div");
	rightColumn.className = "d-flex flex-column gap-2 justify-content-center right-column";
	rightColumn.style.height = "100%";

	const slot2 = document.createElement("div");
	slot2.className = "machine-slot card-hover";
	slot2.setAttribute("data-position", "2");
	slot2.style.minHeight = "150px";

	const slot1 = document.createElement("div");
	slot1.className = "machine-slot card-hover";
	slot1.setAttribute("data-position", "1");
	slot1.style.minHeight = "150px";

	rightColumn.appendChild(slot2);
	rightColumn.appendChild(slot1);
	rightCol.appendChild(rightColumn);

	formationContainer.appendChild(leftCol);
	formationContainer.appendChild(rightCol);
	formationGrid.appendChild(formationContainer);
	resultCard.appendChild(formationGrid);

	// Populate formation slots with machine cards
	const machineTemplate = document.getElementById("machineTemplate");
	const slots = formationContainer.querySelectorAll(".machine-slot[data-position]");
	const positionMap = new Map();

	slots.forEach((slot) => {
		const position = slot.getAttribute("data-position");
		positionMap.set(position, slot);
	});

	Iterator.from(result.formation)
		.map((machine, index) => ({ machine, position: String(index + 1) }))
		.filter(({ position }) => positionMap.has(position))
		.forEach(({ machine, position }) => {
			const slot = positionMap.get(position);
			const machineCard = createMachineCard(machine, machineTemplate);
			slot.appendChild(machineCard);
		});

	// Add everything to container in single operation
	container.appendChild(resultCard);

	// Update all machine cards to show correct initial stats
	const initialMode = optimizeMode === "arena" ? "arena" : "battle";
	Iterator.from(document.querySelectorAll(".machine-card")).forEach((card) => updateMachineStats(card, initialMode));

	// Set up stats toggle event listener
	setupStatsToggle(result, container);
}
