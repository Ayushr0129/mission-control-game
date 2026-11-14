/**
 * The Mission Lab's parts, missions and readiness rules. No DOM in here, so the rules can be tested.
 */
import { performanceOf, solarScale } from './physics';
export type Category = 'Propulsion' | 'Structure' | 'Guidance' | 'Power' | 'Communications' | 'Payload';
export type Part = {
  id: string; category: Category; name: string; short: string;
  /** tonnes, fully fuelled */ mass: number; cost: number; power: number; tags: string[]; note: string;
  /** tonnes of propellant inside `mass` */ prop?: number;
  /** engines only: vacuum thrust in kN and specific impulse in seconds */ thrust?: number; isp?: number;
};
export type Profile = {
  id: string; name: string; destination: string; budget: number; massCap: number; powerNeed: number;
  /** km/s for the whole mission: about LAUNCH_DV to reach orbit, plus `transferNeed` from low orbit onwards */
  deltaVNeed: number; transferNeed: number; payload: string; science: string; accent: string;
  /** distance from the Sun in AU, for solar power */ sunAU: number;
};

export const profiles: Profile[] = [
  { id: 'earth', name: 'Earth Climate Watch', destination: 'Sun-synchronous orbit · 705 km', budget: 182, massCap: 410, powerNeed: 3.2, deltaVNeed: 9.8, transferNeed: 0.4, payload: 'satellite', science: 'Map sea level, aerosols and vegetation every 16 days.', accent: '#73b9ff', sunAU: 1 },
  { id: 'moon', name: 'Lunar Far-Side Relay', destination: 'Elliptical lunar orbit · 100 × 3,000 km', budget: 276, massCap: 500, powerNeed: 4.8, deltaVNeed: 12.7, transferNeed: 3.3, payload: 'satellite', science: 'Relay data from the radio-quiet far side of the Moon.', accent: '#d7dce4', sunAU: 1 },
  { id: 'mars', name: 'Mars Sample Scout', destination: 'Jezero region · 18.4°N, 77.6°E', budget: 486, massCap: 520, powerNeed: 4.1, deltaVNeed: 13.3, transferNeed: 3.9, payload: 'rover', science: 'Cache cores from an ancient river delta for later return.', accent: '#e1835c', sunAU: 1.52 },
  { id: 'saturn', name: 'Saturn Ring Surveyor', destination: 'Saturn polar orbit · ring plane crossings', budget: 740, massCap: 520, powerNeed: 3.4, deltaVNeed: 15.3, transferNeed: 5.9, payload: 'probe', science: 'Measure ring particles, shepherd moons and magnetosphere.', accent: '#e7c98a', sunAU: 9.58 },
];

export const parts: Part[] = [
  { id: 'fairing', category: 'Structure', name: 'Payload fairing', short: 'FAIRING', mass: 1.4, cost: 5.5, power: 0, tags: ['fairing'], note: 'Protects the payload through max-Q and is discarded above the sensible atmosphere.' },
  { id: 'adapter', category: 'Structure', name: 'Docking adapter', short: 'DOCK', mass: 0.42, cost: 8.2, power: -0.18, tags: ['dock'], note: 'Androgynous capture ring, range sensors and soft-capture latches.' },
  { id: 'tank', category: 'Propulsion', name: 'Cryogenic propellant tank', short: 'LOX / LH₂', mass: 25.8, prop: 24, cost: 18, power: 0, tags: ['tank'], note: 'High-energy upper-stage propellant. Adds range, but boil-off limits coast time.' },
  { id: 'booster', category: 'Propulsion', name: 'Reusable booster core', short: 'BOOSTER', mass: 330, prop: 312, thrust: 6200, isp: 300, cost: 42, power: 0, tags: ['engine', 'chemical', 'booster'], note: 'Nine throttleable engines provide pad thrust and recovery reserve.' },
  { id: 'vac', category: 'Propulsion', name: 'Vacuum transfer engine', short: 'VAC ENGINE', mass: 2.6, thrust: 1100, isp: 455, cost: 17.5, power: 0, tags: ['engine', 'chemical'], note: 'Expanding nozzle optimized for orbital insertion and departure burns.' },
  { id: 'kick', category: 'Propulsion', name: 'Storable-propellant kick stage', short: 'KICK STAGE', mass: 9, prop: 8, thrust: 60, isp: 325, cost: 13.6, power: 0, tags: ['engine', 'chemical'], note: 'A restartable stage for high-energy departure and planetary capture.' },
  { id: 'ion', category: 'Propulsion', name: 'Solar-electric cruise drive', short: 'ION DRIVE', mass: 1.75, prop: 1.4, thrust: 0.0009, isp: 3100, cost: 31, power: -2.4, tags: ['engine', 'deep-space'], note: 'Very low thrust over months produces exceptional deep-space delta-v.' },
  { id: 'rcs', category: 'Guidance', name: '16-thruster RCS quad set', short: 'RCS ×16', mass: 0.68, cost: 12.4, power: -0.28, tags: ['rcs'], note: 'Translation and rotation jets for proximity operations and docking.' },
  { id: 'computer', category: 'Guidance', name: 'Triple-redundant flight computer', short: 'GNC', mass: 0.19, cost: 15.8, power: -0.32, tags: ['computer'], note: 'Fuses star tracker, inertial and radar data; survives one computer failure.' },
  { id: 'wheels', category: 'Guidance', name: 'Reaction-wheel assembly', short: 'RW ×4', mass: 0.31, cost: 6.4, power: -0.48, tags: ['attitude'], note: 'Fine pointing without spending propellant; RCS unloads stored momentum.' },
  { id: 'solar', category: 'Power', name: 'Deployable solar wings', short: 'SOLAR 7.6 kW', mass: 1.8, cost: 14.2, power: 7.6, tags: ['power', 'solar'], note: 'Two articulated arrays sized at 1 AU. Output falls with distance from the Sun.' },
  { id: 'rtg', category: 'Power', name: 'Radioisotope power unit', short: 'RTG 1.2 kW', mass: 0.57, cost: 34, power: 1.2, tags: ['power', 'deep-space'], note: 'Continuous deep-space power independent of sunlight; high programme cost.' },
  { id: 'reactor', category: 'Power', name: 'Compact fission reactor', short: 'FISSION 5.5 kW', mass: 1.9, cost: 95, power: 5.5, tags: ['power', 'deep-space'], note: 'High, steady output for electric propulsion beyond the useful range of solar arrays.' },
  { id: 'battery', category: 'Power', name: 'Lithium-ion battery bank', short: 'BATTERY', mass: 0.44, cost: 4.8, power: 0.9, tags: ['battery'], note: 'Buffers eclipse, peak transmitter loads and rover deployment.' },
  { id: 'dish', category: 'Communications', name: 'High-gain steerable dish', short: 'X / Ka BAND', mass: 0.76, cost: 11.7, power: -0.72, tags: ['comms'], note: 'High-rate science downlink. Pointing accuracy is part of the link budget.' },
  { id: 'sat', category: 'Payload', name: 'Modular relay satellite', short: 'RELAY SAT', mass: 1.35, cost: 24, power: -1.6, tags: ['payload', 'satellite'], note: 'Optical crosslinks, X-band relay and a 5-year radiation design life.' },
  { id: 'rover', category: 'Payload', name: 'Autonomous geology rover', short: 'ROVER', mass: 1.92, cost: 58, power: -2.2, tags: ['payload', 'rover'], note: 'Six-wheel rocker-bogie chassis with coring drill and sample cache.' },
  { id: 'probe', category: 'Payload', name: 'Ring-plane science probe', short: 'RING PROBE', mass: 2.46, cost: 76, power: -2.8, tags: ['payload', 'probe'], note: 'Dust analyzer, magnetometer, wide-angle imager and armored electronics.' },
];

/** The parts every new design starts with, bottom of the stack first. No payload yet: that depends on the mission. */
export const starter = ['booster', 'vac', 'tank', 'tank', 'computer', 'rcs', 'wheels', 'solar', 'battery', 'dish', 'adapter', 'fairing'];
export const payloadPartId = (p: Profile) => p.payload === 'satellite' ? 'sat' : p.payload;
/**
 * A known-good vehicle for each mission, bottom of the stack first: booster, the upper stage's engine with the tanks
 * it burns stacked above it, then kick stages and the ion drive, then the spacecraft and the fairing on top.
 * The farther missions need more propellant, and power sources that still work far from the Sun.
 * Every baseline must pass `readinessOf` and reach orbit under the autopilot with enough delta-v left for the journey.
 */
const baselines: Record<string, string[]> = {
  earth: ['booster', 'vac', 'tank', 'computer', 'rcs', 'solar', 'battery', 'dish', 'PAYLOAD', 'fairing'],
  moon: ['booster', 'vac', 'tank', 'tank', 'tank', 'tank', 'kick', 'computer', 'rcs', 'wheels', 'solar', 'battery', 'dish', 'adapter', 'PAYLOAD', 'fairing'],
  mars: ['booster', 'vac', 'tank', 'tank', 'tank', 'kick', 'ion', 'computer', 'rcs', 'wheels', 'solar', 'rtg', 'reactor', 'battery', 'dish', 'adapter', 'PAYLOAD', 'fairing'],
  saturn: ['booster', 'vac', 'tank', 'tank', 'tank', 'tank', 'kick', 'ion', 'computer', 'rcs', 'wheels', 'reactor', 'reactor', 'battery', 'dish', 'adapter', 'PAYLOAD', 'fairing'],
};
export function baselineFor(p: Profile): string[] {
  return (baselines[p.id] ?? baselines.moon).map((id) => id === 'PAYLOAD' ? payloadPartId(p) : id);
}
export const partsOf = (partIds: string[]) => partIds.map((id) => parts.find((p) => p.id === id)).filter((p): p is Part => !!p);
/** Totals for the stack: mass and delta-v from the rocket equation, power with solar output scaled to the mission's distance from the Sun. */
export function sumsOf(partIds: string[], p?: Profile) {
  const list = partsOf(partIds), perf = performanceOf(list), sun = solarScale(p?.sunAU ?? 1);
  return {
    mass: perf.mass, deltaV: perf.deltaV, liftoffTwr: perf.liftoffTwr,
    cost: list.reduce((a, x) => a + x.cost, 0),
    power: list.reduce((a, x) => a + (x.tags.includes('solar') ? x.power * sun : x.power), 0),
  };
}
/** The least thrust-to-weight that gets off the pad with a sensible margin. */
export const MIN_LIFTOFF_TWR = 1.2;
/** km/s a well-flown launch spends reaching low orbit in this simulation, gravity losses included */
export const LAUNCH_DV = 9.4;
/** Everything still standing between this vehicle and flight. Empty means ready. */
export function readinessOf(p: Profile, partIds: string[]): string[] {
  const chosen = partsOf(partIds), t = sumsOf(partIds, p), missing: string[] = [];
  const has = (tag: string) => chosen.some((x) => x.tags.includes(tag));
  if (!has('engine')) missing.push('propulsion'); else if (t.liftoffTwr < MIN_LIFTOFF_TWR) missing.push('liftoff thrust');
  if (!has('computer')) missing.push('flight computer');
  if (!has('rcs')) missing.push('RCS'); if (!has('power')) missing.push('power source'); if (!has('comms')) missing.push('communications');
  if (!has(p.payload)) missing.push(`${p.payload} payload`); if (t.cost > p.budget) missing.push('budget margin');
  if (t.mass > p.massCap) missing.push('launch mass margin'); if (t.power < p.powerNeed) missing.push('power margin'); if (t.deltaV < p.deltaVNeed) missing.push('delta-v margin');
  return missing;
}
/** How a docking went: the RCS propellant left (0..100) and whether guidance flew it. */
export interface DockingResult { fuel: number; guided: boolean }
/** How a launch went: in orbit or not, the delta-v left (km/s) and whether the autopilot flew it. */
export interface LaunchOutcome { orbit: boolean; left: number; guided: boolean }
/** In orbit with enough delta-v left for the rest of the journey. */
export const launchMeetsMission = (p: Profile, l: LaunchOutcome | null | undefined) => !!l && l.orbit && l.left >= p.transferNeed;
export interface ScorePart { id: 'vehicle' | 'margins' | 'launch' | 'docking' | 'payload'; points: number; max: number }
export interface MissionScore { total: number; parts: ScorePart[] }

export const SCORE = {
  vehicle: 20, perIssue: 7, margins: 15, launch: 25, guidedLaunch: 15, shortLaunch: 5, docking: 20, guidedDocking: 12, fuelBonus: 5, payload: 20,
  /** km/s of spare delta-v beyond the journey's need that earns the whole launch bonus */
  spareDv: 1,
  /** headroom (share of the requirement or limit left over) that earns full margin credit */
  thin: 0.05, ample: 0.3, overbuilt: 1,
};

/**
 * Credit for one margin, 0..1. Negative headroom earns nothing; a margin run right at the limit earns half;
 * healthy headroom earns it all; headroom far beyond what the mission needs is overbuilding and fades to a fifth.
 */
export function marginCredit(headroom: number): number {
  const { thin, ample, overbuilt } = SCORE;
  if (headroom < 0) return 0;
  if (headroom < thin) return 0.5 + 0.5 * (headroom / thin);
  if (headroom <= ample) return 1;
  return Math.max(0.2, 1 - 0.8 * Math.min(1, (headroom - ample) / (overbuilt - ample)));
}

/** The debrief score, built up from what the mission actually achieved. Out of 100. */
export function scoreMission(p: Profile, partIds: string[], launch: LaunchOutcome | null, docking: DockingResult | null, deployed: boolean): MissionScore {
  const t = sumsOf(partIds, p), issues = readinessOf(p, partIds).length;
  const headroom = [(p.budget - t.cost) / p.budget, (p.massCap - t.mass) / p.massCap, (t.power - p.powerNeed) / p.powerNeed, (t.deltaV - p.deltaVNeed) / p.deltaVNeed];
  const spare = launch ? Math.min(1, Math.max(0, (launch.left - p.transferNeed) / SCORE.spareDv)) : 0;
  const flown = !launch || !launch.orbit ? 0 : !launchMeetsMission(p, launch) ? SCORE.shortLaunch
    : (launch.guided ? SCORE.guidedLaunch : SCORE.launch) - SCORE.fuelBonus + SCORE.fuelBonus * spare;
  const dock = docking ? (docking.guided ? SCORE.guidedDocking : SCORE.docking) - SCORE.fuelBonus + SCORE.fuelBonus * Math.min(1, Math.max(0, docking.fuel / 100)) : 0;
  const parts: ScorePart[] = [
    { id: 'vehicle', points: Math.max(0, SCORE.vehicle - SCORE.perIssue * issues), max: SCORE.vehicle },
    { id: 'margins', points: SCORE.margins * headroom.reduce((a, h) => a + marginCredit(h), 0) / headroom.length, max: SCORE.margins },
    { id: 'launch', points: flown, max: SCORE.launch },
    { id: 'docking', points: dock, max: SCORE.docking },
    { id: 'payload', points: deployed ? SCORE.payload : 0, max: SCORE.payload },
  ].map((x) => ({ ...x, points: Math.round(x.points) })) as ScorePart[];
  return { total: parts.reduce((a, x) => a + x.points, 0), parts };
}
