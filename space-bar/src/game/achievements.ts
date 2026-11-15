import { endingFor, history, EndingId } from '../data';
import type { Run, Session } from './session';

export type AchievementId = 'landed' | 'first-try' | 'picture-perfect' | 'rough-ground' | 'on-fumes' | 'hands-on'
  | 'by-the-book' | 'comeback' | 'signal-lost' | 'lights-out' | 'vehicle-lost' | 'too-fast' | 'seen-it-all';
/** Every text is [en, fr]. `hint` is shown while the badge is locked. */
export interface Achievement { id: AchievementId; failure: boolean; name: [string, string]; desc: [string, string]; hint: [string, string] }

/** The 13, in the design's order. Failure badges teach the fix: their description is the ending's `avoid` text. */
export const achievements: Achievement[] = [
  {
    id: 'landed', failure: false,
    name: ['The Eagle has landed', "L'Aigle s'est posé"],
    desc: ['Land on the Moon.', 'Se poser sur la Lune.'],
    hint: ['Get all the way down to the surface.', "Aller jusqu'à la surface."],
  },
  {
    id: 'first-try', failure: false,
    name: ['First try', 'Du premier coup'],
    desc: ['Land on the first run of a campaign.', "Se poser dès le premier vol d'une campagne."],
    hint: ['Some get it right the very first time.', 'Certains réussissent dès la première fois.'],
  },
  {
    id: 'picture-perfect', failure: false,
    name: ['Picture perfect', 'Un sans-faute'],
    desc: ['Land with a clean liftoff, a clean orbit burn and a landing on the first try.', 'Se poser après un décollage propre, une mise en orbite propre et un atterrissage au premier essai.'],
    hint: ['Fly every moment cleanly, with no second chance needed.', 'Pilotez chaque moment proprement, sans avoir besoin de seconde chance.'],
  },
  {
    id: 'rough-ground', failure: false,
    name: ['Rough ground', 'Terrain accidenté'],
    desc: ['Land on the rough site.', 'Se poser sur le site accidenté.'],
    hint: ['The plain is not the only place to land.', "La plaine n'est pas le seul endroit où se poser."],
  },
  {
    id: 'on-fumes', failure: false,
    name: ['On fumes', 'Sur la réserve'],
    desc: ['Land with less than 10% of the landing fuel left.', "Se poser avec moins de 10 % de carburant d'atterrissage restant."],
    hint: ['Cut it fine on the way down, and still make it.', 'Descendez au plus juste, et posez-vous quand même.'],
  },
  {
    id: 'hands-on', failure: false,
    name: ['Hands on the stick', 'Les mains sur le manche'],
    desc: ['Land without ever switching the autopilot on.', 'Se poser sans jamais enclencher le pilote automatique.'],
    hint: ['Land without ever letting the autopilot fly.', 'Posez-vous sans jamais laisser voler le pilote automatique.'],
  },
  {
    id: 'by-the-book', failure: false,
    name: ['By the book', 'Comme dans les livres'],
    desc: ['Land having made every choice NASA made.', 'Se poser en ayant fait tous les choix de la NASA.'],
    hint: ['What would NASA have done? The report tells you afterwards.', "Qu'aurait fait la NASA ? Le bilan vous le dit après coup."],
  },
  {
    id: 'comeback', failure: false,
    name: ['Back from the brink', 'Revenu de loin'],
    desc: ['Land after a failed run in the same campaign.', 'Se poser après un échec dans la même campagne.'],
    hint: ['A failure is not the end of the campaign.', "Un échec n'est pas la fin de la campagne."],
  },
  {
    id: 'signal-lost', failure: true,
    name: [endingFor('comms').title, 'Signal perdu'],
    desc: [endingFor('comms').avoid, "Adaptez à l'antenne les instruments choisis par le Scientifique. Une plus grande parabole en transmet davantage, et une charge utile plus légère en demande moins."],
    hint: ['Lose the link back to Earth.', 'Perdre la liaison avec la Terre.'],
  },
  {
    id: 'lights-out', failure: true,
    name: [endingFor('power').title, 'Panne de courant'],
    desc: [endingFor('power').avoid, "Vérifiez le bilan électrique à chaque phase. Les gros instruments consomment tout au long du trajet. Une source d'énergie de secours coûte de la masse mais offre une marge."],
    hint: ['Run the spacecraft out of power.', "Laisser le vaisseau à court d'énergie."],
  },
  {
    id: 'vehicle-lost', failure: true,
    name: [endingFor('mass').title, 'Véhicule perdu'],
    desc: [endingFor('mass').avoid, "Comparez la masse à la capacité de la fusée. La fiabilité coûte de la masse, de l'argent et des jours, mais le risque d'une conception précipitée ou sans redondance s'accumule."],
    hint: ['Lose the vehicle to its mass or a failed part.', "Perdre le véhicule, trop lourd ou victime d'une panne."],
  },
  {
    id: 'too-fast', failure: true,
    name: [endingFor('piloting').title, 'Trop vite'],
    desc: [endingFor('piloting').avoid, "Un vaisseau plus léger emporte plus de carburant d'atterrissage. Des poussées propres au décollage et autour de la Lune en gardent pour la descente. Freinez tôt, et choisissez la plaine tant que vos mains ne connaissent pas le chemin."],
    hint: ['Hit the surface too hard.', 'Toucher la surface trop brutalement.'],
  },
  {
    id: 'seen-it-all', failure: false,
    name: ['Seen it all', 'Tout vu'],
    desc: ['Earn all four failure badges.', "Obtenir les quatre badges d'échec."],
    hint: ['Every way a mission can end, you have seen.', 'Toutes les façons dont une mission peut finir, vous les aurez vues.'],
  },
];

const FAILURE_BY_ENDING: Partial<Record<EndingId, AchievementId>> = {
  comms: 'signal-lost', power: 'lights-out', vehicle: 'vehicle-lost', crash: 'too-fast',
};
const FAILURES = Object.values(FAILURE_BY_ENDING) as AchievementId[];
const IDS = new Set<string>(achievements.map((a) => a.id));

export interface Held { id: AchievementId; at: number }

const KEY = 'rttm.achievements.v1';
/** Stored entries that look like one, whatever their id (a newer build may know more), first of each id only. */
type Entry = { id: string; at: number };
function entries(list: unknown[]): Entry[] {
  const seen = new Set<string>(), out: Entry[] = [];
  for (const h of list) {
    if (!h || typeof h !== 'object' || typeof (h as Entry).id !== 'string' || seen.has((h as Entry).id)) continue;
    seen.add((h as Entry).id); out.push({ id: (h as Entry).id, at: typeof (h as Entry).at === 'number' ? (h as Entry).at : 0 });
  }
  return out;
}
function readStored(): Entry[] {
  try { const d: unknown = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(d) ? entries(d) : []; } catch { return []; }
}
/** What this page has earned, so blocked storage does not re-award a badge within the session. */
let memory: Entry[] = [];
const all = () => entries([...readStored(), ...memory]);
/** What this browser holds. [] on missing, corrupt or non-array data; unknown and repeated ids are dropped. */
export function loadHeld(): Held[] { return all().filter((h): h is Held => IDS.has(h.id)); }
function save(h: Entry[]) { try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* storage may be blocked */ } }
export function clearAchievements() { memory = []; try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

/** What this run earns on its own, before the once-only rule. */
function wins(s: Session, run: Run): Set<AchievementId> {
  const out = new Set<AchievementId>(), o = run.outcome;
  if (!o) return out;
  if (o.success) {
    const f = o.flown, l = f.landing;
    out.add('landed');
    if (run.no === 1) out.add('first-try');
    if (f.liftoff === 'clean' && f.orbit === 'clean' && l?.tries === 1) out.add('picture-perfect');
    if (l?.site === 'rough') out.add('rough-ground');
    if (l && l.fuelLeft < 0.10) out.add('on-fumes');
    if (run.autopilot !== true) out.add('hands-on');
    if (Object.entries(history.optionByQuestion).every(([q, opt]) => run.decisions[q] === opt)) out.add('by-the-book');
    if (s.runs.some((r) => r !== run && r.no < run.no && r.outcome && !r.outcome.success)) out.add('comeback');
  } else if (o.cause) {
    const id = FAILURE_BY_ENDING[endingFor(o.cause).id];
    if (id) out.add(id);
  }
  return out;
}

/** New ids this run earns, given what is already held. Pure. In the list's order, so `seen-it-all` comes last. */
export function earned(s: Session, run: Run, held: AchievementId[]): AchievementId[] {
  const got = wins(s, run), have = new Set(held);
  if (FAILURES.every((id) => have.has(id) || got.has(id))) got.add('seen-it-all');
  return achievements.map((a) => a.id).filter((id) => got.has(id) && !have.has(id));
}

/** Loads, computes, saves, returns the new ones. Returns [] and saves nothing when quick. */
export function award(s: Session, run: Run, quick: boolean): AchievementId[] {
  if (quick) return [];
  const kept = all(), held = kept.filter((h): h is Held => IDS.has(h.id)).map((h) => h.id);
  const fresh = earned(s, run, held);
  if (fresh.length) {
    const add = fresh.map((id) => ({ id, at: Date.now() }));
    memory = entries([...memory, ...add]);
    save([...kept, ...add]); // entries with ids this build does not know are kept
  }
  return fresh;
}
