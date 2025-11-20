// Optimizer.js
import { Calculator } from './calculator.js';
import { BattleEngine } from './battleengine.js';

export class Optimizer {
    constructor({ ownedMachines, heroes, engineerLevel, scarabLevel, artifactArray, globalRarityLevels }) {
        this.ownedMachines = ownedMachines;
        this.heroes = heroes;
        this.engineerLevel = engineerLevel;
        this.scarabLevel = scarabLevel;
        this.artifactArray = artifactArray;
        this.globalRarityLevels = globalRarityLevels;
        this.battleEngine = new BattleEngine({ verbose: false });
    }

    _calcStatsCached(baseStats, inputs, crew) {
        const stats = { ...baseStats };
        if (inputs) {
            if (inputs.damageBoost) stats.damage += inputs.damageBoost;
            if (inputs.healthBoost) stats.health += inputs.healthBoost;
            if (inputs.armorBoost) stats.armor += inputs.armorBoost;
        }
        if (crew?.length) {
            crew.forEach(member => {
                if (member.role === 'damage') stats.damage *= 1 + (member.bonusDmg ?? 0) / 100;
                if (member.role === 'tank') stats.armor += member.bonusArm ?? 0;
                if (member.role === 'healer') stats.health += member.bonusHp ?? 0;
            });
        }
        return stats;
    }

    _calculateDamageTaken(baseDamage, attackerStats, defenderStats) {
        const mitigation = defenderStats.armor / (defenderStats.armor + 100);
        return Math.round(baseDamage * (1 - mitigation));
    }

    // Generate enemy slots for a mission and difficulty
    getEnemySlotsForMission(missionNumber, difficulty) {
        const slots = [];
        for (let i = 0; i < 5; i++) {
            const enemyStats = Calculator.enemyAttributes(missionNumber, difficulty);
            slots.push({
                machine: { name: `Enemy ${i + 1}` },
                stats: { ...enemyStats },
                health: enemyStats.health,
                maxHealth: enemyStats.health,
                abilityKey: null,
                isDead: false
            });
        }
        return slots;
    }

    // Optimizes hero placement on machines for max stat impact
    optimizeFormation(currentFormation) {
        const formation = currentFormation.map(slot => ({
            ...slot,
            crew: []
        }));

        const unassignedHeroes = this.heroes.map(h => ({ ...h, assigned: false }));
        const maxSlots = Calculator.maxCrewSlots(this.engineerLevel);

        unassignedHeroes.forEach(hero => {
            if (hero.assigned) return;

            let bestSlot = null;
            let bestImpact = -Infinity;

            formation.forEach(slot => {
                if (slot.crew.length >= maxSlots) return;

                let roleBonus = slot.role === hero.role ? 5000 : 0;

                const tempStats = { ...slot.stats };
                tempStats.damage *= 1 + (hero.bonusDmg ?? 0) / 100;
                tempStats.health *= 1 + (hero.bonusHp ?? 0) / 100;
                tempStats.armor *= 1 + (hero.bonusArm ?? 0) / 100;

                const impact = tempStats.damage * 1.5 + tempStats.health + tempStats.armor * 1.2 + roleBonus;

                if (impact > bestImpact) {
                    bestImpact = impact;
                    bestSlot = slot;
                }
            });

            if (bestSlot && bestSlot.crew.length < maxSlots) {
                bestSlot.crew.push(hero);
                hero.assigned = true;
            }
        });

        return formation;
    }



    // Main optimizer
    optimizeCampaignMaxStars({playerSlots, maxMission = 90, maxConsecutiveFails = 10, difficulties = ["easy", "normal", "hard", "insane", "nightmare"]}) {
        let totalStars = 0;
        let lastCleared = 0;

        const blankTeam = playerSlots.map(slot => {
            const stats = Calculator.calculateBattleStats(
                slot.machine.baseStats,
                slot.inputs,
                [],
                this.globalRarityLevels,
                this.artifactArray,
                this.engineerLevel,
                this.scarabLevel
            );

            return {
                id: slot.machine.id,
                name: slot.machine.name,
                role: slot.machine.role,
                tags: slot.machine.tags,
                image: slot.machine.image,
                baseStats: { ...slot.machine.baseStats },
                inputs: { ...slot.inputs },
                ability: abilitiesData[slot.abilityKey] ?? slot.machine.ability,
                stats: { ...stats, maxHealth: stats.health },
                crew: []
            };
        });

        let lastWinningTeam = [];
        const teamWithPower = blankTeam.map(slot => ({
            slot,
            power: Calculator.computeMachinePower(slot.stats)
        }));

        let top5 = teamWithPower
            .slice()
            .sort((a, b) => b.power - a.power)
            .slice(0, 5)
            .map(({ slot }) => ({ ...slot, crew: [] }));

        for (let mission = 1; mission <= maxMission; mission++) {
            for (const difficulty of difficulties) {
                for (let consecutiveFails = 0; consecutiveFails <= maxConsecutiveFails; consecutiveFails++) {
                    top5 = this.optimizeFormation(top5);

                    top5.forEach(slot => {
                        const stats = Calculator.calculateBattleStats(
                            slot.baseStats,
                            slot.inputs,
                            slot.crew,
                            this.globalRarityLevels,
                            this.artifactArray,
                            this.engineerLevel,
                            this.scarabLevel
                        );
                        slot.stats = { ...stats, maxHealth: stats.health };
                        slot.ability = abilitiesData[slot.abilityKey] ?? slot.ability;
                    });

                    const enemySlots = this.getEnemySlotsForMission(mission, difficulty);

                    const battleResult = this.battleEngine.runDeterministicBattle({
                        playerSlots: top5,
                        enemySlots,
                        calculateStatsFn: slot => slot.stats,
                        abilitiesDataRef: abilitiesData,
                        maxRounds: 20
                    });

                    if (battleResult.playerWon && difficulty === "easy") {
                        lastCleared = mission;
                    }

                    if (battleResult.playerWon) {
                        totalStars += 1;
                        lastWinningTeam = top5.map(slot => ({ ...slot }));
                        break;
                    }
                }
            }
        }

        return {
            totalStars,
            lastCleared,
            formation: lastWinningTeam
        };
    }
}