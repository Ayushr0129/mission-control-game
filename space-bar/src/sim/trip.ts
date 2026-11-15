/**
 * Solves the game's Earth–Moon trip from Apollo 11's published figures, and samples it for the map.
 * Runs offline (scripts/trajectory.ts); the game reads the result from src/data/trajectory.json.
 */
import type { State } from './cr3bp.ts';
import { D, R_E, R_M, MU_M, flyOutbound, flyHome, leaveMoon, senseAroundMoon, rEarth, rMoon, speed, toRotating, moonAt, W_MOON } from './cr3bp.ts';

export const FT = 0.3048;
/** NASA's figures the trip is solved to. */
export const APOLLO = {
  injectionSpeed: (35567.3 * FT) / 1000, // km/s at trans-lunar injection, SP-4029
  periluneKm: 111,                       // 60 n mi, Apollo 11's lunar orbit after circularization, SP-4029
  entryAngle: -6.48,                     // degrees at entry interface, Apollo Flight Journal
  entrySpeed: (36194 * FT) / 1000,       // km/s at entry interface, Apollo Flight Journal
  homeCoastH: 195.0517 - 135.3950,       // TEI ignition 135:23:42 to entry interface 195:03:06
  parkingKm: (100.4 + 98.9) / 2 * 1.852, // the parking orbit, n mi to km, SP-4029
};
const ENTRY_KM = 122; // the top of the atmosphere, 400,000 ft
/** where the free-return path would pass the Earth with no air: low enough to be caught by the atmosphere */
const FREE_RETURN_PERIGEE_KM = 40;

/** A path for the map: times from its own start (s), Earth-centred rotating frame (km, Moon at (D, 0)), speed (km/s). */
export interface Path { t: number[]; x: number[]; y: number[]; v: number[] }
export interface Trip {
  outbound: Path; freeReturnHome: Path; homebound: Path;
  meta: {
    method: string;
    injectionAltKm: number; injectionPhaseDeg: number; injectionSpeed: number; parkingSpeed: number;
    periluneKm: number; outboundCoastH: number; minSpeedOut: number;
    moonArrivalSpeed: number; lunarOrbitSpeed: number; loiDv: number;
    freeReturnPerigeeKm: number; freeReturnCoastH: number; freeReturnEntryAngle: number;
    teiDv: number; homeCoastH: number; entryAngle: number; entrySpeed: number;
  };
}

/** Bisect f between a and b, where f(a) and f(b) differ in sign (or in the test). */
function bisect(a: number, b: number, below: (x: number) => boolean, n = 60) {
  const ba = below(a);
  for (let i = 0; i < n; i++) { const m = (a + b) / 2; if (below(m) === ba) a = m; else b = m; }
  return (a + b) / 2;
}

const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/** Sample states for the map: every 10 minutes, every 30 s near either body. */
function sample(states: State[], until = states.length - 1): Path {
  const p: Path = { t: [], x: [], y: [], v: [] }; let next = -Infinity;
  const t0 = states[0].t;
  for (let i = 0; i <= until; i++) {
    const s = states[i], near = rEarth(s) < 40000 || rMoon(s) < 25000;
    if (s.t >= next || i === until) {
      const [x, y] = toRotating(s);
      p.t.push(round(s.t - t0, 0)); p.x.push(round(x, 0)); p.y.push(round(y, 0)); p.v.push(round(speed(s), 3));
      next = s.t + (near ? 30 : 600);
    }
  }
  return p;
}
/** Speed relative to the Moon. */
function moonSpeed(s: State) { return Math.hypot(s.vx + D * W_MOON * Math.sin(W_MOON * s.t), s.vy - D * W_MOON * Math.cos(W_MOON * s.t)); }

export function solveTrip(): Trip {
  const v = APOLLO.injectionSpeed;
  // the phase that takes the ship round the Moon's far side at 111 km: just past the phases that hit the Moon
  const phaseFor = (h: number) => {
    let lo = 0, hi = 0;
    for (let d = 224; d < 232; d += 0.05) { const o = flyOutbound(h, v, d * Math.PI / 180); if (o.perilune < 0) lo = d; else if (lo && o.perilune > APOLLO.periluneKm) { hi = d; break; } }
    if (!lo || !hi) throw new Error(`no far-side pass at ${h} km`);
    return bisect(lo * Math.PI / 180, hi * Math.PI / 180, (p) => flyOutbound(h, v, p).perilune < APOLLO.periluneKm, 45);
  };
  // the altitude at the end of the burn that makes the do-nothing path come home grazing the atmosphere
  const h = bisect(344, 352, (x) => flyOutbound(x, v, phaseFor(x)).returnPerigee < FREE_RETURN_PERIGEE_KM, 30);
  const phase = phaseFor(h);
  const o = flyOutbound(h, v, phase);
  const peri = o.states[o.periIdx], sense = senseAroundMoon(peri);
  // the free return: on past the Moon, back to the top of the atmosphere
  let entryIdx = o.states.length - 1;
  for (let i = o.periIdx; i < o.states.length; i++) if (rEarth(o.states[i]) < R_E + ENTRY_KM) { entryIdx = i; break; }
  const fre = o.states[entryIdx];
  const freAngle = Math.asin((fre.x * fre.vx + fre.y * fre.vy) / (rEarth(fre) * speed(fre))) * 180 / Math.PI;

  // the trip home: from a circular lunar orbit at 111 km, the burn size sets the coast time, its point sets the entry angle
  const tTei = peri.t + 59.6 * 3600;
  const hit = (deg: number, dv: number) => { const r = flyHome(leaveMoon(tTei, APOLLO.periluneKm, deg * Math.PI / 180, sense, dv)); return r.reached ? r : null; };
  const angleFor = (dv: number) => {
    // scan for a steep hit followed by a miss, then bisect to the published entry angle
    for (let deg = -60; deg < 60; deg += 1) {
      if (hit(deg, dv) && !hit(deg + 1, dv)) return bisect(deg, deg + 1, (a) => { const r = hit(a, dv); return !!r && r.entryAngle < APOLLO.entryAngle; });
    }
    throw new Error(`no trans-Earth solution for dv ${dv}`);
  };
  const coastFor = (dv: number) => { const r = hit(angleFor(dv), dv)!; return (r.states[r.entryIdx].t - tTei) / 3600; };
  const dv = bisect(1.12, 1.22, (d) => coastFor(d) > APOLLO.homeCoastH, 30);
  const home = flyHome(leaveMoon(tTei, APOLLO.periluneKm, angleFor(dv) * Math.PI / 180, sense, dv));
  const entry = home.states[home.entryIdx];

  let minOut = Infinity; for (let i = 0; i <= o.periIdx; i++) minOut = Math.min(minOut, speed(o.states[i]));
  const vOrbit = Math.sqrt(MU_M / (R_M + APOLLO.periluneKm));
  void moonAt;
  return {
    outbound: sample(o.states, o.periIdx),
    freeReturnHome: sample(o.states.slice(o.periIdx, entryIdx + 1)),
    homebound: sample(home.states),
    meta: {
      method: 'Planar restricted three-body model (Earth and Moon, Moon on a circular orbit), RK4, solved to Apollo 11 figures. Not GMAT.',
      injectionAltKm: round(h, 2), injectionPhaseDeg: round(phase * 180 / Math.PI, 4), injectionSpeed: round(v, 4),
      parkingSpeed: round(Math.sqrt(398600.4418 / (R_E + APOLLO.parkingKm)), 3),
      periluneKm: round(rMoon(peri) - R_M), outboundCoastH: round(peri.t / 3600, 2), minSpeedOut: round(minOut, 3),
      moonArrivalSpeed: round(moonSpeed(peri), 3), lunarOrbitSpeed: round(vOrbit, 3), loiDv: round(moonSpeed(peri) - vOrbit, 3),
      freeReturnPerigeeKm: round(o.returnPerigee), freeReturnCoastH: round((fre.t - peri.t) / 3600, 2), freeReturnEntryAngle: round(freAngle, 2),
      teiDv: round(dv, 3), homeCoastH: round((entry.t - tTei) / 3600, 2), entryAngle: round(home.entryAngle, 2), entrySpeed: round(speed(entry), 3),
    },
  };
}
