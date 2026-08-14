# Fighter RPG Showdown 3D — Design Brief (v0.1)

A **2.5D** fighting game in **Unreal Engine** with light RPG progression and a world-map empire. Fights play like Modern 2.5d Fighter Game 6: 3D characters on a 2D plane. Core loop: pick a rival on the map, win the 1v1, claim their territory, earn XP, level up, and grow stats that actually change how the fighter plays.

This is the starting spec for Dex. Keep the first version small, playable, and readable. Fancy systems can come later.

---

## Pitch

Modern 2.5d Fighter Game-style 1v1 combat, plus the feeling of building *your* fighter **and** your turf. Matches still feel like a fighting game (rounds, health bars, specials). Between matches you return to a world map, spend levels on stats like Strength and Dexterity, then pick the next rival to knock off their throne.

Win enough challenges and the map fills with your colors. That is the empire: not cities to manage, just land you took with your fists.

**Not** a full open-world RPG you walk around. **Not** a 2D sprite fighter. **Not** a Tekken-style 3D arena brawler. World map is a select screen. Fights are **2.5D**: 3D characters and stages, 2D fighting-game rules. Think Modern 2.5d Fighter Game 6 — side view, one plane, jump/crouch/walk, always facing the opponent.

---

## Engine & project

- **Engine:** Unreal Engine 5 (latest stable)
- **Template:** Third Person is fine as a start; immediately lock fighters to a 2D plane and replace the follow cam with a side-view fight camera
- **Input:** Gamepad first, keyboard as fallback. Fighting-game layout: left/right, down = crouch, up = jump, face buttons = attacks
- **Target:** local 1v1 (P1 vs P2 or P1 vs simple AI) for the first playable

Use Blueprints for gameplay prototyping. C++ only if a system clearly needs it.

---

## Core fantasy

You are a fighter who gets better over time **and** a warlord who takes the map. A round-one jab should not feel the same as a level-20 jab. Beating the local champ should feel like planting a flag. Stats and claimed territories should both be visible and noticeable.

---

## Match flow (MVP)

1. Main menu → load (or start) a save
2. World map: see territories, who holds them, who you can challenge
3. Select a rival / territory
4. Fight in a 3D stage on a 2D plane (best of 3)
5. Each round: fight until one health bar hits 0
6. Win: claim (or keep) the territory, gain XP, maybe unlock a neighbor
7. Lose: territory stays theirs (or you lose it if they attacked you — later)
8. Results: XP, level-up, spend a stat point
9. Back to the map. Repeat until the empire covers the board

Keep round timer optional for v1. Health win is enough. Character select can wait until there is more than one playable fighter.

---

## Combat (2.5D fighter)

Play like a classic 2D fighter, look like a modern 3D one. Reference: **Modern 2.5d Fighter Game 4 / 5 / 6** — 3D models, 3D stages, camera with depth, but both fighters live on a single line. No free 3D movement, no sidestep, no 8-way run.

Start with a tight moveset, not a 50-move roster.

### The plane

- Fighters only move **left / right** and **up / down** (jump / crouch)
- Depth (into the camera) is locked. They cannot walk toward or away from the camera
- They **always face each other**. Crossing over auto-flips stance (side switch)
- Stage has a **left wall and right wall**. No walking off into the background
- Corners are real: you can be pushed to the wall and pressured there

### Camera

- Side-view fight cam that frames **both** characters
- Zoom out when they are far apart, zoom in when they are close (Modern 2.5d Fighter Game style)
- Slight 3D orbit / depth is fine for juice; gameplay stays 2D
- Do **not** use a third-person over-the-shoulder camera during matches

### Movement

- Walk forward / back along the plane
- Jump (neutral, forward, back)
- Crouch
- Dash (forward and back; later can scale with Dexterity)

### Attacks

- Light attack (fast, low damage)
- Heavy attack (slow, high damage)
- Crouching and jumping versions can share the same buttons with stance
- Special / meter move (one per fighter for v1)
- Hits register on a 2D axis: overlapping hurtboxes/hitboxes on the plane

### Defense

- Block: hold **back** relative to the opponent (classic fighter, not a dedicated block button — dedicated block is OK as a v1 shortcut if back-to-block is too fiddly at first)
- Standing block vs crouching: later; for v1 a single block is fine
- Hitstun / blockstun so attacks have rhythm
- Knockback along the plane; heavies can send someone toward the wall

### Health & meter

- Health bar per fighter (top of screen, SF-style)
- Super meter that fills from dealing/taking damage
- Special spends meter

Hit detection: 2D boxes (or capsules locked to the plane) attached to bones. Traces in full 3D space are a last resort. No need for frame-perfect netcode in v1.

---

## RPG layer

### Leveling

- Fighters have **Level**, **XP**, and **XP to next level**
- Winning a match grants XP; losing grants a smaller amount
- On level up: **+1 stat point** to spend (plus a small automatic HP bump)

Persist fighter progress **and empire map state** locally (save game). New game = level 1, Home Yard only.

### Core stats

Keep the list short so each one matters:


| Stat         | Short | What it does                                           |
| ------------ | ----- | ------------------------------------------------------ |
| Strength     | STR   | Damage on attacks, especially heavies                  |
| Dexterity    | DEX   | Movement speed, dash distance, attack speed / recovery |
| Constitution | CON   | Max HP, maybe chip/block toughness                     |
| Spirit       | SPI   | Meter gain rate and special damage                     |


Starting values around 5–10. Soft cap later; no need for it on day one.

**Formulas (starting point, tune in play):**

- Light damage ≈ base + (STR * 0.4)
- Heavy damage ≈ base + (STR * 0.8)
- Max HP ≈ baseHP + (CON * 12)
- Move speed ≈ baseSpeed * (1 + DEX * 0.01)
- Attack animation rate / recovery slightly improved by DEX
- Meter gain ≈ base * (1 + SPI * 0.02)
- Special damage ≈ base + (SPI * 0.6) + (STR * 0.3)

Show STR / DEX / CON / SPI / Level on the HUD or pause/results screen.

### Character identity vs stats

Stats modify the fighter; they should not erase the moveset. A high-DEX brawler is still that brawler, just snappier.

---

## World map & empire

The map is the campaign hub. You do **not** run around an open world. You pan/zoom a map, pick a node, and fight.

### Territories

Start with a small board — about **6–8 territories** is enough for v1.

Each territory has:

- Name (city, district, island, whatever fits the art)
- Owner (player, a rival, or unclaimed)
- A champion to fight (name, level, stat bias)
- A linked arena (reuse the same stage at first if needed)

Example starter map (rename freely):


| Territory      | Starter champ  | Notes                                       |
| -------------- | -------------- | ------------------------------------------- |
| Home Yard      | —              | Player starts here. Already owned.          |
| Docks          | Rookie Striker | First easy challenge                        |
| Market         | Brawler        | Unlocks after Docks                         |
| Factory        | Tough Brawler  | Mid                                         |
| Old Town       | Fast Striker   | Mid                                         |
| Arena District | Rival Ace      | Hard                                        |
| Capital        | Boss           | Last. Unlocks when you hold most of the map |


### Challenging people

- Click / highlight a **neighboring** territory (or any adjacent-to-empire tile)
- See the champ’s name, level, and a short threat readout (STR-heavy, DEX-heavy, etc.)
- Confirm → load the fight
- Beating them **claims the territory**. It flips to your color on the map.
- You cannot jump across the board. Empire grows from the edges.

Locked tiles show as darkened until a connected tile is yours.

### Building the empire

Empire = how much of the map you own. Keep it punchy, not a sim.

- **Claimed count** on the HUD (e.g. `3 / 8 territories`)
- Your color spreads across taken tiles
- Optional later: a claimed tile can be **contested** by a rival (they challenge you; lose and they take it back)
- Optional later: holding a tile gives a tiny bonus (Home Yard = extra XP, Factory = +1 STR while owned). Skip bonuses until claiming works.

Winning the campaign = own every territory, or beat the Capital champ after holding a majority.

### Rivals

Rivals are named AI fighters sitting on tiles, not a full diplomacy sim. For v1 they wait for you to attack. Personality / counter-attacks can wait.

---

## Content for first playable

### Fighters (start with 1, then 2)

1. **Brawler** — slower, heavier hits, STR-leaning
2. **Striker** — faster, lighter hits, DEX-leaning

Same input map, different timings / damage / special.

### Arena

One **3D stage with a 2D fight line**. Pretty background, floor, and lighting — but combat is a strip between two walls. Think SF6 stage: you see depth, you cannot walk into it. Different map tiles can reuse this stage until more arenas exist.

### AI (v1)

Very simple: approach, throw lights, sometimes block, sometimes heavy. Scale their stats to the territory (Docks champ is weaker than Capital). Personality later.

### Map

A single world-map widget or level: 6–8 clickable tiles, player color vs rival color, champ portraits/names on hover. Placeholder art is fine (colored regions + labels).

---

## Screens / UI (minimum)

- Main menu: New Game / Continue / Quit
- World map: territories, owners, who you can challenge, empire count
- Challenge prompt: rival name, level, stats teaser, Fight / Back
- In-match HUD: dual health bars, meter, round markers, names, levels (Modern 2.5d Fighter Game layout)
- Results: winner, territory claimed or not, XP, level-up prompt
- Stats panel: current stats + spend point (from results or pause on the map)

---

## Suggested Unreal layout

```
Content/
  Characters/     # meshes, anims, fighter Blueprints
  Arenas/         # first stage
  Combat/         # plane lock, hitboxes, health, meter, round manager
  Camera/         # 2.5D fight camera
  RPG/            # stats, XP, save
  Empire/         # territories, ownership, rival defs
  Map/            # world map widget / map level
  UI/             # HUD, menus, stat screen, challenge popup
  Input/          # IMC + actions
```

Key actors / components:

- `FighterCharacter` — plane movement, jump, crouch, attacks, auto-face opponent
- `PlaneConstraint` — lock to the fight line, walls, side switch
- `FightCamera` — side view, frame both fighters, zoom by distance
- `CombatComponent` — health, meter, hit reaction, hitstun
- `HitboxComponent` — 2D boxes on the plane
- `StatsComponent` — STR/DEX/CON/SPI, derived values
- `ProgressionComponent` — XP, level, stat points
- `MatchGameMode` / `RoundManager` — rounds, win, XP payout
- `FighterAIController` — dummy opponent
- `TerritoryData` — name, owner, champ, adjacent tiles, arena
- `EmpireSubsystem` (or GameInstance) — who owns what, save/load map state
- `WorldMapWidget` — tiles, challenge select, empire count

---

## Build order for Dex

Do these in order. Each step should be playable before the next.

1. Project boots, two 3D fighters on a plane, walk left/right, jump, always face each other, side-view cam frames both
2. Light / heavy attacks with 2D hitboxes and health
3. Block, hitstun, wall, round win when HP = 0
4. Best of 3 + results screen
5. Stats component wired into damage / speed / HP
6. XP + level up + spend a stat point
7. Save/load that fighter
8. Second fighter + simple AI
9. One special move + meter
10. World map with 6–8 tiles, adjacency, and a starting Home Yard
11. Challenge a neighbor → fight → claim tile → save empire state
12. Scale rival stats by territory; Capital as the last fight

Combat should work before the map. The map is the wrapper, not the first system.

Do not start with networking, inventories, skill trees, walking around an overworld, or free 3D movement in fights.

---

## Out of scope for v0.1

- Online multiplayer
- 3+ player modes
- Open world you explore on foot
- Tekken / Soulcalibur-style 3D movement (sidestep, 8-way run)
- Sprite-based 2D (use 3D meshes)
- City building, taxes, armies, or diplomacy
- Crafting, loot, equipment (maybe later as a thin layer)
- Huge combo lists and cancel windows
- Cinematics

---

## Success for this first pass

A person can open the world map, pick a neighboring champ, fight a **2.5D** round that feels like Modern 2.5d Fighter Game (plane, jump, crouch, side cam), feel the difference between light and heavy, win, see the tile flip to their color, gain XP, put a point in STR or DEX, and notice the next match — and the growing empire — play differently.

Tone: arcade 2.5D fighter first, RPG and empire second. Stats and territory support the brawl; they do not replace it.