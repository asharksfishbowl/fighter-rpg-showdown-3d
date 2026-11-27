import "./style.css";
import { FightScene, type FightHud } from "./game/FightScene";
import { bindInput } from "./game/input";
import {
  applyXp,
  spendStat,
  xpForLoss,
  xpForWin,
} from "./game/progression";
import {
  canChallenge,
  empireComplete,
  getTerritory,
  TERRITORIES,
} from "./game/territories";
import {
  claimTerritory,
  clearSave,
  loadSave,
  newGame,
  writeSave,
} from "./game/save";
import { preloadSharkFighter } from "./game/sharkModel";
import type { MatchOutcome, SaveData, Stats, TerritoryId } from "./game/types";

// Warm the humanoid shark GLB so the first fight starts without a hitch.
void preloadSharkFighter().catch((err) => {
  console.error("Failed to preload shark fighter model", err);
});

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app missing");

app.innerHTML = `
  <section class="screen menu" id="screen-menu">
    <p class="menu-kicker">A Shark's Fishbowl · Arcade</p>
    <h1>Fighter RPG<br/>Showdown 3D</h1>
    <p>
      2.5D neon brawls with RPG leveling. Claim the map, spend stats, feel every
      jab hit harder. Keyboard: move with WASD / arrows, J light, K heavy, L special (50 meter).
    </p>
    <div class="btn-row">
      <button class="btn" id="btn-new">New Game</button>
      <button class="btn btn-ghost" id="btn-continue" disabled>Continue</button>
      <a class="btn btn-ghost" href="https://asharksfishbowl.com/">Back to Fishbowl</a>
    </div>
  </section>

  <section class="screen map-shell hidden" id="screen-map">
    <div class="map-top">
      <div>
        <h2>Empire Map</h2>
        <div class="map-meta" id="map-meta"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="btn-stats">Stats</button>
        <button class="btn btn-ghost" id="btn-menu">Menu</button>
      </div>
    </div>
    <div class="map-grid" id="map-grid"></div>
    <div class="map-foot">
      <span id="map-hint">Challenge a neighboring territory to expand your empire.</span>
      <span id="map-empire"></span>
    </div>
  </section>

  <section class="screen hidden" id="screen-challenge" style="justify-content:center;padding:1.5rem;background:#100d0b">
    <div class="panel" id="challenge-panel"></div>
  </section>

  <section class="screen hidden" id="screen-stats" style="justify-content:center;padding:1.5rem;background:#100d0b">
    <div class="panel" id="stats-panel"></div>
  </section>

  <section class="screen fight-shell hidden" id="screen-fight">
    <div class="hud">
      <div class="hud-top">
        <div class="bar-block">
          <div class="bar-label" id="hud-p-name">You</div>
          <div class="hp-stack">
            <div class="bar chip"><i id="hud-p-chip"></i></div>
            <div class="bar player"><i id="hud-p-hp"></i></div>
          </div>
          <div class="pips" id="hud-p-pips"></div>
        </div>
        <div class="timer" id="hud-timer">99</div>
        <div class="bar-block right">
          <div class="bar-label" id="hud-r-name">Rival</div>
          <div class="hp-stack">
            <div class="bar chip"><i id="hud-r-chip"></i></div>
            <div class="bar rival"><i id="hud-r-hp"></i></div>
          </div>
          <div class="pips" id="hud-r-pips"></div>
        </div>
      </div>
      <div class="banner" id="hud-banner"></div>
      <div class="hud-bottom">
        <div class="meter-wrap">
          <span>SUPER</span>
          <div class="meter"><i id="hud-p-meter"></i></div>
        </div>
        <div class="hud-help">WASD move · back=block · J light · K heavy · L special</div>
        <div class="meter-wrap right">
          <span>SUPER</span>
          <div class="meter"><i id="hud-r-meter"></i></div>
        </div>
      </div>
    </div>
  </section>

  <section class="screen results hidden" id="screen-results">
    <div class="panel" id="results-panel"></div>
  </section>
`;

let save: SaveData | null = loadSave();
let selected: TerritoryId | null = null;
let fight: FightScene | null = null;
let raf = 0;
let last = 0;
let unbindInput: (() => void) | null = null;
let lastOutcome: MatchOutcome | null = null;

const el = {
  menu: must("#screen-menu"),
  map: must("#screen-map"),
  challenge: must("#screen-challenge"),
  stats: must("#screen-stats"),
  fight: must("#screen-fight"),
  results: must("#screen-results"),
  continueBtn: must<HTMLButtonElement>("#btn-continue"),
  mapGrid: must("#map-grid"),
  mapMeta: must("#map-meta"),
  mapEmpire: must("#map-empire"),
  mapHint: must("#map-hint"),
  challengePanel: must("#challenge-panel"),
  statsPanel: must("#stats-panel"),
  resultsPanel: must("#results-panel"),
  hudPName: must("#hud-p-name"),
  hudRName: must("#hud-r-name"),
  hudPHp: must("#hud-p-hp"),
  hudRHp: must("#hud-r-hp"),
  hudPChip: must("#hud-p-chip"),
  hudRChip: must("#hud-r-chip"),
  hudPMeter: must("#hud-p-meter"),
  hudRMeter: must("#hud-r-meter"),
  hudPPips: must("#hud-p-pips"),
  hudRPips: must("#hud-r-pips"),
  hudBanner: must("#hud-banner"),
  hudTimer: must("#hud-timer"),
};

function must<T extends HTMLElement = HTMLElement>(sel: string): T {
  const node = document.querySelector<T>(sel);
  if (!node) throw new Error(`Missing ${sel}`);
  return node;
}

function show(
  next: "menu" | "map" | "stats" | "challenge" | "fight" | "results",
): void {
  el.menu.classList.toggle("hidden", next !== "menu");
  el.map.classList.toggle("hidden", next !== "map");
  el.challenge.classList.toggle("hidden", next !== "challenge");
  el.stats.classList.toggle("hidden", next !== "stats");
  el.fight.classList.toggle("hidden", next !== "fight");
  el.results.classList.toggle("hidden", next !== "results");
}

function refreshMenu(): void {
  el.continueBtn.disabled = !save;
}

function renderMap(): void {
  if (!save) return;
  const f = save.fighter;
  el.mapMeta.textContent = `${f.name} · Lv ${f.level} · XP ${f.xp}/${f.xpToNext} · Points ${f.statPoints}`;
  el.mapEmpire.textContent = `${save.owned.length} / ${TERRITORIES.length} territories`;
  if (empireComplete(save.owned)) {
    el.mapHint.textContent = "Empire complete. You own the board.";
  }

  el.mapGrid.innerHTML = TERRITORIES.map((t) => {
    const owned = save!.owned.includes(t.id);
    const open = canChallenge(save!.owned, t.id);
    const locked = !owned && !open;
    const cls = [
      "tile",
      owned ? "owned" : "",
      open ? "challenge" : "",
      locked ? "locked" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const detail = owned
      ? "Your turf"
      : t.champ
        ? `${t.champ.name} · Lv ${t.champ.level} · ${t.champ.bias}`
        : "";
    return `<button class="${cls}" data-id="${t.id}" ${locked ? "disabled" : ""}>
      <strong>${t.name}</strong>
      <span>${detail}</span>
    </button>`;
  }).join("");

  el.mapGrid.querySelectorAll<HTMLButtonElement>(".tile").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id as TerritoryId;
      if (!save) return;
      if (save.owned.includes(id)) {
        el.mapHint.textContent = `${getTerritory(id).name} is already yours.`;
        return;
      }
      if (!canChallenge(save.owned, id)) return;
      selected = id;
      renderChallenge();
      show("challenge");
    });
  });
}

function renderChallenge(): void {
  if (!save || !selected) return;
  const t = getTerritory(selected);
  const c = t.champ!;
  el.challengePanel.innerHTML = `
    <h2>Challenge</h2>
    <p><strong>${t.name}</strong> is held by <strong>${c.name}</strong> (Lv ${c.level}). Bias: ${c.bias}.</p>
    <p>Best of 3. Win to claim the tile and earn XP.</p>
    <div class="btn-row">
      <button class="btn" id="btn-fight">Fight</button>
      <button class="btn btn-ghost" id="btn-challenge-back">Back</button>
    </div>
  `;
  must("#btn-fight").addEventListener("click", () => startFight(selected!));
  must("#btn-challenge-back").addEventListener("click", () => {
    show("map");
    renderMap();
  });
}

function renderStats(): void {
  if (!save) return;
  const f = save.fighter;
  const keys: Array<keyof Stats> = ["str", "dex", "con", "spi"];
  const labels: Record<keyof Stats, string> = {
    str: "Strength — damage",
    dex: "Dexterity — speed",
    con: "Constitution — HP",
    spi: "Spirit — meter / special",
  };
  el.statsPanel.innerHTML = `
    <h2>Level ${f.level}</h2>
    <p>${f.statPoints} point${f.statPoints === 1 ? "" : "s"} to spend · XP ${f.xp}/${f.xpToNext}</p>
    <div class="stat-grid">
      ${keys
        .map(
          (k) => `<button class="stat-btn" data-stat="${k}" ${f.statPoints <= 0 ? "disabled" : ""}>
            <div>${labels[k]}</div>
            <b>${f.stats[k].toString().padStart(2, "0")}</b>
          </button>`,
        )
        .join("")}
    </div>
    <div class="btn-row">
      <button class="btn" id="btn-stats-back">Back to Map</button>
    </div>
  `;
  el.statsPanel.querySelectorAll<HTMLButtonElement>(".stat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.stat as keyof Stats;
      if (!save) return;
      if (spendStat(save.fighter, key)) {
        writeSave(save);
        renderStats();
      }
    });
  });
  must("#btn-stats-back").addEventListener("click", () => {
    show("map");
    renderMap();
  });
}

function onHud(hud: FightHud): void {
  el.hudPName.textContent = `${hud.pName}  Lv${hud.pLevel}`;
  el.hudRName.textContent = `${hud.rName}  Lv${hud.rLevel}`;
  el.hudPHp.style.transform = `scaleX(${hud.pHealth / hud.pMax})`;
  el.hudRHp.style.transform = `scaleX(${hud.rHealth / hud.rMax})`;
  el.hudPChip.style.transform = `scaleX(${hud.pChip / hud.pMax})`;
  el.hudRChip.style.transform = `scaleX(${hud.rChip / hud.rMax})`;
  el.hudPMeter.style.width = `${hud.pMeter}%`;
  el.hudRMeter.style.width = `${hud.rMeter}%`;
  el.hudTimer.textContent = String(hud.timer).padStart(2, "0");
  el.hudPPips.innerHTML = [0, 1]
    .map((i) => `<span class="pip ${hud.pRounds > i ? "on" : ""}"></span>`)
    .join("");
  el.hudRPips.innerHTML = [0, 1]
    .map((i) => `<span class="pip ${hud.rRounds > i ? "on" : ""}"></span>`)
    .join("");
  el.hudBanner.textContent = hud.banner;
}

async function startFight(territoryId: TerritoryId): Promise<void> {
  if (!save) return;
  const t = getTerritory(territoryId);
  if (!t.champ) return;
  stopFightLoop();
  fight?.dispose();
  unbindInput?.();
  show("fight");
  el.hudBanner.textContent = "LOADING";
  try {
    await preloadSharkFighter();
  } catch (err) {
    console.error(err);
    el.hudBanner.textContent = "MODEL FAILED";
    show("map");
    return;
  }
  unbindInput = bindInput();
  fight = new FightScene(el.fight, {
    playerName: save.fighter.name,
    playerLevel: save.fighter.level,
    playerStats: { ...save.fighter.stats },
    champ: t.champ,
    arenaTint: t.arenaTint,
    onHud,
  });
  last = performance.now();
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const result = fight?.update(dt) ?? null;
    if (result) {
      stopFightLoop();
      finishMatch(territoryId, result === "player");
    }
  };
  raf = requestAnimationFrame(loop);
}

function stopFightLoop(): void {
  cancelAnimationFrame(raf);
  unbindInput?.();
  unbindInput = null;
}

function finishMatch(territoryId: TerritoryId, won: boolean): void {
  if (!save) return;
  const t = getTerritory(territoryId);
  const champLevel = t.champ?.level ?? 1;
  const xp = won
    ? xpForWin(champLevel, save.fighter.level)
    : xpForLoss(champLevel);
  const leveledUp = applyXp(save.fighter, xp);
  let claimed = false;
  if (won) {
    claimTerritory(save, territoryId);
    claimed = true;
  }
  writeSave(save);
  lastOutcome = { won, territoryId, xpGained: xp, leveledUp, claimed };
  fight?.dispose();
  fight = null;
  renderResults();
  show("results");
}

function renderResults(): void {
  if (!save || !lastOutcome) return;
  const t = getTerritory(lastOutcome.territoryId);
  el.resultsPanel.innerHTML = `
    <h2>${lastOutcome.won ? "Victory" : "Defeat"}</h2>
    <p>
      ${lastOutcome.won ? `You claimed <strong>${t.name}</strong>.` : `${t.name} stays contested.`}
      Gained <strong>${lastOutcome.xpGained} XP</strong>.
      ${lastOutcome.leveledUp ? " Level up — spend a stat point!" : ""}
    </p>
    <p>Now Lv ${save.fighter.level} · Points ${save.fighter.statPoints} · Empire ${save.owned.length}/${TERRITORIES.length}</p>
    <div class="btn-row">
      ${save.fighter.statPoints > 0 ? `<button class="btn" id="btn-to-stats">Spend Points</button>` : ""}
      <button class="btn ${save.fighter.statPoints > 0 ? "btn-ghost" : ""}" id="btn-to-map">World Map</button>
    </div>
  `;
  must("#btn-to-map").addEventListener("click", () => {
    show("map");
    renderMap();
  });
  const statsBtn = document.querySelector("#btn-to-stats");
  statsBtn?.addEventListener("click", () => {
    renderStats();
    show("stats");
  });
}

must("#btn-new").addEventListener("click", () => {
  clearSave();
  save = newGame();
  writeSave(save);
  refreshMenu();
  renderMap();
  show("map");
});

el.continueBtn.addEventListener("click", () => {
  save = loadSave();
  if (!save) return;
  renderMap();
  show("map");
});

must("#btn-stats").addEventListener("click", () => {
  renderStats();
  show("stats");
});

must("#btn-menu").addEventListener("click", () => {
  stopFightLoop();
  fight?.dispose();
  fight = null;
  refreshMenu();
  show("menu");
});

refreshMenu();
show("menu");
