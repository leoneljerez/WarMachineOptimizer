export function createSection(title, rows) {
  const section = document.createElement("section");
  section.className = "mb-4";
  section.setAttribute("aria-labelledby", `section-${CSS.escape(title)}`);

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

export function createFormRow(
  labelText,
  input,
  colClass = "col-12",
  inputId = null
) {
  const col = document.createElement("div");
  col.className = colClass;

  const formGroup = document.createElement("div");
  formGroup.className = "mb-3";

  const labelEl = document.createElement("label");
  labelEl.className = "form-label";
  labelEl.textContent = labelText;

  const id =
    inputId || input.id || `input-${Math.random().toString(36).substr(2, 9)}`;
  labelEl.htmlFor = id;
  input.id = id;

  if (input.hasAttribute("aria-describedby")) {
    const helperId = input.getAttribute("aria-describedby");
    const helper = document.getElementById(helperId);
    if (helper) {
      formGroup.appendChild(helper);
    }
  }

  formGroup.append(labelEl, input);
  col.appendChild(formGroup);

  return col;
}

export function createNumberInput(
  obj,
  key,
  updateCallback,
  min = 0,
  step = 1,
  id = ""
) {
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

  // Use input event for real-time updates
  input.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    obj[key] = isNaN(val) ? 0 : Math.max(min, val);
    updateCallback();
  });

  // Validate on blur
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

export function createSelect(options, currentValue, onChange, id = "") {
  const select = document.createElement("select");
  select.className = "form-select";

  if (id) {
    select.id = id;
  }

  // Use DocumentFragment for better performance
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

export function createListItem({
  image,
  name,
  statsText,
  isConfigured,
  onClick,
}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "list-group-item list-group-item-action";
  btn.setAttribute("aria-label", `Select ${name}`);

  const container = document.createElement("div");
  container.className = "d-flex align-items-center gap-2";

  const thumb = document.createElement("img");
  thumb.src = image;
  thumb.alt = ""; // Decorative image, name is in text
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
  badge.className = `badge ms-2 ${
    isConfigured ? "bg-success" : "bg-secondary"
  }`;
  badge.textContent = isConfigured ? "Configured" : "Default";
  badge.setAttribute(
    "aria-label",
    isConfigured ? "Configured" : "Using default values"
  );

  nameDiv.appendChild(badge);
  textWrap.append(nameDiv, statsDiv);
  container.append(thumb, textWrap);
  btn.appendChild(container);

  btn.addEventListener("click", onClick);

  // Store references for updates
  btn.__statsDiv = statsDiv;
  btn.__badge = badge;

  return btn;
}

export function updateListItem(btn, statsText, isConfigured) {
  if (btn.__statsDiv) {
    btn.__statsDiv.textContent = statsText;
    btn.__statsDiv.setAttribute("aria-label", `Stats: ${statsText}`);
  }

  if (btn.__badge) {
    btn.__badge.className = `badge ms-2 ${
      isConfigured ? "bg-success" : "bg-secondary"
    }`;
    btn.__badge.textContent = isConfigured ? "Configured" : "Default";
    btn.__badge.setAttribute(
      "aria-label",
      isConfigured ? "Configured" : "Using default values"
    );
  }
}

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
  resetBtn.setAttribute("aria-label", `Reset ${name} to default values`);
  resetBtn.addEventListener("click", onReset);

  header.append(img, title, resetBtn);

  return header;
}
