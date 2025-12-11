// calculator.js
import Decimal from "./vendor/break_eternity.esm.js"; // v2.1.3

export class Calculator {
  // ---------------------------
  // Helper to ensure proper Decimal instances
  // ---------------------------
  static toDecimal(value) {
    if (value instanceof Decimal) {
      return value;
    }

    return new Decimal(value);
  }

  // ---------------------------
  // Static Variables
  // ---------------------------
  static RARITY_LEVELS = {
    common: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5,
    titan: 6,
    angel: 7,
    celestial: 8,
  };

  static BASE = {
    damage: new Decimal(260),
    health: new Decimal(1560),
    armor: new Decimal(30),
  };

  static DIFFICULTY_MULTIPLIERS = {
    easy: new Decimal(1),
    normal: new Decimal(360),
    hard: new Decimal(2478600),
    insane: new Decimal("5.8e+12"),
    nightmare: new Decimal("2.92e+18"),
  };

  // ---------------------------
  // Damage Taken
  // (Enemy_Damage - Character_Armor)
  // ---------------------------
  static computeDamageTaken(enemyDamage, characterArmor) {
    const dmg = Calculator.toDecimal(enemyDamage);
    const armor = Calculator.toDecimal(characterArmor);

    if (armor.gte(dmg)) return new Decimal(0);

    return dmg.sub(armor).max(0);
  }

  // ---------------------------
  // Global rarity level of all machines
  // ---------------------------
  static getGlobalRarityLevels(ownedMachines) {
    return ownedMachines.reduce((sum, machine) => {
      const rarity = machine.rarity?.toLowerCase() ?? "common";
      return sum + (Calculator.RARITY_LEVELS[rarity] ?? 0);
    }, 0);
  }

  // ---------------------------
  // Overdrive of the machine - how often the ability will proc
  // ---------------------------
  static calculateOverdrive(machine) {
    const rarity = Calculator.RARITY_LEVELS[machine.rarity];
    const startingOverdrive = 0.25;
    const multiplier = 0.03;

    if(rarity === 0) return startingOverdrive;

    return startingOverdrive + (rarity * multiplier);
  }

  // ---------------------------
  // Enemy attributes for a mission
  // ---------------------------
  static enemyAttributes(missionNumber, difficulty) {
    const diffMultiplier = this.DIFFICULTY_MULTIPLIERS[difficulty];
    const missionNum = missionNumber - 1;
    const milestoneCount = Math.floor(missionNum / 10);

    const missionFactor = new Decimal(1.2).pow(missionNum);
    const milestoneFactor = new Decimal(3).pow(milestoneCount);

    const finalMultiplier = diffMultiplier
      .mul(missionFactor)
      .mul(milestoneFactor);

    return {
      damage: this.BASE.damage.mul(finalMultiplier),
      health: this.BASE.health.mul(finalMultiplier),
      armor: this.BASE.armor.mul(finalMultiplier),
    };
  }

  // ---------------------------
  // Create an enemy team
  // ---------------------------
  static getEnemyTeamForMission(missionNumber, difficulty) {
    const enemyTeam = [];
    for (let i = 0; i < 5; i++) {
      const enemyStats = Calculator.enemyAttributes(missionNumber, difficulty);
      enemyTeam.push({
        name: `Enemy${i + 1}`,
        baseStats: {
          damage: enemyStats.damage,
          health: enemyStats.health,
          armor: enemyStats.armor,
        },
        battleStats: {
          damage: enemyStats.damage,
          health: enemyStats.health,
          maxHealth: enemyStats.health,
          armor: enemyStats.armor,
        },
        isDead: false,
      });
    }
    return enemyTeam;
  }

  // ---------------------------
  // Required power to unlock next level
  // ---------------------------
  static requiredPowerForMission(missionNumber, difficulty) {
    const enemyTeam = Calculator.getEnemyTeamForMission(
      missionNumber,
      difficulty
    );

    // Compute enemy power
    const enemyPower = Calculator.computeMachinePower(
      enemyTeam[0].battleStats
    ).mul(5);

    // Determine required percentage
    let reqPct = 0.8; // 80%
    if (difficulty === "easy") {
      if (missionNumber <= 10) reqPct = 0.3; // 30%
      else if (missionNumber <= 30) reqPct = 0.5; // 50%
    }

    return enemyPower.mul(reqPct);
  }

  // ---------------------------
  // Crew bonus for a machine
  // ---------------------------
  static computeCrewBonus(crewList) {
    let totalDmg = new Decimal(0);
    let totalHp = new Decimal(0);
    let totalArm = new Decimal(0);

    (crewList || []).forEach((hero) => {
      // Add bonuses if they exist and are non-zero
      const dmgPct = hero?.percentages?.damage || 0;
      const hpPct = hero?.percentages?.health || 0;
      const armPct = hero?.percentages?.armor || 0;

      if (dmgPct > 0) {
        totalDmg = totalDmg.add(dmgPct / 100);
      }
      if (hpPct > 0) {
        totalHp = totalHp.add(hpPct / 100);
      }
      if (armPct > 0) {
        totalArm = totalArm.add(armPct / 100);
      }
    });

    return { dmg: totalDmg, hp: totalHp, arm: totalArm };
  }

  // ---------------------------
  // Basic Attribute formula
  // ---------------------------
  static computeBasicAttribute(
    base,
    levelBonus,
    engineerBonus,
    blueprintBonus,
    rarityBonus,
    sacredBonus,
    inscriptionBonus,
    artifactBonus
  ) {
    return Calculator.toDecimal(base)
      .mul(new Decimal(1).add(levelBonus))
      .mul(new Decimal(1).add(engineerBonus))
      .mul(new Decimal(1).add(blueprintBonus))
      .mul(new Decimal(1).add(rarityBonus))
      .mul(new Decimal(1).add(sacredBonus))
      .mul(new Decimal(1).add(inscriptionBonus))
      .mul(new Decimal(1).add(artifactBonus));
  }

  // ---------------------------
  // Compute Artifact multipliers
  // ---------------------------
  static computeArtifactBonus(artifactArray, stat) {
    let total = new Decimal(1);

    (artifactArray || []).forEach((a) => {
      if (a.stat !== stat || !a.values) return;

      Object.entries(a.values).forEach(([percentStr, quantity]) => {
        if (!quantity || quantity <= 0) return;

        const percent = Number(percentStr);
        const mult = new Decimal(1).add(percent / 100).pow(quantity);

        total = total.mul(mult);
      });
    });

    // Return as additive bonus (e.g. 0.69 = +69%)
    return total.sub(1);
  }

  // ---------------------------
  // Arena battle stats including crew and artifacts
  // ---------------------------
  static calculateArenaAttributes(
    machine,
    globalRarityLevels = 0,
    scarabLevel = 0,
    riftRank = ""
  ) {
    const base105 = new Decimal(1.05);
    console.log("Rift rank is: ", riftRank);

    const scarabBonus = Decimal.min(
      Decimal.max(new Decimal(scarabLevel).sub(3).div(2).floor().add(1), 0).mul(
        0.002
      ),
      1
    );

    let riftBonus = new Decimal(0);
    switch (String(riftRank).toLowerCase()) {
      case "sapphire":
        riftBonus = new Decimal(0.01);
        break;
      case "emerald":
        riftBonus = new Decimal(0.02);
        break;
      case "ruby":
        riftBonus = new Decimal(0.03);
        break;
      case "platinum":
        riftBonus = new Decimal(0.04);
        break;
      case "diamond":
        riftBonus = new Decimal(0.05);
        break;
      default:
        riftBonus = new Decimal(0);
    }

    console.log("Rift Bonus is: ", riftBonus);

    const mechFuryBonus = base105.pow(globalRarityLevels).sub(1);

    const baseDamage = Calculator.toDecimal(machine.baseStats.damage);
    const baseHealth = Calculator.toDecimal(machine.baseStats.health);
    const baseArmor = Calculator.toDecimal(machine.baseStats.armor);

    const battleDamage = Calculator.toDecimal(machine.battleStats.damage);
    const battleHealth = Calculator.toDecimal(machine.battleStats.health);
    const battleArmor = Calculator.toDecimal(machine.battleStats.armor);

    const divDmg = battleDamage.div(baseDamage);
    const divHp = battleHealth.div(baseHealth);
    const divArm = battleArmor.div(baseArmor);

    const arenaDmg = baseDamage
      .mul(Decimal.log10(divDmg).add(1).pow(2))
      .mul(mechFuryBonus.add(1))
      .mul(scarabBonus.add(1))
      .mul(riftBonus.add(1));
    const arenaHp = baseHealth
      .mul(Decimal.log10(divHp).add(1).pow(2))
      .mul(mechFuryBonus.add(1))
      .mul(scarabBonus.add(1))
      .mul(riftBonus.add(1));
    const arenaArm = baseArmor
      .mul(Decimal.log10(divArm).add(1).pow(2))
      .mul(mechFuryBonus.add(1))
      .mul(scarabBonus.add(1))
      .mul(riftBonus.add(1));

    return {
      damage: arenaDmg,
      health: arenaHp,
      armor: arenaArm,
    };
  }

  // ---------------------------
  // Full battle stats including crew and artifacts
  // basic attribute = base attribute * (1 + level bonus) * (1 + engineer bonus) * (1 + blueprint bonus) 
  // * (1 + rarity bonus) * (1 + sacred card bonus)  * (1 + inscription card bonus) * (1 + artifact bonus)
  // ---------------------------
  static calculateBattleAttributes(
    machine,
    crewList = [],
    globalRarityLevels = 0,
    artifactArray = [],
    engineerLevel = 0,
    // eslint-disable-next-line no-unused-vars
    scarabLevel = 0
  ) {
    const base105 = new Decimal(1.05);

    // level bonus = 1.05^(war machine level – 1) - 1
    const levelBonus = base105.pow(machine.level - 1).sub(1);

    // engineer bonus = 1.05^(engineer level – 1) - 1
    const engineerBonus = base105.pow(engineerLevel - 1).sub(1);

    // blueprint bonus = 1.05^blueprint level - 1
    const dmgBPBonus = base105.pow(machine.blueprints.damage).sub(1);
    const hpBPBonus = base105.pow(machine.blueprints.health).sub(1);
    const armBPBonus = base105.pow(machine.blueprints.armor).sub(1);

    // rarity bonus = 1.05^(rarity level of this machine + rarity levels of all machines) - 1
    const rarityLevel =
      Calculator.RARITY_LEVELS[machine.rarity?.toLowerCase()] || 0;
    const rarityBonus = base105.pow(rarityLevel + globalRarityLevels).sub(1);

    // base effect = 0.05 for both
    // card bonus = (1 + base effect)^card level - 1
    const sacredBonus = base105.pow(machine.sacredLevel).sub(1);
    const inscriptionBonus = base105.pow(machine.inscriptionLevel).sub(1);

    // multiplicative
    const artifactBonusDmg = Calculator.computeArtifactBonus(
      artifactArray,
      "damage"
    );
    const artifactBonusHp = Calculator.computeArtifactBonus(
      artifactArray,
      "health"
    );
    const artifactBonusArm = Calculator.computeArtifactBonus(
      artifactArray,
      "armor"
    );

    // base Stats
    const baseDamage = Calculator.toDecimal(machine.baseStats.damage);
    const baseHealth = Calculator.toDecimal(machine.baseStats.health);
    const baseArmor = Calculator.toDecimal(machine.baseStats.armor);

    const basicDmg = Calculator.computeBasicAttribute(
      baseDamage,
      levelBonus,
      engineerBonus,
      dmgBPBonus,
      rarityBonus,
      sacredBonus,
      inscriptionBonus,
      artifactBonusDmg
    );

    const basicHp = Calculator.computeBasicAttribute(
      baseHealth,
      levelBonus,
      engineerBonus,
      hpBPBonus,
      rarityBonus,
      sacredBonus,
      inscriptionBonus,
      artifactBonusHp
    );

    const basicArm = Calculator.computeBasicAttribute(
      baseArmor,
      levelBonus,
      engineerBonus,
      armBPBonus,
      rarityBonus,
      sacredBonus,
      inscriptionBonus,
      artifactBonusArm
    );

    // additive
    const crewBonus = Calculator.computeCrewBonus(crewList);

    // battle attribute = basic attribute * (1 + crew bonus)
    return {
      damage: basicDmg.mul(new Decimal(1).add(crewBonus.dmg)),
      health: basicHp.mul(new Decimal(1).add(crewBonus.hp)),
      armor: basicArm.mul(new Decimal(1).add(crewBonus.arm)),
    };
  }

  // ---------------------------
  // Compute machine power
  // ((10 * dmgVal)^0.7) + ((1 * hpVal)^0.7) + ((10 * armVal)^0.7)
  // ---------------------------
  static computeMachinePower(stats) {
    const dmgVal = Calculator.toDecimal(stats.damage);
    const hpVal = Calculator.toDecimal(stats.health);
    const armVal = Calculator.toDecimal(stats.armor);

    const dmgPower = dmgVal.mul(10).pow(0.7);
    const hpPower = hpVal.mul(1).pow(0.7);
    const armPower = armVal.mul(10).pow(0.7);

    return dmgPower.add(hpPower).add(armPower);
  }

  // ---------------------------
  // Squad power
  // sum of machine power
  // ---------------------------
  static computeSquadPower(machines = [], mode = "campaign") {
    let totalPower = new Decimal(0);

    for (const machine of machines) {
      // Use the appropriate stats based on mode
      const stats = mode === "arena" ? machine.arenaStats : machine.battleStats;
      
      if (!stats) {
        console.warn(`Machine missing ${mode}Stats:`, machine.name);
        continue;
      }
      
      const machinePower = Calculator.computeMachinePower(stats);
      totalPower = totalPower.add(machinePower);
    }

    return totalPower;
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