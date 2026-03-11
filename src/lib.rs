// src/lib.rs
use wasm_bindgen::prelude::*;
use serde_wasm_bindgen::{from_value, to_value};

mod types;
mod calculator;
mod battle_engine;
mod optimizer;

use types::{FlatMachine, OptimizeConfig};
use battle_engine::BattleEngine;
use optimizer::{optimize_campaign, optimize_arena};

fn js_err(msg: &str) -> JsValue {
    JsValue::from_str(msg)
}

#[wasm_bindgen]
pub struct WmoEngine {
    engine: BattleEngine,
}

#[wasm_bindgen]
impl WmoEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u64) -> WmoEngine {

        WmoEngine {
            engine: BattleEngine::new(seed),
        }
    }

    /// Optimize campaign — returns CampaignResult as JS object
    #[wasm_bindgen]
    pub fn optimize_campaign(
        &mut self,
        machines_js: JsValue,
        config_js: JsValue,
    ) -> Result<JsValue, JsValue> {
        let machines: Vec<FlatMachine> = from_value(machines_js)
            .map_err(|e| js_err(&format!("machines deserialize: {e}")))?;
        let config: OptimizeConfig = from_value(config_js)
            .map_err(|e| js_err(&format!("config deserialize: {e}")))?;

        let heroes = config.heroes.clone();
        let result = optimize_campaign(&machines, &config, &heroes, &mut self.engine);

        to_value(&result).map_err(|e| js_err(&format!("serialize result: {e}")))
    }

    /// Optimize arena — returns ArenaResult as JS object
    #[wasm_bindgen]
    pub fn optimize_arena(
        &mut self,
        machines_js: JsValue,
        config_js: JsValue,
    ) -> Result<JsValue, JsValue> {
        let machines: Vec<FlatMachine> = from_value(machines_js)
            .map_err(|e| js_err(&format!("machines deserialize: {e}")))?;
        let config: OptimizeConfig = from_value(config_js)
            .map_err(|e| js_err(&format!("config deserialize: {e}")))?;

        let heroes = config.heroes.clone();
        let result = optimize_arena(&machines, &config, &heroes);

        to_value(&result).map_err(|e| js_err(&format!("serialize result: {e}")))
    }
}