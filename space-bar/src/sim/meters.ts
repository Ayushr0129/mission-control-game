import { mulberry32, hashSeed } from './rng';
import { Chapter, GameEvent, Meters, Outcome, Totals } from './types';

export type HardEnd = 'budget' | 'trust' | 'debris' | null;
const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function initialMeters(ch: Chapter): Meters { return { ...ch.start, day: 0 }; }

export function dateAt(ch: Chapter, day: number): Date {
  const d = new Date(ch.startDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Math.round(day));
  return d;
}

/** Weighted draw without replacement; deterministic for a seed. */
export function drawEvents(pool: GameEvent[], seed: number, n: number): GameEvent[] {
  const rnd = mulberry32(hashSeed(seed, 424242));
  const left = [...pool];
  const out: GameEvent[] = [];
  while (out.length < n && left.length) {
    const total = left.reduce((a, e) => a + e.weight, 0);
    let r = rnd() * total, i = 0;
    for (; i < left.length - 1; i++) { r -= left[i].weight; if (r <= 0) break; }
    out.push(left.splice(i, 1)[0]);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The world meters on launch day if the ship flew as currently designed, before anyone knows how the
 * flight goes. Same arithmetic as resolveRun without the outcome, so the bar can move with every choice.
 */
export function projectMeters(m: Meters, ch: Chapter, totals: Totals, events: GameEvent[]): Meters {
  let budget = m.budget - totals.cost;
  let trust = m.trust - ch.trustDecayPerDay * totals.days + totals.trust;
  const debris = m.debris + totals.debris + ch.debrisPerLaunch;
  const start = new Date(ch.startDate + 'T00:00:00Z');
  for (let d = Math.floor(m.day); d < m.day + totals.days; d++) {
    const dt = new Date(start); dt.setUTCDate(dt.getUTCDate() + d);
    budget += ((ch.appropriations[dt.getUTCFullYear()] ?? 0) * ch.budgetPerAppropriation) / 365;
  }
  for (const ev of events) { budget += ev.immediate?.budget ?? 0; trust += ev.immediate?.trust ?? 0; }
  return { budget: clamp(budget), trust: clamp(trust), debris: clamp(debris), day: m.day + totals.days };
}

export interface RunResolution {
  meters: Meters; hardEnd: HardEnd; late: boolean;
  deltas: { budget: number; trust: number; debris: number; days: number };
  log: string[];
}

/** Apply a finished run to the world meters. */
export function resolveRun(m: Meters, ch: Chapter, totals: Totals, outcome: Outcome, events: GameEvent[], livestream: boolean): RunResolution {
  const log: string[] = [];
  let budget = m.budget - totals.cost;
  log.push(`Development spending: -${totals.cost.toFixed(0)} budget`);
  let trust = m.trust;
  let debris = m.debris + totals.debris + ch.debrisPerLaunch;

  // appropriations arrive day by day: real NASA budget data changes the meter
  let income = 0;
  const start = new Date(ch.startDate + 'T00:00:00Z');
  for (let d = Math.floor(m.day); d < m.day + totals.days; d++) {
    const dt = new Date(start); dt.setUTCDate(dt.getUTCDate() + d);
    income += ((ch.appropriations[dt.getUTCFullYear()] ?? 0) * ch.budgetPerAppropriation) / 365;
  }
  budget += income;
  log.push(`Congress appropriations while we worked: +${income.toFixed(0)} budget`);

  for (const ev of events) {
    if (ev.immediate?.budget) { budget += ev.immediate.budget; log.push(`${ev.headline}: ${ev.immediate.budget > 0 ? '+' : ''}${ev.immediate.budget} budget`); }
    if (ev.immediate?.trust) { trust += ev.immediate.trust; log.push(`${ev.headline}: ${ev.immediate.trust > 0 ? '+' : ''}${ev.immediate.trust} trust`); }
  }
  const decay = ch.trustDecayPerDay * totals.days;
  trust -= decay;
  log.push(`Public attention fades over ${totals.days.toFixed(0)} days: -${decay.toFixed(0)} trust`);
  trust += totals.trust;
  if (totals.trust) log.push(`Public relations choices: ${totals.trust > 0 ? '+' : ''}${totals.trust.toFixed(0)} trust`);

  const day = m.day + totals.days;
  const late = day > ch.deadlineDay;
  if (outcome.success) {
    let gain = livestream ? ch.trustOnSuccess : ch.trustOnSuccessQuiet;
    gain += totals.science * ch.trustPerScience;
    if (late) gain *= 0.5;
    trust += gain;
    log.push(`Success: +${gain.toFixed(0)} trust${late ? ' (halved: the decade had ended)' : ''}`);
  } else {
    let loss = ch.trustOnFailure * (livestream ? 2 : 1);
    loss = Math.min(loss, ch.trustFailureCap);
    trust -= loss;
    debris += ch.debrisOnFailure;
    log.push(`Failure${livestream ? ' seen live by everyone' : ''}: -${loss.toFixed(0)} trust, +${ch.debrisOnFailure} debris`);
  }
  const next: Meters = { budget: clamp(budget), trust: clamp(trust), debris: clamp(debris), day };
  const hardEnd: HardEnd = next.budget <= 0 ? 'budget' : next.trust <= 0 ? 'trust' : next.debris >= 100 ? 'debris' : null;
  return {
    meters: next, hardEnd, late, log,
    deltas: { budget: next.budget - m.budget, trust: next.trust - m.trust, debris: next.debris - m.debris, days: totals.days },
  };
}
