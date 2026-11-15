/**
 * Turns GMAT ReportFile output into the data the game ships. Pure functions, no Node APIs, so they can be tested.
 * A report has a header row of names and one or more rows of numbers; the last row is the result.
 * Anything malformed throws: the collector must never write a zero or a guess into the game's data.
 */

export interface GmatMeta { version: string; /** YYYY-MM-DD */ computed: string }
export const MISSIONS = ['earth', 'moon'] as const;
export type MissionId = (typeof MISSIONS)[number];
export interface MissionTransfer { /** km/s, keyed by burn name */ burns: Record<string, number>; /** km/s */ total: number; script: string }
export interface GmatTransfers { gmat: GmatMeta; missions: Record<MissionId, MissionTransfer> }

export function parseReport(text: string): Record<string, number> {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0).map((l) => l.split(/\s+/));
  if (rows.length === 0) throw new Error('GMAT report has no header row');
  const [header, ...data] = rows;
  if (data.length === 0) throw new Error(`GMAT report has a header (${header.join(', ')}) but no data row`);
  const last = data[data.length - 1];
  if (last.length !== header.length) throw new Error(`GMAT report has ${header.length} header columns but ${last.length} values in its last row`);
  const out: Record<string, number> = {};
  header.forEach((name, i) => {
    const v = Number(last[i]);
    if (!Number.isFinite(v)) throw new Error(`GMAT report value for ${name} is not a number: ${last[i]}`);
    out[name] = v;
  });
  return out;
}

/** The burns of a report are its `dv_` columns, in km/s; everything else (epochs, checks) is ignored here. */
export function burnsOf(report: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(report).filter(([k]) => k.startsWith('dv_')).map(([k, v]) => [k.slice(3), v]));
}

export function buildTransfers(meta: GmatMeta, reports: Record<string, Record<string, number>>): GmatTransfers {
  const missions = {} as Record<MissionId, MissionTransfer>;
  for (const id of MISSIONS) {
    const report = reports[id];
    if (!report) throw new Error(`GMAT report for ${id} is missing (expected gmat/output/${id}.txt)`);
    const burns = burnsOf(report);
    if (Object.keys(burns).length === 0) throw new Error(`GMAT report for ${id} has no dv_ columns`);
    missions[id] = { burns, total: Object.values(burns).reduce((a, b) => a + b, 0), script: `gmat/${id}.script` };
  }
  return { gmat: meta, missions };
}
