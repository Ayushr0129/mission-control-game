import { describe, it, expect } from 'vitest';
import { content } from '../src/data';
import { computeTotals } from '../src/sim/simulate';
import { Decisions } from '../src/sim/types';
import { landingFuelPreview } from '../src/sim/flight';

const { chapter, questions, conflicts } = content;
const totalsOf = (d: Decisions) => computeTotals(chapter, questions, conflicts, d);
/** the lightest sensible build */
const BASIC: Decisions = {
  'mgr-funding': 'modest', 'mgr-schedule': 'steady', 'eng-cabin': 'fix', 'nav-route': 'lor', 'eng-docking': 'basic',
  'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave',
};
const HEAVY: Decisions = { ...BASIC, 'nav-route': 'direct', 'eng-power': 'extra', 'sci-antenna': 'large' };

describe('the landing fuel gauge on the build screen', () => {
  it('shows more for a lighter ship', () => {
    expect(landingFuelPreview(chapter, totalsOf(BASIC))).toBeGreaterThan(landingFuelPreview(chapter, totalsOf(HEAVY)));
    expect(landingFuelPreview(chapter, totalsOf(HEAVY))).toBeGreaterThan(0);
  });
});
