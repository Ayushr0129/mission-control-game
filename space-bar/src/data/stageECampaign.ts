import { truthMissionById, truthRocketById, TruthMission, TruthRocket } from './truth';

export interface StageEMissionProfile { number: 3 | 4 | 5 | 9; classification: 'historical' | 'test-flight'; mission: TruthMission; historicalRocket: TruthRocket; watchedDocking: boolean }
const make = (number: StageEMissionProfile['number'], missionId: string, classification: StageEMissionProfile['classification'], watchedDocking = false): StageEMissionProfile => {
  const mission = truthMissionById(missionId), rocket = mission && truthRocketById(mission.historicalRocketId.value);
  if (!mission || !rocket) throw new Error(`Incomplete Stage E mission ${number}`);
  return { number, classification, mission, historicalRocket: rocket, watchedDocking };
};
export const STAGE_E_CAMPAIGN: readonly StageEMissionProfile[] = [make(3, 'gemini-8', 'historical', true), make(4, 'apollo-8', 'historical'), make(5, 'apollo-11', 'historical', true), make(9, 'starship-flight-1', 'test-flight')] as const;
