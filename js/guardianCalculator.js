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
	 * Gets rank offset from category base
	 * @param {number} rankIndex - Rank index (0-9)
	 * @returns {number} Offset to add to category base
	 */
	static getRankOffset(rankIndex) {
		return rankIndex * 100;
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

		// Bronze stars use lookup table (irregular pattern)
		if (category === "bronze" && rankIndex < 5) {
			const expTable = AppConfig.GUARDIAN_EXP_TABLE?.bronze?.[rank];
			if (!expTable) {
				throw new Error(`No data for Bronze ${rank}`);
			}
			return expTable[level - 1];
		}

		// Bronze crowns and all other categories use formula
		const categoryBase = this.getCategoryBase(category);

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

		const isCrown = toRank.includes("crown");

		// Process ALL star ranks first (bronze through starlight_plus)
		if (!isCrown || targetCategoryIdx < AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.length) {
			// Loop through all categories for stars
			const maxStarCategoryIdx = isCrown ? AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.length - 1 : targetCategoryIdx;

			for (let catIdx = 0; catIdx <= maxStarCategoryIdx; catIdx++) {
				const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
				const isTargetCategory = !isCrown && catIdx === targetCategoryIdx;

				// Process stars (0-4 in GUARDIAN_RANK_PROGRESSION)
				const maxStarIdx = isTargetCategory ? targetRankIdx : 4; // Stars are indices 0-4

				for (let rankIdx = 0; rankIdx <= maxStarIdx; rankIdx++) {
					const rank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx].key;
					const isTargetRank = isTargetCategory && rankIdx === targetRankIdx;

					const maxLevel = isTargetRank ? toLevel : 10;

					for (let level = 1; level < maxLevel; level++) {
						totalExp += this.calculateExpForLevel(category, rank, level);
					}
				}
			}
		}

		// If target is a crown, process crown ranks
		if (isCrown) {
			const crownRankIdx = targetRankIdx - 5; // Crowns start at index 5

			for (let catIdx = 0; catIdx <= targetCategoryIdx; catIdx++) {
				const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
				const isTargetCategory = catIdx === targetCategoryIdx;

				// Process crowns (5-9 in GUARDIAN_RANK_PROGRESSION)
				const maxCrownIdx = isTargetCategory ? crownRankIdx : 4; // 0-4 for crown indices

				for (let rankIdx = 0; rankIdx <= maxCrownIdx; rankIdx++) {
					const rank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx + 5].key; // +5 to get crown indices
					const isTargetRank = isTargetCategory && rankIdx === crownRankIdx;

					const maxLevel = isTargetRank ? toLevel : 10;

					for (let level = 1; level < maxLevel; level++) {
						totalExp += this.calculateExpForLevel(category, rank, level);
					}
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

		const currentIsCrown = current.rank.includes("crown");
		const targetIsCrown = target.rank.includes("crown");

		// If same category and rank, no evolutions needed
		if (currentCategoryIdx === targetCategoryIdx && currentRankIdx === targetRankIdx) {
			return evolutions;
		}

		let catIdx = currentCategoryIdx;
		let rankIdx = currentRankIdx;

		// Phase 1: Complete current star progression (if in stars)
		if (!currentIsCrown) {
			// Continue through stars in current category
			while (rankIdx < 4) {
				// 4 is the index of 5star
				const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
				const fromRank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx];
				const cost = AppConfig.GUARDIAN_EVOLUTION_COSTS[category][fromRank.key];

				rankIdx++;
				const toRank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx];
				evolutions.push({
					from: `${category} ${fromRank.label}`,
					to: `${category} ${toRank.label}`,
					category,
					cost,
				});

				// Check if we've reached target
				if (catIdx === targetCategoryIdx && rankIdx === targetRankIdx) {
					return evolutions;
				}
			}

			// Complete remaining star categories
			catIdx++;
			while (catIdx < AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.length) {
				const prevCategory = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx - 1];
				const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
				const fromRank = AppConfig.GUARDIAN_RANK_PROGRESSION[4]; // 5star
				const toRank = AppConfig.GUARDIAN_RANK_PROGRESSION[0]; // 1star of next category
				const cost = AppConfig.GUARDIAN_EVOLUTION_COSTS[prevCategory][fromRank.key];

				evolutions.push({
					from: `${prevCategory} ${fromRank.label}`,
					to: `${category} ${toRank.label}`,
					category: prevCategory,
					cost,
				});

				// Check if we've reached target
				if (catIdx === targetCategoryIdx && 0 === targetRankIdx) {
					return evolutions;
				}

				// Progress through stars in this category
				rankIdx = 0;
				while (rankIdx < 4) {
					const fromRank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx];
					const cost = AppConfig.GUARDIAN_EVOLUTION_COSTS[category][fromRank.key];

					rankIdx++;
					const toRank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx];
					evolutions.push({
						from: `${category} ${fromRank.label}`,
						to: `${category} ${toRank.label}`,
						category,
						cost,
					});

					// Check if we've reached target
					if (catIdx === targetCategoryIdx && rankIdx === targetRankIdx) {
						return evolutions;
					}
				}

				catIdx++;
			}

			// If target is crowns, transition from 5star starlight_plus to 1crown bronze
			if (targetIsCrown) {
				const prevCategory = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[AppConfig.GUARDIAN_EVOLUTION_CATEGORIES.length - 1];
				const fromRank = AppConfig.GUARDIAN_RANK_PROGRESSION[4]; // 5star
				const toRank = AppConfig.GUARDIAN_RANK_PROGRESSION[5]; // 1crown
				const cost = AppConfig.GUARDIAN_EVOLUTION_COSTS[prevCategory][fromRank.key];

				evolutions.push({
					from: `${prevCategory} ${fromRank.label}`,
					to: `bronze ${toRank.label}`,
					category: prevCategory,
					cost,
				});

				catIdx = 0; // Start at bronze for crowns
				rankIdx = 5; // 1crown
			}
		}

		// Phase 2: Crown progression (if needed)
		if (targetIsCrown && (catIdx < targetCategoryIdx || rankIdx < targetRankIdx)) {
			// Continue through crowns in current category
			while (rankIdx < 9) {
				// 9 is the index of 5crown
				const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
				const fromRank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx];
				const cost = AppConfig.GUARDIAN_EVOLUTION_COSTS[category][fromRank.key];

				rankIdx++;
				const toRank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx];
				evolutions.push({
					from: `${category} ${fromRank.label}`,
					to: `${category} ${toRank.label}`,
					category,
					cost,
				});

				// Check if we've reached target
				if (catIdx === targetCategoryIdx && rankIdx === targetRankIdx) {
					return evolutions;
				}
			}

			// Progress through remaining crown categories
			catIdx++;
			while (catIdx <= targetCategoryIdx) {
				const prevCategory = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx - 1];
				const category = AppConfig.GUARDIAN_EVOLUTION_CATEGORIES[catIdx];
				const fromRank = AppConfig.GUARDIAN_RANK_PROGRESSION[9]; // 5crown
				const toRank = AppConfig.GUARDIAN_RANK_PROGRESSION[5]; // 1crown of next category
				const cost = AppConfig.GUARDIAN_EVOLUTION_COSTS[prevCategory][fromRank.key];

				evolutions.push({
					from: `${prevCategory} ${fromRank.label}`,
					to: `${category} ${toRank.label}`,
					category: prevCategory,
					cost,
				});

				// Check if we've reached target
				if (catIdx === targetCategoryIdx && 5 === targetRankIdx) {
					return evolutions;
				}

				// Progress through crowns in this category
				rankIdx = 5;
				while (rankIdx < targetRankIdx) {
					const fromRank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx];
					const cost = AppConfig.GUARDIAN_EVOLUTION_COSTS[category][fromRank.key];

					rankIdx++;
					const toRank = AppConfig.GUARDIAN_RANK_PROGRESSION[rankIdx];
					evolutions.push({
						from: `${category} ${fromRank.label}`,
						to: `${category} ${toRank.label}`,
						category,
						cost,
					});

					// Check if we've reached target
					if (catIdx === targetCategoryIdx && rankIdx === targetRankIdx) {
						return evolutions;
					}
				}

				catIdx++;
			}
		}

		return evolutions;
	}
}
