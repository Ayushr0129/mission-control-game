import { truthMissionById, truthRocketById, TruthMission, TruthRocket } from './truth';

export interface HistoricalCampaignProfile {
  number: 1 | 2 | 6 | 7 | 8;
  title: string;
  lesson: string;
  mission: TruthMission;
  historicalRocket: TruthRocket;
}

const profile = (number: HistoricalCampaignProfile['number'], missionId: string, lesson: string): HistoricalCampaignProfile => {
  const mission = truthMissionById(missionId);
  const historicalRocket = mission && truthRocketById(mission.historicalRocketId.value);
  if (!mission || !historicalRocket) throw new Error(`Incomplete sourced campaign profile ${number}`);
  return { number, title: mission.name, lesson, mission, historicalRocket };
};

export const STAGE_D_CAMPAIGN: readonly HistoricalCampaignProfile[] = [
  profile(1, 'sputnik-1', 'Reach Earth orbit with the first artificial satellite.'),
  profile(2, 'redstone-suborbital', 'Compare a suborbital Mercury flight with the Atlas orbital mission that follows.'),
  profile(6, 'hubble-deployment', 'Deliver a crewed observatory-deployment mission to low Earth orbit.'),
  profile(7, 'falcon-landing', 'Deliver satellites to orbit while learning why booster recovery is a separate objective.'),
  profile(8, 'psyche-launch', 'Send a robotic science spacecraft onto a deep-space trajectory.'),
] as const;

export const campaignProfileForOrdinal = (ordinal: number) => STAGE_D_CAMPAIGN[Math.min(Math.max(ordinal - 1, 0), STAGE_D_CAMPAIGN.length - 1)];
