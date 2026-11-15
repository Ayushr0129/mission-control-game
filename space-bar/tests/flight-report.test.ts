import { describe, expect, it } from 'vitest';
import { flightReportSnapshot } from '../src/ui/flight/flightReport';

describe('post-flight report data', () => {
  it('derives player comparison values from recorded telemetry', () => {
    expect(flightReportSnapshot([{timeS:0,altitudeM:0,speedMps:400,fuelKg:1000},{timeS:10,altitudeM:2000,speedMps:900,fuelKg:700},{timeS:20,altitudeM:1500,speedMps:800,fuelKg:500}])).toEqual({finalAltitudeM:1500,peakAltitudeM:2000,peakSpeedMps:900,fuelRemainingKg:500});
  });
  it('returns finite zeroes when a flight has no samples', () => {
    expect(flightReportSnapshot([])).toEqual({finalAltitudeM:0,peakAltitudeM:0,peakSpeedMps:0,fuelRemainingKg:0});
  });
});
