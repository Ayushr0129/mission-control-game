import { describe, it, expect } from 'vitest';
import trip from '../src/data/trajectory.json';
import { solveTrip, APOLLO } from '../src/sim/trip';
import { D } from '../src/sim/cr3bp';

const m = trip.meta;
describe('the trip, solved to Apollo 11', () => {
  it('leaves at NASA\'s injection speed and passes 111 km above the Moon', () => {
    expect(m.injectionSpeed).toBeCloseTo(10.841, 3);
    expect(m.periluneKm).toBeGreaterThan(96); expect(m.periluneKm).toBeLessThan(126);
  });
  it('the do-nothing path is a true free return: home, caught by the atmosphere inside the corridor', () => {
    expect(m.freeReturnPerigeeKm).toBeGreaterThan(20); expect(m.freeReturnPerigeeKm).toBeLessThan(60);
    expect(m.freeReturnEntryAngle).toBeGreaterThan(-7.5); expect(m.freeReturnEntryAngle).toBeLessThan(-5.5);
  });
  it('slows to about 1 km/s on the way out', () => {
    expect(m.minSpeedOut).toBeLessThan(1.3); expect(m.minSpeedOut).toBeGreaterThan(0.8);
    expect(m.outboundCoastH).toBeGreaterThan(50); expect(m.outboundCoastH).toBeLessThan(80);
  });
  it('comes home at Apollo 11\'s entry angle, speed and coast time', () => {
    expect(m.entryAngle).toBeCloseTo(APOLLO.entryAngle, 1);
    expect(Math.abs(m.entrySpeed - APOLLO.entrySpeed)).toBeLessThan(0.1);
    expect(Math.abs(m.homeCoastH - APOLLO.homeCoastH)).toBeLessThan(1);
  });
  it('the paths start where they should and end at the Earth', () => {
    const near = (p: { x: number[]; y: number[] }, i: number, x: number, y: number, tol: number) => Math.hypot(p.x[i] - x, p.y[i] - y) < tol;
    expect(near(trip.outbound, trip.outbound.x.length - 1, D, 0, 2000)).toBe(true);           // ends at the Moon
    expect(near(trip.homebound, 0, D, 0, 2000)).toBe(true);                                     // starts at the Moon
    expect(near(trip.homebound, trip.homebound.x.length - 1, 0, 0, 6600)).toBe(true);          // ends at the Earth
    expect(near(trip.freeReturnHome, trip.freeReturnHome.x.length - 1, 0, 0, 6600)).toBe(true);
    for (const p of [trip.outbound, trip.freeReturnHome, trip.homebound]) {
      expect(p.t.length).toBe(p.x.length); expect(p.v.length).toBe(p.x.length);
      for (let i = 1; i < p.t.length; i++) expect(p.t[i]).toBeGreaterThan(p.t[i - 1]);
    }
  });
  it('the shipped data is what the solver gives today', () => {
    expect(JSON.parse(JSON.stringify(solveTrip()))).toEqual(trip);
  }, 120000);
});
