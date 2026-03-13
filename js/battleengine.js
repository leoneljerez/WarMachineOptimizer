// battleengine.js
import { Calculator } from "./calculator.js";
import Decimal from "./vendor/break_eternity.esm.js";
import { AppConfig } from "./config.js";

/**
 * @typedef {Object} BattleMember
 * @property {string}  name
 * @property {boolean} isPlayer
 * @property {boolean} isDead
 * @property {Object|null} ability
 * @property {{damage: Decimal, health: Decimal, maxHealth: Decimal, armor: Decimal}} battleStats
 */

/**
 * @typedef {Object} BattleResult
 * @property {boolean}       playerWon
 * @property {number}        rounds
 * @property {BattleMember[]} playerTeam
 * @property {BattleMember[]} enemyTeam
 * @property {Decimal}       playerTotalHP
 * @property {Decimal}       enemyTotalHP
 */

/**
 * Turn-based battle simulation engine.
 *
 * Static helpers (cloneTeam, hasAlive, etc.) are class methods so their
 * inputs and outputs are explicit — no implicit closure captures.
 * Only `runBattle` is an instance method because `BattleEngine` is
 * instantiated by Optimizer and UpgradeAnalyzer.
 */
export class BattleEngine {
	/** @type {Decimal} */
	static ZERO = new Decimal(0);

	/** @type {number[]} */
	static TARGET_ORDER = AppConfig.ATTACK_ORDER;

	// ─────────────────────────────────────────────
	// Public battle entry point
	// ─────────────────────────────────────────────

	/**
	 * Runs a full battle simulation between two teams.
	 * @param {Object[]} playerTeam - Raw machine objects with battleStats
	 * @param {Object[]} enemyTeam  - Raw enemy objects with battleStats
	 * @param {number}   [maxRounds=AppConfig.MAX_BATTLE_ROUNDS]
	 * @param {boolean}  [enableAbilities=true]
	 * @returns {BattleResult}
	 */
	runBattle(playerTeam, enemyTeam, maxRounds = AppConfig.MAX_BATTLE_ROUNDS, enableAbilities = true) {
		if (!Array.isArray(playerTeam) || !Array.isArray(enemyTeam)) {
			throw new Error("Teams must be arrays");
		}
		if (playerTeam.length === 0 || enemyTeam.length === 0) {
			throw new Error("Teams must have at least one member");
		}

		const players = BattleEngine._cloneTeam(playerTeam, true);
		const enemies = BattleEngine._cloneTeam(enemyTeam, false);

		let round = 0;
		while (round < maxRounds && BattleEngine._hasAlive(players) && BattleEngine._hasAlive(enemies)) {
			BattleEngine._attackPhase(players, enemies, players, enableAbilities);
			if (!BattleEngine._hasAlive(enemies)) break;
			BattleEngine._attackPhase(enemies, players, enemies, enableAbilities);
			round++;
		}

		const playerWon = !BattleEngine._hasAlive(enemies) && BattleEngine._hasAlive(players);

		return {
			playerWon,
			rounds: round,
			playerTeam: players,
			enemyTeam: enemies,
			playerTotalHP: BattleEngine._totalHP(players),
			enemyTotalHP: BattleEngine._totalHP(enemies),
		};
	}

	// ─────────────────────────────────────────────
	// Ability system (used by _attackPhase)
	// ─────────────────────────────────────────────

	/**
	 * Selects targets from a team according to an ability's targeting rule.
	 * @param {BattleMember[]} team
	 * @param {Object} ability
	 * @param {BattleMember} caster
	 * @returns {BattleMember[]}
	 */
	static selectAbilityTargets(team, ability, caster) {
		if (!ability || !team) return [];

		const alive = team.filter((m) => !m.isDead);
		if (alive.length === 0) return [];

		switch (ability.targeting) {
			case "self":
				return [caster];

			case "random": {
				const count = Math.min(ability.numTargets || 1, alive.length);
				const shuffled = [...alive];
				for (let i = shuffled.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
				}
				return shuffled.slice(0, count);
			}

			case "all":
				return alive;

			case "lowest": {
				let lowest = alive[0];
				for (let i = 1; i < alive.length; i++) {
					if (alive[i].battleStats.health.lt(lowest.battleStats.health)) lowest = alive[i];
				}
				return [lowest];
			}

			case "last": {
				const count = ability.numTargets || 1;
				return count >= alive.length ? alive : alive.slice(alive.length - count);
			}

			default:
				console.warn("Unknown targeting type:", ability.targeting);
				return [];
		}
	}

	/**
	 * Applies healing to targets, capped at maxHealth.
	 * @param {BattleMember[]} targets
	 * @param {Decimal}        healAmount
	 */
	static applyHealing(targets, healAmount) {
		if (!targets?.length) return;
		const heal = Calculator.toDecimal(healAmount);

		for (let i = 0; i < targets.length; i++) {
			const t = targets[i];
			if (t.isDead) continue;
			t.battleStats.health = Decimal.min(t.battleStats.health.add(heal), t.battleStats.maxHealth);
		}
	}

	/**
	 * Applies damage to targets, marking dead at ≤ 0 HP.
	 * @param {BattleMember[]} targets
	 * @param {Decimal}        damageAmount
	 */
	static applyDamage(targets, damageAmount) {
		if (!targets?.length) return;
		const ZERO = BattleEngine.ZERO;

		for (let i = 0; i < targets.length; i++) {
			const t = targets[i];
			if (t.isDead) continue;

			const actual = Calculator.computeDamageTaken(damageAmount, t.battleStats.armor);
			if (actual.eq(0)) continue;

			const newHP = t.battleStats.health.sub(actual);
			if (newHP.lte(0)) {
				t.battleStats.health = ZERO;
				t.isDead = true;
			} else {
				t.battleStats.health = newHP;
			}
		}
	}

	/**
	 * Executes a caster's ability, resolving targets and applying the effect.
	 * @param {BattleMember}   caster
	 * @param {BattleMember[]} playerTeam
	 * @param {BattleMember[]} enemyTeam
	 */
	static executeAbility(caster, playerTeam, enemyTeam) {
		const { ability } = caster;
		if (!ability) {
			console.warn("Caster has no ability:", caster.name);
			return;
		}

		let targetTeam;
		if (ability.targets === "ally" || ability.targets === "self") {
			targetTeam = caster.isPlayer ? playerTeam : enemyTeam;
		} else if (ability.targets === "enemy") {
			targetTeam = caster.isPlayer ? enemyTeam : playerTeam;
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

	// ─────────────────────────────────────────────
	// Private static helpers
	// ─────────────────────────────────────────────

	/**
	 * Deep-clones a team array into battle-ready BattleMember objects.
	 * Throws if any member is missing battleStats.
	 * @param {Object[]} team
	 * @param {boolean}  isPlayer
	 * @returns {BattleMember[]}
	 * @private
	 */
	static _cloneTeam(team, isPlayer) {
		return team.map((m) => {
			if (!m.battleStats) throw new Error(`Machine missing battleStats: ${JSON.stringify(m)}`);
			const { battleStats: bs } = m;
			const health = Calculator.toDecimal(bs.health);
			return {
				...m,
				isPlayer,
				ability: m.ability ? { ...m.ability } : null,
				battleStats: {
					health,
					maxHealth: Calculator.toDecimal(bs.maxHealth || bs.health),
					damage: Calculator.toDecimal(bs.damage),
					armor: Calculator.toDecimal(bs.armor),
				},
				isDead: false,
			};
		});
	}

	/**
	 * Returns true if any member of a team is still alive.
	 * @param {BattleMember[]} team
	 * @returns {boolean}
	 * @private
	 */
	static _hasAlive(team) {
		for (let i = 0; i < team.length; i++) {
			if (!team[i].isDead) return true;
		}
		return false;
	}

	/**
	 * Returns the first living member in TARGET_ORDER, or null.
	 * @param {BattleMember[]} team
	 * @returns {BattleMember|null}
	 * @private
	 */
	static _getNextTarget(team) {
		for (const idx of BattleEngine.TARGET_ORDER) {
			if (idx < team.length && !team[idx].isDead) return team[idx];
		}
		return null;
	}

	/**
	 * Sums remaining HP across all living team members.
	 * @param {BattleMember[]} team
	 * @returns {Decimal}
	 * @private
	 */
	static _totalHP(team) {
		let sum = BattleEngine.ZERO;
		for (let i = 0; i < team.length; i++) {
			if (!team[i].isDead) sum = sum.add(team[i].battleStats.health);
		}
		return sum;
	}

	/**
	 * Runs one attack phase: each living attacker (in TARGET_ORDER) hits the
	 * next living defender, then optionally triggers an ability.
	 * Abilities are only triggered for the player team.
	 * @param {BattleMember[]} attackers
	 * @param {BattleMember[]} defenders
	 * @param {BattleMember[]} attackersTeam - Full attacker team (for ability resolution)
	 * @param {boolean}        enableAbilities
	 * @private
	 */
	static _attackPhase(attackers, defenders, attackersTeam, enableAbilities) {
		const ZERO = BattleEngine.ZERO;
		const ORDER = BattleEngine.TARGET_ORDER;
		const isPlayerPhase = attackersTeam === attackers && attackers[0]?.isPlayer;

		for (let i = 0; i < ORDER.length; i++) {
			if (!BattleEngine._hasAlive(defenders)) break;

			const attackerIdx = ORDER[i];
			if (attackerIdx >= attackers.length || attackers[attackerIdx].isDead) continue;

			const attacker = attackers[attackerIdx];
			const target = BattleEngine._getNextTarget(defenders);
			if (!target) break;

			const damage = Calculator.computeDamageTaken(attacker.battleStats.damage, target.battleStats.armor);
			if (!damage.eq(0)) {
				const newHP = target.battleStats.health.sub(damage);
				if (newHP.lte(0)) {
					target.battleStats.health = ZERO;
					target.isDead = true;
				} else {
					target.battleStats.health = newHP;
				}
			}

			if (enableAbilities && attacker.ability && isPlayerPhase) {
				if (Math.random() < Calculator.calculateOverdrive(attacker)) {
					try {
						BattleEngine.executeAbility(attacker, attackersTeam, defenders);
					} catch (error) {
						console.error("Ability execution failed:", error, "Attacker:", attacker.name, "Ability:", attacker.ability);
					}
				}
			}
		}
	}
}
