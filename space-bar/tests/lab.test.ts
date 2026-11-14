import { describe, expect, it } from 'vitest';
import { baselineFor, marginCredit, profiles, readinessOf, scoreMission, starter, sumsOf } from '../src/lab/catalog';

describe('mission lab baselines', () => {
  for (const p of profiles) {
    it(`${p.name}: the engineering baseline is ready to fly`, () => {
      expect(readinessOf(p, baselineFor(p))).toEqual([]);
    });
  }
  it('the bare starter stack is held for its missing payload', () => {
    const moon = profiles.find((p) => p.id === 'moon')!;
    expect(readinessOf(moon, starter)).toContain('satellite payload');
  });
  it('Saturn gets the deep-space parts and keeps a positive power margin', () => {
    const saturn = profiles.find((p) => p.id === 'saturn')!, ids = baselineFor(saturn);
    expect(ids).toEqual(expect.arrayContaining(['kick', 'ion', 'reactor']));
    expect(sumsOf(ids).power).toBeGreaterThanOrEqual(saturn.powerNeed);
  });
});

describe('mission score', () => {
  const moon = profiles.find((p) => p.id === 'moon')!;
  const base = baselineFor(moon);
  const part = (s: ReturnType<typeof scoreMission>, id: string) => s.parts.find((x) => x.id === id)!.points;
  const orbit = (left: number, guided = false) => ({ orbit: true, left, guided });

  it('a ready vehicle that never flew is far from a perfect score', () => {
    const s = scoreMission(moon, base, null, null, false);
    expect(part(s, 'vehicle')).toBe(20);
    expect(part(s, 'launch')).toBe(0);
    expect(part(s, 'docking')).toBe(0);
    expect(part(s, 'payload')).toBe(0);
    expect(s.total).toBeLessThan(40);
  });
  it('launching, docking and deploying the payload each add to the score', () => {
    const idle = scoreMission(moon, base, null, null, false).total;
    const launched = scoreMission(moon, base, orbit(4), null, false).total;
    const docked = scoreMission(moon, base, orbit(4), { fuel: 80, guided: false }, false).total;
    const done = scoreMission(moon, base, orbit(4), { fuel: 80, guided: false }, true).total;
    expect(launched).toBeGreaterThan(idle);
    expect(docked).toBeGreaterThan(launched);
    expect(done).toBe(docked + 20);
  });
  it('an orbit without enough delta-v for the journey earns little', () => {
    expect(part(scoreMission(moon, base, orbit(moon.transferNeed - 0.5), null, false), 'launch')).toBe(5);
    expect(part(scoreMission(moon, base, { orbit: false, left: 6, guided: false }, null, false), 'launch')).toBe(0);
  });
  it('flying it yourself is worth more than the autopilot or the guided approach', () => {
    const manual = scoreMission(moon, base, orbit(4), { fuel: 50, guided: false }, true);
    const guided = scoreMission(moon, base, orbit(4, true), { fuel: 50, guided: true }, true);
    expect(part(manual, 'launch')).toBeGreaterThan(part(guided, 'launch'));
    expect(part(manual, 'docking')).toBeGreaterThan(part(guided, 'docking'));
    expect(part(guided, 'launch')).toBeLessThanOrEqual(15);
    expect(part(guided, 'docking')).toBeLessThanOrEqual(12);
  });
  it('each unresolved issue costs vehicle points', () => {
    expect(part(scoreMission(moon, base.filter((id) => id !== 'sat'), null, null, false), 'vehicle')).toBe(13); // missing the payload
    expect(part(scoreMission(moon, [], null, null, false), 'vehicle')).toBe(0);
  });
  it('margins reward healthy headroom over running at the limit or overbuilding', () => {
    expect(marginCredit(-0.1)).toBe(0);
    expect(marginCredit(0)).toBe(0.5);
    expect(marginCredit(0.15)).toBe(1);
    expect(marginCredit(0.8)).toBeLessThan(1);
    expect(marginCredit(5)).toBeCloseTo(0.2);
  });
  it('every mission can reach a high score with its baseline, and never more than 100', () => {
    for (const p of profiles) {
      const s = scoreMission(p, baselineFor(p), orbit(p.transferNeed + 1), { fuel: 100, guided: false }, true).total;
      expect(s).toBeGreaterThanOrEqual(90);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});
