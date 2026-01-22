// ui/bulkEdit.js
import { AppConfig } from "../config.js";
import { triggerAutoSave, store } from "../app.js";

/**
 * Creates a bulk edit table for machines with editable fields
 * @param {Object[]} machines - Array of machine objects
 * @param {string} machines[].id - Unique machine identifier
 * @param {string} machines[].name - Machine name
 * @param {string} machines[].image - Machine image URL
 * @param {string} machines[].rarity - Machine rarity level
 * @param {number} machines[].level - Machine level
 * @param {Object} machines[].blueprints - Blueprint levels
 * @param {number} machines[].blueprints.damage - Damage blueprint level
 * @param {number} machines[].blueprints.health - Health blueprint level
 * @param {number} machines[].blueprints.armor - Armor blueprint level
 * @returns {HTMLElement} Table container with responsive wrapper
 */
export function createMachinesBulkTable(machines) {
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
 * @param {string} machine.id - Machine identifier
 * @param {string} machine.name - Machine name
 * @param {string} machine.image - Machine image URL
 * @param {string} machine.rarity - Machine rarity
 * @param {number} machine.level - Machine level
 * @param {Object} machine.blueprints - Blueprint levels
 * @param {number} index - Row index for tab ordering
 * @returns {HTMLElement} Table row with input fields
 */
function createMachineRow(machine, index) {
	const row = document.createElement("tr");
	row.setAttribute("role", "row");

	// Name cell with image
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

	// Rarity select cell
	const rarityCell = document.createElement("td");
	rarityCell.setAttribute("role", "gridcell");

	const raritySelect = document.createElement("select");
	raritySelect.className = "form-select form-select-sm";
	raritySelect.id = `bulk-machine-${machine.id}-rarity`;
	raritySelect.setAttribute("aria-label", `${machine.name} rarity`);
	raritySelect.tabIndex = index * 5 + 1;

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

	raritySelect.addEventListener("change", (e) => {
		machine.rarity = e.target.value;
		triggerAutoSave(store);
	});

	rarityCell.appendChild(raritySelect);
	row.appendChild(rarityCell);

	// Level input cell
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

	levelInput.addEventListener("input", (e) => {
		const val = parseInt(e.target.value, 10);
		machine.level = isNaN(val) ? 0 : Math.max(0, val);
		triggerAutoSave(store);
	});

	levelCell.appendChild(levelInput);
	row.appendChild(levelCell);

	// Blueprint cells (damage, health, armor)
	const blueprintStats = ["damage", "health", "armor"];
	for (let i = 0; i < 3; i++) {
		const stat = blueprintStats[i];
		const cell = document.createElement("td");
		cell.setAttribute("role", "gridcell");

		const input = document.createElement("input");
		input.type = "number";
		input.className = "form-control form-control-sm";
		input.id = `bulk-machine-${machine.id}-bp-${stat}`;
		input.min = 0;
		input.step = 1;
		input.value = machine.blueprints[stat];
		input.setAttribute("aria-label", `${machine.name} ${stat} blueprint`);
		input.tabIndex = index * 5 + 3 + i;

		input.addEventListener("input", (e) => {
			const val = parseInt(e.target.value, 10);
			machine.blueprints[stat] = isNaN(val) ? 0 : Math.max(0, val);
			triggerAutoSave(store);
		});

		cell.appendChild(input);
		row.appendChild(cell);
	}

	return row;
}

/**
 * Creates a bulk edit table for heroes with stat percentage inputs
 * @param {Object[]} heroes - Array of hero objects
 * @param {string} heroes[].id - Unique hero identifier
 * @param {string} heroes[].name - Hero name
 * @param {string} heroes[].image - Hero image URL
 * @param {Object} heroes[].percentages - Hero stat percentages
 * @param {number} heroes[].percentages.damage - Damage percentage bonus
 * @param {number} heroes[].percentages.health - Health percentage bonus
 * @param {number} heroes[].percentages.armor - Armor percentage bonus
 * @returns {HTMLElement} Table container with responsive wrapper
 */
export function createHeroesBulkTable(heroes) {
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
 * @param {string} hero.id - Hero identifier
 * @param {string} hero.name - Hero name
 * @param {string} hero.image - Hero image URL
 * @param {Object} hero.percentages - Hero stat percentages
 * @param {number} index - Row index for tab ordering
 * @returns {HTMLElement} Table row with percentage input fields
 */
function createHeroRow(hero, index) {
	const row = document.createElement("tr");
	row.setAttribute("role", "row");

	// Name cell with image
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

	// Stat percentage cells (damage, health, armor)
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

		input.addEventListener("input", (e) => {
			const val = parseInt(e.target.value, 10);
			hero.percentages[stat] = isNaN(val) ? 0 : Math.max(0, val);
			triggerAutoSave(store);
		});

		cell.appendChild(input);
		row.appendChild(cell);
	}

	return row;
}
