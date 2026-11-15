import { describe, expect, it } from 'vitest';
import { apollo11Burns, apollo11Explanations, FT } from '../src/data/apollo11';
import gmat from '../src/data/apollo11-gmat.json';

const values = gmat.values as Record<string, number>;
const off = (b: (typeof apollo11Burns)[number]) => Math.abs(values[b.gmatKey] - b.nasa.value) / b.nasa.value;

describe('Apollo 11 burns', () => {
  it('every burn cites a NASA publication and page', () => {
    for (const b of apollo11Burns) {
      expect(b.nasa.value).toBeGreaterThan(0);
      expect(b.source.label).toMatch(/Apollo/);
      expect(b.source.label).toMatch(/NASA/);
      expect(b.source.page).not.toBe('');
      expect(b.source.status).toBe('verified');
    }
  });
  it('the NASA figures are the printed ones, converted from ft/s', () => {
    const by = Object.fromEntries(apollo11Burns.map((b) => [b.id, b.nasa.value]));
    expect(by.tli).toBeCloseTo(35567.3 * FT, 6);
    expect(by.loi1).toBeCloseTo(Math.hypot(327.12, 2361.28, 1681.85) * FT, 6);
    expect(by.loi2).toBeCloseTo(Math.hypot(92.53, 118.18, 51.61) * FT, 6);
  });
  it('GMAT recomputed every burn', () => {
    for (const b of apollo11Burns) expect(values[b.gmatKey]).toBeGreaterThan(0);
  });
  it('any burn more than 5% off NASA has a written cause, in both languages', () => {
    for (const b of apollo11Burns) {
      if (off(b) > 0.05) {
        expect(apollo11Explanations[b.id]?.en, `${b.id} is ${(off(b) * 100).toFixed(1)}% off`).toBeTruthy();
        expect(apollo11Explanations[b.id]?.fr).toBeTruthy();
      }
    }
  });
  it('GMAT reached the published orbits it was aimed at', () => {
    expect(values.peri_alt_nmi).toBeCloseTo(60.0, 1);
    expect(values.apo_after_loi1_nmi).toBeCloseTo(169.7, 1);
    expect(values.apo_after_loi2_nmi).toBeCloseTo(66.1, 1);
    expect(values.peri_after_loi2_nmi).toBeCloseTo(54.5, 1);
  });
});
