// js/optimizerWorker.js
//
// All optimization runs entirely in WASM (Rust).
// JS is responsible only for:
//   1. Serializing owned machines into FlatMachine structs
//   2. Pre-computing artifact bonuses (same formula as JS Calculator)
//   3. Passing OptimizeConfig with all user-configurable values
//   4. Reconstructing full machine objects from the WASM result
//
// Fallback: if WASM fails to load, falls back to the JS Optimizer unchanged.

import Decimal from "./vendor/break_eternity.esm.js";
import { AppConfig } from "./config.js";

// ---------------------------------------------------------------------------
// WASM bootstrap
// ---------------------------------------------------------------------------

let wasmEngine = null;
let wasmFailed = false;

async function ensureWasm() {
	if (wasmEngine || wasmFailed) return;
 
	try {
		// ── Step 1: fetch the JS glue module as text and eval it as a blob ──
		// fetch() goes through the service worker, unlike dynamic import().
		// We convert it to a blob URL so we can import it as a module.
		const jsUrl    = new URL("./wasm/wmo_engine.js", import.meta.url).href;
		const jsResp   = await fetch(jsUrl);
		if (!jsResp.ok) throw new Error(`Failed to fetch wmo_engine.js: ${jsResp.status}`);
 
		const jsText   = await jsResp.text();
		const blob     = new Blob([jsText], { type: "text/javascript" });
		const blobUrl  = URL.createObjectURL(blob);
 
		const { default: init, WmoEngine: WmoEngineClass } = await import(blobUrl);
		URL.revokeObjectURL(blobUrl);
 
		// ── Step 2: fetch the WASM binary as an ArrayBuffer ──────────────────
		// Also goes through the SW. Pass the buffer directly to init() so
		// WebAssembly.instantiate receives bytes rather than a URL — this avoids
		// a second fetch that might bypass the SW.
		const wasmUrl  = new URL("./wasm/wmo_engine_bg.wasm", import.meta.url).href;
		const wasmResp = await fetch(wasmUrl);
		if (!wasmResp.ok) throw new Error(`Failed to fetch wmo_engine_bg.wasm: ${wasmResp.status}`);
 
		const wasmBuffer = await wasmResp.arrayBuffer();
 
		await init({ module_or_path: wasmBuffer });
 
		wasmEngine = new WmoEngineClass(BigInt(Date.now()));
		console.log("[WMO] WASM engine loaded");
	} catch (err) {
		console.warn("[WMO] WASM failed, using JS fallback:", err);
		wasmFailed = true;
	}
}

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = async function (e) {
	try {
		const {
			mode = AppConfig.DEFAULTS.OPTIMIZE_MODE,
			ownedMachines,
			ownedHeroes,
			maxMission = AppConfig.MAX_MISSIONS_PER_DIFFICULTY,
			globalRarityLevels = 0,
			engineerLevel = 0,
			scarabLevel = 0,
			artifactArray = [],
			riftRank = AppConfig.DEFAULTS.RIFT_RANK,
			heroScoring,
		} = e.data;

		await ensureWasm();

		if (wasmFailed || !wasmEngine) {
			// JS fallback — original Optimizer unchanged
			const { Optimizer } = await import("./optimizer.js");
			if (heroScoring) applyHeroScoring(heroScoring);
			const optimizer = new Optimizer({
				ownedMachines,
				heroes: ownedHeroes,
				engineerLevel,
				scarabLevel,
				artifactArray,
				globalRarityLevels,
				riftRank,
			});
			let result;
			if (mode === "arena") {
				result = optimizer.optimizeForArena(ownedMachines);
				result.mode = "arena";
			} else {
				result = optimizer.optimizeCampaignMaxStars({ ownedMachines, maxMission });
				result.mode = "campaign";
			}
			self.postMessage(serializeForTransfer(result));
			return;
		}

		// ---------------------
		// WASM path
		// ---------------------

		const flatMachines = ownedMachines.map(flattenMachine);
		const config = buildConfig({
			engineerLevel,
			scarabLevel,
			globalRarityLevels,
			riftRank,
			artifactArray,
			maxMission,
			heroScoring,
			ownedHeroes,
		});

		let wasmResult;
		if (mode === "arena") {
			wasmResult = wasmEngine.optimize_arena(flatMachines, config);
		} else {
			wasmResult = wasmEngine.optimize_campaign(flatMachines, config);
		}

		const result = reconstructResult(wasmResult, ownedMachines, ownedHeroes);
		self.postMessage(serializeForTransfer(result));
	} catch (err) {
		console.error("[WMO] Worker error:", err);
		self.postMessage({ error: err?.message || String(err) });
	}
};

// ---------------------------------------------------------------------------
// flattenMachine — JS machine object → FlatMachine for WASM
// ---------------------------------------------------------------------------

function flattenMachine(machine) {
	const ab = machine.resolvedAbility ?? machine.ability ?? null;
	const rarity = machine.rarity?.toLowerCase() ?? "common";
	const rarityLevel = AppConfig.getRarityLevel(rarity);

	return {
		id: machine.id,
		is_tank: machine.role === "tank",
		is_healer: machine.role === "healer",

		base_damage: toDecimalDto(machine.baseStats.damage),
		base_health: toDecimalDto(machine.baseStats.health),
		base_armor: toDecimalDto(machine.baseStats.armor),

		level: machine.level ?? 0,
		rarity_level: rarityLevel,
		sacred_level: machine.sacredLevel ?? 0,
		inscription_level: machine.inscriptionLevel ?? 0,

		bp_damage: machine.blueprints?.damage ?? 0,
		bp_health: machine.blueprints?.health ?? 0,
		bp_armor: machine.blueprints?.armor ?? 0,

		ability_effect: ab ? encodeEffect(ab.effect) : 0,
		ability_targeting: ab ? encodeTargeting(ab.targeting) : 0,
		ability_num_targets: ab?.numTargets ?? 0,
		ability_scale_stat: ab ? encodeScaleStat(ab.scaleStat) : 0,
		ability_multiplier: ab?.multiplier ?? 0,
		overdrive_chance: AppConfig.OVERDRIVE_BASE + rarityLevel * AppConfig.OVERDRIVE_PER_RARITY,
	};
}

function encodeEffect(e) {
	return e === "damage" ? 1 : e === "heal" ? 2 : 0;
}
function encodeTargeting(t) {
	return t === "random" ? 0 : t === "all" ? 1 : t === "lowest" ? 2 : t === "last" ? 3 : t === "self" ? 4 : 0;
}
function encodeScaleStat(s) {
	return s === "health" ? 1 : 0;
}

// ---------------------------------------------------------------------------
// buildConfig — assembles OptimizeConfig for WASM
// ---------------------------------------------------------------------------

function buildConfig({ engineerLevel, scarabLevel, globalRarityLevels, riftRank, artifactArray, maxMission, heroScoring, ownedHeroes }) {
	const scoring = {
		campaign_tank: heroScoring?.campaign?.tank ?? AppConfig.HERO_SCORING.CAMPAIGN.TANK,
		campaign_dps: heroScoring?.campaign?.dps ?? AppConfig.HERO_SCORING.CAMPAIGN.DPS,
		arena_tank: heroScoring?.arena?.tank ?? AppConfig.HERO_SCORING.ARENA.TANK,
		arena_dps: heroScoring?.arena?.dps ?? AppConfig.HERO_SCORING.ARENA.DPS,
	};

	// Sort heroes descending by (damage + health) — matches JS optimizeCrewGlobally
	const sortedHeroes = [...(ownedHeroes ?? [])]
		.sort((a, b) => {
			const sumA = (a.percentages?.damage ?? 0) + (a.percentages?.health ?? 0);
			const sumB = (b.percentages?.damage ?? 0) + (b.percentages?.health ?? 0);
			return sumB - sumA;
		})
		.map((h) => ({
			id: h.id,
			damage_pct: h.percentages?.damage ?? 0,
			health_pct: h.percentages?.health ?? 0,
			armor_pct: h.percentages?.armor ?? 0,
		}));

	return {
		engineer_level: engineerLevel,
		scarab_level: scarabLevel,
		global_rarity_levels: globalRarityLevels,
		rift_bonus: AppConfig.getRiftBonus(riftRank),
		max_mission: maxMission,
		monte_carlo_simulations: AppConfig.MONTE_CARLO_SIMULATIONS,
		max_crew_slots: AppConfig.getMaxCrewSlots(engineerLevel),
		reoptimize_interval: AppConfig.REOPTIMIZE_INTERVAL,

		artifact_bonus_damage: computeArtifactBonusFraction(artifactArray, "damage"),
		artifact_bonus_health: computeArtifactBonusFraction(artifactArray, "health"),
		artifact_bonus_armor: computeArtifactBonusFraction(artifactArray, "armor"),

		hero_scoring_campaign_tank: scoring.campaign_tank,
		hero_scoring_campaign_dps: scoring.campaign_dps,
		hero_scoring_arena_tank: scoring.arena_tank,
		hero_scoring_arena_dps: scoring.arena_dps,

		heroes: sortedHeroes,
	};
}

// Matches JS Calculator.computeArtifactBonus — returns (total - 1) as fraction
function computeArtifactBonusFraction(artifactArray, stat) {
	let total = 1.0;
	for (const artifact of artifactArray) {
		if (artifact.stat !== stat || !artifact.values) continue;
		for (const [pctStr, quantity] of Object.entries(artifact.values)) {
			if (!quantity || quantity <= 0) continue;
			total *= Math.pow(1 + Number(pctStr) / 100, quantity);
		}
	}
	return total - 1;
}

// ---------------------------------------------------------------------------
// reconstructResult
//
// WASM returns (snake_case, DTOs for Decimals):
//   campaign: { total_stars, last_cleared: {easy,normal,hard,insane,nightmare},
//               formation: [{id, battle_*, arena_*, assigned_hero_ids}],
//               battle_power, arena_power, mode }
//
// renderResults expects (camelCase, real Decimals):
//   { totalStars, lastCleared: {easy,...}, formation: [machine+battleStats+arenaStats+crew],
//     battlePower: Decimal, arenaPower: Decimal, mode }
// ---------------------------------------------------------------------------

function dtoToDecimal(dto) {
	if (!dto) return new Decimal(0);
	return Decimal.fromComponents(dto.sign, dto.layer, dto.mag);
}

function reconstructResult(wasmResult, ownedMachines, ownedHeroes) {
	const heroMap = new Map((ownedHeroes ?? []).map((h) => [h.id, h]));
	const machineMap = new Map((ownedMachines ?? []).map((m) => [m.id, m]));

	const formation = (wasmResult.formation ?? [])
		.map((r) => {
			const base = machineMap.get(r.id);
			if (!base) return null;

			const crew = (r.assigned_hero_ids ?? []).map((id) => heroMap.get(id)).filter(Boolean);

			return {
				...base,
				crew,
				battleStats: {
					damage: dtoToDecimal(r.battle_damage),
					health: dtoToDecimal(r.battle_health),
					armor: dtoToDecimal(r.battle_armor),
					maxHealth: dtoToDecimal(r.battle_max_health ?? r.battle_health),
				},
				arenaStats: {
					damage: dtoToDecimal(r.arena_damage),
					health: dtoToDecimal(r.arena_health),
					armor: dtoToDecimal(r.arena_armor),
					maxHealth: dtoToDecimal(r.arena_max_health ?? r.arena_health),
				},
			};
		})
		.filter(Boolean);

	const result = {
		formation,
		battlePower: dtoToDecimal(wasmResult.battle_power),
		arenaPower: dtoToDecimal(wasmResult.arena_power),
		mode: wasmResult.mode,
	};

	if (wasmResult.mode === "campaign") {
		result.totalStars = wasmResult.total_stars ?? 0;
		result.lastCleared = wasmResult.last_cleared ?? {};
	}

	return result;
}

// ---------------------------------------------------------------------------
// toDecimalDto
// ---------------------------------------------------------------------------

function toDecimalDto(value) {
	if (value === null || value === undefined) return { sign: 0, layer: 0, mag: 0 };
	if (typeof value === "number") {
		const d = new Decimal(value);
		return { sign: d.sign, layer: d.layer, mag: d.mag };
	}
	if (typeof value === "object" && "mag" in value) {
		return { sign: Number(value.sign), layer: Number(value.layer), mag: Number(value.mag) };
	}
	const d = new Decimal(value);
	return { sign: d.sign, layer: d.layer, mag: d.mag };
}

// ---------------------------------------------------------------------------
// serializeForTransfer — safe for postMessage structured clone
// ---------------------------------------------------------------------------

function isDecimalLike(obj) {
	return obj !== null && typeof obj === "object" && typeof obj.toExponential === "function" && "sign" in obj && "layer" in obj && "mag" in obj;
}

function serializeForTransfer(obj) {
	if (obj === null || obj === undefined) return obj;
	if (typeof obj !== "object") return obj;
	if (isDecimalLike(obj)) {
		return { sign: Number(obj.sign), layer: Number(obj.layer), mag: Number(obj.mag) };
	}
	if (Array.isArray(obj)) return obj.map(serializeForTransfer);
	const out = {};
	for (const key of Object.keys(obj)) {
		const val = obj[key];
		if (typeof val === "function") continue;
		out[key] = serializeForTransfer(val);
	}
	return out;
}

// ---------------------------------------------------------------------------
// applyHeroScoring — for JS fallback path only
// ---------------------------------------------------------------------------

function applyHeroScoring(heroScoring) {
	if (heroScoring?.CAMPAIGN) {
		if (heroScoring.CAMPAIGN.TANK) AppConfig.HERO_SCORING.CAMPAIGN.TANK = heroScoring.CAMPAIGN.TANK;
		if (heroScoring.CAMPAIGN.DPS) AppConfig.HERO_SCORING.CAMPAIGN.DPS = heroScoring.CAMPAIGN.DPS;
	}
	if (heroScoring?.ARENA) {
		if (heroScoring.ARENA.TANK) AppConfig.HERO_SCORING.ARENA.TANK = heroScoring.ARENA.TANK;
		if (heroScoring.ARENA.DPS) AppConfig.HERO_SCORING.ARENA.DPS = heroScoring.ARENA.DPS;
	}
}
