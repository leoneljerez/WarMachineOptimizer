// ui/heroes.js
import { createSection, createFormRow, createNumberInput, createListItem, updateListItem, createDetailHeader } from "./formHelpers.js";
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
	if (currentHeroView === "normal") {
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

		// Handle reset button clicks (normal view)
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

	// Handle bulk view back button
	const backBtn = e.target.closest('[data-action="back-to-normal"]');
	if (backBtn) {
		currentHeroView = "normal";
		renderHeroes(store.heroes);
	}
}

/**
 * Handles all input events via delegation
 * @param {Event} e - Input event
 */
function handleAllInputs(e) {
	const input = e.target;

	// Handle search input (both normal and bulk views)
	if (input.id === "heroSearch" || input.id === "heroSearchBulk") {
		searchQuery = input.value.toLowerCase().trim();
		applyFiltersAndSort(false); // Don't auto-select on search
		return;
	}

	if (input.type !== "number") return;

	// Normal view - detail inputs
	if (currentHeroView === "normal") {
		const hero = heroesMap.get(currentHeroId);
		if (!hero) return;

		const key = input.dataset.key;
		if (!key) return;

		const val = parseInt(input.value, 10);
		hero.percentages[key] = isNaN(val) ? 0 : Math.max(0, val);

		updateHeroInList(currentHeroId);
		triggerAutoSave(store);
	}
	// Bulk view - table inputs
	else if (currentHeroView === "bulk") {
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
 * Handles all change events via delegation
 * @param {Event} e - Change event
 */
function handleAllChanges(e) {
	const select = e.target;

	// Handle sort select (both normal and bulk views)
	if (select.id === "heroSort" || select.id === "heroSortBulk") {
		currentSort = select.value;
		applyFiltersAndSort(true); // Auto-select first on sort change
		return;
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

		if (currentHeroView === "normal") {
			const hero = heroesMap.get(currentHeroId);
			const key = input.dataset.key;
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
}

/**
 * Filters heroes based on search and active filters
 * @param {Object[]} heroes - Array of hero objects
 * @returns {Object[]} Filtered heroes
 */
function filterHeroes(heroes) {
	return heroes.filter((hero) => {
		// Search filter
		if (searchQuery && !hero.name.toLowerCase().includes(searchQuery)) {
			return false;
		}

		// Tag filters
		if (activeFilters.size > 0) {
			const hasAllTags = Array.from(activeFilters).every((tag) => hero.tags && hero.tags.includes(tag));
			if (!hasAllTags) return false;
		}

		return true;
	});
}

/**
 * Sorts heroes based on current sort option
 * @param {Object[]} heroes - Array of hero objects
 * @returns {Object[]} Sorted heroes
 */
function sortHeroes(heroes) {
	const sorted = [...heroes];

	switch (currentSort) {
		case "name-asc":
			sorted.sort((a, b) => a.name.localeCompare(b.name));
			break;
		case "name-desc":
			sorted.sort((a, b) => b.name.localeCompare(a.name));
			break;
		case "damage-asc":
			sorted.sort((a, b) => a.percentages.damage - b.percentages.damage);
			break;
		case "damage-desc":
			sorted.sort((a, b) => b.percentages.damage - a.percentages.damage);
			break;
		case "health-asc":
			sorted.sort((a, b) => a.percentages.health - b.percentages.health);
			break;
		case "health-desc":
			sorted.sort((a, b) => b.percentages.health - a.percentages.health);
			break;
		case "armor-asc":
			sorted.sort((a, b) => a.percentages.armor - b.percentages.armor);
			break;
		case "armor-desc":
			sorted.sort((a, b) => b.percentages.armor - a.percentages.armor);
			break;
		case "configured-desc":
			sorted.sort((a, b) => {
				const aConfigured = isConfiguredHero(a) ? 1 : 0;
				const bConfigured = isConfiguredHero(b) ? 1 : 0;
				return bConfigured - aConfigured;
			});
			break;
		case "configured-asc":
			sorted.sort((a, b) => {
				const aConfigured = isConfiguredHero(a) ? 1 : 0;
				const bConfigured = isConfiguredHero(b) ? 1 : 0;
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
	const allHeroes = Array.from(heroesMap.values());
	const filtered = filterHeroes(allHeroes);
	const sorted = sortHeroes(filtered);

	if (currentHeroView === "normal") {
		// Check if current selection is still valid
		const currentStillValid = currentHeroId && sorted.find((h) => String(h.id) === currentHeroId);

		// Update list without re-creating search controls
		updateHeroListOnly(sorted);

		// Handle selection
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
		// Bulk view - update only the table
		updateBulkTableOnly(sorted);
	}
}

/**
 * Updates only the hero list without touching search controls
 * @param {Object[]} heroes - Filtered and sorted heroes
 */
function updateHeroListOnly(heroes) {
	const fragment = document.createDocumentFragment();
	const heroesLen = heroes.length;

	for (let i = 0; i < heroesLen; i++) {
		const hero = heroes[i];
		const btn = createListItem({
			id: String(hero.id),
			image: hero.image,
			name: hero.name,
			statsText: formatHeroStats(hero),
			isConfigured: isConfiguredHero(hero),
		});

		fragment.appendChild(btn);
	}

	listElement.replaceChildren(fragment);

	// Restore selection if exists
	if (currentHeroId && heroesMap.has(currentHeroId)) {
		updateActiveButton(currentHeroId);
	}

	// Update filter badges
	updateFilterBadges();
}

/**
 * Updates only the bulk table without touching search controls
 * @param {Object[]} heroes - Filtered and sorted heroes
 */
function updateBulkTableOnly(heroes) {
	// Find the existing table container
	const existingTable = bulkContainer.querySelector(".table-responsive");
	if (!existingTable) return;

	// Create new table
	const newTable = createHeroesBulkTable(heroes);

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
	const filterBtn = document.getElementById("heroFilterBtn");
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
	const filterBtnBulk = document.getElementById("heroFilterBtnBulk");
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
	searchInput.id = isBulkView ? "heroSearchBulk" : "heroSearch";
	searchInput.className = "form-control";
	searchInput.placeholder = "Search heroes...";
	searchInput.value = searchQuery;

	searchGroup.appendChild(searchIcon);
	searchGroup.appendChild(searchInput);

	// Filter dropdown button
	const filterDropdown = document.createElement("div");
	filterDropdown.className = "dropdown";
	filterDropdown.style.zIndex = "1050"; // Ensure dropdown is above table headers

	const filterBtn = document.createElement("button");
	filterBtn.type = "button";
	filterBtn.id = isBulkView ? "heroFilterBtnBulk" : "heroFilterBtn";
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

	const allTags = ["Tank", "Damage", "Healer", "Rage", "Energy", "Mana", "Melee", "Ranged", "Spellcaster"];
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
 * Renders the hero list and detail view
 * Handles both normal and bulk edit modes
 * @param {Object[]} heroes - Array of hero objects
 */
export function renderHeroes(heroes) {
	heroesMap.clear();
	const heroesLen = heroes.length;
	for (let i = 0; i < heroesLen; i++) {
		heroesMap.set(String(heroes[i].id), heroes[i]);
	}

	if (currentHeroView === "bulk") {
		renderHeroesBulkView(heroes);
		return;
	}

	// Show normal view, hide bulk view
	bulkContainer.style.display = "none";
	const children = heroesSection.children;
	const childrenLen = children.length;
	for (let i = 0; i < childrenLen; i++) {
		if (children[i].id !== "heroesBulkContainer") children[i].style.display = "";
	}

	const filtered = filterHeroes(heroes);
	const sorted = sortHeroes(filtered);

	// Render everything including search controls
	renderHeroList(sorted);

	// Select first hero if none selected or current not in list
	if (!currentHeroId || !sorted.find((h) => String(h.id) === currentHeroId)) {
		if (sorted.length > 0) {
			currentHeroId = String(sorted[0].id);
			updateActiveButton(currentHeroId);
			renderHeroDetails(sorted[0]);
		}
	} else {
		// Re-render current hero details
		const currentHero = heroesMap.get(currentHeroId);
		if (currentHero) {
			updateActiveButton(currentHeroId);
			renderHeroDetails(currentHero);
		}
	}
}

/**
 * Renders the hero list with search controls
 * @param {Object[]} heroes - Array of hero objects
 */
function renderHeroList(heroes) {
	// Get or create search controls container
	let searchContainer = listElement.parentElement.querySelector(".search-controls");
	if (!searchContainer) {
		searchContainer = document.createElement("div");
		searchContainer.className = "search-controls p-3 border-bottom";
		listElement.parentElement.insertBefore(searchContainer, listElement);
	}

	searchContainer.replaceChildren(createSearchControls(false));

	const fragment = document.createDocumentFragment();
	const heroesLen = heroes.length;

	for (let i = 0; i < heroesLen; i++) {
		const hero = heroes[i];
		const btn = createListItem({
			id: String(hero.id),
			image: hero.image,
			name: hero.name,
			statsText: formatHeroStats(hero),
			isConfigured: isConfiguredHero(hero),
		});

		fragment.appendChild(btn);
	}

	listElement.replaceChildren(fragment);

	// Update filter badges after render
	updateFilterBadges();
}

/**
 * Updates the active state of list buttons
 * @param {string} heroId - ID of the hero to mark as active
 */
function updateActiveButton(heroId) {
	const buttons = listElement.querySelectorAll(".list-group-item");
	const buttonsLen = buttons.length;
	for (let i = 0; i < buttonsLen; i++) {
		buttons[i].classList.toggle("active", buttons[i].dataset.itemId === heroId);
	}
}

/**
 * Formats hero stats for display in list
 * SIMPLIFIED: No role prefix in list
 * @param {Object} hero - Hero object
 * @returns {string} Formatted stats string
 */
function formatHeroStats(hero) {
	const p = hero.percentages;
	return `Dmg ${p.damage}% • Hp ${p.health}% • Arm ${p.armor}%`;
}

/**
 * Checks if a hero has been configured (any stat > 0)
 * @param {Object} hero - Hero object
 * @returns {boolean} True if any percentage is greater than 0
 */
function isConfiguredHero(hero) {
	const p = hero.percentages;
	return p.damage > 0 || p.health > 0 || p.armor > 0;
}

/**
 * Renders the hero details form
 * NOW: Uses tags array for badges
 * @param {Object} hero - Hero object
 */
function renderHeroDetails(hero) {
	const wrapper = document.createElement("div");
	wrapper.className = "hero-detail-view";

	// Create badges from tags array
	const badges = [];
	if (hero.tags && hero.tags.length > 0) {
		// First tag is the role (tank/dps) - use color coding
		const roleTag = hero.tags[0].toLowerCase();
		badges.push({
			text: hero.tags[0],
			color: roleTag === "tank" ? "primary" : roleTag === "healer" ? "success" : "danger",
		});

		// Add remaining tags as secondary badges
		for (let i = 1; i < hero.tags.length; i++) {
			badges.push({
				text: hero.tags[i],
				color: "secondary",
			});
		}
	}

	// ENHANCED HEADER: Image + Name/Badges on left, Reset on right
	const header = createDetailHeader({
		image: hero.image,
		name: hero.name,
		badges,
	});

	const form = document.createElement("form");
	form.className = "hero-form";

	const heroId = `hero-${hero.id}`;

	// === CREW BONUS SECTION ===
	const percentSection = createSection("CREW BONUS PERCENTAGES", [
		createFormRow("Damage %", createNumberInput(hero.percentages.damage, 0, 20, `${heroId}-damage-pct`, "damage"), "col-md-4"),
		createFormRow("Health %", createNumberInput(hero.percentages.health, 0, 20, `${heroId}-health-pct`, "health"), "col-md-4"),
		createFormRow("Armor %", createNumberInput(hero.percentages.armor, 0, 20, `${heroId}-armor-pct`, "armor"), "col-md-4"),
	]);

	form.appendChild(percentSection);
	wrapper.append(header, form);

	detailsElement.replaceChildren(wrapper);
}

/**
 * Resets a hero to default values
 * @param {Object} hero - Hero object to reset
 */
function resetHero(hero) {
	const defaultPct = AppConfig.DEFAULTS.HERO_PERCENTAGE;
	hero.percentages.damage = defaultPct;
	hero.percentages.health = defaultPct;
	hero.percentages.armor = defaultPct;
}

/**
 * Creates a bulk edit table for heroes
 * @param {Object[]} heroes - Array of hero objects
 * @returns {HTMLElement} Table container with responsive wrapper
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
	thead.style.zIndex = "1"; // Table headers below dropdown
	const headerRow = document.createElement("tr");
	headerRow.setAttribute("role", "row");

	const headers = ["Hero", "Damage %", "Health %", "Armor %"];
	const widths = ["200px", "120px", "120px", "120px"];

	for (let i = 0; i < 4; i++) {
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
	const heroesLen = heroes.length;

	for (let i = 0; i < heroesLen; i++) {
		fragment.appendChild(createHeroRow(heroes[i], i));
	}

	tbody.appendChild(fragment);
	table.append(thead, tbody);
	container.appendChild(table);

	return container;
}

/**
 * Creates a single editable hero row for the bulk edit table
 * @param {Object} hero - Hero object
 * @param {number} index - Row index for tab ordering
 * @returns {HTMLElement} Table row with percentage input fields
 */
function createHeroRow(hero, index) {
	const row = document.createElement("tr");
	row.setAttribute("role", "row");

	const nameCell = document.createElement("td");
	nameCell.setAttribute("role", "gridcell");

	const nameContainer = document.createElement("div");
	nameContainer.className = "d-flex align-items-center gap-2";

	const img = document.createElement("img");
	img.src = hero.image;
	img.alt = "";
	img.className = "rounded";
	img.style.cssText = "width:32px;height:32px;object-fit:cover";
	img.setAttribute("aria-hidden", "true");

	const nameText = document.createElement("span");
	nameText.className = "fw-semibold";
	nameText.textContent = hero.name;

	nameContainer.append(img, nameText);
	nameCell.appendChild(nameContainer);
	row.appendChild(nameCell);

	const stats = ["damage", "health", "armor"];
	for (let i = 0; i < 3; i++) {
		const stat = stats[i];
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
	}

	return row;
}

/**
 * Renders the bulk edit view for all heroes
 * @param {Object[]} heroes - Array of hero objects
 */
function renderHeroesBulkView(heroes) {
	// Apply filters and sort
	const filtered = filterHeroes(heroes);
	const sorted = sortHeroes(filtered);

	// Hide normal view, show bulk view
	const children = heroesSection.children;
	const childrenLen = children.length;
	for (let i = 0; i < childrenLen; i++) {
		children[i].style.display = "none";
	}

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

	cardBody.appendChild(createHeroesBulkTable(sorted));

	card.append(cardHeader, cardBody);
	bulkContainer.replaceChildren(card);

	// Update filter badges after render
	updateFilterBadges();
}

/**
 * Switches to bulk edit view for heroes
 * @param {Object[]} heroes - Array of hero objects
 */
export function switchToBulkEditHeroes(heroes) {
	currentHeroView = "bulk";
	renderHeroes(heroes);
}

/**
 * Updates a specific hero in the list view
 * @param {string} heroId - ID of the hero to update
 */
export function updateHeroInList(heroId) {
	const btn = listElement.querySelector(`[data-item-id="${heroId}"]`);
	if (!btn) return;

	const hero = heroesMap.get(heroId);
	if (!hero) return;

	updateListItem(btn, formatHeroStats(hero), isConfiguredHero(hero));
}
