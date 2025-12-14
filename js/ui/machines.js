// ui/machines.js
import {
  createSection,
  createFormRow,
  createNumberInput,
  createSelect,
  createListItem,
  updateListItem,
  createDetailHeader,
} from "./formHelpers.js";

const RARITIES = [
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

/**
 * Renders the machine list and sets up selection
 * @param {Array} machines - Array of machine objects
 */
export function renderMachines(machines) {
  const list = document.getElementById("machineList");
  const details = document.getElementById("machineDetails");

  list.replaceChildren();
  details.replaceChildren();

  let selectedButton = null;
  const fragment = document.createDocumentFragment();

  machines.forEach((machine, index) => {
    const updateStats = () => {
      const configured = isConfiguredMachine(machine);
      const statsText = `Lv. ${machine.level} • ${machine.rarity}`;
      updateListItem(btn, statsText, configured);
    };

    const btn = createListItem({
      image: machine.image,
      name: machine.name,
      statsText: `Lv. ${machine.level} • ${machine.rarity}`,
      isConfigured: isConfiguredMachine(machine),
      onClick: () => selectMachine(machine, btn, updateStats),
    });

    fragment.appendChild(btn);

    if (index === 0) {
      btn.classList.add("active");
      selectedButton = btn;
      queueMicrotask(() => {
        renderMachineDetails(machine, details, updateStats);
      });
    }
  });

  list.appendChild(fragment);

  function selectMachine(machine, btn, updateStats) {
    if (selectedButton) selectedButton.classList.remove("active");
    selectedButton = btn;
    btn.classList.add("active");
    renderMachineDetails(machine, details, updateStats);
  }
}

/**
 * Checks if a machine has non-default configuration
 * @param {Object} machine - Machine object
 * @returns {boolean} True if configured
 */
function isConfiguredMachine(machine) {
  const { rarity, level, blueprints, inscriptionLevel, sacredLevel } = machine;
  const hasBlueprints = Object.values(blueprints).some((v) => v > 0);
  const hasCards = inscriptionLevel > 0 || sacredLevel > 0;
  const hasLevel = level > 0;
  const hasRarity = rarity.toLowerCase() !== "common";
  return hasBlueprints || hasCards || hasLevel || hasRarity;
}

/**
 * Renders machine details in the detail pane
 * @param {Object} machine - Machine object
 * @param {HTMLElement} container - Detail container element
 * @param {Function} updateListStats - Callback to update list stats
 */
function renderMachineDetails(machine, container, updateListStats) {
  container.replaceChildren();
  const detailView = createMachineDetailView(machine, updateListStats);
  container.appendChild(detailView);
}

/**
 * Creates the detailed view for a machine
 * @param {Object} machine - Machine object
 * @param {Function} updateListStats - Callback to update list stats
 * @returns {HTMLElement} Detail view container
 */
function createMachineDetailView(machine, updateListStats) {
  const wrapper = document.createElement("div");
  wrapper.className = "machine-detail-view";

  const header = createDetailHeader({
    image: machine.image,
    name: machine.name,
    onReset: () => {
      if (confirm(`Reset ${machine.name} to default values?`)) {
        resetMachine(machine);
        wrapper.replaceWith(createMachineDetailView(machine, updateListStats));
        updateListStats();
      }
    },
  });

  const form = document.createElement("form");
  form.className = "machine-form";

  const machineId = `machine-${machine.id}`;

  // General section
  const generalSection = createSection("General", [
    createFormRow(
      "Rarity",
      createSelect(
        RARITIES,
        machine.rarity,
        (e) => {
          machine.rarity = e.target.value;
          updateListStats();
        },
        `${machineId}-rarity`
      ),
      "col-md-6",
      `${machineId}-rarity`
    ),
    createFormRow(
      "Level",
      createNumberInput(
        machine,
        "level",
        updateListStats,
        0,
        1,
        `${machineId}-level`
      ),
      "col-md-6",
      `${machineId}-level`
    ),
  ]);

  // Blueprint Stats section
  const blueprintSection = createSection("Blueprint Stats", [
    createFormRow(
      "Damage",
      createNumberInput(
        machine.blueprints,
        "damage",
        updateListStats,
        0,
        1,
        `${machineId}-bp-damage`
      ),
      "col-md-4",
      `${machineId}-bp-damage`
    ),
    createFormRow(
      "Health",
      createNumberInput(
        machine.blueprints,
        "health",
        updateListStats,
        0,
        1,
        `${machineId}-bp-health`
      ),
      "col-md-4",
      `${machineId}-bp-health`
    ),
    createFormRow(
      "Armor",
      createNumberInput(
        machine.blueprints,
        "armor",
        updateListStats,
        0,
        1,
        `${machineId}-bp-armor`
      ),
      "col-md-4",
      `${machineId}-bp-armor`
    ),
  ]);

  form.append(generalSection, blueprintSection);
  wrapper.append(header, form);

  return wrapper;
}

/**
 * Resets a machine to default values
 * @param {Object} machine - Machine object
 */
function resetMachine(machine) {
  machine.rarity = "Common";
  machine.level = 0;
  machine.blueprints.damage = 0;
  machine.blueprints.health = 0;
  machine.blueprints.armor = 0;
}