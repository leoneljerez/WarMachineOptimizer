/**
 * Shared form utilities for machines.js and heroes.js
 * Eliminates code duplication and ensures consistency
 */

/**
 * Creates a form section with a heading and rows
 * @param {string} title - Section heading text
 * @param {HTMLElement[]} rows - Array of form row elements
 * @returns {HTMLElement} Section container
 */
export function createSection(title, rows) {
  const section = document.createElement("div");
  section.className = "mb-4";

  const heading = document.createElement("h5");
  heading.className = "mb-3";
  heading.textContent = title;

  const rowContainer = document.createElement("div");
  rowContainer.className = "row g-3";
  
  rowContainer.append(...rows);
  section.append(heading, rowContainer);

  return section;
}

/**
 * Creates a form row with label and input
 * @param {string} label - Label text
 * @param {HTMLElement} input - Input element
 * @param {string} colClass - Bootstrap column class
 * @returns {HTMLElement} Form row container
 */
export function createFormRow(label, input, colClass = "col-12") {
  const col = document.createElement("div");
  col.className = colClass;

  const formGroup = document.createElement("div");
  formGroup.className = "form-group";

  const labelEl = document.createElement("label");
  labelEl.className = "form-label";
  labelEl.textContent = label;

  formGroup.append(labelEl, input);
  col.appendChild(formGroup);

  return col;
}

/**
 * Creates a number input that updates an object property
 * @param {Object} obj - Object to update
 * @param {string} key - Property key to update
 * @param {Function} updateCallback - Callback after value changes
 * @param {number} min - Minimum allowed value
 * @param {number} step - Step increment
 * @returns {HTMLInputElement} Number input element
 */
export function createNumberInput(obj, key, updateCallback, min = 0, step = 1) {
  const input = document.createElement("input");
  input.type = "number";
  input.className = "form-control";
  input.min = min;
  input.step = step;
  input.value = obj[key];

  input.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    obj[key] = isNaN(val) ? 0 : Math.max(min, val);
    updateCallback();
  });

  return input;
}

/**
 * Creates a select dropdown with options
 * @param {string[]} options - Array of option values
 * @param {string} currentValue - Currently selected value
 * @param {Function} onChange - Change handler function
 * @returns {HTMLSelectElement} Select element
 */
export function createSelect(options, currentValue, onChange) {
  const select = document.createElement("select");
  select.className = "form-select";

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
 * Creates a list item button with image thumbnail and text
 * @param {Object} config - Configuration object
 * @param {string} config.image - Image source URL
 * @param {string} config.name - Item name
 * @param {string} config.statsText - Secondary stats text
 * @param {boolean} config.isConfigured - Whether item is configured
 * @param {Function} config.onClick - Click handler
 * @returns {HTMLButtonElement} List item button
 */
export function createListItem({
  image,
  name,
  statsText,
  isConfigured,
  onClick
}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "list-group-item list-group-item-action d-flex align-items-center gap-2";

  const thumb = document.createElement("img");
  thumb.src = image;
  thumb.alt = name;
  thumb.style.width = "40px";
  thumb.style.height = "40px";
  thumb.style.objectFit = "cover";
  thumb.classList.add("rounded");

  const textWrap = document.createElement("div");
  textWrap.className = "flex-grow-1";

  const nameDiv = document.createElement("div");
  nameDiv.className = "fw-bold";
  nameDiv.textContent = name;

  const statsDiv = document.createElement("div");
  statsDiv.className = "text-secondary small";
  statsDiv.textContent = statsText;

  const badge = document.createElement("span");
  badge.className = `badge ${
    isConfigured ? "bg-success" : "bg-secondary"
  } ms-2`;
  badge.textContent = isConfigured ? "Configured" : "Default";
  badge.style.fontSize = "0.7rem";

  nameDiv.appendChild(badge);
  textWrap.append(nameDiv, statsDiv);
  btn.append(thumb, textWrap);

  btn.addEventListener("click", onClick);

  // Store references for updates
  btn.__statsDiv = statsDiv;
  btn.__badge = badge;

  return btn;
}

/**
 * Updates a list item's badge and stats text
 * @param {HTMLButtonElement} btn - List item button
 * @param {string} statsText - New stats text
 * @param {boolean} isConfigured - Whether item is configured
 */
export function updateListItem(btn, statsText, isConfigured) {
  if (btn.__statsDiv) {
    btn.__statsDiv.textContent = statsText;
  }
  if (btn.__badge) {
    btn.__badge.className = `badge ${
      isConfigured ? "bg-success" : "bg-secondary"
    } ms-2`;
    btn.__badge.textContent = isConfigured ? "Configured" : "Default";
  }
}

/**
 * Creates a detail view header with image, title, and reset button
 * @param {Object} config - Configuration object
 * @param {string} config.image - Image source URL
 * @param {string} config.name - Item name
 * @param {Function} config.onReset - Reset button click handler
 * @returns {HTMLElement} Header container
 */
export function createDetailHeader({ image, name, onReset }) {
  const header = document.createElement("div");
  header.className = "text-center mb-4";

  const img = document.createElement("img");
  img.src = image;
  img.alt = name;
  img.className = "img-fluid rounded";
  img.style.maxWidth = "200px";

  const title = document.createElement("h4");
  title.className = "mt-3 mb-0";
  title.textContent = name;

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn btn-sm btn-outline-danger mt-2";
  resetBtn.textContent = "Reset to Default";
  resetBtn.addEventListener("click", onReset);

  header.append(img, title, resetBtn);

  return header;
}