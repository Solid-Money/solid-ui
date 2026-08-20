/* ------------------------------------------------------------------
   Synthesised sound design for the Solid rewards film.
   Everything here is generated from scratch (sine sweeps, filtered
   noise, a simple drone) — no sampled or licensed material — so the
   client can drop a music track underneath without any clearance.
   Writes a 48 kHz stereo WAV.
   ------------------------------------------------------------------ */
import fs from 'node:fs';

const SR = 48000;
const DUR = 27.0;
const N = Math.ceil(SR * DUR);
const L = new Float64Array(N);
const R = new Float64Array(N);

/* deterministic noise so repeat runs are byte-identical */
let seed = 12345;
const nrnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};

const idx = (t) => Math.round(t * SR);
const add = (i, l, r) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };

/* ---- biquad bandpass with per-sample sweepable centre ---- */
function makeBP() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, fc, Q) => {
    const w0 = (2 * Math.PI * fc) / SR;
    const cs = Math.cos(w0), sn = Math.sin(w0);
    const alpha = sn / (2 * Q);
    const b0 = alpha, b1 = 0, b2 = -alpha;
    const a0 = 1 + alpha, a1 = -2 * cs, a2 = 1 - alpha;
    const y = (b0 / a0) * x + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

/* ---- low sub impact: pitch-dropping sine with fast decay ---- */
function sub(t0, gain = 1, f0 = 78, f1 = 34, dur = 1.5) {
  const n = Math.round(dur * SR);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const f = f1 + (f0 - f1) * Math.exp(-u * 4.5);
    phase += (2 * Math.PI * f) / SR;
    const env = Math.exp(-u * 5.2) * (1 - Math.exp(-u * 400));
    const v = Math.sin(phase) * env * gain;
    add(idx(t0) + i, v, v);
  }
}

/* ---- transition whoosh: noise through a sweeping bandpass ---- */
function whoosh(t0, dur = 0.55, gain = 0.5, up = true) {
  const n = Math.round(dur * SR);
  const bpL = makeBP(), bpR = makeBP();
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const fc = up ? 260 * Math.pow(26, u) : 6800 * Math.pow(1 / 26, u);
    const env = Math.sin(Math.PI * Math.pow(u, 0.75)) * gain;
    const nz = nrnd();
    add(idx(t0) + i, bpL(nz, fc, 1.1) * env, bpR(nz * 0.85 + nrnd() * 0.15, fc * 1.03, 1.1) * env);
  }
}

/* ---- short UI tick ---- */
function tick(t0, gain = 0.28, fc = 2600) {
  const n = Math.round(0.08 * SR);
  const bp = makeBP();
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const env = Math.exp(-u * 34) * gain;
    const v = bp(nrnd(), fc * (1 - u * 0.35), 3.4) * env;
    add(idx(t0) + i, v, v * 0.94);
  }
}

/* ---- riser: noise + rising tone that lands on a hit ---- */
function riser(t0, dur, gain = 0.3) {
  const n = Math.round(dur * SR);
  const bp = makeBP();
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const env = Math.pow(u, 2.0) * gain;
    const f = 180 * Math.pow(9, u);
    phase += (2 * Math.PI * f) / SR;
    const v = (bp(nrnd(), 700 * Math.pow(7, u), 0.9) * 0.7 + Math.sin(phase) * 0.18) * env;
    add(idx(t0) + i, v, v);
  }
}

/* ---- bright shimmer for the unlock moment ---- */
function shimmer(t0, gain = 0.22) {
  const n = Math.round(1.3 * SR);
  const parts = [1568, 2093, 2637, 3136];
  for (let p = 0; p < parts.length; p++) {
    let phase = 0;
    const off = p * 0.035;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      phase += (2 * Math.PI * parts[p]) / SR;
      const env = Math.exp(-u * 4.4) * (1 - Math.exp(-u * 220)) * gain * (1 - p * 0.16);
      const v = Math.sin(phase) * env;
      add(idx(t0 + off) + i, v * (p % 2 ? 0.75 : 1), v * (p % 2 ? 1 : 0.75));
    }
  }
}

/* ---- sustained drone bed ---- */
function pad() {
  const roots = [
    { f: 55.0, g: 0.085 }, { f: 82.41, g: 0.055 }, { f: 110.0, g: 0.045 },
    { f: 164.81, g: 0.028 }, { f: 220.0, g: 0.016 }, { f: 329.63, g: 0.009 },
  ];
  const ph = roots.map(() => 0);
  const phD = roots.map(() => 0);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    /* slow global swell + a lift into the outro */
    const glob =
      Math.min(1, t / 2.2) *
      (1 - Math.max(0, (t - (DUR - 1.1)) / 1.1)) *
      (0.72 + 0.28 * Math.sin(t * 0.42)) *
      (1 + 0.30 * Math.max(0, Math.min(1, (t - 22.8) / 1.6)));
    let l = 0, r = 0;
    for (let k = 0; k < roots.length; k++) {
      ph[k] += (2 * Math.PI * roots[k].f) / SR;
      phD[k] += (2 * Math.PI * (roots[k].f * 1.004)) / SR;   /* detune for width */
      l += Math.sin(ph[k]) * roots[k].g;
      r += Math.sin(phD[k]) * roots[k].g;
    }
    add(i, l * glob, r * glob);
  }
}

/* =================== the cue sheet =================== */
pad();

/* hook — three brand words */
[0.55, 1.12, 1.69].forEach((t, i) => { tick(t, 0.3, 2200 + i * 400); sub(t, 0.26, 66, 40, 0.7); });
whoosh(1.95, 0.4, 0.28, true);

/* payoff line */
riser(1.85, 0.45, 0.26);
sub(2.28, 0.95);
whoosh(2.3, 0.5, 0.3, false);

/* into the title */
whoosh(3.6, 0.42, 0.42, true);
sub(4.02, 0.7);

/* phone flies in */
whoosh(5.05, 0.45, 0.38, true);
sub(5.42, 0.85, 90, 36, 1.7);
whoosh(5.5, 0.75, 0.22, false);

/* screen builds */
[6.35, 6.5, 6.62, 6.76, 6.9].forEach((t, i) => tick(t, 0.14, 3000 + i * 220));

/* the 25% hero */
riser(7.4, 0.55, 0.24);
sub(7.95, 0.9, 84, 34, 1.8);
shimmer(7.98, 0.14);

/* chips flying out — one tick each, matching CHIP_SLOTS stagger */
for (let i = 0; i < 8; i++) tick(9.3 + i * 0.075, 0.2, 2400 + i * 190);

/* into act 3 */
whoosh(12.3, 0.42, 0.44, true);
sub(12.64, 0.8);

/* tier card lifts + progress fills */
whoosh(13.6, 0.6, 0.16, true);
riser(14.9, 1.5, 0.2);
sub(16.4, 1.0, 92, 33, 1.9);
shimmer(16.42, 0.2);

/* into act 4 */
whoosh(17.9, 0.42, 0.44, true);
sub(18.24, 0.78);

/* boost card + stamp */
tick(20.45, 0.26, 1900);
sub(20.45, 0.34, 70, 40, 0.9);
riser(20.7, 0.42, 0.18);
sub(21.1, 0.62, 76, 34, 1.4);

/* outro */
whoosh(22.5, 0.45, 0.46, true);
sub(22.84, 0.9, 88, 32, 2.0);
[23.35, 23.52, 23.69].forEach((t, i) => tick(t, 0.22, 2100 + i * 260));
sub(25.55, 0.7, 80, 30, 2.4);
shimmer(25.58, 0.16);

/* =================== master =================== */
/* soft-knee limiter + tail fade, then 16-bit PCM */
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = peak > 0 ? 0.92 / peak : 1;
const sat = (x) => Math.tanh(x * 1.25) / Math.tanh(1.25);

const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.05) * Math.min(1, (DUR - t) / 0.5);
  const l = Math.max(-1, Math.min(1, sat(L[i] * norm) * fade));
  const r = Math.max(-1, Math.min(1, sat(R[i] * norm) * fade));
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
}

fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/sound.wav', buf);
console.log(`wrote out/sound.wav — ${DUR}s, peak ${peak.toFixed(3)} -> normalised`);
