import { RocketBlueprint } from '../../data/rockets';
import { atmosphereAt } from './atmosphere';
import { BODIES, BodyId, LAUNCH_SITES } from './bodies';
import { stateToElements } from './orbit';
import { advanceFixed, propagate } from './propagator';
import { seededRng } from './rng';
import { ControlInput, VehicleState, createVehicle, propellantMass, stepVehicle, vehicleMass } from './vehicle';
import { Vec3, add, mag, scale, unit, v3 } from './units';

export type FlightPhase = 'pre-launch'|'ascent'|'orbit'|'transfer'|'arrival'|'landing'|'return'|'recovery'|'failed';
export type Difficulty = 'arcade'|'realistic'|'hardcore';
export interface ManeuverNode { id:string; atS:number; progradeMps:number; normalMps:number; radialMps:number; label:string; executed:boolean }
export interface FlightState { version:1; seed:number; bodyId:BodyId; phase:FlightPhase; missionTimeS:number; positionM:Vec3; velocityMps:Vec3; vehicle:VehicleState; controls:ControlInput; warp:number; difficulty:Difficulty; maneuvers:ManeuverNode[]; events:string[]; checklist:string[]; landed:boolean; failed:boolean }
export interface FlightTelemetry { altitudeM:number; surfaceSpeedMps:number; apoapsisM:number; periapsisM:number; eccentricity:number; inclinationRad:number; deltaVRemainingMps:number; fuelKg:number; twr:number; comm:boolean; heatK:number; qPa:number; gLoad:number }
export interface StepResult { state:FlightState; telemetry:FlightTelemetry }

export const defaultControls = (): ControlInput => ({ throttle:0, pitch:0, yaw:0, roll:0, rcs:v3(), sas:'stability', stage:false });
export function createFlight(blueprint:RocketBlueprint, seed=1, difficulty:Difficulty='realistic'):FlightState {
  const earth=BODIES.earth, site=LAUNCH_SITES[0], radius=earth.radiusM+site.altitudeM, rotation=2*Math.PI*radius/earth.rotationPeriodS*Math.cos(site.latitudeRad);
  return {version:1,seed,bodyId:'earth',phase:'pre-launch',missionTimeS:0,positionM:v3(0,radius,0),velocityMps:v3(rotation,0,0),vehicle:createVehicle(blueprint),controls:defaultControls(),warp:1,difficulty,maneuvers:[],events:['FLIGHT_READY'],checklist:['Ignition','Clear tower','Max-Q','Stage','Orbit','TLI','LOI','Landing','Return'],landed:false,failed:false};
}
export function flightTelemetry(s:FlightState,lastQ=0,lastG=0):FlightTelemetry {
  const body=BODIES[s.bodyId], altitude=mag(s.positionM)-body.radiusM, elements=stateToElements({positionM:s.positionM,velocityMps:s.velocityMps},body.muM3S2);
  const fuel=propellantMass(s.vehicle), mass=vehicleMass(s.vehicle), apoapsis=elements.semiMajorAxisM*(1+elements.eccentricity)-body.radiusM, periapsis=elements.semiMajorAxisM*(1-elements.eccentricity)-body.radiusM;
  return {altitudeM:altitude,surfaceSpeedMps:mag(s.velocityMps),apoapsisM:apoapsis,periapsisM:periapsis,eccentricity:elements.eccentricity,inclinationRad:elements.inclinationRad,deltaVRemainingMps:Math.max(0,9500*fuel/Math.max(1,mass)),fuelKg:fuel,twr:s.vehicle.engines.length?1.2*fuel/Math.max(1,mass):0,comm:s.vehicle.commAvailable,heatK:s.vehicle.heatK,qPa:lastQ,gLoad:lastG};
}
export function addManeuver(s:FlightState,node:Omit<ManeuverNode,'id'|'executed'>):FlightState { return {...s,maneuvers:[...s.maneuvers,{...node,id:`node-${s.maneuvers.length+1}`,executed:false}]}; }
function applyNode(s:FlightState,node:ManeuverNode):FlightState {
  const dv=add(add(scale(unit(s.velocityMps),node.progradeMps),scale(unit(s.positionM),node.radialMps)),scale(v3(0,0,1),node.normalMps));
  let fuelCost=mag(dv)*vehicleMass(s.vehicle)/9500;
  const tanks=s.vehicle.tanks.map(t=>{const take=Math.min(t.propellantKg,fuelCost);fuelCost-=take;return{...t,propellantKg:t.propellantKg-take};});
  return {...s,velocityMps:add(s.velocityMps,dv),vehicle:{...s.vehicle,tanks},maneuvers:s.maneuvers.map(n=>n.id===node.id?{...n,executed:true}:n),events:[...s.events,`MANEUVER_${node.label.toUpperCase().replaceAll(' ','_')}`]};
}
export function stepFlight(current:FlightState,frameDtS:number):StepResult {
  if(current.phase==='pre-launch'&&current.controls.throttle===0) return {state:current,telemetry:flightTelemetry(current)};
  let s={...current}, lastQ=0, lastG=0, firstStep=true;
  const clock={accumulatorS:0,fixedDtS:.02}, rng=seededRng(s.seed+Math.floor(s.missionTimeS*50));
  advanceFixed(clock,frameDtS*s.warp,dt=>{
    const body=BODIES[s.bodyId], altitude=Math.max(0,mag(s.positionM)-body.radiusM), inertialSpeed=mag(s.velocityMps), rotationSpeed=s.bodyId==='earth'&&altitude<100000?2*Math.PI*(body.radiusM+altitude)/body.rotationPeriodS:0, speed=Math.max(0,inertialSpeed-rotationSpeed), sample=atmosphereAt(body,altitude);
    const controls={...s.controls,stage:firstStep&&s.controls.stage}; firstStep=false;
    const vehicleStep=stepVehicle(s.vehicle,controls,{body,altitudeM:altitude,speedMps:speed,velocityDirection:unit(s.velocityMps),lineOfSight:true,solarFactor:1},dt,rng);
    const next=propagate({positionM:s.positionM,velocityMps:s.velocityMps},dt,{body,thrustN:add(vehicleStep.thrustN,vehicleStep.dragN),massKg:vehicleMass(vehicleStep.state),atmosphericDensityKgM3:sample.densityKgM3,nearVessel:false});
    s={...s,positionM:next.positionM,velocityMps:next.velocityMps,vehicle:vehicleStep.state,missionTimeS:s.missionTimeS+dt,controls:{...s.controls,stage:false}}; lastQ=vehicleStep.dynamicPressurePa; lastG=vehicleStep.gLoad;
    const due=s.maneuvers.find(node=>!node.executed&&node.atS<=s.missionTimeS); if(due) s=applyNode(s,due);
  });
  const telemetry=flightTelemetry(s,lastQ,lastG); let phase=s.phase;
  if(s.vehicle.broken||telemetry.altitudeM < -5){phase='failed';s={...s,failed:true,events:[...s.events,'FLIGHT_FAILURE']};}
  else if(phase==='pre-launch'&&s.controls.throttle>0)phase='ascent'; else if(phase==='ascent'&&telemetry.periapsisM>120e3)phase='orbit'; else if(phase==='orbit'&&telemetry.apoapsisM>150e6)phase='transfer'; else if(phase==='transfer'&&s.bodyId==='moon')phase='arrival';
  s={...s,phase,events:phase!==s.phase?[...s.events,phase.toUpperCase().replace('-','_')]:s.events}; return {state:s,telemetry};
}
export function setControl(s:FlightState,patch:Partial<ControlInput>):FlightState { return {...s,controls:{...s.controls,...patch}}; }
export function setWarp(s:FlightState,requested:number):FlightState { const t=flightTelemetry(s), limited=s.controls.throttle>0||t.altitudeM<100000||t.surfaceSpeedMps<10?1:Math.max(1,Math.min(100000,requested)); return {...s,warp:limited}; }
export function recoverFlight(s:FlightState):FlightState { return {...s,phase:'recovery',landed:true,warp:1,controls:{...s.controls,throttle:0},events:[...s.events,'CREW_RECOVERED']}; }
export function trainingManeuver(s:FlightState,kind:'orbit'|'tli'|'loi'|'land'|'return'):FlightState {
  const atS=s.missionTimeS+3;
  if(kind==='orbit')return addManeuver(s,{atS,progradeMps:7800,normalMps:0,radialMps:0,label:'Circularization'});
  if(kind==='tli')return addManeuver(s,{atS,progradeMps:3150,normalMps:0,radialMps:0,label:'Trans Lunar Injection'});
  if(kind==='loi')return addManeuver({...s,bodyId:'moon',positionM:v3(0,BODIES.moon.radiusM+100000,0),velocityMps:v3(1800,0,0),phase:'arrival'},{atS,progradeMps:-200,normalMps:0,radialMps:0,label:'Lunar Orbit Insertion'});
  if(kind==='land')return{...s,phase:'landing',positionM:v3(0,BODIES.moon.radiusM+1200,0),velocityMps:v3(0,-15,0),bodyId:'moon'};
  return{...s,phase:'return',bodyId:'earth',positionM:v3(0,BODIES.earth.radiusM+120000,0),velocityMps:v3(7600,-600,0)};
}
