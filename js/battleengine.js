// battleengine.js
import { Calculator } from "./calculator.js";
import Decimal from "./vendor/break_eternity.esm.js";
import { AppConfig } from "./config.js";

/**
 * Battle simulation engine for War Machine Optimizer
 * Handles turn-based combat between player and enemy teams with abilities
 */
export class BattleEngine {
	/** @type {Decimal} */
	static ZERO = new Decimal(0);
	static TARGET_ORDER = AppConfig.ATTACK_ORDER;

	/**
	 * Selects targets based on ability targeting type
	 * @param {Array<Object>} team - Team to select from
	 * @param {Object} ability - Ability definition
	 * @param {Object} caster - Caster of the ability
	 * @returns {Array<Object>} Selected targets
	 */
	static selectAbilityTargets(team, ability, caster) {
		if (!ability || !team) return [];

		const aliveMembers = [];
		for (let i = 0; i < team.length; i++) {
			if (!team[i].isDead) aliveMembers.push(team[i]);
		}

		if (aliveMembers.length === 0) return [];

		switch (ability.targeting) {
			case "self":
				return [caster];

			case "random": {
				const count = Math.min(ability.numTargets || 1, aliveMembers.length);
				const shuffled = [...aliveMembers];
				for (let i = shuffled.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
				}
				return shuffled.slice(0, count);
			}

			case "all":
				return aliveMembers;

			case "lowest": {
				let lowest = aliveMembers[0];
				let minHP = lowest.battleStats.health;
				for (let i = 1; i < aliveMembers.length; i++) {
					const m = aliveMembers[i];
					if (m.battleStats.health.lt(minHP)) {
						lowest = m;
						minHP = m.battleStats.health;
					}
				}
				return [lowest];
			}

			case "last": {
				const count = ability.numTargets || 1;
				if (count >= aliveMembers.length) return aliveMembers;
				return aliveMembers.slice(aliveMembers.length - count);
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

		const heal = Calculator.toDecimal(healAmount);

		for (let i = 0; i < targets.length; i++) {
			const target = targets[i];
			if (target.isDead) continue;

			const currentHP = target.battleStats.health;
			const maxHP = target.battleStats.maxHealth;
			target.battleStats.health = Decimal.min(currentHP.add(heal), maxHP);
		}
	}

	/**
	 * Applies damage to targets
	 * @param {Array<Object>} targets - Targets to damage
	 * @param {Decimal} damageAmount - Amount of damage
	 */
	static applyDamage(targets, damageAmount) {
		if (!targets || targets.length === 0) return;

		const ZERO = BattleEngine.ZERO;

		for (let i = 0; i < targets.length; i++) {
			const target = targets[i];
			if (target.isDead) continue;

			const actualDamage = Calculator.computeDamageTaken(damageAmount, target.battleStats.armor);

			if (actualDamage.eq(0)) continue;

			const newHealth = target.battleStats.health.sub(actualDamage);

			if (newHealth.lte(0)) {
				target.battleStats.health = ZERO;
				target.isDead = true;
			} else {
				target.battleStats.health = newHealth;
			}
		}
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

		const isPlayerMachine = caster.isPlayer;

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
		if (targets.length === 0) return;

		let baseValue;
		if (ability.scaleStat === "damage") {
			baseValue = caster.battleStats.damage;
		} else if (ability.scaleStat === "health") {
			baseValue = caster.battleStats.maxHealth;
		} else {
			console.warn("Unknown scale stat:", ability.scaleStat);
			baseValue = caster.battleStats.damage;
		}

		const abilityValue = baseValue.mul(ability.multiplier || 1);

		if (ability.effect === "heal") {
			BattleEngine.applyHealing(targets, abilityValue);
		} else if (ability.effect === "damage") {
			BattleEngine.applyDamage(targets, abilityValue);
		} else {
			console.warn("Unknown ability effect:", ability.effect);
		}
	}

	/**
	 * battle simulation
	 * @param {Array<Object>} playerTeam - Player's team
	 * @param {Array<Object>} enemyTeam - Enemy team
	 * @param {number} maxRounds - Maximum rounds
	 * @param {boolean} enableAbilities - Whether to trigger abilities
	 * @returns {Object} Battle result
	 */
	runBattle(playerTeam, enemyTeam, maxRounds = AppConfig.MAX_BATTLE_ROUNDS, enableAbilities = true) {
		if (!Array.isArray(playerTeam) || !Array.isArray(enemyTeam)) {
			throw new Error("Teams must be arrays");
		}
		if (playerTeam.length === 0 || enemyTeam.length === 0) {
			throw new Error("Teams must have at least one member");
		}

		const ZERO = BattleEngine.ZERO;
		const targetOrder = BattleEngine.TARGET_ORDER;

		const cloneTeam = (team, bool) => {
			const len = team.length;
			const result = new Array(len);
			for (let i = 0; i < len; i++) {
				const m = team[i];
				if (!m.battleStats) {
					throw new Error(`Machine missing battleStats: ${JSON.stringify(m)}`);
				}
				const bs = m.battleStats;
				const health = Calculator.toDecimal(bs.health);
				result[i] = {
					...m,
					isPlayer: bool,
					ability: m.ability ? { ...m.ability } : null,
					battleStats: {
						health,
						maxHealth: Calculator.toDecimal(bs.maxHealth || bs.health),
						damage: Calculator.toDecimal(bs.damage),
						armor: Calculator.toDecimal(bs.armor),
					},
					isDead: false,
				};
			}
			return result;
		};

		const players = cloneTeam(playerTeam, true);
		const enemies = cloneTeam(enemyTeam, false);

		const hasAlive = (team) => {
			for (let i = 0; i < team.length; i++) {
				if (!team[i].isDead) return true;
			}
			return false;
		};

		const getNextTarget = (team) => {
			for (let i = 0; i < targetOrder.length; i++) {
				const idx = targetOrder[i];
				if (idx < team.length) {
					const m = team[idx];
					if (!m.isDead) return m;
				}
			}
			return null;
		};

		const getTotalHP = (team) => {
			let sum = ZERO;
			for (let i = 0; i < team.length; i++) {
				if (!team[i].isDead) {
					sum = sum.add(team[i].battleStats.health);
				}
			}
			return sum;
		};

		const attackPhase = (attackers, defenders, attackersTeam, defendersTeam) => {
			for (let i = 0; i < targetOrder.length; i++) {
				const attackerIdx = targetOrder[i];
				if (!hasAlive(defenders)) break;
				if (attackerIdx >= attackers.length || attackers[attackerIdx].isDead) {
					continue;
				}

				const attacker = attackers[attackerIdx];
				const target = getNextTarget(defenders);
				if (!target) break;

				const damage = Calculator.computeDamageTaken(attacker.battleStats.damage, target.battleStats.armor);

				if (!damage.eq(0)) {
					const newHealth = target.battleStats.health.sub(damage);
					if (newHealth.lte(0)) {
						target.battleStats.health = ZERO;
						target.isDead = true;
					} else {
						target.battleStats.health = newHealth;
					}
				}

				if (enableAbilities && attacker.ability && attackersTeam === players) {
					const overdrive = Calculator.calculateOverdrive(attacker);
					if (Math.random() < overdrive) {
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
			attackPhase(players, enemies, players, enemies);
			if (!hasAlive(enemies)) break;
			attackPhase(enemies, players, enemies, players);
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
