/**
 * Rocket physics for the Mission Lab: how a stack of parts becomes stages, and what each stage can do.
 * No DOM in here, so the rules can be tested.
 *
 * Staging rule, bottom of the stack first: every engine starts a stage. A tank feeds the nearest chemical
 * engine below it; a tank with no such engine below it is dead weight. Booster and kick stage carry their own
 * propellant, the ion drive carries its own xenon and cannot use the cryogenic tanks. When a stage runs dry it is
 * dropped with its tanks; the payload fairing goes at the first staging. Everything else rides to the end.
 */
import type { Part } from './catalog';

export const G0 = 9.80665;

export interface Stage {
  engine: Part; tanks: Part[];
  /** tonnes */ prop: number; dry: number;
  /** kN and seconds */ thrust: number; isp: number;
}
export interface StagePerformance extends Stage {
  /** tonnes at ignition and burnout */ m0: number; m1: number;
  /** km/s */ dv: number;
  /** thrust-to-weight at ignition, in Earth gravity */ twr: number;
  /** seconds at full throttle */ burn: number;
}
export interface Performance {
  mass: number; stages: StagePerformance[]; deltaV: number; liftoffTwr: number;
  /** tanks that no chemical engine below them can draw from */
  idleTanks: Part[];
}

const dryOf = (p: Part) => p.mass - (p.prop ?? 0);

export function stagesOf(stack: Part[]): { stages: Stage[]; idleTanks: Part[] } {
  const stages: Stage[] = [], idleTanks: Part[] = [];
  let feedable: Stage | null = null; // the nearest chemical engine below
  for (const p of stack) {
    if (p.thrust) {
      const s: Stage = { engine: p, tanks: [], prop: p.prop ?? 0, dry: dryOf(p), thrust: p.thrust, isp: p.isp ?? 0 };
      stages.push(s);
      feedable = p.tags.includes('chemical') ? s : null;
    } else if (p.tags.includes('tank')) {
      if (feedable) { feedable.tanks.push(p); feedable.prop += p.prop ?? 0; feedable.dry += dryOf(p); }
      else idleTanks.push(p);
    }
  }
  return { stages, idleTanks };
}

/** Delta-v per stage from the rocket equation, with spent stages and the fairing dropped along the way. */
export function performanceOf(stack: Part[]): Performance {
  const mass = stack.reduce((a, p) => a + p.mass, 0);
  const { stages, idleTanks } = stagesOf(stack);
  let fairing = stack.filter((p) => p.tags.includes('fairing')).reduce((a, p) => a + p.mass, 0);
  let dropped = 0;
  const out = stages.map((s, i): StagePerformance => {
    if (i >= 1 && fairing) { dropped += fairing; fairing = 0; }
    const m0 = mass - dropped, m1 = m0 - s.prop;
    const dv = m1 > 0 && s.prop > 0 ? (s.isp * G0 * Math.log(m0 / m1)) / 1000 : 0;
    dropped += s.prop + s.dry;
    return { ...s, m0, m1, dv, twr: m0 > 0 ? s.thrust / (m0 * G0) : 0, burn: s.thrust > 0 ? (s.prop * 1000 * s.isp * G0) / (s.thrust * 1000) : 0 };
  });
  return { mass, stages: out, deltaV: out.reduce((a, s) => a + s.dv, 0), liftoffTwr: out[0]?.twr ?? 0, idleTanks };
}

/** Solar arrays are rated at 1 AU; sunlight falls with the square of distance from the Sun. */
export const solarScale = (au: number) => 1 / (au * au);
