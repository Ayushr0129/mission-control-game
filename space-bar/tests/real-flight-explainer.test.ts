import { describe, expect, it } from 'vitest';
import { REAL_FLIGHT_EXPLAINER_RULES, RealFlightMoment, explainerRuleFor } from '../src/data/realFlightExplainer';

const moments: readonly RealFlightMoment[] = ['countdown', 'ignition', 'liftoff', 'pitch-over', 'drag', 'max-q', 'cutoff', 'staging', 'orbit', 'tli', 'coast', 'loi', 'landing', 're-entry'];
const fixture = { moment: 'liftoff' as const, thrustN: 33_000_000, weightN: 28_000_000, altitudeM: 120_000, horizontalSpeedMps: 7_800, dynamicPressurePa: 35_000, dragN: 120_000, stage: 2 };

describe('authored real-flight explainer', () => {
  it('covers every required flight moment', () => {
    expect(REAL_FLIGHT_EXPLAINER_RULES.map((rule) => rule.moment)).toEqual(expect.arrayContaining([...moments]));
    for (const moment of moments) expect(explainerRuleFor(moment), moment).toBeDefined();
  });

  it('renders live-number text without invalid placeholders', () => {
    for (const rule of REAL_FLIGHT_EXPLAINER_RULES) {
      const output = `${rule.text({ ...fixture, moment: rule.moment })} ${rule.why} ${rule.detail}`;
      expect(output).not.toMatch(/NaN|undefined/);
      expect(rule.source.document).not.toBe('');
      expect(rule.source.location).not.toBe('');
    }
  });
});
