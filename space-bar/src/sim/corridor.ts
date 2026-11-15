import { Controls, Mark } from './types';

/**
 * The entry corridor: the last correction before re-entry. The ship will meet the atmosphere at some angle below
 * horizontal; Apollo 11 met it at -6.48°. Too steep and the heat and the deceleration kill the crew; too shallow and the
 * ship skips off the air into space. One small burn moves the angle: nose up (radially out) makes it shallower,
 * nose down makes it steeper.
 * A correction nobody burns is made by guidance, late. Only a player who burns it out of the band can lose the crew.
 */
export const CORRIDOR = {
  lo: -7.5, hi: -5.5, centre: -6.5,
  /** how far outside the band the ship starts, by how well the trans-Earth burn went (degrees) */
  offBy: { clean: 0.6, fair: 1.4, rough: 2.2 } as Record<Mark, number>,
  rate: 0.45,             // degrees per second at full throttle, pointing straight up or down
  window: 20, selfBurnAt: 0.6, settle: 1.2,
  turnRate: (100 * Math.PI) / 180, snap: (15 * Math.PI) / 180, snapRate: (45 * Math.PI) / 180,
  dt: 1 / 60, maxElapsed: 0.1,
};
export interface CorridorSetup { start: number; lo: number; hi: number; window: number; rate: number; turnRate: number }
/** angle: the entry angle, degrees. ship: the nose, radians, 0 = forward along the path, +π/2 = up (away from the Earth). */
export interface Corridor { angle: number; ship: number; t: number; burnt: number; quiet: number; self: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap = (a: number) => { let x = a; while (x > Math.PI) x -= 2 * Math.PI; while (x <= -Math.PI) x += 2 * Math.PI; return x; };

/**
 * Where the correction starts. After a trans-Earth burn: outside the band by how well that burn went, steep or shallow
 * by `steep`. On the free return: the free-return path's own entry angle, which is already inside the band.
 */
export function corridorSetup(from: { tei: Mark; steep: boolean } | { freeReturn: number }): CorridorSetup {
  const start = 'freeReturn' in from ? from.freeReturn
    : from.steep ? CORRIDOR.lo - CORRIDOR.offBy[from.tei] : CORRIDOR.hi + CORRIDOR.offBy[from.tei];
  return { start, lo: CORRIDOR.lo, hi: CORRIDOR.hi, window: CORRIDOR.window, rate: CORRIDOR.rate, turnRate: CORRIDOR.turnRate };
}
export const corridorIn = (c: Corridor, s: CorridorSetup) => c.angle >= s.lo && c.angle <= s.hi;
export function startCorridor(s: CorridorSetup): Corridor { return { angle: s.start, ship: 0, t: 0, burnt: 0, quiet: 0, self: false }; }
/** Which way the arrow points: up when too steep, down when too shallow, and along the path when inside. */
export function corridorAim(c: Corridor, s: CorridorSetup): number {
  const mid = (s.lo + s.hi) / 2;
  return Math.abs(c.angle - mid) < 0.15 ? 0 : c.angle < mid ? Math.PI / 2 : -Math.PI / 2;
}

/** What guidance does: point up or down, burn, ease off near the middle of the band. */
export function corridorPilot(c: Corridor, s: CorridorSetup): Controls {
  const aim = corridorAim(c, s), off = wrap(aim - c.ship), mid = (s.lo + s.hi) / 2, away = Math.abs(c.angle - mid);
  return { turn: Math.abs(off) < 0.04 ? 0 : off > 0 ? 1 : -1, engine: aim !== 0 && Math.abs(off) < 0.25 && away > 0.15, throttle: away > 0.6 ? 1 : 0.35 };
}

export function stepCorridor(c0: Corridor, hands: Controls, elapsed: number, s: CorridorSetup): Corridor {
  const c = { ...c0 };
  let left = Math.min(Math.max(0, elapsed), CORRIDOR.maxElapsed);
  while (left > 1e-9 && !corridorOver(c, s)) {
    const dt = Math.min(CORRIDOR.dt, left); left -= dt;
    if (!c.self && c.burnt === 0 && !corridorIn(c, s) && c.t >= s.window * CORRIDOR.selfBurnAt) c.self = true;
    const ctl = c.self ? corridorPilot(c, s) : hands;
    const aim = corridorAim(c, s);
    if (ctl.turn !== 0) c.ship = wrap(c.ship + ctl.turn * s.turnRate * dt);
    else { const off = wrap(aim - c.ship); if (Math.abs(off) < CORRIDOR.snap) c.ship = wrap(c.ship + clamp(off, -CORRIDOR.snapRate * dt, CORRIDOR.snapRate * dt)); }
    const p = ctl.engine ? clamp(ctl.throttle, 0, 1) : 0;
    if (p > 0) { c.angle += s.rate * p * Math.sin(c.ship) * dt; c.burnt += p * dt; }
    // settled: inside the band with the engine off, after a burn or from the start
    c.quiet = p === 0 && corridorIn(c, s) && (c.burnt > 0 || c.t > 3) ? c.quiet + dt : 0;
    c.t += dt;
  }
  return c;
}
export function corridorOver(c: Corridor, s: CorridorSetup): boolean { return c.t >= s.window || c.quiet >= CORRIDOR.settle; }
/** Through the corridor? */
export function corridorOk(c: Corridor, s: CorridorSetup): boolean { return corridorIn(c, s); }
export function flyCorridor(s: CorridorSetup, pilot: (c: Corridor, s: CorridorSetup) => Controls): Corridor {
  let c = startCorridor(s);
  while (!corridorOver(c, s)) c = stepCorridor(c, pilot(c, s), CORRIDOR.dt, s);
  return c;
}
