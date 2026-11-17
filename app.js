// ============================================================================
// ABYSSAL KNIGHT — 2D Action Platformer (Expanded Edition)
// Spells, Bonfires, Multiple Weapons, Key Rebinding, Smooth Camera
// Pure vanilla JS + HTML5 Canvas — no dependencies
// ============================================================================
'use strict';

const CANVAS_W = 1280, CANVAS_H = 720;
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
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ============================================================================
// KEY BINDING SYSTEM
// ============================================================================
const DEFAULT_BINDINGS = {
  moveLeft:  ['ArrowLeft', 'KeyA'],
  moveRight: ['ArrowRight', 'KeyD'],
  jump:      ['ArrowUp', 'KeyW', 'Space'],
  attack:    ['KeyJ'],
  dash:      ['ShiftLeft', 'ShiftRight', 'KeyK'],
  heal:      ['KeyQ'],
  interact:  ['KeyF'],
  spell1:    ['Digit1'],
  spell2:    ['Digit2'],
  spell3:    ['Digit3'],
  weapon1:   ['Digit7'],
  weapon2:   ['Digit8'],
  weapon3:   ['Digit9'],
  weapon4:   ['Digit0'],
  weaponNext:['KeyR'],
  pause:     ['Escape'],
  help:      ['KeyH'],
  restart:   ['KeyN', 'KeyR', 'Space', 'Enter'],
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
    } catch(e) {}
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }
  save() {
    try { localStorage.setItem('abyssalKnightBindings', JSON.stringify(this.bindings)); } catch(e) {}
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
      moveLeft: 'Move Left', moveRight: 'Move Right', jump: 'Jump',
      attack: 'Attack', dash: 'Dash', heal: 'Heal', interact: 'Interact',
      spell1: 'Spell: Fireball', spell2: 'Spell: Ice Nova', spell3: 'Spell: Shadow Bolt',
      weapon1: 'Weapon 1', weapon2: 'Weapon 2', weapon3: 'Weapon 3', weapon4: 'Weapon 4',
      weaponNext: 'Next Weapon', pause: 'Pause', help: 'Help', restart: 'Restart',
    };
    return labels[action] || action;
  }
  getKeyLabel(code) {
    const map = {
      ArrowLeft:'←', ArrowRight:'→', ArrowUp:'↑', ArrowDown:'↓',
      Space:'Space', ShiftLeft:'LShift', ShiftRight:'RShift',
      ControlLeft:'LCtrl', ControlRight:'RCtrl', AltLeft:'LAlt', AltRight:'RAlt',
      Enter:'Enter', Backspace:'Bksp', Tab:'Tab',
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
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
      this._pendingLastKey = e.code;
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('mousedown', e => { if (e.button === 0) { this.mouseDown = true; this.mouseJustPressed = true; }});
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
  weapon(n) { return this._wasPressed('weapon'+n); }
  pausePressed() { return this._wasPressed('pause'); }
  helpPressed() { return this._wasPressed('help'); }
  restartPressed() { return this._wasPressed('restart'); }
  anyKey() { return Object.values(this.keys).some(v=>v) || this.mouseDown; }
}

// ============================================================================
// AUDIO ENGINE
// ============================================================================
class AudioEngine {
  constructor() { this.ctx = null; this.enabled = true; this.masterGain = null; }
  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch(e) { this.enabled = false; }
  }
  _play(fn) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    fn(this.ctx, this.masterGain);
  }
  _noise(dur, vol, decay) {
    this._play((ctx, dest) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length, decay||2);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur);
      s.connect(g); g.connect(dest); s.start();
    });
  }
  _tone(freq, freqEnd, type, dur, vol) {
    this._play((ctx, dest) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime+dur);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur);
      o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime+dur);
    });
  }
  swing() { this._tone(300,100,'sawtooth',0.08,0.3); }
  heavySwing() { this._tone(200,50,'sawtooth',0.14,0.4); }
  quickSwing() { this._tone(500,200,'sawtooth',0.05,0.25); }
  hit() { this._noise(0.12,0.5,2); }
  dash() { this._noise(0.15,0.3,1.5); }
  dodgeRoll() { this._noise(0.18,0.25,1.2); }
  dodgeSuccess() { this._tone(600,1100,'sine',0.2,0.3); }
  jump() { this._tone(200,500,'square',0.12,0.15); }
  doubleJump() { this._tone(350,750,'sine',0.16,0.25); this._noise(0.1,0.15,2); }
  enemyDeath() { this._tone(400,60,'square',0.3,0.25); }
  playerHurt() { this._tone(300,100,'sawtooth',0.2,0.35); }
  heal() { this._tone(400,800,'sine',0.3,0.2); }
  bossRoar() {
    this._play((ctx,dest) => {
      const dur=0.8;
      const o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain();
      o.type='sawtooth'; o2.type='square';
      o.frequency.setValueAtTime(80,ctx.currentTime); o.frequency.exponentialRampToValueAtTime(40,ctx.currentTime+dur);
      o2.frequency.setValueAtTime(85,ctx.currentTime); o2.frequency.exponentialRampToValueAtTime(35,ctx.currentTime+dur);
      g.gain.setValueAtTime(0.4,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      o.connect(g);o2.connect(g);g.connect(dest);o.start();o.stop(ctx.currentTime+dur);o2.start();o2.stop(ctx.currentTime+dur);
    });
  }
  fireball() { this._tone(200,600,'sawtooth',0.2,0.25); }
  iceNova() { this._tone(800,200,'sine',0.35,0.3); }
  shadowBolt() { this._tone(100,400,'square',0.15,0.3); }
  bonfire() { this._tone(300,600,'sine',0.5,0.15); }
  weaponSwitch() { this._tone(600,800,'sine',0.06,0.1); }
}

// ============================================================================
// CAMERA — extra smooth with configurable dampening
// ============================================================================
class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.shakeDur = 0; this.shakeIntensity = 0;
    this.targetX = 0; this.targetY = 0;
    this.levelWidth = 0; this.levelHeight = 0;
    // Smooth camera params
    this.smoothX = 3.0;   // horizontal follow speed
    this.smoothY = 4.0;   // vertical follow speed
    this.lookAheadX = 100; // pixels ahead in movement dir
    this.lookAheadY = 50;  // pixels down when falling
    this.lookAheadSmooth = 2.0; // how fast look-ahead shifts
    this.currentLookX = 0;
    this.currentLookY = 0;
    this.deadZoneX = 20;
    this.deadZoneY = 15;
  }
  follow(player, dt) {
    // Compute desired look-ahead
    const desiredLookX = player.facing * this.lookAheadX;
    const desiredLookY = player.vy > 100 ? this.lookAheadY : player.vy < -100 ? -this.lookAheadY * 0.5 : 0;
    // Smoothly shift look-ahead
    this.currentLookX = lerp(this.currentLookX, desiredLookX, 1 - Math.exp(-this.lookAheadSmooth * dt));
    this.currentLookY = lerp(this.currentLookY, desiredLookY, 1 - Math.exp(-this.lookAheadSmooth * dt));

    this.targetX = player.x + player.w/2 - CANVAS_W/2 + this.currentLookX;
    this.targetY = player.y + player.h/2 - CANVAS_H/2 + this.currentLookY;

    // Dead-zone: don't update if target is very close
    const dxCam = this.targetX - this.x;
    const dyCam = this.targetY - this.y;
    if (Math.abs(dxCam) > this.deadZoneX) {
      this.x = lerp(this.x, this.targetX, 1 - Math.exp(-this.smoothX * dt));
    }
    if (Math.abs(dyCam) > this.deadZoneY) {
      this.y = lerp(this.y, this.targetY, 1 - Math.exp(-this.smoothY * dt));
    }

    this.x = clamp(this.x, 0, Math.max(0, this.levelWidth - CANVAS_W));
    this.y = clamp(this.y, 0, Math.max(0, this.levelHeight - CANVAS_H));

    if (this.shakeDur > 0) {
      this.shakeDur -= dt;
      this.shakeX = rand(-this.shakeIntensity, this.shakeIntensity);
      this.shakeY = rand(-this.shakeIntensity, this.shakeIntensity);
      this.shakeIntensity *= 0.92;
    } else { this.shakeX = 0; this.shakeY = 0; }
  }
  shake(intensity, duration) { this.shakeIntensity = Math.max(this.shakeIntensity, intensity); this.shakeDur = Math.max(this.shakeDur, duration); }
  apply(ctx) { ctx.translate(-Math.round(this.x + this.shakeX), -Math.round(this.y + this.shakeY)); }
  screenToWorld(sx, sy) { return { x: sx + this.x, y: sy + this.y }; }
}

// ============================================================================
// PARTICLES
// ============================================================================
class Particle {
  constructor(x,y,vx,vy,life,color,size,gravity,fadeOut,type) {
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;
    this.life=this.maxLife=life;this.color=color;this.size=size;
    this.gravity=gravity||0;this.fadeOut=fadeOut!==false;
    this.type=type||'square';this.dead=false;
  }
  update(dt) {
    this.vy+=this.gravity*dt; this.x+=this.vx*dt; this.y+=this.vy*dt;
    this.life-=dt; if(this.life<=0)this.dead=true;
  }
  draw(ctx) {
    const alpha=this.fadeOut?clamp(this.life/this.maxLife,0,1):1;
    const s=this.size*(this.type==='soul'?(0.5+0.5*alpha):1);
    ctx.globalAlpha=alpha;
    if(this.type==='soul'){
      ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(this.x,this.y,s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(this.x,this.y,s*0.4,0,Math.PI*2);ctx.fill();
    } else if(this.type==='fire'){
      ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(this.x,this.y,s,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle=this.color;ctx.fillRect(this.x-s/2,this.y-s/2,s,s);
    }
    ctx.globalAlpha=1;
  }
}

class ParticleSystem {
  constructor() { this.particles=[]; }
  add(p) { this.particles.push(p); }
  update(dt) { for(let i=this.particles.length-1;i>=0;i--){this.particles[i].update(dt);if(this.particles[i].dead)this.particles.splice(i,1);} }
  draw(ctx) { for(const p of this.particles) p.draw(ctx); }
  clear() { this.particles=[]; }

  dustLand(x,y) { for(let i=0;i<8;i++) this.add(new Particle(x+rand(-10,10),y,rand(-60,60),rand(-40,-10),rand(0.2,0.5),'#8888aa',rand(2,4),200)); }
  dustRun(x,y,dir) { this.add(new Particle(x,y,rand(-20,20)-dir*30,rand(-30,-5),rand(0.15,0.3),'#7777aa',rand(2,3),100)); }
  rollDust(x,y,dir) { for(let i=0;i<3;i++) this.add(new Particle(x,y,rand(-30,30)-dir*40,rand(-40,-10),rand(0.2,0.4),'#8888aa',rand(2,4),150)); }
  dodgeSparks(x,y) {
    for(let i=0;i<12;i++){
      const a=rand(0,Math.PI*2),s=rand(80,220);
      this.add(new Particle(x,y,Math.cos(a)*s,Math.sin(a)*s,rand(0.25,0.5),rand(0,1)>0.4?'#66eeff':'#ffffff',rand(3,5),-20,true,'soul'));
    }
  }
  monarchWings(x,y) {
    for(let i=0;i<14;i++){
      const a=rand(0,Math.PI*2),s=rand(40,100);
      this.add(new Particle(x+rand(-12,12),y-8,Math.cos(a)*s,Math.sin(a)*s+20,rand(0.25,0.5),rand(0,1)>0.4?'#ffffff':'#88eeff',rand(2,5),60,true,'soul'));
    }
  }
  sparks(x,y) { for(let i=0;i<6;i++) this.add(new Particle(x,y,rand(-200,200),rand(-200,50),rand(0.1,0.3),rand(0,1)>0.5?'#fff':'#ffcc44',rand(2,4),400)); }
  soulBurst(x,y) { for(let i=0;i<12;i++){const a=rand(0,Math.PI*2),s=rand(40,120);this.add(new Particle(x,y,Math.cos(a)*s,Math.sin(a)*s,rand(0.6,1.5),'#66ddff',rand(3,6),-50,true,'soul'));} }
  dashTrail(x,y,w,h,f) { for(let i=0;i<3;i++) this.add(new Particle(x+rand(0,w),y+rand(0,h),-f*rand(10,40),rand(-20,20),rand(0.1,0.25),'rgba(100,200,255,0.6)',rand(4,8),0)); }
  shockwave(x,y,dir) { for(let i=0;i<15;i++) this.add(new Particle(x+dir*i*20,y-5,dir*rand(60,150),rand(-80,-20),rand(0.3,0.6),'#ffaa44',rand(3,6),300)); }
  deathBurst(x,y) { for(let i=0;i<30;i++){const a=rand(0,Math.PI*2),s=rand(50,200);this.add(new Particle(x,y,Math.cos(a)*s,Math.sin(a)*s,rand(0.5,1.2),rand(0,1)>0.5?'#66ddff':'#ffffff',rand(3,7),200,true,'soul'));} }
  fireEmbers(x,y) {
    for(let i=0;i<2;i++){
      const c = ['#ff6622','#ffaa33','#ff4411','#ffcc66'][randInt(0,3)];
      this.add(new Particle(x+rand(-8,8),y,rand(-15,15),rand(-60,-20),rand(0.3,0.8),c,rand(2,4),-30,true,'fire'));
    }
  }
  fireballTrail(x,y) { for(let i=0;i<2;i++) this.add(new Particle(x+rand(-6,6),y+rand(-6,6),rand(-30,30),rand(-30,30),rand(0.1,0.25),'#ff8833',rand(3,5),0,true,'fire')); }
  iceExplosion(x,y) { for(let i=0;i<20;i++){const a=rand(0,Math.PI*2),s=rand(80,200);this.add(new Particle(x,y,Math.cos(a)*s,Math.sin(a)*s,rand(0.3,0.7),'#aaeeff',rand(3,6),100));} }
  shadowTrail(x,y) { for(let i=0;i<2;i++) this.add(new Particle(x+rand(-4,4),y+rand(-4,4),rand(-20,20),rand(-20,20),rand(0.15,0.3),'#8844cc',rand(3,5),0,true,'fire')); }
}

// ============================================================================
// WEAPON DEFINITIONS
// ============================================================================
const WEAPONS = [
  {
    name: 'Straight Sword',
    damage: 1,
    range: 48,         // hitbox width
    height: 36,        // hitbox height
    attackDur: 0.25,
    cooldown: 0.12,
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
    name: 'Greatsword',
    damage: 3,
    range: 65,
    height: 48,
    attackDur: 0.4,
    cooldown: 0.3,
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
    name: 'Daggers',
    damage: 1,
    range: 32,
    height: 28,
    attackDur: 0.12,
    cooldown: 0.06,
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
    name: 'Spear',
    damage: 2,
    range: 70,
    height: 18,
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
  constructor(x,y,vx,vy,damage,type,owner) {
    this.x=x; this.y=y; this.vx=vx; this.vy=vy;
    this.w=12; this.h=12; this.damage=damage;
    this.type=type; this.owner=owner;
    this.life=3.0; this.dead=false;
    if(type==='fireball'){ this.w=16; this.h=16; this.life=2.5; }
    if(type==='shadowbolt'){ this.w=10; this.h=10; this.life=2.0; }
  }
  update(dt,level,particles) {
    this.x += this.vx*dt;
    this.y += this.vy*dt;
    this.life -= dt;
    if(this.life<=0) this.dead=true;
    // Trail
    if(this.type==='fireball') particles.fireballTrail(this.x,this.y);
    if(this.type==='shadowbolt') particles.shadowTrail(this.x,this.y);
    // Platform collision
    for(const p of level.platforms) {
      if(p.type==='oneway') continue;
      if(rectsOverlap(this,p)) { this.dead=true; break; }
    }
  }
  draw(ctx) {
    if(this.dead) return;
    ctx.save();
    if(this.type==='fireball') {
      ctx.fillStyle='#ff6622';
      ctx.beginPath();ctx.arc(this.x+this.w/2,this.y+this.h/2,8,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffcc44';
      ctx.beginPath();ctx.arc(this.x+this.w/2,this.y+this.h/2,4,0,Math.PI*2);ctx.fill();
    } else if(this.type==='shadowbolt') {
      ctx.fillStyle='#8833cc';
      ctx.beginPath();ctx.arc(this.x+this.w/2,this.y+this.h/2,6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#cc77ff';
      ctx.beginPath();ctx.arc(this.x+this.w/2,this.y+this.h/2,3,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  getBounds() { return {x:this.x,y:this.y,w:this.w,h:this.h}; }
}

// ============================================================================
// BONFIRE
// ============================================================================
class Bonfire {
  constructor(x,y,id) {
    this.x=x; this.y=y; this.id=id;
    this.w=30; this.h=30;
    this.lit=false; // becomes lit on first interact
    this.animTimer=0;
    this.interactRange=50;
  }
  update(dt,particles) {
    this.animTimer+=dt;
    if(this.lit && Math.random()<0.3) {
      particles.fireEmbers(this.x+this.w/2, this.y);
    }
  }
  draw(ctx) {
    const x=this.x, y=this.y;
    // Stone base
    ctx.fillStyle='#444455';
    ctx.beginPath();
    ctx.arc(x+15, y+28, 18, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle='#333344';
    ctx.fillRect(x-3, y+22, 36, 10);

    // Sword (like Elden Ring site of grace / Dark Souls bonfire)
    ctx.fillStyle='#667788';
    ctx.fillRect(x+13, y-10, 4, 36);
    ctx.fillStyle='#778899';
    ctx.fillRect(x+7, y-4, 16, 4);

    if(this.lit) {
      // Fire glow
      const flicker = Math.sin(this.animTimer*8)*0.15+0.85;
      ctx.save();
      ctx.globalAlpha=0.3*flicker;
      const grad = ctx.createRadialGradient(x+15,y+5,5,x+15,y+5,50);
      grad.addColorStop(0,'#ffaa33');
      grad.addColorStop(1,'rgba(255,100,0,0)');
      ctx.fillStyle=grad;
      ctx.fillRect(x-40,y-50,100,100);
      ctx.restore();

      // Flames
      const flames = [
        {dx:0, s:1}, {dx:-5, s:0.7}, {dx:5, s:0.8}
      ];
      for(const f of flames) {
        const fh = (12+Math.sin(this.animTimer*10+f.dx)*4)*f.s;
        ctx.fillStyle='#ff6622';
        ctx.beginPath();
        ctx.moveTo(x+15+f.dx-5*f.s, y+5);
        ctx.quadraticCurveTo(x+15+f.dx-3*f.s, y+5-fh*0.6, x+15+f.dx, y+5-fh);
        ctx.quadraticCurveTo(x+15+f.dx+3*f.s, y+5-fh*0.6, x+15+f.dx+5*f.s, y+5);
        ctx.fill();
        // Inner flame
        ctx.fillStyle='#ffcc44';
        ctx.beginPath();
        const ih=fh*0.5;
        ctx.moveTo(x+15+f.dx-2*f.s, y+5);
        ctx.quadraticCurveTo(x+15+f.dx, y+5-ih, x+15+f.dx+2*f.s, y+5);
        ctx.fill();
      }
    } else {
      // Unlit — just embers
      ctx.fillStyle='#553322';
      ctx.beginPath();
      ctx.arc(x+15, y+8, 5, 0, Math.PI*2);
      ctx.fill();
    }

    // Interaction prompt
    if(this._showPrompt) {
      ctx.fillStyle='#ccaa66';
      ctx.font='12px monospace';
      ctx.textAlign='center';
      ctx.fillText('[F] Rest', x+15, y-20);
      ctx.textAlign='left';
      this._showPrompt = false;
    }
  }
  isPlayerNear(player) {
    const cx = this.x+this.w/2, cy = this.y+this.h/2;
    const px = player.x+player.w/2, py = player.y+player.h/2;
    return Math.hypot(cx-px,cy-py) < this.interactRange;
  }
}

// ============================================================================
// LEVEL DATA
// ============================================================================
function buildLevel() {
  const platforms = [];
  const enemies = [];
  const bonfires = [];
  const P = (x,y,w,h,type='solid') => platforms.push({x,y,w,h,type,ox:x,oy:y});

  // ---- Section 1: Starting area ----
  P(0, 640, 1600, 80);
  P(0, 400, 40, 240);
  P(200, 560, 160, 20, 'oneway');
  P(450, 480, 160, 20, 'oneway');

  // First bonfire — right at start
  bonfires.push(new Bonfire(120, 610, 0));

  enemies.push({type:'crawler',x:600,y:600,patrolRange:200});
  enemies.push({type:'crawler',x:1000,y:600,patrolRange:150});

  // ---- Section 2: Platforming ----
  P(1600, 640, 200, 80);
  P(1850, 560, 140, 20, 'oneway');
  P(2080, 480, 160, 20, 'oneway');
  P(2320, 410, 180, 20, 'oneway');
  platforms.push({x:2600,y:380,w:130,h:20,type:'moving',ox:2600,oy:380,mx:0,my:140,speed:80,t:0});
  P(2900, 320, 160, 20, 'oneway');
  P(3180, 380, 200, 20, 'oneway');

  enemies.push({type:'flyer',x:2000,y:380});
  enemies.push({type:'flyer',x:2900,y:300});

  // ---- Section 3: Enemy gauntlet ----
  P(3450, 640, 1200, 80);
  P(3450, 300, 40, 340);
  P(3700, 480, 160, 20, 'oneway');
  P(4000, 400, 160, 20, 'oneway');
  P(4300, 520, 160, 20, 'oneway');

  // Second bonfire — before gauntlet
  bonfires.push(new Bonfire(3500, 610, 1));

  enemies.push({type:'crawler',x:3600,y:600,patrolRange:200});
  enemies.push({type:'guard',x:3900,y:592});
  enemies.push({type:'crawler',x:4200,y:600,patrolRange:150});
  enemies.push({type:'flyer',x:4000,y:350});
  enemies.push({type:'guard',x:4400,y:592});

  // ---- Section 4: Boss arena ----
  P(4650, 640, 800, 80);
  P(4650, 200, 40, 440);
  P(5410, 200, 40, 440);
  P(4650, 200, 800, 40);

  // Third bonfire — just before boss
  bonfires.push(new Bonfire(4680, 610, 2));

  const bossSpawn = {x:5050,y:480};
  const bossArena = {x:4650,y:200,w:800,h:520};
  const bossTrigger = {x:4700,y:200,w:60,h:440};

  return { platforms, enemies, bonfires, bossSpawn, bossArena, bossTrigger,
           playerStart:{x:100,y:560}, width:5500, height:720 };
}

// ============================================================================
// PLAYER
// ============================================================================
class Player {
  constructor(x,y) {
    this.x=x; this.y=y; this.w=28; this.h=44;
    this.vx=0; this.vy=0; this.facing=1;
    this.speed=280; this.jumpForce=-540;
    this.onGround=false; this.onWall=0;
    this.wallSliding=false;

    this.maxJumps=2;
    this.jumpsLeft=2;
    this.wingsTimer=0;

    this.coyoteTime=0; this.coyoteMax=0.1;
    this.jumpBuffer=0; this.jumpBufferMax=0.12;
    this.jumpHeld=false; this.jumpCutMult=0.4;

    this.dashSpeed=620; this.dashDur=0.24;
    this.dashCooldownMax=0.55;
    this.dashing=false; this.dashTimer=0;
    this.dashCooldown=0; this.dashDir=1;
    this.isGroundRoll=true;
    this.iFrames=false;
    this._hasTriggeredDodgeEffect=false;

    this.attacking=false; this.attackTimer=0;
    this.attackCooldown=0; this.attackHitbox=null;
    this.hasHitThisSwing=new Set();

    this.hp=5; this.maxHp=5;
    this.invulnTimer=0; this.invulnDur=1.0;
    this.soul=0; this.maxSoul=100; this.healCost=33;

    // Weapons
    this.weaponIndex = 0;
    this.unlockedWeapons = [true, true, true, true]; // all unlocked for demo

    // Spells
    this.spellCooldowns = [0, 0, 0];

    // Bonfire respawn
    this.respawnX = x; this.respawnY = y;
    this.lastBonfireId = -1;

    this.state='idle'; this.animTimer=0; this.animFrame=0;
    this.dead=false; this.deathTimer=0;
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

    switch(index) {
      case 0: // Fireball
        audio.fireball();
        projectiles.push(new Projectile(
          this.x + this.w/2 + this.facing*10, this.y + this.h/3,
          this.facing * 450, 0, 3, 'fireball', 'player'
        ));
        camera.shake(3, 0.1);
        break;
      case 1: // Ice Nova
        audio.iceNova();
        particles.iceExplosion(this.x + this.w/2, this.y + this.h/2);
        camera.shake(6, 0.2);
        // AoE damage handled by game
        break;
      case 2: // Shadow Bolt
        audio.shadowBolt();
        projectiles.push(new Projectile(
          this.x + this.w/2 + this.facing*10, this.y + this.h/3,
          this.facing * 600, 0, 2, 'shadowbolt', 'player'
        ));
        break;
    }
  }

  update(dt, input, level, particles, camera, audio) {
    if (this.dead) { this.deathTimer+=dt; return; }

    if(this.invulnTimer>0) this.invulnTimer-=dt;
    if(this.dashCooldown>0) this.dashCooldown-=dt;
    if(this.attackCooldown>0) this.attackCooldown-=dt;
    if(this.coyoteTime>0) this.coyoteTime-=dt;
    if(this.jumpBuffer>0) this.jumpBuffer-=dt;
    if(this.wingsTimer>0) this.wingsTimer-=dt;
    for(let i=0;i<this.spellCooldowns.length;i++) {
      if(this.spellCooldowns[i]>0) this.spellCooldowns[i]-=dt;
    }
    this.animTimer+=dt;

    // DASH / DODGE ROLL
    if(this.dashing) {
      this.dashTimer-=dt;
      this.vx=this.dashDir*this.dashSpeed; this.vy=0;
      this.iFrames=true;
      if(this.isGroundRoll){
        particles.rollDust(this.x+this.w/2,this.y+this.h,this.dashDir);
      } else {
        particles.dashTrail(this.x,this.y,this.w,this.h,this.dashDir);
      }
      if(this.dashTimer<=0){this.dashing=false;this.iFrames=false;this.vx=this.dashDir*this.speed*0.5;}
    } else {
      this.iFrames=false;

      // ATTACK
      const wpn = this.weapon;
      if(input.attackPressed() && !this.attacking && this.attackCooldown<=0) {
        this.attacking=true;
        this.attackTimer=wpn.attackDur;
        this.attackCooldown=wpn.cooldown+wpn.attackDur;
        this.hasHitThisSwing.clear();
        audio[wpn.sound]();
        this.attackHitbox = {
          x: this.facing===1 ? this.x+this.w : this.x-wpn.range,
          y: this.y+(this.h-wpn.height)/2, w:wpn.range, h:wpn.height
        };
      }
      if(this.attacking) {
        this.attackTimer-=dt;
        this.attackHitbox = {
          x: this.facing===1 ? this.x+this.w : this.x-wpn.range,
          y: this.y+(this.h-wpn.height)/2, w:wpn.range, h:wpn.height
        };
        if(this.attackTimer<=0){this.attacking=false;this.attackHitbox=null;}
      }

      // MOVEMENT
      let moveX=0;
      if(input.left()) moveX-=1;
      if(input.right()) moveX+=1;
      if(moveX!==0 && !this.attacking) this.facing=moveX;

      const accel=this.onGround?2200:1400;
      const decel=this.onGround?1800:600;
      if(moveX!==0){
        this.vx+=moveX*accel*dt;
        this.vx=clamp(this.vx,-this.speed,this.speed);
        if(this.onGround&&Math.abs(this.vx)>50&&Math.random()<0.3) particles.dustRun(this.x+this.w/2,this.y+this.h,this.facing);
      } else {
        if(this.vx>0){this.vx-=decel*dt;if(this.vx<0)this.vx=0;}
        else if(this.vx<0){this.vx+=decel*dt;if(this.vx>0)this.vx=0;}
      }

      // DASH / DODGE ROLL
      if(input.dashPressed() && this.dashCooldown<=0 && !this.attacking) {
        this.dashing=true;
        this.dashTimer=this.dashDur;
        this.dashCooldown=this.dashCooldownMax;
        if(input.left()) this.dashDir=-1;
        else if(input.right()) this.dashDir=1;
        else this.dashDir=this.facing;
        this.facing=this.dashDir;
        this.isGroundRoll=this.onGround;
        this._hasTriggeredDodgeEffect=false;
        if(this.isGroundRoll){
          audio.dodgeRoll();
          particles.dustLand(this.x+this.w/2,this.y+this.h);
        } else {
          audio.dash();
        }
      }

      // HEAL
      if(input.healPressed()&&this.soul>=this.healCost&&this.hp<this.maxHp&&this.onGround){
        this.soul-=this.healCost;this.hp=Math.min(this.hp+1,this.maxHp);audio.heal();
        for(let i=0;i<10;i++) particles.add(new Particle(this.x+this.w/2,this.y+this.h/2,rand(-40,40),rand(-80,-20),rand(0.4,0.8),'#66ffaa',rand(3,5),-100,true,'soul'));
      }

      // GRAVITY
      this.vy+=GRAVITY*dt;
      this.wallSliding=false;
      if(!this.onGround&&this.onWall!==0&&this.vy>0){
        if((this.onWall===-1&&input.left())||(this.onWall===1&&input.right())){
          this.wallSliding=true;this.vy=Math.min(this.vy,100);
        }
      }
      this.vy=Math.min(this.vy,TERMINAL_VEL);

      // JUMP
      if(input.jumpPressed()) this.jumpBuffer=this.jumpBufferMax;
      this.jumpHeld=input.jumpHeld();

      if(this.jumpBuffer>0){
        if(this.coyoteTime>0){
          this.vy=this.jumpForce;this.coyoteTime=0;this.jumpBuffer=0;this.onGround=false;this.jumpsLeft=this.maxJumps-1;audio.jump();
        } else if(this.wallSliding||this.onWall!==0){
          this.vy=this.jumpForce*0.9;this.vx=-this.onWall*this.speed*1.1;this.facing=-this.onWall;
          this.onWall=0;this.wallSliding=false;this.jumpBuffer=0;this.jumpsLeft=this.maxJumps-1;audio.jump();
          particles.dustLand(this.x+this.w/2,this.y+this.h/2);
        } else if(this.jumpsLeft>0){
          // Double Jump (Monarch Wings)!
          this.vy=this.jumpForce*0.95;
          this.jumpsLeft--;
          this.jumpBuffer=0;
          this.wingsTimer=0.35;
          audio.doubleJump();
          particles.monarchWings(this.x+this.w/2,this.y+this.h);
        }
      }
      if(!this.jumpHeld&&this.vy<0) this.vy*=(1-(1-this.jumpCutMult)*dt*20);
    }

    // COLLIDE
    const prevOnGround=this.onGround;
    this.onGround=false; this.onWall=0;

    this.x+=this.vx*dt;
    for(const p of level.platforms){
      if(p.type==='oneway') continue;
      if(rectsOverlap(this,p)){
        if(this.vx>0){this.x=p.x-this.w;this.vx=0;this.onWall=1;}
        else if(this.vx<0){this.x=p.x+p.w;this.vx=0;this.onWall=-1;}
      }
    }
    this.y+=this.vy*dt;
    for(const p of level.platforms){
      if(rectsOverlap(this,p)){
        if(p.type==='oneway'){
          if(this.vy>0&&this.y+this.h-this.vy*dt<=p.y+4){this.y=p.y-this.h;this.vy=0;this.onGround=true;}
        } else {
          if(this.vy>0){this.y=p.y-this.h;this.vy=0;this.onGround=true;}
          else if(this.vy<0){this.y=p.y+p.h;this.vy=0;}
        }
      }
    }
    // Moving platform
    for(const p of level.platforms){
      if(p.type==='moving'&&this.onGround&&this.vy>=0&&this.x+this.w>p.x&&this.x<p.x+p.w&&Math.abs(this.y+this.h-p.y)<6){
        this.x+=(p.pvx||0)*dt; this.y+=(p.pvy||0)*dt;
      }
    }
    if(this.onGround){
      this.coyoteTime=this.coyoteMax;
      this.jumpsLeft=this.maxJumps;
    }
    if(this.wallSliding||this.onWall!==0){
      this.jumpsLeft=this.maxJumps;
    }
    if(this.onGround&&!prevOnGround&&this.vy>=0) particles.dustLand(this.x+this.w/2,this.y+this.h);
    if(this.y>level.height+100) this.takeDamage(99,0,particles,camera,audio);
    this._updateAnimState();
  }

  _updateAnimState() {
    let ns;
    if(this.dead)ns='dead';
    else if(this.dashing)ns='dash';
    else if(this.attacking)ns='attack';
    else if(this.wallSliding)ns='wallslide';
    else if(!this.onGround)ns=this.vy<0?'jump':'fall';
    else if(Math.abs(this.vx)>20)ns='run';
    else ns='idle';
    if(ns!==this.state){this.state=ns;this.animTimer=0;this.animFrame=0;}
    else {
      const spd=this.state==='run'?0.1:this.state==='idle'?0.5:0.1;
      if(this.animTimer>=spd){this.animTimer-=spd;this.animFrame++;}
    }
  }

  takeDamage(amount,knockDir,particles,camera,audio) {
    if(this.dead) return;
    if(this.iFrames) {
      if(!this._hasTriggeredDodgeEffect) {
        this._hasTriggeredDodgeEffect = true;
        particles.dodgeSparks(this.x+this.w/2, this.y+this.h/2);
        audio.dodgeSuccess();
        camera.shake(3, 0.1);
      }
      return;
    }
    if(this.invulnTimer>0) return;
    this.hp-=amount; this.invulnTimer=this.invulnDur;
    this.vy=-250; this.vx=knockDir*300;
    camera.shake(8,0.3); audio.playerHurt();
    particles.sparks(this.x+this.w/2,this.y+this.h/2);
    if(this.hp<=0){this.hp=0;this.dead=true;this.deathTimer=0;particles.deathBurst(this.x+this.w/2,this.y+this.h/2);}
  }

  respawn() {
    this.x=this.respawnX; this.y=this.respawnY;
    this.vx=0;this.vy=0;this.hp=this.maxHp;this.dead=false;this.deathTimer=0;
    this.invulnTimer=1.5;this.dashing=false;this.attacking=false;this.attackHitbox=null;
    this.iFrames=false;this.soul=Math.min(this.soul,this.maxSoul);
    this.spellCooldowns=[0,0,0];
  }

  draw(ctx) {
    if(this.dead&&this.deathTimer>0.5) return;
    if(this.invulnTimer>0&&!this.dashing&&Math.sin(this.invulnTimer*30)>0) return;

    ctx.save();
    const cx=this.x+this.w/2;
    const cy=this.y+this.h/2;
    ctx.translate(cx,0); ctx.scale(this.facing,1); ctx.translate(-cx,0);

    if(this.dashing) {
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
    if(this.wingsTimer>0){
      const wProg=this.wingsTimer/0.35;
      const flap=Math.sin(wProg*Math.PI)*1.3;
      ctx.save();
      ctx.globalAlpha=wProg*0.85;
      ctx.shadowColor='#66eeff';
      ctx.shadowBlur=16;
      ctx.fillStyle='#ffffff';
      ctx.strokeStyle='#66ccff';
      ctx.lineWidth=2;

      // Left wing
      ctx.beginPath();
      ctx.moveTo(cx-6,cy-4);
      ctx.quadraticCurveTo(cx-24*flap,cy-30*flap,cx-38*flap,cy-14*flap);
      ctx.quadraticCurveTo(cx-28*flap,cy+6,cx-6,cy+8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right wing
      ctx.beginPath();
      ctx.moveTo(cx+6,cy-4);
      ctx.quadraticCurveTo(cx+24*flap,cy-30*flap,cx+38*flap,cy-14*flap);
      ctx.quadraticCurveTo(cx+28*flap,cy+6,cx+6,cy+8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // Attack arc
    if(this.attacking){
      const wpn=this.weapon;
      const progress=1-this.attackTimer/wpn.attackDur;
      ctx.save();
      ctx.translate(this.x+this.w, this.y+this.h*0.4);
      ctx.strokeStyle='#bbddff'; ctx.lineWidth=3;
      ctx.globalAlpha=0.7*(1-progress);
      ctx.beginPath();
      if(wpn.isThrust){
        // Thrust line
        const ext=progress*wpn.bladeL*1.5;
        ctx.moveTo(0,0); ctx.lineTo(ext,0);
      } else {
        const startAngle=wpn.swingStart+progress*wpn.swingArc;
        ctx.arc(0,0,wpn.range*0.8,startAngle,startAngle+0.6);
      }
      ctx.stroke(); ctx.globalAlpha=1;
      ctx.restore();
    }
    ctx.restore();
  }

  _drawKnight(ctx, isRolling) {
    const x=this.x,y=this.y;
    const cx=x+this.w/2, cy=y+this.h/2;
    const bobY=this.state==='idle'?Math.sin(this.animTimer*2.5)*2:0;
    const runBob=this.state==='run'?Math.sin(this.animFrame*Math.PI)*3:0;
    const wpn=this.weapon;

    if (isRolling) {
      ctx.fillStyle='#223366';
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle='#3a3a4e';
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle='#555577';
      ctx.beginPath(); ctx.arc(cx + 4, cy - 2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle='#99eeff';
      ctx.fillRect(cx + 6, cy - 4, 5, 3);
      ctx.fillStyle=wpn.color;
      ctx.fillRect(cx - 14, cy - 2, 28, 3);
      return;
    }

    // Cape
    ctx.fillStyle='#3344aa';
    ctx.beginPath();
    ctx.moveTo(x+6,y+12+bobY);ctx.lineTo(x+2,y+this.h+4+runBob);
    ctx.lineTo(x+20,y+this.h-2+runBob*0.5);ctx.lineTo(x+14,y+12+bobY);
    ctx.closePath();ctx.fill();

    // Body
    ctx.fillStyle='#2a2a3a';ctx.fillRect(x+6,y+14+bobY,16,18);

    // Legs
    const legOff=this.state==='run'?Math.sin(this.animFrame*Math.PI)*5:0;
    ctx.fillStyle='#222233';
    ctx.fillRect(x+7,y+32+bobY,6,12+legOff);ctx.fillRect(x+15,y+32+bobY,6,12-legOff);
    ctx.fillStyle='#444466';
    ctx.fillRect(x+6,y+42+bobY+Math.max(0,legOff),7,3);
    ctx.fillRect(x+15,y+42+bobY+Math.max(0,-legOff),7,3);

    // Head
    ctx.fillStyle='#555577';ctx.fillRect(x+6,y+2+bobY,18,14);
    ctx.fillStyle='#99ccff';ctx.fillRect(x+18,y+6+bobY,6,4);
    ctx.fillStyle='#6666aa';
    ctx.beginPath();ctx.moveTo(x+8,y+2+bobY);ctx.lineTo(x+5,y-6+bobY);ctx.lineTo(x+14,y+2+bobY);ctx.closePath();ctx.fill();

    // Shoulders
    ctx.fillStyle='#555577';ctx.fillRect(x+2,y+14+bobY,8,6);ctx.fillRect(x+18,y+14+bobY,8,6);

    // Weapon drawing
    if(this.attacking) {
      const prog=1-this.attackTimer/wpn.attackDur;
      ctx.save();
      ctx.translate(x+this.w,y+18+bobY);
      if(wpn.isThrust) {
        // Thrust animation
        const ext=Math.sin(prog*Math.PI)*wpn.bladeL*0.5;
        ctx.rotate(0.1);
        ctx.fillStyle=wpn.color;
        ctx.fillRect(-2,0,wpn.bladeW,wpn.bladeL+ext);
        ctx.fillStyle=wpn.guardColor;
        ctx.fillRect(-4,-1,8,4);
      } else {
        const angle=wpn.swingStart+prog*wpn.swingArc;
        ctx.rotate(angle);
        ctx.fillStyle=wpn.color;
        ctx.fillRect(-wpn.bladeW/2,-2,wpn.bladeW,wpn.bladeL);
        ctx.fillStyle=wpn.guardColor;
        ctx.fillRect(-wpn.bladeW-1,-4,wpn.bladeW*2+2,5);
        ctx.fillStyle=wpn.handleColor;
        ctx.fillRect(-wpn.bladeW/2,-8,wpn.bladeW,6);
      }
      ctx.restore();
    } else {
      ctx.fillStyle=wpn.color;
      ctx.save();
      ctx.translate(x+this.w+2,y+18+bobY);
      ctx.rotate(0.3);
      ctx.fillRect(-wpn.bladeW/2,0,wpn.bladeW,wpn.bladeL);
      ctx.fillStyle=wpn.guardColor;
      ctx.fillRect(-wpn.bladeW/2-2,-1,wpn.bladeW+4,4);
      ctx.fillStyle=wpn.handleColor;
      ctx.fillRect(-wpn.bladeW/2,-5,wpn.bladeW,5);
      ctx.restore();
    }
  }

  getBounds() { return {x:this.x,y:this.y,w:this.w,h:this.h}; }
}

// ============================================================================
// ENEMIES
// ============================================================================
class Enemy {
  constructor(x,y,type,patrolRange) {
    this.x=x;this.y=y;this.type=type;
    this.vx=0;this.vy=0;this.facing=-1;
    this.dead=false;this.flashTimer=0;this.animTimer=0;
    this.origX=x; this.origY=y; this.origPatrol=patrolRange;

    switch(type) {
      case 'crawler':
        this.w=30;this.h=24;this.hp=this.maxHp=3;this.speed=60;this.damage=1;
        this.patrolLeft=x-(patrolRange||100);this.patrolRight=x+(patrolRange||100);this.facing=1;
        break;
      case 'flyer':
        this.w=28;this.h=28;this.hp=this.maxHp=2;this.speed=70;this.damage=1;
        this.baseY=y;this.sineT=0;this.aggroRange=250;this.charging=false;this.chargeTimer=0;
        break;
      case 'guard':
        this.w=32;this.h=48;this.hp=this.maxHp=5;this.speed=0;this.damage=2;
        this.attackRange=70;this.windUp=0;this.attackCool=0;
        this.guardAttacking=false;this.guardTimer=0;this.attackHitbox=null;
        break;
    }
  }

  reset() {
    this.x=this.origX; this.y=this.origY;
    this.dead=false; this.flashTimer=0; this.vx=0; this.vy=0;
    switch(this.type) {
      case 'crawler': this.hp=this.maxHp;this.facing=1;
        this.patrolLeft=this.origX-(this.origPatrol||100);this.patrolRight=this.origX+(this.origPatrol||100);break;
      case 'flyer': this.hp=this.maxHp;this.baseY=this.origY;this.sineT=0;this.charging=false;break;
      case 'guard': this.hp=this.maxHp;this.guardAttacking=false;this.attackHitbox=null;this.attackCool=0;break;
    }
  }

  update(dt,player,level,particles) {
    if(this.dead) return;
    this.flashTimer=Math.max(0,this.flashTimer-dt);
    this.animTimer+=dt;

    switch(this.type) {
      case 'crawler': this._updateCrawler(dt); break;
      case 'flyer': this._updateFlyer(dt,player); break;
      case 'guard': this._updateGuard(dt,player); break;
    }
    if(this.type!=='flyer'){this.vy+=GRAVITY*dt;this.vy=Math.min(this.vy,TERMINAL_VEL);}

    this.x+=this.vx*dt; this.y+=this.vy*dt;
    for(const p of level.platforms){
      if(p.type==='oneway'){
        if(this.vy>0&&rectsOverlap(this,p)&&this.y+this.h-this.vy*dt<=p.y+4){this.y=p.y-this.h;this.vy=0;}
      } else if(p.type!=='moving'){
        if(rectsOverlap(this,p)){
          if(this.vy>0){this.y=p.y-this.h;this.vy=0;}
          else if(this.vy<0){this.y=p.y+p.h;this.vy=0;}
        }
      }
    }
  }

  _updateCrawler(dt) {
    this.vx=this.facing*this.speed;
    if(this.x<=this.patrolLeft){this.facing=1;this.x=this.patrolLeft;}
    if(this.x+this.w>=this.patrolRight){this.facing=-1;this.x=this.patrolRight-this.w;}
  }
  _updateFlyer(dt,player) {
    this.sineT+=dt;
    if(!this.charging){
      this.y=this.baseY+Math.sin(this.sineT*2)*30;this.vx=0;this.vy=0;
      const dx=player.x-this.x,dy=player.y-this.y;
      if(Math.hypot(dx,dy)<this.aggroRange&&!player.dead){this.charging=true;this.chargeTimer=0.5;this.facing=dx>0?1:-1;}
    } else {
      this.chargeTimer-=dt;
      if(this.chargeTimer>0.2){this.vx=-this.facing*30;this.vy=-20;}
      else if(this.chargeTimer>0){
        const dx=player.x-this.x,dy=player.y-this.y,d=Math.hypot(dx,dy)||1;
        this.vx=(dx/d)*300;this.vy=(dy/d)*300;
      } else {
        const dy=this.baseY-this.y;this.vy=dy*2;this.vx*=0.9;
        if(Math.abs(dy)<10&&Math.abs(this.vx)<10){this.charging=false;this.vy=0;this.vx=0;}
      }
    }
  }
  _updateGuard(dt,player) {
    this.vx=0;
    if(this.attackCool>0){this.attackCool-=dt;return;}
    const dx=player.x-this.x;
    this.facing=dx>0?1:-1;
    if(Math.abs(dx)<this.attackRange&&Math.abs(player.y-this.y)<50&&!player.dead){
      if(!this.guardAttacking){this.guardAttacking=true;this.guardTimer=0.6;this.windUp=0.6;}
    }
    if(this.guardAttacking){
      this.guardTimer-=dt;this.windUp-=dt;
      if(this.windUp<=0&&this.guardTimer>-0.2){
        const hbW=50,hbH=40;
        this.attackHitbox={x:this.facing===1?this.x+this.w:this.x-hbW,y:this.y+4,w:hbW,h:hbH};
      } else this.attackHitbox=null;
      if(this.guardTimer<=-0.2){this.guardAttacking=false;this.attackHitbox=null;this.attackCool=1.0;}
    }
  }

  takeDamage(amount,knockDir,particles,camera,audio) {
    this.hp-=amount;this.flashTimer=0.15;this.vx+=knockDir*200;this.vy=-100;
    camera.shake(4,0.15);audio.hit();particles.sparks(this.x+this.w/2,this.y+this.h/2);
    if(this.hp<=0){this.dead=true;particles.soulBurst(this.x+this.w/2,this.y+this.h/2);audio.enemyDeath();}
  }

  draw(ctx) {
    if(this.dead) return;
    ctx.save();
    switch(this.type){
      case 'crawler': this._drawCrawler(ctx); break;
      case 'flyer': this._drawFlyer(ctx); break;
      case 'guard': this._drawGuard(ctx); break;
    }
    ctx.restore();
  }

  _drawCrawler(ctx) {
    const x=this.x,y=this.y,c=this.flashTimer>0?'#fff':'#884444',c2=this.flashTimer>0?'#fff':'#aa5555';
    ctx.fillStyle=c;ctx.fillRect(x+2,y+4,this.w-4,this.h-8);
    const la=Math.sin(this.animTimer*10);
    ctx.fillStyle=c2;
    ctx.fillRect(x,y+this.h-6+la*2,6,6);ctx.fillRect(x+10,y+this.h-6-la*2,6,6);
    ctx.fillRect(x+this.w-16,y+this.h-6+la*2,6,6);ctx.fillRect(x+this.w-6,y+this.h-6-la*2,6,6);
    ctx.fillStyle=this.flashTimer>0?'#fff':'#ffaa00';
    const ex=this.facing===1?x+this.w-10:x+4;
    ctx.fillRect(ex,y+6,4,4);ctx.fillRect(ex-7*this.facing,y+6,4,4);
    ctx.fillStyle=c2;const px=this.facing===1?x+this.w:x;
    ctx.beginPath();ctx.moveTo(px,y+8);ctx.lineTo(px+this.facing*8,y+4);ctx.lineTo(px+this.facing*6,y+12);ctx.closePath();ctx.fill();
  }
  _drawFlyer(ctx) {
    const x=this.x,y=this.y,c=this.flashTimer>0?'#fff':'#6644aa';
    ctx.fillStyle=c;ctx.beginPath();ctx.arc(x+this.w/2,y+this.h/2,12,0,Math.PI*2);ctx.fill();
    const wa=Math.sin(this.animTimer*12)*8;
    ctx.fillStyle=this.flashTimer>0?'#fff':'#8866cc';
    ctx.beginPath();ctx.ellipse(x+this.w/2-14,y+this.h/2-6+wa,10,5,-0.3,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(x+this.w/2+14,y+this.h/2-6-wa,10,5,0.3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=this.flashTimer>0?'#fff':'#ff4444';
    ctx.fillRect(x+this.w/2-4,y+this.h/2-3,3,3);ctx.fillRect(x+this.w/2+2,y+this.h/2-3,3,3);
    if(this.charging&&this.chargeTimer>0.2){ctx.fillStyle='#ff4444';ctx.font='bold 16px monospace';ctx.fillText('!',x+this.w/2-3,y-8);}
  }
  _drawGuard(ctx) {
    const x=this.x,y=this.y,c=this.flashTimer>0?'#fff':'#556677',c2=this.flashTimer>0?'#fff':'#445566';
    const bobY=Math.sin(this.animTimer*2);
    ctx.save();
    const cx=x+this.w/2;ctx.translate(cx,0);ctx.scale(this.facing,1);ctx.translate(-cx,0);
    ctx.fillStyle=c;ctx.fillRect(x+4,y+10+bobY,this.w-8,24);
    ctx.fillStyle=c2;ctx.fillRect(x+4,y+bobY,this.w-8,14);
    ctx.fillStyle=this.flashTimer>0?'#fff':'#dd6600';ctx.fillRect(x+20,y+4+bobY,8,4);
    ctx.fillStyle=c2;ctx.fillRect(x+6,y+34+bobY,8,14);ctx.fillRect(x+18,y+34+bobY,8,14);
    ctx.fillStyle=this.flashTimer>0?'#fff':'#667788';ctx.fillRect(x-2,y+10+bobY,8,22);
    if(this.guardAttacking){
      ctx.save();ctx.translate(x+this.w,y+16+bobY);
      if(this.windUp>0){ctx.rotate(-1.0-Math.sin(this.windUp*5)*0.5);}
      else{ctx.rotate(1.5);}
      ctx.fillStyle='#aabbcc';ctx.fillRect(-2,0,4,40);
      ctx.fillStyle='#8899aa';ctx.beginPath();ctx.moveTo(-6,36);ctx.lineTo(6,36);ctx.lineTo(0,48);ctx.closePath();ctx.fill();
      ctx.restore();
      if(this.windUp>0&&Math.sin(this.windUp*20)>0){ctx.fillStyle='#ff4444';ctx.font='bold 14px monospace';ctx.fillText('!',x+this.w/2-3,y-8);}
    } else {
      ctx.save();ctx.translate(x+this.w+4,y+14+bobY);ctx.rotate(0.2);
      ctx.fillStyle='#aabbcc';ctx.fillRect(-2,0,4,36);
      ctx.fillStyle='#8899aa';ctx.beginPath();ctx.moveTo(-5,32);ctx.lineTo(5,32);ctx.lineTo(0,42);ctx.closePath();ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  getBounds() { return {x:this.x,y:this.y,w:this.w,h:this.h}; }
}

// ============================================================================
// BOSS
// ============================================================================
class Boss {
  constructor(x,y) {
    this.x=x;this.y=y;this.w=64;this.h=80;
    this.vx=0;this.vy=0;this.facing=-1;
    this.hp=40;this.maxHp=40;this.dead=false;this.active=false;
    this.phase=1;this.phaseTransition=false;this.transitionTimer=0;
    this.state='idle';this.stateTimer=0;this.actionCooldown=1;
    this.animTimer=0;this.flashTimer=0;this.invulnTimer=0;
    this.attackHitbox=null;this.shockwaves=[];this.arena=null;this.spawnedMinions=false;
  }

  activate(arena,audio) {
    this.active=true;this.arena=arena;this.state='roar';this.stateTimer=1.5;audio.bossRoar();
  }

  update(dt,player,level,particles,camera,audio) {
    if(!this.active||this.dead) return;
    this.animTimer+=dt;
    this.flashTimer=Math.max(0,this.flashTimer-dt);
    if(this.invulnTimer>0) this.invulnTimer-=dt;

    if(this.phase===1&&this.hp<=this.maxHp*0.5&&!this.phaseTransition){
      this.phaseTransition=true;this.transitionTimer=2;this.state='roar';this.stateTimer=2;
      this.invulnTimer=2;camera.shake(12,1.5);audio.bossRoar();
    }
    if(this.phaseTransition){
      this.transitionTimer-=dt;
      if(this.transitionTimer<=0){this.phase=2;this.phaseTransition=false;}
      if(Math.random()<0.3) particles.add(new Particle(this.x+rand(0,this.w),this.y+rand(0,this.h),rand(-50,50),rand(-100,-30),rand(0.3,0.8),'#ff4444',rand(3,6),-50,true));
    }

    for(let i=this.shockwaves.length-1;i>=0;i--){
      const sw=this.shockwaves[i];sw.x+=sw.vx*dt;sw.life-=dt;sw.y=sw.groundY-10;
      if(sw.life<=0)this.shockwaves.splice(i,1);
    }

    this.vy+=GRAVITY*dt;this.vy=Math.min(this.vy,TERMINAL_VEL);
    this.stateTimer-=dt;this.attackHitbox=null;

    switch(this.state){
      case 'idle': this.vx=0;if(this.stateTimer<=0)this._chooseAction(player,audio);break;
      case 'walk':
        this.facing=player.x<this.x?-1:1;this.vx=this.facing*(this.phase===2?160:100);
        if(this.stateTimer<=0||Math.abs(player.x-this.x)<80){this.state='idle';this.stateTimer=this.phase===2?0.3:0.6;}break;
      case 'windup': this.vx=0;if(this.stateTimer<=0){this.state='attack';this.stateTimer=0.3;audio.heavySwing();camera.shake(6,0.2);}break;
      case 'attack':
        this.attackHitbox={x:this.facing===1?this.x+this.w:this.x-70,y:this.y+10,w:70,h:60};
        if(this.stateTimer<=0){this.state='idle';this.stateTimer=this.phase===2?0.4:0.8;this.attackHitbox=null;}break;
      case 'jump': this.vx=this.facing*100;break;
      case 'land': this.vx=0;if(this.stateTimer<=0){this.state='idle';this.stateTimer=0.5;}break;
      case 'dash':
        this.vx=this.facing*500;this.vy=0;
        this.attackHitbox={x:this.x,y:this.y+10,w:this.w,h:this.h-10};
        if(this.stateTimer<=0){this.state='idle';this.stateTimer=0.6;this.vx=0;}break;
      case 'roar': this.vx=0;if(this.stateTimer<=0){this.state='idle';this.stateTimer=0.5;}break;
    }

    this.x+=this.vx*dt;this.y+=this.vy*dt;

    for(const p of level.platforms){
      if(p.type==='oneway') continue;
      if(rectsOverlap(this,p)){
        if(this.vy>0&&this.y+this.h-this.vy*dt<=p.y+8){
          this.y=p.y-this.h;
          if(this.state==='jump'&&this.vy>200){
            this.state='land';this.stateTimer=0.4;camera.shake(10,0.3);audio.hit();
            this.shockwaves.push({x:this.x+this.w/2,groundY:p.y,vx:-250,life:0.8,w:30,h:20});
            this.shockwaves.push({x:this.x+this.w/2,groundY:p.y,vx:250,life:0.8,w:30,h:20});
            particles.shockwave(this.x+this.w/2,p.y,-1);
            particles.shockwave(this.x+this.w/2,p.y,1);
          }
          this.vy=0;
        } else if(this.vx>0){this.x=p.x-this.w;this.vx=0;}
        else if(this.vx<0){this.x=p.x+p.w;this.vx=0;}
      }
    }
    if(this.arena) this.x=clamp(this.x,this.arena.x+40,this.arena.x+this.arena.w-40-this.w);
  }

  _chooseAction(player,audio) {
    const dx=player.x-this.x,dist=Math.abs(dx);
    this.facing=dx>0?1:-1;
    const a=[];
    if(dist>150)a.push('walk','walk','jump');
    if(dist<120)a.push('windup','windup','jump');
    if(dist<200)a.push('windup');
    if(this.phase===2){a.push('dash');if(dist>100)a.push('dash');}
    const act=a[randInt(0,a.length-1)];
    switch(act){
      case 'walk':this.state='walk';this.stateTimer=rand(0.5,1.5);break;
      case 'windup':this.state='windup';this.stateTimer=this.phase===2?rand(0.3,0.6):rand(0.5,0.9);break;
      case 'jump':this.state='jump';this.stateTimer=0;this.vy=-600;this.vx=this.facing*150;break;
      case 'dash':this.state='dash';this.stateTimer=0.35;audio.dash();break;
    }
  }

  takeDamage(amount,knockDir,particles,camera,audio) {
    if(this.invulnTimer>0||this.dead)return;
    this.hp-=amount;this.flashTimer=0.15;this.invulnTimer=0.2;
    camera.shake(5,0.15);audio.hit();particles.sparks(this.x+this.w/2,this.y+this.h/3);
    if(this.hp<=0){this.hp=0;this.dead=true;camera.shake(15,2);
      particles.deathBurst(this.x+this.w/2,this.y+this.h/2);
      particles.deathBurst(this.x+this.w/2,this.y+this.h/3);audio.bossRoar();}
  }

  draw(ctx) {
    if(!this.active||this.dead) return;
    ctx.save();
    const cx=this.x+this.w/2;ctx.translate(cx,0);ctx.scale(this.facing,1);ctx.translate(-cx,0);
    const c=this.flashTimer>0?'#fff':'#553344';
    const c2=this.flashTimer>0?'#fff':'#774455';
    const c3=this.flashTimer>0?'#fff':'#993355';
    const bobY=this.state==='idle'?Math.sin(this.animTimer*2)*2:0;

    ctx.fillStyle=c;ctx.fillRect(this.x+8,this.y+24+bobY,this.w-16,36);
    ctx.fillStyle=c2;
    ctx.fillRect(this.x,this.y+20+bobY,16,20);ctx.fillRect(this.x+this.w-16,this.y+20+bobY,16,20);
    ctx.fillStyle=c2;ctx.fillRect(this.x+14,this.y+2+bobY,this.w-28,24);
    ctx.fillStyle=c3;
    ctx.beginPath();ctx.moveTo(this.x+14,this.y+4+bobY);ctx.lineTo(this.x+8,this.y-14+bobY);ctx.lineTo(this.x+22,this.y+4+bobY);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(this.x+this.w-14,this.y+4+bobY);ctx.lineTo(this.x+this.w-8,this.y-14+bobY);ctx.lineTo(this.x+this.w-22,this.y+4+bobY);ctx.closePath();ctx.fill();
    ctx.fillStyle=this.phase===2?'#ff2222':(this.phaseTransition&&Math.sin(this.animTimer*20)>0?'#ff0000':'#ff6600');
    ctx.fillRect(this.x+this.w-20,this.y+10+bobY,6,5);ctx.fillRect(this.x+this.w-30,this.y+10+bobY,6,5);

    const lo=this.state==='walk'?Math.sin(this.animTimer*8)*5:0;
    ctx.fillStyle=c;ctx.fillRect(this.x+12,this.y+60+bobY,12,20+lo);ctx.fillRect(this.x+this.w-24,this.y+60+bobY,12,20-lo);

    ctx.save();ctx.translate(this.x+this.w,this.y+30+bobY);
    if(this.state==='windup')ctx.rotate(-1.5+Math.sin(this.stateTimer*10)*0.2);
    else if(this.state==='attack')ctx.rotate(1.0);
    else if(this.state==='dash')ctx.rotate(0.3);
    else ctx.rotate(0.2);
    ctx.fillStyle=this.flashTimer>0?'#fff':'#aaaacc';ctx.fillRect(-3,0,6,55);
    ctx.fillStyle=this.flashTimer>0?'#fff':'#888aaa';ctx.fillRect(-8,48,16,10);
    ctx.fillStyle=this.flashTimer>0?'#fff':'#665544';ctx.fillRect(-3,-8,6,10);
    ctx.restore();

    if(this.state==='windup'){
      ctx.fillStyle='#ff4444';ctx.globalAlpha=0.5+0.5*Math.sin(this.animTimer*20);
      ctx.font='bold 20px monospace';ctx.fillText('!!',this.x+this.w/2-10,this.y-10);ctx.globalAlpha=1;
    }
    ctx.restore();

    for(const sw of this.shockwaves){
      const a=sw.life/0.8;
      ctx.fillStyle=`rgba(255,120,40,${a*0.7})`;ctx.fillRect(sw.x-sw.w/2,sw.y,sw.w,sw.h);
      ctx.fillStyle=`rgba(255,200,80,${a*0.5})`;ctx.fillRect(sw.x-sw.w/4,sw.y+4,sw.w/2,sw.h-8);
    }
  }

  getBounds() { return {x:this.x,y:this.y,w:this.w,h:this.h}; }
}

// ============================================================================
// PARALLAX BACKGROUND
// ============================================================================
class Background {
  constructor(levelWidth) {
    this.levelWidth=levelWidth;
    this.stars=[];
    for(let i=0;i<100;i++) this.stars.push({x:rand(0,CANVAS_W),y:rand(0,CANVAS_H*0.7),size:rand(1,3),speed:rand(0.1,0.3),blink:rand(0,Math.PI*2)});
    this.mountains1=this._genM(8,0.3,300,500);
    this.mountains2=this._genM(12,0.5,200,400);
    this.trees=this._genT(25,0.7);
  }
  _genM(c,p,mn,mx){const m=[];for(let i=0;i<c;i++)m.push({x:(this.levelWidth/c)*i+rand(-100,100),h:rand(mn,mx),w:rand(200,400),parallax:p});return m;}
  _genT(c,p){const t=[];for(let i=0;i<c;i++)t.push({x:(this.levelWidth/c)*i+rand(-80,80),h:rand(80,180),w:rand(20,40),parallax:p});return t;}

  draw(ctx,camera,time) {
    const grd=ctx.createLinearGradient(0,0,0,CANVAS_H);
    grd.addColorStop(0,'#0a0a1a');grd.addColorStop(0.5,'#141428');grd.addColorStop(1,'#1a1a2e');
    ctx.fillStyle=grd;ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

    for(const s of this.stars){
      const a=0.3+0.7*Math.abs(Math.sin(time*s.speed+s.blink));
      ctx.fillStyle=`rgba(200,200,255,${a})`;ctx.fillRect(s.x,s.y,s.size,s.size);
    }
    ctx.fillStyle='#334466';ctx.beginPath();ctx.arc(CANVAS_W*0.8,100,50,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#0a0a1a';ctx.beginPath();ctx.arc(CANVAS_W*0.8+15,90,45,0,Math.PI*2);ctx.fill();

    ctx.fillStyle='#12122a';
    for(const m of this.mountains1){const sx=m.x-camera.x*m.parallax;ctx.beginPath();ctx.moveTo(sx-m.w/2,CANVAS_H);ctx.lineTo(sx,CANVAS_H-m.h);ctx.lineTo(sx+m.w/2,CANVAS_H);ctx.closePath();ctx.fill();}
    ctx.fillStyle='#1a1a35';
    for(const m of this.mountains2){const sx=m.x-camera.x*m.parallax;ctx.beginPath();ctx.moveTo(sx-m.w/2,CANVAS_H);ctx.lineTo(sx,CANVAS_H-m.h);ctx.lineTo(sx+m.w/2,CANVAS_H);ctx.closePath();ctx.fill();}
    ctx.fillStyle='#181830';
    for(const t of this.trees){const sx=t.x-camera.x*t.parallax;
      ctx.fillRect(sx-t.w/4,CANVAS_H-t.h,t.w/2,t.h);
      ctx.beginPath();ctx.moveTo(sx-t.w,CANVAS_H-t.h+20);ctx.lineTo(sx,CANVAS_H-t.h-30);ctx.lineTo(sx+t.w,CANVAS_H-t.h+20);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(sx-t.w*0.8,CANVAS_H-t.h);ctx.lineTo(sx,CANVAS_H-t.h-50);ctx.lineTo(sx+t.w*0.8,CANVAS_H-t.h);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle='rgba(20,20,40,0.3)';ctx.fillRect(0,CANVAS_H*0.6,CANVAS_W,CANVAS_H*0.4);
  }
}

// ============================================================================
// HUD
// ============================================================================
class HUD {
  constructor(bindings) { this.bindings=bindings; this.deathAlpha=0;this.winAlpha=0;this.bossBarAlpha=0;this.weaponNotifyTimer=0;this.weaponNotifyName=''; }

  showWeaponSwitch(name) { this.weaponNotifyTimer=2; this.weaponNotifyName=name; }

  draw(ctx,player,boss,gameState,dt) {
    ctx.save();
    if(this.weaponNotifyTimer>0) this.weaponNotifyTimer-=dt;

    // HP Hearts
    for(let i=0;i<player.maxHp;i++){
      const hx=30+i*32,hy=30;
      this._drawHeart(ctx,hx,hy,i<player.hp?'#ff3355':'#333344',i<player.hp?'#ff6688':'#444455');
    }

    // Soul meter
    const smX=30,smY=58,smW=120,smH=12;
    ctx.fillStyle='#222233';ctx.fillRect(smX,smY,smW,smH);
    ctx.fillStyle='#44aadd';ctx.fillRect(smX,smY,smW*(player.soul/player.maxSoul),smH);
    ctx.strokeStyle='#556677';ctx.lineWidth=1;ctx.strokeRect(smX,smY,smW,smH);
    ctx.fillStyle='#6688aa';ctx.font='10px monospace';ctx.fillText('SOUL',smX,smY-2);

    if(player.soul>=player.healCost&&player.hp<player.maxHp){
      const hk=this.bindings.getKeyLabel(this.bindings.getKeys('heal')[0]||'Q');
      ctx.fillStyle='#66ffaa';ctx.fillText(`[${hk}] HEAL`,smX+smW+8,smY+10);
    }

    // Dash cooldown
    const dashReady=player.dashCooldown<=0;
    ctx.fillStyle=dashReady?'#66ccff':'#333344';ctx.fillRect(30,78,24,24);
    ctx.strokeStyle='#556677';ctx.strokeRect(30,78,24,24);
    ctx.fillStyle=dashReady?'#fff':'#666677';ctx.font='14px monospace';ctx.fillText('⚡',34,96);
    if(!dashReady){ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(30,78,24,24*(player.dashCooldown/player.dashCooldownMax));}

    // Current weapon
    ctx.fillStyle='#aabbcc';ctx.font='bold 12px monospace';
    ctx.fillText(`⚔ ${player.weapon.name}`,60,92);

    // Weapon switch notification
    if(this.weaponNotifyTimer>0){
      ctx.globalAlpha=Math.min(1,this.weaponNotifyTimer);
      ctx.fillStyle='#ccddee';ctx.font='bold 20px monospace';ctx.textAlign='center';
      ctx.fillText(this.weaponNotifyName,CANVAS_W/2,CANVAS_H-60);
      ctx.textAlign='left';ctx.globalAlpha=1;
    }

    // Spell slots
    for(let i=0;i<SPELLS.length;i++){
      const sx=30+i*42,sy=110;
      const sp=SPELLS[i];
      const ready=player.spellCooldowns[i]<=0&&player.soul>=sp.soulCost;
      ctx.fillStyle=ready?'#333355':'#222233';
      ctx.fillRect(sx,sy,36,36);
      ctx.strokeStyle=ready?'#6666aa':'#333344';ctx.lineWidth=1;ctx.strokeRect(sx,sy,36,36);
      ctx.fillStyle=ready?sp.color:'#555566';ctx.font='16px serif';ctx.fillText(sp.icon,sx+8,sy+24);
      // Cooldown overlay
      if(player.spellCooldowns[i]>0){
        const pct=player.spellCooldowns[i]/sp.cooldown;
        ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(sx,sy,36,36*pct);
      }
      // Key label
      const keyLabel=this.bindings.getKeyLabel(this.bindings.getKeys('spell'+(i+1))[0]||'');
      ctx.fillStyle='#667788';ctx.font='9px monospace';ctx.fillText(keyLabel,sx+2,sy+34);
      // Soul cost
      ctx.fillStyle='#4488aa';ctx.font='8px monospace';ctx.fillText(sp.soulCost,sx+22,sy+34);
    }

    // Boss HP bar
    if(boss&&boss.active&&!boss.dead){
      this.bossBarAlpha=Math.min(1,this.bossBarAlpha+0.02);
      ctx.globalAlpha=this.bossBarAlpha;
      const bw=400,bh=16,bx=CANVAS_W/2-bw/2,by=24;
      ctx.fillStyle='#222233';ctx.fillRect(bx-2,by-2,bw+4,bh+4);
      ctx.fillStyle=boss.phase===2?'#dd2244':'#cc4466';ctx.fillRect(bx,by,bw*(boss.hp/boss.maxHp),bh);
      ctx.strokeStyle='#888899';ctx.lineWidth=1;ctx.strokeRect(bx,by,bw,bh);
      ctx.fillStyle='#ccccdd';ctx.font='12px monospace';ctx.textAlign='center';
      ctx.fillText(boss.phase===2?'⚔ ABYSSAL WARDEN — PHASE 2 ⚔':'⚔ ABYSSAL WARDEN ⚔',CANVAS_W/2,by-6);
      ctx.textAlign='left';ctx.globalAlpha=1;
    } else { this.bossBarAlpha=0; }

    // Death screen
    if(gameState===STATE.DEAD){
      this.deathAlpha=Math.min(1,this.deathAlpha+0.015);
      ctx.fillStyle=`rgba(10,0,0,${this.deathAlpha*0.7})`;ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
      ctx.globalAlpha=this.deathAlpha;ctx.fillStyle='#cc2222';ctx.font='bold 72px serif';ctx.textAlign='center';
      ctx.fillText('YOU DIED',CANVAS_W/2,CANVAS_H/2-20);
      const rk=this.bindings.getKeyLabel(this.bindings.getKeys('restart')[0]||'N');
      ctx.fillStyle='#887766';ctx.font='20px monospace';
      ctx.fillText(`Press ${rk} to revive at bonfire`,CANVAS_W/2,CANVAS_H/2+40);
      ctx.textAlign='left';ctx.globalAlpha=1;
    } else { this.deathAlpha=0; }

    // Win screen
    if(gameState===STATE.WIN){
      this.winAlpha=Math.min(1,this.winAlpha+0.01);
      ctx.fillStyle=`rgba(5,5,20,${this.winAlpha*0.7})`;ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
      ctx.globalAlpha=this.winAlpha;ctx.fillStyle='#66aaff';ctx.font='bold 60px serif';ctx.textAlign='center';
      ctx.fillText('VICTORY',CANVAS_W/2,CANVAS_H/2-40);
      ctx.fillStyle='#aabbcc';ctx.font='italic 24px serif';ctx.fillText('The Abyss has been sealed',CANVAS_W/2,CANVAS_H/2+10);
      const rk=this.bindings.getKeyLabel(this.bindings.getKeys('restart')[0]||'N');
      ctx.fillStyle='#887766';ctx.font='18px monospace';ctx.fillText(`Press ${rk} to play again`,CANVAS_W/2,CANVAS_H/2+60);
      ctx.textAlign='left';ctx.globalAlpha=1;
    } else { this.winAlpha=0; }

    ctx.restore();
  }

  _drawHeart(ctx,x,y,c1,c2) {
    ctx.fillStyle=c1;ctx.beginPath();ctx.moveTo(x,y+6);
    ctx.bezierCurveTo(x,y,x-10,y,x-10,y+6);ctx.bezierCurveTo(x-10,y+14,x,y+18,x,y+22);
    ctx.bezierCurveTo(x,y+18,x+10,y+14,x+10,y+6);ctx.bezierCurveTo(x+10,y,x,y,x,y+6);
    ctx.fill();
    ctx.fillStyle=c2;ctx.beginPath();ctx.arc(x-4,y+6,3,0,Math.PI*2);ctx.fill();
  }
}

// ============================================================================
// BONFIRE MENU UI
// ============================================================================
class BonfireMenu {
  constructor(bindings) {
    this.bindings=bindings;
    this.selectedIndex=0;
    this.options=['Rest & Heal','Switch Weapon','Rebind Keys','Leave'];
    this.alpha=0;
    this.weaponSub=false;
  }
  update(input) {
    if(input.jumpPressed()){
      if(this.weaponSub){
        this.selectedIndex=clamp(this.selectedIndex-1,0,(this.weaponSub?WEAPONS.length:this.options.length)-1);
      } else {
        this.selectedIndex=clamp(this.selectedIndex-1,0,this.options.length-1);
      }
    }
    if(input.dashPressed()||input.wasPressed('ArrowDown')||input.wasPressed('KeyS')){
      const max=this.weaponSub?WEAPONS.length-1:this.options.length-1;
      this.selectedIndex=clamp(this.selectedIndex+1,0,max);
    }
    // We use attack or interact to confirm
    return input.attackPressed()||input.interactPressed();
  }
  getSelection() {
    if(this.weaponSub) return {type:'weapon',index:this.selectedIndex};
    return {type:'menu',index:this.selectedIndex};
  }
  draw(ctx,player) {
    this.alpha=Math.min(1,this.alpha+0.05);
    ctx.save();
    ctx.globalAlpha=this.alpha;

    // Dim background
    ctx.fillStyle='rgba(5,5,15,0.8)';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

    // Panel
    const pw=400,ph=350,px=CANVAS_W/2-pw/2,py=CANVAS_H/2-ph/2;
    ctx.fillStyle='#111122';ctx.fillRect(px,py,pw,ph);
    ctx.strokeStyle='#44557788';ctx.lineWidth=2;ctx.strokeRect(px,py,pw,ph);

    // Title
    ctx.fillStyle='#ffaa44';ctx.font='bold 24px serif';ctx.textAlign='center';
    ctx.fillText('🔥 Bonfire 🔥',CANVAS_W/2,py+35);

    if(this.weaponSub) {
      ctx.fillStyle='#8899aa';ctx.font='16px monospace';
      ctx.fillText('Select Weapon',CANVAS_W/2,py+65);

      for(let i=0;i<WEAPONS.length;i++){
        const oy=py+90+i*55;
        const sel=i===this.selectedIndex;
        const equipped=i===player.weaponIndex;
        ctx.fillStyle=sel?'#334466':'#1a1a2e';ctx.fillRect(px+20,oy,pw-40,45);
        if(sel){ctx.strokeStyle='#6688aa';ctx.lineWidth=1;ctx.strokeRect(px+20,oy,pw-40,45);}
        ctx.textAlign='left';
        ctx.fillStyle=sel?'#ddddff':'#8899aa';ctx.font='bold 14px monospace';
        ctx.fillText(WEAPONS[i].name+(equipped?' [EQUIPPED]':''),px+40,oy+18);
        ctx.fillStyle='#667788';ctx.font='11px monospace';
        ctx.fillText(`DMG: ${WEAPONS[i].damage}  RNG: ${WEAPONS[i].range}  SPD: ${(1/WEAPONS[i].attackDur).toFixed(0)}/s`,px+40,oy+35);
      }
      ctx.textAlign='center';
      ctx.fillStyle='#556677';ctx.font='11px monospace';
      ctx.fillText('↑↓ Navigate · Attack/F to select · ESC to go back',CANVAS_W/2,py+ph-20);
    } else {
      for(let i=0;i<this.options.length;i++){
        const oy=py+70+i*50;
        const sel=i===this.selectedIndex;
        ctx.fillStyle=sel?'#334466':'transparent';ctx.fillRect(px+30,oy,pw-60,38);
        if(sel){ctx.strokeStyle='#6688aa';ctx.lineWidth=1;ctx.strokeRect(px+30,oy,pw-60,38);}
        ctx.fillStyle=sel?'#ddddff':'#8899aa';ctx.font='18px monospace';ctx.textAlign='center';
        ctx.fillText(this.options[i],CANVAS_W/2,oy+26);
      }
      // Player status
      ctx.fillStyle='#667788';ctx.font='12px monospace';
      ctx.fillText(`HP: ${player.hp}/${player.maxHp}   Soul: ${Math.floor(player.soul)}/${player.maxSoul}   Weapon: ${player.weapon.name}`,CANVAS_W/2,py+ph-40);
      ctx.fillStyle='#556677';ctx.font='11px monospace';
      ctx.fillText('↑↓ Navigate · Attack/F to select',CANVAS_W/2,py+ph-20);
    }

    ctx.textAlign='left';ctx.globalAlpha=1;ctx.restore();
  }
}

// ============================================================================
// REBIND MENU UI
// ============================================================================
class RebindMenu {
  constructor(bindings) {
    this.bindings=bindings;
    this.actions=Object.keys(DEFAULT_BINDINGS);
    this.selectedIndex=0;
    this.waitingForKey=false;
    this.scrollOffset=0;
    this.maxVisible=12;
  }
  update(input) {
    if(this.waitingForKey) {
      if(input.lastKeyPressed&&input.lastKeyPressed!=='Escape') {
        this.bindings.setKey(this.actions[this.selectedIndex], input.lastKeyPressed);
        this.waitingForKey=false;
        return false;
      }
      if(input.lastKeyPressed==='Escape') { this.waitingForKey=false; return false; }
      return false;
    }

    if(input.wasPressed('ArrowUp')||input.wasPressed('KeyW')){
      this.selectedIndex=Math.max(0,this.selectedIndex-1);
      if(this.selectedIndex<this.scrollOffset) this.scrollOffset=this.selectedIndex;
    }
    if(input.wasPressed('ArrowDown')||input.wasPressed('KeyS')){
      this.selectedIndex=Math.min(this.actions.length-1,this.selectedIndex+1);
      if(this.selectedIndex>=this.scrollOffset+this.maxVisible) this.scrollOffset=this.selectedIndex-this.maxVisible+1;
    }
    if(input.wasPressed('Enter')||input.wasPressed('KeyJ')){
      this.waitingForKey=true; return false;
    }
    if(input.wasPressed('Backspace')){
      // Clear binding
      this.bindings.bindings[this.actions[this.selectedIndex]]=[];
      this.bindings.save(); return false;
    }
    if(input.wasPressed('KeyR')&&input.isDown('ControlLeft')){
      // Could be reset, but let's use a different key
    }
    // Escape exits
    if(input.wasPressed('Escape')) return true; // signal to exit
    return false;
  }
  draw(ctx) {
    ctx.save();
    ctx.fillStyle='rgba(5,5,15,0.9)';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

    const pw=550,ph=500,px=CANVAS_W/2-pw/2,py=CANVAS_H/2-ph/2;
    ctx.fillStyle='#111122';ctx.fillRect(px,py,pw,ph);
    ctx.strokeStyle='#44557788';ctx.lineWidth=2;ctx.strokeRect(px,py,pw,ph);

    ctx.fillStyle='#aabbcc';ctx.font='bold 22px monospace';ctx.textAlign='center';
    ctx.fillText('⌨ REBIND KEYS',CANVAS_W/2,py+30);

    const startI=this.scrollOffset;
    const endI=Math.min(this.actions.length,startI+this.maxVisible);

    for(let i=startI;i<endI;i++){
      const oy=py+50+(i-startI)*34;
      const sel=i===this.selectedIndex;
      const action=this.actions[i];
      const keys=this.bindings.getKeys(action);
      const keyStr=keys.map(k=>this.bindings.getKeyLabel(k)).join(', ')||'—';

      if(sel){ctx.fillStyle='#223344';ctx.fillRect(px+10,oy,pw-20,30);ctx.strokeStyle='#5577aa';ctx.lineWidth=1;ctx.strokeRect(px+10,oy,pw-20,30);}

      ctx.textAlign='left';
      ctx.fillStyle=sel?'#ddddff':'#8899aa';ctx.font='13px monospace';
      ctx.fillText(this.bindings.getActionLabel(action),px+25,oy+20);
      ctx.textAlign='right';
      if(sel&&this.waitingForKey){
        ctx.fillStyle='#ffaa44';ctx.fillText('Press a key...',px+pw-25,oy+20);
      } else {
        ctx.fillStyle=sel?'#aaccee':'#667788';ctx.fillText(keyStr,px+pw-25,oy+20);
      }
    }

    // Scroll indicators
    if(this.scrollOffset>0){ctx.fillStyle='#667788';ctx.textAlign='center';ctx.fillText('▲',CANVAS_W/2,py+45);}
    if(endI<this.actions.length){ctx.fillStyle='#667788';ctx.textAlign='center';ctx.fillText('▼',CANVAS_W/2,py+ph-30);}

    ctx.textAlign='center';ctx.fillStyle='#556677';ctx.font='11px monospace';
    ctx.fillText('↑↓ Navigate · Enter/J to rebind · Backspace to clear · ESC to close',CANVAS_W/2,py+ph-12);
    ctx.textAlign='left';ctx.restore();
  }
}

// ============================================================================
// TITLE SCREEN
// ============================================================================
class TitleScreen {
  constructor() { this.time=0;this.particles=[]; }
  update(dt) {
    this.time+=dt;
    if(Math.random()<0.1) this.particles.push({x:rand(0,CANVAS_W),y:CANVAS_H+10,vx:rand(-20,20),vy:rand(-60,-20),life:rand(2,5),maxLife:5,size:rand(2,5)});
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
      if(p.life<=0)this.particles.splice(i,1);
    }
  }
  draw(ctx,bindings) {
    const grd=ctx.createLinearGradient(0,0,0,CANVAS_H);
    grd.addColorStop(0,'#060612');grd.addColorStop(1,'#0f0f24');
    ctx.fillStyle=grd;ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

    for(const p of this.particles){
      ctx.globalAlpha=(p.life/p.maxLife)*0.5;ctx.fillStyle='#4466cc';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;ctx.save();ctx.textAlign='center';

    ctx.shadowColor='#4466cc';ctx.shadowBlur=30+Math.sin(this.time*2)*10;
    ctx.fillStyle='#6688cc';ctx.font='bold 80px serif';
    ctx.fillText('ABYSSAL KNIGHT',CANVAS_W/2,CANVAS_H/2-120);ctx.shadowBlur=0;

    ctx.fillStyle='#556688';ctx.font='italic 22px serif';
    ctx.fillText('Echoes of the Deep',CANVAS_W/2,CANVAS_H/2-75);

    ctx.globalAlpha=0.5+0.5*Math.sin(this.time*3);
    ctx.fillStyle='#8899bb';ctx.font='22px monospace';
    ctx.fillText('Press any key to begin',CANVAS_W/2,CANVAS_H/2-20);
    ctx.globalAlpha=1;

    ctx.fillStyle='#445566';ctx.font='14px monospace';
    const hk=bindings.getKeyLabel;
    const bk=bindings.getKeys.bind(bindings);
    const controls=[
      `${bk('moveLeft').map(k=>hk.call(bindings,k)).join('/')} / ${bk('moveRight').map(k=>hk.call(bindings,k)).join('/')} — Move`,
      `${bk('jump').map(k=>hk.call(bindings,k)).slice(0,2).join('/')} — Jump / Double Jump (in air)`,
      `${bk('attack').map(k=>hk.call(bindings,k)).join('/')} / Click — Attack`,
      `${bk('dash').map(k=>hk.call(bindings,k)).slice(0,2).join('/')} — Dash (i-frames!)`,
      `${bk('heal').map(k=>hk.call(bindings,k)).join('/')} — Heal (costs Soul)`,
      `1/2/3 — Cast Spells   ${bk('weaponNext').map(k=>hk.call(bindings,k)).join('/')} — Switch Weapon`,
      `${bk('interact').map(k=>hk.call(bindings,k)).join('/')} — Interact (Bonfires)`,
      `${bk('help').map(k=>hk.call(bindings,k)).join('/')} — Help   ESC — Rebind Keys`,
    ];
    for(let i=0;i<controls.length;i++) ctx.fillText(controls[i],CANVAS_W/2,CANVAS_H/2+30+i*22);

    ctx.restore();
  }
}

// ============================================================================
// MAIN GAME
// ============================================================================
class Game {
  constructor() {
    this.canvas=document.getElementById('gameCanvas');
    this.ctx=this.canvas.getContext('2d');
    this.canvas.width=CANVAS_W;this.canvas.height=CANVAS_H;

    this.keyBindings=new KeyBindings();
    this.input=new InputManager(this.keyBindings);
    this.audio=new AudioEngine();
    this.camera=new Camera();
    this.particles=new ParticleSystem();
    this.hud=new HUD(this.keyBindings);
    this.titleScreen=new TitleScreen();
    this.bonfireMenu=new BonfireMenu(this.keyBindings);
    this.rebindMenu=new RebindMenu(this.keyBindings);

    this.gameState=STATE.TITLE;
    this.lastTime=0;this.time=0;
    this.showHelp=false;
    this.projectiles=[];
    this.freezeFrame=0;
    this.currentBonfire=null;
    this.enemyTemplates=[];

    this._resize();
    window.addEventListener('resize',()=>this._resize());
    requestAnimationFrame(t=>this._loop(t));
  }

  _resize() {
    const s=Math.min(window.innerWidth/CANVAS_W,window.innerHeight/CANVAS_H);
    this.canvas.style.width=`${CANVAS_W*s}px`;this.canvas.style.height=`${CANVAS_H*s}px`;
  }

  _initLevel() {
    const ld=buildLevel();
    this.level=ld;
    this.player=new Player(ld.playerStart.x,ld.playerStart.y);
    this.enemyTemplates=ld.enemies;
    this.enemies=ld.enemies.map(e=>new Enemy(e.x,e.y,e.type,e.patrolRange));
    this.boss=new Boss(ld.bossSpawn.x,ld.bossSpawn.y);
    this.bonfires=ld.bonfires;
    // Light first bonfire
    this.bonfires[0].lit=true;
    this.player.respawnX=this.bonfires[0].x;
    this.player.respawnY=this.bonfires[0].y-10;
    this.player.lastBonfireId=0;

    this.camera.levelWidth=ld.width;this.camera.levelHeight=ld.height;
    this.camera.x=this.player.x-CANVAS_W/2;this.camera.y=this.player.y-CANVAS_H/2;
    this.background=new Background(ld.width);
    this.particles.clear();this.projectiles=[];
    this.bossActivated=false;this.freezeFrame=0;
    this.gameState=STATE.PLAYING;
  }

  _respawnAtBonfire() {
    this.player.respawn();
    // Reset non-boss enemies
    for(const e of this.enemies) e.reset();
    // Reset boss if not dead
    if(!this.boss.dead&&this.bossActivated){
      this.boss=new Boss(this.level.bossSpawn.x,this.level.bossSpawn.y);
      this.bossActivated=false;
    }
    this.projectiles=[];this.particles.clear();
    this.camera.x=this.player.x-CANVAS_W/2;this.camera.y=this.player.y-CANVAS_H/2;
    this.gameState=STATE.PLAYING;
  }

  _loop(timestamp) {
    const dt=Math.min((timestamp-this.lastTime)/1000,0.05);
    this.lastTime=timestamp;this.time+=dt;
    this.input.update();

    if(this.freezeFrame>0){this.freezeFrame-=dt;requestAnimationFrame(t=>this._loop(t));return;}

    this._update(dt);
    this._draw(dt);
    requestAnimationFrame(t=>this._loop(t));
  }

  _update(dt) {
    switch(this.gameState) {
      case STATE.TITLE:
        this.titleScreen.update(dt);
        if(this.input.anyKey()){this.audio.init();this._initLevel();}
        break;
      case STATE.PLAYING:
        this._updatePlaying(dt);
        break;
      case STATE.DEAD:
        this.particles.update(dt);
        if(this.input.restartPressed()) this._respawnAtBonfire();
        break;
      case STATE.WIN:
        this.particles.update(dt);
        if(this.input.restartPressed()) this._initLevel();
        break;
      case STATE.BONFIRE:
        this._updateBonfire(dt);
        break;
      case STATE.REBIND:
        this._updateRebind(dt);
        break;
    }
    if(this.input.helpPressed()&&(this.gameState===STATE.PLAYING)) this.showHelp=!this.showHelp;
    // ESC for rebind from playing
    if(this.input.pausePressed()&&this.gameState===STATE.PLAYING){
      this.gameState=STATE.REBIND;
      this.rebindMenu=new RebindMenu(this.keyBindings);
    }
  }

  _updateBonfire(dt) {
    this.particles.update(dt);
    for(const b of this.bonfires) b.update(dt,this.particles);

    const confirmed=this.bonfireMenu.update(this.input);
    if(confirmed) {
      const sel=this.bonfireMenu.getSelection();
      if(sel.type==='weapon'){
        // Switch weapon
        if(this.player.switchWeapon(sel.index)){
          this.audio.weaponSwitch();
          this.hud.showWeaponSwitch(WEAPONS[sel.index].name);
        }
        this.bonfireMenu.weaponSub=false;
        this.bonfireMenu.selectedIndex=1;
      } else {
        switch(sel.index) {
          case 0: // Rest & Heal
            this.player.hp=this.player.maxHp;
            this.player.spellCooldowns=[0,0,0];
            this.audio.heal();
            // Respawn enemies
            for(const e of this.enemies) e.reset();
            if(!this.boss.dead&&this.bossActivated){
              this.boss=new Boss(this.level.bossSpawn.x,this.level.bossSpawn.y);
              this.bossActivated=false;
            }
            this.gameState=STATE.PLAYING;
            break;
          case 1: // Switch weapon
            this.bonfireMenu.weaponSub=true;
            this.bonfireMenu.selectedIndex=this.player.weaponIndex;
            break;
          case 2: // Rebind
            this.gameState=STATE.REBIND;
            this.rebindMenu=new RebindMenu(this.keyBindings);
            break;
          case 3: // Leave
            this.gameState=STATE.PLAYING;
            break;
        }
      }
    }
    // ESC to leave bonfire / weapon sub
    if(this.input.pausePressed()){
      if(this.bonfireMenu.weaponSub){
        this.bonfireMenu.weaponSub=false;
        this.bonfireMenu.selectedIndex=1;
      } else {
        this.gameState=STATE.PLAYING;
      }
    }
  }

  _updateRebind(dt) {
    const shouldExit=this.rebindMenu.update(this.input);
    if(shouldExit) {
      this.gameState=STATE.PLAYING;
    }
  }

  _updatePlaying(dt) {
    // Moving platforms
    for(const p of this.level.platforms){
      if(p.type==='moving'){
        p.t+=dt;const prevX=p.x,prevY=p.y;
        p.x=p.ox+Math.sin(p.t*p.speed/50)*(p.mx||0);
        p.y=p.oy+Math.sin(p.t*p.speed/50)*(p.my||0);
        p.pvx=(p.x-prevX)/dt; p.pvy=(p.y-prevY)/dt;
      }
    }

    // Player
    this.player.update(dt,this.input,this.level,this.particles,this.camera,this.audio);

    // Weapon switching
    for(let i=1;i<=4;i++){if(this.input.weapon(i)&&this.player.switchWeapon(i-1)){this.audio.weaponSwitch();this.hud.showWeaponSwitch(WEAPONS[i-1].name);}}
    if(this.input.weaponNext()&&this.player.nextWeapon()){this.audio.weaponSwitch();this.hud.showWeaponSwitch(this.player.weapon.name);}

    // Spells
    if(this.input.spell1Pressed()) this.player.castSpell(0,this.projectiles,this.particles,this.audio,this.camera);
    if(this.input.spell2Pressed()) this.player.castSpell(1,this.projectiles,this.particles,this.audio,this.camera);
    if(this.input.spell3Pressed()) this.player.castSpell(2,this.projectiles,this.particles,this.audio,this.camera);

    // Ice Nova AoE check
    if(this.input._wasPressed('spell2')&&this.player.spellCooldowns[1]>SPELLS[1].cooldown-0.1) {
      // Just cast - do AoE
      const novaRange=100;
      const pcx=this.player.x+this.player.w/2, pcy=this.player.y+this.player.h/2;
      for(const e of this.enemies){
        if(!e.dead){
          const ecx=e.x+e.w/2,ecy=e.y+e.h/2;
          if(Math.hypot(ecx-pcx,ecy-pcy)<novaRange){
            e.takeDamage(2,pcx<ecx?1:-1,this.particles,this.camera,this.audio);
            if(e.dead) this.player.soul=Math.min(this.player.soul+15,this.player.maxSoul);
          }
        }
      }
      if(this.boss.active&&!this.boss.dead){
        const bcx=this.boss.x+this.boss.w/2,bcy=this.boss.y+this.boss.h/2;
        if(Math.hypot(bcx-pcx,bcy-pcy)<novaRange){
          this.boss.takeDamage(2,pcx<bcx?1:-1,this.particles,this.camera,this.audio);
        }
      }
    }

    // Enemies
    for(const e of this.enemies){if(!e.dead)e.update(dt,this.player,this.level,this.particles);}
    // Boss
    this.boss.update(dt,this.player,this.level,this.particles,this.camera,this.audio);
    // Boss trigger
    if(!this.bossActivated&&!this.boss.dead){
      const t=this.level.bossTrigger,pb=this.player.getBounds();
      if(rectsOverlap(pb,t)){this.bossActivated=true;this.boss.activate(this.level.bossArena,this.audio);this.camera.shake(8,0.5);}
    }

    // Projectiles
    for(let i=this.projectiles.length-1;i>=0;i--){
      const proj=this.projectiles[i];
      proj.update(dt,this.level,this.particles);
      if(proj.dead){this.projectiles.splice(i,1);continue;}
      // Hit enemies
      if(proj.owner==='player'){
        for(const e of this.enemies){
          if(!e.dead&&rectsOverlap(proj.getBounds(),e.getBounds())){
            e.takeDamage(proj.damage,proj.vx>0?1:-1,this.particles,this.camera,this.audio);
            if(e.dead) this.player.soul=Math.min(this.player.soul+15,this.player.maxSoul);
            proj.dead=true;
            this.particles.sparks(proj.x,proj.y);
            break;
          }
        }
        if(!proj.dead&&this.boss.active&&!this.boss.dead&&rectsOverlap(proj.getBounds(),this.boss.getBounds())){
          this.boss.takeDamage(proj.damage,proj.vx>0?1:-1,this.particles,this.camera,this.audio);
          proj.dead=true;
          this.particles.sparks(proj.x,proj.y);
          if(this.boss.dead){this.player.soul=this.player.maxSoul;setTimeout(()=>{this.gameState=STATE.WIN;},1500);}
        }
      }
    }

    // Player attack vs enemies
    if(this.player.attacking&&this.player.attackHitbox){
      const wpn=this.player.weapon;
      for(const e of this.enemies){
        if(!e.dead&&!this.player.hasHitThisSwing.has(e)&&rectsOverlap(this.player.attackHitbox,e.getBounds())){
          e.takeDamage(wpn.damage,this.player.facing,this.particles,this.camera,this.audio);
          this.player.hasHitThisSwing.add(e);this.freezeFrame=0.05;
          if(e.dead) this.player.soul=Math.min(this.player.soul+15,this.player.maxSoul);
        }
      }
      if(this.boss.active&&!this.boss.dead&&!this.player.hasHitThisSwing.has(this.boss)&&rectsOverlap(this.player.attackHitbox,this.boss.getBounds())){
        this.boss.takeDamage(wpn.damage,this.player.facing,this.particles,this.camera,this.audio);
        this.player.hasHitThisSwing.add(this.boss);this.freezeFrame=0.06;
        if(this.boss.dead){this.player.soul=this.player.maxSoul;setTimeout(()=>{this.gameState=STATE.WIN;},1500);}
      }
    }

    // Enemy contact damage
    for(const e of this.enemies){
      if(!e.dead&&rectsOverlap(this.player.getBounds(),e.getBounds())){
        this.player.takeDamage(e.damage,this.player.x<e.x?-1:1,this.particles,this.camera,this.audio);
      }
      if(e.type==='guard'&&e.attackHitbox&&!e.dead&&rectsOverlap(this.player.getBounds(),e.attackHitbox)){
        this.player.takeDamage(e.damage,this.player.x<e.x?-1:1,this.particles,this.camera,this.audio);
      }
    }

    // Boss damage
    if(this.boss.active&&!this.boss.dead){
      if(rectsOverlap(this.player.getBounds(),this.boss.getBounds())){
        this.player.takeDamage(1,this.player.x<this.boss.x?-1:1,this.particles,this.camera,this.audio);
      }
      if(this.boss.attackHitbox&&rectsOverlap(this.player.getBounds(),this.boss.attackHitbox)){
        this.player.takeDamage(2,this.player.x<this.boss.x?-1:1,this.particles,this.camera,this.audio);
        this.camera.shake(10,0.3);
      }
      for(const sw of this.boss.shockwaves){
        const swb={x:sw.x-sw.w/2,y:sw.y,w:sw.w,h:sw.h};
        if(rectsOverlap(this.player.getBounds(),swb)){
          this.player.takeDamage(1,sw.vx>0?1:-1,this.particles,this.camera,this.audio);
        }
      }
    }

    // Bonfires
    for(const b of this.bonfires){
      b.update(dt,this.particles);
      if(b.isPlayerNear(this.player)){
        b._showPrompt=true;
        if(this.input.interactPressed()){
          b.lit=true;
          this.player.respawnX=b.x; this.player.respawnY=b.y-10;
          this.player.lastBonfireId=b.id;
          this.currentBonfire=b;
          this.audio.bonfire();
          this.bonfireMenu=new BonfireMenu(this.keyBindings);
          this.bonfireMenu.alpha=0;
          this.gameState=STATE.BONFIRE;
        }
      }
    }

    // Player death
    if(this.player.dead&&this.player.deathTimer>0.5) this.gameState=STATE.DEAD;

    // Boss phase 2 minions
    if(this.boss.phase===2&&!this.boss.spawnedMinions&&!this.boss.phaseTransition&&this.boss.active&&!this.boss.dead){
      this.boss.spawnedMinions=true;
      const ar=this.level.bossArena;
      this.enemies.push(new Enemy(ar.x+100,ar.y+ar.h-64,'crawler',150));
      this.enemies.push(new Enemy(ar.x+ar.w-140,ar.y+ar.h-64,'crawler',150));
    }

    this.particles.update(dt);
    this.camera.follow(this.player,dt);
  }

  _draw(dt) {
    const ctx=this.ctx;
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

    if(this.gameState===STATE.TITLE){this.titleScreen.draw(ctx,this.keyBindings);return;}

    this.background.draw(ctx,this.camera,this.time);

    ctx.save();
    this.camera.apply(ctx);

    // Platforms
    for(const p of this.level.platforms){
      if(p.type==='oneway'){
        ctx.fillStyle='#333355';ctx.fillRect(p.x,p.y,p.w,6);
        ctx.fillStyle='#444466';
        for(let dx=4;dx<p.w;dx+=12) ctx.fillRect(p.x+dx,p.y+2,2,2);
      } else if(p.type==='moving'){
        ctx.fillStyle='#335566';ctx.fillRect(p.x,p.y,p.w,p.h);
        ctx.fillStyle='#447788';ctx.fillRect(p.x+4,p.y+2,p.w-8,3);
        ctx.strokeStyle='#44556655';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x+p.w/2,p.y);ctx.lineTo(p.x+p.w/2,p.y-60);ctx.stroke();
      } else {
        ctx.fillStyle='#222244';ctx.fillRect(p.x,p.y,p.w,p.h);
        ctx.fillStyle='#333366';ctx.fillRect(p.x,p.y,p.w,4);
        ctx.fillStyle='#2a2a50';
        for(let dx=8;dx<p.w-8;dx+=20) ctx.fillRect(p.x+dx,p.y+6,8,3);
        ctx.fillStyle='#1a1a33';ctx.fillRect(p.x,p.y+p.h-4,p.w,4);
      }
    }

    // Environmental detail
    ctx.fillStyle='#334466';
    for(const p of this.level.platforms){
      if(p.type!=='solid'||p.h<40) continue;
      for(let dx=10;dx<p.w;dx+=rand(30,60)){
        ctx.beginPath();ctx.moveTo(p.x+dx,p.y);ctx.lineTo(p.x+dx-3,p.y-8);ctx.lineTo(p.x+dx+2,p.y);ctx.fill();
        ctx.beginPath();ctx.moveTo(p.x+dx+5,p.y);ctx.lineTo(p.x+dx+7,p.y-10);ctx.lineTo(p.x+dx+10,p.y);ctx.fill();
      }
    }
    // Boss arena chains
    ctx.strokeStyle='#333355';ctx.lineWidth=2;
    for(let i=0;i<6;i++){
      const cx=4700+i*120,len=40+Math.sin(i*1.5)*20;
      ctx.beginPath();ctx.moveTo(cx,240);ctx.lineTo(cx,240+len);ctx.stroke();
      ctx.fillStyle='#444466';ctx.fillRect(cx-3,240+len,6,6);
    }

    // Bonfires
    for(const b of this.bonfires) b.draw(ctx);

    // Enemies
    for(const e of this.enemies) e.draw(ctx);
    // Boss
    this.boss.draw(ctx);
    // Player
    this.player.draw(ctx);
    // Projectiles
    for(const p of this.projectiles) p.draw(ctx);
    // Particles
    this.particles.draw(ctx);

    ctx.restore();

    // HUD
    this.hud.draw(ctx,this.player,this.boss,this.gameState,dt);

    // Bonfire menu
    if(this.gameState===STATE.BONFIRE) this.bonfireMenu.draw(ctx,this.player);

    // Rebind menu
    if(this.gameState===STATE.REBIND) this.rebindMenu.draw(ctx);

    // Help overlay
    if(this.showHelp&&this.gameState===STATE.PLAYING) this._drawHelp(ctx);
  }

  _drawHelp(ctx) {
    ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(CANVAS_W/2-220,80,440,420);
    ctx.strokeStyle='#556677';ctx.strokeRect(CANVAS_W/2-220,80,440,420);
    ctx.fillStyle='#aabbcc';ctx.font='bold 20px monospace';ctx.textAlign='center';
    ctx.fillText('CONTROLS',CANVAS_W/2,115);

    ctx.font='13px monospace';
    const hk=this.keyBindings.getKeyLabel.bind(this.keyBindings);
    const gk=(a)=>this.keyBindings.getKeys(a).map(k=>hk(k)).slice(0,2).join('/');
    const lines=[
      [gk('moveLeft')+' / '+gk('moveRight'), 'Move'],
      [gk('jump'), 'Jump / Double Jump'],
      [gk('attack')+' / Click', 'Attack'],
      [gk('dash'), 'Dash (i-frames!)'],
      [gk('heal'), 'Heal (costs Soul)'],
      [gk('interact'), 'Interact (Bonfires)'],
      ['1/2/3', 'Cast Spells'],
      [gk('weaponNext'), 'Switch Weapon'],
      ['7/8/9/0', 'Direct Weapon Select'],
      ['ESC', 'Rebind Keys'],
      [gk('help'), 'Toggle Help'],
      ['',''],
      ['TIPS:',''],
      ['','Dash through attacks!'],
      ['','Kill enemies for Soul'],
      ['','Rest at Bonfires to heal'],
      ['','Bonfires respawn enemies!'],
    ];
    for(let i=0;i<lines.length;i++){
      ctx.textAlign='right';ctx.fillStyle='#66aacc';
      ctx.fillText(lines[i][0],CANVAS_W/2-10,150+i*22);
      ctx.textAlign='left';ctx.fillStyle='#8899aa';
      ctx.fillText(lines[i][1],CANVAS_W/2+10,150+i*22);
    }
    ctx.textAlign='left';
  }
}

// ============================================================================
// START
// ============================================================================
window.addEventListener('load',()=>{ new Game(); });
