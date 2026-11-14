import { describe, expect, it } from 'vitest';
import { ROCKET_PRESETS } from '../src/data/rockets';
import { createFlight, setDifficulty, stepFlight } from '../src/domain/sim/flight';
import { initialFlightEducation, recordFlightEducation, reportSuggestions } from '../src/domain/sim/flightEducation';

const input=(overrides:Partial<Parameters<typeof recordFlightEducation>[1]>={})=>({timeS:1,dtS:.02,altitudeM:1000,speedMps:200,airSpeedMps:180,fuelKg:1000,massKg:2000,dragN:2000,gravityMps2:9.8,radialSpeedMps:100,dynamicPressurePa:10000,maxQPa:10000,activeStage:0,previousStage:0,stableOrbit:false,...overrides});

describe('flight education',()=>{
 it('samples only once per simulated second and accumulates physical losses',()=>{
  const first=recordFlightEducation(initialFlightEducation(),input()),second=recordFlightEducation(first,input({timeS:1.5})),third=recordFlightEducation(second,input({timeS:2}));
  expect(first.samples).toHaveLength(1);expect(second.samples).toHaveLength(1);expect(third.samples).toHaveLength(2);
  expect(third.dragLossJ).toBeGreaterThan(0);expect(third.gravityLossJ).toBeGreaterThan(0);
 });
 it('triggers each learning moment once from real telemetry events',()=>{
  let state=recordFlightEducation(initialFlightEducation(),input());
  state=recordFlightEducation(state,input({timeS:2,dynamicPressurePa:7000,maxQPa:10000}));
  state=recordFlightEducation(state,input({timeS:3,activeStage:1,previousStage:0}));
  state=recordFlightEducation(state,input({timeS:4,activeStage:1,previousStage:1,stableOrbit:true}));
  expect(state.moments).toEqual(['drag','max-q','staging','orbit']);
 });
 it('turns difficulty choices into guidance defaults',()=>{
  const flight=createFlight(ROCKET_PRESETS[2],1,'explorer');
  expect(flight.guidanceMode).toBe('assist');
  expect(setDifficulty(flight,'engineer').guidanceMode).toBe('manual');
  expect(setDifficulty(flight,'student').guidanceMode).toBe('assist');
 });
 it('records lightweight telemetry without changing the fixed step',()=>{
  const start=createFlight(ROCKET_PRESETS[2],1);const result=stepFlight(start,.1).state;
  expect(result.missionTimeS).toBeCloseTo(.1,8);expect(result.education.samples.length).toBeLessThanOrEqual(1);
 });
 it('turns loss balance into practical advice',()=>{
  const education={...initialFlightEducation(),dragLossJ:30,gravityLossJ:70,samples:[{timeS:1,altitudeM:100000,speedMps:4000,fuelKg:100}]};
  expect(reportSuggestions(education).join(' ')).toContain('atmosphere');
  expect(reportSuggestions(education).join(' ')).toContain('circularization');
 });
});
