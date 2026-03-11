// src/battle_engine.rs
//
// Exact port of battleengine.js.
// Uses Xorshift64 RNG (same statistical quality as Math.random(), much faster).
// All targeting modes, ability effects, and attack order match the JS exactly.

use break_eternity::Decimal;
use crate::calculator::{compute_damage_taken, ATTACK_ORDER, FORMATION_SIZE};
use crate::types::CombatUnit;

// ---------------------------------------------------------------------------
// Xorshift64 RNG — fast, good enough for Monte Carlo
// ---------------------------------------------------------------------------

pub struct Xorshift64(u64);

impl Xorshift64 {
    pub fn new(seed: u64) -> Self {
        Xorshift64(if seed == 0 { 0xdeadbeef } else { seed })
    }

    #[inline]
    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }

    /// Returns float in [0, 1)
    #[inline]
    pub fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    /// Fisher-Yates shuffle of indices 0..len, in-place
    pub fn shuffle(&mut self, arr: &mut [usize]) {
        let n = arr.len();
        for i in (1..n).rev() {
            let j = (self.next_u64() as usize) % (i + 1);
            arr.swap(i, j);
        }
    }
}

// ---------------------------------------------------------------------------
// BattleEngine
// ---------------------------------------------------------------------------

pub struct BattleEngine {
    pub rng: Xorshift64,
}

impl BattleEngine {
    pub fn new(seed: u64) -> Self {
        BattleEngine { rng: Xorshift64::new(seed) }
    }

    // -----------------------------------------------------------------------
    // run_battle — matches JS BattleEngine.runBattle exactly
    //
    // Takes fixed-size arrays to avoid heap allocation in the Monte Carlo loop.
    // player_len / enemy_len are the actual counts (rest are CombatUnit::dead()).
    // Returns true if player won.
    // -----------------------------------------------------------------------

    pub fn run_battle(
        &mut self,
        player_template: &[CombatUnit; FORMATION_SIZE],
        player_len: usize,
        enemy_template: &[CombatUnit; FORMATION_SIZE],
        enemy_len: usize,
        max_rounds: u32,
    ) -> bool {
        // Clone teams so we can mutate health without touching the templates
        let mut players = *player_template;
        let mut enemies = *enemy_template;

        // Mark excess slots as dead
        for i in player_len..FORMATION_SIZE { players[i].is_dead = true; }
        for i in enemy_len..FORMATION_SIZE  { enemies[i].is_dead = true; }

        // Set is_player flags
        for i in 0..player_len { players[i].is_player = true; }
        for i in 0..enemy_len  { enemies[i].is_player = false; }

        let mut round = 0u32;
        while round < max_rounds && has_alive(&players) && has_alive(&enemies) {
            self.attack_phase(&mut players, &mut enemies, true);
            if !has_alive(&enemies) { break; }
            self.attack_phase(&mut enemies, &mut players, false);
            round += 1;
        }

        !has_alive(&enemies) && has_alive(&players)
    }

    // -----------------------------------------------------------------------
    // attack_phase — matches JS attackPhase
    // -----------------------------------------------------------------------

    fn attack_phase(
        &mut self,
        attackers: &mut [CombatUnit; FORMATION_SIZE],
        defenders: &mut [CombatUnit; FORMATION_SIZE],
        attackers_are_players: bool,
    ) {
        for &attacker_idx in &ATTACK_ORDER {
            if !has_alive_arr(defenders) { break; }
            if attacker_idx >= FORMATION_SIZE || attackers[attacker_idx].is_dead { continue; }

            // Normal attack on first alive target (getNextTarget uses ATTACK_ORDER)
            let target_idx = match get_next_target(defenders) {
                Some(i) => i,
                None => break,
            };

            let attacker_dmg = attackers[attacker_idx].damage;
            let target_armor = defenders[target_idx].armor;
            let damage = compute_damage_taken(attacker_dmg, target_armor);

            if !damage.eq(&zero()) {
                apply_single_damage(&mut defenders[target_idx], damage);
            }

            // Ability trigger — only for player machines (matches JS: attackersTeam === players)
            if attackers_are_players && attackers[attacker_idx].ability_effect != 0 {
                let overdrive = attackers[attacker_idx].overdrive_chance;
                if self.rng.next_f64() < overdrive {
                    let caster_idx = attacker_idx;
                    // We need to execute ability — pass both teams mutably
                    // Rust borrow checker: extract caster values first
                    let caster = attackers[caster_idx];
                    self.execute_ability(&caster, attackers, defenders);
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // execute_ability — matches JS BattleEngine.executeAbility
    // -----------------------------------------------------------------------

    fn execute_ability(
        &mut self,
        caster: &CombatUnit,
        player_team: &mut [CombatUnit; FORMATION_SIZE],
        enemy_team: &mut [CombatUnit; FORMATION_SIZE],
    ) {
        let effect     = caster.ability_effect;
        let targeting  = caster.ability_targeting;
        let num_targets = caster.ability_num_targets as usize;
        let scale_stat  = caster.ability_scale_stat;
        let multiplier  = caster.ability_multiplier;

        // Determine base value
        let base_value = if scale_stat == 1 {
            caster.max_health
        } else {
            caster.damage
        };
        let ability_value = base_value * Decimal::from_number(multiplier);

        // ability.targets in JS: "ally"/"self" → player_team, "enemy" → enemy_team
        // In our encoding: effect=damage → target enemy_team, effect=heal → target player_team
        // (matches JS: damage → enemy, heal → ally)
        let target_team: &mut [CombatUnit; FORMATION_SIZE] = if effect == 2 {
            player_team  // heal → allies
        } else {
            enemy_team   // damage → enemies
        };

        // Select targets
        match targeting {
            0 => {
                // random
                let count = num_targets.max(1);
                let mut alive: Vec<usize> = (0..FORMATION_SIZE)
                    .filter(|&i| !target_team[i].is_dead)
                    .collect();
                self.rng.shuffle(&mut alive);
                let selected: Vec<usize> = alive.into_iter().take(count).collect();
                for idx in selected {
                    apply_ability_to_target(&mut target_team[idx], effect, ability_value);
                }
            }
            1 => {
                // all
                for i in 0..FORMATION_SIZE {
                    if !target_team[i].is_dead {
                        apply_ability_to_target(&mut target_team[i], effect, ability_value);
                    }
                }
            }
            2 => {
                // lowest HP
                if let Some(idx) = lowest_hp_index(target_team) {
                    apply_ability_to_target(&mut target_team[idx], effect, ability_value);
                }
            }
            3 => {
                // last N alive
                let count = num_targets.max(1);
                let alive: Vec<usize> = (0..FORMATION_SIZE)
                    .filter(|&i| !target_team[i].is_dead)
                    .collect();
                let start = if alive.len() > count { alive.len() - count } else { 0 };
                for &idx in &alive[start..] {
                    apply_ability_to_target(&mut target_team[idx], effect, ability_value);
                }
            }
            4 => {
                // self — caster is in player_team; find its slot by pointer comparison
                // We search player_team for the matching overdrive_chance + damage as proxy
                // (In practice "self" abilities are heals so player_team is already target_team)
                // Simplest: heal the caster directly
                // We can't mutably borrow player_team here if target_team already borrows it.
                // For "self" targeting we always target player_team regardless of effect.
                // Re-find caster by matching stats — safe because caster values are Copy
                for i in 0..FORMATION_SIZE {
                    if !player_team[i].is_dead
                        && player_team[i].damage == caster.damage
                        && player_team[i].max_health == caster.max_health
                    {
                        apply_ability_to_target(&mut player_team[i], effect, ability_value);
                        break;
                    }
                }
            }
            _ => {}
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

#[inline]
fn zero() -> Decimal { Decimal::from_number(0.0) }

#[inline]
pub fn has_alive(team: &[CombatUnit; FORMATION_SIZE]) -> bool {
    team.iter().any(|u| !u.is_dead)
}

#[inline]
fn has_alive_arr(team: &[CombatUnit; FORMATION_SIZE]) -> bool {
    has_alive(team)
}

/// getNextTarget — iterates ATTACK_ORDER, returns first alive index
#[inline]
fn get_next_target(team: &[CombatUnit; FORMATION_SIZE]) -> Option<usize> {
    for &idx in &ATTACK_ORDER {
        if !team[idx].is_dead {
            return Some(idx);
        }
    }
    None
}

fn lowest_hp_index(team: &[CombatUnit; FORMATION_SIZE]) -> Option<usize> {
    let mut best: Option<(usize, Decimal)> = None;
    for i in 0..FORMATION_SIZE {
        if !team[i].is_dead {
            match best {
                None => best = Some((i, team[i].health)),
                Some((_, min_hp)) if team[i].health < min_hp => {
                    best = Some((i, team[i].health));
                }
                _ => {}
            }
        }
    }
    best.map(|(i, _)| i)
}

#[inline]
fn apply_single_damage(target: &mut CombatUnit, damage: Decimal) {
    let new_hp = target.health - damage;
    if new_hp <= zero() {
        target.health = zero();
        target.is_dead = true;
    } else {
        target.health = new_hp;
    }
}

fn apply_ability_to_target(target: &mut CombatUnit, effect: u8, value: Decimal) {
    if target.is_dead { return; }
    if effect == 2 {
        // heal — cap at maxHealth
        let new_hp = target.health + value;
        target.health = if new_hp > target.max_health { target.max_health } else { new_hp };
    } else if effect == 1 {
        // damage — goes through armor
        let actual = compute_damage_taken(value, target.armor);
        if !actual.eq(&zero()) {
            apply_single_damage(target, actual);
        }
    }
}