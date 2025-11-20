// main.js

import { BattleEngine } from "./battleengine.js";
import { Optimizer } from "./optimizer.js";
import { Calculator } from "./calculator.js";
import { machinesData } from "./data/machines.js";
import { heroesData } from "./data/heroes.js";
import { abilitiesData } from "./data/abilities.js";

// ---------------------------
// DOM cache & helper utilities
// ---------------------------
const dom = {
    engineer: document.getElementById("engineer-level"),
    scarab: document.getElementById("scarab-level"),
    machineContainer: document.getElementById("machineContainer"),
    heroContainer: document.getElementById("heroContainer"),
    artifactContainer: document.getElementById("artifactContainer"),
    optimizeBtn: document.getElementById("optimizeBtn"),
    setupCode: document.getElementById("setupCode"),
    loadSetupBtn: document.getElementById("loadSetupBtn"),
    optimizerOutput: document.getElementById("optimizerOutput"),
    saveLoadPanel: document.getElementById("saveLoadPanel")
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ---------------------------
// Cached input references
// ---------------------------
let heroInputsCache = {};
let machineInputsCache = {};
let artifactInputsCache = {};

const heroInput = (id, type) => heroInputsCache[id]?.[type];
const machineInput = (id, type) => machineInputsCache[id]?.[type];
const artifactInput = (stat, percent) => artifactInputsCache[`${stat}_${percent}`];

// ---------------------------
// Toast helpers
// ---------------------------
function createToastContainer() {
    if (document.getElementById("toastContainer")) return;
    const container = document.createElement("div");
    container.id = "toastContainer";
    Object.assign(container.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: "9999",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        pointerEvents: "none"
    });
    document.body.appendChild(container);
}

function showToast(message, type = "info") {
    createToastContainer();
    const toast = document.createElement("div");
    toast.textContent = message;
    Object.assign(toast.style, {
        color: "white",
        padding: "10px 16px",
        borderRadius: "8px",
        fontSize: "14px",
        fontFamily: "inherit",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        opacity: "0",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        transform: "translateY(10px)",
        pointerEvents: "auto"
    });

    const colors = {
        success: "rgba(46, 204, 113, 0.95)",
        error: "rgba(231, 76, 60, 0.95)",
        warning: "rgba(241, 196, 15, 0.95)",
        info: "rgba(52, 152, 219, 0.95)"
    };
    toast.style.background = colors[type] || colors.info;

    document.getElementById("toastContainer").appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    });

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, 2600);
}

// ---------------------------
// Build Inputs
// ---------------------------
function buildHeroInputs(heroList) {
    heroInputsCache = {};
    const fragment = document.createDocumentFragment();
    heroList.forEach(hero => {
        const div = document.createElement("div");
        div.className = "card mb-2 p-2";
        div.innerHTML = `
            <div class="row g-2 align-items-center">
                <div class="col-md-3 d-flex align-items-center">
                    <img src="${hero.image}" style="width:50px;height:50px;object-fit:cover;margin-right:5px;">
                    <strong>${hero.name}</strong>
                </div>
                <div class="col"><label>Damage Bonus (%)</label><input type="number" min="0" class="form-control form-control-sm hero-dmg" data-id="${hero.id}"></div>
                <div class="col"><label>Health Bonus (%)</label><input type="number" min="0" class="form-control form-control-sm hero-hp" data-id="${hero.id}"></div>
                <div class="col"><label>Armor Bonus (%)</label><input type="number" min="0" class="form-control form-control-sm hero-arm" data-id="${hero.id}"></div>
            </div>`;
        fragment.appendChild(div);
        heroInputsCache[hero.id] = {
            dmg: div.querySelector(".hero-dmg"),
            hp: div.querySelector(".hero-hp"),
            arm: div.querySelector(".hero-arm")
        };
    });
    dom.heroContainer.innerHTML = "";
    dom.heroContainer.appendChild(fragment);
}

function buildMachineInputs(machineList) {
    machineInputsCache = {};
    const rarities = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "titan", "angel", "celestial"];
    const fragment = document.createDocumentFragment();

    machineList.forEach(machine => {
        const div = document.createElement("div");
        div.className = "card mb-2 p-2";
        div.innerHTML = `
            <div class="row g-2 align-items-center">
                <div class="col-md-3 d-flex align-items-center">
                    <img src="${machine.image}" style="width:50px;height:50px;object-fit:cover;margin-right:5px;">
                    <strong>${machine.name}</strong>
                </div>
                <div class="col"><label>Level</label><input type="number" min="1" class="form-control form-control-sm machine-level" data-id="${machine.id}"></div>
                <div class="col"><label>Damage BP</label><input type="number" min="0" class="form-control form-control-sm machine-dmgBP" data-id="${machine.id}"></div>
                <div class="col"><label>Health BP</label><input type="number" min="0" class="form-control form-control-sm machine-hpBP" data-id="${machine.id}"></div>
                <div class="col"><label>Armor BP</label><input type="number" min="0" class="form-control form-control-sm machine-armBP" data-id="${machine.id}"></div>
                <div class="col"><label>Sacred Level</label><input type="number" min="0" class="form-control form-control-sm machine-sacred" data-id="${machine.id}"></div>
                <div class="col"><label>Inscription Level</label><input type="number" min="0" class="form-control form-control-sm machine-inscription" data-id="${machine.id}"></div>
                <div class="col"><label>Rarity</label><select class="form-select form-select-sm machine-rarity" data-id="${machine.id}">
                    ${rarities.map(r => `<option value="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('')}
                </select></div>
            </div>`;
        fragment.appendChild(div);
        machineInputsCache[machine.id] = {
            level: div.querySelector(".machine-level"),
            dmgBP: div.querySelector(".machine-dmgBP"),
            hpBP: div.querySelector(".machine-hpBP"),
            armBP: div.querySelector(".machine-armBP"),
            sacred: div.querySelector(".machine-sacred"),
            inscription: div.querySelector(".machine-inscription"),
            rarity: div.querySelector(".machine-rarity")
        };
    });
    dom.machineContainer.innerHTML = "";
    dom.machineContainer.appendChild(fragment);
}

function buildArtifactInputs() {
    artifactInputsCache = {};
    const values = [30, 35, 40, 45, 50, 55, 60, 65];

    const fragment = document.createDocumentFragment();
    const div = document.createElement("div");
    div.className = "card mb-3";
    div.innerHTML = `
    <div class="card-body">
        <div class="table-responsive">
        <table class="table table-sm table-bordered table-striped-columns text-center mb-0">
            <thead>
            <tr>
                <th>Stat</th>
                ${values.map(v => `<th>${v}%</th>`).join('')}
            </tr>
            </thead>
            <tbody>
            ${["damage", "health", "armor"].map(stat => `<tr>
                <td>${stat.charAt(0).toUpperCase() + stat.slice(1)}</td>
                ${values.map(v => `<td><input type="number" min="0" class="form-control form-control-sm artifact" data-stat="${stat}" data-percent="${v}"></td>`).join('')}
            </tr>`).join('')}
            </tbody>
        </table>
        </div>
    </div>`;
    fragment.appendChild(div);
    dom.artifactContainer.innerHTML = "";
    dom.artifactContainer.appendChild(fragment);

    $$(".artifact", div).forEach(inp => {
        artifactInputsCache[`${inp.dataset.stat}_${inp.dataset.percent}`] = inp;
    });
}

// ---------------------------
// Read helpers & parsers
// ---------------------------
function readLevel(id, defaultValue = 1) {
    const el = dom[id] ?? document.getElementById(id);
    return parseNumberInput(el, { min: 1, defaultValue });
}
function parseNumberInput(el, { min = 0, max = Infinity, defaultValue = 0, isFloat = false } = {}) {
    if (!el) return defaultValue;
    let val = isFloat ? parseFloat(el.value) : parseInt(el.value, 10);
    if (isNaN(val)) val = defaultValue;
    val = Math.max(min, Math.min(val, max));
    return val;
}

function abbreviate(num) {
    if (num === 0) return "0";
    const units = ["", "K", "M", "B", "T", "Q"];
    let tier = 0;
    let value = num;
    while (value >= 1000 && tier < units.length - 1) { value /= 1000; tier++; }
    return value.toFixed(2).replace(/\.00$/, '') + units[tier];
}

function getMachineInput(machineId) {
    const inputs = machineInputsCache[machineId];
    if (!inputs) return null; // machine not owned

    // Check if all numeric fields are empty
    const level = parseNumberInput(inputs.level, { min: 1, defaultValue: null });
    const dmgBP = parseNumberInput(inputs.dmgBP, { min: 0, defaultValue: null });
    const hpBP = parseNumberInput(inputs.hpBP, { min: 0, defaultValue: null });
    const armBP = parseNumberInput(inputs.armBP, { min: 0, defaultValue: null });
    const sacred = parseNumberInput(inputs.sacred, { min: 0, defaultValue: null });
    const inscription = parseNumberInput(inputs.inscription, { min: 0, defaultValue: null });
    const rarity = inputs.rarity?.value || null;

    // If all fields are null/empty or rarity is default "common", treat as not owned
    if (
        level === null &&
        dmgBP === null &&
        hpBP === null &&
        armBP === null &&
        sacred === null &&
        inscription === null &&
        (!rarity || rarity === "common")
    ) return null;

    return {
        level: level || 1, dmgBP: dmgBP || 0, hpBP: hpBP || 0, armBP: armBP || 0,
        sacred: sacred || 0, inscription: inscription || 0, rarity: rarity || "common"
    };
}

function getHeroInput(heroId) {
    const inputs = heroInputsCache[heroId];
    if (!inputs) return { dmg: 0, hp: 0, arm: 0 };

    return {
        dmg: parseNumberInput(inputs.dmg, { min: 0, isFloat: true }),
        hp: parseNumberInput(inputs.hp, { min: 0, isFloat: true }),
        arm: parseNumberInput(inputs.arm, { min: 0, isFloat: true })
    };
}

function getArtifactInputs() {
    const artifacts = [];
    Object.entries(artifactInputsCache).forEach(([key, el]) => {
        const quantity = parseNumberInput(el, { min: 0 });
        if (quantity > 0) {
            const [stat, percent] = key.split("_");
            artifacts.push({ stat, percent: parseFloat(percent), quantity });
        }
    });
    return artifacts;
}

function getOwnedHeroes(heroList) {
    return heroList
        .map(hero => {
            const { dmg, hp, arm } = getHeroInput(hero.id);
            // Only include heroes with at least one non-zero bonus
            if (dmg === 0 && hp === 0 && arm === 0) return null;
            return { ...hero, bonusDmg: dmg, bonusHp: hp, bonusArm: arm };
        })
        .filter(Boolean);
}

function getOwnedMachines(machineList) {
    return machineList
        .map(machine => {
            const inputs = getMachineInput(machine.id);

            // Check if machine is "owned":
            // Level > 0 OR any stat > 0 OR sacred/inscription > 0 OR rarity != default
            const hasStats = inputs.level > 1 ||
                inputs.dmgBP > 0 ||
                inputs.hpBP > 0 ||
                inputs.armBP > 0 ||
                inputs.sacred > 0 ||
                inputs.inscription > 0 ||
                (inputs.rarity && inputs.rarity !== "common");

            if (!hasStats) return null;

            return { ...machine, inputs };
        })
        .filter(Boolean);
}

// ---------------------------
// Save / Load snapshot
// ---------------------------
function getAllUserInputs() {
    return {
        // Only save heroes that have at least one non-zero bonus
        heroes: heroesData
            .map(h => {
                const { dmg, hp, arm } = getHeroInput(h.id);
                if (!dmg && !hp && !arm) return null; // skip unowned
                return { id: h.id, bonusDmg: dmg, bonusHp: hp, bonusArm: arm };
            })
            .filter(Boolean),

        // Only save machines that have a level or other non-default inputs
        machines: machinesData
            .map(m => {
                const inputs = getMachineInput(m.id);
                const hasInput =
                    inputs.level > 1 ||
                    inputs.dmgBP > 0 ||
                    inputs.hpBP > 0 ||
                    inputs.armBP > 0 ||
                    inputs.sacred > 0 ||
                    inputs.inscription > 0 ||
                    inputs.rarity !== "common";
                if (!hasInput) return null; // skip unowned
                return { id: m.id, inputs };
            })
            .filter(Boolean),

        artifacts: getArtifactInputs(),
        engineer: readLevel("engineer-level"),
        scarab: readLevel("scarab-level")
    };
}

function setAllUserInputs(data) {
    // ---------------------------
    // Heroes
    // ---------------------------
    (data.heroes || []).forEach(h => {
        const dmgInp = heroInput(h.id, "dmg");
        const hpInp = heroInput(h.id, "hp");
        const armInp = heroInput(h.id, "arm");

        if (dmgInp && h.bonusDmg != null) dmgInp.value = h.bonusDmg;
        if (hpInp && h.bonusHp != null) hpInp.value = h.bonusHp;
        if (armInp && h.bonusArm != null) armInp.value = h.bonusArm;
    });

    // ---------------------------
    // Machines
    // ---------------------------
    (data.machines || []).forEach(m => {
        if (!m.id || !m.inputs) return; // skip machines not actually saved
        const fields = ["level", "dmgBP", "hpBP", "armBP", "sacred", "inscription", "rarity"];
        fields.forEach(f => {
            const inp = machineInput(m.id, f);
            if (!inp) return;

            // Only write fields if they exist in the save JSON
            if (m.inputs[f] != null) {
                inp.value = m.inputs[f];
            }
        });
    });

    // ---------------------------
    // Artifacts
    // ---------------------------
    (data.artifacts || []).forEach(a => {
        const el = artifactInput(a.stat, a.percent);
        if (el && a.quantity != null) el.value = a.quantity;
    });

    // ---------------------------
    // Engineer / Scarab
    // ---------------------------
    if (dom.engineer && data.engineer != null) dom.engineer.value = data.engineer;
    if (dom.scarab && data.scarab != null) dom.scarab.value = data.scarab;
}


// ---------------------------
// Display optimizer output (keeps original layout)
// ---------------------------
function displayOptimizerOutput(result) {
    dom.optimizerOutput.innerHTML = "";

    const formation = result.formation || [];
    const activeSlots = formation.filter(s => s !== null);
    const totalPower = Calculator.computeSquadPower(activeSlots.map(s => s.stats));

    const leftColumnPositions = [1, 2];
    const rightColumnPositions = [3, 4, 5];
    const columns = {
        front: leftColumnPositions.map(idx => formation[idx - 1]).filter(Boolean).reverse(),
        back: rightColumnPositions.map(idx => formation[idx - 1]).filter(Boolean).reverse()
    };

    const formationHTML = `
    <div class="d-flex justify-content-center align-items-stretch gap-5 mb-3" style="font-size:0.95rem;">
        <div class="d-flex flex-column justify-content-end gap-4 text-center">
            ${columns.back.map(slot => `
                <div class="card p-3" style="width:150px; min-width:150px;">
                    <img src="${slot.image}" style="width:120px;height:120px;object-fit:cover;">
                    <div class="fw-bold mt-2">${slot.name}</div>
                    <div class="d-flex flex-column align-items-start mt-1 gap-1">
                        <div><img src="img/ui/damage.webp" style="width:20px;height:20px;margin-right:5px;">${abbreviate(slot.stats.damage)}</div>
                        <div><img src="img/ui/health.webp" style="width:20px;height:20px;margin-right:5px;">${abbreviate(slot.stats.health)}</div>
                        <div><img src="img/ui/armor.webp" style="width:20px;height:20px;margin-right:5px;">${abbreviate(slot.stats.armor)}</div>
                    </div>
                    <div class="d-flex justify-content-center gap-2 mt-2 flex-wrap">
                        ${slot.crew.filter(Boolean).map(h => `
                            <div style="text-align:center;">
                                <img src="${h.image}" title="${h.name} (D:${h.bonusDmg}%, H:${h.bonusHp}%, A:${h.bonusArm}%)" 
                                    style="width:40px;height:40px;border-radius:50%;">
                                <div style="font-size:0.75rem;">${h.name}</div>
                            </div>`).join("")}
                    </div>
                </div>
            `).join("")}
        </div>

        <div class="d-flex flex-column justify-content-center gap-4 text-center">
            ${columns.front.map(slot => `
                <div class="card p-3" style="width:150px; min-width:150px;">
                    <img src="${slot.image}" style="width:120px;height:120px;object-fit:cover;">
                    <div class="fw-bold mt-2">${slot.name}</div>
                    <div class="d-flex flex-column align-items-start mt-1 gap-1">
                        <div><img src="img/ui/damage.webp" style="width:20px;height:20px;margin-right:5px;">${abbreviate(slot.stats.damage)}</div>
                        <div><img src="img/ui/health.webp" style="width:20px;height:20px;margin-right:5px;">${abbreviate(slot.stats.health)}</div>
                        <div><img src="img/ui/armor.webp" style="width:20px;height:20px;margin-right:5px;">${abbreviate(slot.stats.armor)}</div>
                    </div>
                    <div class="d-flex justify-content-center gap-2 mt-2 flex-wrap">
                        ${slot.crew.filter(Boolean).map(h => `
                            <div style="text-align:center;">
                                <img src="${h.image}" title="${h.name} (D:${h.bonusDmg}%, H:${h.bonusHp}%, A:${h.bonusArm}%)" 
                                    style="width:40px;height:40px;border-radius:50%;">
                                <div style="font-size:0.75rem;">${h.name}</div>
                            </div>`).join("")}
                    </div>
                </div>
            `).join("")}
        </div>
    </div>`;

    dom.optimizerOutput.innerHTML = `
        <h5 class="mb-2">Max Mission Cleared: ${result.lastCleared}</h5>
        <h5 class="mb-2">Total Stars Earned: ${result.totalStars}</h5>
        <h6 class="mb-3">Total Team Power: ${abbreviate(totalPower)}</h6>
        ${formationHTML}
    `;
}

// ---------------------------
// Run optimizer (auto-save + auto-expand + toast)
// ---------------------------
function runOptimizer(maxMission) {
    // ---------------------------
    // 1. Gather player data
    // ---------------------------
    const ownedHeroes = getOwnedHeroes(heroesData);
    const ownedMachines = getOwnedMachines(machinesData);
    const artifacts = getArtifactInputs();
    const engineerLevel = readLevel("engineer-level");
    const scarabLevel = readLevel("scarab-level");
    const summedRarityLevels = Calculator.getGlobalRarityLevels(ownedMachines);

    // ---------------------------
    // 2. Auto-save setup
    // ---------------------------
    const saveData = getAllUserInputs();
    if (dom.setupCode) {
        dom.setupCode.value = JSON.stringify(saveData);
        if (dom.saveLoadPanel) {
            try {
                if (typeof bootstrap !== "undefined" && bootstrap.Collapse) {
                    const c = bootstrap.Collapse.getInstance(dom.saveLoadPanel) || new bootstrap.Collapse(dom.saveLoadPanel, { toggle: false });
                    c.show();
                } else {
                    dom.saveLoadPanel.classList.remove("collapse");
                    dom.saveLoadPanel.classList.add("show");
                }
            } catch (err) { }
        }
        showToast("Save updated", "success");
    }

    // ---------------------------
    // 3. Prepare player slots
    // ---------------------------
    const machineInputsMap = ownedMachines.reduce((acc, m) => {
        acc[m.id] = m.inputs || {};
        return acc;
    }, {});

    const playerSlots = ownedMachines.map(machine => {
        // Assign first matching hero (optional)
        const hero = ownedHeroes.find(h => !h.assigned && h.role === machine.role);
        if (hero) hero.assigned = true;

        return {
            machine,
            inputs: machineInputsMap[machine.id],
            crew: hero ? [hero] : [],
            abilityKey: machine.ability?.key
        };
    });

    // ---------------------------
    // 4. Run optimizer using new engine
    // ---------------------------
    const optimizer = new Optimizer({
        ownedMachines,
        heroes: ownedHeroes,
        engineerLevel,
        scarabLevel,
        artifactArray: artifacts,
        globalRarityLevels: summedRarityLevels,
        BattleEngineClass: BattleEngine
    });

    const result = optimizer.optimizeCampaignMaxStars({
        playerSlots,
        maxMission
    });

    // ---------------------------
    // 5. Display results
    // ---------------------------
    displayOptimizerOutput(result);
}

// ---------------------------
// Load handler (shows toast)
// ---------------------------
function loadSetupHandler() {
    const raw = dom.setupCode?.value?.trim();
    if (!raw) {
        showToast("Paste a saved setup first.", "error");
        return;
    }

    try {
        const data = JSON.parse(raw);
        setAllUserInputs(data);

        // Ensure panel is visible after loading
        if (dom.saveLoadPanel) {
            try {
                if (typeof bootstrap !== "undefined" && bootstrap.Collapse) {
                    const c = bootstrap.Collapse.getInstance(dom.saveLoadPanel) || new bootstrap.Collapse(dom.saveLoadPanel, { toggle: false });
                    c.show();
                } else {
                    dom.saveLoadPanel.classList.remove("collapse");
                    dom.saveLoadPanel.classList.add("show");
                }
            } catch (err) { }
        }

        showToast("Setup loaded!", "success");
    } catch (err) {
        showToast("Invalid setup code (JSON parse failed).", "error");
    }
}

// ---------------------------
// Initialization
// ---------------------------
function init() {
    buildHeroInputs(heroesData);
    buildMachineInputs(machinesData);
    buildArtifactInputs();

    dom.optimizeBtn?.addEventListener("click", () => runOptimizer(90));
    dom.loadSetupBtn?.addEventListener("click", loadSetupHandler);
}

// Run init
init();
