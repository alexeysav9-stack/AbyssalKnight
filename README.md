# Abyssal Knight

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests: 136 Passed](https://img.shields.io/badge/Tests-136%20Passed%20(100%25)-brightgreen.svg)](test/verify_game.js)
[![Engine: HTML5 Canvas](https://img.shields.io/badge/Engine-Vanilla%20JS%20%2B%20Canvas-orange.svg)](app.js)
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Procedural%20WAV%20(CC0)-purple.svg)](assets/sounds/)

A dark, atmospheric 2D Action-Platformer / Metroidvania built from the ground up in pure vanilla JavaScript and HTML5 Canvas with zero runtime frontend dependencies. Experience responsive directional melee combat, downward pogo bouncing, an arcane spell system with freeze and shatter synergies, dynamic 2D lighting, and multi-tier boss encounters.

---

## Table of Contents

- [Features](#features)
- [Default Controls](#default-controls)
- [Combat & Gameplay Mechanics](#combat--gameplay-mechanics)
- [Ancient Unlockable Spells](#ancient-unlockable-spells)
- [Getting Started & Running Locally](#getting-started--running-locally)
- [Production Deployment](#production-deployment)
  - [FastAPI ASGI Server](#1-fastapi-asgi-server-recommended)
  - [Docker & Docker Compose](#2-docker--docker-compose)
  - [Static Web Server (Nginx / Caddy / Cloudflare Pages)](#3-static-hosting-nginx--caddy--cloudflare-pages)
- [Audio Engine & Provenance](#audio-engine--provenance)
- [Automated Verification & Tests](#automated-verification--tests)

---

## Features

- **Responsive Directional Combat**: Hollow Knight-inspired 4-directional melee slashing with recoil physics, hit-pause freeze frames, and particle feedback.
- **Aerial Pogo Bouncing**: Downward strikes on enemies and environmental spikes propel the knight upward with refreshed double-jump and dash cooldowns.
- **Unarmed & Multi-Weapon Arsenal**: Fight bare-handed with armored gauntlets or wield found weapons including the Old Nail, Coiled Greatsword, Quick Dagger, and Long Lance.
- **Arcane Spell Synergies**: Pyre Blast explosions, Frost Nova radial freezes, and Abyssal Singularity gravitational vortexes with Shatter combo bonus damage.
- **Dynamic 2D Lighting & Atmosphere**: Real-time canvas lighting mask with flickering bonfire flames, lantern glows, bioluminescent crystals, and ambient fog.
- **Bonfire Checkpoint System**: Dark Souls-style bonfires allowing full health replenishment, weapon switching, and world state restoration.
- **Epic Multi-Phase Boss Encounter**: Battle the Void Lord featuring shadow dash blinks, arena-wide void ground shockwaves, and anti-pogo countermeasures.
- **Full In-Game Tutorial**: Contextual on-screen guidance and ancient carved stone tablets introduce movement, evasion, combat, and healing.
- **Full Key Rebinding**: Rebind every action in real-time with custom key mapping persisted to browser storage.

---

## Default Controls

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
| **Toggle Help Overlay**| `H` | — | Display comprehensive control reference |
| **Key Rebinding Menu** | `ESC` | — | Customize key bindings |

---

## Combat & Gameplay Mechanics

### 1. Pogo Bouncing (Air Balance)
- Striking downwards (`↓ + Attack`) while airborne on an enemy, boss, or spike hazard bounces the knight upwards (`vy = jumpForce * 0.95`).
- **Balanced Mechanic**: Downward slashes are limited to **1 hit per airborne cycle**. Subsequent attacks default to horizontal slashes until landing on solid ground.
- Pogo bounces refresh the Double Jump (`Monarch Wings`) and Dash cooldown.

### 2. Unarmed Combat
- Players start without a blade, fighting with bare armored gauntlets (`1 Damage`).
- Punching enemies yields full soul generation and pogo capabilities without requiring a weapon.
- The primary blade (*Old Nail*) is enshrined on the Watchtower Roof altar.

### 3. Shatter Combat Synergy
- Casting **Frost Nova** freezes standard enemies for `2.0 seconds` and chills bosses (`50% slow`).
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

## Getting Started & Running Locally

### Option A: Using the Included Python Server (Fastest)

```bash
# Clone the repository
git clone https://github.com/your-username/abyssal-knight.git
cd "abyssal-knight"

# Run the server (auto-detects FastAPI or runs built-in HTTP server)
python3 server.py
```
Open **`http://localhost:8000`** in your browser.

### Option B: Node.js / npx

```bash
npx serve .
# or
npm install && npm start
```

### Option C: Standard Python HTTP Module

```bash
python3 -m http.server 8000
```

---

## Production Deployment

### 1. FastAPI ASGI Server (Recommended)

Abyssal Knight includes a production-grade FastAPI server with GZip compression, CORS handling, and healthcheck routes.

```bash
# Install production requirements
pip install -r requirements.txt

# Launch with Uvicorn (multi-worker configuration)
uvicorn server:app --host 0.0.0.0 --port 8000 --workers 4
```

API Endpoints:
- `GET /` — Serves the game application
- `GET /health` — Health check endpoint (`{"status": "ok", "app": "Abyssal Knight"}`)
- `GET /api/info` — Game metadata, controls schema, and features

### 2. Docker & Docker Compose

Deploy the self-contained container with a single command:

```bash
# Using Docker Compose
docker compose up -d

# Or build and run standalone Docker container
docker build -t abyssal-knight:latest .
docker run -d -p 8000:8000 --name abyssal-knight abyssal-knight:latest
```

The container includes automated health checking on `http://localhost:8000/health`.

### 3. Static Hosting (Nginx / Caddy / Cloudflare Pages)

Because Abyssal Knight is pure HTML5 Canvas & Web Audio API, it can be hosted on any static edge provider (Cloudflare Pages, Vercel, Netlify, GitHub Pages) or behind Nginx:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/abyssal-knight;
    index index.html;

    # Enable Gzip compression
    gzip on;
    gzip_types text/html application/javascript text/css audio/wav image/png;

    # Static asset caching
    location ~* \.(png|wav|ico)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Audio Engine & Provenance

The game features an internal **AudioEngine** with 33 custom procedural sound effects:
- **Audio Context Management**: Decodes PCM audio into reusable buffers via Web Audio API with seamless procedural synthesizer fallbacks.
- **Dynamic Pitch Randomization**: Organic ±5–8% pitch variation on blade swings and impacts prevents repetitive audio fatigue.
- **Dual-Layer Ambient Soundscapes**: Independent background music loops for exploration and the boss arena with smooth audio crossfading.
- **Licensing & Provenance**: All 33 audio files are procedurally generated and documented under the **Creative Commons Zero (CC0 1.0 Universal) / MIT** license in [AUDIO_LICENSES.md](AUDIO_LICENSES.md).

To regenerate or customize sounds, execute:
```bash
python3 scripts/generate_sounds.py
```

---

## Automated Verification & Tests

The project includes an end-to-end automated test harness covering level geometry, player kinematics, audio triggers, combat synergies, and edge cases with zero external test runners:

```bash
node test/verify_game.js
```

### Test Suite Structure (136/136 Passing):
- **Tier 1: Feature Coverage (55/55)**: Bonfire reachability, lift kinematics, spell detonations, radial freezes, singularity pull, and shatter bonus.
- **Tier 2: Boundary & Corner Cases (56/56)**: Wall bounds, zero-damage attacks, stun locks, cooldown clamping, and Euclidean radial margins.
- **Tier 3: Cross-Feature Combinations (20/20)**: Multi-target combos, vortex into frost nova, pogo canceling into spell casts, and traversal loops.
- **Tier 4: Real-World Workload Scenarios (5/5)**: Continuous pilgrimage, deep canal return parkour, spell rotation combat, and 600-tick loop stress testing.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details. Audio assets are licensed under CC0 / MIT as documented in [AUDIO_LICENSES.md](AUDIO_LICENSES.md).
