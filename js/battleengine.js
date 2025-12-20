// battleengine.js
import { Calculator } from "./calculator.js";
import Decimal from "./vendor/break_eternity.esm.js";

/**
 * Battle simulation engine for War Machine Optimizer
 * Handles turn-based combat between player and enemy teams with abilities
 */
export class BattleEngine {
	/** @type {Decimal} */
	static ZERO = new Decimal(0);

	/** @type {number[]} Attack order for targeting (positions 0-4) */
	static ATTACK_ORDER = [0, 1, 2, 4, 3];

	/**
	 * Selects targets based on ability targeting type
	 * @param {Array<Object>} team - Team to select from
	 * @param {Object} ability - Ability definition
	 * @param {Object} caster - Caster of the ability
	 * @returns {Array<Object>} Selected targets
	 */
	static selectAbilityTargets(team, ability, caster) {
		if (!ability || !team) return [];

		const aliveMembers = team.filter((m) => !m.isDead);

		if (aliveMembers.length === 0) return [];

		switch (ability.targeting) {
			case "self":
				return [caster];

			case "random": {
				const count = Math.min(ability.numTargets || 1, aliveMembers.length);
				const shuffled = [...aliveMembers].sort(() => Math.random() - 0.5);
				return shuffled.slice(0, count);
			}

			case "all":
				return aliveMembers;

			case "lowest": {
				// Target the ally with lowest current HP
				const sorted = [...aliveMembers].sort((a, b) => a.battleStats.health.cmp(b.battleStats.health));
				return [sorted[0]];
			}

			default:
				console.warn("Unknown targeting type:", ability.targeting);
				return [];
		}
	}

	/**
	 * Applies healing to targets
	 * @param {Array<Object>} targets - Targets to heal
	 * @param {Decimal} healAmount - Amount to heal
	 */
	static applyHealing(targets, healAmount) {
		if (!targets || targets.length === 0) return;

		targets.forEach((target) => {
			if (target.isDead) return; // Skip dead targets

			const currentHP = Calculator.toDecimal(target.battleStats.health);
			const maxHP = Calculator.toDecimal(target.battleStats.maxHealth || target.battleStats.health);
			const heal = Calculator.toDecimal(healAmount);

			const newHP = Decimal.min(currentHP.add(heal), maxHP);
			target.battleStats.health = newHP;
		});
	}

	/**
	 * Applies damage to targets
	 * @param {Array<Object>} targets - Targets to damage
	 * @param {Decimal} damageAmount - Amount of damage
	 */
	static applyDamage(targets, damageAmount) {
		if (!targets || targets.length === 0) return;

		const ZERO = BattleEngine.ZERO;

		targets.forEach((target) => {
			if (target.isDead) return; // Skip already dead targets

			const actualDamage = Calculator.computeDamageTaken(damageAmount, target.battleStats.armor);

			if (actualDamage.eq(0)) return;

			const currentHP = Calculator.toDecimal(target.battleStats.health);
			const newHealth = currentHP.sub(actualDamage).max(0);

			if (newHealth.eq(0)) {
				target.battleStats.health = ZERO;
				target.isDead = true;
			} else {
				target.battleStats.health = newHealth;
			}
		});
	}

	/**
	 * Executes an ability
	 * @param {Object} caster - Machine casting the ability
	 * @param {Array<Object>} playerTeam - Player team
	 * @param {Array<Object>} enemyTeam - Enemy team
	 */
	static executeAbility(caster, playerTeam, enemyTeam) {
		const ability = caster.ability;
		if (!ability) {
			console.warn("Caster has no ability:", caster.name);
			return;
		}

		// Determine which team the caster belongs to
		const isPlayerMachine = playerTeam.some((m) => m === caster);

		// Select target team based on ability type
		let targetTeam;
		if (ability.targets === "ally" || ability.targets === "self") {
			targetTeam = isPlayerMachine ? playerTeam : enemyTeam;
		} else if (ability.targets === "enemy") {
			targetTeam = isPlayerMachine ? enemyTeam : playerTeam;
		} else {
			console.warn("Unknown ability target type:", ability.targets);
			return;
		}

		const targets = BattleEngine.selectAbilityTargets(targetTeam, ability, caster);
		if (targets.length === 0) {
			//console.warn('No valid targets for ability');
			return;
		}

		// Calculate ability value based on scaling stat
		let baseValue;
		if (ability.scaleStat === "damage") {
			baseValue = caster.battleStats.damage;
		} else if (ability.scaleStat === "health") {
			baseValue = caster.battleStats.maxHealth || caster.battleStats.health;
		} else {
			console.warn("Unknown scale stat:", ability.scaleStat);
			baseValue = caster.battleStats.damage;
		}

		const abilityValue = Calculator.toDecimal(baseValue).mul(ability.multiplier || 1);

		// Apply effect
		if (ability.effect === "heal") {
			BattleEngine.applyHealing(targets, abilityValue);
		} else if (ability.effect === "damage") {
			BattleEngine.applyDamage(targets, abilityValue);
		} else {
			console.warn("Unknown ability effect:", ability.effect);
		}
	}

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
						maxHealth: Calculator.toDecimal(m.battleStats.maxHealth || m.battleStats.health),
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

	/**
	 * Runs a battle simulation with abilities enabled
	 * @param {Array<import('./app.js').Machine>} playerTeam - Player's team
	 * @param {Array<Object>} enemyTeam - Enemy team
	 * @param {number} [maxRounds=20] - Maximum rounds
	 * @returns {Object} Battle result
	 */
	runBattleWithAbilities(playerTeam, enemyTeam, maxRounds = 20) {
		if (!Array.isArray(playerTeam) || !Array.isArray(enemyTeam)) {
			throw new Error("Teams must be arrays");
		}
		if (playerTeam.length === 0 || enemyTeam.length === 0) {
			throw new Error("Teams must have at least one member");
		}

		const ZERO = BattleEngine.ZERO;
		const targetOrder = BattleEngine.ATTACK_ORDER;

		const cloneTeam = (team) =>
			team.map((m) => {
				if (!m.battleStats) {
					throw new Error(`Machine missing battleStats: ${JSON.stringify(m)}`);
				}

				// Deep clone to avoid mutations
				const cloned = {
					...m,
					ability: m.ability ? { ...m.ability } : null,
					battleStats: {
						health: Calculator.toDecimal(m.battleStats.health),
						maxHealth: Calculator.toDecimal(m.battleStats.maxHealth || m.battleStats.health),
						damage: Calculator.toDecimal(m.battleStats.damage),
						armor: Calculator.toDecimal(m.battleStats.armor),
					},
					isDead: false,
				};

				return cloned;
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

		const getTotalHP = (team) => team.reduce((sum, m) => (m.isDead ? sum : sum.add(m.battleStats.health)), ZERO);

		const attackPhaseWithAbilities = (attackers, defenders, attackersTeam, defendersTeam) => {
			for (const attackerIdx of targetOrder) {
				if (!hasAlive(defenders)) break;
				if (attackerIdx >= attackers.length || attackers[attackerIdx].isDead) {
					continue;
				}

				const attacker = attackers[attackerIdx];
				const target = getNextTarget(defenders);
				if (!target) break;

				// Auto attack
				const damage = Calculator.computeDamageTaken(attacker.battleStats.damage, target.battleStats.armor);

				if (!damage.eq(0)) {
					const newHealth = target.battleStats.health.sub(damage).max(0);

					if (newHealth.eq(0)) {
						target.battleStats.health = ZERO;
						target.isDead = true;
					} else {
						target.battleStats.health = newHealth;
					}
				}

				// Check if ability triggers (overdrive chance)
				// Only for player machines (enemies don't have the ability property)
				if (attacker.ability && attackersTeam === players) {
					const overdrive = Calculator.calculateOverdrive(attacker);
					const roll = Math.random();

					if (roll < overdrive) {
						try {
							BattleEngine.executeAbility(attacker, attackersTeam, defendersTeam);
						} catch (error) {
							console.error("Ability execution failed:", error);
							console.error("Attacker:", attacker.name, "Ability:", attacker.ability);
						}
					}
				}
			}
		};

		let round = 0;
		while (round < maxRounds && hasAlive(players) && hasAlive(enemies)) {
			attackPhaseWithAbilities(players, enemies, players, enemies);

			if (!hasAlive(enemies)) break;

			attackPhaseWithAbilities(enemies, players, enemies, players);

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
