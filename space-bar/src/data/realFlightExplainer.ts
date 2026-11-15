import { SourceMetadata } from './truth';

export type RealFlightMoment = 'countdown' | 'ignition' | 'liftoff' | 'pitch-over' | 'drag' | 'max-q' | 'cutoff' | 'staging' | 'orbit' | 'tli' | 'coast' | 'loi' | 'landing' | 're-entry';

export interface ExplainerState {
  moment: RealFlightMoment;
  thrustN: number;
  weightN: number;
  altitudeM: number;
  horizontalSpeedMps: number;
  dynamicPressurePa: number;
  dragN: number;
  stage: number;
}

export interface ExplainerRule {
  id: string;
  moment: RealFlightMoment;
  priority: number;
  cooldownS: number;
  text: (state: ExplainerState) => string;
  why: string;
  detail: string;
  source: SourceMetadata;
}

const nasaSource = (location: string): SourceMetadata => ({ document: 'nasa-apollo11', location, retrieved: '2026-11-14', status: 'verified' });
const atmosphereSource = (location: string): SourceMetadata => ({ document: 'nasa-ussa76', location, retrieved: '2026-11-14', status: 'verified' });
const physicsSource = (location: string): SourceMetadata => ({ document: 'physics-equations', location, retrieved: '2026-11-14', status: 'verified' });
const mn = (value: number) => (value / 1_000_000).toFixed(2);
const km = (value: number) => (value / 1000).toFixed(1);

export const REAL_FLIGHT_EXPLAINER_RULES: readonly ExplainerRule[] = [
  { id: 'countdown', moment: 'countdown', priority: 100, cooldownS: 1, text: () => 'The countdown synchronizes the vehicle, range and launch team.', why: 'A launch begins only when every critical system is ready.', detail: 'The simulation remains clamped to the rotating launch site.', source: nasaSource('Apollo 11 launch sequence') },
  { id: 'ignition', moment: 'ignition', priority: 95, cooldownS: 2, text: (s) => `Engines are producing ${mn(s.thrustN)} MN while the pad still holds the rocket.`, why: 'Thrust must build and stabilize before release.', detail: 'Thrust is interpolated from sea-level to vacuum performance using ambient pressure.', source: nasaSource('Apollo 11 launch sequence') },
  { id: 'liftoff', moment: 'liftoff', priority: 90, cooldownS: 4, text: (s) => `Thrust ${mn(s.thrustN)} MN is greater than weight ${mn(s.weightN)} MN, so the rocket accelerates upward.`, why: 'A rocket lifts only when upward thrust exceeds its weight.', detail: 'TWR = thrust ÷ (mass × local gravity).', source: physicsSource('Newton’s second law and thrust-to-weight ratio') },
  { id: 'pitch', moment: 'pitch-over', priority: 80, cooldownS: 8, text: (s) => `Pitch-over is building sideways speed: ${km(s.horizontalSpeedMps)} km/s so far.`, why: 'Orbit needs horizontal speed, not just height.', detail: 'The guidance target gradually turns from radial to prograde.', source: nasaSource('Apollo 11 ascent guidance') },
  { id: 'drag', moment: 'drag', priority: 70, cooldownS: 10, text: (s) => `Air resistance is ${Math.round(s.dragN / 1000)} kN at ${km(s.altitudeM)} km altitude.`, why: 'The rocket pushes air aside; denser air and higher speed create more drag.', detail: 'D = ½ρv²CdA, opposite velocity relative to the rotating atmosphere.', source: atmosphereSource('Density table and aerodynamic drag equation') },
  { id: 'max-q', moment: 'max-q', priority: 85, cooldownS: 30, text: (s) => `Max-Q: aerodynamic pressure has peaked near ${(s.dynamicPressurePa / 1000).toFixed(1)} kPa.`, why: 'This is usually the most demanding part of ascent for the vehicle structure.', detail: 'q = ½ρv².', source: atmosphereSource('Dynamic pressure') },
  { id: 'cutoff', moment: 'cutoff', priority: 85, cooldownS: 10, text: () => 'Engine cutoff: the target apoapsis is high enough, so the vehicle coasts.', why: 'Burning continuously would waste propellant and overshoot the parking orbit.', detail: 'The pilot waits for apoapsis before the prograde circularization burn.', source: physicsSource('Two-burn orbital insertion') },
  { id: 'staging', moment: 'staging', priority: 95, cooldownS: 10, text: (s) => `Stage ${s.stage} separated after its usable propellant was depleted.`, why: 'Dropping empty tanks means later engines do not accelerate dead mass.', detail: 'Dry mass is removed only at a physical separation event.', source: nasaSource('Apollo 11 staging sequence') },
  { id: 'orbit', moment: 'orbit', priority: 100, cooldownS: 60, text: (s) => `Parking orbit achieved at ${km(s.altitudeM)} km, moving sideways at ${km(s.horizontalSpeedMps)} km/s.`, why: 'The vehicle is falling around Earth fast enough to keep missing the ground.', detail: 'Orbit requires a computed periapsis above the atmosphere, not an altitude checkpoint.', source: physicsSource('Osculating orbital elements') },
  { id: 'tli', moment: 'tli', priority: 100, cooldownS: 60, text: () => 'Trans-lunar injection raises the Earth orbit until it intersects the Moon’s path.', why: 'The spacecraft needs additional energy to leave parking orbit.', detail: 'The burn and launch window are derived from the current parking orbit and the Moon’s position.', source: nasaSource('Apollo 11 translunar injection') },
  { id: 'coast', moment: 'coast', priority: 60, cooldownS: 20, text: () => 'The engines are off; gravity alone bends the coast trajectory.', why: 'Coasting saves propellant while the vehicle follows its orbit.', detail: 'Vacuum coast uses analytic two-body propagation and switches reference frame inside the Moon’s sphere of influence.', source: physicsSource('Two-body coast') },
  { id: 'loi', moment: 'loi', priority: 100, cooldownS: 60, text: () => 'Lunar-orbit insertion slows the spacecraft so the Moon can capture it.', why: 'Without this burn, the spacecraft would fly past the Moon.', detail: 'The required braking is computed from arrival speed and the target circular lunar orbit.', source: nasaSource('Apollo 11 lunar-orbit insertion') },
  { id: 'landing', moment: 'landing', priority: 100, cooldownS: 60, text: () => 'The lander spends delta-v to cancel sideways and downward motion.', why: 'A safe touchdown needs low vertical and horizontal speed.', detail: 'The existing fixed-step lunar landing pilot now records success or failure in the Moon journey.', source: nasaSource('Apollo 11 powered descent') },
  { id: 're-entry', moment: 're-entry', priority: 100, cooldownS: 60, text: () => 'The heat shield turns atmospheric entry energy into heat.', why: 'The capsule must slow from orbital speed without exceeding its corridor.', detail: 'The mission supplies a sourced shallow and steep entry corridor; outside it the capsule skips out or overloads.', source: nasaSource('Apollo 11 Earth return') },
] as const;

export const explainerRuleFor = (moment: RealFlightMoment) => REAL_FLIGHT_EXPLAINER_RULES.filter((rule) => rule.moment === moment).sort((a, b) => b.priority - a.priority)[0];
