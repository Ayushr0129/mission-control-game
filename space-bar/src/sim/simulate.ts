import { mulberry32, hashSeed } from './rng';
import {
  Chapter, ConflictRule, Decisions, EFFECT_KEYS, Effects, GameEvent, Outcome, Phase, PhaseResult,
  PHASES, Check, Question, Totals, FlownResult, FLOWN, Option,
} from './types';

export interface SimInput {
  chapter: Chapter; questions: Question[]; conflicts: ConflictRule[];
  decisions: Decisions; seed: number; events: GameEvent[];
}

function addEffects(acc: Record<string, number>, phaseRisk: Record<Phase, number>, e: Effects) {
  for (const k of EFFECT_KEYS) acc[k] = (acc[k] ?? 0) + (e[k] ?? 0);
  if (e.phaseRisk) for (const p of PHASES) phaseRisk[p] += e.phaseRisk[p] ?? 0;
}

/** Sum the chosen options (missing answers are neutral) plus any triggered role conflicts. */
export function computeTotals(ch: Chapter, questions: Question[], conflicts: ConflictRule[], decisions: Decisions): Totals {
  const pts: Record<string, number> = {};
  const phaseRisk = Object.fromEntries(PHASES.map((p) => [p, 0])) as Record<Phase, number>;
  const tags = new Set<string>();
  for (const q of questions) {
    const opt = q.options.find((o) => o.id === decisions[q.id]);
    if (!opt) continue;
    addEffects(pts, phaseRisk, opt.effects);
    opt.tags.forEach((t) => tags.add(t));
  }
  const triggered: string[] = [];
  for (const r of conflicts) {
    if (r.all.every((t) => tags.has(t))) { triggered.push(r.id); addEffects(pts, phaseRisk, r.effects); }
  }
  const g = (k: string) => pts[k] ?? 0;
  const s = ch.scale, b = ch.base;
  return {
    mass: b.mass + g('mass') * s.mass, capacity: b.capacity,
    gen: b.gen + g('power') * s.power, load: b.load + g('load') * s.load,
    data: Math.max(0, b.data + g('data') * s.data), comms: Math.max(0, b.comms + g('comms') * s.comms),
    cost: Math.max(3, b.cost + g('cost') * s.cost), days: Math.max(240, b.days + g('days') * s.days),
    risk: g('risk'), trust: g('trust') * s.trust, debris: Math.max(0, b.debris + g('debris') * s.debris), science: g('science'),
    phaseRisk, tags: [...tags], conflicts: triggered,
  };
}

export function eventStress(events: GameEvent[], tags: string[]) {
  const out = Object.fromEntries(PHASES.map((p) => [p, { power: 0, comms: 0, hardware: 0 }])) as Record<Phase, { power: number; comms: number; hardware: number }>;
  for (const ev of events) {
    const mitigated = ev.mitigatedBy?.some((t) => tags.includes(t));
    const f = mitigated ? 1 - (ev.mitigation ?? 0.5) : 1;
    for (const s of ev.stress ?? []) out[s.phase][s.kind] += s.amount * f;
  }
  return out;
}

export function failProbability(ch: Chapter, t: Totals, phase: Phase, hardwareStress: number): number {
  const p = ch.baseFail[phase] + ch.riskPerPoint * t.risk * ch.riskWeight[phase] + ch.riskPerPoint * t.phaseRisk[phase] + hardwareStress;
  return Math.min(0.7, Math.max(0.005, p));
}

/**
 * Pure and deterministic: same inputs, seed and flying always give the same outcome.
 * The physical checks run in every phase. The coast and the trip home roll dice, because nobody is flying them.
 * Liftoff, Moon orbit and the landing are flown: there the player's hands decide, and a moment that has not
 * been flown yet counts as passed, so the flight can ask "has anything failed so far?" as it goes.
 */
export function simulate(inp: SimInput, flown: FlownResult = {}): Outcome {
  const { chapter: ch } = inp;
  const totals = computeTotals(ch, inp.questions, inp.conflicts, inp.decisions);
  const stress = eventStress(inp.events, totals.tags);
  const phases: PhaseResult[] = [];
  let failedPhase: Phase | null = null;
  let cause: Outcome['cause'] = null;

  PHASES.forEach((phase, i) => {
    const st = stress[phase];
    const res: PhaseResult = { phase, reached: failedPhase === null, passed: false, checks: [], failProb: 0, roll: null, stress: st };
    phases.push(res);
    if (failedPhase) return;
    const checks: Check[] = [];
    if (phase === 'launch') {
      checks.push({ kind: 'mass', label: 'Spacecraft mass within launch vehicle capacity', value: totals.mass, limit: totals.capacity, passed: totals.mass <= totals.capacity, unit: 't' });
    } else {
      const use = totals.load * ch.phaseLoad[phase];
      const gen = totals.gen - st.power;
      checks.push({ kind: 'power', label: 'Power generated covers power used', value: use, limit: gen, passed: use <= gen, unit: 'kW' });
    }
    if (phase === 'orbit' || phase === 'landing') {
      const data = totals.data * (phase === 'orbit' ? 0.5 : 1);
      const cap = totals.comms - st.comms + ch.commsSlack;
      checks.push({ kind: 'comms', label: 'Data produced fits the link back to Earth', value: data, limit: cap, passed: data <= cap, unit: 'Mb/s' });
    }
    res.checks = checks;
    const bad = checks.find((c) => !c.passed);
    if (bad) { failedPhase = phase; cause = bad.kind; return; }
    res.failProb = failProbability(ch, totals, phase, st.hardware);
    if (FLOWN.includes(phase)) {
      const mine = phase === 'launch' ? flown.liftoff : phase === 'orbit' ? flown.orbit : flown.landing;
      if (mine !== undefined) res.flown = mine;
      if (phase === 'landing' && flown.landing && !flown.landing.landed) { failedPhase = phase; cause = 'piloting'; return; }
      res.passed = true;
      return;
    }
    res.roll = mulberry32(hashSeed(inp.seed, i, 7919))();
    if (res.roll < res.failProb) { failedPhase = phase; cause = 'hardware'; return; }
    res.passed = true;
  });
  // fill failProb for failed physical-check phases so reports can show it
  for (const r of phases) {
    if (r.reached && r.failProb === 0) r.failProb = failProbability(ch, totals, r.phase, r.stress.hardware);
  }
  return { success: failedPhase === null, failedPhase, cause, phases, totals, seed: inp.seed, flown };
}

/** Chance that nothing breaks on the coast out or the trip home: the two phases still left to the dice. */
export function survivalChance(ch: Chapter, t: Totals, events: GameEvent[]): number {
  const st = eventStress(events, t.tags);
  return PHASES.filter((p) => !FLOWN.includes(p)).reduce((a, p) => a * (1 - failProbability(ch, t, p, st[p].hardware)), 1);
}

/**
 * Would picking this landing site push more data down the link than it can carry?
 * `t` is the totals before any site is chosen. Used to lock a site the player could not survive choosing.
 */
export function siteOverloadsLink(ch: Chapter, t: Totals, events: GameEvent[], o: Option): boolean {
  const data = Math.max(0, t.data + (o.effects.data ?? 0) * ch.scale.data);
  const comms = Math.max(0, t.comms + (o.effects.comms ?? 0) * ch.scale.comms);
  return data > comms - eventStress(events, t.tags).landing.comms + ch.commsSlack;
}
