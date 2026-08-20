# 🫧 BLOB KNIGHT

Six depths. One sword. One very determined blob.

![Version](https://img.shields.io/badge/version-1.4.0-blue)

A vanilla-JS canvas action RPG — no engines, no frameworks. You are the last of the Blob Knights: swing the sword with one hand, blast ranged weapons with the other, and throw everything else you own at the dark.

## Play

**Online (mobile + desktop):** https://zixygit.github.io/blob-knight/

```
cd rpg2d
npm install && npm run dev      # Vite dev server → http://localhost:8123
```

Or open `index.html` directly in a browser (no build step needed).

## Controls

| Key | Action |
|-----|--------|
| WASD / arrows | Move |
| SPACE | **Sword** (primary hand — hold to charge a HEAVY SLAM) |
| R / right-click | **Ranged weapon** (secondary hand — crossbow, staff, boomerang…) |
| SHIFT | Dash |
| E | Potion / shrine |
| F | **Bomb** |
| G | **Deploy turret** |
| T | **Set bear trap** |
| Q / 1-4 | Cycle / select the secondary (ranged) weapon |
| ENTER | Skip the optional shop / path choice after clearing a level |
| P / Esc | Pause |
| M | Mute |

The **sword is always equipped** — ranged weapons are secondary and fire independently, so you can slash and blast at the same time. Bombs, turrets and bear traps are bought from the campfire merchant and used from your tool belt (F / G / T).

Gamepad (Xbox-style): left stick move, A sword, RB ranged, B dash, X potion, LB pause.
Touch (mobile): on-screen joystick + button cluster (sword, ranged, bomb, dash, potion, weapon cycle, pause).

## Features

- **Two-hand combat** — sword + ranged weapon fire on separate keys
- **Tools**: bombs, turrets, bear traps with a visible tool belt in the HUD
- **12 enemy types** + elite modifiers + 7 bosses with pattern libraries, enrage and desperation phases
- **Progression**: XP + level-up cards, perks, weapon levels, classes (Knight/Ranger/Mage), artifacts, meta shrine
- **Meta**: save/continue, daily challenge, New Game+, difficulty, stats, bestiary, achievements, journal
- **Mobile-ready**: touch controls, responsive layout, no-zoom viewport, auto-pause
- **Tech**: procedural synth music/SFX, parallax, minimap, gamepad, Vite, Tauri

## Tests / tooling

- `npm run build` — Vite production bundle → `dist/`
- `src-tauri/` — Tauri desktop wrapper

## Data

All saves/settings are `localStorage`; Steam cloud saves kick in automatically when `steamworks.js` is injected (see `js/steam.js`).