import { TruthMission, TruthRocket } from '../data/truth';

export type EvaluationMode = 'historical' | 'what-if';
export interface FlightVerdict { allowed: boolean; reasons: string[]; warnings: string[] }

export const canFly = (mission: TruthMission, rocket: TruthRocket, buildMassKg: number, mode: EvaluationMode = 'historical'): FlightVerdict => {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (mode === 'historical' && rocket.firstFlightYear.value > mission.year.value) reasons.push(`${rocket.name} first flew in ${rocket.firstFlightYear.value}, after this ${mission.year.value} mission.`);
  if (!rocket.destinations.value.includes(mission.destination.value)) reasons.push(`${rocket.name} is not documented for ${mission.destination.value} missions.`);
  if (mission.crewed.value && !rocket.humanRated.value) reasons.push(`${rocket.name} is not verified as human-rated for this mission.`);
  const capacity = mission.destination.value === 'lunar-surface' ? rocket.lunarPayloadKg : rocket.leoPayloadKg;
  if (capacity.value !== null && buildMassKg > capacity.value) reasons.push(`Payload ${buildMassKg.toLocaleString()} kg exceeds the sourced ${capacity.value.toLocaleString()} kg capacity.`);
  if (capacity.source.status === 'placeholder') warnings.push(`Payload capacity is unresolved: ${capacity.source.location}.`);
  if (rocket.status.value === 'test-flight') warnings.push(`${rocket.name} is classified as a test-flight vehicle, not operational.`);
  if (mode === 'historical' && mission.historicalRocketId.value !== rocket.id) warnings.push(`Historical vehicle: ${mission.historicalRocketId.value}.`);
  return { allowed: reasons.length === 0, reasons, warnings };
};
