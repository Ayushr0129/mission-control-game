// All sound is synthesised with Web Audio: no files to load, nothing to license.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let ambientNodes: { stop: () => void } | null = null;
const MUTE_KEY = 'rttm.muted';
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

function ac(): AudioContext | null {
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function noise(c: AudioContext, loop = true) { const s = c.createBufferSource(); s.buffer = noiseBuf!; s.loop = loop; return s; }
function env(g: GainNode, c: AudioContext, peak: number, a: number, d: number, t = c.currentTime) {
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq: number, to: number, dur: number, peak: number, type: OscillatorType = 'sine', delay = 0) {
  const c = ac(); if (!c || !master) return;
  const o = c.createOscillator(), g = c.createGain(); o.type = type;
  const t = c.currentTime + delay;
  o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  env(g, c, peak, 0.01, dur, t); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.1);
}

export const sfx = {
  unlock() { ac(); },
  isMuted: () => muted,
  toggle() {
    muted = !muted; try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
    ac(); if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
    return muted;
  },
  tick() { tone(1400, 900, 0.05, 0.05, 'square'); },
  /** The weight of a decision landing. */
  thud() {
    const c = ac(); if (!c || !master) return;
    tone(110, 38, 0.5, 0.55); tone(70, 30, 0.7, 0.3, 'triangle');
    const n = noise(c, false), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = 260;
    env(g, c, 0.35, 0.005, 0.3); n.connect(f).connect(g).connect(master); n.start(); n.stop(c.currentTime + 0.5);
  },
  /** A short radio blip: bandpassed noise plus a chirp. */
  radio() {
    const c = ac(); if (!c || !master) return;
    const n = noise(c, false), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.2;
    env(g, c, 0.12, 0.005, 0.12); n.connect(f).connect(g).connect(master); n.start(); n.stop(c.currentTime + 0.2);
    tone(1000, 1000, 0.08, 0.04, 'sine', 0.13);
  },
  news() { tone(880, 880, 0.12, 0.08, 'square'); tone(660, 660, 0.12, 0.08, 'square', 0.14); tone(880, 880, 0.2, 0.08, 'square', 0.28); },
  go() { tone(520, 780, 0.12, 0.07, 'triangle'); },
  warn() { tone(300, 260, 0.35, 0.09, 'sawtooth'); },
  /** Rising tone while a button is held. Returns a function that ends it. */
  hold(ms: number) {
    const c = ac(); if (!c || !master) return () => {};
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth';
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const t = c.currentTime; o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(190, t + ms / 1000);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.08);
    o.connect(f).connect(g).connect(master); o.start();
    return () => { g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(0.0001, c.currentTime, 0.03); o.stop(c.currentTime + 0.2); };
  },
  stinger(kind: 'win' | 'loss') {
    if (kind === 'win') [261.6, 329.6, 392, 523.3].forEach((f, i) => tone(f, f, 1.6, 0.07, 'triangle', i * 0.22));
    else { tone(110, 100, 3.5, 0.12, 'triangle'); tone(130.8, 120, 3.5, 0.08, 'triangle', 0.1); tone(155.6, 140, 3.5, 0.06, 'triangle', 0.2); }
  },
  /** A low, quiet drone under the whole game. */
  ambient(on: boolean) {
    if (!on) { ambientNodes?.stop(); ambientNodes = null; return; }
    if (ambientNodes) return;
    const c = ac(); if (!c || !master) return;
    const g = c.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.05, c.currentTime, 2);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
    const os = [55, 55.4, 82.4].map((fr) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); return o; });
    f.connect(g).connect(master);
    ambientNodes = { stop: () => { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.4); os.forEach((o) => o.stop(c.currentTime + 1.5)); } };
  },
};

/** Sound bed for the flight itself. Call update() every frame. */
export class FlightAudio {
  private c = ac(); private rumble?: GainNode; private stat?: GainNode; private nodes: AudioScheduledSourceNode[] = [];
  private beat = 0; private nextBeat = 0; private bpm = 0; private dead = false;
  constructor() {
    const c = this.c; if (!c || !master) return;
    const r = noise(c), rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 170;
    this.rumble = c.createGain(); this.rumble.gain.value = 0; r.connect(rf).connect(this.rumble).connect(master); r.start();
    const s = noise(c), sf = c.createBiquadFilter(); sf.type = 'highpass'; sf.frequency.value = 2200;
    this.stat = c.createGain(); this.stat.gain.value = 0; s.connect(sf).connect(this.stat).connect(master); s.start();
    this.nodes.push(r, s);
  }
  update(rumble: number, stat: number, bpm: number) {
    const c = this.c; if (!c || this.dead) return;
    this.rumble?.gain.setTargetAtTime(rumble * 0.7, c.currentTime, 0.1);
    this.stat?.gain.setTargetAtTime(stat * 0.22, c.currentTime, 0.1);
    this.bpm = bpm;
    if (bpm > 0 && c.currentTime >= this.nextBeat) {
      tone(60, 40, 0.14, 0.4, 'sine'); tone(55, 38, 0.14, 0.28, 'sine', 0.17);
      this.nextBeat = c.currentTime + 60 / bpm; this.beat++;
    }
  }
  powerDown() { tone(440, 40, 3, 0.12, 'sawtooth'); }
  boom() { sfx.thud(); tone(60, 25, 1.4, 0.5, 'sawtooth'); }
  stop() {
    this.dead = true; const c = this.c; if (!c) return;
    this.rumble?.gain.setTargetAtTime(0, c.currentTime, 0.15); this.stat?.gain.setTargetAtTime(0, c.currentTime, 0.15);
    this.nodes.forEach((n) => { try { n.stop(c.currentTime + 0.8); } catch { /* ignore */ } });
  }
}
