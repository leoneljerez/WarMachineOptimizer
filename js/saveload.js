// js/saveload.js
import { renderArtifacts } from "./ui/artifacts.js";
import { renderHeroes } from "./ui/heroes.js";
import { renderMachines } from "./ui/machines.js";
import { renderTavernCards } from "./ui/tavern.js";

// Validate loaded data structure
function validateSaveData(data) {
  const errors = [];

  // Check top-level fields
  if (typeof data.engineerLevel !== "number" || data.engineerLevel < 0) {
    errors.push("Invalid engineerLevel");
  }

  if (typeof data.scarabLevel !== "number" || data.scarabLevel < 0) {
    errors.push("Invalid scarabLevel");
  }

  if (typeof data.riftRank !== "string") {
    errors.push("Invalid riftRank");
  }

  // Validate machines array
  if (!Array.isArray(data.machines)) {
    errors.push("machines must be an array");
  } else {
    data.machines.forEach((machine, idx) => {
      // ID can be string or number
      if (machine.id === undefined || machine.id === null) {
        errors.push(`Machine ${idx} missing id`);
      }
      if (typeof machine.rarity !== "string") {
        errors.push(`Machine ${idx} missing valid rarity`);
      }
      if (typeof machine.level !== "number") {
        errors.push(`Machine ${idx} missing valid level`);
      }
      if (!machine.blueprints || typeof machine.blueprints !== "object") {
        errors.push(`Machine ${idx} missing blueprints object`);
      }
    });
  }

  // Validate heroes array
  if (!Array.isArray(data.heroes)) {
    errors.push("heroes must be an array");
  } else {
    data.heroes.forEach((hero, idx) => {
      // ID can be string or number
      if (hero.id === undefined || hero.id === null) {
        errors.push(`Hero ${idx} missing id`);
      }
      if (!hero.percentages || typeof hero.percentages !== "object") {
        errors.push(`Hero ${idx} missing percentages object`);
      }
    });
  }

  // Validate artifacts
  if (!data.artifacts || typeof data.artifacts !== "object") {
    errors.push("artifacts must be an object");
  } else {
    const requiredStats = ["damage", "health", "armor"];
    const requiredPercentages = [30, 35, 40, 45, 50, 55, 60, 65];

    requiredStats.forEach((stat) => {
      if (!data.artifacts[stat]) {
        errors.push(`Missing artifact stat: ${stat}`);
      } else {
        requiredPercentages.forEach((pct) => {
          // Accept both string and number keys from JSON
          const value =
            data.artifacts[stat][pct] ?? data.artifacts[stat][String(pct)];
          if (typeof value !== "number") {
            errors.push(`Invalid artifact value for ${stat} at ${pct}%`);
          }
        });
      }
    });
  }

  return errors;
}

// Create a clean save object with only necessary data
function createSaveData(store) {
  return {
    engineerLevel: store.engineerLevel,
    scarabLevel: store.scarabLevel,
    riftRank: store.riftRank,
    machines: store.machines.map((machine) => ({
      id: machine.id,
      rarity: machine.rarity,
      level: machine.level,
      blueprints: {
        damage: machine.blueprints.damage,
        health: machine.blueprints.health,
        armor: machine.blueprints.armor,
      },
      inscriptionLevel: machine.inscriptionLevel,
      sacredLevel: machine.sacredLevel,
    })),
    heroes: store.heroes.map((hero) => ({
      id: hero.id,
      percentages: {
        damage: hero.percentages.damage,
        health: hero.percentages.health,
        armor: hero.percentages.armor,
      },
    })),
    artifacts: {
      damage: { ...store.artifacts.damage },
      health: { ...store.artifacts.health },
      armor: { ...store.artifacts.armor },
    },
  };
}

// Apply loaded data to store
function applyLoadedData(store, data) {
  // Apply top-level values
  store.engineerLevel = data.engineerLevel;
  store.scarabLevel = data.scarabLevel;
  store.riftRank = data.riftRank;

  // Apply machine data by matching IDs (convert both to strings for comparison)
  data.machines.forEach((savedMachine) => {
    const machine = store.machines.find(
      (m) => String(m.id) === String(savedMachine.id)
    );
    if (machine) {
      machine.rarity = savedMachine.rarity;
      machine.level = savedMachine.level;
      machine.blueprints.damage = savedMachine.blueprints.damage;
      machine.blueprints.health = savedMachine.blueprints.health;
      machine.blueprints.armor = savedMachine.blueprints.armor;
      machine.inscriptionLevel = savedMachine.inscriptionLevel || 0;
      machine.sacredLevel = savedMachine.sacredLevel || 0;
    }
  });

  // Apply hero data by matching IDs (convert both to strings for comparison)
  data.heroes.forEach((savedHero) => {
    const hero = store.heroes.find(
      (h) => String(h.id) === String(savedHero.id)
    );
    if (hero) {
      hero.percentages.damage = savedHero.percentages.damage;
      hero.percentages.health = savedHero.percentages.health;
      hero.percentages.armor = savedHero.percentages.armor;
    }
  });

  // Apply artifacts (handle both string and number keys from JSON)
  Object.keys(data.artifacts).forEach((stat) => {
    Object.keys(data.artifacts[stat]).forEach((pct) => {
      const numKey = Number(pct); // Convert string keys to numbers
      if (!isNaN(numKey)) {
        store.artifacts[stat][numKey] = data.artifacts[stat][pct];
      }
    });
  });
}

function showToast(message, type = "success") {
  const toastRoot = document.getElementById("toastRoot");

  const toastEl = document.createElement("div");
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");

  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  toastRoot.appendChild(toastEl);

  // eslint-disable-next-line no-undef
  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();

  toastEl.addEventListener("hidden.bs.toast", () => {
    toastEl.remove();
  });
}

export const SaveLoad = {
  save(store) {
    try {
      const saveData = createSaveData(store);
      const json = JSON.stringify(saveData, null, 2);
      document.getElementById("saveLoadBox").value = json;
      showToast(
        "Data prepared for saving. Copy the JSON from the text box.",
        "success"
      );
    } catch (error) {
      console.error("Save error:", error);
      showToast("Failed to save data: " + error.message, "danger");
    }
  },

  load(store) {
    const textarea = document.getElementById("saveLoadBox");
    const content = textarea.value.trim();

    if (!content) {
      showToast("Please paste save data into the text box first.", "warning");
      return;
    }

    try {
      const data = JSON.parse(content);

      // Validate structure
      const errors = validateSaveData(data);
      if (errors.length > 0) {
        console.error("Validation errors:", errors);
        showToast(`Invalid save data: ${errors[0]}`, "danger");
        return;
      }

      // Apply the loaded data
      applyLoadedData(store, data);

      // Update UI inputs
      document.getElementById("engineerLevel").value = store.engineerLevel;
      document.getElementById("scarabLevel").value = store.scarabLevel;
      document.getElementById("riftRank").value = store.riftRank;

      // Re-render all UI components
      renderMachines(store.machines);
      renderHeroes(store.heroes);
      renderArtifacts(store.artifacts);
      renderTavernCards(store.machines);

      showToast("Data loaded successfully!", "success");

      // Clear the textarea after successful load
      textarea.value = "";
    } catch (error) {
      console.error("Load error:", error);
      if (error instanceof SyntaxError) {
        showToast(
          "Invalid JSON format. Please check your save data.",
          "danger"
        );
      } else {
        showToast("Failed to load data: " + error.message, "danger");
      }
    }
  },
};