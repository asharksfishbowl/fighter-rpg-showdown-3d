# Design Component Inventory — Fighter RPG Showdown 3D

**Status:** Step 1 of `/design-mock` (Orient). Awaiting references.
**Source of truth for scope:** `instructions.md` (Design Brief v0.1).

---

## Audit finding: there is no code yet

The skill's rule is *"ground coverage in the REAL code, not the design doc."* Honest result of that audit:

```
find . -name "*.uproject" -o -type d -name Content   → (nothing)
```

The repo contains only `instructions.md`, `README.md`, an empty `CLAUDE.md`, and the Dex pipeline queue files. **No Unreal project, no `Content/`, no UMG widgets, no C++/Blueprint source.** There is no build to diverge from the plan, so this inventory is grounded in the brief — and that is a deliberate, flagged exception, not an oversight. When the project boots, re-audit `Content/UI/` and reconcile.

**No visual `design.md` exists** (created at Step 8, Lock). **No `DESIGN.md` exists either** — `instructions.md` fills that role.

---

## Platform / frames

| Fact | Value | Source |
|---|---|---|
| Engine | Unreal Engine 5 | brief §Engine & project |
| Input | **Gamepad first**, keyboard fallback | brief §Engine & project |
| Session | Local 1v1 (P1 vs P2 or simple AI) | brief §Engine & project |
| Online | Out of scope for v0.1 | brief §Out of scope |

**This is a PC/console game, not a web app.** The `/design-mock` "desktop AND mobile" rule exists for responsive web products; applied literally here it would produce phone frames for a gamepad-driven fighting game, which is wrong. The correct frame set:

- **Primary: 1920×1080 (16:9)** — the design resolution. Everything is authored here.
- **Secondary: 2560×1080 (21:9) safe-area check** — ultrawide is common on PC; HUD anchors must not drift to the far edges.
- **TV title-safe overlay** — 5% inset guides, since console output crops.

**Gamepad-first consequences that shape every mock:**
- Every screen needs a **visible focus state** (selection ring / highlight), not just hover. Mouse hover is a bonus, not the primary affordance.
- Every screen needs a **button-prompt legend** (A/X = Confirm, B/○ = Back, LB/RB = tab cycle) pinned to a consistent corner.
- No screen may require a cursor to be usable.

---

## Data model — what the UI is allowed to show

Mocking UI the entities cannot back is forbidden. The v0.1 model, verbatim from the brief:

**Fighter:** `Level`, `XP`, `XPToNextLevel`, `StatPoints`, `HP`/`MaxHP`, `Meter`
**Stats:** `STR`, `DEX`, `CON`, `SPI` — four, starting 5–10, no soft cap in v1
**Territory:** `Name`, `Owner` (player / rival / unclaimed), `Champion {name, level, stat bias}`, `LinkedArena`, adjacency
**Match:** best of 3, health-depletion win, round timer **optional** in v1
**Empire:** claimed count `N / 8`

### Do NOT mock these — no data backs them
- ❌ Star ratings / letter grades / combo rank (no scoring model)
- ❌ Equipment, loot, inventory, crafting, currency (explicitly out of scope)
- ❌ Skill trees / branching unlocks (only a flat +1 stat point exists)
- ❌ Online lobby, friends list, matchmaking, leaderboards (out of scope)
- ❌ Diplomacy, taxes, armies, city building (out of scope)
- ❌ Cinematics / cutscene player (out of scope)
- ❌ Move list with 50 entries — v1 is light / heavy / one special
- ❌ Multiple arenas with distinct art — v1 reuses ONE stage across tiles

### Flagged mismatches — resolved
1. **Character select** — ✅ **RESOLVED: stub it.** A minimal 2-slot Brawler/Striker select, marked deferred. Establishes the pattern without over-designing a screen the build order doesn't reach until step 8.
2. **Round timer** — ✅ **RESOLVED: mock both states.** The HUD reserves the center-top slot either way; both timer-on and timer-off layouts get mocked so the layout survives whichever way it lands.
3. **Save slots** — ✅ **RESOLVED: multiple slots.** *This diverges from the brief*, which implies a single local save ("Persist fighter progress and empire map state locally"). A slot list adds: a slot-list screen, per-slot summary cards, empty-slot state, slot-overwrite confirm, and **slot delete + its confirm dialog**. The data model needs a save-slot index — flag to Researcher at roundtable.
4. **Contested tiles** — still deferred. Rivals re-challenging you is "optional later." Map legend keeps room for a `contested` state without designing the flow.
5. **Territory bonuses** — still deferred. "Skip bonuses until claiming works." Tile detail panel must not show a bonus row yet.

---

## Screen coverage

Six screens are named in the brief (§Screens / UI). Four more are structurally required by the flow (§Match flow) and by the skill's confirm-dialog rule. Each row lists the states that must exist in the playground.

### 1. Main Menu — *named in brief*
- Components: title lockup, vertical action list, build/version stamp, button legend
- Actions: **New Game**, **Continue**, **Quit**
- States: `Continue` **enabled** (save exists) · `Continue` **disabled** (no save) · focus ring on each item
- **Confirm dialogs (required):** New Game **over an existing save** (destructive — overwrite), Quit (session action)

### 2. World Map — *named in brief*
- Components: 6–8 tile nodes, adjacency links, owner coloring (player / rival / unclaimed), locked-tile darkening, empire counter `3 / 8`, selected-tile detail panel, pan/zoom affordance, button legend
- Tile states: **owned by player** · **owned by rival** · **unclaimed** · **locked** (not adjacent to empire) · **focused/selected** · *(reserved: contested)*
- Screen states: early game (1 of 8 owned) · mid game · **endgame w/ Capital unlocked** · loading

### 3. Challenge Prompt — *named in brief*
- Components: rival portrait/placeholder, name, level, **threat readout** (STR-heavy / DEX-heavy…), territory name, Fight / Back
- Overlay pattern decision: **centered modal vs. side panel** — must be settled once and reused (see Overlay Pattern below)
- States: challengeable · already-owned tile (no Fight action) · locked tile (explains why)

### 4. In-Match HUD — *named in brief*
- Components: dual health bars (P1 left / P2 right, SF-style), super meter per fighter, **round-win markers**, fighter names, levels, optional round timer
- States: full health · mid-damage · **chip/blocked** · KO (bar empty) · meter empty / partial / **full (special ready)** · round marker 0/1/2 wins · timer shown vs hidden
- Overlays: **Round 1 / FIGHT! / K.O. / Round Won** callouts · **Pause menu** (see 9)

### 5. Results — *named in brief*
- Components: winner banner, territory outcome (**claimed** / **kept** / **held by rival**), XP award bar with fill animation, level-up prompt
- States: **win + tile claimed** · **win, no tile change** · **loss** · **level-up fired** vs **no level-up**

### 6. Stats Panel — *named in brief*
- Components: Level, XP bar to next, **unspent stat points** badge, four stat rows (STR/DEX/CON/SPI) with allocate control, **derived-value readout** (damage, max HP, move speed, meter rate — the brief's formulas)
- States: **points available** (allocate enabled) · **no points** (read-only) · point spent → derived values update · reachable from **Results** and from **map pause**

### 7. Loading / Transition — *structurally required (map → fight → results)*
- Components: stage art or territory card, versus lockup (player vs champion), progress indicator, tip line
- States: loading · ready-to-start

### 8. Save Slots — *structurally required · **multi-slot** (user decision)*
- Components: **slot list**, per-slot summary card — fighter level, empire count `N / 8`, last territory, timestamp, playtime
- Slot states: **filled** · **empty** ("New Game" affordance) · **focused** · **corrupt/unreadable** (error + retry)
- Screen states: all empty (first launch) · mixed · all full
- **Confirm dialogs (required):** overwrite a filled slot with New Game (destructive) · **delete a slot** (destructive)
- ⚠️ Diverges from the brief's single-save implication — needs a save-slot index in the data model

### 9. Pause Menu (in-match) — *structurally required*
- Components: Resume, Stats, **Quit to Map**, button legend
- **Confirm dialog (required):** Quit to Map mid-match (forfeits the round — session action)

### 10. Character Select — *stub (user decision)*
- Components: two slots — **Brawler** (STR-leaning) / **Striker** (DEX-leaning), name, stat-bias tag, focus state
- States: focused · selected · *(reserved: locked slot for future fighters)*
- Deliberately minimal — establishes the pattern; full portraits/previews wait for build-order step 8

---

## Cross-cutting patterns to settle once

| Pattern | Decision needed | Applies to |
|---|---|---|
| **Overlay shape** | centered modal · side panel · bottom sheet — pick ONE | Challenge prompt, pause, confirms |
| **Confirm dialog** | one component, reused | Overwrite slot, **delete slot**, Quit, Quit to Map |
| **Focus state** | ring / glow / slide-in bar — must read on a TV at 3m | every screen |
| **Button legend** | corner, iconography, gamepad vs keyboard swap | every screen |
| **Empty state** | no save, no challengeable tile | Main Menu, World Map |
| **Error + retry** | corrupt save, failed load | Save/Continue, Loading |
| **Toast** | "Territory claimed", "Level up" — or are these full-screen only? | Results, World Map |
| **Owner colors** | player / rival / unclaimed / locked — must survive colorblind check | World Map, HUD |

---

## Accessibility notes (resolved at token-lock, not papered over)

- Health-bar and territory-owner colors must not rely on **red vs green** alone — pair with shape/pattern/label.
- Text must clear **4.5:1** against the busiest stage background the HUD sits on; the HUD needs a scrim or outline, not just a color.
- TV legibility: minimum type size checked at 1080p viewed at distance, not at desk distance.
- Focus indication must be visible **without** color perception (motion, scale, or border weight too).

---

## Decisions locked (Step 1)

| Question | Decision |
|---|---|
| Frame set | **1920×1080 primary + 2560×1080 ultrawide safe-area + TV title-safe guides.** No phone frames. |
| Character select | **Stub** — 2 slots (Brawler / Striker), marked deferred |
| Round timer | **Mock both states** — timer on and timer off |
| Save model | **Multiple slots** — diverges from brief, flag to Researcher |

## Still open

- Overlay shape (modal / side panel) — settled at Step 4 with the feel
- Does "Territory claimed" / "Level up" get a toast, or is it full-screen only?
- Playtime tracking on slot cards — not in the brief's model; drop it if Researcher says no

**Next:** Step 2 — gather reference images.
