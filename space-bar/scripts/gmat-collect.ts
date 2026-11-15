// Reads GMAT's reports in gmat/output/ and writes the data the game imports:
//   gmat/transfers.json          (Earth-orbit and Moon-orbit journeys, km/s: kept as a record, the game does not import it)
//   src/data/apollo11-gmat.json  (Apollo 11: every report column by name, m/s), when gmat/output/apollo11.txt exists
// Writes nothing unless every report parses. Run with: npm run gmat:collect
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MISSIONS, buildTransfers, parseReport } from '../src/gmat/collect.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (name: string) => join(root, 'gmat', 'output', `${name}.txt`);

try {
  const readme = readFileSync(join(root, 'gmat', 'README.md'), 'utf8');
  const version = readme.match(/^# GMAT (\S+)/m)?.[1];
  if (!version) throw new Error('gmat/README.md must start with "# GMAT <version>"');
  const meta = { version, computed: process.env.GMAT_COMPUTED ?? new Date().toISOString().slice(0, 10) };

  const reports: Record<string, Record<string, number>> = {};
  for (const id of MISSIONS) if (existsSync(out(id))) reports[id] = parseReport(readFileSync(out(id), 'utf8'));
  const transfers = buildTransfers(meta, reports);

  let apollo: { gmat: typeof meta; values: Record<string, number> } | null = null;
  if (existsSync(out('apollo11'))) apollo = { gmat: meta, values: parseReport(readFileSync(out('apollo11'), 'utf8')) };

  // everything parsed: only now touch the game's data
  writeFileSync(join(root, 'gmat', 'transfers.json'), JSON.stringify(transfers, null, 2) + '\n');
  console.log('wrote gmat/transfers.json', Object.fromEntries(MISSIONS.map((id) => [id, +transfers.missions[id].total.toFixed(4)])));
  if (apollo) {
    writeFileSync(join(root, 'src', 'data', 'apollo11-gmat.json'), JSON.stringify(apollo, null, 2) + '\n');
    console.log('wrote src/data/apollo11-gmat.json', apollo.values);
  }
} catch (e) {
  console.error(`gmat-collect: ${(e as Error).message}. Nothing was written.`);
  process.exit(1);
}
