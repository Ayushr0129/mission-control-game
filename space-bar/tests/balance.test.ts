import { describe, it, expect } from 'vitest';
import { content } from '../src/data';
import { computeTotals, simulate, survivalChance } from '../src/sim/simulate';
import { Decisions } from '../src/sim/types';

const { chapter, questions, conflicts, events } = content;

// every story decision crossed with every part, landing on the plain. Docking is left off the lander that never docks,
// because the build screen does not offer it there.
const built = questions.filter((q) => q.kind !== 'flight');
function* allDesigns(i = 0, cur: Decisions = { 'sci-site': 'flat' }): Generator<Decisions> {
  if (i === built.length) { yield { ...cur }; return; }
  const q = built[i];
  if (q.id === 'eng-docking' && cur['nav-route'] === 'direct') { delete cur[q.id]; yield* allDesigns(i + 1, cur); return; }
  for (const o of q.options) { cur[q.id] = o.id; yield* allDesigns(i + 1, cur); }
}

describe('balance (exhaustive over every possible design)', () => {
  const stats: Record<string, { n: number; viable: number; sum: number }> = {};
  let total = 0, viable = 0, best = 0, bestD: Decisions = {};
  const causes: Record<string, number> = {};
  for (const d of allDesigns()) {
    total++;
    const t = computeTotals(chapter, questions, conflicts, d);
    const phys = simulate({ chapter, questions, conflicts, decisions: d, seed: 1, events: [] });
    // physical viability = no physical check fails. What is left is the dice on the coast and the trip home, and the flying.
    const ok = phys.cause === null || phys.cause === 'hardware';
    if (!ok) causes[phys.cause!] = (causes[phys.cause!] ?? 0) + 1;
    const s = ok ? survivalChance(chapter, t, []) : 0;
    if (ok) viable++;
    if (s > best) { best = s; bestD = d; }
    for (const [q, o] of Object.entries(d)) { const k = `${q}/${o}`; const r = (stats[k] ??= { n: 0, viable: 0, sum: 0 }); r.n++; r.sum += s; if (ok) r.viable++; }
  }
  it('reports', () => {
    console.log(`designs: ${total}, physically viable: ${(100 * viable / total).toFixed(1)}%, failure causes:`, causes);
    console.log('best survival', best.toFixed(3), JSON.stringify(bestD));
    for (const [k, r] of Object.entries(stats)) console.log(k.padEnd(28), `viable ${(100 * r.viable / r.n).toFixed(0)}%  mean survival ${(r.sum / r.n).toFixed(2)}`);
    expect(total).toBeGreaterThan(1000);
  });
  it('is neither trivial nor hopeless', () => {
    expect(viable / total).toBeGreaterThan(0.25);
    expect(viable / total).toBeLessThan(0.9);
  });
  it('has no single option that every viable design needs, or that kills all designs', () => {
    for (const [k, r] of Object.entries(stats)) { expect(r.viable, k).toBeGreaterThan(0); expect(r.viable / r.n, k).toBeGreaterThan(0.05); }
  });
});
