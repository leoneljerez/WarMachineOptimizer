// ui/tavern.js
import { AppConfig } from "../config.js";
import { triggerAutoSave, store } from "../app.js";

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
	const sections = [
		{
			containerId: "tavernCardsContainer",
			type: "sacred",
			resetText: "Reset All Sacred Cards",
		},
		{
			containerId: "scarabCardsContainer",
			type: "inscription",
			resetText: "Reset All Inscription Cards",
		},
	];

	const sortedMachines = machines.slice().sort((a, b) => a.name.localeCompare(b.name));
	const cardPropertyMap = { sacred: "sacredLevel", inscription: "inscriptionLevel" };

	for (let s = 0; s < 2; s++) {
		const { containerId, type, resetText } = sections[s];
		const container = document.getElementById(containerId);
		const property = cardPropertyMap[type];

		const resetBtn = createResetButton(resetText, () => {
			if (confirm(`${resetText} to 0?`)) {
				const machinesLen = sortedMachines.length;
				for (let i = 0; i < machinesLen; i++) {
					const m = sortedMachines[i];
					m[property] = AppConfig.DEFAULTS.CARD_LEVEL;
					const input = document.getElementById(`${type}-card-machine-${m.id}`);
					if (input) input.value = AppConfig.DEFAULTS.CARD_LEVEL;
				}
				triggerAutoSave(store);
			}
		});

		const grid = document.createElement("div");
		grid.className = `row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-3 ${type}-view`;

		const fragment = document.createDocumentFragment();
		const machinesLen = sortedMachines.length;

		for (let i = 0; i < machinesLen; i++) {
			const machine = sortedMachines[i];
			const col = document.createElement("div");
			col.className = "col";
			col.appendChild(createCardLevelCard(machine, type, property));
			fragment.appendChild(col);
		}

		grid.appendChild(fragment);
		container.replaceChildren(resetBtn, grid);
	}
}

/**
 * Creates a reset button for clearing all card levels in a section
 * @param {string} text - Button text to display
 * @param {Function} onClick - Click handler function
 * @returns {HTMLElement} Button container element
 */
function createResetButton(text, onClick) {
	const buttonContainer = document.createElement("div");
	buttonContainer.className = "d-flex justify-content-end mb-3";

	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn btn-sm btn-outline-danger";
	button.textContent = text;
	button.addEventListener("click", onClick);

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
	card.className = "card h-100 card-hover";

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

	input.addEventListener("input", (e) => {
		const val = parseInt(e.target.value, 10);
		machine[property] = isNaN(val) ? 0 : Math.max(0, val);
		triggerAutoSave(store);
	});

	inputGroup.append(label, input);
	return inputGroup;
}
