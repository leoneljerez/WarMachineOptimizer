// battleengine.js
import { Calculator } from "./calculator.js";
import Decimal from "./vendor/break_eternity.esm.js";

export class BattleEngine {
  static ZERO = new Decimal(0);
  static ATTACK_ORDER = [0, 1, 2, 4, 3];

  runBattle(playerTeam, enemyTeam, maxRounds = 20) {
    // Input validation
    if (!Array.isArray(playerTeam) || !Array.isArray(enemyTeam)) {
      throw new Error("Teams must be arrays");
    }
    if (playerTeam.length === 0 || enemyTeam.length === 0) {
      throw new Error("Teams must have at least one member");
    }

    const ZERO = BattleEngine.ZERO;
    const targetOrder = BattleEngine.ATTACK_ORDER;
    const playerAttackOrder = BattleEngine.ATTACK_ORDER;

    const cloneTeam = (team) =>
      team.map((m) => {
        if (!m.battleStats) {
          throw new Error(`Machine missing battleStats: ${JSON.stringify(m)}`);
        }
        return {
          ...m,
          battleStats: {
            health: Calculator.toDecimal(m.battleStats.health),
            damage: Calculator.toDecimal(m.battleStats.damage),
            armor: Calculator.toDecimal(m.battleStats.armor),
          },
          isDead: false,
        };
      });

    const players = cloneTeam(playerTeam);
    const enemies = cloneTeam(enemyTeam);

    const hasAlive = (team) => team.some((m) => !m.isDead);

    const getNextTarget = (team) => {
      for (const idx of targetOrder) {
        if (idx < team.length && !team[idx].isDead) {
          return team[idx];
        }
      }
      return null;
    };

    const getTotalHP = (team) =>
      team.reduce(
        (sum, m) => (m.isDead ? sum : sum.add(m.battleStats.health)),
        ZERO
      );

    const attackPhase = (attackers, defenders) => {
      for (const attackerIdx of playerAttackOrder) {
        // Stop if all defenders are dead
        if (!hasAlive(defenders)) break;

        if (attackerIdx >= attackers.length || attackers[attackerIdx].isDead) {
          continue;
        }

        const attacker = attackers[attackerIdx];
        const target = getNextTarget(defenders);
        if (!target) break;

        const damage = Calculator.computeDamageTaken(
          attacker.battleStats.damage,
          target.battleStats.armor
        );

        // Check for miss (zero damage)
        if (damage.eq(0)) {
          continue;
        }

        // Subtract damage
        const newHealth = target.battleStats.health.sub(damage).max(0);

        // Check if dead
        if (newHealth.eq(0)) {
          target.battleStats.health = ZERO;
          target.isDead = true;
        } else {
          target.battleStats.health = newHealth;
        }
      }
    };

    let round = 0;
    while (round < maxRounds && hasAlive(players) && hasAlive(enemies)) {
      attackPhase(players, enemies);

      if (!hasAlive(enemies)) break;

      attackPhase(enemies, players);

      round++;
    }

    const playerWon = !hasAlive(enemies) && hasAlive(players);

    return {
      playerWon,
      rounds: round,
      playerTeam: players,
      enemyTeam: enemies,
      playerTotalHP: getTotalHP(players),
      enemyTotalHP: getTotalHP(enemies),
    };
  }
}
