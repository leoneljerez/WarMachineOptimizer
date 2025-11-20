// battleEngine.js

export class BattleEngine {
    constructor({ machines = [], heroes = [], abilities = {}, playerOrder = [0, 1, 2, 3, 4], verbose = false } = {}) {
        this.machines = machines;
        this.heroes = heroes;
        this.abilities = abilities;
        this.PLAYER_ORDER = playerOrder;
        this.verbose = verbose;
    }

    // Deep clone helper
    _deepClone(obj) {
        return JSON.parse(JSON.stringify(obj ?? {}));
    }

    // Build a unit from a slot, calculating stats if needed
    _makeUnit(slot, calculateStatsFn, isPlayer = true, pos = 0) {
        const stats = slot.stats && typeof slot.stats === 'object'
            ? this._deepClone(slot.stats)
            : this._deepClone(calculateStatsFn(slot));

        const hp = Math.max(1, stats.health ?? 1);
        return {
            pos,
            isPlayer: !!isPlayer,
            machine: slot.machine ?? null,
            stats,
            health: hp,
            maxHealth: hp,
            isDead: false,
            abilityKey: slot.abilityKey ?? slot.machine?.ability?.key ?? null,
            temp: {} // for buffs/debuffs
        };
    }

    // Apply damage
    _applyDamage(targetUnit, damage) {
        if (!targetUnit || targetUnit.isDead) return 0;
        const before = targetUnit.health;
        targetUnit.health = Math.max(0, targetUnit.health - Math.max(0, Math.floor(damage ?? 0)));
        if (targetUnit.health <= 0) targetUnit.isDead = true;
        const actual = before - targetUnit.health;
        if (this.verbose) console.log(`[DMG] ${targetUnit.machine?.name ?? 'enemy'} took ${actual} dmg (hp ${before}->${targetUnit.health})`);
        return actual;
    }

    // Apply heal
    _applyHeal(targetUnit, amount) {
        if (!targetUnit || targetUnit.isDead) return 0;
        const before = targetUnit.health;
        targetUnit.health = Math.min(targetUnit.maxHealth, targetUnit.health + Math.max(0, amount ?? 0));
        const healed = targetUnit.health - before;
        if (this.verbose && healed > 0) console.log(`[HEAL] ${targetUnit.machine?.name ?? 'ally'} healed ${healed} (hp ${before}->${targetUnit.health})`);
        return healed;
    }

    // Target selectors
    _pickSingleTarget(actorPos, targetTeam) {
        if (targetTeam[actorPos] && !targetTeam[actorPos].isDead) return targetTeam[actorPos];
        return targetTeam.find(u => !u.isDead) ?? null;
    }

    _pickRandomTargetsDeterministic(numTargets, targetTeam) {
        const alive = targetTeam.filter(u => !u.isDead);
        return alive.slice(0, Math.max(0, numTargets));
    }

    _pickAllTargets(targetTeam) {
        return targetTeam.filter(u => !u.isDead);
    }

    _pickLowestTarget(targetTeam) {
        let best = null;
        for (const u of targetTeam) {
            if (u.isDead) continue;
            const pct = u.health / (u.maxHealth ?? 1);
            if (!best || pct < best.pct) best = { u, pct };
        }
        return best ? [best.u] : [];
    }

    // Compute ability damage
    _computeAbilityDamage(attackerStats, defenderStats, multiplier, externalDamageCalc) {
        const base = (attackerStats?.damage ?? 0) * (multiplier ?? 1);
        if (typeof externalDamageCalc === 'function') return externalDamageCalc(base, attackerStats, defenderStats);
        return Math.max(0, Math.floor(base));
    }

    _computeNormalDamage(attackerStats, defenderStats, externalDamageCalc) {
        const base = attackerStats?.damage ?? 0;
        if (typeof externalDamageCalc === 'function') return externalDamageCalc(base, attackerStats, defenderStats);
        return Math.max(0, Math.floor(base));
    }

    // Execute a unit's ability
    _executeAbilityForUnit(unit, allies, enemies, abilitiesDataRef, externalDamageCalc) {
        if (!unit || unit.isDead || !unit.abilityKey) return;
        const a = abilitiesDataRef?.[unit.abilityKey];
        if (!a) return;

        const { effect, targeting, targets: targetsType, numTargets = 1, multiplier = 1, scaleStat = 'damage' } = a;
        const targetArray = (targetsType === 'ally' || targetsType === 'self') ? allies : enemies;

        const resolveTargets = () => {
            switch (targeting) {
                case 'single': return [this._pickSingleTarget(unit.pos, targetArray)].filter(Boolean);
                case 'random': return this._pickRandomTargetsDeterministic(numTargets, targetArray);
                case 'all': return this._pickAllTargets(targetArray);
                case 'lowest': return this._pickLowestTarget(targetArray);
                case 'self': return [unit];
                default: return [];
            }
        };

        const targets = resolveTargets();

        if (effect === 'damage') {
            for (const tgt of targets) {
                const dealt = this._computeAbilityDamage(unit.stats, tgt.stats, multiplier, (baseDmg, atkStats, defStats) => {
                    if (typeof externalDamageCalc === 'function') return externalDamageCalc(baseDmg, atkStats, defStats);
                    return Math.max(0, Math.floor(baseDmg * (1 - (defStats.armor ?? 0) / 500)));
                });
                this._applyDamage(tgt, dealt);
            }
        } else if (effect === 'heal') {
            for (const tgt of targets) {
                const healAmount = scaleStat === 'health'
                    ? Math.floor((tgt.maxHealth ?? 1) * multiplier)
                    : Math.floor((unit.stats?.damage ?? 0) * multiplier);
                this._applyHeal(tgt, healAmount);
            }
        }
    }

    // Unit acts: ability then normal attack
    _unitAct(unit, allies, enemies, abilitiesDataRef, externalDamageCalc) {
        if (!unit || unit.isDead) return;

        if (unit.abilityKey) {
            this._executeAbilityForUnit(unit, allies, enemies, abilitiesDataRef, externalDamageCalc);
        }

        if (!unit.isDead) {
            const target = this._pickSingleTarget(unit.pos, enemies);
            if (target) {
                const dmg = this._computeNormalDamage(unit.stats, target.stats, (base, atkStats, defStats) => {
                    if (typeof externalDamageCalc === 'function') return externalDamageCalc(base, atkStats, defStats);
                    return Math.max(0, Math.floor(base * (1 - (defStats.armor ?? 0) / 500)));
                });
                this._applyDamage(target, dmg);
            }
        }
    }

    // Run a deterministic battle
    runDeterministicBattle({ playerSlots = [], enemySlots = [], calculateStatsFn, abilitiesDataRef = {}, externalDamageCalc = null, maxRounds = 20 } = {}) {
        if (typeof calculateStatsFn !== 'function') throw new Error('BattleEngine requires calculateStatsFn');

        const players = playerSlots.map((slot, i) => this._makeUnit(slot, calculateStatsFn, true, i));
        const enemies = enemySlots.map((slot, i) => this._makeUnit(slot, calculateStatsFn, false, i));

        const anyAlive = arr => arr.some(u => !u.isDead && (u.health ?? 0) > 0);

        let round = 0;
        while (round < maxRounds && anyAlive(players) && anyAlive(enemies)) {
            for (const pos of this.PLAYER_ORDER) {
                const actor = players[pos];
                if (!actor || actor.isDead) continue;
                this._unitAct(actor, players, enemies, abilitiesDataRef, externalDamageCalc);
                if (!anyAlive(enemies)) break;
            }
            if (!anyAlive(enemies)) break;

            for (const pos of this.PLAYER_ORDER) {
                const actor = enemies[pos];
                if (!actor || actor.isDead) continue;
                this._unitAct(actor, enemies, players, abilitiesDataRef, externalDamageCalc);
                if (!anyAlive(players)) break;
            }
            round++;
        }

        const playerTotalHP = players.reduce((s, u) => s + Math.max(0, u.health ?? 0), 0);
        const enemyTotalHP = enemies.reduce((s, u) => s + Math.max(0, u.health ?? 0), 0);

        if (this.verbose) {
            console.log(`Battle ended after ${round} rounds. playerHP=${playerTotalHP}, enemyHP=${enemyTotalHP}`);
        }

        return { playerWon: playerTotalHP > enemyTotalHP, rounds: round, players, enemies, playerTotalHP, enemyTotalHP };
    }
}
