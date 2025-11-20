// calculator.js
import Decimal from 'decimal.js';

export class Calculator {

    // Static Machine Rarity values
    static RARITY_LEVELS = {
        common: 0,
        uncommon: 1,
        rare: 2,
        epic: 3,
        legendary: 4,
        mythic: 5,
        titan: 6,
        angel: 7,
        celestial: 8
    };

    // ---------------------------
    // Global rarity level of all machines
    // ---------------------------
    static getGlobalRarityLevels(ownedMachines) {
        return ownedMachines.reduce((sum, machine) => {
            const rarity = machine.inputs?.rarity?.toLowerCase() ?? "common";
            return sum + (Calculator.RARITY_LEVELS[rarity] ?? 0);
        }, 0);
    }

    // ---------------------------
    // Enemy attributes for a mission
    // ---------------------------
    static enemyAttributes(missionNumber, difficulty) {
        const base = { damage: new Decimal(260), health: new Decimal(1560), armor: new Decimal(30) };
        const difficultyMultipliers = {
            easy: new Decimal(1),
            normal: new Decimal(360),
            hard: new Decimal(2478600),
            insane: new Decimal('5.8e+12'),
            nightmare: new Decimal('2.92e+18')
        };
        const diffMultiplier = difficultyMultipliers[difficulty];
        const missionFactor = new Decimal(1.2).pow(missionNumber - 1);
        const milestoneFactor = new Decimal(2).pow(Math.floor((missionNumber - 1) / 10));

        return {
            damage: Math.floor(base.damage.mul(diffMultiplier).mul(missionFactor).mul(milestoneFactor).toNumber()),
            health: Math.floor(base.health.mul(diffMultiplier).mul(missionFactor).mul(milestoneFactor).toNumber()),
            armor: Math.floor(base.armor.mul(diffMultiplier).mul(missionFactor).mul(milestoneFactor).toNumber())
        };
    }

    // ---------------------------
    // Required power to unlock next level
    // ---------------------------
    static requiredPowerForMission(missionNumber, difficulty) {
        const enemyStats = Calculator.enemyAttributes(missionNumber, difficulty);
        const enemyPower = new Decimal(Calculator.computeMachinePower(enemyStats)).mul(5);

        let reqPct = 0.8;
        if (difficulty === "easy") {
            if (missionNumber <= 10) reqPct = 0.3;
            else if (missionNumber <= 30) reqPct = 0.5;
        }

        return Math.floor(enemyPower.mul(reqPct / 100).mul(100).toNumber());
    }

    // ---------------------------
    // Crew bonus for a machine
    // ---------------------------
    static computeCrewBonus(crewList) {
        let totalDmg = 0, totalHp = 0, totalArm = 0;
        (crewList || []).forEach(hero => {
            totalDmg += hero?.bonusDmg ? hero.bonusDmg / 100 : 0;
            totalHp += hero?.bonusHp ? hero.bonusHp / 100 : 0;
            totalArm += hero?.bonusArm ? hero.bonusArm / 100 : 0;
        });
        return { dmg: totalDmg, hp: totalHp, arm: totalArm };
    }

    // ---------------------------
    // Basic Attribute formula using Decimal
    // ---------------------------
    static computeBasicAttribute(base, levelBonus, engineerBonus, scarabBonus, blueprintBonus, rarityBonus, sacredBonus, inscriptionBonus, artifactBonus) {
        return Math.floor(
            new Decimal(base)
                .mul(new Decimal(1).plus(levelBonus))
                .mul(new Decimal(1).plus(engineerBonus))
                .mul(new Decimal(1).plus(scarabBonus))
                .mul(new Decimal(1).plus(blueprintBonus))
                .mul(new Decimal(1).plus(rarityBonus))
                .mul(new Decimal(1).plus(sacredBonus))
                .mul(new Decimal(1).plus(inscriptionBonus))
                .mul(new Decimal(1).plus(artifactBonus))
                .toNumber()
        );
    }

    // ---------------------------
    // Arena Attribute formula using Decimal
    // ---------------------------
    static computeArenaAttribute(base, battleAttribute, mechanicalFuryBonus) {
        const logTerm = Decimal.log10(battleAttribute / base).plus(1);
        const square = logTerm.pow(2);
        return Math.floor(new Decimal(base).mul(square).mul(new Decimal(1).plus(mechanicalFuryBonus)).toNumber());
    }

    // ---------------------------
    // Compute Artifact multipliers
    // ---------------------------
    static computeArtifactBonus(artifactArray, stat) {
        let total = new Decimal(1);
        (artifactArray || []).forEach(a => {
            if (!a?.stat || a.stat !== stat) return;
            total = total.mul(new Decimal(1).plus((a.percent || 0) / 100).pow(a.quantity || 0));
        });
        return total.minus(1);
    }

    // ---------------------------
    // Full battle stats including crew and artifacts
    // ---------------------------
    static calculateBattleStats(machineBase, inputs = {}, crewList = [], globalRarityLevels = 0, artifactArray = [], engineerLevel = 0, scarabLevel = 0) {
        const { damage: baseDmg, health: baseHp, armor: baseArm } = machineBase;

        const levelBonus = inputs.level ? new Decimal(1.05).pow(inputs.level - 1).minus(1) : new Decimal(0);
        const engineerBonus = engineerLevel ? new Decimal(1.05).pow(engineerLevel - 1).minus(1) : new Decimal(0);
        const scarabBonus = new Decimal(Math.min(0.002 * Math.max(0, Math.floor((scarabLevel - 3) / 2) + 1), 1));

        const dmgBPBonus = inputs.dmgBP ? new Decimal(1.05).pow(inputs.dmgBP).minus(1) : new Decimal(0);
        const hpBPBonus = inputs.hpBP ? new Decimal(1.05).pow(inputs.hpBP).minus(1) : new Decimal(0);
        const armBPBonus = inputs.armBP ? new Decimal(1.05).pow(inputs.armBP).minus(1) : new Decimal(0);

        const rarityLevel = Calculator.RARITY_LEVELS[inputs.rarity?.toLowerCase()] || 0;
        const rarityBonus = new Decimal(1.05).pow(rarityLevel + globalRarityLevels).minus(1);
        const mechanicalFuryBonus = new Decimal(1.05).pow(globalRarityLevels).minus(1);

        const sacredBonus = inputs.sacred ? new Decimal(1.05).pow(inputs.sacred).minus(1) : new Decimal(0);
        const inscriptionBonus = inputs.inscription ? new Decimal(1.05).pow(inputs.inscription).minus(1) : new Decimal(0);

        const artifactBonusDmg = Calculator.computeArtifactBonus(artifactArray, 'damage');
        const artifactBonusHp = Calculator.computeArtifactBonus(artifactArray, 'health');
        const artifactBonusArm = Calculator.computeArtifactBonus(artifactArray, 'armor');

        const basicDmg = Calculator.computeBasicAttribute(baseDmg, levelBonus, engineerBonus, scarabBonus, dmgBPBonus, rarityBonus, sacredBonus, inscriptionBonus, artifactBonusDmg);
        const basicHp = Calculator.computeBasicAttribute(baseHp, levelBonus, engineerBonus, scarabBonus, hpBPBonus, rarityBonus, sacredBonus, inscriptionBonus, artifactBonusHp);
        const basicArm = Calculator.computeBasicAttribute(baseArm, levelBonus, engineerBonus, scarabBonus, armBPBonus, rarityBonus, sacredBonus, inscriptionBonus, artifactBonusArm);

        const crewBonus = Calculator.computeCrewBonus(crewList);

        return {
            damage: Math.floor(basicDmg * (1 + crewBonus.dmg)),
            health: Math.floor(basicHp * (1 + crewBonus.hp)),
            armor: Math.floor(basicArm * (1 + crewBonus.arm))
        };
    }

    // ---------------------------
    // Compute machine power
    // ---------------------------
    static computeMachinePower(stats) {
        const dmgVal = new Decimal(Math.max(0, stats.damage || 0));
        const hpVal = new Decimal(Math.max(0, stats.health || 0));
        const armVal = new Decimal(Math.max(0, stats.armor || 0));

        return Math.floor(
            dmgVal.mul(10).pow(0.7)
                .plus(hpVal.pow(0.7))
                .plus(armVal.mul(10).pow(0.7))
                .toNumber()
        );
    }

    // ---------------------------
    // Quick power estimate (no crew)
    // ---------------------------
    static calculateMachineBattlePowerQuick(machineBase, inputs, globalRarityLevels = 0, artifactArray = [], engineerLevel = 0, scarabLevel = 0) {
        const stats = Calculator.calculateBattleStats(machineBase, inputs, [], globalRarityLevels, artifactArray, engineerLevel, scarabLevel);
        return Calculator.computeMachinePower(stats);
    }

    // ---------------------------
    // Squad power
    // ---------------------------
    static computeSquadPower(listOfStats) {
        return (listOfStats || []).reduce((sum, s) => sum + Calculator.computeMachinePower(s), 0);
    }

    // ---------------------------
    // Max crew slots
    // ---------------------------
    static maxCrewSlots(engineerLevel) {
        if (engineerLevel >= 60) return 6;
        if (engineerLevel >= 30) return 5;
        return 4;
    }

}
