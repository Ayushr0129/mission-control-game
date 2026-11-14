export type LearningMomentId='drag'|'max-q'|'staging'|'orbit';
export interface FlightSample { timeS:number; altitudeM:number; speedMps:number; fuelKg:number }
export interface FlightEducationState { samples:FlightSample[]; dragLossJ:number; gravityLossJ:number; moments:LearningMomentId[]; lastSampleSecond:number; maxQPassed:boolean }
export interface EducationStepInput { timeS:number; dtS:number; altitudeM:number; speedMps:number; airSpeedMps:number; fuelKg:number; massKg:number; dragN:number; gravityMps2:number; radialSpeedMps:number; dynamicPressurePa:number; maxQPa:number; activeStage:number; previousStage:number; stableOrbit:boolean }

export const initialFlightEducation=():FlightEducationState=>({samples:[],dragLossJ:0,gravityLossJ:0,moments:[],lastSampleSecond:-1,maxQPassed:false});
const addMoment=(moments:LearningMomentId[],moment:LearningMomentId)=>moments.includes(moment)?moments:[...moments,moment];

export function recordFlightEducation(current:FlightEducationState,input:EducationStepInput):FlightEducationState {
 const second=Math.floor(input.timeS),samples=second>current.lastSampleSecond?[...current.samples,{timeS:input.timeS,altitudeM:input.altitudeM,speedMps:input.speedMps,fuelKg:input.fuelKg}]:current.samples;
 let moments=current.moments,maxQPassed=current.maxQPassed;
 if(input.dragN>1000&&input.speedMps>100)moments=addMoment(moments,'drag');
 if(!maxQPassed&&input.maxQPa>5000&&input.dynamicPressurePa<input.maxQPa*.8){moments=addMoment(moments,'max-q');maxQPassed=true;}
 if(input.activeStage>input.previousStage)moments=addMoment(moments,'staging');
 if(input.stableOrbit)moments=addMoment(moments,'orbit');
 return{samples,dragLossJ:current.dragLossJ+input.dragN*input.airSpeedMps*input.dtS,gravityLossJ:current.gravityLossJ+input.massKg*input.gravityMps2*Math.max(0,input.radialSpeedMps)*input.dtS,moments,lastSampleSecond:Math.max(current.lastSampleSecond,second),maxQPassed};
}

export function reportSuggestions(education:FlightEducationState):string[]{
 const total=education.dragLossJ+education.gravityLossJ;if(total<=0)return['Fly a complete ascent to receive efficiency suggestions.'];
 const suggestions:string[]=[];
 if(education.dragLossJ/total>.18)suggestions.push('Pitch more gently through the thick lower atmosphere and reduce throttle near Max-Q.');
 if(education.gravityLossJ/total>.7)suggestions.push('Begin a smooth eastward gravity turn earlier so more thrust builds orbital speed.');
 const final=education.samples.at(-1);if(final&&final.altitudeM<160000)suggestions.push('Save enough fuel for a horizontal circularization burn near apoapsis.');
 return suggestions.length?suggestions:['Your ascent was efficient. Try repeating it with fewer guidance assists.'];
}
