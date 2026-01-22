// ui/machines.js
import { createSection, createFormRow, createNumberInput, createSelect, createListItem, updateListItem, createDetailHeader } from "./formHelpers.js";
import { AppConfig } from "../config.js";
import { createMachinesBulkTable } from "./bulkEdit.js";
import { triggerAutoSave, store } from "../app.js";

/** @type {"normal"|"bulk"} Current view mode for machines */
let currentMachineView = "normal";
/** @type {string|null} Currently selected machine ID */
let currentMachineId = null;
/** @type {Map<string, Object>} Map of machine IDs to machine objects for O(1) lookup */
let machinesMap = new Map();

// Cache DOM elements
let listElement = null;
let detailsElement = null;

/**
 * Renders the machine list and detail view
 * Handles both normal and bulk edit modes
 * @param {Object[]} machines - Array of machine objects
 * @param {string} machines[].id - Unique machine identifier
 * @param {string} machines[].name - Machine name
 * @param {string} machines[].image - Machine image URL
 * @param {string} machines[].rarity - Machine rarity level
 * @param {number} machines[].level - Machine level
 * @param {Object} machines[].blueprints - Blueprint levels
 * @param {number} machines[].blueprints.damage - Damage blueprint level
 * @param {number} machines[].blueprints.health - Health blueprint level
 * @param {number} machines[].blueprints.armor - Armor blueprint level
 */
export function renderMachines(machines) {
	machinesMap.clear();
	const machinesLen = machines.length;
	for (let i = 0; i < machinesLen; i++) {
		machinesMap.set(String(machines[i].id), machines[i]);
	}

	const machinesSection = document.querySelector("#machinesTab > div:last-child");

	if (currentMachineView === "bulk") {
		renderMachinesBulkView(machines, machinesSection);
		return;
	}

	listElement = listElement || document.getElementById("machineList");
	detailsElement = detailsElement || document.getElementById("machineDetails");

	const children = machinesSection.children;
	const childrenLen = children.length;
	for (let i = 0; i < childrenLen; i++) {
		children[i].style.display = children[i].id === "machinesBulkContainer" ? "none" : "";
	}

	setupMachineEventDelegation(listElement, detailsElement);
	renderMachineList(machines, listElement);

	const machineToSelect = currentMachineId ? machinesMap.get(currentMachineId) || machines[0] : machines[0];

	if (machineToSelect) {
		currentMachineId = String(machineToSelect.id);
		updateActiveButton(listElement, currentMachineId);
		renderMachineDetails(machineToSelect, detailsElement);
	}
}

/**
 * Sets up event delegation for machine list and details (idempotent)
 * @param {HTMLElement} list - List container element
 * @param {HTMLElement} details - Details container element
 */
function setupMachineEventDelegation(list, details) {
	if (list._hasMachineListeners && details._hasMachineListeners) return;

	if (!list._hasMachineListeners) {
		const listContainer = list.classList.contains("list-group") ? list : list.querySelector(".list-group") || list;
		listContainer.addEventListener("click", handleMachineListClick);
		list._hasMachineListeners = true;
	}

	if (!details._hasMachineListeners) {
		details.addEventListener("input", handleMachineInput);
		details.addEventListener("change", handleMachineChange);
		details.addEventListener("blur", handleMachineBlur, true);
		details.addEventListener("click", handleMachineReset);
		details._hasMachineListeners = true;
	}
}

/**
 * Handles clicks on machine list items
 * @param {Event} e - Click event
 */
function handleMachineListClick(e) {
	const btn = e.target.closest(".list-group-item");
	if (!btn) return;

	const machineId = btn.dataset.itemId;
	const machine = machinesMap.get(machineId);
	if (!machine) return;

	currentMachineId = machineId;
	updateActiveButton(listElement, machineId);
	renderMachineDetails(machine, detailsElement);
}

/**
 * Handles input changes on machine number fields
 * @param {Event} e - Input event
 */
function handleMachineInput(e) {
	const input = e.target;
	if (input.type !== "number") return;

	const machine = machinesMap.get(currentMachineId);
	if (!machine) return;

	const key = input.dataset.key;
	if (!key) return;

	const val = parseInt(input.value, 10);

	if (key in machine.blueprints) {
		machine.blueprints[key] = isNaN(val) ? 0 : Math.max(0, val);
	} else if (key === "level") {
		machine[key] = isNaN(val) ? 0 : Math.max(0, val);
	}

	const btn = listElement.querySelector(`[data-item-id="${currentMachineId}"]`);
	if (btn) {
		updateListItem(btn, formatMachineStats(machine), isConfiguredMachine(machine));
	}

	triggerAutoSave(store);
}

/**
 * Handles change events on select elements (rarity)
 * @param {Event} e - Change event
 */
function handleMachineChange(e) {
	const select = e.target;
	if (select.tagName !== "SELECT") return;

	const machine = machinesMap.get(currentMachineId);
	if (!machine) return;

	const key = select.dataset.key;
	if (key === "rarity") {
		machine.rarity = select.value;

		const btn = listElement.querySelector(`[data-item-id="${currentMachineId}"]`);
		if (btn) {
			updateListItem(btn, formatMachineStats(machine), isConfiguredMachine(machine));
		}

		triggerAutoSave(store);
	}
}

/**
 * Handles blur events on number inputs to enforce minimum values
 * @param {Event} e - Blur event
 */
function handleMachineBlur(e) {
	const input = e.target;
	if (input.type !== "number") return;

	const val = parseInt(input.value, 10);
	const min = parseInt(input.min, 10) || 0;

	if (isNaN(val) || val < min) {
		input.value = min;

		const machine = machinesMap.get(currentMachineId);
		const key = input.dataset.key;
		if (machine && key) {
			if (key in machine.blueprints) {
				machine.blueprints[key] = min;
			} else if (key === "level") {
				machine[key] = min;
			}
			triggerAutoSave(store);
		}
	}
}

/**
 * Handles reset button clicks for machines
 * @param {Event} e - Click event
 */
function handleMachineReset(e) {
	const resetBtn = e.target.closest('[data-action="reset"]');
	if (!resetBtn) return;

	const machine = machinesMap.get(currentMachineId);
	if (!machine) return;

	if (confirm(`Reset ${machine.name} to default values?`)) {
		resetMachine(machine);

		renderMachineDetails(machine, detailsElement);

		const btn = listElement.querySelector(`[data-item-id="${currentMachineId}"]`);
		if (btn) {
			updateListItem(btn, formatMachineStats(machine), isConfiguredMachine(machine));
		}

		triggerAutoSave(store);
	}
}

/**
 * Renders the machine list
 * @param {Object[]} machines - Array of machine objects
 * @param {HTMLElement} list - List container element
 */
function renderMachineList(machines, list) {
	const fragment = document.createDocumentFragment();
	const machinesLen = machines.length;

	for (let i = 0; i < machinesLen; i++) {
		const machine = machines[i];
		const btn = createListItem({
			id: String(machine.id),
			image: machine.image,
			name: machine.name,
			statsText: formatMachineStats(machine),
			isConfigured: isConfiguredMachine(machine),
		});

		fragment.appendChild(btn);
	}

	list.replaceChildren(fragment);
}

/**
 * Updates the active state of list buttons
 * @param {HTMLElement} list - List container element
 * @param {string} machineId - ID of the machine to mark as active
 */
function updateActiveButton(list, machineId) {
	const buttons = list.querySelectorAll(".list-group-item");
	const buttonsLen = buttons.length;
	for (let i = 0; i < buttonsLen; i++) {
		buttons[i].classList.toggle("active", buttons[i].dataset.itemId === machineId);
	}
}

/**
 * Formats machine stats for display in list
 * @param {Object} machine - Machine object
 * @param {number} machine.level - Machine level
 * @param {string} machine.rarity - Machine rarity
 * @returns {string} Formatted stats string
 */
function formatMachineStats({ level, rarity }) {
	return `Lv. ${level} • ${rarity}`;
}

/**
 * Checks if a machine has been configured (non-default values)
 * @param {Object} machine - Machine object
 * @param {string} machine.rarity - Machine rarity
 * @param {number} machine.level - Machine level
 * @param {Object} machine.blueprints - Blueprint levels
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
 * Renders the machine details form
 * @param {Object} machine - Machine object
 * @param {HTMLElement} container - Details container element
 */
function renderMachineDetails(machine, container) {
	const { id, name, image } = machine;
	const wrapper = document.createElement("div");
	wrapper.className = "machine-detail-view";

	const header = createDetailHeader({
		image,
		name,
	});

	const form = document.createElement("form");
	form.className = "machine-form";

	const machineId = `machine-${id}`;

	const generalSection = createSection("General", [
		createFormRow("Rarity", createSelect(AppConfig.RARITY_LABELS, machine.rarity, `${machineId}-rarity`, "rarity"), "col-md-6"),
		createFormRow("Level", createNumberInput(machine.level, 0, 1, `${machineId}-level`, "level"), "col-md-6"),
	]);

	const blueprintFields = ["damage", "health", "armor"];
	const blueprintRows = [];
	for (let i = 0; i < 3; i++) {
		const field = blueprintFields[i];
		blueprintRows.push(createFormRow(field[0].toUpperCase() + field.slice(1), createNumberInput(machine.blueprints[field], 0, 1, `${machineId}-bp-${field}`, field), "col-md-4"));
	}
	const blueprintSection = createSection("Blueprint Levels", blueprintRows);

	form.append(generalSection, blueprintSection);
	wrapper.append(header, form);

	container.replaceChildren(wrapper);
}

/**
 * Resets a machine to default values
 * @param {Object} machine - Machine object to reset
 */
function resetMachine(machine) {
	machine.rarity = AppConfig.RARITY_LABELS[0];
	machine.level = AppConfig.DEFAULTS.LEVEL;
	const keys = Object.keys(machine.blueprints);
	const keysLen = keys.length;
	for (let i = 0; i < keysLen; i++) {
		machine.blueprints[keys[i]] = AppConfig.DEFAULTS.BLUEPRINT_LEVEL;
	}
}

/**
 * Renders the bulk edit view for all machines
 * @param {Object[]} machines - Array of machine objects
 * @param {HTMLElement} machinesSection - Section container element
 */
function renderMachinesBulkView(machines, machinesSection) {
	const children = machinesSection.children;
	const childrenLen = children.length;
	for (let i = 0; i < childrenLen; i++) children[i].style.display = "none";

	let bulkContainer = document.getElementById("machinesBulkContainer");
	if (!bulkContainer) {
		bulkContainer = document.createElement("div");
		bulkContainer.id = "machinesBulkContainer";
		bulkContainer.className = "col-12";
		machinesSection.appendChild(bulkContainer);
	} else {
		bulkContainer.replaceChildren();
	}
	bulkContainer.style.display = "block";

	const card = document.createElement("div");
	card.className = "card card-hover";

	const cardHeader = document.createElement("div");
	cardHeader.className = "card-header d-flex justify-content-between align-items-center";

	const title = document.createElement("h5");
	title.className = "mb-0";
	title.textContent = "Bulk Edit - All Machines";

	const backButton = document.createElement("button");
	backButton.type = "button";
	backButton.className = "btn btn-sm btn-outline-secondary";

	const backIcon = document.createElement("i");
	backIcon.className = "bi bi-arrow-left me-2";
	backButton.appendChild(backIcon);
	backButton.appendChild(document.createTextNode("Back to Normal View"));

	backButton.addEventListener("click", () => {
		currentMachineView = "normal";
		renderMachines(store.machines);
	});

	cardHeader.append(title, backButton);

	const cardBody = document.createElement("div");
	cardBody.className = "card-body p-0";
	cardBody.appendChild(createMachinesBulkTable(machines));

	card.append(cardHeader, cardBody);
	bulkContainer.appendChild(card);
}

/**
 * Switches to bulk edit view for machines
 * @param {Object[]} machines - Array of machine objects
 */
export function switchToBulkEditMachines(machines) {
	currentMachineView = "bulk";
	renderMachines(machines);
}

/**
 * Updates a specific machine in the list view
 * @param {string} machineId - ID of the machine to update
 */
export function updateMachineInList(machineId) {
	const btn = listElement.querySelector(`[data-item-id="${machineId}"]`);
	if (!btn) return;

	const machine = machinesMap.get(machineId);
	if (!machine) return;

	updateListItem(btn, formatMachineStats(machine), isConfiguredMachine(machine));
}
