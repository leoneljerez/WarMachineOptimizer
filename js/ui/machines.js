// ui/machines.js
import { createSection, createFormRow, createNumberInput, createSelect, createListItem, updateListItem, createDetailHeader } from "./formHelpers.js";
import { AppConfig } from "../config.js";
import { createMachinesBulkTable } from "./bulkEdit.js";
import { triggerAutoSave, store } from "../app.js";

// Track current view mode
let currentMachineView = "normal"; // "normal" or "bulk"

/**
 * Renders the machine list and sets up selection
 * @param {import('../app.js').Machine[]} machines - Array of machine objects
 */
export function renderMachines(machines) {
	const machinesSection = document.querySelector("#machinesTab > div:last-child");

	if (currentMachineView === "bulk") {
		renderMachinesBulkView(machines, machinesSection);
		return;
	}

	const list = document.getElementById("machineList");
	const details = document.getElementById("machineDetails");

	list.replaceChildren();
	details.replaceChildren();

	// Show normal containers, hide bulk
	const children = machinesSection.children;
	for (let i = 0; i < children.length; i++) {
		children[i].style.display = (children[i].id === "machinesBulkContainer") ? "none" : "";
	}

	let selectedButton = null;
	const fragment = document.createDocumentFragment();
	
	// Cache the length
	const len = machines.length;

	for (let i = 0; i < len; i++) {
		const machine = machines[i];
		
		const updateStats = () => {
			const configured = isConfiguredMachine(machine);
			updateListItem(btn, formatMachineStats(machine), configured);
		};

		const btn = createListItem({
			image: machine.image,
			name: machine.name,
			statsText: formatMachineStats(machine),
			isConfigured: isConfiguredMachine(machine),
			onClick: () => selectMachine(machine, btn, updateStats),
		});
		btn.dataset.machineId = machine.id;

		fragment.appendChild(btn);

		if (i === 0) {
			btn.classList.add("active");
			selectedButton = btn;
			queueMicrotask(() => renderMachineDetails(machine, details, updateStats));
		}
	}

	list.appendChild(fragment);

	function selectMachine(machine, btn, updateStats) {
		if (selectedButton) selectedButton.classList.remove("active");
		selectedButton = btn;
		btn.classList.add("active");
		renderMachineDetails(machine, details, updateStats);
	}
}

/**
 * Formats machine stats for display
 * @param {import('../app.js').Machine} machine - Hero object
 * @returns {string} Formatted stats string
 */
function formatMachineStats({ level, rarity }) {
	return `Lv. ${level} • ${rarity}`;
}

/**
 * Checks if a machine has non-default configuration
 * @param {import('../app.js').Machine} machine - Machine object
 * @returns {boolean} True if configured
 */
function isConfiguredMachine({ rarity, level, blueprints }) {
	const hasBlueprints = Object.values(blueprints).some(v => v > 0);
	return hasBlueprints || level > 0 || rarity.toLowerCase() !== "common";
}

/**
 * Renders machine details in the detail pane
 * @param {import('../app.js').Machine} machine - Machine object
 * @param {HTMLElement} container - Detail container element
 * @param {Function} updateListStats - Callback to update list stats
 */
function renderMachineDetails(machine, container, updateListStats) {
	container.replaceChildren();
	container.appendChild(createMachineDetailView(machine, updateListStats));
}

/**
 * Creates the detailed view for a machine
 * @param {import('../app.js').Machine} machine - Machine object
 * @param {Function} updateListStats - Callback to update list stats
 * @returns {HTMLElement} Detail view container
 */
function createMachineDetailView(machine, updateListStats) {
	const { id, name, image } = machine;
	const wrapper = document.createElement("div");
	wrapper.className = "machine-detail-view";

	const header = createDetailHeader({
		image,
		name,
		onReset: () => {
			if (confirm(`Reset ${name} to default values?`)) {
				resetMachine(machine);
				wrapper.replaceWith(createMachineDetailView(machine, updateListStats));
				updateListStats();
				triggerAutoSave(store);
			}
		},
	});

	const form = document.createElement("form");
	form.className = "machine-form";

	const machineId = `machine-${id}`;
	const updateAndSave = () => {
		updateListStats();
		triggerAutoSave(store);
	};

	// General section
	const generalSection = createSection("General", [
		createFormRow(
			"Rarity",
			createSelect(AppConfig.RARITY_LABELS, machine.rarity, e => { machine.rarity = e.target.value; updateAndSave(); }, `${machineId}-rarity`),
			"col-md-6"
		),
		createFormRow("Level", createNumberInput(machine, "level", updateAndSave, 0, 1, `${machineId}-level`), "col-md-6"),
	]);

	// Blueprint Levels section using mapping
	const blueprintFields = ["damage", "health", "armor"];
	const blueprintRows = blueprintFields.map(field =>
		createFormRow(
			field[0].toUpperCase() + field.slice(1),
			createNumberInput(machine.blueprints, field, updateAndSave, 0, 1, `${machineId}-bp-${field}`),
			"col-md-4"
		)
	);
	const blueprintSection = createSection("Blueprint Levels", blueprintRows);

	form.append(generalSection, blueprintSection);
	wrapper.append(header, form);
	return wrapper;
}

/**
 * Resets a machine to default values
 * @param {import('../app.js').Machine} machine - Machine object
 */
function resetMachine(machine) {
	machine.rarity = AppConfig.RARITY_LABELS[0];
	machine.level = AppConfig.DEFAULTS.LEVEL;
	Object.keys(machine.blueprints).forEach(key => machine.blueprints[key] = AppConfig.DEFAULTS.BLUEPRINT_LEVEL);
}

/**
 * Renders the bulk edit view for machines
 * @param {import('../app.js').Machine[]} machines - Array of machine objects
 */
function renderMachinesBulkView(machines, machinesSection) {
	// Hide normal containers
	for (const child of machinesSection.children) child.style.display = "none";

	// Find or create bulk container
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

/**
 * Switches to bulk edit view
 * @param {import('../app.js').Machine[]} machines - Array of machine objects
 */
export function switchToBulkEditMachines(machines) {
	currentMachineView = "bulk";
	renderMachines(machines);
}
