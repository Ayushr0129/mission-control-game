import { RocketBlueprint, RocketId } from '../data/rockets';
export enum CampaignStage { Briefing='briefing',Selection='selection',Customization='customization',Launch='launch',Results='results',NextMission='next-mission' }
export type CampaignEvent='CONTINUE'|'SELECT'|'CUSTOMIZE'|'CONFIRM_LAUNCH'|'COMPLETE'|'CONTINUE_MISSION';
const transitions:Record<CampaignStage,Partial<Record<CampaignEvent,CampaignStage>>>={
 [CampaignStage.Briefing]:{CONTINUE:CampaignStage.Selection},[CampaignStage.Selection]:{SELECT:CampaignStage.Launch,CUSTOMIZE:CampaignStage.Customization},[CampaignStage.Customization]:{CONFIRM_LAUNCH:CampaignStage.Launch},[CampaignStage.Launch]:{COMPLETE:CampaignStage.Results},[CampaignStage.Results]:{CONTINUE_MISSION:CampaignStage.NextMission},[CampaignStage.NextMission]:{CONTINUE:CampaignStage.Briefing}};
export function transition(stage:CampaignStage,event:CampaignEvent):CampaignStage|null{return transitions[stage][event]??null;}
export interface CampaignSave {version:1;stage:CampaignStage;mission:number;budget:number;reputation:number;unlocks:RocketId[];selected?:RocketBlueprint;customRockets:RocketBlueprint[];outcome?:'success'|'partial'|'failure'}
export const freshCampaign=():CampaignSave=>({version:1,stage:CampaignStage.Briefing,mission:1,budget:200,reputation:50,unlocks:[],customRockets:[]});
const KEY='spacebar.historical.v1';
export function saveCampaign(s:CampaignSave){localStorage.setItem(KEY,JSON.stringify(s));}
export function loadCampaign():CampaignSave{try{const v=JSON.parse(localStorage.getItem(KEY)||'null') as unknown;if(v&&typeof v==='object'&&(v as {version?:unknown}).version===1)return v as CampaignSave;}catch{/* invalid save */}return freshCampaign();}
