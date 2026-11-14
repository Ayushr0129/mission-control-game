import { Chapter, Controls, GameEvent, Mark, Totals } from './types';
import { difficulty, warningsFor } from './flight';

/**
 * The burn into Moon orbit, flown for real: the ship arrives nose first and too fast. Turn it around so the
 * engine points along its path, burn until the speed is inside the green band, and stop.
 * Nothing here can lose the crew: a ship nobody flies burns by itself, late, and pays for it in landing fuel.
 */
export const ORBIT = {
  speed0: 2400, target: 1650, bandEasy: 60, bandHard: 35, decel: 170, window: 20, selfBurnAt: 0.7,
  turnRate: (100 * Math.PI) / 180, snap: (15 * Math.PI) / 180, snapRate: (45 * Math.PI) / 180,
  settle: 1.2,                         // seconds inside the band with the engine off before the burn counts as finished
  dt: 1 / 60, maxElapsed: 0.1,
};
export interface OrbitSetup { speed0: number; lo: number; hi: number; window: number; decel: number; turnRate: number; warnings: string[] }
/** angle: 0 = nose first along the path, π = backwards (the way to slow down). quiet = seconds settled inside the band. */
export interface OrbitBurn { speed: number; angle: number; t: number; burnt: number; quiet: number; self: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const wrap = (a: number) => { let x = a; while (x > Math.PI) x -= 2 * Math.PI; while (x <= -Math.PI) x += 2 * Math.PI; return x; };
/** how far the nose is from pointing backwards */
export const offBackwards = (o: OrbitBurn) => wrap(Math.PI - o.angle);
export const inBand = (o: OrbitBurn, s: OrbitSetup) => o.speed >= s.lo && o.speed <= s.hi;

export function orbitSetup(ch: Chapter, t: Totals, events: GameEvent[]): OrbitSetup {
  const half = lerp(ORBIT.bandEasy, ORBIT.bandHard, difficulty(ch, t, events, 'orbit'));
  return { speed0: ORBIT.speed0, lo: ORBIT.target - half, hi: ORBIT.target + half, window: ORBIT.window, decel: ORBIT.decel, turnRate: ORBIT.turnRate, warnings: warningsFor(events, t.tags, 'orbit') };
}
export function startOrbit(s: OrbitSetup): OrbitBurn { return { speed: s.speed0, angle: 0, t: 0, burnt: 0, quiet: 0, self: false }; }

/** What guidance does: turn right round, burn hard, ease off near the band, stop inside it. */
export function orbitPilot(o: OrbitBurn, s: OrbitSetup): Controls {
  const off = offBackwards(o), mid = (s.lo + s.hi) / 2, over = o.speed - mid;
  return { turn: Math.abs(off) < 0.04 ? 0 : off > 0 ? 1 : -1, engine: Math.abs(off) < 0.25 && over > 4, throttle: over > 70 ? 1 : 0.3 };
}

/** Move the burn forward. Fixed small steps, at most a tenth of a second per call. */
export function stepOrbit(o0: OrbitBurn, hands: Controls, elapsed: number, s: OrbitSetup): OrbitBurn {
  const o = { ...o0 };
  let left = Math.min(Math.max(0, elapsed), ORBIT.maxElapsed);
  while (left > 1e-9 && !orbitOver(o, s)) {
    const dt = Math.min(ORBIT.dt, left); left -= dt;
    // nobody has burned and the window is closing: the ship does it by itself, late
    if (!o.self && o.burnt === 0 && o.t >= s.window * ORBIT.selfBurnAt) o.self = true;
    const ctl = o.self ? orbitPilot(o, s) : hands;
    if (ctl.turn !== 0) o.angle = wrap(o.angle + ctl.turn * s.turnRate * dt);
    else { const off = offBackwards(o); if (Math.abs(off) < ORBIT.snap) o.angle = wrap(o.angle + clamp(off, -ORBIT.snapRate * dt, ORBIT.snapRate * dt)); }
    const p = ctl.engine ? clamp(ctl.throttle, 0, 1) : 0;
    if (p > 0) { o.speed -= s.decel * p * Math.cos(offBackwards(o)) * dt; o.burnt += p * dt; }
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
