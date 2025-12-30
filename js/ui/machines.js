// ui/machines.js
import { createSection, createFormRow, createNumberInput, createSelect, createListItem, updateListItem, createDetailHeader } from "./formHelpers.js";
import { AppConfig } from "../config.js";

/**
 * Renders the machine list and sets up selection
 * @param {import('../app.js').Machine[]} machines - Array of machine objects
 */
export function renderMachines(machines) {
	const list = document.getElementById("machineList");
	const details = document.getElementById("machineDetails");

	list.replaceChildren();
	details.replaceChildren();

	let selectedButton = null;
	const fragment = document.createDocumentFragment();

	machines.forEach((machine, index) => {
		const updateStats = () => {
			const configured = isConfiguredMachine(machine);
			const statsText = formatMachineStats(machine);
			updateListItem(btn, statsText, configured);
		};

		const btn = createListItem({
			image: machine.image,
			name: machine.name,
			statsText: formatMachineStats(machine),
			isConfigured: isConfiguredMachine(machine),
			onClick: () => selectMachine(machine, btn, updateStats),
		});

		fragment.appendChild(btn);

		if (index === 0) {
			btn.classList.add("active");
			selectedButton = btn;
			queueMicrotask(() => {
				renderMachineDetails(machine, details, updateStats);
			});
		}
	});

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
function formatMachineStats(machine) {
	return `Lv. ${machine.level} • ${machine.rarity}`;
}

/**
 * Checks if a machine has non-default configuration
 * @param {import('../app.js').Machine} machine - Machine object
 * @returns {boolean} True if configured
 */
function isConfiguredMachine(machine) {
	const { rarity, level, blueprints } = machine;
	const hasBlueprints = Object.values(blueprints).some((v) => v > 0);
	const hasLevel = level > 0;
	const hasRarity = rarity.toLowerCase() !== "common";
	return hasBlueprints || hasLevel || hasRarity;
}

/**
 * Renders machine details in the detail pane
 * @param {import('../app.js').Machine} machine - Machine object
 * @param {HTMLElement} container - Detail container element
 * @param {Function} updateListStats - Callback to update list stats
 */
function renderMachineDetails(machine, container, updateListStats) {
	container.replaceChildren();
	const detailView = createMachineDetailView(machine, updateListStats);
	container.appendChild(detailView);
}

/**
 * Creates the detailed view for a machine
 * @param {import('../app.js').Machine} machine - Machine object
 * @param {Function} updateListStats - Callback to update list stats
 * @returns {HTMLElement} Detail view container
 */
function createMachineDetailView(machine, updateListStats) {
	const wrapper = document.createElement("div");
	wrapper.className = "machine-detail-view";

	// Import triggerAutoSave dynamically to avoid circular dependency
	const triggerAutoSave = async () => {
		const { triggerAutoSave: fn } = await import("../app.js");
		const { store } = await import("../app.js");
		fn(store);
	};

	const header = createDetailHeader({
		image: machine.image,
		name: machine.name,
		onReset: () => {
			if (confirm(`Reset ${machine.name} to default values?`)) {
				resetMachine(machine);
				wrapper.replaceWith(createMachineDetailView(machine, updateListStats));
				updateListStats();
				triggerAutoSave();
			}
		},
	});

	const form = document.createElement("form");
	form.className = "machine-form";

	const machineId = `machine-${machine.id}`;

	const updateAndSave = () => {
		updateListStats();
		triggerAutoSave();
	};

	// General section
	const generalSection = createSection("General", [
		createFormRow(
			"Rarity",
			createSelect(
				AppConfig.RARITY_LABELS,
				machine.rarity,
				(e) => {
					machine.rarity = e.target.value;
					updateAndSave();
				},
				`${machineId}-rarity`
			),
			"col-md-6"
		),
		createFormRow("Level", createNumberInput(machine, "level", updateAndSave, 0, 1, `${machineId}-level`), "col-md-6"),
	]);

	// Blueprint Levels section
	const blueprintSection = createSection("Blueprint Levels", [
		createFormRow("Damage", createNumberInput(machine.blueprints, "damage", updateAndSave, 0, 1, `${machineId}-bp-damage`), "col-md-4"),
		createFormRow("Health", createNumberInput(machine.blueprints, "health", updateAndSave, 0, 1, `${machineId}-bp-health`), "col-md-4"),
		createFormRow("Armor", createNumberInput(machine.blueprints, "armor", updateAndSave, 0, 1, `${machineId}-bp-armor`), "col-md-4"),
	]);

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
	machine.blueprints.damage = AppConfig.DEFAULTS.BLUEPRINT_LEVEL;
	machine.blueprints.health = AppConfig.DEFAULTS.BLUEPRINT_LEVEL;
	machine.blueprints.armor = AppConfig.DEFAULTS.BLUEPRINT_LEVEL;
}
