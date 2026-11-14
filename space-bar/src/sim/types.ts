export const PHASES = ['launch', 'coast', 'orbit', 'landing', 'return'] as const;
export type Phase = (typeof PHASES)[number];
export const ROLES = ['manager', 'engineer', 'navigator', 'scientist'] as const;
export type Role = (typeof ROLES)[number];
export type Cause = 'mass' | 'power' | 'comms' | 'hardware' | 'piloting';

/** Relative effect points (about -3..+4). Scaled to real units by chapter.scale. */
export interface Effects {
  mass?: number; cost?: number; days?: number; risk?: number;
  power?: number; load?: number; data?: number; comms?: number;
  trust?: number; debris?: number; science?: number;
  phaseRisk?: Partial<Record<Phase, number>>;
}
export type EffectKey = Exclude<keyof Effects, 'phaseRisk'>;
export const EFFECT_KEYS: EffectKey[] = ['mass', 'cost', 'days', 'risk', 'power', 'load', 'data', 'comms', 'trust', 'debris', 'science'];

export interface SourceRef { label: string; url?: string; status: 'placeholder' | 'verified'; retrieved?: string }

export interface Option {
  id: string; label: string; blurb: string;
  /** short name when this option is a part you fit on the rocket */
  part?: string;
  effects: Effects; tags: string[];
}
export interface Question {
  id: string; role: Role | 'crew';
  /** story = a decision you hold to commit; part = a spot on the rocket; flight = picked while flying */
  kind: 'story' | 'part' | 'flight'; chapter: number;
  /** the name of the spot on the rocket, for parts */
  slot?: string;
  prompt: string; context?: string; why: string; options: Option[];
}
export type Decisions = Record<string, string>; // questionId -> optionId

export interface ConflictRule {
  id: string; all: string[]; effects: Effects; roles: Role[]; message: string;
}

export interface GameEvent {
  id: string; date: string; headline: string; body: string; weight: number;
  immediate?: { trust?: number; budget?: number };
  stress?: { phase: Phase; kind: 'power' | 'comms' | 'hardware'; amount: number }[];
  mitigatedBy?: string[]; mitigation?: number;
  explain: string; source: SourceRef;
}

export interface Chapter {
  id: number; title: string; years: string;
  base: { mass: number; capacity: number; gen: number; load: number; data: number; comms: number; cost: number; days: number; debris: number };
  scale: { mass: number; power: number; load: number; data: number; comms: number; cost: number; days: number; trust: number; debris: number };
  phaseLoad: Record<Phase, number>;
  baseFail: Record<Phase, number>;
  riskWeight: Record<Phase, number>;
  riskPerPoint: number;
  commsSlack: number;
  /** elapsed days from the clock start when the decade ends */
  deadlineDay: number;
  startDate: string; // ISO
  start: { budget: number; trust: number; debris: number };
  trustDecayPerDay: number;
  trustPerScience: number; trustOnSuccess: number; trustOnSuccessQuiet: number; trustOnFailure: number; trustFailureCap: number;
  debrisOnFailure: number; debrisPerLaunch: number;
  budgetPerAppropriation: number; // meter points per $M per year
  appropriations: Record<number, number>; // year -> $M
  eventsPerRun: number;
}

export interface Meters { budget: number; trust: number; debris: number; day: number }
export interface Totals {
  mass: number; capacity: number; gen: number; load: number; data: number; comms: number;
  cost: number; days: number; risk: number; trust: number; debris: number; science: number;
  phaseRisk: Record<Phase, number>; tags: string[]; conflicts: string[];
}
export interface Check { kind: Cause; label: string; value: number; limit: number; passed: boolean; unit: string }
export interface PhaseResult {
  phase: Phase; reached: boolean; passed: boolean; checks: Check[];
  failProb: number; roll: number | null; stress: Record<'power' | 'comms' | 'hardware', number>;
  /** how the player flew this phase, for the three flown ones */
  flown?: Mark | LandingResult;
}
export interface Outcome {
  success: boolean; failedPhase: Phase | null; cause: Cause | null;
  phases: PhaseResult[]; totals: Totals; seed: number;
  flown: FlownResult;
}

// ---------------------------------------------------------------- flying
/** How well a flown moment went. */
export type Mark = 'clean' | 'fair' | 'rough';
export type Site = 'flat' | 'rough';
/** fuelLeft is the share of that try's fuel still in the tank at touchdown, 0..1 */
export interface LandingResult { landed: boolean; tries: 1 | 2; site: Site; speed: number; fuelLeft: number }
/** What the player's hands did. A moment not flown yet is simply missing. */
export interface FlownResult { liftoff?: Mark; orbit?: Mark; landing?: LandingResult }
/** The phases the player flies. The other two are watched, and keep their dice. */
export const FLOWN: Phase[] = ['launch', 'orbit', 'landing'];

/** What the pilot's hands are doing this instant. throttle is 0..1. */
export interface Controls { turn: -1 | 0 | 1; engine: boolean; throttle: number }
