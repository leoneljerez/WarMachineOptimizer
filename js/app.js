// js/app.js
import { renderMachines } from "./ui/machines.js";
import { renderHeroes } from "./ui/heroes.js";
import { renderArtifacts, resetAllArtifacts } from "./ui/artifacts.js";
import { renderResults } from "./ui/results.js";
import { machinesData } from "./data/machines.js";
import { heroesData } from "./data/heroes.js";
import { abilitiesData } from "./data/abilities.js";
import { Calculator } from "./calculator.js";
import { SaveLoad } from "./saveload.js";

// ---------------------------
// Data for input
// ---------------------------

function createInitialStore() {
  return {
    machines: machinesData.map((machine) => ({
      ...machine,
      ability: abilitiesData[machine.ability.key],
      rarity: "Common",
      level: 0,
      blueprints: {
        damage: 0,
        health: 0,
        armor: 0,
      },
      inscriptionLevel: 0,
      sacredLevel: 0,
      battleStats: {
        damage: 0,
        health: 0,
        armor: 0,
        maxHealth: 0,
      },
      arenaStats: {
        damage: 0,
        health: 0,
        armor: 0,
        maxHealth: 0,
      },
      crew: [],
    })),
    heroes: heroesData.map((hero) => ({
      ...hero,
      percentages: {
        damage: 0,
        health: 0,
        armor: 0,
      },
    })),
    artifacts: {
      damage: { 30: 0, 35: 0, 40: 0, 45: 0, 50: 0, 55: 0, 60: 0, 65: 0 },
      health: { 30: 0, 35: 0, 40: 0, 45: 0, 50: 0, 55: 0, 60: 0, 65: 0 },
      armor: { 30: 0, 35: 0, 40: 0, 45: 0, 50: 0, 55: 0, 60: 0, 65: 0 },
    },
    engineerLevel: 0,
    scarabLevel: 0,
    riftRank: "bronze",
    optimizeMode: "campaign", // Default mode
  };
}

export const store = createInitialStore();

// ---------------------------
// UI
// ---------------------------

function setLoading(isLoading) {
  const body = document.body;
  const optimizeBtn = document.getElementById("optimizeBtn");

  if (isLoading) {
    body.style.cursor = "wait";
    optimizeBtn.disabled = true;
    optimizeBtn.textContent = "Optimizing...";
  } else {
    body.style.cursor = "default";
    optimizeBtn.disabled = false;
    updateOptimizeButtonText();
  }
}

function updateOptimizeButtonText() {
  const optimizeBtn = document.getElementById("optimizeBtn");
  const mode = store.optimizeMode;

  if (mode === "arena") {
    optimizeBtn.textContent = "Optimize for Arena";
  } else {
    optimizeBtn.textContent = "Optimize for Campaign";
  }
}

function switchToResultsTab() {
  const resultsTabLink = document.querySelector('a[href="#resultsTab"]');
  if (resultsTabLink) {
    // eslint-disable-next-line no-undef
    const tab = new bootstrap.Tab(resultsTabLink);
    tab.show();
  }
}

// ---------------------------
// Optimize
// ---------------------------

function getOwnedMachines() {
  return store.machines.filter((machine) => {
    const { rarity, level, blueprints, inscriptionLevel, sacredLevel } =
      machine;
    const hasBlueprints = Object.values(blueprints).some((v) => v > 0);
    const hasCards = inscriptionLevel > 0 || sacredLevel > 0;
    const hasLevel = level > 0;
    const hasRarity = rarity.toLowerCase() !== "common";
    return hasBlueprints || hasCards || hasLevel || hasRarity;
  });
}

function getOwnedHeroes() {
  return store.heroes.filter((hero) =>
    Object.values(hero.percentages).some((v) => v > 0)
  );
}

function getArtifactArray() {
  return Object.keys(store.artifacts).map((stat) => ({
    stat,
    values: store.artifacts[stat],
  }));
}

function runOptimization() {
  setLoading(true);

  const ownedMachines = getOwnedMachines();
  const ownedHeroes = getOwnedHeroes();
  const artifactArray = getArtifactArray();
  const globalRarityLevels = Calculator.getGlobalRarityLevels(ownedMachines);

  // Only enable for debug since Console.log slows down performance
  /* console.log("Starting optimization with:", {
    mode: store.optimizeMode,
    machines: ownedMachines.length,
    heroes: ownedHeroes.length,
    engineerLevel: store.engineerLevel,
    scarabLevel: store.scarabLevel,
    artifacts: artifactArray,
    globalRarityLevels,
  }); */

  const worker = new Worker("js/optimizerWorker.js", { type: "module" });

  worker.postMessage({
    mode: store.optimizeMode,
    ownedMachines,
    ownedHeroes,
    maxMission: 90,
    globalRarityLevels,
    engineerLevel: store.engineerLevel,
    scarabLevel: store.scarabLevel,
    artifactArray,
    riftRank: store.riftRank,
  });

  worker.onmessage = function (e) {
    const result = e.data;

    if (result.error) {
      console.error("Optimizer worker error:", result.error);
      alert(`Optimization failed: ${result.error}`);
      setLoading(false);
      return;
    }

    renderResults(result, store.optimizeMode);
    switchToResultsTab();
    setLoading(false);
  };

  worker.onerror = function (err) {
    console.error("Worker error:", err);
    alert(
      "An error occurred during optimization. Check the console for details."
    );
    setLoading(false);
  };
}

// ---------------------------
// Event Listeners
// ---------------------------

function setupEventListeners() {
  // Engineer level
  const engineerInput = document.getElementById("engineerLevel");
  if (engineerInput) {
    engineerInput.value = store.engineerLevel;
    engineerInput.addEventListener("input", (e) => {
      store.engineerLevel = parseInt(e.target.value) || 0;
    });
  }

  // Scarab level
  const scarabInput = document.getElementById("scarabLevel");
  if (scarabInput) {
    scarabInput.value = store.scarabLevel;
    scarabInput.addEventListener("input", (e) => {
      store.scarabLevel = parseInt(e.target.value) || 0;
    });
  }

  // Chaos Rift Rank
  const riftInput = document.getElementById("riftRank");
  if (riftInput) {
    riftInput.value = store.riftRank;
    riftInput.addEventListener("change", (e) => {
      store.riftRank = e.target.value;
    });
  }

  // Optimize mode toggle
  const campaignModeRadio = document.getElementById("campaignMode");
  const arenaModeRadio = document.getElementById("arenaMode");

  if (campaignModeRadio && arenaModeRadio) {
    campaignModeRadio.addEventListener("change", (e) => {
      if (e.target.checked) {
        store.optimizeMode = "campaign";
        updateOptimizeButtonText();
      }
    });

    arenaModeRadio.addEventListener("change", (e) => {
      if (e.target.checked) {
        store.optimizeMode = "arena";
        updateOptimizeButtonText();
      }
    });
  }

  // Optimize button
  const optimizeBtn = document.getElementById("optimizeBtn");
  if (optimizeBtn) {
    optimizeBtn.addEventListener("click", runOptimization);
  }

  const saveLoadModal = document.getElementById("saveLoadModal");
  const saveLoadBtn = document.getElementById("saveLoadBtn");

  if (saveLoadModal && saveLoadBtn) {
    // BEFORE aria-hidden gets applied
    saveLoadModal.addEventListener("hide.bs.modal", () => {
      if (saveLoadModal.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    });

    // AFTER modal is fully hidden
    saveLoadModal.addEventListener("hidden.bs.modal", () => {
      saveLoadBtn.focus();
    });

    saveLoadModal.addEventListener("shown.bs.modal", () => {
      // Focus first input when opened
      document.getElementById("saveLoadBox").focus();
    });
  }

  // Save/Load buttons
  const saveBtn = document.getElementById("saveBtn");
  const loadBtn = document.getElementById("loadBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => SaveLoad.save(store));
  }

  if (loadBtn) {
    loadBtn.addEventListener("click", () => SaveLoad.load(store));
  }

  const resetArtifactsBtn = document.getElementById("resetArtifacts");
  if (resetArtifactsBtn) {
    resetArtifactsBtn.addEventListener("click", () => {
      if (confirm("Reset all artifact values to 0?")) {
        resetAllArtifacts(store.artifacts);
        renderArtifacts(store.artifacts);
      }
    });
  }
}

// ---------------------------
// Init
// ---------------------------
function init() {
  // Render initial UI
  renderMachines(store.machines);
  renderHeroes(store.heroes);
  renderArtifacts(store.artifacts);

  // Setup event listeners
  setupEventListeners();

  // Set initial button text
  updateOptimizeButtonText();
}

// Start the application when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
