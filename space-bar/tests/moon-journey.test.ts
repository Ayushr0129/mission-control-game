import { describe, expect, it } from 'vitest';
import { BODIES } from '../src/domain/sim/bodies';
import { assessReentry, beginDescent, createMoonJourney, executeLoi, executeTei, executeTli, launchFromMoon, planTransLunarInjection, recordLanding } from '../src/domain/sim/moonJourney';

describe('Stage E Moon journey', () => {
  it('derives TLI from the parking orbit and Moon orbit instead of a scripted checkpoint', () => {
    const plan = planTransLunarInjection(200_000);
    expect(plan.departureDeltaVMps).toBeGreaterThan(3000);
    expect(plan.departureDeltaVMps).toBeLessThan(3300);
    expect(plan.transferTimeS).toBeGreaterThan(0);
  });
  it('spends real delta-v and fails a TLI shortfall', () => {
    expect(executeTli(createMoonJourney(200_000, 4000)).phase).toBe('trans-lunar');
    expect(executeTli(createMoonJourney(200_000, 100)).phase).toBe('failed');
  });
  it('runs the lunar surface and return state chain without scripted success', () => {
    const approach = { ...createMoonJourney(200_000, 5000), phase: 'lunar-approach' as const, frame: 'moon' as const, vessel: { positionM: { x: BODIES.moon.radiusM + 100_000, y: 0, z: 0 }, velocityMps: { x: 0, y: 1800, z: 0 } } };
    const orbit = executeLoi(approach), descent = beginDescent(orbit), surface = recordLanding(descent, true), ascent = launchFromMoon(surface, 1800), home = executeTei(ascent, 1000);
    expect([orbit.phase, descent.phase, surface.phase, ascent.phase, home.phase]).toEqual(['lunar-orbit', 'descent', 'surface', 'ascent', 'trans-earth']);
  });
  it('classifies shallow, safe and steep entry using an explicit sourced corridor supplied by the mission', () => {
    const corridor = { shallowRad: -0.08, steepRad: -0.13 };
    expect(assessReentry(-0.05, corridor)).toBe('skip-out');
    expect(assessReentry(-0.1, corridor)).toBe('safe');
    expect(assessReentry(-0.16, corridor)).toBe('overload');
  });
});
