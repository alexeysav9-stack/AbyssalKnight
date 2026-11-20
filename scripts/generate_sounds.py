#!/usr/bin/env python3
"""
Abyssal Knight - High Fidelity Audio FX Generator
Generates realistic 44.1kHz 16-bit PCM WAV audio effects for the game.
"""

import os
import math
import struct
import random
import wave

SAMPLE_RATE = 44100

def clamp(v, lo=-1.0, hi=1.0):
    return max(lo, min(hi, v))

def soft_clip(x):
    # Smooth cubic soft-clipping for analog punch and warmth
    if x > 1.5:
        return 1.0
    elif x < -1.5:
        return -1.0
    return x - (x ** 3) / 9.0

def write_wav(path, samples, sample_rate=SAMPLE_RATE):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with wave.open(path, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        
        # Normalize to prevent digital harshness and ensure solid punch
        max_val = max(abs(s) for s in samples) if samples else 1.0
        if max_val > 0.001:
            gain = 0.95 / max_val
            normalized = [s * gain for s in samples]
        else:
            normalized = samples

        frames = bytearray()
        for s in normalized:
            clipped = clamp(soft_clip(s), -1.0, 1.0)
            val = int(clipped * 32760)
            frames.extend(struct.pack('<h', val))
        wav.writeframes(frames)

# ==============================================================================
# DSP UTILITIES
# ==============================================================================

class OnePoleLP:
    def __init__(self, cutoff, sr=SAMPLE_RATE):
        self.set_cutoff(cutoff, sr)
        self.y = 0.0
    def set_cutoff(self, cutoff, sr=SAMPLE_RATE):
        self.alpha = min(1.0, max(0.0, 2.0 * math.pi * cutoff / sr))
    def process(self, x):
        self.y += self.alpha * (x - self.y)
        return self.y

class OnePoleHP:
    def __init__(self, cutoff, sr=SAMPLE_RATE):
        self.lp = OnePoleLP(cutoff, sr)
    def set_cutoff(self, cutoff, sr=SAMPLE_RATE):
        self.lp.set_cutoff(cutoff, sr)
    def process(self, x):
        return x - self.lp.process(x)

class BandPass:
    def __init__(self, center_freq, q=4.0, sr=SAMPLE_RATE):
        w0 = 2.0 * math.pi * center_freq / sr
        alpha = math.sin(w0) / (2.0 * q)
        b0 = alpha
        b1 = 0.0
        b2 = -alpha
        a0 = 1.0 + alpha
        a1 = -2.0 * math.cos(w0)
        a2 = 1.0 - alpha
        self.b0 = b0 / a0
        self.b1 = b1 / a0
        self.b2 = b2 / a0
        self.a1 = a1 / a0
        self.a2 = a2 / a0
        self.x1 = self.x2 = self.y1 = self.y2 = 0.0

    def process(self, x):
        y = self.b0 * x + self.b1 * self.x1 + self.b2 * self.x2 - self.a1 * self.y1 - self.a2 * self.y2
        self.x2 = self.x1
        self.x1 = x
        self.y2 = self.y1
        self.y1 = y
        return y

def make_noise(n_samples):
    return [random.uniform(-1.0, 1.0) for _ in range(n_samples)]

# ==============================================================================
# SOUND GENERATORS
# ==============================================================================

def gen_swing(duration=0.18, start_f=1100, end_f=280, air_cut=3200):
    """Realistic blade whoosh with aerodynamic pitch scoop and metal scrape"""
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(air_cut)
    hp = OnePoleHP(180)
    
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        # Smooth attack-decay envelope
        env = math.sin(p * math.pi) ** 1.6
        # Resonant air frequency drop
        curr_f = start_f * ((end_f / start_f) ** p)
        # Noise core (air drag)
        noise = random.uniform(-1.0, 1.0)
        # Metal blade whistling tone
        whistle = math.sin(2 * math.pi * curr_f * t) * 0.35 + math.sin(2 * math.pi * curr_f * 2.03 * t) * 0.15
        s = hp.process(lp.process(noise * 0.7 + whistle)) * env
        samples.append(s)
    return samples

def gen_heavy_swing():
    """Deep, devastating greatsword whoosh with heavy bass rush"""
    duration = 0.32
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1600)
    sub_lp = OnePoleLP(220)
    for i in range(n):
        p = i / n
        t = i / SAMPLE_RATE
        env = math.sin(p * math.pi) ** 1.8
        f = 450 * ((80 / 450) ** p)
        sub = math.sin(2 * math.pi * f * t) * 0.8
        noise = random.uniform(-1.0, 1.0)
        s = (sub_lp.process(sub) * 0.6 + lp.process(noise) * 0.5) * env
        samples.append(s)
    return samples

def gen_quick_swing():
    """Fast, sharp dagger flick through air"""
    duration = 0.11
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(4800)
    hp = OnePoleHP(600)
    for i in range(n):
        p = i / n
        t = i / SAMPLE_RATE
        env = math.sin(p * math.pi) ** 1.4
        f = 1900 * ((450 / 1900) ** p)
        whistle = math.sin(2 * math.pi * f * t) * 0.4
        noise = random.uniform(-1.0, 1.0) * 0.6
        s = hp.process(lp.process(noise + whistle)) * env
        samples.append(s)
    return samples

def gen_hit():
    """Visceral flesh/armor impact: low sub-thump + bone crunch"""
    duration = 0.16
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1200)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        # Fast punch attack, exponential decay
        env = math.exp(-t * 26)
        # Sub-bass pitch dive (140Hz -> 45Hz)
        pitch = 45 + 95 * math.exp(-t * 30)
        sub = math.sin(2 * math.pi * pitch * t) * 0.85
        # Crunchy transient snap
        transient = (random.uniform(-1.0, 1.0) ** 3) * math.exp(-t * 80) * 0.8
        noise = lp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 35) * 0.4
        s = (sub + transient + noise) * env
        samples.append(soft_clip(s * 1.5))
    return samples

def gen_nail_hit():
    """Crisp, metallic sword clank / parry with ringing harmonics"""
    duration = 0.28
    n = int(SAMPLE_RATE * duration)
    samples = []
    # Inharmonic metal eigenfrequencies (Hollow Knight nail sound)
    freqs = [1420, 2450, 3810, 5600]
    decays = [18, 28, 42, 60]
    amps = [0.55, 0.35, 0.25, 0.15]
    
    for i in range(n):
        t = i / SAMPLE_RATE
        # Metallic transient click
        click = (random.uniform(-1.0, 1.0) if i < 150 else 0.0) * 0.6
        metal = 0.0
        for f, d, a in zip(freqs, decays, amps):
            metal += math.sin(2 * math.pi * f * t) * math.exp(-t * d) * a
        # Low sword body resonance
        thump = math.sin(2 * math.pi * 210 * t) * math.exp(-t * 30) * 0.4
        s = click + metal + thump
        samples.append(s)
    return samples

def gen_nail_slash():
    """Sharp cutting blade swipe: razor edge tearing air and armor"""
    duration = 0.14
    n = int(SAMPLE_RATE * duration)
    samples = []
    bp = BandPass(2400, q=2.5)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.3
        f = 3200 * ((700 / 3200) ** p)
        metal = math.sin(2 * math.pi * f * t + math.sin(2 * math.pi * 320 * t) * 1.5) * 0.35
        noise = bp.process(random.uniform(-1.0, 1.0)) * 0.7
        s = (noise + metal) * env
        samples.append(s)
    return samples

def gen_dash():
    """Shade dash: dark air compression and supernatural rush"""
    duration = 0.22
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1800)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.5
        # Deep whoosh + frequency rising then plunging
        sub = math.sin(2 * math.pi * (80 + 120 * math.sin(p * math.pi)) * t) * 0.5
        noise = lp.process(random.uniform(-1.0, 1.0)) * 0.8
        samples.append((noise + sub) * env)
    return samples

def gen_dodge_roll():
    """Physical roll on dungeon stone / gravel rustle and body thud"""
    duration = 0.24
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(800)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        # Dual tumble envelope
        env = (math.sin(p * math.pi) + 0.4 * math.sin(p * 2 * math.pi)) * math.exp(-t * 4)
        noise = lp.process(random.uniform(-1.0, 1.0)) * 0.7
        sub = math.sin(2 * math.pi * 65 * t) * math.exp(-t * 8) * 0.5
        samples.append((noise + sub) * env)
    return samples

def gen_dodge_success():
    """Ethereal glass/bell shimmer rewarding perfect i-frame dodge"""
    duration = 0.35
    n = int(SAMPLE_RATE * duration)
    samples = []
    chimes = [920, 1380, 1840, 2760]
    for i in range(n):
        t = i / SAMPLE_RATE
        val = 0.0
        for idx, f in enumerate(chimes):
            val += math.sin(2 * math.pi * f * t) * math.exp(-t * (10 + idx * 4)) * (0.35 / (idx + 1))
        # Subtle harmonic tremolo
        tremolo = 1.0 + 0.2 * math.sin(2 * math.pi * 12 * t)
        samples.append(val * tremolo)
    return samples

def gen_pogo():
    """Hollow Knight style nail bounce: resonant ping and spring"""
    duration = 0.22
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        # Bright ringing bell with pitch bending upward slightly
        f = 1250 + 200 * math.sin(t * 20)
        bell = math.sin(2 * math.pi * f * t) * math.exp(-t * 18) * 0.5
        harmonic = math.sin(2 * math.pi * (f * 2.3) * t) * math.exp(-t * 26) * 0.3
        sub = math.sin(2 * math.pi * 180 * t) * math.exp(-t * 30) * 0.4
        samples.append(bell + harmonic + sub)
    return samples

def gen_jump():
    """Ground push takeoff + cloak flutter"""
    duration = 0.14
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(450)
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 22)
        thump = math.sin(2 * math.pi * (160 - t * 400) * t) * 0.4
        rustle = lp.process(random.uniform(-1.0, 1.0)) * 0.5
        samples.append((thump + rustle) * env)
    return samples

def gen_double_jump():
    """Monarch Wings flap: ethereal updraft and wing beat"""
    duration = 0.26
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1400)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.3
        # Ethereal upward sweep
        f = 320 + 500 * (p ** 1.4)
        chime = math.sin(2 * math.pi * f * t) * 0.35 + math.sin(2 * math.pi * (f * 1.5) * t) * 0.15
        wing = lp.process(random.uniform(-1.0, 1.0)) * 0.6
        samples.append((wing + chime) * env)
    return samples

def gen_enemy_death():
    """Monster crumbling to abyssal dust and dissipating soul"""
    duration = 0.42
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(900)
    for i in range(n):
        t = i / SAMPLE_RATE
        # Deep crushing impact followed by dissolving hiss
        env = math.exp(-t * 7)
        crush_f = 90 * math.exp(-t * 12) + 40
        crush = math.sin(2 * math.pi * crush_f * t) * 0.6
        dissolve = lp.process(random.uniform(-1.0, 1.0)) * (1.0 - math.exp(-t * 10)) * 0.6
        samples.append((crush + dissolve) * env)
    return samples

def gen_player_hurt():
    """Visceral player damage: breath knock, armor rattle, heart-stopping thud"""
    duration = 0.26
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(650)
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 14)
        sub = math.sin(2 * math.pi * (120 * math.exp(-t * 20) + 40) * t) * 0.8
        crack = (random.uniform(-1.0, 1.0) ** 3) * math.exp(-t * 40) * 0.7
        body = lp.process(random.uniform(-1.0, 1.0)) * 0.5
        samples.append(soft_clip(sub + crack + body) * env)
    return samples

def gen_heal():
    """Soul healing: warm celestial chord progression and soothing chimes"""
    duration = 0.55
    n = int(SAMPLE_RATE * duration)
    samples = []
    # Warm radiant chord (D maj: D4, F#4, A4, D5)
    chord = [293.66, 369.99, 440.0, 587.33]
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.2
        val = 0.0
        for idx, f in enumerate(chord):
            # Rich warm sine + gentle octave
            val += (math.sin(2 * math.pi * f * t) + 0.3 * math.sin(2 * math.pi * f * 2 * t)) * (0.25)
        # Soothing tremolo
        val *= 1.0 + 0.15 * math.sin(2 * math.pi * 8 * t)
        samples.append(val * env)
    return samples

def gen_boss_roar():
    """Abyssal Warden roar: terrifying monstrous beast with subterranean rumble"""
    duration = 1.1
    n = int(SAMPLE_RATE * duration)
    samples = []
    bp1 = BandPass(320, q=3.0) # Throat formant 1
    bp2 = BandPass(780, q=4.0) # Throat formant 2
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        # Roar envelope with heavy sustained swell
        if p < 0.15:
            env = p / 0.15
        else:
            env = math.exp(-(p - 0.15) * 2.8)
        
        # Growling detuned sub-oscillators
        f1 = 65 - 20 * p
        f2 = 68 - 22 * p
        sub = math.sin(2 * math.pi * f1 * t) * 0.5 + math.sin(2 * math.pi * f2 * t) * 0.5
        # Guttural throat rasp
        rasp = (random.uniform(-1.0, 1.0) + sub) * (1.0 + 0.5 * math.sin(2 * math.pi * 35 * t))
        vocal = bp1.process(rasp) * 0.6 + bp2.process(rasp) * 0.4
        
        # Heavy analog overdrive for sheer beastly power
        s = soft_clip((sub * 0.7 + vocal * 0.8) * 2.2) * env
        samples.append(s)
    return samples

def gen_fireball():
    """Soul fireball cast: explosive combustion whoosh"""
    duration = 0.32
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1600)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.exp(-t * 9)
        # Low ignition "whump"
        ignition = math.sin(2 * math.pi * (220 * math.exp(-t * 25) + 60) * t) * 0.7
        # Burning hiss and roar
        flame = lp.process(random.uniform(-1.0, 1.0)) * 0.6
        samples.append((ignition + flame) * env)
    return samples

def gen_ice_nova():
    """Abyssal Pillar / Ice Nova: glacial shattering crystal burst"""
    duration = 0.45
    n = int(SAMPLE_RATE * duration)
    samples = []
    hp = OnePoleHP(800)
    # Glassy inharmonic partials
    shards = [1120, 1780, 2640, 3950, 5200]
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 7)
        val = 0.0
        for f in shards:
            val += math.sin(2 * math.pi * f * t) * math.exp(-t * random.uniform(12, 25)) * 0.2
        ice = hp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 18) * 0.5
        samples.append((val + ice) * env)
    return samples

def gen_shadow_bolt():
    """Void Nova / Dark pulse: ominous sub-frequency warp"""
    duration = 0.28
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.4
        # Pitch diving void oscillator with FM growl
        f_mod = math.sin(2 * math.pi * 40 * t) * 80
        f = 180 * ((45 / 180) ** p) + f_mod
        sub = math.sin(2 * math.pi * f * t) * 0.7
        samples.append(soft_clip(sub * 1.4) * env)
    return samples

def gen_bonfire():
    """Bonfire resting chime: warm crackling hearth embers + mystical relief"""
    duration = 0.7
    n = int(SAMPLE_RATE * duration)
    samples = []
    # Mystical open fifths (E4, B4, E5)
    tones = [329.63, 493.88, 659.25]
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.1
        val = 0.0
        for idx, f in enumerate(tones):
            val += math.sin(2 * math.pi * f * t) * (0.3 / (idx + 1))
        # Hearth wood crackle spikes
        crackle = 0.4 if random.random() < 0.003 else 0.0
        samples.append((val * 0.7 + crackle) * env)
    return samples

def gen_weapon_switch():
    """Weapon change: metal blade drawn from leather sheath"""
    duration = 0.16
    n = int(SAMPLE_RATE * duration)
    samples = []
    bp = BandPass(3100, q=3.5)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.3
        scrape = bp.process(random.uniform(-1.0, 1.0)) * 0.6
        clink = math.sin(2 * math.pi * 1850 * t) * math.exp(-t * 35) * 0.4
        samples.append((scrape + clink) * env)
    return samples

def gen_boss_telegraph():
    """Boss attack anticipation: high-tension ominous ring of malice"""
    duration = 0.32
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        # Rising sinister crescendo
        env = (p ** 1.8) * 0.9
        f1 = 880 + 350 * p
        f2 = 932 + 370 * p # Dissonant minor second
        ring = math.sin(2 * math.pi * f1 * t) * 0.4 + math.sin(2 * math.pi * f2 * t) * 0.4
        samples.append(ring * env)
    return samples

def gen_boss_thrust_glint():
    """Lethal weapon glint: razor flash before thrust attack"""
    duration = 0.22
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.2
        f = 1400 + 1200 * (p ** 0.8)
        glint = math.sin(2 * math.pi * f * t) * 0.6 + math.sin(2 * math.pi * (f * 2.05) * t) * 0.3
        samples.append(glint * env)
    return samples

def gen_boss_void_charge():
    """Dark void gravity charge: abyssal vortex collapsing inward"""
    duration = 0.65
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(400)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        # Sucking vortex build-up
        env = p ** 1.5
        f = 50 + 180 * (p ** 2)
        vortex = math.sin(2 * math.pi * f * t) * (1.0 + 0.4 * math.sin(2 * math.pi * 18 * t)) * 0.6
        roar = lp.process(random.uniform(-1.0, 1.0)) * 0.5
        samples.append((vortex + roar) * env)
    return samples

# ==============================================================================
# MAIN BATCH GENERATOR
# ==============================================================================

SOUND_GENERATORS = {
    'swing': gen_swing,
    'heavy_swing': gen_heavy_swing,
    'quick_swing': gen_quick_swing,
    'hit': gen_hit,
    'nail_hit': gen_nail_hit,
    'nail_slash': gen_nail_slash,
    'dash': gen_dash,
    'dodge_roll': gen_dodge_roll,
    'dodge_success': gen_dodge_success,
    'pogo': gen_pogo,
    'jump': gen_jump,
    'double_jump': gen_double_jump,
    'enemy_death': gen_enemy_death,
    'player_hurt': gen_player_hurt,
    'heal': gen_heal,
    'boss_roar': gen_boss_roar,
    'fireball': gen_fireball,
    'ice_nova': gen_ice_nova,
    'shadow_bolt': gen_shadow_bolt,
    'bonfire': gen_bonfire,
    'weapon_switch': gen_weapon_switch,
    'boss_telegraph': gen_boss_telegraph,
    'boss_thrust_glint': gen_boss_thrust_glint,
    'boss_void_charge': gen_boss_void_charge,
}

def main():
    target_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'sounds')
    os.makedirs(target_dir, exist_ok=True)
    print(f"Generating {len(SOUND_GENERATORS)} sound effects into: {target_dir}")
    
    for name, gen_fn in SOUND_GENERATORS.items():
        filename = f"{name}.wav"
        filepath = os.path.join(target_dir, filename)
        samples = gen_fn()
        write_wav(filepath, samples)
        size_kb = os.path.getsize(filepath) / 1024
        print(f"  ✓ {filename:22} ({len(samples)} samples, {size_kb:.1f} KB)")
        
    print("\nAll sounds successfully generated!")

if __name__ == '__main__':
    main()

