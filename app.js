// ============================================================================
// ABYSSAL KNIGHT — 2D Action Platformer (Expanded Edition)
// Spells, Bonfires, Multiple Weapons, Key Rebinding, Smooth Camera
// Pure vanilla JS + HTML5 Canvas — no dependencies
// ============================================================================
'use strict';

const CANVAS_W = 1280, CANVAS_H = 720;
const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const CAMERA_ZOOM = 1.65; // Hollow Knight style close-up
const TILE = 40;
const GRAVITY = 1800;
const TERMINAL_VEL = 900;
const STATE = { TITLE: 0, PLAYING: 1, DEAD: 2, WIN: 3, BONFIRE: 4, REBIND: 5 };
const ASSET_VERSION = 'v=1.0.2';

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
  jump: ['ArrowUp', 'KeyW', 'Space', 'KeyZ'],
  attack: ['KeyX', 'KeyJ'],
  dash: ['ControlLeft', 'ControlRight', 'ShiftLeft', 'KeyK'],
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
      const saved = localStorage.getItem('abyssalKnightBindings_v2');
      if (saved) {
        this.bindings = { ...JSON.parse(JSON.stringify(DEFAULT_BINDINGS)), ...JSON.parse(saved) };
        return;
      }
    } catch (e) { }
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }
  save() {
    try { localStorage.setItem('abyssalKnightBindings_v2', JSON.stringify(this.bindings)); } catch (e) { }
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
      spell1: 'Spell: Pyre Blast', spell2: 'Spell: Frost Nova', spell3: 'Spell: Singularity',
      weapon1: 'Weapon 1', weapon2: 'Weapon 2', weapon3: 'Weapon 3', weapon4: 'Weapon 4',
      weaponNext: 'Next Weapon', pause: 'Pause', help: 'Help', restart: 'Restart',
    };
    return labels[action] || action;
  }
  getKeyLabel(code) {
    const map = {
      ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
      Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift',
      ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt',
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
    this.masterVolume = 1.0;
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
      footstep1: 'assets/sounds/footstep_1.wav',
      footstep2: 'assets/sounds/footstep_2.wav',
      land: 'assets/sounds/land.wav',
      fireballHit: 'assets/sounds/fireball_hit.wav',
      iceShatter: 'assets/sounds/ice_shatter.wav',
      voidVortex: 'assets/sounds/void_vortex.wav',
      voidImplode: 'assets/sounds/void_implode.wav',
      bonfireLit: 'assets/sounds/bonfire_lit.wav',
      gargoyleSpit: 'assets/sounds/gargoyle_spit.wav',
    };

    // Background Music Tracks
    this.musicTracks = {
      level: 'MUS_Ambient_ForgottenSouls.mp3',
      boss: 'short_The Enchanting Haunted Ballroom.mp3',
    };
    this.musicElements = {};
    this.currentMusicKey = null;
    this.targetMusicKey = null;
    this.musicVolumes = { level: 0, boss: 0 };
    this.musicTargets = { level: 0, boss: 0 };
    this.maxMusicVolumes = { level: 0.16, boss: 0.22 };
    this.musicCrossfadeSpeed = 0.9;
    this.musicStarted = false;

    if (typeof window !== 'undefined' && window.addEventListener) {
      const unlockAudio = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        if (this.targetMusicKey) {
          const el = this._getMusicElement(this.targetMusicKey);
          if (el && el.paused) {
            el.play().catch(() => {});
          }
        }
      };
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
    }

    this.preload();
  }

  _getMusicElement(key) {
    if (typeof Audio === 'undefined') return null;
    if (!this.musicElements[key] && this.musicTracks[key]) {
      try {
        const baseSrc = this.musicTracks[key];
        const v = typeof ASSET_VERSION !== 'undefined' ? ASSET_VERSION : 'v=1.0.2';
        const src = baseSrc + (baseSrc.includes('?') ? '&' : '?') + v;
        const audio = new Audio(src);
        audio.loop = true;
        audio.volume = 0;
        audio.preload = 'auto';
        this.musicElements[key] = audio;
      } catch (e) {
        // Safe fallback
      }
    }
    return this.musicElements[key];
  }

  playLevelMusic() {
    this.switchMusic('level');
  }

  playBossMusic() {
    this.switchMusic('boss');
  }

  stopMusic() {
    this.switchMusic(null);
  }

  switchMusic(key) {
    if (!this.enabled) return;
    this.targetMusicKey = key;
    this.musicStarted = true;

    if (key) {
      const el = this._getMusicElement(key);
      if (el) {
        if (el.paused) {
          el.play().catch(() => {});
        }
      }
      this.musicTargets[key] = this.maxMusicVolumes[key] || 0.18;
    }

    for (const k of Object.keys(this.musicTracks)) {
      if (k !== key) {
        this.musicTargets[k] = 0;
      }
    }
  }

  update(dt = 0.016) {
    if (!this.enabled || !this.musicStarted) return;
    for (const [k, el] of Object.entries(this.musicElements)) {
      if (!el) continue;
      const target = this.musicTargets[k] || 0;
      let cur = this.musicVolumes[k] || 0;
      if (Math.abs(cur - target) > 0.005) {
        cur = lerp(cur, target, Math.min(1.0, this.musicCrossfadeSpeed * 2.5 * dt));
        this.musicVolumes[k] = cur;
        try {
          el.volume = clamp(cur, 0, 1);
        } catch (e) {}
      } else {
        cur = target;
        this.musicVolumes[k] = cur;
        try {
          el.volume = clamp(cur, 0, 1);
          if (cur <= 0.005 && !el.paused) {
            el.pause();
            if (k === 'boss') {
              el.currentTime = 0; // Rewind boss music for dramatic intro
            }
          }
        } catch (e) {}
      }
    }
  }

  preload() {
    try {
      if (typeof window !== 'undefined' && !this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = 0.35;
          this.masterGain.connect(this.ctx.destination);
        }
      }
      this.loadSounds();
      // Preload music elements
      this._getMusicElement('level');
      this._getMusicElement('boss');
    } catch (e) {
      console.warn('AudioContext preloading skipped:', e);
    }
  }

  init() {
    try {
      if (typeof window !== 'undefined' && !this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = 0.35;
          this.masterGain.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (!this.loaded && !this.loading) {
        this.loadSounds();
      }
      if (this.targetMusicKey) {
        const el = this._getMusicElement(this.targetMusicKey);
        if (el && el.paused) {
          el.play().catch(() => {});
        }
      }
    } catch (e) {
      this.enabled = false;
    }
  }

  async loadSounds() {
    if (!this.ctx || this.loading || this.loaded) return;
    this.loading = true;
    const entries = Object.entries(this.soundPaths);
    const v = typeof ASSET_VERSION !== 'undefined' ? ASSET_VERSION : 'v=1.0.2';
    await Promise.all(entries.map(async ([key, url]) => {
      try {
        const versionedUrl = url + (url.includes('?') ? '&' : '?') + v;
        const resp = await fetch(versionedUrl);
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

  setMasterVolume(vol) {
    this.masterVolume = clamp(vol, 0.0, 1.0);
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(this.masterVolume * 0.35, this.ctx.currentTime);
      } catch (e) {}
    }
  }

  playSynthTone(freq, dur = 0.1, type = 'sine', vol = 0.3) {
    if (!this.enabled || !this.ctx) return;
    this._tone(freq, freq * 0.8, type, dur, vol);
  }

  playSample(name, vol = 1.0, pitchVariation = 0.08) {
    if (!this.enabled || !name || !this.ctx) return false;
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
    if (!this.enabled) return;
    if (!this.playSample('swing', 0.85, 0.08)) {
      this._tone(300, 100, 'sawtooth', 0.08, 0.3);
    }
  }
  heavySwing() {
    if (!this.enabled) return;
    if (!this.playSample('heavySwing', 1.1, 0.06)) {
      this._tone(200, 50, 'sawtooth', 0.14, 0.4);
    }
  }
  quickSwing() {
    if (!this.enabled) return;
    if (!this.playSample('quickSwing', 0.8, 0.09)) {
      this._tone(500, 200, 'sawtooth', 0.05, 0.25);
    }
  }
  hit() {
    if (!this.enabled) return;
    if (!this.playSample('hit', 1.15, 0.07)) {
      this._noise(0.12, 0.5, 2);
    }
  }
  dash() {
    if (!this.enabled) return;
    if (!this.playSample('dash', 0.85, 0.05)) {
      this._noise(0.15, 0.3, 1.5);
    }
  }
  dodgeRoll() {
    if (!this.enabled) return;
    if (!this.playSample('dodgeRoll', 0.85, 0.08)) {
      this._noise(0.18, 0.25, 1.2);
    }
  }
  dodgeSuccess() {
    if (!this.enabled) return;
    if (!this.playSample('dodgeSuccess', 0.9, 0.0)) {
      this._tone(600, 1100, 'sine', 0.2, 0.3);
    }
  }
  nailSlash() {
    if (!this.enabled) return;
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
    if (!this.enabled) return;
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
    if (!this.enabled) return;
    if (!this.playSample('pogo', 0.95, 0.04)) {
      this._tone(500, 900, 'sine', 0.12, 0.3);
    }
  }
  jump() {
    if (!this.enabled) return;
    if (!this.playSample('jump', 0.7, 0.06)) {
      this._tone(200, 500, 'square', 0.12, 0.15);
    }
  }
  doubleJump() {
    if (!this.enabled) return;
    if (!this.playSample('doubleJump', 0.85, 0.05)) {
      this._tone(350, 750, 'sine', 0.16, 0.25); this._noise(0.1, 0.15, 2);
    }
  }
  enemyDeath() {
    if (!this.enabled) return;
    if (!this.playSample('enemyDeath', 1.0, 0.07)) {
      this._tone(400, 60, 'square', 0.3, 0.25);
    }
  }
  playerHurt() {
    if (!this.enabled) return;
    if (!this.playSample('playerHurt', 1.25, 0.05)) {
      this._tone(300, 100, 'sawtooth', 0.2, 0.35);
    }
  }
  heal() {
    if (!this.enabled) return;
    if (!this.playSample('heal', 0.95, 0.0)) {
      this._tone(400, 800, 'sine', 0.3, 0.2);
    }
  }
  bossRoar() {
    if (!this.enabled) return;
    if (!this.playSample('bossRoar', 1.35, 0.03)) {
      this._play((ctx, dest) => {
        const dur = 1.2;
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
        o1.type = 'sawtooth'; o2.type = 'sine';
        o1.frequency.setValueAtTime(54, ctx.currentTime);
        o1.frequency.exponentialRampToValueAtTime(34, ctx.currentTime + dur);
        o2.frequency.setValueAtTime(36, ctx.currentTime);
        o2.frequency.exponentialRampToValueAtTime(22, ctx.currentTime + dur);
        g.gain.setValueAtTime(0.55, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o1.connect(g); o2.connect(g); g.connect(dest);
        o1.start(); o1.stop(ctx.currentTime + dur);
        o2.start(); o2.stop(ctx.currentTime + dur);
      });
      this._noise(0.65, 0.45, 1.8);
    }
  }
  fireball() {
    if (!this.enabled) return;
    if (!this.playSample('fireball', 0.9, 0.06)) {
      this._tone(200, 600, 'sawtooth', 0.2, 0.25);
    }
  }
  iceNova() {
    if (!this.enabled) return;
    if (!this.playSample('iceNova', 0.95, 0.05)) {
      this._tone(800, 200, 'sine', 0.35, 0.3);
    }
  }
  shadowBolt() {
    if (!this.enabled) return;
    if (!this.playSample('shadowBolt', 0.85, 0.06)) {
      this._tone(100, 400, 'square', 0.15, 0.3);
    }
  }
  bonfire() {
    if (!this.enabled) return;
    if (!this.playSample('bonfire', 0.9, 0.0)) {
      this._tone(300, 600, 'sine', 0.5, 0.15);
    }
  }
  weaponSwitch() {
    if (!this.enabled) return;
    if (!this.playSample('weaponSwitch', 0.8, 0.06)) {
      this._tone(600, 800, 'sine', 0.06, 0.1);
    }
  }
  bossTelegraph() {
    if (!this.enabled) return;
    if (!this.playSample('bossTelegraph', 0.95, 0.02)) {
      this._play((ctx, dest) => {
        const dur = 0.35;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(104, ctx.currentTime);
        o.frequency.linearRampToValueAtTime(120, ctx.currentTime + dur);
        g.gain.setValueAtTime(0.01, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.35, ctx.currentTime + dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
      });
      this._noise(0.2, 0.25, 2.0);
    }
  }
  bossThrustGlint() {
    if (!this.enabled) return;
    if (!this.playSample('bossThrustGlint', 0.95, 0.03)) {
      this._play((ctx, dest) => {
        const dur = 0.22;
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o2.type = 'triangle';
        o.frequency.setValueAtTime(1950, ctx.currentTime);
        o2.frequency.setValueAtTime(3240, ctx.currentTime);
        g.gain.setValueAtTime(0.35, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(g); o2.connect(g); g.connect(dest);
        o.start(); o.stop(ctx.currentTime + dur);
        o2.start(); o2.stop(ctx.currentTime + dur);
      });
      this._noise(0.12, 0.2, 3.5);
    }
  }
  bossVoidCharge() {
    if (!this.enabled) return;
    if (!this.playSample('bossVoidCharge', 1.05, 0.03)) {
      this._play((ctx, dest) => {
        const dur = 0.6;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(32, ctx.currentTime);
        o.frequency.linearRampToValueAtTime(56, ctx.currentTime + dur);
        g.gain.setValueAtTime(0.05, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.4, ctx.currentTime + dur * 0.85);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
      });
      this._noise(0.45, 0.35, 1.2);
    }
  }
  footstep() {
    if (!this.enabled) return;
    const name = Math.random() < 0.5 ? 'footstep1' : 'footstep2';
    if (!this.playSample(name, 0.65, 0.08)) {
      this._noise(0.04, 0.15, 3);
    }
  }
  land() {
    if (!this.enabled) return;
    if (!this.playSample('land', 0.8, 0.05)) {
      this._noise(0.08, 0.25, 2);
    }
  }
  fireballHit() {
    if (!this.enabled) return;
    if (!this.playSample('fireballHit', 1.05, 0.05)) {
      this._play((ctx, dest) => {
        const dur = 0.25;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(140, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + dur);
        g.gain.setValueAtTime(0.4, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
      });
      this._noise(0.2, 0.35, 1.8);
    }
  }
  iceShatter() {
    if (!this.enabled) return;
    if (!this.playSample('iceShatter', 1.1, 0.07)) {
      this._play((ctx, dest) => {
        const dur = 0.18;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(1200, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + dur);
        g.gain.setValueAtTime(0.35, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
      });
      this._noise(0.12, 0.3, 2.5);
    }
  }
  voidVortex() {
    if (!this.enabled) return;
    if (!this.playSample('voidVortex', 0.95, 0.04)) {
      this._tone(80, 240, 'sine', 0.4, 0.3);
    }
  }
  voidImplode() {
    if (!this.enabled) return;
    if (!this.playSample('voidImplode', 1.15, 0.04)) {
      this._play((ctx, dest) => {
        const dur = 0.3;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(60, ctx.currentTime);
        o.frequency.linearRampToValueAtTime(280, ctx.currentTime + dur * 0.4);
        o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + dur);
        g.gain.setValueAtTime(0.45, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur);
      });
      this._noise(0.25, 0.4, 2.0);
    }
  }
  bonfireLit() {
    if (!this.enabled) return;
    if (!this.playSample('bonfireLit', 1.0, 0.0)) {
      this._tone(220, 660, 'sine', 0.6, 0.35);
    }
  }
  gargoyleSpit() {
    if (!this.enabled) return;
    if (!this.playSample('gargoyleSpit', 1.0, 0.05)) {
      this._noise(0.16, 0.35, 1.8);
      this._tone(180, 90, 'sawtooth', 0.15, 0.25);
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
    this.pogoRing(x, y, '#66eeff');
  }
  pogoRing(x, y, color = '#66eeff') {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const s = rand(100, 160);
      this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s * 0.45, rand(0.16, 0.3), color, rand(2, 4), 0, false));
    }
  }
  guardBreakBurst(x, y) {
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2), s = rand(70, 230);
      const col = ['#fbbf24', '#f59e0b', '#ffffff', '#e2e8f0'][randInt(0, 3)];
      this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.7), col, rand(3, 6), 250, true));
    }
  }
  weaponImpactSparks(x, y, colors) {
    const pal = (colors && colors.length) ? colors : ['#ffffff', '#66eeff', '#0099dd'];
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2), s = rand(80, 260);
      const c = pal[randInt(0, pal.length - 1)];
      this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.12, 0.28), c, rand(2, 4), 160, true));
    }
  }
  stoneCrumble(x, y) {
    for (let i = 0; i < 20; i++) {
      const a = rand(0, Math.PI * 2), s = rand(60, 220);
      const col = ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'][randInt(0, 5)];
      this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s - 30, rand(0.35, 0.8), col, rand(3, 6), 360, true));
    }
    for (let i = 0; i < 8; i++) {
      this.add(new Particle(x + rand(-10, 10), y + rand(-10, 10), rand(-40, 40), rand(-50, -10), rand(0.2, 0.5), '#94a3b8', rand(2, 4), 180));
    }
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
const UNARMED_ATTACK = {
  id: -1,
  name: 'Unarmed',
  damage: 1,
  range: 30,
  height: 30,
  attackDur: 0.16,
  cooldown: 0.12,
  knockback: 100,
  color: '#8899aa',
  guardColor: '#667788',
  handleColor: '#443322',
  bladeW: 2, bladeL: 12,
  swingArc: 1.2,
  swingStart: -0.6,
  slashColors: ['#ffffff', '#88aacc', '#334466'],
  glowColor: '#6688aa',
  sound: 'swing',
};

const WEAPONS = [
  {
    id: 0,
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
    slashColors: ['#ffffff', '#66eeff', '#0099dd'],
    glowColor: '#00f0ff',
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
    slashColors: ['#ffffff', '#ff4444', '#990022'],
    glowColor: '#ff2244',
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
    slashColors: ['#ffffff', '#ffe066', '#d97706'],
    glowColor: '#ffbb22',
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
    slashColors: ['#ffffff', '#cc66ff', '#5b21b6'],
    glowColor: '#bb33ff',
    sound: 'swing',
  },
];

// ============================================================================
// SPELL DEFINITIONS
// ============================================================================
const SPELLS = [
  {
    name: 'Pyre Blast',
    soulCost: 25,
    cooldown: 1.0,
    radius: 80,
    range: 80,
    icon: '🔥',
    color: '#ff6622',
    glowColor: '#ff8833',
    desc: 'Launches an explosive fire artillery shell. Detonates on impact with enemies or solid platforms, shattering guard shields and dealing AoE splash damage.',
  },
  {
    name: 'Frost Nova',
    soulCost: 30,
    cooldown: 2.0,
    radius: 140,
    range: 140,
    icon: '❄',
    color: '#66ddff',
    glowColor: '#aae8ff',
    desc: 'Radial frost burst halting enemies solid for 2.0s and chilling the boss. Striking frozen enemies triggers a devastating Shatter bonus (+2 damage)!',
  },
  {
    name: 'Abyssal Singularity',
    soulCost: 20,
    cooldown: 1.0,
    radius: 160,
    range: 160,
    icon: '🌑',
    color: '#c084fc',
    glowColor: '#e9d5ff',
    desc: 'Slowly advancing void vortex that gravitationally sucks in nearby enemies, dealing tick damage before collapsing into a catastrophic implosion.',
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
    if (type === 'pyre_blast' || type === 'fireball') {
      this.w = 18; this.h = 18; this.life = 2.5;
      this.blastRadius = 80; this.splashDamage = 3;
    }
    if (type === 'void_vortex') {
      this.w = 24; this.h = 24; this.life = 2.4;
      this.pullRange = 160; this.pullForce = 750;
      this.tickInterval = 0.4; this.tickTimer = 0.4;
      this.implosionDamage = 2; this.blastRadius = 160;
    }
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
    if (this.type === 'pyre_blast' || this.type === 'fireball') {
      if (particles && particles.fireballTrail) particles.fireballTrail(this.x, this.y);
      else if (particles && particles.add && Math.random() < 0.6) {
        particles.add(new Particle(this.x + this.w / 2, this.y + this.h / 2, rand(-15, 15), rand(-15, 15), 0.22, '#ff6622', rand(3, 5), 0, true));
      }
    }
    if (this.type === 'void_vortex') {
      if (particles && particles.add && Math.random() < 0.7) {
        particles.add(new Particle(this.x + this.w / 2, this.y + this.h / 2, rand(-20, 20), rand(-20, 20), 0.28, '#c084fc', rand(3, 6), 0, true));
      }
    }
    if (this.type === 'shadowbolt' && particles && particles.shadowTrail) particles.shadowTrail(this.x, this.y);
    if (this.type === 'acid_spit') {
      if (Math.random() < 0.45) {
        particles.add(new Particle(this.x + this.w / 2, this.y + this.h / 2, rand(-15, 15), rand(-15, 15), 0.2, this.reflected ? '#38bdf8' : '#c084fc', rand(2, 4), 0, true));
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
    if (this.type === 'pyre_blast' || this.type === 'fireball') {
      ctx.shadowColor = '#ff6622';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff4400';
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffaa22';
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'void_vortex') {
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#090314';
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'shadowbolt') {
      ctx.fillStyle = '#8833cc';
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cc77ff';
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 3, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'acid_spit') {
      const px = this.x + this.w / 2, py = this.y + this.h / 2;
      const glow = this.reflected ? '#38bdf8' : '#a855f7';
      ctx.fillStyle = this.reflected ? '#00f0ff' : '#9333ea';
      ctx.shadowColor = glow;
      ctx.shadowBlur = 10;
      // Diamond stone shard
      ctx.beginPath();
      ctx.moveTo(px + 7, py);
      ctx.lineTo(px, py - 5);
      ctx.lineTo(px - 7, py);
      ctx.lineTo(px, py + 5);
      ctx.closePath();
      ctx.fill();
      // Weathered stone core
      ctx.fillStyle = this.reflected ? '#ffffff' : '#cbd5e1';
      ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
      ctx.shadowBlur = 0;
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
    ctx.save();

    // Ground rune circle etched in stone beneath the bonfire
    if (this.lit) {
      const runeAlpha = Math.sin(this.animTimer * 3) * 0.12 + 0.28;
      ctx.strokeStyle = `rgba(255, 170, 50, ${runeAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x + 15, y + 28, 38, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Mound of ancient charred stones & white bone fragments
    ctx.fillStyle = '#1c1f2b';
    ctx.beginPath();
    ctx.ellipse(x + 15, y + 26, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2b3040';
    for (let i = 0; i < 6; i++) {
      const bx = x + 3 + i * 4.5, by = y + 23 + (i % 2) * 3;
      ctx.fillRect(bx, by, 5, 4);
    }
    // Small white bone fragments
    ctx.fillStyle = '#dcdde8';
    ctx.fillRect(x + 5, y + 25, 4, 2);
    ctx.fillRect(x + 21, y + 24, 5, 2);

    // Coiled Sword (Dark Souls / Elden Ring tribute)
    // Pommel & Hilt
    ctx.fillStyle = '#8899aa';
    ctx.fillRect(x + 13.5, y - 16, 3, 4);
    ctx.fillStyle = '#556677';
    ctx.fillRect(x + 8, y - 12, 14, 3.5);
    // Twisted spiral blade plunged into the embers
    ctx.fillStyle = '#778899';
    ctx.fillRect(x + 13, y - 9, 4, 34);
    ctx.strokeStyle = '#aabbcc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 15, y - 9); ctx.lineTo(x + 15, y + 22);
    ctx.stroke();

    if (this.lit) {
      // Warm glowing radiant halo
      const flicker = Math.sin(this.animTimer * 9) * 0.15 + 0.85;
      ctx.save();
      ctx.globalAlpha = 0.28 * flicker;
      const grad = ctx.createRadialGradient(x + 15, y + 8, 4, x + 15, y + 8, 48);
      grad.addColorStop(0, '#ff9922');
      grad.addColorStop(0.5, '#ff5500');
      grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 40, y - 45, 110, 100);
      ctx.restore();

      // Multi-layer animated flames
      const flames = [
        { dx: 0, s: 1.1, sp: 11 },
        { dx: -6, s: 0.75, sp: 8 },
        { dx: 6, s: 0.85, sp: 13 }
      ];
      for (const f of flames) {
        const fh = (14 + Math.sin(this.animTimer * f.sp + f.dx) * 4) * f.s;
        // Outer flame tongue
        ctx.fillStyle = '#ff4411';
        ctx.beginPath();
        ctx.moveTo(x + 15 + f.dx - 6 * f.s, y + 8);
        ctx.quadraticCurveTo(x + 15 + f.dx - 3 * f.s, y + 8 - fh * 0.6, x + 15 + f.dx, y + 8 - fh);
        ctx.quadraticCurveTo(x + 15 + f.dx + 3 * f.s, y + 8 - fh * 0.6, x + 15 + f.dx + 6 * f.s, y + 8);
        ctx.fill();

        // Core flame tongue
        ctx.fillStyle = '#ffaa22';
        ctx.beginPath();
        const ih = fh * 0.65;
        ctx.moveTo(x + 15 + f.dx - 3.5 * f.s, y + 8);
        ctx.quadraticCurveTo(x + 15 + f.dx - 1.5 * f.s, y + 8 - ih * 0.6, x + 15 + f.dx, y + 8 - ih);
        ctx.quadraticCurveTo(x + 15 + f.dx + 1.5 * f.s, y + 8 - ih * 0.6, x + 15 + f.dx + 3.5 * f.s, y + 8);
        ctx.fill();

        // White-hot inner seed
        ctx.fillStyle = '#fff4cc';
        ctx.beginPath();
        ctx.arc(x + 15 + f.dx * 0.5, y + 6, 2.5 * f.s, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Unlit — faint smoldering embers
      ctx.fillStyle = '#442211';
      ctx.beginPath();
      ctx.arc(x + 15, y + 16, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(x + 14, y + 15, 2, 2);
    }

    // Interaction prompt
    if (this._showPrompt) {
      ctx.fillStyle = '#eedd88';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(this.lit ? '[F] REST AT BONFIRE' : '[F] LIGHT BONFIRE', x + 15, y - 26);
      ctx.textAlign = 'left';
      this._showPrompt = false;
    }
    ctx.restore();
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
  const props = [];
  const P = (x, y, w, h, type = 'solid') => platforms.push({ x, y, w, h, type, ox: x, oy: y });

  // Helpers for environmental props
  const addCrystal = (x, y, color = 'cyan', scale = 1) => props.push({ type: 'crystal', x, y, color, scale });
  const addLantern = (x, y, chainLen = 40, color = '#ffaa33') => props.push({ type: 'lantern', x, y, chainLen, color });
  const addWaterDrip = (x, y, groundY) => props.push({ type: 'waterDrip', x, y, groundY, timer: rand(0, 3) });
  const addArch = (x, y, w, h, style = 'gothic') => props.push({ type: 'arch', x, y, w, h, style });
  const addStreetlamp = (x, y, h = 55, color = '#ffaa33') => props.push({ type: 'streetlamp', x, y, h, color });
  const addGargoyle = (x, y, facing = 1, wings = 'spread') => props.push({ type: 'gargoyle', x, y, facing, wings });
  const addGothicWindow = (x, y, w = 32, h = 75, color = '#ffaa33', glow = true) => props.push({ type: 'gothicWindow', x, y, w, h, color, glow });
  const addChandelier = (x, y, w = 150, chainLen = 120) => props.push({ type: 'chandelier', x, y, w, chainLen });
  const addRoseWindow = (x, y, radius = 60, color = '#ff2255') => props.push({ type: 'roseWindow', x, y, radius, color });

  // ==========================================================================
  // ZONE 1: THE FORGOTTEN BASTION & HIGH VIADUCT (x: 0 - 1800, y: 480 - 1500)
  // ==========================================================================
  // Left level boundary fortress wall (extends to map floor y=1500)
  P(0, 200, 40, 1300);

  // Starting Bastion Rampart (Tier 2, y=880)
  // Starting Bastion Rampart terrace (x: 0..320 solid, x: 320..460 oneway overlook hatch)
  P(0, 880, 320, 80);
  P(320, 880, 140, 28, 'oneway');
  bonfires.push(new Bonfire(180, 850, 0)); // Starting Bonfire

  // Bastion props & overlook architecture
  addArch(180, 680, 180, 200, 'shrine');
  addRoseWindow(180, 620, 36, '#ffaa33');
  addGothicWindow(60, 640, 34, 75, '#ffaa33', true);
  addGothicWindow(60, 480, 34, 75, '#ff8833', true);
  addCrystal(80, 878, 'purple', 1.1); // Placed in the far left bastion corner away from tutorial tablets

  // Ancient carved tutorial tablets in Starting Bastion (placed in open spaces with 0 occluding decorations)
  props.push({ type: 'tutorialTablet', x: 250, y: 880, title: 'MOVEMENT', line1: '[← / →] Move', line2: '[↑] Jump' });
  props.push({ type: 'tutorialTablet', x: 390, y: 880, title: 'EVASION', line1: '[Ctrl] Dash', line2: 'i-frame roll' });
  props.push({ type: 'tutorialTablet', x: 560, y: 820, title: 'COMBAT', line1: '[X] Strike', line2: '[Air + ↓ + X] Pogo' });

  // Upper overlook balconies with perched gargoyles (located high above on ledges, never blocking ground tablets)
  P(180, 760, 160, 20, 'oneway');
  P(320, 640, 150, 20, 'oneway');
  addLantern(320, 640, 45, '#ffaa33');
  addGargoyle(180, 760, 1, 'spread');
  addGargoyle(330, 640, -1, 'spread');

  // Stone ramp step connecting Bastion terrace (y=880) to High Viaduct Bridge (y=820)
  P(440, 850, 60, 30);
  addStreetlamp(460, 850, 55, '#ffaa33'); // Illuminates the ascent step from bastion onto viaduct bridge

  // The Grand High Viaduct Bridge: continuous monumental roadway spanning to Gatehouse Watchtower!
  // Roadway deck at y=820, thickness 32px (bg_viaducts.png shows the arches below naturally)
  P(480, 820, 440, 32);
  P(920, 820, 460, 32);
  addStreetlamp(700, 820, 55, '#ffaa33');
  addStreetlamp(1150, 820, 55, '#ffaa33');
  addGargoyle(1280, 820, -1, 'folded');
  enemies.push({ type: 'crawler', x: 740, y: 790, patrolRange: 100 });
  enemies.push({ type: 'guard', x: 1060, y: 770 });

  // Sunken Mist Streets / Canals (Tier 1, y=1340)
  // Continuous architectural street platform spanning from left fortress wall to gatehouse
  P(40, 1340, 1740, 32);

  // Two-way ascending return parkour ledges under bastion (x: 80..460)
  P(80, 1220, 140, 20, 'oneway');
  P(200, 1100, 140, 20, 'oneway');
  P(320, 980, 140, 20, 'oneway');
  P(920, 1240, 140, 20, 'oneway');

  // Intermediate descent catwalks / inspection platforms
  P(580, 1020, 160, 20, 'oneway');
  P(900, 1140, 180, 20, 'oneway');

  addWaterDrip(700, 852, 1340);
  addWaterDrip(1150, 852, 1340);
  addCrystal(360, 1338, 'purple', 1.3);
  addCrystal(1000, 1338, 'cyan', 1.2);
  enemies.push({ type: 'crawler', x: 440, y: 1300, patrolRange: 140 });
  enemies.push({ type: 'guard', x: 820, y: 1290 });
  enemies.push({ type: 'crawler', x: 1240, y: 1300, patrolRange: 110 });

  // Gatehouse Watchtower (x: 1380 - 1756, vertical climbing shaft from y=1340 up to y=500)
  // High Viaduct Bridge (y=820) enters west tower wall through arched doorway (y=720..820)!
  // Sunken Canal (y=1340) enters tower base through gateway arch (y=1220..1340)!
  P(1380, 500, 36, 220); // Upper west wall (y=500..720)
  P(1380, 820, 36, 400); // Lower west wall (y=820..1220)
  P(1720, 500, 36, 840); // East fortress wall (y=500..1340)

  // Interior climbing ledges
  P(1420, 1180, 150, 20, 'oneway');
  P(1550, 1030, 150, 20, 'oneway');
  P(1420, 880, 150, 20, 'oneway');
  P(1550, 730, 150, 20, 'oneway');
  P(1420, 590, 160, 20, 'oneway');

  // Watchtower top roof terrace (with central oneway hatch so player can jump through onto the roof!)
  P(1340, 500, 80, 28);
  P(1420, 500, 280, 28, 'oneway');
  P(1700, 500, 80, 28);
  addGargoyle(1350, 500, -1, 'spread');
  addGargoyle(1770, 500, 1, 'spread');
  addStreetlamp(1440, 500, 55, '#ffaa33');

  // Radiant Ancient Altar with First Sword (Old Nail) on the Watchtower roof terrace
  const swordPickup = {
    x: 1560,
    y: 476,
    w: 28,
    h: 46,
    name: 'Old Nail',
    collected: false
  };

  // ==========================================================================
  // ZONE 2: THE SPIRES, BELFRY & HIGH VIADUCTS (x: 1800 - 3600, y: 320 - 1500)
  // ==========================================================================
  // --- Tier 3: High Slate Rooftops & Belfry Haven ---
  P(1880, 460, 200, 26);
  P(2140, 400, 180, 20, 'oneway');
  P(2380, 360, 220, 26);
  addGargoyle(2400, 360, -1, 'spread');
  addGargoyle(2580, 360, 1, 'folded');

  // Moving Gothic lift between spires
  platforms.push({ x: 2680, y: 360, w: 140, h: 22, type: 'moving', ox: 2680, oy: 360, mx: 180, my: 60, speed: 75, t: 0 });

  // Belfry approach landing ledge connecting moving lift arrival to tower entrance
  P(2920, 480, 80, 24, 'oneway');

  // Clocktower Belfry Haven (x: 2980 - 3460, y: 480)
  P(3000, 480, 440, 32); // Belfry floor
  P(2980, 240, 36, 120); // Left belfry tower pier (opens 120px tall doorway y=360..480)
  P(3404, 240, 36, 120); // Right belfry tower pier (opens 120px tall doorway y=360..480)
  P(2980, 240, 460, 32); // Overhead vaulted ceiling beam
  bonfires.push(new Bonfire(3220, 450, 1)); // Second Bonfire: Belfry Haven
  addArch(3220, 260, 260, 220, 'shrine');
  addRoseWindow(3220, 280, 42, '#ff8833');
  addStreetlamp(3070, 480, 55, '#ffaa33');
  addStreetlamp(3370, 480, 55, '#ffaa33');
  addGothicWindow(3220, 350, 36, 85, '#ff9933', true);
  addCrystal(3120, 478, 'blue', 1.2);
  addCrystal(3320, 478, 'purple', 1.1);

  // --- Tier 2: Mid-level Viaduct Bridges (y: 840 - 900) ---
  P(1900, 880, 280, 32);
  P(2280, 840, 240, 32);
  P(2620, 880, 240, 32);
  P(2960, 860, 280, 32);
  P(3320, 840, 300, 32);
  addStreetlamp(2040, 880, 55, '#ffaa33');
  addStreetlamp(2730, 880, 55, '#ffaa33');
  addStreetlamp(3460, 840, 55, '#ffaa33');
  enemies.push({ type: 'crawler', x: 2380, y: 800, patrolRange: 90 });
  enemies.push({ type: 'guard', x: 3060, y: 810 });
  enemies.push({ type: 'flyer', x: 2150, y: 620 });
  enemies.push({ type: 'flyer', x: 2800, y: 560 });
  enemies.push({ type: 'flyer', x: 3480, y: 500 });

  // --- Tier 1: Sunken Mist Streets & Abyss Pits (y: 1340) ---
  P(1900, 1340, 440, 160);
  // Mist death pit: x=2340 to 2540
  P(2540, 1340, 520, 160);
  // Mist death pit: x=3060 to 3260
  P(3260, 1340, 380, 160);
  enemies.push({ type: 'crawler', x: 2060, y: 1300, patrolRange: 130 });
  enemies.push({ type: 'crawler', x: 2760, y: 1300, patrolRange: 150 });
  enemies.push({ type: 'guard', x: 3400, y: 1290 });
  addWaterDrip(2280, 840, 1340);
  addWaterDrip(2960, 860, 1340);
  addCrystal(2600, 1338, 'cyan', 1.3);
  addCrystal(3300, 1338, 'purple', 1.2);

  // Connecting stair ledges between Tier 2 and Tier 3
  P(3480, 680, 160, 20, 'oneway');
  P(3540, 540, 160, 20, 'oneway');

  // ==========================================================================
  // ZONE 3: GRAND AQUEDUCT & VAMPIRE CASTLE GAUNTLET (x: 3600 - 5500, y: 380 - 1500)
  // ==========================================================================
  // --- Upper Aqueduct Walkway (y: 680 - 740) ---
  P(3700, 740, 420, 32);
  P(4220, 700, 380, 32);
  P(4700, 680, 440, 32);
  P(5220, 720, 420, 32);
  addStreetlamp(3900, 740, 55, '#ffaa33');
  addStreetlamp(4400, 700, 55, '#ffaa33');
  addStreetlamp(4920, 680, 55, '#ffaa33');
  addGargoyle(4230, 700, -1, 'spread');
  addGargoyle(4590, 700, 1, 'spread');
  addGargoyle(5130, 680, 1, 'folded');

  // Gauntlet enemies
  enemies.push({ type: 'guard', x: 3950, y: 690 });
  enemies.push({ type: 'crawler', x: 4420, y: 660, patrolRange: 110 });
  enemies.push({ type: 'guard', x: 4880, y: 630 });
  enemies.push({ type: 'flyer', x: 4300, y: 480 });
  enemies.push({ type: 'flyer', x: 4950, y: 440 });
  enemies.push({ type: 'guard', x: 5400, y: 670 });

  // --- High Spires & Buttress crossings (Tier 3, y: 380 - 500) ---
  P(3860, 480, 180, 20, 'oneway');
  P(4120, 400, 200, 20, 'oneway');
  P(4400, 460, 180, 20, 'oneway');
  P(4680, 380, 220, 20, 'oneway');
  // Moving chain elevator connecting Tier 3 to Tier 2
  platforms.push({ x: 4980, y: 440, w: 130, h: 22, type: 'moving', ox: 4980, oy: 440, mx: 0, my: 180, speed: 80, t: 0 });

  // --- Lower Canal / Dungeon Streets (Tier 1, y: 1340) ---
  P(3740, 1340, 600, 160);
  P(4440, 1340, 560, 160);
  P(5100, 1340, 520, 160);
  enemies.push({ type: 'crawler', x: 3920, y: 1300, patrolRange: 160 });
  enemies.push({ type: 'guard', x: 4680, y: 1290 });
  enemies.push({ type: 'crawler', x: 5260, y: 1300, patrolRange: 130 });
  addWaterDrip(4220, 700, 1340);
  addWaterDrip(4700, 680, 1340);

  // ==========================================================================
  // ZONE 4: CATHEDRAL COURTYARD & SANCTUARY HAVEN (x: 5500 - 6800, y: 650 - 1500)
  // ==========================================================================
  // Stepped courtyard terraces leading down to Cathedral entrance
  P(5660, 780, 260, 28);
  P(6000, 880, 260, 28);
  P(6320, 1020, 200, 28);
  P(5800, 660, 160, 20, 'oneway');
  P(6140, 750, 160, 20, 'oneway');
  addStreetlamp(5780, 780, 55, '#ffaa33');
  addStreetlamp(6120, 880, 55, '#ffaa33');
  addGargoyle(6250, 880, 1, 'spread');

  // Zone 4 Cathedral Sub-Crypt walkway (Tier 1, y: 1340) for Skill 3
  P(5620, 1340, 560, 32);
  P(5560, 1180, 140, 20, 'oneway');
  P(5700, 1040, 140, 20, 'oneway');
  addCrystal(5850, 1338, 'purple', 1.3);
  addWaterDrip(5850, 880, 1340);

  // Cathedral Antechamber / Sanctuary Haven (Safe resting zone outside boss arena)
  P(6380, 1260, 420, 100); // Floor y=1260..1360
  P(6380, 660, 420, 40);   // Ceiling y=660..700
  P(6380, 660, 40, 450);   // Exterior wall y=660..1110

  // Third Bonfire: Cathedral Sanctuary Haven
  bonfires.push(new Bonfire(6540, 1230, 2));
  addArch(6540, 960, 240, 300, 'shrine');
  addRoseWindow(6540, 800, 50, '#9933ff');
  addStreetlamp(6440, 1260, 55, '#ffaa33');
  addStreetlamp(6680, 1260, 55, '#ffaa33');
  addGothicWindow(6540, 820, 36, 85, '#ff9933', true);
  addCrystal(6420, 1258, 'blue', 1.4);
  addCrystal(6700, 1258, 'cyan', 1.3);

  // Decorative balcony inside sanctuary
  P(6460, 1120, 160, 18, 'oneway');

  // ==========================================================================
  // ZONE 5: GRAND BLOODMOON CATHEDRAL BOSS ARENA (x: 6800 - 8150, y: 252 - 1360)
  // ==========================================================================
  P(6800, 1260, 1350, 100); // Arena floor from 6800 to 8150
  P(6800, 252, 1350, 40);   // Soaring cathedral vaulted ceiling
  P(8110, 252, 40, 1008);   // Right wall (gothic iron portcullis)
  P(6800, 252, 40, 858);    // Upper left wall above fog gate (y=252..1110)

  // Dynamic Boss Fog Gate (y=1110..1260, h=150): open before fight, sealed during fight
  platforms.push({ x: 6800, y: 1110, w: 40, h: 150, type: 'solid', isGate: true });

  const bossSpawn = { x: 7550, y: 1100 };
  const bossArena = { x: 6800, y: 252, w: 1350, h: 1008 };
  const bossTrigger = { x: 6940, y: 400, w: 80, h: 860 };

  // Choir Balconies & Ledges matching the artwork of bg_1st_boss_arena.png:
  // Lower colonnade ledges (y=920, matching lower arched gallery)
  P(6860, 920, 240, 20, 'oneway');
  P(7850, 920, 240, 20, 'oneway');

  // Upper grand balconies (y=620, matching upper openwork balustrades)
  P(6840, 620, 320, 24, 'oneway');
  P(7790, 620, 320, 24, 'oneway');

  // Center chandelier / organ high platform
  P(7380, 800, 180, 20, 'oneway');

  // Throne dais steps (y=1200, matching the red carpet steps leading up to the throne)
  P(7430, 1200, 140, 20, 'oneway');

  // Abyssal crystals
  addCrystal(6870, 1258, 'purple', 1.5);
  addCrystal(8060, 1258, 'purple', 1.5);

  // Hidden Skill Pickups in bottom corners across the 8200px map
  const skillPickups = [
    {
      id: 0,
      spellIndex: 0,
      name: 'Pyre Blast',
      nameEn: 'Pyre Blast',
      key: '1',
      icon: '🔥',
      color: '#ff6622',
      glowColor: '#ff8833',
      x: 160,
      y: 1300,
      w: 32,
      h: 40,
      collected: false,
      desc: 'Fiery projectile. Explodes on contact, breaches guard shields, and deals area of effect damage.',
      hint: 'Key: [1] (Soul Cost: 25)',
      locationName: 'Sunken Canal (West Dead End)'
    },
    {
      id: 1,
      spellIndex: 1,
      name: 'Frost Nova',
      nameEn: 'Frost Nova',
      key: '2',
      icon: '❄',
      color: '#66ddff',
      glowColor: '#aae8ff',
      x: 2850,
      y: 1300,
      w: 32,
      h: 40,
      collected: false,
      desc: 'Wave of freezing mist. Freezes enemies and chills the boss. Striking frozen targets triggers Shatter (+2 bonus damage)!',
      hint: 'Key: [2] (Soul Cost: 30)',
      locationName: 'Sunken Belfry Ruins'
    },
    {
      id: 2,
      spellIndex: 2,
      name: 'Abyssal Singularity',
      nameEn: 'Abyssal Singularity',
      key: '3',
      icon: '🌑',
      color: '#c084fc',
      glowColor: '#e9d5ff',
      x: 5850,
      y: 1300,
      w: 32,
      h: 40,
      collected: false,
      desc: 'Void vortex. Pulls nearby enemies within 160px radius, deals periodic damage, and implodes on collapse.',
      hint: 'Key: [3] (Soul Cost: 20)',
      locationName: 'Cathedral Sub-Crypt'
    }
  ];

  return {
    platforms, enemies, bonfires, props, bossSpawn, bossArena, bossTrigger,
    swordPickup, skillPickups,
    playerStart: { x: 140, y: 836 }, width: 8200, height: 1500
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
    this.downSlashCount = 0; // Max 1 down-slash hit per airborne cycle (nerf)
    this.downSlashVisualTimer = 0;
    this.downSlashVisualDur = 0.2;
    this.hasHitThisSwing = new Set();
    this.castAuraTimer = 0;
    this.castAuraColor = '#ff6622';
    this.unlockedSpells = [true, true, true]; // Default true for direct Player unit tests

    this.hp = 5; this.maxHp = 5;
    this.invulnTimer = 0; this.invulnDur = 1.2;
    this.soul = 0; this.maxSoul = 100; this.healCost = 33;
    this.soulPerHit = 11; // Hollow Knight: gain soul on each nail hit
    this.recoilTimer = 0;
    this.recoilVx = 0;
    this.ridingPlatform = null;

    // Weapons (Unarmed until finding first sword on tower)
    this.weaponIndex = -1;
    this.unlockedWeapons = [false, false, false, false];

    // Spells
    this.spellCooldowns = [0, 0, 0];

    // Bonfire respawn
    this.respawnX = x; this.respawnY = y;
    this.lastBonfireId = -1;

    // Visual trails and cloth kinematics
    this.afterimages = [];
    this.afterimageTimer = 0;

    this.state = 'idle'; this.animTimer = 0; this.animFrame = 0;
    this.dead = false; this.deathTimer = 0;
  }

  get weapon() {
    if (this.weaponIndex < 0 || !this.unlockedWeapons[this.weaponIndex]) return null;
    return WEAPONS[this.weaponIndex];
  }

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
    if (this.unlockedWeapons[next] && next !== this.weaponIndex) {
      return this.switchWeapon(next);
    }
    return false;
  }

  castSpell(index, projectiles, particles, audio, camera, enemies = [], boss = null) {
    if (index < 0 || index >= SPELLS.length) return false;
    const spell = SPELLS[index];
    if (this.soul < spell.soulCost || this.spellCooldowns[index] > 0 || this.dashing || (this.hurtTimer && this.hurtTimer > 0)) return false;

    this.soul -= spell.soulCost;
    this.spellCooldowns[index] = spell.cooldown;
    this.castAuraTimer = 0.22;
    this.castAuraColor = spell.color;

    const spawnX = this.x + this.w / 2 + this.facing * 10;
    const spawnY = this.y + this.h / 3;

    switch (index) {
      case 0: { // Pyre Blast
        if (audio && audio.fireball) audio.fireball();
        const pyre = new Projectile(spawnX, spawnY, this.facing * 520, 0, 4, 'pyre_blast', 'player');
        pyre.blastRadius = spell.radius || 80;
        pyre.splashDamage = 3;
        projectiles.push(pyre);
        if (camera && camera.shake) camera.shake(5, 0.15);
        break;
      }
      case 1: { // Frost Nova
        if (audio && audio.iceNova) audio.iceNova();
        if (particles && particles.iceExplosion) particles.iceExplosion(this.x + this.w / 2, this.y + this.h / 2);
        if (camera && camera.shake) camera.shake(6, 0.2);
        this._justCastNova = true;
        const novaRadius = spell.radius || 140;
        const pcx = this.x + this.w / 2, pcy = this.y + this.h / 2;
        if (enemies && enemies.length > 0) {
          for (const e of enemies) {
            if (!e.dead) {
              const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
              const dist = Math.min(Math.hypot(ecx - pcx, ecy - pcy), Math.hypot(e.x - this.x, e.y - this.y));
              if (dist <= novaRadius) {
                if (e instanceof Boss || e.isBoss) {
                  e.chilled = true;
                  e.chillTimer = 1.2;
                  e.freezeTimer = 0;
                } else {
                  e.freezeTimer = 2.0;
                  e.stunned = 2.0;
                  e.attackHitbox = null;
                  e.vx = 0;
                }
              }
            }
          }
        }
        if (boss && boss.active && !boss.dead) {
          const bcx = boss.x + boss.w / 2, bcy = boss.y + boss.h / 2;
          if (Math.hypot(bcx - pcx, bcy - pcy) <= novaRadius) {
            boss.chilled = true;
            boss.chillTimer = 1.2;
            boss.freezeTimer = 0;
            boss.takeDamage(2, pcx < bcx ? 1 : -1, particles, camera, audio);
          }
        }
        break;
      }
      case 2: { // Abyssal Singularity
        if (audio) {
          if (audio.voidVortex) audio.voidVortex();
          else if (audio.shadowBolt) audio.shadowBolt();
        }
        const vortex = new Projectile(spawnX, spawnY, this.facing * 190, 0, 1, 'void_vortex', 'player');
        vortex.life = 2.4;
        vortex.pullRange = spell.radius || 160;
        vortex.pullForce = 750;
        vortex.tickInterval = 0.4;
        vortex.tickTimer = 0.4;
        vortex.implosionDamage = 2;
        vortex.blastRadius = spell.radius || 160;
        projectiles.push(vortex);
        if (camera && camera.shake) camera.shake(4, 0.12);
        break;
      }
    }
    return true;
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
      if (this.spellCooldowns[i] > 0) this.spellCooldowns[i] = Math.max(0, this.spellCooldowns[i] - dt);
    }
    this.animTimer += dt;
    if (this.recoilTimer > 0) { this.recoilTimer -= dt; this.vx = this.recoilVx; }
    if (this.downSlashVisualTimer > 0) this.downSlashVisualTimer -= dt;
    if (this.castAuraTimer > 0) this.castAuraTimer -= dt;
    if (this.onGround) this.downSlashCount = 0;

    // DASH / DODGE ROLL
    if (this.dashing) {
      this.dashTimer -= dt;
      this.vx = this.dashDir * this.dashSpeed; this.vy = 0;
      this.iFrames = true;

      // Spawn smooth afterimages
      this.afterimageTimer = (this.afterimageTimer || 0) - dt;
      if (this.afterimageTimer <= 0) {
        this.afterimageTimer = 0.04;
        this.afterimages.push({
          x: this.x,
          y: this.y,
          facing: this.facing,
          isRolling: this.isGroundRoll,
          rollProg: 1 - this.dashTimer / this.dashDur,
          alpha: 0.65,
          color: this.isGroundRoll ? '#38bdf8' : '#818cf8'
        });
      }

      if (this.isGroundRoll) {
        if (particles && particles.rollDust) particles.rollDust(this.x + this.w / 2, this.y + this.h, this.dashDir);
      } else {
        if (particles && particles.dashTrail) particles.dashTrail(this.x, this.y, this.w, this.h, this.dashDir);
      }
      if (this.dashTimer <= 0) { this.dashing = false; this.iFrames = false; this.vx = this.dashDir * this.speed * 0.5; }
    } else {
      this.iFrames = false;

    // Decay afterimages
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].alpha -= dt * 3.4;
      if (this.afterimages[i].alpha <= 0) {
        this.afterimages.splice(i, 1);
      }
    }

      // ATTACK (Hollow Knight directional system + responsive buffer)
      const wpn = this.weapon || UNARMED_ATTACK;
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
          if (this.downSlashCount < 1) {
            this.attackDir = 'down';
            this.downSlashCount++;
            this.downSlashVisualTimer = wpn.attackDur;
            this.downSlashVisualDur = wpn.attackDur;
          } else {
            this.attackDir = 'side';
          }
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

    // Draw ghost afterimages (during dash / dodge roll)
    for (const img of this.afterimages) {
      ctx.save();
      ctx.globalAlpha = img.alpha * 0.55;
      const icx = img.x + this.w / 2;
      const icy = img.y + this.h / 2;
      ctx.translate(icx, 0); ctx.scale(img.facing, 1); ctx.translate(-icx, 0);
      if (img.isRolling) {
        ctx.translate(icx, icy);
        ctx.rotate(img.rollProg * Math.PI * 2);
        ctx.translate(-icx, -icy);
      }
      ctx.shadowColor = img.color;
      ctx.shadowBlur = 10;
      this._drawKnightSilhouette(ctx, img.x, img.y, img.color);
      ctx.restore();
    }

    ctx.save();
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    ctx.translate(cx, 0); ctx.scale(this.facing, 1); ctx.translate(-cx, 0);

    if (this.dashing) {
      const prog = 1 - this.dashTimer / this.dashDur;
      if (this.isGroundRoll) {
        // Somersault roll
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(prog * Math.PI * 2);
        ctx.translate(-cx, -cy);
        ctx.shadowColor = '#66ccff';
        ctx.shadowBlur = 14;
        this._drawKnight(ctx, true);
        ctx.restore();
      } else {
        // Shade Dash
        ctx.shadowColor = '#4f46e5';
        ctx.shadowBlur = 16;
        ctx.globalAlpha = 0.8;
        this._drawKnight(ctx, false);
      }
    } else {
      this._drawKnight(ctx, false);
    }

    // Monarch Wings (Double jump effect)
    if (this.wingsTimer > 0) {
      const wProg = this.wingsTimer / 0.35;
      const flap = Math.sin(wProg * Math.PI) * 1.35;
      ctx.save();
      ctx.globalAlpha = wProg * 0.9;
      ctx.shadowColor = '#66eeff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#f0f9ff';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;

      // Left wing
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 4);
      ctx.quadraticCurveTo(cx - 26 * flap, cy - 32 * flap, cx - 42 * flap, cy - 14 * flap);
      ctx.quadraticCurveTo(cx - 30 * flap, cy + 8, cx - 6, cy + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right wing
      ctx.beginPath();
      ctx.moveTo(cx + 6, cy - 4);
      ctx.quadraticCurveTo(cx + 26 * flap, cy - 32 * flap, cx + 42 * flap, cy - 14 * flap);
      ctx.quadraticCurveTo(cx + 30 * flap, cy + 8, cx + 6, cy + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // F11: Player Arcane Casting Aura (expanding magic rune circle at feet)
    if (this.castAuraTimer > 0) {
      const auraProg = 1 - Math.max(0, this.castAuraTimer) / 0.22;
      const alpha = Math.sin(auraProg * Math.PI) * 0.85;
      const auraRadius = 16 + auraProg * 12;
      const groundX = this.x + this.w / 2;
      const groundY = this.y + this.h;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.strokeStyle = this.castAuraColor || '#ff6622';
      ctx.shadowColor = this.castAuraColor || '#ff6622';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.ellipse(groundX, groundY, auraRadius, auraRadius * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(groundX, groundY, auraRadius * 0.55, auraRadius * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();

      const angle = auraProg * Math.PI * 2;
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 2;
        const gx = groundX + Math.cos(a) * (auraRadius * 0.75);
        const gy = groundY + Math.sin(a) * (auraRadius * 0.35);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gx - 1.5, gy - 1.5, 3, 3);
      }
      ctx.restore();
    }

    // Directional slash arc (Hollow Knight style with weapon colors & crescent dynamics)
    const showDownVisual = this.downSlashVisualTimer > 0;
    if (this.attacking || showDownVisual) {
      const wpn = this.weapon || UNARMED_ATTACK;
      let progress = 1 - this.attackTimer / wpn.attackDur;
      const isDown = showDownVisual || (this.attackDir === 'down');
      if (showDownVisual) {
        progress = 1 - Math.max(0, this.downSlashVisualTimer) / this.downSlashVisualDur;
      }
      const alpha = Math.max(0.15, 0.95 * (1 - progress * progress));
      const slashLen = wpn.range * 1.25;
      const colors = wpn.slashColors || ['#ffffff', '#66eeff', '#0099dd'];
      const glowCol = wpn.glowColor || '#00f0ff';

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = glowCol;
      ctx.shadowBlur = 16;

      if (wpn.isThrust && this.attackDir === 'side') {
        // Sonic thrust shockcone
        const tx = this.x + this.w + 6;
        const ty = this.y + this.h * 0.45;
        const thrustLen = slashLen * (0.4 + 0.6 * Math.sin(progress * Math.PI));
        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.moveTo(tx, ty - 6);
        ctx.lineTo(tx + thrustLen, ty);
        ctx.lineTo(tx, ty + 6);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = colors[1];
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(tx - 6, ty - 12);
        ctx.lineTo(tx + thrustLen + 8, ty);
        ctx.lineTo(tx - 6, ty + 12);
        ctx.stroke();

        this._drawGlint(ctx, tx + thrustLen, ty, 8, glowCol, '#ffffff');
      } else if (isDown) {
        // Downward Pogo Slash Crescent
        ctx.translate(cx, this.y + this.h - 6);
        const sweep = progress * 2.8 - 1.4;
        const rad = slashLen;

        ctx.strokeStyle = colors[0]; ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, rad, Math.PI / 2 + sweep - 0.55, Math.PI / 2 + sweep + 0.55);
        ctx.stroke();

        ctx.strokeStyle = colors[1]; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.88, Math.PI / 2 + sweep - 0.45, Math.PI / 2 + sweep + 0.45);
        ctx.stroke();

        ctx.fillStyle = colors[2] ? `${colors[2]}44` : 'rgba(100,200,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rad, Math.PI / 2 + sweep - 0.55, Math.PI / 2 + sweep + 0.55);
        ctx.closePath();
        ctx.fill();

        // Tip spark glint
        const tipAngle = Math.PI / 2 + sweep + 0.45;
        this._drawGlint(ctx, Math.cos(tipAngle) * rad, Math.sin(tipAngle) * rad, 7, glowCol, '#ffffff');
      } else if (this.attackDir === 'up') {
        // Upward Slash Crescent
        ctx.translate(cx, this.y + 2);
        const sweep = progress * 2.8 - 1.4;
        const rad = slashLen;

        ctx.strokeStyle = colors[0]; ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, rad, -Math.PI / 2 + sweep - 0.55, -Math.PI / 2 + sweep + 0.55);
        ctx.stroke();

        ctx.strokeStyle = colors[1]; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.88, -Math.PI / 2 + sweep - 0.45, -Math.PI / 2 + sweep + 0.45);
        ctx.stroke();

        ctx.fillStyle = colors[2] ? `${colors[2]}44` : 'rgba(100,200,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rad, -Math.PI / 2 + sweep - 0.55, -Math.PI / 2 + sweep + 0.55);
        ctx.closePath();
        ctx.fill();

        const tipAngle = -Math.PI / 2 + sweep + 0.45;
        this._drawGlint(ctx, Math.cos(tipAngle) * rad, Math.sin(tipAngle) * rad, 7, glowCol, '#ffffff');
      } else {
        // Horizontal Side Slash
        ctx.translate(this.x + this.w * 0.5, this.y + this.h * 0.42);
        const sweep = progress * 3.2 - 1.6;
        const rad = slashLen;

        ctx.strokeStyle = colors[0]; ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, rad, sweep - 0.55, sweep + 0.55);
        ctx.stroke();

        ctx.strokeStyle = colors[1]; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.88, sweep - 0.45, sweep + 0.45);
        ctx.stroke();

        ctx.fillStyle = colors[2] ? `${colors[2]}44` : 'rgba(100,200,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rad, sweep - 0.55, sweep + 0.55);
        ctx.closePath();
        ctx.fill();

        const tipAngle = sweep + 0.45;
        this._drawGlint(ctx, Math.cos(tipAngle) * rad, Math.sin(tipAngle) * rad, 7, glowCol, '#ffffff');
      }
      ctx.restore();
    }
    ctx.restore();
  }

  _drawGlint(ctx, gx, gy, size, color, coreColor = '#ffffff') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(gx - size, gy);
    ctx.lineTo(gx, gy - size * 0.35);
    ctx.lineTo(gx + size, gy);
    ctx.lineTo(gx, gy + size * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(gx, gy - size);
    ctx.lineTo(gx - size * 0.35, gy);
    ctx.lineTo(gx, gy + size);
    ctx.lineTo(gx + size * 0.35, gy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = coreColor;
    ctx.fillRect(gx - 1.5, gy - 1.5, 3, 3);
    ctx.restore();
  }

  _drawKnightSilhouette(ctx, x, y, color) {
    ctx.save();
    ctx.fillStyle = color;
    // Cape silhouette
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 14);
    ctx.lineTo(x - 8, y + this.h + 2);
    ctx.lineTo(x + 20, y + this.h - 2);
    ctx.lineTo(x + 16, y + 14);
    ctx.closePath();
    ctx.fill();
    // Cuirass silhouette
    ctx.fillRect(x + 5, y + 13, 18, 19);
    // Horned helm silhouette
    ctx.fillRect(x + 6, y + 2, 17, 13);
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 2);
    ctx.lineTo(x + 2, y - 8);
    ctx.lineTo(x + 14, y + 2);
    ctx.closePath();
    ctx.fill();
    // Legs
    ctx.fillRect(x + 6, y + 32, 7, 12);
    ctx.fillRect(x + 15, y + 32, 7, 12);
    ctx.restore();
  }

  _drawKnight(ctx, isRolling) {
    const x = Math.round(this.x), y = Math.round(this.y);
    const cx = Math.round(x + this.w / 2), cy = Math.round(y + this.h / 2);
    const wpn = this.weapon || UNARMED_ATTACK;

    if (isRolling) {
      // Somersault tucked sphere
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(cx, cy, 19, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
      // Cloak whorl
      ctx.fillStyle = '#2e1065';
      ctx.beginPath();
      ctx.arc(cx, cy, 17, 0.4, 2.8);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      // Armored curve
      ctx.fillStyle = '#475569';
      ctx.beginPath(); ctx.arc(cx + 3, cy - 2, 9, 0, Math.PI * 2); ctx.fill();
      // Swept horn tip
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 14); ctx.lineTo(cx - 16, cy - 10); ctx.lineTo(cx - 8, cy - 8);
      ctx.closePath(); ctx.fill();
      // Glowing cyan visor streak
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 10;
      ctx.fillRect(cx + 5, cy - 5, 8, 3.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + 7, cy - 4, 4, 1.8);
      ctx.shadowBlur = 0;
      // Spinning blade edge
      ctx.fillStyle = wpn.color || '#e2e8f0';
      ctx.fillRect(cx - 16, cy - 2, 32, 3.5);
      return;
    }

    const isIdle = this.state === 'idle';
    const isRun = this.state === 'run';
    const isJump = this.state === 'jump';
    const isFall = this.state === 'fall';
    const isWallSlide = this.state === 'wallslide';

    const bobY = isIdle ? Math.round(Math.sin(this.animTimer * 2.8) * 1.5) : 0;
    const runPhase = (this.animTimer * 11) % (Math.PI * 2);
    const runBob = isRun ? Math.round(Math.abs(Math.sin(runPhase)) * 2.5) : 0;
    const legStride = isRun ? Math.sin(runPhase) * 6 : 0;

    // Cloak dynamics
    let capeHemX = x - 4;
    let capeHemY = y + this.h + 2;
    if (isRun) {
      capeHemX = x - 12 - Math.sin(runPhase) * 4;
      capeHemY = y + this.h - 1 + runBob;
    } else if (isJump) {
      capeHemX = x - 5;
      capeHemY = y + this.h + 6;
    } else if (isFall) {
      capeHemX = x - 10;
      capeHemY = y + this.h - 6; // Billows upwards!
    } else if (isWallSlide) {
      capeHemX = x - 1;
      capeHemY = y + this.h;
    }

    // 1. Back Pauldron & Arm
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 4, y + 14 + bobY, 7, 7);
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 4, y + 14 + bobY, 7, 2);

    // 2. Royal Cloak (Outer Obsidian Violet + Inner Crimson Silk)
    // Outer Obsidian Veil
    ctx.fillStyle = '#17112b';
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 12 + bobY);
    ctx.lineTo(capeHemX - 2, capeHemY + 2);
    ctx.lineTo(x + 20, y + this.h - 2 + Math.round(runBob * 0.5));
    ctx.lineTo(x + 15, y + 12 + bobY);
    ctx.closePath();
    ctx.fill();

    // Inner Velvet Crimson Silk lining
    ctx.fillStyle = '#831843';
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 14 + bobY);
    ctx.lineTo(capeHemX + 3, capeHemY);
    ctx.lineTo(x + 16, y + this.h - 4 + Math.round(runBob * 0.5));
    ctx.lineTo(x + 15, y + 14 + bobY);
    ctx.closePath();
    ctx.fill();

    // Outer Cloak Fold & Highlight
    ctx.fillStyle = '#31225c';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 13 + bobY);
    ctx.lineTo(capeHemX + 1, capeHemY - 2);
    ctx.lineTo(x + 13, y + this.h - 6);
    ctx.lineTo(x + 12, y + 13 + bobY);
    ctx.closePath();
    ctx.fill();

    // Gold trim hem embroidery
    ctx.fillStyle = '#b45309';
    ctx.fillRect(capeHemX, capeHemY, 8, 1.5);

    // 3. Armored Greaves & Pointed Sabatons (Legs)
    let leftLegOff = 0, rightLegOff = 0;
    if (isRun) {
      leftLegOff = Math.round(legStride);
      rightLegOff = -Math.round(legStride);
    } else if (isJump) {
      leftLegOff = -4; rightLegOff = -2;
    } else if (isFall) {
      leftLegOff = 2; rightLegOff = 3;
    } else if (isWallSlide) {
      leftLegOff = -2; rightLegOff = 2;
    }

    // Left (back) Leg
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 6, y + 32 + bobY, 6, 12 + leftLegOff);
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 5, y + 42 + bobY + Math.max(0, leftLegOff), 7, 3);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 5, y + 42 + bobY + Math.max(0, leftLegOff), 7, 1);

    // Right (front) Leg
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 15, y + 32 + bobY, 6, 12 + rightLegOff);
    // Poleyn (knee-cop)
    ctx.fillStyle = '#475569';
    ctx.fillRect(x + 16, y + 36 + bobY + Math.round(rightLegOff * 0.5), 5, 4);
    // Greave & Sabaton
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 15, y + 42 + bobY + Math.max(0, rightLegOff), 8, 3);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + 15, y + 42 + bobY + Math.max(0, rightLegOff), 8, 1);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 22, y + 43 + bobY + Math.max(0, rightLegOff), 2, 2); // Pointed toe

    // 4. Gothic Plate Cuirass & Fauld (Body)
    // Blackened plate base
    ctx.fillStyle = '#1e2433';
    ctx.fillRect(x + 6, y + 14 + bobY, 16, 18);
    // Fluted side steel bevel
    ctx.fillStyle = '#38455e';
    ctx.fillRect(x + 6, y + 14 + bobY, 3, 18);
    ctx.fillRect(x + 6, y + 14 + bobY, 16, 2);
    // Breastplate ridge
    ctx.fillStyle = '#4f5f80';
    ctx.fillRect(x + 10, y + 16 + bobY, 9, 12);
    // Armored tassets / belt
    ctx.fillStyle = '#111827';
    ctx.fillRect(x + 6, y + 29 + bobY, 16, 3);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(x + 12, y + 29 + bobY, 4, 3); // Brass buckle

    // ABYSSAL SOUL CORE (Center glowing gem)
    const corePulse = 0.75 + 0.25 * Math.sin(this.animTimer * 4);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 12, y + 19 + bobY, 6, 6);
    ctx.fillStyle = `rgba(0, 240, 255, ${corePulse})`;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = (this.soul >= this.healCost ? 8 : 4) * corePulse;
    ctx.fillRect(x + 13, y + 20 + bobY, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 14, y + 21 + bobY, 2, 2);
    ctx.shadowBlur = 0;

    // 5. Gothic Helm (Sallet with Abyssal Horns)
    // Skull dome
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 6, y + 2 + bobY, 18, 14);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 6, y + 2 + bobY, 18, 2);
    ctx.fillRect(x + 6, y + 2 + bobY, 2, 14);
    ctx.fillStyle = '#475569';
    ctx.fillRect(x + 8, y + 4 + bobY, 14, 8);

    // Swept-back Abyssal Horns
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 2 + bobY);
    ctx.lineTo(x + 1, y - 8 + bobY);
    ctx.lineTo(x + 15, y + 2 + bobY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 2 + bobY);
    ctx.lineTo(x + 3, y - 6 + bobY);
    ctx.lineTo(x + 13, y + 2 + bobY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + 2, y - 7 + bobY, 2, 3); // Horn tip glint

    // Glowing Cyan Visor Slit
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fillRect(x + 15, y + 7 + bobY, 9, 3.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 17, y + 8 + bobY, 5, 1.8);
    ctx.shadowBlur = 0;

    // 6. Front Pauldron & Arm
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 2, y + 14 + bobY, 8, 7);
    ctx.fillRect(x + 18, y + 14 + bobY, 8, 7);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 2, y + 14 + bobY, 8, 2);
    ctx.fillRect(x + 18, y + 14 + bobY, 8, 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + 4, y + 12 + bobY, 3, 2); // Pauldron spire
    ctx.fillRect(x + 20, y + 12 + bobY, 3, 2);

    // 7. Active Weapon In Hand
    const showDownVisual = this.downSlashVisualTimer > 0;
    if (this.attacking || showDownVisual) {
      const prog = showDownVisual
        ? (1 - Math.max(0, this.downSlashVisualTimer) / this.downSlashVisualDur)
        : (1 - this.attackTimer / wpn.attackDur);
      const isDown = showDownVisual || (this.attackDir === 'down');
      ctx.save();
      if (isDown) {
        ctx.translate(x + this.w / 2, y + this.h - 6);
        const angle = Math.PI / 2 + (prog * 1.5 - 0.75);
        ctx.rotate(angle);
        this._renderWeaponBlade(ctx, wpn, true);
      } else if (this.attackDir === 'up') {
        ctx.translate(x + this.w / 2, y + 8 + bobY);
        const angle = -Math.PI / 2 + (prog * 1.5 - 0.75);
        ctx.rotate(angle);
        this._renderWeaponBlade(ctx, wpn, false);
      } else {
        ctx.translate(x + this.w + 2, y + 18 + bobY);
        if (wpn.isThrust) {
          const ext = Math.sin(prog * Math.PI) * wpn.bladeL * 0.6;
          ctx.rotate(0.08);
          this._renderWeaponBlade(ctx, wpn, false, ext);
        } else {
          const angle = wpn.swingStart + prog * wpn.swingArc;
          ctx.rotate(angle);
          this._renderWeaponBlade(ctx, wpn, false);
        }
      }
      ctx.restore();
    } else if (this.weapon) {
      ctx.save();
      ctx.translate(x + this.w + 2, y + 18 + bobY);
      ctx.rotate(0.28 + (isRun ? Math.sin(runPhase) * 0.12 : 0));
      this._renderWeaponBlade(ctx, wpn, false);
      ctx.restore();
    }
  }

  _renderWeaponBlade(ctx, wpn, isDown, thrustExt = 0) {
    if (wpn.id === -1) {
      // Unarmed armored gauntlet fist
      ctx.fillStyle = '#475569';
      ctx.fillRect(-3, 0, 6, 8);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-2, 2, 4, 3);
      return;
    }

    const l = wpn.bladeL + thrustExt;
    const w = wpn.bladeW;

    if (wpn.id === 1) {
      // Coiled Greatsword (flamberge, jagged fiery blade)
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(-w / 2, 0, w, l);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-w / 2 + 1, 2, w - 2, l - 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-1, 4, 2, l - 8); // Fiery core
      // Demonic crossguard
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(-w - 3, -3, (w + 3) * 2, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-w - 3, -1, 3, 3);
      ctx.fillRect(w + 1, -1, 3, 3);
      // Grip & skull pommel
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(-w / 2, -10, w, 8);
      ctx.fillStyle = '#78716c';
      ctx.fillRect(-w / 2 - 1, -13, w + 2, 3);
    } else if (wpn.id === 2) {
      // Quick Dagger (golden curved stiletto)
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(-w / 2, 0, w, l);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-w / 2 + 0.5, 1, w - 1, l - 2);
      // Recurved gold quillons
      ctx.fillStyle = '#a16207';
      ctx.fillRect(-w - 2, -2, (w + 2) * 2, 3);
      // Grip & pommel
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-w / 2, -6, w, 5);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-w / 2 - 0.5, -8, w + 1, 2);
    } else if (wpn.id === 3) {
      // Long Lance (slender estoc / rapier with basket hilt)
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(-w / 2, 0, w, l);
      ctx.fillStyle = '#ddd6fe';
      ctx.fillRect(-w / 2 + 0.5, 0, 1, l);
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(-w / 2, l - 4, w, 4); // Piercing tip
      // Swept basket hilt
      ctx.fillStyle = '#3b0764';
      ctx.beginPath();
      ctx.arc(0, -3, w + 4, 0, Math.PI);
      ctx.fill();
      // Grip & pommel
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(-w / 2, -9, w, 7);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(-w / 2 - 1, -11, w + 2, 2);
    } else {
      // Old Nail (classic iron nail blade with chisel tip and fuller)
      ctx.fillStyle = '#475569';
      ctx.fillRect(-w / 2, 0, w, l);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-w / 2 + 1, 1, w - 2, l - 3);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(0, 4, 1, l - 10); // Cyan rune fuller
      // Chisel tip
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-w / 2, l - 2, w, 2);
      // Guard & wrapped grip
      ctx.fillStyle = '#334155';
      ctx.fillRect(-w - 2, -2, (w + 2) * 2, 4);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(-w / 2, -8, w, 6);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-w / 2 - 1, -10, w + 2, 2); // Ring pommel
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

    if (this.freezeTimer > 0) {
      this.freezeTimer = Math.max(0, this.freezeTimer - dt);
      this.vx = 0;
      this.attackHitbox = null;
      if (particles && particles.frostMotes && Math.random() < 0.25) {
        particles.frostMotes(this.x + this.w / 2, this.y + this.h / 2);
      }
      return;
    }

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
        if (this.origPatrol === 0) {
          this.vx = 0;
          this.attackHitbox = null;
        } else {
          this.vx = this.facing * this.speed;
          this.attackHitbox = null;
          if (this.x <= this.patrolLeft) { this.facing = 1; this.x = this.patrolLeft; }
          if (this.x + this.w >= this.patrolRight) { this.facing = -1; this.x = this.patrolRight - this.w; }
        }
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
          if (audio) {
          if (audio.gargoyleSpit) audio.gargoyleSpit();
          else if (audio.shadowBolt) audio.shadowBolt();
        }
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

    // F9: Shatter Combat Synergy (Freeze + Melee/Blast)
    if (this.freezeTimer > 0 && amount > 0) {
      this.freezeTimer = 0;
      amount += 2; // +2 bonus shatter damage
      if (audio && audio.iceShatter) audio.iceShatter();
      if (particles) {
        if (particles.iceExplosion) particles.iceExplosion(this.x + this.w / 2, this.y + this.h / 2);
        if (particles.iceShatterBurst) particles.iceShatterBurst(this.x + this.w / 2, this.y + this.h / 2);
        if (particles.iceShatter) particles.iceShatter(this.x + this.w / 2, this.y + this.h / 2);
      }
    }

    const hitFromFront = (knockDir === -this.facing);

    // GUARD SHIELD BLOCK:
    if (this.type === 'guard' && this.shieldUp && !this.stunned) {
      const isFromAbove = (attackY < this.y + 12);

      if (hitFromFront && !isMagicOrReflect && !isFromAbove) {
        // Blocked cleanly with shield!
        this.flashTimer = 0.08;
        this.vx += knockDir * 60;
        if (camera && camera.shake) camera.shake(3, 0.08);
        if (audio && audio.hit) audio.hit();
        if (particles && particles.sparks) particles.sparks(this.x + (this.facing === 1 ? this.w : 0), this.y + 20);
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
    if (this.type === 'guard') {
      if (isMagicOrReflect) {
        this.stunned = 0.9; // Magic stuns guard!
        this.shieldUp = false;
        if (particles && particles.guardBreakBurst) particles.guardBreakBurst(this.x + this.w / 2, this.y + 16);
      } else if (!hitFromFront && amount >= 2) {
        this.stunned = 0.65; // Backstab guard break!
        this.shieldUp = false;
        if (particles && particles.guardBreakBurst) particles.guardBreakBurst(this.x + this.w / 2, this.y + 16);
      }
    }
    if (camera && camera.shake) camera.shake(4, 0.15);
    if (audio && audio.hit) audio.hit();
    if (particles && particles.sparks) particles.sparks(this.x + this.w / 2, this.y + this.h / 2);
    if (this.type === 'flyer' || this.type === 'crawler') {
      if (particles && particles.dustLand) particles.dustLand(this.x + this.w / 2, this.y + this.h / 2);
    }
    if (this.hp <= 0) {
      this.dead = true;
      if (this.type === 'flyer' || this.type === 'crawler') {
        if (particles && particles.stoneCrumble) particles.stoneCrumble(this.x + this.w / 2, this.y + this.h / 2);
      }
      if (particles && particles.soulBurst) particles.soulBurst(this.x + this.w / 2, this.y + this.h / 2);
      if (audio && audio.enemyDeath) audio.enemyDeath();
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
    if (this.freezeTimer > 0) {
      this._drawIceShell(ctx);
    }
    ctx.restore();
  }

  _drawIceShell(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(100, 220, 255, 0.55)';
    ctx.strokeStyle = '#bbf2f6';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#66ddff';
    ctx.shadowBlur = 10;
    ctx.fillRect(this.x - 4, this.y - 4, this.w + 8, this.h + 8);
    ctx.strokeRect(this.x - 4, this.y - 4, this.w + 8, this.h + 8);
    ctx.beginPath();
    ctx.moveTo(this.x - 4, this.y + 6);
    ctx.lineTo(this.x + this.w / 2, this.y - 8);
    ctx.lineTo(this.x + this.w + 4, this.y + 6);
    ctx.stroke();
    ctx.restore();
  }

  _drawCrawler(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    const isAggro = (this.state === 'aggro' || this.state === 'leap' || this.state === 'leap_windup');
    const isFlashing = this.flashTimer > 0;
    const isLeaping = this.state === 'leap';
    const isWindup = this.state === 'leap_windup';
    const isRecover = this.state === 'recover';

    ctx.save();
    const cx = x + this.w / 2;
    ctx.translate(cx, 0); ctx.scale(this.facing, 1); ctx.translate(-cx, 0);

    // Basalt stone and magma palette
    const stoneBase = isFlashing ? '#ffffff' : (isAggro ? '#261b2b' : '#1e212d');
    const stonePlate = isFlashing ? '#ffffff' : (isAggro ? '#3d2542' : '#313749');
    const stoneHighlight = isFlashing ? '#ffffff' : (isAggro ? '#66396e' : '#525c78');
    const magmaGlow = isFlashing ? '#ffffff' : '#ef4444';

    // Kinematic posture calculations
    let bodyOffY = 0;
    let spineFlare = isAggro ? 3 : 0;
    let headOffX = 0, headOffY = 0;
    let jawOpen = 0;

    if (isWindup) {
      // Coiled stalking spring
      bodyOffY = 3 + Math.sin(this.animTimer * 38) * 1.5;
      spineFlare = 5;
      headOffY = 4;
      jawOpen = 3;
    } else if (isLeaping) {
      // Aerodynamic mid-air pounce
      bodyOffY = -2;
      spineFlare = 6;
      headOffX = 3; headOffY = -1;
      jawOpen = 6;
    } else if (isRecover) {
      // Skid landing
      bodyOffY = 4;
      headOffY = 5;
    }

    // 1. Segmented Stone Tail
    ctx.strokeStyle = stonePlate;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 14 + bodyOffY);
    if (isLeaping) {
      ctx.quadraticCurveTo(x - 6, y + 14 + bodyOffY, x - 12, y + 10 + bodyOffY);
    } else {
      ctx.quadraticCurveTo(x - 4, y + 8 + bodyOffY, x - 8, y + 4 + bodyOffY);
    }
    ctx.stroke();
    // Spaded stone tail barb
    ctx.fillStyle = stoneHighlight;
    ctx.beginPath();
    const tailTipX = isLeaping ? x - 12 : x - 8;
    const tailTipY = isLeaping ? y + 10 + bodyOffY : y + 4 + bodyOffY;
    ctx.moveTo(tailTipX, tailTipY);
    ctx.lineTo(tailTipX - 4, tailTipY - 2);
    ctx.lineTo(tailTipX - 2, tailTipY + 3);
    ctx.closePath();
    ctx.fill();

    // 2. Hind Leg (Crouched Gargoyle Haunch)
    const legPhase = this.animTimer * (isAggro ? 18 : 10);
    const hindStride = (isLeaping || isWindup) ? 0 : Math.sin(legPhase) * 4;
    ctx.fillStyle = stoneBase;
    ctx.fillRect(x + 4 + hindStride, y + 12 + bodyOffY, 7, 10);
    ctx.fillStyle = stonePlate;
    ctx.fillRect(x + 3 + hindStride, y + 18 + bodyOffY, 8, 4);
    // Stone talons
    ctx.fillStyle = isFlashing ? '#ffffff' : '#cbd5e1';
    ctx.fillRect(x + 2 + hindStride, y + 21 + bodyOffY, 3, 3);
    ctx.fillRect(x + 6 + hindStride, y + 21 + bodyOffY, 3, 3);

    // 3. Main Obsidian Carapace / Ribcage
    ctx.fillStyle = stoneBase;
    ctx.fillRect(x + 6, y + 8 + bodyOffY, 20, 12);
    ctx.fillStyle = stonePlate;
    ctx.fillRect(x + 8, y + 8 + bodyOffY, 18, 2);
    ctx.fillRect(x + 8, y + 12 + bodyOffY, 16, 2);
    ctx.fillRect(x + 10, y + 16 + bodyOffY, 14, 2);

    // Glowing magma vein cracks through the basalt
    if (isAggro) {
      ctx.fillStyle = magmaGlow;
      ctx.fillRect(x + 10, y + 11 + bodyOffY, 14, 1.5);
      ctx.fillRect(x + 14, y + 14 + bodyOffY, 8, 1.5);
    }

    // 4. Jagged Obsidian Dorsal Spines (Flares up when aggressive)
    ctx.fillStyle = stoneHighlight;
    ctx.beginPath();
    // Spine 1
    ctx.moveTo(x + 8, y + 8 + bodyOffY);
    ctx.lineTo(x + 11, y + 1 + bodyOffY - spineFlare);
    ctx.lineTo(x + 14, y + 8 + bodyOffY);
    // Spine 2 (tallest)
    ctx.moveTo(x + 15, y + 8 + bodyOffY);
    ctx.lineTo(x + 19, y - 2 + bodyOffY - spineFlare * 1.3);
    ctx.lineTo(x + 23, y + 8 + bodyOffY);
    ctx.closePath();
    ctx.fill();

    // 5. Fore Leg (Muscular Stone Shoulder & Claws)
    const foreStride = (isLeaping || isWindup) ? 0 : -Math.sin(legPhase) * 4;
    ctx.fillStyle = stonePlate;
    ctx.fillRect(x + 18 + foreStride, y + 10 + bodyOffY, 7, 12);
    ctx.fillStyle = stoneHighlight;
    ctx.fillRect(x + 19 + foreStride, y + 10 + bodyOffY, 5, 3);
    // Razor stone talons (extended during leap!)
    ctx.fillStyle = isFlashing ? '#ffffff' : '#f1f5f9';
    const talonReach = isLeaping ? 4 : 0;
    ctx.fillRect(x + 22 + foreStride + talonReach, y + 20 + bodyOffY, 4, 3);
    ctx.fillRect(x + 17 + foreStride, y + 21 + bodyOffY, 3, 3);

    // 6. Snarling Gargoyle Head & Jaws
    const hx = x + 20 + headOffX, hy = y + 4 + headOffY + bodyOffY;
    // Skull dome
    ctx.fillStyle = stonePlate;
    ctx.fillRect(hx, hy, 12, 9);
    ctx.fillStyle = stoneHighlight;
    ctx.fillRect(hx + 1, hy, 11, 2);
    // Stone ear pinned back
    ctx.fillStyle = stoneBase;
    ctx.beginPath();
    ctx.moveTo(hx + 2, hy);
    ctx.lineTo(hx - 3, hy - 4);
    ctx.lineTo(hx + 4, hy + 2);
    ctx.closePath();
    ctx.fill();

    // Serrated Fangs / Jaws
    ctx.fillStyle = isFlashing ? '#ffffff' : '#f8fafc';
    ctx.fillRect(hx + 8, hy + 7, 3, 3); // Upper fangs
    if (jawOpen > 0) {
      // Lower jaw dropped in snarl
      ctx.fillStyle = stoneBase;
      ctx.fillRect(hx + 4, hy + 9 + jawOpen, 8, 3);
      ctx.fillStyle = isFlashing ? '#ffffff' : '#f8fafc';
      ctx.fillRect(hx + 7, hy + 7 + jawOpen, 3, 2); // Lower fangs
    }

    // QUAD GLOWING EMBER EYES
    const eyeColor = isFlashing ? '#ffffff' : (isAggro ? '#ff1100' : '#ff9900');
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 8;
    // Eye 1 & 2 (front pair)
    ctx.fillRect(hx + 6, hy + 3, 3.5, 3);
    ctx.fillRect(hx + 9, hy + 4, 2.5, 2.5);
    // White-hot pupil glints
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx + 7, hy + 3.5, 1.5, 1.5);
    ctx.shadowBlur = 0;

    // Telegraph indicator
    if (isWindup) {
      ctx.fillStyle = '#ff2222';
      ctx.font = 'bold 15px monospace';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 8;
      ctx.fillText('!', x + this.w / 2 - 3, y - 8);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  _drawFlyer(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    const isAiming = (this.state === 'aim');
    const isDiving = (this.state === 'dive' || this.state === 'dive_windup');
    const isFlashing = this.flashTimer > 0;

    ctx.save();
    const cx = x + this.w / 2;
    ctx.translate(cx, 0); ctx.scale(this.facing, 1); ctx.translate(-cx, 0);

    // Weathered Cathedral Stone & Granite Palette
    const stoneDark = isFlashing ? '#ffffff' : (isAiming ? '#27303f' : '#1e2634');
    const stoneBase = isFlashing ? '#ffffff' : (isAiming ? '#3a4454' : '#334155');
    const stonePlate = isFlashing ? '#ffffff' : (isAiming ? '#525e73' : '#475569');
    const stoneHighlight = isFlashing ? '#ffffff' : (isAiming ? '#73829c' : '#64748b');
    const stoneBevel = isFlashing ? '#ffffff' : '#94a3b8';
    const runeEnergy = isFlashing ? '#ffffff' : '#c084fc';

    // Stone Gargoyle Heavy Wing Kinematics
    const flapSpeed = isDiving ? 22 : isAiming ? 16 : 9;
    const flapWave = Math.sin(this.animTimer * flapSpeed);
    const wingYOff = flapWave * 7.5;
    const hoverBob = Math.sin(this.animTimer * 2.8) * 2;

    // 1. Back Stone Wing (Articulated Cathedral Wing Slabs)
    if (!isDiving || this.state === 'dive_windup') {
      ctx.fillStyle = stoneDark;
      ctx.strokeStyle = stoneBase;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 3, y + 10 + hoverBob);
      ctx.lineTo(cx - 16, y - 2 + hoverBob + wingYOff);
      ctx.lineTo(cx - 30, y + 4 + hoverBob + wingYOff * 1.25); // Top stone pinion
      // Scalloped stone feathers
      ctx.lineTo(cx - 24, y + 15 + hoverBob + wingYOff);
      ctx.lineTo(cx - 18, y + 18 + hoverBob + wingYOff * 0.8);
      ctx.lineTo(cx - 3, y + 16 + hoverBob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 2. Segmented Carved Stone Tail
    ctx.strokeStyle = stoneBase;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, y + 20 + hoverBob);
    const tailSway = Math.sin(this.animTimer * 5) * 3;
    ctx.quadraticCurveTo(cx - 6, y + 26 + hoverBob, cx - 11 + tailSway, y + 31 + hoverBob);
    ctx.stroke();
    // Arrowhead stone barb
    ctx.fillStyle = stonePlate;
    ctx.beginPath();
    ctx.moveTo(cx - 11 + tailSway, y + 31 + hoverBob);
    ctx.lineTo(cx - 15 + tailSway, y + 27 + hoverBob);
    ctx.lineTo(cx - 17 + tailSway, y + 33 + hoverBob);
    ctx.closePath();
    ctx.fill();

    // 3. Crouching Stone Chimera Talons (Perched gargoyle stance)
    ctx.fillStyle = stonePlate;
    ctx.fillRect(cx - 5, y + 21 + hoverBob, 4, 6);
    ctx.fillRect(cx + 1, y + 21 + hoverBob, 4, 6);
    // Pointed stone claws
    ctx.fillStyle = isFlashing ? '#ffffff' : stoneBevel;
    ctx.fillRect(cx - 5, y + 26 + hoverBob, 2, 2);
    ctx.fillRect(cx - 2, y + 26 + hoverBob, 2, 2);
    ctx.fillRect(cx + 1, y + 26 + hoverBob, 2, 2);
    ctx.fillRect(cx + 4, y + 26 + hoverBob, 2, 2);

    // 4. Carved Granite Torso (Mimicking gothic cathedral masonry)
    ctx.fillStyle = stoneBase;
    ctx.beginPath();
    ctx.ellipse(cx, y + 14 + hoverBob, 11, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = stonePlate;
    ctx.beginPath();
    ctx.ellipse(cx, y + 13 + hoverBob, 8, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gothic vaulting rib lines carved across the chest
    ctx.fillStyle = stoneDark;
    ctx.fillRect(cx - 7, y + 12 + hoverBob, 14, 1.5);
    ctx.fillRect(cx - 5, y + 16 + hoverBob, 10, 1.5);
    ctx.fillStyle = stoneHighlight;
    ctx.fillRect(cx - 7, y + 13.5 + hoverBob, 14, 1);

    // Stone throat & chest runic crack (Glows when channeling stone shard!)
    if (isAiming) {
      const crackPulse = Math.sin(this.animTimer * 20) * 0.3 + 0.7;
      ctx.fillStyle = runeEnergy;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 10 * crackPulse;
      ctx.beginPath();
      ctx.ellipse(cx, y + 16 + hoverBob, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 1, y + 15 + hoverBob, 2, 2);
      ctx.shadowBlur = 0;
    }

    // 5. Grotesque Carved Stone Gargoyle Head
    const jawOpen = isAiming ? 4 : 0;
    // Skull dome
    ctx.fillStyle = stoneBase;
    ctx.fillRect(cx - 6, y + 3 + hoverBob, 13, 10);
    ctx.fillStyle = stonePlate;
    ctx.fillRect(cx - 4, y + 2 + hoverBob, 10, 2);
    // Brow ridge
    ctx.fillStyle = stoneHighlight;
    ctx.fillRect(cx - 6, y + 5 + hoverBob, 13, 2);

    // Curved Stone Demon / Ram Horns (Swept back from crown)
    ctx.fillStyle = stoneDark;
    ctx.beginPath();
    ctx.moveTo(cx - 3, y + 3 + hoverBob);
    ctx.lineTo(cx - 9, y - 6 + hoverBob);
    ctx.lineTo(cx - 1, y + 1 + hoverBob);
    ctx.moveTo(cx + 3, y + 3 + hoverBob);
    ctx.lineTo(cx - 3, y - 8 + hoverBob);
    ctx.lineTo(cx + 5, y + 1 + hoverBob);
    ctx.closePath();
    ctx.fill();
    // Horn ridge highlights
    ctx.fillStyle = stoneBevel;
    ctx.fillRect(cx - 9, y - 6 + hoverBob, 2, 3);
    ctx.fillRect(cx - 3, y - 8 + hoverBob, 2, 3);

    // Pointed stone ears
    ctx.fillStyle = stonePlate;
    ctx.beginPath();
    ctx.moveTo(cx - 6, y + 7 + hoverBob);
    ctx.lineTo(cx - 11, y + 4 + hoverBob);
    ctx.lineTo(cx - 6, y + 9 + hoverBob);
    ctx.closePath();
    ctx.fill();

    // Grotesque Snout & Granite Fangs
    ctx.fillStyle = stonePlate;
    ctx.fillRect(cx + 3, y + 8 + hoverBob, 7, 5);
    // Upper stone fangs
    ctx.fillStyle = isFlashing ? '#ffffff' : '#f8fafc';
    ctx.fillRect(cx + 6, y + 12 + hoverBob, 2, 2.5);
    ctx.fillRect(cx + 9, y + 12 + hoverBob, 2, 2.5);

    // Gaping lower jaw when aiming
    if (jawOpen > 0) {
      ctx.fillStyle = stoneDark;
      ctx.fillRect(cx + 2, y + 12 + hoverBob + jawOpen, 7, 3);
      ctx.fillStyle = isFlashing ? '#ffffff' : '#f8fafc';
      ctx.fillRect(cx + 5, y + 10 + hoverBob + jawOpen, 2, 2); // Lower fang
      // Gathering stone soul ember in mouth
      ctx.fillStyle = runeEnergy;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx + 7, y + 12 + hoverBob + jawOpen * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // PIERCING SPECTRAL STONE EYES (Glowing cyan soul light)
    const eyeCol = isFlashing ? '#ffffff' : (isAiming ? '#ffffff' : '#38bdf8');
    ctx.fillStyle = eyeCol;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.fillRect(cx - 1, y + 6 + hoverBob, 3, 3);
    ctx.fillRect(cx + 4, y + 6 + hoverBob, 3, 3);
    // White pupil core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx, y + 7 + hoverBob, 1.5, 1.5);
    ctx.fillRect(cx + 5, y + 7 + hoverBob, 1.5, 1.5);
    ctx.shadowBlur = 0;

    // 6. Front Stone Wing (Articulated Cathedral Wing Slabs)
    if (isDiving && this.state === 'dive') {
      // Swept-back aerodynamic stone wedge during high-velocity dive!
      ctx.fillStyle = stonePlate;
      ctx.strokeStyle = stoneBase;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(cx - 1, y + 8 + hoverBob);
      ctx.lineTo(cx - 24, y - 8 + hoverBob); // Sharp stone wedge tip
      ctx.lineTo(cx - 14, y + 5 + hoverBob);
      ctx.lineTo(cx - 3, y + 16 + hoverBob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wing stone bevel highlight
      ctx.strokeStyle = stoneBevel;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 1, y + 8 + hoverBob);
      ctx.lineTo(cx - 24, y - 8 + hoverBob);
      ctx.stroke();
    } else {
      // Normal majestic stone wing with sculpted feathers & gothic bevels
      ctx.fillStyle = stonePlate;
      ctx.strokeStyle = stoneDark;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(cx + 3, y + 11 + hoverBob);
      ctx.lineTo(cx + 17, y - 1 + hoverBob - wingYOff);
      ctx.lineTo(cx + 32, y + 4 + hoverBob - wingYOff * 1.3); // Outer stone feather
      // Scalloped arch feathers
      ctx.lineTo(cx + 25, y + 14 + hoverBob - wingYOff);
      ctx.lineTo(cx + 18, y + 18 + hoverBob - wingYOff * 0.8);
      ctx.lineTo(cx + 4, y + 16 + hoverBob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Stone feather bevel highlights
      ctx.strokeStyle = stoneBevel;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 5, y + 12 + hoverBob);
      ctx.lineTo(cx + 17, y - 1 + hoverBob - wingYOff);
      ctx.lineTo(cx + 32, y + 4 + hoverBob - wingYOff * 1.3);
      ctx.stroke();
    }

    // 7. Dive telegraph indicator
    if (this.state === 'dive_windup') {
      ctx.fillStyle = '#ff2222';
      ctx.font = 'bold 16px monospace';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 8;
      ctx.fillText('▼', cx - 5, y - 8);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  _drawGuard(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    const isFlashing = this.flashTimer > 0;
    const isStunned = this.stunned > 0;
    const bobY = Math.sin(this.animTimer * 2.2) * 1.5;

    ctx.save();
    const cx = x + this.w / 2;
    ctx.translate(cx, 0); ctx.scale(this.facing, 1); ctx.translate(-cx, 0);

    // Cathedral Black Templar Armor Palette
    const armorBlack = isFlashing ? '#ffffff' : '#0f172a';
    const armorPlate = isFlashing ? '#ffffff' : '#1e293b';
    const steelHighlight = isFlashing ? '#ffffff' : '#475569';
    const goldTrim = isFlashing ? '#ffffff' : '#f59e0b';
    const goldLight = isFlashing ? '#ffffff' : '#fbbf24';

    // Kinematics
    const tilt = isStunned ? -0.22 : (this.state === 'shield_bash' ? 0.18 : 0);
    ctx.translate(cx, y + this.h);
    ctx.rotate(tilt);
    ctx.translate(-cx, -(y + this.h));

    // 1. Knight's Crimson Mantle / Plume (Fluttering behind helm)
    ctx.fillStyle = '#881337';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 3 + bobY);
    ctx.quadraticCurveTo(x - 6, y + 6 + bobY, x - 12 + Math.sin(this.animTimer * 6) * 3, y + 16 + bobY);
    ctx.lineTo(x - 4, y + 14 + bobY);
    ctx.closePath();
    ctx.fill();

    // 2. Heavy Armored Greaves & Pointed Sabatons (Legs)
    const legBob = (this.state === 'advance' || this.state === 'patrol') ? Math.sin(this.animTimer * 6) * 4 : 0;
    ctx.fillStyle = armorBlack;
    ctx.fillRect(x + 6, y + 36 + bobY + legBob, 8, 14);
    ctx.fillRect(x + 20, y + 36 + bobY - legBob, 8, 14);
    ctx.fillStyle = steelHighlight;
    ctx.fillRect(x + 6, y + 36 + bobY + legBob, 2, 14);
    ctx.fillRect(x + 20, y + 36 + bobY - legBob, 2, 14);
    // Pointed sabatons
    ctx.fillStyle = armorPlate;
    ctx.fillRect(x + 6, y + 47 + bobY + Math.max(0, legBob), 10, 3);
    ctx.fillRect(x + 20, y + 47 + bobY + Math.max(0, -legBob), 10, 3);
    ctx.fillStyle = goldTrim;
    ctx.fillRect(x + 14, y + 48 + bobY + Math.max(0, legBob), 2, 2);
    ctx.fillRect(x + 28, y + 48 + bobY + Math.max(0, -legBob), 2, 2);

    // 3. Fluted Gothic Cuirass & Fauld (Torso)
    ctx.fillStyle = armorBlack;
    ctx.fillRect(x + 4, y + 12 + bobY, this.w - 8, 25);
    ctx.fillStyle = armorPlate;
    ctx.fillRect(x + 6, y + 14 + bobY, this.w - 12, 21);
    // Fluted ribs
    ctx.fillStyle = steelHighlight;
    ctx.fillRect(x + 6, y + 14 + bobY, 3, 21);
    ctx.fillRect(x + 14, y + 16 + bobY, 2, 17);
    // Gold filigree breastplate trim
    ctx.fillStyle = goldTrim;
    ctx.fillRect(x + 4, y + 12 + bobY, this.w - 8, 2);
    ctx.fillRect(x + 8, y + 32 + bobY, this.w - 16, 2);

    // 4. Gothic Sugarloaf Greathelm
    ctx.fillStyle = armorBlack;
    ctx.fillRect(x + 5, y + bobY, this.w - 10, 14);
    ctx.fillStyle = armorPlate;
    ctx.fillRect(x + 7, y + 2 + bobY, this.w - 14, 10);
    ctx.fillStyle = steelHighlight;
    ctx.fillRect(x + 5, y + bobY, 2, 14);
    ctx.fillRect(x + 5, y + bobY, this.w - 10, 2);

    // BURNING SPECTRAL AMBER VISOR
    ctx.fillStyle = isFlashing ? '#ffffff' : (isStunned ? '#94a3b8' : '#f59e0b');
    ctx.shadowColor = isStunned ? 'transparent' : '#f59e0b';
    ctx.shadowBlur = isStunned ? 0 : 12;
    ctx.fillRect(x + 18, y + 5 + bobY, 11, 3.5);
    ctx.fillStyle = isStunned ? '#64748b' : '#ffffff';
    ctx.fillRect(x + 20, y + 6 + bobY, 6, 1.5);
    ctx.shadowBlur = 0;

    // 5. Spiked Pauldrons
    ctx.fillStyle = armorPlate;
    ctx.fillRect(x + 1, y + 12 + bobY, 8, 8);
    ctx.fillRect(x + this.w - 9, y + 12 + bobY, 8, 8);
    ctx.fillStyle = goldTrim;
    ctx.fillRect(x + 1, y + 12 + bobY, 8, 2);
    ctx.fillRect(x + this.w - 9, y + 12 + bobY, 8, 2);

    // 6. GOTHIC LANCET ARCH TOWER SHIELD (Pointed Cologne Cathedral Arch!)
    if (this.shieldUp && !isStunned) {
      const sx = x + this.w - 6;
      const sy = y + 4 + bobY;
      const sw = 14, sh = 42;

      // Dark obsidian iron body
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.moveTo(sx, sy + 10);
      ctx.quadraticCurveTo(sx + sw / 2, sy - 4, sx + sw, sy + 10); // Pointed lancet arch top!
      ctx.lineTo(sx + sw, sy + sh);
      ctx.lineTo(sx, sy + sh);
      ctx.closePath();
      ctx.fill();

      // Outer gold lancet rim
      ctx.strokeStyle = goldTrim;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner iron plate
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy + 12);
      ctx.quadraticCurveTo(sx + sw / 2, sy, sx + sw - 2, sy + 12);
      ctx.lineTo(sx + sw - 2, sy + sh - 2);
      ctx.lineTo(sx + 2, sy + sh - 2);
      ctx.closePath();
      ctx.fill();

      // Embossed Gold Templar Cross
      ctx.fillStyle = goldLight;
      ctx.fillRect(sx + sw / 2 - 2, sy + 14, 4, 18); // Vertical bar
      ctx.fillRect(sx + 2, sy + 20, sw - 4, 4);     // Horizontal bar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + sw / 2 - 1, sy + 21, 2, 2); // Center diamond
    }

    // 7. Cathedral Greatsword
    ctx.save();
    if (this.state === 'combo1_windup') {
      ctx.translate(x + this.w, y + 12 + bobY);
      ctx.rotate(-1.4);
      // Blade
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(-2, 0, 5, 42);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-1, 2, 3, 38);
      // Gold cruciform guard
      ctx.fillStyle = goldTrim; ctx.fillRect(-6, 0, 13, 5);
      ctx.fillStyle = armorBlack; ctx.fillRect(-2, -9, 4, 9); // Hilt
    } else if (this.state === 'combo1_slash') {
      ctx.translate(x + this.w + 8, y + 16 + bobY);
      ctx.rotate(1.4);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(-2, 0, 5, 44);
      ctx.fillStyle = goldTrim; ctx.fillRect(-6, 0, 13, 5);
      ctx.fillStyle = armorBlack; ctx.fillRect(-2, -9, 4, 9);
      // Slash trail
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-10, -10, 40, -0.4, 1.2);
      ctx.stroke();
    } else if (this.state === 'combo2_windup') {
      ctx.translate(x + this.w - 4, y + 22 + bobY);
      ctx.rotate(-0.1);
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, -2, 36, 4);
      ctx.fillStyle = goldTrim; ctx.fillRect(0, -6, 5, 12);
    } else if (this.state === 'combo2_thrust') {
      ctx.translate(x + this.w + 16, y + 22 + bobY);
      ctx.rotate(0.0);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -2, 46, 4.5);
      ctx.fillStyle = goldTrim; ctx.fillRect(0, -6, 5, 12);
      // Thrust shockcone
      ctx.strokeStyle = 'rgba(255, 230, 150, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(38, -6); ctx.lineTo(50, 0); ctx.lineTo(38, 6);
      ctx.stroke();
    } else {
      // Ready stance (sword angled)
      ctx.translate(x - 2, y + 14 + bobY);
      ctx.rotate(0.32);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(-2, 0, 4, 36);
      ctx.fillStyle = goldTrim; ctx.fillRect(-5, 0, 10, 4);
      ctx.fillStyle = armorBlack; ctx.fillRect(-2, -7, 4, 7);
    }
    ctx.restore();

    // 8. Stun / Threat Indicators
    if (isStunned) {
      // Swirling golden dazed stars
      const starOrbit = this.animTimer * 8;
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 6;
      for (let s = 0; s < 3; s++) {
        const sa = starOrbit + (s * Math.PI * 2) / 3;
        const sx = cx + Math.cos(sa) * 16;
        const sy = y - 6 + Math.sin(sa) * 5;
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
      }
      ctx.shadowBlur = 0;
    } else if (this.state === 'combo1_windup' || this.state === 'shield_bash_windup') {
      ctx.fillStyle = '#ff2222';
      ctx.font = 'bold 16px monospace';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 8;
      ctx.fillText('!', cx - 4, y - 8);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  getBounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ============================================================================
// BOSS
// ============================================================================
// ============================================================================
// BOSS — VOID LORD
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
    this.isBoss = true;
  }

  activate(arena, audio) {
    this.active = true; this.arena = arena; this.state = 'roar';
    this.stateTimer = 1.6; this.stateMaxTimer = 1.6;
    if (audio && audio.bossRoar) audio.bossRoar();
  }

  update(dt, player, level, particles, camera, audio, projectiles) {
    if (!this.active || this.dead) return;

    const isChilled = (this.freezeTimer > 0 || this.chillTimer > 0 || this.chilled);
    if (this.freezeTimer > 0) {
      this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    }
    if (this.chillTimer > 0) {
      this.chillTimer = Math.max(0, this.chillTimer - dt);
      this.chilled = (this.chillTimer > 0);
    } else {
      this.chilled = false;
    }
    if (isChilled) {
      dt *= 0.5; // Chilled slows boss movement and actions by 50%
      if (particles && particles.frostMotes && Math.random() < 0.25) {
        particles.frostMotes(this.x + this.w / 2, this.y + this.h / 2);
      }
    }

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
            if (audio) {
              if (audio.land) audio.land();
              if (audio.voidImplode) audio.voidImplode();
            }
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

    if ((this.freezeTimer > 0 || this.chilled || this.chillTimer > 0) && amount > 0) {
      this.freezeTimer = 0;
      this.chilled = false;
      this.chillTimer = 0;
      amount += 2; // +2 shatter bonus
      if (audio && audio.iceShatter) audio.iceShatter();
      if (particles) {
        if (particles.iceExplosion) particles.iceExplosion(this.x + this.w / 2, this.y + this.h / 2);
        if (particles.iceShatterBurst) particles.iceShatterBurst(this.x + this.w / 2, this.y + this.h / 2);
        if (particles.iceShatter) particles.iceShatter(this.x + this.w / 2, this.y + this.h / 2);
      }
    }

    this.hp -= amount; this.flashTimer = 0.15; this.invulnTimer = 0.2;
    if (camera && camera.shake) camera.shake(5, 0.15);
    if (audio && audio.hit) audio.hit();
    if (particles && particles.sparks) particles.sparks(this.x + this.w / 2, this.y + this.h / 3);
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

    // Chilled frost overlay if frozen/chilled (F8)
    if (this.freezeTimer > 0 || this.chillTimer > 0 || this.chilled) {
      ctx.save();
      ctx.fillStyle = 'rgba(100, 220, 255, 0.35)';
      ctx.strokeStyle = '#bbf2f6';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#66ddff';
      ctx.shadowBlur = 12;
      ctx.fillRect(x - 2, y - 4, this.w + 4, this.h + 6);
      ctx.strokeRect(x - 2, y - 4, this.w + 4, this.h + 6);
      ctx.restore();
    }
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
// ENVIRONMENT RENDERER (Detailed Stone Masonry, Overgrowth & Gothic Props)
// ============================================================================
class EnvironmentRenderer {
  constructor() {
    this.dripDroplets = [];
    this.imgBossArena = typeof Image !== 'undefined' ? new Image() : null;
    if (this.imgBossArena) this.imgBossArena.src = 'bg_1st_boss_arena.png?' + (typeof ASSET_VERSION !== 'undefined' ? ASSET_VERSION : 'v=1.0.2');
  }

  _isReady(img) {
    return img && img.complete && (img.naturalWidth > 0 || img.width > 0);
  }

  drawBackWalls(ctx, camera, time, level) {
    const cw = CANVAS_W / camera.zoom;
    const ch = CANVAS_H / camera.zoom;
    const minX = camera.x - 100, maxX = camera.x + cw + 100;
    const minY = camera.y - 100, maxY = camera.y + ch + 100;

    ctx.save();

    // 1. Bedrock & Crypt Sub-floor Foundations across the map (fills solid underground down to y=1500)
    // Preserves open abyss death pits at (2340..2540) and (3060..3260)
    ctx.fillStyle = '#0a0512';
    if (minX < 2340 && maxY > 1372) {
      const x1 = Math.max(40, minX);
      const x2 = Math.min(2340, maxX);
      if (x2 > x1) ctx.fillRect(x1, 1372, x2 - x1, 128);
    }
    if (maxX > 2540 && minX < 3060 && maxY > 1372) {
      const x1 = Math.max(2540, minX);
      const x2 = Math.min(3060, maxX);
      if (x2 > x1) ctx.fillRect(x1, 1372, x2 - x1, 128);
    }
    if (maxX > 3260 && minX < 6380 && maxY > 1372) {
      const x1 = Math.max(3260, minX);
      const x2 = Math.min(6380, maxX);
      if (x2 > x1) ctx.fillRect(x1, 1372, x2 - x1, 128);
    }
    // Cathedral foundation (from 6380 to 8200, y: 1260 to 1500)
    if (maxX > 6380 && maxY > 1260) {
      const x1 = Math.max(6380, minX);
      const x2 = Math.min(8200, maxX);
      if (x2 > x1) ctx.fillRect(x1, 1260, x2 - x1, 240);
    }

    // Foundation ashlar courses & rock strata
    ctx.strokeStyle = '#150a24';
    ctx.lineWidth = 1.5;
    for (let fy = 1380; fy < 1500; fy += 40) {
      if (fy > minY && fy < maxY) {
        ctx.beginPath();
        ctx.moveTo(Math.max(40, minX), fy);
        ctx.lineTo(Math.min(8200, maxX), fy);
        ctx.stroke();
      }
    }

    // 2. Starting Fortress Left Boundary Wall (x: 0 to 220, y: 180 to 880)
    // Only spans the fortress upper ramparts above the canal terrace (y: 180 to 880).
    // Does NOT extend down to 1500, avoiding the awkward black cutoff block in the canal.
    if (minX < 220 && maxY > 180 && minY < 880) {
      this._drawFortressBackWall(ctx, 0, 180, 220, 700);
    }

    // 3. THE WATCHTOWER BACK WALL (x: 1380 to 1756, y: 500 to 1340)
    // Solid opaque masonry back wall WITH TRANSPARENT GOTHIC WINDOW APERTURES!
    if (maxX > 1380 && minX < 1756 && maxY > 500 && minY < 1340) {
      this._drawWatchtowerBackWall(ctx, 1380, 500, 376, 840, time);
    }

    // 4. Clocktower Belfry Haven Back Wall (x: 2980 to 3460, y: 240 to 480)
    if (maxX > 2980 && minX < 3460 && maxY > 240 && minY < 480) {
      this._drawHavenBackWall(ctx, 2980, 240, 480, 240, time);
    }

    // 5. Grand Cathedral Antechamber & Nave Back Wall (x: 6380 to 6800, y: 660 to 1260)
    if (maxX > 6380 && minX < 6800 && maxY > 660 && minY < 1260) {
      this._drawCathedralAntechamberWall(ctx, 6380, 660, 420, 600, time);
    }

    // 6. Grand Bloodmoon Cathedral Boss Arena Back Wall (x: 6800 to 8150, y: 252 to 1260)
    if (maxX > 6800 && minX < 8150 && maxY > 240 && minY < 1260) {
      this._drawCathedralArenaWall(ctx, 6800, 252, 1350, 1008, time);
    }

    ctx.restore();
  }

  _drawFortressBackWall(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#0f081b';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#090411';
    ctx.lineWidth = 1.5;
    for (let cy = y + 26; cy < y + h; cy += 26) {
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x + w, cy);
      ctx.stroke();
      const offset = (Math.floor(cy / 26) % 2 === 0) ? 0 : 36;
      for (let bx = x + offset; bx < x + w; bx += 72) {
        ctx.beginPath();
        ctx.moveTo(bx, cy - 26);
        ctx.lineTo(bx, cy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawWatchtowerBackWall(ctx, x, y, w, h, time) {
    ctx.save();

    // 3 Grand Gothic Lancet Windows cutting through the solid rear wall
    const windows = [
      { x: x + w / 2, y: y + 120, w: 42, h: 95 },
      { x: x + w / 2, y: y + 310, w: 42, h: 95 },
      { x: x + w / 2, y: y + 500, w: 42, h: 95 },
    ];

    // 1. Solid Opaque Dark Gothic Masonry Back Wall (with evenodd cutouts for windows!)
    ctx.beginPath();
    ctx.rect(x, y, w, h);

    for (const win of windows) {
      const halfW = win.w / 2;
      const archTopY = win.y;
      const springY = win.y + win.h * 0.36;
      const sillY = win.y + win.h;

      ctx.moveTo(win.x - halfW, sillY);
      ctx.lineTo(win.x - halfW, springY);
      ctx.quadraticCurveTo(win.x - halfW * 0.5, archTopY, win.x, archTopY - 2);
      ctx.quadraticCurveTo(win.x + halfW * 0.5, archTopY, win.x + halfW, springY);
      ctx.lineTo(win.x + halfW, sillY);
      ctx.closePath();
    }

    // Base solid dark basalt stone (100% Solid Opaque!)
    ctx.fillStyle = '#0e0818';
    ctx.fill('evenodd');

    // Ashlar stone masonry courses on the solid wall (clipped with evenodd)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    for (const win of windows) {
      const halfW = win.w / 2;
      const archTopY = win.y;
      const springY = win.y + win.h * 0.36;
      const sillY = win.y + win.h;
      ctx.moveTo(win.x - halfW, sillY);
      ctx.lineTo(win.x - halfW, springY);
      ctx.quadraticCurveTo(win.x - halfW * 0.5, archTopY, win.x, archTopY - 2);
      ctx.quadraticCurveTo(win.x + halfW * 0.5, archTopY, win.x + halfW, springY);
      ctx.lineTo(win.x + halfW, sillY);
      ctx.closePath();
    }
    ctx.clip('evenodd');

    // Dark ashlar course lines
    ctx.strokeStyle = '#08040f';
    ctx.lineWidth = 1.5;
    const courseH = 26;
    for (let cy = y + courseH; cy < y + h; cy += courseH) {
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x + w, cy);
      ctx.stroke();

      const offset = (Math.floor(cy / courseH) % 2 === 0) ? 0 : 36;
      const brickW = 72;
      for (let bx = x + offset; bx < x + w; bx += brickW) {
        ctx.beginPath();
        ctx.moveTo(bx, cy - courseH);
        ctx.lineTo(bx, cy);
        ctx.stroke();
      }
    }

    // Architectural stone pilasters on left and right inside the tower
    ctx.fillStyle = '#160d24';
    ctx.fillRect(x + 36, y, 16, h);
    ctx.fillRect(x + w - 52, y, 16, h);

    // Subtle stone mouldings across floors
    ctx.fillStyle = '#1d1230';
    ctx.fillRect(x, y + 230, w, 6);
    ctx.fillRect(x, y + 420, w, 6);
    ctx.fillRect(x, y + 610, w, 6);

    ctx.restore(); // end clip

    // 2. TRANSPARENT WINDOW TRACERY & FRAMES (The sky/moon is visible through the cutouts!)
    for (const win of windows) {
      const halfW = win.w / 2;
      const archTopY = win.y;
      const springY = win.y + win.h * 0.36;
      const sillY = win.y + win.h;

      // Recessed stone jambs surround
      ctx.strokeStyle = '#1b122e';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(win.x - halfW - 2, sillY + 2);
      ctx.lineTo(win.x - halfW - 2, springY);
      ctx.quadraticCurveTo(win.x - halfW * 0.5, archTopY - 3, win.x, archTopY - 4);
      ctx.quadraticCurveTo(win.x + halfW * 0.5, archTopY - 3, win.x + halfW + 2, springY);
      ctx.lineTo(win.x + halfW + 2, sillY + 2);
      ctx.stroke();

      // Stone sill
      ctx.fillStyle = '#221736';
      ctx.fillRect(win.x - halfW - 4, sillY, win.w + 8, 5);
      ctx.fillStyle = '#342550';
      ctx.fillRect(win.x - halfW - 3, sillY, win.w + 6, 1.5);

      // Fine delicate moonlit glass sheen (transparent with faint violet/candle glimmer)
      const glassGrad = ctx.createLinearGradient(win.x, archTopY, win.x, sillY);
      const flk = Math.sin(time * 6 + win.y) * 0.03 + 0.12;
      glassGrad.addColorStop(0, `rgba(255, 180, 80, ${flk})`);
      glassGrad.addColorStop(0.5, `rgba(180, 100, 255, ${flk * 0.6})`);
      glassGrad.addColorStop(1, `rgba(255, 150, 40, ${flk * 1.2})`);
      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.moveTo(win.x - halfW, sillY);
      ctx.lineTo(win.x - halfW, springY);
      ctx.quadraticCurveTo(win.x - halfW * 0.5, archTopY, win.x, archTopY - 2);
      ctx.quadraticCurveTo(win.x + halfW * 0.5, archTopY, win.x + halfW, springY);
      ctx.lineTo(win.x + halfW, sillY);
      ctx.closePath();
      ctx.fill();

      // Stone tracery: central vertical mullion
      ctx.strokeStyle = '#0d0716';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(win.x, archTopY + 12);
      ctx.lineTo(win.x, sillY);
      ctx.stroke();

      // Horizontal transom bars
      ctx.beginPath();
      ctx.moveTo(win.x - halfW, springY);
      ctx.lineTo(win.x + halfW, springY);
      ctx.moveTo(win.x - halfW, springY + (sillY - springY) * 0.5);
      ctx.lineTo(win.x + halfW, springY + (sillY - springY) * 0.5);
      ctx.stroke();

      // Trefoil rosette in arch head
      ctx.beginPath();
      ctx.arc(win.x, archTopY + 13, 4.5, 0, Math.PI * 2);
      ctx.stroke();

      // Outer delicate moulding
      ctx.strokeStyle = '#2f2048';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(win.x - halfW, sillY);
      ctx.lineTo(win.x - halfW, springY);
      ctx.quadraticCurveTo(win.x - halfW * 0.5, archTopY, win.x, archTopY - 2);
      ctx.quadraticCurveTo(win.x + halfW * 0.5, archTopY, win.x + halfW, springY);
      ctx.lineTo(win.x + halfW, sillY);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawHavenBackWall(ctx, x, y, w, h, time) {
    ctx.save();
    // Solid opaque gothic stone sanctuary backing wall
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#0c0817');
    grad.addColorStop(0.5, '#150f24');
    grad.addColorStop(1, '#0e0a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Weathered ashlar courses
    ctx.strokeStyle = '#090613';
    ctx.lineWidth = 1;
    for (let cy = y + 20; cy < y + h; cy += 20) {
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x + w, cy);
      ctx.stroke();
    }

    // High decorative Belfry blind arcade & lancet niches
    ctx.strokeStyle = '#221738';
    ctx.lineWidth = 2;
    for (let ax = x + 40; ax < x + w - 30; ax += 60) {
      ctx.beginPath();
      ctx.moveTo(ax - 22, y + h);
      ctx.lineTo(ax - 22, y + 60);
      ctx.quadraticCurveTo(ax - 11, y + 20, ax, y + 10);
      ctx.quadraticCurveTo(ax + 11, y + 20, ax + 22, y + 60);
      ctx.lineTo(ax + 22, y + h);
      ctx.stroke();

      // Recessed niche shadow
      ctx.fillStyle = '#080511';
      ctx.beginPath();
      ctx.moveTo(ax - 18, y + h);
      ctx.lineTo(ax - 18, y + 65);
      ctx.quadraticCurveTo(ax - 9, y + 28, ax, y + 20);
      ctx.quadraticCurveTo(ax + 9, y + 28, ax + 18, y + 65);
      ctx.lineTo(ax + 18, y + h);
      ctx.closePath();
      ctx.fill();

      // Warm candlelit glow inside the niche
      const flk = Math.sin(time * 9 + ax) * 0.15 + 0.85;
      ctx.fillStyle = '#ffaa33';
      ctx.fillRect(ax - 3, y + h - 35, 6, 8 * flk);
    }

    // Vaulted ceiling beam mouldings
    ctx.fillStyle = '#2d2144';
    ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = '#59447d';
    ctx.fillRect(x, y, w, 1.5);

    ctx.restore();
  }

  _drawCathedralAntechamberWall(ctx, x, y, w, h, time) {
    ctx.save();
    // 100% Solid Opaque Cathedral Stone Wall
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#090512');
    grad.addColorStop(0.5, '#120b1e');
    grad.addColorStop(1, '#0b0614');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Cologne Cathedral Blind Arches & Triforium Gallery Courses
    ctx.strokeStyle = '#1b122c';
    ctx.lineWidth = 2;
    for (let ax = x + 35; ax < x + w - 30; ax += 70) {
      // Pointed blind lancet arch in nave wall
      ctx.beginPath();
      ctx.moveTo(ax - 24, y + h);
      ctx.lineTo(ax - 24, y + 160);
      ctx.quadraticCurveTo(ax - 12, y + 60, ax, y + 40);
      ctx.quadraticCurveTo(ax + 12, y + 60, ax + 24, y + 160);
      ctx.lineTo(ax + 24, y + h);
      ctx.stroke();

      // Inner recess
      ctx.fillStyle = '#08040e';
      ctx.beginPath();
      ctx.moveTo(ax - 20, y + h);
      ctx.lineTo(ax - 20, y + 165);
      ctx.quadraticCurveTo(ax - 10, y + 70, ax, y + 52);
      ctx.quadraticCurveTo(ax + 10, y + 70, ax + 20, y + 165);
      ctx.lineTo(ax + 20, y + h);
      ctx.closePath();
      ctx.fill();
    }

    // Molded stone stringcourses
    ctx.fillStyle = '#1c132d';
    ctx.fillRect(x, y + 170, w, 8);
    ctx.fillRect(x, y + 360, w, 8);

    ctx.restore();
  }

  _drawCathedralArenaWall(ctx, x, y, w, h, time) {
    ctx.save();
    if (this._isReady(this.imgBossArena)) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.imgBossArena, x, y, w, h);
      ctx.restore();
      return;
    }

    // Procedural Fallback: Cathedral Nave Wall with transparent lancet window cutouts
    // Window apertures that reveal the background bloodmoon & sky
    const windows = [
      { x: x + w * 0.5, y: y + 80, w: 140, h: 420 }, // High Central Rose & Lancet
      { x: x + 160, y: y + 150, w: 90, h: 360 },     // Left High Lancet
      { x: x + 310, y: y + 200, w: 80, h: 310 },     // Left Mid Lancet
      { x: x + w - 310, y: y + 200, w: 80, h: 310 }, // Right Mid Lancet
      { x: x + w - 160, y: y + 150, w: 90, h: 360 }, // Right High Lancet
      { x: x + 110, y: y + 620, w: 120, h: 380 },    // Lower Arcade Passages
      { x: x + w - 110, y: y + 620, w: 120, h: 380 },
    ];

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    for (const win of windows) {
      const halfW = win.w / 2;
      const springY = win.y + win.h * 0.35;
      const sillY = win.y + win.h;
      ctx.moveTo(win.x - halfW, sillY);
      ctx.lineTo(win.x - halfW, springY);
      ctx.quadraticCurveTo(win.x - halfW * 0.5, win.y, win.x, win.y - 2);
      ctx.quadraticCurveTo(win.x + halfW * 0.5, win.y, win.x + halfW, springY);
      ctx.lineTo(win.x + halfW, sillY);
      ctx.closePath();
    }
    ctx.clip('evenodd');

    // Grand High Gothic Nave Wall
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#080410');
    grad.addColorStop(0.35, '#110a1c');
    grad.addColorStop(1, '#080410');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Monumental Clustered Piers (Bündelpfeiler) running from floor to ceiling
    const pierStep = 180;
    for (let px = x + 60; px < x + w; px += pierStep) {
      // Base pilaster
      ctx.fillStyle = '#160e24';
      ctx.fillRect(px - 14, y, 28, h);
      // Shafts
      ctx.fillStyle = '#1c132e';
      ctx.fillRect(px - 10, y, 6, h);
      ctx.fillRect(px + 4, y, 6, h);
      // Capitals
      ctx.fillStyle = '#2a1d42';
      ctx.fillRect(px - 16, y + 110, 32, 10);
      ctx.fillRect(px - 16, y + 320, 32, 10);
    }

    // High Cathedral Triforium Gallery Arches
    ctx.strokeStyle = '#1d1330';
    ctx.lineWidth = 2.5;
    for (let px = x + 60; px < x + w - pierStep; px += pierStep) {
      const midX = px + pierStep / 2;
      ctx.beginPath();
      ctx.moveTo(px + 14, y + 110);
      ctx.quadraticCurveTo(midX - 30, y + 10, midX, y - 10);
      ctx.quadraticCurveTo(midX + 30, y + 10, px + pierStep - 14, y + 110);
      ctx.stroke();
    }

    // Cathedral Ashlar Masonry Horizontals
    ctx.strokeStyle = '#0d0716';
    ctx.lineWidth = 1;
    for (let cy = y + 25; cy < y + h; cy += 28) {
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x + w, cy);
      ctx.stroke();
    }

    // Heavy vault springlines
    ctx.fillStyle = '#211636';
    ctx.fillRect(x, y + 116, w, 6);
    ctx.fillRect(x, y + 326, w, 6);

    ctx.restore(); // end clip

    // Window tracery, stone frames, and delicate glass glimmer
    for (const win of windows) {
      const halfW = win.w / 2;
      const springY = win.y + win.h * 0.35;
      const sillY = win.y + win.h;

      // Stone moulding surround
      ctx.strokeStyle = '#22153a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(win.x - halfW, sillY);
      ctx.lineTo(win.x - halfW, springY);
      ctx.quadraticCurveTo(win.x - halfW * 0.5, win.y, win.x, win.y - 2);
      ctx.quadraticCurveTo(win.x + halfW * 0.5, win.y, win.x + halfW, springY);
      ctx.lineTo(win.x + halfW, sillY);
      ctx.stroke();

      // Stone sill
      ctx.fillStyle = '#1c1130';
      ctx.fillRect(win.x - halfW - 4, sillY, win.w + 8, 4);

      // Delicate transparent glass sheen
      const glassGrad = ctx.createLinearGradient(win.x, win.y, win.x, sillY);
      glassGrad.addColorStop(0, 'rgba(255, 120, 100, 0.08)');
      glassGrad.addColorStop(0.5, 'rgba(180, 80, 255, 0.04)');
      glassGrad.addColorStop(1, 'rgba(100, 40, 200, 0.08)');
      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.moveTo(win.x - halfW, sillY);
      ctx.lineTo(win.x - halfW, springY);
      ctx.quadraticCurveTo(win.x - halfW * 0.5, win.y, win.x, win.y - 2);
      ctx.quadraticCurveTo(win.x + halfW * 0.5, win.y, win.x + halfW, springY);
      ctx.lineTo(win.x + halfW, sillY);
      ctx.closePath();
      ctx.fill();

      // Central stone mullion
      ctx.strokeStyle = '#150d24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(win.x, win.y + 16);
      ctx.lineTo(win.x, sillY);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawSwordPickup(ctx, pickup, time, player) {
    if (!pickup || pickup.collected) return;
    const x = Math.round(pickup.x);
    const y = Math.round(pickup.y);
    ctx.save();

    // 1. Ancient Carved Gothic Altar / Pedestal (Basalt stone plinth)
    ctx.fillStyle = '#100a1c';
    ctx.fillRect(x - 24, y + 20, 48, 8);
    ctx.fillStyle = '#1b122e';
    ctx.fillRect(x - 18, y + 14, 36, 6);
    ctx.strokeStyle = '#2d1e48';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 24, y + 20, 48, 8);

    // Glowing soul runes on altar
    const runePulse = Math.sin(time * 3.5) * 0.25 + 0.75;
    ctx.fillStyle = `rgba(0, 240, 255, ${0.85 * runePulse})`;
    ctx.fillRect(x - 12, y + 22, 24, 2);

    // 2. Vertical Radiant Light Beam / Skyward Pillar (Glowing to the heavens so player spots it immediately!)
    const beamGrad = ctx.createLinearGradient(x, y + 20, x, y - 280);
    beamGrad.addColorStop(0, `rgba(0, 240, 255, ${0.48 * runePulse})`);
    beamGrad.addColorStop(0.35, `rgba(170, 70, 255, ${0.32 * runePulse})`);
    beamGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(x - 16, y + 20);
    ctx.lineTo(x - 30, y - 280);
    ctx.lineTo(x + 30, y - 280);
    ctx.lineTo(x + 16, y + 20);
    ctx.closePath();
    ctx.fill();

    // 3. Multi-ring Pulsing Radiant Corona Halo
    const haloSize = 28 + Math.sin(time * 4) * 6;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 24 * runePulse;
    ctx.fillStyle = `rgba(0, 240, 255, ${0.25 * runePulse})`;
    ctx.beginPath();
    ctx.arc(x, y - 2, haloSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(180, 80, 255, ${0.35 * runePulse})`;
    ctx.beginPath();
    ctx.arc(x, y - 2, haloSize * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // 4. Shimmering Ascending Sparkles / Magic Motes
    for (let i = 0; i < 7; i++) {
      const spProg = ((time * 0.8 + i / 7) % 1.0);
      const spX = x + Math.sin(time * 3.5 + i * 1.8) * 16;
      const spY = y + 10 - spProg * 75;
      const spAlpha = Math.sin(spProg * Math.PI) * 0.9;
      ctx.fillStyle = i % 2 === 0 ? `rgba(255, 255, 255, ${spAlpha})` : `rgba(0, 240, 255, ${spAlpha})`;
      ctx.fillRect(Math.round(spX - 1.5), Math.round(spY - 1.5), 3, 3);
    }

    // 5. The Sword (Old Nail) - Embedded Point-Down
    // Blade
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(x, y + 15); // tip embedded in stone
    ctx.lineTo(x - 4, y - 14);
    ctx.lineTo(x - 3, y - 16);
    ctx.lineTo(x + 3, y - 16);
    ctx.lineTo(x + 4, y - 14);
    ctx.closePath();
    ctx.fill();

    // Blade central fuller / fuller highlight
    ctx.fillStyle = '#66eeff';
    ctx.fillRect(x - 1, y - 14, 2, 26);

    // Crossguard
    ctx.fillStyle = '#2a1e44';
    ctx.fillRect(x - 12, y - 18, 24, 4);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(x - 10, y - 17, 20, 2);

    // Hilt / Grip
    ctx.fillStyle = '#443322';
    ctx.fillRect(x - 2, y - 26, 4, 8);
    // Pommel
    ctx.fillStyle = '#aabbdd';
    ctx.beginPath();
    ctx.arc(x, y - 28, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // 6. Floating Interaction Prompt when Player is near
    const dist = player ? Math.hypot((player.x + player.w / 2) - x, (player.y + player.h / 2) - y) : 999;
    if (dist < 60) {
      const promptY = y - 48 + Math.sin(time * 5) * 3;
      ctx.fillStyle = 'rgba(12, 6, 22, 0.92)';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      const pw = 130, ph = 24;
      ctx.fillRect(x - pw / 2, promptY - ph / 2, pw, ph);
      ctx.strokeRect(x - pw / 2, promptY - ph / 2, pw, ph);

      ctx.fillStyle = '#ffaa33';
      ctx.fillRect(x - pw / 2 + 6, promptY - 8, 16, 16);
      ctx.fillStyle = '#0e051a';
      ctx.font = `bold 11px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('E', x - pw / 2 + 14, promptY + 4);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 12px ${UI_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('CLAIM SWORD', x - pw / 2 + 28, promptY + 4);
    }

    ctx.restore();
  }

  drawSkillPickups(ctx, skillPickups, time) {
    if (!skillPickups || !skillPickups.length) return;
    for (const s of skillPickups) {
      if (s.collected) continue;
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      const bobY = Math.sin(time * 3.5 + s.id) * 5;

      ctx.save();
      // Stone pedestal
      ctx.fillStyle = '#1c1428';
      ctx.strokeStyle = '#3d2b56';
      ctx.lineWidth = 2;
      ctx.fillRect(s.x, s.y + s.h - 12, s.w, 12);
      ctx.strokeRect(s.x, s.y + s.h - 12, s.w, 12);
      ctx.fillRect(s.x - 4, s.y + s.h - 4, s.w + 8, 4);

      // Light beam pillar
      const pillarGrad = ctx.createLinearGradient(cx, s.y - 120, cx, s.y + s.h);
      pillarGrad.addColorStop(0, 'rgba(0,0,0,0)');
      pillarGrad.addColorStop(0.5, s.glowColor ? s.glowColor + '22' : 'rgba(100,200,255,0.15)');
      pillarGrad.addColorStop(1, s.glowColor ? s.glowColor + '44' : 'rgba(100,200,255,0.3)');
      ctx.fillStyle = pillarGrad;
      ctx.fillRect(cx - 14, s.y - 120, 28, s.h + 120);

      // Levitating orb relic
      ctx.shadowColor = s.glowColor || '#66ddff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = s.color || '#ff8833';
      ctx.beginPath();
      ctx.arc(cx, cy - 8 + bobY, 11, 0, Math.PI * 2);
      ctx.fill();

      // Highlight core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy - 8 + bobY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Floating header prompt
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[ ' + s.name + ' ]', cx, s.y - 24 + bobY);
      ctx.fillStyle = s.glowColor || '#ffaa33';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('KEY [' + s.key + ']', cx, s.y - 12 + bobY);

      ctx.restore();
    }
  }

  drawBackgroundProps(ctx, props, camera, time) {
    if (!props) return;
    const cw = CANVAS_W / camera.zoom;
    const ch = CANVAS_H / camera.zoom;
    const minX = camera.x - 200, maxX = camera.x + cw + 200;
    const minY = camera.y - 200, maxY = camera.y + ch + 200;

    for (const p of props) {
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
      if (p.type === 'arch') {
        this._drawGothicArch(ctx, p.x, p.y, p.w, p.h, p.style, time);
      } else if (p.type === 'lantern') {
        this._drawHangingLantern(ctx, p.x, p.y, p.chainLen, p.color, time);
      } else if (p.type === 'streetlamp') {
        this._drawStreetlamp(ctx, p.x, p.y, p.h, p.color, time);
      } else if (p.type === 'gothicWindow') {
        this._drawGothicWindow(ctx, p.x, p.y, p.w, p.h, p.color, p.glow, time);
      } else if (p.type === 'chandelier') {
        this._drawChandelier(ctx, p.x, p.y, p.w, p.chainLen, time);
      } else if (p.type === 'roseWindow') {
        this._drawRoseWindow(ctx, p.x, p.y, p.radius, p.color, time);
      }
    }
  }

  _drawTutorialTablet(ctx, x, y, title, line1, line2, time) {
    ctx.save();
    const rx = Math.round(x);
    const ry = Math.round(y);
    const tw = 120, th = 58;

    // Ambient glow pulse
    const glowPulse = 0.85 + 0.15 * Math.sin(time * 3 + rx * 0.05);

    // Stone stele base plinth (double-tiered carved basalt pedestal)
    ctx.fillStyle = '#07040e';
    ctx.fillRect(rx - tw / 2 - 4, ry - 3, tw + 8, 4);
    ctx.fillStyle = '#1b112c';
    ctx.fillRect(rx - tw / 2 - 2, ry - 5, tw + 4, 2);

    // Dark gothic stone stele body with lancet pointed top
    ctx.fillStyle = '#100a1d';
    ctx.beginPath();
    ctx.moveTo(rx - tw / 2, ry - 3);
    ctx.lineTo(rx - tw / 2, ry - th + 14);
    ctx.quadraticCurveTo(rx - tw / 4, ry - th - 4, rx, ry - th);
    ctx.quadraticCurveTo(rx + tw / 4, ry - th - 4, rx + tw / 2, ry - th + 14);
    ctx.lineTo(rx + tw / 2, ry - 3);
    ctx.closePath();
    ctx.fill();

    // Inner recessed carved tablet plaque (ultra-dark backing for 100% crystal-clear readability)
    const pad = 4;
    ctx.fillStyle = 'rgba(7, 4, 15, 0.96)';
    ctx.beginPath();
    ctx.moveTo(rx - tw / 2 + pad, ry - 4);
    ctx.lineTo(rx - tw / 2 + pad, ry - th + 16);
    ctx.quadraticCurveTo(rx, ry - th + 2, rx + tw / 2 - pad, ry - th + 16);
    ctx.lineTo(rx + tw / 2 - pad, ry - 4);
    ctx.closePath();
    ctx.fill();

    // Weathered runic stone border
    ctx.strokeStyle = '#432d66';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Golden runic apex jewel / crown emblem
    ctx.fillStyle = `rgba(255, 215, 80, ${glowPulse})`;
    ctx.beginPath();
    ctx.arc(rx, ry - th + 8, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Text rendering with dark drop-shadow for guaranteed high contrast against any backdrop
    ctx.textAlign = 'center';

    // 1. Title header
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#05020a';
    ctx.fillText(title, rx + 1, ry - th + 20);
    ctx.fillStyle = `rgba(140, 225, 255, ${glowPulse})`;
    ctx.fillText(title, rx, ry - th + 19);

    // 2. Primary action key
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#05020a';
    ctx.fillText(line1, rx + 1, ry - th + 35);
    ctx.fillStyle = `rgba(255, 225, 110, ${glowPulse})`;
    ctx.fillText(line1, rx, ry - th + 34);

    // 3. Secondary hint
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#05020a';
    ctx.fillText(line2, rx + 1, ry - th + 49);
    ctx.fillStyle = 'rgba(215, 225, 245, 0.95)';
    ctx.fillText(line2, rx, ry - th + 48);

    ctx.restore();
  }

  _drawRoseWindow(ctx, x, y, radius = 60, color = '#ff2255', time) {
    ctx.save();
    const rx = Math.round(x);
    const ry = Math.round(y);
    const r = Math.round(radius);

    // 1. Heavy outer dark stone ashlar rosette frame (Cologne Cathedral Werkstein - 100% Solid Opaque)
    ctx.fillStyle = '#0a0514';
    ctx.beginPath();
    ctx.arc(rx, ry, r + 10, 0, Math.PI * 2);
    ctx.fill();

    // Chiseled stone dentils / crockets around outer ring
    const numDentils = 24;
    ctx.fillStyle = '#261b38';
    for (let i = 0; i < numDentils; i++) {
      const a = (i / numDentils) * Math.PI * 2;
      const dx = rx + Math.cos(a) * (r + 7);
      const dy = ry + Math.sin(a) * (r + 7);
      ctx.fillRect(Math.round(dx - 2), Math.round(dy - 2), 4, 4);
    }

    ctx.fillStyle = '#170f28';
    ctx.beginPath();
    ctx.arc(rx, ry, r + 4, 0, Math.PI * 2);
    ctx.fill();

    // 2. 12 Stained Glass Petals with Jewel-Toned Glazing (100% Solid Opaque)
    const numPetals = 12;
    const petalAngle = (Math.PI * 2) / numPetals;
    const jewelColors = [
      '#ff2255', '#ffaa22', '#3388ff', '#bb33ff',
      '#ff4477', '#ffcc33', '#22bbff', '#9922ee',
      '#ff3366', '#ff9922', '#4499ff', '#cc44ff'
    ];

    for (let i = 0; i < numPetals; i++) {
      const a1 = i * petalAngle - petalAngle * 0.44;
      const a2 = i * petalAngle + petalAngle * 0.44;
      const midA = i * petalAngle;
      const col = jewelColors[i % jewelColors.length];

      // Outer lancet petal slice
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(rx, ry, r, a1, a2);
      ctx.lineTo(rx + Math.cos(midA) * (r * 0.42), ry + Math.sin(midA) * (r * 0.42));
      ctx.closePath();
      ctx.fill();

      // Trefoil tracery cusp highlight inside each petal
      ctx.fillStyle = '#ffffff';
      const cuspX = rx + Math.cos(midA) * (r * 0.76);
      const cuspY = ry + Math.sin(midA) * (r * 0.76);
      ctx.fillRect(Math.round(cuspX - 2), Math.round(cuspY - 2), 4, 4);
    }

    // 3. Middle concentric stone ring (binding outer and inner tracery)
    ctx.strokeStyle = '#120a1f';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(rx, ry, r * 0.48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#2d1e44';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rx, ry, r * 0.48, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Inner 6-petal rosette (100% Solid Opaque)
    const innerPetals = 6;
    const innerAngle = (Math.PI * 2) / innerPetals;
    for (let i = 0; i < innerPetals; i++) {
      const a = i * innerAngle;
      ctx.fillStyle = (i % 2 === 0) ? '#ffcc22' : '#ff3366';
      ctx.beginPath();
      ctx.arc(rx + Math.cos(a) * (r * 0.26), ry + Math.sin(a) * (r * 0.26), r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Radiating dark stone mullions / spokes (Maßwerk lace)
    ctx.strokeStyle = '#0d071a';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < numPetals; i++) {
      const a = i * petalAngle;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.cos(a) * (r + 4), ry + Math.sin(a) * (r + 4));
      ctx.stroke();
    }

    // Molded stone spoke highlight
    ctx.strokeStyle = '#291b3e';
    ctx.lineWidth = 1;
    for (let i = 0; i < numPetals; i++) {
      const a = i * petalAngle;
      ctx.beginPath();
      ctx.moveTo(rx + Math.cos(a) * (r * 0.48), ry + Math.sin(a) * (r * 0.48));
      ctx.lineTo(rx + Math.cos(a) * r, ry + Math.sin(a) * r);
      ctx.stroke();
    }

    // 6. Center Golden Eye / Rosette Boss
    const centerPulse = Math.sin(time * 4) * 0.15 + 0.85;
    ctx.fillStyle = '#ffaa11';
    ctx.shadowColor = '#ffbb22';
    ctx.shadowBlur = 10 * centerPulse;
    ctx.beginPath();
    ctx.arc(rx, ry, r * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rx, ry, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Outer stone frame chiseled edge
    ctx.strokeStyle = '#392552';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry, r + 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  _drawGothicArch(ctx, x, y, w, h, style, time) {
    ctx.save();
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(w);
    const rh = Math.round(h);

    if (style === 'shrine') {
      // 1. Solid opaque masonry wall backing the entire shrine facade (no transparency)
      ctx.fillStyle = '#0f091a';
      ctx.beginPath();
      ctx.moveTo(rx - rw / 2 - 4, ry + rh);
      ctx.lineTo(rx - rw / 2 - 4, ry + 56);
      ctx.lineTo(rx, ry - 72);
      ctx.lineTo(rx + rw / 2 + 4, ry + 56);
      ctx.lineTo(rx + rw / 2 + 4, ry + rh);
      ctx.closePath();
      ctx.fill();

      // 2. Inner tympanum stone wall (100% solid opaque)
      ctx.fillStyle = '#160e26';
      ctx.beginPath();
      ctx.moveTo(rx - rw / 2 + 20, ry + rh);
      ctx.lineTo(rx - rw / 2 + 20, ry + 56);
      ctx.quadraticCurveTo(rx - rw / 4, ry - 18, rx, ry - 38);
      ctx.quadraticCurveTo(rx + rw / 4, ry - 18, rx + rw / 2 - 20, ry + 56);
      ctx.lineTo(rx + rw / 2 - 20, ry + rh);
      ctx.closePath();
      ctx.fill();

      // Cologne Cathedral Sanctuary Shrine (Bonfire canopy)
      // Clustered columns (Bündelpfeiler): three grouped stone shafts on each side
      ctx.fillStyle = '#100a1c';
      ctx.fillRect(rx - rw / 2, ry, 12, rh);
      ctx.fillStyle = '#170f28';
      ctx.fillRect(rx - rw / 2 + 10, ry, 10, rh);
      ctx.fillStyle = '#120c20';
      ctx.fillRect(rx - rw / 2 + 18, ry, 10, rh);

      ctx.fillStyle = '#120c20';
      ctx.fillRect(rx + rw / 2 - 28, ry, 10, rh);
      ctx.fillStyle = '#170f28';
      ctx.fillRect(rx + rw / 2 - 20, ry, 10, rh);
      ctx.fillStyle = '#100a1c';
      ctx.fillRect(rx + rw / 2 - 12, ry, 12, rh);

      // Molded plinth bases & capitals
      ctx.fillStyle = '#261b3c';
      ctx.fillRect(rx - rw / 2 - 2, ry + rh - 12, 32, 12);
      ctx.fillRect(rx + rw / 2 - 30, ry + rh - 12, 32, 12);
      ctx.fillRect(rx - rw / 2 - 2, ry + 56, 32, 8);
      ctx.fillRect(rx + rw / 2 - 30, ry + 56, 32, 8);

      // Pointed lancet arch with double cusped tracery
      ctx.beginPath();
      ctx.moveTo(rx - rw / 2, ry + 56);
      ctx.quadraticCurveTo(rx - rw / 4, ry - 45, rx, ry - 65);
      ctx.quadraticCurveTo(rx + rw / 4, ry - 45, rx + rw / 2, ry + 56);
      ctx.lineTo(rx + rw / 2 - 28, ry + 56);
      ctx.quadraticCurveTo(rx + rw / 4, ry - 20, rx, ry - 38);
      ctx.quadraticCurveTo(rx - rw / 4, ry - 20, rx - rw / 2 + 28, ry + 56);
      ctx.closePath();
      ctx.fillStyle = '#201635';
      ctx.fill();

      // Stone crockets (Krabben) ascending the gable
      ctx.fillStyle = '#2d1f46';
      for (let i = 0; i < 5; i++) {
        const prog = (i + 1) / 6;
        const lx = rx - rw / 2 + prog * (rw / 2);
        const ly = ry + 56 - prog * 115;
        const rxp = rx + rw / 2 - prog * (rw / 2);
        ctx.fillRect(Math.round(lx - 3), Math.round(ly - 3), 6, 6);
        ctx.fillRect(Math.round(rxp - 3), Math.round(ly - 3), 6, 6);
      }

      // Cruciform finial (Kreuzblumen) at the gable peak
      ctx.fillStyle = '#392858';
      ctx.fillRect(rx - 3, ry - 78, 6, 16);
      ctx.fillRect(rx - 8, ry - 74, 16, 5);

      // Carved stone cross in tympanum (100% Solid Opaque)
      ctx.fillStyle = '#ffaa33';
      ctx.shadowColor = '#ff9922';
      ctx.shadowBlur = 8;
      ctx.fillRect(rx - 2, ry + 20, 4, 24);
      ctx.fillRect(rx - 8, ry + 28, 16, 4);
      ctx.shadowBlur = 0;

      // Candle niches in flanking piers
      const cFlk1 = Math.sin(time * 10 + rx) * 0.15 + 0.85;
      const cFlk2 = Math.sin(time * 12 + rx * 2) * 0.15 + 0.85;
      ctx.fillStyle = '#ffaa33';
      ctx.fillRect(rx - rw / 2 + 12, ry + rh * 0.45, 4, 6 * cFlk1);
      ctx.fillRect(rx + rw / 2 - 16, ry + rh * 0.45, 4, 6 * cFlk2);
    } else if (style === 'arenaThrone') {
      // Grand High Altar & Throne Arch in Boss Arena (Bloodmoon Cathedral)
      // Solid opaque stone backing wall
      ctx.fillStyle = '#0b0614';
      ctx.fillRect(rx - rw / 2, ry, rw, rh);
      ctx.fillStyle = '#140c20';
      ctx.fillRect(rx - rw / 2 + 30, ry + 20, rw - 60, rh - 20);

      // Clustered columns (Bündelpfeiler)
      ctx.fillStyle = '#0a0614';
      ctx.fillRect(rx - rw / 2, ry, 36, rh);
      ctx.fillRect(rx + rw / 2 - 36, ry, 36, rh);
      ctx.fillStyle = '#170f26';
      ctx.fillRect(rx - rw / 2 + 10, ry, 16, rh);
      ctx.fillRect(rx + rw / 2 - 26, ry, 16, rh);

      // High pointed lancet arch with double cusped tracery
      ctx.beginPath();
      ctx.moveTo(rx - rw / 2, ry + rh);
      ctx.lineTo(rx - rw / 2, ry + 100);
      ctx.quadraticCurveTo(rx - rw / 4, ry - 30, rx, ry - 65);
      ctx.quadraticCurveTo(rx + rw / 4, ry - 30, rx + rw / 2, ry + 100);
      ctx.lineTo(rx + rw / 2, ry + rh);
      ctx.lineTo(rx + rw / 2 - 36, ry + rh);
      ctx.lineTo(rx + rw / 2 - 36, ry + 105);
      ctx.quadraticCurveTo(rx + rw / 4, ry + 8, rx, ry - 22);
      ctx.quadraticCurveTo(rx - rw / 4, ry + 8, rx - rw / 2 + 36, ry + 105);
      ctx.lineTo(rx - rw / 2 + 36, ry + rh);
      ctx.closePath();
      ctx.fillStyle = '#160e24';
      ctx.fill();

      // Grand Rose Window set in the Altar Tympanum!
      this._drawRoseWindow(ctx, rx, ry + 85, 58, '#ff2255', time);

      // Heavy forged iron chains dangling down from the vaulted ribs
      ctx.strokeStyle = '#1d142d';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(rx - 80, ry); ctx.lineTo(rx - 80, ry + rh - 120);
      ctx.moveTo(rx + 80, ry); ctx.lineTo(rx + 80, ry + rh - 120);
      ctx.stroke();

      // Stone gargoyle corbels at the arch springline
      this._drawGargoyle(ctx, rx - rw / 2 + 36, ry + 105, 1, 'folded', time);
      this._drawGargoyle(ctx, rx + rw / 2 - 36, ry + 105, -1, 'folded', time);
    } else if (style === 'arenaColonnade') {
      // Cologne Cathedral Great Arcade Nave Colonnade - 100% Solid Opaque
      ctx.fillStyle = '#0c0716';
      ctx.fillRect(rx - rw / 2, ry, rw, rh);

      ctx.fillStyle = '#100a1c';
      ctx.fillRect(rx - rw / 2, ry, 32, rh);
      ctx.fillRect(rx + rw / 2 - 32, ry, 32, rh);
      ctx.fillStyle = '#1c132f';
      ctx.fillRect(rx - rw / 2 + 8, ry, 16, rh);
      ctx.fillRect(rx + rw / 2 - 24, ry, 16, rh);

      // Pointed arch with triforium arches above
      ctx.beginPath();
      ctx.moveTo(rx - rw / 2, ry + 90);
      ctx.quadraticCurveTo(rx - rw / 4, ry, rx, ry - 30);
      ctx.quadraticCurveTo(rx + rw / 4, ry, rx + rw / 2, ry + 90);
      ctx.lineTo(rx + rw / 2 - 32, ry + 90);
      ctx.quadraticCurveTo(rx + rw / 4, ry + 24, rx, ry - 4);
      ctx.quadraticCurveTo(rx - rw / 4, ry + 24, rx - rw / 2 + 32, ry + 90);
      ctx.closePath();
      ctx.fillStyle = '#1b122e';
      ctx.fill();

      // Candlelit niches in arcade (solid color)
      ctx.fillStyle = '#ffaa33';
      ctx.fillRect(rx - 6, ry + 36, 12, 16);
    } else if (style === 'viaductBridge' || style === 'viaductPillar') {
      // Monumental Multi-tier Gothic Viaduct Bridge spanning the canyon (High-density Cologne stone style!)
      this._drawViaductBridge(ctx, rx, ry, rw, rh, time);
    } else {
      // Standard ruined gothic arch (100% solid)
      ctx.fillStyle = '#130d22';
      ctx.beginPath();
      ctx.moveTo(rx - rw / 2, ry + rh);
      ctx.lineTo(rx - rw / 2, ry + 55);
      ctx.quadraticCurveTo(rx - rw / 4, ry - 22, rx, ry - 38);
      ctx.quadraticCurveTo(rx + rw / 4, ry - 22, rx + rw / 2, ry + 55);
      ctx.lineTo(rx + rw / 2, ry + rh);
      ctx.lineTo(rx + rw / 2 - 24, ry + rh);
      ctx.lineTo(rx + rw / 2 - 24, ry + 60);
      ctx.quadraticCurveTo(rx + rw / 4, ry - 4, rx, ry - 18);
      ctx.quadraticCurveTo(rx - rw / 4, ry - 4, rx - rw / 2 + 24, ry + 60);
      ctx.lineTo(rx - rw / 2 + 24, ry + rh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  _drawViaductBridge(ctx, rx, ry, rw, rh, time) {
    ctx.save();
    const x0 = rx - Math.round(rw / 2);
    const x1 = rx + Math.round(rw / 2);
    const pierW = 56;
    const archLeft = x0 + pierW;
    const archRight = x1 - pierW;
    const span = archRight - archLeft;
    const springY = ry + 115;
    const apexY = ry + 28;

    // 1. Solid Spandrel Ashlar Masonry Wall & Full Bridge Backing (100% Solid Opaque!)
    // Renders the entire rectangular bounds with gothic stone ashlar blocks matching bg_viaducts.png
    this._drawGothicStone(ctx, x0, ry, rw, rh, true, false, time);

    // 2. Recessed 3D Perspective Barrel Vault Inside the Arch Opening
    // Deep, dark vaulted tunnel with receding perspective ribs into the abyss
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(archLeft, ry + rh);
    ctx.lineTo(archLeft, springY);
    ctx.quadraticCurveTo(archLeft + span * 0.18, apexY + 4, rx, apexY);
    ctx.quadraticCurveTo(archRight - span * 0.18, apexY + 4, archRight, springY);
    ctx.lineTo(archRight, ry + rh);
    ctx.closePath();

    // Deep shadowy tunnel gradient (deepest darkness in vault depth)
    const vaultGrad = ctx.createLinearGradient(rx, apexY, rx, ry + rh);
    vaultGrad.addColorStop(0, '#06030c');
    vaultGrad.addColorStop(0.35, '#0e0718');
    vaultGrad.addColorStop(0.70, '#140c22');
    vaultGrad.addColorStop(1, '#090412');
    ctx.fillStyle = vaultGrad;
    ctx.fill();

    // Concentric 3D Receding Vault Ribs in perspective
    const ribs = [
      { inset: 10, col: '#1c112d', w: 3 },
      { inset: 24, col: '#130a20', w: 2.5 },
      { inset: 40, col: '#0a0512', w: 2 }
    ];
    for (const r of ribs) {
      ctx.strokeStyle = r.col;
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.moveTo(archLeft + r.inset, ry + rh);
      ctx.lineTo(archLeft + r.inset, springY + r.inset * 0.3);
      ctx.quadraticCurveTo(
        archLeft + span * 0.18 + r.inset * 0.5,
        apexY + r.inset + 3,
        rx,
        apexY + r.inset
      );
      ctx.quadraticCurveTo(
        archRight - span * 0.18 - r.inset * 0.5,
        apexY + r.inset + 3,
        archRight - r.inset,
        springY + r.inset * 0.3
      );
      ctx.lineTo(archRight - r.inset, ry + rh);
      ctx.stroke();
    }

    // Heavy forged iron chain dangling from the apex of the barrel vault
    ctx.strokeStyle = '#231636';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rx, apexY);
    ctx.lineTo(rx, apexY + 85);
    ctx.stroke();
    // Iron ring at the tip of the chain
    ctx.strokeStyle = '#382550';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, apexY + 89, 4.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // 3. Radiating Voussoir Arch Ring (Wedge Stones & Center Keystone)
    const numVoussoirs = 19;
    const ringThick = 22;
    const voussoirColors = ['#281b3c', '#36264e', '#1e142e', '#412e5c', '#2b1c40'];

    for (let i = 0; i < numVoussoirs; i++) {
      const t1 = i / numVoussoirs;
      const t2 = (i + 1) / numVoussoirs;

      const getArchPt = (t, extraR) => {
        const px = archLeft + t * span;
        const archH = (springY - apexY);
        const curveFactor = 4 * t * (1 - t);
        const py = springY - curveFactor * archH - extraR;
        return { x: px, y: py };
      };

      const inPt1 = getArchPt(t1, 0);
      const inPt2 = getArchPt(t2, 0);
      const outPt1 = getArchPt(t1, ringThick);
      const outPt2 = getArchPt(t2, ringThick);

      ctx.fillStyle = voussoirColors[i % voussoirColors.length];
      ctx.beginPath();
      ctx.moveTo(inPt1.x, inPt1.y);
      ctx.lineTo(outPt1.x, outPt1.y);
      ctx.lineTo(outPt2.x, outPt2.y);
      ctx.lineTo(inPt2.x, inPt2.y);
      ctx.closePath();
      ctx.fill();

      // Top outer extrados moonlight highlight
      ctx.strokeStyle = 'rgba(150, 115, 200, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(outPt1.x, outPt1.y);
      ctx.lineTo(outPt2.x, outPt2.y);
      ctx.stroke();

      // Radial mortar seam
      ctx.strokeStyle = '#08040e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(inPt1.x, inPt1.y);
      ctx.lineTo(outPt1.x, outPt1.y);
      ctx.stroke();
    }

    // Carved Keystone at the apex of the arch (prominent projecting stone)
    ctx.fillStyle = '#4c3668';
    ctx.beginPath();
    ctx.moveTo(rx - 14, apexY + 4);
    ctx.lineTo(rx - 18, apexY - ringThick - 6);
    ctx.lineTo(rx + 18, apexY - ringThick - 6);
    ctx.lineTo(rx + 14, apexY + 4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#75549e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Carved cruciform boss on keystone
    ctx.fillStyle = '#ffaa33';
    ctx.fillRect(rx - 2, apexY - ringThick + 2, 4, 10);
    ctx.fillRect(rx - 5, apexY - ringThick + 5, 10, 3);

    // 4. Carved Stone Quatrefoil Medallion in the Spandrel Wall
    const medY = ry + 26;
    ctx.fillStyle = '#08040f';
    ctx.beginPath();
    ctx.arc(rx, medY, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2f2048';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4 lobes of the carved quatrefoil
    ctx.fillStyle = '#27193c';
    const lobeDist = 7;
    ctx.beginPath();
    ctx.arc(rx, medY - lobeDist, 6, 0, Math.PI * 2);
    ctx.arc(rx + lobeDist, medY, 6, 0, Math.PI * 2);
    ctx.arc(rx, medY + lobeDist, 6, 0, Math.PI * 2);
    ctx.arc(rx - lobeDist, medY, 6, 0, Math.PI * 2);
    ctx.fill();
    // Center boss
    ctx.fillStyle = '#4a3465';
    ctx.beginPath();
    ctx.arc(rx, medY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Pier Impost Capitals & Plinths
    // Left impost capital
    ctx.fillStyle = '#392652';
    ctx.fillRect(x0 - 4, springY - 12, pierW + 8, 12);
    ctx.fillStyle = '#644788';
    ctx.fillRect(x0 - 4, springY - 12, pierW + 8, 2);

    // Right impost capital
    ctx.fillStyle = '#392652';
    ctx.fillRect(x1 - pierW - 4, springY - 12, pierW + 8, 12);
    ctx.fillStyle = '#644788';
    ctx.fillRect(x1 - pierW - 4, springY - 12, pierW + 8, 2);

    // Base Plinths at canal floor
    ctx.fillStyle = '#1b122c';
    ctx.fillRect(x0 - 6, ry + rh - 22, pierW + 12, 22);
    ctx.fillStyle = '#3a2752';
    ctx.fillRect(x0 - 6, ry + rh - 22, pierW + 12, 3);

    ctx.fillStyle = '#1b122c';
    ctx.fillRect(x1 - pierW - 6, ry + rh - 22, pierW + 12, 22);
    ctx.fillStyle = '#3a2752';
    ctx.fillRect(x1 - pierW - 6, ry + rh - 22, pierW + 12, 3);

    // 6. Wall Sconce Torches on Left and Right Piers
    this._drawPierTorch(ctx, x0 + pierW / 2, springY + 45, time, 0);
    this._drawPierTorch(ctx, x1 - pierW / 2, springY + 45, time, 1);

    // 7. Cornice & Corbels at the top connecting to Bridge Deck
    ctx.fillStyle = '#2d1f44';
    ctx.fillRect(x0, ry, rw, 6);
    ctx.fillStyle = '#5c417e';
    ctx.fillRect(x0, ry, rw, 1.5);

    ctx.restore();
  }

  _drawPierTorch(ctx, tx, ty, time, seedOffset) {
    ctx.save();
    // Wrought-iron bracket mounted to stone pier
    ctx.strokeStyle = '#1d132e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(tx - 6, ty + 10);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx + 4, ty - 4);
    ctx.stroke();

    // Iron torch basket
    ctx.fillStyle = '#2d1f42';
    ctx.fillRect(tx - 4, ty - 6, 8, 6);

    // Dynamic flickering flame
    const flk = Math.sin(time * 12 + tx * 0.5 + seedOffset * 3) * 0.2 + 0.8;
    const flameH = 14 * flk;

    // Warm radial glow on the surrounding stone pier
    const glowGrad = ctx.createRadialGradient(tx, ty - 6, 2, tx, ty - 6, 36);
    glowGrad.addColorStop(0, 'rgba(255, 160, 40, 0.32)');
    glowGrad.addColorStop(0.5, 'rgba(255, 90, 20, 0.12)');
    glowGrad.addColorStop(1, 'rgba(255, 60, 10, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(tx, ty - 6, 36, 0, Math.PI * 2);
    ctx.fill();

    // Outer flame body
    ctx.fillStyle = '#ff6611';
    ctx.beginPath();
    ctx.ellipse(tx, ty - 6 - flameH * 0.4, 4.5, flameH * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mid flame core
    ctx.fillStyle = '#ffcc22';
    ctx.beginPath();
    ctx.ellipse(tx, ty - 6 - flameH * 0.3, 3, flameH * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright spark
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(tx, ty - 6 - flameH * 0.2, 1.5, flameH * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawHangingLantern(ctx, x, y, chainLen, color, time) {
    ctx.save();
    const sway = Math.sin(time * 2.4 + x * 0.1) * 0.05;
    ctx.translate(x, y);
    ctx.rotate(sway);

    ctx.strokeStyle = '#261b3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, chainLen);
    ctx.stroke();

    const ly = chainLen;
    ctx.fillStyle = '#170f26';
    ctx.fillRect(-8, ly, 16, 20);
    ctx.strokeStyle = '#32234e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-8, ly, 16, 20);

    const flk = Math.sin(time * 14 + x) * 0.15 + 0.85;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 * flk;
    ctx.beginPath();
    ctx.arc(0, ly + 10, 4.5 * flk, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, ly + 9, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawStreetlamp(ctx, x, y, h = 55, color = '#ffaa33', time) {
    ctx.save();
    // Iron base
    ctx.fillStyle = '#120d1e';
    ctx.fillRect(x - 6, y - 6, 12, 6);
    ctx.fillStyle = '#261b3d';
    ctx.fillRect(x - 5, y - 6, 10, 2);

    // Slender tapered iron post
    const topY = y - h;
    const postGrad = ctx.createLinearGradient(x - 2, 0, x + 2, 0);
    postGrad.addColorStop(0, '#110c1c');
    postGrad.addColorStop(0.5, '#2b1f42');
    postGrad.addColorStop(1, '#0e0917');
    ctx.fillStyle = postGrad;
    ctx.fillRect(x - 2, topY + 22, 4, h - 28);

    // Decorative mid-post collar ring
    ctx.fillStyle = '#392956';
    ctx.fillRect(x - 4, y - h * 0.5, 8, 3);

    // Ornate curved iron brackets supporting the lantern
    ctx.strokeStyle = '#251b3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 2, topY + 24);
    ctx.quadraticCurveTo(x - 10, topY + 18, x - 1, topY + 14);
    ctx.moveTo(x + 2, topY + 24);
    ctx.quadraticCurveTo(x + 10, topY + 18, x + 1, topY + 14);
    ctx.stroke();

    // Lantern base cap
    ctx.fillStyle = '#181126';
    ctx.fillRect(x - 7, topY + 14, 14, 3);

    // Glass lantern cage
    const cageW = 12, cageH = 14;
    const cageY = topY;
    ctx.strokeStyle = '#2d2146';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - cageW / 2, cageY, cageW, cageH);

    // Warm flickering gaslight flame
    const flk = Math.sin(time * 11 + x * 0.1) * 0.12 + 0.88;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * flk;
    ctx.beginPath();
    ctx.arc(x, cageY + cageH * 0.55, 3.5 * flk, 0, Math.PI * 2);
    ctx.fill();

    // White-hot core
    ctx.fillStyle = '#fff6d9';
    ctx.beginPath();
    ctx.arc(x, cageY + cageH * 0.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Iron roof cap & spire needle
    ctx.fillStyle = '#150f24';
    ctx.beginPath();
    ctx.moveTo(x - 8, cageY);
    ctx.lineTo(x, cageY - 8);
    ctx.lineTo(x + 8, cageY);
    ctx.closePath();
    ctx.fill();

    // Finial needle
    ctx.strokeStyle = '#2b1f42';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, cageY - 8);
    ctx.lineTo(x, cageY - 14);
    ctx.stroke();

    ctx.restore();
  }

  _drawGothicWindow(ctx, x, y, w = 32, h = 75, color = '#ff9933', glow = true, time) {
    ctx.save();
    const halfW = w / 2;
    const archTopY = y;
    const springY = y + h * 0.38;
    const sillY = y + h;

    // Deep recessed stone shadow
    ctx.fillStyle = '#0a0612';
    ctx.beginPath();
    ctx.moveTo(x - halfW - 3, sillY + 4);
    ctx.lineTo(x - halfW - 3, springY);
    ctx.quadraticCurveTo(x - halfW * 0.5, archTopY - 4, x, archTopY - 6);
    ctx.quadraticCurveTo(x + halfW * 0.5, archTopY - 4, x + halfW + 3, springY);
    ctx.lineTo(x + halfW + 3, sillY + 4);
    ctx.closePath();
    ctx.fill();

    // Stone sill
    ctx.fillStyle = '#231a36';
    ctx.fillRect(x - halfW - 5, sillY, w + 10, 5);
    ctx.fillStyle = '#342750';
    ctx.fillRect(x - halfW - 4, sillY, w + 8, 1.5);

    // Lancet window aperture path
    ctx.beginPath();
    ctx.moveTo(x - halfW, sillY);
    ctx.lineTo(x - halfW, springY);
    ctx.quadraticCurveTo(x - halfW * 0.5, archTopY, x, archTopY - 2);
    ctx.quadraticCurveTo(x + halfW * 0.5, archTopY, x + halfW, springY);
    ctx.lineTo(x + halfW, sillY);
    ctx.closePath();

    // Warm candlelit glass interior gradient (100% Solid Opaque)
    const winGrad = ctx.createLinearGradient(x, archTopY, x, sillY);
    if (color === '#ff2255') {
      winGrad.addColorStop(0, '#991236');
      winGrad.addColorStop(0.5, '#e62452');
      winGrad.addColorStop(1, '#ff6688');
    } else if (color === '#cc44ff') {
      winGrad.addColorStop(0, '#58108c');
      winGrad.addColorStop(0.6, '#9b2ce0');
      winGrad.addColorStop(1, '#c555ff');
    } else {
      winGrad.addColorStop(0, '#b34e0c');
      winGrad.addColorStop(0.5, '#f5901a');
      winGrad.addColorStop(1, '#ffc44d');
    }
    ctx.fillStyle = winGrad;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dark stone tracery (vertical mullion & crossbars)
    ctx.strokeStyle = '#140e21';
    ctx.lineWidth = 2;
    // Central vertical mullion
    ctx.beginPath();
    ctx.moveTo(x, archTopY + 12);
    ctx.lineTo(x, sillY);
    ctx.stroke();

    // Horizontal transom bars
    ctx.beginPath();
    ctx.moveTo(x - halfW, springY);
    ctx.lineTo(x + halfW, springY);
    ctx.moveTo(x - halfW, springY + (sillY - springY) * 0.5);
    ctx.lineTo(x + halfW, springY + (sillY - springY) * 0.5);
    ctx.stroke();

    // Rosette / trefoil in lancet head
    ctx.beginPath();
    ctx.arc(x, archTopY + 12, 4, 0, Math.PI * 2);
    ctx.stroke();

    // Outer stone frame mouldings
    ctx.strokeStyle = '#2b2040';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - halfW, sillY);
    ctx.lineTo(x - halfW, springY);
    ctx.quadraticCurveTo(x - halfW * 0.5, archTopY, x, archTopY - 2);
    ctx.quadraticCurveTo(x + halfW * 0.5, archTopY, x + halfW, springY);
    ctx.lineTo(x + halfW, sillY);
    ctx.stroke();

    ctx.restore();
  }

  _drawChandelier(ctx, x, y, w = 150, chainLen = 120, time) {
    ctx.save();
    const sway = Math.sin(time * 1.6 + x * 0.05) * 0.025;
    ctx.translate(x, y);
    ctx.rotate(sway);

    // Hanging iron chain links
    ctx.strokeStyle = '#221936';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, chainLen);
    ctx.stroke();

    const cy = chainLen;
    // Main wrought iron chandelier hoop
    ctx.fillStyle = '#140e22';
    ctx.fillRect(-w / 2, cy, w, 7);
    ctx.strokeStyle = '#2f2347';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w / 2, cy, w, 7);

    // Decorative curved iron braces connecting chain to hoop
    ctx.strokeStyle = '#261b3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cy - 35);
    ctx.quadraticCurveTo(-w * 0.25, cy - 10, -w * 0.45, cy);
    ctx.moveTo(0, cy - 35);
    ctx.quadraticCurveTo(w * 0.25, cy - 10, w * 0.45, cy);
    ctx.stroke();

    // Candles and glowing flames on the hoop
    const numCandles = 6;
    const step = (w - 20) / (numCandles - 1);
    for (let i = 0; i < numCandles; i++) {
      const cx = -w / 2 + 10 + i * step;
      // Wax candle shaft
      ctx.fillStyle = '#dcd4c2';
      ctx.fillRect(cx - 2, cy - 12, 4, 12);
      ctx.fillStyle = '#221936'; // iron drip saucer
      ctx.fillRect(cx - 4, cy, 8, 2);

      // Flickering flame
      const flk = Math.sin(time * 12 + i * 2.3 + x) * 0.15 + 0.85;
      ctx.fillStyle = '#ff9922';
      ctx.shadowColor = '#ffaa33';
      ctx.shadowBlur = 8 * flk;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 16, 2.5 * flk, 4.5 * flk, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff4cc';
      ctx.beginPath();
      ctx.arc(cx, cy - 15, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Hanging ornamental teardrop pendants beneath chandelier
    ctx.fillStyle = '#1b132c';
    for (let i = 0; i < numCandles - 1; i++) {
      const px = -w / 2 + 10 + (i + 0.5) * step;
      ctx.beginPath();
      ctx.moveTo(px, cy + 7);
      ctx.lineTo(px - 3, cy + 18);
      ctx.lineTo(px, cy + 24);
      ctx.lineTo(px + 3, cy + 18);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  drawForegroundProps(ctx, props, camera, time) {
    if (!props) return;
    const cw = CANVAS_W / camera.zoom;
    const ch = CANVAS_H / camera.zoom;
    const minX = camera.x - 100, maxX = camera.x + cw + 100;
    const minY = camera.y - 100, maxY = camera.y + ch + 100;

    for (const p of props) {
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
      if (p.type === 'tutorialTablet') {
        this._drawTutorialTablet(ctx, p.x, p.y, p.title, p.line1, p.line2, time);
      } else if (p.type === 'crystal') {
        this._drawCrystals(ctx, p.x, p.y, p.color, p.scale, time);
      } else if (p.type === 'waterDrip') {
        this._drawWaterDrip(ctx, p, time);
      } else if (p.type === 'gargoyle') {
        this._drawGargoyle(ctx, p.x, p.y, p.facing, p.wings, time);
      }
    }
  }

  _drawCrystals(ctx, x, y, colorType, scale, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const isCyan = colorType === 'cyan';
    const isPurple = colorType === 'purple';
    const colMain = isCyan ? '#33ccff' : (isPurple ? '#b844ff' : '#4488ff');
    const colLight = isCyan ? '#b3f0ff' : (isPurple ? '#e6b3ff' : '#aadcff');
    const colDark = isCyan ? '#1a7799' : (isPurple ? '#661a99' : '#1a4499');

    // Crystal shards
    const shards = [
      { dx: 0, h: 28, w: 8, angle: 0 },
      { dx: -7, h: 20, w: 6, angle: -0.25 },
      { dx: 7, h: 22, w: 6, angle: 0.22 },
      { dx: -12, h: 14, w: 5, angle: -0.5 },
      { dx: 11, h: 12, w: 4, angle: 0.45 }
    ];

    for (const s of shards) {
      ctx.save();
      ctx.translate(s.dx, 0);
      ctx.rotate(s.angle);

      // Left facet (darker)
      ctx.fillStyle = colDark;
      ctx.beginPath();
      ctx.moveTo(0, -s.h);
      ctx.lineTo(-s.w / 2, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      // Right facet (lighter)
      ctx.fillStyle = colMain;
      ctx.beginPath();
      ctx.moveTo(0, -s.h);
      ctx.lineTo(s.w / 2, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      // Highlight bevel line
      ctx.strokeStyle = colLight;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -s.h);
      ctx.lineTo(0, 0);
      ctx.stroke();

      ctx.restore();
    }

    // Gentle glint sparkle
    const glint = Math.sin(time * 3 + x) * 0.5 + 0.5;
    if (glint > 0.7) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -28, (glint - 0.7) * 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawWaterDrip(ctx, p, time) {
    // Drop cycle
    const cycle = (time * 1.5 + p.timer) % 3.0;
    const dropY = p.y + (cycle < 1.0 ? Math.pow(cycle, 2) * (p.groundY - p.y) : (p.groundY - p.y));

    // Stalactite source
    ctx.fillStyle = '#1c2130';
    ctx.beginPath();
    ctx.moveTo(p.x - 4, p.y);
    ctx.lineTo(p.x + 4, p.y);
    ctx.lineTo(p.x, p.y + 10);
    ctx.closePath();
    ctx.fill();

    // Falling droplet
    if (cycle < 1.0) {
      ctx.fillStyle = 'rgba(140, 210, 255, 0.75)';
      ctx.beginPath();
      ctx.ellipse(p.x, dropY, 2, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (cycle < 1.5) {
      // Impact ripple ring on floor
      const prog = (cycle - 1.0) / 0.5;
      ctx.strokeStyle = `rgba(140, 210, 255, ${1 - prog})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.groundY, prog * 12, prog * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawGargoyle(ctx, x, y, facing = 1, wings = 'spread', time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    // Stone cornice pedestal beneath gargoyle
    ctx.fillStyle = '#140f20';
    ctx.fillRect(-14, 0, 28, 8);
    ctx.fillStyle = '#261c38';
    ctx.fillRect(-12, 0, 24, 2);

    // Crouched stone beast body
    ctx.fillStyle = '#1a1329';
    ctx.beginPath();
    ctx.ellipse(0, -14, 11, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Taloned feet gripping the ledge
    ctx.fillStyle = '#110c1c';
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(10, -2); ctx.lineTo(12, 0); ctx.lineTo(14, 2); ctx.lineTo(4, 2);
    ctx.closePath();
    ctx.fill();

    // Stone claws highlight
    ctx.fillStyle = '#2f2347';
    ctx.fillRect(8, -2, 4, 2);

    // Muscular hunched shoulders & back
    ctx.fillStyle = '#231a38';
    ctx.beginPath();
    ctx.arc(-4, -18, 7, 0, Math.PI * 2);
    ctx.fill();

    // Horned gargoyle head
    ctx.fillStyle = '#201833';
    ctx.beginPath();
    ctx.ellipse(6, -22, 6, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Snout / jaw
    ctx.beginPath();
    ctx.moveTo(9, -24); ctx.lineTo(16, -21); ctx.lineTo(11, -17);
    ctx.closePath();
    ctx.fill();

    // Curved demonic horns
    ctx.strokeStyle = '#2d2249';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, -25);
    ctx.quadraticCurveTo(-1, -33, -6, -35);
    ctx.moveTo(6, -25);
    ctx.quadraticCurveTo(3, -34, -2, -37);
    ctx.stroke();

    // Glowing crimson eye slit
    const eyeGlint = Math.sin(time * 3 + x) * 0.25 + 0.75;
    ctx.fillStyle = `rgba(255, 34, 68, ${0.85 * eyeGlint})`;
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 6;
    ctx.fillRect(9, -23, 2.5, 1.5);
    ctx.shadowBlur = 0;

    // Bat-like gargoyle wings
    if (wings === 'spread') {
      ctx.fillStyle = '#160f24';
      ctx.strokeStyle = '#2b1f42';
      ctx.lineWidth = 1.5;

      // Fore wing (spread wide)
      ctx.beginPath();
      ctx.moveTo(-4, -20);
      ctx.quadraticCurveTo(-15, -42, -26, -46); // upper wing thumb
      ctx.quadraticCurveTo(-18, -32, -28, -24); // wing scallop 1
      ctx.quadraticCurveTo(-16, -20, -22, -10); // wing scallop 2
      ctx.quadraticCurveTo(-10, -12, -2, -14);  // wing scallop 3
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wing rib bones
      ctx.beginPath();
      ctx.moveTo(-4, -20); ctx.lineTo(-26, -46);
      ctx.moveTo(-4, -20); ctx.lineTo(-28, -24);
      ctx.moveTo(-4, -20); ctx.lineTo(-22, -10);
      ctx.stroke();
    } else {
      // Folded bat wings against back
      ctx.fillStyle = '#150e22';
      ctx.beginPath();
      ctx.moveTo(-6, -22);
      ctx.lineTo(-18, -32);
      ctx.lineTo(-14, -12);
      ctx.lineTo(-4, -10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2a1e3f';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Weathered stone chisel highlights
    ctx.fillStyle = '#3c2c5c';
    ctx.fillRect(-2, -20, 2, 2);
    ctx.fillRect(4, -16, 2, 2);

    ctx.restore();
  }

  drawPlatforms(ctx, platforms, camera, time, level) {
    const cw = CANVAS_W / camera.zoom;
    const ch = CANVAS_H / camera.zoom;
    const minX = camera.x - 60, maxX = camera.x + cw + 60;
    const minY = camera.y - 60, maxY = camera.y + ch + 60;

    for (const p of platforms) {
      if (p.x + p.w < minX || p.x > maxX || p.y + p.h < minY || p.y > maxY) continue;

      if (p.type === 'oneway') {
        this._drawOneWay(ctx, p, time);
      } else if (p.type === 'moving') {
        this._drawMoving(ctx, p, time);
      } else if (p.isGate) {
        this._drawFogGate(ctx, p, level.gateClosed, time);
      } else {
        this._drawSolid(ctx, p, time);
      }
    }
  }

  _drawGothicStone(ctx, rx, ry, rw, rh, isBridge, hasBalustrade, time) {
    ctx.save();

    // 1. Solid opaque stone foundation backing (palette matching bg_viaducts.png)
    ctx.fillStyle = '#0a0714';
    ctx.fillRect(rx, ry, rw, rh);

    const isWall = (rw <= 48 && rh > 48);

    // Weathered gothic stone courses matching bg_viaducts.png & bg_spires.png
    // Palette of weathered dark slate & basalt:
    const STONE_COURSES = [
      { fill: '#161224', hi: '#241c38', sh: '#0b0816' },
      { fill: '#1b152a', hi: '#2b2140', sh: '#0d0a19' },
      { fill: '#211933', hi: '#32274d', sh: '#100c1e' },
      { fill: '#261e3b', hi: '#382b54', sh: '#130f23' },
      { fill: '#1e172f', hi: '#2e2345', sh: '#0f0b1c' }
    ];

    const courseH = isWall ? 20 : 16;
    const numCourses = Math.ceil(rh / courseH);

    // Vertical wall styling: elegant buttress pilasters with base and capital mouldings
    if (isWall) {
      // Background stone courses
      for (let c = 0; c < numCourses; c++) {
        const cy = ry + c * courseH;
        const ch = Math.min(courseH, ry + rh - cy);
        const col = STONE_COURSES[c % STONE_COURSES.length];

        ctx.fillStyle = col.fill;
        ctx.fillRect(rx, cy, rw, ch);

        // Course mortar seam
        ctx.fillStyle = col.sh;
        ctx.fillRect(rx, cy + ch - 1, rw, 1);
        ctx.fillStyle = col.hi;
        ctx.fillRect(rx, cy, rw, 1);
      }

      // Outer pilaster buttress borders (3px left and right)
      ctx.fillStyle = '#2b2042';
      ctx.fillRect(rx, ry, 3, rh);
      ctx.fillStyle = '#0a0714';
      ctx.fillRect(rx + rw - 3, ry, 3, rh);

      // Capital moulding at top of wall
      ctx.fillStyle = '#3a2b54';
      ctx.fillRect(rx - 2, ry, rw + 4, 4);
      ctx.fillStyle = '#654e8e';
      ctx.fillRect(rx - 2, ry, rw + 4, 1);

      // Base plinth moulding at bottom of wall
      ctx.fillStyle = '#1e162f';
      ctx.fillRect(rx - 2, ry + rh - 6, rw + 4, 6);
      ctx.fillStyle = '#392a52';
      ctx.fillRect(rx - 2, ry + rh - 6, rw + 4, 1.5);

      // Occasional horizontal stringcourse band every 80px
      for (let sy = ry + 80; sy < ry + rh - 30; sy += 80) {
        ctx.fillStyle = '#2d2244';
        ctx.fillRect(rx - 1, sy, rw + 2, 4);
        ctx.fillStyle = '#543f75';
        ctx.fillRect(rx - 1, sy, rw + 2, 1);
      }

      ctx.restore();
      return;
    }

    // 2. Horizontal Ashlar Courses (Platform & Floor Slabs)
    for (let c = 0; c < numCourses; c++) {
      const cy = ry + c * courseH;
      const ch = Math.min(courseH, ry + rh - cy);
      if (ch <= 0) break;

      const blockW = 44;
      const offset = (c % 2 === 0) ? 0 : Math.round(blockW * 0.5);

      for (let bx = rx - offset; bx < rx + rw; bx += blockW) {
        const drawX = Math.max(rx, bx);
        const drawR = Math.min(rx + rw, bx + blockW);
        const bw = drawR - drawX;
        if (bw <= 0) continue;

        const h = Math.abs(Math.sin((bx * 17.3 + cy * 31.7)) * 10000);
        const col = STONE_COURSES[Math.floor(h) % STONE_COURSES.length];

        // Stone block fill
        ctx.fillStyle = col.fill;
        ctx.fillRect(drawX + 1, cy + 1, bw - 1, ch - 1);

        // Soft moonlit stone bevel (top and left)
        ctx.fillStyle = col.hi;
        ctx.fillRect(drawX + 1, cy + 1, bw - 1, 1);
        ctx.fillRect(drawX + 1, cy + 1, 1, ch - 1);

        // Subtle dark mortar seam (bottom and right)
        ctx.fillStyle = col.sh;
        ctx.fillRect(drawX + 1, cy + ch - 1, bw - 1, 1);
        ctx.fillRect(drawX + bw - 1, cy + 1, 1, ch - 1);

        // Occasional stone texture chip / chisel mark
        if (Math.floor(h * 2.3) % 9 === 0 && bw > 18 && ch > 8) {
          ctx.fillStyle = '#080512';
          ctx.fillRect(drawX + 8, cy + 5, 4, 1);
        }
      }
    }

    // 3. Top Roadway / Platform Flagstone Curb (Walking Surface)
    if (rh >= 14) {
      // Molded Flagstone Curb slab
      ctx.fillStyle = '#2c2242';
      ctx.fillRect(rx, ry, rw, 5);

      // Moonlight top rim glint matching bg_viaducts.png moonlit edges
      ctx.fillStyle = '#7a649f';
      ctx.fillRect(rx, ry, rw, 1);
      ctx.fillStyle = '#4c3a6e';
      ctx.fillRect(rx, ry + 1, rw, 1);

      // Flagstone vertical paving joints every 24px
      ctx.fillStyle = '#0c0817';
      for (let px = rx + 24; px < rx + rw - 6; px += 24) {
        ctx.fillRect(px, ry, 1, 5);
      }

      // Subtle shadow groove under the flagstone curb
      ctx.fillStyle = '#07050e';
      ctx.fillRect(rx, ry + 5, rw, 1);
    }

    // 4. Underside Carved Stone Corbels (stepped brackets under openwork bridges)
    if (rh <= 60 && ry + rh < 1300) {
      const corbelStep = 52;
      for (let sx = rx + 14; sx <= rx + rw - 14; sx += corbelStep) {
        // Stepped gothic corbel bracket
        ctx.fillStyle = '#150f24';
        ctx.beginPath();
        ctx.moveTo(sx - 8, ry + rh);
        ctx.lineTo(sx + 8, ry + rh);
        ctx.lineTo(sx + 4, ry + rh + 9);
        ctx.lineTo(sx - 4, ry + rh + 9);
        ctx.closePath();
        ctx.fill();

        // Moonlight glint on left edge of corbel
        ctx.fillStyle = '#392a54';
        ctx.fillRect(sx - 8, ry + rh, 2, 4);
        ctx.fillRect(sx - 5, ry + rh + 4, 2, 5);

        // Deep shadow on right edge of corbel
        ctx.fillStyle = '#080510';
        ctx.fillRect(sx + 6, ry + rh, 2, 4);
        ctx.fillRect(sx + 3, ry + rh + 4, 2, 5);
      }

      // Shallow carved arching corbel table profile between brackets
      ctx.strokeStyle = '#0a0714';
      ctx.lineWidth = 1;
      for (let sx = rx + 14; sx + corbelStep <= rx + rw; sx += corbelStep) {
        ctx.beginPath();
        ctx.moveTo(sx + 8, ry + rh);
        ctx.quadraticCurveTo(sx + corbelStep / 2, ry + rh + 4, sx + corbelStep - 8, ry + rh);
        ctx.stroke();
      }
    }

    // 5. Subtle outer boundary definition
    ctx.strokeStyle = '#090613';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.restore();
  }

  _drawSolid(ctx, p, time) {
    const rx = Math.round(p.x);
    const ry = Math.round(p.y);
    const rw = Math.round(p.w);
    const rh = Math.round(p.h);
    this._drawGothicStone(ctx, rx, ry, rw, rh, false, false, time);
  }

  _drawOneWay(ctx, p, time) {
    const rx = Math.round(p.x);
    const ry = Math.round(p.y);
    const rw = Math.round(p.w);
    const rh = Math.round(p.h);
    ctx.save();

    // 1. Solid Ashlar Stone Walkway Slab
    this._drawGothicStone(ctx, rx, ry, rw, rh, false, false, time);

    // 2. Heavy Carved Stone Corbels (Brackets) Supporting the Ends and Middle
    ctx.fillStyle = '#140c22';
    // Left end corbel
    ctx.beginPath();
    ctx.moveTo(rx, ry + rh);
    ctx.lineTo(rx, ry + rh + 12);
    ctx.lineTo(rx + 16, ry + rh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a2752';
    ctx.fillRect(rx, ry + rh, 3, 7);

    // Right end corbel
    ctx.fillStyle = '#140c22';
    ctx.beginPath();
    ctx.moveTo(rx + rw, ry + rh);
    ctx.lineTo(rx + rw, ry + rh + 12);
    ctx.lineTo(rx + rw - 16, ry + rh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a2752';
    ctx.fillRect(rx + rw - 3, ry + rh, 3, 7);

    // Intermediate corbels if long
    if (rw >= 140) {
      const mid = Math.round(rx + rw / 2);
      ctx.fillStyle = '#140c22';
      ctx.beginPath();
      ctx.moveTo(mid - 7, ry + rh);
      ctx.lineTo(mid + 7, ry + rh);
      ctx.lineTo(mid, ry + rh + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a2752';
      ctx.fillRect(mid - 7, ry + rh, 3, 4);
    }

    // 3. Delicate Wrought-Iron Balustrade Handrail (10px high, completely openwork)
    ctx.strokeStyle = '#221736';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Handrail top bar
    ctx.moveTo(rx + 4, ry - 10);
    ctx.lineTo(rx + rw - 4, ry - 10);
    // Vertical spindles every 20px
    for (let bx = rx + 12; bx < rx + rw - 8; bx += 20) {
      ctx.moveTo(bx, ry);
      ctx.lineTo(bx, ry - 10);
      // Gothic pointed cusp
      ctx.moveTo(bx - 3, ry - 3);
      ctx.lineTo(bx, ry - 7);
      ctx.lineTo(bx + 3, ry - 3);
    }
    ctx.stroke();

    // Handrail top moonlit violet glint
    ctx.strokeStyle = '#624b86';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + 4, ry - 11);
    ctx.lineTo(rx + rw - 4, ry - 11);
    ctx.stroke();

    ctx.restore();
  }

  _drawMoving(ctx, p, time) {
    const rx = Math.round(p.x);
    const ry = Math.round(p.y);
    const rw = Math.round(p.w);
    const rh = Math.round(p.h);
    ctx.save();

    // Heavy iron chains hanging from above
    ctx.strokeStyle = '#191126';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rx + 8, ry - 200);
    ctx.lineTo(rx + 8, ry);
    ctx.moveTo(rx + rw - 8, ry - 200);
    ctx.lineTo(rx + rw - 8, ry);
    ctx.stroke();

    // Gothic iron-reinforced stone carriage slab
    ctx.fillStyle = '#1c152a';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#392a54';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    // Side iron brackets
    ctx.fillStyle = '#261b3a';
    ctx.fillRect(rx + 4, ry - 4, 8, 4);
    ctx.fillRect(rx + rw - 12, ry - 4, 8, 4);

    // Glowing vampire-runic conduits
    const pulse = Math.sin(time * 5) * 0.2 + 0.8;
    ctx.strokeStyle = `rgba(190, 70, 255, ${0.75 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx + 12, ry + Math.round(rh / 2));
    ctx.lineTo(rx + rw - 12, ry + Math.round(rh / 2));
    ctx.stroke();

    // Center runic glyph
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#bb44ff';
    ctx.shadowBlur = 8 * pulse;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('❖', rx + Math.round(rw / 2) - 6, ry + Math.round(rh / 2) + 4);

    ctx.restore();
  }

  _drawFogGate(ctx, p, isClosed, time) {
    const rx = Math.round(p.x);
    const ry = Math.round(p.y);
    const rw = Math.round(p.w);
    const rh = Math.round(p.h);
    ctx.save();

    // Stone gate pillars framing the entrance
    ctx.fillStyle = '#1c2130';
    ctx.fillRect(rx - 8, ry - 20, 16, rh + 20);
    ctx.fillRect(rx + rw - 8, ry - 20, 16, rh + 20);
    ctx.strokeStyle = '#38455e';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx - 8, ry - 20, 16, rh + 20);
    ctx.strokeRect(rx + rw - 8, ry - 20, 16, rh + 20);

    // Arch header
    ctx.fillStyle = '#252d42';
    ctx.fillRect(rx - 12, ry - 28, rw + 24, 12);

    if (isClosed) {
      // Intimidating Swirling Void Fog Gate
      const pulse = Math.sin(time * 5) * 0.15 + 0.85;

      // Outer violet glow
      ctx.shadowColor = '#cc44ff';
      ctx.shadowBlur = 18 * pulse;

      // Fog layers with wavy curves
      for (let i = 0; i < 3; i++) {
        const fAlpha = (0.28 + i * 0.18) * pulse;
        ctx.fillStyle = i % 2 === 0 ? `rgba(130, 20, 200, ${fAlpha})` : `rgba(70, 10, 160, ${fAlpha})`;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        for (let py = ry; py <= ry + rh; py += 16) {
          const wave = Math.sin(py * 0.08 + time * (4 + i * 2)) * (6 + i * 2);
          ctx.lineTo(rx + Math.round(rw / 2) + wave, py);
        }
        ctx.lineTo(rx + rw, ry + rh);
        ctx.lineTo(rx + rw, ry);
        ctx.closePath();
        ctx.fill();
      }

      // Demonic runes floating in mist
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      const runeY1 = ry + Math.round((time * 30) % rh);
      const runeY2 = ry + Math.round(((time * 30) + rh / 2) % rh);
      ctx.fillText('✦', rx + Math.round(rw / 2) - 6, runeY1);
      ctx.fillText('✦', rx + Math.round(rw / 2) - 6, runeY2);

      // Boundary barrier lines
      ctx.strokeStyle = '#e699ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);
    } else {
      // Open portal: gentle mist on ground
      ctx.fillStyle = 'rgba(100, 60, 160, 0.2)';
      ctx.fillRect(rx, ry + rh - 18, rw, 18);
    }

    ctx.restore();
  }
}

// ============================================================================
// 2D DYNAMIC LIGHTING SYSTEM (Lightmaps, Radial Sources & Cinematic Vignette)
// ============================================================================
class LightingSystem {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = CANVAS_W;
    this.height = CANVAS_H;
    this._initCanvas();
  }

  _initCanvas() {
    if (typeof document !== 'undefined' && document.createElement) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.ctx = this.canvas.getContext ? this.canvas.getContext('2d') : null;
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
      }
    }
  }

  resize(w, h) {
    this.width = w; this.height = h;
    if (this.canvas) {
      this.canvas.width = w; this.canvas.height = h;
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
      }
    }
  }

  render(ctx, camera, player, boss, enemies, bonfires, projectiles, props, time, swordPickup) {
    if (!this.ctx || !this.canvas) return;
    const lctx = this.ctx;
    const cw = this.width, ch = this.height;

    // 1. Vampire City Ambient Darkness
    // The open night sky, stars and moon above are the natural SOURCE of light and are never shrouded in shadow!
    // Darkness only pools softly down in the lower viaducts, streets, and inside the enclosed cathedral.
    const isInsideArena = player.x > 6750;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, cw, ch);

    if (isInsideArena) {
      // Inside cathedral: atmospheric enclosed twilight darkness
      lctx.fillStyle = 'rgba(12, 7, 20, 0.30)';
      lctx.fillRect(0, 0, cw, ch);
    } else {
      // Outdoors: Sky & Moon at top are luminous and completely clear (alpha = 0)!
      // Darkness increases smoothly towards ground/canyons, but stays soft (max ~0.38).
      const darkGrad = lctx.createLinearGradient(0, 0, 0, ch);
      darkGrad.addColorStop(0, 'rgba(14, 8, 22, 0)');        // Top open sky & moon: 100% CLEAR
      darkGrad.addColorStop(0.24, 'rgba(14, 8, 22, 0.04)');  // Upper clouds & moon halo: clear
      darkGrad.addColorStop(0.55, 'rgba(14, 8, 22, 0.22)');  // Mid rooftops / viaducts: soft twilight
      darkGrad.addColorStop(0.85, 'rgba(14, 8, 22, 0.36)');  // Lower streets: moody gothic shadow
      darkGrad.addColorStop(1.0, 'rgba(14, 8, 22, 0.42)');
      lctx.fillStyle = darkGrad;
      lctx.fillRect(0, 0, cw, ch);
    }

    // 2. Cut out light sources using destination-out
    lctx.globalCompositeOperation = 'destination-out';

    const toScreen = (wx, wy) => ({
      x: (wx - camera.x - camera.shakeX) * camera.zoom,
      y: (wy - camera.y - camera.shakeY) * camera.zoom
    });

    const addLight = (wx, wy, radius, intensity = 1.0, flicker = 0) => {
      const pos = toScreen(wx, wy);
      const rad = radius * camera.zoom * (1 + flicker);
      if (pos.x + rad < 0 || pos.x - rad > cw || pos.y + rad < 0 || pos.y - rad > ch) return;

      const grad = lctx.createRadialGradient(pos.x, pos.y, Math.max(1, rad * 0.08), pos.x, pos.y, rad);
      grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, intensity)})`);
      grad.addColorStop(0.35, `rgba(255, 255, 255, ${Math.min(1, intensity * 0.75)})`);
      grad.addColorStop(0.7, `rgba(255, 255, 255, ${Math.min(1, intensity * 0.25)})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      lctx.fillStyle = grad;
      lctx.beginPath();
      lctx.arc(pos.x, pos.y, rad, 0, Math.PI * 2);
      lctx.fill();
    };

    // A. CELESTIAL MOONLIGHT CUTOUT
    // Cut out radiant moonlight directly so moon and night sky are always shining bright!
    if (!isInsideArena) {
      const moonX = cw * 0.68 - camera.x * 0.02;
      const moonY = 130 - camera.y * 0.02;
      const mRad = 340;
      const mGrad = lctx.createRadialGradient(moonX, moonY, 30, moonX, moonY, mRad);
      mGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      mGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.85)');
      mGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.35)');
      mGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      lctx.fillStyle = mGrad;
      lctx.beginPath();
      lctx.arc(moonX, moonY, mRad, 0, Math.PI * 2);
      lctx.fill();
    }

    // B. Player light (Knight's glowing mask & soul aura)
    addLight(player.x + player.w / 2, player.y + player.h * 0.35, 160, 0.98);

    // C. Bonfires
    if (bonfires) {
      for (const b of bonfires) {
        if (b.lit) {
          const flk = Math.sin(time * 12 + b.id) * 0.07 + Math.cos(time * 23 + b.id) * 0.03;
          addLight(b.x + b.w / 2, b.y + 10, 240, 1.0, flk);
        } else {
          addLight(b.x + b.w / 2, b.y + 18, 70, 0.35);
        }
      }
    }

    // D. Enemies Visibility Light (Guarantees enemies are always clearly visible in any darkness!)
    if (enemies) {
      for (const e of enemies) {
        if (!e.dead) {
          const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
          const r = e.type === 'guard' ? 110 : (e.type === 'crawler' ? 85 : 95);
          addLight(ecx, ecy, r, 0.75);
        }
      }
    }

    // E. Boss aura
    if (boss && boss.active && !boss.dead) {
      const bFlk = Math.sin(time * 6) * 0.1;
      addLight(boss.x + boss.w / 2, boss.y + boss.h / 2, 300, 0.92, bFlk);
    }

    // E2. Cathedral Arena Background Torches & Candelabras Light
    if (isInsideArena) {
      const arenaTorches = [
        { x: 7070, y: 1180, r: 150 },
        { x: 7370, y: 1180, r: 160 },
        { x: 7580, y: 1180, r: 160 },
        { x: 7880, y: 1180, r: 150 },
        { x: 7475, y: 760, r: 240 }
      ];
      for (const t of arenaTorches) {
        const flk = Math.sin(time * 11 + t.x * 0.1) * 0.08;
        addLight(t.x, t.y, t.r, 0.88, flk);
      }
    }

    // F. Projectiles
    if (projectiles) {
      for (const p of projectiles) {
        if (!p.dead) {
          const r = p.type === 'fireball' ? 150 : (p.type === 'ice_nova' ? 170 : 100);
          addLight(p.x, p.y, r, 0.9);
        }
      }
    }

    // G. Environmental props (streetlamps, gothic windows, chandeliers, lanterns, crystals)
    if (props) {
      for (const pr of props) {
        if (pr.type === 'streetlamp') {
          const lFlk = Math.sin(time * 9 + pr.x) * 0.07;
          addLight(pr.x, pr.y - (pr.h || 55) + 12, 170, 0.95, lFlk);
        } else if (pr.type === 'gothicWindow') {
          addLight(pr.x, pr.y + (pr.h || 75) / 2, 130, 0.85);
        } else if (pr.type === 'chandelier') {
          const cFlk = Math.sin(time * 8 + pr.x) * 0.05;
          addLight(pr.x, pr.y + (pr.chainLen || 120) + 15, 230, 0.95, cFlk);
        } else if (pr.type === 'lantern') {
          const lFlk = Math.sin(time * 10 + pr.x) * 0.06;
          addLight(pr.x, pr.y + 12, 130, 0.9, lFlk);
        } else if (pr.type === 'crystal') {
          addLight(pr.x, pr.y, 85, 0.7);
        } else if (pr.type === 'tutorialTablet') {
          addLight(pr.x, pr.y - 25, 130, 0.95);
        }
      }
    }

    // H. Radiant Sword Pickup on Watchtower Roof
    if (swordPickup && !swordPickup.collected) {
      addLight(swordPickup.x, swordPickup.y, 250, 1.0);
    }

    // 3. Colored light tinting
    lctx.globalCompositeOperation = 'source-over';

    const addColorGlow = (wx, wy, radius, colorInner, colorOuter) => {
      const pos = toScreen(wx, wy);
      const rad = radius * camera.zoom;
      if (pos.x + rad < 0 || pos.x - rad > cw || pos.y + rad < 0 || pos.y - rad > ch) return;
      const grad = lctx.createRadialGradient(pos.x, pos.y, 2, pos.x, pos.y, rad);
      grad.addColorStop(0, colorInner);
      grad.addColorStop(1, colorOuter);
      lctx.fillStyle = grad;
      lctx.beginPath();
      lctx.arc(pos.x, pos.y, rad, 0, Math.PI * 2);
      lctx.fill();
    };

    // Sword pickup celestial glow
    if (swordPickup && !swordPickup.collected) {
      addColorGlow(swordPickup.x, swordPickup.y, 220, 'rgba(0, 240, 255, 0.38)', 'rgba(0, 240, 255, 0)');
    }

    // Warm golden bonfire light
    if (bonfires) {
      for (const b of bonfires) {
        if (b.lit) {
          addColorGlow(b.x + b.w / 2, b.y + 10, 190, 'rgba(255, 140, 40, 0.24)', 'rgba(255, 80, 0, 0)');
        }
      }
    }

    // Cathedral Arena background torches & stained glass colored glow
    if (isInsideArena) {
      const arenaTorches = [
        { x: 7070, y: 1180, r: 130 },
        { x: 7370, y: 1180, r: 140 },
        { x: 7580, y: 1180, r: 140 },
        { x: 7880, y: 1180, r: 130 },
        { x: 7475, y: 760, r: 220 }
      ];
      for (const t of arenaTorches) {
        addColorGlow(t.x, t.y, t.r, 'rgba(255, 150, 45, 0.22)', 'rgba(255, 75, 10, 0)');
      }
    }
    // Pale ethereal soul light on player
    addColorGlow(player.x + player.w / 2, player.y + player.h * 0.35, 115, 'rgba(120, 200, 255, 0.16)', 'rgba(80, 140, 255, 0)');

    // Enemy distinctive aura / eye glow in darkness
    if (enemies) {
      for (const e of enemies) {
        if (!e.dead) {
          const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
          if (e.type === 'crawler') {
            addColorGlow(ecx, ecy, 70, 'rgba(255, 80, 30, 0.22)', 'rgba(255, 40, 0, 0)');
          } else if (e.type === 'guard') {
            addColorGlow(ecx, ecy, 90, 'rgba(255, 150, 40, 0.22)', 'rgba(255, 90, 0, 0)');
          } else if (e.type === 'flyer') {
            addColorGlow(ecx, ecy, 80, 'rgba(180, 70, 255, 0.24)', 'rgba(120, 20, 200, 0)');
          }
        }
      }
    }

    // Environmental props colored glow
    if (props) {
      for (const pr of props) {
        if (pr.type === 'streetlamp') {
          addColorGlow(pr.x, pr.y - (pr.h || 55) + 12, 140, 'rgba(255, 175, 60, 0.26)', 'rgba(255, 110, 20, 0)');
        } else if (pr.type === 'gothicWindow' && pr.glow) {
          const c = pr.color === '#ff2255' ? 'rgba(255, 40, 80, 0.28)' : (pr.color === '#cc44ff' ? 'rgba(190, 60, 255, 0.25)' : 'rgba(255, 160, 40, 0.22)');
          addColorGlow(pr.x, pr.y + (pr.h || 75) / 2, 110, c, 'rgba(200, 80, 20, 0)');
        } else if (pr.type === 'chandelier') {
          addColorGlow(pr.x, pr.y + (pr.chainLen || 120) + 15, 180, 'rgba(255, 150, 40, 0.25)', 'rgba(255, 70, 10, 0)');
        } else if (pr.type === 'tutorialTablet') {
          addColorGlow(pr.x, pr.y - 25, 110, 'rgba(140, 210, 255, 0.22)', 'rgba(100, 160, 255, 0)');
        }
      }
    }

    // Menacing void purple glow on boss
    if (boss && boss.active && !boss.dead) {
      addColorGlow(boss.x + boss.w / 2, boss.y + boss.h / 2, 260, 'rgba(170, 40, 240, 0.26)', 'rgba(120, 0, 180, 0)');
    }

    // 4. Draw lighting canvas to main screen
    ctx.drawImage(this.canvas, 0, 0);

    // 5. Cinematic Radial Vignette (Gentle edge darkening that leaves the sky & center clear)
    const vigGrad = ctx.createRadialGradient(cw / 2, ch / 2, cw * 0.42, cw / 2, ch / 2, cw * 0.78);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.12)');
    vigGrad.addColorStop(1, 'rgba(8, 4, 16, 0.38)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, cw, ch);
  }
}

// ============================================================================
// PARALLAX BACKGROUND (Gothic Ruins, Broken Eclipse & Volumetric Mist)
// ============================================================================
class Background {
  constructor(levelWidth) {
    this.levelWidth = levelWidth || 8200;

    // Custom Generated Parallax Image Layers (User provided assets)
    this.imgSky = typeof Image !== 'undefined' ? new Image() : null;
    this.imgSpires = typeof Image !== 'undefined' ? new Image() : null;
    this.imgViaducts = typeof Image !== 'undefined' ? new Image() : null;
    this.imgBossArena = typeof Image !== 'undefined' ? new Image() : null;
    const v = typeof ASSET_VERSION !== 'undefined' ? '?' + ASSET_VERSION : '?v=1.0.2';
    if (this.imgSky) this.imgSky.src = 'bg_sky.png' + v;
    if (this.imgSpires) this.imgSpires.src = 'bg_spires.png' + v;
    if (this.imgViaducts) this.imgViaducts.src = 'bg_viaducts.png' + v;
    if (this.imgBossArena) this.imgBossArena.src = 'bg_1st_boss_arena.png' + v;

    // Atmospheric night stars / celestial motes
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: rand(0, CANVAS_W),
        y: rand(0, CANVAS_H * 0.60),
        size: rand(1.2, 2.8),
        speed: rand(0.3, 0.9),
        blink: rand(0, Math.PI * 2)
      });
    }

    // Atmospheric floating embers / violet spores
    this.spores = [];
    for (let i = 0; i < 45; i++) {
      this.spores.push({
        x: rand(0, CANVAS_W),
        y: rand(40, CANVAS_H - 40),
        vx: rand(-10, -25),
        vy: rand(-4, 4),
        size: rand(1.5, 3.5),
        phase: rand(0, Math.PI * 2),
        color: Math.random() < 0.5 ? '#b854ff' : (Math.random() < 0.6 ? '#66ddff' : '#ffaa44')
      });
    }

    // Volumetric purple clouds drifting across sky
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      this.clouds.push({
        x: rand(0, CANVAS_W * 1.5),
        y: rand(30, CANVAS_H * 0.48),
        w: rand(180, 380),
        h: rand(65, 120),
        speed: rand(4, 12),
        alpha: rand(0.22, 0.42)
      });
    }

    // Layer 1: Distant Gothic Skyline & Cathedral Spires (Parallax X: 0.12, Parallax Y: 0.10)
    this.distantSpires = [];
    const numSpires = 32;
    for (let i = 0; i < numSpires; i++) {
      this.distantSpires.push({
        x: (this.levelWidth / numSpires) * i + rand(-100, 100),
        h: rand(420, 680),
        w: rand(140, 280),
        spireH: rand(120, 220),
        type: i % 4 // 0: twin needle spires, 1: grand cathedral dome, 2: stepped buttress, 3: needle tower with cross
      });
    }

    // Layer 2: Mid-distance Gothic Viaducts & Arched Bridges (Parallax X: 0.28, Parallax Y: 0.22)
    this.midArches = [];
    const numArches = 28;
    for (let i = 0; i < numArches; i++) {
      this.midArches.push({
        x: (this.levelWidth / numArches) * i + rand(-80, 80),
        h: rand(300, 520),
        w: rand(200, 380),
        pillarW: rand(32, 54),
        hasWindow: Math.random() < 0.7,
        hasGargoyle: Math.random() < 0.4,
        windowColor: Math.random() < 0.8 ? '#ffaa33' : '#ff4466'
      });
    }

    // Layer 3: Closer City Skyline - Gables, Chimneys & Battlements (Parallax X: 0.48, Parallax Y: 0.38)
    this.nearColumns = [];
    const numColumns = 26;
    for (let i = 0; i < numColumns; i++) {
      this.nearColumns.push({
        x: (this.levelWidth / numColumns) * i + rand(-60, 60),
        h: rand(220, 440),
        w: rand(80, 160),
        roofH: rand(60, 120),
        hasFinial: Math.random() < 0.6
      });
    }
  }

  _isReady(img) {
    return img && img.complete && (img.naturalWidth > 0 || img.width > 0);
  }

  draw(ctx, camera, time) {
    const hasCustomSky = this._isReady(this.imgSky);
    const hasCustomSpires = this._isReady(this.imgSpires);
    const hasCustomViaducts = this._isReady(this.imgViaducts);

    // 1. SKY LAYER (Layer 1 - Custom Generated or Procedural Hi-Bit Sky)
    if (hasCustomSky) {
      const skyW = 2000, skyH = 820;
      const skyX = -Math.round((camera.x * 0.05) % skyW);
      const skyY = Math.round(-30 - camera.y * 0.04);
      const startX = skyX <= 0 ? skyX : skyX - skyW;
      for (let x = startX; x < CANVAS_W; x += skyW) {
        ctx.drawImage(this.imgSky, x, skyY, skyW, skyH);
      }
    } else {
      // Procedural Fallback: Radiant Midnight-Violet Vampire Sky with Stepped Hi-Bit Pixel Art Dither Bands
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      skyGrad.addColorStop(0, '#0e051c');
      skyGrad.addColorStop(0.30, '#1c0a34');
      skyGrad.addColorStop(0.62, '#33134e');
      skyGrad.addColorStop(1, '#4e1c6e');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Subtle 2x2 ordered pixel dither scanlines for authentic Hi-Bit pixel art texture
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let y = 0; y < CANVAS_H; y += 2) {
        ctx.fillRect(0, y, CANVAS_W, 1);
      }

      // Background storm clouds behind the moon
      for (let i = 0; i < this.clouds.length / 2; i++) {
        const cl = this.clouds[i];
        const cx = Math.round(((cl.x - time * cl.speed - camera.x * 0.04) % (CANVAS_W + cl.w * 2)) - cl.w);
        const cy = Math.round(cl.y - camera.y * 0.03);
        ctx.fillStyle = `rgba(58, 24, 82, ${cl.alpha})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.round(cl.w * 0.5), Math.round(cl.h * 0.5), 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Eerie, Radiant Bloodmoon (Hi-Bit Pixel Art Bloodmoon)
      const moonX = Math.round(CANVAS_W * 0.68 - camera.x * 0.02);
      const moonY = Math.round(130 - camera.y * 0.02);

      // Stepped pixel moonlight corona halo rings
      ctx.fillStyle = 'rgba(235, 215, 255, 0.08)';
      ctx.beginPath(); ctx.arc(moonX, moonY, 140, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(195, 140, 255, 0.12)';
      ctx.beginPath(); ctx.arc(moonX, moonY, 95, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(225, 180, 255, 0.20)';
      ctx.beginPath(); ctx.arc(moonX, moonY, 68, 0, Math.PI * 2); ctx.fill();

      // Pale moon sphere
      ctx.fillStyle = '#26173e';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 52, 0, Math.PI * 2);
      ctx.fill();

      // Pixel crater maria (volcanic basalt seas on the moon surface)
      ctx.fillStyle = '#170c26';
      ctx.beginPath();
      ctx.arc(moonX - 14, moonY - 10, 15, 0, Math.PI * 2);
      ctx.arc(moonX + 12, moonY + 14, 11, 0, Math.PI * 2);
      ctx.arc(moonX - 5, moonY + 18, 8, 0, Math.PI * 2);
      ctx.arc(moonX + 18, moonY - 12, 7, 0, Math.PI * 2);
      ctx.fill();

      // Luminous lunar crescent rim
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#d9bfff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 52, -Math.PI * 0.72, Math.PI * 0.42);
      ctx.stroke();

      // Radiant moon crater fractures
      ctx.strokeStyle = 'rgba(240, 220, 255, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(moonX - 24, moonY - 16);
      ctx.lineTo(moonX - 2, moonY + 8);
      ctx.lineTo(moonX + 18, moonY - 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Foreground clouds drifting in front of the moon with silver edges
      for (let i = Math.floor(this.clouds.length / 2); i < this.clouds.length; i++) {
        const cl = this.clouds[i];
        const cx = Math.round(((cl.x - time * cl.speed - camera.x * 0.04) % (CANVAS_W + cl.w * 2)) - cl.w);
        const cy = Math.round(cl.y - camera.y * 0.03);
        ctx.fillStyle = `rgba(42, 18, 62, ${cl.alpha * 0.9})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.round(cl.w * 0.5), Math.round(cl.h * 0.5), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(220, 200, 255, ${cl.alpha * 0.55})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy - cl.h * 0.2, cl.w * 0.35, -Math.PI * 0.8, -Math.PI * 0.2);
        ctx.stroke();
      }

      // Twinkling celestial motes/stars in upper sky
      for (const s of this.stars) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(time * s.speed + s.blink));
        ctx.fillStyle = `rgba(235, 220, 255, ${a})`;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.round(s.size), Math.round(s.size));
        if (s.size > 2.2) {
          ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.6})`;
          ctx.fillRect(Math.round(s.x - 2), Math.round(s.y), 5, 1);
          ctx.fillRect(Math.round(s.x), Math.round(s.y - 2), 1, 5);
        }
      }
    }

    // 2. SPIRES LAYER (Layer 2 - Cologne Cathedral Skyline)
    if (hasCustomSpires) {
      const spiresW = 1850, spiresH = 820;
      const spiresX = -Math.round((camera.x * 0.16) % spiresW);
      const spiresY = Math.round(CANVAS_H * 0.10 - camera.y * 0.12);
      const startX = spiresX <= 0 ? spiresX : spiresX - spiresW;
      for (let x = startX; x < CANVAS_W; x += spiresW) {
        ctx.drawImage(this.imgSpires, x, spiresY, spiresW, spiresH);
      }
    } else {
      // Procedural Fallback: Cologne Cathedral Spires & Skyline
      ctx.fillStyle = '#120722';
      const baseY1 = Math.round(CANVAS_H * 0.90 - camera.y * 0.10);
      for (const d of this.distantSpires) {
        const sx = Math.round(d.x - camera.x * 0.12);
        if (sx + d.w < -140 || sx - d.w > CANVAS_W + 140) continue;

        const baseTop = baseY1 - d.h;
        ctx.beginPath();
        ctx.fillRect(sx - Math.round(d.w / 2), baseTop, d.w, d.h + 200);

        if (d.type === 0) {
          const towerW = Math.round(d.w * 0.28);
          const tower1X = Math.round(sx - d.w * 0.28);
          const tower2X = Math.round(sx + d.w * 0.28);
          const spH = d.spireH;

          ctx.moveTo(tower1X - towerW / 2, baseTop);
          ctx.lineTo(tower1X, baseTop - spH);
          ctx.lineTo(tower1X + towerW / 2, baseTop);

          ctx.moveTo(tower2X - towerW / 2, baseTop);
          ctx.lineTo(tower2X, baseTop - spH);
          ctx.lineTo(tower2X + towerW / 2, baseTop);

          ctx.moveTo(sx - 8, baseTop);
          ctx.lineTo(sx, baseTop - spH * 0.55);
          ctx.lineTo(sx + 8, baseTop);
          ctx.fill();

          ctx.fillStyle = '#220d36';
          ctx.fillRect(tower1X - 3, baseTop - spH * 0.65, 6, 24);
          ctx.fillRect(tower1X - 3, baseTop - spH * 0.35, 6, 28);
          ctx.fillRect(tower2X - 3, baseTop - spH * 0.65, 6, 24);
          ctx.fillRect(tower2X - 3, baseTop - spH * 0.35, 6, 28);

          ctx.beginPath();
          ctx.arc(sx, baseTop + 45, 20, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#170b2b';
          for (let k = 1; k < 5; k++) {
            const kp = k / 5;
            const kxL = tower1X - (1 - kp) * (towerW / 2);
            const ky = baseTop - kp * spH;
            const kxR = tower1X + (1 - kp) * (towerW / 2);
            ctx.fillRect(Math.round(kxL - 2), Math.round(ky - 2), 4, 3);
            ctx.fillRect(Math.round(kxR - 2), Math.round(ky - 2), 4, 3);

            const kxL2 = tower2X - (1 - kp) * (towerW / 2);
            const kxR2 = tower2X + (1 - kp) * (towerW / 2);
            ctx.fillRect(Math.round(kxL2 - 2), Math.round(ky - 2), 4, 3);
            ctx.fillRect(Math.round(kxR2 - 2), Math.round(ky - 2), 4, 3);
          }

          ctx.fillStyle = '#261242';
          ctx.fillRect(tower1X - 2, baseTop - spH - 12, 4, 12);
          ctx.fillRect(tower1X - 6, baseTop - spH - 8, 12, 3);
          ctx.fillRect(tower2X - 2, baseTop - spH - 12, 4, 12);
          ctx.fillRect(tower2X - 6, baseTop - spH - 8, 12, 3);

          ctx.fillStyle = '#120722';
        } else if (d.type === 1) {
          ctx.arc(sx, baseTop, d.w * 0.35, Math.PI, 0);
          ctx.moveTo(sx - 8, baseTop - d.w * 0.35);
          ctx.lineTo(sx, baseTop - d.spireH - 30);
          ctx.lineTo(sx + 8, baseTop - d.w * 0.35);
          ctx.fill();
        } else if (d.type === 2) {
          ctx.moveTo(sx - d.w / 2, baseTop);
          ctx.lineTo(sx, baseTop - d.spireH * 0.85);
          ctx.lineTo(sx + d.w / 2, baseTop);
          ctx.fill();
          ctx.fillRect(sx - d.w * 0.38 - 3, baseTop - 28, 6, 28);
          ctx.fillRect(sx + d.w * 0.38 - 3, baseTop - 28, 6, 28);
        } else {
          ctx.moveTo(sx - d.w * 0.25, baseTop);
          ctx.lineTo(sx, baseTop - d.spireH);
          ctx.lineTo(sx + d.w * 0.25, baseTop);
          ctx.rect(sx - 2, baseTop - d.spireH - 16, 4, 16);
          ctx.rect(sx - 7, baseTop - d.spireH - 11, 14, 3);
          ctx.fill();
        }

        if (Math.sin(sx * 0.1) > 0.1) {
          ctx.fillStyle = '#ff9922';
          ctx.fillRect(sx - 4, baseTop + 30, 8, 18);
          ctx.fillStyle = '#120722';
        }
      }

      // Atmospheric violet haze over Layer 1
      const fog1 = ctx.createLinearGradient(0, CANVAS_H * 0.60, 0, CANVAS_H);
      fog1.addColorStop(0, 'rgba(28, 12, 45, 0)');
      fog1.addColorStop(1, 'rgba(42, 18, 64, 0.6)');
      ctx.fillStyle = fog1;
      ctx.fillRect(0, Math.round(CANVAS_H * 0.60), CANVAS_W, Math.round(CANVAS_H * 0.40));
    }

    // 3. VIADUCTS LAYER (Layer 3 - Mid-distance Gothic Viaducts & Bridges)
    if (hasCustomViaducts) {
      const viaductsW = 1850, viaductsH = 820;
      const viaductsX = -Math.round((camera.x * 0.32) % viaductsW);
      const viaductsY = Math.round(CANVAS_H * 0.18 - camera.y * 0.22);
      const startX = viaductsX <= 0 ? viaductsX : viaductsX - viaductsW;
      for (let x = startX; x < CANVAS_W; x += viaductsW) {
        ctx.drawImage(this.imgViaducts, x, viaductsY, viaductsW, viaductsH);
      }
    } else {
      // Procedural Fallback: Mid-distance Gothic Viaducts & Arched Bridges
      ctx.fillStyle = '#190b2e';
      const baseY2 = Math.round(CANVAS_H * 0.95 - camera.y * 0.22);
      for (const a of this.midArches) {
        const sx = Math.round(a.x - camera.x * 0.28);
        if (sx + a.w < -120 || sx - a.w > CANVAS_W + 120) continue;

        const topY = baseY2 - a.h;
        ctx.beginPath();
        ctx.moveTo(sx - a.w / 2, baseY2 + 200);
        ctx.lineTo(sx - a.w / 2, topY);
        ctx.lineTo(sx + a.w / 2, topY);
        ctx.lineTo(sx + a.w / 2, baseY2 + 200);
        ctx.lineTo(sx + a.w / 2 - a.pillarW, baseY2 + 200);
        ctx.lineTo(sx + a.w / 2 - a.pillarW, topY + a.h * 0.45);
        ctx.quadraticCurveTo(sx, topY + a.h * 0.18, sx - a.w / 2 + a.pillarW, topY + a.h * 0.45);
        ctx.lineTo(sx - a.w / 2 + a.pillarW, baseY2 + 200);
        ctx.closePath();
        ctx.fill();

        if (a.hasWindow) {
          ctx.fillStyle = a.windowColor;
          ctx.shadowColor = a.windowColor;
          ctx.shadowBlur = 8;
          const winX = sx, winY = topY + 28, winW = 16, winH = 36;
          ctx.beginPath();
          ctx.moveTo(winX - winW / 2, winY + winH);
          ctx.lineTo(winX - winW / 2, winY + 10);
          ctx.quadraticCurveTo(winX, winY, winX + winW / 2, winY + 10);
          ctx.lineTo(winX + winW / 2, winY + winH);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#190b2e';
        }

        if (a.hasGargoyle) {
          ctx.fillStyle = '#10061e';
          ctx.beginPath();
          const gx = sx - Math.round(a.w * 0.35), gy = topY;
          ctx.ellipse(gx, gy - 8, 6, 5, 0, 0, Math.PI * 2);
          ctx.moveTo(gx - 4, gy - 12); ctx.lineTo(gx - 12, gy - 20); ctx.lineTo(gx - 8, gy - 6);
          ctx.fill();
          ctx.fillStyle = '#190b2e';
        }
      }

      // Procedural Closer City Skyline
      ctx.fillStyle = '#220f3b';
      const baseY3 = Math.round(CANVAS_H * 1.05 - camera.y * 0.38);
      for (const c of this.nearColumns) {
        const sx = Math.round(c.x - camera.x * 0.48);
        if (sx + c.w < -100 || sx - c.w > CANVAS_W + 100) continue;

        const topY = baseY3 - c.h;
        ctx.fillRect(sx - Math.round(c.w / 2), topY, c.w, c.h + 200);

        ctx.beginPath();
        ctx.moveTo(sx - c.w / 2 - 6, topY);
        ctx.lineTo(sx, topY - c.roofH);
        ctx.lineTo(sx + c.w / 2 + 6, topY);
        ctx.closePath();
        ctx.fill();

        if (c.hasFinial) {
          ctx.fillRect(sx + Math.round(c.w * 0.25) - 4, topY - Math.round(c.roofH * 0.6) - 16, 8, 16);
          ctx.beginPath();
          ctx.moveTo(sx, topY - c.roofH);
          ctx.lineTo(sx, topY - c.roofH - 18);
          ctx.strokeStyle = '#220f3b';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // 4. ATMOSPHERIC DRIFTING PARTICLES & CANYON MIST
    for (const sp of this.spores) {
      sp.x += sp.vx * 0.016;
      sp.y += Math.sin(time * 2 + sp.phase) * 0.4;
      if (sp.x < 0) sp.x = CANVAS_W + 10;
      if (sp.x > CANVAS_W + 10) sp.x = 0;

      const alpha = 0.45 + 0.55 * Math.sin(time * 3 + sp.phase);
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(Math.round(sp.x), Math.round(sp.y), Math.round(sp.size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Volumetric Purple Mist in low canyon areas
    const mistY = Math.max(Math.round(CANVAS_H * 0.65), Math.round(CANVAS_H * 0.80 - camera.y * 0.25));
    const mistGrad = ctx.createLinearGradient(0, mistY, 0, CANVAS_H);
    mistGrad.addColorStop(0, 'rgba(42, 18, 64, 0)');
    mistGrad.addColorStop(0.5, 'rgba(52, 22, 78, 0.35)');
    mistGrad.addColorStop(1, 'rgba(44, 18, 68, 0.75)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, mistY, CANVAS_W, CANVAS_H - mistY);
  }
}

// ============================================================================
// HUD
// ============================================================================
class HUD {
  constructor(bindings) {
    this.bindings = bindings;
    this.deathAlpha = 0;
    this.winAlpha = 0;
    this.bossBarAlpha = 0;
    this.weaponNotifyTimer = 0;
    this.weaponNotifyName = '';
    this.tipTimer = 0;
    this.tipText = '';
    this.skillNotification = null;
    this.skillNotificationTimer = 0;
    this.skillNotificationDur = 6.0;
  }

  showWeaponSwitch(name) { this.weaponNotifyTimer = 2; this.weaponNotifyName = name; }
  showNotification(text) { this.tipTimer = 3; this.tipText = text; }
  showSkillUnlockNotification(skill) {
    this.skillNotification = skill;
    this.skillNotificationTimer = this.skillNotificationDur;
  }
  showLockedSpellNotification(spellIndex) {
    const sp = SPELLS[spellIndex] || { name: 'Spell' };
    this.showNotification('🔒 ' + sp.name + ' is locked! Discover its ancient relic in the depths.');
  }

  draw(ctx, player, boss, gameState, dt) {
    ctx.save();
    if (this.weaponNotifyTimer > 0) this.weaponNotifyTimer -= dt;
    if (this.tipTimer > 0) this.tipTimer -= dt;

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
    ctx.fillStyle = '#88aacc'; ctx.font = `bold 11px ${UI_FONT}`; ctx.fillText('SOUL', smX, smY - 3);

    if (player.soul >= player.healCost && player.hp < player.maxHp) {
      const hk = this.bindings.getKeyLabel(this.bindings.getKeys('heal')[0] || 'Q');
      ctx.fillStyle = '#66ffaa'; ctx.font = `bold 12px ${UI_FONT}`; ctx.fillText(`[${hk}] HEAL`, smX + smW + 8, smY + 10);
    }

    // Dash cooldown
    const dashReady = player.dashCooldown <= 0;
    ctx.fillStyle = dashReady ? '#66ccff' : '#333344'; ctx.fillRect(30, 78, 24, 24);
    ctx.strokeStyle = '#556677'; ctx.strokeRect(30, 78, 24, 24);
    ctx.fillStyle = dashReady ? '#fff' : '#666677'; ctx.font = `14px ${UI_FONT}`; ctx.fillText('⚡', 34, 95);
    if (!dashReady) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(30, 78, 24, 24 * (player.dashCooldown / player.dashCooldownMax)); }

    // Current weapon
    const wpnName = player.weapon ? player.weapon.name : 'Unarmed';
    ctx.fillStyle = '#ddeeff'; ctx.font = `bold 13px ${UI_FONT}`;
    ctx.fillText(`⚔ ${wpnName}`, 62, 95);

    // Weapon switch notification
    if (this.weaponNotifyTimer > 0) {
      ctx.globalAlpha = Math.min(1, this.weaponNotifyTimer);
      ctx.fillStyle = '#ccddee'; ctx.font = `bold 22px ${UI_FONT}`; ctx.textAlign = 'center';
      ctx.fillText(this.weaponNotifyName, CANVAS_W / 2, CANVAS_H - 60);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }

    // Guidance / Pickup Notification banner
    if (this.tipTimer > 0) {
      ctx.globalAlpha = Math.min(1, this.tipTimer * 2, (3 - this.tipTimer) * 4);
      ctx.fillStyle = 'rgba(12, 8, 22, 0.92)';
      ctx.fillRect(CANVAS_W / 2 - 220, 24, 440, 36);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(CANVAS_W / 2 - 220, 24, 440, 36);
      ctx.fillStyle = '#00f0ff';
      ctx.font = `bold 14px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(this.tipText, CANVAS_W / 2, 47);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // Special Epic Skill Discovery Notification Banner
    if (this.skillNotification && this.skillNotificationTimer > 0) {
      this.skillNotificationTimer -= dt;
      const t = this.skillNotificationTimer;
      const alpha = Math.min(1.0, Math.sin((t / this.skillNotificationDur) * Math.PI) * 1.5);
      const sk = this.skillNotification;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      
      const bw = 640, bh = 82;
      const bx = CANVAS_W / 2 - bw / 2, by = 48;

      ctx.fillStyle = 'rgba(10, 6, 20, 0.94)';
      ctx.fillRect(bx, by, bw, bh);

      ctx.strokeStyle = sk.glowColor || '#66ddff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = sk.glowColor || '#66ddff';
      ctx.shadowBlur = 16;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.strokeStyle = '#2d1b4e';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);

      ctx.fillStyle = sk.color || '#ffaa33';
      ctx.font = `bold 16px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`★ SKILL UNLOCKED: ${sk.name.toUpperCase()} ★`, CANVAS_W / 2, by + 24);

      ctx.fillStyle = '#ffdd44';
      ctx.font = `bold 14px ${UI_FONT}`;
      ctx.fillText(`ACTIVATE: [ KEY ${sk.key} ]`, CANVAS_W / 2, by + 45);

      ctx.fillStyle = '#b0c4de';
      ctx.font = `12px ${UI_FONT}`;
      ctx.fillText(sk.desc, CANVAS_W / 2, by + 66);

      ctx.restore();
    }

    // Spell slots (with locked icon support)
    for (let i = 0; i < SPELLS.length; i++) {
      const sx = 30 + i * 44, sy = 110;
      const sp = SPELLS[i];
      const isUnlocked = !player.unlockedSpells || player.unlockedSpells[i] !== false;
      const ready = isUnlocked && player.spellCooldowns[i] <= 0 && player.soul >= sp.soulCost;

      if (!isUnlocked) {
        ctx.fillStyle = '#14121c';
        ctx.fillRect(sx, sy, 36, 36);
        ctx.strokeStyle = '#3a2e4c';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, 36, 36);
        ctx.fillStyle = '#6a5d7e';
        ctx.font = '14px serif';
        ctx.fillText('🔒', sx + 10, sy + 24);
        const keyLabel = this.bindings.getKeyLabel(this.bindings.getKeys('spell' + (i + 1))[0] || (i + 1));
        ctx.fillStyle = '#443854';
        ctx.font = `bold 10px ${UI_FONT}`;
        ctx.fillText(keyLabel, sx + 3, sy + 32);
        continue;
      }

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
      ctx.fillStyle = '#8899aa'; ctx.font = `bold 11px ${UI_FONT}`; ctx.fillText(keyLabel, sx + 3, sy + 32);
      // Soul cost
      ctx.fillStyle = '#55aacc'; ctx.font = `bold 10px ${UI_FONT}`; ctx.fillText(sp.soulCost, sx + 20, sy + 32);
    }

    // Boss HP bar
    if (boss && boss.active && !boss.dead) {
      this.bossBarAlpha = Math.min(1, this.bossBarAlpha + 0.02);
      ctx.globalAlpha = this.bossBarAlpha;
      const bw = 460, bh = 18, bx = CANVAS_W / 2 - bw / 2, by = 26;
      ctx.fillStyle = '#1a1a26'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = boss.phase === 2 ? '#dd2244' : '#cc4466'; ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), bh);
      ctx.strokeStyle = '#888899'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#eeeeff'; ctx.font = `bold 14px ${UI_FONT}`; ctx.textAlign = 'center';
      ctx.fillText(boss.phase === 2 ? '⚔ ABYSSAL WARDEN — PHASE 2 ⚔' : '⚔ ABYSSAL WARDEN ⚔', CANVAS_W / 2, by - 7);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    } else { this.bossBarAlpha = 0; }

    // Death screen
    if (gameState === STATE.DEAD) {
      this.deathAlpha = Math.min(1, this.deathAlpha + 0.015);
      ctx.fillStyle = `rgba(10,0,0,${this.deathAlpha * 0.75})`; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = this.deathAlpha; ctx.fillStyle = '#ee2222'; ctx.font = 'bold 72px serif'; ctx.textAlign = 'center';
      ctx.fillText('YOU DIED', CANVAS_W / 2, CANVAS_H / 2 - 20);
      const rk = this.bindings.getKeyLabel(this.bindings.getKeys('restart')[0] || 'N');
      ctx.fillStyle = '#eeddcc'; ctx.font = `20px ${UI_FONT}`;
      ctx.fillText(`Press ${rk} to revive at bonfire`, CANVAS_W / 2, CANVAS_H / 2 + 40);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    } else { this.deathAlpha = 0; }

    // Win screen
    if (gameState === STATE.WIN) {
      this.winAlpha = Math.min(1, this.winAlpha + 0.01);
      ctx.fillStyle = `rgba(5,5,20,${this.winAlpha * 0.75})`; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = this.winAlpha; ctx.fillStyle = '#77bbff'; ctx.font = 'bold 64px serif'; ctx.textAlign = 'center';
      ctx.fillText('VICTORY', CANVAS_W / 2, CANVAS_H / 2 - 40);
      ctx.fillStyle = '#ccddee'; ctx.font = 'italic 24px serif'; ctx.fillText('The Abyss has been sealed', CANVAS_W / 2, CANVAS_H / 2 + 10);
      const rk = this.bindings.getKeyLabel(this.bindings.getKeys('restart')[0] || 'N');
      ctx.fillStyle = '#eeddcc'; ctx.font = `18px ${UI_FONT}`; ctx.fillText(`Press ${rk} to play again`, CANVAS_W / 2, CANVAS_H / 2 + 60);
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
    ctx.fillStyle = '#ffaa44'; ctx.font = 'bold 26px serif'; ctx.textAlign = 'center';
    ctx.fillText('🔥 Bonfire 🔥', CANVAS_W / 2, py + 35);

    if (this.weaponSub) {
      ctx.fillStyle = '#8899aa'; ctx.font = `16px ${UI_FONT}`;
      ctx.fillText('Select Weapon', CANVAS_W / 2, py + 65);

      for (let i = 0; i < WEAPONS.length; i++) {
        const oy = py + 90 + i * 55;
        const sel = i === this.selectedIndex;
        const unlocked = player.unlockedWeapons && player.unlockedWeapons[i];
        const equipped = i === player.weaponIndex;
        ctx.fillStyle = sel ? (unlocked ? '#334466' : '#222233') : '#1a1a2e';
        ctx.fillRect(px + 20, oy, pw - 40, 45);
        if (sel) { ctx.strokeStyle = unlocked ? '#6688aa' : '#444455'; ctx.lineWidth = 1; ctx.strokeRect(px + 20, oy, pw - 40, 45); }
        ctx.textAlign = 'left';
        ctx.fillStyle = unlocked ? (sel ? '#ddddff' : '#8899aa') : '#556677';
        ctx.font = `bold 14px ${UI_FONT}`;
        const statusLabel = equipped ? ' [EQUIPPED]' : (unlocked ? '' : ' [LOCKED]');
        ctx.fillText(WEAPONS[i].name + statusLabel, px + 40, oy + 18);
        ctx.fillStyle = unlocked ? '#99aabb' : '#445566';
        ctx.font = `12px ${UI_FONT}`;
        ctx.fillText(`DMG: ${WEAPONS[i].damage}  RNG: ${WEAPONS[i].range}  SPD: ${(1 / WEAPONS[i].attackDur).toFixed(0)}/s`, px + 40, oy + 35);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#778899'; ctx.font = `12px ${UI_FONT}`;
      ctx.fillText('↑↓ Navigate · Attack/F to select · ESC to go back', CANVAS_W / 2, py + ph - 20);
    } else {
      for (let i = 0; i < this.options.length; i++) {
        const oy = py + 70 + i * 50;
        const sel = i === this.selectedIndex;
        ctx.fillStyle = sel ? '#334466' : 'transparent'; ctx.fillRect(px + 30, oy, pw - 60, 38);
        if (sel) { ctx.strokeStyle = '#6688aa'; ctx.lineWidth = 1; ctx.strokeRect(px + 30, oy, pw - 60, 38); }
        ctx.fillStyle = sel ? '#ddddff' : '#8899aa'; ctx.font = `bold 18px ${UI_FONT}`; ctx.textAlign = 'center';
        ctx.fillText(this.options[i], CANVAS_W / 2, oy + 26);
      }
      // Player status
      const curWpnName = player.weapon ? player.weapon.name : 'Unarmed';
      ctx.fillStyle = '#8899aa'; ctx.font = `13px ${UI_FONT}`;
      ctx.fillText(`HP: ${player.hp}/${player.maxHp}   Soul: ${Math.floor(player.soul)}/${player.maxSoul}   Weapon: ${curWpnName}`, CANVAS_W / 2, py + ph - 40);
      ctx.fillStyle = '#778899'; ctx.font = `12px ${UI_FONT}`;
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

    ctx.fillStyle = '#aabbcc'; ctx.font = `bold 22px ${UI_FONT}`; ctx.textAlign = 'center';
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
      ctx.fillStyle = sel ? '#ddddff' : '#8899aa'; ctx.font = `14px ${UI_FONT}`;
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

    ctx.textAlign = 'center'; ctx.fillStyle = '#778899'; ctx.font = `12px ${UI_FONT}`;
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
    ctx.fillStyle = '#8899bb'; ctx.font = `20px ${UI_FONT}`;
    ctx.fillText('Press any key to begin', CANVAS_W / 2, CANVAS_H / 2 - 20);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#8899aa'; ctx.font = `14px ${UI_FONT}`;
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

    // Hi-Bit Pixel Art Rendering Buffer (640x360 scaled 2x to 1280x720)
    this.pixelW = 640;
    this.pixelH = 360;
    if (typeof document !== 'undefined' && document.createElement) {
      this.pixelCanvas = document.createElement('canvas');
      this.pixelCanvas.width = this.pixelW;
      this.pixelCanvas.height = this.pixelH;
      this.pixelCtx = this.pixelCanvas.getContext ? this.pixelCanvas.getContext('2d') : null;
      if (this.pixelCtx) {
        this.pixelCtx.imageSmoothingEnabled = false;
        this.pixelCtx.webkitImageSmoothingEnabled = false;
        this.pixelCtx.mozImageSmoothingEnabled = false;
        this.pixelCtx.msImageSmoothingEnabled = false;
      }
    }
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.webkitImageSmoothingEnabled = true;
      this.ctx.mozImageSmoothingEnabled = true;
      this.ctx.msImageSmoothingEnabled = true;
    }

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
    this.lighting = new LightingSystem();
    this.envRenderer = new EnvironmentRenderer();
    this.props = [];
    this.swordCollected = false;
    this.swordPickup = null;

    this._resize();
    window.addEventListener('resize', () => this._resize());
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(t => this._loop(t));
    }
  }

  _resize() {
    const s = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H);
    this.canvas.style.width = `${CANVAS_W * s}px`; this.canvas.style.height = `${CANVAS_H * s}px`;
    if (this.lighting) this.lighting.resize(CANVAS_W, CANVAS_H);
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.webkitImageSmoothingEnabled = true;
      this.ctx.mozImageSmoothingEnabled = true;
      this.ctx.msImageSmoothingEnabled = true;
    }
    if (this.pixelCtx) {
      this.pixelCtx.imageSmoothingEnabled = false;
      this.pixelCtx.webkitImageSmoothingEnabled = false;
      this.pixelCtx.mozImageSmoothingEnabled = false;
      this.pixelCtx.msImageSmoothingEnabled = false;
    }
  }

  _initLevel() {
    const ld = buildLevel();
    this.level = ld;
    this.props = ld.props || [];
    this.player = new Player(ld.playerStart.x, ld.playerStart.y);
    this.enemyTemplates = ld.enemies;
    this.player.unlockedSpells = [false, false, false]; // Start locked until picked up
    this.enemies = ld.enemies.map(e => new Enemy(e.x, e.y, e.type, e.patrolRange));
    this.boss = new Boss(ld.bossSpawn.x, ld.bossSpawn.y);
    this.bonfires = ld.bonfires;
    // Radiant Sword on Watchtower roof
    this.swordPickup = ld.swordPickup || { x: 1560, y: 476, w: 28, h: 46, name: 'Old Nail', collected: this.swordCollected || false };
    this.skillPickups = (ld.skillPickups || []).map(s => Object.assign({}, s));
    this.swordPickup.collected = this.swordCollected || false;
    this.player.unlockedWeapons = [this.swordCollected || false, false, false, false];
    this.player.weaponIndex = this.swordCollected ? 0 : -1;
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
    this.audio.playLevelMusic();
  }

  _respawnAtBonfire() {
    this.player.respawn();
    this.player.unlockedWeapons = [this.swordCollected || false, false, false, false];
    this.player.weaponIndex = this.swordCollected ? 0 : -1;
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
    this.audio.playLevelMusic();
  }

  _loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp; this.time += dt;
    this.input.update();

    if (this.audio && this.audio.update) this.audio.update(dt);

    if (this.freezeFrame > 0) { this.freezeFrame -= dt; requestAnimationFrame(t => this._loop(t)); return; }

    this._update(dt);
    this._draw(dt);
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(t => this._loop(t));
    }
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

    // Dynamic contextual tutorial hints for new players
    if (!this.tutorialsShown) {
      this.tutorialsShown = { move: false, dash: false, doubleJump: false, attack: false, heal: false };
      this.tutorialCooldown = 0.5;
    }
    if (this.tutorialCooldown > 0) {
      this.tutorialCooldown -= dt;
    } else if (this.hud && this.hud.tipTimer <= 0) {
      const getK = (action) => {
        if (!this.keyBindings) return '';
        const keys = this.keyBindings.getKeys(action);
        return keys && keys[0] ? this.keyBindings.getKeyLabel(keys[0]) : '';
      };
      const moveK = `${getK('moveLeft')}/${getK('moveRight')}` || '←/→';
      const jumpK = getK('jump') || '↑';
      const attackK = getK('attack') || 'X';
      const dashK = getK('dash') || 'Ctrl';
      const healK = getK('heal') || 'Q';

      if (!this.tutorialsShown.move && this.player.x < 300) {
        this.tutorialsShown.move = true;
        this.tutorialCooldown = 4.0;
        this.hud.showNotification(`[ ${moveK} ] Move   ·   [ ${jumpK} ] Jump`, 3.5);
      } else if (!this.tutorialsShown.dash && this.player.x >= 300 && this.player.x < 550) {
        this.tutorialsShown.dash = true;
        this.tutorialCooldown = 4.0;
        this.hud.showNotification(`[ ${dashK} ] Dash — Dodge roll with invulnerable i-frames!`, 4.0);
      } else if (!this.tutorialsShown.attack && this.player.x >= 550 && this.player.x < 850) {
        this.tutorialsShown.attack = true;
        this.tutorialCooldown = 4.5;
        this.hud.showNotification(`[ ${attackK} ] Attack   ·   Air + [ ↓ + ${attackK} ] Pogo Bounce on enemies!`, 4.5);
      } else if (!this.tutorialsShown.doubleJump && !this.player.onGround && this.player.vy > 40 && this.player.jumpsLeft > 0) {
        this.tutorialsShown.doubleJump = true;
        this.tutorialCooldown = 4.0;
        this.hud.showNotification(`Press [ ${jumpK} ] again in mid-air for Double Jump (Monarch Wings)!`, 3.5);
      } else if (!this.tutorialsShown.heal && this.player.hp < this.player.maxHp && this.player.soul >= this.player.healCost) {
        this.tutorialsShown.heal = true;
        this.tutorialCooldown = 4.5;
        this.hud.showNotification(`[ ${healK} ] Hold to Focus Soul and Heal HP!`, 4.0);
      }
    }

    // Weapon switching
    for (let i = 1; i <= 4; i++) {
      if (this.input.weapon(i)) {
        if (this.player.switchWeapon(i - 1)) {
          this.audio.weaponSwitch();
          this.hud.showWeaponSwitch(WEAPONS[i - 1].name);
        } else if (!this.player.unlockedWeapons[i - 1]) {
          this.hud.showNotification(`⚔ ${WEAPONS[i - 1].name} is Locked`);
        }
      }
    }
    if (this.input.weaponNext()) {
      if (this.player.nextWeapon()) {
        this.audio.weaponSwitch();
        this.hud.showWeaponSwitch(this.player.weapon.name);
      }
    }

    // Spells with discovery unlock checks
    if (this.input.spell1Pressed()) {
      if (this.player.unlockedSpells && !this.player.unlockedSpells[0]) {
        this.hud.showLockedSpellNotification(0);
      } else {
        this.player.castSpell(0, this.projectiles, this.particles, this.audio, this.camera, this.enemies, this.boss);
      }
    }
    if (this.input.spell2Pressed()) {
      if (this.player.unlockedSpells && !this.player.unlockedSpells[1]) {
        this.hud.showLockedSpellNotification(1);
      } else {
        this.player.castSpell(1, this.projectiles, this.particles, this.audio, this.camera, this.enemies, this.boss);
      }
    }
    if (this.input.spell3Pressed()) {
      if (this.player.unlockedSpells && !this.player.unlockedSpells[2]) {
        this.hud.showLockedSpellNotification(2);
      } else {
        this.player.castSpell(2, this.projectiles, this.particles, this.audio, this.camera, this.enemies, this.boss);
      }
    }

    // Frost Nova engine resolution (F8)
    if (this.player._justCastNova) {
      this.player._justCastNova = false;
      const novaRadius = SPELLS[1].radius || 140;
      const pcx = this.player.x + this.player.w / 2, pcy = this.player.y + this.player.h / 2;
      for (const e of this.enemies) {
        if (!e.dead) {
          const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
          const dist = Math.min(Math.hypot(ecx - pcx, ecy - pcy), Math.hypot(e.x - this.player.x, e.y - this.player.y));
          if (dist <= novaRadius) {
            if (e instanceof Boss || e.isBoss) {
              e.chilled = true;
              e.chillTimer = 1.2;
              e.freezeTimer = 0;
            } else {
              e.freezeTimer = 2.0;
              e.stunned = 2.0;
              e.attackHitbox = null;
              e.vx = 0;
            }
          }
        }
      }
      if (this.boss.active && !this.boss.dead) {
        const bcx = this.boss.x + this.boss.w / 2, bcy = this.boss.y + this.boss.h / 2;
        if (Math.hypot(bcx - pcx, bcy - pcy) <= novaRadius) {
          this.boss.chilled = true;
          this.boss.chillTimer = 1.2;
          this.boss.freezeTimer = 0;
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
        this.audio.playBossMusic();
      }
    }

    // Projectiles & Advanced Spells Mechanics
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt, this.level, this.particles);

      // Void Singularity Gravitational Pull Vector (F10)
      if (proj.type === 'void_vortex' && !proj.dead) {
        const pullRange = proj.pullRange || 160;
        const vcx = proj.x + proj.w / 2, vcy = proj.y + proj.h / 2;
        proj.tickTimer = (proj.tickTimer || 0.4) - dt;
        const doTick = proj.tickTimer <= 0;
        if (doTick) proj.tickTimer = proj.tickInterval || 0.4;

        for (const e of this.enemies) {
          if (!e.dead) {
            const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
            const dx = vcx - ecx, dy = vcy - ecy;
            const dist = Math.min(Math.hypot(dx, dy), Math.hypot(proj.x - e.x, proj.y - e.y));
            if (dist < pullRange) {
              const pullFactor = 1.0 - (dist / pullRange);
              const pull = pullFactor * (proj.pullForce || 750);
              e.vx = (dx / (dist || 1)) * pull;
              e.x += (dx / (dist || 1)) * Math.min(Math.abs(dx), (pull + 200) * dt * 1.2);
              if (doTick) {
                e.takeDamage(1, dx > 0 ? 1 : -1, this.particles, this.camera, this.audio, true);
                if (e.dead) this.player.soul = Math.min(this.player.soul + 15, this.player.maxSoul);
              }
            }
          }
        }
      }

      // Check Expiration / Implosion for Void Singularity
      if (proj.dead) {
        if (proj.type === 'void_vortex') {
          if (this.audio && this.audio.voidImplode) this.audio.voidImplode();
          if (this.camera && this.camera.shake) this.camera.shake(5, 0.15);
          const vcx = proj.x + proj.w / 2, vcy = proj.y + proj.h / 2;
          const implosionRadius = proj.blastRadius || 160;
          const implosionDmg = proj.implosionDamage || 2;
          for (const e of this.enemies) {
            if (!e.dead) {
              const dist = Math.hypot(e.x + e.w / 2 - vcx, e.y + e.h / 2 - vcy);
              if (dist <= implosionRadius) {
                e.takeDamage(implosionDmg, vcx < e.x ? 1 : -1, this.particles, this.camera, this.audio, true);
                if (e.dead) this.player.soul = Math.min(this.player.soul + 15, this.player.maxSoul);
              }
            }
          }
          if (this.boss.active && !this.boss.dead) {
            const dist = Math.hypot(this.boss.x + this.boss.w / 2 - vcx, this.boss.y + this.boss.h / 2 - vcy);
            if (dist <= implosionRadius) {
              this.boss.takeDamage(implosionDmg, vcx < this.boss.x ? 1 : -1, this.particles, this.camera, this.audio);
            }
          }
        }
        this.projectiles.splice(i, 1);
        continue;
      }

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
        let hitSomething = false;
        if (proj.type === 'pyre_blast' || proj.type === 'fireball') {
          for (const e of this.enemies) {
            if (!e.dead && rectsOverlap(proj.getBounds(), e.getBounds())) {
              hitSomething = true;
              break;
            }
          }
          if (!hitSomething && this.boss.active && !this.boss.dead && rectsOverlap(proj.getBounds(), this.boss.getBounds())) {
            hitSomething = true;
          }
          if (hitSomething) {
            proj.dead = true;
            const cx = proj.x + proj.w / 2, cy = proj.y + proj.h / 2;
            const blastRadius = proj.blastRadius || 80;
            if (this.audio && this.audio.fireballHit) this.audio.fireballHit();
            if (this.camera && this.camera.shake) this.camera.shake(6, 0.2);
            if (this.particles && this.particles.sparks) this.particles.sparks(cx, cy);

            for (const e of this.enemies) {
              if (!e.dead) {
                const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
                const dist = Math.hypot(ecx - cx, ecy - cy);
                if (dist <= blastRadius) {
                  const dmg = dist < 24 ? proj.damage : (proj.splashDamage || 3);
                  if (e.type === 'guard') {
                    e.shieldUp = false;
                    e.stunned = Math.max(e.stunned || 0, 1.0);
                  }
                  e.takeDamage(dmg, cx < ecx ? 1 : -1, this.particles, this.camera, this.audio, true);
                  if (e.dead) this.player.soul = Math.min(this.player.soul + 15, this.player.maxSoul);
                }
              }
            }
            if (this.boss.active && !this.boss.dead) {
              const bcx = this.boss.x + this.boss.w / 2, bcy = this.boss.y + this.boss.h / 2;
              const dist = Math.hypot(bcx - cx, bcy - cy);
              if (dist <= blastRadius) {
                this.boss.takeDamage(proj.damage, cx < bcx ? 1 : -1, this.particles, this.camera, this.audio);
                if (this.boss.dead) {
                  this.player.soul = this.player.maxSoul;
                  this.audio.playLevelMusic();
                  setTimeout(() => { this.gameState = STATE.WIN; }, 1500);
                }
              }
            }
          }
        } else if (proj.type !== 'void_vortex') {
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
            if (this.boss.dead) {
              this.player.soul = this.player.maxSoul;
              this.audio.playLevelMusic();
              setTimeout(() => { this.gameState = STATE.WIN; }, 1500);
            }
          }
        }
      }
    }

    // Player attack vs enemies (Hollow Knight combat)
    if (this.player.attacking && this.player.attackHitbox) {
      const wpn = this.player.weapon || UNARMED_ATTACK;
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
        if (this.particles.weaponImpactSparks) {
          this.particles.weaponImpactSparks(hitX, hitY, wpn.slashColors);
        }

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
          this.audio.playLevelMusic();
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

    // Radiant Ancient Sword Pickup on Watchtower Roof
    if (this.swordPickup && !this.swordPickup.collected) {
      const p = this.player;
      const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
      const dist = Math.hypot(pcx - this.swordPickup.x, pcy - (this.swordPickup.y + 10));
      if (dist < 48) {
        if (this.input.interactPressed() || dist < 24) {
          this.swordPickup.collected = true;
          this.swordCollected = true;
          this.player.unlockedWeapons = [true, false, false, false];
          this.player.weaponIndex = 0;
          this.audio.bonfire();
          this.audio.weaponSwitch();
          this.particles.sparks(this.swordPickup.x, this.swordPickup.y);
          this.particles.deathBurst(this.swordPickup.x, this.swordPickup.y);
          this.camera.shake(6, 0.25);
          this.hud.showWeaponSwitch('⚔ OLD NAIL ACQUIRED! ⚔');
          this.hud.showNotification('Primary blade claimed. Ready your strike!');
        }
      }
    }

    // Hidden Skill Pickups in bottom corners across map (User Request 3)
    if (this.skillPickups) {
      const pb = this.player.getBounds();
      for (const pickup of this.skillPickups) {
        if (!pickup.collected) {
          const px = this.player.x + this.player.w / 2;
          const py = this.player.y + this.player.h / 2;
          const cx = pickup.x + pickup.w / 2;
          const cy = pickup.y + pickup.h / 2;
          const dist = Math.hypot(cx - px, cy - py);
          if (dist < 48 || rectsOverlap(pb, pickup)) {
            pickup.collected = true;
            this.player.unlockedSpells[pickup.spellIndex] = true;
            if (this.audio) {
              if (this.audio.bonfireLit) this.audio.bonfireLit();
              else if (this.audio.dodgeSuccess) this.audio.dodgeSuccess();
            }
            if (this.particles) {
              if (this.particles.soulBurst) this.particles.soulBurst(cx, cy);
              if (this.particles.sparks) this.particles.sparks(cx, cy);
            }
            if (this.camera) this.camera.shake(6, 0.25);
            this.hud.showSkillUnlockNotification(pickup);
          }
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
    const mainCtx = this.ctx;
    let ctx = mainCtx;

    if (this.pixelCtx && this.pixelCanvas) {
      ctx = this.pixelCtx;
      ctx.save();
      ctx.clearRect(0, 0, this.pixelW, this.pixelH);
      ctx.scale(0.5, 0.5);
    } else {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    }

    if (this.gameState === STATE.TITLE) {
      if (ctx !== mainCtx) {
        ctx.restore();
        mainCtx.imageSmoothingEnabled = false;
        mainCtx.webkitImageSmoothingEnabled = false;
        mainCtx.mozImageSmoothingEnabled = false;
        mainCtx.msImageSmoothingEnabled = false;
        mainCtx.drawImage(this.pixelCanvas, 0, 0, CANVAS_W, CANVAS_H);
      }
      mainCtx.save();
      mainCtx.imageSmoothingEnabled = true;
      mainCtx.webkitImageSmoothingEnabled = true;
      mainCtx.mozImageSmoothingEnabled = true;
      mainCtx.msImageSmoothingEnabled = true;
      this.titleScreen.draw(mainCtx, this.keyBindings);
      mainCtx.restore();
      return;
    }

    // 1. Multi-layered Parallax Background (Cathedral ruins, broken eclipse, volumetric fog)
    this.background.draw(ctx, this.camera, this.time);

    ctx.save();
    this.camera.apply(ctx);

    // 2. Solid Building Back Walls (Watchtower with transparent windows, Cathedral Nave, Sanctuary, Fortress, Foundations)
    if (this.envRenderer && this.envRenderer.drawBackWalls) {
      this.envRenderer.drawBackWalls(ctx, this.camera, this.time, this.level);
    }

    // 3. Background Props (Cathedral arches, massive chains, hanging lanterns)
    if (this.envRenderer) {
      this.envRenderer.drawBackgroundProps(ctx, this.props, this.camera, this.time);
    }

    // 4. Platforms (Stone masonry, flagstones, organic moss & cave grass, runic ledges, fog gate)
    if (this.envRenderer) {
      this.envRenderer.drawPlatforms(ctx, this.level.platforms, this.camera, this.time, this.level);
    }

    // 4.5 Radiant Ancient Altar with First Sword on Watchtower Roof
    if (this.envRenderer && this.envRenderer.drawSwordPickup) {
      this.envRenderer.drawSwordPickup(ctx, this.swordPickup, this.time, this.player);
    }

    // Hidden Skill Pickups in bottom corners
    if (this.envRenderer && this.envRenderer.drawSkillPickups) {
      this.envRenderer.drawSkillPickups(ctx, this.skillPickups, this.time);
    }

    // 5. Foreground Props (Glowing crystals, water drips)
    if (this.envRenderer) {
      this.envRenderer.drawForegroundProps(ctx, this.props, this.camera, this.time);
    }

    // 6. Bonfires
    for (const b of this.bonfires) b.draw(ctx);

    // 7. Enemies
    for (const e of this.enemies) e.draw(ctx);
    // 8. Boss
    this.boss.draw(ctx);
    // 9. Player
    this.player.draw(ctx);
    // 10. Projectiles
    for (const p of this.projectiles) p.draw(ctx);
    // 11. Particles
    this.particles.draw(ctx);

    ctx.restore();

    // 12. 2D Dynamic Lighting & Atmospheric Vignette Pass
    if (this.lighting && (this.gameState === STATE.PLAYING || this.gameState === STATE.BONFIRE)) {
      this.lighting.render(ctx, this.camera, this.player, this.boss, this.enemies, this.bonfires, this.projectiles, this.props, this.time, this.swordPickup);
    }

    // Blit pixelated game world to main canvas (retro 2x pixel art scaling)
    if (ctx !== mainCtx) {
      ctx.restore();
      mainCtx.imageSmoothingEnabled = false;
      mainCtx.webkitImageSmoothingEnabled = false;
      mainCtx.mozImageSmoothingEnabled = false;
      mainCtx.msImageSmoothingEnabled = false;
      mainCtx.drawImage(this.pixelCanvas, 0, 0, CANVAS_W, CANVAS_H);
    }

    // High-Resolution Smooth UI & HUD Pass (Rendered at full 1280x720 with crisp readable text)
    mainCtx.save();
    mainCtx.imageSmoothingEnabled = true;
    mainCtx.webkitImageSmoothingEnabled = true;
    mainCtx.mozImageSmoothingEnabled = true;
    mainCtx.msImageSmoothingEnabled = true;

    // 12. HUD
    this.hud.draw(mainCtx, this.player, this.boss, this.gameState, dt);

    // Bonfire menu
    if (this.gameState === STATE.BONFIRE) this.bonfireMenu.draw(mainCtx, this.player);

    // Rebind menu
    if (this.gameState === STATE.REBIND) this.rebindMenu.draw(mainCtx);

    // Help overlay
    if (this.showHelp && this.gameState === STATE.PLAYING) this._drawHelp(mainCtx);

    mainCtx.restore();
  }

  _drawHelp(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(CANVAS_W / 2 - 250, 50, 500, 490);
    ctx.strokeStyle = '#556677'; ctx.strokeRect(CANVAS_W / 2 - 250, 50, 500, 490);
    ctx.fillStyle = '#aabbcc'; ctx.font = `bold 20px ${UI_FONT}`; ctx.textAlign = 'center';
    ctx.fillText('CONTROLS & COMBAT', CANVAS_W / 2, 85);

    ctx.font = `14px ${UI_FONT}`;
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
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('load', () => { new Game(); });
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Player,
    Enemy,
    Boss,
    Particle,
    ParticleSystem,
    Projectile,
    WEAPONS,
    UNARMED_ATTACK,
    SPELLS,
    AudioEngine,
    Game,
    EnvironmentRenderer,
    buildLevel,
    Bonfire,
  };
}
