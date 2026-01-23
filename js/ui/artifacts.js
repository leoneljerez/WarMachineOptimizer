// ui/artifacts.js
import { AppConfig } from "../config.js";
import { triggerAutoSave, store } from "../app.js";

const container = document.getElementById("artifactsContainer");
const STAT_PERCENTAGES = AppConfig.ARTIFACT_PERCENTAGES;
const ARTIFACT_STATS = AppConfig.ARTIFACT_STATS;

// Cache badge elements globally for O(1) lookup
const badgeCache = new Map();

// Single event delegation handler - set up once
if (container) {
	container.addEventListener("input", handleArtifactInput);
}

/**
 * Handles all artifact input changes via delegation
 * @param {Event} e - Input event
 */
function handleArtifactInput(e) {
	const input = e.target;
	if (input.type !== "number") return;

	const val = input.value | 0;
	const stat = input.dataset.stat;
	const pct = input.dataset.pct;

	const artifactData = store.artifacts[stat];
	const oldVal = input.dataset.last | 0;
	const newVal = val < 0 ? 0 : val;

	artifactData[pct] = newVal;

	const delta = newVal - oldVal;
	if (delta !== 0) {
		const badge = badgeCache.get(stat);
		badge._total += delta;
		badge.textContent = `Total: ${badge._total}`;
		input.dataset.last = newVal;
	}

	triggerAutoSave(store);
}

/**
 * Renders artifact configuration cards for all stat types
 * @param {Object} artifacts - Artifact configuration object containing stat data
 * @param {Object} artifacts.damage - Damage artifact percentage values
 * @param {Object} artifacts.health - Health artifact percentage values
 * @param {Object} artifacts.armor - Armor artifact percentage values
 */
export function renderArtifacts(artifacts) {
	const fragment = document.createDocumentFragment();
	const statsLen = ARTIFACT_STATS.length;

	for (let i = 0; i < statsLen; i++) {
		const col = document.createElement("div");
		col.className = "col";
		col.appendChild(createArtifactCard(ARTIFACT_STATS[i], STAT_PERCENTAGES, artifacts));
		fragment.appendChild(col);
	}

	container.replaceChildren(fragment);
}

/**
 * Creates an artifact card for a specific stat type
 * @param {string} stat - Stat type (damage, health, armor)
 * @param {number[]} percentages - Array of percentage tiers (e.g., [20, 40, 60, 80, 100])
 * @param {Object} artifacts - Artifact configuration object
 * @returns {HTMLElement} Card element containing stat inputs and total badge
 */
function createArtifactCard(stat, percentages, artifacts) {
	const card = document.createElement("div");
	card.className = "card h-100 card-hover bg-body-tertiary bg-opacity-25";

	const cardBody = document.createElement("div");
	cardBody.className = "card-body";

	const header = document.createElement("div");
	header.className = "d-flex justify-content-between align-items-center mb-3";

	const title = document.createElement("h5");
	title.className = "card-title mb-0 text-capitalize";
	title.textContent = stat;

	const badge = document.createElement("span");
	badge.className = "badge bg-primary";

	header.append(title, badge);
	cardBody.appendChild(header);

	const row = document.createElement("div");
	row.className = "row g-2";

	const data = artifacts[stat];
	let initialTotal = 0;
	const pctLen = percentages.length;

	for (let i = 0; i < pctLen; i++) {
		const pct = percentages[i];
		const val = data[pct] | 0;
		initialTotal += val;

		const col = document.createElement("div");
		col.className = "col-6";

		const inputGroup = document.createElement("div");
		inputGroup.className = "input-group input-group-sm";

		const span = document.createElement("span");
		span.className = "input-group-text";
		span.style.width = "55px";
		span.textContent = pct + "%";

		const inputId = `art-${stat}-${pct}`;
		span.id = `label-${inputId}`;

		const input = document.createElement("input");
		input.type = "number";
		input.className = "form-control form-control-sm";
		input.value = val;
		input.min = 0;
		input.dataset.stat = stat;
		input.dataset.pct = pct;
		input.dataset.last = val;
		input.id = inputId;

		input.setAttribute("aria-labelledby", span.id);
		input.setAttribute("aria-label", stat + " " + pct + "%");

		inputGroup.append(span, input);
		col.appendChild(inputGroup);
		row.appendChild(col);
	}

	badge._total = initialTotal;
	badge.textContent = `Total: ${initialTotal}`;
	badgeCache.set(stat, badge);

	cardBody.appendChild(row);
	card.appendChild(cardBody);
	return card;
}

/**
 * Resets all artifact values to 0 across all stat types
 * @param {Object} artifacts - Artifact configuration object to reset
 */
export function resetAllArtifacts(artifacts) {
	const statsLen = ARTIFACT_STATS.length;
	const pctLen = STAT_PERCENTAGES.length;

	for (let i = 0; i < statsLen; i++) {
		const stat = ARTIFACT_STATS[i];
		const statObj = artifacts[stat];

		for (let j = 0; j < pctLen; j++) {
			const pct = STAT_PERCENTAGES[j];
			statObj[pct] = 0;

			const input = document.getElementById(`art-${stat}-${pct}`);
			if (input) {
				input.value = 0;
				input.dataset.last = 0;
			}
		}

		const badge = badgeCache.get(stat);
		if (badge) {
			badge._total = 0;
			badge.textContent = "Total: 0";
		}
	}
	triggerAutoSave(store);
}
