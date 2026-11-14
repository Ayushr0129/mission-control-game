import { Part, PartCategory, partsRepository } from '../../data/parts';
import { RocketBlueprint } from '../../data/rockets';
import { AscentVehicleSpec, EngineSpec, StageSpec } from './ascentPhysics';

const partsFor=(rocket:RocketBlueprint,index:number)=>rocket.stages[index].partIds.map(id=>partsRepository.getById(id)).filter((part):part is Part=>part!==undefined);

export function ascentVehicleSpec(rocket:RocketBlueprint):AscentVehicleSpec {
  const stages:StageSpec[]=rocket.stages.map((stage,index)=>{
    const parts=partsFor(rocket,index),engines=new Map<string,EngineSpec>();
    for(const part of parts)if(part.category===PartCategory.Engine){const prior=engines.get(part.id);if(prior)prior.count++;else engines.set(part.id,{count:1,thrustSeaLevelN:Number(part.thrustSlKn)*1000,thrustVacuumN:Number(part.thrustVacKn)*1000,ispSeaLevelS:Number(part.ispSlS),ispVacuumS:Number(part.ispVacS),minThrottle:part.engineType==='solid'?1:.35});}
    const fallbackDry=parts.reduce((sum,part)=>sum+Number(part.dryMassKg),0),fallbackPropellant=parts.reduce((sum,part)=>sum+Number(part.propellantMassKg??0),0)*stage.propellantLoad;
    const diameter=stage.flightDiameterM??Math.max(1,...parts.map(part=>part.compatibility.diameterM)),baseCd=parts.length?parts.reduce((sum,part)=>sum+part.dragCoefficient,0)/parts.length:.3;
    return{id:stage.id,dryMassKg:stage.flightDryMassKg??fallbackDry,propellantKg:stage.flightPropellantKg??fallbackPropellant,diameterM:diameter,baseCd,engines:[...engines.values()]};
  });
  return{name:rocket.name,payloadMassKg:rocket.payloadMassKg,stages,maxDynamicPressurePa:65000};
}
