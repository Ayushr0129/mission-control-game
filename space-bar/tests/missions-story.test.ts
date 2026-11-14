import { describe, expect, it } from 'vitest';
import { HISTORICAL_MISSIONS, missionFor } from '../src/data/missions';
import { storyForEvents } from '../src/data/story/flightScripts';

describe('historical missions and story',()=>{
  it('defines a progressive, unique mission campaign',()=>{expect(HISTORICAL_MISSIONS.length).toBeGreaterThanOrEqual(8);expect(new Set(HISTORICAL_MISSIONS.map(m=>m.id)).size).toBe(HISTORICAL_MISSIONS.length);expect(missionFor(5).id).toBe('apollo-11');});
  it('selects radio dialogue from simulation events',()=>{const lines=storyForEvents(['FLIGHT_READY','FLIGHT_FAILURE']);expect(lines[0].id).toBe('failure');expect(lines.some(line=>line.speaker.includes('CAPCOM')||line.speaker.includes('Flight Director'))).toBe(true);});
});
