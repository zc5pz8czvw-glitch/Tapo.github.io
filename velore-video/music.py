"""Original ambient score for the VELORÉ intro (D major): soft piano + pad + reverb,
low boom + swell at each transition. Pure numpy/scipy synthesis, no samples."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile
import sys

SR = 48000
DUR = 19.0
N = int(SR * DUR)
rng = np.random.default_rng(42)
t_all = np.arange(N) / SR

def midi_hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def lp(x, fc, order=2): return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)

L = np.zeros(N); R = np.zeros(N)
def add(sig, start, pan=0.0, gain=1.0):
    i0 = int(start * SR)
    if i0 >= N: return
    sig = sig[:N - i0] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i0:i0 + len(sig)] += sig * gl
    R[i0:i0 + len(sig)] += sig * gr

# ---------- piano (additive, inharmonic partials, soft hammer) ----------
def piano(m, dur=4.5, vel=0.6):
    f = midi_hz(m); n = int(dur * SR); t = np.arange(n) / SR
    B = 0.0004
    out = np.zeros(n)
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 9000: break
        amp = (1.0 / k ** 1.3) * (0.55 + 0.45 * vel)
        dec = 1.6 + 0.9 * k * (f / 300)          # higher partials decay faster
        out += amp * np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28)) * np.exp(-dec * t)
    out *= (1 - np.exp(-t * 900))                  # soft attack
    out *= np.exp(-t * 0.35)
    hammer = lp(rng.standard_normal(n) * np.exp(-t * 180), 2500) * 0.05 * vel
    out = out + hammer
    out = lp(out, 2400 + 2600 * vel)              # felt-piano warmth
    fade = np.ones(n); fade[-int(0.3 * SR):] = np.linspace(1, 0, int(0.3 * SR))
    return out * fade * vel

# ---------- pad (detuned saw stack, slow filter) ----------
def pad(notes, start, dur, gain=0.11):
    n = int(dur * SR); t = np.arange(n) / SR
    sig = np.zeros(n)
    for m in notes:
        f = midi_hz(m)
        for d in (-0.07, 0.0, 0.065):
            ph = rng.uniform(0, 1)
            saw = 2 * ((f * (1 + d / 100 * 12) * t + ph) % 1) - 1
            sig += saw
    sig /= len(notes) * 3
    # moving low-pass via two filters crossfaded by a slow LFO
    a, b = lp(sig, 700, 4), lp(sig, 1500, 4)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * t + start)
    sig = a * (1 - lfo) + b * lfo
    att, rel = 1.6, 1.8
    env = np.minimum(1, t / att) * np.minimum(1, (dur - t) / rel).clip(0, 1)
    add(sig * env, start, pan=-0.25, gain=gain)
    add(np.roll(sig, 331) * env, start, pan=0.25, gain=gain)

# Harmony (D major):   0-4 Dmaj9 | 4-7 Bm9 | 7-10 Gmaj9 | 10-14.5 Em9 -> A6/9 (12.3) | 14.5-19 Dmaj9
D, Fs, A, Cs, E, B, G = 50, 54, 57, 61, 52, 47, 55
pad([38, 50, 57, 61, 64], 0.0, 4.6)
pad([35, 47, 54, 57, 62], 3.9, 3.5)
pad([31, 43, 50, 54, 57], 6.8, 3.6)
pad([40, 52, 55, 59, 62], 9.8, 2.8)
pad([33, 45, 52, 54, 59], 12.2, 2.7)
pad([38, 50, 57, 61, 64, 66], 14.3, 4.7, gain=0.12)

# piano melody / arpeggios (sparse, calm)
notes = [
    # t, midi, vel, pan
    (0.45, 74, 0.45, 0.1), (1.25, 69, 0.38, -0.1), (1.95, 73, 0.42, 0.15), (2.70, 76, 0.40, 0.0), (3.35, 78, 0.35, 0.2),
    (4.05, 59, 0.55, -0.2), (4.06, 71, 0.50, 0.1), (4.80, 74, 0.40, 0.2), (5.55, 78, 0.40, -0.1), (6.30, 76, 0.38, 0.1),
    (7.00, 55, 0.50, -0.2), (7.01, 74, 0.48, 0.1), (7.75, 78, 0.40, 0.2), (8.45, 81, 0.38, 0.0), (9.15, 79, 0.36, -0.1),
    (10.05, 64, 0.52, -0.2), (10.06, 71, 0.48, 0.1), (10.80, 74, 0.40, 0.2), (11.55, 78, 0.38, -0.1),
    (12.30, 69, 0.48, -0.15), (12.31, 76, 0.44, 0.1), (13.05, 73, 0.38, 0.2), (13.75, 71, 0.34, 0.0),
    (14.55, 62, 0.58, -0.2), (14.56, 69, 0.52, 0.0), (14.57, 78, 0.50, 0.15), (15.40, 81, 0.40, 0.2),
    (16.20, 76, 0.38, -0.1), (17.00, 74, 0.42, 0.1), (17.02, 66, 0.34, -0.2),
]
for (st, m, v, p) in notes:
    add(piano(m, dur=min(5.0, DUR - st), vel=v), st, pan=p, gain=0.55)
# low piano roots under transitions
for st, m in [(0.0, 38), (4.0, 35), (7.0, 31), (10.0, 40), (12.3, 33), (14.5, 38)]:
    add(piano(m, dur=min(5.5, DUR - st), vel=0.5), st, pan=0.0, gain=0.42)

# ---------- reverb (stereo IR, ~3.8 s) ----------
def make_ir(seed, length=3.8):
    n = int(length * SR); t = np.arange(n) / SR
    r = np.random.default_rng(seed).standard_normal(n)
    ir = r * np.exp(-t * 6.9 / length) * (1 - np.exp(-t * 300))
    ir = lp(ir, 5200); ir = hp(ir, 120)
    ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir ** 2))
irL, irR = make_ir(1), make_ir(2)
dry = np.stack([L, R])
wetL = fftconvolve(L, irL)[:N]; wetR = fftconvolve(R, irR)[:N]
mus = 0.62 * dry + 0.85 * np.stack([wetL, wetR])

# ---------- transitions: swell + boom ----------
fx = np.zeros((2, N))
def swell(center, length=1.3):
    n = int(length * SR); t = np.arange(n) / SR
    noise = rng.standard_normal((2, n))
    env = (t / length) ** 2.6
    k = int(0.06 * SR); env[-k:] *= np.linspace(1, 0, k) ** 0.7   # no click at the cut
    # rising filtered noise ("reverse cymbal")
    lo = bp(noise[0], 900, 6000) * env; ro = bp(noise[1], 900, 6000) * env
    # shimmer: rising D5/A5 sine tones
    shim = (np.sin(2 * np.pi * 587.33 * t) + 0.6 * np.sin(2 * np.pi * 880 * t)) * env * 0.35
    i0 = int((center - length) * SR)
    fx[0, i0:i0 + n] += 0.075 * lo + 0.05 * shim
    fx[1, i0:i0 + n] += 0.075 * ro + 0.05 * shim
def boom(at, gain=0.42):
    n = int(2.6 * SR); t = np.arange(n) / SR
    f = 52 * np.exp(-t * 1.6) + 34
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 1.7) * (1 - np.exp(-t * 400))
    thump = lp(rng.standard_normal(n), 180) * np.exp(-t * 22) * 0.6
    s = s + thump
    i0 = int(at * SR); m = min(n, N - i0)
    fx[:, i0:i0 + m] += gain * s[:m]
for c in (4.0, 10.0, 14.5):
    swell(c); boom(c - 0.02)
boom(0.40, 0.26)   # soft opening hit as the logo begins

fxw = np.stack([fftconvolve(fx[0], irL)[:N], fftconvolve(fx[1], irR)[:N]])
mix = mus + fx + 0.35 * fxw

# gentle fade in/out, gentle bus compression (soft knee)
env = np.ones(N)
fi, fo = int(0.25 * SR), int(1.6 * SR)
env[:fi] = np.linspace(0, 1, fi); env[-fo:] = np.linspace(1, 0, fo) ** 1.5
mix *= env
mix = hp(mix, 28)
mix /= np.max(np.abs(mix)) * 1.05
mix = np.tanh(1.4 * mix) / np.tanh(1.4)
mix *= 0.85
wavfile.write(sys.argv[1] if len(sys.argv) > 1 else 'music.wav', SR, (mix.T * 32767).astype(np.int16))
print('ok', mix.shape, float(np.max(np.abs(mix))))
