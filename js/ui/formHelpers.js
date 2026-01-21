// ui/formHelpers.js

/**
 * @typedef {Object} ListItemConfig
 * @property {string} image - Image source URL
 * @property {string} name - Display name
 * @property {string} statsText - Stats text to display
 * @property {boolean} isConfigured - Whether item is configured
 * @property {Function} onClick - Click handler
 */

/**
 * @typedef {Object} DetailHeaderConfig
 * @property {string} image - Image source URL
 * @property {string} name - Display name
 * @property {Function} onReset - Reset handler
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

	const sectionId = `section-${title.replace(/\s+/g, '-').toLowerCase()}`;
    section.setAttribute("aria-labelledby", sectionId);

	const heading = document.createElement("h5");
	heading.className = "mb-3";
	heading.id = `section-${CSS.escape(title)}`;
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
 * Creates a number input element
 * @param {Object} obj - Object to bind to
 * @param {string} key - Property key
 * @param {Function} updateCallback - Update callback
 * @param {number} min - Minimum value
 * @param {number} step - Step value
 * @param {string} id - Input ID
 * @returns {HTMLInputElement} Input element
 */
export function createNumberInput(obj, key, updateCallback, min = 0, step = 1, id = "") {
	const input = document.createElement("input");
	input.type = "number";
	input.className = "form-control";
	input.min = min;
	input.step = step;
	input.value = obj[key];
	input.setAttribute("aria-label", `${key} value`);

	if (id) {
		input.id = id;
	}

	input.addEventListener("input", (e) => {
		const val = parseInt(e.target.value, 10);
		obj[key] = isNaN(val) ? 0 : Math.max(min, val);
		updateCallback();
	});

	input.addEventListener("blur", (e) => {
		const val = parseInt(e.target.value, 10);
		if (isNaN(val) || val < min) {
			e.target.value = min;
			obj[key] = min;
			updateCallback();
		}
	});

	return input;
}

/**
 * Creates a select dropdown element
 * @param {string[]} options - Array of option values
 * @param {string} currentValue - Currently selected value
 * @param {Function} onChange - Change handler
 * @param {string} id - Select ID
 * @returns {HTMLSelectElement} Select element
 */
export function createSelect(options, currentValue, onChange, id = "") {
	const select = document.createElement("select");
	select.className = "form-select";

	if (id) {
		select.id = id;
	}

	const fragment = document.createDocumentFragment();

	options.forEach((option) => {
		const optionEl = document.createElement("option");
		optionEl.value = option;
		optionEl.textContent = option;
		optionEl.selected = currentValue === option;
		fragment.appendChild(optionEl);
	});

	select.appendChild(fragment);
	select.addEventListener("change", onChange);

	return select;
}

/**
 * Creates a list item button
 * @param {ListItemConfig} config - List item configuration
 * @returns {HTMLButtonElement} Button element
 */
export function createListItem({ image, name, statsText, isConfigured, onClick }) {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "list-group-item list-group-item-action";
	btn.setAttribute("aria-label", `Select ${name}`);

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

	if (onClick) {
		btn.addEventListener("click", onClick);
	}

	btn.__statsDiv = statsDiv;
	btn.__badge = badge;

	return btn;
}

/**
 * Updates an existing list item
 * @param {HTMLButtonElement} btn - Button element to update
 * @param {string} statsText - New stats text
 * @param {boolean} isConfigured - New configuration state
 */
export function updateListItem(btn, statsText, isConfigured) {
	if (btn.__statsDiv) {
		btn.__statsDiv.textContent = statsText;
		btn.__statsDiv.setAttribute("aria-label", `Stats: ${statsText}`);
	}

	if (btn.__badge) {
		btn.__badge.className = `badge ms-2 ${isConfigured ? "bg-success" : "bg-secondary"}`;
		btn.__badge.textContent = isConfigured ? "Configured" : "Default";
		btn.__badge.setAttribute("aria-label", isConfigured ? "Configured" : "Using default values");
	}
}

/**
 * Creates a detail header with image and reset button
 * @param {DetailHeaderConfig} config - Header configuration
 * @returns {HTMLElement} Header element
 */
export function createDetailHeader({ image, name, onReset }) {
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
	resetBtn.addEventListener("click", onReset);

	header.append(img, title, resetBtn);

	return header;
}
