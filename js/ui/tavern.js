// ui/tavern.js
import { AppConfig } from "../config.js";
import { triggerAutoSave, store } from "../app.js";

// Cache DOM elements on module load
const sacredContainer = document.getElementById("tavernCardsContainer");
const inscriptionContainer = document.getElementById("scarabCardsContainer");

// Set up event delegation once on module load
if (sacredContainer) {
	sacredContainer.addEventListener("input", handleSacredInput);
	sacredContainer.addEventListener("click", handleSacredReset);
}

if (inscriptionContainer) {
	inscriptionContainer.addEventListener("input", handleInscriptionInput);
	inscriptionContainer.addEventListener("click", handleInscriptionReset);
}

/**
 * Handles input events for sacred cards
 * @param {Event} e - Input event
 */
function handleSacredInput(e) {
	const input = e.target;
	if (input.type !== "number") return;

	const machineId = parseInt(input.dataset.machineId, 10);
	const machine = store.machines.find((m) => m.id === machineId);
	if (!machine) return;

	const val = parseInt(input.value, 10);
	machine.sacredLevel = isNaN(val) ? 0 : Math.max(0, val);
	triggerAutoSave(store);
}

/**
 * Handles reset button for sacred cards
 * @param {Event} e - Click event
 */
function handleSacredReset(e) {
	const resetBtn = e.target.closest('[data-action="reset-sacred"]');
	if (!resetBtn) return;

	if (confirm("Reset All Sacred Cards to 0?")) {
		const machines = store.machines;
		const machinesLen = machines.length;
		for (let i = 0; i < machinesLen; i++) {
			const m = machines[i];
			m.sacredLevel = AppConfig.DEFAULTS.CARD_LEVEL;
			const input = document.getElementById(`sacred-card-machine-${m.id}`);
			if (input) input.value = AppConfig.DEFAULTS.CARD_LEVEL;
		}
		triggerAutoSave(store);
	}
}

/**
 * Handles input events for inscription cards
 * @param {Event} e - Input event
 */
function handleInscriptionInput(e) {
	const input = e.target;
	if (input.type !== "number") return;

	const machineId = parseInt(input.dataset.machineId, 10);
	const machine = store.machines.find((m) => m.id === machineId);
	if (!machine) return;

	const val = parseInt(input.value, 10);
	machine.inscriptionLevel = isNaN(val) ? 0 : Math.max(0, val);
	triggerAutoSave(store);
}

/**
 * Handles reset button for inscription cards
 * @param {Event} e - Click event
 */
function handleInscriptionReset(e) {
	const resetBtn = e.target.closest('[data-action="reset-inscription"]');
	if (!resetBtn) return;

	if (confirm("Reset All Inscription Cards to 0?")) {
		const machines = store.machines;
		const machinesLen = machines.length;
		for (let i = 0; i < machinesLen; i++) {
			const m = machines[i];
			m.inscriptionLevel = AppConfig.DEFAULTS.CARD_LEVEL;
			const input = document.getElementById(`inscription-card-machine-${m.id}`);
			if (input) input.value = AppConfig.DEFAULTS.CARD_LEVEL;
		}
		triggerAutoSave(store);
	}
}

/**
 * Checks if a machine has been configured (non-default values)
 * @param {Object} machine - Machine object
 * @returns {boolean} True if machine has non-default configuration
 */
function isConfiguredMachine({ rarity, level, blueprints }) {
	const values = Object.values(blueprints);
	const valuesLen = values.length;
	for (let i = 0; i < valuesLen; i++) {
		if (values[i] > 0) return true;
	}
	return level > 0 || rarity.toLowerCase() !== "common";
}

/**
 * Sorts machines: configured first (alphabetically), then unconfigured (alphabetically)
 * @param {Object[]} machines - Array of machine objects
 * @returns {Object[]} Sorted array of machines
 */
function sortMachinesConfiguredFirst(machines) {
	// Separate machines into configured and unconfigured
	const configured = [];
	const unconfigured = [];

	const machinesLen = machines.length;
	for (let i = 0; i < machinesLen; i++) {
		const machine = machines[i];
		if (isConfiguredMachine(machine)) {
			configured.push(machine);
		} else {
			unconfigured.push(machine);
		}
	}

	// Sort each group alphabetically by name
	configured.sort((a, b) => a.name.localeCompare(b.name));
	unconfigured.sort((a, b) => a.name.localeCompare(b.name));

	// Combine: configured first, then unconfigured
	return [...configured, ...unconfigured];
}

/**
 * Renders the tavern cards sections (Sacred and Inscription)
 * Creates grid layouts with card level inputs for each machine
 * @param {Object[]} machines - Array of machine objects
 * @param {string} machines[].id - Unique machine identifier
 * @param {string} machines[].name - Machine name
 * @param {string} machines[].image - Machine image URL
 * @param {number} machines[].sacredLevel - Sacred card level
 * @param {number} machines[].inscriptionLevel - Inscription card level
 */
export function renderTavernCards(machines) {
	const sortedMachines = sortMachinesConfiguredFirst(machines);

	// Render Sacred Cards
	renderCardSection(sacredContainer, sortedMachines, "sacred", "sacredLevel", "Reset All Sacred Cards");

	// Render Inscription Cards
	renderCardSection(inscriptionContainer, sortedMachines, "inscription", "inscriptionLevel", "Reset All Inscription Cards");
}

/**
 * Renders a single card section (sacred or inscription)
 * @param {HTMLElement} container - Container element
 * @param {Object[]} machines - Sorted array of machines
 * @param {string} type - Card type ("sacred" or "inscription")
 * @param {string} property - Property name on machine object
 * @param {string} resetText - Reset button text
 */
function renderCardSection(container, machines, type, property, resetText) {
	const resetBtn = createResetButton(resetText, type);

	const grid = document.createElement("div");
	grid.className = `row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-3 ${type}-view`;

	const fragment = document.createDocumentFragment();
	const machinesLen = machines.length;

	for (let i = 0; i < machinesLen; i++) {
		const machine = machines[i];
		const col = document.createElement("div");
		col.className = "col";
		col.appendChild(createCardLevelCard(machine, type, property));
		fragment.appendChild(col);
	}

	grid.appendChild(fragment);
	container.replaceChildren(resetBtn, grid);
}

/**
 * Creates a reset button for clearing all card levels in a section
 * @param {string} text - Button text to display
 * @param {string} type - Card type for data attribute
 * @returns {HTMLElement} Button container element
 */
function createResetButton(text, type) {
	const buttonContainer = document.createElement("div");
	buttonContainer.className = "d-flex justify-content-end mb-3";

	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn btn-sm btn-outline-danger";
	button.textContent = text;
	button.dataset.action = `reset-${type}`;

	buttonContainer.appendChild(button);
	return buttonContainer;
}

/**
 * Creates a card for managing a machine's card level
 * @param {Object} machine - Machine object
 * @param {string} machine.id - Machine identifier
 * @param {string} machine.name - Machine name
 * @param {string} machine.image - Machine image URL
 * @param {number} machine[property] - Current card level value
 * @param {string} cardType - Card type identifier ("sacred" or "inscription")
 * @param {string} property - Property name on machine object ("sacredLevel" or "inscriptionLevel")
 * @returns {HTMLElement} Card element with image, name, and input
 */
function createCardLevelCard(machine, cardType, property) {
	const { name, image } = machine;

	const card = document.createElement("div");
	card.className = "card h-100 card-shadow";

	const cardBody = document.createElement("div");
	cardBody.className = "card-body d-flex flex-column align-items-center";

	const img = document.createElement("img");
	img.src = image;
	img.alt = name;
	img.className = "rounded mb-2";
	img.style.cssText = "width:80px;height:80px;object-fit:cover";

	const title = document.createElement("h6");
	title.className = "card-title text-center mb-3";
	title.textContent = name;

	const inputGroup = createInputGroup(machine, cardType, property);

	cardBody.append(img, title, inputGroup);
	card.appendChild(cardBody);

	return card;
}

/**
 * Creates an input group for editing card level
 * @param {Object} machine - Machine object
 * @param {string} machine.id - Machine identifier
 * @param {string} machine.name - Machine name
 * @param {number} machine[property] - Current card level value
 * @param {string} cardType - Card type identifier ("sacred" or "inscription")
 * @param {string} property - Property name on machine object to update
 * @returns {HTMLElement} Input group element with label and number input
 */
function createInputGroup(machine, cardType, property) {
	const inputId = `${cardType}-card-machine-${machine.id}`;

	const inputGroup = document.createElement("div");
	inputGroup.className = "input-group input-group-sm mt-auto w-100";

	const label = document.createElement("label");
	label.className = "input-group-text";
	label.textContent = "Card Level";
	label.htmlFor = inputId;

	const input = document.createElement("input");
	input.type = "number";
	input.className = "form-control";
	input.id = inputId;
	input.min = 0;
	input.step = 1;
	input.value = machine[property];
	input.setAttribute("aria-label", `${machine.name} ${cardType} card level`);
	input.dataset.machineId = machine.id;

	inputGroup.append(label, input);
	return inputGroup;
}
