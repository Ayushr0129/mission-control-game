// Computes the game's Earth–Moon trip and writes src/data/trajectory.json.
// Planar restricted three-body model (src/sim/cr3bp.ts), solved to Apollo 11's published figures:
//   injection speed 35,567.3 ft/s (SP-4029), perilune 111 km (60 n mi), entry angle -6.48° (Apollo Flight Journal),
//   return coast 59.7 h (TEI 135:23:42 to entry interface 195:03:06).
// Run with: npm run trajectory
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveTrip } from '../src/sim/trip.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trip = solveTrip();
writeFileSync(join(root, 'src', 'data', 'trajectory.json'), JSON.stringify(trip) + '\n');
console.log('wrote src/data/trajectory.json', trip.meta);
