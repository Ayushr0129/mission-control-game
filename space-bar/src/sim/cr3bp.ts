/**
 * The Earth–Moon trip, computed: a planar restricted three-body model. The Moon moves on a circular orbit about the
 * Earth; the ship feels both. Positions in km, speeds in km/s, time in s, Earth-centred and non-rotating (inertial),
 * with the Moon at angle 0 at t = 0. Used offline by scripts/trajectory.ts; the game ships the result as data.
 * No imports, so Node can run it directly.
 */
export const MU_E = 398600.4418, MU_M = 4902.8, D = 384400, R_E = 6378.137, R_M = 1737.4;
export const W_MOON = Math.sqrt((MU_E + MU_M) / (D * D * D)); // rad/s

export interface State { t: number; x: number; y: number; vx: number; vy: number }

export function moonAt(t: number): [number, number] { return [D * Math.cos(W_MOON * t), D * Math.sin(W_MOON * t)]; }

function accel(t: number, x: number, y: number): [number, number] {
  const [mx, my] = moonAt(t);
  const r3 = Math.pow(x * x + y * y, 1.5);
  const dx = x - mx, dy = y - my, d3 = Math.pow(dx * dx + dy * dy, 1.5);
  const m3 = Math.pow(mx * mx + my * my, 1.5);
  // the Earth's pull, the Moon's pull, and the Moon's pull on the Earth (the frame is centred on an accelerating Earth)
  return [-MU_E * x / r3 - MU_M * dx / d3 - MU_M * mx / m3, -MU_E * y / r3 - MU_M * dy / d3 - MU_M * my / m3];
}

function rk4(s: State, h: number): State {
  const f = (t: number, x: number, y: number, vx: number, vy: number) => { const [ax, ay] = accel(t, x, y); return [vx, vy, ax, ay]; };
  const k1 = f(s.t, s.x, s.y, s.vx, s.vy);
  const k2 = f(s.t + h / 2, s.x + h / 2 * k1[0], s.y + h / 2 * k1[1], s.vx + h / 2 * k1[2], s.vy + h / 2 * k1[3]);
  const k3 = f(s.t + h / 2, s.x + h / 2 * k2[0], s.y + h / 2 * k2[1], s.vx + h / 2 * k2[2], s.vy + h / 2 * k2[3]);
  const k4 = f(s.t + h, s.x + h * k3[0], s.y + h * k3[1], s.vx + h * k3[2], s.vy + h * k3[3]);
  return {
    t: s.t + h,
    x: s.x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y: s.y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    vx: s.vx + h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]), vy: s.vy + h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
  };
}

export const rEarth = (s: State) => Math.hypot(s.x, s.y);
export const rMoon = (s: State) => { const [mx, my] = moonAt(s.t); return Math.hypot(s.x - mx, s.y - my); };
export const speed = (s: State) => Math.hypot(s.vx, s.vy);

/** Step size: small near either body, larger in between. */
function stepFor(s: State) {
  const a = Math.min(Math.sqrt(Math.pow(rEarth(s), 3) / MU_E), Math.sqrt(Math.pow(rMoon(s), 3) / MU_M));
  return Math.min(300, Math.max(0.5, 0.004 * a));
}

/** Integrate until `stop` says so (or tMax). Returns every step. */
export function integrate(s0: State, stop: (s: State, prev: State) => boolean, tMax = 12 * 86400): State[] {
  const out = [s0]; let s = s0;
  while (s.t - s0.t < tMax) {
    const n = rk4(s, stepFor(s)); out.push(n);
    if (stop(n, s)) break;
    s = n;
  }
  return out;
}

/** Flight-path angle at a point relative to the Earth, degrees (negative = descending). */
export function flightPathDeg(s: State) { return Math.asin((s.x * s.vx + s.y * s.vy) / (rEarth(s) * speed(s))) * 180 / Math.PI; }

/** Earth-centred, Earth–Moon rotating frame: the Moon sits at (D, 0). */
export function toRotating(s: State): [number, number] {
  const a = -W_MOON * s.t, c = Math.cos(a), si = Math.sin(a);
  return [s.x * c - s.y * si, s.x * si + s.y * c];
}

/** Injection: at altitude h (km), speed v (km/s), horizontal and counter-clockwise, at angle phase (rad) from the Moon. */
export function injection(h: number, v: number, phase: number): State {
  const r = R_E + h;
  return { t: 0, x: r * Math.cos(phase), y: r * Math.sin(phase), vx: -v * Math.sin(phase), vy: v * Math.cos(phase) };
}

/** Which way the ship goes round the Moon: +1 counter-clockwise, -1 clockwise. */
export function senseAroundMoon(s: State): number {
  const [mx, my] = moonAt(s.t), mvx = -D * W_MOON * Math.sin(W_MOON * s.t), mvy = D * W_MOON * Math.cos(W_MOON * s.t);
  return Math.sign((s.x - mx) * (s.vy - mvy) - (s.y - my) * (s.vx - mvx));
}

/**
 * Leaving lunar orbit: a circular orbit `alt` km above the Moon at time t, at angle `at` (rad, Moon-centred, measured
 * from the Earth–Moon line pointing away from the Earth), going round in `sense`, with `dv` km/s added along the motion.
 */
export function leaveMoon(t: number, alt: number, at: number, sense: number, dv: number): State {
  const [mx, my] = moonAt(t), th = W_MOON * t, r = R_M + alt, vc = Math.sqrt(MU_M / r) + dv;
  const a = th + at, px = Math.cos(a), py = Math.sin(a);
  return {
    t, x: mx + r * px, y: my + r * py,
    vx: -D * W_MOON * Math.sin(th) + sense * vc * -py, vy: D * W_MOON * Math.cos(th) + sense * vc * px,
  };
}

export interface Homebound { states: State[]; entryIdx: number; entryAngle: number; reached: boolean }
/** Fly from the trans-Earth burn to the top of the atmosphere (122 km), or until the path misses. */
export function flyHome(s0: State): Homebound {
  let reached = false;
  const states = integrate(s0, (n, p) => {
    if (rMoon(n) < R_M) return true;
    if (rEarth(n) < R_E + 122) { reached = true; return true; }
    if (rEarth(n) < 60000 && rEarth(n) > rEarth(p)) return true; // passed perigee without reaching the air
    return false;
  }, 8 * 86400);
  const e = states[states.length - 1];
  return { states, entryIdx: states.length - 1, entryAngle: reached ? flightPathDeg(e) : 0, reached };
}

export interface Outbound { states: State[]; periIdx: number; perilune: number; returnPerigee: number; homeIdx: number }
/** Fly from injection past the Moon and back to the Earth with no burn. */
export function flyOutbound(h: number, v: number, phase: number): Outbound {
  let periIdx = -1, pmin = Infinity, gone = false;
  const states = integrate(injection(h, v, phase), (n, p) => {
    const rm = rMoon(n);
    if (rm < pmin) pmin = rm;
    if (rm < R_M) return true;
    if (!gone && rMoon(p) < rm && rm < 60000) gone = true; // past the Moon
    if (gone && rEarth(n) > rEarth(p) && rEarth(n) < 60000) return true; // back at the Earth: perigee, measured with no air
    if (gone && rEarth(n) < 1000) return true; // straight into the Earth (a point mass here, so it can pass below the surface)
    return false;
  }, 14 * 86400);
  states.forEach((s, i) => { if (periIdx < 0 || rMoon(s) < rMoon(states[periIdx])) periIdx = i; });
  let homeIdx = states.length - 1; let rp = Infinity;
  for (let i = periIdx; i < states.length; i++) if (rEarth(states[i]) < rp) { rp = rEarth(states[i]); homeIdx = i; }
  return { states, periIdx, perilune: rMoon(states[periIdx]) - R_M, returnPerigee: rp - R_E, homeIdx };
}
