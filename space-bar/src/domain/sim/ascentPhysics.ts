import { CelestialBody } from './bodies';
import { Vec3, add, dot, mag, scale, sub, unit, v3 } from './units';

export const ASCENT_DT_S = 0.02;
export const G0_MPS2 = 9.80665;

export interface EngineSpec {
  count: number;
  thrustSeaLevelN: number;
  thrustVacuumN: number;
  ispSeaLevelS: number;
  ispVacuumS: number;
  minThrottle: number;
}
export interface StageSpec {
  id: string;
  dryMassKg: number;
  propellantKg: number;
  diameterM: number;
  baseCd: number;
  engines: EngineSpec[];
}
export interface AscentVehicleSpec {
  name: string;
  payloadMassKg: number;
  stages: StageSpec[];
  maxDynamicPressurePa: number;
}
export interface StageRuntime extends StageSpec { propellantRemainingKg:number }
export interface AscentState {
  positionM: Vec3;
  velocityMps: Vec3;
  attitudeRad: number;
  angularRateRadS: number;
  stages: StageRuntime[];
  activeStage: number;
  launched: boolean;
  elapsedS: number;
  maxQPa: number;
  structuralWarning: boolean;
  events: string[];
}
export interface AscentControl {
  throttle: number;
  turn: number;
  targetAttitudeRad?: number;
  stage: boolean;
}
export interface AscentEnvironment {
  body: CelestialBody;
  launchRadiusM: number;
  launchLatitudeRad: number;
  dragEnabled: boolean;
}
export interface AscentTelemetry {
  altitudeM:number; speedMps:number; airSpeedMps:number; massKg:number; fuelKg:number;
  thrustN:number; weightN:number; dragN:number; dynamicPressurePa:number; twr:number;
  cd:number; areaM2:number; radialSpeedMps:number; horizontalSpeedMps:number;
}
export interface AscentStep { state:AscentState; telemetry:AscentTelemetry }

const USSA76:readonly (readonly [number,number,number,number])[] = [
  [0,1.225,101325,288.15],[11000,.36391,22632.1,216.65],[20000,.08803,5474.89,216.65],
  [32000,.013225,868.02,228.65],[47000,.0014275,110.91,270.65],[51000,.0008616,66.94,270.65],
  [71000,.000064,3.956,214.65],[84852,.000006957,.3734,186.95],[86000,.00000568,.302,186.87],
];

export interface StandardAtmosphereSample { densityKgM3:number; pressurePa:number; temperatureK:number }
export function standardAtmosphere1976(altitudeM:number):StandardAtmosphereSample {
  const h=Math.max(0,altitudeM);
  if(h>86000){const scaleHeightM=7000, density=USSA76.at(-1)![1]*Math.exp(-(h-86000)/scaleHeightM), pressure=USSA76.at(-1)![2]*Math.exp(-(h-86000)/scaleHeightM);return{densityKgM3:h>180000?0:density,pressurePa:h>180000?0:pressure,temperatureK:186.87};}
  let low=USSA76[0],high=USSA76[1];
  for(let i=1;i<USSA76.length;i++)if(h>=USSA76[i][0]){low=USSA76[i];high=USSA76[Math.min(i+1,USSA76.length-1)];}
  const t=high[0]===low[0]?0:(h-low[0])/(high[0]-low[0]);
  const logBlend=(a:number,b:number)=>Math.exp(Math.log(a)+(Math.log(b)-Math.log(a))*t);
  return{densityKgM3:logBlend(low[1],high[1]),pressurePa:logBlend(low[2],high[2]),temperatureK:low[3]+(high[3]-low[3])*t};
}

export const vehicleMassKg=(spec:AscentVehicleSpec,state:AscentState)=>spec.payloadMassKg+state.stages.slice(state.activeStage).reduce((sum,s)=>sum+s.dryMassKg+s.propellantRemainingKg,0);
export const fuelMassKg=(state:AscentState)=>state.stages.slice(state.activeStage).reduce((sum,s)=>sum+s.propellantRemainingKg,0);
const activeStage=(state:AscentState)=>state.stages[state.activeStage];
const radialBasis=(position:Vec3)=>unit(position);
const eastBasis=(position:Vec3)=>{const r=radialBasis(position);return v3(r.y,-r.x,0);};
export const gravityAccelerationMps2=(body:CelestialBody,radiusM:number)=>body.muM3S2/(radiusM*radiusM);
export const atmosphereVelocity=(state:AscentState,env:AscentEnvironment)=>scale(eastBasis(state.positionM),(2*Math.PI*mag(state.positionM)/env.body.rotationPeriodS)*Math.cos(env.launchLatitudeRad));

export function aerodynamicCoefficient(baseCd:number,airSpeedMps:number,temperatureK:number,densityKgM3:number){
  if(densityKgM3<=0)return 0.08;
  const sound=Math.sqrt(1.4*287.05*Math.max(150,temperatureK)),mach=airSpeedMps/sound;
  return Math.max(.08,baseCd*(.78+.72*Math.exp(-(((mach-1)/.32)**2))));
}

function enginePerformance(stage:StageRuntime,pressurePa:number,throttle:number){
  const p=Math.max(0,Math.min(1,pressurePa/101325));let thrustN=0,massFlowKgS=0;
  for(const engine of stage.engines){const level=throttle<=0?0:Math.max(engine.minThrottle,Math.min(1,throttle)),thrust=(engine.thrustVacuumN*(1-p)+engine.thrustSeaLevelN*p)*engine.count*level,isp=engine.ispVacuumS*(1-p)+engine.ispSeaLevelS*p;thrustN+=thrust;massFlowKgS+=isp>0?thrust/(isp*G0_MPS2):0;}
  return{thrustN,massFlowKgS};
}

export function createAscentState(spec:AscentVehicleSpec,positionM:Vec3,velocityMps:Vec3):AscentState{return{positionM,velocityMps,attitudeRad:0,angularRateRadS:0,stages:spec.stages.map(s=>({...s,propellantRemainingKg:s.propellantKg})),activeStage:0,launched:false,elapsedS:0,maxQPa:0,structuralWarning:false,events:['CLAMPED_ON_PAD']};}
export function separateStage(state:AscentState):AscentState {if(state.activeStage>=state.stages.length-1)return state;return{...state,activeStage:state.activeStage+1,events:[...state.events,`STAGE_${state.activeStage+1}_SEPARATION`]};}

export function stepAscent(spec:AscentVehicleSpec,current:AscentState,control:AscentControl,env:AscentEnvironment,dtS=ASCENT_DT_S):AscentStep {
  let state=control.stage?separateStage(current):current;const stage=activeStage(state),radius=mag(state.positionM),altitude=radius-env.body.radiusM,radial=radialBasis(state.positionM),east=eastBasis(state.positionM);
  const airVelocity=atmosphereVelocity(state,env),relativeVelocity=sub(state.velocityMps,airVelocity),airSpeed=mag(relativeVelocity),atmosphere=standardAtmosphere1976(altitude);
  const maxDiameter=Math.max(stage?.diameterM??1,...state.stages.slice(state.activeStage).map(s=>s.diameterM)),areaM2=Math.PI*(maxDiameter/2)**2,baseCd=stage?.baseCd??.3,cd=aerodynamicCoefficient(baseCd,airSpeed,atmosphere.temperatureK,atmosphere.densityKgM3);
  const q=.5*atmosphere.densityKgM3*airSpeed*airSpeed,dragMagnitude=env.dragEnabled?q*cd*areaM2:0,dragForce=airSpeed>0?scale(unit(relativeVelocity),-dragMagnitude):v3();
  const maxRate=6*Math.PI/180,target=control.targetAttitudeRad,manualRate=Math.max(-1,Math.min(1,control.turn))*maxRate;
  let commandedRate=target===undefined?manualRate:Math.max(-maxRate,Math.min(maxRate,(target-state.attitudeRad)*.9));
  if(q>3000&&airSpeed>50){const flightAngle=Math.atan2(dot(relativeVelocity,east),dot(relativeVelocity,radial)),stability=Math.min(.7,q/50000);commandedRate=commandedRate*(1-stability)+Math.max(-maxRate,Math.min(maxRate,(flightAngle-state.attitudeRad)*.45))*stability;}
  const angularRate=state.angularRateRadS+(commandedRate-state.angularRateRadS)*Math.min(1,dtS*4),attitude=Math.max(-.15,Math.min(Math.PI/2+.15,state.attitudeRad+angularRate*dtS));
  const performance=stage?enginePerformance(stage,atmosphere.pressurePa,control.throttle):{thrustN:0,massFlowKgS:0},available=stage?.propellantRemainingKg??0,burn=Math.min(available,performance.massFlowKgS*dtS),burnScale=performance.massFlowKgS*dtS>0?burn/(performance.massFlowKgS*dtS):0,thrustN=performance.thrustN*burnScale;
  const stages=state.stages.map((s,i)=>i===state.activeStage?{...s,propellantRemainingKg:Math.max(0,s.propellantRemainingKg-burn)}:s),mass=spec.payloadMassKg+stages.slice(state.activeStage).reduce((sum,s)=>sum+s.dryMassKg+s.propellantRemainingKg,0),gravity=gravityAccelerationMps2(env.body,radius),bodyAxis=add(scale(radial,Math.cos(attitude)),scale(east,Math.sin(attitude))),thrustForce=scale(bodyAxis,thrustN),weightN=mass*gravity;
  const acceleration=add(add(scale(radial,-gravity),scale(thrustForce,1/Math.max(1,mass))),scale(dragForce,1/Math.max(1,mass))),radialThrust=dot(thrustForce,radial);
  let launched=state.launched,position=state.positionM,velocity=state.velocityMps;
  if(!launched&&radialThrust<=weightN){position=scale(radial,env.launchRadiusM);velocity=airVelocity;}
  else{launched=true;velocity=add(state.velocityMps,scale(acceleration,dtS));position=add(state.positionM,scale(velocity,dtS));}
  let next:AscentState={...state,positionM:position,velocityMps:velocity,attitudeRad:attitude,angularRateRadS:angularRate,stages,launched,elapsedS:state.elapsedS+dtS,maxQPa:Math.max(state.maxQPa,q),structuralWarning:q>spec.maxDynamicPressurePa,events:q>spec.maxDynamicPressurePa&&!state.structuralWarning?[...state.events,'MAX_Q_LIMIT']:state.events};
  if(stage&&stages[state.activeStage].propellantRemainingKg<=.001&&state.activeStage<stages.length-1)next=separateStage(next);
  const radialSpeed=dot(next.velocityMps,radial),horizontalSpeed=dot(next.velocityMps,east);
  return{state:next,telemetry:{altitudeM:mag(next.positionM)-env.body.radiusM,speedMps:mag(next.velocityMps),airSpeedMps:airSpeed,massKg:mass,fuelKg:fuelMassKg(next),thrustN,weightN,dragN:dragMagnitude,dynamicPressurePa:q,twr:weightN>0?thrustN/weightN:0,cd,areaM2,radialSpeedMps:radialSpeed,horizontalSpeedMps:horizontalSpeed}};
}
