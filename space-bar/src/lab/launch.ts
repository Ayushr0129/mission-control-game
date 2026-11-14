/**
 * The launch to orbit, flown for real: a planar rocket over a real-size Earth, Newtonian gravity, thrust and
 * mass flow from each stage's engine. No atmosphere: an orbit counts once its lowest point clears ORBIT.minPeri.
 * No DOM in here. The autopilot is also the test pilot, so the game never asks for something it cannot do itself.
 */
import { G0, performanceOf } from './physics';
import type { Part } from './catalog';

export const EARTH = { radius: 6_371_000, mu: 3.986004418e14 };
export const ORBIT = {
  /** lowest point of the orbit that counts as reaching space for good, metres above the surface */
  minPeri: 150_000,
  /** what the autopilot aims for */
  targetApo: 200_000, targetPeri: 170_000,
  dt: 0.05, maxElapsed: 2,
};

export interface FlightStage { name: string; thrust: number; isp: number; prop: number; dry: number; chemical: boolean }
/** SI units: newtons, seconds, kilograms */
export interface LaunchSetup { stages: FlightStage[]; rest: number; fairing: number }
export type LaunchStatus = 'pad' | 'flying' | 'orbit' | 'crashed' | 'spent';
export interface LaunchState {
  x: number; y: number; vx: number; vy: number;
  /** thrust direction from local vertical, radians; positive leans downrange */
  pitch: number; throttle: number;
  stage: number; prop: number[]; fairing: boolean; t: number; status: LaunchStatus;
  /** autopilot bookkeeping: 0 climb, 1 coast to the top, 2 circularise */
  phase: 0 | 1 | 2;
}
export interface LaunchControls { throttle: number; pitch: number; stage?: boolean }

export function launchSetupOf(stack: Part[]): LaunchSetup {
  const perf = performanceOf(stack);
  const stages = perf.stages.map((s): FlightStage => ({ name: s.engine.short, thrust: s.thrust * 1000, isp: s.isp, prop: s.prop * 1000, dry: s.dry * 1000, chemical: s.engine.tags.includes('chemical') }));
  const fairing = stack.filter((p) => p.tags.includes('fairing')).reduce((a, p) => a + p.mass, 0) * 1000;
  const inStages = stages.reduce((a, s) => a + s.prop + s.dry, 0);
  return { stages, fairing, rest: perf.mass * 1000 - inStages - fairing };
}

export function startLaunch(s: LaunchSetup): LaunchState {
  return { x: 0, y: EARTH.radius, vx: 0, vy: 0, pitch: 0, throttle: 0, stage: 0, prop: s.stages.map((x) => x.prop), fairing: s.fairing > 0, t: 0, status: 'pad', phase: 0 };
}

export function massOf(f: LaunchState, s: LaunchSetup): number {
  let m = s.rest + (f.fairing ? s.fairing : 0);
  for (let i = f.stage; i < s.stages.length; i++) m += s.stages[i].dry + f.prop[i];
  return m;
}
export const altitudeOf = (f: LaunchState) => Math.hypot(f.x, f.y) - EARTH.radius;
export const speedOf = (f: LaunchState) => Math.hypot(f.vx, f.vy);
/** speed away from the planet's centre (m/s) */
export const climbOf = (f: LaunchState) => (f.x * f.vx + f.y * f.vy) / Math.hypot(f.x, f.y);

/** Apoapsis and periapsis altitudes in metres (Infinity apoapsis on an escape path). */
export function orbitOf(f: LaunchState): { apo: number; peri: number; escape: boolean } {
  const r = Math.hypot(f.x, f.y), v2 = f.vx * f.vx + f.vy * f.vy, mu = EARTH.mu;
  const energy = v2 / 2 - mu / r, h = f.x * f.vy - f.y * f.vx;
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)));
  if (energy >= 0) return { apo: Infinity, peri: (h * h) / (mu * (1 + e)) - EARTH.radius, escape: true };
  const a = -mu / (2 * energy);
  return { apo: a * (1 + e) - EARTH.radius, peri: a * (1 - e) - EARTH.radius, escape: false };
}

/** Delta-v still in the tanks, km/s, with what is left of this stage and every stage above it. */
export function remainingDv(f: LaunchState, s: LaunchSetup): number {
  let m = massOf(f, s), dv = 0, fairing = f.fairing;
  for (let i = f.stage; i < s.stages.length; i++) {
    if (i > f.stage && fairing) { m -= s.fairing; fairing = false; }
    const st = s.stages[i], p = f.prop[i];
    if (p > 0 && st.isp > 0) dv += st.isp * G0 * Math.log(m / (m - p));
    m -= p + st.dry;
  }
  return dv / 1000;
}

const usable = (st: FlightStage, prop: number) => st.chemical && st.thrust > 0 && prop > 0;
/** Is any chemical stage at or above this one still holding propellant? Ion drives cannot lift into orbit. */
export const canStillBurn = (f: LaunchState, s: LaunchSetup) => s.stages.some((st, i) => i >= f.stage && usable(st, f.prop[i]));
export const stageDry = (f: LaunchState, s: LaunchSetup) => f.stage < s.stages.length && !usable(s.stages[f.stage], f.prop[f.stage]);

/** Drop the current stage (and the fairing, the first time) and move to the next. */
export function stageNow(f: LaunchState, s: LaunchSetup): LaunchState {
  if (f.stage >= s.stages.length - 1) return f;
  return { ...f, stage: f.stage + 1, fairing: false };
}

/** Advance the flight. Fixed small steps, at most `ORBIT.maxElapsed` seconds of flight per call. */
export function stepLaunch(f0: LaunchState, ctl: LaunchControls, elapsed: number, s: LaunchSetup): LaunchState {
  let f: LaunchState = { ...f0, prop: [...f0.prop] };
  if (f.status === 'crashed' || f.status === 'spent') return f;
  if (ctl.stage) f = stageNow(f, s);
  f.pitch = ctl.pitch; f.throttle = Math.min(1, Math.max(0, ctl.throttle));
  let left = Math.min(Math.max(0, elapsed), ORBIT.maxElapsed);
  while (left > 1e-9) {
    const dt = Math.min(ORBIT.dt, left); left -= dt;
    const r = Math.hypot(f.x, f.y), ux = f.x / r, uy = f.y / r, ex = uy, ey = -ux;
    const st = s.stages[f.stage];
    const burning = st && st.thrust > 0 && f.prop[f.stage] > 0 && f.throttle > 0;
    const force = burning ? st.thrust * f.throttle : 0;
    const m = massOf(f, s);
    const dirx = Math.cos(f.pitch) * ux + Math.sin(f.pitch) * ex, diry = Math.cos(f.pitch) * uy + Math.sin(f.pitch) * ey;
    const g = EARTH.mu / (r * r);
    if (f.status === 'pad' && force / m <= g) { f.t += dt; continue; } // held down until the engines can lift her
    if (f.status === 'pad') f.status = 'flying';
    f.vx += (force / m * dirx - g * ux) * dt; f.vy += (force / m * diry - g * uy) * dt;
    f.x += f.vx * dt; f.y += f.vy * dt; f.t += dt;
    if (burning) f.prop[f.stage] = Math.max(0, f.prop[f.stage] - (force / (st.isp * G0)) * dt);
    if (Math.hypot(f.x, f.y) < EARTH.radius) { f.status = 'crashed'; break; }
  }
  if (f.status === 'flying' || f.status === 'orbit') {
    const o = orbitOf(f);
    if (o.peri >= ORBIT.minPeri) f.status = 'orbit';
    else if (f.status === 'flying' && !canStillBurn(f, s)) f.status = 'spent';
  }
  return f;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Seconds until the craft next reaches the top of its arc (a rough figure, good enough near the top). */
function timeToApo(f: LaunchState): number { const vr = climbOf(f); return vr > 0 ? vr / (EARTH.mu / Math.hypot(f.x, f.y) ** 2) : 0; }

/**
 * What guidance does: a gravity turn until the top of the arc reaches 200 km, coast up to it, then burn
 * along the horizon until the low point clears the atmosphere. Drops a stage the moment it runs dry.
 * Returns the controls and the guidance phase to remember for next time.
 */
export function launchPilot(f: LaunchState, s: LaunchSetup): LaunchControls & { phase: LaunchState['phase'] } {
  const stage = stageDry(f, s) && f.stage < s.stages.length - 1;
  const alt = altitudeOf(f), o = orbitOf(f), vr = climbOf(f);
  let phase = f.phase;
  if (phase === 0 && o.apo >= ORBIT.targetApo) phase = 1;
  if (phase === 1) {
    const st = s.stages[f.stage], m = massOf(f, s), a = st && st.thrust > 0 ? st.thrust / m : 0;
    const need = Math.sqrt(EARTH.mu / Math.hypot(f.x, f.y)) - speedOf(f); // rough: what circular speed still needs
    if (a > 0 && timeToApo(f) <= Math.max(5, need / a / 2)) phase = 2;
  }
  if (phase === 1) return { throttle: 0, pitch: Math.PI / 2, stage, phase };
  if (phase === 2 && o.peri >= ORBIT.targetPeri) return { throttle: 0, pitch: Math.PI / 2, stage: false, phase };
  // lean over smoothly with height (straight up off the pad, nearly flat by 60 km), but never so far that a weak
  // upper stage stops climbing: keep enough of the thrust pointing up to hold the climb rate guidance wants
  const u = clamp((alt - 800) / 60_000, 0, 1);
  const program = phase === 0 ? (Math.PI / 2) * 0.92 * Math.sqrt(u) : Math.PI / 2;
  const wantClimb = phase === 0 ? clamp((ORBIT.targetApo - alt) / 400, 0, 250) : 0;
  return { throttle: 1, pitch: Math.min(program, holdClimb(f, s, wantClimb)), stage, phase };
}

/** The furthest from vertical the thrust can lean while still steering the climb rate towards `wantClimb` (m/s). */
function holdClimb(f: LaunchState, s: LaunchSetup, wantClimb: number): number {
  const st = s.stages[f.stage];
  if (!st || st.thrust <= 0 || f.prop[f.stage] <= 0) return Math.PI / 2;
  const r = Math.hypot(f.x, f.y), a = st.thrust / massOf(f, s);
  const vt = Math.abs(f.x * f.vy - f.y * f.vx) / r; // speed along the horizon
  const upNeed = EARTH.mu / (r * r) - (vt * vt) / r + 0.05 * (wantClimb - climbOf(f));
  return Math.acos(clamp(upNeed / a, 0, 1));
}

/** Fly the whole launch with the autopilot. For the tests and for the guided launch. */
export function flyLaunch(s: LaunchSetup, limit = 4000): LaunchState {
  let f = startLaunch(s);
  while (f.t < limit && (f.status === 'pad' || f.status === 'flying' || (f.status === 'orbit' && orbitOf(f).peri < ORBIT.targetPeri && canStillBurn(f, s)))) {
    const c = launchPilot(f, s);
    f = stepLaunch({ ...f, phase: c.phase }, c, 0.5, s);
    f.phase = c.phase;
  }
  return f;
}
