// ui/heroes.js
import { createSection, createFormRow, createNumberInput, createListItem, updateListItem, createDetailHeader } from "./formHelpers.js";
import { AppConfig } from "../config.js";
import { createHeroesBulkTable } from "./bulkEdit.js";
import { triggerAutoSave, store } from "../app.js";

// Track current view mode
let currentHeroView = "normal"; // "normal" or "bulk"

/**
 * Renders the hero list and sets up selection
 * @param {import('../app.js').Hero[]} heroes - Array of hero objects
 */
export function renderHeroes(heroes) {
	if (currentHeroView === "bulk") {
		renderHeroesBulkView(heroes);
		return;
	}

	const list = document.getElementById("heroList");
	const details = document.getElementById("heroDetails");

	list.replaceChildren();
	details.replaceChildren();

	// Hide bulk container if it exists
	const bulkContainer = document.getElementById("heroesBulkContainer");
	if (bulkContainer) {
		bulkContainer.style.display = "none";
	}

	// Show normal containers
	const heroesSection = document.querySelector("#heroesTab .row.g-3");
	Array.from(heroesSection.children).forEach((child) => {
		if (child.id !== "heroesBulkContainer") {
			child.style.display = "";
		}
	});

	let selectedButton = null;
	const fragment = document.createDocumentFragment();

	heroes.forEach((hero, index) => {
		const updateStats = () => {
			const configured = isConfiguredHero(hero);
			const statsText = formatHeroStats(hero);
			updateListItem(btn, statsText, configured);
		};

		const btn = createListItem({
			image: hero.image,
			name: hero.name,
			statsText: formatHeroStats(hero),
			isConfigured: isConfiguredHero(hero),
			onClick: () => selectHero(hero, btn, updateStats),
		});

		fragment.appendChild(btn);

		if (index === 0) {
			btn.classList.add("active");
			selectedButton = btn;
			queueMicrotask(() => {
				renderHeroDetails(hero, details, updateStats);
			});
		}
	});

	list.appendChild(fragment);

	function selectHero(hero, btn, updateStats) {
		if (selectedButton) selectedButton.classList.remove("active");
		selectedButton = btn;
		btn.classList.add("active");
		renderHeroDetails(hero, details, updateStats);
	}
}

/**
 * Formats hero stats for display
 * @param {import('../app.js').Hero} hero - Hero object
 * @returns {string} Formatted stats string
 */
function formatHeroStats(hero) {
	return `Dmg ${hero.percentages.damage}% • Hp ${hero.percentages.health}% • Arm ${hero.percentages.armor}%`;
}

/**
 * Checks if a hero has non-zero percentages
 * @param {import('../app.js').Hero} hero - Hero object
 * @returns {boolean} True if configured
 */
function isConfiguredHero(hero) {
	const p = hero.percentages;
	return p.damage > 0 || p.health > 0 || p.armor > 0;
}

/**
 * Renders hero details in the detail pane
 * @param {import('../app.js').Hero} hero - Hero object
 * @param {HTMLElement} container - Detail container element
 * @param {Function} updateListStats - Callback to update list stats
 */
function renderHeroDetails(hero, container, updateListStats) {
	container.replaceChildren();
	const detailView = createHeroDetailView(hero, updateListStats);
	container.appendChild(detailView);
}

/**
 * Creates the detailed view for a hero
 * @param {import('../app.js').Hero} hero - Hero object
 * @param {Function} updateListStats - Callback to update list stats
 * @returns {HTMLElement} Detail view container
 */
function createHeroDetailView(hero, updateListStats) {
	const wrapper = document.createElement("div");
	wrapper.className = "hero-detail-view";

	const header = createDetailHeader({
		image: hero.image,
		name: hero.name,
		onReset: () => {
			if (confirm(`Reset ${hero.name} to default values?`)) {
				resetHero(hero);
				wrapper.replaceWith(createHeroDetailView(hero, updateListStats));
				updateListStats();
				triggerAutoSave(store);
			}
		},
	});

	const form = document.createElement("form");
	form.className = "hero-form";

	const heroId = `hero-${hero.id}`;

	const updateAndSave = () => {
		updateListStats();
		triggerAutoSave(store);
	};

	const percentSection = createSection("Crew Bonus", [
		createFormRow("Damage %", createNumberInput(hero.percentages, "damage", updateAndSave, 0, 20, `${heroId}-damage-pct`), "col-md-4"),
		createFormRow("Health %", createNumberInput(hero.percentages, "health", updateAndSave, 0, 20, `${heroId}-health-pct`), "col-md-4"),
		createFormRow("Armor %", createNumberInput(hero.percentages, "armor", updateAndSave, 0, 20, `${heroId}-armor-pct`), "col-md-4"),
	]);

	form.appendChild(percentSection);
	wrapper.append(header, form);

	return wrapper;
}

/**
 * Resets a hero to default values
 * @param {import('../app.js').Hero} hero - Hero object
 */
function resetHero(hero) {
	hero.percentages.damage = AppConfig.DEFAULTS.HERO_PERCENTAGE;
	hero.percentages.health = AppConfig.DEFAULTS.HERO_PERCENTAGE;
	hero.percentages.armor = AppConfig.DEFAULTS.HERO_PERCENTAGE;
}

/**
 * Renders the bulk edit view for heroes
 * @param {import('../app.js').Hero[]} heroes - Array of hero objects
 */
function renderHeroesBulkView(heroes) {
	const heroesSection = document.querySelector("#heroesTab .row.g-3");

	// Hide all children (list and details containers)
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

	// Create card
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

	const bulkTable = createHeroesBulkTable(heroes);
	cardBody.appendChild(bulkTable);

	card.append(cardHeader, cardBody);
	bulkContainer.appendChild(card);
}

/**
 * Switches to bulk edit view
 * @param {import('../app.js').Hero[]} heroes - Array of hero objects
 */
export function switchToBulkEditHeroes(heroes) {
	currentHeroView = "bulk";
	renderHeroes(heroes);
}
