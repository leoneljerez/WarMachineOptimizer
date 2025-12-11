export function renderHeroes(heroes) {
  const list = document.getElementById("heroList");
  const details = document.getElementById("heroDetails");

  list.replaceChildren();
  details.replaceChildren();

  let selectedButton = null;

  heroes.forEach((hero, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "list-group-item list-group-item-action d-flex align-items-center gap-2";

    const thumb = document.createElement("img");
    thumb.src = hero.image;
    thumb.alt = hero.name;
    thumb.style.width = "40px";
    thumb.style.height = "40px";
    thumb.style.objectFit = "cover";
    thumb.classList.add("rounded");

    const textWrap = document.createElement("div");
    textWrap.className = "flex-grow-1";

    const name = document.createElement("div");
    name.className = "fw-bold";
    name.textContent = hero.name;

    const stats = document.createElement("div");
    stats.className = "text-secondary small";

    // Check if hero is configured
    const isConfigured = isConfiguredHero(hero);

    const badge = document.createElement("span");
    badge.className = `badge ${
      isConfigured ? "bg-success" : "bg-secondary"
    } ms-2`;
    badge.textContent = isConfigured ? "Configured" : "Default";
    badge.style.fontSize = "0.7rem";

    const updateStats = () => {
      const configured = isConfiguredHero(hero);
      stats.textContent =
        `Dmg ${hero.percentages.damage}% • ` +
        `Hp ${hero.percentages.health}% • ` +
        `Arm ${hero.percentages.armor}%`;
      badge.className = `badge ${
        configured ? "bg-success" : "bg-secondary"
      } ms-2`;
      badge.textContent = configured ? "Configured" : "Default";
    };

    updateStats();

    name.appendChild(badge);
    textWrap.appendChild(name);
    textWrap.appendChild(stats);

    btn.appendChild(thumb);
    btn.appendChild(textWrap);

    btn.addEventListener("click", () => {
      selectHero(hero, btn, updateStats);
    });

    list.appendChild(btn);

    if (index === 0) {
      btn.classList.add("active");
      selectedButton = btn;
      renderHeroDetails(hero, details, updateStats);
    }
  });

  function selectHero(hero, btn, updateStats) {
    if (selectedButton) {
      selectedButton.classList.remove("active");
    }

    selectedButton = btn;
    btn.classList.add("active");

    renderHeroDetails(hero, details, updateStats);
  }
}

function isConfiguredHero(hero) {
  return Object.values(hero.percentages).some((v) => v > 0);
}

function renderHeroDetails(hero, container, updateListStats) {
  container.replaceChildren();

  const detailView = createHeroDetailView(hero, updateListStats);
  container.appendChild(detailView);
}

function createHeroDetailView(hero, updateListStats) {
  const wrapper = document.createElement("div");
  wrapper.className = "hero-detail-view";

  // Header with image and name
  const header = document.createElement("div");
  header.className = "text-center mb-4";

  const img = document.createElement("img");
  img.src = hero.image;
  img.alt = hero.name;
  img.className = "img-fluid rounded";
  img.style.maxWidth = "200px";

  const title = document.createElement("h4");
  title.className = "mt-3 mb-0";
  title.textContent = hero.name;

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn btn-sm btn-outline-danger mt-2";
  resetBtn.textContent = "Reset to Default";
  resetBtn.addEventListener("click", () => {
    if (confirm(`Reset ${hero.name} to default values?`)) {
      resetHero(hero);
      wrapper.replaceWith(createHeroDetailView(hero, updateListStats));
      updateListStats();
    }
  });

  header.appendChild(img);
  header.appendChild(title);
  header.appendChild(resetBtn);

  // Form
  const form = document.createElement("form");
  form.className = "hero-form";

  const percentSection = createSection("Crew Bonus", [
    createFormRow(
      "Damage %",
      createNumberInput(hero.percentages, "damage", updateListStats, 0, 1),
      "col-md-4"
    ),
    createFormRow(
      "Health %",
      createNumberInput(hero.percentages, "health", updateListStats, 0, 1),
      "col-md-4"
    ),
    createFormRow(
      "Armor %",
      createNumberInput(hero.percentages, "armor", updateListStats, 0, 1),
      "col-md-4"
    ),
  ]);

  form.appendChild(percentSection);

  wrapper.appendChild(header);
  wrapper.appendChild(form);

  return wrapper;
}

function createSection(title, rows) {
  const section = document.createElement("div");
  section.className = "mb-4";

  const heading = document.createElement("h5");
  heading.className = "mb-3";
  heading.textContent = title;
  section.appendChild(heading);

  const rowContainer = document.createElement("div");
  rowContainer.className = "row g-3";
  rows.forEach((row) => rowContainer.appendChild(row));
  section.appendChild(rowContainer);

  return section;
}

function createFormRow(label, input, colClass = "col-12") {
  const col = document.createElement("div");
  col.className = colClass;

  const formGroup = document.createElement("div");
  formGroup.className = "form-group";

  const labelEl = document.createElement("label");
  labelEl.className = "form-label";
  labelEl.textContent = label;

  formGroup.appendChild(labelEl);
  formGroup.appendChild(input);
  col.appendChild(formGroup);

  return col;
}

function createNumberInput(obj, key, updateCallback, min = 0, step = 1) {
  const input = document.createElement("input");
  input.type = "number";
  input.className = "form-control";
  input.min = min;
  input.step = step;
  input.value = obj[key];

  input.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    obj[key] = isNaN(val) ? 0 : Math.max(min, val);
    updateCallback();
  });

  return input;
}

function resetHero(hero) {
  hero.percentages.damage = 0;
  hero.percentages.health = 0;
  hero.percentages.armor = 0;
}
