import { Chapter, Controls, GameEvent, Mark, Site, Totals } from './types';
import { difficulty, fuelMargin, warningsFor } from './flight';

/**
 * The landing, flown for real: a side view, a craft that turns and burns, gravity, and ground.
 * No graphics in here. The pilot that tests these rules is also the autopilot, and its advice is the
 * guide arrow the player sees, so the game never asks for something it cannot do itself.
 */
export const LAND = {
  gravity: 1.62, thrust: 6.5, turnRate: (120 * Math.PI) / 180,
  // let go of the turn keys near the guide arrow and the craft settles onto it: no fiddly taps
  snap: (15 * Math.PI) / 180, snapRate: (45 * Math.PI) / 180,
  // arriving from orbit: high, moving sideways, sinking slowly
  y0: 260, vx0: 22, vy0: -4,
  // a safe touchdown
  vDownEasy: 6, vDownHard: 4.5, vSide: 3, tilt: (15 * Math.PI) / 180,
  // the highlands: rocks, one flat pad, and a gentler touchdown
  roughDown: 0.8, padCentre: 150, padWidth: 60, rockHeight: 8, legSpan: 4,
  // how the careful pilot comes down: brake early, then drift the last few metres
  cautious: 0.5, lastMoment: 0.75, drift: 12,
  dt: 1 / 60, maxElapsed: 0.1,
};

/** metres and m/s; vy is positive going up; angle in radians, 0 = nose up, positive = leaning right; fuel = seconds at full throttle */
export interface Craft { x: number; y: number; vx: number; vy: number; angle: number; fuel: number; t: number }
export interface LandingSetup {
  fuel: number; start: Craft; gravity: number; thrust: number; turnRate: number;
  /** the fastest safe touchdown: downward, sideways, and how far from upright */
  vDown: number; vSide: number; tilt: number;
  site: Site; pad: { from: number; to: number } | null;
  warnings: string[];
}
export type Verdict = 'ok' | 'fast' | 'sideways' | 'tilted' | 'rocks';
export type Pilot = (c: Craft, s: LandingSetup) => Controls;
export interface Advice {
  /** which way to point, and whether to burn, right now */
  angle: number; throttle: number; engine: boolean;
  /** the coach's step: 0 cancel sideways speed, 1 turn upright, 2 brake, 3 touch down */
  step: 0 | 1 | 2 | 3;
  /** how urgent braking is */
  brake: 'none' | 'soon' | 'now';
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const wrap = (a: number) => { let x = a; while (x > Math.PI) x -= 2 * Math.PI; while (x <= -Math.PI) x += 2 * Math.PI; return x; };

/** Height of the ground at x. The plain is flat; the highlands are rocks everywhere but the pad. */
export function groundAt(s: LandingSetup, x: number): number {
  if (!s.pad) return 0;
  if (x >= s.pad.from && x <= s.pad.to) return 0;
  const edge = Math.min(Math.abs(x - s.pad.from), Math.abs(x - s.pad.to));
  const rock = LAND.rockHeight * (0.55 + 0.25 * Math.sin(x * 0.11 + 1.3) + 0.2 * Math.sin(x * 0.37 + 0.4));
  return Math.max(1.5, rock) * Math.min(1, edge / 6 + 0.35); // the rocks rise from the pad's edge
}
/** the highest ground under the legs and the body */
function floor(s: LandingSetup, x: number) { return Math.max(groundAt(s, x - LAND.legSpan), groundAt(s, x), groundAt(s, x + LAND.legSpan)); }
export function heightOf(c: Craft, s: LandingSetup) { return Math.max(0, c.y - floor(s, c.x)); }
export function onGround(c: Craft, s: LandingSetup) { return c.y <= floor(s, c.x) + 1e-9; }

/**
 * Move the craft forward. Fixed small steps, never more than a tenth of a second per call, so a frozen tab
 * loses time instead of throwing the craft through the ground. Stops the moment it touches.
 */
export function stepCraft(c: Craft, ctl: Controls, elapsed: number, s: LandingSetup): Craft {
  let { x, y, vx, vy, angle, fuel, t } = c;
  let left = Math.min(Math.max(0, elapsed), LAND.maxElapsed);
  while (left > 1e-9 && y > floor(s, x)) {
    const dt = Math.min(LAND.dt, left); left -= dt;
    if (ctl.turn !== 0) angle = wrap(angle + ctl.turn * s.turnRate * dt);
    else { // hands off the turn keys: settle onto the guide arrow if it is close
      const off = wrap(advise({ x, y, vx, vy, angle, fuel, t }, s).angle - angle);
      if (Math.abs(off) < LAND.snap) angle = wrap(angle + clamp(off, -LAND.snapRate * dt, LAND.snapRate * dt));
    }
    const power = ctl.engine && fuel > 0 ? clamp(ctl.throttle, 0, 1) : 0;
    const a = s.thrust * power;
    vx += a * Math.sin(angle) * dt; vy += (a * Math.cos(angle) - s.gravity) * dt;
    fuel = Math.max(0, fuel - power * dt);
    x += vx * dt; y += vy * dt; t += dt;
  }
  const g = floor(s, x); if (y < g) y = g;
  return { x, y, vx, vy, angle, fuel, t };
}

/** How a touchdown went. Checked in the order a player most needs to hear it. */
export function judge(c: Craft, s: LandingSetup): Verdict {
  if (s.pad && (c.x - LAND.legSpan < s.pad.from || c.x + LAND.legSpan > s.pad.to)) return 'rocks';
  if (-c.vy > s.vDown) return 'fast';
  if (Math.abs(c.vx) > s.vSide) return 'sideways';
  if (Math.abs(c.angle) > s.tilt) return 'tilted';
  return 'ok';
}

/** Where the craft comes down if the engine stays off. */
export function impactX(c: Craft, s: LandingSetup): number {
  const t = (c.vy + Math.sqrt(c.vy * c.vy + 2 * s.gravity * Math.max(0, c.y))) / s.gravity;
  return c.x + c.vx * t;
}

/** True once the first try cannot be saved: time to abort. */
export function hopeless(c: Craft, s: LandingSetup): boolean {
  const h = heightOf(c, s), down = -c.vy;
  const fall2 = c.vy * c.vy + 2 * s.gravity * h; // touchdown speed squared with the engine off
  if (fall2 <= s.vDown * s.vDown) return false;
  if (c.fuel <= 0) return true;
  if (down <= s.vDown) return false;
  return down * down - 2 * (s.thrust - s.gravity) * h > s.vDown * s.vDown; // full thrust, nose up, from here to the ground
}

/** What a careful pilot would do right now. Drives the guide arrow, the coach, the autopilot and the test pilots. */
export function advise(c: Craft, s: LandingSetup): Advice {
  const T = s.thrust, g = s.gravity, net = T - g, h = heightOf(c, s), down = -c.vy;
  // sideways: stop, or on the highlands drift to the pad and stop over it
  let wantVx = 0;
  if (s.pad) { const mid = (s.pad.from + s.pad.to) / 2, off = mid - c.x; wantVx = Math.abs(off) < 4 ? 0 : clamp(off * 0.22, -16, 16); }
  // downward: fall freely while high, brake early, drift the last few metres
  const wantDown = Math.sqrt(2 * LAND.cautious * net * Math.max(0, h - LAND.drift)) + 0.5 * s.vDown;
  const lastDown = Math.sqrt(2 * LAND.lastMoment * net * h) + 0.6 * s.vDown;
  let ax = clamp((wantVx - c.vx) * 1.2, -0.85 * T, 0.85 * T);
  let ay = clamp(g + (down - wantDown) * 1.6, 0, T);
  // close to the ground the nose stays near upright: the legs have to arrive first
  const lean = h < 30 ? lerp((6 * Math.PI) / 180, (70 * Math.PI) / 180, h / 30) : Math.PI / 2;
  if (lean < Math.PI / 2) { if (ay < 0.25 * g && Math.abs(ax) > 0.05) ay = 0.25 * g; ax = clamp(ax, -ay * Math.tan(lean), ay * Math.tan(lean)); }
  let mag = Math.hypot(ax, ay);
  if (mag > T) { ax *= T / mag; ay *= T / mag; mag = T; }
  const idle = mag < 0.1 * T;
  const angle = idle ? 0 : Math.atan2(ax, ay);
  const side = Math.abs(c.vx - wantVx);
  // still step 0 while the arrow is asking for a sideways burn, so the coach and the arrow never disagree
  const sidewaysWork = side > s.vSide || (!idle && Math.abs(angle) > 0.6 && side > 0.6);
  const step = sidewaysWork ? 0 : Math.abs(c.angle) > (10 * Math.PI) / 180 && h > 3 ? 1 : down > s.vDown ? 2 : 3;
  return {
    angle, throttle: idle ? 0 : clamp(mag / T, 0.1, 1), engine: !idle && mag > 0.42 * T, step,
    brake: down > lastDown ? 'now' : down > wantDown ? 'soon' : 'none',
  };
}

const turnTo = (have: number, want: number): -1 | 0 | 1 => { const d = wrap(want - have); return Math.abs(d) < 0.035 ? 0 : d > 0 ? 1 : -1; };

/** Smooth hands: points where the advice points and sets the throttle it asks for. The autopilot. */
export const carefulPilot: Pilot = (c, s) => {
  const a = advise(c, s), aimed = Math.abs(wrap(a.angle - c.angle)) < 0.5;
  return { turn: turnTo(c.angle, a.angle), engine: a.throttle > 0 && aimed, throttle: a.throttle };
};
/** A player's hands: full throttle, engine on or off, following the arrow. */
export const simplePilot: Pilot = (c, s) => {
  const a = advise(c, s), aimed = Math.abs(wrap(a.angle - c.angle)) < 0.45;
  return { turn: turnTo(c.angle, a.angle), engine: a.engine && aimed, throttle: 1 };
};
/**
 * The same player with slow hands. They decide what to do from what the screen said `lagSeconds` ago
 * (where to point, whether to burn), but they can see their own craft turning, so they stop a turn on time.
 */
export function laggedPilot(lagSeconds: number): Pilot {
  let seen: { t: number; a: Advice }[] = [];
  return (c, s) => {
    if (seen.length && c.t < seen[seen.length - 1].t) seen = []; // a new try
    seen.push({ t: c.t, a: advise(c, s) });
    let a: Advice | null = null;
    for (let i = seen.length - 1; i >= 0; i--) if (seen[i].t <= c.t - lagSeconds) { a = seen[i].a; break; }
    if (!a) return { turn: 0, engine: false, throttle: 1 };
    const off = wrap(a.angle - c.angle);
    return { turn: Math.abs(off) < LAND.snap * 0.8 ? 0 : off > 0 ? 1 : -1, engine: a.engine && Math.abs(off) < 0.45, throttle: 1 };
  };
}

/** Fly one whole try with a pilot rule. */
export function flyLanding(s: LandingSetup, pilot: Pilot): { landed: boolean; why: Verdict; speed: number; fuelLeft: number; craft: Craft } {
  let c = { ...s.start, fuel: s.fuel };
  while (!onGround(c, s) && c.t < 400) c = stepCraft(c, pilot(c, s), LAND.dt, s);
  const why: Verdict = onGround(c, s) ? judge(c, s) : 'fast';
  return { landed: why === 'ok', why, speed: Math.hypot(c.vx, c.vy), fuelLeft: s.fuel > 0 ? c.fuel / s.fuel : 0, craft: c };
}

const refCache = new Map<string, number>();
/** Seconds of full-throttle fuel the careful pilot uses on this landing. The yardstick every tank is measured against. */
function refBurn(s: LandingSetup): number {
  const key = `${s.site}|${s.vDown.toFixed(4)}`;
  let v = refCache.get(key);
  if (v === undefined) { const big = 1e6; v = big - flyLanding({ ...s, fuel: big }, carefulPilot).craft.fuel; refCache.set(key, v); }
  return v;
}

export function landingSetup(ch: Chapter, t: Totals, events: GameEvent[], marks: { liftoff: Mark; orbit: Mark }, site: Site, attempt: 1 | 2): LandingSetup {
  const vDown = lerp(LAND.vDownEasy, LAND.vDownHard, difficulty(ch, t, events, 'landing')) * (site === 'rough' ? LAND.roughDown : 1);
  const s: LandingSetup = {
    fuel: 0, start: { x: 0, y: LAND.y0, vx: LAND.vx0, vy: LAND.vy0, angle: 0, fuel: 0, t: 0 },
    gravity: LAND.gravity, thrust: LAND.thrust, turnRate: LAND.turnRate,
    vDown, vSide: LAND.vSide, tilt: LAND.tilt, site,
    pad: site === 'rough' ? { from: LAND.padCentre - LAND.padWidth / 2, to: LAND.padCentre + LAND.padWidth / 2 } : null,
    warnings: warningsFor(events, t.tags, 'landing'),
  };
  s.fuel = fuelMargin(t, marks, attempt) * refBurn(s);
  return s;
}
