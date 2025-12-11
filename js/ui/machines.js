export function renderMachines(machines) {
  const list = document.getElementById("machineList");
  const details = document.getElementById("machineDetails");

  list.replaceChildren();
  details.replaceChildren();

  let selectedButton = null;

  machines.forEach((machine, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "list-group-item list-group-item-action d-flex align-items-center gap-2";

    const thumb = document.createElement("img");
    thumb.src = machine.image;
    thumb.alt = machine.name;
    thumb.style.width = "40px";
    thumb.style.height = "40px";
    thumb.style.objectFit = "cover";
    thumb.classList.add("rounded");

    const textWrap = document.createElement("div");
    textWrap.className = "flex-grow-1";

    const name = document.createElement("div");
    name.className = "fw-bold";
    name.textContent = machine.name;

    const stats = document.createElement("div");
    stats.className = "text-secondary small";

    // Check if machine is configured
    const isConfigured = isConfiguredMachine(machine);

    const badge = document.createElement("span");
    badge.className = `badge ${
      isConfigured ? "bg-success" : "bg-secondary"
    } ms-2`;
    badge.textContent = isConfigured ? "Configured" : "Default";
    badge.style.fontSize = "0.7rem";

    const updateStats = () => {
      const configured = isConfiguredMachine(machine);
      stats.textContent = `Lv. ${machine.level} • ${machine.rarity}`;
      badge.className = `badge ${
        configured ? "bg-success" : "bg-secondary"
      } ms-2`;
      badge.textContent = configured ? "Configured" : "Default";
    };
    updateStats();

    name.appendChild(badge);
    textWrap.appendChild(name);
    textWrap.appendChild(stats);

    btn.appendChild(thumb);
    btn.appendChild(textWrap);

    btn.addEventListener("click", () => {
      selectMachine(machine, btn, updateStats);
    });

    list.appendChild(btn);

    if (index === 0) {
      btn.classList.add("active");
      selectedButton = btn;
      renderMachineDetails(machine, details, updateStats);
    }
  });

  function selectMachine(machine, btn, updateStats) {
    if (selectedButton) selectedButton.classList.remove("active");
    selectedButton = btn;
    btn.classList.add("active");

    renderMachineDetails(machine, details, updateStats);
  }
}

function isConfiguredMachine(machine) {
  const { rarity, level, blueprints, inscriptionLevel, sacredLevel } = machine;
  const hasBlueprints = Object.values(blueprints).some((v) => v > 0);
  const hasCards = inscriptionLevel > 0 || sacredLevel > 0;
  const hasLevel = level > 0;
  const hasRarity = rarity.toLowerCase() !== "common";
  return hasBlueprints || hasCards || hasLevel || hasRarity;
}

function renderMachineDetails(machine, container, updateListStats) {
  container.replaceChildren();

  // Create detail view without template
  const detailView = createMachineDetailView(machine, updateListStats);
  container.appendChild(detailView);
}

function createMachineDetailView(machine, updateListStats) {
  const wrapper = document.createElement("div");
  wrapper.className = "machine-detail-view";

  // Header with image and name
  const header = document.createElement("div");
  header.className = "text-center mb-4";

  const img = document.createElement("img");
  img.src = machine.image;
  img.alt = machine.name;
  img.className = "img-fluid rounded";
  img.style.maxWidth = "200px";

  const title = document.createElement("h4");
  title.className = "mt-3 mb-0";
  title.textContent = machine.name;

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn btn-sm btn-outline-danger mt-2";
  resetBtn.textContent = "Reset to Default";
  resetBtn.addEventListener("click", () => {
    if (confirm(`Reset ${machine.name} to default values?`)) {
      resetMachine(machine);
      wrapper.replaceWith(createMachineDetailView(machine, updateListStats));
      updateListStats();
    }
  });

  header.appendChild(img);
  header.appendChild(title);
  header.appendChild(resetBtn);

  // Form sections
  const form = document.createElement("form");
  form.className = "machine-form";

  // General section
  const generalSection = createSection("General", [
    createFormRow(
      "Rarity",
      createRaritySelect(machine, updateListStats),
      "col-md-6"
    ),
    createFormRow(
      "Level",
      createNumberInput(machine, "level", updateListStats, 0, 1),
      "col-md-6"
    ),
  ]);

  // Blueprint Stats section
  const blueprintSection = createSection("Blueprint Stats", [
    createFormRow(
      "Damage",
      createNumberInput(machine.blueprints, "damage", updateListStats, 0, 1),
      "col-md-4"
    ),
    createFormRow(
      "Health",
      createNumberInput(machine.blueprints, "health", updateListStats, 0, 1),
      "col-md-4"
    ),
    createFormRow(
      "Armor",
      createNumberInput(machine.blueprints, "armor", updateListStats, 0, 1),
      "col-md-4"
    ),
  ]);

  // Card Levels section
  const cardSection = createSection("Card Levels", [
    createFormRow(
      "Sacred Card",
      createNumberInput(machine, "sacredLevel", updateListStats, 0, 1),
      "col-md-6"
    ),
    createFormRow(
      "Inscription Card",
      createNumberInput(machine, "inscriptionLevel", updateListStats, 0, 1),
      "col-md-6"
    ),
  ]);

  form.appendChild(generalSection);
  form.appendChild(blueprintSection);
  form.appendChild(cardSection);

  wrapper.appendChild(header);
  wrapper.appendChild(form);

  return wrapper;
}

function createSection(title, rows) {
  const section = document.createElement("div");
  section.className = "mb-4";

  const heading = document.createElement("h5");
  heading.className = "mb-3";
  heading.textContent = title;
  section.appendChild(heading);

  const rowContainer = document.createElement("div");
  rowContainer.className = "row g-3";
  rows.forEach((row) => rowContainer.appendChild(row));
  section.appendChild(rowContainer);

  return section;
}

function createFormRow(label, input, colClass = "col-12") {
  const col = document.createElement("div");
  col.className = colClass;

  const formGroup = document.createElement("div");
  formGroup.className = "form-group";

  const labelEl = document.createElement("label");
  labelEl.className = "form-label";
  labelEl.textContent = label;

  formGroup.appendChild(labelEl);
  formGroup.appendChild(input);
  col.appendChild(formGroup);

  return col;
}

function createRaritySelect(machine, updateCallback) {
  const select = document.createElement("select");
  select.className = "form-select";

  const rarities = [
    "Common",
    "Uncommon",
    "Rare",
    "Epic",
    "Legendary",
    "Mythic",
    "Titan",
    "Angel",
    "Celestial",
  ];
  rarities.forEach((rarity) => {
    const option = document.createElement("option");
    option.value = rarity;
    option.textContent = rarity;
    option.selected = machine.rarity === rarity;
    select.appendChild(option);
  });

  select.addEventListener("change", (e) => {
    machine.rarity = e.target.value;
    updateCallback();
  });

  return select;
}

function createNumberInput(obj, key, updateCallback, min = 0, step = 1) {
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

function resetMachine(machine) {
  machine.rarity = "Common";
  machine.level = 0;
  machine.blueprints.damage = 0;
  machine.blueprints.health = 0;
  machine.blueprints.armor = 0;
  machine.inscriptionLevel = 0;
  machine.sacredLevel = 0;
}
