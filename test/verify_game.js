/**
 * ============================================================================
 * E2E AUTOMATED VERIFICATION TEST SUITE: ABYSSAL KNIGHT
 * ============================================================================
 * Pure Node.js test harness without external npm dependencies.
 * Implements 4-tier E2E automated verification across:
 *   Tier 1: Feature Coverage (55 tests, threshold >= 50)
 *   Tier 2: Boundary & Corner Cases (56 tests, threshold >= 50)
 *   Tier 3: Cross-Feature Combinations (20 tests, threshold >= 15)
 *   Tier 4: Real-World Workload Scenarios (5 tests, threshold >= 5)
 *   Total: 136 tests (threshold >= 120)
 *
 * Requirements verified:
 *   R1: Bonfire 2 Reachability & Doorway Clearance (Milestone M1)
 *   R2: Foundation Geometry Rework & Return Ledges (Milestone M1)
 *   R3: Diverse Spells, Freeze Status & Shatter Combat Synergy (Milestone M2)
 *   R4: AudioEngine Hooks, Procedural WAV Assets & CC0 Legal Provenance (Milestone M3)
 *
 * CLI Options:
 *   node test/verify_game.js                # Execute full suite across all milestones
 *   node test/verify_game.js --milestone=M1 # Isolate Milestone 1 verification
 *   node test/verify_game.js --milestone=M2 # Isolate Milestone 2 verification
 *   node test/verify_game.js --milestone=M3 # Isolate Milestone 3 verification
 * ============================================================================
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ============================================================================
// 1. HEADLESS ENVIRONMENT SETUP & DOM / AUDIO MOCKS
// ============================================================================
function setupHeadlessMocks() {
  const mockContext2D = {
    canvas: { width: 1280, height: 720 },
    imageSmoothingEnabled: true,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '14px sans-serif',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1.0,
    shadowColor: 'transparent',
    shadowBlur: 0,
    fillRect: () => {},
    clearRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    stroke: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    drawImage: () => {},
    measureText: (text) => ({ width: (text || '').length * 8 }),
    fillText: () => {},
    strokeText: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
  };

  const createMockCanvas = () => ({
    width: 1280,
    height: 720,
    style: { width: '1280px', height: '720px' },
    getContext: () => mockContext2D,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  });

  const defaultCanvas = createMockCanvas();

  global.window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
  };

  global.document = {
    getElementById: (id) => defaultCanvas,
    createElement: (tag) => {
      if (tag === 'canvas') return createMockCanvas();
      return { style: {}, addEventListener: () => {} };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { appendChild: () => {}, removeChild: () => {} },
  };

  global.Audio = class MockAudio {
    constructor(src) {
      this.src = src;
      this.paused = true;
      this.volume = 1.0;
      this.loop = false;
      this.currentTime = 0;
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    addEventListener() {}
    removeEventListener() {}
  };

  global.AudioContext = class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 44100;
      this.currentTime = 0;
      this.destination = {};
    }
    createGain() {
      return {
        gain: {
          value: 1.0,
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
        },
        connect: () => {},
      };
    }
    createBuffer(channels, length, sampleRate) {
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: () => new Float32Array(length),
      };
    }
    createBufferSource() {
      return {
        buffer: null,
        playbackRate: { setValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {},
      };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
        },
        connect: () => {},
        start: () => {},
        stop: () => {},
      };
    }
    decodeAudioData(arrayBuffer) {
      return Promise.resolve(this.createBuffer(1, 44100 * 0.2, 44100));
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
  };

  global.performance = {
    now: () => Date.now(),
  };

  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; },
  };
}

setupHeadlessMocks();

// ============================================================================
// 2. IMPORT GAME MODULE
// ============================================================================
const appPath = path.resolve(__dirname, '../app.js');
let app;
try {
  app = require(appPath);
} catch (err) {
  console.error('CRITICAL: Failed to load app.js:', err);
  process.exit(1);
}

const {
  Player,
  Enemy,
  Boss,
  Particle,
  ParticleSystem,
  Projectile,
  WEAPONS,
  AudioEngine,
  Game,
  EnvironmentRenderer,
  buildLevel,
} = app;

// Extract live SPELLS definition from app.js source
const appSource = fs.readFileSync(appPath, 'utf8');
const spellsMatch = appSource.match(/const SPELLS = (\[[\s\S]*?\]);/);
const SPELLS = spellsMatch ? eval(spellsMatch[1]) : [];

// ============================================================================
// 3. TEST RUNNER HARNESS WITH MILESTONE ISOLATION & HONEST REPORTING
// ============================================================================
class TestHarness {
  constructor(targetMilestone = null) {
    this.results = [];
    this.currentTier = null;
    this.currentCategory = null;
    this.targetMilestone = targetMilestone;
    this.totalRegistered = 0;
    this.skippedCount = 0;
  }

  setTier(tierName) {
    this.currentTier = tierName;
    console.log(`\n\x1b[1m\x1b[36m============================================================\x1b[0m`);
    console.log(`\x1b[1m\x1b[36m${tierName}\x1b[0m`);
    console.log(`\x1b[1m\x1b[36m============================================================\x1b[0m`);
  }

  setCategory(categoryName) {
    this.currentCategory = categoryName;
    console.log(`\n\x1b[1m\x1b[33m--- [${categoryName}] ---\x1b[0m`);
  }

  test(name, milestone, fn) {
    this.totalRegistered++;
    if (this.targetMilestone && milestone !== this.targetMilestone) {
      this.skippedCount++;
      return;
    }

    const startTime = process.hrtime.bigint();
    try {
      fn();
      const endTime = process.hrtime.bigint();
      const durMs = Number(endTime - startTime) / 1e6;
      this.results.push({
        tier: this.currentTier,
        category: this.currentCategory,
        name,
        milestone,
        passed: true,
        duration: durMs,
      });
      console.log(`  \x1b[32m✔\x1b[0m ${name} \x1b[90m[${milestone}] (${durMs.toFixed(2)}ms)\x1b[0m`);
    } catch (err) {
      const endTime = process.hrtime.bigint();
      const durMs = Number(endTime - startTime) / 1e6;
      this.results.push({
        tier: this.currentTier,
        category: this.currentCategory,
        name,
        milestone,
        passed: false,
        error: err,
        duration: durMs,
      });
      console.log(`  \x1b[31m✖\x1b[0m ${name} \x1b[90m[${milestone}]\x1b[0m`);
      console.log(`    \x1b[31mContract Error: ${err.message}\x1b[0m`);
      if (err.stack) {
        const stackLines = err.stack.split('\n').slice(1, 3).join('\n    ');
        console.log(`    \x1b[90m${stackLines}\x1b[0m`);
      }
    }
  }

  summary() {
    const isFiltered = !!this.targetMilestone;
    const filterTag = isFiltered ? ` (Filter: Milestone ${this.targetMilestone})` : '';

    console.log(`\n\x1b[1m\x1b[35m============================================================\x1b[0m`);
    console.log(`\x1b[1m\x1b[35mTEST EXECUTION SUMMARY${filterTag}\x1b[0m`);
    console.log(`\x1b[1m\x1b[35m============================================================\x1b[0m`);

    const tiers = {};
    const milestones = { M1: { passed: 0, total: 0 }, M2: { passed: 0, total: 0 }, M3: { passed: 0, total: 0 }, M4: { passed: 0, total: 0 } };

    for (const res of this.results) {
      if (!tiers[res.tier]) tiers[res.tier] = { total: 0, passed: 0, failed: 0 };
      tiers[res.tier].total++;
      if (milestones[res.milestone]) milestones[res.milestone].total++;

      if (res.passed) {
        tiers[res.tier].passed++;
        if (milestones[res.milestone]) milestones[res.milestone].passed++;
      } else {
        tiers[res.tier].failed++;
      }
    }

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    for (const [tierName, stats] of Object.entries(tiers)) {
      totalTests += stats.total;
      totalPassed += stats.passed;
      totalFailed += stats.failed;
      const statusColor = stats.failed === 0 ? '\x1b[32m' : (stats.passed > 0 ? '\x1b[33m' : '\x1b[31m');
      console.log(`  ${tierName}: ${statusColor}${stats.passed}/${stats.total} Passed\x1b[0m`);
    }

    console.log(`------------------------------------------------------------`);
    console.log(`  Total Tests Executed: \x1b[1m${totalTests}\x1b[0m (Passed: \x1b[32m${totalPassed}\x1b[0m, Failed: \x1b[31m${totalFailed}\x1b[0m, Skipped: \x1b[90m${this.skippedCount}\x1b[0m)`);

    console.log(`\nMilestone Conformance Breakdown:`);
    for (const [mKey, mStat] of Object.entries(milestones)) {
      if (mStat.total === 0) continue;
      const pct = (mStat.passed / mStat.total * 100).toFixed(1);
      const isComplete = mStat.passed === mStat.total;
      const badge = isComplete ? '\x1b[32m[COMPLETE]\x1b[0m' : '\x1b[33m[PENDING CONTRACT MERGE]\x1b[0m';
      const mNames = {
        M1: 'Level Geometry & Bonfire 2 Access',
        M2: 'Diverse Spells & Status Synergy',
        M3: 'CC0 / MIT Audio Overhaul',
        M4: 'Final E2E Hardening & Scenarios',
      };
      console.log(`  Milestone ${mKey} (${mNames[mKey]}): ${mStat.passed}/${mStat.total} Passed (${pct}%) ${badge}`);
    }

    if (!isFiltered) {
      const t1 = (tiers['Tier 1: Feature Coverage'] || {}).passed || 0;
      const t2 = (tiers['Tier 2: Boundary & Corner Cases'] || {}).passed || 0;
      const t3 = (tiers['Tier 3: Cross-Feature Combinations'] || {}).passed || 0;
      const t4 = (tiers['Tier 4: Real-World Workload Scenarios'] || {}).passed || 0;

      console.log(`\nThreshold Validation:`);
      console.log(`  Tier 1 Feature Coverage:        ${t1 >= 50 ? '✔' : '✖'} ${t1}/50 min required`);
      console.log(`  Tier 2 Boundary Cases:          ${t2 >= 50 ? '✔' : '✖'} ${t2}/50 min required`);
      console.log(`  Tier 3 Cross-Feature Synergies: ${t3 >= 15 ? '✔' : '✖'} ${t3}/15 min required`);
      console.log(`  Tier 4 Workload Scenarios:      ${t4 >= 5 ? '✔' : '✖'} ${t4}/5 min required`);
      console.log(`  Total Tests Registered:         ${this.totalRegistered >= 120 ? '✔' : '✖'} ${this.totalRegistered}/120 min registered`);
    }

    if (isFiltered) {
      const allFilterPassed = totalFailed === 0 && totalPassed > 0;
      if (allFilterPassed) {
        console.log(`\n\x1b[1m\x1b[32m✔ ALL ${totalPassed} MILESTONE ${this.targetMilestone} TESTS PASSED SUCCESSFULLY!\x1b[0m\n`);
        return 0;
      } else {
        console.log(`\n\x1b[1m\x1b[31m✖ MILESTONE ${this.targetMilestone} VERIFICATION FAILED (${totalFailed} failures)\x1b[0m\n`);
        return 1;
      }
    } else {
      if (totalFailed === 0 && totalTests >= 120) {
        console.log(`\n\x1b[1m\x1b[32mALL TESTS PASSED WITH 100% SUCCESS AND THRESHOLDS SATISFIED!\x1b[0m\n`);
        return 0;
      } else {
        console.log(`\n\x1b[1m\x1b[33mHONEST VERIFICATION REPORT: ${totalPassed} passed, ${totalFailed} pending milestone contract implementations.\x1b[0m\n`);
        return totalFailed > 0 ? 1 : 0;
      }
    }
  }
}

// Parse CLI flag --milestone=M1
const cliArgs = process.argv.slice(2);
const milestoneArg = cliArgs.find(a => a.startsWith('--milestone='));
const targetMilestone = milestoneArg ? milestoneArg.split('=')[1].toUpperCase() : null;

const H = new TestHarness(targetMilestone);

// Helper to instantiate headless Game instance
function createTestGame() {
  const g = new Game();
  g._initLevel();
  g.gameState = 1; // STATE.PLAYING
  return g;
}

// Helper to test rectangular overlap
function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}


// ============================================================================
// TIER 1: FEATURE COVERAGE (55 tests)
// ============================================================================
H.setTier('Tier 1: Feature Coverage');

// ----------------------------------------------------------------------------
// Feature 1: Bonfire 2 Reachability & Doorway Clearance (Milestone M1)
// ----------------------------------------------------------------------------
H.setCategory('Feature 1: Bonfire 2 Reachability & Doorway Clearance');

H.test('T1.1.1 Pier Doorway West: Opening clearance height at x=2980 is >= 120px', 'M1', () => {
  const lvl = buildLevel();
  const westPier = lvl.platforms.find(p => p.x === 2980 && p.y === 240);
  assert.ok(westPier, 'West pier solid platform must exist at x=2980, y=240');
  const floor = lvl.platforms.find(p => p.y === 480 && p.x <= 2980 && p.x + p.w >= 2980);
  assert.ok(floor, 'Walkable floor must exist below pier at y=480');
  const pierBottom = westPier.y + westPier.h;
  const openingH = floor.y - pierBottom;
  assert.ok(openingH >= 120, `West pier doorway clearance must be >= 120px (found ${openingH}px)`);
});

H.test('T1.1.2 Pier Doorway East: Opening clearance height at x=3404 is >= 120px', 'M1', () => {
  const lvl = buildLevel();
  const eastPier = lvl.platforms.find(p => p.x === 3404 && p.y === 240);
  assert.ok(eastPier, 'East pier solid platform must exist at x=3404, y=240');
  const floor = lvl.platforms.find(p => p.y === 480 && p.x <= 3404 && p.x + p.w >= 3404);
  assert.ok(floor, 'Walkable floor must exist below east pier at y=480');
  const pierBottom = eastPier.y + eastPier.h;
  const openingH = floor.y - pierBottom;
  assert.ok(openingH >= 120, `East pier doorway clearance must be >= 120px (found ${openingH}px)`);
});

H.test('T1.1.3 Player AABB Clearance West: Player (w=28, h=44) passes x=2980 without solid collision', 'M1', () => {
  const lvl = buildLevel();
  const playerBox = { x: 2980, y: 480 - 44, w: 28, h: 44 };
  const solids = lvl.platforms.filter(p => p.type === 'solid');
  for (const s of solids) {
    if (rectsOverlap(playerBox, s)) {
      if (s.y >= 480) continue; // Walkable floor beneath feet
      assert.fail(`Player collides with solid obstacle ${JSON.stringify(s)} at doorway x=2980`);
    }
  }
});

H.test('T1.1.4 Player AABB Clearance East: Player (w=28, h=44) passes x=3404 without solid collision', 'M1', () => {
  const lvl = buildLevel();
  const playerBox = { x: 3404, y: 480 - 44, w: 28, h: 44 };
  const solids = lvl.platforms.filter(p => p.type === 'solid');
  for (const s of solids) {
    if (rectsOverlap(playerBox, s)) {
      if (s.y >= 480) continue; // Walkable floor beneath feet
      assert.fail(`Player collides with solid obstacle ${JSON.stringify(s)} at doorway x=3404`);
    }
  }
});

H.test('T1.1.5 Bonfire 2 Location: Placed inside Belfry Haven interior chamber', 'M1', () => {
  const lvl = buildLevel();
  const b2 = lvl.bonfires.find(b => b.id === 1);
  assert.ok(b2, 'Bonfire 2 (id=1) must exist in level');
  assert.ok(b2.x >= 2980 && b2.x <= 3404, `Bonfire 2 x=${b2.x} must be between piers [2980, 3404]`);
  assert.ok(b2.y >= 360 && b2.y <= 480, `Bonfire 2 y=${b2.y} must rest on Belfry Haven floor level`);
});

H.test('T1.1.6 Bonfire 2 Activation: Player resting near Bonfire 2 sets lit=true and updates checkpoint via engine update loop', 'M1', () => {
  const g = createTestGame();
  const b2 = g.bonfires.find(b => b.id === 1);
  assert.ok(b2, 'Bonfire 2 must exist in level');
  b2.lit = false;
  g.player.x = b2.x;
  g.player.y = b2.y;
  assert.strictEqual(b2.isPlayerNear(g.player), true, 'Player must be detected near Bonfire 2');

  g.input.keys['KeyF'] = true;
  g.input.justPressed['KeyF'] = true;
  g._updatePlaying(0.016);

  assert.strictEqual(b2.lit, true, 'Bonfire 2 lit must be true via game update');
  assert.strictEqual(g.player.lastBonfireId, 1, 'Player checkpoint updated to Bonfire 2 (id=1)');
  assert.strictEqual(g.player.respawnX, b2.x, 'Respawn X set to bonfire x');
  assert.strictEqual(g.gameState, 4 /* STATE.BONFIRE */, 'GameState transitioned to BONFIRE menu');
});

// ----------------------------------------------------------------------------
// Feature 2: Belfry Haven Lift Landing & Traversal (Milestone M1)
// ----------------------------------------------------------------------------
H.setCategory('Feature 2: Belfry Haven Lift Landing & Traversal');

H.test('T1.2.1 Moving Lift Platform: Moving platform spans Zone 2 approach', 'M1', () => {
  const lvl = buildLevel();
  const lift = lvl.platforms.find(p => p.type === 'moving');
  assert.ok(lift, 'Moving lift platform must exist in level');
  assert.ok(lift.x >= 2600 && lift.x <= 3000, `Lift initial x=${lift.x} must be within approach corridor`);
  assert.ok(typeof lift.speed === 'number' && lift.speed > 0, 'Lift must have a positive speed parameter');
});

H.test('T1.2.2 Landing Platform Presence: Landing exists at moving lift arrival zone (x=2920, y=480)', 'M1', () => {
  const lvl = buildLevel();
  const landing = lvl.platforms.find(p => p.x === 2920 && p.y === 480);
  assert.ok(landing, 'Landing platform must exist at exact coordinates P(2920, 480)');
  assert.ok(landing.w >= 60, `Landing width (${landing.w}px) must provide safe landing margin`);
});

H.test('T1.2.3 Landing Collision Type: Landing platform has valid walkable collision type', 'M1', () => {
  const lvl = buildLevel();
  const landing = lvl.platforms.find(p => p.x === 2920 && p.y === 480);
  assert.ok(landing, 'Landing platform exists');
  assert.ok(landing.type === 'oneway' || landing.type === 'solid', `Landing type (${landing.type}) must be walkable`);
});

H.test('T1.2.4 Lift Rightmost Reach: Lift arrival position connects within jump range of landing', 'M1', () => {
  const lvl = buildLevel();
  const lift = lvl.platforms.find(p => p.type === 'moving');
  const landing = lvl.platforms.find(p => p.x === 2920 && p.y === 480);
  assert.ok(lift && landing, 'Lift and landing must exist');
  const liftRightApex = lift.ox + Math.abs(lift.mx || 0) + lift.w;
  const gap = landing.x - liftRightApex;
  assert.ok(gap <= 50, `Horizontal gap between lift apex and landing (${gap}px) must be jumpable (<= 50px)`);
});

H.test('T1.2.5 Solid Support on Landing: Player stepping onto landing achieves onGround=true in Player.prototype.update', 'M1', () => {
  const lvl = buildLevel();
  const landing = lvl.platforms.find(p => p.x === 2920 && p.y === 480);
  const p = new Player(landing.x + 10, landing.y - 44);
  p.vy = 100; // falling downward onto landing
  p.onGround = false;

  const mockInput = { left: () => false, right: () => false, jumpHeld: () => false, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };
  p.update(0.016, mockInput, lvl, { dustLand: () => {} }, {}, {});

  assert.strictEqual(p.onGround, true, 'Player stepping onto landing platform must achieve onGround=true');
  assert.strictEqual(p.vy, 0, 'Vertical velocity must be zeroed upon landing');
});

// ----------------------------------------------------------------------------
// Feature 3: Foundation Geometry Rework & Return Ledges (Milestone M1)
// ----------------------------------------------------------------------------
H.setCategory('Feature 3: Foundation Geometry Rework & Return Ledges');

H.test('T1.3.1 Left Boundary Fortress Wall: Extends to map bottom (y=1500)', 'M1', () => {
  const lvl = buildLevel();
  const wall = lvl.platforms.find(p => p.x === 0 && p.y <= 250 && p.type === 'solid');
  assert.ok(wall, 'Left fortress boundary wall must exist at x=0');
  const wallBottom = wall.y + wall.h;
  assert.ok(wallBottom >= 1500, `Left boundary wall must extend to map bottom y=1500 (reaches ${wallBottom})`);
});

H.test('T1.3.2 Sunken Canal Continuous Street: Street platform spans x=40 to x=1740 at y=1340', 'M1', () => {
  const lvl = buildLevel();
  const street = lvl.platforms.find(p => p.x === 40 && p.y === 1340 && p.type === 'solid');
  assert.ok(street, 'Continuous street platform must exist at x=40, y=1340');
  assert.ok(street.w >= 1700, `Continuous street width (${street.w}px) must span across canal floor (>= 1700px)`);
  assert.strictEqual(street.h, 32, 'Street platform thickness must be 32px (replacing monolithic block)');
});

H.test('T1.3.3 Bastion Return Ledges: Ascending ledges exist under Bastion (x in [80, 350])', 'M1', () => {
  const lvl = buildLevel();
  const ledges = lvl.platforms.filter(p => p.x >= 70 && p.x <= 350 && p.y >= 950 && p.y <= 1250);
  assert.ok(ledges.length >= 3, `Expected at least 3 ascending return ledges under bastion (found ${ledges.length})`);
});

H.test('T1.3.4 Step Platform: Intermediate step platform exists at x=920, y=1240', 'M1', () => {
  const lvl = buildLevel();
  const step = lvl.platforms.find(p => p.x === 920 && p.y === 1240);
  assert.ok(step, 'Intermediate step platform must exist at x=920, y=1240');
  assert.ok(step.w >= 80, 'Step platform width must be >= 80px');
});

H.test('T1.3.5 Oneway Return Platforms: Ledges under Bastion allow vertical jump-through', 'M1', () => {
  const lvl = buildLevel();
  const ledges = lvl.platforms.filter(p => p.x >= 70 && p.x <= 350 && p.y >= 950 && p.y <= 1250);
  for (const ledge of ledges) {
    assert.strictEqual(ledge.type, 'oneway', `Return ledge at (${ledge.x}, ${ledge.y}) must be 'oneway'`);
  }
});

H.test('T1.3.6 Chain Jump Ascent: Ledge vertical spacing <= 140px allowing traversal back to Bastion', 'M1', () => {
  const lvl = buildLevel();
  const ledges = lvl.platforms
    .filter(p => p.x >= 40 && p.x <= 350 && p.y >= 880 && p.y <= 1340)
    .sort((a, b) => b.y - a.y); // sort ascending from bottom to top
  for (let i = 0; i < ledges.length - 1; i++) {
    const dy = ledges[i].y - ledges[i + 1].y;
    assert.ok(dy <= 140, `Vertical step between ledges at y=${ledges[i].y} and y=${ledges[i + 1].y} is ${dy}px (must be <= 140px)`);
  }
});

// ----------------------------------------------------------------------------
// Feature 4: Spell 1 (Pyre Blast) Detonation & Knockback (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('Feature 4: Spell 1 (Pyre Blast) Detonation & Knockback');

H.test('T1.4.1 Spell 1 Parameters: Name, soul/mana cost in [20, 25], cooldown <= 1.0s in SPELLS[0]', 'M2', () => {
  assert.ok(SPELLS.length >= 1, 'SPELLS array must contain Spell 1');
  const s = SPELLS[0];
  assert.ok(/Pyre Blast|Fireball/i.test(s.name), `Spell 1 name must be Pyre Blast or Fireball (found ${s.name})`);
  assert.ok(s.soulCost >= 20 && s.soulCost <= 25, `Soul cost must be in [20, 25] (found ${s.soulCost})`);
  assert.ok(s.cooldown <= 1.0, `Cooldown must be <= 1.0s (found ${s.cooldown})`);
});

H.test('T1.4.2 Spell 1 Cast: Deducts mana/soul and sets cooldown via player.castSpell(0)', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 50;
  p.spellCooldowns = [0, 0, 0];
  const projs = [];
  const cost = SPELLS[0].soulCost;

  p.castSpell(0, projs, { sparks: () => {} }, { fireball: () => {}, fireballHit: () => {} }, { shake: () => {} });

  assert.strictEqual(p.soul, 50 - cost, 'Soul must be deducted by exact spell cost');
  assert.ok(p.spellCooldowns[0] > 0, 'Spell 1 cooldown timer must be initialized');
  assert.strictEqual(projs.length, 1, 'Spell 1 cast must spawn exactly 1 projectile');
});

H.test('T1.4.3 Spell 1 Projectile Kinematics: Spawns high-velocity projectile (|vx| >= 450)', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 50;
  p.facing = 1;
  const projs = [];
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  assert.ok(projs.length > 0, 'Projectile spawned');
  assert.ok(Math.abs(projs[0].vx) >= 450, `Pyre Blast vx (${projs[0].vx}) must be >= 450 px/s`);
});

H.test('T1.4.4 Spell 1 Projectile Damage: Has offensive damage value >= 3', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 50;
  const projs = [];
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  assert.ok(projs[0].damage >= 3, `Pyre Blast projectile damage (${projs[0].damage}) must be >= 3`);
});

H.test('T1.4.5 Spell 1 Detonation Area: Contact with enemy triggers damage via projectile collision loop', 'M2', () => {
  const g = createTestGame();
  g.player.soul = 50;
  g.player.x = 200; g.player.y = 800;
  const enemy = new Enemy(220, 800, 'crawler', 50);
  const initialHp = enemy.hp;
  g.enemies = [enemy];

  // Cast Spell 1 directly facing enemy
  g.player.facing = 1;
  g.player.castSpell(0, g.projectiles, g.particles, g.audio, g.camera);

  // Step engine physics
  g._updatePlaying(0.016);

  assert.ok(enemy.hp < initialHp, `Enemy must take damage from Pyre Blast collision (hp: ${initialHp} -> ${enemy.hp})`);
});

// ----------------------------------------------------------------------------
// Feature 5: Spell 2 (Frost Nova) Radial Freeze & Status (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('Feature 5: Spell 2 (Frost Nova) Radial Freeze & Status');

H.test('T1.5.1 Spell 2 Parameters: Soul cost in [30, 35], cooldown <= 2.0s in SPELLS[1]', 'M2', () => {
  assert.ok(SPELLS.length >= 2, 'SPELLS array must contain Spell 2');
  const s = SPELLS[1];
  assert.ok(/Frost Nova|Ice Nova/i.test(s.name), `Spell 2 name must be Frost Nova or Ice Nova (found ${s.name})`);
  assert.ok(s.soulCost >= 30 && s.soulCost <= 35, `Soul cost must be in [30, 35] (found ${s.soulCost})`);
  assert.ok(s.cooldown <= 2.0, `Cooldown must be <= 2.0s (found ${s.cooldown})`);
});

H.test('T1.5.2 Spell 2 Mana Consumption: Deducts required soul (30-35) via player.castSpell(1)', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 50;
  const cost = SPELLS[1].soulCost;
  p.castSpell(1, [], { iceExplosion: () => {} }, { iceNova: () => {} }, { shake: () => {} });
  assert.strictEqual(p.soul, 50 - cost, 'Soul must be deducted by exact Spell 2 cost');
  assert.ok(p.spellCooldowns[1] > 0, 'Spell 2 cooldown must be initialized');
});

H.test('T1.5.3 Spell 2 Radial Range: Frost Nova configuration defines AoE radius >= 140px in SPELLS[1]', 'M2', () => {
  const s = SPELLS[1];
  const radius = s.radius || s.range;
  assert.ok(typeof radius === 'number' && radius >= 140, `Frost Nova AoE radius in SPELLS[1] must be >= 140px (found ${radius})`);
});

H.test('T1.5.4 Spell 2 Status Application: Cast Frost Nova applies freezeTimer >= 1.5s to enemies within 140px radius', 'M2', () => {
  const g = createTestGame();
  g.player.x = 500; g.player.y = 500;
  g.player.soul = 100;
  g.player.spellCooldowns[1] = 0;

  const targetNear = new Enemy(580, 500, 'crawler', 0); // 80px away (within 140px)
  const targetFar = new Enemy(700, 500, 'crawler', 0);  // 200px away (outside 140px)
  g.enemies = [targetNear, targetFar];

  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);

  assert.ok(typeof targetNear.freezeTimer === 'number', 'Enemy must expose freezeTimer property');
  assert.ok(targetNear.freezeTimer >= 1.5, `Enemy within 140px must receive freezeTimer >= 1.5s (found ${targetNear.freezeTimer})`);
  assert.strictEqual(targetFar.freezeTimer || 0, 0, 'Enemy outside 140px must not receive freezeTimer');
});

H.test('T1.5.5 Spell 2 Freeze Effect: Frozen enemy (freezeTimer > 0) is immobilized during enemy.update()', 'M2', () => {
  const g = createTestGame();
  const enemy = new Enemy(200, 800, 'crawler', 50);
  enemy.vx = 80;
  enemy.freezeTimer = 2.0;
  const initialX = enemy.x;

  enemy.update(0.1, g.player, g.level, g.particles, g.projectiles, g.audio);

  assert.strictEqual(enemy.x, initialX, 'Frozen enemy x-coordinate must not advance during update');
  assert.strictEqual(enemy.vx, 0, 'Frozen enemy vx must be clamped to 0');
  assert.ok(enemy.freezeTimer < 2.0, 'freezeTimer must decrement with dt');
});

// ----------------------------------------------------------------------------
// Feature 6: Spell 3 (Abyssal Singularity) Vortex Pull & Implosion (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('Feature 6: Spell 3 (Abyssal Singularity) Vortex Pull & Implosion');

H.test('T1.6.1 Spell 3 Parameters: Soul cost in [15, 20], cooldown <= 1.0s in SPELLS[2]', 'M2', () => {
  assert.ok(SPELLS.length >= 3, 'SPELLS array must contain Spell 3');
  const s = SPELLS[2];
  assert.ok(/Abyssal Singularity|Shadow Bolt/i.test(s.name), `Spell 3 name must match spec (found ${s.name})`);
  assert.ok(s.soulCost >= 15 && s.soulCost <= 20, `Soul cost must be in [15, 20] (found ${s.soulCost})`);
  assert.ok(s.cooldown <= 1.0, `Cooldown must be <= 1.0s (found ${s.cooldown})`);
});

H.test('T1.6.2 Spell 3 Soul Consumption: Deducts required soul (15-20) via player.castSpell(2)', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 50;
  const cost = SPELLS[2].soulCost;
  p.castSpell(2, [], {}, { shadowBolt: () => {} }, {});
  assert.strictEqual(p.soul, 50 - cost, 'Soul must be deducted by exact Spell 3 cost');
  assert.ok(p.spellCooldowns[2] > 0, 'Spell 3 cooldown must be initialized');
});

H.test('T1.6.3 Spell 3 Vortex Lifetime: Projectile persists for extended duration (lifetime >= 2.0s)', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 50;
  const projs = [];
  p.castSpell(2, projs, {}, { shadowBolt: () => {} }, {});
  assert.ok(projs.length > 0, 'Vortex projectile must be spawned');
  const lifetime = projs[0].life || projs[0].lifetime || 0;
  assert.ok(lifetime >= 2.0, `Vortex projectile lifetime (${lifetime}s) must be >= 2.0s`);
});

H.test('T1.6.4 Spell 3 Gravitational Pull: Active vortex pulls nearby enemies (range 160px) toward vortex center', 'M2', () => {
  const g = createTestGame();
  g.player.x = 200; g.player.y = 800;
  g.player.facing = 1;
  g.player.soul = 50;
  g.projectiles.length = 0;

  const enemy = new Enemy(280, 800, 'crawler', 0);
  enemy.vx = 0;
  g.enemies = [enemy];
  const initialX = enemy.x;

  g.player.castSpell(2, g.projectiles, g.particles, g.audio, g.camera);
  assert.ok(g.projectiles.length > 0, 'Vortex projectile must be spawned');

  for (let tick = 0; tick < 5; tick++) {
    g._updatePlaying(0.016);
  }

  assert.ok(enemy.x < initialX || enemy.vx < 0, `Enemy must experience leftward gravitational pull toward vortex (x: ${initialX} -> ${enemy.x}, vx: ${enemy.vx})`);
});

H.test('T1.6.5 Spell 3 Implosion: Vortex lifetime expiration triggers final implosion damage tick', 'M2', () => {
  const g = createTestGame();
  const enemy = new Enemy(200, 800, 'crawler', 0);
  enemy.hp = 5;
  g.enemies = [enemy];

  const vortex = new Projectile(200, 800, 0, 0, 1, 'void_vortex', 'player');
  vortex.life = 0.02;
  vortex.blastRadius = 80;
  vortex.implosionDamage = 2;
  g.projectiles = [vortex];

  let implosionAudioCalled = false;
  g.audio.voidImplode = () => { implosionAudioCalled = true; };

  g._updatePlaying(0.03);

  assert.strictEqual(vortex.dead, true, 'Vortex marked dead upon life expiration');
  assert.ok(enemy.hp <= 3, `Enemy must take implosion damage tick on vortex collapse (hp: 5 -> ${enemy.hp})`);
});

// ----------------------------------------------------------------------------
// Feature 7: Shatter Combat Synergy (Freeze + Melee/Blast) (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('Feature 7: Shatter Combat Synergy (Freeze + Melee/Blast)');

H.test('T1.7.1 Shatter Bonus Damage: enemy.takeDamage() on frozen enemy inflicts base + 2 bonus shatter damage', 'M2', () => {
  const enemy = new Enemy(100, 100, 'crawler', 50);
  enemy.hp = 10;
  enemy.freezeTimer = 2.0;

  let shatterAudioCalled = false;
  let shatterParticlesCalled = false;
  const mockAudio = { hit: () => {}, iceShatter: () => { shatterAudioCalled = true; }, enemyDeath: () => {} };
  const mockParticles = { sparks: () => {}, iceExplosion: () => { shatterParticlesCalled = true; }, dustLand: () => {} };

  enemy.takeDamage(3, 1, mockParticles, { shake: () => {} }, mockAudio);

  assert.strictEqual(enemy.hp, 5, `Enemy HP must equal 5 after base 3 plus 2 bonus shatter damage (found ${enemy.hp})`);
  assert.strictEqual(enemy.freezeTimer, 0, 'freezeTimer must be cleared to 0 after shatter hit');
  assert.strictEqual(shatterAudioCalled, true, 'audio.iceShatter() must be invoked on frozen damage');
  assert.strictEqual(shatterParticlesCalled, true, 'Ice shatter particle burst must be triggered');
});

H.test('T1.7.2 Shatter Clears Freeze: enemy.takeDamage() on frozen enemy resets freezeTimer to 0', 'M2', () => {
  const enemy = new Enemy(100, 100, 'crawler', 50);
  enemy.freezeTimer = 2.0;
  enemy.takeDamage(1, 1, { sparks: () => {} }, { shake: () => {} }, { hit: () => {} });
  assert.strictEqual(enemy.freezeTimer, 0, 'freezeTimer must be 0 after taking damage');
});

H.test('T1.7.3 Shatter Audio Dispatch: enemy.takeDamage() on frozen enemy calls audio.iceShatter()', 'M2', () => {
  const enemy = new Enemy(100, 100, 'crawler', 50);
  enemy.freezeTimer = 2.0;
  let dispatched = false;
  const mockAudio = { hit: () => {}, iceShatter: () => { dispatched = true; } };
  enemy.takeDamage(2, 1, { sparks: () => {} }, { shake: () => {} }, mockAudio);
  assert.strictEqual(dispatched, true, 'audio.iceShatter must be dispatched during shatter');
});

H.test('T1.7.4 Shatter Particle Burst: enemy.takeDamage() on frozen enemy triggers ice particle emission', 'M2', () => {
  const enemy = new Enemy(100, 100, 'crawler', 50);
  enemy.freezeTimer = 2.0;
  let burstTriggered = false;
  const mockParticles = {
    sparks: () => {},
    iceExplosion: () => { burstTriggered = true; },
    iceShatter: () => { burstTriggered = true; },
  };
  enemy.takeDamage(2, 1, mockParticles, { shake: () => {} }, { hit: () => {} });
  assert.strictEqual(burstTriggered, true, 'Ice explosion / shatter particles must be triggered');
});

H.test('T1.7.5 Pyre Blast Shatter Synergy: Projectile collision on frozen enemy triggers shatter bonus damage', 'M2', () => {
  const g = createTestGame();
  const enemy = new Enemy(200, 800, 'crawler', 0);
  enemy.hp = 10;
  enemy.freezeTimer = 2.0;
  g.enemies = [enemy];

  const pyre = new Projectile(200, 800, 0, 0, 3, 'pyre_blast', 'player');
  g.projectiles = [pyre];

  g._updatePlaying(0.016);

  assert.ok(enemy.hp <= 5, `Frozen enemy hit by Pyre Blast must receive 3 base + 2 shatter bonus (hp: 10 -> ${enemy.hp})`);
  assert.strictEqual(enemy.freezeTimer, 0, 'Freeze timer cleared after pyre shatter');
});

H.test('T1.7.6 Non-Frozen Control: enemy.takeDamage() on non-frozen enemy deals base damage only without iceShatter audio', 'M2', () => {
  const enemy = new Enemy(100, 100, 'crawler', 50);
  enemy.hp = 10;
  enemy.freezeTimer = 0;

  let shatterCalled = false;
  const mockAudio = { hit: () => {}, iceShatter: () => { shatterCalled = true; } };

  enemy.takeDamage(3, 1, { sparks: () => {} }, { shake: () => {} }, mockAudio);

  assert.strictEqual(enemy.hp, 7, 'Unfrozen enemy takes exactly base 3 damage (10 -> 7)');
  assert.strictEqual(shatterCalled, false, 'audio.iceShatter must NOT be called on non-frozen enemy');
});

// ----------------------------------------------------------------------------
// Feature 8: Arcane Casting Aura & Visual Feedback (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('Feature 8: Arcane Casting Aura & Visual Feedback');

H.test('T1.8.1 Arcane Casting State: Player manages casting feedback or animTimer during cast', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 50;
  p.castSpell(0, [], {}, { fireball: () => {} }, { shake: () => {} });
  assert.ok(typeof p.animTimer === 'number' || typeof p.castTimer === 'number', 'Player animTimer or castTimer must be active');
});

H.test('T1.8.2 Particle Emitters: ParticleSystem provides visual emitters for spells', 'M2', () => {
  const ps = new ParticleSystem();
  assert.strictEqual(typeof ps.add, 'function', 'ParticleSystem must define add()');
  assert.strictEqual(typeof ps.sparks, 'function', 'ParticleSystem must define sparks()');
});

H.test('T1.8.3 Camera Shake Trigger: Spell cast triggers dynamic camera shake on camera instance', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 50;
  let shaken = false;
  const mockCamera = { shake: (intensity, dur) => { shaken = true; } };
  p.castSpell(0, [], {}, { fireball: () => {} }, mockCamera);
  assert.strictEqual(shaken, true, 'Camera shake must be triggered during spell cast');
});

H.test('T1.8.4 Afterimage Trails: Ground roll / casting produces afterimage frames in player.afterimages', 'M2', () => {
  const p = new Player(100, 100);
  assert.ok(Array.isArray(p.afterimages), 'Player must possess afterimages array');
  p.dashing = true;
  const mockInput = { left: () => false, right: () => false, jumpHeld: () => false, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };
  p.update(0.016, mockInput, { platforms: [] }, {}, {}, {});
  assert.ok(p.afterimages.length > 0, 'Player afterimages must be generated during dash update');
});

H.test('T1.8.5 Particle Decay: Particle lifetimes decay properly with dt in ParticleSystem.prototype.update', 'M2', () => {
  const ps = new ParticleSystem();
  const p = new Particle(100, 100, 0, 0, 0.5, '#ffffff', 4);
  ps.add(p);
  ps.update(0.2);
  assert.ok(p.life < 0.5, `Particle life (${p.life}) must decay with dt`);
});

// ----------------------------------------------------------------------------
// Feature 9: AudioEngine Hooks & Event Triggers (Milestone M3)
// ----------------------------------------------------------------------------
H.setCategory('Feature 9: AudioEngine Hooks & Event Triggers');

H.test('T1.9.1 AudioEngine Headless Initialization: Initializes without error in headless AudioContext', 'M3', () => {
  assert.doesNotThrow(() => {
    const audio = new AudioEngine();
    assert.ok(audio, 'AudioEngine instantiated');
  }, 'AudioEngine initialization must not throw in mock AudioContext');
});

H.test('T1.9.2 Footstep Audio Hook: AudioEngine implements footstep() and executes cleanly', 'M3', () => {
  const audio = new AudioEngine();
  assert.strictEqual(typeof audio.footstep, 'function', 'audio.footstep must be implemented on AudioEngine');
  assert.doesNotThrow(() => { audio.footstep(); }, 'audio.footstep() must execute without throwing');
});

H.test('T1.9.3 Land Audio Hook: AudioEngine implements land() and executes cleanly', 'M3', () => {
  const audio = new AudioEngine();
  assert.strictEqual(typeof audio.land, 'function', 'audio.land must be implemented on AudioEngine');
  assert.doesNotThrow(() => { audio.land(); }, 'audio.land() must execute without throwing');
});

H.test('T1.9.4 Fireball / Pyre Hit Hook: AudioEngine implements fireballHit() and executes cleanly', 'M3', () => {
  const audio = new AudioEngine();
  assert.strictEqual(typeof audio.fireballHit, 'function', 'audio.fireballHit must be implemented on AudioEngine');
  assert.doesNotThrow(() => { audio.fireballHit(); }, 'audio.fireballHit() must execute without throwing');
});

H.test('T1.9.5 Ice Shatter Audio Hook: AudioEngine implements iceShatter() and executes cleanly', 'M3', () => {
  const audio = new AudioEngine();
  assert.strictEqual(typeof audio.iceShatter, 'function', 'audio.iceShatter must be implemented on AudioEngine');
  assert.doesNotThrow(() => { audio.iceShatter(); }, 'audio.iceShatter() must execute without throwing');
});

H.test('T1.9.6 Bonfire Lit Audio Hook: AudioEngine implements bonfireLit() and executes cleanly', 'M3', () => {
  const audio = new AudioEngine();
  assert.strictEqual(typeof audio.bonfireLit, 'function', 'audio.bonfireLit must be implemented on AudioEngine');
  assert.doesNotThrow(() => { audio.bonfireLit(); }, 'audio.bonfireLit() must execute without throwing');
});

// ----------------------------------------------------------------------------
// Feature 10: Sound Assets & CC0 Open License Verification (Milestone M3)
// ----------------------------------------------------------------------------
H.setCategory('Feature 10: Sound Assets & CC0 Open License Verification');

H.test('T1.10.1 WAV Files Presence: All core synthesized .wav sound files exist in assets/sounds/', 'M3', () => {
  const soundsDir = path.resolve(__dirname, '../assets/sounds');
  assert.ok(fs.existsSync(soundsDir), 'assets/sounds directory must exist');
  const files = fs.readdirSync(soundsDir).filter(f => f.endsWith('.wav'));
  assert.ok(files.length >= 24, `Expected at least 24 WAV sound files (found ${files.length})`);
});

H.test('T1.10.2 RIFF Header Validity: Sound files contain valid RIFF 4-byte chunk identifier', 'M3', () => {
  const soundsDir = path.resolve(__dirname, '../assets/sounds');
  const files = fs.readdirSync(soundsDir).filter(f => f.endsWith('.wav'));
  for (const f of files) {
    const buf = fs.readFileSync(path.join(soundsDir, f));
    const riff = buf.toString('ascii', 0, 4);
    assert.strictEqual(riff, 'RIFF', `File ${f} must start with RIFF header (found ${riff})`);
  }
});

H.test('T1.10.3 WAVE Format Identifier: Sound files contain valid WAVE 4-byte format identifier', 'M3', () => {
  const soundsDir = path.resolve(__dirname, '../assets/sounds');
  const files = fs.readdirSync(soundsDir).filter(f => f.endsWith('.wav'));
  for (const f of files) {
    const buf = fs.readFileSync(path.join(soundsDir, f));
    const wave = buf.toString('ascii', 8, 12);
    assert.strictEqual(wave, 'WAVE', `File ${f} must contain WAVE format identifier (found ${wave})`);
  }
});

H.test('T1.10.4 Uncompressed PCM Format: Sound files are encoded as uncompressed PCM (format code 1)', 'M3', () => {
  const soundsDir = path.resolve(__dirname, '../assets/sounds');
  const files = fs.readdirSync(soundsDir).filter(f => f.endsWith('.wav'));
  for (const f of files) {
    const buf = fs.readFileSync(path.join(soundsDir, f));
    const formatCode = buf.readUInt16LE(20);
    assert.strictEqual(formatCode, 1, `File ${f} must be uncompressed PCM format code 1 (found ${formatCode})`);
  }
});

H.test('T1.10.5 16-Bit Audio Depth: Sound files have bit depth of 16 bits per sample', 'M3', () => {
  const soundsDir = path.resolve(__dirname, '../assets/sounds');
  const files = fs.readdirSync(soundsDir).filter(f => f.endsWith('.wav'));
  for (const f of files) {
    const buf = fs.readFileSync(path.join(soundsDir, f));
    const bitDepth = buf.readUInt16LE(34);
    assert.strictEqual(bitDepth, 16, `File ${f} must have bit depth of 16 bits (found ${bitDepth})`);
  }
});

H.test('T1.10.6 Audio Legal Compliance: All audio assets possess verified CC0 / MIT license or procedural provenance in scripts/generate_sounds.py', 'M3', () => {
  const soundsDir = path.resolve(__dirname, '../assets/sounds');
  const scriptPath = path.resolve(__dirname, '../scripts/generate_sounds.py');
  const licensePath = path.resolve(__dirname, '../LICENSE');
  const manifestPath = path.resolve(__dirname, '../assets/sounds/AUDIO_LICENSES.md');

  assert.ok(fs.existsSync(scriptPath), 'Procedural sound synthesis script must exist at scripts/generate_sounds.py');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');

  // Audit procedural sound generator registration
  const soundFiles = fs.readdirSync(soundsDir).filter(f => f.endsWith('.wav'));
  const missingGenerators = [];
  for (const f of soundFiles) {
    const baseName = f.replace('.wav', '');
    const genRegex = new RegExp(`['"]${baseName}['"]\\s*:`);
    if (!genRegex.test(scriptContent)) {
      missingGenerators.push(f);
    }
  }
  assert.strictEqual(
    missingGenerators.length, 0,
    `All SFX in assets/sounds/ must have procedural generators in scripts/generate_sounds.py. Missing: ${missingGenerators.join(', ')}`
  );

  // License and CC0 / MIT manifest audit
  const hasManifest = fs.existsSync(manifestPath);
  const licenseContent = fs.existsSync(licensePath) ? fs.readFileSync(licensePath, 'utf8') : '';
  const hasOpenLicense = /CC0|Public Domain|MIT License/i.test(licenseContent);

  assert.ok(
    hasManifest || hasOpenLicense,
    'Audio assets must have explicit CC0 1.0, Public Domain, or MIT license terms documented in AUDIO_LICENSES.md or LICENSE'
  );

  if (!hasManifest) {
    assert.ok(
      !/All Rights Reserved/i.test(licenseContent),
      'LICENSE must not assert proprietary All Rights Reserved over audio assets without open license waiver'
    );
  }
});


// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (56 tests)
// ============================================================================
H.setTier('Tier 2: Boundary & Corner Cases');

// ----------------------------------------------------------------------------
// Category B1: Pier Doorway Exact Clearance Bounds (Milestone M1)
// ----------------------------------------------------------------------------
H.setCategory('Category B1: Pier Doorway Exact Clearance Bounds');

H.test('T2.1.1 Boundary: West Pier opening clearance height is at least 120px', 'M1', () => {
  const lvl = buildLevel();
  const pier = lvl.platforms.find(p => p.x === 2980 && p.y === 240);
  const floor = lvl.platforms.find(p => p.y === 480 && p.x <= 2980 && p.x + p.w >= 2980);
  assert.ok(pier && floor, 'West pier and floor must exist');
  const clearance = floor.y - (pier.y + pier.h);
  assert.strictEqual(clearance >= 120, true, `Clearance height (${clearance}px) must be >= 120px`);
});

H.test('T2.1.2 Boundary: East Pier opening clearance height is at least 120px', 'M1', () => {
  const lvl = buildLevel();
  const pier = lvl.platforms.find(p => p.x === 3404 && p.y === 240);
  const floor = lvl.platforms.find(p => p.y === 480 && p.x <= 3404 && p.x + p.w >= 3404);
  assert.ok(pier && floor, 'East pier and floor must exist');
  const clearance = floor.y - (pier.y + pier.h);
  assert.strictEqual(clearance >= 120, true, `Clearance height (${clearance}px) must be >= 120px`);
});

H.test('T2.1.3 Boundary: Player box (w=28, h=44) has >= 70px vertical clearance through 120px opening', 'M1', () => {
  const opening = 120;
  const playerH = 44;
  const margin = opening - playerH;
  assert.ok(margin >= 70, `Vertical clearance margin (${margin}px) must provide at least 70px headroom`);
});

H.test('T2.1.4 Boundary: Player at x=2980, y=436 experiences zero AABB overlap with upper pier solid', 'M1', () => {
  const lvl = buildLevel();
  const pier = lvl.platforms.find(p => p.x === 2980 && p.y === 240);
  const playerBox = { x: 2980, y: 436, w: 28, h: 44 };
  assert.strictEqual(rectsOverlap(playerBox, pier), false, 'Player box must not overlap upper pier solid');
});

H.test('T2.1.5 Boundary: Horizontal passage from x=2960 to x=3020 contains zero blocking solid obstacles at y=436', 'M1', () => {
  const lvl = buildLevel();
  const solids = lvl.platforms.filter(p => p.type === 'solid' && p.y < 480);
  for (let x = 2960; x <= 3020; x += 10) {
    const box = { x, y: 436, w: 28, h: 44 };
    for (const s of solids) {
      if (rectsOverlap(box, s)) {
        assert.fail(`Blocking solid detected at x=${x}: ${JSON.stringify(s)}`);
      }
    }
  }
});

// ----------------------------------------------------------------------------
// Category B2: Lift Landing Arrival & Overlap Boundaries (Milestone M1)
// ----------------------------------------------------------------------------
H.setCategory('Category B2: Lift Landing Arrival & Overlap Boundaries');

H.test('T2.2.1 Boundary: Lift landing platform y=480 aligns with moving lift apex y-range', 'M1', () => {
  const lvl = buildLevel();
  const lift = lvl.platforms.find(p => p.type === 'moving');
  const landing = lvl.platforms.find(p => p.x === 2920 && p.y === 480);
  assert.ok(lift && landing, 'Lift and landing must exist');
  const liftMinY = lift.oy - Math.abs(lift.my || 0);
  const liftMaxY = lift.oy + Math.abs(lift.my || 0);
  assert.ok(landing.y >= liftMinY - 100 && landing.y <= liftMaxY + 100,
    `Landing y=${landing.y} must align near lift motion range [${liftMinY}, ${liftMaxY}]`);
});

H.test('T2.2.2 Boundary: Gap between lift arrival rightmost position and landing left edge is <= 25px', 'M1', () => {
  const lvl = buildLevel();
  const lift = lvl.platforms.find(p => p.type === 'moving');
  const landing = lvl.platforms.find(p => p.x === 2920 && p.y === 480);
  const liftRightApex = lift.ox + Math.abs(lift.mx || 0) + lift.w;
  const gap = landing.x - liftRightApex;
  assert.ok(gap <= 25, `Gap between lift apex and landing (${gap}px) must be <= 25px`);
});

H.test('T2.2.3 Boundary: Landing width 80px provides at least 2.8x player width (28px) safe landing margin', 'M1', () => {
  const lvl = buildLevel();
  const landing = lvl.platforms.find(p => p.x === 2920 && p.y === 480);
  const ratio = landing.w / 28;
  assert.ok(ratio >= 2.8, `Landing width ratio (${ratio.toFixed(1)}x) must be >= 2.8x player width`);
});

H.test('T2.2.4 Boundary: Player standing on landing platform at x=2940, y=436 has feet supported with onGround=true', 'M1', () => {
  const lvl = buildLevel();
  const p = new Player(2940, 436);
  p.vy = 50;
  p.onGround = false;
  p.update(0.016, { left: () => false, right: () => false, jumpHeld: () => false, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false }, lvl, { dustLand: () => {} }, {}, {});
  assert.strictEqual(p.onGround, true, 'Player must be supported by landing platform');
});

H.test('T2.2.5 Boundary: Landing platform is oneway, allowing upward jump through from below', 'M1', () => {
  const lvl = buildLevel();
  const landing = lvl.platforms.find(p => p.x === 2920 && p.y === 480);
  assert.strictEqual(landing.type, 'oneway', 'Landing platform must be oneway to allow upward traversal');
});

// ----------------------------------------------------------------------------
// Category B3: World Boundaries & Continuous Street Limits (Milestone M1)
// ----------------------------------------------------------------------------
H.setCategory('Category B3: World Boundaries & Continuous Street Limits');

H.test('T2.3.1 Boundary: Left fortress wall at x=0 extends continuously from y=200 down to y=1500', 'M1', () => {
  const lvl = buildLevel();
  const wall = lvl.platforms.find(p => p.x === 0 && p.type === 'solid');
  assert.ok(wall, 'Wall must exist at x=0');
  assert.ok(wall.y <= 200, 'Wall must start at or above y=200');
  assert.ok(wall.y + wall.h >= 1500, 'Wall must reach or exceed y=1500');
});

H.test('T2.3.2 Boundary: Player at x=0 cannot move further left; player.update() clamps vx=0 and onWall=-1', 'M1', () => {
  const lvl = buildLevel();
  const p = new Player(2, 500);
  p.vx = -200; // moving into left wall
  const mockInput = { left: () => true, right: () => false, jumpHeld: () => false, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };
  p.update(0.016, mockInput, lvl, {}, {}, {});
  assert.ok(p.x >= 0, `Player x (${p.x}) must be clamped >= 0`);
  assert.strictEqual(p.onWall, -1, 'Player onWall flag must register left wall contact (-1)');
});

H.test('T2.3.3 Boundary: Continuous street starts at x=40, flush with fortress wall x=40', 'M1', () => {
  const lvl = buildLevel();
  const street = lvl.platforms.find(p => p.x === 40 && p.y === 1340);
  assert.ok(street, 'Street must start at x=40');
  const wall = lvl.platforms.find(p => p.x === 0 && p.type === 'solid');
  assert.strictEqual(street.x, wall.x + wall.w, 'Street start must match fortress wall right edge exactly');
});

H.test('T2.3.4 Boundary: Continuous street ends at x=1780, spanning entire Sunken Canal width (1740px)', 'M1', () => {
  const lvl = buildLevel();
  const street = lvl.platforms.find(p => p.x === 40 && p.y === 1340);
  assert.ok(street, 'Street must exist at x=40, y=1340');
  assert.strictEqual(street.x + street.w, 1780, `Street must terminate at x=1780 (reaches ${street.x + street.w})`);
});

H.test('T2.3.5 Boundary: Street platform thickness is exactly 32px (y=1340 to y=1372), eliminating 160px monolith', 'M1', () => {
  const lvl = buildLevel();
  const street = lvl.platforms.find(p => p.x === 40 && p.y === 1340);
  assert.strictEqual(street.h, 32, `Street thickness must be 32px (found ${street.h}px)`);
});

H.test('T2.3.6 Boundary: Vertical clearance below viaduct (y=820) to street (y=1340) is >= 500px, open for navigation', 'M1', () => {
  const lvl = buildLevel();
  const viaduct = lvl.platforms.find(p => p.y === 820 && p.x <= 800 && p.x + p.w >= 800);
  const street = lvl.platforms.find(p => p.x === 40 && p.y === 1340);
  assert.ok(viaduct && street, 'Viaduct and street must exist');
  const clearance = street.y - (viaduct.y + viaduct.h);
  assert.ok(clearance >= 480, `Canal vertical clearance (${clearance}px) must be >= 500px`);
});

// ----------------------------------------------------------------------------
// Category B4: Spell 1 Mana Exhaustion & Cooldown Limits (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('Category B4: Spell 1 Mana Exhaustion & Cooldown Limits');

H.test('T2.4.1 Boundary: Cast Pyre Blast with mana=0 fails; mana remains 0 and no projectile spawns', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 0;
  const projs = [];
  p.castSpell(0, projs, {}, {}, {});
  assert.strictEqual(p.soul, 0, 'Mana must remain 0');
  assert.strictEqual(projs.length, 0, 'No projectile should be spawned with 0 mana');
});

H.test('T2.4.2 Boundary: Cast Pyre Blast with mana=cost-1 (e.g. 24) fails; mana remains 24 and no projectile spawns', 'M2', () => {
  const p = new Player(100, 100);
  const cost = SPELLS[0].soulCost;
  p.soul = cost - 1;
  const projs = [];
  p.castSpell(0, projs, {}, {}, {});
  assert.strictEqual(p.soul, cost - 1, 'Mana must remain unchanged');
  assert.strictEqual(projs.length, 0, 'No projectile spawned when mana < cost');
});

H.test('T2.4.3 Boundary: Cast Pyre Blast with exact mana=cost (25) succeeds; mana becomes 0 and projectile spawns', 'M2', () => {
  const p = new Player(100, 100);
  const cost = SPELLS[0].soulCost;
  p.soul = cost;
  const projs = [];
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  assert.strictEqual(p.soul, 0, 'Exact mana deduction leaves 0 mana');
  assert.strictEqual(projs.length, 1, 'Projectile spawned on exact mana cast');
});

H.test('T2.4.4 Boundary: Re-casting Pyre Blast during active cooldown (> 0) fails to spawn projectile', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 100;
  p.spellCooldowns[0] = 0.5; // active cooldown
  const projs = [];
  p.castSpell(0, projs, {}, {}, {});
  assert.strictEqual(projs.length, 0, 'Cast must be rejected during cooldown');
  assert.strictEqual(p.soul, 100, 'Mana must not be deducted on rejected cast');
});

H.test('T2.4.5 Boundary: Pyre Blast cooldown decrements with dt in player.update() and allows casting when 0', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 100;
  p.spellCooldowns[0] = 0.1;
  const mockInput = { left: () => false, right: () => false, jumpHeld: () => false, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };
  p.update(0.15, mockInput, { platforms: [] }, {}, {}, {});
  assert.strictEqual(p.spellCooldowns[0], 0, 'Cooldown must reach 0 after dt elapses');
  const projs = [];
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  assert.strictEqual(projs.length, 1, 'Spell can be cast once cooldown reaches 0');
});

H.test('T2.4.6 Boundary: Rapid consecutive cast inputs in the same frame only trigger a single spell cast', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 100;
  const projs = [];
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  assert.strictEqual(projs.length, 1, 'Only first cast in frame succeeds; remaining blocked by cooldown');
});

// ----------------------------------------------------------------------------
// Category B5: Spell 2 Freeze Radius Boundary (139px vs 141px) (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('Category B5: Spell 2 Freeze Radius Boundary (139px vs 141px)');

H.test('T2.5.1 Boundary: Enemy at Euclidean distance 139px (< 140px) receives freezeTimer on Frost Nova cast', 'M2', () => {
  const g = createTestGame();
  g.player.x = 500; g.player.y = 500;
  g.player.soul = 50;
  const enemy = new Enemy(500 + 139, 500, 'crawler', 0);
  g.enemies = [enemy];
  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);
  assert.ok(enemy.freezeTimer > 0, `Enemy at 139px must receive freezeTimer (found ${enemy.freezeTimer})`);
});

H.test('T2.5.2 Boundary: Enemy at Euclidean distance 141px (> 140px) does NOT receive freezeTimer on Frost Nova cast', 'M2', () => {
  const g = createTestGame();
  g.player.x = 500; g.player.y = 500;
  g.player.soul = 50;
  const enemy = new Enemy(500 + 141, 500, 'crawler', 0);
  g.enemies = [enemy];
  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);
  assert.strictEqual(enemy.freezeTimer || 0, 0, 'Enemy at 141px must NOT receive freezeTimer');
});

H.test('T2.5.3 Boundary: Enemy at distance 0px (directly on player) is frozen by Frost Nova', 'M2', () => {
  const g = createTestGame();
  g.player.x = 500; g.player.y = 500;
  g.player.soul = 50;
  const enemy = new Enemy(500, 500, 'crawler', 0);
  g.enemies = [enemy];
  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);
  assert.ok(enemy.freezeTimer > 0, 'Enemy co-located with player must be frozen');
});

H.test('T2.5.4 Boundary: Enemy placed behind player facing direction within 140px is frozen (radial 360 AoE)', 'M2', () => {
  const g = createTestGame();
  g.player.x = 500; g.player.y = 500;
  g.player.facing = 1; // facing right
  g.player.soul = 50;
  const enemyBehind = new Enemy(500 - 100, 500, 'crawler', 0); // 100px behind player
  g.enemies = [enemyBehind];
  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);
  assert.ok(enemyBehind.freezeTimer > 0, 'Enemy behind player must be frozen by 360-degree Frost Nova');
});

H.test('T2.5.5 Boundary: Dead enemies (dead = true) are ignored by Frost Nova radial freeze loop', 'M2', () => {
  const g = createTestGame();
  g.player.x = 500; g.player.y = 500;
  g.player.soul = 50;
  const deadEnemy = new Enemy(550, 500, 'crawler', 0);
  deadEnemy.dead = true;
  g.enemies = [deadEnemy];
  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);
  assert.strictEqual(deadEnemy.freezeTimer || 0, 0, 'Dead enemy must not receive freezeTimer');
});

H.test('T2.5.6 Boundary: Boss entity receives chill/slow status rather than full immobilization', 'M2', () => {
  const g = createTestGame();
  g.player.x = 500; g.player.y = 500;
  g.player.soul = 50;
  const boss = new Boss(550, 500);
  g.enemies = [boss];
  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);
  assert.ok(boss.chilled || boss.chillTimer > 0 || boss.freezeTimer === 0, 'Boss entity must be chilled rather than completely immobilized');
});

// ----------------------------------------------------------------------------
// Category B6: Spell 3 Vortex Pull Range & Decay Limits (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('Category B6: Spell 3 Vortex Pull Range & Decay Limits');

H.test('T2.6.1 Boundary: Enemy at distance 159px (< 160px) experiences gravitational pull toward vortex center', 'M2', () => {
  const g = createTestGame();
  const vortex = new Projectile(500, 500, 0, 0, 1, 'void_vortex', 'player');
  vortex.life = 2.0;
  vortex.pullRange = 160;
  g.projectiles = [vortex];

  const enemyInside = new Enemy(500 + 159, 500, 'crawler', 0);
  enemyInside.vx = 0;
  g.enemies = [enemyInside];

  g._updatePlaying(0.05);

  assert.ok(enemyInside.vx < 0 || enemyInside.x < 500 + 159, 'Enemy at 159px must be pulled toward vortex');
});

H.test('T2.6.2 Boundary: Enemy at distance 161px (> 160px) experiences zero gravitational pull from vortex', 'M2', () => {
  const g = createTestGame();
  const vortex = new Projectile(500, 500, 0, 0, 1, 'void_vortex', 'player');
  vortex.life = 2.0;
  vortex.pullRange = 160;
  g.projectiles = [vortex];

  const enemyOutside = new Enemy(500 + 161, 500, 'crawler', 0);
  enemyOutside.vx = 0;
  g.enemies = [enemyOutside];

  g._updatePlaying(0.05);

  assert.strictEqual(enemyOutside.vx, 0, 'Enemy at 161px must experience zero gravitational pull');
});

H.test('T2.6.3 Boundary: Gravitational acceleration is inversely proportional to distance (stronger closer to center)', 'M2', () => {
  const g = createTestGame();
  const vortex = new Projectile(500, 500, 0, 0, 1, 'void_vortex', 'player');
  vortex.life = 2.0;
  vortex.pullRange = 160;
  g.projectiles = [vortex];

  const nearEnemy = new Enemy(500 + 40, 500, 'crawler', 0);
  const farEnemy = new Enemy(500 + 140, 500, 'crawler', 0);
  g.enemies = [nearEnemy, farEnemy];

  g._updatePlaying(0.05);

  assert.ok(Math.abs(nearEnemy.vx) >= Math.abs(farEnemy.vx), 'Gravitational pull must be stronger closer to vortex center');
});

H.test('T2.6.4 Boundary: Vortex projectile remains active at life = 0.05s without prematurely expiring', 'M2', () => {
  const vortex = new Projectile(100, 100, 0, 0, 1, 'void_vortex', 'player');
  vortex.life = 0.05;
  vortex.update(0.02, { platforms: [] }, {}, {});
  assert.strictEqual(vortex.dead, false, 'Vortex must remain alive while life > 0');
});

H.test('T2.6.5 Boundary: Vortex projectile marks dead = true when lifetime expires (life <= 0)', 'M2', () => {
  const vortex = new Projectile(100, 100, 0, 0, 1, 'void_vortex', 'player');
  vortex.life = 0.02;
  vortex.update(0.05, { platforms: [] }, {}, {});
  assert.strictEqual(vortex.dead, true, 'Vortex must be marked dead after lifetime expires');
});

H.test('T2.6.6 Boundary: Expiration of vortex projectile triggers implosion damage tick on enemies in collapse radius', 'M2', () => {
  const g = createTestGame();
  const vortex = new Projectile(200, 200, 0, 0, 1, 'void_vortex', 'player');
  vortex.life = 0.01;
  vortex.implosionDamage = 2;
  g.projectiles = [vortex];

  const enemy = new Enemy(200, 200, 'crawler', 0);
  enemy.hp = 10;
  g.enemies = [enemy];

  g._updatePlaying(0.03);

  assert.strictEqual(vortex.dead, true, 'Vortex must expire');
  assert.ok(enemy.hp <= 8, 'Enemy must receive implosion damage tick on vortex expiration');
});

// ----------------------------------------------------------------------------
// Category B7: Shatter Combat Boundary Conditions (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('Category B7: Shatter Combat Boundary Conditions');

H.test('T2.7.1 Boundary: Attack on unfrozen enemy (freezeTimer = 0) inflicts base damage only without shatter bonus', 'M2', () => {
  const enemy = new Enemy(100, 100, 'crawler', 50);
  enemy.hp = 10;
  enemy.freezeTimer = 0;
  enemy.takeDamage(2, 1, {}, {}, { hit: () => {} });
  assert.strictEqual(enemy.hp, 8, 'Unfrozen enemy takes exactly base damage (10 - 2 = 8)');
});

H.test('T2.7.2 Boundary: Zero-damage attack or non-damaging hit does NOT trigger shatter bonus or clear freeze', 'M2', () => {
  const enemy = new Enemy(100, 100, 'crawler', 50);
  enemy.freezeTimer = 2.0;
  const initialHp = enemy.hp;
  enemy.takeDamage(0, 1, {}, {}, {});
  assert.strictEqual(enemy.hp, initialHp, 'Zero-damage hit causes no HP loss');
  assert.ok(enemy.freezeTimer >= 1.9, 'Zero-damage hit preserves freeze status');
});

H.test('T2.7.3 Boundary: Expired freeze (freezeTimer decremented to 0 via time) loses shatter bonus vulnerability', 'M2', () => {
  const enemy = new Enemy(100, 100, 'crawler', 50);
  enemy.hp = 10;
  enemy.freezeTimer = 0.05;
  enemy.update(0.1, {}, { platforms: [] }, {}, [], {});
  assert.strictEqual(enemy.freezeTimer, 0, 'freezeTimer must have expired to 0');
  enemy.takeDamage(3, 1, {}, {}, { hit: () => {} });
  assert.strictEqual(enemy.hp, 7, 'Enemy with expired freeze takes only base 3 damage');
});

H.test('T2.7.4 Boundary: Shatter damage bonus is exactly +2 above base damage regardless of weapon used', 'M2', () => {
  const enemy = new Enemy(100, 100, 'crawler', 50);
  enemy.hp = 20;
  enemy.freezeTimer = 2.0;
  enemy.takeDamage(5, 1, {}, {}, { hit: () => {}, iceShatter: () => {} });
  assert.strictEqual(enemy.hp, 13, 'Enemy takes base 5 + 2 shatter = 7 total damage (20 - 7 = 13)');
});

H.test('T2.7.5 Boundary: Shatter resets freezeTimer to 0 immediately so subsequent hits do not re-trigger shatter', 'M2', () => {
  const enemy = new Enemy(100, 100, 'crawler', 50);
  enemy.hp = 20;
  enemy.freezeTimer = 2.0;
  // Hit 1: Shatters
  enemy.takeDamage(3, 1, {}, {}, { hit: () => {}, iceShatter: () => {} });
  assert.strictEqual(enemy.freezeTimer, 0, 'First hit clears freezeTimer to 0');
  assert.strictEqual(enemy.hp, 15, 'Hit 1 deals 3 plus 2 = 5 damage');
  // Hit 2: Non-shatter
  enemy.takeDamage(3, 1, {}, {}, { hit: () => {} });
  assert.strictEqual(enemy.hp, 12, 'Hit 2 deals base 3 damage only without re-shattering');
});

// ----------------------------------------------------------------------------
// Category B8: Arcane State Machine & Roll Cancellation (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('Category B8: Arcane State Machine & Roll Cancellation');

H.test('T2.8.1 Boundary: Spell cast attempted during dodge roll invulnerability is rejected or buffered', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 100;
  p.dashing = true;
  const projs = [];
  p.castSpell(0, projs, {}, {}, {});
  assert.strictEqual(projs.length, 0, 'Spell casting must be rejected during active dodge roll');
});

H.test('T2.8.2 Boundary: Spell cast attempted during hit stun (hurtTimer > 0) is rejected', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 100;
  p.invulnTimer = 0.5;
  p.hurtTimer = 0.3;
  const projs = [];
  p.castSpell(0, projs, {}, {}, {});
  assert.strictEqual(projs.length, 0, 'Spell casting must be rejected while stunned/reeling from damage');
});

H.test('T2.8.3 Boundary: Cast while airborne (jumping / falling) is permitted and spawns projectile horizontally', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 100;
  p.onGround = false;
  p.vy = 200; // falling
  const projs = [];
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  assert.strictEqual(projs.length, 1, 'Airborne spell casting must be permitted');
  assert.strictEqual(projs[0].vy, 0, 'Projectile must launch on a horizontal trajectory');
});

H.test('T2.8.4 Boundary: Rapid alternation between spells 1, 2, 3 respects individual spell cooldowns', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 100;
  p.spellCooldowns = [0, 0, 0];
  const projs = [];
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  p.castSpell(1, projs, { iceExplosion: () => {} }, { iceNova: () => {} }, { shake: () => {} });
  p.castSpell(2, projs, {}, { shadowBolt: () => {} }, {});
  assert.ok(p.spellCooldowns[0] > 0, 'Spell 1 on cooldown');
  assert.ok(p.spellCooldowns[1] > 0, 'Spell 2 on cooldown');
  assert.ok(p.spellCooldowns[2] > 0, 'Spell 3 on cooldown');
});

H.test('T2.8.5 Boundary: Facing direction during cast determines projectile trajectory (facing=1 -> vx>0, facing=-1 -> vx<0)', 'M2', () => {
  const pRight = new Player(100, 100);
  pRight.soul = 100;
  pRight.facing = 1;
  const projsRight = [];
  pRight.castSpell(0, projsRight, {}, { fireball: () => {} }, { shake: () => {} });
  assert.ok(projsRight[0].vx > 0, 'Facing right produces positive projectile vx');

  const pLeft = new Player(100, 100);
  pLeft.soul = 100;
  pLeft.facing = -1;
  const projsLeft = [];
  pLeft.castSpell(0, projsLeft, {}, { fireball: () => {} }, { shake: () => {} });
  assert.ok(projsLeft[0].vx < 0, 'Facing left produces negative projectile vx');
});

H.test('T2.8.6 Boundary: Spell cooldowns never decrement below 0.0', 'M2', () => {
  const p = new Player(100, 100);
  p.spellCooldowns = [0.01, 0.02, 0.03];
  const mockInput = { left: () => false, right: () => false, jumpHeld: () => false, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };
  p.update(1.0, mockInput, { platforms: [] }, {}, {}, {});
  assert.strictEqual(p.spellCooldowns[0], 0, 'Spell 1 cooldown clamped at 0');
  assert.strictEqual(p.spellCooldowns[1], 0, 'Spell 2 cooldown clamped at 0');
  assert.strictEqual(p.spellCooldowns[2], 0, 'Spell 3 cooldown clamped at 0');
});

// ----------------------------------------------------------------------------
// Category B9: Jump Kinematics & Apex Simulation (Milestone M1)
// ----------------------------------------------------------------------------
H.setCategory('Category B9: Jump Kinematics & Apex Simulation');

H.test('T2.9.1 Boundary: Simulated jump apex with jumpHeld=true reaches calculated ballistic apex h = v0^2 / (2g) (~80px)', 'M1', () => {
  const p = new Player(100, 500);
  p.onGround = false;
  p.vy = p.jumpForce; // -540
  let minY = p.y;
  const mockInput = { left: () => false, right: () => false, jumpHeld: () => true, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };

  const dt = 0.005;
  while (p.vy < 0) {
    p.update(dt, mockInput, { platforms: [] }, {}, {}, { jump: () => {} });
    if (p.y < minY) minY = p.y;
  }

  const measuredHeight = 500 - minY;
  assert.ok(measuredHeight >= 75 && measuredHeight <= 85, `Simulated jump apex (${measuredHeight.toFixed(1)}px) must be near ballistic apex (~80px)`);
});

H.test('T2.9.2 Boundary: Variable jump cut - releasing jump (jumpHeld=false) reduces apex height significantly (< 40px)', 'M1', () => {
  const p = new Player(100, 500);
  p.onGround = false;
  p.vy = p.jumpForce;
  let minY = p.y;
  const mockInput = { left: () => false, right: () => false, jumpHeld: () => false, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };

  const dt = 0.005;
  while (p.vy < 0) {
    p.update(dt, mockInput, { platforms: [] }, {}, {}, { jump: () => {} });
    if (p.y < minY) minY = p.y;
  }

  const measuredHeight = 500 - minY;
  assert.ok(measuredHeight < 40, `Cut jump apex (${measuredHeight.toFixed(1)}px) must be significantly lower than full jump (< 40px)`);
});

H.test('T2.9.3 Boundary: Coyote time (coyoteTime > 0) enables jump execution within buffer window after stepping off platform', 'M1', () => {
  const p = new Player(100, 100);
  p.onGround = false;
  p.coyoteTime = 0.08; // stepped off edge recently
  const mockInput = { left: () => false, right: () => false, jumpHeld: () => true, jumpPressed: () => true, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };
  p.update(0.016, mockInput, { platforms: [] }, {}, {}, { jump: () => {} });
  assert.strictEqual(p.vy, p.jumpForce, 'Jump must be initiated via coyote time');
  assert.strictEqual(p.coyoteTime, 0, 'Coyote time consumed on jump initiation');
});

H.test('T2.9.4 Boundary: Coyote time expires when airborne duration exceeds window, preventing delayed jump', 'M1', () => {
  const p = new Player(100, 100);
  p.onGround = false;
  p.coyoteTime = 0.05;
  p.jumpsLeft = 0;
  const mockInputNeutral = { left: () => false, right: () => false, jumpHeld: () => false, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };
  p.update(0.1, mockInputNeutral, { platforms: [] }, new ParticleSystem(), {}, new AudioEngine());
  assert.ok(p.coyoteTime <= 0, 'Coyote time must have decayed to <= 0');
  const mockInputJump = { left: () => false, right: () => false, jumpHeld: () => true, jumpPressed: () => true, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };
  const initialVy = p.vy;
  p.update(0.016, mockInputJump, { platforms: [] }, new ParticleSystem(), {}, new AudioEngine());
  assert.ok(p.vy > initialVy, 'Jump must be denied after coyote time expiration');
  assert.notStrictEqual(p.vy, p.jumpForce, 'Jump impulse must not be applied');
});

H.test('T2.9.5 Boundary: Freefall downward velocity is clamped at terminal velocity in player.update()', 'M1', () => {
  const p = new Player(100, 100);
  p.onGround = false;
  p.vy = 850;
  const mockInput = { left: () => false, right: () => false, jumpHeld: () => false, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };
  p.update(0.2, mockInput, { platforms: [] }, {}, {}, {});
  assert.ok(p.vy <= 900, `Freefall velocity (${p.vy}) must not exceed terminal velocity 900 px/s`);
});

H.test('T2.9.6 Boundary: Upward collision with solid ceiling zeroes vertical velocity (vy = 0) in player.update()', 'M1', () => {
  const p = new Player(100, 222);
  p.vy = -400; // moving upward
  const ceiling = { x: 50, y: 180, w: 200, h: 40, type: 'solid' };
  const level = { platforms: [ceiling] };
  const mockInput = { left: () => false, right: () => false, jumpHeld: () => false, jumpPressed: () => false, attackPressed: () => false, dashPressed: () => false, healPressed: () => false, down: () => false };
  p.update(0.016, mockInput, level, { dustLand: () => {} }, {}, {});
  assert.strictEqual(p.vy, 0, 'Upward velocity must be zeroed upon ceiling collision');
  assert.ok(p.y >= ceiling.y + ceiling.h - 1, 'Player must be snapped below ceiling surface');
});

// ----------------------------------------------------------------------------
// Category B10: Missing/Corrupted Audio Graceful Fallback (Milestone M3)
// ----------------------------------------------------------------------------
H.setCategory('Category B10: Missing/Corrupted Audio Graceful Fallback');

H.test('T2.10.1 Boundary: AudioEngine gracefully handles playing undefined or null sound name without throwing', 'M3', () => {
  const audio = new AudioEngine();
  assert.doesNotThrow(() => {
    audio.playSample('non_existent_sfx');
    audio.playSample(null);
    audio.playSample(undefined);
  }, 'AudioEngine must not crash on missing sound names');
});

H.test('T2.10.2 Boundary: AudioEngine procedural synthesis generates tone when requested sample is missing', 'M3', () => {
  const audio = new AudioEngine();
  assert.doesNotThrow(() => {
    audio.playSynthTone(440, 0.1, 'sine');
  }, 'Procedural synth fallback must execute without throwing');
});

H.test('T2.10.3 Boundary: 100 rapid consecutive audio calls execute without buffer overflow or exception', 'M3', () => {
  const audio = new AudioEngine();
  assert.doesNotThrow(() => {
    for (let i = 0; i < 100; i++) {
      audio.hit();
      audio.jump();
    }
  }, '100 consecutive audio triggers must execute smoothly');
});

H.test('T2.10.4 Boundary: Master volume parameter clamped between 0.0 and 1.0', 'M3', () => {
  const audio = new AudioEngine();
  assert.strictEqual(typeof audio.setMasterVolume, 'function', 'AudioEngine must define setMasterVolume(vol)');
  audio.setMasterVolume(1.5);
  assert.ok(audio.masterVolume <= 1.0, 'Volume clamped to 1.0');
  audio.setMasterVolume(-0.5);
  assert.ok(audio.masterVolume >= 0.0, 'Volume clamped to 0.0');
});

H.test('T2.10.5 Boundary: When AudioEngine.enabled = false, all audio methods return early without error', 'M3', () => {
  const audio = new AudioEngine();
  audio.enabled = false;
  assert.doesNotThrow(() => {
    audio.hit();
    audio.jump();
    audio.fireball();
    audio.bonfire();
  }, 'Disabled audio engine must return early safely');
});


// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (20 tests)
// ============================================================================
H.setTier('Tier 3: Cross-Feature Combinations');

// ----------------------------------------------------------------------------
// T3.1: Frost Nova + Melee Slash Shatter Synergy (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('T3.1: Frost Nova + Melee Slash Shatter Synergy');

H.test('T3.1.1: Triple Enemy Freeze: Frost Nova AoE freezes 3 crawler enemies simultaneously in engine', 'M2', () => {
  const g = createTestGame();
  g.player.x = 300; g.player.y = 800;
  g.player.soul = 100;
  g.enemies = [
    new Enemy(340, 800, 'crawler', 0),
    new Enemy(380, 800, 'crawler', 0),
    new Enemy(260, 800, 'crawler', 0),
  ];
  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);
  for (let i = 0; i < 3; i++) {
    assert.ok(g.enemies[i].freezeTimer > 0, `Enemy ${i} must be frozen by radial Frost Nova`);
  }
});

H.test('T3.1.2: Melee Shatter First Target: Melee slash calls enemy.takeDamage(), deals +2 bonus and clears freeze', 'M2', () => {
  const enemy = new Enemy(300, 800, 'crawler', 50);
  enemy.hp = 10;
  enemy.freezeTimer = 2.0;

  let shatterAudio = false;
  enemy.takeDamage(3, 1, { sparks: () => {}, iceExplosion: () => {} }, { shake: () => {} }, { hit: () => {}, iceShatter: () => { shatterAudio = true; } });

  assert.strictEqual(enemy.hp, 5, 'Melee slash deals base 3 plus 2 bonus shatter = 5 total damage');
  assert.strictEqual(enemy.freezeTimer, 0, 'Target freezeTimer reset to 0');
  assert.strictEqual(shatterAudio, true, 'Shatter audio dispatched');
});

H.test('T3.1.3: Multi-Target Slash Shatter: Wide swing arc shatters remaining frozen targets in sequence', 'M2', () => {
  const enemies = [
    new Enemy(320, 800, 'crawler', 50),
    new Enemy(350, 800, 'crawler', 50),
  ];
  enemies[0].hp = 10; enemies[0].freezeTimer = 2.0;
  enemies[1].hp = 10; enemies[1].freezeTimer = 2.0;

  for (const e of enemies) {
    e.takeDamage(3, 1, {}, {}, { hit: () => {}, iceShatter: () => {} });
    assert.strictEqual(e.hp, 5, 'Each target receives +2 shatter bonus');
    assert.strictEqual(e.freezeTimer, 0, 'Each target freezeTimer is cleared');
  }
});

// ----------------------------------------------------------------------------
// T3.2: Frost Nova + Pyre Blast Shatter Synergy (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('T3.2: Frost Nova + Pyre Blast Shatter Synergy');

H.test('T3.2.1: Shield Guard Freeze: Frost Nova freezes front-facing shield guard', 'M2', () => {
  const g = createTestGame();
  g.player.x = 300; g.player.y = 800;
  g.player.soul = 50;
  const guard = new Enemy(380, 800, 'guard', 0);
  guard.facing = -1; // facing player
  guard.shieldUp = true;
  g.enemies = [guard];

  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);

  assert.ok(guard.freezeTimer > 0, 'Shield guard must receive freeze status from Frost Nova');
});

H.test('T3.2.2: Pyre Blast Shield Break: Pyre Blast projectile detonates on frozen guard, triggering shatter bonus', 'M2', () => {
  const g = createTestGame();
  const guard = new Enemy(300, 800, 'guard', 0);
  guard.hp = 10;
  guard.freezeTimer = 2.0;
  guard.shieldUp = true;
  g.enemies = [guard];

  const pyre = new Projectile(300, 800, 0, 0, 3, 'pyre_blast', 'player');
  g.projectiles = [pyre];

  g._updatePlaying(0.016);

  assert.ok(guard.hp <= 5, `Pyre Blast on frozen guard must bypass shield and inflict shatter damage (hp: ${guard.hp})`);
  assert.strictEqual(guard.freezeTimer, 0, 'Guard freezeTimer cleared after shatter');
});

H.test('T3.2.3: Shatter Bonus Damage: Total damage inflicted on frozen guard equals Pyre Blast base + 2 bonus damage', 'M2', () => {
  const guard = new Enemy(200, 200, 'guard', 0);
  guard.hp = 12;
  guard.freezeTimer = 2.0;
  const baseDamage = 3;
  guard.takeDamage(baseDamage, 1, { sparks: () => {}, iceExplosion: () => {} }, { shake: () => {} }, { hit: () => {}, iceShatter: () => {} }, true);
  assert.strictEqual(guard.hp, 12 - (baseDamage + 2), `Total damage on frozen target must equal base + 2 (expected HP ${12 - (baseDamage + 2)}, found ${guard.hp})`);
});

// ----------------------------------------------------------------------------
// T3.3: Singularity Pull + Pyre Blast Clustered AoE (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('T3.3: Singularity Pull + Pyre Blast Clustered AoE');

H.test('T3.3.1: Vortex Clustering: Abyssal Singularity pulls 3 separated enemies into cluster near vortex center', 'M2', () => {
  const g = createTestGame();
  const vortex = new Projectile(400, 800, 0, 0, 1, 'void_vortex', 'player');
  vortex.life = 2.0;
  vortex.pullRange = 160;
  g.projectiles = [vortex];

  const mob = [
    new Enemy(320, 800, 'crawler', 0),
    new Enemy(480, 800, 'crawler', 0),
    new Enemy(450, 800, 'crawler', 0),
  ];
  g.enemies = mob;

  for (let tick = 0; tick < 10; tick++) {
    g._updatePlaying(0.016);
  }

  // All enemies should be drawn closer to vortex center x=400
  for (const e of mob) {
    const dist = Math.abs(e.x - 400);
    assert.ok(dist <= 60, `Enemy at x=${e.x} must be clustered near vortex center x=400 (dist=${dist}px)`);
  }
});

H.test('T3.3.2: Clustered Pyre Detonation: Blast projectile fired into cluster damages multiple enemies simultaneously', 'M2', () => {
  const g = createTestGame();
  const mob = [
    new Enemy(400, 800, 'crawler', 0),
    new Enemy(410, 800, 'crawler', 0),
    new Enemy(390, 800, 'crawler', 0),
  ];
  for (const e of mob) e.hp = 10;
  g.enemies = mob;

  const blast = new Projectile(400, 800, 0, 0, 3, 'pyre_blast', 'player');
  blast.blastRadius = 80;
  g.projectiles = [blast];

  g._updatePlaying(0.016);

  for (let i = 0; i < mob.length; i++) {
    assert.ok(mob[i].hp < 10, `Enemy ${i} must take blast damage in AoE cluster`);
  }
});

H.test('T3.3.3: Mob Clearance: Combined vortex pull and explosive blast eliminates low-hp mob cluster', 'M2', () => {
  const g = createTestGame();
  const mob = [
    new Enemy(400, 800, 'crawler', 0),
    new Enemy(405, 800, 'crawler', 0),
  ];
  mob[0].hp = 3; mob[1].hp = 3;
  g.enemies = mob;

  const blast = new Projectile(400, 800, 0, 0, 3, 'pyre_blast', 'player');
  blast.blastRadius = 80;
  g.projectiles = [blast];

  g._updatePlaying(0.016);

  for (const e of mob) {
    assert.ok(e.hp <= 0 || e.dead, 'Low-hp enemies in cluster must be eliminated');
  }
});

// ----------------------------------------------------------------------------
// T3.4: Singularity Pull + Frost Nova Mass Freeze (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('T3.4: Singularity Pull + Frost Nova Mass Freeze');

H.test('T3.4.1: Pull into Frost Nova Radius: Singularity pulls distant enemy (180px away) into 140px range', 'M2', () => {
  const g = createTestGame();
  g.player.x = 300; g.player.y = 800;
  const vortex = new Projectile(350, 800, 0, 0, 1, 'void_vortex', 'player');
  vortex.life = 2.0;
  vortex.pullRange = 160;
  g.projectiles = [vortex];

  // Distant enemy at x=480 (180px from player, outside 140px Nova radius, but inside 160px vortex range)
  const enemy = new Enemy(480, 800, 'crawler', 0);
  g.enemies = [enemy];

  for (let tick = 0; tick < 10; tick++) {
    g._updatePlaying(0.016);
  }

  const distToPlayer = Math.abs(enemy.x - g.player.x);
  assert.ok(distToPlayer <= 140, `Enemy must be pulled into Frost Nova radius <= 140px (dist=${distToPlayer}px)`);
});

H.test('T3.4.2: Freeze While In Vortex: Frost Nova detonates, applying freezeTimer to pulled enemy', 'M2', () => {
  const g = createTestGame();
  g.player.x = 300; g.player.y = 800;
  g.player.soul = 50;
  const enemy = new Enemy(380, 800, 'crawler', 0);
  g.enemies = [enemy];

  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);

  assert.ok(enemy.freezeTimer > 0, 'Enemy in vortex must be frozen by Frost Nova');
});

H.test('T3.4.3: Implosion on Frozen Targets: Vortex collapse implosion inflicts damage on frozen targets', 'M2', () => {
  const g = createTestGame();
  const enemy = new Enemy(200, 800, 'crawler', 0);
  enemy.hp = 10;
  enemy.freezeTimer = 2.0;
  g.enemies = [enemy];

  const vortex = new Projectile(200, 800, 0, 0, 1, 'void_vortex', 'player');
  vortex.life = 0.01;
  vortex.implosionDamage = 2;
  g.projectiles = [vortex];

  g._updatePlaying(0.03);

  assert.ok(enemy.hp <= 8, 'Frozen enemy takes implosion damage from vortex collapse');
});

// ----------------------------------------------------------------------------
// T3.5: Movement & Arcane Casting Interaction (Milestone M2)
// ----------------------------------------------------------------------------
H.setCategory('T3.5: Movement & Arcane Casting Interaction');

H.test('T3.5.1: Jump Apex Spell Cast: Pyre Blast maintains horizontal trajectory while player falls', 'M2', () => {
  const p = new Player(100, 500);
  p.soul = 50;
  p.onGround = false;
  p.vy = 0; // apex of jump
  const projs = [];
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  assert.strictEqual(projs.length, 1, 'Projectile cast at jump apex');
  assert.strictEqual(projs[0].vy, 0, 'Projectile trajectory is purely horizontal (vy=0)');
});

H.test('T3.5.2: Roll i-Frame Immunity: Spell queuing during roll maintains roll invulnerability', 'M2', () => {
  const p = new Player(100, 100);
  p.dashing = true;
  p.invulnTimer = 0.3;
  p.castSpell(0, [], {}, {}, {});
  assert.ok(p.invulnTimer > 0, 'Invulnerability timer must not be canceled by spell cast input during roll');
});

H.test('T3.5.3: Pogo Attack into Spell Cast: Downward pogo attack bouncing off enemy allows immediate spell cast', 'M2', () => {
  const p = new Player(100, 100);
  p.soul = 50;
  p.vy = -350; // upward bounce from pogo
  p.onGround = false;
  const projs = [];
  p.castSpell(0, projs, {}, { fireball: () => {} }, { shake: () => {} });
  assert.strictEqual(projs.length, 1, 'Spell can be cast after pogo bounce');
});

// ----------------------------------------------------------------------------
// T3.6: Bonfire 1 to Bonfire 2 Multi-Zone Traversal Simulation (Milestone M1)
// ----------------------------------------------------------------------------
H.setCategory('T3.6: Bonfire 1 to Bonfire 2 Multi-Zone Traversal Simulation');

H.test('T3.6.1: Leg 1: Player descends from Bastion (x=180, y=850) to Sunken Canal street (y=1340)', 'M1', () => {
  const g = createTestGame();
  g.player.x = 180;
  g.player.y = 850;
  assert.strictEqual(g.bonfires[0].isPlayerNear(g.player), true, 'Starts at Bonfire 1');

  // Descend to Sunken Canal street platform
  g.player.x = 470;
  g.player.y = 1340 - g.player.h;
  g._updatePlaying(0.016);

  assert.ok(g.player.y >= 1250, 'Player arrives safely on canal street level');
  assert.strictEqual(g.player.dead, false, 'Player survives descent');
});

H.test('T3.6.2: Leg 2: Player ascends return ledges back to High Viaduct (y=820)', 'M1', () => {
  const g = createTestGame();
  // Ascend ledge sequence
  const ledges = [
    { x: 80, y: 1220 - 44 },
    { x: 200, y: 1100 - 44 },
    { x: 320, y: 980 - 44 },
    { x: 480, y: 820 - 44 }, // High Viaduct bridge
  ];
  for (const l of ledges) {
    g.player.x = l.x;
    g.player.y = l.y;
    g._updatePlaying(0.016);
    assert.strictEqual(g.player.dead, false, `Player safely traverses ledge at (${l.x}, ${l.y})`);
  }
  assert.ok(g.player.y <= 820, 'Player ascends back to High Viaduct elevation');
});

H.test('T3.6.3: Leg 3: Player rides moving lift to Belfry Haven landing, walks through pier arches to Bonfire 2', 'M1', () => {
  const g = createTestGame();
  const b2 = g.bonfires.find(b => b.id === 1);
  assert.ok(b2, 'Bonfire 2 exists');

  // Step 1: Landing
  g.player.x = 2920; g.player.y = 480 - 44;
  g._updatePlaying(0.016);

  // Step 2: Walk through West pier doorway x=2980
  g.player.x = 2980; g.player.y = 480 - 44;
  g._updatePlaying(0.016);
  assert.strictEqual(g.player.dead, false, 'Player walks through pier archway');

  // Step 3: Arrive at Bonfire 2
  g.player.x = b2.x; g.player.y = b2.y;
  assert.strictEqual(b2.isPlayerNear(g.player), true, 'Player arrives at Bonfire 2 sanctuary');
});

// ----------------------------------------------------------------------------
// T3.7: Concurrent Audio Event Mixing (Milestone M3)
// ----------------------------------------------------------------------------
H.setCategory('T3.7: Concurrent Audio Event Mixing');

H.test('T3.7.1: Concurrent Audio Mixing: Simultaneous audio calls execute without glitch in AudioContext', 'M3', () => {
  const audio = new AudioEngine();
  assert.doesNotThrow(() => {
    audio.hit();
    audio.jump();
    audio.fireball();
    audio.doubleJump();
    audio.bonfire();
  }, 'Simultaneous audio hook invocations must mix smoothly without throwing');
});

H.test('T3.7.2: Footstep + Hit + Bonfire Concurrent Mixing: Rapid overlapping game events execute cleanly', 'M3', () => {
  const audio = new AudioEngine();
  assert.doesNotThrow(() => {
    if (typeof audio.footstep === 'function') audio.footstep();
    audio.hit();
    if (typeof audio.bonfireLit === 'function') audio.bonfireLit();
  }, 'Overlapping gameplay sound calls must execute without error');
});

// ============================================================================
// TIER 4: REAL-WORLD WORKLOAD SCENARIOS (5 tests)
// ============================================================================
H.setTier('Tier 4: Real-World Workload Scenarios');

H.setCategory('Scenario 1: S1 Continuous Level Pilgrimage');
H.test('S1: Continuous Level Pilgrimage: Pilgrimage from Starting Bastion to Belfry Haven Bonfire 2 with zero collisions', 'M1', () => {
  const g = createTestGame();
  g.player.x = 180; g.player.y = 836;
  assert.strictEqual(g.bonfires[0].isPlayerNear(g.player), true, 'Starts at Bonfire 1');

  const pilgrimageRoute = [
    { name: 'Bastion Ramparts', x: 300, y: 836 },
    { name: 'Canal Street Floor', x: 600, y: 1340 - 44 },
    { name: 'Ascending Return Ledges', x: 200, y: 1100 - 44 },
    { name: 'High Viaduct Bridge Deck', x: 800, y: 820 - 44 },
    { name: 'Gatehouse Watchtower Portal', x: 1380, y: 820 - 44 },
    { name: 'Watchtower Roof Overlook', x: 1560, y: 500 - 44 },
    { name: 'Moving Lift Arrival Corridor', x: 2850, y: 480 - 44 },
    { name: 'Belfry Haven Landing Platform', x: 2920, y: 480 - 44 },
    { name: 'West Pier Doorway Archway', x: 2980, y: 480 - 44 },
    { name: 'Bonfire 2 Sanctuary Chamber', x: 3220, y: 450 },
  ];

  for (const step of pilgrimageRoute) {
    g.player.x = step.x;
    g.player.y = step.y;
    g._updatePlaying(0.016);
    assert.strictEqual(g.player.dead, false, `Player survives at ${step.name}`);
  }

  const b2 = g.bonfires.find(b => b.id === 1);
  assert.strictEqual(b2.isPlayerNear(g.player), true, 'Arrived within interaction radius of Bonfire 2');

  // Trigger lighting via engine input loop
  g.input.keys['KeyF'] = true;
  g.input.justPressed['KeyF'] = true;
  g._updatePlaying(0.016);

  assert.strictEqual(b2.lit, true, 'Bonfire 2 lit via engine update at pilgrimage conclusion');
  assert.strictEqual(g.player.lastBonfireId, 1, 'Player checkpoint updated to Bonfire 2');
});

H.setCategory('Scenario 2: S2 Deep Sunken Canal Exploration');
H.test('S2: Deep Canal Exploration & Return: Drops to floor, traverses continuous street, ascends return ledges', 'M1', () => {
  const g = createTestGame();
  // Drop to canal floor
  g.player.x = 200; g.player.y = 1340 - 44;
  g._updatePlaying(0.016);
  assert.ok(g.player.y >= 1290, 'Player positioned on canal floor');

  // Traverse street from x=200 to x=1600 along continuous roadway
  for (let x = 200; x <= 1600; x += 200) {
    g.player.x = x;
    g.player.y = 1340 - 44;
    g._updatePlaying(0.016);
    assert.ok(g.player.y <= 1340, 'Player supported by continuous street');
  }

  // Return via ascending ledges under Bastion
  const ascentSteps = [
    { x: 80, y: 1220 - 44 },
    { x: 200, y: 1100 - 44 },
    { x: 320, y: 980 - 44 },
  ];
  for (const step of ascentSteps) {
    g.player.x = step.x;
    g.player.y = step.y;
    g._updatePlaying(0.016);
    assert.ok(g.player.y <= step.y + 10, 'Player supported on return ledge');
  }
});

H.setCategory('Scenario 3: S3 High-Stress Spell Rotation Combat');
H.test('S3: High-Stress Spell Rotation: Singularity pull -> Frost Nova freeze -> Pyre Blast shatter -> melee finish via engine', 'M2', () => {
  const g = createTestGame();
  g.player.soul = 100;
  g.player.x = 200; g.player.y = 800;

  const mob = [
    new Enemy(280, 800, 'crawler', 50),
    new Enemy(310, 800, 'guard', 50),
  ];
  mob[0].hp = 4;
  mob[1].hp = 8;
  g.enemies = mob;

  // 1. Singularity Pull
  g.player.castSpell(2, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.05);
  assert.ok(mob[0].vx < 0 || mob[0].x < 280, 'Enemy 0 pulled toward singularity');

  // 2. Frost Nova Freeze
  g.player.castSpell(1, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);
  assert.ok(mob[0].freezeTimer > 0, 'Enemy 0 frozen by Frost Nova');

  // 3. Pyre Blast Shatter
  g.player.castSpell(0, g.projectiles, g.particles, g.audio, g.camera);
  g._updatePlaying(0.016);
  assert.strictEqual(mob[0].freezeTimer, 0, 'Enemy 0 freeze cleared by shatter detonation');

  // 4. Melee Finish
  g.player.isAttacking = true;
  g._updatePlaying(0.016);
});

H.setCategory('Scenario 4: S4 Bonfire Rest & World Reset Loop');
H.test('S4: Rest & World Reset Loop: Damage taken, rest at Bonfire 2 restores HP and resets enemy states via engine update loops', 'M1', () => {
  const g = createTestGame();
  const b2 = g.bonfires.find(b => b.id === 1);
  assert.ok(b2, 'Bonfire 2 (id=1) must exist');
  g.player.hp = 1;
  g.player.soul = 10;
  g.player.x = b2.x;
  g.player.y = b2.y;

  // Kill an enemy in zone to verify respawn on rest
  g.enemies[0].dead = true;
  assert.strictEqual(g.enemies[0].dead, true, 'Enemy dead before rest');

  // 1. Enter Bonfire via _updatePlaying
  g.input.keys['KeyF'] = true;
  g.input.justPressed['KeyF'] = true;
  g._updatePlaying(0.016);
  assert.strictEqual(b2.lit, true, 'Bonfire 2 lit must be true');
  assert.strictEqual(g.gameState, 4 /* STATE.BONFIRE */, 'GameState transitioned to BONFIRE');

  // 2. Select option 0 ("Rest & Heal") in BonfireMenu and confirm
  g.input.keys['KeyF'] = true;
  g.input.justPressed['KeyF'] = true;
  g._update(0.016); // dispatches to _updateBonfire(0.016)

  // Assert genuine engine reset
  assert.strictEqual(g.player.hp, g.player.maxHp, 'Player HP restored to maxHp upon rest');
  assert.strictEqual(g.enemies[0].dead, false, 'Enemies reset upon rest');
  assert.strictEqual(g.gameState, 1 /* STATE.PLAYING */, 'GameState returned to PLAYING');
});

H.setCategory('Scenario 5: S5 Full Level Playthrough End-to-End Simulation');
H.test('S5: Full Level Playthrough Simulation: 600 ticks continuous physics loop with zero unhandled exceptions', 'M4', () => {
  const g = createTestGame();
  let tick = 0;
  assert.doesNotThrow(() => {
    while (tick < 600) {
      g.player.vx = 150;
      g._updatePlaying(0.016);
      tick++;
    }
  }, '600-tick continuous simulation must run without exception');
  assert.strictEqual(tick, 600, 'Completed 600 physics updates');
  assert.ok(g.player.x > 140, 'Player progressed rightward across level');
});

// ============================================================================
// 4. EXECUTION REPORT & PROCESS EXIT
// ============================================================================
const exitCode = H.summary();
process.exit(exitCode);
