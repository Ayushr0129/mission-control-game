import { describe, it, expect, beforeEach, vi } from 'vitest';
import { endingFor, history } from '../src/data';
import { storyOrder, slotOrder, CABIN } from '../src/data/story';
import { Cause, Decisions, FlownResult, LandingResult, Outcome } from '../src/sim/types';
import { Session, Run, newSession, answer, setPart, pendingInterrupt, markFired, peek, finishFlight, retry } from '../src/game/session';
import { achievements, AchievementId, award, clearAchievements, earned, loadHeld } from '../src/game/achievements';

const KEY = 'rttm.achievements.v1';
const BASIC: Decisions = {
  'mgr-funding': 'modest', 'mgr-schedule': 'steady', 'eng-cabin': 'fix', 'nav-route': 'lor', 'eng-docking': 'basic',
  'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave',
};
const LOST = { liftoff: 'fair', orbit: 'fair', landing: { landed: false, tries: 2, site: 'flat', speed: 12, fuelLeft: 0 } } as const;
const LANDED = { liftoff: 'fair', orbit: 'fair', landing: { landed: true, tries: 1, site: 'flat', speed: 3, fuelLeft: 0.3 } } as const;
const FAILURES: AchievementId[] = ['signal-lost', 'lights-out', 'vehicle-lost', 'too-fast'];

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  });
  clearAchievements(); // also forgets the page's in-memory copy
});
const blocked = () => vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } });

function build(s: Session, d: Decisions) {
  for (const q of [...storyOrder, CABIN]) answer(s, q, d[q]);
  for (const q of slotOrder) if (d[q]) setPart(s, q, d[q]);
  while (pendingInterrupt(s, true)) markFired(s);
}
/** a world whose first flight with the basic build lands when the landing is good */
function fresh(): Session {
  for (let seed = 1; seed < 500; seed++) {
    const s = newSession(seed, false); build(s, BASIC); answer(s, 'sci-site', 'flat');
    if (peek(s, LANDED).success) { const t = newSession(seed, false); build(t, BASIC); answer(t, 'sci-site', 'flat'); return t; }
  }
  throw new Error('no quiet seed');
}

/** a session whose first run was lost and whose second, flown with LANDED, lands */
function secondRunLands(): Session {
  for (let seed = 1; seed < 500; seed++) {
    const s = newSession(seed, false); build(s, BASIC); answer(s, 'sci-site', 'flat');
    finishFlight(s, LOST); retry(s); build(s, BASIC); answer(s, 'sci-site', 'flat');
    if (peek(s, LANDED).success) return s;
  }
  throw new Error('no seed lands on run 2');
}

const landing = (l: Partial<LandingResult> = {}): LandingResult => ({ landed: true, tries: 1, site: 'flat', speed: 3, fuelLeft: 0.3, ...l });
/** a run with a fixed outcome, pushed into the session the way finishFlight does */
interface Fixed { cause?: Cause; flown?: FlownResult; decisions?: Decisions; autopilot?: boolean }
function fixed(s: Session, o: Fixed & { success: boolean }): Run {
  const no = s.runs.length + 1;
  const outcome = { success: o.success, failedPhase: o.success ? null : 'landing', cause: o.success ? null : o.cause ?? 'piloting', phases: [], seed: no, flown: o.flown ?? { liftoff: 'fair', orbit: 'fair', landing: landing() } } as unknown as Outcome;
  const run: Run = { no, seed: no, events: [], decisions: o.decisions ?? {}, fired: 0, outcome, autopilot: o.autopilot };
  s.runs.push(run);
  return run;
}
const win = (s: Session, extra: Fixed = {}) => fixed(s, { success: true, ...extra });
const lose = (s: Session, cause: Cause) => fixed(s, { success: false, cause });

describe('success badges', () => {
  it('landed on run 1 earns landed and first-try', () => {
    const s = fresh(); const run = finishFlight(s, LANDED);
    expect(run.outcome!.success).toBe(true);
    const got = earned(s, run, []);
    expect(got).toContain('landed'); expect(got).toContain('first-try');
    expect(got).not.toContain('comeback');
  });
  it('first-try is not earned on run 2, and comeback is earned on a success after a failed run', () => {
    const s = secondRunLands(); const run = finishFlight(s, LANDED);
    expect(run.no).toBe(2); expect(run.outcome!.success).toBe(true);
    const got = earned(s, run, []);
    expect(got).not.toContain('first-try'); expect(got).toContain('comeback'); expect(got).toContain('landed');
    const t = newSession(1, false); lose(t, 'comms'); const r = win(t);
    expect(earned(t, r, [])).toEqual(expect.arrayContaining(['landed', 'comeback']));
    expect(earned(t, r, [])).not.toContain('first-try');
    const u = newSession(1, false); win(u); const r2 = win(u); // two wins, no failure
    expect(earned(u, r2, [])).not.toContain('comeback');
    expect(earned(u, r2, [])).not.toContain('first-try');
  });
  it('picture-perfect needs clean liftoff, clean orbit, landing tries 1', () => {
    const pp = (flown: FlownResult) => { const s = newSession(1, false); return earned(s, win(s, { flown }), []).includes('picture-perfect'); };
    expect(pp({ liftoff: 'clean', orbit: 'clean', landing: landing({ tries: 1 }) })).toBe(true);
    expect(pp({ liftoff: 'clean', orbit: 'fair', landing: landing({ tries: 1 }) })).toBe(false);
    expect(pp({ liftoff: 'clean', orbit: 'clean', landing: landing({ tries: 2 }) })).toBe(false);
    expect(pp({ liftoff: 'fair', orbit: 'clean', landing: landing({ tries: 1 }) })).toBe(false);
  });
  it('rough-ground on a rough site, on-fumes under 10% fuel', () => {
    const has = (l: Partial<LandingResult>, id: AchievementId) => { const s = newSession(1, false); return earned(s, win(s, { flown: { liftoff: 'fair', orbit: 'fair', landing: landing(l) } }), []).includes(id); };
    expect(has({ site: 'rough' }, 'rough-ground')).toBe(true);
    expect(has({ site: 'flat' }, 'rough-ground')).toBe(false);
    expect(has({ fuelLeft: 0.09 }, 'on-fumes')).toBe(true);
    expect(has({ fuelLeft: 0.10 }, 'on-fumes')).toBe(false);
  });
  it('hands-on only when run.autopilot is not true', () => {
    const has = (autopilot?: boolean) => { const s = newSession(1, false); return earned(s, win(s, { autopilot }), []).includes('hands-on'); };
    expect(has(undefined)).toBe(true); expect(has(false)).toBe(true);
    expect(has(true)).toBe(false); // switched on mid-landing and off again still leaves the flag set
  });
  it('by-the-book is earned from a real build of NASA\'s choices', () => {
    const H = history.optionByQuestion;
    expect(H['sci-site']).toBeDefined();
    const flown = { liftoff: 'clean', orbit: 'clean', landing: { landed: true, tries: 1, site: 'flat', speed: 3, fuelLeft: 0.3 } } as const;
    let hits = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = newSession(seed, false); build(s, H); answer(s, 'sci-site', H['sci-site']);
      for (const [q, opt] of Object.entries(H)) expect(s.current.decisions[q]).toBe(opt);
      const run = finishFlight(s, flown);
      if (run.outcome!.success && earned(s, run, []).includes('by-the-book')) hits++;
    }
    expect(hits).toBeGreaterThan(0);
  });
  it('by-the-book when every historical choice matches', () => {
    const has = (decisions: Decisions) => { const s = newSession(1, false); return earned(s, win(s, { decisions }), []).includes('by-the-book'); };
    expect(has({ ...history.optionByQuestion })).toBe(true);
    const [k] = Object.keys(history.optionByQuestion);
    expect(has({ ...history.optionByQuestion, [k]: 'something-else' })).toBe(false);
    const missing: Decisions = { ...history.optionByQuestion }; delete missing[k];
    expect(has(missing)).toBe(false);
  });
});

describe('failure badges', () => {
  it('each cause maps to its badge, and a failed run earns no success badges', () => {
    const map: [Cause, AchievementId][] = [['comms', 'signal-lost'], ['power', 'lights-out'], ['mass', 'vehicle-lost'], ['hardware', 'vehicle-lost'], ['piloting', 'too-fast']];
    for (const [cause, id] of map) { const s = newSession(1, false); expect(earned(s, lose(s, cause), [])).toEqual([id]); }
  });
  it('a real lost landing earns too-fast', () => {
    const s = fresh(); const run = finishFlight(s, LOST);
    expect(earned(s, run, [])).toEqual(['too-fast']);
  });
  it('seen-it-all is returned in the same call that earns the 4th failure badge', () => {
    const s = newSession(1, false);
    expect(earned(s, lose(s, 'power'), ['signal-lost', 'vehicle-lost'])).toEqual(['lights-out']);
    expect(earned(s, lose(s, 'piloting'), ['signal-lost', 'vehicle-lost', 'lights-out'])).toEqual(['too-fast', 'seen-it-all']);
  });
  it('seen-it-all through award, across runs', () => {
    const s = newSession(1, false);
    expect(award(s, lose(s, 'comms'), false)).toEqual(['signal-lost']);
    expect(award(s, lose(s, 'power'), false)).toEqual(['lights-out']);
    expect(award(s, lose(s, 'mass'), false)).toEqual(['vehicle-lost']);
    expect(award(s, lose(s, 'hardware'), false)).toEqual([]);
    expect(award(s, lose(s, 'piloting'), false)).toEqual(['too-fast', 'seen-it-all']);
    expect(loadHeld().map((h) => h.id).sort()).toEqual([...FAILURES, 'seen-it-all'].sort());
  });
});

describe('once only and storage', () => {
  it('already-held ids are not returned again', () => {
    const s = newSession(1, false); const run = win(s);
    const all = earned(s, run, []);
    expect(earned(s, run, all)).toEqual([]);
    expect(award(s, run, false).sort()).toEqual([...all].sort());
    expect(award(s, run, false)).toEqual([]);
    expect(loadHeld()).toHaveLength(all.length);
  });
  it('award saves ids with the date earned', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const s = newSession(1, false); award(s, lose(s, 'comms'), false);
    expect(JSON.parse(store.get(KEY)!)).toEqual([{ id: 'signal-lost', at: 1234 }]);
    vi.restoreAllMocks();
  });
  it('award with quick=true returns [] and stores nothing', () => {
    const s = newSession(1, false);
    expect(award(s, win(s), true)).toEqual([]);
    expect(store.has(KEY)).toBe(false); expect(loadHeld()).toEqual([]);
  });
  it('loadHeld survives corrupt data', () => {
    for (const bad of ['{', '{}', '[{"id":"nope"}]', 'null', '42', '"landed"', '[null, 3, "landed"]']) {
      store.set(KEY, bad); expect(loadHeld()).toEqual([]);
    }
    store.set(KEY, '[{"id":"nope","at":1},{"id":"landed","at":2}]');
    expect(loadHeld()).toEqual([{ id: 'landed', at: 2 }]);
    store.set(KEY, '{');
    const s = newSession(1, false); expect(award(s, lose(s, 'comms'), false)).toEqual(['signal-lost']); // corrupt data is replaced, not a crash
  });
  it('loadHeld keeps the first of a repeated id', () => {
    store.set(KEY, '[{"id":"landed","at":1},{"id":"too-fast","at":2},{"id":"landed","at":3}]');
    expect(loadHeld()).toEqual([{ id: 'landed', at: 1 }, { id: 'too-fast', at: 2 }]);
  });
  it('saving keeps entries from a newer build, loading hides them', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5);
    store.set(KEY, '[{"id":"from-the-future","at":1},{"id":"landed","at":2}]');
    const s = newSession(1, false); expect(award(s, lose(s, 'comms'), false)).toEqual(['signal-lost']);
    expect(JSON.parse(store.get(KEY)!)).toEqual([{ id: 'from-the-future', at: 1 }, { id: 'landed', at: 2 }, { id: 'signal-lost', at: 5 }]);
    expect(loadHeld().map((h) => h.id)).toEqual(['landed', 'signal-lost']);
    vi.restoreAllMocks();
  });
  it('blocked storage does not re-award a badge within the page session', () => {
    blocked();
    const s = fresh(); const run = finishFlight(s, LANDED);
    expect(award(s, run, false)).toContain('landed');
    expect(award(s, run, false)).toEqual([]);
    expect(loadHeld().map((h) => h.id)).toContain('landed');
  });
  it('survives blocked storage', () => {
    blocked();
    expect(loadHeld()).toEqual([]);
    const s = newSession(1, false); expect(award(s, lose(s, 'comms'), false)).toEqual(['signal-lost']);
    expect(() => clearAchievements()).not.toThrow();
  });
  it('clearAchievements forgets everything', () => {
    const s = newSession(1, false); award(s, win(s), false);
    expect(loadHeld().length).toBeGreaterThan(0);
    clearAchievements(); expect(loadHeld()).toEqual([]); expect(store.has(KEY)).toBe(false);
  });
});

describe('the list', () => {
  it('has the 13 in the spec order', () => {
    expect(achievements.map((a) => a.id)).toEqual(['landed', 'first-try', 'picture-perfect', 'rough-ground', 'on-fumes', 'hands-on',
      'by-the-book', 'comeback', 'signal-lost', 'lights-out', 'vehicle-lost', 'too-fast', 'seen-it-all']);
    expect(achievements.filter((a) => a.failure).map((a) => a.id)).toEqual(FAILURES);
  });
  it('every achievement has EN and FR name, desc, hint', () => {
    for (const a of achievements) for (const pair of [a.name, a.desc, a.hint]) {
      expect(pair).toHaveLength(2);
      expect(pair[0].trim().length).toBeGreaterThan(0); expect(pair[1].trim().length).toBeGreaterThan(0);
      expect(pair[1]).not.toBe(pair[0]);
    }
    const byId = Object.fromEntries(achievements.map((a) => [a.id, a]));
    const causes: [AchievementId, Cause][] = [['signal-lost', 'comms'], ['lights-out', 'power'], ['vehicle-lost', 'mass'], ['too-fast', 'piloting']];
    for (const [id, cause] of causes) {
      expect(byId[id].desc[0]).toBe(endingFor(cause).avoid);
      expect(byId[id].name[0]).toBe(endingFor(cause).title);
    }
    expect(byId['landed'].name[0]).toBe('The Eagle has landed');
  });
});

describe('quickRun', () => {
  it('is true only when the URL has ?quick, whatever else it has', async () => {
    // achievements-ui pulls in the Mission Lab's preferences, which touch the page on load: give it a bare one
    vi.stubGlobal('document', { documentElement: {}, body: { dataset: {} } });
    const { quickRun } = await import('../src/ui/achievements-ui');
    vi.unstubAllGlobals();
    expect(quickRun('?quick=1')).toBe(true);
    expect(quickRun('?seed=3&quick=1')).toBe(true);
    expect(quickRun('')).toBe(false);
    expect(quickRun('?fly=1')).toBe(false);
  });
});
