import { describe, expect, it } from 'vitest';
import { ROCKET_PRESETS } from '../src/data/rockets';
import { createFlight, setControl, setWarp, stepFlight, trainingManeuver } from '../src/domain/sim/flight';

describe('flight session', () => {
  it('creates a serializable deterministic session', () => {
    const flight = createFlight(ROCKET_PRESETS[0], 1969);
    expect(JSON.parse(JSON.stringify(flight))).toEqual(flight);
    expect(createFlight(ROCKET_PRESETS[0], 1969)).toEqual(flight);
  });
  it('holds the rocket on the pad and limits unsafe time warp', () => {
    const flight = createFlight(ROCKET_PRESETS[0]);
    expect(setWarp(flight, 1000).warp).toBe(1);
    expect(stepFlight(flight, .1).state.failed).toBe(false);
  });
  it('moves forward into ascent and creates maneuver nodes', () => {
    const flight = setControl(createFlight(ROCKET_PRESETS[0]), { throttle: 1 });
    expect(stepFlight(flight, .04).state.phase).toBe('ascent');
    expect(trainingManeuver(flight, 'tli').maneuvers[0].label).toBe('Trans Lunar Injection');
  });
});
