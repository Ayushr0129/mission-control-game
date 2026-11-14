import { describe, it, expect } from 'vitest';
import { content } from '../src/data';
import { computeTotals } from '../src/sim/simulate';
import { Controls, Decisions } from '../src/sim/types';
import { ORBIT, orbitSetup, startOrbit, stepOrbit, orbitOver, gradeOrbit, orbitPilot, flyOrbit, inBand, offBackwards } from '../src/sim/orbit';

const { chapter, questions, conflicts } = content;
const totalsOf = (d: Decisions) => computeTotals(chapter, questions, conflicts, d);
const BASIC: Decisions = {
  'mgr-funding': 'modest', 'mgr-schedule': 'steady', 'eng-cabin': 'fix', 'nav-route': 'lor', 'eng-docking': 'basic',
  'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave',
};
const setup = (d: Decisions = BASIC) => orbitSetup(chapter, totalsOf(d), []);
const off: Controls = { turn: 0, engine: false, throttle: 1 }, burn: Controls = { turn: 0, engine: true, throttle: 1 };

describe('the burn into Moon orbit', () => {
  it('arrives nose first, too fast, with a band to aim for', () => {
    const s = setup(), o = startOrbit(s);
    expect(o.speed).toBeGreaterThan(s.hi); expect(o.angle).toBe(0); expect(Math.abs(offBackwards(o))).toBeCloseTo(Math.PI, 5);
    expect(s.hi - s.lo).toBeGreaterThan(60);
  });
  it('a riskier build narrows the band', () => {
    const risky = orbitSetup(chapter, totalsOf({ ...BASIC, 'mgr-schedule': 'rush', 'eng-cabin': 'test' }), []);
    expect(risky.hi - risky.lo).toBeLessThan(setup().hi - setup().lo);
  });
  it('burning backwards slows the ship; burning nose first speeds it up', () => {
    const s = setup();
    expect(stepOrbit({ ...startOrbit(s), angle: Math.PI }, burn, 0.1, s).speed).toBeCloseTo(s.speed0 - s.decel * 0.1, 3);
    expect(stepOrbit(startOrbit(s), burn, 0.1, s).speed).toBeCloseTo(s.speed0 + s.decel * 0.1, 3);
    expect(stepOrbit({ ...startOrbit(s), angle: Math.PI / 2 }, burn, 0.1, s).speed).toBeCloseTo(s.speed0, 0); // sideways does nothing
  });
  it('settles onto backwards when the turn keys are let go close to it', () => {
    const s = setup(); let o = { ...startOrbit(s), angle: Math.PI - 0.2 };
    for (let i = 0; i < 20; i++) o = stepOrbit(o, off, 0.05, s);
    expect(Math.abs(offBackwards(o))).toBeLessThan(0.01);
  });
  it('guidance turns round, burns and stops inside the band: clean, with time to spare', () => {
    const s = setup(), o = flyOrbit(s, orbitPilot);
    expect(inBand(o, s)).toBe(true); expect(gradeOrbit(o, s)).toBe('clean'); expect(o.t).toBeLessThan(s.window * 0.7);
  });
  it('a player on full throttle who lets go a little late is still clean or fair', () => {
    const s = setup(); let late = 0;
    const hand = (o: any): Controls => {
      const aligned = Math.abs(offBackwards(o)) < 0.2;
      if (!aligned) return { turn: 1, engine: false, throttle: 1 };
      if (o.speed > s.hi) return burn;
      if (late < 0.15) { late += ORBIT.dt; return burn; } // slow to let go
      return off;
    };
    expect(['clean', 'fair']).toContain(gradeOrbit(flyOrbit(s, hand), s));
  });
  it('overshooting far below the band is rough', () => {
    const s = setup();
    const o = flyOrbit(s, (x) => (Math.abs(offBackwards(x)) < 0.2 ? burn : { turn: 1, engine: false, throttle: 1 }));
    expect(o.speed).toBeLessThan(s.lo - (s.hi - s.lo)); expect(gradeOrbit(o, s)).toBe('rough');
  });
  it('never touching anything: the ship burns by itself, late, and that is rough', () => {
    const s = setup(), o = flyOrbit(s, () => off);
    expect(o.self).toBe(true); expect(inBand(o, s)).toBe(true); expect(gradeOrbit(o, s)).toBe('rough');
  });
  it('the moment ends when the window closes, or once the ship sits in the band with the engine off', () => {
    const s = setup();
    expect(orbitOver({ ...startOrbit(s), t: s.window }, s)).toBe(true);
    expect(orbitOver({ ...startOrbit(s), quiet: ORBIT.settle }, s)).toBe(true);
    expect(orbitOver(startOrbit(s), s)).toBe(false);
  });
  it('a frozen tab loses time, not the burn; and it is the same every time', () => {
    const s = setup(), o = { ...startOrbit(s), angle: Math.PI };
    expect(stepOrbit(o, burn, 5, s)).toEqual(stepOrbit(o, burn, ORBIT.maxElapsed, s));
    expect(flyOrbit(s, orbitPilot)).toEqual(flyOrbit(s, orbitPilot));
  });
});
