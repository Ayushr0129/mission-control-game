import { describe, it, expect } from 'vitest';
import { content } from '../src/data';
import { simulate, computeTotals, survivalChance, failProbability, siteOverloadsLink } from '../src/sim/simulate';
import { drawEvents, initialMeters, resolveRun } from '../src/sim/meters';
import { gradeChapter } from '../src/sim/grade';
import { validateContent } from '../src/data/validate';
import { Decisions } from '../src/sim/types';

const { chapter, questions, conflicts, events } = content;
const base = (d: Decisions, seed = 1, ev = [] as typeof events) => simulate({ chapter, questions, conflicts, decisions: d, seed, events: ev });
const SAFE: Decisions = {
  'mgr-funding': 'modest', 'mgr-schedule': 'steady', 'nav-route': 'lor', 'nav-disposal': 'solar',
  'eng-docking': 'robust', 'eng-cabin': 'fix', 'eng-power': 'extra', 'sci-site': 'flat',
  'sci-instruments': 'basic', 'sci-antenna': 'large',
};

describe('content', () => {
  it('passes the schema check', () => expect(validateContent(content)).toEqual([]));
  it('catches a bad effect key', () => {
    const bad = structuredClone(content);
    (bad.questions[0].options[0].effects as any).banana = 1;
    expect(validateContent(bad).join()).toMatch(/banana/);
  });
  it('has three story decisions, six parts and one flight pick', () => {
    const kinds = (k: string) => questions.filter((q) => q.kind === k).map((q) => q.id).sort();
    expect(kinds('story')).toEqual(['eng-cabin', 'mgr-funding', 'mgr-schedule']);
    expect(kinds('part')).toEqual(['eng-docking', 'eng-power', 'nav-disposal', 'nav-route', 'sci-antenna', 'sci-instruments']);
    expect(kinds('flight')).toEqual(['sci-site']);
    expect(questions.filter((q) => q.kind === 'part').every((q) => !!q.slot)).toBe(true);
  });
  it('live TV carries the broadcast', () => {
    const full = questions.find((q) => q.id === 'sci-instruments')!.options.find((o) => o.id === 'full')!;
    expect(full.tags).toContain('livestream'); expect(full.effects.trust).toBe(2);
  });
  it('no rule punishes docking on the route that never docks', () => {
    expect(conflicts.map((c) => c.id)).toEqual(['lor-docking', 'eor-docking', 'data-link', 'rush-payload']);
  });
});

describe('simulate', () => {
  it('is deterministic for the same seed', () => {
    expect(JSON.stringify(base(SAFE, 7))).toEqual(JSON.stringify(base(SAFE, 7)));
  });
  it('can succeed with a sensible design (some seed)', () => {
    expect([...Array(40).keys()].some((s) => base(SAFE, s).success)).toBe(true);
  });
  it('fails with cause "mass" when direct ascent is overloaded', () => {
    const o = base({ ...SAFE, 'nav-route': 'direct', 'eng-cabin': 'redesign', 'eng-power': 'battery' });
    expect(o.cause).toBe('mass'); expect(o.failedPhase).toBe('launch');
  });
  it('fails with cause "comms" when data outruns the antenna', () => {
    const o = base({ ...SAFE, 'sci-instruments': 'full', 'sci-antenna': 'small', 'sci-site': 'rough', 'eng-power': 'extra' });
    expect(o.cause).toBe('comms'); expect(o.failedPhase).toBe('orbit' === o.failedPhase ? 'orbit' : 'landing');
  });
  it('fails with cause "power" when instruments outdraw the cells', () => {
    const o = base({ ...SAFE, 'sci-instruments': 'full', 'eng-power': 'standard' });
    expect(o.cause).toBe('power');
  });
  it('stops at the first failing phase and leaves later phases unreached', () => {
    const o = base({ ...SAFE, 'nav-route': 'direct', 'eng-cabin': 'redesign', 'eng-power': 'battery' });
    expect(o.phases.slice(1).every((p) => !p.reached)).toBe(true);
  });
  it('triggers a role conflict for LOR with manual docking', () => {
    const t = computeTotals(chapter, questions, conflicts, { ...SAFE, 'eng-docking': 'basic' });
    expect(t.conflicts).toContain('lor-docking');
  });
  it('event stress is reduced by a mitigating choice', () => {
    const solar = events.find((e) => e.id === 'solar-activity')!;
    const a = survivalChance(chapter, computeTotals(chapter, questions, conflicts, SAFE), [solar]);
    expect(a).toBeGreaterThan(0);
    const without = base({ ...SAFE, 'eng-power': 'standard' }, 3, [solar]).phases.find((p) => p.phase === 'coast')!;
    const with_ = base(SAFE, 3, [solar]).phases.find((p) => p.phase === 'coast')!;
    expect(without.stress.power).toBeGreaterThan(with_.stress.power);
  });
  it('drawEvents is deterministic and unique', () => {
    const a = drawEvents(events, 5, 2).map((e) => e.id), b = drawEvents(events, 5, 2).map((e) => e.id);
    expect(a).toEqual(b); expect(new Set(a).size).toBe(2);
  });
});

describe('meters', () => {
  const win = () => { for (let s = 0; s < 200; s++) { const o = base(SAFE, s); if (o.success) return o; } throw new Error('no win'); };
  const lose = () => base({ ...SAFE, 'sci-instruments': 'full', 'eng-power': 'standard' }, 1);
  it('a failure never removes more than 40 trust, even when livestreamed', () => {
    const o = lose(); const m = initialMeters(chapter);
    const r = resolveRun({ ...m, trust: 100 }, chapter, o.totals, o, [], true);
    const decay = chapter.trustDecayPerDay * o.totals.days;
    expect(100 - r.meters.trust - decay - o.totals.trust).toBeLessThanOrEqual(chapter.trustFailureCap + 1e-9);
  });
  it('success restores trust and fail adds debris', () => {
    const m = initialMeters(chapter);
    const w = win(), l = lose();
    const rw = resolveRun(m, chapter, w.totals, w, [], false);
    const rl = resolveRun(m, chapter, l.totals, l, [], false);
    expect(rw.meters.trust).toBeGreaterThan(rl.meters.trust);
    expect(rl.meters.debris).toBeGreaterThan(rw.meters.debris);
  });
  it('real appropriations feed the budget meter', () => {
    const m = initialMeters(chapter);
    const l = lose();
    const early = resolveRun({ ...m, day: 0 }, chapter, l.totals, l, [], false);
    const rich = resolveRun({ ...m, day: 900 }, chapter, l.totals, l, [], false); // 1963-64: bigger NASA budgets
    expect(rich.meters.budget).toBeGreaterThan(early.meters.budget);
  });
  it('detects hard ends', () => {
    const l = lose(); const m = initialMeters(chapter);
    expect(resolveRun({ ...m, budget: 5 }, chapter, l.totals, l, [], false).hardEnd).toBe('budget');
    expect(resolveRun({ ...m, trust: 3 }, chapter, l.totals, l, [], false).hardEnd).toBe('trust');
    expect(resolveRun({ ...m, debris: 99 }, chapter, l.totals, l, [], false).hardEnd).toBe('debris');
    expect(resolveRun(m, chapter, l.totals, l, [], false).hardEnd).toBeNull();
  });
  it('grade rewards teamwork and science', () => {
    const w = win(); const m = { ...initialMeters(chapter), day: 900, budget: 40 };
    const g1 = gradeChapter(chapter, m, w.totals, 0, 5, false), g2 = gradeChapter(chapter, m, w.totals, 3, 5, false);
    expect(g1.score).toBeGreaterThan(g2.score);
    expect(['S', 'A', 'B', 'C']).toContain(g1.letter);
  });
});

describe('flying and the simulation', () => {
  it('does not roll dice in the flown phases', () => {
    for (let seed = 0; seed < 300; seed++) {
      const o = base(SAFE, seed);
      for (const p of o.phases.filter((p) => ['launch', 'orbit', 'landing'].includes(p.phase))) expect(p.roll).toBeNull();
      if (!o.success) expect(['coast', 'return']).toContain(o.failedPhase);
    }
  });
  it('a lost landing fails the mission as piloting', () => {
    const landing = { landed: false, tries: 2, site: 'flat', speed: 14, fuelLeft: 0 } as const;
    const seed = [...Array(300).keys()].find((s) => base(SAFE, s).success)!;
    const o = simulate({ chapter, questions, conflicts, decisions: SAFE, seed, events: [] }, { liftoff: 'clean', orbit: 'clean', landing });
    expect(o.success).toBe(false); expect(o.failedPhase).toBe('landing'); expect(o.cause).toBe('piloting');
    expect(o.flown.landing).toEqual(landing);
    expect(o.phases.find((p) => p.phase === 'launch')!.flown).toBe('clean');
    expect(o.phases.find((p) => p.phase === 'return')!.reached).toBe(false);
  });
  it('a landing that worked passes, and records how it was flown', () => {
    const landing = { landed: true, tries: 2, site: 'rough', speed: 2.5, fuelLeft: 0.1 } as const;
    const seed = [...Array(300).keys()].find((s) => base(SAFE, s).success)!;
    const o = simulate({ chapter, questions, conflicts, decisions: SAFE, seed, events: [] }, { liftoff: 'rough', orbit: 'fair', landing });
    expect(o.success).toBe(true);
    expect(o.phases.find((p) => p.phase === 'landing')!.flown).toEqual(landing);
  });
  it('flying cannot save a rocket that is too heavy', () => {
    const heavy = { ...SAFE, 'nav-route': 'direct', 'eng-power': 'extra', 'sci-instruments': 'full', 'sci-antenna': 'large', 'eng-cabin': 'redesign' };
    const t = computeTotals(chapter, questions, conflicts, heavy);
    expect(t.mass).toBeGreaterThan(t.capacity);
    const o = simulate({ chapter, questions, conflicts, decisions: heavy, seed: 1, events: [] }, { liftoff: 'clean' });
    expect(o.failedPhase).toBe('launch'); expect(o.cause).toBe('mass');
  });
  it('is the same every time for the same flying', () => {
    const f = { liftoff: 'fair', orbit: 'clean' } as const;
    const inp = { chapter, questions, conflicts, decisions: SAFE, seed: 42, events: [] };
    expect(simulate(inp, f)).toEqual(simulate(inp, f));
  });
  it('survival covers only the coast and the trip home', () => {
    const t = computeTotals(chapter, questions, conflicts, SAFE);
    const want = (1 - failProbability(chapter, t, 'coast', 0)) * (1 - failProbability(chapter, t, 'return', 0));
    expect(survivalChance(chapter, t, [])).toBeCloseTo(want, 9);
  });
  it('locks the highlands when the antenna cannot carry them', () => {
    const rough = questions.find((q) => q.id === 'sci-site')!.options.find((o) => o.id === 'rough')!;
    const { 'sci-site': _s, ...noSite } = SAFE;
    const t = computeTotals(chapter, questions, conflicts, { ...noSite, 'sci-instruments': 'basic', 'sci-antenna': 'small' }); // data 3, link 4
    const storm = { ...events[0], stress: [{ phase: 'landing', kind: 'comms', amount: 1 }], mitigatedBy: [] } as typeof events[0];   // link 3
    expect(siteOverloadsLink(chapter, t, [], rough)).toBe(false);     // 4 of 4 still fits
    expect(siteOverloadsLink(chapter, t, [storm], rough)).toBe(true); // 4 of 3 does not
    const withSite = simulate({ chapter, questions, conflicts, decisions: { ...noSite, 'sci-instruments': 'basic', 'sci-antenna': 'small', 'sci-site': 'rough' }, seed: 1, events: [storm] }, { liftoff: 'clean', orbit: 'clean' });
    if (withSite.failedPhase !== 'coast') expect(withSite.cause).toBe('comms'); // the lock and the simulation agree
  });
});
