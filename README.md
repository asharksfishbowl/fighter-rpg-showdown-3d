# Fighter RPG Showdown 3D

Playable **Three.js** 2.5D fighter with a light RPG / empire map — claim territories, earn XP, spend STR / DEX / CON / SPI.

Live (alongside Kilimanjaro): **[asharksfishbowl.com/fighter/](https://asharksfishbowl.com/fighter/)**

## Controls

| Input | Action |
| --- | --- |
| A / D or ← / → | Move |
| W / ↑ / Space | Jump |
| S / ↓ | Crouch |
| Hold back (away from rival) | Block |
| J | Light |
| K | Heavy |
| L | Special (needs 50 meter) |

Best of 3. Win a neighboring champ to flip their tile to your empire.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3851/`.

## Build

```bash
npm run build
```

Production assets land in `dist/` with base path `/fighter/` for Firebase Hosting next to the Kilimanjaro site.

## Stack

- Vite + TypeScript
- three.js (procedural fighters + arena)
- localStorage save (`frs3d-save-v1`)
