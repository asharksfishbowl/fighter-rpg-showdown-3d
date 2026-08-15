# Design iteration manifest — Fighter RPG Showdown 3D

Read this FIRST on any restart or lost context. It reconstructs what already exists.
Never overwrite a prior iteration — fork a new suffix (`A` → `A1` → `A2`; new direction → `B`).

## Direction A — first pass, four presets in one file

| Iteration | File | What it is | Status |
|---|---|---|---|
| **A** | `playground-A.html` | First playground. Four feel presets (Concrete & Neon / Iron Sanction / Broadcast / Warlord) over the app's real components: in-match HUD over stage art, HUD parts, main + pause menus, world map with all tile states, challenge overlay A/B, stats & progression, results, save slots, confirm dialogs + toasts, versus/loading, character-select stub. Live token controls + copy-tokens. | **Awaiting pick** |

## Context

- **No reference images received yet.** Only named reference is Street Fighter (confirmed as the brief's sanitized "Modern 2.5d Fighter Game 4/5/6"). The four presets exist to give a real spread to react against — one SF6-derived, three deliberately different.
- **No code exists.** Repo has no `.uproject` and no `Content/`. Coverage is grounded in `instructions.md`, flagged as an exception in the inventory.
- Coverage inventory: `specs/ui-redesign/design-component-inventory.md`
- Design DNA + accessibility caveats: `design-references/README.md`

## Decisions locked at Step 1

| Question | Decision |
|---|---|
| Frames | 1920×1080 primary + 21:9 ultrawide safe-area + TV title-safe guides. **No phone frames.** |
| Character select | Stub — 2 slots, deferred |
| Round timer | Mock both states (on / off) |
| Save model | **Multiple slots** — diverges from brief, flagged for Researcher |

## Open decisions

1. **Which feel** — the whole point of iteration A. Mongrels welcome ("Iron's palette, Broadcast's type").
2. **Overlay shape** — centred modal vs. side panel (section 5). One shape gets reused everywhere.
3. **Toast vs. results-only** — does "Territory claimed" / "Level up" get a toast, or does the full-screen Results own that moment?
