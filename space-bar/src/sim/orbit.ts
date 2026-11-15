import { Chapter, Controls, GameEvent, Mark, Phase, Totals } from './types';
import { difficulty, warningsFor } from './flight';
import trip from '../data/trajectory.json';

/**
 * The speed burns, flown for real, with real speeds in km/s from the computed Apollo 11 trajectory:
 *  - trans-lunar injection (tli): in Earth orbit, point forward and burn from orbital speed to the speed that reaches the Moon;
 *  - lunar orbit insertion (loi): arriving at the Moon too fast, point backwards and burn down to lunar-orbit speed;
 *  - trans-Earth injection (tei): in lunar orbit, point forward and burn up to the speed that falls back to the Earth.
 * Nothing here can lose the crew: a burn nobody flies is done by the ship itself, late, and that costs fuel.
 * The one exception is the Moon-orbit burn: with no burn at all, the free return carries the crew home without landing.
 */
export type BurnId = 'tli' | 'loi' | 'tei';
export const ORBIT = {
  window: 20, selfBurnAt: 0.5,
  /** half the green band, as a share of the speed change: wider on an easy build */
  bandEasy: 0.06, bandHard: 0.035,
  /** seconds a full-throttle burn takes, so the change of speed sets the rate */
  burnSeconds: 6,
  turnRate: (100 * Math.PI) / 180, snap: (15 * Math.PI) / 180, snapRate: (45 * Math.PI) / 180,
  settle: 1.2, // seconds inside the band with the engine off before the burn counts as finished
  dt: 1 / 60, maxElapsed: 0.1,
};
const m = trip.meta;
/** The speeds each burn starts from and aims for, km/s, and which way to point. */
export const BURNS: Record<BurnId, { from: number; to: number; dir: 'prograde' | 'retrograde'; start: number; phase: Phase }> = {
  tli: { from: m.parkingSpeed, to: m.injectionSpeed, dir: 'prograde', start: Math.PI / 2, phase: 'coast' },
  loi: { from: m.moonArrivalSpeed, to: m.lunarOrbitSpeed, dir: 'retrograde', start: 0, phase: 'orbit' },
  tei: { from: m.lunarOrbitSpeed, to: m.lunarOrbitSpeed + m.teiDv, dir: 'prograde', start: Math.PI, phase: 'return' },
};

export interface OrbitSetup {
  id: BurnId; dir: 'prograde' | 'retrograde';
  speed0: number; target: number; lo: number; hi: number; window: number; rate: number; turnRate: number; start: number; warnings: string[];
  /** whether the ship burns by itself when nobody touches it. Not at the Moon: no burn there means the free return home. */
  idleSelf: boolean;
}
/** angle: 0 = nose forward along the path, π = backwards. quiet = seconds settled inside the band. */
export interface OrbitBurn { speed: number; angle: number; t: number; burnt: number; quiet: number; self: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const wrap = (a: number) => { let x = a; while (x > Math.PI) x -= 2 * Math.PI; while (x <= -Math.PI) x += 2 * Math.PI; return x; };
const aimOf = (s: OrbitSetup) => (s.dir === 'prograde' ? 0 : Math.PI);
/** how far the nose is from where the arrow points */
export const offTarget = (o: OrbitBurn, s: OrbitSetup) => wrap(aimOf(s) - o.angle);
/** kept for older callers: the Moon-orbit burn points backwards */
export const offBackwards = (o: OrbitBurn) => wrap(Math.PI - o.angle);
export const inBand = (o: OrbitBurn, s: OrbitSetup) => o.speed >= s.lo && o.speed <= s.hi;

export function burnSetup(id: BurnId, ch: Chapter, t: Totals, events: GameEvent[]): OrbitSetup {
  const b = BURNS[id], dv = Math.abs(b.to - b.from);
  const half = dv * lerp(ORBIT.bandEasy, ORBIT.bandHard, difficulty(ch, t, events, b.phase));
  return {
    id, dir: b.dir, speed0: b.from, target: b.to, lo: b.to - half, hi: b.to + half, window: ORBIT.window,
    rate: dv / ORBIT.burnSeconds, turnRate: ORBIT.turnRate, start: b.start, warnings: warningsFor(events, t.tags, b.phase),
    idleSelf: id !== 'loi',
  };
}
/** The Moon-orbit burn, as before. */
export function orbitSetup(ch: Chapter, t: Totals, events: GameEvent[]): OrbitSetup { return burnSetup('loi', ch, t, events); }
export function startOrbit(s: OrbitSetup): OrbitBurn { return { speed: s.speed0, angle: s.start, t: 0, burnt: 0, quiet: 0, self: false }; }

/** What guidance does: turn to the arrow, burn hard, ease off near the band, stop inside it. */
export function orbitPilot(o: OrbitBurn, s: OrbitSetup): Controls {
  const off = offTarget(o, s), left = Math.abs(s.target - o.speed) * (s.dir === 'prograde' ? Math.sign(s.target - o.speed) : Math.sign(o.speed - s.target));
  const width = s.hi - s.lo;
  return { turn: Math.abs(off) < 0.04 ? 0 : off > 0 ? 1 : -1, engine: Math.abs(off) < 0.25 && left > width * 0.05, throttle: left > width * 1.5 ? 1 : 0.3 };
}

/** Move the burn forward. Fixed small steps, at most a tenth of a second per call. */
export function stepOrbit(o0: OrbitBurn, hands: Controls, elapsed: number, s: OrbitSetup): OrbitBurn {
  const o = { ...o0 };
  let left = Math.min(Math.max(0, elapsed), ORBIT.maxElapsed);
  while (left > 1e-9 && !orbitOver(o, s)) {
    const dt = Math.min(ORBIT.dt, left); left -= dt;
    // nobody has burned and the window is closing: the ship does it by itself, late
    if (s.idleSelf && !o.self && o.burnt === 0 && o.t >= s.window * ORBIT.selfBurnAt) o.self = true;
    const ctl = o.self ? orbitPilot(o, s) : hands;
    if (ctl.turn !== 0) o.angle = wrap(o.angle + ctl.turn * s.turnRate * dt);
    else { const off = offTarget(o, s); if (Math.abs(off) < ORBIT.snap) o.angle = wrap(o.angle + clamp(off, -ORBIT.snapRate * dt, ORBIT.snapRate * dt)); }
    const p = ctl.engine ? clamp(ctl.throttle, 0, 1) : 0;
    if (p > 0) { o.speed += (s.dir === 'prograde' ? 1 : -1) * s.rate * p * Math.cos(offTarget(o, s)) * dt; o.burnt += p * dt; }
    o.quiet = p === 0 && o.burnt > 0 && inBand(o, s) ? o.quiet + dt : 0;
    o.t += dt;
  }
  return o;
}
/** The moment is over when the window closes, or the ship has sat inside the band with the engine off. */
export function orbitOver(o: OrbitBurn, s: OrbitSetup): boolean { return o.t >= s.window || o.quiet >= ORBIT.settle; }

export function gradeOrbit(o: OrbitBurn, s: OrbitSetup): Mark {
  if (o.self) return 'rough';
  if (inBand(o, s)) return 'clean';
  const width = s.hi - s.lo;
  return o.speed >= s.lo - width && o.speed <= s.hi + width ? 'fair' : 'rough';
}
/** Fly the whole burn with a pilot rule. For the tests. */
export function flyOrbit(s: OrbitSetup, pilot: (o: OrbitBurn, s: OrbitSetup) => Controls): OrbitBurn {
  let o = startOrbit(s);
  while (!orbitOver(o, s)) o = stepOrbit(o, pilot(o, s), ORBIT.dt, s);
  return o;
}
