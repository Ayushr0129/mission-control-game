import {CelestialBody} from './bodies';import {OrbitalElements,StateVector,propagateKepler,stateToElements} from './orbit';import {Vec3,add,mag,scale,sub} from './units';
export type PropagationMode='physical'|'kepler';
export interface PropagationContext {body:CelestialBody;thrustN:Vec3;massKg:number;atmosphericDensityKgM3:number;nearVessel:boolean}
export const selectPropagationMode=(c:PropagationContext):PropagationMode=>mag(c.thrustN)>0||c.atmosphericDensityKgM3>1e-8||c.nearVessel?'physical':'kepler';
const acceleration=(s:StateVector,c:PropagationContext)=>{const r=mag(s.positionM);return add(scale(s.positionM,-c.body.muM3S2/r**3),scale(c.thrustN,1/Math.max(1,c.massKg)));};
export function velocityVerlet(s:StateVector,dtS:number,c:PropagationContext):StateVector{const a0=acceleration(s,c),positionM=add(add(s.positionM,scale(s.velocityMps,dtS)),scale(a0,.5*dtS**2)),a1=acceleration({positionM,velocityMps:s.velocityMps},c);return{positionM,velocityMps:add(s.velocityMps,scale(add(a0,a1),.5*dtS))};}
export function propagate(s:StateVector,dtS:number,c:PropagationContext):StateVector{return selectPropagationMode(c)==='physical'?velocityVerlet(s,dtS,c):propagateKepler(stateToElements(s,c.body.muM3S2),dtS,c.body.muM3S2);}
export function sphereOfInfluence(body:CelestialBody,positionM:Vec3,children:readonly CelestialBody[]):CelestialBody{for(const child of children)if(mag(sub(positionM,{x:child.orbit?.semiMajorAxisM??Infinity,y:0,z:0}))<child.soiRadiusM)return child;return body;}
export interface FixedStepClock {accumulatorS:number;fixedDtS:number}
export function advanceFixed(clock:FixedStepClock,frameDtS:number,step:(dtS:number)=>void,maxSteps=250){clock.accumulatorS+=Math.min(frameDtS,5);let count=0;while(clock.accumulatorS+1e-12>=clock.fixedDtS&&count<maxSteps){step(clock.fixedDtS);clock.accumulatorS=Math.max(0,clock.accumulatorS-clock.fixedDtS);count++;}return count;}
