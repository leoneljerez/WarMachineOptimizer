// src/optimizer.rs
//
// Exact port of optimizer.js.
// Includes:
//   - selectBestFive       (sorts by level descending, takes top 5)
//   - Hungarian assignment (kmAssignment — full Decimal weight matrix)
//   - optimizeCrewGlobally (builds machine slots, runs KM, assigns crew)
//   - arrangeByRole        (exact tank/DPS/useless categorization)
//   - pushStarsWithMonteCarlo
//   - optimizeCampaignMaxStars
//   - optimizeForArena

use break_eternity::Decimal;

use crate::calculator::{
    calculate_battle_attributes, calculate_arena_attributes,
    compute_machine_power, compute_squad_power,
    enemy_attributes, req_power,
    calculate_overdrive, compute_damage_taken,
    FORMATION_SIZE, MILESTONE_SCALE_FACTOR,
    NUM_DIFFICULTIES, MAX_MISSIONS,
};
use crate::battle_engine::BattleEngine;
use crate::types::{
    FlatMachine, HeroDto, ComputedMachine, MachineStats,
    OptimizeConfig, HeroWeights,
    MachineResult, CampaignResult, ArenaResult, DifficultyClears, DecimalDto,
};

fn zero() -> Decimal { Decimal::from_number(0.0) }
fn one()  -> Decimal { Decimal::from_number(1.0) }

// ---------------------------------------------------------------------------
// Build CombatUnit from ComputedMachine
// ---------------------------------------------------------------------------

fn to_combat_unit(m: &ComputedMachine, is_player: bool) -> crate::types::CombatUnit {
    crate::types::CombatUnit {
        damage:    m.battle.damage,
        health:    m.battle.health,
        max_health: m.battle.health,
        armor:     m.battle.armor,
        is_dead:   false,
        ability_effect:      m.flat.ability_effect,
        ability_targeting:   m.flat.ability_targeting,
        ability_num_targets: m.flat.ability_num_targets,
        ability_scale_stat:  m.flat.ability_scale_stat,
        ability_multiplier:  m.flat.ability_multiplier,
        overdrive_chance:    calculate_overdrive(m.flat.rarity_level),
        is_player,
    }
}

// ---------------------------------------------------------------------------
// scoreHeroForMachine  (matches JS Optimizer.scoreHeroForMachine)
// ---------------------------------------------------------------------------

fn score_hero_for_machine(
    hero: &HeroDto,
    is_tank: bool,
    current_stats: &MachineStats,
    is_campaign: bool,
    weights_tank: HeroWeights,
    weights_dps: HeroWeights,
) -> Decimal {
    let weights = if is_tank { weights_tank } else { weights_dps };

    let dmg_score = Decimal::from_number(hero.damage_pct / 100.0 * weights.damage);
    let hp_score  = Decimal::from_number(hero.health_pct / 100.0 * weights.health);
    let arm_score = Decimal::from_number(hero.armor_pct  / 100.0 * weights.armor);
    let base_score = dmg_score + hp_score + arm_score;

    if base_score <= zero() { return zero(); }

    let power = compute_machine_power(current_stats);
    let log_power = if power > zero() {
        Decimal::log10(&power) + one()
    } else {
        one()
    };

    if is_campaign {
        (base_score * log_power).pow(Decimal::from_number(2.0))
    } else {
        base_score * log_power
    }
}

// ---------------------------------------------------------------------------
// calculateAllStats  (matches JS Optimizer.calculateAllStats)
// ---------------------------------------------------------------------------

fn calculate_all_stats(
    machine: &FlatMachine,
    crew: &[HeroDto],
    config: &OptimizeConfig,
) -> (MachineStats, MachineStats) {
    let battle = calculate_battle_attributes(machine, crew, config);

    // Need a temporary FlatMachine-like struct for arena calc
    // calculateArenaAttributes needs baseStats + battleStats
    let arena = calculate_arena_attributes(machine, &battle, config);

    (battle, arena)
}

// ---------------------------------------------------------------------------
// kmAssignment  (matches JS Optimizer.kmAssignment exactly)
//
// Kuhn-Munkres maximum weight perfect matching.
// heroes: slice of heroes to assign
// machine_slots: (machine_idx, slot_idx) pairs — each machine appears max_crew_slots times
// Returns: Vec<Vec<u32>> — for each machine index, list of assigned hero IDs
// ---------------------------------------------------------------------------

fn km_assignment(
    heroes: &[HeroDto],
    machines: &[ComputedMachine],
    max_crew_slots: usize,
    is_campaign: bool,
    weights_tank: HeroWeights,
    weights_dps: HeroWeights,
) -> Vec<Vec<u32>> {
    let n = heroes.len();
    let m = machines.len() * max_crew_slots;
    let size = n.max(m);

    if size == 0 {
        return vec![vec![]; machines.len()];
    }

    // weight[i][j] — 1-indexed like the JS
    // We use a flat Vec for cache efficiency
    let sz1 = size + 1;
    let mut weight = vec![zero(); sz1 * sz1];
    let mut lx = vec![zero(); sz1];
    let mut ly = vec![zero(); sz1];
    let mut match_y = vec![0usize; sz1];
    let mut slack = vec![zero(); sz1];
    let mut pre = vec![0usize; sz1];
    let mut vis_y = vec![false; sz1];

    // Build weights — each slot j maps to a (machine_idx, _slot) pair
    for i in 1..=n {
        for j in 1..=m {
            let machine_idx = (j - 1) / max_crew_slots;
            if machine_idx >= machines.len() { continue; }
            let machine = &machines[machine_idx];
            let is_tank = machine.flat.is_tank;
            let current_stats = if is_campaign { &machine.battle } else { &machine.arena };
            let score = score_hero_for_machine(
                &heroes[i - 1], is_tank, current_stats,
                is_campaign, weights_tank, weights_dps,
            );
            weight[i * sz1 + j] = score;
            if score > lx[i] { lx[i] = score; }
        }
    }

    let epsilon = Decimal::from_number(1e-12);
    let inf = Decimal::from_number(1e300);

    for i in 1..=size {
        // Reset per-augmentation arrays
        for x in 0..sz1 { slack[x] = inf; vis_y[x] = false; pre[x] = 0; }

        let mut cur_y = 0usize;
        match_y[0] = i;

        loop {
            vis_y[cur_y] = true;
            let cur_x = match_y[cur_y];
            let mut delta = inf;
            let mut next_y = 0usize;

            for y in 1..=size {
                if !vis_y[y] {
                    let cur_diff = lx[cur_x] + ly[y] - weight[cur_x * sz1 + y];
                    if cur_diff < slack[y] {
                        slack[y] = cur_diff;
                        pre[y] = cur_y;
                    }
                    if slack[y] < delta {
                        delta = slack[y];
                        next_y = y;
                    }
                }
            }

            if delta < epsilon { delta = zero(); }
            if delta > zero() {
                for j in 0..=size {
                    if vis_y[j] {
                        lx[match_y[j]] = lx[match_y[j]] - delta;
                        ly[j] = ly[j] + delta;
                    } else {
                        slack[j] = slack[j] - delta;
                    }
                }
            }
            cur_y = next_y;
            if match_y[cur_y] == 0 { break; }
        }

        // Augment path
        while cur_y != 0 {
            let prev_y = pre[cur_y];
            match_y[cur_y] = match_y[prev_y];
            cur_y = prev_y;
        }
    }

    // Build result: for each machine, collect assigned hero IDs
    let mut machine_crew: Vec<Vec<u32>> = vec![vec![]; machines.len()];
    for j in 1..=m {
        let hero_idx = if match_y[j] == 0 { continue } else { match_y[j] - 1 };
        if hero_idx >= n { continue; }
        let machine_idx = (j - 1) / max_crew_slots;
        if machine_idx < machines.len() {
            machine_crew[machine_idx].push(heroes[hero_idx].id);
        }
    }
    machine_crew
}

// ---------------------------------------------------------------------------
// optimizeCrewGlobally  (matches JS Optimizer.optimizeCrewGlobally)
// ---------------------------------------------------------------------------

fn optimize_crew_globally(
    machines: &[ComputedMachine],
    heroes_sorted: &[HeroDto],
    config: &OptimizeConfig,
    is_campaign: bool,
) -> Vec<ComputedMachine> {
    if heroes_sorted.is_empty() || machines.is_empty() {
        return machines.to_vec();
    }

    let max_slots = config.max_crew_slots as usize;
    let required = machines.len() * max_slots + 20;
    let heroes_slice = &heroes_sorted[..required.min(heroes_sorted.len())];

    let weights_tank = if is_campaign {
        config.hero_scoring_campaign_tank
    } else {
        config.hero_scoring_arena_tank
    };
    let weights_dps = if is_campaign {
        config.hero_scoring_campaign_dps
    } else {
        config.hero_scoring_arena_dps
    };

    let crew_assignments = km_assignment(
        heroes_slice, machines, max_slots, is_campaign, weights_tank, weights_dps,
    );

    machines.iter().enumerate().map(|(idx, m)| {
        let hero_ids = &crew_assignments[idx];
        let crew: Vec<HeroDto> = hero_ids.iter()
            .filter_map(|&id| heroes_sorted.iter().find(|h| h.id == id).cloned())
            .collect();
        let (battle, arena) = calculate_all_stats(&m.flat, &crew, config);
        ComputedMachine {
            flat: m.flat.clone(),
            crew,
            battle,
            arena,
        }
    }).collect()
}

// ---------------------------------------------------------------------------
// selectBestFive  (matches JS Optimizer.selectBestFive)
// Sorts by level descending, takes top 5, computes stats with empty crew.
// ---------------------------------------------------------------------------

fn select_best_five(
    machines: &[FlatMachine],
    config: &OptimizeConfig,
    _arena: bool,
) -> Vec<ComputedMachine> {
    if machines.is_empty() { return vec![]; }

    let mut indexed: Vec<(usize, &FlatMachine)> = machines.iter().enumerate().collect();
    // JS: sort by level descending
    indexed.sort_by(|a, b| b.1.level.cmp(&a.1.level));

    indexed.iter().take(5).map(|(_, flat)| {
        let (battle, arena) = calculate_all_stats(flat, &[], config);
        ComputedMachine {
            flat: (*flat).clone(),
            crew: vec![],
            battle,
            arena,
        }
    }).collect()
}

// ---------------------------------------------------------------------------
// arrangeByRole  (exact port of JS Optimizer.arrangeByRole)
//
// Categorizes machines into tank/remaining/useless, then sorts and arranges
// using the exact same logic as the JS version.
// ---------------------------------------------------------------------------

fn arrange_by_role(
    team: &[ComputedMachine],
    enemy_stats: &MachineStats,
) -> Vec<ComputedMachine> {
    if team.is_empty() { return vec![]; }

    let mut useless: Vec<&ComputedMachine> = vec![];
    let mut tanks: Vec<&ComputedMachine>   = vec![];
    let mut remaining: Vec<&ComputedMachine> = vec![];

    for m in team {
        if m.flat.is_tank {
            let potential_damage = compute_damage_taken(enemy_stats.damage, m.battle.armor);
            let threshold = m.battle.health * Decimal::from_number(0.4);
            if potential_damage > threshold {
                useless.push(m);
            } else {
                tanks.push(m);
            }
        } else {
            let dmg_dealt = compute_damage_taken(m.battle.damage, enemy_stats.armor);
            if dmg_dealt == zero() {
                useless.push(m);
            } else {
                remaining.push(m);
            }
        }
    }

    // useless: sort by health descending
    useless.sort_by(|a, b| b.battle.health.partial_cmp(&a.battle.health).unwrap_or(std::cmp::Ordering::Equal));

    // tanks: separate goliath, tanks that can hit, tanks that miss
    let mut goliath: Option<&ComputedMachine> = None;
    let mut tanks_can_hit: Vec<&ComputedMachine> = vec![];
    let mut tanks_miss: Vec<&ComputedMachine>    = vec![];

    for tank in &tanks {
        if tank.flat.id == 13 {
            // Goliath has id=13
            goliath = Some(tank);
            continue;
        }
        let dmg_dealt = compute_damage_taken(tank.battle.damage, enemy_stats.armor);
        if dmg_dealt > zero() {
            tanks_can_hit.push(tank);
        } else {
            tanks_miss.push(tank);
        }
    }

    // sort each group by health descending
    let sort_by_health = |a: &&ComputedMachine, b: &&ComputedMachine| {
        b.battle.health.partial_cmp(&a.battle.health).unwrap_or(std::cmp::Ordering::Equal)
    };
    tanks_can_hit.sort_by(sort_by_health);
    tanks_miss.sort_by(sort_by_health);

    // JS: tanks = [...tanksMiss, goliath (if any), ...tanksCanHit]
    let mut ordered_tanks: Vec<&ComputedMachine> = tanks_miss;
    if let Some(g) = goliath { ordered_tanks.push(g); }
    ordered_tanks.extend(tanks_can_hit);

    // remaining: sort by damage ascending (weakest first)
    remaining.sort_by(|a, b| a.battle.damage.partial_cmp(&b.battle.damage).unwrap_or(std::cmp::Ordering::Equal));

    // If exactly 5 machines, pop strongest DPS and insert second-to-last
    let mut strongest_dps: Option<&ComputedMachine> = None;
    if !remaining.is_empty() && team.len() == 5 {
        strongest_dps = remaining.pop();
    }

    // formation = [...useless, ...tanks, ...remaining]
    let mut formation: Vec<ComputedMachine> = useless.iter()
        .chain(ordered_tanks.iter())
        .chain(remaining.iter())
        .map(|m| (*m).clone())
        .collect();

    if let Some(sdps) = strongest_dps {
        let insert_pos = if formation.is_empty() { 0 } else { formation.len() - 1 };
        formation.insert(insert_pos, sdps.clone());
    }

    formation
}

// ---------------------------------------------------------------------------
// Combat unit array from team
// ---------------------------------------------------------------------------

fn team_to_combat_array(
    team: &[ComputedMachine],
) -> ([crate::types::CombatUnit; FORMATION_SIZE], usize) {
    let mut arr = [crate::types::CombatUnit::dead(); FORMATION_SIZE];
    let len = team.len().min(FORMATION_SIZE);
    for (i, m) in team.iter().take(len).enumerate() {
        arr[i] = to_combat_unit(m, true);
    }
    (arr, len)
}

fn enemy_team_array(
    enemy_stats: &MachineStats,
) -> ([crate::types::CombatUnit; FORMATION_SIZE], usize) {
    let mut arr = [crate::types::CombatUnit::dead(); FORMATION_SIZE];
    for i in 0..FORMATION_SIZE {
        arr[i] = crate::types::CombatUnit {
            damage: enemy_stats.damage,
            health: enemy_stats.health,
            max_health: enemy_stats.health,
            armor: enemy_stats.armor,
            is_dead: false,
            ability_effect: 0,
            ability_targeting: 0,
            ability_num_targets: 0,
            ability_scale_stat: 0,
            ability_multiplier: 0.0,
            overdrive_chance: 0.0,
            is_player: false,
        };
    }
    (arr, FORMATION_SIZE)
}

// ---------------------------------------------------------------------------
// pushStarsWithMonteCarlo  (matches JS Optimizer.pushStarsWithMonteCarlo)
// ---------------------------------------------------------------------------

fn push_stars_with_monte_carlo(
    formation: &[ComputedMachine],
    last_cleared: &mut DifficultyClears,
    config: &OptimizeConfig,
    engine: &mut BattleEngine,
) -> u32 {
    if formation.is_empty() { return 0; }

    let mut additional_stars = 0u32;
    let our_power = compute_squad_power(formation, false);

    for diff in 0..NUM_DIFFICULTIES {
        let last_mission = last_cleared.get(diff);

        for mission in (last_mission + 1)..=MAX_MISSIONS {
            let required = req_power(mission, diff);
            if our_power < required { break; }

            let enemy_stats = enemy_attributes(mission, diff, MILESTONE_SCALE_FACTOR);
            let arranged = arrange_by_role(formation, &enemy_stats);
            let (player_arr, player_len) = team_to_combat_array(&arranged);
            let (enemy_arr, enemy_len) = enemy_team_array(&enemy_stats);

            let won = run_monte_carlo(
                engine, &player_arr, player_len, &enemy_arr, enemy_len,
                config.max_battle_rounds(), config.monte_carlo_simulations,
            );

            if won {
                additional_stars += 1;
                last_cleared.set(diff, mission);
            }
        }
    }

    additional_stars
}

fn run_monte_carlo(
    engine: &mut BattleEngine,
    players: &[crate::types::CombatUnit; FORMATION_SIZE],
    player_len: usize,
    enemies: &[crate::types::CombatUnit; FORMATION_SIZE],
    enemy_len: usize,
    max_rounds: u32,
    simulations: u32,
) -> bool {
    for _ in 0..simulations {
        if engine.run_battle(players, player_len, enemies, enemy_len, max_rounds) {
            return true;
        }
    }
    false
}

// ---------------------------------------------------------------------------
// optimizeCampaignMaxStars  (matches JS Optimizer.optimizeCampaignMaxStars)
// ---------------------------------------------------------------------------

pub fn optimize_campaign(
    machines: &[FlatMachine],
    config: &OptimizeConfig,
    heroes_sorted: &[HeroDto],
    engine: &mut BattleEngine,
) -> CampaignResult {
    let empty_result = || CampaignResult {
        total_stars: 0,
        last_cleared: DifficultyClears::zero(),
        formation: vec![],
        battle_power: DecimalDto::zero(),
        arena_power: DecimalDto::zero(),
        mode: "campaign".to_string(),
    };

    if machines.is_empty() { return empty_result(); }

    let max_mission = config.max_mission.min(MAX_MISSIONS);
    let reoptimize_interval = config.reoptimize_interval;

    let mut total_stars = 0u32;
    let mut last_winning_team: Vec<ComputedMachine> = vec![];
    let mut last_cleared = DifficultyClears::zero();

    let mut current_best_team: Option<Vec<ComputedMachine>> = None;
    let mut last_optimized_mission = 0u32;

    for mission in 1..=max_mission {
        let should_reoptimize = current_best_team.is_none()
            || mission - last_optimized_mission >= reoptimize_interval;

        if should_reoptimize {
            let top5 = select_best_five(machines, config, false);
            let optimized = optimize_crew_globally(&top5, heroes_sorted, config, true);
            if optimized.is_empty() { break; }
            current_best_team = Some(optimized);
            last_optimized_mission = mission;
        }

        let team = current_best_team.as_ref().unwrap();
        let mut mission_has_clears = false;

        for diff in 0..NUM_DIFFICULTIES {
            let enemy_stats = enemy_attributes(mission, diff, MILESTONE_SCALE_FACTOR);
            let arranged = arrange_by_role(team, &enemy_stats);

            let required = req_power(mission, diff);
            let our_power = compute_squad_power(&arranged, false);
            if our_power < required { break; }

            let (player_arr, player_len) = team_to_combat_array(&arranged);
            let (enemy_arr, enemy_len) = enemy_team_array(&enemy_stats);

            let result = engine.run_battle(
                &player_arr, player_len,
                &enemy_arr, enemy_len,
                config.max_battle_rounds(),
            );

            if result {
                total_stars += 1;
                mission_has_clears = true;
                last_cleared.set(diff, mission);
                last_winning_team = arranged.iter().map(|m| ComputedMachine {
                    flat: m.flat.clone(),
                    crew: m.crew.clone(),
                    battle: m.battle,
                    arena: m.arena,
                }).collect();
            } else {
                break;
            }
        }

        if !mission_has_clears && mission > 1 { break; }
    }

    // pushStarsWithMonteCarlo
    let additional = push_stars_with_monte_carlo(
        &last_winning_team, &mut last_cleared, config, engine,
    );
    total_stars += additional;

    let battle_power = compute_squad_power(&last_winning_team, false);
    let arena_power  = compute_squad_power(&last_winning_team, true);

    CampaignResult {
        total_stars,
        last_cleared,
        formation: last_winning_team.iter().map(machine_to_result).collect(),
        battle_power: DecimalDto::from_decimal(battle_power),
        arena_power:  DecimalDto::from_decimal(arena_power),
        mode: "campaign".to_string(),
    }
}

// ---------------------------------------------------------------------------
// optimizeForArena  (matches JS Optimizer.optimizeForArena)
// ---------------------------------------------------------------------------

pub fn optimize_arena(
    machines: &[FlatMachine],
    config: &OptimizeConfig,
    heroes_sorted: &[HeroDto],
) -> ArenaResult {
    if machines.is_empty() {
        return ArenaResult {
            formation: vec![],
            arena_power: DecimalDto::zero(),
            battle_power: DecimalDto::zero(),
            mode: "arena".to_string(),
        };
    }

    let top5 = select_best_five(machines, config, true);
    let mut optimized = optimize_crew_globally(&top5, heroes_sorted, config, false);

    // arrangeByRole with mission=1, difficulty=easy (matches JS)
    let enemy_stats = enemy_attributes(1, 0, MILESTONE_SCALE_FACTOR);
    optimized = arrange_by_role(&optimized, &enemy_stats);

    let arena_power  = compute_squad_power(&optimized, true);
    let battle_power = compute_squad_power(&optimized, false);

    ArenaResult {
        formation: optimized.iter().map(machine_to_result).collect(),
        arena_power:  DecimalDto::from_decimal(arena_power),
        battle_power: DecimalDto::from_decimal(battle_power),
        mode: "arena".to_string(),
    }
}

// ---------------------------------------------------------------------------
// Convert ComputedMachine to MachineResult for JS
// ---------------------------------------------------------------------------

fn machine_to_result(m: &ComputedMachine) -> MachineResult {
    MachineResult {
        id: m.flat.id,
        battle_damage:     DecimalDto::from_decimal(m.battle.damage),
        battle_health:     DecimalDto::from_decimal(m.battle.health),
        battle_armor:      DecimalDto::from_decimal(m.battle.armor),
        battle_max_health: DecimalDto::from_decimal(m.battle.health),
        arena_damage:      DecimalDto::from_decimal(m.arena.damage),
        arena_health:      DecimalDto::from_decimal(m.arena.health),
        arena_armor:       DecimalDto::from_decimal(m.arena.armor),
        arena_max_health:  DecimalDto::from_decimal(m.arena.health),
        assigned_hero_ids: m.crew.iter().map(|h| h.id).collect(),
    }
}

// ---------------------------------------------------------------------------
// Helper: max_battle_rounds on config (always the constant)
// ---------------------------------------------------------------------------

impl OptimizeConfig {
    pub fn max_battle_rounds(&self) -> u32 {
        crate::calculator::MAX_BATTLE_ROUNDS
    }
}