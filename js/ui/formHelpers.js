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
 * @property {string} [subtitle] - Optional subtitle (e.g., "Epic • Lv.25")
 * @property {string} [badgeText] - Optional badge text (e.g., "Tank")
 * @property {string} [badgeColor] - Optional badge color (primary, danger, success, etc)
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

	const heading = document.createElement("h6");
	heading.className = "detail-section-header mb-3";
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
 * NOW: Uses status icon instead of badge, supports multi-line stats
 * @param {ListItemConfig} config - List item configuration
 * @returns {HTMLButtonElement} Button element
 */
export function createListItem({ image, name, statsText, isConfigured, id }) {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "list-group-item list-group-item-action p-3";
	btn.setAttribute("aria-label", `Select ${name}`);
	btn.dataset.itemId = id;

	const container = document.createElement("div");
	container.className = "d-flex align-items-start gap-3";

	// Image (slightly larger)
	const thumb = document.createElement("img");
	thumb.src = image;
	thumb.alt = "";
	thumb.className = "rounded";
	thumb.style.cssText = "width: 48px; height: 48px; object-fit: cover;";
	thumb.setAttribute("aria-hidden", "true");

	// Content wrapper
	const textWrap = document.createElement("div");
	textWrap.className = "flex-grow-1 min-width-0";

	// Name row with status icon (CHANGED: badge → icon)
	const nameRow = document.createElement("div");
	nameRow.className = "d-flex justify-content-between align-items-start mb-1";

	const nameDiv = document.createElement("div");
	nameDiv.className = "fw-semibold fs-6 text-truncate";
	nameDiv.textContent = name;

	// Status icon (CHANGED)
	const statusIcon = document.createElement("i");
	statusIcon.className = `bi ${isConfigured ? "bi-check-circle-fill text-success" : "bi-circle text-secondary"}`;
	statusIcon.setAttribute("aria-label", isConfigured ? "Configured" : "Default");
	statusIcon.style.fontSize = "1.1rem";

	nameRow.append(nameDiv, statusIcon);

	// Stats text (secondary line, preserve line breaks)
	const statsDiv = document.createElement("div");
	statsDiv.className = "text-secondary small";
	statsDiv.style.whiteSpace = "pre-line"; // Preserve \n line breaks
	statsDiv.textContent = statsText;
	statsDiv.setAttribute("aria-label", `Stats: ${statsText}`);

	textWrap.append(nameRow, statsDiv);
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
	const statusIcon = btn.querySelector("i.bi");

	if (statsDiv && statsDiv.textContent !== statsText) {
		statsDiv.textContent = statsText;
		statsDiv.setAttribute("aria-label", `Stats: ${statsText}`);
	}

	if (statusIcon) {
		const newClass = `bi ${isConfigured ? "bi-check-circle-fill text-success" : "bi-circle text-secondary"}`;
		const newLabel = isConfigured ? "Configured" : "Default";

		if (statusIcon.className !== newClass) {
			statusIcon.className = newClass;
		}
		if (statusIcon.getAttribute("aria-label") !== newLabel) {
			statusIcon.setAttribute("aria-label", newLabel);
		}
	}
}

/**
 * Creates a detail header - PROFESSIONAL: Left-aligned with reset on far right
 * @param {DetailHeaderConfig} config - Header configuration
 * @returns {HTMLElement} Header element
 */
export function createDetailHeader({ image, name, subtitle = null, badgeText = null, badgeColor = "primary", badges = [] }) {
	const header = document.createElement("div");
	header.className = "d-flex align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom";

	// Left side: Image + Name/Badges
	const leftSide = document.createElement("div");
	leftSide.className = "d-flex align-items-center gap-3";

	// Image
	const img = document.createElement("img");
	img.src = image;
	img.alt = name;
	img.className = "rounded shadow-sm flex-shrink-0";
	img.style.cssText = "width: 80px; height: 80px; object-fit: cover;";

	// Content area (name + badges)
	const content = document.createElement("div");

	// Name
	const nameEl = document.createElement("h4");
	nameEl.className = "mb-2";
	nameEl.textContent = name;

	content.appendChild(nameEl);

	// Badges container
	const badgesContainer = document.createElement("div");
	badgesContainer.className = "d-flex flex-wrap gap-2 align-items-center";

	// Add badges from array (supports multiple badges)
	if (badges && badges.length > 0) {
		badges.forEach((badge) => {
			const badgeEl = document.createElement("span");
			badgeEl.className = `badge bg-${badge.color || "secondary"}`;
			badgeEl.textContent = badge.text;
			badgesContainer.appendChild(badgeEl);
		});
	}
	// Fallback to single badge for backwards compatibility
	else if (badgeText) {
		const badge = document.createElement("span");
		badge.className = `badge bg-${badgeColor}`;
		badge.textContent = badgeText;
		badgesContainer.appendChild(badge);
	}

	// Optional subtitle
	if (subtitle) {
		const subtitleEl = document.createElement("span");
		subtitleEl.className = "text-secondary small";
		subtitleEl.textContent = subtitle;
		badgesContainer.appendChild(subtitleEl);
	}

	content.appendChild(badgesContainer);

	leftSide.append(img, content);

	// Right side: Reset button
	const resetBtn = document.createElement("button");
	resetBtn.type = "button";
	resetBtn.className = "btn btn-sm btn-outline-danger flex-shrink-0";
	resetBtn.textContent = "Reset to Default";
	resetBtn.setAttribute("aria-label", `Reset ${name} to default values`);
	resetBtn.dataset.action = "reset";

	header.append(leftSide, resetBtn);

	return header;
}
