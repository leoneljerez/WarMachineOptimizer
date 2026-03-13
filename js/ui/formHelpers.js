// ui/formHelpers.js

/**
 * @typedef {Object} ListItemConfig
 * @property {string}  image       - Image base path (without extension)
 * @property {string}  name        - Display name
 * @property {string}  statsText   - Multi-line stats string (supports \n)
 * @property {boolean} isConfigured - Whether the item has non-default values
 * @property {string}  id          - Unique identifier (used as data-item-id)
 */

/**
 * @typedef {Object} BadgeConfig
 * @property {string} text  - Badge label
 * @property {string} [color="secondary"] - Bootstrap colour name
 */

/**
 * @typedef {Object} DetailHeaderConfig
 * @property {string}        image    - Image base path
 * @property {string}        name     - Display name
 * @property {string}        [subtitle]
 * @property {BadgeConfig[]} [badges] - Array of badge configs (replaces single-badge API)
 */

/**
 * @typedef {Object} NumberInputConfig
 * @property {number}  value   - Initial value
 * @property {number}  [min=0] - Minimum value
 * @property {number}  [step=1]
 * @property {string}  id      - Input ID (required — use explicit IDs everywhere)
 * @property {string}  dataKey - data-key attribute for delegation identification
 * @property {number}  [max]   - Optional maximum
 * @property {boolean} [isAtMax=false]
 */

// ─────────────────────────────────────────────
// Media
// ─────────────────────────────────────────────

/**
 * Creates a <picture> element with JXL → AVIF → WebP → PNG fallback chain.
 * @param {string} baseSrc  - Image path without extension
 * @param {string} alt      - Alt text for the <img>
 * @param {string} [cssText=""]  - Inline styles for the <img>
 * @param {string} [className=""] - CSS class(es) for the <img>
 * @returns {HTMLPictureElement}
 */
export function createPicture(baseSrc, alt, cssText = "", className = "") {
	const picture = document.createElement("picture");

	for (const { type, ext } of [
		{ type: "image/jxl", ext: ".jxl" },
		{ type: "image/avif", ext: ".avif" },
		{ type: "image/webp", ext: ".webp" },
	]) {
		const source = document.createElement("source");
		source.type = type;
		source.srcset = baseSrc + ext;
		picture.appendChild(source);
	}

	const img = document.createElement("img");
	img.src = baseSrc + ".png";
	img.alt = alt;
	if (cssText) img.style.cssText = cssText;
	if (className) img.className = className;
	picture.appendChild(img);

	return picture;
}

// ─────────────────────────────────────────────
// Layout helpers
// ─────────────────────────────────────────────

/**
 * Creates a labelled <section> containing a Bootstrap row of child elements.
 * @param {string}        title   - Section heading text
 * @param {HTMLElement[]} rows    - Child elements placed in the row
 * @param {string|null}   [spacing=null] - Override for the section's margin class
 * @returns {HTMLElement}
 */
export function createSection(title, rows, spacing = null) {
	const section = document.createElement("section");
	section.className = spacing || "mb-4";

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
 * Wraps a label and input in a Bootstrap column div.
 * The `inputId` parameter is required — random fallback IDs are not generated
 * because they make accessibility auditing and testing unreliable.
 * @param {string}      labelText
 * @param {HTMLElement} input
 * @param {string}      [colClass="col-12"]
 * @param {string}      inputId   - Must be provided explicitly
 * @returns {HTMLElement}
 */
export function createFormRow(labelText, input, colClass = "col-12", inputId) {
	if (!inputId && !input.id) {
		console.warn("createFormRow: inputId is required — provide an explicit ID.");
	}

	const id = inputId || input.id;

	const col = document.createElement("div");
	col.className = colClass;

	const formGroup = document.createElement("div");
	formGroup.className = "mb-3";

	const labelEl = document.createElement("label");
	labelEl.className = "form-label";
	labelEl.textContent = labelText;
	labelEl.htmlFor = id;
	input.id = id;

	formGroup.append(labelEl, input);
	col.appendChild(formGroup);
	return col;
}

// ─────────────────────────────────────────────
// Input factories
// ─────────────────────────────────────────────

/**
 * Creates a number input element (no event listeners — use delegation).
 * @param {NumberInputConfig} config
 * @returns {HTMLInputElement}
 */
export function createNumberInput({ value, min = 0, step = 1, id, dataKey, max = null, isAtMax = false }) {
	const input = document.createElement("input");
	input.type = "number";
	input.className = "form-control";
	input.min = min;
	input.step = step;
	input.value = value;
	input.setAttribute("aria-label", `${dataKey} value`);

	if (id) input.id = id;
	if (dataKey) input.dataset.key = dataKey;
	if (max !== null) {
		input.max = max;
		input.dataset.dynamicMax = max;
	}

	if (isAtMax && max !== null && value >= max) {
		input.classList.add("border-success", "border-2");
	}

	return input;
}

/**
 * Updates a blueprint input's max and applies/removes the at-max highlight.
 * @param {HTMLInputElement} input
 * @param {number}           value
 * @param {number}           max
 */
export function updateBlueprintInputState(input, value, max) {
	if (!input) return;
	input.max = max;
	input.dataset.dynamicMax = max;

	if (value >= max) {
		input.classList.add("border-success", "border-2");
	} else {
		input.classList.remove("border-success", "border-2");
	}
}

/**
 * Creates a select dropdown element (no event listeners — use delegation).
 * @param {string[]} options      - Option value strings
 * @param {string}   currentValue - Initially selected value
 * @param {string}   [id=""]
 * @param {string}   [dataKey=""]
 * @returns {HTMLSelectElement}
 */
export function createSelect(options, currentValue, id = "", dataKey = "") {
	const select = document.createElement("select");
	select.className = "form-select";
	if (id) select.id = id;
	if (dataKey) select.dataset.key = dataKey;

	const fragment = document.createDocumentFragment();
	for (const value of options) {
		const opt = document.createElement("option");
		opt.value = value;
		opt.textContent = value;
		opt.selected = value === currentValue;
		fragment.appendChild(opt);
	}

	select.appendChild(fragment);
	return select;
}

// ─────────────────────────────────────────────
// List item
// ─────────────────────────────────────────────

/**
 * Creates a list-group-item button for the entity list.
 * No click handler — use event delegation on the parent list.
 * @param {ListItemConfig} config
 * @returns {HTMLButtonElement}
 */
export function createListItem({ image, name, statsText, isConfigured, id }) {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "list-group-item list-group-item-action p-3";
	btn.setAttribute("aria-label", `Select ${name}`);
	btn.dataset.itemId = id;

	const container = document.createElement("div");
	container.className = "d-flex align-items-start gap-3";

	const thumb = createPicture(image, "", "width: 48px; height: 48px; object-fit: scale-down; object-position: left center;", "rounded");
	thumb.setAttribute("aria-hidden", "true");

	const textWrap = document.createElement("div");
	textWrap.className = "flex-grow-1 min-width-0";

	const nameRow = document.createElement("div");
	nameRow.className = "d-flex justify-content-between align-items-start mb-1";

	const nameDiv = document.createElement("div");
	nameDiv.className = "fw-semibold fs-6 text-truncate";
	nameDiv.textContent = name;

	const statusIcon = document.createElement("i");
	statusIcon.className = `bi ${isConfigured ? "bi-check-circle-fill text-success" : "bi-circle text-secondary"}`;
	statusIcon.setAttribute("aria-label", isConfigured ? "Configured" : "Default");
	statusIcon.style.fontSize = "1.1rem";

	nameRow.append(nameDiv, statusIcon);

	const statsDiv = document.createElement("div");
	statsDiv.className = "text-secondary small";
	statsDiv.style.whiteSpace = "pre-line";
	statsDiv.textContent = statsText;
	statsDiv.setAttribute("aria-label", `Stats: ${statsText}`);

	textWrap.append(nameRow, statsDiv);
	container.append(thumb, textWrap);
	btn.appendChild(container);

	return btn;
}

/**
 * Updates the stats text and configured indicator on an existing list item.
 * Only mutates the DOM if values have actually changed.
 * @param {HTMLButtonElement} btn
 * @param {string}            statsText
 * @param {boolean}           isConfigured
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
		if (statusIcon.className !== newClass) statusIcon.className = newClass;
		if (statusIcon.getAttribute("aria-label") !== newLabel) statusIcon.setAttribute("aria-label", newLabel);
	}
}

// ─────────────────────────────────────────────
// Detail header
// ─────────────────────────────────────────────

/**
 * Creates the standard detail-panel header with image, name, badges, and reset button.
 *
 * Only the `badges` array API is supported. The old `badgeText`/`badgeColor`
 * single-badge parameters have been removed — callers should pass
 * `badges: [{ text: "Tank", color: "danger" }]` instead.
 *
 * @param {DetailHeaderConfig} config
 * @returns {HTMLElement}
 */
export function createDetailHeader({ image, name, subtitle = null, badges = [] }) {
	const header = document.createElement("div");
	header.className = "d-flex align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom";

	// Left: image + name/badges
	const leftSide = document.createElement("div");
	leftSide.className = "d-flex align-items-center gap-3";

	const img = createPicture(image, name, "width: 80px; height: 80px; object-fit: scale-down; object-position: left center;", "rounded flex-shrink-0");

	const content = document.createElement("div");

	const nameEl = document.createElement("h4");
	nameEl.className = "mb-2";
	nameEl.textContent = name;
	content.appendChild(nameEl);

	const badgesContainer = document.createElement("div");
	badgesContainer.className = "d-flex flex-wrap gap-2 align-items-center";

	for (const { text, color = "secondary" } of badges) {
		const badgeEl = document.createElement("span");
		badgeEl.className = `badge bg-${color}`;
		badgeEl.textContent = text;
		badgesContainer.appendChild(badgeEl);
	}

	if (subtitle) {
		const subtitleEl = document.createElement("span");
		subtitleEl.className = "text-secondary small";
		subtitleEl.textContent = subtitle;
		badgesContainer.appendChild(subtitleEl);
	}

	content.appendChild(badgesContainer);
	leftSide.append(img, content);

	// Right: reset button
	const resetBtn = document.createElement("button");
	resetBtn.type = "button";
	resetBtn.className = "btn btn-sm btn-outline-danger flex-shrink-0";
	resetBtn.textContent = "Reset to Default";
	resetBtn.setAttribute("aria-label", `Reset ${name} to default values`);
	resetBtn.dataset.action = "reset";

	header.append(leftSide, resetBtn);
	return header;
}
