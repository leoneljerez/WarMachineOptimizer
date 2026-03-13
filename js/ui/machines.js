// ui/machines.js
import { createSection, createFormRow, createNumberInput, createSelect, createListItem, updateListItem, createDetailHeader, updateBlueprintInputState, createPicture } from "./formHelpers.js";
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
 * Handles all click events via delegation.
 * @param {Event} e - Click event
 */
function handleAllClicks(e) {
	// Filter badge clicks — prevent dropdown from closing
	const filterBadge = e.target.closest(".filter-badge-item");
	if (filterBadge) {
		e.preventDefault();
		e.stopPropagation();
		const { tag } = filterBadge.dataset;
		if (activeFilters.has(tag)) {
			activeFilters.delete(tag);
		} else {
			activeFilters.add(tag);
		}
		applyFiltersAndSort(true);
		updateFilterButton();
		return;
	}

	if (currentMachineView === "normal") {
		// List item selection
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

		// Reset button
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

	// Bulk view back button
	const backBtn = e.target.closest('[data-action="back-to-normal"]');
	if (backBtn) {
		currentMachineView = "normal";
		renderMachines(store.machines);
	}
}

/**
 * Handles all input events via delegation.
 * @param {Event} e - Input event
 */
function handleAllInputs(e) {
	const input = e.target;

	// Search input (both views)
	if (input.id === "machineSearch" || input.id === "machineSearchBulk") {
		searchQuery = input.value.toLowerCase().trim();
		applyFiltersAndSort(false);
		return;
	}

	if (input.type !== "number") return;

	if (currentMachineView === "normal") {
		const machine = machinesMap.get(currentMachineId);
		if (!machine) return;

		const { key } = input.dataset;
		if (!key) return;

		const val = parseInt(input.value, 10);

		if (key in machine.blueprints) {
			const maxBP = Calculator.getMaxBlueprintLevel(machine.level);
			machine.blueprints[key] = isNaN(val) ? 0 : Math.max(0, Math.min(val, maxBP));
			updateBlueprintInputState(input, machine.blueprints[key], maxBP);
		} else if (key === "level") {
			machine.level = isNaN(val) ? 0 : Math.max(0, val);
			updateAllBlueprintMaxValues(machine);
		}

		updateMachineInList(currentMachineId);
		triggerAutoSave(store);
	} else if (currentMachineView === "bulk") {
		const machineId = input.dataset.machineId;
		const field = input.dataset.field;
		const machine = machinesMap.get(machineId);
		if (!machine) return;

		const val = parseInt(input.value, 10);
		const validVal = isNaN(val) ? 0 : Math.max(0, val);

		if (field === "level") {
			machine.level = validVal;
			updateBulkBlueprintMaxValues(machineId, machine.level);
		} else if (field in machine.blueprints) {
			const maxBP = Calculator.getMaxBlueprintLevel(machine.level);
			machine.blueprints[field] = Math.min(validVal, maxBP);
			updateBlueprintInputState(input, machine.blueprints[field], maxBP);
		}

		triggerAutoSave(store);
	}
}

/**
 * Handles all change events via delegation.
 * @param {Event} e - Change event
 */
function handleAllChanges(e) {
	const select = e.target;

	// Sort select (both views)
	if (select.id === "machineSort" || select.id === "machineSortBulk") {
		currentSort = select.value;
		applyFiltersAndSort(true);
		return;
	}

	if (select.tagName !== "SELECT") return;

	if (currentMachineView === "normal") {
		const machine = machinesMap.get(currentMachineId);
		if (!machine) return;
		if (select.dataset.key === "rarity") {
			machine.rarity = select.value;
			updateMachineInList(currentMachineId);
			triggerAutoSave(store);
		}
	} else if (currentMachineView === "bulk") {
		const machineId = select.dataset.machineId;
		const machine = machinesMap.get(machineId);
		if (!machine) return;
		machine.rarity = select.value;
		triggerAutoSave(store);
	}
}

/**
 * Handles all blur events via delegation.
 * Clamps out-of-range values when the user leaves an input.
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

	if (correctedValue === val) return;

	input.value = correctedValue;

	if (currentMachineView === "normal") {
		const machine = machinesMap.get(currentMachineId);
		const { key } = input.dataset;
		if (!machine || !key) return;

		if (key in machine.blueprints) {
			machine.blueprints[key] = correctedValue;
			updateBlueprintInputState(input, correctedValue, max ?? Infinity);
		} else if (key === "level") {
			machine.level = correctedValue;
		}
		triggerAutoSave(store);
	} else if (currentMachineView === "bulk") {
		const machineId = input.dataset.machineId;
		const field = input.dataset.field;
		const machine = machinesMap.get(machineId);
		if (!machine || !field) return;

		if (field === "level") {
			machine.level = correctedValue;
		} else if (field in machine.blueprints) {
			machine.blueprints[field] = correctedValue;
			updateBlueprintInputState(input, correctedValue, max ?? Infinity);
		}
		triggerAutoSave(store);
	}
}

/**
 * Updates all blueprint input max values and hint text when machine level changes (normal view).
 * @param {Object} machine - Machine object
 */
function updateAllBlueprintMaxValues(machine) {
	const maxBP = Calculator.getMaxBlueprintLevel(machine.level);
	const machineId = `machine-${machine.id}`;

	// Update hint text
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

			textSpan.textContent = "Current max blueprint level: ";
			textSpan.appendChild(strong);
			textSpan.appendChild(muted);
			textSpan.appendChild(document.createTextNode("Upgrades every 5 machine levels"));
		}
	}

	for (const field of ["damage", "health", "armor"]) {
		const input = document.getElementById(`${machineId}-bp-${field}`);
		if (!input) continue;

		const currentValue = parseInt(input.value, 10) || 0;
		const newValue = Math.min(currentValue, maxBP);

		if (newValue !== currentValue) {
			input.value = newValue;
			machine.blueprints[field] = newValue;
		}

		updateBlueprintInputState(input, newValue, maxBP);
	}
}

/**
 * Updates all blueprint input max values for a machine row in bulk view.
 * @param {string} machineId - Machine ID
 * @param {number} level    - New machine level
 */
function updateBulkBlueprintMaxValues(machineId, level) {
	const maxBP = Calculator.getMaxBlueprintLevel(level);
	const machine = machinesMap.get(machineId);
	if (!machine) return;

	for (const field of ["damage", "health", "armor"]) {
		const input = document.getElementById(`bulk-machine-${machine.id}-bp-${field}`);
		if (!input) continue;

		const currentValue = parseInt(input.value, 10) || 0;
		const newValue = Math.min(currentValue, maxBP);

		if (newValue !== currentValue) {
			input.value = newValue;
			machine.blueprints[field] = newValue;
		}

		updateBlueprintInputState(input, newValue, maxBP);
	}
}

/**
 * Filters machines by search query and active tag filters.
 * @param {Object[]} machines - Array of machine objects
 * @returns {Object[]} Filtered machines
 */
function filterMachines(machines) {
	return machines.filter((machine) => {
		if (searchQuery && !machine.name.toLowerCase().includes(searchQuery)) return false;
		if (activeFilters.size > 0) {
			const hasAllTags = Array.from(activeFilters).every((tag) => machine.tags?.includes(tag));
			if (!hasAllTags) return false;
		}
		return true;
	});
}

/** @type {Map<string, (a: Object, b: Object) => number>} Sort comparators keyed by sort option */
const MACHINE_SORT_COMPARATORS = new Map([
	["name-asc", (a, b) => a.name.localeCompare(b.name)],
	["name-desc", (a, b) => b.name.localeCompare(a.name)],
	["level-asc", (a, b) => a.level - b.level],
	["level-desc", (a, b) => b.level - a.level],
	["damage-asc", (a, b) => a.blueprints.damage - b.blueprints.damage],
	["damage-desc", (a, b) => b.blueprints.damage - a.blueprints.damage],
	["health-asc", (a, b) => a.blueprints.health - b.blueprints.health],
	["health-desc", (a, b) => b.blueprints.health - a.blueprints.health],
	["armor-asc", (a, b) => a.blueprints.armor - b.blueprints.armor],
	["armor-desc", (a, b) => b.blueprints.armor - a.blueprints.armor],
	["rarity-asc", (a, b) => AppConfig.getRarityLevel(a.rarity) - AppConfig.getRarityLevel(b.rarity)],
	["rarity-desc", (a, b) => AppConfig.getRarityLevel(b.rarity) - AppConfig.getRarityLevel(a.rarity)],
	["configured-desc", (a, b) => (isConfiguredMachine(b) ? 1 : 0) - (isConfiguredMachine(a) ? 1 : 0)],
	["configured-asc", (a, b) => (isConfiguredMachine(a) ? 1 : 0) - (isConfiguredMachine(b) ? 1 : 0)],
]);

/**
 * Sorts machines by the current sort option.
 * Falls back to original order when sort is "default" or unrecognised.
 * @param {Object[]} machines - Array of machine objects
 * @returns {Object[]} Sorted copy
 */
function sortMachines(machines) {
	const comparator = MACHINE_SORT_COMPARATORS.get(currentSort);
	return comparator ? [...machines].sort(comparator) : [...machines];
}

/**
 * Applies current filters and sort, then re-renders without losing focus.
 * @param {boolean} autoSelectFirst - Auto-select first item when the filtered set changes
 */
function applyFiltersAndSort(autoSelectFirst = false) {
	const allMachines = Array.from(machinesMap.values());
	const filtered = filterMachines(allMachines);
	const sorted = sortMachines(filtered);

	if (currentMachineView === "normal") {
		const currentStillValid = currentMachineId && sorted.find((m) => String(m.id) === currentMachineId);

		updateMachineListOnly(sorted);

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
		updateBulkTableOnly(sorted);
	}
}

/**
 * Re-renders only the machine list items, leaving search controls intact.
 * @param {Object[]} machines - Filtered and sorted machines
 */
function updateMachineListOnly(machines) {
	const fragment = document.createDocumentFragment();
	for (const machine of machines) {
		fragment.appendChild(
			createListItem({
				id: String(machine.id),
				image: machine.image,
				name: machine.name,
				statsText: formatMachineStats(machine),
				isConfigured: isConfiguredMachine(machine),
			}),
		);
	}

	listElement.replaceChildren(fragment);

	if (currentMachineId && machinesMap.has(currentMachineId)) {
		updateActiveButton(currentMachineId);
	}

	updateFilterBadges();
}

/**
 * Re-renders only the bulk table, leaving search controls intact.
 * @param {Object[]} machines - Filtered and sorted machines
 */
function updateBulkTableOnly(machines) {
	const existingTable = bulkContainer.querySelector(".table-responsive");
	if (!existingTable) return;
	existingTable.replaceWith(createMachinesBulkTable(machines));
	updateFilterBadges();
}

/**
 * Updates the filter button text and active state for both normal and bulk views.
 */
function updateFilterButton() {
	for (const id of ["machineFilterBtn", "machineFilterBtnBulk"]) {
		const btn = document.getElementById(id);
		if (!btn) continue;

		const textNode = Array.from(btn.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
		const label = activeFilters.size > 0 ? ` Filters (${activeFilters.size})` : " Filters";
		if (textNode) textNode.textContent = label;
		btn.classList.toggle("active", activeFilters.size > 0);
	}
}

/**
 * Syncs filter badge active states in the dropdown to reflect `activeFilters`.
 */
function updateFilterBadges() {
	for (const badge of document.querySelectorAll(".filter-badge-item")) {
		const isActive = activeFilters.has(badge.dataset.tag);
		badge.classList.toggle("active", isActive);
		const checkIcon = badge.querySelector(".bi-check-lg");
		if (checkIcon) checkIcon.style.visibility = isActive ? "visible" : "hidden";
	}
}

/**
 * Collects all unique machine tags from machinesMap.
 * @returns {string[]} Sorted array of unique tags
 */
function getAllMachineTags() {
	const tagSet = new Set();
	for (const machine of machinesMap.values()) {
		if (Array.isArray(machine.tags)) {
			for (const tag of machine.tags) tagSet.add(tag);
		}
	}
	return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Creates the search, filter, and sort controls row.
 * @param {boolean} isBulkView - True when rendering inside the bulk edit card
 * @returns {HTMLElement} Controls container
 */
function createSearchControls(isBulkView = false) {
	const container = document.createElement("div");
	container.className = "mb-3";

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

	searchGroup.append(searchIcon, searchInput);

	// Filter dropdown
	const filterDropdown = document.createElement("div");
	filterDropdown.className = "dropdown";
	filterDropdown.style.zIndex = "1050";

	const filterBtn = document.createElement("button");
	filterBtn.type = "button";
	filterBtn.id = isBulkView ? "machineFilterBtnBulk" : "machineFilterBtn";
	filterBtn.className = "btn btn-outline-secondary dropdown-toggle";
	filterBtn.setAttribute("data-bs-toggle", "dropdown");
	filterBtn.setAttribute("data-bs-auto-close", "outside");
	filterBtn.setAttribute("aria-expanded", "false");
	if (activeFilters.size > 0) filterBtn.classList.add("active");

	const filterIcon = document.createElement("i");
	filterIcon.className = "bi bi-funnel";
	filterBtn.append(filterIcon, document.createTextNode(activeFilters.size > 0 ? ` Filters (${activeFilters.size})` : " Filters"));

	const dropdownMenu = document.createElement("ul");
	dropdownMenu.className = "dropdown-menu dropdown-menu-end";
	dropdownMenu.style.zIndex = "1051";

	for (const tag of getAllMachineTags()) {
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

		item.append(text, checkIcon);
		li.appendChild(item);
		dropdownMenu.appendChild(li);
	}

	filterDropdown.append(filterBtn, dropdownMenu);
	row.append(searchGroup, filterDropdown);

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

	for (const { value, label } of sortOptions) {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = label;
		option.selected = currentSort === value;
		sortSelect.appendChild(option);
	}

	container.append(row, sortSelect);
	return container;
}

/**
 * Renders the full machines panel (list + details or bulk view).
 * @param {Object[]} machines - Array of machine objects
 */
export function renderMachines(machines) {
	machinesMap.clear();
	for (const machine of machines) machinesMap.set(String(machine.id), machine);

	if (currentMachineView === "bulk") {
		renderMachinesBulkView(machines);
		return;
	}

	// Show normal columns, hide bulk container
	bulkContainer.style.display = "none";
	for (const child of machinesSection.children) {
		child.style.display = child.id === "machinesBulkContainer" ? "none" : "";
	}

	const sorted = sortMachines(filterMachines(machines));
	renderMachineList(sorted);

	if (!currentMachineId || !sorted.find((m) => String(m.id) === currentMachineId)) {
		if (sorted.length > 0) {
			currentMachineId = String(sorted[0].id);
			updateActiveButton(currentMachineId);
			renderMachineDetails(sorted[0]);
		}
	} else {
		const currentMachine = machinesMap.get(currentMachineId);
		if (currentMachine) {
			updateActiveButton(currentMachineId);
			renderMachineDetails(currentMachine);
		}
	}
}

/**
 * Renders the machine list column including search controls.
 * @param {Object[]} machines - Filtered and sorted machines
 */
function renderMachineList(machines) {
	let searchContainer = listElement.parentElement.querySelector(".search-controls");
	if (!searchContainer) {
		searchContainer = document.createElement("div");
		searchContainer.className = "search-controls p-3 border-bottom";
		listElement.parentElement.insertBefore(searchContainer, listElement);
	}
	searchContainer.replaceChildren(createSearchControls(false));

	const fragment = document.createDocumentFragment();
	for (const machine of machines) {
		fragment.appendChild(
			createListItem({
				id: String(machine.id),
				image: machine.image,
				name: machine.name,
				statsText: formatMachineStats(machine),
				isConfigured: isConfiguredMachine(machine),
			}),
		);
	}
	listElement.replaceChildren(fragment);
	updateFilterBadges();
}

/**
 * Marks a single list item as active, clearing others.
 * @param {string} machineId - ID of the machine to mark active
 */
function updateActiveButton(machineId) {
	for (const btn of listElement.querySelectorAll(".list-group-item")) {
		btn.classList.toggle("active", btn.dataset.itemId === machineId);
	}
}

/**
 * Formats machine stats as a two-line summary for the list item.
 * @param {Object} machine - Machine object
 * @returns {string} Formatted stats string
 */
function formatMachineStats(machine) {
	const { level, rarity, blueprints: bp } = machine;
	const displayRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
	return `Lv.${level} • ${displayRarity}\nDmg ${bp.damage} • Hp ${bp.health} • Arm ${bp.armor}`;
}

/**
 * Returns true if a machine has any non-default values set.
 * @param {Object} machine - Machine object
 * @returns {boolean}
 */
function isConfiguredMachine({ rarity, level, blueprints }) {
	return level > 0 || rarity.toLowerCase() !== "common" || Object.values(blueprints).some((v) => v > 0);
}

/**
 * Builds and mounts the detail form for a machine.
 * @param {Object} machine - Machine object
 */
function renderMachineDetails(machine) {
	const { id, name, image, level, rarity, blueprints, tags, ability, baseStats } = machine;
	const wrapper = document.createElement("div");
	wrapper.className = "machine-detail-view";

	// Role badge uses colour-coding; remaining tags are secondary
	const badges = [];
	if (tags?.length > 0) {
		const role = tags[0].toLowerCase();
		badges.push({
			text: tags[0],
			color: role === "tank" ? "primary" : role === "healer" ? "success" : "danger",
		});
		for (let i = 1; i < tags.length; i++) {
			badges.push({ text: tags[i], color: "secondary" });
		}
	}

	const header = createDetailHeader({ image, name, badges });

	// Ability and base-stats info cards (below header, above form)
	const infoSection = document.createElement("div");
	infoSection.className = "row g-3 mb-4";

	if (ability?.description) {
		const abilityCol = document.createElement("div");
		abilityCol.className = baseStats ? "col-md-7" : "col-12";

		const abilityCard = document.createElement("div");
		abilityCard.className = "card bg-info bg-opacity-10 border-info border-opacity-25 h-100";

		const abilityBody = document.createElement("div");
		abilityBody.className = "card-body p-3";

		const abilityHeader = document.createElement("div");
		abilityHeader.className = "d-flex align-items-center gap-2 mb-2";

		const lightningIcon = document.createElement("i");
		lightningIcon.className = "bi bi-lightning-charge-fill text-info";

		const abilityTitle = document.createElement("h6");
		abilityTitle.className = "mb-0 text-info";
		abilityTitle.textContent = "Ability";

		abilityHeader.append(lightningIcon, abilityTitle);

		const abilityDesc = document.createElement("div");
		abilityDesc.className = "small";
		abilityDesc.textContent = ability.description;

		abilityBody.append(abilityHeader, abilityDesc);
		abilityCard.appendChild(abilityBody);
		abilityCol.appendChild(abilityCard);
		infoSection.appendChild(abilityCol);
	}

	if (baseStats) {
		const statsCol = document.createElement("div");
		statsCol.className = ability?.description ? "col-md-5" : "col-12";

		const statsCard = document.createElement("div");
		statsCard.className = "card bg-secondary bg-opacity-10 border-secondary border-opacity-25 h-100";

		const statsBody = document.createElement("div");
		statsBody.className = "card-body p-3";

		const statsTitle = document.createElement("h6");
		statsTitle.className = "mb-2 text-secondary";
		statsTitle.textContent = "Base Stats";

		/** @param {string} label @param {number} value @param {boolean} addMargin */
		const createStatRow = (label, value, addMargin = true) => {
			const row = document.createElement("div");
			if (addMargin) row.classList.add("mb-1");
			const strong = document.createElement("strong");
			strong.textContent = `${label}: `;
			row.append(strong, document.createTextNode(value.toLocaleString()));
			return row;
		};

		const statsList = document.createElement("div");
		statsList.className = "small";
		statsList.append(createStatRow("Damage", baseStats.damage), createStatRow("Health", baseStats.health), createStatRow("Armor", baseStats.armor, false));

		statsBody.append(statsTitle, statsList);
		statsCard.appendChild(statsBody);
		statsCol.appendChild(statsCard);
		infoSection.appendChild(statsCol);
	}

	// Form
	const form = document.createElement("form");
	form.className = "machine-form";

	const machineId = `machine-${id}`;

	// Basic information
	const rarityId = `${machineId}-rarity`;
	const levelId = `${machineId}-level`;

	const generalSection = createSection("BASIC INFORMATION", [
		createFormRow("Rarity", createSelect(AppConfig.RARITY_LABELS, rarity, rarityId, "rarity"), "col-md-6", rarityId),
		createFormRow("Level", createNumberInput({ value: level, min: 0, step: 1, id: levelId, dataKey: "level" }), "col-md-6", levelId),
	]);

	// Blueprint levels
	const maxBP = Calculator.getMaxBlueprintLevel(level);
	const blueprintRows = ["damage", "health", "armor"].map((field) => {
		const currentValue = blueprints[field];
		const inputId = `${machineId}-bp-${field}`;
		return createFormRow(
			field[0].toUpperCase() + field.slice(1),
			createNumberInput({ value: currentValue, min: 0, step: 1, id: inputId, dataKey: field, max: maxBP, isAtMax: currentValue >= maxBP }),
			"col-md-4",
			inputId,
		);
	});

	const blueprintSection = createSection("BLUEPRINT LEVELS", blueprintRows, "mb-2");

	// Blueprint level hint
	const bpHint = document.createElement("div");
	bpHint.id = `${machineId}-bp-hint`;
	bpHint.className = "d-flex align-items-center gap-2 px-3 py-2 mt-3 rounded-2";
	bpHint.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
	bpHint.style.border = "1px solid rgba(255, 255, 255, 0.08)";

	const hintIcon = document.createElement("i");
	hintIcon.className = "bi bi-info-circle text-secondary";
	hintIcon.style.fontSize = "0.9rem";

	const hintText = document.createElement("span");
	hintText.className = "small text-secondary";

	const maxBPStrong = document.createElement("strong");
	maxBPStrong.className = "text-white";
	maxBPStrong.textContent = maxBP;

	const muted = document.createElement("span");
	muted.className = "text-muted";
	muted.textContent = " • ";

	hintText.textContent = "Current max blueprint level: ";
	hintText.append(maxBPStrong, muted, document.createTextNode("Upgrades every 5 machine levels"));
	bpHint.append(hintIcon, hintText);
	blueprintSection.appendChild(bpHint);

	form.append(generalSection, blueprintSection);
	wrapper.append(header, infoSection, form);
	detailsElement.replaceChildren(wrapper);
}

/**
 * Resets a machine to application defaults.
 * @param {Object} machine - Machine object
 */
function resetMachine(machine) {
	machine.rarity = AppConfig.RARITY_LABELS[0];
	machine.level = AppConfig.DEFAULTS.LEVEL;
	for (const key of Object.keys(machine.blueprints)) {
		machine.blueprints[key] = AppConfig.DEFAULTS.BLUEPRINT_LEVEL;
	}
}

/**
 * Builds the responsive bulk-edit table for a set of machines.
 * @param {Object[]} machines - Array of machine objects
 * @returns {HTMLElement} `.table-responsive` wrapper
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
	thead.style.zIndex = "1";

	const headerRow = document.createElement("tr");
	headerRow.setAttribute("role", "row");

	const COLUMNS = [
		{ label: "Machine", width: "200px" },
		{ label: "Rarity", width: "150px" },
		{ label: "Level", width: "100px" },
		{ label: "Damage BP", width: "110px" },
		{ label: "Health BP", width: "110px" },
		{ label: "Armor BP", width: "110px" },
	];

	for (const { label, width } of COLUMNS) {
		const th = document.createElement("th");
		th.setAttribute("role", "columnheader");
		th.scope = "col";
		th.textContent = label;
		th.style.width = width;
		headerRow.appendChild(th);
	}

	thead.appendChild(headerRow);

	const tbody = document.createElement("tbody");
	const fragment = document.createDocumentFragment();
	machines.forEach((machine, i) => fragment.appendChild(createMachineRow(machine, i)));
	tbody.appendChild(fragment);

	table.append(thead, tbody);
	container.appendChild(table);
	return container;
}

/**
 * Creates an editable table row for a machine in the bulk edit view.
 * @param {Object} machine - Machine object
 * @param {number} index   - Row index (used for tab ordering)
 * @returns {HTMLTableRowElement}
 */
function createMachineRow(machine, index) {
	const row = document.createElement("tr");
	row.setAttribute("role", "row");

	// Name cell
	const nameCell = document.createElement("td");
	nameCell.setAttribute("role", "gridcell");
	const nameDiv = document.createElement("div");
	nameDiv.className = "d-flex align-items-center gap-2";

	const img = createPicture(machine.image, "", "width:32px;height:32px;object-fit:cover", "rounded");
	img.setAttribute("aria-hidden", "true");

	const nameSpan = document.createElement("span");
	nameSpan.className = "fw-semibold";
	nameSpan.textContent = machine.name;

	nameDiv.append(img, nameSpan);
	nameCell.appendChild(nameDiv);
	row.appendChild(nameCell);

	// Rarity cell
	const rarityCell = document.createElement("td");
	rarityCell.setAttribute("role", "gridcell");

	const raritySelect = document.createElement("select");
	raritySelect.className = "form-select form-select-sm";
	raritySelect.id = `bulk-machine-${machine.id}-rarity`;
	raritySelect.setAttribute("aria-label", `${machine.name} rarity`);
	raritySelect.tabIndex = index * 5 + 1;
	raritySelect.dataset.machineId = String(machine.id);

	for (const rarity of AppConfig.RARITY_LABELS) {
		const option = document.createElement("option");
		option.value = rarity;
		option.textContent = rarity;
		option.selected = machine.rarity === rarity;
		raritySelect.appendChild(option);
	}

	rarityCell.appendChild(raritySelect);
	row.appendChild(rarityCell);

	// Level cell
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

	// Blueprint cells
	const maxBP = Calculator.getMaxBlueprintLevel(machine.level);
	["damage", "health", "armor"].forEach((stat, i) => {
		const cell = document.createElement("td");
		cell.setAttribute("role", "gridcell");

		const currentValue = machine.blueprints[stat];
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

		if (currentValue >= maxBP) input.classList.add("border-success", "border-2");

		cell.appendChild(input);
		row.appendChild(cell);
	});

	return row;
}

/**
 * Renders the full bulk-edit card, replacing the bulk container's contents.
 * @param {Object[]} machines - Array of machine objects
 */
function renderMachinesBulkView(machines) {
	const sorted = sortMachines(filterMachines(machines));

	// Hide all normal-view columns
	for (const child of machinesSection.children) child.style.display = "none";
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
	backButton.append(backIcon, document.createTextNode("Back to Normal View"));

	cardHeader.append(title, backButton);

	const cardBody = document.createElement("div");
	cardBody.className = "card-body p-0";

	const searchWrapper = document.createElement("div");
	searchWrapper.className = "p-3 border-bottom";
	searchWrapper.appendChild(createSearchControls(true));
	cardBody.appendChild(searchWrapper);
	cardBody.appendChild(createMachinesBulkTable(sorted));

	// Hint below table
	const hint = document.createElement("div");
	hint.className = "d-flex align-items-center gap-2 px-3 py-2 mx-3 mt-1 mb-3 rounded-2";
	hint.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
	hint.style.border = "1px solid rgba(255, 255, 255, 0.08)";

	const hintIcon = document.createElement("i");
	hintIcon.className = "bi bi-info-circle text-secondary";
	hintIcon.style.fontSize = "0.9rem";

	const hintText = document.createElement("span");
	hintText.className = "small text-secondary";
	hintText.textContent = "Blueprint max levels update automatically based on machine level (increases every 5 levels)";

	hint.append(hintIcon, hintText);
	card.append(cardHeader, cardBody, hint);
	bulkContainer.replaceChildren(card);

	updateFilterBadges();
}

/**
 * Switches to the bulk edit view.
 * @param {Object[]} machines - Array of machine objects
 */
export function switchToBulkEditMachines(machines) {
	currentMachineView = "bulk";
	renderMachines(machines);
}

/**
 * Updates a single machine's list item with current stats.
 * @param {string} machineId - ID of the machine to update
 */
export function updateMachineInList(machineId) {
	const btn = listElement.querySelector(`[data-item-id="${machineId}"]`);
	if (!btn) return;

	const machine = machinesMap.get(machineId);
	if (!machine) return;

	updateListItem(btn, formatMachineStats(machine), isConfiguredMachine(machine));
}
