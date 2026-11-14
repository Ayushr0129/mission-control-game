import { content, endingFor, lessonWatch } from '../data';
import { computeTotals, simulate, survivalChance } from '../sim/simulate';
import { drawEvents, initialMeters, resolveRun, RunResolution, HardEnd } from '../sim/meters';
import { hashSeed } from '../sim/rng';
import { gradeChapter, Grade } from '../sim/grade';
import { Cause, Decisions, FlownResult, GameEvent, Meters, Option, Outcome, Question, Totals } from '../sim/types';
import { storyOrder, slotOrder, CABIN } from '../data/story';

const { chapter, questions, conflicts, events } = content;

export interface Lesson { id: string; runNo: number; cause: Cause; text: string; watch: string[] }
export interface Run {
  no: number; seed: number; events: GameEvent[]; decisions: Decisions;
  outcome?: Outcome; resolution?: RunResolution; livestream?: boolean;
  /** how many of the build's interruptions (news, the cabin scare, news) have been shown */
  fired: number;
}
export interface Session {
  baseSeed: number; meters: Meters; runs: Run[]; current: Run; lessons: Lesson[];
  grade?: Grade; hardEnd?: HardEnd;
}

const LKEY = 'rttm.lessons.v1';
function load(): Lesson[] { try { return JSON.parse(localStorage.getItem(LKEY) || '[]'); } catch { return []; } }
function save(l: Lesson[]) { try { localStorage.setItem(LKEY, JSON.stringify(l)); } catch { /* storage may be blocked */ } }
export function clearLessons() { try { localStorage.removeItem(LKEY); } catch { /* ignore */ } }

export function newRun(baseSeed: number, no: number): Run {
  const seed = hashSeed(baseSeed, no);
  return { no, seed, events: drawEvents(events, seed, chapter.eventsPerRun), decisions: {}, fired: 0 };
}
/** Fresh world, lessons kept (design doc 4.6). */
export function newSession(baseSeed = Math.floor(Math.random() * 1e9), keepLessons = true): Session {
  return { baseSeed, meters: initialMeters(chapter), runs: [], current: newRun(baseSeed, 1), lessons: keepLessons ? load() : [] };
}

export function answer(s: Session, qid: string, oid: string) { s.current.decisions[qid] = oid; }

export function totalsFor(s: Session, extra?: Decisions): Totals {
  return computeTotals(chapter, questions, conflicts, { ...s.current.decisions, ...extra });
}
export function survival(s: Session, extra?: Decisions) { return survivalChance(chapter, totalsFor(s, extra), s.current.events); }

export function warningsFor(s: Session, tags: string[]): Lesson[] {
  return s.lessons.filter((l) => l.watch.some((w) => tags.includes(w)));
}

// ---------------- building ----------------
/** Every spot needs a part, except docking on the lander that never docks. */
export function slotNeeded(qid: string, tags: string[]): boolean { return !(qid === 'eng-docking' && tags.includes('route-direct')); }
export function neededSlots(s: Session): string[] { const tags = totalsFor(s).tags; return slotOrder.filter((q) => slotNeeded(q, tags)); }
/** Fit or swap a part. A docking system already fitted comes off again if the new lander never docks. */
export function setPart(s: Session, qid: string, oid: string) {
  s.current.decisions[qid] = oid;
  for (const q of slotOrder) if (!slotNeeded(q, totalsFor(s).tags)) delete s.current.decisions[q];
}
export function filled(s: Session): number { return neededSlots(s).filter((q) => s.current.decisions[q]).length; }

/** The world does not wait for the build: news, then the cabin scare, then more news. */
export type Interrupt = { t: 'news'; ev: GameEvent } | { t: 'scene'; qid: string };
function interrupts(s: Session): Interrupt[] {
  const news = s.current.events.map((ev): Interrupt => ({ t: 'news', ev }));
  return [...news.slice(0, 1), { t: 'scene', qid: CABIN }, ...news.slice(1)];
}
/** The next interruption if enough parts are on (or if `force`, whatever is left). Null when there is none. */
export function pendingInterrupt(s: Session, force = false): Interrupt | null {
  const list = interrupts(s), i = s.current.fired;
  if (i >= list.length) return null;
  const threshold = i < 2 ? 2 + i : Math.max(4, neededSlots(s).length - 1);
  return force || filled(s) >= threshold ? list[i] : null;
}
export function markFired(s: Session) { s.current.fired++; }
export function seenEvents(s: Session): GameEvent[] {
  return interrupts(s).slice(0, s.current.fired).filter((i): i is Extract<Interrupt, { t: 'news' }> => i.t === 'news').map((i) => i.ev);
}
const storyIds = () => [...storyOrder, CABIN];
/** Ready to roll out: the story decisions are made, every needed spot has a part, and the world has had its say. */
export function isReady(s: Session): boolean {
  const d = s.current.decisions;
  return storyIds().every((q) => d[q]) && neededSlots(s).every((q) => d[q]) && s.current.fired >= interrupts(s).length;
}
/** How far through the work this run is, 0..1. Drives the calendar. */
export function progressOf(s: Session): number {
  const d = s.current.decisions, need = neededSlots(s).length;
  const done = storyIds().filter((q) => d[q]).length + filled(s) + seenEvents(s).length;
  return Math.min(1, done / (storyIds().length + need + s.current.events.length));
}
/** What was actually chosen, in the questions' own order. Old or unknown answers are skipped. */
export function answered(decisions: Decisions): { q: Question; opt: Option }[] {
  return questions.flatMap((q) => { const opt = q.options.find((o) => o.id === decisions[q.id]); return opt ? [{ q, opt }] : []; });
}

// ---------------- flying ----------------
const simInput = (run: Run) => ({ chapter, questions, conflicts, decisions: run.decisions, seed: run.seed, events: run.events });
/** How the flight stands so far, given what has been flown. Changes nothing. */
export function peek(s: Session, flown: FlownResult): Outcome { return simulate(simInput(s.current), flown); }

/** The flight is over: settle the outcome, the world meters, the lesson and the grade. */
export function finishFlight(s: Session, flown: FlownResult): Run {
  const run = s.current;
  const outcome = simulate(simInput(run), flown);
  run.outcome = outcome;
  run.livestream = outcome.totals.tags.includes('livestream'); // live TV rides with the full science package
  run.resolution = resolveRun(s.meters, chapter, outcome.totals, outcome, run.events, run.livestream);
  s.meters = run.resolution.meters;
  s.hardEnd = outcome.success ? null : run.resolution.hardEnd; // a landing completes the chapter
  if (!outcome.success && outcome.cause) {
    const e = endingFor(outcome.cause);
    if (!s.lessons.some((l) => l.cause === outcome.cause)) {
      s.lessons.push({ id: `${outcome.cause}-${run.no}`, runNo: run.no, cause: outcome.cause, text: e.lessonText, watch: lessonWatch[outcome.cause] });
      save(s.lessons);
    }
  }
  if (outcome.success) {
    s.grade = gradeChapter(chapter, s.meters, outcome.totals, outcome.totals.conflicts.length, conflicts.length, run.resolution.late);
  }
  s.runs.push(run);
  return run;
}

/** Try again: the rocket stands as it was left. The story decisions, the news and the landing site are new. */
export function retry(s: Session) {
  const last = s.runs[s.runs.length - 1];
  s.current = newRun(s.baseSeed, s.runs.length + 1);
  if (last) for (const q of slotOrder) if (last.decisions[q]) s.current.decisions[q] = last.decisions[q];
}

export function daysLeft(s: Session) { return Math.max(0, chapter.deadlineDay - s.meters.day); }

// ---------------- share / leaderboard (client only) ----------------
export interface Shared { v: 1; grade: string; score: number; runs: number; day: number; decisions: Decisions; at: number }
export function encodeShare(s: Session): string {
  const r = s.runs[s.runs.length - 1];
  const d: Shared = { v: 1, grade: s.grade?.letter ?? '-', score: Math.round(s.grade?.score ?? 0), runs: s.runs.length, day: Math.round(s.meters.day), decisions: r.decisions, at: Date.now() };
  return btoa(unescape(encodeURIComponent(JSON.stringify(d))));
}
export function decodeShare(h: string): Shared | null {
  try { const d = JSON.parse(decodeURIComponent(escape(atob(h)))); return d && d.v === 1 && d.decisions ? d : null; } catch { return null; }
}
const BKEY = 'rttm.board.v1';
export function board(): Shared[] { try { return JSON.parse(localStorage.getItem(BKEY) || '[]'); } catch { return []; } }
export function addToBoard(s: Session) {
  const r = s.runs[s.runs.length - 1]; if (!s.grade) return;
  const list = board(); list.push({ v: 1, grade: s.grade.letter, score: Math.round(s.grade.score), runs: s.runs.length, day: Math.round(s.meters.day), decisions: r.decisions, at: Date.now() });
  list.sort((a, b) => b.score - a.score);
  try { localStorage.setItem(BKEY, JSON.stringify(list.slice(0, 8))); } catch { /* ignore */ }
}
