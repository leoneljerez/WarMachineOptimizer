// ui/upgradeSuggestions.js
import { Calculator } from "../calculator.js";
import { AppConfig } from "../config.js";

/**
 * Renders upgrade paths in the results view
 * @param {import('../upgradeAnalyzer.js').UpgradeAnalysis} analysis - Upgrade analysis
 * @param {HTMLElement} container - Container to render into
 */
export function renderUpgradeSuggestions(analysis, container) {
	if (!analysis) {
		return;
	}

	const section = document.createElement("div");
	section.className = "upgrade-suggestions-section mt-4 mb-5";

	// Header
	const header = createPathsHeader(analysis);
	section.appendChild(header);

	// If no paths found
	if (!analysis.canPass || analysis.paths.length === 0) {
		const warningMsg = createNoSolutionMessage();
		section.appendChild(warningMsg);
		container.appendChild(section);
		return;
	}

	// Paths grid
	const pathsGrid = createPathsGrid(analysis.paths);
	section.appendChild(pathsGrid);

	container.appendChild(section);
}

/**
 * Formats a Decimal as a localized integer string or exponential notation
 * @param {*} decimal - Serialized decimal to format
 * @returns {string} Formatted string
 */
function formatPower(decimal) {
	const value = Calculator.toDecimal(decimal);
	if (value.lessThan(999000000)) {
		return Math.trunc(value.toNumber()).toLocaleString("en-US");
	}
	return value.toExponential(2);
}

/**
 * Creates the header
 * @param {import('../upgradeAnalyzer.js').UpgradeAnalysis} analysis
 * @returns {HTMLElement}
 */
function createPathsHeader(analysis) {
	const header = document.createElement("div");
	header.className = "card mb-3";

	const difficulty = AppConfig.DIFFICULTIES.find((d) => d.key === analysis.nextDifficulty);
	const difficultyColor = "secondary";
	const difficultyLabel = difficulty?.label || analysis.nextDifficulty;

	const cardBody = document.createElement("div");
	cardBody.className = "card-body";

	const titleRow = document.createElement("div");
	titleRow.className = "d-flex justify-content-between align-items-start";

	const titleSection = document.createElement("div");

	const title = document.createElement("h5");
	title.className = "card-title mb-2";

	const icon = document.createElement("i");
	icon.className = "bi bi-arrow-up-circle me-2";

	const titleText = document.createTextNode("Upgrade Paths");
	title.append(icon, titleText);

	const subtitle = document.createElement("p");
	subtitle.className = "text-secondary mb-1";
	subtitle.textContent = "Complete any one of these upgrade paths to pass the next mission";

	const powerInfo = document.createElement("p");
	powerInfo.className = "text-muted small mb-0";
	powerInfo.innerHTML = `<i class="bi bi-info-circle me-1"></i>Target mission selected by the next lowest enemy team power. Upgrade suggestions shown below may be higher than what is actually needed since a low amount of battle simulations are used.`;

	titleSection.append(title, subtitle, powerInfo);

	const badge = document.createElement("span");
	badge.className = `badge bg-${difficultyColor} fs-6`;
	badge.textContent = `${difficultyLabel} ${analysis.nextMission}`;

	titleRow.append(titleSection, badge);
	cardBody.appendChild(titleRow);
	header.appendChild(cardBody);

	return header;
}

/**
 * Creates no solution message
 * @returns {HTMLElement}
 */
function createNoSolutionMessage() {
	const alert = document.createElement("div");
	alert.className = "alert alert-warning";

	const icon = document.createElement("i");
	icon.className = "bi bi-exclamation-triangle-fill me-2";

	const message = document.createTextNode("No reasonable upgrade path found on your top 2 machines. You may need more significant upgrades or different strategies.");

	alert.append(icon, message);
	return alert;
}

/**
 * Creates grid of upgrade paths
 * @param {Array<import('../upgradeAnalyzer.js').UpgradePath>} paths
 * @returns {HTMLElement}
 */
function createPathsGrid(paths) {
	const grid = document.createElement("div");
	grid.className = "row g-3";

	paths.forEach((path) => {
		const col = document.createElement("div");
		col.className = "col-md-6 col-lg-3";

		const card = createPathCard(path);
		col.appendChild(card);
		grid.appendChild(col);
	});

	return grid;
}

/**
 * Creates a single path card
 * @param {import('../upgradeAnalyzer.js').UpgradePath} path
 * @returns {HTMLElement}
 */
function createPathCard(path) {
	const card = document.createElement("div");
	card.className = "card h-100 suggestion-card";

	const cardBody = document.createElement("div");
	cardBody.className = "card-body d-flex flex-column";

	// Title
	const pathTitle = document.createElement("h6");
	pathTitle.className = "card-subtitle mb-3";
	pathTitle.textContent = path.upgrades.length === 1 ? "Single Upgrade" : `${path.upgrades.length} Upgrades`;

	cardBody.appendChild(pathTitle);

	// List each upgrade in the path
	path.upgrades.forEach((upgrade, index) => {
		const upgradeItem = createUpgradeItem(upgrade, index > 0);
		cardBody.appendChild(upgradeItem);
	});

	// Power gain at bottom
	const powerSection = document.createElement("div");
	powerSection.className = "mt-auto pt-3";

	const powerRow = document.createElement("div");
	powerRow.className = "d-flex justify-content-between align-items-center";

	const powerLabel = document.createElement("span");
	powerLabel.className = "small text-secondary";
	powerLabel.textContent = "Total Power Gain:";

	const powerValue = document.createElement("span");
	powerValue.className = "small fw-bold text-success";
	powerValue.textContent = `+${formatPower(path.totalPowerGain)}`;

	powerRow.append(powerLabel, powerValue);
	powerSection.appendChild(powerRow);

	cardBody.appendChild(powerSection);
	card.appendChild(cardBody);

	return card;
}

/**
 * Creates a single upgrade item within a path
 * @param {import('../upgradeAnalyzer.js').SingleUpgrade} upgrade
 * @param {boolean} showSeparator - Whether to show "+" separator
 * @returns {HTMLElement}
 */
function createUpgradeItem(upgrade, showSeparator) {
	const container = document.createElement("div");
	container.className = "mb-3";

	// Separator
	if (showSeparator) {
		const separator = document.createElement("div");
		separator.className = "text-center mb-2";

		const plusIcon = document.createElement("i");
		plusIcon.className = "bi bi-plus-lg text-muted";

		separator.appendChild(plusIcon);
		container.appendChild(separator);
	}

	// Upgrade box
	const upgradeBox = document.createElement("div");
	upgradeBox.className = "upgrade-values";

	// Machine name
	const machineName = document.createElement("div");
	machineName.className = "small fw-semibold mb-2";
	machineName.textContent = upgrade.machineName;

	// Type labels
	const typeLabels = {
		level: "Level",
		damage: "Damage BP",
		health: "Health BP",
		armor: "Armor BP",
	};
	const typeLabel = typeLabels[upgrade.upgradeType] || upgrade.upgradeType;

	const typeName = document.createElement("div");
	typeName.className = "small text-muted mb-2";
	typeName.textContent = typeLabel;

	// Values
	const valuesRow = document.createElement("div");
	valuesRow.className = "d-flex justify-content-between align-items-center";

	const currentSpan = document.createElement("span");
	currentSpan.className = "small";
	currentSpan.textContent = `${upgrade.currentValue}`;

	const arrow = document.createElement("i");
	arrow.className = "bi bi-arrow-right text-warning small";

	const requiredSpan = document.createElement("span");
	requiredSpan.className = "small fw-bold text-warning";
	requiredSpan.textContent = `${upgrade.requiredValue}`;

	valuesRow.append(currentSpan, arrow, requiredSpan);

	upgradeBox.append(machineName, typeName, valuesRow);
	container.appendChild(upgradeBox);

	return container;
}
