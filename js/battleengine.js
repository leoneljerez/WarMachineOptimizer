// battleengine.js
import { Calculator } from "./calculator.js";
import Decimal from "./vendor/break_eternity.esm.js";

/**
 * Battle simulation engine for War Machine Optimizer
 * Handles turn-based combat between player and enemy teams
 */
export class BattleEngine {
	/** @type {Decimal} */
	static ZERO = new Decimal(0);

	/** @type {number[]} Attack order for targeting (positions 0-4) */
	static ATTACK_ORDER = [0, 1, 2, 4, 3];

	/**
	 * Runs a complete battle simulation between two teams
	 * @param {Array<import('./app.js').Machine>} playerTeam - Player's team of machines
	 * @param {Array<Object>} enemyTeam - Enemy team (from Calculator.getEnemyTeamForMission)
	 * @param {number} [maxRounds=20] - Maximum number of combat rounds
	 * @returns {{
	 *   playerWon: boolean,
	 *   rounds: number,
	 *   playerTeam: Array<Object>,
	 *   enemyTeam: Array<Object>,
	 *   playerTotalHP: Decimal,
	 *   enemyTotalHP: Decimal
	 * }} Battle result
	 * @throws {Error} If teams are invalid or missing battleStats
	 */
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

		/**
		 * Deep clones a team with proper Decimal conversion
		 * @param {Array<Object>} team - Team to clone
		 * @returns {Array<Object>} Cloned team
		 * @throws {Error} If machine is missing battleStats
		 */
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

		/**
		 * Checks if any team member is alive
		 * @param {Array<Object>} team - Team to check
		 * @returns {boolean} True if at least one member is alive
		 */
		const hasAlive = (team) => team.some((m) => !m.isDead);

		/**
		 * Gets next valid target based on attack order
		 * @param {Array<Object>} team - Team to select from
		 * @returns {Object|null} Next alive target or null
		 */
		const getNextTarget = (team) => {
			for (const idx of targetOrder) {
				if (idx < team.length && !team[idx].isDead) {
					return team[idx];
				}
			}
			return null;
		};

		/**
		 * Calculates total remaining HP of team
		 * @param {Array<Object>} team - Team to calculate
		 * @returns {Decimal} Total HP
		 */
		const getTotalHP = (team) => team.reduce((sum, m) => (m.isDead ? sum : sum.add(m.battleStats.health)), ZERO);

		/**
		 * Executes one attack phase for a team
		 * @param {Array<Object>} attackers - Attacking team
		 * @param {Array<Object>} defenders - Defending team
		 */
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

				const damage = Calculator.computeDamageTaken(attacker.battleStats.damage, target.battleStats.armor);

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
