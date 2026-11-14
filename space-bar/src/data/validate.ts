import { EFFECT_KEYS, PHASES, ROLES, Chapter, ConflictRule, GameEvent, Question } from '../sim/types';

/** Cheap schema check so content mistakes fail loudly, not silently. Returns a list of problems. */
export function validateContent(c: { chapter: Chapter; questions: Question[]; conflicts: ConflictRule[]; events: GameEvent[] }): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  const allTags = new Set<string>();
  const effectOk = (where: string, e: Record<string, unknown>) => {
    for (const k of Object.keys(e)) {
      if (k === 'phaseRisk') { for (const p of Object.keys(e.phaseRisk as object)) if (!(PHASES as readonly string[]).includes(p)) errs.push(`${where}: bad phase ${p}`); }
      else if (!(EFFECT_KEYS as string[]).includes(k)) errs.push(`${where}: unknown effect ${k}`);
      else if (typeof e[k] !== 'number' || !Number.isFinite(e[k] as number)) errs.push(`${where}: effect ${k} is not a number`);
    }
  };
  for (const q of c.questions) {
    if (seen.has(q.id)) errs.push(`duplicate question id ${q.id}`);
    seen.add(q.id);
    if (q.chapter !== c.chapter.id) errs.push(`${q.id}: wrong chapter`);
    if (q.role !== 'crew' && !(ROLES as readonly string[]).includes(q.role)) errs.push(`${q.id}: bad role ${q.role}`);
    if ((q.kind === 'part') !== !!q.slot) errs.push(`${q.id}: a part needs a slot name, and only a part has one`);
    if (q.options.length < 2) errs.push(`${q.id}: needs at least 2 options`);
    if (!q.why) errs.push(`${q.id}: missing "why"`);
    const oids = new Set<string>();
    for (const o of q.options) {
      if (oids.has(o.id)) errs.push(`${q.id}: duplicate option ${o.id}`);
      oids.add(o.id);
      effectOk(`${q.id}/${o.id}`, o.effects as Record<string, unknown>);
      o.tags.forEach((t) => allTags.add(t));
    }
  }
  for (const r of c.conflicts) {
    effectOk(r.id, r.effects as Record<string, unknown>);
    for (const t of r.all) if (!allTags.has(t)) errs.push(`conflict ${r.id}: tag ${t} is on no option`);
  }
  for (const ev of c.events) {
    if (!ev.source?.label) errs.push(`event ${ev.id}: missing source`);
    for (const t of ev.mitigatedBy ?? []) if (!allTags.has(t)) errs.push(`event ${ev.id}: tag ${t} is on no option`);
  }
  return errs;
}
