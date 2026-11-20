// ============================================================================
// ABYSSAL KNIGHT — 2D Action Platformer (Expanded Edition)
// Spells, Bonfires, Multiple Weapons, Key Rebinding, Smooth Camera
// Pure vanilla JS + HTML5 Canvas — no dependencies
// ============================================================================
'use strict';

const CANVAS_W = 1280, CANVAS_H = 720;
const CAMERA_ZOOM = 1.65; // Hollow Knight style close-up
const TILE = 40;
const GRAVITY = 1800;
const TERMINAL_VEL = 900;
const STATE = { TITLE: 0, PLAYING: 1, DEAD: 2, WIN: 3, BONFIRE: 4, REBIND: 5 };

// ============================================================================
// UTILITIES
// ============================================================================
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(lo, hi) { return Math.random() * (hi - lo) + lo; }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ============================================================================
// KEY BINDING SYSTEM
// ============================================================================
const DEFAULT_BINDINGS = {
  moveLeft: ['ArrowLeft', 'KeyA'],
  moveRight: ['ArrowRight', 'KeyD'],
  moveDown: ['ArrowDown', 'KeyS'],
  jump: ['ArrowUp', 'KeyW', 'Space'],
  attack: ['KeyJ'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyK'],
  heal: ['KeyQ'],
  interact: ['KeyF'],
  spell1: ['Digit1'],
  spell2: ['Digit2'],
  spell3: ['Digit3'],
  weapon1: ['Digit7'],
  weapon2: ['Digit8'],
  weapon3: ['Digit9'],
  weapon4: ['Digit0'],
  weaponNext: ['KeyR'],
  pause: ['Escape'],
  help: ['KeyH'],
  restart: ['KeyN', 'KeyR', 'Space', 'Enter'],
};

class KeyBindings {
  constructor() {
    this.bindings = {};
    this.load();
  }
  load() {
    try {
      const saved = localStorage.getItem('abyssalKnightBindings');
      if (saved) {
        this.bindings = { ...JSON.parse(JSON.stringify(DEFAULT_BINDINGS)), ...JSON.parse(saved) };
        return;
      }
    } catch (e) { }
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }
  save() {
    try { localStorage.setItem('abyssalKnightBindings', JSON.stringify(this.bindings)); } catch (e) { }
  }
  reset() {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    this.save();
  }
  getKeys(action) { return this.bindings[action] || []; }
  setKey(action, keyCode) {
    // Remove this key from any other action
    for (const a in this.bindings) {
      this.bindings[a] = this.bindings[a].filter(k => k !== keyCode);
    }
    if (!this.bindings[action]) this.bindings[action] = [];
    this.bindings[action].push(keyCode);
    this.save();
  }
  getActionLabel(action) {
    const labels = {
      moveLeft: 'Move Left', moveRight: 'Move Right', moveDown: 'Aim / Look Down', jump: 'Jump',
      attack: 'Attack', dash: 'Dash', heal: 'Heal', interact: 'Interact',
      spell1: 'Spell: Fireball', spell2: 'Spell: Ice Nova', spell3: 'Spell: Shadow Bolt',
      weapon1: 'Weapon 1', weapon2: 'Weapon 2', weapon3: 'Weapon 3', weapon4: 'Weapon 4',
      weaponNext: 'Next Weapon', pause: 'Pause', help: 'Help', restart: 'Restart',
    };
    return labels[action] || action;
  }
  getKeyLabel(code) {
    const map = {
      ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
      Space: 'Space', ShiftLeft: 'LShift', ShiftRight: 'RShift',
      ControlLeft: 'LCtrl', ControlRight: 'RCtrl', AltLeft: 'LAlt', AltRight: 'RAlt',
      Enter: 'Enter', Backspace: 'Bksp', Tab: 'Tab',
    };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }
}

// ============================================================================
// INPUT MANAGER
// ============================================================================
class InputManager {
  constructor(bindings) {
    this.bindings = bindings;
    this.keys = {};
    this.justPressed = {};
    this._prev = {};
    this.mouseDown = false;
    this.mouseJustPressed = false;
    this.lastKeyPressed = null; // for rebinding
    this._pendingLastKey = null;

    window.addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
      this._pendingLastKey = e.code;
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('mousedown', e => { if (e.button === 0) { this.mouseDown = true; this.mouseJustPressed = true; } });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.mouseDown = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });
  }
  update() {
    this.justPressed = {};
    for (const k in this.keys) {
      if (this.keys[k] && !this._prev[k]) this.justPressed[k] = true;
    }
    this._prev = { ...this.keys };
    this.lastKeyPressed = this._pendingLastKey;
    this._pendingLastKey = null;
  }
  isDown(code) { return !!this.keys[code]; }
  wasPressed(code) { return !!this.justPressed[code]; }
  _isDown(action) { return this.bindings.getKeys(action).some(k => !!this.keys[k]); }
  _wasPressed(action) { return this.bindings.getKeys(action).some(k => !!this.justPressed[k]); }

  left() { return this._isDown('moveLeft'); }
  right() { return this._isDown('moveRight'); }
  jumpHeld() { return this._isDown('jump'); }
  jumpPressed() { return this._wasPressed('jump'); }
  attackPressed() { const m = this.mouseJustPressed; this.mouseJustPressed = false; return this._wasPressed('attack') || m; }
  dashPressed() { return this._wasPressed('dash'); }
  healPressed() { return this._wasPressed('heal'); }
  interactPressed() { return this._wasPressed('interact'); }
  spell1Pressed() { return this._wasPressed('spell1'); }
  spell2Pressed() { return this._wasPressed('spell2'); }
  spell3Pressed() { return this._wasPressed('spell3'); }
  weaponNext() { return this._wasPressed('weaponNext'); }
  weapon(n) { return this._wasPressed('weapon' + n); }
  pausePressed() { return this._wasPressed('pause'); }
  helpPressed() { return this._wasPressed('help'); }
  restartPressed() { return this._wasPressed('restart'); }
  up() { return this.isDown('ArrowUp') || this.isDown('KeyW'); }
  down() { return this._isDown('moveDown') || this.isDown('ArrowDown') || this.isDown('KeyS'); }
  anyKey() { return Object.values(this.keys).some(v => v) || this.mouseDown; }
}

// ============================================================================
// AUDIO ENGINE
// ============================================================================
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.buffers = {};
    this.loading = false;
    this.loaded = false;
    this.soundPaths = {
      swing: 'assets/sounds/swing.wav',
      heavySwing: 'assets/sounds/heavy_swing.wav',
      quickSwing: 'assets/sounds/quick_swing.wav',
      hit: 'assets/sounds/hit.wav',
      nailHit: 'assets/sounds/nail_hit.wav',
      nailSlash: 'assets/sounds/nail_slash.wav',
      dash: 'assets/sounds/dash.wav',
      dodgeRoll: 'assets/sounds/dodge_roll.wav',
      dodgeSuccess: 'assets/sounds/dodge_success.wav',
      pogo: 'assets/sounds/pogo.wav',
      jump: 'assets/sounds/jump.wav',
      doubleJump: 'assets/sounds/double_jump.wav',
      enemyDeath: 'assets/sounds/enemy_death.wav',
      playerHurt: 'assets/sounds/player_hurt.wav',
      heal: 'assets/sounds/heal.wav',
      bossRoar: 'assets/sounds/boss_roar.wav',
      fireball: 'assets/sounds/fireball.wav',
      iceNova: 'assets/sounds/ice_nova.wav',
      shadowBolt: 'assets/sounds/shadow_bolt.wav',
      bonfire: 'assets/sounds/bonfire.wav',
      weaponSwitch: 'assets/sounds/weapon_switch.wav',
      bossTelegraph: 'assets/sounds/boss_telegraph.wav',
      bossThrustGlint: 'assets/sounds/boss_thrust_glint.wav',
      bossVoidCharge: 'assets/sounds/boss_void_charge.wav',
    };
    this.preload();
  }

  preload() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.35;
        this.masterGain.connect(this.ctx.destination);
      }
      this.loadSounds();
    } catch (e) {
      console.warn('AudioContext preloading skipped:', e);
    }
  }

  init() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.35;
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (!this.loaded && !this.loading) {
        this.loadSounds();
      }
    } catch (e) {
      this.enabled = false;
    }
  }

  async loadSounds() {
    if (!this.ctx || this.loading || this.loaded) return;
    this.loading = true;
    const entries = Object.entries(this.soundPaths);
    await Promise.all(entries.map(async ([key, url]) => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return;
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
        this.buffers[key] = audioBuf;
      } catch (err) {
        // Handled silently with fallback synthesis
      }
    }));
    this.loaded = true;
    this.loading = false;
  }

  playSample(name, vol = 1.0, pitchVariation = 0.08) {
    if (!this.enabled || !this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const buf = this.buffers[name];
    if (!buf) return false;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buf;

      if (pitchVariation > 0) {
        const detune = 1.0 + (Math.random() * 2 - 1) * pitchVariation;
        source.playbackRate.setValueAtTime(detune, this.ctx.currentTime);
      }

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(clamp(vol, 0.0, 2.0), this.ctx.currentTime);

      source.connect(gain);
      gain.connect(this.masterGain);
      source.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  _play(fn) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    fn(this.ctx, this.masterGain);
  }
  _noise(dur, vol, decay) {
    this._play((ctx, dest) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay || 2);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      s.connect(g); g.connect(dest); s.start();
    });
  }
  _tone(freq, freqEnd, type, dur, vol) {
    this._play((ctx, dest) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
    });
  }

  swing() {
    if (!this.playSample('swing', 0.85, 0.08)) {
      this._tone(300, 100, 'sawtooth', 0.08, 0.3);
    }
  }
  heavySwing() {
    if (!this.playSample('heavySwing', 1.1, 0.06)) {
      this._tone(200, 50, 'sawtooth', 0.14, 0.4);
    }
  }
  quickSwing() {
    if (!this.playSample('quickSwing', 0.8, 0.09)) {
      this._tone(500, 200, 'sawtooth', 0.05, 0.25);
    }
  }
  hit() {
    if (!this.playSample('hit', 1.15, 0.07)) {
      this._noise(0.12, 0.5, 2);
    }
  }
  dash() {
    if (!this.playSample('dash', 0.85, 0.05)) {
      this._noise(0.15, 0.3, 1.5);
    }
  }
  dodgeRoll() {
    if (!this.playSample('dodgeRoll', 0.85, 0.08)) {
      this._noise(0.18, 0.25, 1.2);
    }
  }
  dodgeSuccess() {
    if (!this.playSample('dodgeSuccess', 0.9, 0.0)) {
      this._tone(600, 1100, 'sine', 0.2, 0.3);
    }
  }
  nailSlash() {
    if (!this.playSample('nailSlash', 0.9, 0.07)) {
      this._play((ctx, dest) => {
        const dur = 0.08;
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5) * 0.5;
        const s = ctx.createBufferSource(); s.buffer = buf;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.4, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(400, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + dur);
        const og = ctx.createGain(); og.gain.value = 0.15;
        o.connect(og); og.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
        s.connect(g); g.connect(dest); s.start();
      });
    }
  }
  nailHit() {
    if (!this.playSample('nailHit', 1.05, 0.06)) {
      this._play((ctx, dest) => {
        const dur = 0.1;
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2) * 0.6;
        const s = ctx.createBufferSource(); s.buffer = buf;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.5, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        s.connect(g); g.connect(dest); s.start();
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(200, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + dur);
        const og = ctx.createGain(); og.gain.value = 0.25;
        o.connect(og); og.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
      });
    }
  }
  pogo() {
    if (!this.playSample('pogo', 0.95, 0.04)) {
      this._tone(500, 900, 'sine', 0.12, 0.3);
    }
  }
  jump() {
    if (!this.playSample('jump', 0.7, 0.06)) {
      this._tone(200, 500, 'square', 0.12, 0.15);
    }
  }
  doubleJump() {
    if (!this.playSample('doubleJump', 0.85, 0.05)) {
      this._tone(350, 750, 'sine', 0.16, 0.25); this._noise(0.1, 0.15, 2);
    }
  }
  enemyDeath() {
    if (!this.playSample('enemyDeath', 1.0, 0.07)) {
      this._tone(400, 60, 'square', 0.3, 0.25);
    }
  }
  playerHurt() {
    if (!this.playSample('playerHurt', 1.25, 0.05)) {
      this._tone(300, 100, 'sawtooth', 0.2, 0.35);
    }
  }
  heal() {
    if (!this.playSample('heal', 0.95, 0.0)) {
      this._tone(400, 800, 'sine', 0.3, 0.2);
    }
  }
  bossRoar() {
    if (!this.playSample('bossRoar', 1.35, 0.03)) {
      this._play((ctx, dest) => {
        const dur = 0.8;
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o2.type = 'square';
        o.frequency.setValueAtTime(80, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + dur);
        o2.frequency.setValueAtTime(85, ctx.currentTime); o2.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + dur);
        g.gain.setValueAtTime(0.4, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(g); o2.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur); o2.start(); o2.stop(ctx.currentTime + dur);
      });
    }
  }
  fireball() {
    if (!this.playSample('fireball', 0.9, 0.06)) {
      this._tone(200, 600, 'sawtooth', 0.2, 0.25);
    }
  }
  iceNova() {
    if (!this.playSample('iceNova', 0.95, 0.05)) {
      this._tone(800, 200, 'sine', 0.35, 0.3);
    }
  }
  shadowBolt() {
    if (!this.playSample('shadowBolt', 0.85, 0.06)) {
      this._tone(100, 400, 'square', 0.15, 0.3);
    }
  }
  bonfire() {
    if (!this.playSample('bonfire', 0.9, 0.0)) {
      this._tone(300, 600, 'sine', 0.5, 0.15);
    }
  }
  weaponSwitch() {
    if (!this.playSample('weaponSwitch', 0.8, 0.06)) {
      this._tone(600, 800, 'sine', 0.06, 0.1);
    }
  }
  bossTelegraph() {
    if (!this.playSample('bossTelegraph', 0.9, 0.02)) {
      this._play((ctx, dest) => {
        const dur = 0.22;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(950, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(1550, ctx.currentTime + dur);
        g.gain.setValueAtTime(0.28, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
      });
    }
  }
  bossThrustGlint() {
    if (!this.playSample('bossThrustGlint', 0.9, 0.03)) {
      this._play((ctx, dest) => {
        const dur = 0.18;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(700, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(1350, ctx.currentTime + dur);
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
      });
    }
  }
  bossVoidCharge() {
    if (!this.playSample('bossVoidCharge', 1.0, 0.03)) {
      this._play((ctx, dest) => {
        const dur = 0.45;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(90, ctx.currentTime);
        o.frequency.linearRampToValueAtTime(260, ctx.currentTime + dur);
        g.gain.setValueAtTime(0.22, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
      });
    }
  }
}

// ============================================================================
// CAMERA — extra smooth with configurable dampening
// ============================================================================
class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.zoom = CAMERA_ZOOM;
    this.shakeX = 0; this.shakeY = 0;
    this.shakeDur = 0; this.shakeIntensity = 0;
    this.targetX = 0; this.targetY = 0;
    this.levelWidth = 0; this.levelHeight = 0;
    // Smooth camera params
    this.smoothX = 4.5;   // horizontal follow speed (faster for zoomed)
    this.smoothY = 5.5;   // vertical follow speed
    this.lookAheadX = 60;  // pixels ahead in movement dir (smaller for zoom)
    this.lookAheadY = 30;  // pixels down when falling
    this.lookAheadSmooth = 3.0; // how fast look-ahead shifts
    this.currentLookX = 0;
    this.currentLookY = 0;
    this.deadZoneX = 8;
    this.deadZoneY = 6;
  }
  follow(player, dt) {
    // Compute desired look-ahead
    const desiredLookX = player.facing * this.lookAheadX;
    const desiredLookY = player.vy > 100 ? this.lookAheadY : player.vy < -100 ? -this.lookAheadY * 0.5 : 0;
    // Smoothly shift look-ahead
    this.currentLookX = lerp(this.currentLookX, desiredLookX, 1 - Math.exp(-this.lookAheadSmooth * dt));
    this.currentLookY = lerp(this.currentLookY, desiredLookY, 1 - Math.exp(-this.lookAheadSmooth * dt));

    const viewW = CANVAS_W / this.zoom;
    const viewH = CANVAS_H / this.zoom;
    this.targetX = player.x + player.w / 2 - viewW / 2 + this.currentLookX;
    this.targetY = player.y + player.h / 2 - viewH / 2 + this.currentLookY;

    // Dead-zone: don't update if target is very close
    const dxCam = this.targetX - this.x;
    const dyCam = this.targetY - this.y;
    if (Math.abs(dxCam) > this.deadZoneX) {
      this.x = lerp(this.x, this.targetX, 1 - Math.exp(-this.smoothX * dt));
    }
    if (Math.abs(dyCam) > this.deadZoneY) {
      this.y = lerp(this.y, this.targetY, 1 - Math.exp(-this.smoothY * dt));
    }

    const vw = CANVAS_W / this.zoom;
    const vh = CANVAS_H / this.zoom;
    this.x = clamp(this.x, 0, Math.max(0, this.levelWidth - vw));
    this.y = clamp(this.y, 0, Math.max(0, this.levelHeight - vh));

    if (this.shakeDur > 0) {
      this.shakeDur -= dt;
      this.shakeX = rand(-this.shakeIntensity, this.shakeIntensity);
      this.shakeY = rand(-this.shakeIntensity, this.shakeIntensity);
      this.shakeIntensity *= 0.92;
    } else { this.shakeX = 0; this.shakeY = 0; }
  }
  shake(intensity, duration) { this.shakeIntensity = Math.max(this.shakeIntensity, intensity); this.shakeDur = Math.max(this.shakeDur, duration); }
  apply(ctx) {
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-Math.round(this.x + this.shakeX), -Math.round(this.y + this.shakeY));
  }
  screenToWorld(sx, sy) { return { x: sx / this.zoom + this.x, y: sy / this.zoom + this.y }; }
}

// ============================================================================
// PARTICLES
// ============================================================================
class Particle {
  constructor(x, y, vx, vy, life, color, size, gravity, fadeOut, type) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = this.maxLife = life; this.color = color; this.size = size;
    this.gravity = gravity || 0; this.fadeOut = fadeOut !== false;
    this.type = type || 'square'; this.dead = false;
  }
  update(dt) {
    this.vy += this.gravity * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt; if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const alpha = this.fadeOut ? clamp(this.life / this.maxLife, 0, 1) : 1;
    const s = this.size * (this.type === 'soul' ? (0.5 + 0.5 * alpha) : 1);
    ctx.globalAlpha = alpha;
    if (this.type === 'soul') {
      ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x, this.y, s * 0.4, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'fire') {
      ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, s, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = this.color; ctx.fillRect(this.x - s / 2, this.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }
}

class ParticleSystem {
  constructor() { this.particles = []; }
  add(p) { this.particles.push(p); }
  update(dt) { for (let i = this.particles.length - 1; i >= 0; i--) { this.particles[i].update(dt); if (this.particles[i].dead) this.particles.splice(i, 1); } }
  draw(ctx) { for (const p of this.particles) p.draw(ctx); }
  clear() { this.particles = []; }

  dustLand(x, y) { for (let i = 0; i < 8; i++) this.add(new Particle(x + rand(-10, 10), y, rand(-60, 60), rand(-40, -10), rand(0.2, 0.5), '#8888aa', rand(2, 4), 200)); }
  dustRun(x, y, dir) { this.add(new Particle(x, y, rand(-20, 20) - dir * 30, rand(-30, -5), rand(0.15, 0.3), '#7777aa', rand(2, 3), 100)); }
  rollDust(x, y, dir) { for (let i = 0; i < 3; i++) this.add(new Particle(x, y, rand(-30, 30) - dir * 40, rand(-40, -10), rand(0.2, 0.4), '#8888aa', rand(2, 4), 150)); }
  dodgeSparks(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2), s = rand(80, 220);
      this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.5), rand(0, 1) > 0.4 ? '#66eeff' : '#ffffff', rand(3, 5), -20, true, 'soul'));
    }
  }
  monarchWings(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), s = rand(40, 100);
      this.add(new Particle(x + rand(-12, 12), y - 8, Math.cos(a) * s, Math.sin(a) * s + 20, rand(0.25, 0.5), rand(0, 1) > 0.4 ? '#ffffff' : '#88eeff', rand(2, 5), 60, true, 'soul'));
    }
  }
  sparks(x, y) { for (let i = 0; i < 6; i++) this.add(new Particle(x, y, rand(-200, 200), rand(-200, 50), rand(0.1, 0.3), rand(0, 1) > 0.5 ? '#fff' : '#ffcc44', rand(2, 4), 400)); }
  nailSlash(x, y, dir, angle) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-0.6, 0.6);
      const s = rand(100, 250);
      this.add(new Particle(x, y, Math.cos(a) * s * dir, Math.sin(a) * s, rand(0.08, 0.18), '#ffffff', rand(2, 4), 0, true));
    }
  }
  pogoSparks(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
      const s = rand(80, 220);
      const col = Math.random() < 0.4 ? '#ffffff' : (Math.random() < 0.5 ? '#88eeff' : '#44bbff');
      this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.18, 0.35), col, rand(2, 5), 180, true));
    }
    this.add(new Particle(x, y, 0, 0, 0.15, '#ffffff', 14, 0, false));
    this.add(new Particle(x, y, 0, 0, 0.22, '#88ddff', 22, 0, false));
  }
  soulBurst(x, y) { for (let i = 0; i < 12; i++) { const a = rand(0, Math.PI * 2), s = rand(40, 120); this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.6, 1.5), '#66ddff', rand(3, 6), -50, true, 'soul')); } }
  dashTrail(x, y, w, h, f) { for (let i = 0; i < 3; i++) this.add(new Particle(x + rand(0, w), y + rand(0, h), -f * rand(10, 40), rand(-20, 20), rand(0.1, 0.25), 'rgba(100,200,255,0.6)', rand(4, 8), 0)); }
  shockwave(x, y, dir) { for (let i = 0; i < 15; i++) this.add(new Particle(x + dir * i * 20, y - 5, dir * rand(60, 150), rand(-80, -20), rand(0.3, 0.6), '#ffaa44', rand(3, 6), 300)); }
  deathBurst(x, y) { for (let i = 0; i < 30; i++) { const a = rand(0, Math.PI * 2), s = rand(50, 200); this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.5, 1.2), rand(0, 1) > 0.5 ? '#66ddff' : '#ffffff', rand(3, 7), 200, true, 'soul')); } }
  fireEmbers(x, y) {
    for (let i = 0; i < 2; i++) {
      const c = ['#ff6622', '#ffaa33', '#ff4411', '#ffcc66'][randInt(0, 3)];
      this.add(new Particle(x + rand(-8, 8), y, rand(-15, 15), rand(-60, -20), rand(0.3, 0.8), c, rand(2, 4), -30, true, 'fire'));
    }
  }
  fireballTrail(x, y) { for (let i = 0; i < 2; i++) this.add(new Particle(x + rand(-6, 6), y + rand(-6, 6), rand(-30, 30), rand(-30, 30), rand(0.1, 0.25), '#ff8833', rand(3, 5), 0, true, 'fire')); }
  iceExplosion(x, y) { for (let i = 0; i < 20; i++) { const a = rand(0, Math.PI * 2), s = rand(80, 200); this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.7), '#aaeeff', rand(3, 6), 100)); } }
  shadowTrail(x, y) { for (let i = 0; i < 2; i++) this.add(new Particle(x + rand(-4, 4), y + rand(-4, 4), rand(-20, 20), rand(-20, 20), rand(0.15, 0.3), '#8844cc', rand(3, 5), 0, true, 'fire')); }
  bossTelegraphSparkle(x, y, color = '#ff3344') {
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2), s = rand(60, 220);
      this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.18, 0.4), color, rand(2, 5), 0, true, 'soul'));
    }
  }
  bossVoidVortex(x, y) {
    for (let i = 0; i < 3; i++) {
      const a = rand(0, Math.PI * 2), dist = rand(40, 85);
      const px = x + Math.cos(a) * dist, py = y + Math.sin(a) * dist;
      const speed = rand(100, 190);
      this.add(new Particle(px, py, -Math.cos(a) * speed, -Math.sin(a) * speed, rand(0.2, 0.38), '#c044ff', rand(2, 5), 0, true, 'soul'));
    }
  }
  bossLandingShock(x, y) {
    for (let i = 0; i < 16; i++) {
      const dir = rand(0, 1) > 0.5 ? 1 : -1;
      this.add(new Particle(x + rand(-24, 24), y, dir * rand(60, 220), rand(-130, -30), rand(0.3, 0.65), '#ff6622', rand(3, 6), 350));
    }
  }
}

// ============================================================================
// WEAPON DEFINITIONS
// ============================================================================
const WEAPONS = [
  {
    name: 'Old Nail',
    damage: 1,
    range: 56,         // hitbox width (generous like HK)
    height: 42,        // hitbox height
    attackDur: 0.22,
    cooldown: 0.1,
    knockback: 200,
    color: '#aabbdd',
    guardColor: '#8899bb',
    handleColor: '#554433',
    bladeW: 3, bladeL: 26,
    swingArc: 2.4,
    swingStart: -1.2,
    sound: 'swing',
  },
  {
    name: 'Coiled Nail',
    damage: 3,
    range: 72,
    height: 52,
    attackDur: 0.35,
    cooldown: 0.22,
    knockback: 350,
    color: '#99aacc',
    guardColor: '#7788aa',
    handleColor: '#443322',
    bladeW: 5, bladeL: 38,
    swingArc: 3.0,
    swingStart: -1.5,
    sound: 'heavySwing',
  },
  {
    name: 'Quick Nail',
    damage: 1,
    range: 40,
    height: 32,
    attackDur: 0.1,
    cooldown: 0.05,
    knockback: 100,
    color: '#ccddee',
    guardColor: '#aabbcc',
    handleColor: '#665544',
    bladeW: 2, bladeL: 16,
    swingArc: 1.8,
    swingStart: -0.9,
    sound: 'quickSwing',
  },
  {
    name: 'Long Nail',
    damage: 2,
    range: 80,
    height: 22,
    attackDur: 0.2,
    cooldown: 0.2,
    knockback: 250,
    color: '#bbccdd',
    guardColor: '#8899aa',
    handleColor: '#554422',
    bladeW: 3, bladeL: 42,
    swingArc: 0.8,   // narrow thrust
    swingStart: -0.1,
    isThrust: true,
    sound: 'swing',
  },
];

// ============================================================================
// SPELL DEFINITIONS
// ============================================================================
const SPELLS = [
  {
    name: 'Fireball',
    soulCost: 20,
    cooldown: 1.0,
    icon: '🔥',
    color: '#ff6622',
    desc: 'Launches a flaming projectile',
  },
  {
    name: 'Ice Nova',
    soulCost: 35,
    cooldown: 2.0,
    icon: '❄',
    color: '#88ccff',
    desc: 'AoE frost burst around you',
  },
  {
    name: 'Shadow Bolt',
    soulCost: 15,
    cooldown: 0.6,
    icon: '🌑',
    color: '#9955dd',
    desc: 'Fast dark projectile',
  },
];

// ============================================================================
// PROJECTILES (for spells)
// ============================================================================
class Projectile {
  constructor(x, y, vx, vy, damage, type, owner) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.w = 12; this.h = 12; this.damage = damage;
    this.type = type; this.owner = owner;
    this.life = 3.0; this.dead = false;
    this.reflected = false;
    if (type === 'fireball') { this.w = 16; this.h = 16; this.life = 2.5; }
    if (type === 'shadowbolt') { this.w = 10; this.h = 10; this.life = 2.0; }
    if (type === 'acid_spit') { this.w = 14; this.h = 14; this.life = 3.2; }
    if (type === 'void_wave') { this.w = 28; this.h = 48; this.life = 2.2; }
    if (type === 'stalactite') { this.w = 18; this.h = 32; this.life = 2.5; }
  }
  update(dt, level, particles) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    // Trail
    if (this.type === 'fireball') particles.fireballTrail(this.x, this.y);
    if (this.type === 'shadowbolt') particles.shadowTrail(this.x, this.y);
    if (this.type === 'acid_spit') {
      if (Math.random() < 0.4) {
        particles.add(new Particle(this.x + this.w / 2, this.y + this.h / 2, rand(-15, 15), rand(-15, 15), 0.2, this.reflected ? '#55ccff' : '#66ff33', rand(2, 4), 0, true));
      }
    }
    if (this.type === 'void_wave') {
      if (Math.random() < 0.5) {
        particles.add(new Particle(this.x + this.w / 2, this.y + rand(0, this.h), -Math.sign(this.vx || 1) * rand(20, 50), rand(-20, 20), 0.25, '#bb33ff', rand(3, 5), 0, true));
      }
    }
    // Platform collision
    for (const p of level.platforms) {
      if (p.type === 'oneway') continue;
      if (p.isGate && !level.gateClosed) continue;
      if (rectsOverlap(this, p)) {
        this.dead = true;
        if (this.type === 'stalactite') {
          particles.sparks(this.x + this.w / 2, p.y);
        }
        break;
      }
    }
  }
  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    if (this.type === 'fireball') {
      ctx.fillStyle = '#ff6622';
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcc44';
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 4, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'shadowbolt') {
      ctx.fillStyle = '#8833cc';
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cc77ff';
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 3, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'acid_spit') {
      ctx.fillStyle = this.reflected ? '#33aaff' : '#55dd22';
      ctx.shadowColor = this.reflected ? '#66ccff' : '#88ff33';
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'void_wave') {
      ctx.fillStyle = '#9922ee';
      ctx.shadowColor = '#cc44ff';
      ctx.shadowBlur = 14;
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 2, this.y + 8, 4, this.h - 16);
    } else if (this.type === 'stalactite') {
      ctx.fillStyle = '#443355';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.w, this.y);
      ctx.lineTo(this.x + this.w / 2, this.y + this.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#776688';
      ctx.fillRect(this.x + 2, this.y, this.w - 4, 4);
    }
    ctx.restore();
  }
  getBounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ============================================================================
// BONFIRE
// ============================================================================
class Bonfire {
  constructor(x, y, id) {
    this.x = x; this.y = y; this.id = id;
    this.w = 30; this.h = 30;
    this.lit = false; // becomes lit on first interact
    this.animTimer = 0;
    this.interactRange = 50;
  }
  update(dt, particles) {
    this.animTimer += dt;
    if (this.lit && Math.random() < 0.3) {
      particles.fireEmbers(this.x + this.w / 2, this.y);
    }
  }
  draw(ctx) {
    const x = this.x, y = this.y;
    // Stone base
    ctx.fillStyle = '#444455';
    ctx.beginPath();
    ctx.arc(x + 15, y + 28, 18, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#333344';
    ctx.fillRect(x - 3, y + 22, 36, 10);

    // Sword (like Elden Ring site of grace / Dark Souls bonfire)
    ctx.fillStyle = '#667788';
    ctx.fillRect(x + 13, y - 10, 4, 36);
    ctx.fillStyle = '#778899';
    ctx.fillRect(x + 7, y - 4, 16, 4);

    if (this.lit) {
      // Fire glow
      const flicker = Math.sin(this.animTimer * 8) * 0.15 + 0.85;
      ctx.save();
      ctx.globalAlpha = 0.3 * flicker;
      const grad = ctx.createRadialGradient(x + 15, y + 5, 5, x + 15, y + 5, 50);
      grad.addColorStop(0, '#ffaa33');
      grad.addColorStop(1, 'rgba(255,100,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 40, y - 50, 100, 100);
      ctx.restore();

      // Flames
      const flames = [
        { dx: 0, s: 1 }, { dx: -5, s: 0.7 }, { dx: 5, s: 0.8 }
      ];
      for (const f of flames) {
        const fh = (12 + Math.sin(this.animTimer * 10 + f.dx) * 4) * f.s;
        ctx.fillStyle = '#ff6622';
        ctx.beginPath();
        ctx.moveTo(x + 15 + f.dx - 5 * f.s, y + 5);
        ctx.quadraticCurveTo(x + 15 + f.dx - 3 * f.s, y + 5 - fh * 0.6, x + 15 + f.dx, y + 5 - fh);
        ctx.quadraticCurveTo(x + 15 + f.dx + 3 * f.s, y + 5 - fh * 0.6, x + 15 + f.dx + 5 * f.s, y + 5);
        ctx.fill();
        // Inner flame
        ctx.fillStyle = '#ffcc44';
        ctx.beginPath();
        const ih = fh * 0.5;
        ctx.moveTo(x + 15 + f.dx - 2 * f.s, y + 5);
        ctx.quadraticCurveTo(x + 15 + f.dx, y + 5 - ih, x + 15 + f.dx + 2 * f.s, y + 5);
        ctx.fill();
      }
    } else {
      // Unlit — just embers
      ctx.fillStyle = '#553322';
      ctx.beginPath();
      ctx.arc(x + 15, y + 8, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Interaction prompt
    if (this._showPrompt) {
      ctx.fillStyle = '#ccaa66';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[F] Rest', x + 15, y - 20);
      ctx.textAlign = 'left';
      this._showPrompt = false;
    }
  }
  isPlayerNear(player) {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    return Math.hypot(cx - px, cy - py) < this.interactRange;
  }
}

// ============================================================================
// LEVEL DATA
// ============================================================================
function buildLevel() {
  const platforms = [];
  const enemies = [];
  const bonfires = [];
  const P = (x, y, w, h, type = 'solid') => platforms.push({ x, y, w, h, type, ox: x, oy: y });

  // ---- Section 1: Starting area ----
  P(0, 640, 1600, 80);
  P(0, 400, 40, 240);
  P(200, 560, 160, 20, 'oneway');
  P(450, 480, 160, 20, 'oneway');

  // First bonfire — right at start
  bonfires.push(new Bonfire(120, 610, 0));

  enemies.push({ type: 'crawler', x: 600, y: 600, patrolRange: 200 });
  enemies.push({ type: 'crawler', x: 1000, y: 600, patrolRange: 150 });

  // ---- Section 2: Platforming ----
  P(1600, 640, 200, 80);
  P(1850, 560, 140, 20, 'oneway');
  P(2080, 480, 160, 20, 'oneway');
  P(2320, 410, 180, 20, 'oneway');
  platforms.push({ x: 2600, y: 380, w: 130, h: 20, type: 'moving', ox: 2600, oy: 380, mx: 0, my: 140, speed: 80, t: 0 });
  P(2900, 320, 160, 20, 'oneway');
  P(3180, 380, 200, 20, 'oneway');

  enemies.push({ type: 'flyer', x: 2000, y: 380 });
  enemies.push({ type: 'flyer', x: 2900, y: 300 });

  // ---- Section 3: Enemy gauntlet ----
  P(3450, 640, 1150, 80); // Floor ends at 4600
  P(3450, 300, 40, 340);
  P(3700, 480, 160, 20, 'oneway');
  P(4000, 400, 160, 20, 'oneway');
  P(4300, 520, 160, 20, 'oneway');

  // Second bonfire — before gauntlet
  bonfires.push(new Bonfire(3500, 610, 1));

  // Gauntlet enemies (confined to x <= 4450 so they never leak into bonfire sanctuary)
  enemies.push({ type: 'crawler', x: 3650, y: 600, patrolRange: 140 });
  enemies.push({ type: 'guard', x: 3950, y: 592 });
  enemies.push({ type: 'flyer', x: 4050, y: 350 });
  enemies.push({ type: 'crawler', x: 4220, y: 600, patrolRange: 100 });
  enemies.push({ type: 'guard', x: 4400, y: 592 });

  // Archway wall separating Gauntlet from the Boss Sanctuary
  P(4600, 200, 40, 320); // upper wall (y=200..520), archway open below (y=520..640)

  // ---- Boss Sanctuary / Antechamber (Safe Resting Area) ----
  P(4600, 640, 600, 80); // Floor from 4600 to 5200

  // Third bonfire — completely safe resting haven outside the boss arena
  bonfires.push(new Bonfire(4850, 610, 2));

  // Decorative platform in sanctuary
  P(4780, 510, 140, 16, 'oneway');

  // ---- Section 4: Boss arena ----
  P(5200, 640, 1050, 80); // Arena floor from 5200 to 6250
  P(5200, 180, 1050, 40);  // Arena ceiling
  P(6210, 180, 40, 460);   // Right wall (back of arena)
  P(5200, 180, 40, 320);   // Upper left wall (y=180..500)

  // Dynamic Boss Fog Gate (y=500..640, height=140): open before fight, sealed during fight
  platforms.push({ x: 5200, y: 500, w: 40, h: 140, type: 'solid', isGate: true });

  const bossSpawn = { x: 5750, y: 480 };
  const bossArena = { x: 5200, y: 180, w: 1050, h: 540 };
  const bossTrigger = { x: 5320, y: 200, w: 60, h: 440 };

  return {
    platforms, enemies, bonfires, bossSpawn, bossArena, bossTrigger,
    playerStart: { x: 100, y: 560 }, width: 6350, height: 720
  };
}

// ============================================================================
// PLAYER
// ============================================================================
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 28; this.h = 44;
    this.vx = 0; this.vy = 0; this.facing = 1;
    this.speed = 280; this.jumpForce = -540;
    this.onGround = false; this.onWall = 0;
    this.wallSliding = false;

    this.maxJumps = 2;
    this.jumpsLeft = 2;
    this.wingsTimer = 0;

    this.coyoteTime = 0; this.coyoteMax = 0.1;
    this.jumpBuffer = 0; this.jumpBufferMax = 0.12;
    this.jumpHeld = false; this.jumpCutMult = 0.4;

    this.dashSpeed = 620; this.dashDur = 0.24;
    this.dashCooldownMax = 0.55;
    this.dashing = false; this.dashTimer = 0;
    this.dashCooldown = 0; this.dashDir = 1;
    this.isGroundRoll = true;
    this.iFrames = false;
    this._hasTriggeredDodgeEffect = false;

    this.attacking = false; this.attackTimer = 0;
    this.attackCooldown = 0; this.attackHitbox = null;
    this.attackBuffer = 0; this.attackBufferMax = 0.14;
    this.attackDir = 'side';
    this.downSlashVisualTimer = 0;
    this.downSlashVisualDur = 0.2;
    this.hasHitThisSwing = new Set();

    this.hp = 5; this.maxHp = 5;
    this.invulnTimer = 0; this.invulnDur = 1.2;
    this.soul = 0; this.maxSoul = 100; this.healCost = 33;
    this.soulPerHit = 11; // Hollow Knight: gain soul on each nail hit
    this.recoilTimer = 0;
    this.recoilVx = 0;
    this.ridingPlatform = null;

    // Weapons
    this.weaponIndex = 0;
    this.unlockedWeapons = [true, true, true, true]; // all unlocked for demo

    // Spells
    this.spellCooldowns = [0, 0, 0];

    // Bonfire respawn
    this.respawnX = x; this.respawnY = y;
    this.lastBonfireId = -1;

    this.state = 'idle'; this.animTimer = 0; this.animFrame = 0;
    this.dead = false; this.deathTimer = 0;
  }

  get weapon() { return WEAPONS[this.weaponIndex]; }

  switchWeapon(index) {
    if (index >= 0 && index < WEAPONS.length && this.unlockedWeapons[index] && !this.attacking) {
      this.weaponIndex = index;
      return true;
    }
    return false;
  }

  nextWeapon() {
    let next = (this.weaponIndex + 1) % WEAPONS.length;
    let attempts = 0;
    while (!this.unlockedWeapons[next] && attempts < WEAPONS.length) {
      next = (next + 1) % WEAPONS.length;
      attempts++;
    }
    return this.switchWeapon(next);
  }

  castSpell(index, projectiles, particles, audio, camera) {
    if (index < 0 || index >= SPELLS.length) return;
    const spell = SPELLS[index];
    if (this.soul < spell.soulCost || this.spellCooldowns[index] > 0 || this.dashing) return;

    this.soul -= spell.soulCost;
    this.spellCooldowns[index] = spell.cooldown;

    switch (index) {
      case 0: // Fireball
        audio.fireball();
        projectiles.push(new Projectile(
          this.x + this.w / 2 + this.facing * 10, this.y + this.h / 3,
          this.facing * 450, 0, 3, 'fireball', 'player'
        ));
        camera.shake(3, 0.1);
        break;
      case 1: // Ice Nova
        audio.iceNova();
        particles.iceExplosion(this.x + this.w / 2, this.y + this.h / 2);
        camera.shake(6, 0.2);
        // AoE damage handled by game
        break;
      case 2: // Shadow Bolt
        audio.shadowBolt();
        projectiles.push(new Projectile(
          this.x + this.w / 2 + this.facing * 10, this.y + this.h / 3,
          this.facing * 600, 0, 2, 'shadowbolt', 'player'
        ));
        break;
    }
  }

  update(dt, input, level, particles, camera, audio) {
    if (this.dead) { this.deathTimer += dt; return; }

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.attackBuffer > 0) this.attackBuffer -= dt;
    if (this.coyoteTime > 0) this.coyoteTime -= dt;
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    if (this.wingsTimer > 0) this.wingsTimer -= dt;
    for (let i = 0; i < this.spellCooldowns.length; i++) {
      if (this.spellCooldowns[i] > 0) this.spellCooldowns[i] -= dt;
    }
    this.animTimer += dt;
    if (this.recoilTimer > 0) { this.recoilTimer -= dt; this.vx = this.recoilVx; }
    if (this.downSlashVisualTimer > 0) this.downSlashVisualTimer -= dt;

    // DASH / DODGE ROLL
    if (this.dashing) {
      this.dashTimer -= dt;
      this.vx = this.dashDir * this.dashSpeed; this.vy = 0;
      this.iFrames = true;
      if (this.isGroundRoll) {
        particles.rollDust(this.x + this.w / 2, this.y + this.h, this.dashDir);
      } else {
        particles.dashTrail(this.x, this.y, this.w, this.h, this.dashDir);
      }
      if (this.dashTimer <= 0) { this.dashing = false; this.iFrames = false; this.vx = this.dashDir * this.speed * 0.5; }
    } else {
      this.iFrames = false;

      // ATTACK (Hollow Knight directional system + responsive buffer)
      const wpn = this.weapon;
      if (input.attackPressed()) this.attackBuffer = this.attackBufferMax;

      if (this.attackBuffer > 0 && !this.attacking && this.attackCooldown <= 0) {
        this.attackBuffer = 0;
        this.attacking = true;
        this.attackTimer = wpn.attackDur;
        this.attackCooldown = wpn.cooldown + wpn.attackDur;
        this.hasHitThisSwing.clear();
        audio.nailSlash();

        // Determine attack direction (Hollow Knight style)
        if (input.up()) {
          this.attackDir = 'up';
        } else if (input.down() && !this.onGround) {
          this.attackDir = 'down';
          this.downSlashVisualTimer = wpn.attackDur;
          this.downSlashVisualDur = wpn.attackDur;
        } else {
          this.attackDir = 'side';
        }

        // Create directional hitbox
        this._updateAttackHitbox(wpn);

        // Recoil on attack (Hollow Knight style slight pushback)
        if (this.attackDir === 'side' && this.onGround) {
          this.vx -= this.facing * 60;
        }
      }
      if (this.attacking) {
        this.attackTimer -= dt;
        this._updateAttackHitbox(wpn);
        if (this.attackTimer <= 0) {
          this.attacking = false;
          this.attackHitbox = null;
          if (this.downSlashVisualTimer <= 0) this.attackDir = 'side';
        }
      } else if (this.downSlashVisualTimer <= 0 && this.attackDir === 'down') {
        this.attackDir = 'side';
      }

      // MOVEMENT
      let moveX = 0;
      if (input.left()) moveX -= 1;
      if (input.right()) moveX += 1;
      if (moveX !== 0 && !this.attacking) this.facing = moveX;

      const accel = this.onGround ? 2200 : 1400;
      const decel = this.onGround ? 1800 : 600;
      if (moveX !== 0) {
        this.vx += moveX * accel * dt;
        this.vx = clamp(this.vx, -this.speed, this.speed);
        if (this.onGround && Math.abs(this.vx) > 50 && Math.random() < 0.3) particles.dustRun(this.x + this.w / 2, this.y + this.h, this.facing);
      } else {
        if (this.vx > 0) { this.vx -= decel * dt; if (this.vx < 0) this.vx = 0; }
        else if (this.vx < 0) { this.vx += decel * dt; if (this.vx > 0) this.vx = 0; }
      }

      // DASH / DODGE ROLL
      if (input.dashPressed() && this.dashCooldown <= 0 && !this.attacking) {
        this.dashing = true;
        this.dashTimer = this.dashDur;
        this.dashCooldown = this.dashCooldownMax;
        if (input.left()) this.dashDir = -1;
        else if (input.right()) this.dashDir = 1;
        else this.dashDir = this.facing;
        this.facing = this.dashDir;
        this.isGroundRoll = this.onGround;
        this._hasTriggeredDodgeEffect = false;
        if (this.isGroundRoll) {
          audio.dodgeRoll();
          particles.dustLand(this.x + this.w / 2, this.y + this.h);
        } else {
          audio.dash();
        }
      }

      // HEAL
      if (input.healPressed() && this.soul >= this.healCost && this.hp < this.maxHp && this.onGround) {
        this.soul -= this.healCost; this.hp = Math.min(this.hp + 1, this.maxHp); audio.heal();
        for (let i = 0; i < 10; i++) particles.add(new Particle(this.x + this.w / 2, this.y + this.h / 2, rand(-40, 40), rand(-80, -20), rand(0.4, 0.8), '#66ffaa', rand(3, 5), -100, true, 'soul'));
      }

      // GRAVITY
      this.vy += GRAVITY * dt;
      this.wallSliding = false;
      if (!this.onGround && this.onWall !== 0 && this.vy > 0) {
        if ((this.onWall === -1 && input.left()) || (this.onWall === 1 && input.right())) {
          this.wallSliding = true; this.vy = Math.min(this.vy, 100);
        }
      }
      this.vy = Math.min(this.vy, TERMINAL_VEL);

      // JUMP
      if (input.jumpPressed()) this.jumpBuffer = this.jumpBufferMax;
      this.jumpHeld = input.jumpHeld();

      if (this.jumpBuffer > 0) {
        this.ridingPlatform = null;
        if (this.coyoteTime > 0) {
          this.vy = this.jumpForce; this.coyoteTime = 0; this.jumpBuffer = 0; this.onGround = false; this.jumpsLeft = this.maxJumps - 1; audio.jump();
        } else if (this.wallSliding || this.onWall !== 0) {
          this.vy = this.jumpForce * 0.9; this.vx = -this.onWall * this.speed * 1.1; this.facing = -this.onWall;
          this.onWall = 0; this.wallSliding = false; this.jumpBuffer = 0; this.jumpsLeft = this.maxJumps - 1; audio.jump();
          particles.dustLand(this.x + this.w / 2, this.y + this.h / 2);
        } else if (this.jumpsLeft > 0) {
          // Double Jump (Monarch Wings)!
          this.vy = this.jumpForce * 0.95;
          this.jumpsLeft--;
          this.jumpBuffer = 0;
          this.wingsTimer = 0.35;
          audio.doubleJump();
          particles.monarchWings(this.x + this.w / 2, this.y + this.h);
        }
      }
      if (!this.jumpHeld && this.vy < 0) this.vy *= (1 - (1 - this.jumpCutMult) * dt * 20);
    }

    // COLLIDE
    const prevOnGround = this.onGround;
    this.onGround = false; this.onWall = 0;
    let foundPlatform = null;

    this.x += this.vx * dt;
    for (const p of level.platforms) {
      if (p.type === 'oneway' || p.type === 'moving') continue; // skip one-way and moving for horizontal
      if (p.isGate && !level.gateClosed) continue;
      if (rectsOverlap(this, p)) {
        if (this.vx > 0) { this.x = p.x - this.w; this.vx = 0; this.onWall = 1; }
        else if (this.vx < 0) { this.x = p.x + p.w; this.vx = 0; this.onWall = -1; }
      }
    }
    this.y += this.vy * dt;
    for (const p of level.platforms) {
      if (p.type === 'oneway' || p.type === 'moving') {
        const feetY = this.y + this.h;
        const prevFeetY = feetY - this.vy * dt;
        const inHoriz = (this.x + this.w > p.x && this.x < p.x + p.w);

        if (inHoriz) {
          if (this.ridingPlatform === p) {
            // Already standing on moving platform: keep securely snapped to top surface
            if (Math.abs(feetY - p.y) < 26) {
              this.y = p.y - this.h;
              this.vy = 0;
              this.onGround = true;
              foundPlatform = p;
            }
          } else if (this.vy >= 0 && prevFeetY <= p.y + 12 && feetY >= p.y - 4) {
            // Land smoothly from above
            this.y = p.y - this.h;
            this.vy = 0;
            this.onGround = true;
            if (p.type === 'moving') foundPlatform = p;
          }
        }
      } else {
        if (p.isGate && !level.gateClosed) continue;
        if (rectsOverlap(this, p)) {
          if (this.vy > 0) { this.y = p.y - this.h; this.vy = 0; this.onGround = true; }
          else if (this.vy < 0) { this.y = p.y + p.h; this.vy = 0; }
        }
      }
    }
    this.ridingPlatform = foundPlatform;
    if (this.onGround) {
      this.coyoteTime = this.coyoteMax;
      this.jumpsLeft = this.maxJumps;
    }
    if (this.wallSliding || this.onWall !== 0) {
      this.jumpsLeft = this.maxJumps;
    }
    if (this.onGround && !prevOnGround && this.vy >= 0) particles.dustLand(this.x + this.w / 2, this.y + this.h);
    if (this.y > level.height + 100) this.takeDamage(99, 0, particles, camera, audio);
    this._updateAnimState();
  }

  _updateAttackHitbox(wpn) {
    const range = wpn.range;
    const h = wpn.height;
    switch (this.attackDir) {
      case 'up':
        this.attackHitbox = { x: this.x - 14, y: this.y - range, w: this.w + 28, h: range + 10 };
        break;
      case 'down': {
        // Generous, wide arc below and overlapping the lower body
        // so falling onto an enemy connects the blade first
        const downW = Math.max(this.w + 48, range * 1.35);
        this.attackHitbox = {
          x: this.x + this.w / 2 - downW / 2,
          y: this.y + this.h * 0.35,
          w: downW,
          h: range + this.h * 0.75
        };
        break;
      }
      default: // side
        this.attackHitbox = {
          x: this.facing === 1 ? this.x + this.w - 4 : this.x - range + 4,
          y: this.y + (this.h - h) / 2,
          w: range,
          h: h
        };
        break;
    }
  }

  _updateAnimState() {
    let ns;
    if (this.dead) ns = 'dead';
    else if (this.dashing) ns = 'dash';
    else if (this.attacking) ns = 'attack';
    else if (this.wallSliding) ns = 'wallslide';
    else if (!this.onGround) ns = this.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 20) ns = 'run';
    else ns = 'idle';
    if (ns !== this.state) { this.state = ns; this.animTimer = 0; this.animFrame = 0; }
    else {
      const spd = this.state === 'run' ? 0.1 : this.state === 'idle' ? 0.5 : 0.1;
      if (this.animTimer >= spd) { this.animTimer -= spd; this.animFrame++; }
    }
  }

  takeDamage(amount, knockDir, particles, camera, audio) {
    if (this.dead) return;
    if (this.iFrames) {
      if (!this._hasTriggeredDodgeEffect) {
        this._hasTriggeredDodgeEffect = true;
        particles.dodgeSparks(this.x + this.w / 2, this.y + this.h / 2);
        audio.dodgeSuccess();
        camera.shake(3, 0.1);
      }
      return;
    }
    if (this.invulnTimer > 0) return;
    this.hp -= amount; this.invulnTimer = this.invulnDur;
    this.vy = -250; this.vx = knockDir * 300;
    camera.shake(8, 0.3); audio.playerHurt();
    particles.sparks(this.x + this.w / 2, this.y + this.h / 2);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deathTimer = 0; particles.deathBurst(this.x + this.w / 2, this.y + this.h / 2); }
  }

  respawn() {
    this.x = this.respawnX; this.y = this.respawnY;
    this.vx = 0; this.vy = 0; this.hp = this.maxHp; this.dead = false; this.deathTimer = 0;
    this.invulnTimer = 1.5; this.dashing = false; this.attacking = false; this.attackHitbox = null;
    this.iFrames = false; this.soul = Math.min(this.soul, this.maxSoul); this.ridingPlatform = null;
    this.spellCooldowns = [0, 0, 0];
  }

  draw(ctx) {
    if (this.dead && this.deathTimer > 0.5) return;
    if (this.invulnTimer > 0 && !this.dashing && Math.sin(this.invulnTimer * 30) > 0) return;

    ctx.save();
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    ctx.translate(cx, 0); ctx.scale(this.facing, 1); ctx.translate(-cx, 0);

    if (this.dashing) {
      const prog = 1 - this.dashTimer / this.dashDur;
      if (this.isGroundRoll) {
        // Elden Ring dodge roll somersault!
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(prog * Math.PI * 2);
        ctx.translate(-cx, -cy);
        ctx.shadowColor = '#66ccff';
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.9;
        this._drawKnight(ctx, true);
        ctx.restore();
      } else {
        // Hollow Knight Shade Dash!
        ctx.shadowColor = '#3388ff';
        ctx.shadowBlur = 16;
        ctx.globalAlpha = 0.65;
        this._drawKnight(ctx, false);
      }
    } else {
      this._drawKnight(ctx, false);
    }

    // Monarch Wings (Double jump effect)
    if (this.wingsTimer > 0) {
      const wProg = this.wingsTimer / 0.35;
      const flap = Math.sin(wProg * Math.PI) * 1.3;
      ctx.save();
      ctx.globalAlpha = wProg * 0.85;
      ctx.shadowColor = '#66eeff';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#66ccff';
      ctx.lineWidth = 2;

      // Left wing
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 4);
      ctx.quadraticCurveTo(cx - 24 * flap, cy - 30 * flap, cx - 38 * flap, cy - 14 * flap);
      ctx.quadraticCurveTo(cx - 28 * flap, cy + 6, cx - 6, cy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right wing
      ctx.beginPath();
      ctx.moveTo(cx + 6, cy - 4);
      ctx.quadraticCurveTo(cx + 24 * flap, cy - 30 * flap, cx + 38 * flap, cy - 14 * flap);
      ctx.quadraticCurveTo(cx + 28 * flap, cy + 6, cx + 6, cy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // Directional slash arc (Hollow Knight style)
    const showDownVisual = this.downSlashVisualTimer > 0;
    if (this.attacking || showDownVisual) {
      const wpn = this.weapon;
      let progress = 1 - this.attackTimer / wpn.attackDur;
      const isDown = showDownVisual || (this.attackDir === 'down');
      if (showDownVisual) {
        progress = 1 - Math.max(0, this.downSlashVisualTimer) / this.downSlashVisualDur;
      }
      const alpha = 0.85 * (1 - progress * progress);
      const slashLen = wpn.range * 1.15;
      ctx.save();
      ctx.globalAlpha = Math.max(0.12, alpha);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      ctx.shadowColor = '#aaddff'; ctx.shadowBlur = 12;

      if (isDown) {
        ctx.translate(cx, this.y + this.h - 4);
        const sweep = progress * 2.6 - 1.3;
        ctx.beginPath();
        ctx.arc(0, 0, slashLen, Math.PI / 2 + sweep - 0.5, Math.PI / 2 + sweep + 0.5);
        ctx.stroke();
        ctx.fillStyle = 'rgba(200,230,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, slashLen, Math.PI / 2 + sweep - 0.5, Math.PI / 2 + sweep + 0.5);
        ctx.closePath(); ctx.fill();
      } else if (this.attackDir === 'up') {
        ctx.translate(cx, this.y + 4);
        const sweep = progress * 2.6 - 1.3;
        ctx.beginPath();
        ctx.arc(0, 0, slashLen, -Math.PI / 2 + sweep - 0.5, -Math.PI / 2 + sweep + 0.5);
        ctx.stroke();
        // slash fill
        ctx.fillStyle = 'rgba(200,230,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, slashLen, -Math.PI / 2 + sweep - 0.5, -Math.PI / 2 + sweep + 0.5);
        ctx.closePath(); ctx.fill();
      } else if (this.attackDir === 'down') {
        ctx.translate(cx, this.y + this.h - 4);
        const sweep = progress * 2.6 - 1.3;
        ctx.beginPath();
        ctx.arc(0, 0, slashLen, Math.PI / 2 + sweep - 0.5, Math.PI / 2 + sweep + 0.5);
        ctx.stroke();
        ctx.fillStyle = 'rgba(200,230,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, slashLen, Math.PI / 2 + sweep - 0.5, Math.PI / 2 + sweep + 0.5);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.translate(this.x + this.w * 0.5, this.y + this.h * 0.4);
        const sweep = progress * 3.0 - 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, slashLen, sweep - 0.5, sweep + 0.5);
        ctx.stroke();
        ctx.fillStyle = 'rgba(200,230,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, slashLen, sweep - 0.5, sweep + 0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  _drawKnight(ctx, isRolling) {
    const x = this.x, y = this.y;
    const cx = x + this.w / 2, cy = y + this.h / 2;
    const bobY = this.state === 'idle' ? Math.sin(this.animTimer * 2.5) * 2 : 0;
    const runBob = this.state === 'run' ? Math.sin(this.animFrame * Math.PI) * 3 : 0;
    const wpn = this.weapon;

    if (isRolling) {
      ctx.fillStyle = '#223366';
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3a4e';
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#555577';
      ctx.beginPath(); ctx.arc(cx + 4, cy - 2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#99eeff';
      ctx.fillRect(cx + 6, cy - 4, 5, 3);
      ctx.fillStyle = wpn.color;
      ctx.fillRect(cx - 14, cy - 2, 28, 3);
      return;
    }

    // Cape
    ctx.fillStyle = '#3344aa';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 12 + bobY); ctx.lineTo(x + 2, y + this.h + 4 + runBob);
    ctx.lineTo(x + 20, y + this.h - 2 + runBob * 0.5); ctx.lineTo(x + 14, y + 12 + bobY);
    ctx.closePath(); ctx.fill();

    // Body
    ctx.fillStyle = '#2a2a3a'; ctx.fillRect(x + 6, y + 14 + bobY, 16, 18);

    // Legs
    const legOff = this.state === 'run' ? Math.sin(this.animFrame * Math.PI) * 5 : 0;
    ctx.fillStyle = '#222233';
    ctx.fillRect(x + 7, y + 32 + bobY, 6, 12 + legOff); ctx.fillRect(x + 15, y + 32 + bobY, 6, 12 - legOff);
    ctx.fillStyle = '#444466';
    ctx.fillRect(x + 6, y + 42 + bobY + Math.max(0, legOff), 7, 3);
    ctx.fillRect(x + 15, y + 42 + bobY + Math.max(0, -legOff), 7, 3);

    // Head
    ctx.fillStyle = '#555577'; ctx.fillRect(x + 6, y + 2 + bobY, 18, 14);
    ctx.fillStyle = '#99ccff'; ctx.fillRect(x + 18, y + 6 + bobY, 6, 4);
    ctx.fillStyle = '#6666aa';
    ctx.beginPath(); ctx.moveTo(x + 8, y + 2 + bobY); ctx.lineTo(x + 5, y - 6 + bobY); ctx.lineTo(x + 14, y + 2 + bobY); ctx.closePath(); ctx.fill();

    // Shoulders
    ctx.fillStyle = '#555577'; ctx.fillRect(x + 2, y + 14 + bobY, 8, 6); ctx.fillRect(x + 18, y + 14 + bobY, 8, 6);

    // Weapon drawing
    const showDownVisual = this.downSlashVisualTimer > 0;
    if (this.attacking || showDownVisual) {
      const prog = showDownVisual
        ? (1 - Math.max(0, this.downSlashVisualTimer) / this.downSlashVisualDur)
        : (1 - this.attackTimer / wpn.attackDur);
      const isDown = showDownVisual || (this.attackDir === 'down');
      ctx.save();
      if (isDown) {
        ctx.translate(x + this.w / 2, y + this.h - 8);
        const angle = Math.PI / 2 + (prog * 1.4 - 0.7);
        ctx.rotate(angle);
        ctx.fillStyle = wpn.color;
        ctx.fillRect(-wpn.bladeW / 2, 0, wpn.bladeW, wpn.bladeL);
        ctx.fillStyle = wpn.guardColor;
        ctx.fillRect(-wpn.bladeW - 1, -2, wpn.bladeW * 2 + 2, 4);
        ctx.fillStyle = wpn.handleColor;
        ctx.fillRect(-wpn.bladeW / 2, -8, wpn.bladeW, 6);
      } else if (this.attackDir === 'up') {
        ctx.translate(x + this.w / 2, y + 8 + bobY);
        const angle = -Math.PI / 2 + (prog * 1.4 - 0.7);
        ctx.rotate(angle);
        ctx.fillStyle = wpn.color;
        ctx.fillRect(-wpn.bladeW / 2, -wpn.bladeL, wpn.bladeW, wpn.bladeL);
        ctx.fillStyle = wpn.guardColor;
        ctx.fillRect(-wpn.bladeW - 1, -2, wpn.bladeW * 2 + 2, 4);
        ctx.fillStyle = wpn.handleColor;
        ctx.fillRect(-wpn.bladeW / 2, 2, wpn.bladeW, 6);
      } else {
        ctx.translate(x + this.w, y + 18 + bobY);
        if (wpn.isThrust) {
          // Thrust animation
          const ext = Math.sin(prog * Math.PI) * wpn.bladeL * 0.5;
          ctx.rotate(0.1);
          ctx.fillStyle = wpn.color;
          ctx.fillRect(-2, 0, wpn.bladeW, wpn.bladeL + ext);
          ctx.fillStyle = wpn.guardColor;
          ctx.fillRect(-4, -1, 8, 4);
        } else {
          const angle = wpn.swingStart + prog * wpn.swingArc;
          ctx.rotate(angle);
          ctx.fillStyle = wpn.color;
          ctx.fillRect(-wpn.bladeW / 2, -2, wpn.bladeW, wpn.bladeL);
          ctx.fillStyle = wpn.guardColor;
          ctx.fillRect(-wpn.bladeW - 1, -4, wpn.bladeW * 2 + 2, 5);
          ctx.fillStyle = wpn.handleColor;
          ctx.fillRect(-wpn.bladeW / 2, -8, wpn.bladeW, 6);
        }
      }
      ctx.restore();
    } else {
      ctx.fillStyle = wpn.color;
      ctx.save();
      ctx.translate(x + this.w + 2, y + 18 + bobY);
      ctx.rotate(0.3);
      ctx.fillRect(-wpn.bladeW / 2, 0, wpn.bladeW, wpn.bladeL);
      ctx.fillStyle = wpn.guardColor;
      ctx.fillRect(-wpn.bladeW / 2 - 2, -1, wpn.bladeW + 4, 4);
      ctx.fillStyle = wpn.handleColor;
      ctx.fillRect(-wpn.bladeW / 2, -5, wpn.bladeW, 5);
      ctx.restore();
    }
  }

  getBounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ============================================================================
// ENEMIES
// ============================================================================
class Enemy {
  constructor(x, y, type, patrolRange) {
    this.x = x; this.y = y; this.type = type;
    this.vx = 0; this.vy = 0; this.facing = -1;
    this.dead = false; this.flashTimer = 0; this.animTimer = 0;
    this.origX = x; this.origY = y; this.origPatrol = patrolRange;
    this.state = 'patrol';
    this.stateTimer = 0;
    this.attackHitbox = null;
    this.onGround = false;

    switch (type) {
      case 'crawler':
        this.w = 32; this.h = 24; this.hp = this.maxHp = 4; this.speed = 65; this.damage = 1;
        this.patrolLeft = x - (patrolRange || 100); this.patrolRight = x + (patrolRange || 100); this.facing = 1;
        this.cooldown = 0;
        break;
      case 'flyer':
        this.w = 30; this.h = 30; this.hp = this.maxHp = 3; this.speed = 80; this.damage = 1;
        this.baseY = y; this.sineT = rand(0, Math.PI * 2); this.shootCooldown = rand(1.5, 2.5);
        this.state = 'hover';
        break;
      case 'guard':
        this.w = 34; this.h = 50; this.hp = this.maxHp = 8; this.speed = 50; this.damage = 2;
        this.attackCool = 0; this.shieldBashCool = 1.0; this.turnTimer = 0;
        this.shieldUp = true; this.blockCount = 0; this.stunned = 0;
        this.patrolLeft = x - 90; this.patrolRight = x + 90;
        break;
    }
  }

  reset() {
    this.x = this.origX; this.y = this.origY;
    this.dead = false; this.flashTimer = 0; this.vx = 0; this.vy = 0;
    this.state = 'patrol'; this.stateTimer = 0; this.attackHitbox = null;
    switch (this.type) {
      case 'crawler':
        this.hp = this.maxHp; this.facing = 1; this.cooldown = 0;
        this.patrolLeft = this.origX - (this.origPatrol || 100); this.patrolRight = this.origX + (this.origPatrol || 100);
        break;
      case 'flyer':
        this.hp = this.maxHp; this.baseY = this.origY; this.sineT = 0; this.shootCooldown = rand(1.5, 2.5);
        this.state = 'hover';
        break;
      case 'guard':
        this.hp = this.maxHp; this.shieldUp = true; this.blockCount = 0; this.stunned = 0;
        this.attackCool = 0; this.shieldBashCool = 1.0; this.turnTimer = 0;
        break;
    }
  }

  update(dt, player, level, particles, projectiles, audio) {
    if (this.dead) return;
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.animTimer += dt;

    switch (this.type) {
      case 'crawler': this._updateCrawler(dt, player, particles); break;
      case 'flyer': this._updateFlyer(dt, player, projectiles, audio); break;
      case 'guard': this._updateGuard(dt, player, audio); break;
    }
    if (this.type !== 'flyer') { this.vy += GRAVITY * dt; this.vy = Math.min(this.vy, TERMINAL_VEL); }

    this.onGround = false;
    this.x += this.vx * dt;
    for (const p of level.platforms) {
      if (p.type === 'oneway' || p.type === 'moving') continue;
      if (p.isGate && !level.gateClosed) continue;
      if (rectsOverlap(this, p)) {
        if (this.vx > 0) { this.x = p.x - this.w; this.vx = 0; this.facing = -1; }
        else if (this.vx < 0) { this.x = p.x + p.w; this.vx = 0; this.facing = 1; }
      }
    }
    this.y += this.vy * dt;
    for (const p of level.platforms) {
      if (p.type === 'oneway') {
        if (this.vy > 0 && rectsOverlap(this, p) && this.y + this.h - this.vy * dt <= p.y + 6) {
          this.y = p.y - this.h; this.vy = 0; this.onGround = true;
        }
      } else if (p.type !== 'moving') {
        if (p.isGate && !level.gateClosed) continue;
        if (rectsOverlap(this, p)) {
          if (this.vy > 0) { this.y = p.y - this.h; this.vy = 0; this.onGround = true; }
          else if (this.vy < 0) { this.y = p.y + p.h; this.vy = 0; }
        }
      }
    }
  }

  _updateCrawler(dt, player, particles) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const inRange = dist < 240 && Math.abs(dy) < 80 && !player.dead;

    this.cooldown = Math.max(0, this.cooldown - dt);

    switch (this.state) {
      case 'patrol':
        this.vx = this.facing * this.speed;
        this.attackHitbox = null;
        if (this.x <= this.patrolLeft) { this.facing = 1; this.x = this.patrolLeft; }
        if (this.x + this.w >= this.patrolRight) { this.facing = -1; this.x = this.patrolRight - this.w; }
        if (inRange && this.cooldown <= 0) {
          this.state = 'aggro';
          this.stateTimer = rand(0.6, 1.2);
        }
        break;

      case 'aggro':
        this.facing = dx > 0 ? 1 : -1;
        this.vx = this.facing * (this.speed * 1.8);
        this.attackHitbox = null;
        this.stateTimer -= dt;

        // Pounce attack telegraph when in range
        if (dist < 160 && dist > 40 && Math.abs(dy) < 45 && this.onGround) {
          this.state = 'leap_windup';
          this.stateTimer = 0.28;
          this.vx = 0;
        } else if (this.stateTimer <= 0 || !inRange) {
          this.state = 'patrol';
          this.cooldown = 1.0;
        }
        break;

      case 'leap_windup':
        this.vx = 0;
        this.facing = dx > 0 ? 1 : -1;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'leap';
          this.vy = -340;
          this.vx = this.facing * 290;
          this.stateTimer = 0.55;
          particles.dustLand(this.x + this.w / 2, this.y + this.h);
        }
        break;

      case 'leap':
        this.stateTimer -= dt;
        // Dangerous lunge hitbox during jump
        this.attackHitbox = { x: this.x - 2, y: this.y, w: this.w + 4, h: this.h };
        if (this.onGround && this.stateTimer < 0.38) {
          this.state = 'recover';
          this.stateTimer = 0.4;
          this.vx = 0;
          this.attackHitbox = null;
          particles.dustLand(this.x + this.w / 2, this.y + this.h);
        }
        break;

      case 'recover':
        this.vx = 0;
        this.attackHitbox = null;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = inRange ? 'aggro' : 'patrol';
          this.stateTimer = 1.0;
          this.cooldown = 0.8;
        }
        break;
    }
  }

  _updateFlyer(dt, player, projectiles, audio) {
    this.sineT += dt;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    this.facing = dx > 0 ? 1 : -1;

    switch (this.state) {
      case 'hover':
        this.attackHitbox = null;
        // Dynamic kite positioning above the player
        const targetX = player.x + (this.x < player.x ? -140 : 140);
        const targetY = player.y - 110 + Math.sin(this.sineT * 3) * 25;
        this.vx = lerp(this.vx, clamp(targetX - this.x, -130, 130), 3.5 * dt);
        this.vy = lerp(this.vy, clamp(targetY - this.y, -110, 110), 3.5 * dt);

        if (dist < 320 && this.shootCooldown <= 0 && !player.dead) {
          if (dist > 130 || Math.random() < 0.7) {
            this.state = 'aim';
            this.stateTimer = 0.45;
            this.vx *= 0.3;
            this.vy *= 0.3;
          } else {
            this.state = 'dive_windup';
            this.stateTimer = 0.3;
          }
        }
        break;

      case 'aim':
        this.vx *= 0.8;
        this.vy *= 0.8;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          // Shoot acid spit towards player
          const aimAngle = Math.atan2(player.y + player.h / 2 - (this.y + this.h / 2), player.x + player.w / 2 - (this.x + this.w / 2));
          const pSpeed = 330;
          if (projectiles) {
            projectiles.push(new Projectile(
              this.x + this.w / 2, this.y + this.h / 2,
              Math.cos(aimAngle) * pSpeed, Math.sin(aimAngle) * pSpeed,
              1, 'acid_spit', 'enemy'
            ));
          }
          if (audio && audio.shadowBolt) audio.shadowBolt();
          this.shootCooldown = rand(2.2, 3.2);
          this.state = 'hover';
        }
        break;

      case 'dive_windup':
        this.vx = -this.facing * 40;
        this.vy = -60;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'dive';
          const aimAngle = Math.atan2(player.y - this.y, player.x - this.x);
          this.vx = Math.cos(aimAngle) * 360;
          this.vy = Math.sin(aimAngle) * 360;
          this.stateTimer = 0.55;
        }
        break;

      case 'dive':
        this.attackHitbox = { x: this.x, y: this.y, w: this.w, h: this.h };
        this.stateTimer -= dt;
        if (this.stateTimer <= 0 || this.y > player.y + 40) {
          this.state = 'hover';
          this.shootCooldown = 1.8;
          this.vy = -140; // Pull up
          this.attackHitbox = null;
        }
        break;
    }
  }

  _updateGuard(dt, player, audio) {
    if (this.stunned > 0) {
      this.stunned -= dt;
      this.vx *= 0.8;
      this.shieldUp = false;
      this.attackHitbox = null;
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.abs(dx);
    const sameHeight = Math.abs(dy) < 55;

    this.attackCool = Math.max(0, this.attackCool - dt);
    this.shieldBashCool = Math.max(0, this.shieldBashCool - dt);

    switch (this.state) {
      case 'patrol':
        this.shieldUp = true;
        this.vx = this.facing * 45;
        this.attackHitbox = null;
        if (this.x <= this.patrolLeft) { this.facing = 1; }
        if (this.x >= this.patrolRight) { this.facing = -1; }
        if (dist < 260 && sameHeight && !player.dead) {
          this.state = 'advance';
        }
        break;

      case 'advance':
        this.shieldUp = true;
        this.attackHitbox = null;
        const targetFacing = dx > 0 ? 1 : -1;
        if (this.turnTimer > 0) {
          this.turnTimer -= dt;
          this.vx = 0;
        } else if (this.facing !== targetFacing) {
          this.facing = targetFacing;
          this.turnTimer = 0.28;
          this.vx = 0;
        } else {
          this.vx = this.facing * 85;
        }

        // Shield bash if player is at medium distance
        if (dist > 75 && dist < 170 && sameHeight && this.shieldBashCool <= 0) {
          this.state = 'shield_bash_windup';
          this.stateTimer = 0.25;
          this.vx = 0;
        } else if (dist <= 65 && sameHeight && this.attackCool <= 0) {
          // Slash combo
          this.state = 'combo1_windup';
          this.stateTimer = 0.28;
          this.vx = 0;
        } else if (dist > 320) {
          this.state = 'patrol';
        }
        break;

      case 'combo1_windup':
        this.vx = 0;
        this.shieldUp = false; // Shield down when swinging!
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'combo1_slash';
          this.stateTimer = 0.2;
          this.attackHitbox = { x: this.facing === 1 ? this.x + this.w : this.x - 55, y: this.y + 4, w: 55, h: 42 };
          this.vx = this.facing * 70;
          if (audio && audio.swing) audio.swing();
        }
        break;

      case 'combo1_slash':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.attackHitbox = null;
          this.state = 'combo2_windup';
          this.stateTimer = 0.16;
          this.vx = 0;
        }
        break;

      case 'combo2_windup':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'combo2_thrust';
          this.stateTimer = 0.24;
          this.attackHitbox = { x: this.facing === 1 ? this.x + this.w : this.x - 70, y: this.y + 14, w: 70, h: 22 };
          this.vx = this.facing * 160; // Forward lunge on thrust!
          if (audio && audio.swing) audio.swing();
        }
        break;

      case 'combo2_thrust':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.attackHitbox = null;
          this.state = 'advance';
          this.attackCool = 1.1;
          this.shieldUp = true;
        }
        break;

      case 'shield_bash_windup':
        this.vx = 0;
        this.shieldUp = true;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'shield_bash';
          this.stateTimer = 0.3;
          this.vx = this.facing * 350;
          this.attackHitbox = { x: this.facing === 1 ? this.x + this.w - 10 : this.x - 30, y: this.y + 8, w: 40, h: 40 };
          if (audio && audio.dash) audio.dash();
        }
        break;

      case 'shield_bash':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.attackHitbox = null;
          this.state = 'advance';
          this.shieldBashCool = 2.2;
          this.vx = 0;
        }
        break;
    }
  }

  takeDamage(amount, knockDir, particles, camera, audio, isMagicOrReflect = false, attackY = 0) {
    if (this.dead) return false;

    // GUARD SHIELD BLOCK:
    if (this.type === 'guard' && this.shieldUp && !this.stunned) {
      const hitFromFront = (knockDir === -this.facing);
      const isFromAbove = (attackY < this.y + 12);

      if (hitFromFront && !isMagicOrReflect && !isFromAbove) {
        // Blocked cleanly with shield!
        this.flashTimer = 0.08;
        this.vx += knockDir * 60;
        camera.shake(3, 0.08);
        audio.hit();
        particles.sparks(this.x + (this.facing === 1 ? this.w : 0), this.y + 20);
        this.blockCount = (this.blockCount || 0) + 1;
        // Counter-attack after 2 blocks!
        if (this.blockCount >= 2) {
          this.blockCount = 0;
          this.state = 'shield_bash';
          this.stateTimer = 0.3;
          this.vx = this.facing * 350;
          this.attackHitbox = { x: this.facing === 1 ? this.x + this.w - 10 : this.x - 30, y: this.y + 8, w: 40, h: 40 };
        }
        return false;
      }
    }

    this.hp -= amount;
    this.flashTimer = 0.15;
    this.vx += knockDir * 180;
    this.vy = -90;
    if (isMagicOrReflect && this.type === 'guard') {
      this.stunned = 0.7; // Magic stuns guard!
      this.shieldUp = false;
    }
    camera.shake(4, 0.15);
    audio.hit();
    particles.sparks(this.x + this.w / 2, this.y + this.h / 2);
    if (this.hp <= 0) {
      this.dead = true;
      particles.soulBurst(this.x + this.w / 2, this.y + this.h / 2);
      audio.enemyDeath();
    }
    return true;
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    switch (this.type) {
      case 'crawler': this._drawCrawler(ctx); break;
      case 'flyer': this._drawFlyer(ctx); break;
      case 'guard': this._drawGuard(ctx); break;
    }
    ctx.restore();
  }

  _drawCrawler(ctx) {
    const x = this.x, y = this.y;
    const isAggro = (this.state === 'aggro' || this.state === 'leap' || this.state === 'leap_windup');
    const c = this.flashTimer > 0 ? '#fff' : (isAggro ? '#993333' : '#773333');
    const c2 = this.flashTimer > 0 ? '#fff' : (isAggro ? '#cc4444' : '#994444');
    ctx.fillStyle = c; ctx.fillRect(x + 2, y + 4, this.w - 4, this.h - 8);

    // Spiky carapace when aggro
    if (isAggro) {
      ctx.fillStyle = '#ff5544';
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + 10, y - 4); ctx.lineTo(x + 14, y + 4);
      ctx.moveTo(x + 16, y + 4); ctx.lineTo(x + 20, y - 5); ctx.lineTo(x + 24, y + 4);
      ctx.closePath(); ctx.fill();
    }

    const la = Math.sin(this.animTimer * (isAggro ? 18 : 10));
    ctx.fillStyle = c2;
    ctx.fillRect(x, y + this.h - 6 + la * 2, 6, 6); ctx.fillRect(x + 10, y + this.h - 6 - la * 2, 6, 6);
    ctx.fillRect(x + this.w - 16, y + this.h - 6 + la * 2, 6, 6); ctx.fillRect(x + this.w - 6, y + this.h - 6 - la * 2, 6, 6);

    // Glowing eyes
    ctx.fillStyle = this.flashTimer > 0 ? '#fff' : (isAggro ? '#ff1100' : '#ffaa00');
    const ex = this.facing === 1 ? x + this.w - 10 : x + 4;
    ctx.fillRect(ex, y + 6, 4, 4); ctx.fillRect(ex - 7 * this.facing, y + 6, 4, 4);

    // Mandibles / jaw
    ctx.fillStyle = c2; const px = this.facing === 1 ? x + this.w : x;
    const jawOpen = (this.state === 'leap' || this.state === 'leap_windup') ? 4 : 0;
    ctx.beginPath();
    ctx.moveTo(px, y + 6 - jawOpen);
    ctx.lineTo(px + this.facing * 10, y + 3 - jawOpen);
    ctx.lineTo(px + this.facing * 7, y + 13 + jawOpen);
    ctx.closePath();
    ctx.fill();

    // Leap telegraph
    if (this.state === 'leap_windup') {
      ctx.fillStyle = '#ff2222';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('!', x + this.w / 2 - 4, y - 8);
    }
  }

  _drawFlyer(ctx) {
    const x = this.x, y = this.y;
    const isAiming = (this.state === 'aim');
    const isDiving = (this.state === 'dive' || this.state === 'dive_windup');
    const c = this.flashTimer > 0 ? '#fff' : (isAiming ? '#8833bb' : '#553388');
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x + this.w / 2, y + this.h / 2, 13, 0, Math.PI * 2); ctx.fill();

    // Glowing belly / acid sac when aiming
    if (isAiming) {
      const pulse = Math.sin(this.stateTimer * 25) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(100, 255, 50, ${pulse})`;
      ctx.beginPath(); ctx.arc(x + this.w / 2, y + this.h / 2 + 3, 7, 0, Math.PI * 2); ctx.fill();
    }

    const wa = Math.sin(this.animTimer * (isDiving ? 20 : 12)) * 8;
    ctx.fillStyle = this.flashTimer > 0 ? '#fff' : '#7755aa';
    ctx.beginPath(); ctx.ellipse(x + this.w / 2 - 14, y + this.h / 2 - 6 + wa, 11, 5, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + this.w / 2 + 14, y + this.h / 2 - 6 - wa, 11, 5, 0.3, 0, Math.PI * 2); ctx.fill();

    // Eyes
    ctx.fillStyle = this.flashTimer > 0 ? '#fff' : (isAiming ? '#66ff22' : '#ff3344');
    ctx.fillRect(x + this.w / 2 - 4, y + this.h / 2 - 3, 3, 3); ctx.fillRect(x + this.w / 2 + 2, y + this.h / 2 - 3, 3, 3);

    // Telegraph
    if (this.state === 'dive_windup') {
      ctx.fillStyle = '#ff3333'; ctx.font = 'bold 15px monospace';
      ctx.fillText('▼', x + this.w / 2 - 5, y - 8);
    }
  }

  _drawGuard(ctx) {
    const x = this.x, y = this.y;
    const c = this.flashTimer > 0 ? '#fff' : '#4a5568';
    const c2 = this.flashTimer > 0 ? '#fff' : '#2d3748';
    const bobY = Math.sin(this.animTimer * 2);

    ctx.save();
    const cx = x + this.w / 2; ctx.translate(cx, 0); ctx.scale(this.facing, 1); ctx.translate(-cx, 0);

    // Body & armor
    ctx.fillStyle = c; ctx.fillRect(x + 4, y + 10 + bobY, this.w - 8, 26);
    ctx.fillStyle = c2; ctx.fillRect(x + 4, y + bobY, this.w - 8, 14);
    // Helmet eye slit
    ctx.fillStyle = this.flashTimer > 0 ? '#fff' : '#ff7700'; ctx.fillRect(x + 22, y + 4 + bobY, 8, 3);
    // Legs
    ctx.fillStyle = c2; ctx.fillRect(x + 6, y + 36 + bobY, 8, 14); ctx.fillRect(x + 20, y + 36 + bobY, 8, 14);

    // Shield (blocking stance)
    if (this.shieldUp) {
      ctx.fillStyle = '#2b394a';
      ctx.fillRect(x + this.w - 4, y + 4 + bobY, 9, 38);
      ctx.fillStyle = '#4a627a';
      ctx.fillRect(x + this.w - 2, y + 6 + bobY, 5, 34);
      // Crest
      ctx.fillStyle = '#e2b344';
      ctx.fillRect(x + this.w - 1, y + 18 + bobY, 3, 8);
    }

    // Weapon
    ctx.save();
    if (this.state === 'combo1_windup') {
      ctx.translate(x + this.w, y + 14 + bobY);
      ctx.rotate(-1.2);
      ctx.fillStyle = '#cbd5e0'; ctx.fillRect(-2, 0, 4, 38);
    } else if (this.state === 'combo1_slash') {
      ctx.translate(x + this.w + 6, y + 18 + bobY);
      ctx.rotate(1.4);
      ctx.fillStyle = '#cbd5e0'; ctx.fillRect(-2, 0, 4, 40);
    } else if (this.state === 'combo2_thrust') {
      ctx.translate(x + this.w + 14, y + 20 + bobY);
      ctx.rotate(0.0);
      ctx.fillStyle = '#cbd5e0'; ctx.fillRect(0, -2, 42, 4);
    } else {
      ctx.translate(x - 2, y + 14 + bobY);
      ctx.rotate(0.3);
      ctx.fillStyle = '#a0aec0'; ctx.fillRect(-2, 0, 4, 34);
    }
    ctx.restore();

    // Stun indicator
    if (this.stunned > 0) {
      ctx.fillStyle = '#ffdd44'; ctx.font = 'bold 14px monospace';
      ctx.fillText('💫', x + this.w / 2 - 7, y - 8);
    } else if (this.state === 'combo1_windup' || this.state === 'shield_bash_windup') {
      ctx.fillStyle = '#ff2222'; ctx.font = 'bold 15px monospace';
      ctx.fillText('!', x + this.w / 2 - 4, y - 8);
    }

    ctx.restore();
  }

  getBounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ============================================================================
// BOSS
// ============================================================================
// ============================================================================
// BOSS — VOID LORD (Владыка Бездны)
// High-readability animations, expressive silhouettes & clear telegraphs
// ============================================================================
class Boss {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 64; this.h = 82;
    this.vx = 0; this.vy = 0; this.facing = -1;
    this.hp = 50; this.maxHp = 50; this.dead = false; this.active = false;
    this.phase = 1; this.phaseTransition = false; this.transitionTimer = 0;
    this.state = 'idle'; this.stateTimer = 0; this.stateMaxTimer = 0.5; this.actionCooldown = 1;
    this.animTimer = 0; this.flashTimer = 0; this.invulnTimer = 0;
    this.attackHitbox = null; this.shockwaves = []; this.arena = null; this.spawnedMinions = false;
    this.comboStep = 0;
    this.telegraphTriggered = false;
    this.ghostAfterimages = [];
    this.ghostTimer = 0;
    this.phantomX = 0;
    this.phantomFacing = 1;
    this.pogoHitsAgainst = 0;
    this.pogoDecayTimer = 0;
  }

  activate(arena, audio) {
    this.active = true; this.arena = arena; this.state = 'roar';
    this.stateTimer = 1.6; this.stateMaxTimer = 1.6;
    if (audio && audio.bossRoar) audio.bossRoar();
  }

  update(dt, player, level, particles, camera, audio, projectiles) {
    if (!this.active || this.dead) return;
    this.animTimer += dt;
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.pogoDecayTimer > 0) {
      this.pogoDecayTimer -= dt;
      if (this.pogoDecayTimer <= 0) this.pogoHitsAgainst = 0;
    }

    // Phase 2 transition at 50% HP
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5 && !this.phaseTransition) {
      this.phaseTransition = true; this.transitionTimer = 2.0; this.state = 'roar';
      this.stateTimer = 2.0; this.stateMaxTimer = 2.0;
      this.invulnTimer = 2.0;
      if (camera) camera.shake(14, 1.8);
      if (audio && audio.bossRoar) audio.bossRoar();
    }
    if (this.phaseTransition) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) { this.phase = 2; this.phaseTransition = false; }
      if (particles && Math.random() < 0.45) {
        particles.add(new Particle(this.x + rand(0, this.w), this.y + rand(0, this.h), rand(-60, 60), rand(-120, -40), rand(0.3, 0.8), '#ff2255', rand(3, 6), -40, true));
      }
    }

    if (this.phase === 2 && particles && Math.random() < 0.35) {
      particles.fireEmbers(this.x + this.w / 2 + rand(-18, 18), this.y + this.h - 12);
    }

    // Ghost afterimages decay
    for (let i = this.ghostAfterimages.length - 1; i >= 0; i--) {
      const g = this.ghostAfterimages[i];
      g.life -= dt;
      g.alpha = Math.max(0, g.life / g.maxLife);
      if (g.life <= 0) this.ghostAfterimages.splice(i, 1);
    }

    // Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i]; sw.x += sw.vx * dt; sw.life -= dt; sw.y = sw.groundY - 10;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    this.vy += GRAVITY * dt; this.vy = Math.min(this.vy, TERMINAL_VEL);
    this.stateTimer -= dt; this.attackHitbox = null;
    const prog = 1 - Math.max(0, this.stateTimer) / Math.max(0.001, this.stateMaxTimer);

    switch (this.state) {
      case 'idle':
        this.vx = 0;
        if (this.stateTimer <= 0) this._chooseAction(player, audio, projectiles, particles);
        break;

      case 'walk':
        this.facing = player.x < this.x ? -1 : 1;
        this.vx = this.facing * (this.phase === 2 ? 180 : 120);
        if (particles && Math.random() < 0.25) {
          particles.dustRun(this.x + (this.facing === 1 ? 8 : this.w - 8), this.y + this.h, this.facing);
        }
        if (this.stateTimer <= 0 || Math.abs(player.x - this.x) < 85) {
          this.state = 'idle';
          this.stateTimer = this.phase === 2 ? 0.22 : 0.45;
          this.stateMaxTimer = this.stateTimer;
        }
        break;

      case 'windup':
        this.vx = 0;
        if (prog < 0.35) this.facing = player.x < this.x ? -1 : 1;
        // Telegraph cue at 68% of windup
        if (prog >= 0.68 && !this.telegraphTriggered) {
          this.telegraphTriggered = true;
          if (audio && audio.bossTelegraph) audio.bossTelegraph();
          if (particles && particles.bossTelegraphSparkle) {
            particles.bossTelegraphSparkle(this.x + (this.facing === 1 ? this.w + 14 : -14), this.y - 10, '#ff3344');
          }
        }
        if (this.stateTimer <= 0) {
          this.state = 'attack';
          this.stateTimer = 0.22;
          this.stateMaxTimer = 0.22;
          if (audio) audio.heavySwing();
          if (camera) camera.shake(7, 0.2);
          if (particles) particles.nailSlash(this.x + (this.facing === 1 ? this.w + 20 : -20), this.y + 35, this.facing, 0.3);
        }
        break;

      case 'attack':
        this.attackHitbox = { x: this.facing === 1 ? this.x + this.w : this.x - 85, y: this.y + 8, w: 85, h: 72 };
        if (this.stateTimer <= 0) {
          // Chain into combo thrust?
          if (this.comboStep === 0 && Math.random() < (this.phase === 2 ? 0.75 : 0.5)) {
            this.comboStep = 1;
            this.state = 'combo_thrust_windup';
            this.stateTimer = this.phase === 2 ? 0.38 : 0.46;
            this.stateMaxTimer = this.stateTimer;
            this.telegraphTriggered = false;
            if (audio && audio.bossThrustGlint) audio.bossThrustGlint();
          } else {
            this.comboStep = 0;
            this.state = 'idle';
            this.stateTimer = this.phase === 2 ? 0.32 : 0.62;
            this.stateMaxTimer = this.stateTimer;
          }
        }
        break;

      case 'combo_thrust_windup':
        this.vx = 0;
        if (prog < 0.35) this.facing = player.x < this.x ? -1 : 1;
        if (prog >= 0.68 && !this.telegraphTriggered) {
          this.telegraphTriggered = true;
          if (audio && audio.bossTelegraph) audio.bossTelegraph();
          if (particles && particles.bossTelegraphSparkle) {
            particles.bossTelegraphSparkle(this.x + (this.facing === 1 ? this.w + 6 : -6), this.y + 42, '#00f0ff');
          }
        }
        if (this.stateTimer <= 0) {
          this.state = 'combo_thrust';
          this.stateTimer = 0.26;
          this.stateMaxTimer = 0.26;
          this.vx = this.facing * (this.phase === 2 ? 370 : 275);
          this.attackHitbox = { x: this.facing === 1 ? this.x + this.w : this.x - 95, y: this.y + 24, w: 95, h: 36 };
          if (audio) audio.heavySwing();
          if (camera) camera.shake(5, 0.18);
        }
        break;

      case 'combo_thrust':
        this.attackHitbox = { x: this.facing === 1 ? this.x + this.w : this.x - 95, y: this.y + 24, w: 95, h: 36 };
        if (this.stateTimer <= 0) {
          this.comboStep = 0;
          this.state = 'idle';
          this.stateTimer = this.phase === 2 ? 0.35 : 0.65;
          this.stateMaxTimer = this.stateTimer;
          this.vx = 0;
        }
        break;

      case 'void_wave_windup':
        this.vx = 0;
        if (prog < 0.35) this.facing = player.x < this.x ? -1 : 1;
        if (particles && particles.bossVoidVortex) {
          particles.bossVoidVortex(this.x + this.w / 2, this.y + 30);
        }
        if (prog >= 0.72 && !this.telegraphTriggered) {
          this.telegraphTriggered = true;
          if (audio && audio.bossTelegraph) audio.bossTelegraph();
          if (particles && particles.bossTelegraphSparkle) {
            particles.bossTelegraphSparkle(this.x + this.w / 2, this.y + 10, '#cc44ff');
          }
        }
        if (this.stateTimer <= 0) {
          this.state = 'void_wave_release';
          this.stateTimer = 0.22;
          this.stateMaxTimer = 0.22;
          if (audio) audio.heavySwing();
          if (camera) camera.shake(8, 0.2);
          if (projectiles) {
            projectiles.push(new Projectile(
              this.facing === 1 ? this.x + this.w + 10 : this.x - 30, this.y + 16,
              this.facing * 400, 0,
              1, 'void_wave', 'enemy'
            ));
          }
        }
        break;

      case 'void_wave_release':
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = this.phase === 2 ? 0.35 : 0.6;
          this.stateMaxTimer = this.stateTimer;
        }
        break;

      case 'jump_crouch':
        this.vx = 0;
        if (particles && Math.random() < 0.5) {
          particles.dustRun(this.x + this.w / 2, this.y + this.h, rand(-1, 1));
        }
        if (this.stateTimer <= 0) {
          this.state = 'jump';
          this.stateTimer = 0;
          this.stateMaxTimer = 1.0;
          this.vy = -640;
          this.vx = this.facing * (this.phase === 2 ? 180 : 130);
          if (audio) audio.jump();
        }
        break;

      case 'jump':
        this.vx = this.facing * (this.phase === 2 ? 180 : 130);
        break;

      case 'land':
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = this.phase === 2 ? 0.3 : 0.55;
          this.stateMaxTimer = this.stateTimer;
        }
        break;

      case 'dash':
        this.vx = this.facing * (this.phase === 2 ? 580 : 480);
        this.vy = 0;
        this.attackHitbox = { x: this.x, y: this.y + 10, w: this.w, h: this.h - 10 };
        this.ghostTimer += dt;
        if (this.ghostTimer >= 0.05) {
          this.ghostTimer = 0;
          this.ghostAfterimages.push({
            x: this.x, y: this.y, facing: this.facing, life: 0.28, maxLife: 0.28, alpha: 1,
            color: this.phase === 2 ? '#ff2255' : '#7744ff'
          });
        }
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 0.45;
          this.stateMaxTimer = 0.45;
          this.vx = 0;
        }
        break;

      case 'shadow_blink':
        this.state = 'shadow_blink_dissolve';
        this.stateTimer = 0.15;
        this.stateMaxTimer = 0.15;
        this.vx = 0;
        break;

      case 'shadow_blink_dissolve':
        this.vx = 0;
        if (this.stateTimer <= 0) {
          const side = player.facing === 1 ? -1 : 1;
          this.phantomX = clamp(player.x + side * 95, this.arena ? this.arena.x + 50 : 0, this.arena ? this.arena.x + this.arena.w - 110 : 5000);
          this.phantomFacing = player.x > this.phantomX ? 1 : -1;
          this.state = 'shadow_blink_phantom';
          this.stateTimer = 0.36;
          this.stateMaxTimer = 0.36;
          if (audio) audio.shadowBolt();
        }
        break;

      case 'shadow_blink_phantom':
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.x = this.phantomX;
          this.facing = this.phantomFacing;
          if (particles) particles.deathBurst(this.x + this.w / 2, this.y + this.h / 2);
          this.state = 'windup';
          this.stateTimer = this.phase === 2 ? 0.38 : 0.52;
          this.stateMaxTimer = this.stateTimer;
          this.telegraphTriggered = false;
        }
        break;

      case 'roar':
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 0.5;
          this.stateMaxTimer = 0.5;
        }
        break;
    }

    this.x += this.vx * dt; this.y += this.vy * dt;

    for (const p of level.platforms) {
      if (p.type === 'oneway') continue;
      if (rectsOverlap(this, p)) {
        if (this.vy > 0 && this.y + this.h - this.vy * dt <= p.y + 8) {
          this.y = p.y - this.h;
          if (this.state === 'jump' && this.vy > 180) {
            this.state = 'land';
            this.stateTimer = 0.4;
            this.stateMaxTimer = 0.4;
            if (camera) camera.shake(12, 0.35);
            if (audio) audio.hit();
            this.shockwaves.push({ x: this.x + this.w / 2, groundY: p.y, vx: -280, life: 0.85, w: 32, h: 22 });
            this.shockwaves.push({ x: this.x + this.w / 2, groundY: p.y, vx: 280, life: 0.85, w: 32, h: 22 });
            if (particles) {
              particles.shockwave(this.x + this.w / 2, p.y, -1);
              particles.shockwave(this.x + this.w / 2, p.y, 1);
              if (particles.bossLandingShock) particles.bossLandingShock(this.x + this.w / 2, p.y);
            }
          }
          this.vy = 0;
        } else if (this.vx > 0) { this.x = p.x - this.w; this.vx = 0; }
        else if (this.vx < 0) { this.x = p.x + p.w; this.vx = 0; }
      }
    }
    if (this.arena) this.x = clamp(this.x, this.arena.x + 40, this.arena.x + this.arena.w - 40 - this.w);
  }

  _chooseAction(player, audio, projectiles, particles) {
    const dx = player.x - this.x, dist = Math.abs(dx);
    this.facing = dx > 0 ? 1 : -1;
    const a = [];

    if (dist > 180) a.push('walk', 'jump', 'void_wave');
    if (dist < 130) a.push('windup', 'windup', 'jump');
    if (dist < 220) a.push('windup');

    if (this.phase === 2) {
      a.push('dash', 'shadow_blink', 'void_wave');
      if (dist > 120) a.push('shadow_blink', 'dash');
    }

    const act = a[randInt(0, a.length - 1)];
    this.telegraphTriggered = false;
    switch (act) {
      case 'walk':
        this.state = 'walk'; this.stateTimer = rand(0.4, 1.0); this.stateMaxTimer = this.stateTimer;
        break;
      case 'windup':
        this.comboStep = 0;
        this.state = 'windup'; this.stateTimer = this.phase === 2 ? rand(0.38, 0.48) : rand(0.5, 0.68); this.stateMaxTimer = this.stateTimer;
        break;
      case 'jump':
        this.state = 'jump_crouch'; this.stateTimer = 0.22; this.stateMaxTimer = 0.22;
        break;
      case 'dash':
        this.state = 'dash'; this.stateTimer = 0.32; this.stateMaxTimer = 0.32; if (audio) audio.dash();
        break;
      case 'shadow_blink':
        this.state = 'shadow_blink_dissolve'; this.stateTimer = 0.14; this.stateMaxTimer = 0.14;
        if (particles) particles.deathBurst(this.x + this.w / 2, this.y + this.h / 2);
        break;
      case 'void_wave':
        this.state = 'void_wave_windup'; this.stateTimer = 0.5; this.stateMaxTimer = 0.5;
        if (audio && audio.bossVoidCharge) audio.bossVoidCharge();
        break;
      default:
        this.state = 'walk'; this.stateTimer = 0.5; this.stateMaxTimer = 0.5;
        break;
    }
  }

  takeDamage(amount, knockDir, particles, camera, audio) {
    if (this.invulnTimer > 0 || this.dead) return;
    this.hp -= amount; this.flashTimer = 0.15; this.invulnTimer = 0.2;
    if (camera) camera.shake(5, 0.15);
    if (audio) audio.hit();
    if (particles) particles.sparks(this.x + this.w / 2, this.y + this.h / 3);
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true;
      if (camera) camera.shake(16, 2.2);
      if (particles) {
        particles.deathBurst(this.x + this.w / 2, this.y + this.h / 2);
        particles.deathBurst(this.x + this.w / 2, this.y + this.h / 3);
      }
      if (audio && audio.bossRoar) audio.bossRoar();
    }
  }

  _drawGlint(ctx, x, y, size, color, coreColor = '#ffffff') {
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x, y, x + size, y);
    ctx.quadraticCurveTo(x, y, x, y + size);
    ctx.quadraticCurveTo(x, y, x - size, y);
    ctx.quadraticCurveTo(x, y, x, y - size);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = coreColor;
    const s2 = size * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y - s2);
    ctx.quadraticCurveTo(x, y, x + s2, y);
    ctx.quadraticCurveTo(x, y, x, y + s2);
    ctx.quadraticCurveTo(x, y, x - s2, y);
    ctx.quadraticCurveTo(x, y, x, y - s2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _drawVoidWings(ctx, cx, cy, flap) {
    ctx.save();
    ctx.shadowColor = this.phase === 2 ? '#ff2255' : '#8833cc';
    ctx.shadowBlur = 16;
    ctx.fillStyle = this.phase === 2 ? 'rgba(255, 30, 80, 0.7)' : 'rgba(140, 50, 220, 0.6)';
    ctx.strokeStyle = this.phase === 2 ? '#ffaacc' : '#ddaaff';
    ctx.lineWidth = 1.8;

    // Left Wing
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.quadraticCurveTo(cx - 35 * flap, cy - 42 * flap, cx - 58 * flap, cy - 20 * flap);
    ctx.quadraticCurveTo(cx - 45 * flap, cy + 12, cx - 10, cy + 15);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Right Wing
    ctx.beginPath();
    ctx.moveTo(cx + 10, cy);
    ctx.quadraticCurveTo(cx + 35 * flap, cy - 42 * flap, cx + 58 * flap, cy - 20 * flap);
    ctx.quadraticCurveTo(cx + 45 * flap, cy + 12, cx + 10, cy + 15);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  _drawGreatsword(ctx, hiltX, hiltY, angle, runeColor, isGlint, prog) {
    ctx.save();
    ctx.translate(hiltX, hiltY);
    ctx.rotate(angle);

    const bladeLen = 66, bladeW = 12;
    const isWhiteFlash = this.flashTimer > 0;

    // Pommel & Grip
    ctx.fillStyle = isWhiteFlash ? '#fff' : '#221e2a';
    ctx.beginPath(); ctx.arc(0, -6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = isWhiteFlash ? '#fff' : '#3a3448';
    ctx.fillRect(-2.5, -6, 5, 8);

    // Crossguard
    ctx.fillStyle = isWhiteFlash ? '#fff' : '#4a425a';
    ctx.fillRect(-10, 2, 20, 5);
    ctx.fillStyle = isWhiteFlash ? '#fff' : '#2a2238';
    ctx.beginPath(); ctx.moveTo(-10, 2); ctx.lineTo(-13, 0); ctx.lineTo(-10, 7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, 2); ctx.lineTo(13, 0); ctx.lineTo(10, 7); ctx.closePath(); ctx.fill();

    // Blade Steel
    ctx.fillStyle = isWhiteFlash ? '#fff' : '#6b6380';
    ctx.beginPath();
    ctx.moveTo(-bladeW / 2, 7);
    ctx.lineTo(bladeW / 2, 7);
    ctx.lineTo(bladeW / 2 - 1, 7 + bladeLen - 12);
    ctx.lineTo(0, 7 + bladeLen);
    ctx.lineTo(-bladeW / 2 + 1, 7 + bladeLen - 12);
    ctx.closePath();
    ctx.fill();

    // Inner blade bevel
    ctx.fillStyle = isWhiteFlash ? '#fff' : '#8d85a6';
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(bladeW / 2 - 2, 7 + 4);
    ctx.lineTo(bladeW / 2 - 3, 7 + bladeLen - 14);
    ctx.lineTo(0, 7 + bladeLen - 2);
    ctx.closePath();
    ctx.fill();

    // Glowing Central Fuller Rune
    ctx.shadowColor = runeColor; ctx.shadowBlur = 10;
    ctx.fillStyle = runeColor;
    ctx.fillRect(-1.5, 12, 3, bladeLen - 24);

    // Tip Glint
    if (isGlint) {
      this._drawGlint(ctx, 0, 7 + bladeLen, 14, runeColor, '#ffffff');
    }
    ctx.restore();
  }

  draw(ctx) {
    if (!this.active || this.dead) return;

    // Draw Phantom Pre-spawn for Shadow Blink
    if (this.state === 'shadow_blink_phantom') {
      ctx.save();
      const pulse = 0.45 + 0.35 * Math.sin(this.stateTimer * 22);
      ctx.globalAlpha = pulse;
      ctx.shadowColor = '#cc22ff'; ctx.shadowBlur = 18;
      const pcx = this.phantomX + this.w / 2;
      ctx.translate(pcx, 0); ctx.scale(this.phantomFacing, 1); ctx.translate(-pcx, 0);
      this._drawSilhouette(ctx, this.phantomX, this.y, '#1b0d2a', '#ff1144', true);
      // Pulsing destination rune circle on ground
      ctx.beginPath();
      ctx.ellipse(this.phantomX + this.w / 2, this.y + this.h, 36, 10, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 50, 255, 0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
      return; // Physical body is dissolved during this preview
    }

    // Ghost afterimages (Dash & Teleport trail)
    for (const g of this.ghostAfterimages) {
      ctx.save();
      ctx.globalAlpha = g.alpha * 0.4;
      const gcx = g.x + this.w / 2;
      ctx.translate(gcx, 0); ctx.scale(g.facing, 1); ctx.translate(-gcx, 0);
      this._drawSilhouette(ctx, g.x, g.y, g.color, g.color, false);
      ctx.restore();
    }

    ctx.save();
    const cx = this.x + this.w / 2;
    const feetY = this.y + this.h;
    const prog = 1 - Math.max(0, this.stateTimer) / Math.max(0.001, this.stateMaxTimer);

    // Compute state-based squash, stretch, tilt, and weapon kinematics
    let scaleX = 1, scaleY = 1, tilt = 0, bobY = 0;
    let swordAngle = 0.25, swordOffX = 0, swordOffY = 0;
    let runeColor = this.phase === 2 ? '#ff3344' : '#ff9922';
    let isGlint = false;

    if (this.state === 'idle') {
      bobY = Math.sin(this.animTimer * 2.4) * 2;
      swordAngle = 0.25 + Math.sin(this.animTimer * 2.4) * 0.04;
    } else if (this.state === 'walk') {
      const walkCycle = Math.sin(this.animTimer * 7.5);
      bobY = Math.abs(walkCycle) * 3;
      tilt = 0.08;
      swordAngle = 0.38 + walkCycle * 0.08;
    } else if (this.state === 'windup') {
      scaleY = 1.05; scaleX = 0.95; tilt = -0.15;
      // Trembling tension before strike
      swordAngle = -2.35 + Math.sin(this.stateTimer * 22) * 0.06;
      swordOffX = -8; swordOffY = -12;
      runeColor = '#ff2244';
      if (prog >= 0.68) isGlint = true;
    } else if (this.state === 'attack') {
      scaleY = 0.95; scaleX = 1.05; tilt = 0.18;
      const swingP = Math.min(1, prog * 1.5);
      swordAngle = -2.35 + (1.4 - (-2.35)) * Math.pow(swingP, 0.6);
      swordOffX = 10; swordOffY = 8;
      runeColor = '#ff2244';
    } else if (this.state === 'combo_thrust_windup') {
      scaleY = 0.82; scaleX = 1.15; tilt = -0.12;
      swordAngle = 0.02; swordOffX = -22; swordOffY = 4;
      runeColor = '#00f0ff';
      if (prog >= 0.68) isGlint = true;
    } else if (this.state === 'combo_thrust') {
      scaleY = 0.85; scaleX = 1.18; tilt = 0.24;
      swordAngle = 0.0; swordOffX = 32; swordOffY = 2;
      runeColor = '#00f0ff';
    } else if (this.state === 'void_wave_windup') {
      bobY = Math.sin(this.animTimer * 4) * 4 - 4;
      swordAngle = -1.57; swordOffX = 6; swordOffY = -18;
      runeColor = '#cc44ff';
      if (prog >= 0.72) isGlint = true;
    } else if (this.state === 'void_wave_release') {
      tilt = 0.15; swordAngle = 0.85; swordOffX = 22; swordOffY = 6;
      runeColor = '#cc44ff';
    } else if (this.state === 'jump_crouch') {
      scaleY = 0.68; scaleX = 1.25; bobY = 0; tilt = 0;
      swordAngle = 0.55;
    } else if (this.state === 'jump') {
      scaleY = 1.2; scaleX = 0.88;
      swordAngle = this.vy > 0 ? 1.57 : -0.7; // point straight down when falling!
      if (this.vy > 0) { swordOffX = 4; swordOffY = 16; }
    } else if (this.state === 'land') {
      scaleY = 0.72; scaleX = 1.22; tilt = 0.04;
      swordAngle = 1.57; swordOffX = 14; swordOffY = 18;
    } else if (this.state === 'dash') {
      scaleY = 0.76; scaleX = 1.25; tilt = 0.42;
      swordAngle = -0.65; swordOffX = -18; swordOffY = -4;
    } else if (this.state === 'roar') {
      scaleY = 1.14; scaleX = 1.05; tilt = -0.22;
      swordAngle = -1.1; runeColor = this.phase === 2 ? '#ff2255' : '#ff9922';
    }

    // --- VISUAL TELEGRAPH INDICATORS (Threat lines & danger zones) ---
    if (this.state === 'windup') {
      // Danger floor arc
      ctx.save();
      const arcAlpha = 0.2 + 0.5 * prog;
      ctx.strokeStyle = `rgba(255, 40, 60, ${arcAlpha})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      const arcStart = this.facing === 1 ? -0.25 : Math.PI - 0.45;
      const arcEnd = this.facing === 1 ? 0.45 : Math.PI + 0.25;
      ctx.arc(cx, feetY, 92, arcStart, arcEnd);
      ctx.stroke();
      ctx.restore();
    } else if (this.state === 'combo_thrust_windup') {
      // Targeting laser streak with chevrons
      ctx.save();
      const beamLen = 270;
      const beamY = this.y + 44;
      const startX = this.facing === 1 ? this.x + this.w : this.x;
      const endX = startX + this.facing * beamLen;
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.4 + 0.5 * prog})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(startX, beamY); ctx.lineTo(endX, beamY); ctx.stroke();
      ctx.setLineDash([]);
      // Chevron arrows along line
      ctx.fillStyle = '#00f0ff';
      for (let c = 1; c <= 3; c++) {
        const ax = startX + this.facing * (c * 75 + (this.animTimer * 120) % 75);
        ctx.beginPath();
        ctx.moveTo(ax - this.facing * 8, beamY - 6);
        ctx.lineTo(ax, beamY);
        ctx.lineTo(ax - this.facing * 8, beamY + 6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (this.state === 'roar') {
      // Expanding shockwave rings
      for (let r = 0; r < 3; r++) {
        const ringP = ((this.animTimer * 2.2 + r * 0.33) % 1);
        const radius = ringP * 140;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, this.y + 36, radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.phase === 2 ? `rgba(255, 30, 70, ${1 - ringP})` : `rgba(180, 80, 255, ${1 - ringP})`;
        ctx.lineWidth = 3.5 * (1 - ringP);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Apply Facing & Squash/Stretch Transformations
    ctx.translate(cx, feetY);
    ctx.scale(this.facing * scaleX, scaleY);
    ctx.rotate(tilt);
    ctx.translate(-cx, -feetY);

    // --- DRAW VOID KNIGHT CHARACTER ---
    this._drawBossCharacter(ctx, this.x, this.y + bobY, runeColor, swordAngle, swordOffX, swordOffY, isGlint, prog);

    ctx.restore();

    // --- ACTIVE ATTACK EFFECTS (Crescent slash trails & shockwaves) ---
    if (this.state === 'attack') {
      ctx.save();
      const slashAlpha = Math.max(0, 1 - prog * 1.3);
      ctx.globalAlpha = slashAlpha;
      ctx.shadowColor = '#ff2255'; ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(255, 40, 70, 0.35)';
      const handX = cx + (this.w / 2 - 4) * this.facing;
      const handY = this.y + 32;
      const sweepStart = this.facing === 1 ? -2.2 : -Math.PI + 2.2;
      const sweepEnd = this.facing === 1 ? 1.2 : -Math.PI - 1.2;
      const curAngle = sweepStart + (sweepEnd - sweepStart) * Math.min(1, prog * 1.5);

      ctx.beginPath();
      ctx.arc(handX, handY, 96, curAngle - 0.75, curAngle + 0.15, this.facing !== 1);
      ctx.arc(handX, handY, 42, curAngle + 0.15, curAngle - 0.75, this.facing === 1);
      ctx.closePath();
      ctx.fill();

      // Blade white-hot leading edge
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(handX, handY, 96, curAngle - 0.75, curAngle + 0.1, this.facing !== 1);
      ctx.stroke();
      ctx.restore();
    } else if (this.state === 'combo_thrust') {
      ctx.save();
      const thrustAlpha = Math.max(0, 1 - prog * 1.5);
      ctx.globalAlpha = thrustAlpha;
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 16;
      const tX = this.facing === 1 ? this.x + this.w + 6 : this.x - 6;
      const tLen = 98 * this.facing;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.32)';
      ctx.beginPath();
      ctx.moveTo(tX, this.y + 30);
      ctx.lineTo(tX + tLen, this.y + 42);
      ctx.lineTo(tX, this.y + 54);
      ctx.closePath(); ctx.fill();

      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tX, this.y + 42); ctx.lineTo(tX + tLen, this.y + 42); ctx.stroke();
      ctx.restore();
    } else if (this.state === 'land') {
      // Glowing floor impact cracks
      ctx.save();
      const landAlpha = Math.max(0, 1 - prog);
      ctx.strokeStyle = `rgba(255, 140, 50, ${landAlpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 38, feetY); ctx.lineTo(cx - 15, feetY + 3); ctx.lineTo(cx + 18, feetY - 2); ctx.lineTo(cx + 40, feetY);
      ctx.stroke();
      ctx.restore();
    }

    // Shockwaves render
    for (const sw of this.shockwaves) {
      const a = sw.life / 0.85;
      ctx.fillStyle = `rgba(255,100,40,${a * 0.8})`; ctx.fillRect(sw.x - sw.w / 2, sw.y, sw.w, sw.h);
      ctx.fillStyle = `rgba(255,220,100,${a * 0.6})`; ctx.fillRect(sw.x - sw.w / 4, sw.y + 3, sw.w / 2, sw.h - 6);
    }
  }

  _drawBossCharacter(ctx, x, y, runeColor, swordAngle, swordOffX, swordOffY, isGlint, prog) {
    const isWhite = this.flashTimer > 0;
    const bodyC = isWhite ? '#fff' : '#2b2338';
    const armorC = isWhite ? '#fff' : '#453856';
    const darkC = isWhite ? '#fff' : '#171322';
    const cx = x + this.w / 2;

    // Void Wings in Phase 2 or Roar
    if (this.phase === 2 || this.state === 'roar') {
      const flap = 0.85 + 0.25 * Math.sin(this.animTimer * 5);
      this._drawVoidWings(ctx, cx, y + 28, flap);
    }

    // Dynamic Flowing Cloak (behind body)
    ctx.fillStyle = isWhite ? '#fff' : '#1c152a';
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 24);
    const wave = Math.sin(this.animTimer * 6) * 6;
    ctx.quadraticCurveTo(x - 14 + wave, y + 55, x - 20 + wave * 1.5, y + this.h + 2);
    ctx.lineTo(x + 8, y + this.h - 4);
    ctx.lineTo(x + this.w - 14, y + 24);
    ctx.closePath();
    ctx.fill();

    // Greaves & Boots
    const walkL = this.state === 'walk' ? Math.sin(this.animTimer * 7.5) * 6 : 0;
    ctx.fillStyle = darkC;
    ctx.fillRect(x + 12, y + 54, 14, 26 + walkL);
    ctx.fillRect(x + this.w - 26, y + 54, 14, 26 - walkL);
    ctx.fillStyle = armorC;
    ctx.fillRect(x + 10, y + 74 + Math.max(0, walkL), 18, 8);
    ctx.fillRect(x + this.w - 28, y + 74 + Math.max(0, -walkL), 18, 8);

    // Torso Cuirass
    ctx.fillStyle = bodyC;
    ctx.fillRect(x + 10, y + 24, this.w - 20, 32);
    ctx.fillStyle = armorC;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 24); ctx.lineTo(x + this.w - 10, y + 24);
    ctx.lineTo(x + this.w - 16, y + 52); ctx.lineTo(x + 16, y + 52);
    ctx.closePath(); ctx.fill();

    // Glowing Runic Core in Chest
    ctx.save();
    ctx.shadowColor = runeColor; ctx.shadowBlur = 12;
    ctx.fillStyle = runeColor;
    ctx.beginPath();
    ctx.arc(cx, y + 36, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, y + 36, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Spiked Pauldrons (Shoulders)
    ctx.fillStyle = armorC;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 24); ctx.lineTo(x - 4, y + 14); ctx.lineTo(x + 18, y + 20); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + this.w - 4, y + 24); ctx.lineTo(x + this.w + 4, y + 14); ctx.lineTo(x + this.w - 18, y + 20); ctx.closePath(); ctx.fill();

    // Helmet & Horns
    ctx.fillStyle = bodyC;
    ctx.fillRect(x + 14, y + 2, this.w - 28, 22);

    // Horns (Hollow Knight style double-curved horns)
    ctx.fillStyle = armorC;
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 4); ctx.quadraticCurveTo(x + 8, y - 16, x - 2, y - 24); ctx.quadraticCurveTo(x + 14, y - 12, x + 24, y + 4);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + this.w - 18, y + 4); ctx.quadraticCurveTo(x + this.w - 8, y - 16, x + this.w + 2, y - 24); ctx.quadraticCurveTo(x + this.w - 14, y - 12, x + this.w - 24, y + 4);
    ctx.closePath(); ctx.fill();

    // Visor Eye Slits (Piercing light)
    const eyeC = this.phase === 2 ? '#ff1133' : '#ffaa22';
    ctx.save();
    ctx.shadowColor = eyeC; ctx.shadowBlur = 10;
    ctx.fillStyle = eyeC;
    ctx.fillRect(x + this.w - 24, y + 10, 8, 4);
    ctx.fillRect(x + this.w - 36, y + 10, 8, 4);
    if (this.phase === 2) {
      // Eye flame trail
      ctx.fillStyle = 'rgba(255, 30, 60, 0.5)';
      ctx.fillRect(x + this.w - 44, y + 9, 8, 3);
    }
    ctx.restore();

    // Colossal Greatsword
    const hiltX = x + this.w - 12 + swordOffX;
    const hiltY = y + 30 + swordOffY;
    this._drawGreatsword(ctx, hiltX, hiltY, swordAngle, runeColor, isGlint, prog);
  }

  _drawSilhouette(ctx, x, y, color, eyeColor, showEyes = true) {
    ctx.fillStyle = color;
    // Cloak
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 24); ctx.lineTo(x - 14, y + this.h); ctx.lineTo(x + this.w + 14, y + this.h); ctx.lineTo(x + this.w - 10, y + 24);
    ctx.closePath(); ctx.fill();
    // Body & Head
    ctx.fillRect(x + 12, y + 6, this.w - 24, 48);
    // Horns
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 4); ctx.quadraticCurveTo(x + 8, y - 16, x - 2, y - 24); ctx.quadraticCurveTo(x + 14, y - 12, x + 24, y + 4);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + this.w - 18, y + 4); ctx.quadraticCurveTo(x + this.w - 8, y - 16, x + this.w + 2, y - 24); ctx.quadraticCurveTo(x + this.w - 14, y - 12, x + this.w - 24, y + 4);
    ctx.closePath(); ctx.fill();

    if (showEyes) {
      ctx.shadowColor = eyeColor; ctx.shadowBlur = 12;
      ctx.fillStyle = eyeColor;
      ctx.fillRect(x + this.w - 24, y + 10, 8, 4);
      ctx.fillRect(x + this.w - 36, y + 10, 8, 4);
    }
  }

  getBounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ============================================================================
// PARALLAX BACKGROUND
// ============================================================================
class Background {
  constructor(levelWidth) {
    this.levelWidth = levelWidth;
    this.stars = [];
    for (let i = 0; i < 100; i++) this.stars.push({ x: rand(0, CANVAS_W), y: rand(0, CANVAS_H * 0.7), size: rand(1, 3), speed: rand(0.1, 0.3), blink: rand(0, Math.PI * 2) });
    this.mountains1 = this._genM(8, 0.3, 300, 500);
    this.mountains2 = this._genM(12, 0.5, 200, 400);
    this.trees = this._genT(25, 0.7);
  }
  _genM(c, p, mn, mx) { const m = []; for (let i = 0; i < c; i++)m.push({ x: (this.levelWidth / c) * i + rand(-100, 100), h: rand(mn, mx), w: rand(200, 400), parallax: p }); return m; }
  _genT(c, p) { const t = []; for (let i = 0; i < c; i++)t.push({ x: (this.levelWidth / c) * i + rand(-80, 80), h: rand(80, 180), w: rand(20, 40), parallax: p }); return t; }

  draw(ctx, camera, time) {
    const grd = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grd.addColorStop(0, '#0a0a1a'); grd.addColorStop(0.5, '#141428'); grd.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const s of this.stars) {
      const a = 0.3 + 0.7 * Math.abs(Math.sin(time * s.speed + s.blink));
      ctx.fillStyle = `rgba(200,200,255,${a})`; ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.fillStyle = '#334466'; ctx.beginPath(); ctx.arc(CANVAS_W * 0.8, 100, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0a1a'; ctx.beginPath(); ctx.arc(CANVAS_W * 0.8 + 15, 90, 45, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#12122a';
    for (const m of this.mountains1) { const sx = m.x - camera.x * m.parallax; ctx.beginPath(); ctx.moveTo(sx - m.w / 2, CANVAS_H); ctx.lineTo(sx, CANVAS_H - m.h); ctx.lineTo(sx + m.w / 2, CANVAS_H); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#1a1a35';
    for (const m of this.mountains2) { const sx = m.x - camera.x * m.parallax; ctx.beginPath(); ctx.moveTo(sx - m.w / 2, CANVAS_H); ctx.lineTo(sx, CANVAS_H - m.h); ctx.lineTo(sx + m.w / 2, CANVAS_H); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#181830';
    for (const t of this.trees) {
      const sx = t.x - camera.x * t.parallax;
      ctx.fillRect(sx - t.w / 4, CANVAS_H - t.h, t.w / 2, t.h);
      ctx.beginPath(); ctx.moveTo(sx - t.w, CANVAS_H - t.h + 20); ctx.lineTo(sx, CANVAS_H - t.h - 30); ctx.lineTo(sx + t.w, CANVAS_H - t.h + 20); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx - t.w * 0.8, CANVAS_H - t.h); ctx.lineTo(sx, CANVAS_H - t.h - 50); ctx.lineTo(sx + t.w * 0.8, CANVAS_H - t.h); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,20,40,0.3)'; ctx.fillRect(0, CANVAS_H * 0.6, CANVAS_W, CANVAS_H * 0.4);
  }
}

// ============================================================================
// HUD
// ============================================================================
class HUD {
  constructor(bindings) { this.bindings = bindings; this.deathAlpha = 0; this.winAlpha = 0; this.bossBarAlpha = 0; this.weaponNotifyTimer = 0; this.weaponNotifyName = ''; }

  showWeaponSwitch(name) { this.weaponNotifyTimer = 2; this.weaponNotifyName = name; }

  draw(ctx, player, boss, gameState, dt) {
    ctx.save();
    if (this.weaponNotifyTimer > 0) this.weaponNotifyTimer -= dt;

    // HP Hearts
    for (let i = 0; i < player.maxHp; i++) {
      const hx = 30 + i * 32, hy = 30;
      this._drawHeart(ctx, hx, hy, i < player.hp ? '#ff3355' : '#333344', i < player.hp ? '#ff6688' : '#444455');
    }

    // Soul meter
    const smX = 30, smY = 58, smW = 120, smH = 12;
    ctx.fillStyle = '#222233'; ctx.fillRect(smX, smY, smW, smH);
    ctx.fillStyle = '#44aadd'; ctx.fillRect(smX, smY, smW * (player.soul / player.maxSoul), smH);
    ctx.strokeStyle = '#556677'; ctx.lineWidth = 1; ctx.strokeRect(smX, smY, smW, smH);
    ctx.fillStyle = '#6688aa'; ctx.font = '10px monospace'; ctx.fillText('SOUL', smX, smY - 2);

    if (player.soul >= player.healCost && player.hp < player.maxHp) {
      const hk = this.bindings.getKeyLabel(this.bindings.getKeys('heal')[0] || 'Q');
      ctx.fillStyle = '#66ffaa'; ctx.fillText(`[${hk}] HEAL`, smX + smW + 8, smY + 10);
    }

    // Dash cooldown
    const dashReady = player.dashCooldown <= 0;
    ctx.fillStyle = dashReady ? '#66ccff' : '#333344'; ctx.fillRect(30, 78, 24, 24);
    ctx.strokeStyle = '#556677'; ctx.strokeRect(30, 78, 24, 24);
    ctx.fillStyle = dashReady ? '#fff' : '#666677'; ctx.font = '14px monospace'; ctx.fillText('⚡', 34, 96);
    if (!dashReady) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(30, 78, 24, 24 * (player.dashCooldown / player.dashCooldownMax)); }

    // Current weapon
    ctx.fillStyle = '#aabbcc'; ctx.font = 'bold 12px monospace';
    ctx.fillText(`⚔ ${player.weapon.name}`, 60, 92);

    // Weapon switch notification
    if (this.weaponNotifyTimer > 0) {
      ctx.globalAlpha = Math.min(1, this.weaponNotifyTimer);
      ctx.fillStyle = '#ccddee'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
      ctx.fillText(this.weaponNotifyName, CANVAS_W / 2, CANVAS_H - 60);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }

    // Spell slots
    for (let i = 0; i < SPELLS.length; i++) {
      const sx = 30 + i * 42, sy = 110;
      const sp = SPELLS[i];
      const ready = player.spellCooldowns[i] <= 0 && player.soul >= sp.soulCost;
      ctx.fillStyle = ready ? '#333355' : '#222233';
      ctx.fillRect(sx, sy, 36, 36);
      ctx.strokeStyle = ready ? '#6666aa' : '#333344'; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, 36, 36);
      ctx.fillStyle = ready ? sp.color : '#555566'; ctx.font = '16px serif'; ctx.fillText(sp.icon, sx + 8, sy + 24);
      // Cooldown overlay
      if (player.spellCooldowns[i] > 0) {
        const pct = player.spellCooldowns[i] / sp.cooldown;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx, sy, 36, 36 * pct);
      }
      // Key label
      const keyLabel = this.bindings.getKeyLabel(this.bindings.getKeys('spell' + (i + 1))[0] || '');
      ctx.fillStyle = '#667788'; ctx.font = '9px monospace'; ctx.fillText(keyLabel, sx + 2, sy + 34);
      // Soul cost
      ctx.fillStyle = '#4488aa'; ctx.font = '8px monospace'; ctx.fillText(sp.soulCost, sx + 22, sy + 34);
    }

    // Boss HP bar
    if (boss && boss.active && !boss.dead) {
      this.bossBarAlpha = Math.min(1, this.bossBarAlpha + 0.02);
      ctx.globalAlpha = this.bossBarAlpha;
      const bw = 400, bh = 16, bx = CANVAS_W / 2 - bw / 2, by = 24;
      ctx.fillStyle = '#222233'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = boss.phase === 2 ? '#dd2244' : '#cc4466'; ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), bh);
      ctx.strokeStyle = '#888899'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#ccccdd'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(boss.phase === 2 ? '⚔ ABYSSAL WARDEN — PHASE 2 ⚔' : '⚔ ABYSSAL WARDEN ⚔', CANVAS_W / 2, by - 6);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    } else { this.bossBarAlpha = 0; }

    // Death screen
    if (gameState === STATE.DEAD) {
      this.deathAlpha = Math.min(1, this.deathAlpha + 0.015);
      ctx.fillStyle = `rgba(10,0,0,${this.deathAlpha * 0.7})`; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = this.deathAlpha; ctx.fillStyle = '#cc2222'; ctx.font = 'bold 72px serif'; ctx.textAlign = 'center';
      ctx.fillText('YOU DIED', CANVAS_W / 2, CANVAS_H / 2 - 20);
      const rk = this.bindings.getKeyLabel(this.bindings.getKeys('restart')[0] || 'N');
      ctx.fillStyle = '#887766'; ctx.font = '20px monospace';
      ctx.fillText(`Press ${rk} to revive at bonfire`, CANVAS_W / 2, CANVAS_H / 2 + 40);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    } else { this.deathAlpha = 0; }

    // Win screen
    if (gameState === STATE.WIN) {
      this.winAlpha = Math.min(1, this.winAlpha + 0.01);
      ctx.fillStyle = `rgba(5,5,20,${this.winAlpha * 0.7})`; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = this.winAlpha; ctx.fillStyle = '#66aaff'; ctx.font = 'bold 60px serif'; ctx.textAlign = 'center';
      ctx.fillText('VICTORY', CANVAS_W / 2, CANVAS_H / 2 - 40);
      ctx.fillStyle = '#aabbcc'; ctx.font = 'italic 24px serif'; ctx.fillText('The Abyss has been sealed', CANVAS_W / 2, CANVAS_H / 2 + 10);
      const rk = this.bindings.getKeyLabel(this.bindings.getKeys('restart')[0] || 'N');
      ctx.fillStyle = '#887766'; ctx.font = '18px monospace'; ctx.fillText(`Press ${rk} to play again`, CANVAS_W / 2, CANVAS_H / 2 + 60);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    } else { this.winAlpha = 0; }

    ctx.restore();
  }

  _drawHeart(ctx, x, y, c1, c2) {
    ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(x, y + 6);
    ctx.bezierCurveTo(x, y, x - 10, y, x - 10, y + 6); ctx.bezierCurveTo(x - 10, y + 14, x, y + 18, x, y + 22);
    ctx.bezierCurveTo(x, y + 18, x + 10, y + 14, x + 10, y + 6); ctx.bezierCurveTo(x + 10, y, x, y, x, y + 6);
    ctx.fill();
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(x - 4, y + 6, 3, 0, Math.PI * 2); ctx.fill();
  }
}

// ============================================================================
// BONFIRE MENU UI
// ============================================================================
class BonfireMenu {
  constructor(bindings) {
    this.bindings = bindings;
    this.selectedIndex = 0;
    this.options = ['Rest & Heal', 'Switch Weapon', 'Rebind Keys', 'Leave'];
    this.alpha = 0;
    this.weaponSub = false;
  }
  update(input) {
    if (input.jumpPressed()) {
      if (this.weaponSub) {
        this.selectedIndex = clamp(this.selectedIndex - 1, 0, (this.weaponSub ? WEAPONS.length : this.options.length) - 1);
      } else {
        this.selectedIndex = clamp(this.selectedIndex - 1, 0, this.options.length - 1);
      }
    }
    if (input.dashPressed() || input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
      const max = this.weaponSub ? WEAPONS.length - 1 : this.options.length - 1;
      this.selectedIndex = clamp(this.selectedIndex + 1, 0, max);
    }
    // We use attack or interact to confirm
    return input.attackPressed() || input.interactPressed();
  }
  getSelection() {
    if (this.weaponSub) return { type: 'weapon', index: this.selectedIndex };
    return { type: 'menu', index: this.selectedIndex };
  }
  draw(ctx, player) {
    this.alpha = Math.min(1, this.alpha + 0.05);
    ctx.save();
    ctx.globalAlpha = this.alpha;

    // Dim background
    ctx.fillStyle = 'rgba(5,5,15,0.8)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Panel
    const pw = 400, ph = 350, px = CANVAS_W / 2 - pw / 2, py = CANVAS_H / 2 - ph / 2;
    ctx.fillStyle = '#111122'; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#44557788'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);

    // Title
    ctx.fillStyle = '#ffaa44'; ctx.font = 'bold 24px serif'; ctx.textAlign = 'center';
    ctx.fillText('🔥 Bonfire 🔥', CANVAS_W / 2, py + 35);

    if (this.weaponSub) {
      ctx.fillStyle = '#8899aa'; ctx.font = '16px monospace';
      ctx.fillText('Select Weapon', CANVAS_W / 2, py + 65);

      for (let i = 0; i < WEAPONS.length; i++) {
        const oy = py + 90 + i * 55;
        const sel = i === this.selectedIndex;
        const equipped = i === player.weaponIndex;
        ctx.fillStyle = sel ? '#334466' : '#1a1a2e'; ctx.fillRect(px + 20, oy, pw - 40, 45);
        if (sel) { ctx.strokeStyle = '#6688aa'; ctx.lineWidth = 1; ctx.strokeRect(px + 20, oy, pw - 40, 45); }
        ctx.textAlign = 'left';
        ctx.fillStyle = sel ? '#ddddff' : '#8899aa'; ctx.font = 'bold 14px monospace';
        ctx.fillText(WEAPONS[i].name + (equipped ? ' [EQUIPPED]' : ''), px + 40, oy + 18);
        ctx.fillStyle = '#667788'; ctx.font = '11px monospace';
        ctx.fillText(`DMG: ${WEAPONS[i].damage}  RNG: ${WEAPONS[i].range}  SPD: ${(1 / WEAPONS[i].attackDur).toFixed(0)}/s`, px + 40, oy + 35);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#556677'; ctx.font = '11px monospace';
      ctx.fillText('↑↓ Navigate · Attack/F to select · ESC to go back', CANVAS_W / 2, py + ph - 20);
    } else {
      for (let i = 0; i < this.options.length; i++) {
        const oy = py + 70 + i * 50;
        const sel = i === this.selectedIndex;
        ctx.fillStyle = sel ? '#334466' : 'transparent'; ctx.fillRect(px + 30, oy, pw - 60, 38);
        if (sel) { ctx.strokeStyle = '#6688aa'; ctx.lineWidth = 1; ctx.strokeRect(px + 30, oy, pw - 60, 38); }
        ctx.fillStyle = sel ? '#ddddff' : '#8899aa'; ctx.font = '18px monospace'; ctx.textAlign = 'center';
        ctx.fillText(this.options[i], CANVAS_W / 2, oy + 26);
      }
      // Player status
      ctx.fillStyle = '#667788'; ctx.font = '12px monospace';
      ctx.fillText(`HP: ${player.hp}/${player.maxHp}   Soul: ${Math.floor(player.soul)}/${player.maxSoul}   Weapon: ${player.weapon.name}`, CANVAS_W / 2, py + ph - 40);
      ctx.fillStyle = '#556677'; ctx.font = '11px monospace';
      ctx.fillText('↑↓ Navigate · Attack/F to select', CANVAS_W / 2, py + ph - 20);
    }

    ctx.textAlign = 'left'; ctx.globalAlpha = 1; ctx.restore();
  }
}

// ============================================================================
// REBIND MENU UI
// ============================================================================
class RebindMenu {
  constructor(bindings) {
    this.bindings = bindings;
    this.actions = Object.keys(DEFAULT_BINDINGS);
    this.selectedIndex = 0;
    this.waitingForKey = false;
    this.scrollOffset = 0;
    this.maxVisible = 12;
  }
  update(input) {
    if (this.waitingForKey) {
      if (input.lastKeyPressed && input.lastKeyPressed !== 'Escape') {
        this.bindings.setKey(this.actions[this.selectedIndex], input.lastKeyPressed);
        this.waitingForKey = false;
        return false;
      }
      if (input.lastKeyPressed === 'Escape') { this.waitingForKey = false; return false; }
      return false;
    }

    if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      if (this.selectedIndex < this.scrollOffset) this.scrollOffset = this.selectedIndex;
    }
    if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
      this.selectedIndex = Math.min(this.actions.length - 1, this.selectedIndex + 1);
      if (this.selectedIndex >= this.scrollOffset + this.maxVisible) this.scrollOffset = this.selectedIndex - this.maxVisible + 1;
    }
    if (input.wasPressed('Enter') || input.wasPressed('KeyJ')) {
      this.waitingForKey = true; return false;
    }
    if (input.wasPressed('Backspace')) {
      // Clear binding
      this.bindings.bindings[this.actions[this.selectedIndex]] = [];
      this.bindings.save(); return false;
    }
    if (input.wasPressed('KeyR') && input.isDown('ControlLeft')) {
      // Could be reset, but let's use a different key
    }
    // Escape or pause exits
    if (input.wasPressed('Escape') || input.pausePressed()) return true; // signal to exit
    return false;
  }
  draw(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,15,0.9)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const pw = 550, ph = 500, px = CANVAS_W / 2 - pw / 2, py = CANVAS_H / 2 - ph / 2;
    ctx.fillStyle = '#111122'; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#44557788'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = '#aabbcc'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
    ctx.fillText('⌨ REBIND KEYS', CANVAS_W / 2, py + 30);

    const startI = this.scrollOffset;
    const endI = Math.min(this.actions.length, startI + this.maxVisible);

    for (let i = startI; i < endI; i++) {
      const oy = py + 50 + (i - startI) * 34;
      const sel = i === this.selectedIndex;
      const action = this.actions[i];
      const keys = this.bindings.getKeys(action);
      const keyStr = keys.map(k => this.bindings.getKeyLabel(k)).join(', ') || '—';

      if (sel) { ctx.fillStyle = '#223344'; ctx.fillRect(px + 10, oy, pw - 20, 30); ctx.strokeStyle = '#5577aa'; ctx.lineWidth = 1; ctx.strokeRect(px + 10, oy, pw - 20, 30); }

      ctx.textAlign = 'left';
      ctx.fillStyle = sel ? '#ddddff' : '#8899aa'; ctx.font = '13px monospace';
      ctx.fillText(this.bindings.getActionLabel(action), px + 25, oy + 20);
      ctx.textAlign = 'right';
      if (sel && this.waitingForKey) {
        ctx.fillStyle = '#ffaa44'; ctx.fillText('Press a key...', px + pw - 25, oy + 20);
      } else {
        ctx.fillStyle = sel ? '#aaccee' : '#667788'; ctx.fillText(keyStr, px + pw - 25, oy + 20);
      }
    }

    // Scroll indicators
    if (this.scrollOffset > 0) { ctx.fillStyle = '#667788'; ctx.textAlign = 'center'; ctx.fillText('▲', CANVAS_W / 2, py + 45); }
    if (endI < this.actions.length) { ctx.fillStyle = '#667788'; ctx.textAlign = 'center'; ctx.fillText('▼', CANVAS_W / 2, py + ph - 30); }

    ctx.textAlign = 'center'; ctx.fillStyle = '#556677'; ctx.font = '11px monospace';
    ctx.fillText('↑↓ Navigate · Enter/J to rebind · Backspace to clear · ESC to close', CANVAS_W / 2, py + ph - 12);
    ctx.textAlign = 'left'; ctx.restore();
  }
}

// ============================================================================
// TITLE SCREEN
// ============================================================================
class TitleScreen {
  constructor() { this.time = 0; this.particles = []; }
  update(dt) {
    this.time += dt;
    if (Math.random() < 0.1) this.particles.push({ x: rand(0, CANVAS_W), y: CANVAS_H + 10, vx: rand(-20, 20), vy: rand(-60, -20), life: rand(2, 5), maxLife: 5, size: rand(2, 5) });
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }
  draw(ctx, bindings) {
    const grd = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grd.addColorStop(0, '#060612'); grd.addColorStop(1, '#0f0f24');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const p of this.particles) {
      ctx.globalAlpha = (p.life / p.maxLife) * 0.5; ctx.fillStyle = '#4466cc'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.save(); ctx.textAlign = 'center';

    ctx.shadowColor = '#4466cc'; ctx.shadowBlur = 30 + Math.sin(this.time * 2) * 10;
    ctx.fillStyle = '#6688cc'; ctx.font = 'bold 80px serif';
    ctx.fillText('ABYSSAL KNIGHT', CANVAS_W / 2, CANVAS_H / 2 - 120); ctx.shadowBlur = 0;

    ctx.fillStyle = '#556688'; ctx.font = 'italic 22px serif';
    ctx.fillText('Echoes of the Deep', CANVAS_W / 2, CANVAS_H / 2 - 75);

    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 3);
    ctx.fillStyle = '#8899bb'; ctx.font = '22px monospace';
    ctx.fillText('Press any key to begin', CANVAS_W / 2, CANVAS_H / 2 - 20);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#445566'; ctx.font = '14px monospace';
    const hk = bindings.getKeyLabel;
    const bk = bindings.getKeys.bind(bindings);
    const controls = [
      `${bk('moveLeft').map(k => hk.call(bindings, k)).join('/')} / ${bk('moveRight').map(k => hk.call(bindings, k)).join('/')} — Move`,
      `${bk('jump').map(k => hk.call(bindings, k)).slice(0, 2).join('/')} — Jump / Double Jump (in air)`,
      `${bk('attack').map(k => hk.call(bindings, k)).join('/')} / Click — Attack`,
      `${bk('dash').map(k => hk.call(bindings, k)).slice(0, 2).join('/')} — Dash (i-frames!)`,
      `${bk('heal').map(k => hk.call(bindings, k)).join('/')} — Heal (costs Soul)`,
      `1/2/3 — Cast Spells   ${bk('weaponNext').map(k => hk.call(bindings, k)).join('/')} — Switch Weapon`,
      `${bk('interact').map(k => hk.call(bindings, k)).join('/')} — Interact (Bonfires)`,
      `${bk('help').map(k => hk.call(bindings, k)).join('/')} — Help   ESC — Rebind Keys`,
    ];
    for (let i = 0; i < controls.length; i++) ctx.fillText(controls[i], CANVAS_W / 2, CANVAS_H / 2 + 30 + i * 22);

    ctx.restore();
  }
}

// ============================================================================
// MAIN GAME
// ============================================================================
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = CANVAS_W; this.canvas.height = CANVAS_H;

    this.keyBindings = new KeyBindings();
    this.input = new InputManager(this.keyBindings);
    this.audio = new AudioEngine();
    this.camera = new Camera();
    this.particles = new ParticleSystem();
    this.hud = new HUD(this.keyBindings);
    this.titleScreen = new TitleScreen();
    this.bonfireMenu = new BonfireMenu(this.keyBindings);
    this.rebindMenu = new RebindMenu(this.keyBindings);
    this.rebindReturnState = STATE.PLAYING;

    this.gameState = STATE.TITLE;
    this.lastTime = 0; this.time = 0;
    this.showHelp = false;
    this.projectiles = [];
    this.freezeFrame = 0;
    this.currentBonfire = null;
    this.enemyTemplates = [];

    this._resize();
    window.addEventListener('resize', () => this._resize());
    requestAnimationFrame(t => this._loop(t));
  }

  _resize() {
    const s = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H);
    this.canvas.style.width = `${CANVAS_W * s}px`; this.canvas.style.height = `${CANVAS_H * s}px`;
  }

  _initLevel() {
    const ld = buildLevel();
    this.level = ld;
    this.player = new Player(ld.playerStart.x, ld.playerStart.y);
    this.enemyTemplates = ld.enemies;
    this.enemies = ld.enemies.map(e => new Enemy(e.x, e.y, e.type, e.patrolRange));
    this.boss = new Boss(ld.bossSpawn.x, ld.bossSpawn.y);
    this.bonfires = ld.bonfires;
    // Light first bonfire
    this.bonfires[0].lit = true;
    this.player.respawnX = this.bonfires[0].x;
    this.player.respawnY = this.bonfires[0].y - 10;
    this.player.lastBonfireId = 0;

    this.camera.levelWidth = ld.width; this.camera.levelHeight = ld.height;
    this.camera.x = this.player.x - CANVAS_W / (2 * CAMERA_ZOOM); this.camera.y = this.player.y - CANVAS_H / (2 * CAMERA_ZOOM);
    this.background = new Background(ld.width);
    this.particles.clear(); this.projectiles = [];
    this.bossActivated = false; this.freezeFrame = 0;
    this.gameState = STATE.PLAYING;
  }

  _respawnAtBonfire() {
    this.player.respawn();
    // Reset non-boss enemies
    for (const e of this.enemies) e.reset();
    // Reset boss if not dead
    if (!this.boss.dead && this.bossActivated) {
      this.boss = new Boss(this.level.bossSpawn.x, this.level.bossSpawn.y);
      this.bossActivated = false;
    }
    this.projectiles = []; this.particles.clear();
    this.camera.x = this.player.x - CANVAS_W / (2 * CAMERA_ZOOM); this.camera.y = this.player.y - CANVAS_H / (2 * CAMERA_ZOOM);
    this.gameState = STATE.PLAYING;
  }

  _loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp; this.time += dt;
    this.input.update();

    if (this.freezeFrame > 0) { this.freezeFrame -= dt; requestAnimationFrame(t => this._loop(t)); return; }

    this._update(dt);
    this._draw(dt);
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    switch (this.gameState) {
      case STATE.TITLE:
        this.titleScreen.update(dt);
        if (this.input.anyKey()) { this.audio.init(); this._initLevel(); }
        break;
      case STATE.PLAYING:
        this._updatePlaying(dt);
        if (this.input.helpPressed()) this.showHelp = !this.showHelp;
        if (this.input.pausePressed()) {
          if (this.showHelp) {
            this.showHelp = false;
          } else {
            this.rebindReturnState = STATE.PLAYING;
            this.gameState = STATE.REBIND;
            this.rebindMenu = new RebindMenu(this.keyBindings);
          }
        }
        break;
      case STATE.DEAD:
        this.particles.update(dt);
        if (this.input.restartPressed()) this._respawnAtBonfire();
        break;
      case STATE.WIN:
        this.particles.update(dt);
        if (this.input.restartPressed()) this._initLevel();
        break;
      case STATE.BONFIRE:
        this._updateBonfire(dt);
        break;
      case STATE.REBIND:
        this._updateRebind(dt);
        break;
    }
  }

  _updateBonfire(dt) {
    this.particles.update(dt);
    for (const b of this.bonfires) b.update(dt, this.particles);

    const confirmed = this.bonfireMenu.update(this.input);
    if (confirmed) {
      const sel = this.bonfireMenu.getSelection();
      if (sel.type === 'weapon') {
        // Switch weapon
        if (this.player.switchWeapon(sel.index)) {
          this.audio.weaponSwitch();
          this.hud.showWeaponSwitch(WEAPONS[sel.index].name);
        }
        this.bonfireMenu.weaponSub = false;
        this.bonfireMenu.selectedIndex = 1;
      } else {
        switch (sel.index) {
          case 0: // Rest & Heal
            this.player.hp = this.player.maxHp;
            this.player.spellCooldowns = [0, 0, 0];
            this.audio.heal();
            // Respawn enemies
            for (const e of this.enemies) e.reset();
            if (!this.boss.dead && this.bossActivated) {
              this.boss = new Boss(this.level.bossSpawn.x, this.level.bossSpawn.y);
              this.bossActivated = false;
            }
            this.gameState = STATE.PLAYING;
            break;
          case 1: // Switch weapon
            this.bonfireMenu.weaponSub = true;
            this.bonfireMenu.selectedIndex = this.player.weaponIndex;
            break;
          case 2: // Rebind
            this.rebindReturnState = STATE.BONFIRE;
            this.gameState = STATE.REBIND;
            this.rebindMenu = new RebindMenu(this.keyBindings);
            break;
          case 3: // Leave
            this.gameState = STATE.PLAYING;
            break;
        }
      }
    }
    // ESC to leave bonfire / weapon sub
    if (this.input.pausePressed()) {
      if (this.bonfireMenu.weaponSub) {
        this.bonfireMenu.weaponSub = false;
        this.bonfireMenu.selectedIndex = 1;
      } else {
        this.gameState = STATE.PLAYING;
      }
    }
  }

  _updateRebind(dt) {
    const shouldExit = this.rebindMenu.update(this.input);
    if (shouldExit) {
      this.gameState = this.rebindReturnState || STATE.PLAYING;
      this.rebindReturnState = STATE.PLAYING;
    }
  }

  _updatePlaying(dt) {
    this.level.gateClosed = (this.bossActivated && !this.boss.dead);

    // Moving platforms (update position and carry player)
    for (const p of this.level.platforms) {
      if (p.type === 'moving') {
        const prevX = p.x, prevY = p.y;
        p.t += dt;
        p.x = p.ox + Math.sin(p.t * p.speed / 50) * (p.mx || 0);
        p.y = p.oy + Math.sin(p.t * p.speed / 50) * (p.my || 0);
        const pdx = p.x - prevX;
        const pdy = p.y - prevY;
        if (dt > 0.0001) {
          p.pvx = pdx / dt;
          p.pvy = pdy / dt;
        }
        // Seamlessly carry player with the platform
        if (this.player.ridingPlatform === p) {
          this.player.x += pdx;
          this.player.y += pdy;
        }
      }
    }

    // Player
    this.player.update(dt, this.input, this.level, this.particles, this.camera, this.audio);

    // Weapon switching
    for (let i = 1; i <= 4; i++) { if (this.input.weapon(i) && this.player.switchWeapon(i - 1)) { this.audio.weaponSwitch(); this.hud.showWeaponSwitch(WEAPONS[i - 1].name); } }
    if (this.input.weaponNext() && this.player.nextWeapon()) { this.audio.weaponSwitch(); this.hud.showWeaponSwitch(this.player.weapon.name); }

    // Spells
    if (this.input.spell1Pressed()) this.player.castSpell(0, this.projectiles, this.particles, this.audio, this.camera);
    if (this.input.spell2Pressed()) this.player.castSpell(1, this.projectiles, this.particles, this.audio, this.camera);
    if (this.input.spell3Pressed()) this.player.castSpell(2, this.projectiles, this.particles, this.audio, this.camera);

    // Ice Nova AoE check
    if (this.input._wasPressed('spell2') && this.player.spellCooldowns[1] > SPELLS[1].cooldown - 0.1) {
      // Just cast - do AoE
      const novaRange = 100;
      const pcx = this.player.x + this.player.w / 2, pcy = this.player.y + this.player.h / 2;
      for (const e of this.enemies) {
        if (!e.dead) {
          const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
          if (Math.hypot(ecx - pcx, ecy - pcy) < novaRange) {
            e.takeDamage(2, pcx < ecx ? 1 : -1, this.particles, this.camera, this.audio);
            if (e.dead) this.player.soul = Math.min(this.player.soul + 15, this.player.maxSoul);
          }
        }
      }
      if (this.boss.active && !this.boss.dead) {
        const bcx = this.boss.x + this.boss.w / 2, bcy = this.boss.y + this.boss.h / 2;
        if (Math.hypot(bcx - pcx, bcy - pcy) < novaRange) {
          this.boss.takeDamage(2, pcx < bcx ? 1 : -1, this.particles, this.camera, this.audio);
        }
      }
    }

    // Enemies
    for (const e of this.enemies) { if (!e.dead) e.update(dt, this.player, this.level, this.particles, this.projectiles, this.audio); }
    // Boss (punish healing if player tries to heal in sight)
    if (this.boss.active && !this.boss.dead && this.player.soul >= this.player.healCost && this.input.healPressed() && this.boss.phase === 2) {
      if (this.boss.state === 'idle' || this.boss.state === 'walk') {
        this.boss.state = 'shadow_blink';
        this.boss.stateTimer = 0.2;
        this.particles.deathBurst(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2);
      }
    }
    this.boss.update(dt, this.player, this.level, this.particles, this.camera, this.audio, this.projectiles);
    // Boss trigger
    if (!this.bossActivated && !this.boss.dead) {
      const t = this.level.bossTrigger, pb = this.player.getBounds();
      if (rectsOverlap(pb, t)) {
        this.bossActivated = true;
        this.level.gateClosed = true;
        this.boss.activate(this.level.bossArena, this.audio);
        this.camera.shake(8, 0.5);
      }
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt, this.level, this.particles);
      if (proj.dead) { this.projectiles.splice(i, 1); continue; }

      // Deflect enemy projectile with Nail attack! (Hollow Knight deflect)
      if (proj.owner === 'enemy' && this.player.attacking && this.player.attackHitbox) {
        if (rectsOverlap(this.player.attackHitbox, proj.getBounds())) {
          if (proj.type === 'acid_spit') {
            proj.owner = 'player';
            proj.reflected = true;
            proj.vx = -proj.vx * 1.35;
            proj.damage = 3;
            this.audio.nailHit();
            this.camera.shake(3, 0.08);
            this.particles.sparks(proj.x, proj.y);
            // POGO bounce if down-slashing on projectile!
            if (this.player.attackDir === 'down' && !this.player.onGround) {
              this.player.vy = this.player.jumpForce * 1.0;
              this.player.jumpsLeft = this.player.maxJumps - 1;
              this.player.coyoteTime = 0.15;
              this.player.dashCooldown = 0;
              this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.08);
              this.player.attacking = false;
              this.player.downSlashVisualTimer = 0.20;
              this.player.downSlashVisualDur = 0.20;
              this.player.attackCooldown = 0.26;
              this.player.attackHitbox = null;
              this.audio.pogo();
              this.particles.pogoSparks(this.player.x + this.player.w / 2, this.player.y + this.player.h);
              this.camera.shake(4, 0.1);
            }
            continue;
          }
        }
      }

      // Hit player (enemy projectiles)
      if (proj.owner === 'enemy') {
        if (rectsOverlap(proj.getBounds(), this.player.getBounds())) {
          this.player.takeDamage(proj.damage, proj.vx > 0 ? 1 : -1, this.particles, this.camera, this.audio);
          proj.dead = true;
          this.particles.sparks(proj.x, proj.y);
          continue;
        }
      }

      // Hit enemies (player or reflected projectiles)
      if (proj.owner === 'player') {
        for (const e of this.enemies) {
          if (!e.dead && rectsOverlap(proj.getBounds(), e.getBounds())) {
            e.takeDamage(proj.damage, proj.vx > 0 ? 1 : -1, this.particles, this.camera, this.audio, true);
            if (e.dead) this.player.soul = Math.min(this.player.soul + 15, this.player.maxSoul);
            proj.dead = true;
            this.particles.sparks(proj.x, proj.y);
            break;
          }
        }
        if (!proj.dead && this.boss.active && !this.boss.dead && rectsOverlap(proj.getBounds(), this.boss.getBounds())) {
          this.boss.takeDamage(proj.damage, proj.vx > 0 ? 1 : -1, this.particles, this.camera, this.audio);
          proj.dead = true;
          this.particles.sparks(proj.x, proj.y);
          if (this.boss.dead) { this.player.soul = this.player.maxSoul; setTimeout(() => { this.gameState = STATE.WIN; }, 1500); }
        }
      }
    }

    // Player attack vs enemies (Hollow Knight combat)
    if (this.player.attacking && this.player.attackHitbox) {
      const wpn = this.player.weapon;
      const p = this.player;
      const hitTargets = (target, isBoss) => {
        if (!p.attackHitbox || target.dead || p.hasHitThisSwing.has(target)) return;
        if (!rectsOverlap(p.attackHitbox, target.getBounds ? target.getBounds() : target)) return;

        // Hit confirmed!
        const knockDir = p.attackDir === 'side' ? p.facing : (p.x + p.w / 2 < target.x + target.w / 2 ? 1 : -1);
        const attackFromY = p.attackDir === 'down' ? -9999 : (p.y + p.h);
        const dmg = (isBoss && p.attackDir === 'down')
          ? Math.max(1, Math.floor(wpn.damage * 0.6))
          : wpn.damage;
        const didDamage = target.takeDamage(dmg, knockDir, this.particles, this.camera, this.audio, false, attackFromY);
        p.hasHitThisSwing.add(target);

        // Hollow Knight hit feedback
        this.audio.nailHit();
        this.freezeFrame = isBoss ? 0.07 : 0.05;
        this.camera.shake(isBoss ? 7 : 5, 0.12);

        // Directional recoil (Hollow Knight style)
        const hitX = (p.x + p.w / 2 + target.x + target.w / 2) / 2;
        const hitY = (p.y + p.h / 2 + target.y + target.h / 2) / 2;

        if (p.attackDir === 'down' && !p.onGround) {
          // POGO BOUNCE! (Hollow Knight signature mechanic)
          // Always trigger energetic pogo bounce on downwards hit, even if shield blocked!
          p.vy = p.jumpForce * 0.95;
          p.y = Math.min(p.y, target.y - p.h - 8);
          p.jumpsLeft = p.maxJumps - 1; // Refresh double jump on pogo!
          p.coyoteTime = 0.15;
          p.dashCooldown = 0; // Refresh dash on pogo!
          p.invulnTimer = Math.max(p.invulnTimer, 0.08); // brief safety window
          p.attacking = false;
          p.downSlashVisualTimer = 0.20;
          p.downSlashVisualDur = 0.20;
          p.attackCooldown = 0.26; // Requires timing each bounce at apex, prevents spamming
          p.attackHitbox = null;
          this.audio.pogo();
          this.particles.pogoSparks(p.x + p.w / 2, p.y + p.h);
          this.camera.shake(isBoss ? 6 : 4, 0.1);

          // Boss anti-pogo balance & countermeasure
          if (isBoss) {
            target.pogoHitsAgainst = (target.pogoHitsAgainst || 0) + 1;
            target.pogoDecayTimer = 1.2;
            if (target.pogoHitsAgainst >= 2 && !target.phaseTransition && target.state !== 'roar') {
              // Boss blinks out to prevent infinite head pogo cheese
              target.pogoHitsAgainst = 0;
              target.state = 'shadow_blink_dissolve';
              target.stateTimer = 0.12;
              target.stateMaxTimer = 0.12;
              if (this.audio && this.audio.shadowBolt) this.audio.shadowBolt();
              if (this.particles) this.particles.deathBurst(target.x + target.w / 2, target.y + target.h / 2);
            }
          }
        } else if (didDamage === false) {
          // Blocked by shield on horizontal hit: recoil player without soul gain
          p.recoilVx = -p.facing * 200;
          p.recoilTimer = 0.09;
          return;
        } else if (p.attackDir === 'up') {
          p.vy = Math.max(p.vy, 80); // slight push down
          this.particles.nailSlash(hitX, hitY, 1, -Math.PI / 2);
        } else {
          // Side recoil (get pushed back slightly)
          p.recoilVx = -p.facing * 180;
          p.recoilTimer = 0.08;
          this.particles.nailSlash(hitX, hitY, p.facing, 0);
        }

        if (didDamage !== false) {
          // Soul gain on hit (Hollow Knight: soul on every hit, not just kills)
          p.soul = Math.min(p.soul + p.soulPerHit, p.maxSoul);
          if (target.dead) p.soul = Math.min(p.soul + 10, p.maxSoul); // bonus on kill
        }

        if (isBoss && target.dead) {
          p.soul = p.maxSoul;
          setTimeout(() => { this.gameState = STATE.WIN; }, 1500);
        }
      };

      for (const e of this.enemies) {
        if (!this.player.attacking || !this.player.attackHitbox) break;
        hitTargets(e, false);
      }
      if (this.boss.active && !this.boss.dead && this.player.attacking && this.player.attackHitbox) {
        hitTargets(this.boss, true);
      }
    }

    // Enemy contact damage
    for (const e of this.enemies) {
      if (!e.dead && rectsOverlap(this.player.getBounds(), e.getBounds())) {
        this.player.takeDamage(e.damage, this.player.x < e.x ? -1 : 1, this.particles, this.camera, this.audio);
      }
      if (e.attackHitbox && !e.dead && rectsOverlap(this.player.getBounds(), e.attackHitbox)) {
        this.player.takeDamage(e.damage, this.player.x < e.x ? -1 : 1, this.particles, this.camera, this.audio);
      }
    }

    // Boss damage
    if (this.boss.active && !this.boss.dead) {
      if (rectsOverlap(this.player.getBounds(), this.boss.getBounds())) {
        this.player.takeDamage(1, this.player.x < this.boss.x ? -1 : 1, this.particles, this.camera, this.audio);
      }
      if (this.boss.attackHitbox && rectsOverlap(this.player.getBounds(), this.boss.attackHitbox)) {
        this.player.takeDamage(2, this.player.x < this.boss.x ? -1 : 1, this.particles, this.camera, this.audio);
        this.camera.shake(10, 0.3);
      }
      for (const sw of this.boss.shockwaves) {
        const swb = { x: sw.x - sw.w / 2, y: sw.y, w: sw.w, h: sw.h };
        if (rectsOverlap(this.player.getBounds(), swb)) {
          this.player.takeDamage(1, sw.vx > 0 ? 1 : -1, this.particles, this.camera, this.audio);
        }
      }
    }

    // Bonfires
    for (const b of this.bonfires) {
      b.update(dt, this.particles);
      if (b.isPlayerNear(this.player)) {
        b._showPrompt = true;
        if (this.input.interactPressed()) {
          b.lit = true;
          this.player.respawnX = b.x; this.player.respawnY = b.y - 10;
          this.player.lastBonfireId = b.id;
          this.currentBonfire = b;
          this.audio.bonfire();
          this.bonfireMenu = new BonfireMenu(this.keyBindings);
          this.bonfireMenu.alpha = 0;
          this.gameState = STATE.BONFIRE;
        }
      }
    }

    // Player death
    if (this.player.dead && this.player.deathTimer > 0.5) this.gameState = STATE.DEAD;

    // Boss phase 2 minions
    if (this.boss.phase === 2 && !this.boss.spawnedMinions && !this.boss.phaseTransition && this.boss.active && !this.boss.dead) {
      this.boss.spawnedMinions = true;
      const ar = this.level.bossArena;
      this.enemies.push(new Enemy(ar.x + 180, ar.y + ar.h - 64, 'crawler', 150));
      this.enemies.push(new Enemy(ar.x + ar.w - 180, ar.y + ar.h - 64, 'crawler', 150));
    }

    this.particles.update(dt);
    this.camera.follow(this.player, dt);
  }

  _draw(dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (this.gameState === STATE.TITLE) { this.titleScreen.draw(ctx, this.keyBindings); return; }

    this.background.draw(ctx, this.camera, this.time);

    ctx.save();
    this.camera.apply(ctx);

    // Platforms
    for (const p of this.level.platforms) {
      if (p.type === 'oneway') {
        ctx.fillStyle = '#333355'; ctx.fillRect(p.x, p.y, p.w, 6);
        ctx.fillStyle = '#444466';
        for (let dx = 4; dx < p.w; dx += 12) ctx.fillRect(p.x + dx, p.y + 2, 2, 2);
      } else if (p.type === 'moving') {
        ctx.fillStyle = '#335566'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#447788'; ctx.fillRect(p.x + 4, p.y + 2, p.w - 8, 3);
        ctx.strokeStyle = '#44556655'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x + p.w / 2, p.y); ctx.lineTo(p.x + p.w / 2, p.y - 60); ctx.stroke();
      } else if (p.isGate) {
        if (this.level.gateClosed) {
          // Closed Fog Gate / Boss barrier
          const pulse = Math.sin(this.time * 6) * 0.15 + 0.85;
          ctx.fillStyle = `rgba(130, 30, 200, ${0.7 * pulse})`;
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.strokeStyle = '#d588ff';
          ctx.lineWidth = 2;
          ctx.strokeRect(p.x, p.y, p.w, p.h);
          // Dark runes in fog
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px monospace';
          ctx.fillText('✦', p.x + p.w / 2 - 6, p.y + p.h / 2 - 25);
          ctx.fillText('✦', p.x + p.w / 2 - 6, p.y + p.h / 2 + 25);
        } else {
          // Open archway: open passage, slight mist on floor
          ctx.fillStyle = '#22223a';
          ctx.fillRect(p.x, p.y, 8, p.h);
          ctx.fillRect(p.x + p.w - 8, p.y, 8, p.h);
          ctx.fillStyle = 'rgba(100, 60, 160, 0.25)';
          ctx.fillRect(p.x + 8, p.y + p.h - 10, p.w - 16, 10);
        }
      } else {
        ctx.fillStyle = '#222244'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#333366'; ctx.fillRect(p.x, p.y, p.w, 4);
        ctx.fillStyle = '#2a2a50';
        for (let dx = 8; dx < p.w - 8; dx += 20) ctx.fillRect(p.x + dx, p.y + 6, 8, 3);
        ctx.fillStyle = '#1a1a33'; ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
      }
    }

    // Environmental detail
    ctx.fillStyle = '#334466';
    for (const p of this.level.platforms) {
      if (p.type !== 'solid' || p.h < 40 || p.isGate) continue;
      for (let dx = 10; dx < p.w; dx += rand(30, 60)) {
        ctx.beginPath(); ctx.moveTo(p.x + dx, p.y); ctx.lineTo(p.x + dx - 3, p.y - 8); ctx.lineTo(p.x + dx + 2, p.y); ctx.fill();
        ctx.beginPath(); ctx.moveTo(p.x + dx + 5, p.y); ctx.lineTo(p.x + dx + 7, p.y - 10); ctx.lineTo(p.x + dx + 10, p.y); ctx.fill();
      }
    }
    // Boss arena chains
    ctx.strokeStyle = '#333355'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const cx = 5300 + i * 130, len = 40 + Math.sin(i * 1.5) * 20;
      ctx.beginPath(); ctx.moveTo(cx, 220); ctx.lineTo(cx, 220 + len); ctx.stroke();
      ctx.fillStyle = '#444466'; ctx.fillRect(cx - 3, 220 + len, 6, 6);
    }

    // Bonfires
    for (const b of this.bonfires) b.draw(ctx);

    // Enemies
    for (const e of this.enemies) e.draw(ctx);
    // Boss
    this.boss.draw(ctx);
    // Player
    this.player.draw(ctx);
    // Projectiles
    for (const p of this.projectiles) p.draw(ctx);
    // Particles
    this.particles.draw(ctx);

    ctx.restore();

    // HUD
    this.hud.draw(ctx, this.player, this.boss, this.gameState, dt);

    // Bonfire menu
    if (this.gameState === STATE.BONFIRE) this.bonfireMenu.draw(ctx, this.player);

    // Rebind menu
    if (this.gameState === STATE.REBIND) this.rebindMenu.draw(ctx);

    // Help overlay
    if (this.showHelp && this.gameState === STATE.PLAYING) this._drawHelp(ctx);
  }

  _drawHelp(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(CANVAS_W / 2 - 250, 50, 500, 490);
    ctx.strokeStyle = '#556677'; ctx.strokeRect(CANVAS_W / 2 - 250, 50, 500, 490);
    ctx.fillStyle = '#aabbcc'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
    ctx.fillText('CONTROLS & COMBAT', CANVAS_W / 2, 85);

    ctx.font = '13px monospace';
    const hk = this.keyBindings.getKeyLabel.bind(this.keyBindings);
    const gk = (a) => this.keyBindings.getKeys(a).map(k => hk(k)).slice(0, 2).join('/');
    const lines = [
      [gk('moveLeft') + ' / ' + gk('moveRight'), 'Move'],
      [gk('jump'), 'Jump / Double Jump'],
      [gk('attack') + ' / Click', 'Nail Attack (Side)'],
      ['W / ↑ + Attack', 'Slash Up'],
      ['S / ↓ + Attack (Air)', 'Pogo Bounce (Down)'],
      [gk('dash'), 'Dodge Roll / Dash (i-frames!)'],
      [gk('heal'), 'Heal (costs Soul)'],
      [gk('interact'), 'Interact (Bonfires)'],
      ['1/2/3', 'Cast Spells'],
      [gk('weaponNext'), 'Switch Weapon'],
      ['7/8/9/0', 'Direct Weapon Select'],
      ['ESC', 'Rebind Keys'],
      [gk('help'), 'Toggle Help'],
      ['', ''],
      ['TACTICS & SECRETS:', ''],
      ['', 'Dash through attacks with i-frames!'],
      ['', 'Hit enemy spit with Nail to deflect it!'],
      ['', 'Roll behind Shield Guards or Pogo!'],
      ['', 'Spells break guard stance & stun!'],
      ['', 'Beware: Boss punishes heals in Phase 2!'],
    ];
    for (let i = 0; i < lines.length; i++) {
      ctx.textAlign = 'right'; ctx.fillStyle = '#66aacc';
      ctx.fillText(lines[i][0], CANVAS_W / 2 - 10, 115 + i * 21);
      ctx.textAlign = 'left'; ctx.fillStyle = '#8899aa';
      ctx.fillText(lines[i][1], CANVAS_W / 2 + 10, 115 + i * 21);
    }
    ctx.textAlign = 'left';
  }
}

// ============================================================================
// START
// ============================================================================
window.addEventListener('load', () => { new Game(); });
