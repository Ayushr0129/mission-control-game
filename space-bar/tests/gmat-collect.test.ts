import { describe, expect, it } from 'vitest';
import { buildTransfers, parseReport } from '../src/gmat/collect';

describe('parseReport', () => {
  it('reads the last data row by header name', () => {
    expect(parseReport('dv_TLI   dv_LOI\n3.1   0.9\n3.15   0.92\n')).toEqual({ dv_TLI: 3.15, dv_LOI: 0.92 });
  });
  it('accepts GMAT scientific notation and surrounding blank lines', () => {
    expect(parseReport('\n  dv_raise1    dv_raise2  \n  1.4256e-01   1.3990e-01\n\n')).toEqual({ dv_raise1: 0.14256, dv_raise2: 0.1399 });
  });
  it('rejects an empty report', () => { expect(() => parseReport('')).toThrow(/header/); });
  it('rejects a header with no data', () => { expect(() => parseReport('dv_TLI\n')).toThrow(/data/); });
  it('rejects a non-numeric value', () => { expect(() => parseReport('dv_TLI\nNaN\n')).toThrow(/dv_TLI/); });
  it('rejects a column count mismatch', () => { expect(() => parseReport('a b\n1\n')).toThrow(/column/); });
});

describe('buildTransfers', () => {
  const meta = { version: 'R0000a', computed: '2026-11-14' };
  const ok = { earth: { dv_raise1: 0.1, dv_raise2: 0.2, epoch: 1 }, moon: { dv_TLI: 3, dv_LOI: 0.5 } };
  it('sums the dv_ columns and drops the prefix', () => {
    const t = buildTransfers(meta, ok);
    expect(t.gmat).toEqual(meta);
    expect(t.missions.earth.burns).toEqual({ raise1: 0.1, raise2: 0.2 });
    expect(t.missions.earth.total).toBeCloseTo(0.3);
    expect(t.missions.moon.script).toBe('gmat/moon.script');
    expect(Object.keys(t.missions)).toEqual(['earth', 'moon']);
  });
  it('refuses a missing mission', () => {
    const { moon: _moon, ...rest } = ok;
    expect(() => buildTransfers(meta, rest)).toThrow(/moon/);
  });
  it('refuses a mission with no burns', () => { expect(() => buildTransfers(meta, { ...ok, moon: { epoch: 1 } })).toThrow(/moon/); });
});
