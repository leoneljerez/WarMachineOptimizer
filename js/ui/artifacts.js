// ui/artifacts.js
import { AppConfig } from "../config.js";
import { triggerAutoSave, store } from "../app.js";

/**
 * Renders artifact configuration cards
 * @param {import('../app.js').Artifacts} artifacts - Artifact configuration object
 */
export function renderArtifacts(artifacts) {
    const container = document.getElementById("artifactsContainer");
    const stats = AppConfig.ARTIFACT_STATS;
    const percentages = AppConfig.ARTIFACT_PERCENTAGES;

    const fragment = document.createDocumentFragment();
    
    // Use for loop instead of for...of for better performance
    for (let i = 0; i < stats.length; i++) {
        const col = document.createElement("div");
        col.className = "col";
        col.appendChild(createArtifactCard(stats[i], percentages, artifacts));
        fragment.appendChild(col);
    }

    container.replaceChildren(fragment);
}

/**
 * Creates an artifact card for a specific stat
 * @param {string} stat - Stat type (damage, health, armor)
 * @param {number[]} percentages - Array of percentage tiers
 * @param {import('../app.js').Artifacts} artifacts - Artifact configuration object
 * @returns {HTMLElement} Card element
 */
function createArtifactCard(stat, percentages, artifacts) {
	const card = document.createElement("div");
	card.className = "card h-100 card-hover bg-body-tertiary bg-opacity-25";

	const body = document.createElement("div");
	body.className = "card-body";

	// Title + badge row
	const titleRow = document.createElement("div");
	titleRow.className = "d-flex justify-content-between align-items-center mb-3";

	const title = document.createElement("h5");
	title.className = "card-title mb-0 text-capitalize";
	title.textContent = stat;

	const values = Object.values(artifacts[stat]);
	let total = 0;
	for (let i = 0; i < values.length; i++) {
		total += values[i];
	}
	const totalBadge = document.createElement("span");
	totalBadge.className = "badge bg-primary";
	totalBadge.textContent = `Total: ${total}`;

	titleRow.append(title, totalBadge);
	body.appendChild(titleRow);

	// Input grid: two columns
	const grid = document.createElement("div");
	grid.className = "row g-2";

	for (let i = 0; i < percentages.length; i++) {
		const pct = percentages[i];

		const col = document.createElement("div");
		col.className = "col-6";

		const inputGroup = document.createElement("div");
		inputGroup.className = "input-group input-group-sm";

		const label = document.createElement("span");
		label.className = "input-group-text";
		label.textContent = `${pct}%`;
		label.style.width = "55px";

		const input = document.createElement("input");
		input.type = "number";
		input.min = 0;
		input.step = 1;
		input.value = artifacts[stat][pct];
		input.className = "form-control form-control-sm";

		const inputId = `artifact-${stat}-${pct}`;
		input.id = inputId;
		input.setAttribute("aria-label", `${stat} ${pct}% quantity`);

		input.addEventListener("input", (e) => {
			const val = parseInt(e.target.value, 10);
			artifacts[stat][pct] = isNaN(val) ? 0 : Math.max(0, val);

			const newTotal = Object.values(artifacts[stat]).reduce((sum, v) => sum + v, 0);
			totalBadge.textContent = `Total: ${newTotal}`;

			triggerAutoSave(store);
		});

		inputGroup.append(label, input);
		col.appendChild(inputGroup);
		grid.appendChild(col);
	}

	body.appendChild(grid);
	card.appendChild(body);

	return card;
}

/**
 * Resets all artifact values to 0
 * @param {import('../app.js').Artifacts} artifacts - Artifact configuration object
 */
export function resetAllArtifacts(artifacts) {
	const stats = AppConfig.ARTIFACT_STATS;
	const pcts = AppConfig.ARTIFACT_PERCENTAGES;

	for (let i = 0; i < stats.length; i++) {
		const stat = stats[i];
		const artifactStat = artifacts[stat];

		for (let j = 0; j < pcts.length; j++) {
			artifactStat[pcts[j]] = 0;
		}
	}
}
