import { describe, expect, it } from 'vitest';
import { PartCategory, PartId } from '../src/data/parts';
import { ROCKET_PRESETS } from '../src/data/rockets';
import { plumeExpansion, rocketPartCount, rocketVisualModel } from '../src/ui/rocketVisual';

const preset=(id:string)=>ROCKET_PRESETS.find(rocket=>String(rocket.id)===id)!;

describe('real-scale rocket visual data',()=>{
 it.each(ROCKET_PRESETS.map(rocket=>[rocket.name,rocket] as const))('%s uses its stored height-to-diameter ratio',(_,rocket)=>{
  const model=rocketVisualModel(rocket);
  expect(model.coreAspectRatio).toBeCloseTo(rocket.heightM/rocket.visual.bodyDiameterM,8);
  expect(model.heightM).toBe(rocket.heightM);
  expect(model.stageLengthsM).toEqual(rocket.stages.map(stage=>stage.lengthM));
 });

 it('contains the defining components of each historical stack',()=>{
  const saturn=rocketVisualModel(preset('saturn-v')),falcon=rocketVisualModel(preset('falcon-9')),heavy=rocketVisualModel(preset('falcon-heavy')),shuttle=rocketVisualModel(preset('discovery')),starship=rocketVisualModel(preset('starship'));
  expect(saturn.pieces.find(piece=>piece.role==='engine')?.count).toBe(5);
  expect(falcon.pieces).toEqual(expect.arrayContaining([expect.objectContaining({role:'grid-fin',count:4}),expect.objectContaining({role:'landing-leg',count:4})]));
  expect(heavy.pieces).toEqual(expect.arrayContaining([expect.objectContaining({role:'booster',count:2})]));
  expect(shuttle.pieces).toEqual(expect.arrayContaining([expect.objectContaining({role:'booster',count:2}),expect.objectContaining({role:'orbiter',count:1})]));
  expect(starship.pieces.find(piece=>piece.role==='engine')?.count).toBe(33);
 });

 it('changes the visual model when an editor part is added or removed',()=>{
  const falcon=preset('falcon-9'),before=rocketPartCount(falcon,PartCategory.Engine);
  const edited={...falcon,stages:falcon.stages.map((stage,index)=>index===0?{...stage,partIds:[...stage.partIds,'merlin1d' as PartId]}:stage)};
  expect(rocketPartCount(edited,PartCategory.Engine)).toBe(before+1);
  expect(rocketVisualModel(edited).pieces[1].count).not.toBe(rocketVisualModel(falcon).pieces[1].count);
 });

 it('widens an engine plume as atmospheric pressure falls',()=>{
  expect(plumeExpansion(100000)).toBeGreaterThan(plumeExpansion(0));
 });
});
