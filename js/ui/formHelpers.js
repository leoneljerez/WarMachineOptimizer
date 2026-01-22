// ui/formHelpers.js

/**
 * @typedef {Object} ListItemConfig
 * @property {string} image - Image source URL
 * @property {string} name - Display name
 * @property {string} statsText - Stats text to display
 * @property {boolean} isConfigured - Whether item is configured
 * @property {string} id - Unique identifier
 */

/**
 * @typedef {Object} DetailHeaderConfig
 * @property {string} image - Image source URL
 * @property {string} name - Display name
 */

/**
 * Creates a section with title and rows
 * @param {string} title - Section title
 * @param {HTMLElement[]} rows - Array of row elements
 * @returns {HTMLElement} Section element
 */
export function createSection(title, rows) {
	const section = document.createElement("section");
	section.className = "mb-4";

	const sectionId = `section-${title.replace(/\s+/g, "-").toLowerCase()}`;
	section.setAttribute("aria-labelledby", sectionId);

	const heading = document.createElement("h5");
	heading.className = "mb-3";
	heading.id = sectionId;
	heading.textContent = title;

	const rowContainer = document.createElement("div");
	rowContainer.className = "row g-3";
	rowContainer.append(...rows);

	section.append(heading, rowContainer);
	return section;
}

/**
 * Creates a form row with label and input
 * @param {string} labelText - Label text
 * @param {HTMLElement} input - Input element
 * @param {string} colClass - Bootstrap column class
 * @param {string|null} inputId - Optional input ID
 * @returns {HTMLElement} Column element
 */
export function createFormRow(labelText, input, colClass = "col-12", inputId = null) {
	const col = document.createElement("div");
	col.className = colClass;

	const formGroup = document.createElement("div");
	formGroup.className = "mb-3";

	const labelEl = document.createElement("label");
	labelEl.className = "form-label";
	labelEl.textContent = labelText;

	const id = inputId || input.id || `input-${Math.random().toString(36).substr(2, 9)}`;
	labelEl.htmlFor = id;
	input.id = id;

	formGroup.append(labelEl, input);
	col.appendChild(formGroup);

	return col;
}

/**
 * Creates a number input element (no event listeners - use delegation)
 * @param {number} value - Initial value
 * @param {number} min - Minimum value
 * @param {number} step - Step value
 * @param {string} id - Input ID
 * @param {string} dataKey - Data attribute key for identification
 * @returns {HTMLInputElement} Input element
 */
export function createNumberInput(value, min = 0, step = 1, id = "", dataKey = "") {
	const input = document.createElement("input");
	input.type = "number";
	input.className = "form-control";
	input.min = min;
	input.step = step;
	input.value = value;
	input.setAttribute("aria-label", `${dataKey} value`);

	if (id) input.id = id;
	if (dataKey) input.dataset.key = dataKey;

	return input;
}

/**
 * Creates a select dropdown element (no event listeners - use delegation)
 * @param {string[]} options - Array of option values
 * @param {string} currentValue - Currently selected value
 * @param {string} id - Select ID
 * @param {string} dataKey - Data attribute key for identification
 * @returns {HTMLSelectElement} Select element
 */
export function createSelect(options, currentValue, id = "", dataKey = "") {
	const select = document.createElement("select");
	select.className = "form-select";

	if (id) select.id = id;
	if (dataKey) select.dataset.key = dataKey;

	const fragment = document.createDocumentFragment();

	options.forEach((option) => {
		const optionEl = document.createElement("option");
		optionEl.value = option;
		optionEl.textContent = option;
		optionEl.selected = currentValue === option;
		fragment.appendChild(optionEl);
	});

	select.appendChild(fragment);
	return select;
}

/**
 * Creates a list item button (no click handler - use delegation)
 * @param {ListItemConfig} config - List item configuration
 * @returns {HTMLButtonElement} Button element
 */
export function createListItem({ image, name, statsText, isConfigured, id }) {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "list-group-item list-group-item-action";
	btn.setAttribute("aria-label", `Select ${name}`);
	btn.dataset.itemId = id;

	const container = document.createElement("div");
	container.className = "d-flex align-items-center gap-2";

	const thumb = document.createElement("img");
	thumb.src = image;
	thumb.alt = "";
	thumb.className = "rounded";
	thumb.style.cssText = "width: 40px; height: 40px; object-fit: cover;";
	thumb.setAttribute("aria-hidden", "true");

	const textWrap = document.createElement("div");
	textWrap.className = "flex-grow-1";

	const nameDiv = document.createElement("div");
	nameDiv.className = "fw-bold";
	nameDiv.textContent = name;

	const statsDiv = document.createElement("div");
	statsDiv.className = "text-secondary small";
	statsDiv.textContent = statsText;
	statsDiv.setAttribute("aria-label", `Stats: ${statsText}`);

	const badge = document.createElement("span");
	badge.className = `badge ms-2 ${isConfigured ? "bg-success" : "bg-secondary"}`;
	badge.textContent = isConfigured ? "Configured" : "Default";
	badge.setAttribute("aria-label", isConfigured ? "Configured" : "Using default values");

	nameDiv.appendChild(badge);
	textWrap.append(nameDiv, statsDiv);
	container.append(thumb, textWrap);
	btn.appendChild(container);

	return btn;
}

/**
 * Updates an existing list item
 * @param {HTMLButtonElement} btn - Button element to update
 * @param {string} statsText - New stats text
 * @param {boolean} isConfigured - New configuration state
 */
export function updateListItem(btn, statsText, isConfigured) {
	const statsDiv = btn.querySelector(".text-secondary.small");
	const badge = btn.querySelector(".badge");

	if (statsDiv && statsDiv.textContent !== statsText) {
		statsDiv.textContent = statsText;
		statsDiv.setAttribute("aria-label", `Stats: ${statsText}`);
	}

	if (badge) {
		const newClass = `badge ms-2 ${isConfigured ? "bg-success" : "bg-secondary"}`;
		const newText = isConfigured ? "Configured" : "Default";

		if (badge.className !== newClass) {
			badge.className = newClass;
		}
		if (badge.textContent !== newText) {
			badge.textContent = newText;
			badge.setAttribute("aria-label", newText === "Configured" ? "Configured" : "Using default values");
		}
	}
}

/**
 * Creates a detail header with image and reset button (no event listener - use delegation)
 * @param {DetailHeaderConfig} config - Header configuration
 * @returns {HTMLElement} Header element
 */
export function createDetailHeader({ image, name }) {
	const header = document.createElement("div");
	header.className = "text-center mb-4";

	const img = document.createElement("img");
	img.src = image;
	img.alt = name;
	img.className = "img-fluid rounded shadow-sm";
	img.style.maxWidth = "200px";

	const title = document.createElement("h4");
	title.className = "mt-3 mb-0";
	title.textContent = name;

	const resetBtn = document.createElement("button");
	resetBtn.type = "button";
	resetBtn.className = "btn btn-sm btn-outline-danger mt-3";
	resetBtn.textContent = "Reset to Default";
	resetBtn.setAttribute("aria-label", `Reset ${name} to default values`);
	resetBtn.dataset.action = "reset";

	header.append(img, title, resetBtn);

	return header;
}
