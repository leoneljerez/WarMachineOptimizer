// ui/heroes.js
import { createSection, createFormRow, createNumberInput, createListItem, updateListItem, createDetailHeader, createPicture } from "./formHelpers.js";
import { AppConfig } from "../config.js";
import { triggerAutoSave, store } from "../app.js";

/** @type {"normal"|"bulk"} Current view mode for heroes */
let currentHeroView = "normal";
/** @type {string|null} Currently selected hero ID */
let currentHeroId = null;
/** @type {Map<string, Object>} Map of hero IDs to hero objects for O(1) lookup */
let heroesMap = new Map();
/** @type {Set<string>} Active filter tags */
let activeFilters = new Set();
/** @type {string} Current sort option */
let currentSort = "default";
/** @type {string} Current search query */
let searchQuery = "";

// Cache DOM elements on module load
const heroesSection = document.querySelector("#heroesTab .row.g-3");
const listElement = document.getElementById("heroList");
const detailsElement = document.getElementById("heroDetails");
let bulkContainer = document.getElementById("heroesBulkContainer");

// Create bulk container if it doesn't exist
if (!bulkContainer && heroesSection) {
	bulkContainer = document.createElement("div");
	bulkContainer.id = "heroesBulkContainer";
	bulkContainer.className = "col-12";
	bulkContainer.style.display = "none";
	heroesSection.appendChild(bulkContainer);
}

// Set up event delegation once on module load
if (heroesSection) {
	heroesSection.addEventListener("click", handleAllClicks);
	heroesSection.addEventListener("input", handleAllInputs);
	heroesSection.addEventListener("change", handleAllChanges);
	heroesSection.addEventListener("blur", handleAllBlurs, true);
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

	if (currentHeroView === "normal") {
		// List item selection
		const btn = e.target.closest(".list-group-item");
		if (btn) {
			const heroId = btn.dataset.itemId;
			const hero = heroesMap.get(heroId);
			if (!hero) return;
			currentHeroId = heroId;
			updateActiveButton(heroId);
			renderHeroDetails(hero);
			return;
		}

		// Reset button
		const resetBtn = e.target.closest('[data-action="reset"]');
		if (resetBtn) {
			const hero = heroesMap.get(currentHeroId);
			if (!hero) return;
			if (confirm(`Reset ${hero.name} to default values?`)) {
				resetHero(hero);
				renderHeroDetails(hero);
				updateHeroInList(currentHeroId);
				triggerAutoSave(store);
			}
			return;
		}
	}

	// Bulk view back button
	const backBtn = e.target.closest('[data-action="back-to-normal"]');
	if (backBtn) {
		currentHeroView = "normal";
		renderHeroes(store.heroes);
	}
}

/**
 * Handles all input events via delegation.
 * @param {Event} e - Input event
 */
function handleAllInputs(e) {
	const input = e.target;

	// Search input (both views)
	if (input.id === "heroSearch" || input.id === "heroSearchBulk") {
		searchQuery = input.value.toLowerCase().trim();
		applyFiltersAndSort(false);
		return;
	}

	if (input.type !== "number") return;

	if (currentHeroView === "normal") {
		const hero = heroesMap.get(currentHeroId);
		if (!hero) return;

		const { key } = input.dataset;
		if (!key) return;

		const val = parseInt(input.value, 10);
		hero.percentages[key] = isNaN(val) ? 0 : Math.max(0, val);

		updateHeroInList(currentHeroId);
		triggerAutoSave(store);
	} else if (currentHeroView === "bulk") {
		const heroId = input.dataset.heroId;
		const stat = input.dataset.stat;
		const hero = heroesMap.get(heroId);
		if (!hero) return;

		const val = parseInt(input.value, 10);
		hero.percentages[stat] = isNaN(val) ? 0 : Math.max(0, val);
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
	if (select.id === "heroSort" || select.id === "heroSortBulk") {
		currentSort = select.value;
		applyFiltersAndSort(true);
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

	if (!isNaN(val) && val >= min) return;

	input.value = min;

	if (currentHeroView === "normal") {
		const hero = heroesMap.get(currentHeroId);
		const { key } = input.dataset;
		if (hero && key) {
			hero.percentages[key] = min;
			triggerAutoSave(store);
		}
	} else if (currentHeroView === "bulk") {
		const heroId = input.dataset.heroId;
		const stat = input.dataset.stat;
		const hero = heroesMap.get(heroId);
		if (hero && stat) {
			hero.percentages[stat] = min;
			triggerAutoSave(store);
		}
	}
}

/**
 * Filters heroes by search query and active tag filters.
 * @param {Object[]} heroes - Array of hero objects
 * @returns {Object[]} Filtered heroes
 */
function filterHeroes(heroes) {
	return heroes.filter((hero) => {
		if (searchQuery && !hero.name.toLowerCase().includes(searchQuery)) return false;
		if (activeFilters.size > 0) {
			const hasAllTags = Array.from(activeFilters).every((tag) => hero.tags?.includes(tag));
			if (!hasAllTags) return false;
		}
		return true;
	});
}

/** @type {Map<string, (a: Object, b: Object) => number>} Sort comparators keyed by sort option */
const HERO_SORT_COMPARATORS = new Map([
	["name-asc", (a, b) => a.name.localeCompare(b.name)],
	["name-desc", (a, b) => b.name.localeCompare(a.name)],
	["damage-asc", (a, b) => a.percentages.damage - b.percentages.damage],
	["damage-desc", (a, b) => b.percentages.damage - a.percentages.damage],
	["health-asc", (a, b) => a.percentages.health - b.percentages.health],
	["health-desc", (a, b) => b.percentages.health - a.percentages.health],
	["armor-asc", (a, b) => a.percentages.armor - b.percentages.armor],
	["armor-desc", (a, b) => b.percentages.armor - a.percentages.armor],
	["configured-desc", (a, b) => (isConfiguredHero(b) ? 1 : 0) - (isConfiguredHero(a) ? 1 : 0)],
	["configured-asc", (a, b) => (isConfiguredHero(a) ? 1 : 0) - (isConfiguredHero(b) ? 1 : 0)],
]);

/**
 * Sorts heroes by the current sort option.
 * Falls back to original order when sort is "default" or unrecognised.
 * @param {Object[]} heroes - Array of hero objects
 * @returns {Object[]} Sorted copy
 */
function sortHeroes(heroes) {
	const comparator = HERO_SORT_COMPARATORS.get(currentSort);
	return comparator ? [...heroes].sort(comparator) : [...heroes];
}

/**
 * Applies current filters and sort, then re-renders without losing focus.
 * @param {boolean} autoSelectFirst - Auto-select first item when the filtered set changes
 */
function applyFiltersAndSort(autoSelectFirst = false) {
	const allHeroes = Array.from(heroesMap.values());
	const filtered = filterHeroes(allHeroes);
	const sorted = sortHeroes(filtered);

	if (currentHeroView === "normal") {
		const currentStillValid = currentHeroId && sorted.find((h) => String(h.id) === currentHeroId);

		updateHeroListOnly(sorted);

		if (!currentStillValid || autoSelectFirst) {
			if (sorted.length > 0) {
				currentHeroId = String(sorted[0].id);
				updateActiveButton(currentHeroId);
				renderHeroDetails(sorted[0]);
			} else {
				currentHeroId = null;
				detailsElement.replaceChildren();
				const noResults = document.createElement("p");
				noResults.className = "text-secondary text-center mt-4";
				noResults.textContent = "No heroes match your filters";
				detailsElement.appendChild(noResults);
			}
		}
	} else {
		updateBulkTableOnly(sorted);
	}
}

/**
 * Re-renders only the hero list items, leaving search controls intact.
 * @param {Object[]} heroes - Filtered and sorted heroes
 */
function updateHeroListOnly(heroes) {
	const fragment = document.createDocumentFragment();
	for (const hero of heroes) {
		fragment.appendChild(
			createListItem({
				id: String(hero.id),
				image: hero.image,
				name: hero.name,
				statsText: formatHeroStats(hero),
				isConfigured: isConfiguredHero(hero),
			}),
		);
	}

	listElement.replaceChildren(fragment);

	if (currentHeroId && heroesMap.has(currentHeroId)) {
		updateActiveButton(currentHeroId);
	}

	updateFilterBadges();
}

/**
 * Re-renders only the bulk table, leaving search controls intact.
 * @param {Object[]} heroes - Filtered and sorted heroes
 */
function updateBulkTableOnly(heroes) {
	const existingTable = bulkContainer.querySelector(".table-responsive");
	if (!existingTable) return;
	existingTable.replaceWith(createHeroesBulkTable(heroes));
	updateFilterBadges();
}

/**
 * Updates the filter button text and active state for both normal and bulk views.
 */
function updateFilterButton() {
	for (const id of ["heroFilterBtn", "heroFilterBtnBulk"]) {
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
 * Collects all unique hero tags from heroesMap.
 * @returns {string[]} Sorted array of unique tags
 */
function getAllHeroTags() {
	const tagSet = new Set();
	for (const hero of heroesMap.values()) {
		if (Array.isArray(hero.tags)) {
			for (const tag of hero.tags) tagSet.add(tag);
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

	const searchIconWrapper = document.createElement("span");
	searchIconWrapper.className = "input-group-text";
	const searchIcon = document.createElement("i");
	searchIcon.className = "bi bi-search";
	searchIconWrapper.appendChild(searchIcon);

	const searchInput = document.createElement("input");
	searchInput.type = "text";
	searchInput.id = isBulkView ? "heroSearchBulk" : "heroSearch";
	searchInput.className = "form-control";
	searchInput.placeholder = "Search heroes...";
	searchInput.value = searchQuery;

	searchGroup.append(searchIconWrapper, searchInput);

	// Filter dropdown
	const filterDropdown = document.createElement("div");
	filterDropdown.className = "dropdown";
	filterDropdown.style.zIndex = "1050";

	const filterBtn = document.createElement("button");
	filterBtn.type = "button";
	filterBtn.id = isBulkView ? "heroFilterBtnBulk" : "heroFilterBtn";
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

	for (const tag of getAllHeroTags()) {
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
	sortSelect.id = isBulkView ? "heroSortBulk" : "heroSort";
	sortSelect.className = "form-select";

	const sortOptions = [
		{ value: "default", label: "Default Order" },
		{ value: "name-asc", label: "Name (A-Z)" },
		{ value: "name-desc", label: "Name (Z-A)" },
		{ value: "configured-desc", label: "Configured First" },
		{ value: "configured-asc", label: "Unconfigured First" },
		{ value: "damage-asc", label: "Damage % (Low to High)" },
		{ value: "damage-desc", label: "Damage % (High to Low)" },
		{ value: "health-asc", label: "Health % (Low to High)" },
		{ value: "health-desc", label: "Health % (High to Low)" },
		{ value: "armor-asc", label: "Armor % (Low to High)" },
		{ value: "armor-desc", label: "Armor % (High to Low)" },
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
 * Renders the full heroes panel (list + details or bulk view).
 * @param {Object[]} heroes - Array of hero objects
 */
export function renderHeroes(heroes) {
	heroesMap.clear();
	for (const hero of heroes) heroesMap.set(String(hero.id), hero);

	if (currentHeroView === "bulk") {
		renderHeroesBulkView(heroes);
		return;
	}

	// Show normal columns, hide bulk container
	bulkContainer.style.display = "none";
	for (const child of heroesSection.children) {
		if (child.id !== "heroesBulkContainer") child.style.display = "";
	}

	const sorted = sortHeroes(filterHeroes(heroes));
	renderHeroList(sorted);

	if (!currentHeroId || !sorted.find((h) => String(h.id) === currentHeroId)) {
		if (sorted.length > 0) {
			currentHeroId = String(sorted[0].id);
			updateActiveButton(currentHeroId);
			renderHeroDetails(sorted[0]);
		}
	} else {
		const currentHero = heroesMap.get(currentHeroId);
		if (currentHero) {
			updateActiveButton(currentHeroId);
			renderHeroDetails(currentHero);
		}
	}
}

/**
 * Renders the hero list column including search controls.
 * @param {Object[]} heroes - Filtered and sorted heroes
 */
function renderHeroList(heroes) {
	let searchContainer = listElement.parentElement.querySelector(".search-controls");
	if (!searchContainer) {
		searchContainer = document.createElement("div");
		searchContainer.className = "search-controls p-3 border-bottom";
		listElement.parentElement.insertBefore(searchContainer, listElement);
	}
	searchContainer.replaceChildren(createSearchControls(false));

	const fragment = document.createDocumentFragment();
	for (const hero of heroes) {
		fragment.appendChild(
			createListItem({
				id: String(hero.id),
				image: hero.image,
				name: hero.name,
				statsText: formatHeroStats(hero),
				isConfigured: isConfiguredHero(hero),
			}),
		);
	}
	listElement.replaceChildren(fragment);
	updateFilterBadges();
}

/**
 * Marks a single list item as active, clearing others.
 * @param {string} heroId - ID of the hero to mark active
 */
function updateActiveButton(heroId) {
	for (const btn of listElement.querySelectorAll(".list-group-item")) {
		btn.classList.toggle("active", btn.dataset.itemId === heroId);
	}
}

/**
 * Formats hero stats as a single-line summary for the list item.
 * @param {Object} hero - Hero object
 * @returns {string} Formatted stats string
 */
function formatHeroStats(hero) {
	const p = hero.percentages;
	return `Dmg ${p.damage}% • Hp ${p.health}% • Arm ${p.armor}%`;
}

/**
 * Returns true if a hero has any non-default (non-zero) percentage.
 * @param {Object} hero - Hero object
 * @returns {boolean}
 */
function isConfiguredHero(hero) {
	const { damage, health, armor } = hero.percentages;
	return damage > 0 || health > 0 || armor > 0;
}

/**
 * Builds and mounts the detail form for a hero.
 * @param {Object} hero - Hero object
 */
function renderHeroDetails(hero) {
	const wrapper = document.createElement("div");
	wrapper.className = "hero-detail-view";

	// Role badge uses colour-coding; remaining tags are secondary
	const badges = [];
	if (hero.tags?.length > 0) {
		const role = hero.tags[0].toLowerCase();
		badges.push({
			text: hero.tags[0],
			color: role === "tank" ? "primary" : role === "healer" ? "success" : "danger",
		});
		for (let i = 1; i < hero.tags.length; i++) {
			badges.push({ text: hero.tags[i], color: "secondary" });
		}
	}

	const header = createDetailHeader({ image: hero.image, name: hero.name, badges });

	const form = document.createElement("form");
	form.className = "hero-form";

	const heroId = `hero-${hero.id}`;
	const damageId = `${heroId}-damage-pct`;
	const healthId = `${heroId}-health-pct`;
	const armorId = `${heroId}-armor-pct`;

	const percentSection = createSection("CREW BONUS PERCENTAGES", [
		createFormRow("Damage %", createNumberInput({ value: hero.percentages.damage, min: 0, step: 20, id: damageId, dataKey: "damage" }), "col-md-4", damageId),
		createFormRow("Health %", createNumberInput({ value: hero.percentages.health, min: 0, step: 20, id: healthId, dataKey: "health" }), "col-md-4", healthId),
		createFormRow("Armor %", createNumberInput({ value: hero.percentages.armor, min: 0, step: 20, id: armorId, dataKey: "armor" }), "col-md-4", armorId),
	]);

	form.appendChild(percentSection);
	wrapper.append(header, form);
	detailsElement.replaceChildren(wrapper);
}

/**
 * Resets a hero to application defaults.
 * @param {Object} hero - Hero object
 */
function resetHero(hero) {
	const defaultPct = AppConfig.DEFAULTS.HERO_PERCENTAGE;
	hero.percentages.damage = defaultPct;
	hero.percentages.health = defaultPct;
	hero.percentages.armor = defaultPct;
}

/**
 * Builds the responsive bulk-edit table for a set of heroes.
 * @param {Object[]} heroes - Array of hero objects
 * @returns {HTMLElement} `.table-responsive` wrapper
 */
function createHeroesBulkTable(heroes) {
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
		{ label: "Hero", width: "200px" },
		{ label: "Damage %", width: "120px" },
		{ label: "Health %", width: "120px" },
		{ label: "Armor %", width: "120px" },
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
	heroes.forEach((hero, i) => fragment.appendChild(createHeroRow(hero, i)));
	tbody.appendChild(fragment);

	table.append(thead, tbody);
	container.appendChild(table);
	return container;
}

/**
 * Creates an editable table row for a hero in the bulk edit view.
 * @param {Object} hero  - Hero object
 * @param {number} index - Row index (used for tab ordering)
 * @returns {HTMLTableRowElement}
 */
function createHeroRow(hero, index) {
	const row = document.createElement("tr");
	row.setAttribute("role", "row");

	// Name cell
	const nameCell = document.createElement("td");
	nameCell.setAttribute("role", "gridcell");

	const nameContainer = document.createElement("div");
	nameContainer.className = "d-flex align-items-center gap-2";

	const img = createPicture(hero.image, "", "width:32px;height:32px;object-fit:cover", "rounded");
	img.setAttribute("aria-hidden", "true");

	const nameText = document.createElement("span");
	nameText.className = "fw-semibold";
	nameText.textContent = hero.name;

	nameContainer.append(img, nameText);
	nameCell.appendChild(nameContainer);
	row.appendChild(nameCell);

	// Percentage cells
	["damage", "health", "armor"].forEach((stat, i) => {
		const cell = document.createElement("td");
		cell.setAttribute("role", "gridcell");

		const input = document.createElement("input");
		input.type = "number";
		input.className = "form-control form-control-sm";
		input.id = `bulk-hero-${hero.id}-${stat}`;
		input.min = 0;
		input.step = 20;
		input.value = hero.percentages[stat];
		input.setAttribute("aria-label", `${hero.name} ${stat} percentage`);
		input.tabIndex = index * 3 + 1 + i;
		input.dataset.heroId = String(hero.id);
		input.dataset.stat = stat;

		cell.appendChild(input);
		row.appendChild(cell);
	});

	return row;
}

/**
 * Renders the full bulk-edit card, replacing the bulk container's contents.
 * @param {Object[]} heroes - Array of hero objects
 */
function renderHeroesBulkView(heroes) {
	const sorted = sortHeroes(filterHeroes(heroes));

	// Hide all normal-view columns
	for (const child of heroesSection.children) child.style.display = "none";
	bulkContainer.style.display = "block";

	const card = document.createElement("div");
	card.className = "card card-hover";

	const cardHeader = document.createElement("div");
	cardHeader.className = "card-header d-flex justify-content-between align-items-center";

	const title = document.createElement("h5");
	title.className = "mb-0";
	title.textContent = "Bulk Edit - All Heroes";

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
	cardBody.appendChild(createHeroesBulkTable(sorted));

	card.append(cardHeader, cardBody);
	bulkContainer.replaceChildren(card);

	updateFilterBadges();
}

/**
 * Switches to the bulk edit view.
 * @param {Object[]} heroes - Array of hero objects
 */
export function switchToBulkEditHeroes(heroes) {
	currentHeroView = "bulk";
	renderHeroes(heroes);
}

/**
 * Updates a single hero's list item with current stats.
 * @param {string} heroId - ID of the hero to update
 */
export function updateHeroInList(heroId) {
	const btn = listElement.querySelector(`[data-item-id="${heroId}"]`);
	if (!btn) return;

	const hero = heroesMap.get(heroId);
	if (!hero) return;

	updateListItem(btn, formatHeroStats(hero), isConfiguredHero(hero));
}
