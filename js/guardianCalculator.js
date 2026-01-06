// guardianCalculator.js
import { AppConfig } from "./config.js";

export class GuardianCalculator {
	/**
	 * Gets category base EXP value (for 1-star, level 1)
	 * @param {string} category - Evolution category
	 * @returns {number} Base EXP value
	 */
	static getCategoryBase(category) {
		const bases = {
			bronze: null, // Bronze stars use lookup table
			silver: 5810,
			gold: 6410,
			platinum: 6910,
			ruby: 7410,
			sapphire: 8010,
			pearl: 8610,
			diamond: 9110,
			starlight: 9610,
			starlight_plus: 10210,
		};

		return bases[category];
	}

	/**
	 * Gets rank offset from category base
	 * @param {number} rankIndex - Rank index (0-9)
	 * @returns {number} Offset to add to category base
	 */
	static getRankOffset(rankIndex) {
		// Stars: [0, 100, 300, 400, 500]
		// Crowns: [500, 600, 800, 900, 1000] ?? No information on Wiki about this
		const offsets = [0, 100, 300, 400, 500, 500, 600, 800, 900, 1000];
		return offsets[rankIndex];
	}

	/**
	 * Calculates EXP required for a specific level upgrade
	 * @param {string} category - Evolution category
	 * @param {string} rank - Rank key (1star, 2star, ..., 5crown)
	 * @param {number} level - Starting level (1-9 for level→level+1)
	 * @returns {number} EXP required
	 */
	static calculateExpForLevel(category, rank, level) {
		if (level < 1 || level > 9) {
			throw new Error("Level must be between 1 and 9 (for level→level+1)");
		}

		const rankIndex = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === rank);
		if (rankIndex === -1) {
			throw new Error(`Unknown rank: ${rank}`);
		}

		const isStar = rankIndex < 5;
		//const isCrown = rankIndex >= 5;

		// Bronze stars use lookup table (irregular pattern)
		if (category === "bronze" && isStar) {
			const expTable = AppConfig.GUARDIAN_EXP_TABLE?.bronze?.[rank];
			if (!expTable) {
				throw new Error(`No data for Bronze ${rank}`);
			}
			return expTable[level - 1];
		}

		// Bronze crowns and all other categories use formula
		const categoryBase = this.getCategoryBase(category);
		if (categoryBase === null) {
			// Bronze crowns - use Silver base and treat as Silver pattern
			// Bronze 1-crown = Silver 1-star pattern
			const silverBase = this.getCategoryBase("silver");
			const rankOffset = this.getRankOffset(rankIndex);
			const levelOffset = (level - 1) * 10;
			return silverBase + rankOffset + levelOffset;
		}

		// Standard formula for all other categories
		const rankOffset = this.getRankOffset(rankIndex);
		const levelOffset = (level - 1) * 10;

		return categoryBase + rankOffset + levelOffset;
	}

	/**
	 * Calculates total experience from start to a specific position
	 * @param {string} toCategory - Target evolution category
	 * @param {string} toRank - Target rank
	 * @param {number} toLevel - Target level (1-10)
	 * @returns {number} Total experience needed from level 1, 1-star Bronze
	 */
	static calculateTotalExpToPosition(toCategory, toRank, toLevel) {
		let totalExp = 0;
		const targetCategoryIdx = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.indexOf(toCategory);
		const targetRankIdx = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === toRank);

		if (targetCategoryIdx === -1) {
			throw new Error(`Unknown category: ${toCategory}`);
		}
		if (targetRankIdx === -1) {
			throw new Error(`Unknown rank: ${toRank}`);
		}

		// Loop through all categories up to target
		for (let catIdx = 0; catIdx <= targetCategoryIdx; catIdx++) {
			const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
			const isTargetCategory = catIdx === targetCategoryIdx;

			// Determine which ranks to process in this category
			const maxRankIdx = isTargetCategory ? targetRankIdx : AppConfig.GUARDIAN_RANK_PROGRESSION.length - 1;

			// Loop through ranks
			for (let rankIdx = 0; rankIdx <= maxRankIdx; rankIdx++) {
				const rank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx].key;
				const isTargetRank = isTargetCategory && rankIdx === targetRankIdx;

				// Determine which levels to process
				const maxLevel = isTargetRank ? toLevel : 10;

				// Add exp for levels 1→2, 2→3, ..., up to maxLevel
				for (let level = 1; level < maxLevel; level++) {
					totalExp += this.calculateExpForLevel(category, rank, level);
				}
			}
		}

		return totalExp;
	}

	/**
	 * Calculates experience needed between two positions
	 * @param {Object} current - Current position
	 * @param {string} current.category - Current evolution category
	 * @param {string} current.rank - Current rank
	 * @param {number} current.level - Current level (1-10)
	 * @param {number} current.currentExp - Current exp towards next level
	 * @param {Object} target - Target position
	 * @param {string} target.category - Target evolution category
	 * @param {string} target.rank - Target rank
	 * @param {number} target.level - Target level (1-10)
	 * @returns {Object} { expNeeded, strangeDustNeeded, evolutionsNeeded }
	 */
	static calculateExpNeeded(current, target) {
		// Validate inputs
		if (current.level < 1 || current.level > 10) {
			throw new Error("Current level must be between 1 and 10");
		}
		if (target.level < 1 || target.level > 10) {
			throw new Error("Target level must be between 1 and 10");
		}

		const currentCategoryIdx = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.indexOf(current.category);
		const targetCategoryIdx = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.indexOf(target.category);
		const currentRankIdx = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === current.rank);
		const targetRankIdx = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === target.rank);

		// Check if target is before current
		if (targetCategoryIdx < currentCategoryIdx) {
			return { expNeeded: 0, strangeDustNeeded: 0, evolutionsNeeded: [], error: "You cannot go lower in categories" };
		}
		if (targetCategoryIdx === currentCategoryIdx && targetRankIdx < currentRankIdx) {
			return { expNeeded: 0, strangeDustNeeded: 0, evolutionsNeeded: [], error: "You cannot go lower in ranks" };
		}
		if (targetCategoryIdx === currentCategoryIdx && targetRankIdx === currentRankIdx && target.level < current.level) {
			return { expNeeded: 0, strangeDustNeeded: 0, evolutionsNeeded: [], error: "You cannot go lower in levels" };
		}
		if (targetCategoryIdx === currentCategoryIdx && targetRankIdx === currentRankIdx && target.level === current.level) {
			return { expNeeded: 0, strangeDustNeeded: 0, evolutionsNeeded: [], error: "Already at desired level" };
		}

		// Calculate total exp to both positions
		const totalExpToCurrent = this.calculateTotalExpToPosition(current.category, current.rank, current.level);
		const totalExpToTarget = this.calculateTotalExpToPosition(target.category, target.rank, target.level);

		// Account for current progress
		const expNeeded = totalExpToTarget - totalExpToCurrent - current.currentExp;

		// Calculate Strange Dust needed
		const strangeDustNeeded = Math.ceil(expNeeded / AppConfig.STRANGE_DUST_EXP);

		// Calculate evolutions needed
		const evolutionsNeeded = this.calculateEvolutionsNeeded(current, target);

		return {
			expNeeded: Math.max(0, expNeeded),
			strangeDustNeeded: Math.max(0, strangeDustNeeded * 20),
			evolutionsNeeded,
		};
	}

	/**
	 * Calculates evolution steps needed between current and target
	 * @param {Object} current - Current position
	 * @param {Object} target - Target position
	 * @returns {Array<{from: string, to: string, category: string, cost: number}>} Evolution steps
	 */
	static calculateEvolutionsNeeded(current, target) {
		const evolutions = [];
		const currentCategoryIdx = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.indexOf(current.category);
		const targetCategoryIdx = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.indexOf(target.category);
		const currentRankIdx = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === current.rank);
		const targetRankIdx = AppConfig.GUARDIAN_RANK_PROGRESSION.findIndex((r) => r.key === target.rank);

		// If same category and rank, no evolutions needed
		if (currentCategoryIdx === targetCategoryIdx && currentRankIdx === targetRankIdx) {
			return evolutions;
		}

		// Start from current position
		let catIdx = currentCategoryIdx;
		let rankIdx = currentRankIdx;

		// Loop until we reach target
		while (catIdx < targetCategoryIdx || (catIdx === targetCategoryIdx && rankIdx < targetRankIdx)) {
			const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
			const fromRank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx];
			const cost = AppConfig.GUARDIAN_EVOLUTION_COSTS[category][fromRank.key];

			// Determine next rank
			if (rankIdx < AppConfig.GUARDIAN_RANK_PROGRESSION.length - 1) {
				// Next rank in same category
				rankIdx++;
				const toRank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx];
				evolutions.push({
					from: `${category} ${fromRank.label}`,
					to: `${category} ${toRank.label}`,
					category,
					cost,
				});
			} else {
				// Next category, reset to 1-star
				catIdx++;
				rankIdx = 0;
				const nextCategory = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
				const toRank = AppConfig.GUARDIAN_RANK_PROGRESSION[0];
				evolutions.push({
					from: `${category} ${fromRank.label}`,
					to: `${nextCategory} ${toRank.label}`,
					category,
					cost,
				});
			}
		}

		return evolutions;
	}
}
