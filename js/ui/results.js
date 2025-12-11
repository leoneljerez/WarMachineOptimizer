import Decimal from "../vendor/break_eternity.esm.js";

/**
 * Converts a serialized Decimal to a Decimal instance
 */
function toDecimal(serialized) {
  return Decimal.fromComponents(
    serialized.sign,
    serialized.layer,
    serialized.mag
  );
}

/**
 * Formats a Decimal as a localized integer string
 */
function formatPower(decimal) {

  if(toDecimal(decimal).lessThan(999000000))
    return Math.trunc(toDecimal(decimal).toNumber()).toLocaleString("en-US");

  return toDecimal(decimal).toExponential(2);
}

/**
 * Updates stats display for a single machine card
 */
function updateMachineStats(card, mode) {
  const machine = card.__machine;
  if (!machine) return;

  const stats = mode === "arena" ? machine.arenaStats : machine.battleStats;

  card.querySelector(".damage .value").textContent = toDecimal(
    stats.damage
  ).toExponential(2);
  card.querySelector(".health .value").textContent = toDecimal(
    stats.health
  ).toExponential(2);
  card.querySelector(".armor .value").textContent = toDecimal(
    stats.armor
  ).toExponential(2);
}

/**
 * Creates a crew member image element
 */
function createCrewImage(hero) {
  const img = document.createElement("img");
  img.src = hero.image || "hero-placeholder.png";
  img.alt = hero.name;
  img.title = hero.name;
  img.className = "rounded border";
  img.style.cssText = "width: 30px; height: 30px; object-fit: cover;";
  return img;
}

/**
 * Creates a machine card for the formation display
 */
function createMachineCard(machine, machineTemplate) {
  const clone = machineTemplate.content.cloneNode(true);
  const card = clone.querySelector(".machine-card");

  // Attach machine data for stats toggling
  card.__machine = machine;

  // Machine image
  const img = clone.querySelector(".machine-image");
  img.src = machine.image || "placeholder.png";
  img.alt = machine.name;

  // Machine name and info
  clone.querySelector(
    ".machine-name"
  ).textContent = `${machine.name} (Lv ${machine.level}, ${machine.rarity})`;

  // Initial stats (battle mode by default)
  updateMachineStats(card, "battle");

  // Crew images
  const crewDiv = clone.querySelector(".crew");
  Object.values(machine.crew).forEach((hero) => {
    crewDiv.appendChild(createCrewImage(hero));
  });

  return clone;
}

/**
 * Sets up the battle/arena stats toggle
 */
function setupStatsToggle(result) {
  const toggle = document.getElementById("statsToggle");
  if (!toggle || toggle.__initialized) return;

  toggle.__initialized = true;

  toggle.addEventListener("change", (e) => {
    const mode = e.target.value;

    // Update all machine cards
    document.querySelectorAll(".machine-card").forEach((card) => {
      updateMachineStats(card, mode);
    });

    // Update power display
    const power = mode === "arena" ? result.arenaPower : result.battlePower;
    const title = mode === "arena" ? "Arena Power:" : "Battle Power:";

    document.querySelector(".powerResult").textContent = formatPower(power);
    document.querySelector(".powerTitle").textContent = title;
  });
}

/**
 * Main render function for optimization results
 */
export function renderResults(result, optimizeMode = "campaign") {
  //console.log("Result:", result);

  const container = document.getElementById("resultsContainer");
  container.replaceChildren();

  // Handle no results case
  if (!result) {
    const noResult = document.createElement("p");
    noResult.className = "text-secondary";
    noResult.textContent = "No results available.";
    container.appendChild(noResult);
    return;
  }

  // Clone result template
  const template = document.getElementById("resultTemplate");
  const clone = template.content.cloneNode(true);

  // Set initial power display based on optimization mode
  const initialPower =
    optimizeMode === "arena" ? result.arenaPower : result.battlePower;
  const initialTitle =
    optimizeMode === "arena" ? "Arena Power:" : "Battle Power:";

  clone.querySelector(".powerResult").textContent = formatPower(initialPower);
  clone.querySelector(".powerTitle").textContent = initialTitle;

  // Handle campaign-specific stats
  if (optimizeMode === "campaign") {
    clone.querySelector(".totalStars").textContent = result.totalStars || 0;
    clone.querySelector(".lastCleared").textContent = result.lastCleared || 0;
  } else {
    // For arena mode, hide campaign-specific stats
    clone.querySelector(".totalStars").textContent = "N/A";
    clone.querySelector(".lastCleared").textContent = "N/A";
  }

  // Set initial toggle state based on optimization mode
  const battleRadio = clone.querySelector("#battleStats");
  const arenaRadio = clone.querySelector("#arenaStats");

  if (optimizeMode === "arena") {
    battleRadio.checked = false;
    arenaRadio.checked = true;
  } else {
    battleRadio.checked = true;
    arenaRadio.checked = false;
  }

  // Map formation positions to slots
  const positionMap = {
    1: clone.querySelector('.right-column .machine-slot[data-position="1"]'),
    2: clone.querySelector('.right-column .machine-slot[data-position="2"]'),
    3: clone.querySelector('.left-column .machine-slot[data-position="3"]'),
    4: clone.querySelector('.left-column .machine-slot[data-position="4"]'),
    5: clone.querySelector('.left-column .machine-slot[data-position="5"]'),
  };

  // Render each machine in the formation
  const machineTemplate = document.getElementById("machineTemplate");
  result.formation.forEach((machine, index) => {
    const slot = positionMap[index + 1];
    if (!slot) return;

    const machineCard = createMachineCard(machine, machineTemplate);
    slot.appendChild(machineCard);
  });

  container.appendChild(clone);

  // Update initial machine stats based on mode
  document.querySelectorAll(".machine-card").forEach((card) => {
    updateMachineStats(card, optimizeMode === "arena" ? "arena" : "battle");
  });

  // Setup toggle for battle/arena stats
  setupStatsToggle(result);
}
