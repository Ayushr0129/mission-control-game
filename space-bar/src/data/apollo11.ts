/**
 * Apollo 11's two big trajectory events, as NASA published them, for the campaign report's "What really happened".
 * Every figure cites its NASA publication and page. ft/s are converted to m/s with 0.3048; the printed value is kept
 * alongside. GMAT recomputes each event (gmat/apollo11.script) and the report shows both, NASA's first.
 *
 * Sources:
 *  - Apollo by the Numbers, NASA SP-2000-4029 (2000), Apollo 11 chapter. PDF pages refer to
 *    https://www.nasa.gov/wp-content/uploads/2023/04/sp-4029.pdf
 *  - Apollo 11 Mission Report, MSC-00171 (November 1969), NASA Technical Reports Server 19700008096,
 *    Table 8.6-II "Maneuver summary", report page 8-12 (PDF page 141).
 */
import type { SourceRef } from '../sim/types';

export const FT = 0.3048;
export interface Apollo11Source extends SourceRef { page: string }
export const SP4029: Omit<Apollo11Source, 'page'> = { label: 'Apollo by the Numbers, NASA SP-2000-4029', url: 'https://www.nasa.gov/wp-content/uploads/2023/04/sp-4029.pdf', status: 'verified', retrieved: '2026-11-14' };
export const MSC00171: Omit<Apollo11Source, 'page'> = { label: 'Apollo 11 Mission Report, NASA MSC-00171', url: 'https://ntrs.nasa.gov/citations/19700008096', status: 'verified', retrieved: '2026-11-14' };

/** Earth parking orbit at insertion, 000:11:49.34 (SP-4029 PDF p. 102): 100.4 by 98.9 n mi, 32.521°. */
export const apollo11Parking = { apogeeNmi: 100.4, perigeeNmi: 98.9, inclinationDeg: 32.521, source: { ...SP4029, page: 'PDF p. 102' } };
/** Lunar orbits after each insertion burn (SP-4029 PDF p. 103): 169.7 by 60.0 n mi, then 66.1 by 54.5 n mi. */
export const apollo11LunarOrbits = {
  afterLoi1: { apoNmi: 169.7, periNmi: 60.0 }, afterLoi2: { apoNmi: 66.1, periNmi: 54.5 },
  source: { ...SP4029, page: 'PDF p. 103' },
};

export type Apollo11BurnId = 'tli' | 'loi1' | 'loi2';
export interface Apollo11Burn {
  id: Apollo11BurnId; label: string; labelFr: string;
  /**
   * What NASA published for this burn, in m/s. For the two service-engine burns this is the velocity change
   * (from its three components in Table 8.6-II). For the trans-lunar injection, fired by the Saturn V's third stage,
   * the publications give the speed reached at injection rather than a single velocity change, so the comparison
   * is speed reached against speed reached.
   */
  nasa: { kind: 'dv' | 'speedAfter'; value: number; printed: string };
  durationS: number;
  /** GMAT's report column holding the comparable figure, m/s */
  gmatKey: string;
  source: Apollo11Source;
}

const mag = (x: number, y: number, z: number) => Math.hypot(x, y, z);

export const apollo11Burns: Apollo11Burn[] = [
  {
    id: 'tli', label: 'Trans-lunar injection (Saturn V third stage)', labelFr: 'Injection translunaire (troisième étage de la Saturn V)',
    // ignition 002:44:16.20, shutdown 002:50:03.03; injection at 35,567.3 ft/sec
    nasa: { kind: 'speedAfter', value: 35567.3 * FT, printed: '35,567.3 ft/sec at injection' },
    durationS: 346.83, gmatKey: 'v_tli', source: { ...SP4029, page: 'PDF p. 102' },
  },
  {
    id: 'loi1', label: 'Lunar orbit insertion', labelFr: "Insertion en orbite lunaire",
    // Table 8.6-II, actual components +327.12, +2361.28, +1681.85 ft/sec; 357.53 s from 75:49:50.37
    nasa: { kind: 'dv', value: mag(327.12, 2361.28, 1681.85) * FT, printed: '+327.12 / +2361.28 / +1681.85 ft/sec (components)' },
    durationS: 357.53, gmatKey: 'dv_loi1', source: { ...MSC00171, page: 'Table 8.6-II, p. 8-12' },
  },
  {
    id: 'loi2', label: 'Lunar orbit circularization', labelFr: "Circularisation de l'orbite lunaire",
    // Table 8.6-II, actual components +92.53, +118.18, +51.61 ft/sec; 16.88 s from 80:11:36.75
    nasa: { kind: 'dv', value: mag(92.53, 118.18, 51.61) * FT, printed: '+92.53 / +118.18 / +51.61 ft/sec (components)' },
    durationS: 16.88, gmatKey: 'dv_loi2', source: { ...MSC00171, page: 'Table 8.6-II, p. 8-12' },
  },
];

/**
 * The written cause for any burn where GMAT and NASA differ by more than 5%. The game always shows NASA's figure.
 * loi2: GMAT gives 42.7 m/s against NASA's measured 48.4 m/s (-11.7%), while reaching the same 66.1 x 54.5 n mi orbit.
 */
export const apollo11Explanations: Partial<Record<Apollo11BurnId, { en: string; fr: string }>> = {
  loi2: {
    en: 'GMAT\'s Moon here is a smooth sphere. NASA\'s Mission Report notes the Moon\'s uneven gravity moved Apollo 11\'s orbit by miles within a day, so the orbit the crew burned from two revolutions after insertion was not the clean 169.7 × 60.0 n mi orbit the recreation starts from. The real burn was also placed to set the low point over 80° W for the landing site, and lasted 16.9 seconds rather than an instant.',
    fr: "Ici, la Lune de GMAT est une sphère lisse. Le rapport de mission de la NASA indique que la gravité irrégulière de la Lune a déplacé l'orbite d'Apollo 11 de plusieurs milles en une journée : l'orbite à partir de laquelle l'équipage a fait cette poussée, deux révolutions après l'insertion, n'était donc pas l'orbite parfaite de 169,7 × 60,0 milles marins dont part la reconstitution. La vraie poussée a aussi été placée pour mettre le point bas à 80° O pour le site d'alunissage, et a duré 16,9 secondes au lieu d'un instant.",
  },
};
