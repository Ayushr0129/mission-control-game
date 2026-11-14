import { Chapter, GameEvent, Mark, Phase, Site, Totals } from './types';
import { eventStress, failProbability } from './simulate';

/**
 * Every number behind the three flown moments. No graphics in here, so the rules can be tested:
 * the same build, the same seed and the same key presses always give the same result.
 */
export const FLIGHT = {
  // liftoff: hold to burn, let go in the green zone near the end of the bar
  burn: 6, zoneWide: 0.20, zoneNarrow: 0.10, zoneEnd: 0.96, igniteHold: 1.0, idleIgnite: 5,
  // Moon orbit: tap as the ship crosses the ring
  approach: 5, windowWide: 0.5, windowNarrow: 0.25,
  // share of the landing fuel a sloppy burn costs
  loss: { clean: 0, fair: 0.04, rough: 0.08 } as Record<Mark, number>,
  // landing: straight down under lunar gravity
  h0: 300, v0: 10, gravity: 1.62, thrust: 5,
  // landing fuel as a multiple of the least a clean landing needs
  marginLight: 2.0, marginHeavy: 1.5, marginFloor: 1.4, lightMass: 24,
  retryFuel: 0.8, retryFloor: 1.25,
  // the cautious way down: brake early, then drift the last few metres
  cautious: 0.5, lastMoment: 0.7, pad: 15,
  vSafeEasy: 6, vSafeHard: 4.5, roughSite: 0.7,
  dt: 1 / 60, maxElapsed: 0.1, diffSpan: 0.25,
};

/** What the autopilot earns: an average burn, never a perfect one. */
export const AUTOPILOT: { liftoff: Mark; orbit: Mark } = { liftoff: 'fair', orbit: 'fair' };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** How hard a flown moment is, 0..1. It comes from the same risk the dice used to roll against. */
export function difficulty(ch: Chapter, t: Totals, events: GameEvent[], phase: Phase): number {
  const st = eventStress(events, t.tags)[phase].hardware;
  return clamp01((failProbability(ch, t, phase, st) - 0.005) / FLIGHT.diffSpan);
}

/** News that is pushing on this moment and that the build did nothing about. */
export function warningsFor(events: GameEvent[], tags: string[], phase: Phase): string[] {
  return events
    .filter((ev) => ev.stress?.some((s) => s.phase === phase && s.kind === 'hardware') && !ev.mitigatedBy?.some((t) => tags.includes(t)))
    .map((ev) => ev.headline);
}

export const massFrac = (t: Totals) => clamp01((t.mass - FLIGHT.lightMass) / (t.capacity - FLIGHT.lightMass));

/** Landing fuel as a multiple of what a careful landing needs: less for a heavy ship, for sloppy burns, and on the second try. */
export function fuelMargin(t: Totals, marks: { liftoff: Mark; orbit: Mark }, attempt: 1 | 2): number {
  let margin = Math.max(FLIGHT.marginFloor, lerp(FLIGHT.marginLight, FLIGHT.marginHeavy, massFrac(t)) * (1 - FLIGHT.loss[marks.liftoff] - FLIGHT.loss[marks.orbit]));
  if (attempt === 2) margin = Math.max(FLIGHT.retryFloor, margin * FLIGHT.retryFuel);
  return margin;
}

/** 0..1 for the gauge on the build screen: how much spare landing fuel this build leaves. */
export function landingFuelPreview(_ch: Chapter, t: Totals): number {
  return clamp01((lerp(FLIGHT.marginLight, FLIGHT.marginHeavy, massFrac(t)) - FLIGHT.marginFloor) / (FLIGHT.marginLight - FLIGHT.marginFloor));
}
