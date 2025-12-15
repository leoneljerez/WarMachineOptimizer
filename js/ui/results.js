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
	const machine = card.__machine;
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

	card.__machine = machine;

	const img = clone.querySelector(".machine-image");
	img.src = machine.image || "placeholder.png";
	img.alt = machine.name;

	clone.querySelector(".machine-name").textContent = `${machine.name} (Lv ${machine.level}, ${machine.rarity})`;

	updateMachineStats(card, "battle");

	const crewDiv = clone.querySelector(".crew");
	const fragment = document.createDocumentFragment();

	Object.values(machine.crew).forEach((hero) => {
		fragment.appendChild(createCrewImage(hero));
	});

	crewDiv.appendChild(fragment);

	return clone;
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

	if (container.__statsController) {
		container.__statsController.abort();
	}
	container.__statsController = controller;

	toggle.addEventListener(
		"change",
		(e) => {
			const mode = e.target.value;

			document.querySelectorAll(".machine-card").forEach((card) => {
				updateMachineStats(card, mode);
			});

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

	if (container.__statsController) {
		container.__statsController.abort();
		container.__statsController = null;
	}

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

	const initialPower = optimizeMode === "arena" ? result.arenaPower : result.battlePower;
	const initialTitle = optimizeMode === "arena" ? "Arena Power:" : "Battle Power:";

	clone.querySelector(".powerResult").textContent = formatPower(initialPower);
	clone.querySelector(".powerTitle").textContent = initialTitle;

	if (optimizeMode === "campaign") {
		clone.querySelector(".totalStars").textContent = result.totalStars || 0;
		clone.querySelector(".lastCleared").textContent = result.lastCleared || 0;
	} else {
		clone.querySelector(".totalStars").textContent = "N/A";
		clone.querySelector(".lastCleared").textContent = "N/A";
	}

	const battleRadio = clone.querySelector("#battleStats");
	const arenaRadio = clone.querySelector("#arenaStats");

	if (optimizeMode === "arena") {
		battleRadio.checked = false;
		arenaRadio.checked = true;
	} else {
		battleRadio.checked = true;
		arenaRadio.checked = false;
	}

	const slots = clone.querySelectorAll(".machine-slot[data-position]");
	const positionMap = {};
	slots.forEach((slot) => {
		const position = slot.getAttribute("data-position");
		positionMap[position] = slot;
	});

	const machineTemplate = document.getElementById("machineTemplate");

	result.formation.forEach((machine, index) => {
		const slot = positionMap[index + 1];
		if (!slot) return;

		const machineCard = createMachineCard(machine, machineTemplate);
		slot.appendChild(machineCard);
	});

	container.appendChild(clone);

	document.querySelectorAll(".machine-card").forEach((card) => {
		updateMachineStats(card, optimizeMode === "arena" ? "arena" : "battle");
	});

	setupStatsToggle(result, container);
}
