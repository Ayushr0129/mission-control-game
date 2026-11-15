import { describe, it, expect } from 'vitest';
import { Controls } from '../src/sim/types';
import { CORRIDOR, corridorSetup, startCorridor, stepCorridor, corridorOk, corridorPilot, flyCorridor, corridorIn, corridorAim } from '../src/sim/corridor';
import trip from '../src/data/trajectory.json';

const off: Controls = { turn: 0, engine: false, throttle: 1 };

describe('the entry corridor', () => {
  it('is two degrees wide around Apollo 11\'s -6.48°', () => {
    expect(CORRIDOR.hi - CORRIDOR.lo).toBe(2);
    expect(-6.48).toBeGreaterThan(CORRIDOR.lo); expect(-6.48).toBeLessThan(CORRIDOR.hi);
  });
  it('starts outside the band after a trans-Earth burn, further out the worse the burn', () => {
    const c = (m: 'clean' | 'fair' | 'rough', steep: boolean) => corridorSetup({ tei: m, steep }).start;
    expect(c('clean', true)).toBeLessThan(CORRIDOR.lo); expect(c('rough', true)).toBeLessThan(c('clean', true));
    expect(c('clean', false)).toBeGreaterThan(CORRIDOR.hi); expect(c('rough', false)).toBeGreaterThan(c('clean', false));
  });
  it('on the free return it starts inside, because the free-return path was aimed at the corridor', () => {
    const s = corridorSetup({ freeReturn: trip.meta.freeReturnEntryAngle });
    expect(corridorIn(startCorridor(s), s)).toBe(true);
    expect(corridorOk(flyCorridor(s, () => off), s)).toBe(true);
  });
  it('the arrow points up when too steep and down when too shallow; nose up makes it shallower', () => {
    const steep = corridorSetup({ tei: 'fair', steep: true }), c = startCorridor(steep);
    expect(corridorAim(c, steep)).toBeCloseTo(Math.PI / 2, 5);
    const up = stepCorridor({ ...c, ship: Math.PI / 2 }, { turn: 0, engine: true, throttle: 1 }, 0.1, steep);
    expect(up.angle).toBeGreaterThan(c.angle);
    const shallow = corridorSetup({ tei: 'fair', steep: false });
    expect(corridorAim(startCorridor(shallow), shallow)).toBeCloseTo(-Math.PI / 2, 5);
  });
  it('guidance brings every start into the band', () => {
    for (const m of ['clean', 'fair', 'rough'] as const) for (const steep of [true, false]) {
      const s = corridorSetup({ tei: m, steep }); expect(corridorOk(flyCorridor(s, corridorPilot), s), `${m} ${steep}`).toBe(true);
    }
  });
  it('left alone, guidance makes the correction late, and the crew is safe', () => {
    for (const steep of [true, false]) {
      const s = corridorSetup({ tei: 'rough', steep }), c = flyCorridor(s, () => off);
      expect(c.self).toBe(true); expect(corridorOk(c, s)).toBe(true);
    }
  });
  it('burned the wrong way and let go: the crew is lost', () => {
    const s = corridorSetup({ tei: 'clean', steep: true });
    let held = 0;
    const wrong = (c: any): Controls => { const toDown = -Math.PI / 2 - c.ship; if (Math.abs(toDown) > 0.1) return { turn: toDown > 0 ? 1 : -1, engine: false, throttle: 1 }; if (held < 1.5) { held += CORRIDOR.dt; return { turn: 0, engine: true, throttle: 1 }; } return off; };
    const c = flyCorridor(s, wrong);
    expect(c.self).toBe(false); expect(corridorOk(c, s)).toBe(false); expect(c.angle).toBeLessThan(s.start);
  });
  it('a frozen tab loses time, not the correction', () => {
    const s = corridorSetup({ tei: 'fair', steep: true }), c = { ...startCorridor(s), ship: Math.PI / 2 };
    expect(stepCorridor(c, { turn: 0, engine: true, throttle: 1 }, 5, s)).toEqual(stepCorridor(c, { turn: 0, engine: true, throttle: 1 }, CORRIDOR.maxElapsed, s));
  });
});
