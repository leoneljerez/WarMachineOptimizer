// ui/tavern.js

/**
 * Renders the tavern cards with reset buttons
 * @param {import('../app.js').Machine[]} machines - Array of machine objects
 */
export function renderTavernCards(machines) {
	const sections = [
		{
			containerId: "tavernCardsContainer",
			type: "sacred",
			resetText: "Reset All Sacred Cards",
			property: "sacredLevel",
		},
		{
			containerId: "scarabCardsContainer",
			type: "inscription",
			resetText: "Reset All Inscription Cards",
			property: "inscriptionLevel",
		},
	];

	const sortedMachines = machines.toSorted((a, b) => a.name.localeCompare(b.name));

	sections.forEach(({ containerId, type, resetText, property }) => {
		const container = document.getElementById(containerId);
		container.replaceChildren();

		const resetBtn = createResetButton(resetText, () => {
			if (confirm(`${resetText} to 0?`)) {
				machines.forEach((m) => (m[property] = 0));
				renderTavernCards(machines);
			}
		});

		const grid = document.createElement("div");
		grid.className = `row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-3 ${type}-view`;

		const fragment = document.createDocumentFragment();
		sortedMachines.forEach((machine) => {
			const col = document.createElement("div");
			col.className = "col";
			col.appendChild(createCardLevelCard(machine, type));
			fragment.appendChild(col);
		});
		grid.appendChild(fragment);

		container.append(resetBtn, grid);
	});
}

/**
 * Creates a reset button for the section
 * @param {string} text - Button text
 * @param {Function} onClick - Click handler
 * @returns {HTMLElement} Button element
 */
function createResetButton(text, onClick) {
	const buttonContainer = document.createElement("div");
	buttonContainer.className = "d-flex justify-content-end mb-3";

	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn btn-sm btn-outline-danger";
	button.textContent = text;
	button.addEventListener("click", onClick);

	buttonContainer.appendChild(button);
	return buttonContainer;
}

/**
 * Creates a card for managing a machine's card level
 * @param {import('../app.js').Machine} machine - Machine object
 * @param {string} cardType - "sacred" or "inscription"
 * @returns {HTMLElement} Card element
 */
function createCardLevelCard(machine, cardType) {
	const card = document.createElement("div");
	card.className = "card h-100 card-hover";

	const cardBody = document.createElement("div");
	cardBody.className = "card-body d-flex flex-column align-items-center";

	const img = document.createElement("img");
	img.src = machine.image;
	img.alt = machine.name;
	img.className = "rounded mb-2";
	img.style.cssText = "width: 80px; height: 80px; object-fit: cover;";

	const title = document.createElement("h6");
	title.className = "card-title text-center mb-3";
	title.textContent = machine.name;

	const inputId = `${cardType}-card-machine-${machine.id}`;

	const inputGroup = document.createElement("div");
	inputGroup.className = "input-group input-group-sm mt-auto w-100";

	const label = document.createElement("label");
	label.className = "input-group-text";
	label.textContent = "Card Level";
	label.htmlFor = inputId;

	const input = document.createElement("input");
	input.type = "number";
	input.className = "form-control";
	input.id = inputId;
	input.min = 0;
	input.step = 1;
	input.setAttribute("aria-label", `${machine.name} ${cardType} card level`);

	const propertyName = cardType === "sacred" ? "sacredLevel" : "inscriptionLevel";
	input.value = machine[propertyName];

	input.addEventListener("input", (e) => {
		const val = parseInt(e.target.value, 10);
		machine[propertyName] = isNaN(val) ? 0 : Math.max(0, val);
	});

	inputGroup.appendChild(label);
	inputGroup.appendChild(input);

	cardBody.appendChild(img);
	cardBody.appendChild(title);
	cardBody.appendChild(inputGroup);
	card.appendChild(cardBody);

	return card;
}
