import { describe, expect, it } from 'vitest';
import { canFly } from '../src/domain/canFly';
import { SOURCE_DOCUMENTS, TRUTH_MISSIONS, TRUTH_ROCKETS, truthMissionById, truthRocketById, validateTruthData } from '../src/data/truth';

const mission = (id: string) => {
  const value = truthMissionById(id);
  if (!value) throw new Error(`Missing mission ${id}`);
  return value;
};
const rocket = (id: string) => {
  const value = truthRocketById(id);
  if (!value) throw new Error(`Missing rocket ${id}`);
  return value;
};

describe('truth data provenance', () => {
  it('validates every truth-layer figure and classification', () => {
    expect(validateTruthData()).toEqual({ valid: true, errors: [] });
  });

  it('registers a local archive path for every source', () => {
    for (const source of SOURCE_DOCUMENTS) expect(source.localPath).toMatch(/^(data\/sources|docs)\//);
  });

  it('never exposes an unsourced numeric or date field', () => {
    for (const record of [...TRUTH_ROCKETS, ...TRUTH_MISSIONS]) {
      for (const [key, field] of Object.entries(record)) {
        if (key === 'id' || key === 'name') continue;
        expect(field).toHaveProperty('source.document');
        expect(field).toHaveProperty('source.location');
        expect(field).toHaveProperty('source.retrieved', '2026-11-14');
      }
    }
  });
});

describe('canFly truth table', () => {
  it('allows Saturn V for a crewed Moon landing and return', () => {
    expect(canFly(mission('apollo-11'), rocket('saturn-v'), 40_000).allowed).toBe(true);
  });

  it.each(['falcon-9', 'falcon-heavy', 'discovery'])('denies %s for a crewed Moon landing and return', (rocketId) => {
    expect(canFly(mission('apollo-11'), rocket(rocketId), 1_000).allowed).toBe(false);
  });

  it('allows Redstone suborbital but denies orbit', () => {
    expect(canFly(mission('redstone-suborbital'), rocket('mercury-redstone'), 1_000).allowed).toBe(true);
    expect(canFly(mission('mercury-orbit'), rocket('mercury-redstone'), 1_000).allowed).toBe(false);
  });

  it('allows Atlas orbit and Discovery Hubble deployment', () => {
    expect(canFly(mission('mercury-orbit'), rocket('mercury-atlas'), 1_000).allowed).toBe(true);
    expect(canFly(mission('hubble-deployment'), rocket('discovery'), 10_000).allowed).toBe(true);
  });

  it('denies a post-1957 vehicle historically but allows it in What-if mode', () => {
    expect(canFly(mission('sputnik-1'), rocket('falcon-9'), 50, 'historical').allowed).toBe(false);
    expect(canFly(mission('sputnik-1'), rocket('falcon-9'), 50, 'what-if').allowed).toBe(true);
  });

  it('keeps Starship experimental', () => {
    expect(rocket('starship').status.value).toBe('test-flight');
    expect(canFly(mission('apollo-11'), rocket('starship'), 1_000).warnings).toContain('Starship is classified as a test-flight vehicle, not operational.');
  });
});
