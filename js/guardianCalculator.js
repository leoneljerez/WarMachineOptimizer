// guardianCalculator.js
import { AppConfig } from "./config.js";

/**
 * @typedef {Object} GuardianPosition
 * @property {string} category  - Evolution category key (e.g. "bronze")
 * @property {string} rank      - Rank key (e.g. "3star", "2crown")
 * @property {number} level     - Level within the rank (1–10)
 * @property {number} [currentExp=0] - EXP already accumulated towards the next level
 */

/**
 * @typedef {Object} ExpResult
 * @property {number}   expNeeded         - Total EXP needed to reach target
 * @property {number}   strangeDustNeeded - Strange Dust items required
 * @property {Array<{from: string, to: string, category: string, cost: number}>} evolutionsNeeded
 */

/**
 * Pure calculator for guardian EXP, Strange Dust costs, and evolution paths.
 * All methods are static — no instance state.
 */
export class GuardianCalculator {
	// ─────────────────────────────────────────────
	// EXP per level
	// ─────────────────────────────────────────────

	/**
	 * Returns the category base EXP value (used for the formula path).
	 * Bronze is irregular and uses the lookup table instead.
	 * @param {string} category
	 * @returns {number}
	 */
	static getCategoryBase(category) {
		const bases = {
			bronze: 5310,
			silver: 5810,
			gold: 6410,
			platinum: 6910,
			ruby: 7410,
			sapphire: 7910,
			pearl: 8610,
			diamond: 9110,
			starlight: 9610,
			starlight_plus: 10210,
		};
		return bases[category];
	}

	/**
	 * Returns the rank offset added to the category base.
	 * Each rank step adds 100 to the per-level EXP cost.
	 * @param {number} rankIndex - 0-based index into GUARDIAN_RANK_PROGRESSION
	 * @returns {number}
	 */
	static getRankOffset(rankIndex) {
		return rankIndex * 100;
	}

	/**
	 * Returns the EXP required for one level-up within a rank.
	 * Bronze stars use the lookup table (irregular pattern);
	 * all other combinations use the linear formula.
	 * @param {string} category
	 * @param {string} rank - e.g. "3star" or "2crown"
	 * @param {number} level - Starting level (1–9; level→level+1)
	 * @returns {number}
	 * @throws {Error} If level is out of range or rank/category are unknown
	 */
	static calculateExpForLevel(category, rank, level) {
		if (level < 1 || level > 9) {
			throw new Error(`Level must be 1–9 (for level→level+1), got ${level}`);
		}

		const rankIndex = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === rank);
		if (rankIndex === -1) throw new Error(`Unknown rank: ${rank}`);

		// Bronze stars: irregular pattern → lookup table
		if (category === "bronze" && rankIndex < 5) {
			const expTable = AppConfig.GUARDIAN_EXP_TABLE?.bronze?.[rank];
			if (!expTable) throw new Error(`No EXP table data for Bronze ${rank}`);
			return expTable[level - 1];
		}

		// All other combinations: formula
		return this.getCategoryBase(category) + this.getRankOffset(rankIndex) + (level - 1) * 10;
	}

	// ─────────────────────────────────────────────
	// Cumulative EXP — private phase helpers
	// ─────────────────────────────────────────────

	/**
	 * Sums EXP for all star ranks from the start of `fromCategory` up to
	 * (but not including) `toLevel` of `toRank` in `toCategory`.
	 * Iterates categories from `fromCategoryIdx` to `toCategoryIdx`.
	 *
	 * @param {number} fromCategoryIdx - First category index to include
	 * @param {number} toCategoryIdx   - Last category index to include
	 * @param {number} toRankIdx       - Target rank index (0–4 for stars)
	 * @param {number} toLevel         - Stop before this level in the target rank
	 * @returns {number}
	 * @private
	 */
	static _sumStarExp(fromCategoryIdx, toCategoryIdx, toRankIdx, toLevel) {
		let total = 0;

		for (let catIdx = fromCategoryIdx; catIdx <= toCategoryIdx; catIdx++) {
			const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
			const isTargetCat = catIdx === toCategoryIdx;
			const maxRankIdx = isTargetCat ? toRankIdx : 4; // 4 = index of 5star

			for (let rankIdx = 0; rankIdx <= maxRankIdx; rankIdx++) {
				const rank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx].key;
				const isTargetRank = isTargetCat && rankIdx === toRankIdx;
				const maxLevel = isTargetRank ? toLevel : 10;

				for (let level = 1; level < maxLevel; level++) {
					total += this.calculateExpForLevel(category, rank, level);
				}
			}
		}

		return total;
	}

	/**
	 * Sums EXP for all crown ranks from the start of `fromCategory` up to
	 * (but not including) `toLevel` of `toCrownRankIdx` in `toCategoryIdx`.
	 * Crown rank indices within GUARDIAN_RANK_PROGRESSION start at 5.
	 *
	 * @param {number} fromCategoryIdx  - First category index to include
	 * @param {number} toCategoryIdx    - Last category index to include
	 * @param {number} toCrownRankIdx   - Target crown rank index (0–4, offset +5 for GUARDIAN_RANK_PROGRESSION)
	 * @param {number} toLevel          - Stop before this level in the target rank
	 * @returns {number}
	 * @private
	 */
	static _sumCrownExp(fromCategoryIdx, toCategoryIdx, toCrownRankIdx, toLevel) {
		let total = 0;

		for (let catIdx = fromCategoryIdx; catIdx <= toCategoryIdx; catIdx++) {
			const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
			const isTargetCat = catIdx === toCategoryIdx;
			const maxCrownIdx = isTargetCat ? toCrownRankIdx : 4; // 4 = index of 5crown within crowns

			for (let crownIdx = 0; crownIdx <= maxCrownIdx; crownIdx++) {
				const rank = AppConfig.GUARDIAN_RANK_PROGRESSION[crownIdx + 5].key; // +5: crown offset
				const isTargetRank = isTargetCat && crownIdx === toCrownRankIdx;
				const maxLevel = isTargetRank ? toLevel : 10;

				for (let level = 1; level < maxLevel; level++) {
					total += this.calculateExpForLevel(category, rank, level);
				}
			}
		}

		return total;
	}

	// ─────────────────────────────────────────────
	// Cumulative EXP — public
	// ─────────────────────────────────────────────

	/**
	 * Returns the total EXP from level 1 of Bronze 1-Star to a given position.
	 * @param {string} toCategory
	 * @param {string} toRank
	 * @param {number} toLevel - 1–10
	 * @returns {number}
	 * @throws {Error} If category or rank are unknown
	 */
	static calculateTotalExpToPosition(toCategory, toRank, toLevel) {
		const catIdx = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.indexOf(toCategory);
		const rankIdx = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === toRank);

		if (catIdx === -1) throw new Error(`Unknown category: ${toCategory}`);
		if (rankIdx === -1) throw new Error(`Unknown rank: ${toRank}`);

		const isCrown = toRank.includes("crown");
		let total = 0;

		// Always accumulate all star EXP first
		const lastStarCatIdx = isCrown ? AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.length - 1 : catIdx;
		const lastStarRankIdx = isCrown ? 4 : rankIdx;
		const lastStarLevel = isCrown ? 10 : toLevel;

		total += this._sumStarExp(0, lastStarCatIdx, lastStarRankIdx, lastStarLevel);

		// Then crown EXP if target is a crown rank
		if (isCrown) {
			const crownRankIdx = rankIdx - 5; // crowns start at GUARDIAN_RANK_PROGRESSION index 5
			total += this._sumCrownExp(0, catIdx, crownRankIdx, toLevel);
		}

		return total;
	}

	// ─────────────────────────────────────────────
	// Public API
	// ─────────────────────────────────────────────

	/**
	 * Calculates EXP, Strange Dust, and evolutions needed to reach a target position.
	 * Throws on invalid level ranges; returns a result object with an `error` field
	 * for logical impossibilities (target behind current position).
	 *
	 * Note on error handling: structural errors (invalid level values) throw because
	 * they indicate a programming mistake. Logical errors (going backwards) return a
	 * result with `error` because they are valid user input edge cases.
	 *
	 * @param {GuardianPosition} current
	 * @param {GuardianPosition} target
	 * @returns {ExpResult & {error?: string}}
	 */
	static calculateExpNeeded(current, target) {
		if (current.level < 1 || current.level > 10) throw new Error("Current level must be 1–10");
		if (target.level < 1 || target.level > 10) throw new Error("Target level must be 1–10");

		const currentCatIdx = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.indexOf(current.category);
		const targetCatIdx = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.indexOf(target.category);
		const currentRankIdx = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === current.rank);
		const targetRankIdx = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === target.rank);

		const noProgress = { expNeeded: 0, strangeDustNeeded: 0, evolutionsNeeded: [] };

		if (targetCatIdx < currentCatIdx) return { ...noProgress, error: "You cannot go lower in categories" };
		if (targetCatIdx === currentCatIdx && targetRankIdx < currentRankIdx) return { ...noProgress, error: "You cannot go lower in ranks" };
		if (targetCatIdx === currentCatIdx && targetRankIdx === currentRankIdx && target.level < current.level) return { ...noProgress, error: "You cannot go lower in levels" };
		if (targetCatIdx === currentCatIdx && targetRankIdx === currentRankIdx && target.level === current.level) return { ...noProgress, error: "Already at desired level" };

		const expToCurrent = this.calculateTotalExpToPosition(current.category, current.rank, current.level);
		const expToTarget = this.calculateTotalExpToPosition(target.category, target.rank, target.level);
		const rawExpNeeded = expToTarget - expToCurrent - (current.currentExp || 0);
		const expNeeded = Math.max(0, rawExpNeeded);

		const dustItems = Math.ceil(expNeeded / AppConfig.STRANGE_DUST_EXP);

		return {
			expNeeded,
			strangeDustNeeded: Math.max(0, dustItems * 20),
			evolutionsNeeded: this.calculateEvolutionsNeeded(current, target),
		};
	}

	// ─────────────────────────────────────────────
	// Evolution path — private phase helpers
	// ─────────────────────────────────────────────

	/**
	 * Appends one evolution step to the `evolutions` array and returns true
	 * if the target has been reached (so the caller can early-return).
	 * @param {Array}  evolutions   - Mutable output array
	 * @param {string} fromCategory
	 * @param {number} fromRankIdx
	 * @param {string} toCategory
	 * @param {number} toRankIdx
	 * @param {number} targetCatIdx
	 * @param {number} targetRankIdx
	 * @returns {boolean} True if the target was reached
	 * @private
	 */
	static _addEvolutionStep(evolutions, fromCategory, fromRankIdx, toCategory, toRankIdx, targetCatIdx, targetRankIdx) {
		const fromRank = AppConfig.GUARDIAN_RANK_PROGRESSION[fromRankIdx];
		const toRank = AppConfig.GUARDIAN_RANK_PROGRESSION[toRankIdx];
		const cost = AppConfig.GUARDIAN_EVOLUTION_COSTS[fromCategory][fromRank.key];

		evolutions.push({
			from: `${fromCategory} ${fromRank.label}`,
			to: `${toCategory} ${toRank.label}`,
			category: fromCategory,
			cost,
		});

		const targetCategoryKey = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[targetCatIdx];
		return toCategory === targetCategoryKey && toRankIdx === targetRankIdx;
	}

	/**
	 * Walks through star ranks from (catIdx, rankIdx) through all categories
	 * up to targetCatIdx/targetRankIdx, appending steps to `evolutions`.
	 * Returns early (true) when target is reached.
	 * @private
	 */
	static _walkStarPhase(evolutions, catIdx, rankIdx, targetCatIdx, targetRankIdx) {
		// Complete remaining stars in current category
		while (rankIdx < 4) {
			const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
			const reached = this._addEvolutionStep(evolutions, category, rankIdx, category, rankIdx + 1, targetCatIdx, targetRankIdx);
			rankIdx++;
			if (reached) return { reached: true };
		}

		// Walk through subsequent categories
		catIdx++;
		while (catIdx < AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.length) {
			const prevCategory = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx - 1];
			const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];

			// Evolution from 5star of previous category to 1star of this category
			const crossReached = this._addEvolutionStep(evolutions, prevCategory, 4, category, 0, targetCatIdx, targetRankIdx);
			if (crossReached) return { reached: true };

			// Progress through stars in this category
			rankIdx = 0;
			while (rankIdx < 4) {
				const reached = this._addEvolutionStep(evolutions, category, rankIdx, category, rankIdx + 1, targetCatIdx, targetRankIdx);
				rankIdx++;
				if (reached) return { reached: true };
			}

			catIdx++;
		}

		return { reached: false, catIdx, rankIdx };
	}

	/**
	 * Walks through crown ranks from (catIdx, rankIdx) up to targetCatIdx/targetRankIdx.
	 * Crown rankIdx here is the absolute index into GUARDIAN_RANK_PROGRESSION (5–9).
	 * @private
	 */
	static _walkCrownPhase(evolutions, catIdx, rankIdx, targetCatIdx, targetRankIdx) {
		// Complete crowns in current category
		while (rankIdx < 9) {
			const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
			const reached = this._addEvolutionStep(evolutions, category, rankIdx, category, rankIdx + 1, targetCatIdx, targetRankIdx);
			rankIdx++;
			if (reached) return { reached: true };
		}

		// Walk through subsequent crown categories
		catIdx++;
		while (catIdx <= targetCatIdx) {
			const prevCategory = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx - 1];
			const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];

			// Evolution from 5crown of previous to 1crown of this
			const crossReached = this._addEvolutionStep(evolutions, prevCategory, 9, category, 5, targetCatIdx, targetRankIdx);
			if (crossReached) return { reached: true };

			rankIdx = 5;
			while (rankIdx < targetRankIdx) {
				const reached = this._addEvolutionStep(evolutions, category, rankIdx, category, rankIdx + 1, targetCatIdx, targetRankIdx);
				rankIdx++;
				if (reached) return { reached: true };
			}

			catIdx++;
		}

		return { reached: false };
	}

	// ─────────────────────────────────────────────
	// Evolution path — public
	// ─────────────────────────────────────────────

	/**
	 * Returns the ordered list of evolution steps needed to move from `current`
	 * to `target`. Returns an empty array when no evolutions are required.
	 * @param {GuardianPosition} current
	 * @param {GuardianPosition} target
	 * @returns {Array<{from: string, to: string, category: string, cost: number}>}
	 */
	static calculateEvolutionsNeeded(current, target) {
		const evolutions = [];
		const currentCatIdx = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.indexOf(current.category);
		const targetCatIdx = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.indexOf(target.category);
		const currentRankIdx = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === current.rank);
		const targetRankIdx = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === target.rank);

		if (currentCatIdx === targetCatIdx && currentRankIdx === targetRankIdx) return evolutions;

		const currentIsCrown = current.rank.includes("crown");
		const targetIsCrown = target.rank.includes("crown");

		// Phase 1: Star progression (only when current position is in stars)
		if (!currentIsCrown) {
			const starResult = this._walkStarPhase(evolutions, currentCatIdx, currentRankIdx, targetCatIdx, targetRankIdx);
			if (starResult.reached) return evolutions;

			// If target is crowns, bridge from last star category to first crown
			if (targetIsCrown) {
				const lastCat = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.length - 1];
				const bronzeName = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[0];
				const from5star = AppConfig.GUARDIAN_RANK_PROGRESSION[4];
				const to1crown = AppConfig.GUARDIAN_RANK_PROGRESSION[5];

				evolutions.push({
					from: `${lastCat} ${from5star.label}`,
					to: `${bronzeName} ${to1crown.label}`,
					category: lastCat,
					cost: AppConfig.GUARDIAN_EVOLUTION_COSTS[lastCat][from5star.key],
				});
			}
		}

		// Phase 2: Crown progression (only when target is a crown rank)
		if (targetIsCrown) {
			const crownStartCatIdx = currentIsCrown ? currentCatIdx : 0;
			const crownStartRankIdx = currentIsCrown ? currentRankIdx : 5; // 5 = 1crown index

			const crownResult = this._walkCrownPhase(evolutions, crownStartCatIdx, crownStartRankIdx, targetCatIdx, targetRankIdx);
			if (crownResult.reached) return evolutions;
		}

		return evolutions;
	}
}
