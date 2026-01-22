// ui/heroes.js
import { createSection, createFormRow, createNumberInput, createListItem, updateListItem, createDetailHeader } from "./formHelpers.js";
import { AppConfig } from "../config.js";
import { createHeroesBulkTable } from "./bulkEdit.js";
import { triggerAutoSave, store } from "../app.js";

// Track current view mode and selected hero
let currentHeroView = "normal";
let currentHeroId = null;
let eventHandlersAttached = false;
let heroesMap = new Map();

/**
 * Renders the hero list and sets up selection
 * @param {import('../app.js').Hero[]} heroes - Array of hero objects
 */
export function renderHeroes(heroes) {
	// Update heroes map for O(1) lookups
	heroesMap.clear();
	heroes.forEach(hero => heroesMap.set(hero.id, hero));

	if (currentHeroView === "bulk") {
		renderHeroesBulkView(heroes);
		return;
	}

	const list = document.getElementById("heroList");
	const details = document.getElementById("heroDetails");

	// Hide bulk container if it exists
	const bulkContainer = document.getElementById("heroesBulkContainer");
	if (bulkContainer) bulkContainer.style.display = "none";

	// Show normal containers
	const heroesSection = document.querySelector("#heroesTab .row.g-3");
	Array.from(heroesSection.children).forEach((child) => {
		if (child.id !== "heroesBulkContainer") child.style.display = "";
	});

	// Render list only if needed
	renderHeroList(heroes, list);
	
	// Attach event handlers once
	if (!eventHandlersAttached) {
		attachHeroEventHandlers();
		eventHandlersAttached = true;
	}

	// Select first hero or previously selected
	const heroToSelect = currentHeroId 
		? heroesMap.get(currentHeroId) || heroes[0]
		: heroes[0];
	
	if (heroToSelect) {
		currentHeroId = heroToSelect.id;
		updateActiveButton(list, heroToSelect.id);
		renderHeroDetails(heroToSelect, details);
	}
}

/**
 * Renders just the hero list
 */
function renderHeroList(heroes, list) {
	const fragment = document.createDocumentFragment();

	heroes.forEach((hero) => {
		const btn = createListItem({
			id: hero.id,
			image: hero.image,
			name: hero.name,
			statsText: formatHeroStats(hero),
			isConfigured: isConfiguredHero(hero),
		});

		fragment.appendChild(btn);
	});

	list.replaceChildren(fragment);
}

/**
 * Updates which button is active
 */
function updateActiveButton(list, heroId) {
	const buttons = list.querySelectorAll('.list-group-item');
	buttons.forEach(btn => {
		btn.classList.toggle('active', btn.dataset.itemId === heroId);
	});
}

/**
 * Attaches event handlers using delegation
 */
function attachHeroEventHandlers() {
	const list = document.getElementById("heroList");
	const details = document.getElementById("heroDetails");

	// List click delegation
	list.addEventListener("click", (e) => {
		const btn = e.target.closest('.list-group-item');
		if (!btn) return;

		const heroId = btn.dataset.itemId;
		const hero = heroesMap.get(heroId);
		if (!hero) return;

		currentHeroId = heroId;
		updateActiveButton(list, heroId);
		renderHeroDetails(hero, details);
	});

	// Details form delegation
	details.addEventListener("input", (e) => {
		const input = e.target;
		if (input.type !== "number") return;

		const hero = heroesMap.get(currentHeroId);
		if (!hero) return;

		const key = input.dataset.key;
		if (!key) return;

		const val = parseInt(input.value, 10);
		hero.percentages[key] = isNaN(val) ? 0 : Math.max(0, val);

		// Update list item
		const btn = list.querySelector(`[data-item-id="${currentHeroId}"]`);
		if (btn) {
			updateListItem(btn, formatHeroStats(hero), isConfiguredHero(hero));
		}

		triggerAutoSave(store);
	});

	// Blur validation
	details.addEventListener("blur", (e) => {
		const input = e.target;
		if (input.type !== "number") return;

		const val = parseInt(input.value, 10);
		const min = parseInt(input.min, 10) || 0;
		
		if (isNaN(val) || val < min) {
			input.value = min;
			
			const hero = heroesMap.get(currentHeroId);
			const key = input.dataset.key;
			if (hero && key) {
				hero.percentages[key] = min;
				triggerAutoSave(store);
			}
		}
	}, true);

	// Reset button delegation
	details.addEventListener("click", (e) => {
		const resetBtn = e.target.closest('[data-action="reset"]');
		if (!resetBtn) return;

		const hero = heroesMap.get(currentHeroId);
		if (!hero) return;

		if (confirm(`Reset ${hero.name} to default values?`)) {
			resetHero(hero);
			renderHeroDetails(hero, details);
			
			const btn = list.querySelector(`[data-item-id="${currentHeroId}"]`);
			if (btn) {
				updateListItem(btn, formatHeroStats(hero), isConfiguredHero(hero));
			}
			
			triggerAutoSave(store);
		}
	});
}

/**
 * Formats hero stats for display
 */
function formatHeroStats(hero) {
	return `Dmg ${hero.percentages.damage}% • Hp ${hero.percentages.health}% • Arm ${hero.percentages.armor}%`;
}

/**
 * Checks if a hero has non-zero percentages
 */
function isConfiguredHero(hero) {
	const p = hero.percentages;
	return p.damage > 0 || p.health > 0 || p.armor > 0;
}

/**
 * Renders hero details in the detail pane
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
 */
function resetHero(hero) {
	hero.percentages.damage = AppConfig.DEFAULTS.HERO_PERCENTAGE;
	hero.percentages.health = AppConfig.DEFAULTS.HERO_PERCENTAGE;
	hero.percentages.armor = AppConfig.DEFAULTS.HERO_PERCENTAGE;
}

/**
 * Renders the bulk edit view for heroes
 */
function renderHeroesBulkView(heroes) {
	const heroesSection = document.querySelector("#heroesTab .row.g-3");

	// Hide all children
	const children = heroesSection.children;
	for (let i = 0; i < children.length; i++) {
		children[i].style.display = "none";
	}

	// Find or create bulk container
	let bulkContainer = document.getElementById("heroesBulkContainer");
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
	backButton.innerHTML = '<i class="bi bi-arrow-left me-2"></i>Back to Normal View';
	backButton.addEventListener("click", async () => {
		currentHeroView = "normal";
		const { store } = await import("../app.js");
		renderHeroes(store.heroes);
	});

	cardHeader.append(title, backButton);

	const cardBody = document.createElement("div");
	cardBody.className = "card-body p-0";
	cardBody.appendChild(createHeroesBulkTable(heroes));

	card.append(cardHeader, cardBody);
	bulkContainer.appendChild(card);
}

/**
 * Switches to bulk edit view
 */
export function switchToBulkEditHeroes(heroes) {
	currentHeroView = "bulk";
	renderHeroes(heroes);
}

/**
 * Updates a specific hero in the list (call this when data changes externally)
 */
export function updateHeroInList(heroId) {
	const list = document.getElementById("heroList");
	const btn = list.querySelector(`[data-item-id="${heroId}"]`);
	if (!btn) return;

	const hero = heroesMap.get(heroId);
	if (!hero) return;

	updateListItem(btn, formatHeroStats(hero), isConfiguredHero(hero));
}