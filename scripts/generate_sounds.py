#!/usr/bin/env python3
"""
Abyssal Knight - High Fidelity Audio FX Generator v2
Generates rich, atmospheric 44.1kHz 16-bit PCM WAV audio effects.
All sounds procedurally generated — 100% original, CC0-safe.
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
    if x > 1.5:
        return 1.0
    elif x < -1.5:
        return -1.0
    return x - (x ** 3) / 9.0

def hard_clip(x):
    return clamp(x)

def write_wav(path, samples, sample_rate=SAMPLE_RATE):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with wave.open(path, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        max_val = max(abs(s) for s in samples) if samples else 1.0
        if max_val > 0.001:
            gain = 0.92 / max_val
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
        b0 = alpha; b1 = 0.0; b2 = -alpha
        a0 = 1.0 + alpha; a1 = -2.0 * math.cos(w0); a2 = 1.0 - alpha
        self.b0 = b0 / a0; self.b1 = b1 / a0; self.b2 = b2 / a0
        self.a1 = a1 / a0; self.a2 = a2 / a0
        self.x1 = self.x2 = self.y1 = self.y2 = 0.0
    def process(self, x):
        y = self.b0*x + self.b1*self.x1 + self.b2*self.x2 - self.a1*self.y1 - self.a2*self.y2
        self.x2 = self.x1; self.x1 = x; self.y2 = self.y1; self.y1 = y
        return y

class Reverb:
    """Simple algorithmic reverb using multiple delay lines"""
    def __init__(self, decay=0.4, mix=0.3, sr=SAMPLE_RATE):
        delays_ms = [23.1, 29.3, 37.1, 41.2, 53.7, 67.3]
        self.delays = [int(d / 1000 * sr) for d in delays_ms]
        self.buffers = [[0.0] * d for d in self.delays]
        self.heads = [0] * len(self.delays)
        self.decay = decay
        self.mix = mix
        self.lp = OnePoleLP(4000, sr)
    def process(self, x):
        wet = 0.0
        for i in range(len(self.delays)):
            buf = self.buffers[i]
            head = self.heads[i]
            delayed = buf[head]
            wet += delayed
            buf[head] = x + delayed * self.decay
            self.heads[i] = (head + 1) % self.delays[i]
        wet = self.lp.process(wet / len(self.delays))
        return x * (1.0 - self.mix) + wet * self.mix

def make_noise(n_samples):
    return [random.uniform(-1.0, 1.0) for _ in range(n_samples)]

def lerp(a, b, t):
    return a + (b - a) * t

def envelope_adsr(p, a=0.05, d=0.1, s=0.7, r=0.2):
    """ADSR envelope normalized to 0..1 position p"""
    if p < a:
        return p / a
    elif p < a + d:
        return 1.0 - (1.0 - s) * ((p - a) / d)
    elif p < 1.0 - r:
        return s
    else:
        return s * (1.0 - (p - (1.0 - r)) / r)

# ==============================================================================
# SOUND GENERATORS — Enhanced v2
# ==============================================================================

def gen_swing(duration=0.20, start_f=1200, end_f=250, air_cut=3600):
    """Realistic blade whoosh: multi-layered air displacement with metallic edge"""
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(air_cut)
    hp = OnePoleHP(200)
    bp = BandPass(1800, q=2.0)

    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.5
        curr_f = start_f * ((end_f / start_f) ** p)
        noise = random.uniform(-1.0, 1.0)
        # Blade whistle with harmonics
        whistle = (math.sin(2 * math.pi * curr_f * t) * 0.30
                   + math.sin(2 * math.pi * curr_f * 2.07 * t) * 0.12
                   + math.sin(2 * math.pi * curr_f * 3.1 * t) * 0.06)
        # Bandpass filtered air turbulence
        turb = bp.process(noise) * 0.3
        s = hp.process(lp.process(noise * 0.55 + whistle + turb)) * env
        samples.append(s)
    return samples

def gen_heavy_swing():
    """Devastating greatsword sweep: massive bass rush with trailing resonance"""
    duration = 0.36
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1400)
    sub_lp = OnePoleLP(200)
    rev = Reverb(decay=0.3, mix=0.15)
    for i in range(n):
        p = i / n
        t = i / SAMPLE_RATE
        env = math.sin(p * math.pi) ** 1.6
        f = 400 * ((60 / 400) ** p)
        sub = math.sin(2 * math.pi * f * t) * 0.7 + math.sin(2 * math.pi * f * 1.5 * t) * 0.2
        noise = random.uniform(-1.0, 1.0)
        s = (sub_lp.process(sub) * 0.55 + lp.process(noise) * 0.45) * env
        samples.append(rev.process(s))
    return samples

def gen_quick_swing():
    """Lightning-fast dagger flick: sharp, bright, whip-like"""
    duration = 0.12
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(5200)
    hp = OnePoleHP(700)
    for i in range(n):
        p = i / n
        t = i / SAMPLE_RATE
        env = math.sin(p * math.pi) ** 1.3
        f = 2200 * ((500 / 2200) ** p)
        whistle = math.sin(2 * math.pi * f * t) * 0.35 + math.sin(2 * math.pi * f * 2.5 * t) * 0.1
        noise = random.uniform(-1.0, 1.0) * 0.55
        s = hp.process(lp.process(noise + whistle)) * env
        samples.append(s)
    return samples

def gen_hit():
    """Visceral flesh/armor impact: heavy sub-thump + bone crunch (NO glass bottle ring)"""
    duration = 0.18
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(900)
    rev = Reverb(decay=0.18, mix=0.08)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.exp(-t * 26)
        # Heavy sub-bass punch (95Hz -> 38Hz)
        pitch = 38 + 57 * math.exp(-t * 35)
        sub = math.sin(2 * math.pi * pitch * t) * 0.85
        # Flesh/armor crunch transient (damped low-pass noise)
        transient = (random.uniform(-1.0, 1.0) ** 3) * math.exp(-t * 85) * 0.75
        noise = lp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 38) * 0.4
        # Damped blade body thud (320Hz, decays rapidly)
        blade = math.sin(2 * math.pi * 320 * t) * math.exp(-t * 55) * 0.35
        s = soft_clip((sub + transient + noise + blade) * 1.5) * env
        samples.append(rev.process(s))
    return samples

def gen_nail_hit():
    """Meaty, visceral blade slash on enemy flesh & mail — solid impact, zero bottle ping"""
    duration = 0.22
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1100)
    bp = BandPass(420, q=2.0)
    rev = Reverb(decay=0.20, mix=0.10)

    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.exp(-t * 22)
        # 1. Solid heavy impact sub-thump (110Hz dive to 42Hz)
        sub_pitch = 42 + 68 * math.exp(-t * 32)
        sub = math.sin(2 * math.pi * sub_pitch * t) * 0.90
        # 2. Visceral flesh cleave / crunch transient (organic snap)
        crunch = (random.uniform(-1.0, 1.0) ** 3) * math.exp(-t * 90) * 0.85
        # 3. Steel blade bite resonance (warm 420Hz mid body, heavily damped in 40ms — no high ringing!)
        steel_bite = bp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 45) * 0.65
        blade_tone = math.sin(2 * math.pi * 380 * t) * math.exp(-t * 40) * 0.30
        # 4. Low-pass filtered impact weight
        flesh_thud = lp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 30) * 0.40
        s = soft_clip((sub + crunch + steel_bite + blade_tone + flesh_thud) * 1.6) * env
        samples.append(rev.process(s))
    return samples

def gen_nail_slash():
    """Razor-edge blade swipe: cutting air with metallic sizzle"""
    duration = 0.16
    n = int(SAMPLE_RATE * duration)
    samples = []
    bp = BandPass(2600, q=2.0)
    hp = OnePoleHP(400)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.2
        f = 3400 * ((650 / 3400) ** p)
        metal = math.sin(2 * math.pi * f * t + math.sin(2 * math.pi * 350 * t) * 1.8) * 0.30
        # Layered sizzle
        sizzle = math.sin(2 * math.pi * (f * 2.3) * t) * math.exp(-t * 20) * 0.12
        noise = bp.process(random.uniform(-1.0, 1.0)) * 0.65
        s = hp.process(noise + metal + sizzle) * env
        samples.append(s)
    return samples

def gen_dash():
    """Shade dash: dark supernatural air compression with void undertone"""
    duration = 0.25
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(2000)
    bp = BandPass(300, q=1.5)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.4
        # Deep void whoosh
        sub = math.sin(2 * math.pi * (70 + 140 * math.sin(p * math.pi)) * t) * 0.45
        # Dark mid-range resonance
        dark = bp.process(random.uniform(-1.0, 1.0)) * 0.35
        noise = lp.process(random.uniform(-1.0, 1.0)) * 0.70
        # Ghostly whisper layer
        ghost = math.sin(2 * math.pi * (600 + 300 * p) * t) * math.exp(-t * 15) * 0.15
        samples.append((noise + sub + dark + ghost) * env)
    return samples

def gen_dodge_roll():
    """Body rolling on dungeon stone: cloth rustle + armor scrape + ground thud"""
    duration = 0.28
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(750)
    bp = BandPass(2400, q=2.0)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        # Double tumble envelope
        env = (math.sin(p * math.pi) + 0.35 * math.sin(p * 2 * math.pi)) * math.exp(-t * 3.5)
        noise = lp.process(random.uniform(-1.0, 1.0)) * 0.6
        # Armor scrape
        scrape = bp.process(random.uniform(-1.0, 1.0)) * 0.2 * math.sin(p * math.pi * 3)
        sub = math.sin(2 * math.pi * 60 * t) * math.exp(-t * 7) * 0.45
        samples.append((noise + sub + scrape) * env)
    return samples

def gen_dodge_success():
    """Perfect dodge: ethereal bell shimmer + time-dilation effect"""
    duration = 0.40
    n = int(SAMPLE_RATE * duration)
    samples = []
    rev = Reverb(decay=0.45, mix=0.3)
    chimes = [880, 1320, 1760, 2640, 3520]
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        val = 0.0
        for idx, f in enumerate(chimes):
            # Slight detuning for richness
            detune = 1.0 + 0.003 * math.sin(t * (7 + idx * 2))
            val += math.sin(2 * math.pi * f * detune * t) * math.exp(-t * (8 + idx * 3)) * (0.30 / (idx + 1))
        # Shimmer tremolo
        tremolo = 1.0 + 0.25 * math.sin(2 * math.pi * 14 * t)
        # Rising sparkle
        sparkle = math.sin(2 * math.pi * (2000 + 2000 * p) * t) * math.exp(-t * 12) * 0.1
        samples.append(rev.process((val + sparkle) * tremolo))
    return samples

def gen_pogo():
    """Nail bounce: bright resonant spring-ping with metallic overtones"""
    duration = 0.25
    n = int(SAMPLE_RATE * duration)
    samples = []
    rev = Reverb(decay=0.3, mix=0.2)
    for i in range(n):
        t = i / SAMPLE_RATE
        f = 1300 + 250 * math.sin(t * 22)
        bell = math.sin(2 * math.pi * f * t) * math.exp(-t * 16) * 0.45
        harmonic = math.sin(2 * math.pi * (f * 2.35) * t) * math.exp(-t * 24) * 0.25
        sparkle = math.sin(2 * math.pi * (f * 3.8) * t) * math.exp(-t * 35) * 0.12
        sub = math.sin(2 * math.pi * 170 * t) * math.exp(-t * 28) * 0.35
        samples.append(rev.process(bell + harmonic + sparkle + sub))
    return samples

def gen_jump():
    """Ground push takeoff: quick thud + cloak rustle"""
    duration = 0.15
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(500)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.exp(-t * 20)
        thump = math.sin(2 * math.pi * (170 - t * 500) * t) * 0.4
        rustle = lp.process(random.uniform(-1.0, 1.0)) * 0.45
        # Quick upward pitch sweep
        swoosh = math.sin(2 * math.pi * (200 + 600 * p) * t) * 0.15 * math.exp(-t * 25)
        samples.append((thump + rustle + swoosh) * env)
    return samples

def gen_double_jump():
    """Dark Monarch Wings flap: heavy atmospheric wing gust, deep air thrust, feathery flutter"""
    duration = 0.26
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(850)
    bp = BandPass(450, q=1.8)
    rev = Reverb(decay=0.25, mix=0.12)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.3
        # 1. Powerful wing beat sub-thump (75Hz air compression punch)
        wing_thump = math.sin(2 * math.pi * (75 - 25 * p) * t) * 0.70
        # 2. Turbulent air rush (bandpass filtered wind gust)
        gust = bp.process(random.uniform(-1.0, 1.0)) * 0.65
        # 3. Feathery wing flutter (22Hz envelope oscillation)
        flutter = 1.0 + 0.45 * math.sin(2 * math.pi * 22 * t)
        air = lp.process(random.uniform(-1.0, 1.0)) * 0.50 * flutter
        # 4. Subtle dark ethereal shadow undertone (low mystical resonance)
        shadow = math.sin(2 * math.pi * (160 + 60 * math.sin(p * math.pi)) * t) * 0.25
        s = soft_clip(wing_thump + gust + air + shadow) * env
        samples.append(rev.process(s))
    return samples

def gen_enemy_death():
    """Monster crumbling to abyssal dust: deep crush + soul dissipation + shatter"""
    duration = 0.50
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(850)
    hp = OnePoleHP(2000)
    rev = Reverb(decay=0.35, mix=0.2)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.exp(-t * 5.5)
        crush_f = 95 * math.exp(-t * 10) + 35
        crush = math.sin(2 * math.pi * crush_f * t) * 0.55
        dissolve = lp.process(random.uniform(-1.0, 1.0)) * min(1.0, t * 8) * 0.5
        # Soul release shimmer
        soul_f = 800 + 600 * p
        soul = math.sin(2 * math.pi * soul_f * t) * math.exp(-t * 4) * 0.2
        # High crystal shatter fragments
        shatter = hp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 12) * 0.3
        samples.append(rev.process((crush + dissolve + soul + shatter) * env))
    return samples

def gen_player_hurt():
    """Player damage: breath knock + armor rattle + visceral sub-bass punch"""
    duration = 0.30
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(600)
    bp = BandPass(2000, q=3.0)
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 12)
        # Gut-punch sub
        sub = math.sin(2 * math.pi * (130 * math.exp(-t * 18) + 38) * t) * 0.75
        # Armor rattle
        rattle = bp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 20) * 0.25
        # Cracking transient
        crack = (random.uniform(-1.0, 1.0) ** 3) * math.exp(-t * 45) * 0.65
        body = lp.process(random.uniform(-1.0, 1.0)) * 0.4
        # Dissonant pain tone
        pain = math.sin(2 * math.pi * 480 * t) * math.exp(-t * 25) * 0.15
        samples.append(soft_clip(sub + crack + body + rattle + pain) * env)
    return samples

def gen_heal():
    """Soul healing: celestial chord progression with warm shimmer and chimes"""
    duration = 0.60
    n = int(SAMPLE_RATE * duration)
    samples = []
    rev = Reverb(decay=0.5, mix=0.3)
    # Warm radiant chord (D maj7: D4, F#4, A4, C#5, D5)
    chord = [293.66, 369.99, 440.0, 554.37, 587.33]
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.1
        val = 0.0
        for idx, f in enumerate(chord):
            # Rich sine + gentle harmonics
            detune = 1.0 + 0.002 * math.sin(t * (5 + idx))
            val += (math.sin(2 * math.pi * f * detune * t) * 0.22
                    + math.sin(2 * math.pi * f * 2 * detune * t) * 0.06)
        # Soothing tremolo
        val *= 1.0 + 0.12 * math.sin(2 * math.pi * 6 * t)
        # Rising sparkle notes
        sparkle = math.sin(2 * math.pi * (1200 + 800 * p) * t) * 0.08 * math.sin(p * math.pi * 3)
        samples.append(rev.process((val + sparkle) * env))
    return samples

def gen_boss_roar():
    """Abyssal Warden roar: terrifying monstrous beast with formant-shaped vocals"""
    duration = 1.2
    n = int(SAMPLE_RATE * duration)
    samples = []
    bp1 = BandPass(300, q=2.5)
    bp2 = BandPass(720, q=3.5)
    bp3 = BandPass(1600, q=5.0)
    rev = Reverb(decay=0.4, mix=0.2)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        # Roar envelope with heavy sustained swell
        if p < 0.12:
            env = (p / 0.12) ** 0.8
        elif p < 0.5:
            env = 1.0
        else:
            env = math.exp(-(p - 0.5) * 3.5)

        # Growling detuned sub-oscillators
        f1 = 60 - 18 * p
        f2 = 63 - 20 * p
        f3 = 67 - 22 * p
        sub = (math.sin(2 * math.pi * f1 * t) * 0.4
               + math.sin(2 * math.pi * f2 * t) * 0.35
               + math.sin(2 * math.pi * f3 * t) * 0.25)
        # Guttural throat rasp with modulation
        rasp = (random.uniform(-1.0, 1.0) + sub) * (1.0 + 0.6 * math.sin(2 * math.pi * 32 * t))
        vocal = bp1.process(rasp) * 0.45 + bp2.process(rasp) * 0.35 + bp3.process(rasp) * 0.15
        # Infrasonic rumble
        rumble = math.sin(2 * math.pi * 25 * t) * 0.3 * env

        s = soft_clip((sub * 0.6 + vocal * 0.75 + rumble) * 2.5) * env
        samples.append(rev.process(s))
    return samples

def gen_fireball():
    """Pyre Blast cast: explosive combustion with low ignition whump and flame tail"""
    duration = 0.38
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1800)
    bp = BandPass(600, q=1.5)
    rev = Reverb(decay=0.25, mix=0.15)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.exp(-t * 7.5)
        # Low ignition "whump"
        ignition = math.sin(2 * math.pi * (250 * math.exp(-t * 22) + 55) * t) * 0.65
        # Flame roar
        flame = lp.process(random.uniform(-1.0, 1.0)) * 0.55
        # Fire crackle
        crackle = bp.process(random.uniform(-1.0, 1.0)) * 0.25 * (1 + 0.5 * math.sin(t * 80))
        # Power rising tone
        power = math.sin(2 * math.pi * (100 + 400 * p) * t) * 0.15 * env
        samples.append(rev.process((ignition + flame + crackle + power) * env))
    return samples

def gen_ice_nova():
    """Glacial Frost Nova: crystalline burst with deep freeze resonance"""
    duration = 0.50
    n = int(SAMPLE_RATE * duration)
    samples = []
    hp = OnePoleHP(700)
    rev = Reverb(decay=0.4, mix=0.25)
    # Glassy crystal partials
    shards = [1050, 1700, 2520, 3800, 5000, 6400]
    shard_decays = [15, 20, 28, 40, 55, 70]

    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.exp(-t * 5.5)
        val = 0.0
        for f, d in zip(shards, shard_decays):
            # Slight random detuning for organic feel
            detune = 1.0 + 0.005 * math.sin(t * (3 + f / 500))
            val += math.sin(2 * math.pi * f * detune * t) * math.exp(-t * d) * 0.18
        ice = hp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 14) * 0.45
        # Deep freeze sub-bass pulse
        freeze = math.sin(2 * math.pi * 80 * t) * math.exp(-t * 10) * 0.3
        # Crystal shimmer
        shimmer = math.sin(2 * math.pi * 4000 * t + math.sin(2 * math.pi * 10 * t) * 3) * math.exp(-t * 18) * 0.12
        samples.append(rev.process((val + ice + freeze + shimmer) * env))
    return samples

def gen_shadow_bolt():
    """Void Nova: ominous sub-frequency warp with dark energy discharge"""
    duration = 0.32
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(800)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.3
        # Pitch-diving void oscillator with FM growl
        f_mod = math.sin(2 * math.pi * 38 * t) * 90
        f = 200 * ((40 / 200) ** p) + f_mod
        sub = math.sin(2 * math.pi * f * t) * 0.6
        # Dark resonance
        dark = lp.process(random.uniform(-1.0, 1.0)) * 0.3
        # Eerie overtone
        eerie = math.sin(2 * math.pi * (f * 3.14) * t) * math.exp(-t * 15) * 0.15
        samples.append(soft_clip((sub + dark + eerie) * 1.5) * env)
    return samples

def gen_bonfire():
    """Bonfire rest: warm crackling hearth + mystical relief chime"""
    duration = 0.75
    n = int(SAMPLE_RATE * duration)
    samples = []
    rev = Reverb(decay=0.4, mix=0.25)
    # Mystical open fifths (E4, B4, E5)
    tones = [329.63, 493.88, 659.25]
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.0
        val = 0.0
        for idx, f in enumerate(tones):
            detune = 1.0 + 0.003 * math.sin(t * (4 + idx * 2))
            val += math.sin(2 * math.pi * f * detune * t) * (0.28 / (idx + 1))
        # Warm crackle pops
        crackle = 0.0
        if random.random() < 0.005:
            crackle = random.uniform(0.2, 0.5) * (1 if random.random() > 0.5 else -1)
        # Gentle fire hiss
        hiss = random.uniform(-0.08, 0.08) * env
        samples.append(rev.process((val * 0.65 + crackle + hiss) * env))
    return samples

def gen_weapon_switch():
    """Weapon swap: metal blade unsheathed + leather creak"""
    duration = 0.18
    n = int(SAMPLE_RATE * duration)
    samples = []
    bp = BandPass(3200, q=3.0)
    lp = OnePoleLP(1200)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.2
        scrape = bp.process(random.uniform(-1.0, 1.0)) * 0.5
        clink = math.sin(2 * math.pi * 1900 * t) * math.exp(-t * 32) * 0.35
        # Leather creak
        creak = lp.process(random.uniform(-1.0, 1.0)) * 0.2 * math.exp(-t * 10)
        samples.append((scrape + clink + creak) * env)
    return samples

def gen_boss_telegraph():
    """Boss attack anticipation: rising ominous dissonance building dread"""
    duration = 0.35
    n = int(SAMPLE_RATE * duration)
    samples = []
    rev = Reverb(decay=0.3, mix=0.15)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = (p ** 1.6) * 0.85
        f1 = 850 + 400 * p
        f2 = 900 + 420 * p  # Tight dissonant interval
        f3 = 1700 + 600 * p  # Harmonic overtone
        ring = (math.sin(2 * math.pi * f1 * t) * 0.35
                + math.sin(2 * math.pi * f2 * t) * 0.35
                + math.sin(2 * math.pi * f3 * t) * 0.15)
        # Subtle sub-pulse
        pulse = math.sin(2 * math.pi * 50 * t) * 0.15 * p
        samples.append(rev.process((ring + pulse) * env))
    return samples

def gen_boss_thrust_glint():
    """Lethal weapon glint: razor flash with harmonic overtones"""
    duration = 0.24
    n = int(SAMPLE_RATE * duration)
    samples = []
    rev = Reverb(decay=0.25, mix=0.15)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 1.1
        f = 1500 + 1400 * (p ** 0.7)
        glint = (math.sin(2 * math.pi * f * t) * 0.5
                 + math.sin(2 * math.pi * (f * 2.03) * t) * 0.25
                 + math.sin(2 * math.pi * (f * 3.1) * t) * 0.1)
        samples.append(rev.process(glint * env))
    return samples

def gen_boss_void_charge():
    """Dark void gravity charge: abyssal vortex collapsing inward with building tension"""
    duration = 0.70
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(350)
    bp = BandPass(200, q=2.0)
    rev = Reverb(decay=0.35, mix=0.2)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = p ** 1.4
        f = 45 + 200 * (p ** 2)
        vortex = math.sin(2 * math.pi * f * t) * (1.0 + 0.5 * math.sin(2 * math.pi * 16 * t)) * 0.55
        roar = lp.process(random.uniform(-1.0, 1.0)) * 0.45
        # Gravity sucking resonance
        suck = bp.process(random.uniform(-1.0, 1.0)) * 0.3 * p
        # Building high overtone
        tension = math.sin(2 * math.pi * (1000 * p) * t) * 0.15 * (p ** 2)
        samples.append(rev.process((vortex + roar + suck + tension) * env))
    return samples

# ==============================================================================
# NEW SOUND GENERATORS — Missing sounds
# ==============================================================================

def gen_footstep_1():
    """Stone dungeon footstep variant 1: boot heel on weathered stone"""
    duration = 0.09
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1200)
    bp = BandPass(800, q=2.5)
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 40)
        # Stone impact thud
        thud = math.sin(2 * math.pi * (180 * math.exp(-t * 50) + 60) * t) * 0.5
        # Grit crunch
        grit = lp.process(random.uniform(-1.0, 1.0)) * 0.4
        # Stone resonance
        stone = bp.process(random.uniform(-1.0, 1.0)) * 0.25
        samples.append((thud + grit + stone) * env)
    return samples

def gen_footstep_2():
    """Stone dungeon footstep variant 2: different pitch/timing for alternation"""
    duration = 0.08
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1400)
    bp = BandPass(950, q=2.0)
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 45)
        thud = math.sin(2 * math.pi * (200 * math.exp(-t * 55) + 70) * t) * 0.45
        grit = lp.process(random.uniform(-1.0, 1.0)) * 0.35
        stone = bp.process(random.uniform(-1.0, 1.0)) * 0.3
        # Slight leather creak
        creak = math.sin(2 * math.pi * 1600 * t) * math.exp(-t * 60) * 0.1
        samples.append((thud + grit + stone + creak) * env)
    return samples

def gen_land():
    """Heavy landing impact: boot slamming stone with dust puff and armor rattle"""
    duration = 0.18
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(600)
    bp = BandPass(2200, q=3.0)
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 18)
        # Heavy stone thump
        thump = math.sin(2 * math.pi * (160 * math.exp(-t * 30) + 40) * t) * 0.7
        # Dust/debris puff
        dust = lp.process(random.uniform(-1.0, 1.0)) * 0.5
        # Armor rattle
        rattle = bp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 25) * 0.25
        # Sub-bass weight
        weight = math.sin(2 * math.pi * 50 * t) * math.exp(-t * 20) * 0.4
        samples.append(soft_clip((thump + dust + rattle + weight) * 1.3) * env)
    return samples

def gen_fireball_hit():
    """Pyre Blast explosion: fiery detonation with bass shockwave and debris"""
    duration = 0.42
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1500)
    bp = BandPass(400, q=1.5)
    rev = Reverb(decay=0.35, mix=0.2)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.exp(-t * 6)
        # Explosive shockwave
        shock = math.sin(2 * math.pi * (200 * math.exp(-t * 20) + 30) * t) * 0.8
        # Fire roar
        fire = lp.process(random.uniform(-1.0, 1.0)) * 0.6 * min(1.0, t * 15)
        # Debris scatter
        debris = bp.process(random.uniform(-1.0, 1.0)) * 0.3
        # High sizzle
        sizzle = random.uniform(-1.0, 1.0) * math.exp(-t * 25) * 0.2
        # Sub-bass boom
        boom = math.sin(2 * math.pi * 40 * t) * math.exp(-t * 8) * 0.5
        s = soft_clip((shock + fire + debris + sizzle + boom) * 1.5) * env
        samples.append(rev.process(s))
    return samples

def gen_ice_shatter():
    """Ice shatter: frozen enemy cracking apart — crystalline explosion"""
    duration = 0.35
    n = int(SAMPLE_RATE * duration)
    samples = []
    hp = OnePoleHP(1200)
    rev = Reverb(decay=0.3, mix=0.2)
    # Crystal shard frequencies
    crystal_f = [1800, 2800, 4200, 5600, 7000]
    crystal_d = [12, 18, 25, 35, 45]

    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 8)
        # Initial crack transient
        crack = (random.uniform(-1.0, 1.0) if i < 200 else 0.0) * 0.7
        # Crystal shards ringing
        crystals = sum(
            math.sin(2 * math.pi * f * t) * math.exp(-t * d) * 0.2
            for f, d in zip(crystal_f, crystal_d)
        )
        # Ice debris scatter
        ice_debris = hp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 10) * 0.4
        # Sub crack
        sub_crack = math.sin(2 * math.pi * 120 * t) * math.exp(-t * 25) * 0.3
        samples.append(rev.process((crack + crystals + ice_debris + sub_crack) * env))
    return samples

def gen_void_vortex():
    """Abyssal Singularity vortex: deep supernatural gravitational vacuum with ominous swirling resonance"""
    duration = 0.58
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(550)
    bp = BandPass(160, q=2.5)
    rev = Reverb(decay=0.45, mix=0.28)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 0.85
        # Accelerating gravitational vortex rotation
        rot_speed = 7 + 14 * p
        f_base = 55 + 50 * math.sin(2 * math.pi * rot_speed * t)
        # Deep vacuum sub-pulse
        sub = math.sin(2 * math.pi * f_base * t) * 0.65
        # Gravity suction drone
        drone = bp.process(random.uniform(-1.0, 1.0)) * 0.40
        # Supernatural chorus void whisper
        whisper = sum(
            math.sin(2 * math.pi * (240 + 40 * k) * t + math.sin(2 * math.pi * (2.5 + k) * t) * 2.2) * 0.09
            for k in range(4)
        )
        # Wind suction roar
        wind = lp.process(random.uniform(-1.0, 1.0)) * 0.45 * (1.0 + 0.3 * math.sin(2 * math.pi * rot_speed * t))
        s = soft_clip(sub + drone + whisper + wind) * env
        samples.append(rev.process(s))
    return samples

def gen_gargoyle_spit():
    """Gargoyle acid spit: guttural throat hack + pressurized venom projectile launch + acidic sizzle"""
    duration = 0.28
    n = int(SAMPLE_RATE * duration)
    samples = []
    bp = BandPass(850, q=2.5)
    hp = OnePoleHP(1800)
    lp = OnePoleLP(1200)
    rev = Reverb(decay=0.25, mix=0.15)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.exp(-t * 14)
        # 1. Guttural throat compression transient (180Hz guttural rasp)
        rasp_f = 220 * math.exp(-t * 30) + 90
        rasp = math.sin(2 * math.pi * rasp_f * t) * math.exp(-t * 35) * 0.65
        # 2. Pressurized spit projectile launch "pkkht"
        launch = bp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 40) * 0.80
        # 3. Acidic sizzle tail (caustic venom flying through air)
        sizzle = hp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 16) * 0.50
        # 4. Wet body squelch
        squelch = lp.process(random.uniform(-1.0, 1.0)) * math.exp(-t * 22) * 0.35
        s = soft_clip(rasp + launch + sizzle + squelch) * env
        samples.append(rev.process(s))
    return samples

def gen_void_implode():
    """Singularity collapse: reverse explosion — everything rushing inward then burst"""
    duration = 0.40
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(1200)
    rev = Reverb(decay=0.35, mix=0.2)
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        # Build-up phase (0-70%) then explosive release (70-100%)
        if p < 0.7:
            pp = p / 0.7
            env = pp ** 2
            # Sucking inward pitch rise
            f = 60 + 300 * (pp ** 2)
            suck = math.sin(2 * math.pi * f * t) * 0.6
            wind = lp.process(random.uniform(-1.0, 1.0)) * 0.4 * pp
            s = (suck + wind) * env
        else:
            pp = (p - 0.7) / 0.3
            env = math.exp(-pp * 4)
            # Explosive release
            boom = math.sin(2 * math.pi * (350 * math.exp(-pp * 8) + 40) * t) * 0.8
            debris = random.uniform(-1.0, 1.0) * 0.5
            ring = math.sin(2 * math.pi * 800 * t) * math.exp(-pp * 6) * 0.3
            s = soft_clip((boom + debris + ring) * 1.5) * env
        samples.append(rev.process(s))
    return samples

def gen_bonfire_lit():
    """Bonfire kindling: ascending warm flame with mystical activation chime"""
    duration = 0.80
    n = int(SAMPLE_RATE * duration)
    samples = []
    lp = OnePoleLP(2000)
    rev = Reverb(decay=0.45, mix=0.3)
    # Ascending celestial chord
    chords = [
        (329.63, 493.88, 659.25),  # E major
        (349.23, 523.25, 698.46),  # F major (ascending)
        (392.00, 587.33, 783.99),  # G major
    ]
    for i in range(n):
        t = i / SAMPLE_RATE
        p = i / n
        env = math.sin(p * math.pi) ** 0.9
        # Fire igniting (rising noise)
        fire = lp.process(random.uniform(-1.0, 1.0)) * 0.25 * min(1.0, p * 3)
        # Chord progression
        chord_idx = min(2, int(p * 3))
        chord = chords[chord_idx]
        tonal = 0.0
        for idx, f in enumerate(chord):
            tonal += math.sin(2 * math.pi * f * t) * (0.22 / (idx + 1))
        # Mystical rising shimmer
        shimmer = math.sin(2 * math.pi * (1000 + 1500 * p) * t) * 0.1 * math.sin(p * math.pi * 2)
        # Warm crackle pops
        crackle = 0.0
        if random.random() < 0.004:
            crackle = random.uniform(0.15, 0.4) * (1 if random.random() > 0.5 else -1)
        samples.append(rev.process((fire + tonal + shimmer + crackle) * env))
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
    # New sounds for spells and missing effects
    'footstep_1': gen_footstep_1,
    'footstep_2': gen_footstep_2,
    'land': gen_land,
    'fireball_hit': gen_fireball_hit,
    'ice_shatter': gen_ice_shatter,
    'void_vortex': gen_void_vortex,
    'void_implode': gen_void_implode,
    'bonfire_lit': gen_bonfire_lit,
    'gargoyle_spit': gen_gargoyle_spit,
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
        dur_ms = len(samples) / SAMPLE_RATE * 1000
        size_kb = os.path.getsize(filepath) / 1024
        print(f"  ✓ {filename:22} ({dur_ms:6.0f}ms, {size_kb:6.1f} KB)")

    print(f"\nAll {len(SOUND_GENERATORS)} sounds successfully generated!")

if __name__ == '__main__':
    main()
