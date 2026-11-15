import { describe, it, expect } from 'vitest';
import { content } from '../src/data';
import { computeTotals } from '../src/sim/simulate';
import { Controls, Decisions } from '../src/sim/types';
import { ORBIT, BurnId, burnSetup, startOrbit, stepOrbit, orbitOver, gradeOrbit, orbitPilot, flyOrbit, inBand, offTarget } from '../src/sim/orbit';
import trip from '../src/data/trajectory.json';

const { chapter, questions, conflicts } = content;
const totalsOf = (d: Decisions) => computeTotals(chapter, questions, conflicts, d);
const BASIC: Decisions = {
  'mgr-funding': 'modest', 'mgr-schedule': 'steady', 'eng-cabin': 'fix', 'nav-route': 'lor', 'eng-docking': 'basic',
  'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave',
};
const setup = (id: BurnId, d: Decisions = BASIC) => burnSetup(id, chapter, totalsOf(d), []);
const off: Controls = { turn: 0, engine: false, throttle: 1 }, burn: Controls = { turn: 0, engine: true, throttle: 1 };
function* everyBuild(i = 0, cur: Decisions = {}): Generator<Decisions> {
  const qs = questions.filter((q) => q.kind !== 'flight');
  if (i === qs.length) { yield { ...cur }; return; }
  for (const o of qs[i].options) { cur[qs[i].id] = o.id; yield* everyBuild(i + 1, cur); }
}

describe('the speed burns use real speeds', () => {
  it('trans-lunar injection: from Earth-orbit speed up to NASA\'s 10.84 km/s', () => {
    const s = setup('tli');
    expect(s.speed0).toBeCloseTo(7.79, 2); expect(s.target).toBeCloseTo(10.841, 3); expect(s.dir).toBe('prograde');
    expect(s.lo).toBeLessThan(10.841); expect(s.hi).toBeGreaterThan(10.841);
  });
  it('lunar orbit insertion: from the arrival speed down to lunar-orbit speed', () => {
    const s = setup('loi');
    expect(s.speed0).toBeCloseTo(trip.meta.moonArrivalSpeed, 3); expect(s.target).toBeCloseTo(1.629, 3); expect(s.dir).toBe('retrograde');
  });
  it('trans-Earth injection: from lunar-orbit speed up by the computed burn', () => {
    const s = setup('tei');
    expect(s.target - s.speed0).toBeCloseTo(trip.meta.teiDv, 3); expect(s.dir).toBe('prograde');
  });
  it('a riskier build narrows every band', () => {
    const risky = { ...BASIC, 'mgr-schedule': 'rush', 'eng-cabin': 'test' };
    for (const id of ['tli', 'loi', 'tei'] as BurnId[]) expect(setup(id, risky).hi - setup(id, risky).lo).toBeLessThan(setup(id).hi - setup(id).lo);
  });
});

describe('flying a burn', () => {
  it('pointing the way the arrow says changes the speed the right way; pointing the other way does the opposite', () => {
    for (const id of ['tli', 'loi', 'tei'] as BurnId[]) {
      const s = setup(id), aim = s.dir === 'prograde' ? 0 : Math.PI;
      const good = stepOrbit({ ...startOrbit(s), angle: aim }, burn, 0.1, s), bad = stepOrbit({ ...startOrbit(s), angle: aim + Math.PI }, burn, 0.1, s);
      const toward = Math.sign(s.target - s.speed0);
      expect(Math.sign(good.speed - s.speed0)).toBe(toward); expect(Math.sign(bad.speed - s.speed0)).toBe(-toward);
      expect(Math.abs(good.speed - s.speed0)).toBeCloseTo(s.rate * 0.1, 4);
    }
  });
  it('guidance is clean on every burn for every rocket that can fly', () => {
    for (const d of everyBuild()) {
      const t = totalsOf(d); if (t.mass > t.capacity) continue;
      for (const id of ['tli', 'loi', 'tei'] as BurnId[]) {
        const s = burnSetup(id, chapter, t, []), o = flyOrbit(s, orbitPilot);
        if (gradeOrbit(o, s) !== 'clean') throw new Error(`${id} ${o.speed} not in ${s.lo}-${s.hi}: ${JSON.stringify(d)}`);
      }
    }
  });
  it('a player on full throttle who lets go a moment late is still clean or fair', () => {
    for (const id of ['tli', 'loi', 'tei'] as BurnId[]) {
      const s = setup(id); let late = 0;
      const hand = (o: any): Controls => {
        if (Math.abs(offTarget(o, s)) > 0.2) return { turn: offTarget(o, s) > 0 ? 1 : -1, engine: false, throttle: 1 };
        const short = s.dir === 'prograde' ? o.speed < s.lo : o.speed > s.hi;
        if (short) return burn;
        if (late < 0.15) { late += ORBIT.dt; return burn; }
        return off;
      };
      expect(['clean', 'fair'], id).toContain(gradeOrbit(flyOrbit(s, hand), s));
    }
  });
  it('never touching anything: the ship burns by itself, late, and that is rough', () => {
    for (const id of ['tli', 'tei'] as BurnId[]) {
      const s = setup(id), o = flyOrbit(s, () => off);
      expect(o.self).toBe(true); expect(inBand(o, s)).toBe(true); expect(gradeOrbit(o, s)).toBe('rough');
    }
  });
  it('never touching the Moon-orbit burn: no burn at all, so the free return takes the ship home', () => {
    const s = setup('loi'), o = flyOrbit(s, () => off);
    expect(s.idleSelf).toBe(false);
    expect(o.self).toBe(false); expect(o.burnt).toBe(0); expect(o.speed).toBe(s.speed0); expect(o.t).toBeGreaterThanOrEqual(s.window);
  });
  it('the moment ends when the window closes, or once the ship sits in the band with the engine off', () => {
    const s = setup('loi');
    expect(orbitOver({ ...startOrbit(s), t: s.window }, s)).toBe(true);
    expect(orbitOver({ ...startOrbit(s), quiet: ORBIT.settle }, s)).toBe(true);
    expect(orbitOver(startOrbit(s), s)).toBe(false);
  });
  it('a frozen tab loses time, not the burn; and it is the same every time', () => {
    const s = setup('loi'), o = { ...startOrbit(s), angle: Math.PI };
    expect(stepOrbit(o, burn, 5, s)).toEqual(stepOrbit(o, burn, ORBIT.maxElapsed, s));
    expect(flyOrbit(s, orbitPilot)).toEqual(flyOrbit(s, orbitPilot));
  });
});
