// optimizerWorker.js
import { Optimizer } from "./optimizer.js";

self.onmessage = function (e) {
  try {
    const {
      mode = "campaign",
      ownedMachines: rawMachines,
      ownedHeroes: rawHeroes,
      maxMission = 90,
      globalRarityLevels = 0,
      engineerLevel = 0,
      scarabLevel = 0,
      artifactArray = [],
      riftRank = ""
    } = e.data;

    // Create optimizer
    const optimizer = new Optimizer({
      ownedMachines: rawMachines,
      heroes: rawHeroes,
      engineerLevel,
      scarabLevel,
      artifactArray,
      globalRarityLevels,
      riftRank,
    });

    let result;

    // Run optimization based on mode
    if (mode === "arena") {
      result = optimizer.optimizeForArena(rawMachines);
      // Add mode to result
      result.mode = "arena";
    } else {
      result = optimizer.optimizeCampaignMaxStars({
        ownedMachines: rawMachines,
        maxMission,
      });
      // Add mode to result
      result.mode = "campaign";
    }

    self.postMessage(result);
  } catch (err) {
    // Catch all runtime errors and report to main thread
    const message = err?.message || String(err);
    console.error("Worker caught error:", message);
    self.postMessage({ error: message });
  }
};
