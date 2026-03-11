// src/types.rs
use break_eternity::Decimal;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Decimal DTO
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default)]
pub struct DecimalDto {
    pub sign: i64,
    pub layer: i64,
    pub mag: f64,
}

impl DecimalDto {
    pub fn to_decimal(self) -> Decimal {
        Decimal::from_components(self.sign as i8, self.layer, self.mag)
    }
    pub fn from_decimal(d: Decimal) -> Self {
        DecimalDto { sign: d.sign as i64, layer: d.layer, mag: d.mag }
    }

    pub fn zero() -> Self {
        DecimalDto::from_decimal(Decimal::from_number(0.0))
    }
}

// ---------------------------------------------------------------------------
// HeroDto
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HeroDto {
    pub id: u32,
    pub damage_pct: f64,
    pub health_pct: f64,
    pub armor_pct: f64,
}

// ---------------------------------------------------------------------------
// FlatMachine — JS sends one per owned machine
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FlatMachine {
    pub id: u32,
    pub is_tank: bool,
    pub is_healer: bool,

    pub base_damage: DecimalDto,
    pub base_health: DecimalDto,
    pub base_armor: DecimalDto,

    pub level: u32,
    pub rarity_level: u32,
    pub sacred_level: u32,
    pub inscription_level: u32,

    pub bp_damage: u32,
    pub bp_health: u32,
    pub bp_armor: u32,

    // ability encoded as integers
    // effect:     0=none  1=damage  2=heal
    // targeting:  0=random  1=all  2=lowest  3=last  4=self
    // scale_stat: 0=damage  1=health
    pub ability_effect: u8,
    pub ability_targeting: u8,
    pub ability_num_targets: u32,
    pub ability_scale_stat: u8,
    pub ability_multiplier: f64,
    pub overdrive_chance: f64,
}

// ---------------------------------------------------------------------------
// CombatUnit — stack-allocated, used inside battle hot loop
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug)]
pub struct CombatUnit {
    pub damage: Decimal,
    pub health: Decimal,
    pub max_health: Decimal,
    pub armor: Decimal,
    pub is_dead: bool,

    pub ability_effect: u8,
    pub ability_targeting: u8,
    pub ability_num_targets: u32,
    pub ability_scale_stat: u8,
    pub ability_multiplier: f64,
    pub overdrive_chance: f64,

    pub is_player: bool,
}

impl CombatUnit {
    pub fn dead() -> Self {
        let z = Decimal::from_number(0.0);
        CombatUnit {
            damage: z, health: z, max_health: z, armor: z,
            is_dead: true,
            ability_effect: 0, ability_targeting: 0,
            ability_num_targets: 0, ability_scale_stat: 0,
            ability_multiplier: 0.0, overdrive_chance: 0.0,
            is_player: false,
        }
    }
}

// ---------------------------------------------------------------------------
// MachineStats
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, Default)]
pub struct MachineStats {
    pub damage: Decimal,
    pub health: Decimal,
    pub armor: Decimal,
}



// ---------------------------------------------------------------------------
// ComputedMachine — internal, fully computed
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct ComputedMachine {
    pub flat: FlatMachine,
    pub crew: Vec<HeroDto>,
    pub battle: MachineStats,
    pub arena: MachineStats,
}

// ---------------------------------------------------------------------------
// OptimizeConfig — all user-configurable values passed from JS
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug)]
pub struct OptimizeConfig {
    pub engineer_level: u32,
    pub scarab_level: u32,
    pub global_rarity_levels: u32,
    pub rift_bonus: f64,
    pub max_mission: u32,
    pub monte_carlo_simulations: u32,
    pub max_crew_slots: u32,
    pub reoptimize_interval: u32,

    // artifact bonuses already computed by JS (fraction, e.g. 0.30 = +30%)
    pub artifact_bonus_damage: f64,
    pub artifact_bonus_health: f64,
    pub artifact_bonus_armor: f64,

    // hero scoring weights
    pub hero_scoring_campaign_tank: HeroWeights,
    pub hero_scoring_campaign_dps: HeroWeights,
    pub hero_scoring_arena_tank: HeroWeights,
    pub hero_scoring_arena_dps: HeroWeights,

    // heroes — sorted by JS before passing in (descending damage+health sum)
    // sliced to (num_machines * max_crew_slots + 20) by JS
    pub heroes: Vec<HeroDto>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub struct HeroWeights {
    pub damage: f64,
    pub health: f64,
    pub armor: f64,
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug)]
pub struct DifficultyClears {
    pub easy: u32,
    pub normal: u32,
    pub hard: u32,
    pub insane: u32,
    pub nightmare: u32,
}

impl DifficultyClears {
    pub fn zero() -> Self {
        DifficultyClears { easy: 0, normal: 0, hard: 0, insane: 0, nightmare: 0 }
    }
    pub fn get(&self, diff: usize) -> u32 {
        match diff {
            0 => self.easy,
            1 => self.normal,
            2 => self.hard,
            3 => self.insane,
            4 => self.nightmare,
            _ => 0,
        }
    }
    pub fn set(&mut self, diff: usize, val: u32) {
        match diff {
            0 => self.easy = val,
            1 => self.normal = val,
            2 => self.hard = val,
            3 => self.insane = val,
            4 => self.nightmare = val,
            _ => {}
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MachineResult {
    pub id: u32,
    pub battle_damage: DecimalDto,
    pub battle_health: DecimalDto,
    pub battle_armor: DecimalDto,
    pub battle_max_health: DecimalDto,
    pub arena_damage: DecimalDto,
    pub arena_health: DecimalDto,
    pub arena_armor: DecimalDto,
    pub arena_max_health: DecimalDto,
    pub assigned_hero_ids: Vec<u32>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CampaignResult {
    pub total_stars: u32,
    pub last_cleared: DifficultyClears,
    pub formation: Vec<MachineResult>,
    pub battle_power: DecimalDto,
    pub arena_power: DecimalDto,
    pub mode: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ArenaResult {
    pub formation: Vec<MachineResult>,
    pub arena_power: DecimalDto,
    pub battle_power: DecimalDto,
    pub mode: String,
}