// utils/utils.js
import { Calculator } from "../calculator.js";
import { AppConfig } from "../config.js";

// ─────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────

/**
 * Formats a Decimal-like power value for display.
 * Values below 999,000,000 are shown as locale integers.
 * Larger values use 2-digit exponential notation.
 *
 * Previously duplicated in results.js and upgradeSuggestions.js.
 *
 * @param {import('../vendor/break_eternity.esm.js').default|Object} value
 * @returns {string}
 */
export function formatPower(value) {
	const d = Calculator.toDecimal(value);
	return d.lessThan(999_000_000) ? Math.trunc(d.toNumber()).toLocaleString("en-US") : d.toExponential(2);
}

// ─────────────────────────────────────────────
// Entity predicates
// ─────────────────────────────────────────────

/**
 * Returns true when a machine has any non-default configuration.
 * A machine is configured if its level > 0, rarity is not the default,
 * or any blueprint level > 0.
 *
 * Previously duplicated in machines.js and tavern.js.
 *
 * @param {Object} machine
 * @param {string} machine.rarity
 * @param {number} machine.level
 * @param {Object} machine.blueprints
 * @returns {boolean}
 */
export function isConfiguredMachine({ rarity, level, blueprints }) {
	if (level > 0) return true;
	if (rarity.toLowerCase() !== AppConfig.DEFAULTS.RARITY) return true;
	return Object.values(blueprints).some((v) => v > 0);
}

/**
 * Returns true when a hero has any non-zero percentage value.
 *
 * @param {Object} hero
 * @param {Object} hero.percentages
 * @returns {boolean}
 */
export function isConfiguredHero({ percentages }) {
	return Object.values(percentages).some((v) => v > 0);
}
