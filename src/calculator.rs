// src/calculator.rs
//
// Exact port of calculator.js.
// All formulas match 1:1. Comments note the JS equivalent.

use break_eternity::Decimal;
use crate::types::{FlatMachine, MachineStats, HeroDto, OptimizeConfig};

// ---------------------------------------------------------------------------
// Game constants — hardcoded (never change via UI)
// ---------------------------------------------------------------------------

pub const LEVEL_BONUS_BASE: f64 = 1.05;
pub const OVERDRIVE_BASE: f64 = 0.25;
pub const OVERDRIVE_PER_RARITY: f64 = 0.03;

pub const MISSION_SCALE_FACTOR: f64 = 1.2;
pub const MILESTONE_SCALE_FACTOR: f64 = 3.0;
pub const POWER_REQUIREMENT_MILESTONE_FACTOR: f64 = 2.0;

pub const BASE_ENEMY_DAMAGE: f64 = 260.0;
pub const BASE_ENEMY_HEALTH: f64 = 1560.0;
pub const BASE_ENEMY_ARMOR: f64 = 30.0;

pub const MAX_MISSIONS: u32 = 90;
pub const MAX_BATTLE_ROUNDS: u32 = 20;
pub const FORMATION_SIZE: usize = 5;

// ATTACK_ORDER = [0, 1, 2, 4, 3]
pub const ATTACK_ORDER: [usize; 5] = [0, 1, 2, 4, 3];

// DIFFICULTY_MULTIPLIERS indexed 0=easy 1=normal 2=hard 3=insane 4=nightmare
pub fn difficulty_multiplier(diff: usize) -> Decimal {
    match diff {
        0 => Decimal::from_number(1.0),
        1 => Decimal::from_number(360.0),
        2 => Decimal::from_number(2_478_600.0),
        3 => Decimal::from_number(5.8e12),
        4 => Decimal::from_number(2.92e18),
        _ => Decimal::from_number(1.0),
    }
}

pub const NUM_DIFFICULTIES: usize = 5;

// Power calculation weights
pub const DAMAGE_WEIGHT: f64 = 10.0;
pub const HEALTH_WEIGHT: f64 = 1.0;
pub const ARMOR_WEIGHT: f64 = 10.0;
pub const SCALING_EXPONENT: f64 = 0.7;

// Power requirements
pub const POWER_REQ_EASY_EARLY_MAX: u32 = 10;
pub const POWER_REQ_EASY_EARLY_PCT: f64 = 0.3;
pub const POWER_REQ_EASY_MID_MAX: u32 = 30;
pub const POWER_REQ_EASY_MID_PCT: f64 = 0.5;
pub const POWER_REQ_DEFAULT_PCT: f64 = 0.8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

#[inline]
pub fn zero() -> Decimal { Decimal::from_number(0.0) }
#[inline]
pub fn one() -> Decimal { Decimal::from_number(1.0) }

/// base^exp - 1   (matches the JS: base.pow(x).sub(1))
#[inline]
pub fn bonus(base: f64, exp: f64) -> Decimal {
    Decimal::from_number(base).pow(Decimal::from_number(exp)) - one()
}

/// JS: computeDamageTaken(enemyDamage, characterArmor)
#[inline]
pub fn compute_damage_taken(enemy_damage: Decimal, character_armor: Decimal) -> Decimal {
    if character_armor >= enemy_damage {
        return zero();
    }
    enemy_damage - character_armor
}

/// JS: calculateOverdrive(machine)
pub fn calculate_overdrive(rarity_level: u32) -> f64 {
    OVERDRIVE_BASE + rarity_level as f64 * OVERDRIVE_PER_RARITY
}

// ---------------------------------------------------------------------------
// computeCrewBonus  (matches JS Calculator.computeCrewBonus)
// Returns (dmg_fraction, hp_fraction, arm_fraction)
// ---------------------------------------------------------------------------

pub fn compute_crew_bonus(crew: &[HeroDto]) -> (Decimal, Decimal, Decimal) {
    let mut dmg = zero();
    let mut hp = zero();
    let mut arm = zero();
    for hero in crew {
        if hero.damage_pct > 0.0 { dmg = dmg + Decimal::from_number(hero.damage_pct / 100.0); }
        if hero.health_pct > 0.0 { hp  = hp  + Decimal::from_number(hero.health_pct / 100.0); }
        if hero.armor_pct  > 0.0 { arm = arm + Decimal::from_number(hero.armor_pct  / 100.0); }
    }
    (dmg, hp, arm)
}

// ---------------------------------------------------------------------------
// calculateBattleAttributes  (matches JS Calculator.calculateBattleAttributes)
// ---------------------------------------------------------------------------

pub fn calculate_battle_attributes(
    machine: &FlatMachine,
    crew: &[HeroDto],
    config: &OptimizeConfig,
) -> MachineStats {
    let base = LEVEL_BONUS_BASE;

    let level_bonus    = bonus(base, (machine.level as f64) - 1.0);
    let engineer_bonus = bonus(base, (config.engineer_level as f64) - 1.0);

    let dmg_bp_bonus = bonus(base, machine.bp_damage as f64);
    let hp_bp_bonus  = bonus(base, machine.bp_health as f64);
    let arm_bp_bonus = bonus(base, machine.bp_armor  as f64);

    let rarity_bonus = bonus(base, (machine.rarity_level + config.global_rarity_levels) as f64);

    let sacred_bonus      = bonus(base, machine.sacred_level      as f64);
    let inscription_bonus = bonus(base, machine.inscription_level as f64);

    let art_dmg = Decimal::from_number(config.artifact_bonus_damage);
    let art_hp  = Decimal::from_number(config.artifact_bonus_health);
    let art_arm = Decimal::from_number(config.artifact_bonus_armor);

    let base_dmg = machine.base_damage.to_decimal();
    let base_hp  = machine.base_health.to_decimal();
    let base_arm = machine.base_armor.to_decimal();

    let one = one();

    let basic_dmg = base_dmg
        * (one + level_bonus)
        * (one + engineer_bonus)
        * (one + dmg_bp_bonus)
        * (one + rarity_bonus)
        * (one + sacred_bonus)
        * (one + inscription_bonus)
        * (one + art_dmg);

    let basic_hp = base_hp
        * (one + level_bonus)
        * (one + engineer_bonus)
        * (one + hp_bp_bonus)
        * (one + rarity_bonus)
        * (one + sacred_bonus)
        * (one + inscription_bonus)
        * (one + art_hp);

    let basic_arm = base_arm
        * (one + level_bonus)
        * (one + engineer_bonus)
        * (one + arm_bp_bonus)
        * (one + rarity_bonus)
        * (one + sacred_bonus)
        * (one + inscription_bonus)
        * (one + art_arm);

    let (crew_dmg, crew_hp, crew_arm) = compute_crew_bonus(crew);

    MachineStats {
        damage: basic_dmg * (one + crew_dmg),
        health: basic_hp  * (one + crew_hp),
        armor:  basic_arm * (one + crew_arm),
    }
}

// ---------------------------------------------------------------------------
// calculateArenaAttributes  (matches JS Calculator.calculateArenaAttributes)
// ---------------------------------------------------------------------------

pub fn calculate_arena_attributes(
    machine: &FlatMachine,
    battle: &MachineStats,
    config: &OptimizeConfig,
) -> MachineStats {
    let base = Decimal::from_number(LEVEL_BONUS_BASE);
    let one  = one();

    // scarabBonus = min(max(floor((scarabLevel - 3) / 2) + 1, 0) * 0.002, 1)
    let scarab_level = config.scarab_level as f64;
    let scarab_steps = ((scarab_level - 3.0) / 2.0).floor() + 1.0;
    let scarab_steps_clamped = if scarab_steps < 0.0 { 0.0 } else { scarab_steps };
    let scarab_raw = scarab_steps_clamped * 0.002;
    let scarab_bonus = Decimal::from_number(if scarab_raw > 1.0 { 1.0 } else { scarab_raw });

    let rift_bonus    = Decimal::from_number(config.rift_bonus);
    let mech_fury     = base.pow(Decimal::from_number(config.global_rarity_levels as f64)) - one;
    let total_bonus   = (one + mech_fury) * (one + scarab_bonus) * (one + rift_bonus);

    let base_dmg = machine.base_damage.to_decimal();
    let base_hp  = machine.base_health.to_decimal();
    let base_arm = machine.base_armor.to_decimal();

    let div_dmg = battle.damage / base_dmg;
    let div_hp  = battle.health / base_hp;
    let div_arm = battle.armor  / base_arm;

    let one_d = Decimal::from_number(1.0);
    let two_d = Decimal::from_number(2.0);

    let log_add = |d: Decimal| -> Decimal {
        (Decimal::log10(&d) + one_d).pow(two_d)
    };

    MachineStats {
        damage: base_dmg * log_add(div_dmg) * total_bonus,
        health: base_hp  * log_add(div_hp)  * total_bonus,
        armor:  base_arm * log_add(div_arm) * total_bonus,
    }
}

// ---------------------------------------------------------------------------
// computeMachinePower  (matches JS Calculator.computeMachinePower)
// ---------------------------------------------------------------------------

pub fn compute_machine_power(stats: &MachineStats) -> Decimal {
    let exp = Decimal::from_number(SCALING_EXPONENT);
    let dmg_power = (stats.damage * Decimal::from_number(DAMAGE_WEIGHT)).pow(exp);
    let hp_power  = (stats.health * Decimal::from_number(HEALTH_WEIGHT)).pow(exp);
    let arm_power = (stats.armor  * Decimal::from_number(ARMOR_WEIGHT)).pow(exp);
    dmg_power + hp_power + arm_power
}

// ---------------------------------------------------------------------------
// enemyAttributes  (matches JS Calculator.enemyAttributes)
// ---------------------------------------------------------------------------

pub fn enemy_attributes(mission: u32, diff: usize, milestone_base: f64) -> MachineStats {
    let diff_mult  = difficulty_multiplier(diff);
    let mission_n  = (mission - 1) as f64;
    let milestone_count = (mission_n / 10.0).floor();

    let mission_factor   = Decimal::from_number(MISSION_SCALE_FACTOR).pow(Decimal::from_number(mission_n));
    let milestone_factor = Decimal::from_number(milestone_base).pow(Decimal::from_number(milestone_count));
    let final_mult       = diff_mult * mission_factor * milestone_factor;

    MachineStats {
        damage: Decimal::from_number(BASE_ENEMY_DAMAGE) * final_mult,
        health: Decimal::from_number(BASE_ENEMY_HEALTH) * final_mult,
        armor:  Decimal::from_number(BASE_ENEMY_ARMOR)  * final_mult,
    }
}

// ---------------------------------------------------------------------------
// computeSquadPower  (matches JS Calculator.computeSquadPower)
// ---------------------------------------------------------------------------

pub fn compute_squad_power(machines: &[ComputedMachine], arena: bool) -> Decimal {
    let mut total = zero();
    for m in machines {
        let stats = if arena { &m.arena } else { &m.battle };
        total = total + compute_machine_power(stats);
    }
    total
}

/// Compute squad power for 5 identical enemies at given mission/diff
pub fn enemy_squad_power(mission: u32, diff: usize) -> Decimal {
    let stats = enemy_attributes(mission, diff, POWER_REQUIREMENT_MILESTONE_FACTOR);
    compute_machine_power(&stats) * Decimal::from_number(5.0)
}

/// Required power to clear a mission — matches JS Calculator.requiredPowerForMission
pub fn req_power(mission: u32, diff: usize) -> Decimal {
    let squad = enemy_squad_power(mission, diff);
    let req_pct = if diff == 0 {
        if mission <= POWER_REQ_EASY_EARLY_MAX      { POWER_REQ_EASY_EARLY_PCT }
        else if mission <= POWER_REQ_EASY_MID_MAX   { POWER_REQ_EASY_MID_PCT }
        else                                        { POWER_REQ_DEFAULT_PCT }
    } else {
        POWER_REQ_DEFAULT_PCT
    };
    // JS: enemyPower.mul(reqPct).div(100).floor().mul(100)
    // reqPct is a fraction (0.3/0.5/0.8), div(100).floor().mul(100) rounds to nearest 100
    let hundred = Decimal::from_number(100.0);
    (squad * Decimal::from_number(req_pct) / hundred).floor() * hundred
}

// Import ComputedMachine here to use in compute_squad_power
use crate::types::ComputedMachine;