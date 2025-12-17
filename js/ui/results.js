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
 * @property {number} lastCleared
 * @property {import('../app.js').Machine[]} formation
 * @property {SerializedDecimal} battlePower
 * @property {SerializedDecimal} arenaPower
 * @property {string} mode
 */

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
			const title = mode === "arena" ? "Arena Power:" : "Battle Power:";

			document.querySelector(".powerResult").textContent = formatPower(power);
			document.querySelector(".powerTitle").textContent = title;
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

	// Clear container
	container.replaceChildren();

	if (!result) {
		const noResult = document.createElement("p");
		noResult.className = "text-secondary";
		noResult.textContent = "No results available.";
		container.appendChild(noResult);
		return;
	}

	const template = document.getElementById("resultTemplate");
	const clone = template.content.cloneNode(true);

	// Set power display based on mode
	const initialPower = optimizeMode === "arena" ? result.arenaPower : result.battlePower;
	const initialTitle = optimizeMode === "arena" ? "Arena Power:" : "Battle Power:";

	clone.querySelector(".powerResult").textContent = formatPower(initialPower);
	clone.querySelector(".powerTitle").textContent = initialTitle;

	// Set stars and mission display
	if (optimizeMode === "campaign") {
		clone.querySelector(".totalStars").textContent = result.totalStars || 0;
		clone.querySelector(".lastCleared").textContent = result.lastCleared || 0;
	} else {
		clone.querySelector(".totalStars").textContent = "N/A";
		clone.querySelector(".lastCleared").textContent = "N/A";
	}

	// Set initial radio button state
	const battleRadio = clone.querySelector("#battleStats");
	const arenaRadio = clone.querySelector("#arenaStats");

	if (optimizeMode === "arena") {
		battleRadio.checked = false;
		arenaRadio.checked = true;
	} else {
		battleRadio.checked = true;
		arenaRadio.checked = false;
	}

	// Build position map for formation slots
	const slots = clone.querySelectorAll(".machine-slot[data-position]");
	const positionMap = new Map();
	slots.forEach((slot) => {
		const position = slot.getAttribute("data-position");
		positionMap.set(position, slot);
	});

	const machineTemplate = document.getElementById("machineTemplate");

	// Populate formation slots with machine cards
	// Note: We're appending to slots within the clone DocumentFragment,
	// so all DOM manipulations happen before the single insert to container
	result.formation.forEach((machine, index) => {
		const position = String(index + 1);
		const slot = positionMap.get(position);
		if (!slot) return;

		const machineCard = createMachineCard(machine, machineTemplate);
		slot.appendChild(machineCard);
	});

	// Single DOM insertion - everything was built in the fragment
	container.appendChild(clone);

	// Update all machine cards to show correct initial stats
	const initialMode = optimizeMode === "arena" ? "arena" : "battle";
	document.querySelectorAll(".machine-card").forEach((card) => {
		updateMachineStats(card, initialMode);
	});

	// Set up stats toggle event listener
	setupStatsToggle(result, container);
}