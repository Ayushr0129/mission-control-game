import { describe, it, expect } from 'vitest';
import { content } from '../src/data';
import { storyOrder, slotOrder, CABIN } from '../src/data/story';
import { Decisions } from '../src/sim/types';
import {
  Session, newSession, answer, setPart, neededSlots, filled, pendingInterrupt, markFired, isReady, progressOf, seenEvents,
  peek, finishFlight, retry, answered, decodeShare, slotNeeded,
} from '../src/game/session';

const BASIC: Decisions = {
  'mgr-funding': 'modest', 'mgr-schedule': 'steady', 'eng-cabin': 'fix', 'nav-route': 'lor', 'eng-docking': 'basic',
  'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave',
};
const LOST = { liftoff: 'fair', orbit: 'fair', landing: { landed: false, tries: 2, site: 'flat', speed: 12, fuelLeft: 0 } } as const;
const LANDED = { liftoff: 'fair', orbit: 'fair', landing: { landed: true, tries: 1, site: 'flat', speed: 3, fuelLeft: 0.3 } } as const;

/** answer the story, fit every part, and let the world have its say */
function build(s: Session, d: Decisions) {
  for (const q of [...storyOrder, CABIN]) answer(s, q, d[q]);
  for (const q of slotOrder) if (d[q]) setPart(s, q, d[q]);
  while (pendingInterrupt(s, true)) markFired(s);
}
/** a world whose first flight with the basic build does not break on the coast or the trip home */
function fresh(): Session {
  for (let seed = 1; seed < 500; seed++) {
    const s = newSession(seed, false); build(s, BASIC);
    if (peek(s, {}).success) return newSession(seed, false);
  }
  throw new Error('no quiet seed');
}

describe('building', () => {
  it('the lander that never docks needs no docking, and drops one already fitted', () => {
    const s = fresh(); setPart(s, 'nav-route', 'lor'); setPart(s, 'eng-docking', 'robust');
    expect(neededSlots(s)).toContain('eng-docking');
    setPart(s, 'nav-route', 'direct');
    expect(neededSlots(s)).not.toContain('eng-docking');
    expect(s.current.decisions['eng-docking']).toBeUndefined();
    expect(slotNeeded('eng-docking', ['route-eor'])).toBe(true);
    setPart(s, 'eng-docking', 'robust'); // a stray click on the spot that is not needed
    expect(s.current.decisions['eng-docking']).toBeUndefined();
  });
  it('interrupts the build in order and only once each', () => {
    const s = fresh(); setPart(s, 'nav-route', 'lor');
    expect(pendingInterrupt(s)).toBeNull();
    setPart(s, 'eng-power', 'standard');
    expect(pendingInterrupt(s)).toMatchObject({ t: 'news', ev: s.current.events[0] }); markFired(s);
    expect(seenEvents(s)).toEqual([s.current.events[0]]);
    expect(pendingInterrupt(s)).toBeNull();
    setPart(s, 'sci-antenna', 'small');
    expect(pendingInterrupt(s)).toEqual({ t: 'scene', qid: 'eng-cabin' }); markFired(s);
    expect(pendingInterrupt(s)).toBeNull();
    expect(pendingInterrupt(s, true)).toMatchObject({ t: 'news', ev: s.current.events[1] }); markFired(s);
    expect(pendingInterrupt(s, true)).toBeNull();
    expect(seenEvents(s)).toEqual(s.current.events);
  });
  it('swapping a part does not bring an interruption back', () => {
    const s = fresh(); setPart(s, 'nav-route', 'lor'); setPart(s, 'eng-power', 'standard'); markFired(s);
    setPart(s, 'eng-power', 'extra'); setPart(s, 'eng-power', 'battery');
    expect(filled(s)).toBe(2); expect(pendingInterrupt(s)).toBeNull();
  });
  it('is ready only when story, parts and interruptions are all done', () => {
    const s = fresh(); build(s, BASIC);
    expect(isReady(s)).toBe(true); expect(progressOf(s)).toBe(1);
    delete s.current.decisions['sci-antenna']; expect(isReady(s)).toBe(false);
    const t = fresh(); for (const q of [...storyOrder, CABIN]) answer(t, q, BASIC[q]); for (const q of slotOrder) setPart(t, q, BASIC[q]);
    expect(isReady(t)).toBe(false); // the world has not interrupted yet
    expect(progressOf(fresh())).toBe(0);
  });
});

describe('flying', () => {
  it('a retry keeps the rocket and nothing else', () => {
    const s = fresh(); build(s, BASIC); answer(s, 'sci-site', 'flat');
    finishFlight(s, LOST); retry(s);
    expect(s.current.decisions).toEqual({ 'nav-route': 'lor', 'eng-docking': 'basic', 'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave' });
    expect(s.current.fired).toBe(0);
    expect(isReady(s)).toBe(false);
  });
  it('a lost landing teaches a piloting lesson and is not livestreamed without live TV', () => {
    const s = fresh(); build(s, BASIC); answer(s, 'sci-site', 'flat');
    const before = { ...s.meters };
    const run = finishFlight(s, LOST);
    expect(run.outcome!.cause).toBe('piloting'); expect(run.livestream).toBe(false);
    expect(s.lessons.some((l) => l.cause === 'piloting')).toBe(true);
    expect(s.meters.trust).toBeLessThan(before.trust); expect(s.grade).toBeUndefined();
  });
  it('a landing completes the chapter, and live TV is the broadcast', () => {
    const s = fresh(); build(s, { ...BASIC, 'sci-instruments': 'full', 'sci-antenna': 'large', 'eng-power': 'extra' }); answer(s, 'sci-site', 'flat');
    const o = peek(s, LANDED);
    if (o.success) { const run = finishFlight(s, LANDED); expect(run.livestream).toBe(true); expect(s.grade).toBeDefined(); }
    else expect(['coast', 'return', 'launch', 'orbit', 'landing']).toContain(o.failedPhase);
  });
  it('peek changes nothing', () => {
    const s = fresh(); build(s, BASIC); const before = JSON.stringify(s);
    peek(s, { liftoff: 'clean' }); expect(JSON.stringify(s)).toBe(before);
  });
  it('a flight that ends before the site is picked still settles', () => {
    const s = fresh(); build(s, { ...BASIC, 'nav-route': 'direct', 'eng-power': 'extra', 'sci-antenna': 'large', 'sci-instruments': 'full', 'eng-cabin': 'redesign' });
    const run = finishFlight(s, { liftoff: 'clean' });
    expect(run.outcome!.failedPhase).toBe('launch'); expect(run.decisions['sci-site']).toBeUndefined();
    expect(answered(run.decisions).every((a) => a.opt && a.q)).toBe(true);
    expect(answered(run.decisions).some((a) => a.q.id === 'sci-site')).toBe(false);
  });
});

describe('old and odd data', () => {
  it('lists only what was actually answered', () => {
    expect(answered({ 'nav-route': 'lor', 'vote-bold': 'bold', 'eng-power': 'nope' }).map((a) => a.q.id)).toEqual(['nav-route']);
  });
  it('still opens a share link made before the change', () => {
    const old = btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, grade: 'A', score: 80, runs: 2, day: 2000, decisions: { 'vote-bold': 'bold', 'nav-route': 'lor' }, at: 1 }))));
    expect(decodeShare(old)!.decisions['nav-route']).toBe('lor');
    expect(answered(decodeShare(old)!.decisions).map((a) => a.q.id)).toEqual(['nav-route']);
    expect(decodeShare('not a link')).toBeNull();
  });
  it('every question that can be answered has a known id', () => {
    expect(content.questions.map((q) => q.id).sort()).toEqual([...storyOrder, CABIN, ...slotOrder, 'sci-site'].sort());
  });
});
