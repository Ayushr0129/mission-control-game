import { describe, expect, it } from 'vitest';
import { STAGE_D_CAMPAIGN } from '../src/data/stageDCampaign';
import { canFly } from '../src/domain/canFly';
import { truthRocketById } from '../src/data/truth';

describe('Stage D sourced campaign', () => {
  it('assembles the complete requested nine-mission sequence', () => {
    expect(STAGE_D_CAMPAIGN.map(({ number }) => number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(STAGE_D_CAMPAIGN.every(({ mission, historicalRocket }) => mission.historicalRocketId.value === historicalRocket.id)).toBe(true);
  });

  it('locks anachronistic alternatives in historical mode but labels a capable what-if', () => {
    const sputnik = STAGE_D_CAMPAIGN[0].mission;
    const falcon9 = truthRocketById('falcon-9');
    expect(falcon9).toBeDefined();
    expect(canFly(sputnik, falcon9!, 83.6, 'historical').allowed).toBe(false);
    expect(canFly(sputnik, falcon9!, 83.6, 'what-if').allowed).toBe(true);
  });

  it('keeps destination, crew rating, and payload limits active in what-if mode', () => {
    const mercury = STAGE_D_CAMPAIGN[1].mission;
    const falconHeavy = truthRocketById('falcon-heavy');
    expect(falconHeavy).toBeDefined();
    const verdict = canFly(mercury, falconHeavy!, 1, 'what-if');
    expect(verdict.allowed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes('human-rated'))).toBe(true);
  });
});
