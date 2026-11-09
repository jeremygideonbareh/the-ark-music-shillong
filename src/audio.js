// Tiny Web Audio instrument: a warm, felt-piano-ish voice with a generated room reverb.
// Nothing plays until the visitor interacts (click a key or turn sound on).

let ctx = null;
let master = null;
let reverbIn = null;
const listeners = new Set();

export const audio = {
  enabled: false,
  setEnabled(v) {
    this.enabled = v;
    if (v) ensure();
    listeners.forEach((fn) => fn(v));
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 3;
  comp.connect(ctx.destination);

  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(comp);

  const conv = ctx.createConvolver();
  conv.buffer = impulse(2.6, 2.8);
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  conv.connect(wet);
  wet.connect(comp);
  reverbIn = conv;
  return ctx;
}

function impulse(seconds, decay) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

const PARTIALS = [
  [1, 1, 'sine'],
  [2, 0.42, 'sine'],
  [3, 0.18, 'triangle'],
  [4, 0.08, 'sine'],
  [5.02, 0.04, 'sine'],
];

export function playNote(freq, { velocity = 0.7, duration = 2.2 } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + 0.005;
  const out = c.createGain();
  const peak = 0.28 * velocity;
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(peak, t + 0.006);
  out.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.28);
  out.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(10000, freq * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(500, freq * 2.2), t + duration * 0.7);
  lp.Q.value = 0.4;

  lp.connect(out);
  out.connect(master);
  if (reverbIn) out.connect(reverbIn);

  for (const [mult, gain, type] of PARTIALS) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq * mult;
    o.detune.value = (Math.random() - 0.5) * 6;
    g.gain.value = gain;
    o.connect(g);
    g.connect(lp);
    o.start(t);
    o.stop(t + duration + 0.05);
  }
}

// Pentatonic scale in D major — used for soft hover chimes and harp-like string plucks.
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
export function chime(index = Math.floor(Math.random() * PENTA.length), velocity = 0.35) {
  if (!audio.enabled) return;
  playNote(midiToFreq(PENTA[((index % PENTA.length) + PENTA.length) % PENTA.length]), { velocity, duration: 1.6 });
}
