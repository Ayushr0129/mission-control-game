import { describe, expect, it } from 'vitest';
import { baselineFor, parts, partsOf, profiles, readinessOf, sumsOf } from '../src/lab/catalog';
import { G0, performanceOf, solarScale, stagesOf } from '../src/lab/physics';
import { EARTH, ORBIT, flyLaunch, launchSetupOf, orbitOf, remainingDv, startLaunch, stepLaunch } from '../src/lab/launch';

const part = (id: string) => parts.find((p) => p.id === id)!;

describe('staging', () => {
  it('a tank feeds the nearest chemical engine below it', () => {
    const { stages, idleTanks } = stagesOf(partsOf(['booster', 'vac', 'tank', 'tank', 'sat']));
    expect(stages.map((s) => s.engine.id)).toEqual(['booster', 'vac']);
    expect(stages[1].tanks).toHaveLength(2);
    expect(stages[1].prop).toBeCloseTo(2 * part('tank').prop!);
    expect(idleTanks).toEqual([]);
  });
  it('a tank with no engine below it is dead weight', () => {
    const { stages, idleTanks } = stagesOf(partsOf(['tank', 'booster']));
    expect(idleTanks).toHaveLength(1);
    expect(stages[0].prop).toBe(part('booster').prop);
  });
  it('the ion drive cannot burn cryogenic propellant', () => {
    const { stages, idleTanks } = stagesOf(partsOf(['booster', 'ion', 'tank']));
    expect(stages[1].tanks).toEqual([]);
    expect(idleTanks).toHaveLength(1);
  });
});

describe('rocket equation', () => {
  it('a single stage follows Tsiolkovsky', () => {
    const stack = partsOf(['booster', 'sat']), b = part('booster'), m0 = b.mass + part('sat').mass;
    expect(performanceOf(stack).deltaV).toBeCloseTo((b.isp! * G0 * Math.log(m0 / (m0 - b.prop!))) / 1000, 6);
  });
  it('dropping the spent stage and the fairing raises the upper stage delta-v', () => {
    const withFairing = performanceOf(partsOf(['booster', 'vac', 'tank', 'sat', 'fairing']));
    const upperM0 = withFairing.mass - part('booster').mass - part('fairing').mass;
    expect(withFairing.stages[1].m0).toBeCloseTo(upperM0, 6);
  });
  it('stack order matters: tanks above the payload still feed the engine, tanks below the booster do not', () => {
    const good = performanceOf(partsOf(['booster', 'vac', 'tank', 'sat'])).deltaV;
    const bad = performanceOf(partsOf(['tank', 'booster', 'vac', 'sat'])).deltaV;
    expect(bad).toBeLessThan(good);
  });
  it('liftoff thrust-to-weight comes from the first stage', () => {
    const perf = performanceOf(partsOf(['booster', 'sat']));
    expect(perf.liftoffTwr).toBeCloseTo(part('booster').thrust! / (perf.mass * G0), 6);
  });
});

describe('power', () => {
  it('solar output falls with the square of distance from the Sun', () => {
    expect(solarScale(1)).toBe(1);
    expect(solarScale(2)).toBe(0.25);
    const ids = ['solar'];
    const earth = profiles.find((p) => p.id === 'earth')!, saturn = profiles.find((p) => p.id === 'saturn')!;
    expect(sumsOf(ids, saturn).power).toBeLessThan(sumsOf(ids, earth).power / 50);
  });
});

describe('launch', () => {
  it('a circular orbit has equal high and low points', () => {
    const r = EARTH.radius + 300_000, v = Math.sqrt(EARTH.mu / r);
    const o = orbitOf({ ...startLaunch(launchSetupOf(partsOf(['booster']))), x: 0, y: r, vx: v, vy: 0 });
    expect(o.apo).toBeCloseTo(300_000, -2);
    expect(o.peri).toBeCloseTo(300_000, -2);
  });
  it('a rocket too heavy for its engines stays on the pad', () => {
    const s = launchSetupOf(partsOf(['booster', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank', 'tank']));
    let f = startLaunch(s);
    for (let i = 0; i < 20; i++) f = stepLaunch(f, { throttle: 1, pitch: 0 }, 1, s);
    expect(f.status).toBe('pad');
    expect(f.y).toBe(EARTH.radius);
  });
  it('a rocket that burns straight up and runs dry comes back down', () => {
    const s = launchSetupOf(partsOf(['booster', 'sat']));
    let f = startLaunch(s);
    while (f.status === 'pad' || f.status === 'flying') f = stepLaunch(f, { throttle: 1, pitch: 0 }, 2, s);
    expect(f.status === 'spent' || f.status === 'crashed').toBe(true);
  });
});

describe('every mission baseline', () => {
  for (const p of profiles) {
    it(`${p.name}: ready, reaches orbit under the autopilot, and keeps enough delta-v for the journey`, () => {
      const ids = baselineFor(p);
      expect(readinessOf(p, ids)).toEqual([]);
      const s = launchSetupOf(partsOf(ids)), f = flyLaunch(s);
      expect(f.status).toBe('orbit');
      expect(orbitOf(f).peri).toBeGreaterThanOrEqual(ORBIT.minPeri);
      expect(remainingDv(f, s)).toBeGreaterThanOrEqual(p.transferNeed);
    });
  }
});
