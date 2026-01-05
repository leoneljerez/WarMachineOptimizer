// ui/guardian.js
import { GuardianCalculator } from "../guardianCalculator.js";
//import { AppConfig } from "../config.js";
import { showToast } from "./notifications.js";
import { createGuardianRankSelector, parseGuardianRankValue } from '../utils/ranks.js';

/**
 * Renders the Guardian calculator interface
 */
export function renderGuardianCalculator() {
	const container = document.getElementById("guardianContainer");
	if (!container) return;

	container.replaceChildren();

	const card = document.createElement("div");
	card.className = "card";

	const header = document.createElement("div");
	header.className = "card-header";

	const headerTitle = document.createElement("h5");
	headerTitle.className = "mb-0";
	headerTitle.textContent = "Guardian Experience Calculator";
	header.appendChild(headerTitle);

	const body = document.createElement("div");
	body.className = "card-body";

	// Current Position Section
	const currentSection = createPositionSection("current", "Current Level");

	// Add current exp input
	const currentExpRow = document.createElement("div");
	currentExpRow.className = "col-md-6";

	const currentExpLabel = document.createElement("label");
	currentExpLabel.className = "form-label";
	currentExpLabel.textContent = "Current EXP (towards next level)";
	currentExpLabel.htmlFor = "currentExp";

	const currentExpInput = document.createElement("input");
	currentExpInput.type = "number";
	currentExpInput.className = "form-control";
	currentExpInput.id = "currentExp";
	currentExpInput.min = 0;
	currentExpInput.value = 0;

	currentExpRow.append(currentExpLabel, currentExpInput);
	currentSection.querySelector(".row").appendChild(currentExpRow);

	// Target Position Section
	const targetSection = createPositionSection("target", "Target Level");

	// Calculate Button
	const calculateBtn = document.createElement("button");
	calculateBtn.type = "button";
	calculateBtn.className = "btn btn-primary w-100 mb-3";
	calculateBtn.textContent = "Calculate Strange Dust Needed";
	calculateBtn.addEventListener("click", calculateStrangeDust);

	// Results Section
	const resultsDiv = document.createElement("div");
	resultsDiv.id = "guardianResults";
	resultsDiv.className = "mt-4";

	body.append(currentSection, targetSection, calculateBtn, resultsDiv);
	card.append(header, body);
	container.appendChild(card);
}

/**
 * Creates a position input section (current or target)
 * @param {string} prefix - "current" or "target"
 * @param {string} title - Section title
 * @returns {HTMLElement} Section element
 */
function createPositionSection(prefix, title) {
	const section = document.createElement('div');
	section.className = 'mb-4';

	const heading = document.createElement('h6');
	heading.className = 'mb-3';
	heading.textContent = title;

	const row = document.createElement('div');
	row.className = 'row g-3';

	// Combined Evolution & Rank selector
	const rankCol = document.createElement('div');
	rankCol.className = 'col-md-8';

	const rankLabel = document.createElement('label');
	rankLabel.className = 'form-label';
	rankLabel.textContent = 'Evolution & Rank';
	rankLabel.htmlFor = `${prefix}Rank`;

	const rankSelect = createGuardianRankSelector('bronze', '1star', `${prefix}Rank`);

	rankCol.append(rankLabel, rankSelect);

	// Level input
	const levelCol = document.createElement('div');
	levelCol.className = 'col-md-4';

	const levelLabel = document.createElement('label');
	levelLabel.className = 'form-label';
	levelLabel.textContent = 'Level';
	levelLabel.htmlFor = `${prefix}Level`;

	const levelInput = document.createElement('input');
	levelInput.type = 'number';
	levelInput.className = 'form-control';
	levelInput.id = `${prefix}Level`;
	levelInput.min = 1;
	levelInput.max = 10;
	levelInput.value = 1;

	levelCol.append(levelLabel, levelInput);

	row.append(rankCol, levelCol);
	section.append(heading, row);

	return section;
}

/**
 * Calculates and displays Strange Dust needed
 */
function calculateStrangeDust() {
	try {
		// Get current position
		const currentRankValue = document.getElementById('currentRank').value;
		const currentParsed = parseGuardianRankValue(currentRankValue);
		
		const current = {
			category: currentParsed.evolution,
			rank: currentParsed.rank,
			level: parseInt(document.getElementById('currentLevel').value),
			currentExp: parseInt(document.getElementById('currentExp').value) || 0,
		};

		// Get target position
		const targetRankValue = document.getElementById('targetRank').value;
		const targetParsed = parseGuardianRankValue(targetRankValue);
		
		const target = {
			category: targetParsed.evolution,
			rank: targetParsed.rank,
			level: parseInt(document.getElementById('targetLevel').value),
		};

		// Calculate
		const result = GuardianCalculator.calculateExpNeeded(current, target);

		// Display results
		displayResults(result);

		if (result.error) {
			showToast(result.error, 'warning');
		}
	} catch (error) {
		console.error('Guardian calculation error:', error);
		showToast(`Calculation error: ${error.message}`, 'danger');
	}
}

/**
 * Creates a breakdown box for the summary
 * @param {string} label - Label text
 * @param {number} value - Numeric value
 * @param {string} subtext - Subtext to display
 * @returns {HTMLElement} Breakdown box element
 */
function createBreakdownBox(label, value, subtext) {
	const col = document.createElement("div");
	col.className = "col-md-6";

	const box = document.createElement("div");
	box.className = "border rounded p-3";

	const labelEl = document.createElement("div");
	labelEl.className = "text-secondary small mb-1";
	labelEl.textContent = label;

	const valueEl = document.createElement("div");
	valueEl.className = "fs-4 fw-semibold";
	valueEl.textContent = value.toLocaleString();

	const subtextEl = document.createElement("div");
	subtextEl.className = "text-secondary small";
	subtextEl.textContent = subtext;

	box.append(labelEl, valueEl, subtextEl);
	col.appendChild(box);

	return col;
}

/**
 * Displays calculation results
 * @param {Object} result - Calculation result
 */
function displayResults(result) {
	const container = document.getElementById("guardianResults");
	container.replaceChildren();

	if (result.error) {
		const alert = document.createElement("div");
		alert.className = "alert alert-warning";
		alert.textContent = result.error;
		container.appendChild(alert);
		return;
	}

	// Calculate total Strange Dust (EXP + Evolutions)
	const totalEvolutionCost = result.evolutionsNeeded.reduce((sum, e) => sum + e.cost, 0);
	const totalStrangeDust = result.strangeDustNeeded + totalEvolutionCost;

	// Summary Card
	const summaryCard = document.createElement("div");
	summaryCard.className = "card bg-primary bg-opacity-10";

	const summaryBody = document.createElement("div");
	summaryBody.className = "card-body text-center";

	const summaryTitle = document.createElement("h5");
	summaryTitle.className = "card-title text-primary mb-3";
	summaryTitle.textContent = "Total Strange Dust Needed";

	const dustAmount = document.createElement("div");
	dustAmount.className = "display-3 fw-bold text-primary mb-3";
	dustAmount.textContent = totalStrangeDust.toLocaleString();

	// Breakdown
	const breakdown = document.createElement("div");
	breakdown.className = "row g-3 mt-3";

	// EXP portion
	const expBox = createBreakdownBox("For Experience", result.strangeDustNeeded, `${result.expNeeded.toLocaleString()} EXP`);

	// Evolution portion
	const evolutionLabel = result.evolutionsNeeded.length === 1 ? "evolution" : "evolutions";
	const evoBox = createBreakdownBox("For Evolutions", totalEvolutionCost, `${result.evolutionsNeeded.length} ${evolutionLabel}`);

	breakdown.append(expBox, evoBox);

	summaryBody.append(summaryTitle, dustAmount, breakdown);
	summaryCard.appendChild(summaryBody);
	container.appendChild(summaryCard);
}
