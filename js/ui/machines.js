// ui/machines.js
import { createSection, createFormRow, createNumberInput, createSelect, createListItem, updateListItem, createDetailHeader, updateBlueprintInputState } from "./formHelpers.js";
import { AppConfig } from "../config.js";
import { Calculator } from "../calculator.js";
import { triggerAutoSave, store } from "../app.js";

/** @type {"normal"|"bulk"} Current view mode for machines */
let currentMachineView = "normal";
/** @type {string|null} Currently selected machine ID */
let currentMachineId = null;
/** @type {Map<string, Object>} Map of machine IDs to machine objects for O(1) lookup */
let machinesMap = new Map();
/** @type {Set<string>} Active filter tags */
let activeFilters = new Set();
/** @type {string} Current sort option */
let currentSort = "default";
/** @type {string} Current search query */
let searchQuery = "";

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
	// Handle filter badge clicks - prevent dropdown from closing
	const filterBadge = e.target.closest(".filter-badge-item");
	if (filterBadge) {
		e.preventDefault();
		e.stopPropagation();
		const tag = filterBadge.dataset.tag;
		if (activeFilters.has(tag)) {
			activeFilters.delete(tag);
		} else {
			activeFilters.add(tag);
		}
		applyFiltersAndSort(true); // Auto-select first
		updateFilterButton();
		return;
	}

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

	// Handle search input (both normal and bulk views)
	if (input.id === "machineSearch" || input.id === "machineSearchBulk") {
		searchQuery = input.value.toLowerCase().trim();
		applyFiltersAndSort(false); // Don't auto-select on search
		return;
	}

	if (input.type !== "number") return;

	// Normal view - detail inputs
	if (currentMachineView === "normal") {
		const machine = machinesMap.get(currentMachineId);
		if (!machine) return;

		const key = input.dataset.key;
		if (!key) return;

		const val = parseInt(input.value, 10);

		if (key in machine.blueprints) {
			const maxBP = Calculator.getMaxBlueprintLevel(machine.level);
			machine.blueprints[key] = isNaN(val) ? 0 : Math.max(0, Math.min(val, maxBP));

			// Update visual state
			updateBlueprintInputState(input, machine.blueprints[key], maxBP);
		} else if (key === "level") {
			machine[key] = isNaN(val) ? 0 : Math.max(0, val);

			// When level changes, update all blueprint inputs' max values
			updateAllBlueprintMaxValues(machine);
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

			// Update all blueprint max values for this machine in bulk view
			updateBulkBlueprintMaxValues(machineId, machine.level);
		} else if (field in machine.blueprints) {
			const maxBP = Calculator.getMaxBlueprintLevel(machine.level);
			machine.blueprints[field] = Math.min(validVal, maxBP);

			// Update visual state in bulk view
			updateBlueprintInputState(input, machine.blueprints[field], maxBP);
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

	// Handle sort select (both normal and bulk views)
	if (select.id === "machineSort" || select.id === "machineSortBulk") {
		currentSort = select.value;
		applyFiltersAndSort(true); // Auto-select first on sort change
		return;
	}

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
	const max = input.dataset.dynamicMax ? parseInt(input.dataset.dynamicMax, 10) : null;

	let correctedValue = val;

	if (isNaN(val) || val < min) {
		correctedValue = min;
	} else if (max !== null && val > max) {
		correctedValue = max;
	}

	if (correctedValue !== val) {
		input.value = correctedValue;

		if (currentMachineView === "normal") {
			const machine = machinesMap.get(currentMachineId);
			const key = input.dataset.key;
			if (machine && key) {
				if (key in machine.blueprints) {
					machine.blueprints[key] = correctedValue;
					updateBlueprintInputState(input, correctedValue, max || Infinity);
				} else if (key === "level") {
					machine[key] = correctedValue;
				}
				triggerAutoSave(store);
			}
		} else if (currentMachineView === "bulk") {
			const machineId = input.dataset.machineId;
			const field = input.dataset.field;
			const machine = machinesMap.get(machineId);
			if (machine && field) {
				if (field === "level") {
					machine.level = correctedValue;
				} else if (field in machine.blueprints) {
					machine.blueprints[field] = correctedValue;
					updateBlueprintInputState(input, correctedValue, max || Infinity);
				}
				triggerAutoSave(store);
			}
		}
	}
}

/**
 * Updates all blueprint input max values for the current machine in normal view
 * @param {Object} machine - Machine object
 */
function updateAllBlueprintMaxValues(machine) {
	const maxBP = Calculator.getMaxBlueprintLevel(machine.level);
	const machineId = `machine-${machine.id}`;

	// Update the hint text
	const hint = document.getElementById(`${machineId}-bp-hint`);
	if (hint) {
		const textSpan = hint.querySelector("span.small");
		if (textSpan) {
			const strong = document.createElement("strong");
			strong.className = "text-white";
			strong.textContent = maxBP;

			const muted = document.createElement("span");
			muted.className = "text-muted";
			muted.textContent = " • ";

			textSpan.textContent = "Current max: ";
			textSpan.appendChild(strong);
			textSpan.appendChild(muted);
			textSpan.appendChild(document.createTextNode("Upgrades every 5 machine levels"));
		}
	}

	const blueprintFields = ["damage", "health", "armor"];
	blueprintFields.forEach((field) => {
		const input = document.getElementById(`${machineId}-bp-${field}`);
		if (input) {
			// Clamp current value to new max
			const currentValue = parseInt(input.value, 10) || 0;
			const newValue = Math.min(currentValue, maxBP);

			if (newValue !== currentValue) {
				input.value = newValue;
				machine.blueprints[field] = newValue;
			}

			updateBlueprintInputState(input, newValue, maxBP);
		}
	});
}

/**
 * Updates all blueprint input max values for a machine in bulk view
 * @param {string} machineId - Machine ID
 * @param {number} level - New machine level
 */
function updateBulkBlueprintMaxValues(machineId, level) {
	const maxBP = Calculator.getMaxBlueprintLevel(level);
	const machine = machinesMap.get(machineId);
	if (!machine) return;

	const blueprintFields = ["damage", "health", "armor"];
	blueprintFields.forEach((field) => {
		const input = document.getElementById(`bulk-machine-${machine.id}-bp-${field}`);
		if (input) {
			// Clamp current value to new max
			const currentValue = parseInt(input.value, 10) || 0;
			const newValue = Math.min(currentValue, maxBP);

			if (newValue !== currentValue) {
				input.value = newValue;
				machine.blueprints[field] = newValue;
			}

			updateBlueprintInputState(input, newValue, maxBP);
		}
	});
}

/**
 * Filters machines based on search and active filters
 * @param {Object[]} machines - Array of machine objects
 * @returns {Object[]} Filtered machines
 */
function filterMachines(machines) {
	return machines.filter((machine) => {
		// Search filter
		if (searchQuery && !machine.name.toLowerCase().includes(searchQuery)) {
			return false;
		}

		// Tag filters
		if (activeFilters.size > 0) {
			const hasAllTags = Array.from(activeFilters).every((tag) => machine.tags && machine.tags.includes(tag));
			if (!hasAllTags) return false;
		}

		return true;
	});
}

/**
 * Sorts machines based on current sort option
 * @param {Object[]} machines - Array of machine objects
 * @returns {Object[]} Sorted machines
 */
function sortMachines(machines) {
	const sorted = [...machines];

	switch (currentSort) {
		case "name-asc":
			sorted.sort((a, b) => a.name.localeCompare(b.name));
			break;
		case "name-desc":
			sorted.sort((a, b) => b.name.localeCompare(a.name));
			break;
		case "level-asc":
			sorted.sort((a, b) => a.level - b.level);
			break;
		case "level-desc":
			sorted.sort((a, b) => b.level - a.level);
			break;
		case "damage-asc":
			sorted.sort((a, b) => a.blueprints.damage - b.blueprints.damage);
			break;
		case "damage-desc":
			sorted.sort((a, b) => b.blueprints.damage - a.blueprints.damage);
			break;
		case "health-asc":
			sorted.sort((a, b) => a.blueprints.health - b.blueprints.health);
			break;
		case "health-desc":
			sorted.sort((a, b) => b.blueprints.health - a.blueprints.health);
			break;
		case "armor-asc":
			sorted.sort((a, b) => a.blueprints.armor - b.blueprints.armor);
			break;
		case "armor-desc":
			sorted.sort((a, b) => b.blueprints.armor - a.blueprints.armor);
			break;
		case "rarity-asc":
			sorted.sort((a, b) => AppConfig.getRarityLevel(a.rarity) - AppConfig.getRarityLevel(b.rarity));
			break;
		case "rarity-desc":
			sorted.sort((a, b) => AppConfig.getRarityLevel(b.rarity) - AppConfig.getRarityLevel(a.rarity));
			break;
		case "configured-desc":
			sorted.sort((a, b) => {
				const aConfigured = isConfiguredMachine(a) ? 1 : 0;
				const bConfigured = isConfiguredMachine(b) ? 1 : 0;
				return bConfigured - aConfigured;
			});
			break;
		case "configured-asc":
			sorted.sort((a, b) => {
				const aConfigured = isConfiguredMachine(a) ? 1 : 0;
				const bConfigured = isConfiguredMachine(b) ? 1 : 0;
				return aConfigured - bConfigured;
			});
			break;
	}

	return sorted;
}

/**
 * Applies filters and sorting, then re-renders the list without losing focus
 * @param {boolean} autoSelectFirst - Whether to auto-select first item when list changes
 */
function applyFiltersAndSort(autoSelectFirst = false) {
	const allMachines = Array.from(machinesMap.values());
	const filtered = filterMachines(allMachines);
	const sorted = sortMachines(filtered);

	if (currentMachineView === "normal") {
		// Check if current selection is still valid
		const currentStillValid = currentMachineId && sorted.find((m) => String(m.id) === currentMachineId);

		// Update list without re-creating search controls
		updateMachineListOnly(sorted);

		// Handle selection
		if (!currentStillValid || autoSelectFirst) {
			if (sorted.length > 0) {
				currentMachineId = String(sorted[0].id);
				updateActiveButton(currentMachineId);
				renderMachineDetails(sorted[0]);
			} else {
				currentMachineId = null;
				detailsElement.replaceChildren();
				const noResults = document.createElement("p");
				noResults.className = "text-secondary text-center mt-4";
				noResults.textContent = "No machines match your filters";
				detailsElement.appendChild(noResults);
			}
		}
	} else {
		// Bulk view - update only the table
		updateBulkTableOnly(sorted);
	}
}

/**
 * Updates only the machine list without touching search controls
 * @param {Object[]} machines - Filtered and sorted machines
 */
function updateMachineListOnly(machines) {
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

	// Restore selection if exists
	if (currentMachineId && machinesMap.has(currentMachineId)) {
		updateActiveButton(currentMachineId);
	}

	// Update filter badges
	updateFilterBadges();
}

/**
 * Updates only the bulk table without touching search controls
 * @param {Object[]} machines - Filtered and sorted machines
 */
function updateBulkTableOnly(machines) {
	// Find the existing table container
	const existingTable = bulkContainer.querySelector(".table-responsive");
	if (!existingTable) return;

	// Create new table
	const newTable = createMachinesBulkTable(machines);

	// Replace only the table
	existingTable.replaceWith(newTable);

	// Update filter badges
	updateFilterBadges();
}

/**
 * Updates the filter button text to show active filter count
 */
function updateFilterButton() {
	// Normal view button
	const filterBtn = document.getElementById("machineFilterBtn");
	if (filterBtn) {
		const textNode = Array.from(filterBtn.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
		if (activeFilters.size > 0) {
			if (textNode) textNode.textContent = ` Filters (${activeFilters.size})`;
			filterBtn.classList.add("active");
		} else {
			if (textNode) textNode.textContent = " Filters";
			filterBtn.classList.remove("active");
		}
	}

	// Bulk view button
	const filterBtnBulk = document.getElementById("machineFilterBtnBulk");
	if (filterBtnBulk) {
		const textNode = Array.from(filterBtnBulk.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
		if (activeFilters.size > 0) {
			if (textNode) textNode.textContent = ` Filters (${activeFilters.size})`;
			filterBtnBulk.classList.add("active");
		} else {
			if (textNode) textNode.textContent = " Filters";
			filterBtnBulk.classList.remove("active");
		}
	}
}

/**
 * Updates filter badge active states in dropdown
 */
function updateFilterBadges() {
	const badges = document.querySelectorAll(".filter-badge-item");
	badges.forEach((badge) => {
		const tag = badge.dataset.tag;
		const checkIcon = badge.querySelector(".bi-check-lg");
		if (activeFilters.has(tag)) {
			badge.classList.add("active");
			if (checkIcon) checkIcon.style.visibility = "visible";
		} else {
			badge.classList.remove("active");
			if (checkIcon) checkIcon.style.visibility = "hidden";
		}
	});
}

/**
 * Creates the search and filter controls
 * @param {boolean} isBulkView - Whether this is for bulk view
 * @returns {HTMLElement} Controls container
 */
function createSearchControls(isBulkView = false) {
	const container = document.createElement("div");
	container.className = "mb-3";

	// Row with search and buttons
	const row = document.createElement("div");
	row.className = "d-flex gap-2 mb-2";

	// Search input
	const searchGroup = document.createElement("div");
	searchGroup.className = "input-group flex-grow-1";

	const searchIcon = document.createElement("span");
	searchIcon.className = "input-group-text";
	const icon = document.createElement("i");
	icon.className = "bi bi-search";
	searchIcon.appendChild(icon);

	const searchInput = document.createElement("input");
	searchInput.type = "text";
	searchInput.id = isBulkView ? "machineSearchBulk" : "machineSearch";
	searchInput.className = "form-control";
	searchInput.placeholder = "Search machines...";
	searchInput.value = searchQuery;

	searchGroup.appendChild(searchIcon);
	searchGroup.appendChild(searchInput);

	// Filter dropdown button
	const filterDropdown = document.createElement("div");
	filterDropdown.className = "dropdown";
	filterDropdown.style.zIndex = "1050"; // Ensure dropdown is above table headers

	const filterBtn = document.createElement("button");
	filterBtn.type = "button";
	filterBtn.id = isBulkView ? "machineFilterBtnBulk" : "machineFilterBtn";
	filterBtn.className = "btn btn-outline-secondary dropdown-toggle";
	filterBtn.setAttribute("data-bs-toggle", "dropdown");
	filterBtn.setAttribute("data-bs-auto-close", "outside");
	filterBtn.setAttribute("aria-expanded", "false");

	const filterIcon = document.createElement("i");
	filterIcon.className = "bi bi-funnel";
	filterBtn.appendChild(filterIcon);
	filterBtn.appendChild(document.createTextNode(activeFilters.size > 0 ? ` Filters (${activeFilters.size})` : " Filters"));

	if (activeFilters.size > 0) filterBtn.classList.add("active");

	const dropdownMenu = document.createElement("ul");
	dropdownMenu.className = "dropdown-menu dropdown-menu-end";
	dropdownMenu.style.zIndex = "1051"; // Ensure menu is above everything

	const allTags = ["Tank", "Damage", "Healer", "Single", "AOE"];
	allTags.forEach((tag) => {
		const li = document.createElement("li");

		const item = document.createElement("a");
		item.className = "dropdown-item filter-badge-item d-flex align-items-center justify-content-between";
		item.href = "#";
		item.dataset.tag = tag;
		if (activeFilters.has(tag)) item.classList.add("active");

		const text = document.createElement("span");
		text.textContent = tag;

		const checkIcon = document.createElement("i");
		checkIcon.className = "bi bi-check-lg text-primary";
		checkIcon.style.visibility = activeFilters.has(tag) ? "visible" : "hidden";

		item.appendChild(text);
		item.appendChild(checkIcon);
		li.appendChild(item);
		dropdownMenu.appendChild(li);
	});

	filterDropdown.appendChild(filterBtn);
	filterDropdown.appendChild(dropdownMenu);

	row.appendChild(searchGroup);
	row.appendChild(filterDropdown);

	// Sort select
	const sortSelect = document.createElement("select");
	sortSelect.id = isBulkView ? "machineSortBulk" : "machineSort";
	sortSelect.className = "form-select";

	const sortOptions = [
		{ value: "default", label: "Default Order" },
		{ value: "name-asc", label: "Name (A-Z)" },
		{ value: "name-desc", label: "Name (Z-A)" },
		{ value: "configured-desc", label: "Configured First" },
		{ value: "configured-asc", label: "Unconfigured First" },
		{ value: "level-asc", label: "Level (Low to High)" },
		{ value: "level-desc", label: "Level (High to Low)" },
		{ value: "damage-asc", label: "Damage BP (Low to High)" },
		{ value: "damage-desc", label: "Damage BP (High to Low)" },
		{ value: "health-asc", label: "Health BP (Low to High)" },
		{ value: "health-desc", label: "Health BP (High to Low)" },
		{ value: "armor-asc", label: "Armor BP (Low to High)" },
		{ value: "armor-desc", label: "Armor BP (High to Low)" },
		{ value: "rarity-asc", label: "Rarity (Low to High)" },
		{ value: "rarity-desc", label: "Rarity (High to Low)" },
	];

	sortOptions.forEach((opt) => {
		const option = document.createElement("option");
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = currentSort === opt.value;
		sortSelect.appendChild(option);
	});

	container.appendChild(row);
	container.appendChild(sortSelect);

	return container;
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

	const filtered = filterMachines(machines);
	const sorted = sortMachines(filtered);

	// Render everything including search controls
	renderMachineList(sorted);

	// Select first machine if none selected or current not in list
	if (!currentMachineId || !sorted.find((m) => String(m.id) === currentMachineId)) {
		if (sorted.length > 0) {
			currentMachineId = String(sorted[0].id);
			updateActiveButton(currentMachineId);
			renderMachineDetails(sorted[0]);
		}
	} else {
		// Re-render current machine details
		const currentMachine = machinesMap.get(currentMachineId);
		if (currentMachine) {
			updateActiveButton(currentMachineId);
			renderMachineDetails(currentMachine);
		}
	}
}

/**
 * Renders the machine list with search controls
 * @param {Object[]} machines - Array of machine objects
 */
function renderMachineList(machines) {
	// Get or create search controls container
	let searchContainer = listElement.parentElement.querySelector(".search-controls");
	if (!searchContainer) {
		searchContainer = document.createElement("div");
		searchContainer.className = "search-controls p-3 border-bottom";
		listElement.parentElement.insertBefore(searchContainer, listElement);
	}

	searchContainer.replaceChildren(createSearchControls(false));

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

	// Update filter badges after render
	updateFilterBadges();
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
	const maxBP = Calculator.getMaxBlueprintLevel(level);
	const blueprintFields = ["damage", "health", "armor"];
	const blueprintRows = [];

	for (let i = 0; i < 3; i++) {
		const field = blueprintFields[i];
		const currentValue = blueprints[field];
		const isAtMax = currentValue >= maxBP;

		blueprintRows.push(createFormRow(field[0].toUpperCase() + field.slice(1), createNumberInput(currentValue, 0, 1, `${machineId}-bp-${field}`, field, maxBP, isAtMax), "col-md-4"));
	}

	const blueprintSection = createSection("BLUEPRINT LEVELS", blueprintRows, "mb-2");

	// Small note about max bp level
	const bpHint = document.createElement("div");
	bpHint.id = `${machineId}-bp-hint`;
	bpHint.className = "d-flex align-items-center gap-2 px-3 py-2 mt-3 rounded-2";
	bpHint.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
	bpHint.style.border = "1px solid rgba(255, 255, 255, 0.08)";

	const hintIcon = document.createElement("i");
	hintIcon.className = "bi bi-info-circle text-secondary";
	hintIcon.style.fontSize = "0.9rem";

	const text = document.createElement("span");
	text.className = "small text-secondary";

	const strong = document.createElement("strong");
	strong.className = "text-white";
	strong.textContent = maxBP;

	const muted = document.createElement("span");
	muted.className = "text-muted";
	muted.textContent = " • ";

	text.textContent = "Current max blueprint level: ";
	text.appendChild(strong);
	text.appendChild(muted);
	text.appendChild(document.createTextNode("Upgrades every 5 machine levels"));

	bpHint.append(hintIcon, text);
	blueprintSection.appendChild(bpHint);

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
	thead.style.zIndex = "1"; // Table headers below dropdown
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

	const maxBP = Calculator.getMaxBlueprintLevel(machine.level);
	const blueprintStats = ["damage", "health", "armor"];

	for (let i = 0; i < 3; i++) {
		const stat = blueprintStats[i];
		const cell = document.createElement("td");
		cell.setAttribute("role", "gridcell");

		const currentValue = machine.blueprints[stat];
		const isAtMax = currentValue >= maxBP;

		const input = document.createElement("input");
		input.type = "number";
		input.className = "form-control form-control-sm";
		input.id = `bulk-machine-${machine.id}-bp-${stat}`;
		input.min = 0;
		input.step = 1;
		input.max = maxBP;
		input.value = currentValue;
		input.setAttribute("aria-label", `${machine.name} ${stat} blueprint`);
		input.tabIndex = index * 5 + 3 + i;
		input.dataset.machineId = String(machine.id);
		input.dataset.field = stat;
		input.dataset.dynamicMax = maxBP;

		// Apply visual feedback if at max
		if (isAtMax) {
			input.classList.add("border-success", "border-2");
		}

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
	// Apply filters and sort
	const filtered = filterMachines(machines);
	const sorted = sortMachines(filtered);

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

	// Add search controls
	const searchWrapper = document.createElement("div");
	searchWrapper.className = "p-3 border-bottom";
	searchWrapper.appendChild(createSearchControls(true)); // true for bulk view
	cardBody.appendChild(searchWrapper);

	cardBody.appendChild(createMachinesBulkTable(sorted));

	// Add polished hint below table
	const hint = document.createElement("div");
	hint.className = "d-flex align-items-center gap-2 px-3 py-2 mx-3 mt-1 mb-3 rounded-2";
	hint.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
	hint.style.border = "1px solid rgba(255, 255, 255, 0.08)";

	const icon = document.createElement("i");
	icon.className = "bi bi-info-circle text-secondary";
	icon.style.fontSize = "0.9rem";

	const text = document.createElement("span");
	text.className = "small text-secondary";
	text.textContent = "Blueprint max levels update automatically based on machine level (increases every 5 levels)";

	hint.append(icon, text);
	card.append(cardHeader, cardBody, hint);
	bulkContainer.replaceChildren(card);

	// Update filter badges after render
	updateFilterBadges();
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
