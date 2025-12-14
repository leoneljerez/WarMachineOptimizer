// ui/tavern.js

/**
 * Renders the tavern cards with reset buttons
 * @param {Array} machines - Array of machine objects
 */
export function renderTavernCards(machines) {
  const tavernContainer = document.getElementById("tavernCardsContainer");
  const scarabContainer = document.getElementById("scarabCardsContainer");

  tavernContainer.replaceChildren();
  scarabContainer.replaceChildren();

  const sortedMachines = machines.toSorted((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Build Tavern section
  const tavernResetBtn = createResetButton("Reset All Sacred Cards", () => {
    if (confirm("Reset all Sacred Card levels to 0?")) {
      machines.forEach((machine) => (machine.sacredLevel = 0));
      renderTavernCards(machines);
    }
  });

  const tavernGrid = document.createElement("div");
  tavernGrid.className =
    "row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-3";

  const tavernFragment = document.createDocumentFragment();
  sortedMachines.forEach((machine) => {
    const col = document.createElement("div");
    col.className = "col";
    const card = createCardLevelCard(machine, "sacred");
    col.appendChild(card);
    tavernFragment.appendChild(col);
  });
  tavernGrid.appendChild(tavernFragment);

  tavernContainer.appendChild(tavernResetBtn);
  tavernContainer.appendChild(tavernGrid);

  // Build Scarab section
  const scarabResetBtn = createResetButton(
    "Reset All Inscription Cards",
    () => {
      if (confirm("Reset all Inscription Card levels to 0?")) {
        machines.forEach((machine) => (machine.inscriptionLevel = 0));
        renderTavernCards(machines);
      }
    }
  );

  const scarabGrid = document.createElement("div");
  scarabGrid.className =
    "row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-3";

  const scarabFragment = document.createDocumentFragment();
  sortedMachines.forEach((machine) => {
    const col = document.createElement("div");
    col.className = "col";
    const card = createCardLevelCard(machine, "inscription");
    col.appendChild(card);
    scarabFragment.appendChild(col);
  });
  scarabGrid.appendChild(scarabFragment);

  scarabContainer.appendChild(scarabResetBtn);
  scarabContainer.appendChild(scarabGrid);
}

/**
 * Creates a reset button for the section
 * @param {string} text - Button text
 * @param {Function} onClick - Click handler
 * @returns {HTMLElement} Button element
 */
function createResetButton(text, onClick) {
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "d-flex justify-content-end";
  buttonContainer.style.marginBottom = "1rem";

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
 * @param {Object} machine - Machine object
 * @param {string} cardType - "sacred" or "inscription"
 * @returns {HTMLElement} Card element
 */
function createCardLevelCard(machine, cardType) {
  const card = document.createElement("div");
  card.className = "card h-100";

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

  const inputGroup = document.createElement("div");
  inputGroup.className = "input-group input-group-sm mt-auto w-100";

  const label = document.createElement("span");
  label.className = "input-group-text";
  label.textContent = "Level";

  const input = document.createElement("input");
  input.type = "number";
  input.className = "form-control";
  input.min = 0;
  input.step = 1;

  // Get the appropriate property name
  const propertyName =
    cardType === "sacred" ? "sacredLevel" : "inscriptionLevel";
  input.value = machine[propertyName];

  input.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
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
