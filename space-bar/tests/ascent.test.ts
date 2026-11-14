import { describe, it, expect } from 'vitest';
import { content } from '../src/data';
import { computeTotals } from '../src/sim/simulate';
import { Controls, Decisions } from '../src/sim/types';
import { ASCENT, liftoffSetup, guideAngle, startAscent, stepAscent, ascentDone, gradeAscent, ascentPilot, flyAscent, stageDry, thrusting } from '../src/sim/ascent';

const { chapter, questions, conflicts } = content;
const totalsOf = (d: Decisions) => computeTotals(chapter, questions, conflicts, d);
const BASIC: Decisions = {
  'mgr-funding': 'modest', 'mgr-schedule': 'steady', 'eng-cabin': 'fix', 'nav-route': 'lor', 'eng-docking': 'basic',
  'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave',
};
const HEAVY: Decisions = { ...BASIC, 'nav-route': 'direct', 'eng-power': 'extra', 'sci-antenna': 'large' };
const OVER: Decisions = { ...HEAVY, 'sci-instruments': 'full', 'eng-cabin': 'redesign' };
const setup = (d: Decisions = BASIC) => liftoffSetup(chapter, totalsOf(d), []);
function* everyBuild(i = 0, cur: Decisions = {}): Generator<Decisions> {
  const qs = questions.filter((q) => q.kind !== 'flight');
  if (i === qs.length) { yield { ...cur }; return; }
  for (const o of qs[i].options) { cur[qs[i].id] = o.id; yield* everyBuild(i + 1, cur); }
}
const burn: Controls = { turn: 0, engine: true, throttle: 1 }, off: Controls = { turn: 0, engine: false, throttle: 1 };

describe('the climb', () => {
  it('the guide starts straight up and leans over on the way', () => {
    const s = setup();
    expect(guideAngle(s, 0)).toBe(0); expect(guideAngle(s, 20)).toBe(0);
    expect(guideAngle(s, s.targetY / 2)).toBeGreaterThan(0.2);
    expect(guideAngle(s, s.targetY)).toBeCloseTo(ASCENT.lean, 5);
  });
  it('sits on the pad until the engine is held, then rises', () => {
    const s = setup(); let a = startAscent(s);
    a = stepAscent(a, off, 0.1, s); expect(a.y).toBe(0);
    for (let i = 0; i < 20; i++) a = stepAscent(a, burn, 0.1, s);
    expect(a.y).toBeGreaterThan(5); expect(a.fuel1).toBeCloseTo(s.burn1 - 2, 3);
  });
  it('guidance flies a clean climb on every rocket that can fly, and gets there in good time', () => {
    for (const d of everyBuild()) {
      const t = totalsOf(d); if (t.mass > t.capacity) continue;
      const s = liftoffSetup(chapter, t, []); const a = flyAscent(s, ascentPilot);
      if (!ascentDone(a, s) || a.t > 40 || gradeAscent(a, s) !== 'clean') throw new Error(`t ${a.t.toFixed(1)} y ${a.y.toFixed(0)} grade ${gradeAscent(a, s)} dry ${a.dry.toFixed(2)}: ${JSON.stringify(d)}`);
    }
  });
  it('a heavier rocket climbs more slowly', () => {
    expect(setup(HEAVY).twr).toBeLessThan(setup(BASIC).twr);
    expect(flyAscent(setup(HEAVY), ascentPilot).t).toBeGreaterThan(flyAscent(setup(BASIC), ascentPilot).t);
  });
  it('a rocket over the mass limit never leaves the pad', () => {
    const t = totalsOf(OVER); expect(t.mass).toBeGreaterThan(t.capacity);
    const s = setup(OVER); expect(s.twr).toBeLessThan(1);
    let a = startAscent(s); for (let i = 0; i < 200; i++) a = stepAscent(a, burn, 0.1, s);
    expect(a.y).toBe(0);
  });
  it('the first stage runs dry, and a fresh press of the engine drops it', () => {
    const s = setup(); let a = startAscent(s);
    while (!stageDry(a)) a = stepAscent(a, burn, 0.1, s);
    expect(thrusting(a, burn)).toBe(0);
    a = stepAscent(a, burn, 0.1, s); expect(a.stage).toBe(1);   // still holding: nothing happens
    a = stepAscent(a, off, 0.05, s); expect(a.armed).toBe(true);
    a = stepAscent(a, burn, 0.05, s); expect(a.stage).toBe(2); expect(thrusting(a, burn)).toBe(1);
  });
  it('a frozen tab loses time, not the rocket', () => {
    const s = setup(); const a = stepAscent(startAscent(s), burn, 0.1, s);
    expect(stepAscent(a, burn, 5, s)).toEqual(stepAscent(a, burn, ASCENT.maxElapsed, s));
  });
});

describe('grading the liftoff', () => {
  const heldOnly = (a: any, s: any): Controls => ({ turn: 0, engine: stageDry(a) ? a.armed : true, throttle: 1 });
  it('holding the engine and letting the rocket settle on the arrow is clean or fair, never rough', () => {
    const s = setup(); const a = flyAscent(s, heldOnly);
    expect(ascentDone(a, s)).toBe(true); expect(['clean', 'fair']).toContain(gradeAscent(a, s));
  });
  it('fighting the arrow is not clean', () => {
    const s = setup();
    const wild = (a: any): Controls => ({ turn: a.y > 60 && a.y < 420 ? -1 : 0, engine: stageDry(a) ? a.armed : true, throttle: 1 });
    expect(gradeAscent(flyAscent(s, wild), s)).not.toBe('clean');
  });
  it('a late relight costs the clean mark', () => {
    const s = setup(); let waited = 0;
    const slow = (a: any, ss: any): Controls => { if (stageDry(a) && waited < 2.5) { waited += ASCENT.dt; return off; } return ascentPilot(a, ss); };
    const a = flyAscent(s, slow);
    expect(a.dry).toBeGreaterThan(2); expect(gradeAscent(a, s)).toBe('fair');
  });
  it('never touching anything hands over to guidance, which still reaches space: a rough liftoff', () => {
    const s = setup(); const a = flyAscent(s, () => off);
    expect(a.guided).toBe(true); expect(ascentDone(a, s)).toBe(true); expect(gradeAscent(a, s)).toBe('rough');
  });
  it('holding the engine forever without relighting also hands over', () => {
    const s = setup(); const a = flyAscent(s, () => burn);
    expect(a.guided).toBe(true); expect(ascentDone(a, s)).toBe(true);
  });
  it('tipping right over near the ground hands over', () => {
    const s = setup();
    const a = flyAscent(s, (x) => ({ turn: x.y > 6 ? 1 : 0, engine: true, throttle: 1 }));
    expect(a.guided).toBe(true); expect(ascentDone(a, s)).toBe(true);
  });
  it('is the same every time', () => {
    expect(flyAscent(setup(), ascentPilot)).toEqual(flyAscent(setup(), ascentPilot));
  });
});
