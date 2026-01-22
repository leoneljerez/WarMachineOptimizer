// ui/heroes.js
import { createSection, createFormRow, createNumberInput, createListItem, updateListItem, createDetailHeader } from "./formHelpers.js";
import { AppConfig } from "../config.js";
import { createHeroesBulkTable } from "./bulkEdit.js";
import { triggerAutoSave, store } from "../app.js";

let currentHeroView = "normal";
let currentHeroId = null;
let heroesMap = new Map();

// Cache DOM elements
let listElement = null;
let detailsElement = null;

/**
 * Renders the hero list and sets up selection
 * @param {import('../app.js').Hero[]} heroes - Array of hero objects
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

	const bulkContainer = document.getElementById("heroesBulkContainer");
	if (bulkContainer) bulkContainer.style.display = "none";

	const heroesSection = document.querySelector("#heroesTab .row.g-3");
	const children = heroesSection.children;
	const childrenLen = children.length;
	for (let i = 0; i < childrenLen; i++) {
		if (children[i].id !== "heroesBulkContainer") children[i].style.display = "";
	}

	setupHeroEventDelegation(listElement, detailsElement);
	renderHeroList(heroes, listElement);

	const heroToSelect = currentHeroId ? heroesMap.get(currentHeroId) || heroes[0] : heroes[0];

	if (heroToSelect) {
		currentHeroId = String(heroToSelect.id);
		updateActiveButton(listElement, currentHeroId);
		renderHeroDetails(heroToSelect, detailsElement);
	}
}

/**
 * Sets up event delegation (idempotent)
 */
function setupHeroEventDelegation(list, details) {
	if (list._hasHeroListeners && details._hasHeroListeners) return;

	if (!list._hasHeroListeners) {
		const listContainer = list.classList.contains("list-group") ? list : list.querySelector(".list-group") || list;
		listContainer.addEventListener("click", handleHeroListClick);
		list._hasHeroListeners = true;
	}

	if (!details._hasHeroListeners) {
		details.addEventListener("input", handleHeroInput);
		details.addEventListener("blur", handleHeroBlur, true);
		details.addEventListener("click", handleHeroReset);
		details._hasHeroListeners = true;
	}
}

function handleHeroListClick(e) {
	const btn = e.target.closest(".list-group-item");
	if (!btn) return;

	const heroId = btn.dataset.itemId;
	const hero = heroesMap.get(heroId);
	if (!hero) return;

	currentHeroId = heroId;
	updateActiveButton(listElement, heroId);
	renderHeroDetails(hero, detailsElement);
}

function handleHeroInput(e) {
	const input = e.target;
	if (input.type !== "number") return;

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

function handleHeroBlur(e) {
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
}

function handleHeroReset(e) {
	const resetBtn = e.target.closest('[data-action="reset"]');
	if (!resetBtn) return;

	const hero = heroesMap.get(currentHeroId);
	if (!hero) return;

	if (confirm(`Reset ${hero.name} to default values?`)) {
		resetHero(hero);

		renderHeroDetails(hero, detailsElement);

		const btn = listElement.querySelector(`[data-item-id="${currentHeroId}"]`);
		if (btn) {
			updateListItem(btn, formatHeroStats(hero), isConfiguredHero(hero));
		}

		triggerAutoSave(store);
	}
}

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

function updateActiveButton(list, heroId) {
	const buttons = list.querySelectorAll(".list-group-item");
	const buttonsLen = buttons.length;
	for (let i = 0; i < buttonsLen; i++) {
		buttons[i].classList.toggle("active", buttons[i].dataset.itemId === heroId);
	}
}

function formatHeroStats(hero) {
	return `Dmg ${hero.percentages.damage}% • Hp ${hero.percentages.health}% • Arm ${hero.percentages.armor}%`;
}

function isConfiguredHero(hero) {
	const p = hero.percentages;
	return p.damage > 0 || p.health > 0 || p.armor > 0;
}

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

function resetHero(hero) {
	const defaultPct = AppConfig.DEFAULTS.HERO_PERCENTAGE;
	hero.percentages.damage = defaultPct;
	hero.percentages.health = defaultPct;
	hero.percentages.armor = defaultPct;
}

function renderHeroesBulkView(heroes) {
	const heroesSection = document.querySelector("#heroesTab .row.g-3");

	const children = heroesSection.children;
	const childrenLen = children.length;
	for (let i = 0; i < childrenLen; i++) {
		children[i].style.display = "none";
	}

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

	const backIcon = document.createElement("i");
	backIcon.className = "bi bi-arrow-left me-2";
	backButton.appendChild(backIcon);
	backButton.appendChild(document.createTextNode("Back to Normal View"));

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

export function switchToBulkEditHeroes(heroes) {
	currentHeroView = "bulk";
	renderHeroes(heroes);
}

export function updateHeroInList(heroId) {
	const btn = listElement.querySelector(`[data-item-id="${heroId}"]`);
	if (!btn) return;

	const hero = heroesMap.get(heroId);
	if (!hero) return;

	updateListItem(btn, formatHeroStats(hero), isConfiguredHero(hero));
}
