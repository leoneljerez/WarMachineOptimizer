// ui/artifacts.js
export function renderArtifacts(artifacts) {
  const container = document.getElementById("artifactsContainer");
  container.replaceChildren();

  const stats = ["damage", "health", "armor"];
  const percentages = [30, 35, 40, 45, 50, 55, 60, 65];

  // Create Bootstrap row
  const row = document.createElement("div");
  row.className = "row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3";

  const fragment = document.createDocumentFragment();

  // Render each stat type as a card
  stats.forEach((stat) => {
    const col = document.createElement("div");
    col.className = "col";

    const card = createArtifactCard(stat, percentages, artifacts);
    col.appendChild(card);
    fragment.appendChild(col);
  });

  row.appendChild(fragment);
  container.appendChild(row);
}

function createArtifactCard(stat, percentages, artifacts) {
  const card = document.createElement("div");
  card.className = "artifact-card p-4 rounded";

  // Header
  const header = document.createElement("div");
  header.className =
    "artifact-card-header d-flex justify-content-between align-items-center";

  const title = document.createElement("h5");
  title.className = "artifact-card-title";
  title.textContent = `${stat.charAt(0).toUpperCase() + stat.slice(1)}`;

  const totalBadge = document.createElement("span");
  totalBadge.className = "badge bg-primary";
  const total = Object.values(artifacts[stat]).reduce(
    (sum, val) => sum + val,
    0
  );
  totalBadge.textContent = `Total: ${total}`;

  header.appendChild(title);
  header.appendChild(totalBadge);

  // Body with input grid
  const body = document.createElement("div");
  body.className = "artifact-inputs pt-4";

  percentages.forEach((pct) => {
    const group = document.createElement("div");
    group.className = "artifact-input-group";

    const inputId = `artifact-${stat}-${pct}`;
    const labelId = `${inputId}-label`;

    const label = document.createElement("label");
    label.textContent = `${pct}%`;
    label.className = "form-label";
    label.htmlFor = inputId;
    label.id = labelId;

    const input = document.createElement("input");
    input.type = "number";
    input.className = "form-control form-control-sm";
    input.id = inputId;
    input.min = 0;
    input.step = 1;
    input.value = artifacts[stat][pct];
    input.setAttribute("aria-labelledby", labelId);

    input.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      artifacts[stat][pct] = isNaN(val) ? 0 : Math.max(0, val);

      // Update total badge
      const newTotal = Object.values(artifacts[stat]).reduce(
        (sum, v) => sum + v,
        0
      );
      totalBadge.textContent = `Total: ${newTotal}`;
    });

    group.appendChild(label);
    group.appendChild(input);
    body.appendChild(group);
  });

  card.appendChild(header);
  card.appendChild(body);

  return card;
}

export function resetAllArtifacts(artifacts) {
  const stats = ["damage", "health", "armor"];
  const percentages = [30, 35, 40, 45, 50, 55, 60, 65];

  stats.forEach((stat) => {
    percentages.forEach((pct) => {
      artifacts[stat][pct] = 0;
    });
  });
}
