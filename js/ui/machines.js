// ui/machines.js
import { createSection, createFormRow, createNumberInput, createSelect, createListItem, updateListItem, createDetailHeader } from "./formHelpers.js";
import { AppConfig } from "../config.js";
import { triggerAutoSave, store } from "../app.js";

/** @type {"normal"|"bulk"} Current view mode for machines */
let currentMachineView = "normal";
/** @type {string|null} Currently selected machine ID */
let currentMachineId = null;
/** @type {Map<string, Object>} Map of machine IDs to machine objects for O(1) lookup */
let machinesMap = new Map();

// Cache DOM elements on module load
const machinesSection = document.querySelector("#machinesTab > div:last-child");
const listElement = document.getElementById("machineList");
const detailsElement = document.getElementById("machineDetails");
let bulkContainer = document.getElementById("machinesBulkContainer");

// Create bulk container if it doesn't exist
if (!bulkContainer && machinesSection) {
	bulkContainer = document.createElement("div");
	bulkContainer.id = "machinesBulkContainer";
	bulkContainer.className = "col-12";
	bulkContainer.style.display = "none";
	machinesSection.appendChild(bulkContainer);
}

// Set up event delegation once on module load
if (machinesSection) {
	machinesSection.addEventListener("click", handleAllClicks);
	machinesSection.addEventListener("input", handleAllInputs);
	machinesSection.addEventListener("change", handleAllChanges);
	machinesSection.addEventListener("blur", handleAllBlurs, true);
}

/**
 * Handles all click events via delegation
 * @param {Event} e - Click event
 */
function handleAllClicks(e) {
	// Handle list item clicks (normal view)
	if (currentMachineView === "normal") {
		const btn = e.target.closest(".list-group-item");
		if (btn) {
			const machineId = btn.dataset.itemId;
			const machine = machinesMap.get(machineId);
			if (!machine) return;

			currentMachineId = machineId;
			updateActiveButton(machineId);
			renderMachineDetails(machine);
			return;
		}

		// Handle reset button clicks (normal view)
		const resetBtn = e.target.closest('[data-action="reset"]');
		if (resetBtn) {
			const machine = machinesMap.get(currentMachineId);
			if (!machine) return;

			if (confirm(`Reset ${machine.name} to default values?`)) {
				resetMachine(machine);
				renderMachineDetails(machine);
				updateMachineInList(currentMachineId);
				triggerAutoSave(store);
			}
			return;
		}
	}

	// Handle bulk view back button
	const backBtn = e.target.closest('[data-action="back-to-normal"]');
	if (backBtn) {
		currentMachineView = "normal";
		renderMachines(store.machines);
	}
}

/**
 * Handles all input events via delegation
 * @param {Event} e - Input event
 */
function handleAllInputs(e) {
	const input = e.target;
	if (input.type !== "number") return;

	// Normal view - detail inputs
	if (currentMachineView === "normal") {
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

		updateMachineInList(currentMachineId);
		triggerAutoSave(store);
	}
	// Bulk view - table inputs
	else if (currentMachineView === "bulk") {
		const machineId = input.dataset.machineId;
		const field = input.dataset.field;
		const machine = machinesMap.get(machineId);
		if (!machine) return;

		const val = parseInt(input.value, 10);
		const validVal = isNaN(val) ? 0 : Math.max(0, val);

		if (field === "level") {
			machine.level = validVal;
		} else if (field in machine.blueprints) {
			machine.blueprints[field] = validVal;
		}

		triggerAutoSave(store);
	}
}

/**
 * Handles all change events via delegation
 * @param {Event} e - Change event
 */
function handleAllChanges(e) {
	const select = e.target;
	if (select.tagName !== "SELECT") return;

	// Normal view - rarity select
	if (currentMachineView === "normal") {
		const machine = machinesMap.get(currentMachineId);
		if (!machine) return;

		const key = select.dataset.key;
		if (key === "rarity") {
			machine.rarity = select.value;
			updateMachineInList(currentMachineId);
			triggerAutoSave(store);
		}
	}
	// Bulk view - rarity select
	else if (currentMachineView === "bulk") {
		const machineId = select.dataset.machineId;
		const machine = machinesMap.get(machineId);
		if (!machine) return;

		machine.rarity = select.value;
		triggerAutoSave(store);
	}
}

/**
 * Handles all blur events via delegation
 * @param {Event} e - Blur event
 */
function handleAllBlurs(e) {
	const input = e.target;
	if (input.type !== "number") return;

	const val = parseInt(input.value, 10);
	const min = parseInt(input.min, 10) || 0;

	if (isNaN(val) || val < min) {
		input.value = min;

		if (currentMachineView === "normal") {
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
		} else if (currentMachineView === "bulk") {
			const machineId = input.dataset.machineId;
			const field = input.dataset.field;
			const machine = machinesMap.get(machineId);
			if (machine && field) {
				if (field === "level") {
					machine.level = min;
				} else if (field in machine.blueprints) {
					machine.blueprints[field] = min;
				}
				triggerAutoSave(store);
			}
		}
	}
}

/**
 * Renders the machine list and detail view
 * Handles both normal and bulk edit modes
 * @param {Object[]} machines - Array of machine objects
 */
export function renderMachines(machines) {
	machinesMap.clear();
	const machinesLen = machines.length;
	for (let i = 0; i < machinesLen; i++) {
		machinesMap.set(String(machines[i].id), machines[i]);
	}

	if (currentMachineView === "bulk") {
		renderMachinesBulkView(machines);
		return;
	}

	// Show normal view, hide bulk view
	bulkContainer.style.display = "none";
	const children = machinesSection.children;
	const childrenLen = children.length;
	for (let i = 0; i < childrenLen; i++) {
		children[i].style.display = children[i].id === "machinesBulkContainer" ? "none" : "";
	}

	renderMachineList(machines);

	const machineToSelect = currentMachineId ? machinesMap.get(currentMachineId) || machines[0] : machines[0];

	if (machineToSelect) {
		currentMachineId = String(machineToSelect.id);
		updateActiveButton(currentMachineId);
		renderMachineDetails(machineToSelect);
	}
}

/**
 * Renders the machine list
 * @param {Object[]} machines - Array of machine objects
 */
function renderMachineList(machines) {
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

	listElement.replaceChildren(fragment);
}

/**
 * Updates the active state of list buttons
 * @param {string} machineId - ID of the machine to mark as active
 */
function updateActiveButton(machineId) {
	const buttons = listElement.querySelectorAll(".list-group-item");
	const buttonsLen = buttons.length;
	for (let i = 0; i < buttonsLen; i++) {
		buttons[i].classList.toggle("active", buttons[i].dataset.itemId === machineId);
	}
}

/**
 * Formats machine stats for display in list
 * NOW: Multi-line with level/rarity and blueprints (full labels)
 * @param {Object} machine - Machine object
 * @returns {string} Formatted stats string
 */
function formatMachineStats(machine) {
	const { level, rarity, blueprints } = machine;
	const bp = blueprints;
	const displayRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
	return `Lv.${level} • ${displayRarity}\nDmg ${bp.damage} • Hp ${bp.health} • Arm ${bp.armor}`;
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
 * Renders the machine details form
 * NOW: Uses tags array for badges, ability and base stats integrated
 * @param {Object} machine - Machine object
 */
function renderMachineDetails(machine) {
	const { id, name, image, level, rarity, blueprints, tags, ability, baseStats } = machine;
	const wrapper = document.createElement("div");
	wrapper.className = "machine-detail-view";

	// Create badges from tags array
	const badges = [];
	if (tags && tags.length > 0) {
		// First tag is the role (tank/dps) - use color coding
		const roleTag = tags[0].toLowerCase();
		badges.push({
			text: tags[0],
			color: roleTag === "tank" ? "primary" : roleTag === "healer" ? "success" : "danger",
		});

		// Add remaining tags as secondary badges
		for (let i = 1; i < tags.length; i++) {
			badges.push({
				text: tags[i],
				color: "secondary",
			});
		}
	}

	// ENHANCED HEADER: Image + Name/Badges on left, Reset on right
	const header = createDetailHeader({
		image,
		name,
		badges,
	});

	// === ABILITY & BASE STATS (directly below header, before form) ===
	const infoSection = document.createElement("div");
	infoSection.className = "row g-3 mb-4";

	// Ability column (if exists)
	if (ability && ability.description) {
		const abilityCol = document.createElement("div");
		abilityCol.className = baseStats ? "col-md-7" : "col-12";

		const abilityCard = document.createElement("div");
		abilityCard.className = "card bg-info bg-opacity-10 border-info border-opacity-25 h-100";

		const abilityBody = document.createElement("div");
		abilityBody.className = "card-body p-3";

		const abilityHeader = document.createElement("div");
		abilityHeader.className = "d-flex align-items-center gap-2 mb-2";

		const icon = document.createElement("i");
		icon.className = "bi bi-lightning-charge-fill text-info";

		const abilityTitle = document.createElement("h6");
		abilityTitle.className = "mb-0 text-info";
		abilityTitle.textContent = "Ability";

		abilityHeader.append(icon, abilityTitle);

		const abilityDesc = document.createElement("div");
		abilityDesc.className = "small";
		abilityDesc.textContent = ability.description;

		abilityBody.append(abilityHeader, abilityDesc);
		abilityCard.appendChild(abilityBody);
		abilityCol.appendChild(abilityCard);
		infoSection.appendChild(abilityCol);
	}

	// Base stats column (if exists)
	if (baseStats) {
		const statsCol = document.createElement("div");
		statsCol.className = ability && ability.description ? "col-md-5" : "col-12";

		const statsCard = document.createElement("div");
		statsCard.className = "card bg-secondary bg-opacity-10 border-secondary border-opacity-25 h-100";

		const statsBody = document.createElement("div");
		statsBody.className = "card-body p-3";

		const statsTitle = document.createElement("h6");
		statsTitle.className = "mb-2 text-secondary";
		statsTitle.textContent = "Base Stats";

		const statsList = document.createElement("div");
		statsList.className = "small";
		const createStatRow = (label, value, addMargin = true) => {
			const row = document.createElement("div");
			if (addMargin) row.classList.add("mb-1");

			const strong = document.createElement("strong");
			strong.textContent = `${label}: `;

			row.appendChild(strong);
			row.appendChild(document.createTextNode(value.toLocaleString()));

			return row;
		};

		statsList.appendChild(createStatRow("Damage", baseStats.damage));
		statsList.appendChild(createStatRow("Health", baseStats.health));
		statsList.appendChild(createStatRow("Armor", baseStats.armor, false));

		statsBody.append(statsTitle, statsList);
		statsCard.appendChild(statsBody);
		statsCol.appendChild(statsCard);
		infoSection.appendChild(statsCol);
	}

	const form = document.createElement("form");
	form.className = "machine-form";

	const machineId = `machine-${id}`;

	// === BASIC INFORMATION SECTION ===
	const generalSection = createSection("BASIC INFORMATION", [
		createFormRow("Rarity", createSelect(AppConfig.RARITY_LABELS, rarity, `${machineId}-rarity`, "rarity"), "col-md-6"),
		createFormRow("Level", createNumberInput(level, 0, 1, `${machineId}-level`, "level"), "col-md-6"),
	]);

	// === BLUEPRINT LEVELS SECTION ===
	const blueprintFields = ["damage", "health", "armor"];
	const blueprintRows = [];
	for (let i = 0; i < 3; i++) {
		const field = blueprintFields[i];
		blueprintRows.push(createFormRow(field[0].toUpperCase() + field.slice(1), createNumberInput(blueprints[field], 0, 1, `${machineId}-bp-${field}`, field), "col-md-4"));
	}
	const blueprintSection = createSection("BLUEPRINT LEVELS", blueprintRows);

	form.append(generalSection, blueprintSection);

	wrapper.append(header, infoSection, form);

	detailsElement.replaceChildren(wrapper);
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
 * Creates a bulk edit table for machines
 * @param {Object[]} machines - Array of machine objects
 * @returns {HTMLElement} Table container with responsive wrapper
 */
function createMachinesBulkTable(machines) {
	const container = document.createElement("div");
	container.className = "table-responsive";
	container.style.width = "100%";

	const table = document.createElement("table");
	table.className = "table table-striped table-hover align-middle";
	table.setAttribute("role", "grid");

	const thead = document.createElement("thead");
	thead.className = "table-dark sticky-top";
	const headerRow = document.createElement("tr");
	headerRow.setAttribute("role", "row");

	const headers = ["Machine", "Rarity", "Level", "Damage BP", "Health BP", "Armor BP"];
	const widths = ["200px", "150px", "100px", "110px", "110px", "110px"];

	for (let i = 0; i < 6; i++) {
		const th = document.createElement("th");
		th.setAttribute("role", "columnheader");
		th.scope = "col";
		th.textContent = headers[i];
		th.style.width = widths[i];
		headerRow.appendChild(th);
	}

	thead.appendChild(headerRow);
	table.appendChild(thead);

	const tbody = document.createElement("tbody");
	const fragment = document.createDocumentFragment();
	const machinesLen = machines.length;

	for (let i = 0; i < machinesLen; i++) {
		fragment.appendChild(createMachineRow(machines[i], i));
	}

	tbody.appendChild(fragment);
	table.append(thead, tbody);
	container.appendChild(table);

	return container;
}

/**
 * Creates a single editable machine row for the bulk edit table
 * @param {Object} machine - Machine object
 * @param {number} index - Row index for tab ordering
 * @returns {HTMLElement} Table row with input fields
 */
function createMachineRow(machine, index) {
	const row = document.createElement("tr");
	row.setAttribute("role", "row");

	const nameCell = document.createElement("td");
	nameCell.setAttribute("role", "gridcell");
	const nameDiv = document.createElement("div");
	nameDiv.className = "d-flex align-items-center gap-2";

	const img = document.createElement("img");
	img.src = machine.image;
	img.alt = "";
	img.className = "rounded";
	img.style.cssText = "width:32px;height:32px;object-fit:cover";
	img.setAttribute("aria-hidden", "true");

	const nameSpan = document.createElement("span");
	nameSpan.className = "fw-semibold";
	nameSpan.textContent = machine.name;

	nameDiv.append(img, nameSpan);
	nameCell.appendChild(nameDiv);
	row.appendChild(nameCell);

	const rarityCell = document.createElement("td");
	rarityCell.setAttribute("role", "gridcell");

	const raritySelect = document.createElement("select");
	raritySelect.className = "form-select form-select-sm";
	raritySelect.id = `bulk-machine-${machine.id}-rarity`;
	raritySelect.setAttribute("aria-label", `${machine.name} rarity`);
	raritySelect.tabIndex = index * 5 + 1;
	raritySelect.dataset.machineId = String(machine.id);

	const rarityLabels = AppConfig.RARITY_LABELS;
	const rarityLen = rarityLabels.length;
	for (let i = 0; i < rarityLen; i++) {
		const rarity = rarityLabels[i];
		const option = document.createElement("option");
		option.value = rarity;
		option.textContent = rarity;
		option.selected = machine.rarity === rarity;
		raritySelect.appendChild(option);
	}

	rarityCell.appendChild(raritySelect);
	row.appendChild(rarityCell);

	const levelCell = document.createElement("td");
	levelCell.setAttribute("role", "gridcell");

	const levelInput = document.createElement("input");
	levelInput.type = "number";
	levelInput.className = "form-control form-control-sm";
	levelInput.id = `bulk-machine-${machine.id}-level`;
	levelInput.min = 0;
	levelInput.step = 1;
	levelInput.value = machine.level;
	levelInput.setAttribute("aria-label", `${machine.name} level`);
	levelInput.tabIndex = index * 5 + 2;
	levelInput.dataset.machineId = String(machine.id);
	levelInput.dataset.field = "level";

	levelCell.appendChild(levelInput);
	row.appendChild(levelCell);

	const blueprintStats = ["damage", "health", "armor"];
	for (let i = 0; i < 3; i++) {
		const stat = blueprintStats[i];
		const cell = document.createElement("td");
		cell.setAttribute("role", "gridcell");

		const input = document.createElement("input");
		input.type = "number";
		input.className = "form-control form-control-sm";
		input.id = `bulk-machine-${machine.id}-bp-${stat}`;
		input.min = 0;
		input.step = 1;
		input.value = machine.blueprints[stat];
		input.setAttribute("aria-label", `${machine.name} ${stat} blueprint`);
		input.tabIndex = index * 5 + 3 + i;
		input.dataset.machineId = String(machine.id);
		input.dataset.field = stat;

		cell.appendChild(input);
		row.appendChild(cell);
	}

	return row;
}

/**
 * Renders the bulk edit view for all machines
 * @param {Object[]} machines - Array of machine objects
 */
function renderMachinesBulkView(machines) {
	// Hide normal view, show bulk view
	const children = machinesSection.children;
	const childrenLen = children.length;
	for (let i = 0; i < childrenLen; i++) children[i].style.display = "none";

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
	backButton.dataset.action = "back-to-normal";

	const backIcon = document.createElement("i");
	backIcon.className = "bi bi-arrow-left me-2";
	backButton.appendChild(backIcon);
	backButton.appendChild(document.createTextNode("Back to Normal View"));

	cardHeader.append(title, backButton);

	const cardBody = document.createElement("div");
	cardBody.className = "card-body p-0";
	cardBody.appendChild(createMachinesBulkTable(machines));

	card.append(cardHeader, cardBody);
	bulkContainer.replaceChildren(card);
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
