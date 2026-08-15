# Design References — Fighter RPG Showdown 3D

The project's design DNA. This file is **committed** and travels with the repo. Everything else in this folder (reference images, `playground-*.html`, `screens-*.html`, `index.md`) is per-user and gitignored.

---

## Status

**No reference images received yet.** The only named reference so far is the one sanitized in `instructions.md` as *"Modern 2.5d Fighter Game 4 / 5 / 6"* — confirmed by the user to mean **Street Fighter**, so SF6's layout language is the baseline.

Because a single baseline is a thin basis for a choice, the first playground ships **four presets**: one SF6-derived, three deliberately different, so there's a real spread to react against. Additional references get spun into new presets on request.

---

## Reference 1 — Street Fighter 6 *(named, no image on file)*

### Design DNA
- **Palette** — dark asphalt base, one screaming accent (hot yellow) against a secondary hot (magenta/cyan). Accents are *saturated to the point of vibration*; the base is almost neutral so they can shout.
- **Type** — heavy condensed display, frequently italicised/skewed for motion. Body copy is a plain grotesque that gets out of the way. Type is treated as a graphic element, not a label layer.
- **Shape** — near-zero radius, hard diagonal cuts, sheared parallelograms. Panels look *stamped* or *sprayed*, not rounded cards.
- **Texture** — spray-paint, ink-bleed, halftone. Grit as a brand device.
- **HUD** — health bars top-left/top-right mirrored, angled inner ends, name + level beneath. Meter bottom-corner, segmented with notches. Round-win pips inboard of the bars. Timer center-top.
- **Motion** — hard cuts and impact snaps, not eases. Damage drains in two layers (instant red loss + trailing chip).

### What transfers
- The mirrored-HUD layout — it's the genre-standard reading pattern and players expect it.
- Two-layer health drain (instant + trailing) — reads damage magnitude at a glance.
- Segmented meter with notches — communicates "one special's worth" without a number.
- Near-zero radius, angular panels — our fighter should feel struck, not soft.
- Base-neutral + one loud accent — leaves room for player/rival ownership colors to mean something on the map.

### What does NOT transfer
- ❌ **World Tour / Battle Hub / avatar customisation** — SF6's entire open-world front-end is out of scope. We have a node map, not a walkable overworld.
- ❌ **Drive Gauge complexity** — SF6 has Drive Rush/Parry/Impact off one gauge. We have *one* meter and *one* special.
- ❌ **Character-select roster grid** — we ship one fighter, later two. Our select is a 2-slot stub.
- ❌ **Combo counters, damage numerals, frame data, rank badges** — no scoring model exists in v0.1.
- ❌ **Online lobby, ranked tiers, replays** — explicitly out of scope.
- ❌ **Mouse-density menus** — SF6 assumes gamepad; so do we, but the reference's dense sub-menus fight couch-distance legibility. Fewer, bigger targets.

### Gaps the reference cannot fill
SF6 has **no world map, no territory ownership, no stat allocation**. That third of our UI has no fighting-game precedent — it needs its own reference (campaign-map or node-map games) or it will be designed blind. **Flagged as an open request to the user.**

---

## Playground directions (first pass)

Four presets, each a full palette + type + radius + shape bundle. They are directions to react against, not finished proposals.

| # | Preset | Feel | Palette core | Type | Radius |
|---|---|---|---|---|---|
| 1 | **Concrete & Neon** | SF6-derived. Street, sprayed, loud. | asphalt + hot yellow / magenta | Archivo Black + Barlow | 3px |
| 2 | **Iron Sanction** | Heavy metal, grim, weighty. Strive-adjacent. | near-black + blood red / bone | Bebas Neue + Rajdhani | 0px |
| 3 | **Broadcast** | Clean e-sport telecast. Precise, legible, cool. | deep navy + cyan / orange | Chakra Petch + Inter | 8px |
| 4 | **Warlord** | Empire-forward. The map leads, brass and oxblood. | dark umber + brass / oxblood | Cinzel + Spectral | 5px |

**Why these four:** the brief has two halves that pull in opposite directions — an *arcade brawl* and a *territorial campaign*. Presets 1–2 lead with the brawl, preset 4 leads with the empire, preset 3 stays neutral between them. Whichever one wins tells us which half the game's face belongs to.

---

## Accessibility caveats — resolved at token-lock, not papered over

These are live issues in the presets, deliberately visible rather than hidden:

1. **Player vs. rival color must never be the only signal.** The playground puts a **diagonal hatch on rival-held tiles** so ownership survives color blindness. Any locked direction must keep a non-color channel.
2. **HUD over a busy stage.** Health bars sit on top of 3D arena art. Color contrast alone won't hold — the playground renders the HUD over a textured backdrop so the scrim/outline can be judged honestly, not against flat grey.
3. **Concrete & Neon: white-on-yellow risk.** `#FFD400` cannot carry white text (~1.6:1). Text on the yellow accent must be near-black. Enforced in the preset; watch for it if the palette is fine-tuned.
4. **Iron Sanction: red-on-near-black.** `#C8102E` on `#0B0B0D` is ~3.2:1 — acceptable for large display type and bar fills, **not** for body copy. Don't demote it to a text color.
5. **TV legibility.** Type is sized for 1080p at couch distance. Nothing below 16px at the 1920-wide design size.
6. **Focus without color.** Every focus state uses ring **weight + scale + an inset bar**, so it reads with color perception fully removed.

---

## Frame targets

- **1920×1080 (16:9)** — the design resolution. Everything authored here.
- **2560×1080 (21:9)** — ultrawide safe-area check. HUD must anchor inward, not drift to the far edges.
- **TV title-safe** — 5% inset guides.
- **No phone frames.** This is a gamepad-first UE5 game; the responsive-web "desktop AND mobile" rule doesn't apply.

---

## Still wanted

- A **map / territory** reference (campaign map, node map, Risk-like ownership) — the biggest blind spot.
- A **menu / front-end** reference — main menu and results set the tone more than the HUD does.
- Optionally a **non-game** reference (poster, album, sports broadcast package) — often the strongest DNA source.
