import { RocketBlueprint, RocketId } from '../data/rockets';
import type { FlightState } from './sim/flight';

export enum CampaignStage { Briefing='briefing', Selection='selection', Customization='customization', Launch='launch', Flight='flight', Results='results', NextMission='next-mission' }
export type CampaignEvent='CONTINUE'|'SELECT'|'CUSTOMIZE'|'CONFIRM_LAUNCH'|'BEGIN_FLIGHT'|'COMPLETE'|'CONTINUE_MISSION';
const transitions:Record<CampaignStage,Partial<Record<CampaignEvent,CampaignStage>>>={
  [CampaignStage.Briefing]:{CONTINUE:CampaignStage.Selection}, [CampaignStage.Selection]:{SELECT:CampaignStage.Launch,CUSTOMIZE:CampaignStage.Customization},
  [CampaignStage.Customization]:{CONFIRM_LAUNCH:CampaignStage.Launch}, [CampaignStage.Launch]:{BEGIN_FLIGHT:CampaignStage.Flight},
  [CampaignStage.Flight]:{COMPLETE:CampaignStage.Results}, [CampaignStage.Results]:{CONTINUE_MISSION:CampaignStage.NextMission}, [CampaignStage.NextMission]:{CONTINUE:CampaignStage.Briefing},
};
export function transition(stage:CampaignStage,event:CampaignEvent):CampaignStage|null{return transitions[stage][event]??null;}
export interface CampaignSave { version:1; stage:CampaignStage; mission:number; budget:number; reputation:number; unlocks:RocketId[]; selected?:RocketBlueprint; customRockets:RocketBlueprint[]; outcome?:'success'|'partial'|'failure'; flight?:FlightState }
export const freshCampaign=():CampaignSave=>({version:1,stage:CampaignStage.Briefing,mission:1,budget:200,reputation:50,unlocks:[],customRockets:[]});
const KEY='spacebar.historical.v1';
export function saveCampaign(state:CampaignSave){localStorage.setItem(KEY,JSON.stringify(state));}
export function isCampaignSave(value:unknown):value is CampaignSave { if(!value||typeof value!=='object')return false;const save=value as Partial<CampaignSave>;return save.version===1&&Object.values(CampaignStage).includes(save.stage as CampaignStage)&&typeof save.mission==='number'&&typeof save.budget==='number'&&typeof save.reputation==='number'&&Array.isArray(save.unlocks)&&Array.isArray(save.customRockets); }
export function loadCampaign():CampaignSave{try{const value=JSON.parse(localStorage.getItem(KEY)||'null') as unknown;if(isCampaignSave(value))return value;}catch{/* invalid save */}return freshCampaign();}
