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

// Cache DOM elements
let listElement = null;
let detailsElement = null;
let bulkContainer = null;

// Set up event delegation once on module load
const heroesSection = document.querySelector("#heroesTab .row.g-3");
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
	// Handle list item clicks (normal view)
	if (currentHeroView === "normal") {
		const btn = e.target.closest(".list-group-item");
		if (btn) {
			const heroId = btn.dataset.itemId;
			const hero = heroesMap.get(heroId);
			if (!hero) return;

			currentHeroId = heroId;
			updateActiveButton(listElement, heroId);
			renderHeroDetails(hero, detailsElement);
			return;
		}

		// Handle reset button clicks (normal view)
		const resetBtn = e.target.closest('[data-action="reset"]');
		if (resetBtn) {
			const hero = heroesMap.get(currentHeroId);
			if (!hero) return;

			if (confirm(`Reset ${hero.name} to default values?`)) {
				resetHero(hero);
				renderHeroDetails(hero, detailsElement);

				const listBtn = listElement.querySelector(`[data-item-id="${currentHeroId}"]`);
				if (listBtn) {
					updateListItem(listBtn, formatHeroStats(hero), isConfiguredHero(hero));
				}

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
	if (input.type !== "number") return;

	// Normal view - detail inputs
	if (currentHeroView === "normal") {
		const hero = heroesMap.get(currentHeroId);
		if (!hero) return;

		const key = input.dataset.key;
		if (!key) return;

		const val = parseInt(input.value, 10);
		hero.percentages[key] = isNaN(val) ? 0 : Math.max(0, val);

		const btn = listElement.querySelector(`[data-item-id="${currentHeroId}"]`);
		if (btn) {
			updateListItem(btn, formatHeroStats(hero), isConfiguredHero(hero));
		}

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
// eslint-disable-next-line no-unused-vars
function handleAllChanges(e) {
	// Currently unused for heroes, but here for consistency
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
 * Renders the hero list and detail view
 * Handles both normal and bulk edit modes
 * @param {Object[]} heroes - Array of hero objects
 * @param {string} heroes[].id - Unique hero identifier
 * @param {string} heroes[].name - Hero name
 * @param {string} heroes[].image - Hero image URL
 * @param {Object} heroes[].percentages - Hero stat percentages
 * @param {number} heroes[].percentages.damage - Damage percentage bonus
 * @param {number} heroes[].percentages.health - Health percentage bonus
 * @param {number} heroes[].percentages.armor - Armor percentage bonus
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

	listElement = listElement || document.getElementById("heroList");
	detailsElement = detailsElement || document.getElementById("heroDetails");

	bulkContainer = bulkContainer || document.getElementById("heroesBulkContainer");
	if (bulkContainer) bulkContainer.style.display = "none";

	const children = heroesSection.children;
	const childrenLen = children.length;
	for (let i = 0; i < childrenLen; i++) {
		if (children[i].id !== "heroesBulkContainer") children[i].style.display = "";
	}

	renderHeroList(heroes, listElement);

	const heroToSelect = currentHeroId ? heroesMap.get(currentHeroId) || heroes[0] : heroes[0];

	if (heroToSelect) {
		currentHeroId = String(heroToSelect.id);
		updateActiveButton(listElement, currentHeroId);
		renderHeroDetails(heroToSelect, detailsElement);
	}
}

/**
 * Renders the hero list
 * @param {Object[]} heroes - Array of hero objects
 * @param {HTMLElement} list - List container element
 */
function renderHeroList(heroes, list) {
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

	list.replaceChildren(fragment);
}

/**
 * Updates the active state of list buttons
 * @param {HTMLElement} list - List container element
 * @param {string} heroId - ID of the hero to mark as active
 */
function updateActiveButton(list, heroId) {
	const buttons = list.querySelectorAll(".list-group-item");
	const buttonsLen = buttons.length;
	for (let i = 0; i < buttonsLen; i++) {
		buttons[i].classList.toggle("active", buttons[i].dataset.itemId === heroId);
	}
}

/**
 * Formats hero stats for display in list
 * @param {Object} hero - Hero object
 * @param {Object} hero.percentages - Hero stat percentages
 * @returns {string} Formatted stats string
 */
function formatHeroStats(hero) {
	return `Dmg ${hero.percentages.damage}% • Hp ${hero.percentages.health}% • Arm ${hero.percentages.armor}%`;
}

/**
 * Checks if a hero has been configured (any stat > 0)
 * @param {Object} hero - Hero object
 * @param {Object} hero.percentages - Hero stat percentages
 * @returns {boolean} True if any percentage is greater than 0
 */
function isConfiguredHero(hero) {
	const p = hero.percentages;
	return p.damage > 0 || p.health > 0 || p.armor > 0;
}

/**
 * Renders the hero details form
 * @param {Object} hero - Hero object
 * @param {HTMLElement} container - Details container element
 */
function renderHeroDetails(hero, container) {
	const wrapper = document.createElement("div");
	wrapper.className = "hero-detail-view";

	const header = createDetailHeader({
		image: hero.image,
		name: hero.name,
	});

	const form = document.createElement("form");
	form.className = "hero-form";

	const heroId = `hero-${hero.id}`;

	const percentSection = createSection("Crew Bonus", [
		createFormRow("Damage %", createNumberInput(hero.percentages.damage, 0, 20, `${heroId}-damage-pct`, "damage"), "col-md-4"),
		createFormRow("Health %", createNumberInput(hero.percentages.health, 0, 20, `${heroId}-health-pct`, "health"), "col-md-4"),
		createFormRow("Armor %", createNumberInput(hero.percentages.armor, 0, 20, `${heroId}-armor-pct`, "armor"), "col-md-4"),
	]);

	form.appendChild(percentSection);
	wrapper.append(header, form);

	container.replaceChildren(wrapper);
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
	const children = heroesSection.children;
	const childrenLen = children.length;
	for (let i = 0; i < childrenLen; i++) {
		children[i].style.display = "none";
	}

	bulkContainer = bulkContainer || document.getElementById("heroesBulkContainer");
	if (!bulkContainer) {
		bulkContainer = document.createElement("div");
		bulkContainer.id = "heroesBulkContainer";
		bulkContainer.className = "col-12";
		heroesSection.appendChild(bulkContainer);
	}

	bulkContainer.style.display = "block";
	bulkContainer.replaceChildren();

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
	cardBody.appendChild(createHeroesBulkTable(heroes));

	card.append(cardHeader, cardBody);
	bulkContainer.appendChild(card);
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
	const btn = listElement?.querySelector(`[data-item-id="${heroId}"]`);
	if (!btn) return;

	const hero = heroesMap.get(heroId);
	if (!hero) return;

	updateListItem(btn, formatHeroStats(hero), isConfiguredHero(hero));
}
