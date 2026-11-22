# Abyssal Knight

[![Play Game](https://img.shields.io/badge/▶_PLAY_GAME-abyssal--knight.onrender.com-7928CA?style=for-the-badge&logo=googlechrome&logoColor=white)](https://abyssal-knight.onrender.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests: 136 Passed](https://img.shields.io/badge/Tests-136%20Passed%20(100%25)-brightgreen.svg)](test/verify_game.js)
[![Engine: HTML5 Canvas](https://img.shields.io/badge/Engine-Vanilla%20JS%20%2B%20Canvas-orange.svg)](app.js)
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Procedural%20%2B%20MP3%20(CC0)-purple.svg)](assets/sounds/)

> A dark, atmospheric 2D Action-Platformer / Metroidvania built from the ground up in pure vanilla JavaScript and HTML5 Canvas with zero runtime dependencies. Experience responsive directional melee combat, downward aerial pogo bouncing, an arcane spell system with freeze and shatter synergies, dynamic 2D lighting, and an epic multi-phase Void Lord boss encounter.

---

### 🎮 **[Click Here to Play Abyssal Knight in Your Browser](https://abyssal-knight.onrender.com/)**
*No installation, plugins, or setup required — instant loading directly in any modern browser.*

---

## Table of Contents

- [Features](#features)
- [Controls & Keybindings](#controls--keybindings)
- [Combat & Gameplay Mechanics](#combat--gameplay-mechanics)
  - [Aerial Pogo Bouncing](#1-aerial-pogo-bouncing)
  - [Unarmed Combat & Weapon Progression](#2-unarmed-combat--weapon-progression)
  - [Shatter Combat Synergy](#3-shatter-combat-synergy)
- [Ancient Unlockable Spells](#ancient-unlockable-spells)
- [World & Boss Encounters](#world--boss-encounters)
- [Audio Engine & Ambient Soundscapes](#audio-engine--ambient-soundscapes)
- [Automated Verification & Tests](#automated-verification--tests)
- [License](#license)

---

## Features

- **Instant Browser Play**: Zero compilation, zero dependencies, and lightweight WebP textures that load in milliseconds.
- **Responsive Directional Combat**: Hollow Knight-inspired 4-directional melee slashing with recoil physics, hit-pause freeze frames, and visceral particle feedback.
- **Aerial Pogo Bouncing**: Downward strikes on enemies and environmental spikes propel the knight upward, refreshing double-jump and dash cooldowns.
- **Unarmed & Multi-Weapon Arsenal**: Begin fighting bare-handed with armored gauntlets or find and wield the Old Nail, Coiled Greatsword, Quick Dagger, and Long Lance.
- **Arcane Spell Synergies**: Pyre Blast explosions, Frost Nova radial freezes, and Abyssal Singularity gravitational vortexes with bonus Shatter combo damage.
- **Dynamic 2D Lighting & Atmosphere**: Real-time canvas illumination with flickering bonfire flames, lantern glows, bioluminescent crystals, and ambient fog.
- **Bonfire Checkpoint System**: Dark Souls-style bonfires allowing full health replenishment, weapon switching, and world state restoration.
- **Multi-Phase Void Lord Boss**: Battle the master of the cathedral featuring shadow dash blinks, arena-wide void shockwaves, and anti-pogo countermeasures.
- **In-Game Tutorial & Tablet Lore**: Contextual on-screen prompts and ancient carved stone tablets introduce movement, evasion, combat, and healing.
- **Full Key Rebinding**: Rebind every action in real-time with custom key mappings persisted to browser storage.

---

## Controls & Keybindings

All controls can be customized at any time by pressing `ESC`.

| Action | Primary Key | Secondary Key / Mouse | Description |
| :--- | :--- | :--- | :--- |
| **Move Left / Right** | `←` / `→` | `A` / `D` | Smooth acceleration & deceleration |
| **Look / Aim Down** | `↓` | `S` | Aim downward slash in air / lower camera |
| **Jump** | `↑` | `Space` / `W` / `Z` | Variable height jump; double-jump in air |
| **Attack** | `X` | `J` / Left Click | Slash in facing direction (or Up / Down) |
| **Dash (Dodge Roll)** | `Ctrl` | `Shift` / `K` | High-speed dash with complete invulnerability (i-frames) |
| **Focus Heal** | `Q` | — | Hold to channel Soul and recover Health Hearts |
| **Down-Slash (Pogo)** | `↓` + `X` (in air) | `S` + Attack | Bounce off enemies, spikes, and projectiles |
| **Up-Slash** | `↑` + `X` | `W` + Attack | Upward anti-air swing |
| **Spell 1 (Pyre Blast)** | `1` | — | Cast fiery explosive projectile (Soul: 25) |
| **Spell 2 (Frost Nova)** | `2` | — | Cast 360° freezing radial frost wave (Soul: 30) |
| **Spell 3 (Singularity)**| `3` | — | Cast gravitational void vortex (Soul: 20) |
| **Next Weapon** | `R` | — | Cycle through collected weapons |
| **Direct Weapon Select**| `7`, `8`, `9`, `0` | — | Quick-equip weapon slot |
| **Interact / Rest** | `F` | — | Light and rest at Bonfires |
| **Toggle Help Overlay**| `H` | — | Display comprehensive in-game control reference |
| **Key Rebinding Menu** | `ESC` | — | Customize key bindings |

---

## Combat & Gameplay Mechanics

### 1. Aerial Pogo Bouncing
- Striking downwards (`↓ + Attack`) while airborne on an enemy, boss, or spike hazard bounces the knight upwards (`vy = jumpForce * 0.95`).
- **Balanced Mechanic**: Downward slashes are limited to **1 strike per airborne cycle**. Subsequent attacks default to horizontal slashes until landing on solid ground.
- Successful pogo bounces refresh the Double Jump (`Monarch Wings`) and Dash cooldown.

### 2. Unarmed Combat & Weapon Progression
- Players begin their journey without a blade, fighting bare-handed with armored gauntlets (`1 Damage`).
- Punching enemies generates Soul and enables full aerial pogo bounces without requiring a weapon.
- The primary blade (*Old Nail*) is enshrined on the Watchtower Roof altar. Explore further to locate the Coiled Greatsword, Quick Dagger, and Long Lance.

### 3. Shatter Combat Synergy
- Casting **Frost Nova** (`2`) freezes standard enemies for `2.0 seconds` and chills bosses (`50% slow`).
- Striking a frozen target with a melee attack or Pyre Blast projectile triggers **Shatter**:
  - Inflicts **+2 bonus damage** above weapon base damage.
  - Clears the freeze status and emits an icy crystalline particle explosion.

---

## Ancient Unlockable Spells

All spells begin sealed (`🔒`) and must be discovered by exploring the depths of the sunken ruins:

1. **Pyre Blast (Key: `1` | Soul Cost: `25`)**
   - *Location*: Sunken Canal (Far West Dead End, `x: 160, y: 1300`)
   - *Effect*: High-velocity projectile detonating in an `80px` AoE radius for `3 Damage`. Breaches Guard shields and stuns heavy targets.
2. **Frost Nova (Key: `2` | Soul Cost: `30`)**
   - *Location*: Sunken Belfry Ruins (`x: 2850, y: 1300`)
   - *Effect*: 360-degree radial frost explosion (`140px` radius). Freezes all nearby enemies for `2.0s` and chills bosses. Sets up the Shatter synergy.
3. **Abyssal Singularity (Key: `3` | Soul Cost: `20`)**
   - *Location*: Cathedral Sub-Crypt (`x: 5850, y: 1300`)
   - *Effect*: Spawns a floating Void Vortex (`2.4s` duration) pulling all targets within `160px` into its gravitational core. Deals periodic ticks and detonates in a collapsing implosion.

---

## World & Boss Encounters

- **Zone 1: The Forgotten Bastion & High Viaduct**: Crumbling gothic architecture, moving lift platforms, perched gargoyles, and ancient stone tutorial plaques.
- **Zone 2: Belfry Haven & Sunken Canal**: Underground waterways, hidden ledges, and return shortcuts connecting to the second resting bonfire.
- **Zone 3: Cathedral Nave & Void Lord Arena**: Grand transparent lancet windows and choir balconies set the stage for the climactic battle against the Void Lord.

---

## Audio Engine & Ambient Soundscapes

Abyssal Knight features a built-in Web Audio API sound engine with dynamic volume attenuation and zero third-party audio libraries:
- **Lightweight MP3 Streaming**: High-fidelity compressed exploration ambient music (`3.6 MB`) and dramatic orchestral boss themes (`2.1 MB`).
- **33 Procedural Physical SFX**: Footsteps, blade swings, flesh and armor impacts, pogo bounces, and magic detonations.
- **Dynamic Pitch Randomization**: Organic ±5–8% pitch variation on blade swings and impacts prevents audio fatigue.
- **Licensing & Provenance**: All audio assets are licensed under **Creative Commons Zero (CC0 1.0 Universal) / MIT** (see [AUDIO_LICENSES.md](AUDIO_LICENSES.md)).

---

## Automated Verification & Tests

The project includes an automated end-to-end test suite verifying kinematics, collision physics, combat synergies, audio hooks, and scenario walkthroughs:

```bash
node test/verify_game.js
```

### Test Suite Structure (136/136 Passing):
- **Tier 1: Feature Coverage (55/55)**: Bonfire reachability, lift kinematics, spell detonations, radial freezes, singularity pull, and shatter bonus.
- **Tier 2: Boundary & Corner Cases (56/56)**: Wall bounds, zero-damage attacks, stun locks, cooldown clamping, and Euclidean radial margins.
- **Tier 3: Cross-Feature Combinations (20/20)**: Multi-target combos, vortex into frost nova, pogo canceling into spell casts, and traversal loops.
- **Tier 4: Real-World Workload Scenarios (5/5)**: Continuous pilgrimage, deep canal return parkour, spell rotation combat, and 600-tick physics loop stress testing.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details. Audio assets are licensed under CC0 / MIT as documented in [AUDIO_LICENSES.md](AUDIO_LICENSES.md).
