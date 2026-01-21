// ui/bulkEdit.js
import { AppConfig } from "../config.js";
import { triggerAutoSave, store } from "../app.js";

/**
 * Creates a bulk edit table for machines
 * @param {import('../app.js').Machine[]} machines - Array of machine objects
 * @param {Function} triggerAutoSave - Auto-save callback
 * @returns {HTMLElement} Table container
 */
export function createMachinesBulkTable(machines, triggerAutoSave) {
	const container = document.createElement("div");
	container.className = "table-responsive";
	container.style.width = "100%";

	const table = document.createElement("table");
	table.className = "table table-striped table-hover align-middle";
	table.setAttribute("role", "grid");

	// Create thead
	const thead = document.createElement("thead");
	thead.className = "table-dark sticky-top";

	const headerRow = document.createElement("tr");
	headerRow.setAttribute("role", "row");

	const headers = [
		{ text: "Machine", width: "200px" },
		{ text: "Rarity", width: "150px" },
		{ text: "Level", width: "100px" },
		{ text: "Damage BP", width: "110px" },
		{ text: "Health BP", width: "110px" },
		{ text: "Armor BP", width: "110px" },
	];

	headers.forEach((header) => {
		const th = document.createElement("th");
		th.setAttribute("role", "columnheader");
		th.scope = "col";
		th.textContent = header.text;
		if (header.width) {
			th.style.width = header.width;
		}
		headerRow.appendChild(th);
	});

	thead.appendChild(headerRow);
	table.appendChild(thead);

	// Create tbody - NO SORTING, use original order
	const tbody = document.createElement("tbody");

	machines.forEach((machine, index) => {
		const row = createMachineRow(machine, index, triggerAutoSave);
		tbody.appendChild(row);
	});

	table.appendChild(tbody);
	container.appendChild(table);

	return container;
}

/**
 * Creates a single machine row
 * @param {import('../app.js').Machine} machine - Machine object
 * @param {number} index - Row index
 * @param {Function} triggerAutoSave - Auto-save callback
 * @returns {HTMLElement} Table row
 */
function createMachineRow(machine, index) {
	const row = document.createElement("tr");
	row.setAttribute("role", "row");

	// Machine name cell with image
	const nameCell = document.createElement("td");
	nameCell.setAttribute("role", "gridcell");

	nameCell.innerHTML = `
        <div class="d-flex align-items-center gap-2">
            <img src="${machine.image}" alt="" class="rounded" 
                 style="width: 32px; height: 32px; object-fit: cover;" 
                 aria-hidden="true">
            <span class="fw-semibold">${machine.name}</span>
        </div>
    `;
	
	row.appendChild(nameCell);

	// Rarity cell
	const rarityCell = document.createElement("td");
	rarityCell.setAttribute("role", "gridcell");

	const raritySelect = document.createElement("select");
	raritySelect.className = "form-select form-select-sm";
	raritySelect.id = `bulk-machine-${machine.id}-rarity`;
	raritySelect.setAttribute("aria-label", `${machine.name} rarity`);
	raritySelect.tabIndex = index * 5 + 1; // Structured tab order

	AppConfig.RARITY_LABELS.forEach((rarity) => {
		const option = document.createElement("option");
		option.value = rarity;
		option.textContent = rarity;
		option.selected = machine.rarity === rarity;
		raritySelect.appendChild(option);
	});

	raritySelect.addEventListener("change", (e) => {
		machine.rarity = e.target.value;
		triggerAutoSave(store);
	});

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

	levelInput.addEventListener("input", (e) => {
		const val = parseInt(e.target.value, 10);
		machine.level = isNaN(val) ? 0 : Math.max(0, val);
		triggerAutoSave(store);
	});

	levelCell.appendChild(levelInput);
	row.appendChild(levelCell);

	// Blueprint cells
	const blueprintStats = ["damage", "health", "armor"];
	blueprintStats.forEach((stat, statIndex) => {
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
		input.tabIndex = index * 5 + 3 + statIndex;

		input.addEventListener("input", (e) => {
			const val = parseInt(e.target.value, 10);
			machine.blueprints[stat] = isNaN(val) ? 0 : Math.max(0, val);
			triggerAutoSave(store);
		});

		cell.appendChild(input);
		row.appendChild(cell);
	});

	return row;
}

/**
 * Creates a bulk edit table for heroes
 * @param {import('../app.js').Hero[]} heroes - Array of hero objects
 * @param {Function} triggerAutoSave - Auto-save callback
 * @returns {HTMLElement} Table container
 */
export function createHeroesBulkTable(heroes) {
	const container = document.createElement("div");
	container.className = "table-responsive";
	container.style.width = "100%";

	const table = document.createElement("table");
	table.className = "table table-striped table-hover align-middle";
	table.setAttribute("role", "grid");

	// Create thead
	const thead = document.createElement("thead");
	thead.className = "table-dark sticky-top";

	const headerRow = document.createElement("tr");
	headerRow.setAttribute("role", "row");

	const headers = [
		{ text: "Hero", width: "200px" },
		{ text: "Damage %", width: "120px" },
		{ text: "Health %", width: "120px" },
		{ text: "Armor %", width: "120px" },
	];

	headers.forEach((header) => {
		const th = document.createElement("th");
		th.setAttribute("role", "columnheader");
		th.scope = "col";
		th.textContent = header.text;
		if (header.width) {
			th.style.width = header.width;
		}
		headerRow.appendChild(th);
	});

	thead.appendChild(headerRow);
	table.appendChild(thead);

	// Create tbody - NO SORTING, use original order
	const tbody = document.createElement("tbody");

	heroes.forEach((hero, index) => {
		const row = createHeroRow(hero, index);
		tbody.appendChild(row);
	});

	table.appendChild(tbody);
	container.appendChild(table);

	return container;
}

/**
 * Creates a single hero row
 * @param {import('../app.js').Hero} hero - Hero object
 * @param {number} index - Row index
 * @param {Function} triggerAutoSave - Auto-save callback
 * @returns {HTMLElement} Table row
 */
function createHeroRow(hero, index) {
	const row = document.createElement("tr");
	row.setAttribute("role", "row");

	// Hero name cell with image
	const nameCell = document.createElement("td");
	nameCell.setAttribute("role", "gridcell");

	const nameContainer = document.createElement("div");
	nameContainer.className = "d-flex align-items-center gap-2";

	const img = document.createElement("img");
	img.src = hero.image;
	img.alt = "";
	img.className = "rounded";
	img.style.cssText = "width: 32px; height: 32px; object-fit: cover;";
	img.setAttribute("aria-hidden", "true");

	const nameText = document.createElement("span");
	nameText.className = "fw-semibold";
	nameText.textContent = hero.name;

	nameContainer.append(img, nameText);
	nameCell.appendChild(nameContainer);
	row.appendChild(nameCell);

	// Percentage cells
	const stats = ["damage", "health", "armor"];
	stats.forEach((stat, statIndex) => {
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
		input.tabIndex = index * 3 + 1 + statIndex;

		input.addEventListener("input", (e) => {
			const val = parseInt(e.target.value, 10);
			hero.percentages[stat] = isNaN(val) ? 0 : Math.max(0, val);
			triggerAutoSave(store);
		});

		cell.appendChild(input);
		row.appendChild(cell);
	});

	return row;
}
