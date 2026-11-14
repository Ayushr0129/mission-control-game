import { Chapter, Controls, GameEvent, Mark, Totals } from './types';
import { difficulty, massFrac, warningsFor } from './flight';

/**
 * The liftoff, flown for real: hold the engine, lean the rocket over along the guide arrow, drop the first
 * stage when it runs dry, and keep going to the height marked on screen.
 * Nothing here can lose the crew. A rocket over its mass limit simply never leaves the pad.
 * Numbers are game-scale: the whole climb takes about twenty seconds.
 */
export const ASCENT = {
  gravity: 9.81, twrLight: 1.6, twrHeavy: 1.15, twrOver: 0.9, stage2: 1.6,
  burn1: 9, targetY: 900,
  turnRate: (60 * Math.PI) / 180, snap: (12 * Math.PI) / 180, snapRate: (30 * Math.PI) / 180,
  lean: (48 * Math.PI) / 180,          // how far over the guide leans by the top
  // when guidance takes over
  idle: 6, dryIdle: 5, astray: (50 * Math.PI) / 180,
  // grading: mean angle off the arrow, and seconds the engine sat dead between stages
  cleanErr: (8 * Math.PI) / 180, cleanErrHard: (5 * Math.PI) / 180, roughErr: (20 * Math.PI) / 180, cleanDry: 1.5, roughDry: 4,
  dt: 1 / 60, maxElapsed: 0.1,
};

export interface AscentSetup { twr: number; burn1: number; targetY: number; gravity: number; turnRate: number; cleanErr: number; warnings: string[] }
/** angle: 0 = nose up, positive = leaning right. fuel1 = seconds of first-stage burn left. */
export interface Ascent {
  x: number; y: number; vx: number; vy: number; angle: number; stage: 1 | 2; fuel1: number; t: number;
  /** grading: angle off the arrow summed over burn time, burn time, and seconds the dry stage hung on */
  err: number; n: number; dry: number;
  /** the engine key has been let go since the stage ran dry, so the next press drops it */
  armed: boolean;
  guided: boolean; idle: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const wrap = (a: number) => { let x = a; while (x > Math.PI) x -= 2 * Math.PI; while (x <= -Math.PI) x += 2 * Math.PI; return x; };

export function liftoffSetup(ch: Chapter, t: Totals, events: GameEvent[]): AscentSetup {
  return {
    twr: t.mass > t.capacity ? ASCENT.twrOver : lerp(ASCENT.twrLight, ASCENT.twrHeavy, massFrac(t)),
    burn1: ASCENT.burn1, targetY: ASCENT.targetY, gravity: ASCENT.gravity, turnRate: ASCENT.turnRate,
    cleanErr: lerp(ASCENT.cleanErr, ASCENT.cleanErrHard, difficulty(ch, t, events, 'launch')),
    warnings: warningsFor(events, t.tags, 'launch'),
  };
}

/** Which way to point at this height: straight up off the pad, leaning over more and more on the way to space. */
export function guideAngle(s: AscentSetup, y: number): number {
  const u = clamp((y / s.targetY - 0.06) / 0.94, 0, 1);
  return ASCENT.lean * u * u * (3 - 2 * u);
}
export function startAscent(s: AscentSetup): Ascent {
  return { x: 0, y: 0, vx: 0, vy: 0, angle: 0, stage: 1, fuel1: s.burn1, t: 0, err: 0, n: 0, dry: 0, armed: false, guided: false, idle: 0 };
}
/** is the engine actually pushing, given what the pilot is holding */
export function thrusting(a: Ascent, ctl: Controls): number {
  return ctl.engine && (a.stage === 2 || a.fuel1 > 0) ? clamp(ctl.throttle, 0, 1) : 0;
}
export const stageDry = (a: Ascent) => a.stage === 1 && a.fuel1 <= 0;
export function ascentDone(a: Ascent, s: AscentSetup): boolean { return a.y >= s.targetY; }

/** What guidance does: stay on the arrow, burn, and drop the stage the moment it is empty. */
export function ascentPilot(a: Ascent, s: AscentSetup): Controls {
  const off = wrap(guideAngle(s, a.y) - a.angle);
  return { turn: Math.abs(off) < 0.03 ? 0 : off > 0 ? 1 : -1, engine: stageDry(a) ? a.armed : true, throttle: 1 };
}

/** Move the rocket forward. Fixed small steps, at most a tenth of a second per call. */
export function stepAscent(a0: Ascent, hands: Controls, elapsed: number, s: AscentSetup): Ascent {
  const a = { ...a0 };
  let left = Math.min(Math.max(0, elapsed), ASCENT.maxElapsed);
  while (left > 1e-9 && a.y < s.targetY) {
    const dt = Math.min(ASCENT.dt, left); left -= dt;
    const ctl = a.guided ? ascentPilot(a, s) : hands;
    const guide = guideAngle(s, a.y);
    if (ctl.turn !== 0) a.angle = wrap(a.angle + ctl.turn * s.turnRate * dt);
    else { const off = wrap(guide - a.angle); if (Math.abs(off) < ASCENT.snap) a.angle = wrap(a.angle + clamp(off, -ASCENT.snapRate * dt, ASCENT.snapRate * dt)); }
    // the first stage, once empty, hangs on until the engine key is let go and pressed again
    if (stageDry(a)) {
      a.dry += dt;
      if (!ctl.engine) a.armed = true; else if (a.armed) { a.stage = 2; a.armed = false; }
    }
    // a rocket too heavy for its first stage is too heavy, full stop: it never gets the lighter second stage
    const p = thrusting(a, ctl), acc = s.twr * (a.stage === 2 && s.twr >= 1 ? ASCENT.stage2 : 1) * s.gravity * p;
    a.vx += acc * Math.sin(a.angle) * dt; a.vy += (acc * Math.cos(a.angle) - s.gravity) * dt;
    if (a.stage === 1) a.fuel1 = Math.max(0, a.fuel1 - p * dt);
    a.x += a.vx * dt; a.y += a.vy * dt; a.t += dt;
    if (a.y <= 0) { a.y = 0; a.vy = Math.max(0, a.vy); a.vx = 0; a.x = a0.y <= 0 ? a0.x : a.x; }
    if (p > 0 && a.y > 0.05 * s.targetY) { a.err += Math.abs(wrap(a.angle - guide)) * dt; a.n += dt; }
    // guidance takes over when nobody is flying, or when the flying has gone badly wrong
    if (!a.guided) {
      a.idle = a.y < 1 && !ctl.engine ? a.idle + dt : 0;
      const astray = a.y > 5 && a.y < s.targetY / 3 && Math.abs(wrap(a.angle - guide)) > ASCENT.astray;
      if (a.idle > ASCENT.idle || a.dry > ASCENT.dryIdle || astray || (a.vy < -8 && a.y > 10)) a.guided = true;
    }
  }
  return a;
}

export function gradeAscent(a: Ascent, s: AscentSetup): Mark {
  if (a.guided) return 'rough';
  const mean = a.n > 0 ? a.err / a.n : 0;
  if (mean > ASCENT.roughErr || a.dry > ASCENT.roughDry) return 'rough';
  return mean < s.cleanErr && a.dry < ASCENT.cleanDry ? 'clean' : 'fair';
}

/** Fly the whole climb with a pilot rule. For the tests. */
export function flyAscent(s: AscentSetup, pilot: (a: Ascent, s: AscentSetup) => Controls, limit = 90): Ascent {
  let a = startAscent(s);
  while (!ascentDone(a, s) && a.t < limit) a = stepAscent(a, pilot(a, s), ASCENT.dt, s);
  return a;
}
