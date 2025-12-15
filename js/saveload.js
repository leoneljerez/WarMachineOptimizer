// saveload.js
import { renderArtifacts } from "./ui/artifacts.js";
import { renderHeroes } from "./ui/heroes.js";
import { renderMachines } from "./ui/machines.js";
import { renderTavernCards } from "./ui/tavern.js";
import { showToast } from "./ui/notifications.js";

/**
 * @typedef {Object} SaveData
 * @property {number} engineerLevel
 * @property {number} scarabLevel
 * @property {string} riftRank
 * @property {Array} machines
 * @property {Array} heroes
 * @property {Object} artifacts
 */

/**
 * Validates loaded save data structure
 * @param {SaveData} data - Data to validate
 * @returns {string[]} Array of error messages
 */
function validateSaveData(data) {
	const errors = [];

	if (typeof data.engineerLevel !== "number" || data.engineerLevel < 0) {
		errors.push("Invalid engineerLevel");
	}

	if (typeof data.scarabLevel !== "number" || data.scarabLevel < 0) {
		errors.push("Invalid scarabLevel");
	}

	if (typeof data.riftRank !== "string") {
		errors.push("Invalid riftRank");
	}

	if (!Array.isArray(data.machines)) {
		errors.push("machines must be an array");
	} else {
		data.machines.forEach((machine, idx) => {
			if (machine.id === undefined || machine.id === null) {
				errors.push(`Machine ${idx} missing id`);
			}
			if (typeof machine.rarity !== "string") {
				errors.push(`Machine ${idx} missing valid rarity`);
			}
			if (typeof machine.level !== "number") {
				errors.push(`Machine ${idx} missing valid level`);
			}
			if (!machine.blueprints || typeof machine.blueprints !== "object") {
				errors.push(`Machine ${idx} missing blueprints object`);
			}
		});
	}

	if (!Array.isArray(data.heroes)) {
		errors.push("heroes must be an array");
	} else {
		data.heroes.forEach((hero, idx) => {
			if (hero.id === undefined || hero.id === null) {
				errors.push(`Hero ${idx} missing id`);
			}
			if (!hero.percentages || typeof hero.percentages !== "object") {
				errors.push(`Hero ${idx} missing percentages object`);
			}
		});
	}

	if (!data.artifacts || typeof data.artifacts !== "object") {
		errors.push("artifacts must be an object");
	} else {
		const requiredStats = ["damage", "health", "armor"];
		const requiredPercentages = [30, 35, 40, 45, 50, 55, 60, 65];

		requiredStats.forEach((stat) => {
			if (!data.artifacts[stat]) {
				errors.push(`Missing artifact stat: ${stat}`);
			} else {
				requiredPercentages.forEach((pct) => {
					const value = data.artifacts[stat][pct] ?? data.artifacts[stat][String(pct)];
					if (typeof value !== "number") {
						errors.push(`Invalid artifact value for ${stat} at ${pct}%`);
					}
				});
			}
		});
	}

	return errors;
}

/**
 * Creates a clean save object with only necessary data
 * @param {import('./app.js').Store} store - Application store
 * @returns {SaveData} Save data object
 */
function createSaveData(store) {
	return {
		engineerLevel: store.engineerLevel,
		scarabLevel: store.scarabLevel,
		riftRank: store.riftRank,
		machines: store.machines.map((machine) => ({
			id: machine.id,
			rarity: machine.rarity,
			level: machine.level,
			blueprints: {
				damage: machine.blueprints.damage,
				health: machine.blueprints.health,
				armor: machine.blueprints.armor,
			},
			inscriptionLevel: machine.inscriptionLevel,
			sacredLevel: machine.sacredLevel,
		})),
		heroes: store.heroes.map((hero) => ({
			id: hero.id,
			percentages: {
				damage: hero.percentages.damage,
				health: hero.percentages.health,
				armor: hero.percentages.armor,
			},
		})),
		artifacts: {
			damage: { ...store.artifacts.damage },
			health: { ...store.artifacts.health },
			armor: { ...store.artifacts.armor },
		},
	};
}

/**
 * Applies loaded data to store
 * @param {import('./app.js').Store} store - Application store
 * @param {SaveData} data - Save data to apply
 */
function applyLoadedData(store, data) {
	store.engineerLevel = data.engineerLevel;
	store.scarabLevel = data.scarabLevel;
	store.riftRank = data.riftRank;

	data.machines.forEach((savedMachine) => {
		const machine = store.machines.find((m) => String(m.id) === String(savedMachine.id));
		if (machine) {
			machine.rarity = savedMachine.rarity;
			machine.level = savedMachine.level;
			machine.blueprints.damage = savedMachine.blueprints.damage;
			machine.blueprints.health = savedMachine.blueprints.health;
			machine.blueprints.armor = savedMachine.blueprints.armor;
			machine.inscriptionLevel = savedMachine.inscriptionLevel || 0;
			machine.sacredLevel = savedMachine.sacredLevel || 0;
		}
	});

	data.heroes.forEach((savedHero) => {
		const hero = store.heroes.find((h) => String(h.id) === String(savedHero.id));
		if (hero) {
			hero.percentages.damage = savedHero.percentages.damage;
			hero.percentages.health = savedHero.percentages.health;
			hero.percentages.armor = savedHero.percentages.armor;
		}
	});

	Object.keys(data.artifacts).forEach((stat) => {
		Object.keys(data.artifacts[stat]).forEach((pct) => {
			const numKey = Number(pct);
			if (!isNaN(numKey)) {
				store.artifacts[stat][numKey] = data.artifacts[stat][pct];
			}
		});
	});
}

export const SaveLoad = {
	/**
	 * Saves the current store to JSON
	 * @param {import('./app.js').Store} store - Application store
	 */
	save(store) {
		try {
			const saveData = createSaveData(store);
			const json = JSON.stringify(saveData, null, 2);
			document.getElementById("saveLoadBox").value = json;
			showToast("Data prepared for saving. Copy the JSON from the text box.", "success");
		} catch (error) {
			const wrappedError = new Error("Failed to save data", { cause: error });
			console.error(wrappedError);
			showToast("Failed to save data. Please try again.", "danger");
		}
	},

	/**
	 * Loads JSON data into the store
	 * @param {import('./app.js').Store} store - Application store
	 */
	load(store) {
		const textarea = document.getElementById("saveLoadBox");
		const content = textarea.value.trim();

		if (!content) {
			showToast("Please paste save data into the text box first.", "warning");
			return;
		}

		try {
			const data = JSON.parse(content);

			const errors = validateSaveData(data);
			if (errors.length > 0) {
				const wrappedError = new Error("Invalid save data structure", { cause: errors });
				console.error(wrappedError);
				showToast(`Invalid save data: ${errors[0]}`, "danger");
				return;
			}

			applyLoadedData(store, data);

			document.getElementById("engineerLevel").value = store.engineerLevel;
			document.getElementById("scarabLevel").value = store.scarabLevel;
			document.getElementById("riftRank").value = store.riftRank;

			renderMachines(store.machines);
			renderHeroes(store.heroes);
			renderArtifacts(store.artifacts);
			renderTavernCards(store.machines);

			showToast("Data loaded successfully!", "success");
			textarea.value = "";
		} catch (error) {
			if (error instanceof SyntaxError) {
				const wrappedError = new Error("Invalid JSON format", { cause: error });
				console.error(wrappedError);
				showToast("Invalid JSON format. Please check your save data.", "danger");
			} else {
				const wrappedError = new Error("Failed to load data", { cause: error });
				console.error(wrappedError);
				showToast("Failed to load data. Please try again.", "danger");
			}
		}
	},
};
