// ui/heroes.js
import {
  createSection,
  createFormRow,
  createNumberInput,
  createListItem,
  updateListItem,
  createDetailHeader,
} from "./formHelpers.js";

/**
 * Renders the hero list and sets up selection
 * @param {Array} heroes - Array of hero objects
 */
export function renderHeroes(heroes) {
  const list = document.getElementById("heroList");
  const details = document.getElementById("heroDetails");

  list.replaceChildren();
  details.replaceChildren();

  let selectedButton = null;
  const fragment = document.createDocumentFragment();

  heroes.forEach((hero, index) => {
    const updateStats = () => {
      const configured = isConfiguredHero(hero);
      const statsText = formatHeroStats(hero);
      updateListItem(btn, statsText, configured);
    };

    const btn = createListItem({
      image: hero.image,
      name: hero.name,
      statsText: formatHeroStats(hero),
      isConfigured: isConfiguredHero(hero),
      onClick: () => selectHero(hero, btn, updateStats),
    });

    fragment.appendChild(btn);

    if (index === 0) {
      btn.classList.add("active");
      selectedButton = btn;
      queueMicrotask(() => {
        renderHeroDetails(hero, details, updateStats);
      });
    }
  });

  list.appendChild(fragment);

  function selectHero(hero, btn, updateStats) {
    if (selectedButton) {
      selectedButton.classList.remove("active");
    }
    selectedButton = btn;
    btn.classList.add("active");
    renderHeroDetails(hero, details, updateStats);
  }
}

/**
 * Formats hero stats for display
 * @param {Object} hero - Hero object
 * @returns {string} Formatted stats string
 */
function formatHeroStats(hero) {
  return (
    `Dmg ${hero.percentages.damage}% • ` +
    `Hp ${hero.percentages.health}% • ` +
    `Arm ${hero.percentages.armor}%`
  );
}

/**
 * Checks if a hero has non-zero percentages
 * @param {Object} hero - Hero object
 * @returns {boolean} True if configured
 */
function isConfiguredHero(hero) {
  return Object.values(hero.percentages).some((v) => v > 0);
}

/**
 * Renders hero details in the detail pane
 * @param {Object} hero - Hero object
 * @param {HTMLElement} container - Detail container element
 * @param {Function} updateListStats - Callback to update list stats
 */
function renderHeroDetails(hero, container, updateListStats) {
  container.replaceChildren();
  const detailView = createHeroDetailView(hero, updateListStats);
  container.appendChild(detailView);
}

/**
 * Creates the detailed view for a hero
 * @param {Object} hero - Hero object
 * @param {Function} updateListStats - Callback to update list stats
 * @returns {HTMLElement} Detail view container
 */
function createHeroDetailView(hero, updateListStats) {
  const wrapper = document.createElement("div");
  wrapper.className = "hero-detail-view";

  const header = createDetailHeader({
    image: hero.image,
    name: hero.name,
    onReset: () => {
      if (confirm(`Reset ${hero.name} to default values?`)) {
        resetHero(hero);
        wrapper.replaceWith(createHeroDetailView(hero, updateListStats));
        updateListStats();
      }
    },
  });

  const form = document.createElement("form");
  form.className = "hero-form";

  const heroId = `hero-${hero.id}`;

  const percentSection = createSection("Crew Bonus", [
    createFormRow(
      "Damage %",
      createNumberInput(
        hero.percentages,
        "damage",
        updateListStats,
        0,
        1,
        `${heroId}-damage-pct`
      ),
      "col-md-4",
      `${heroId}-damage-pct`
    ),
    createFormRow(
      "Health %",
      createNumberInput(
        hero.percentages,
        "health",
        updateListStats,
        0,
        1,
        `${heroId}-health-pct`
      ),
      "col-md-4",
      `${heroId}-health-pct`
    ),
    createFormRow(
      "Armor %",
      createNumberInput(
        hero.percentages,
        "armor",
        updateListStats,
        0,
        1,
        `${heroId}-armor-pct`
      ),
      "col-md-4",
      `${heroId}-armor-pct`
    ),
  ]);

  form.appendChild(percentSection);
  wrapper.append(header, form);

  return wrapper;
}

/**
 * Resets a hero to default values
 * @param {Object} hero - Hero object
 */
function resetHero(hero) {
  hero.percentages.damage = 0;
  hero.percentages.health = 0;
  hero.percentages.armor = 0;
}
