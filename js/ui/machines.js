// ui/machines.js
import { createSection, createFormRow, createNumberInput, createSelect, createListItem, updateListItem, createDetailHeader } from "./formHelpers.js";
import { AppConfig } from "../config.js";
import { createMachinesBulkTable } from "./bulkEdit.js";
import { triggerAutoSave, store } from "../app.js";

let currentMachineView = "normal";
let currentMachineId = null;
let machinesMap = new Map();

/**
 * Renders the machine list and sets up selection
 */
export function renderMachines(machines) {
	machinesMap.clear();
	machines.forEach((machine) => machinesMap.set(String(machine.id), machine));

	const machinesSection = document.querySelector("#machinesTab > div:last-child");

	if (currentMachineView === "bulk") {
		renderMachinesBulkView(machines, machinesSection);
		return;
	}

	const list = document.getElementById("machineList");
	const details = document.getElementById("machineDetails");

	const children = machinesSection.children;
	for (let i = 0; i < children.length; i++) {
		children[i].style.display = children[i].id === "machinesBulkContainer" ? "none" : "";
	}

	setupMachineEventDelegation(list, details);
	renderMachineList(machines, list);

	const machineToSelect = currentMachineId ? machinesMap.get(currentMachineId) || machines[0] : machines[0];

	if (machineToSelect) {
		currentMachineId = String(machineToSelect.id);
		updateActiveButton(list, currentMachineId);
		renderMachineDetails(machineToSelect, details);
	}
}

/**
 * Sets up event delegation
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

function handleMachineListClick(e) {
	const btn = e.target.closest(".list-group-item");
	if (!btn) return;

	const machineId = btn.dataset.itemId;
	const machine = machinesMap.get(machineId);
	if (!machine) return;

	const list = document.getElementById("machineList");
	const details = document.getElementById("machineDetails");

	currentMachineId = machineId;
	updateActiveButton(list, machineId);
	renderMachineDetails(machine, details);
}

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

	const list = document.getElementById("machineList");
	const btn = list.querySelector(`[data-item-id="${currentMachineId}"]`);
	if (btn) {
		updateListItem(btn, formatMachineStats(machine), isConfiguredMachine(machine));
	}

	triggerAutoSave(store);
}

function handleMachineChange(e) {
	const select = e.target;
	if (select.tagName !== "SELECT") return;

	const machine = machinesMap.get(currentMachineId);
	if (!machine) return;

	const key = select.dataset.key;
	if (key === "rarity") {
		machine.rarity = select.value;

		const list = document.getElementById("machineList");
		const btn = list.querySelector(`[data-item-id="${currentMachineId}"]`);
		if (btn) {
			updateListItem(btn, formatMachineStats(machine), isConfiguredMachine(machine));
		}

		triggerAutoSave(store);
	}
}

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

function handleMachineReset(e) {
	const resetBtn = e.target.closest('[data-action="reset"]');
	if (!resetBtn) return;

	const machine = machinesMap.get(currentMachineId);
	if (!machine) return;

	if (confirm(`Reset ${machine.name} to default values?`)) {
		resetMachine(machine);

		const details = document.getElementById("machineDetails");
		renderMachineDetails(machine, details);

		const list = document.getElementById("machineList");
		const btn = list.querySelector(`[data-item-id="${currentMachineId}"]`);
		if (btn) {
			updateListItem(btn, formatMachineStats(machine), isConfiguredMachine(machine));
		}

		triggerAutoSave(store);
	}
}

function renderMachineList(machines, list) {
	const fragment = document.createDocumentFragment();

	machines.forEach((machine) => {
		const btn = createListItem({
			id: String(machine.id),
			image: machine.image,
			name: machine.name,
			statsText: formatMachineStats(machine),
			isConfigured: isConfiguredMachine(machine),
		});

		fragment.appendChild(btn);
	});

	list.replaceChildren(fragment);
}

function updateActiveButton(list, machineId) {
	const buttons = list.querySelectorAll(".list-group-item");
	buttons.forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.itemId === machineId);
	});
}

function formatMachineStats({ level, rarity }) {
	return `Lv. ${level} • ${rarity}`;
}

function isConfiguredMachine({ rarity, level, blueprints }) {
	const hasBlueprints = Object.values(blueprints).some((v) => v > 0);
	return hasBlueprints || level > 0 || rarity.toLowerCase() !== "common";
}

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
	const blueprintRows = blueprintFields.map((field) =>
		createFormRow(field[0].toUpperCase() + field.slice(1), createNumberInput(machine.blueprints[field], 0, 1, `${machineId}-bp-${field}`, field), "col-md-4"),
	);
	const blueprintSection = createSection("Blueprint Levels", blueprintRows);

	form.append(generalSection, blueprintSection);
	wrapper.append(header, form);

	container.replaceChildren(wrapper);
}

function resetMachine(machine) {
	machine.rarity = AppConfig.RARITY_LABELS[0];
	machine.level = AppConfig.DEFAULTS.LEVEL;
	Object.keys(machine.blueprints).forEach((key) => (machine.blueprints[key] = AppConfig.DEFAULTS.BLUEPRINT_LEVEL));
}

function renderMachinesBulkView(machines, machinesSection) {
	for (const child of machinesSection.children) child.style.display = "none";

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
	backButton.innerHTML = '<i class="bi bi-arrow-left me-2"></i>Back to Normal View';
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

export function switchToBulkEditMachines(machines) {
	currentMachineView = "bulk";
	renderMachines(machines);
}

export function updateMachineInList(machineId) {
	const list = document.getElementById("machineList");
	const btn = list.querySelector(`[data-item-id="${machineId}"]`);
	if (!btn) return;

	const machine = machinesMap.get(machineId);
	if (!machine) return;

	updateListItem(btn, formatMachineStats(machine), isConfiguredMachine(machine));
}
