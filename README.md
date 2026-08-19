# ⚔️ EMBERQUEST 2D

**A six-level action RPG. Slay the Void Sovereign and save the realm.**

Move with WASD, swing your sword, dash through danger, and climb from the Forest of Fangmoor to the Void Throne across 6 handcrafted levels — each with its own enemies, a boss, and a campfire merchant between fights.

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `WASD` / Arrows | Move |
| `SPACE` | Attack with your equipped weapon |
| `SHIFT` | Dash (brief invincibility) |
| `E` | Drink a potion |
| `1`–`4` or `Q` | Switch weapons |
| `P` / `ESC` | Pause |
| `M` | Toggle sound |

## ✨ Features

- **6 levels** — Fangmoor, the Hollow Depths, the Dragon's Lair, the Frozen Spire, the Hollow Court, and the Void Throne
- **10 enemy archetypes** — chasers, kiting shooters, suicide bombers, telegraphed chargers, teleporting phantoms, chilling freezers, summoners, elites, and 6 unique bosses
- **4 weapons** — Sword, Wave Blade (shockwave), Crossbow (rapid bolts), Ember Staff (explosive fireball)
- **Campfire merchant** — buy potions, stat upgrades, and new weapons between levels
- **Loot system** — gold, potions, herbs, sharpening stones, crit charms, and guard runes
- **Secrets** — a flickering candle and an old legendary code hide in the realm
- **Progression** — level up your sword and armor, grow max HP, and face enraged boss phases
- **Zero dependencies** — plain HTML5 Canvas + vanilla JavaScript, no build step, no assets to download

## 🎮 Play

Open `index.html` in any modern browser, or play the live build.

## 🧪 Verification

The game ships with a headless smoke test that plays a full run — all 6 levels, bosses, shop, every weapon, easter eggs, win, death, and reset:

```bash
node tests/smoke-test.mjs
```

Expected output: `42 passed, 0 failed, 0 runtime errors`.

## 📁 Project structure

```
├── index.html          # Game page
├── css/style.css       # UI styling
├── js/
│   ├── config.js       # Constants, enemy archetypes, level layouts, weapons
│   ├── sfx.js          # Tiny WebAudio synth (zero assets)
│   ├── entities.js     # Player, Enemy, Projectile, Wave, Pickup
│   ├── weapons.js      # Attack implementations
│   ├── render.js       # Canvas rendering
│   └── game.js         # Game state, input, update loop
└── tests/
    └── smoke-test.mjs  # Headless full-playthrough verification
```

## 📄 License

MIT