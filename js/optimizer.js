// optimizer.js
import { Calculator } from "./calculator.js";
import { BattleEngine } from "./battleengine.js";
import Decimal from "./vendor/break_eternity.esm.js";

// Constants
const REOPTIMIZE_INTERVAL = 5;
const POWER_THRESHOLD = 0.8;
const MAX_ROUNDS = 20;

export class Optimizer {
  constructor({
    ownedMachines,
    heroes,
    engineerLevel,
    scarabLevel,
    artifactArray,
    globalRarityLevels,
    riftRank,
  }) {
    this.ownedMachines = ownedMachines;
    this.heroes = heroes;
    this.engineerLevel = engineerLevel;
    this.scarabLevel = scarabLevel;
    this.artifactArray = artifactArray;
    this.globalRarityLevels = globalRarityLevels;
    this.riftRank = riftRank;
    this.battleEngine = new BattleEngine();
    this.maxSlots = Calculator.maxCrewSlots(engineerLevel);
  }

  // Score hero for a specific machine based on role preferences and current stats
  scoreHeroForMachine(hero, machine, currentStats, mode = "campaign") {
    const role = machine.role === "tank" ? "tank" : "dps";

    const dmgBonus = hero.percentages.damage / 100;
    const hpBonus = hero.percentages.health / 100;
    const armBonus = hero.percentages.armor / 100;

    if (dmgBonus === 0 && hpBonus === 0 && armBonus === 0) {
      return 0;
    }

    // Calculate absolute stat gains (percentage × current stat value)
    const currentDmg = Calculator.toDecimal(currentStats.damage).toNumber();
    const currentHp = Calculator.toDecimal(currentStats.health).toNumber();
    const currentArm = Calculator.toDecimal(currentStats.armor).toNumber();

    const dmgGain = dmgBonus * currentDmg;
    const hpGain = hpBonus * currentHp;
    const armGain = armBonus * currentArm;

    let score = 0;

    if (mode === "campaign") {
      if (role === "tank") {
        // Tanks prioritize: health > armor > damage
        score = hpGain * 5.0 + armGain * 3.0 + dmgGain * 0.3;
      } else {
        // DPS/Healer prioritize: damage > health > armor
        score = dmgGain * 10.0 + hpGain * 0.55 + armGain * 0.3;
      }
    } else {
      // Arena mode
      if (role === "tank") {
        // Tanks prioritize: health > armor > damage
        score = hpGain * 5.0 + armGain * 3.0 + dmgGain * 0.3;
      } else {
        // DPS/Healer prioritize: damage > health > armor
        score = dmgGain * 10.0 + hpGain * 0.55 + armGain * 0.3;
      }
    }

    return score;
  }

  calculateAllStats(machine, crew) {
    const battleStats = Calculator.calculateBattleAttributes(
      machine,
      crew,
      this.globalRarityLevels,
      this.artifactArray,
      this.engineerLevel
    );

    const machineWithBattleStats = {
      ...machine,
      battleStats: {
        damage: battleStats.damage,
        health: battleStats.health,
        maxHealth: battleStats.health,
        armor: battleStats.armor,
      },
    };

    const arenaStats = Calculator.calculateArenaAttributes(
      machineWithBattleStats,
      this.globalRarityLevels,
      this.scarabLevel,
      this.riftRank
    );

    return {
      battleStats: {
        damage: battleStats.damage,
        health: battleStats.health,
        maxHealth: battleStats.health,
        armor: battleStats.armor,
      },
      arenaStats: {
        damage: arenaStats.damage,
        health: arenaStats.health,
        maxHealth: arenaStats.health,
        armor: arenaStats.armor,
      },
    };
  }

  // Power-based crew optimization
  optimizeCrewGlobally(machines, mode = "campaign") {
    const availableHeroes = [...this.heroes];
    const assignedHeroIds = new Set();

    // Initialize all machines with empty crews and calculate base stats
    const machineStates = machines.map((machine) => {
      const stats = this.calculateAllStats(machine, []);
      const power = Calculator.computeMachinePower(
        mode === "arena" ? stats.arenaStats : stats.battleStats
      );
      return {
        machine,
        crew: [],
        stats,
        power,
      };
    });

    const sortedStates = machineStates.toSorted((a, b) => b.power.cmp(a.power));

    const grouped = Object.groupBy(sortedStates, (ms) =>
      ms.machine.role === "tank" ? "tank" : "dps"
    );

    const dpsMachines = grouped.dps ?? [];
    const tankMachines = grouped.tank ?? [];

    // Priority order
    const priorityOrder = [];

    if (dpsMachines.length > 0) {
      priorityOrder.push(dpsMachines[0]);
    }

    if (tankMachines.length > 0) {
      priorityOrder.push(tankMachines[0]);
    }

    // Add remaining machines by power, excluding those already in priority
    const priorityIds = new Set(priorityOrder.map((ms) => ms.machine.id));
    for (const ms of sortedStates) {
      if (!priorityIds.has(ms.machine.id)) {
        priorityOrder.push(ms);
      }
    }

    // Assign heroes sequentially to machines in priority order
    for (const machineState of priorityOrder) {
      // Fill this machine's crew slots
      while (machineState.crew.length < this.maxSlots) {
        // Get current stats for accurate scoring
        const currentStats =
          mode === "arena"
            ? machineState.stats.arenaStats
            : machineState.stats.battleStats;

        // Find best available hero for this machine
        let bestHeroIdx = -1;
        let bestScore = 0;

        for (let i = 0; i < availableHeroes.length; i++) {
          if (assignedHeroIds.has(availableHeroes[i].id)) continue;

          const score = this.scoreHeroForMachine(
            availableHeroes[i],
            machineState.machine,
            currentStats,
            mode
          );

          if (score > bestScore) {
            bestScore = score;
            bestHeroIdx = i;
          }
        }

        // Stop if no beneficial hero found
        if (bestHeroIdx === -1 || bestScore === 0) {
          break;
        }

        // Assign the hero
        const hero = availableHeroes[bestHeroIdx];
        machineState.crew.push(hero);
        assignedHeroIds.add(hero.id);

        // Recalculate stats with new crew
        machineState.stats = this.calculateAllStats(
          machineState.machine,
          machineState.crew
        );

        // Stop if we've run out of heroes
        if (assignedHeroIds.size >= availableHeroes.length) {
          break;
        }
      }
    }

    // Return machines with crews and final stats
    return sortedStates.map((ms) => ({
      ...ms.machine,
      crew: ms.crew,
      battleStats: ms.stats.battleStats,
      arenaStats: ms.stats.arenaStats,
    }));
  }

  selectBestFive(optimizedMachines, mode = "campaign") {
    if (optimizedMachines.length === 0) return [];

    const sorted = optimizedMachines
      .map((m) => {
        const stats = mode === "arena" ? m.arenaStats : m.battleStats;
        const power = Calculator.computeMachinePower(stats);
        return { machine: m, power };
      })
      .toSorted((a, b) => b.power.cmp(a.power));

    return sorted.slice(0, Math.min(5, sorted.length)).map((x) => x.machine);
  }

  arrangeByRole(team, mission = 1, difficulty = "easy") {
    if (!team || team.length === 0) return [];

    const formation = [];

    // Get enemy stats for this mission & difficulty
    const enemyStats = Calculator.enemyAttributes(mission, difficulty);

    const grouped = Object.groupBy(team, (machine) => {
      const dmgTaken = Calculator.computeDamageTaken(
        machine.battleStats.damage,
        enemyStats.armor
      );

      if (dmgTaken.eq(0)) return "useless";
      if (machine.role === "tank") return "tank";
      return "remaining";
    });

    const useless = grouped.useless ?? [];
    const tanks = grouped.tank ?? [];
    let remaining = grouped.remaining ?? [];

    remaining = remaining.toSorted(
      (a, b) => a.battleStats.damage - b.battleStats.damage
    );
    const sortedTanks = tanks.toSorted(
      (a, b) => a.battleStats.health - b.battleStats.health
    );

    let strongestMachine;
    if (remaining.length > 0) {
      if (team.length === 5) {
        strongestMachine = remaining.at(-1);
        remaining = remaining.slice(0, -1);
      } else {
        strongestMachine = null;
      }
    }

    if (useless.length > 0) formation.push(...useless);
    if (sortedTanks.length > 0) formation.push(...sortedTanks);
    if (remaining.length > 0) formation.push(...remaining);

    if (strongestMachine) {
      if (formation.length > 0) {
        formation.splice(formation.length - 1, 0, strongestMachine);
      } else {
        formation.push(strongestMachine);
      }
    }

    return formation;
  }

  optimizeCampaignMaxStars({
    ownedMachines,
    maxMission = 90,
    difficulties = ["easy", "normal", "hard", "insane", "nightmare"],
  }) {
    let totalStars = 0;
    let lastCleared = 0;
    let lastWinningTeam = [];

    if (!ownedMachines?.length) {
      return { totalStars, lastCleared, formation: [] };
    }

    let currentBestTeam = null;
    let lastOptimizedMission = 0;

    for (let mission = 1; mission <= maxMission; mission++) {
      const shouldReoptimize =
        !currentBestTeam ||
        mission - lastOptimizedMission >= REOPTIMIZE_INTERVAL;

      if (shouldReoptimize) {
        const allOptimized = this.optimizeCrewGlobally(
          ownedMachines,
          "campaign"
        );
        currentBestTeam = this.selectBestFive(allOptimized, "campaign");

        if (currentBestTeam.length === 0) break;

        lastOptimizedMission = mission;
      }

      for (const difficulty of difficulties) {
        const arrangedTeam = this.arrangeByRole(
          currentBestTeam,
          mission,
          difficulty
        );

        const enemyFormation = Calculator.getEnemyTeamForMission(
          mission,
          difficulty
        );
        const requiredPower = Calculator.requiredPowerForMission(
          mission,
          difficulty
        );
        const ourPower = Calculator.computeSquadPower(arrangedTeam, "campaign");

        // Skip if power is too low
        if (ourPower.lt(requiredPower.mul(POWER_THRESHOLD))) break;

        // Deep copy stats and crew for simulation
        const battleTeam = arrangedTeam.map((m) => ({
          ...m,
          crew: [...m.crew],
          battleStats: {
            damage: Calculator.toDecimal(m.battleStats.damage),
            health: Calculator.toDecimal(m.battleStats.health),
            maxHealth: Calculator.toDecimal(m.battleStats.maxHealth),
            armor: Calculator.toDecimal(m.battleStats.armor),
          },
        }));

        const result = this.battleEngine.runBattle(
          battleTeam,
          enemyFormation,
          MAX_ROUNDS
        );

        if (result.playerWon) {
          totalStars++;
          if (difficulty === "easy") lastCleared = mission;
          lastWinningTeam = arrangedTeam.map((m) => ({ ...m }));
        } else {
          // Stop trying higher difficulties if we lose
          break;
        }
      }
    }

    const battlePower = Calculator.computeSquadPower(
      lastWinningTeam,
      "campaign"
    );
    const arenaPower = Calculator.computeSquadPower(lastWinningTeam, "arena");

    return {
      totalStars,
      lastCleared,
      formation: lastWinningTeam,
      battlePower,
      arenaPower,
    };
  }

  optimizeForArena(ownedMachines) {
    if (!ownedMachines?.length) {
      return { formation: [], totalPower: new Decimal(0) };
    }

    const allOptimized = this.optimizeCrewGlobally(ownedMachines, "arena");

    let bestTeam = this.selectBestFive(allOptimized, "arena");
    bestTeam = this.arrangeByRole(bestTeam, 1, "easy");

    const arenaPower = Calculator.computeSquadPower(bestTeam, "arena");
    const battlePower = Calculator.computeSquadPower(bestTeam, "campaign");

    return { formation: bestTeam, arenaPower, battlePower };
  }
}
