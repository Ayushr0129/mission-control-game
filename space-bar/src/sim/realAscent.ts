import { AscentVehicleSpec, G0_MPS2, standardAtmosphere1976 } from '../domain/sim/ascentPhysics';
import { CelestialBody } from '../domain/sim/bodies';
import { StateVector, stateToElements } from '../domain/sim/orbit';
import { Vec3, add, dot, mag, scale, sub, unit, v3 } from '../domain/sim/units';

export const REAL_ASCENT_STEP_S = 0.02;

export interface RealAscentEnvironment {
  body: CelestialBody;
  launchLatitudeRad: number;
  launchAltitudeM: number;
  dragEnabled: boolean;
}

export interface RealAscentControl {
  throttle: number;
  targetPitchRad: number;
  stage: boolean;
}

export interface RealAscentState extends StateVector {
  timeS: number;
  pitchRad: number;
  activeStage: number;
  stagePropellantKg: readonly number[];
  launched: boolean;
  events: readonly string[];
  maxDynamicPressurePa: number;
  gravityLossMps: number;
  dragLossMps: number;
}

export interface RealAscentTelemetry {
  altitudeM: number;
  speedMps: number;
  horizontalSpeedMps: number;
  radialSpeedMps: number;
  massKg: number;
  thrustN: number;
  dragN: number;
  dynamicPressurePa: number;
  apoapsisM: number;
  periapsisM: number;
  eccentricity: number;
  stableParkingOrbit: boolean;
  activeStageDry: boolean;
  allPropellantDepleted: boolean;
}

interface Derivative { position: Vec3; velocity: Vec3; propellantKgS: number; gravityLossMps2: number; dragLossMps2: number }

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const radialAt = (position: Vec3) => unit(position);
const eastAt = (position: Vec3) => {
  const radial = radialAt(position);
  return v3(radial.y, -radial.x, 0);
};

const stageMassKg = (spec: AscentVehicleSpec, state: RealAscentState, activePropellantKg = state.stagePropellantKg[state.activeStage] ?? 0) =>
  spec.payloadMassKg + spec.stages.slice(state.activeStage).reduce((total, stage, offset) => total + stage.dryMassKg + (offset === 0 ? activePropellantKg : state.stagePropellantKg[state.activeStage + offset] ?? 0), 0);

const engineAt = (spec: AscentVehicleSpec, state: RealAscentState, pressurePa: number, throttle: number) => {
  const stage = spec.stages[state.activeStage];
  if (!stage || throttle <= 0 || (state.stagePropellantKg[state.activeStage] ?? 0) <= 0) return { thrustN: 0, massFlowKgS: 0 };
  const pressureFraction = clamp(pressurePa / 101325, 0, 1);
  let thrustN = 0;
  let massFlowKgS = 0;
  for (const engine of stage.engines) {
    const level = clamp(throttle, engine.minThrottle, 1);
    const thrustPerEngine = engine.thrustVacuumN + (engine.thrustSeaLevelN - engine.thrustVacuumN) * pressureFraction;
    const ispS = engine.ispVacuumS + (engine.ispSeaLevelS - engine.ispVacuumS) * pressureFraction;
    const engineThrustN = thrustPerEngine * engine.count * level;
    thrustN += engineThrustN;
    massFlowKgS += ispS > 0 ? engineThrustN / (ispS * G0_MPS2) : 0;
  }
  return { thrustN, massFlowKgS };
};

const atmosphereVelocity = (position: Vec3, env: RealAscentEnvironment) => {
  const angularRate = 2 * Math.PI / env.body.rotationPeriodS;
  return scale(eastAt(position), angularRate * mag(position) * Math.cos(env.launchLatitudeRad));
};

function derivative(spec: AscentVehicleSpec, state: RealAscentState, env: RealAscentEnvironment, control: RealAscentControl, position: Vec3, velocity: Vec3, propellantKg: number): Derivative {
  const radiusM = mag(position);
  const altitudeM = radiusM - env.body.radiusM;
  const atmosphere = standardAtmosphere1976(altitudeM);
  const airVelocity = atmosphereVelocity(position, env);
  const airRelativeVelocity = sub(velocity, airVelocity);
  const airSpeedMps = mag(airRelativeVelocity);
  const active = spec.stages[state.activeStage];
  const areaM2 = Math.PI * ((active?.diameterM ?? 1) / 2) ** 2;
  const speedOfSoundMps = Math.sqrt(1.4 * 287.05 * Math.max(150, atmosphere.temperatureK));
  const mach = airSpeedMps / speedOfSoundMps;
  const cd = (active?.baseCd ?? 0.3) * (0.78 + 0.72 * Math.exp(-(((mach - 1) / 0.32) ** 2)));
  const dynamicPressurePa = 0.5 * atmosphere.densityKgM3 * airSpeedMps ** 2;
  const dragN = env.dragEnabled ? dynamicPressurePa * cd * areaM2 : 0;
  const dragAcceleration = airSpeedMps > 0 ? scale(unit(airRelativeVelocity), -dragN / Math.max(1, stageMassKg(spec, state, propellantKg))) : v3();
  const radial = radialAt(position);
  const east = eastAt(position);
  const bodyAxis = add(scale(radial, Math.cos(state.pitchRad)), scale(east, Math.sin(state.pitchRad)));
  const engine = engineAt(spec, { ...state, positionM: position, velocityMps: velocity, stagePropellantKg: state.stagePropellantKg.map((value, index) => index === state.activeStage ? propellantKg : value) }, atmosphere.pressurePa, control.throttle);
  const massKg = stageMassKg(spec, state, propellantKg);
  const gravityAcceleration = scale(position, -env.body.muM3S2 / radiusM ** 3);
  const thrustAcceleration = scale(bodyAxis, engine.thrustN / Math.max(1, massKg));
  return {
    position: velocity,
    velocity: add(add(gravityAcceleration, thrustAcceleration), dragAcceleration),
    propellantKgS: -engine.massFlowKgS,
    gravityLossMps2: engine.thrustN > 0 ? env.body.muM3S2 / radiusM ** 2 * Math.max(0, dot(bodyAxis, radial)) : 0,
    dragLossMps2: mag(dragAcceleration),
  };
}

const advance = (state: RealAscentState, derivativeValue: Derivative, dtS: number, propellantKg: number): { position: Vec3; velocity: Vec3; propellantKg: number } => ({
  position: add(state.positionM, scale(derivativeValue.position, dtS)),
  velocity: add(state.velocityMps, scale(derivativeValue.velocity, dtS)),
  propellantKg: Math.max(0, propellantKg + derivativeValue.propellantKgS * dtS),
});

export function createRealAscent(spec: AscentVehicleSpec, env: RealAscentEnvironment): RealAscentState {
  const radiusM = env.body.radiusM + env.launchAltitudeM;
  const positionM = v3(0, radiusM, 0);
  return {
    positionM,
    velocityMps: atmosphereVelocity(positionM, env),
    timeS: 0,
    pitchRad: 0,
    activeStage: 0,
    stagePropellantKg: spec.stages.map((stage) => stage.propellantKg),
    launched: false,
    events: ['CLAMPED_ON_PAD'],
    maxDynamicPressurePa: 0,
    gravityLossMps: 0,
    dragLossMps: 0,
  };
}

export function realAscentTelemetry(spec: AscentVehicleSpec, state: RealAscentState, env: RealAscentEnvironment): RealAscentTelemetry {
  const radiusM = mag(state.positionM);
  const altitudeM = radiusM - env.body.radiusM;
  const radial = radialAt(state.positionM);
  const east = eastAt(state.positionM);
  const atmosphere = standardAtmosphere1976(altitudeM);
  const airRelative = sub(state.velocityMps, atmosphereVelocity(state.positionM, env));
  const active = spec.stages[state.activeStage];
  const areaM2 = Math.PI * ((active?.diameterM ?? 1) / 2) ** 2;
  const dynamicPressurePa = 0.5 * atmosphere.densityKgM3 * mag(airRelative) ** 2;
  const dragN = env.dragEnabled ? dynamicPressurePa * (active?.baseCd ?? 0.3) * areaM2 : 0;
  const engine = engineAt(spec, state, atmosphere.pressurePa, 1);
  const elements = stateToElements(state, env.body.muM3S2);
  const apoapsisM = elements.semiMajorAxisM * (1 + elements.eccentricity) - env.body.radiusM;
  const periapsisM = elements.semiMajorAxisM * (1 - elements.eccentricity) - env.body.radiusM;
  return {
    altitudeM,
    speedMps: mag(state.velocityMps),
    horizontalSpeedMps: dot(state.velocityMps, east),
    radialSpeedMps: dot(state.velocityMps, radial),
    massKg: stageMassKg(spec, state),
    thrustN: engine.thrustN,
    dragN,
    dynamicPressurePa,
    apoapsisM,
    periapsisM,
    eccentricity: elements.eccentricity,
    stableParkingOrbit: periapsisM >= 150000 && apoapsisM >= periapsisM && elements.eccentricity < 0.1,
    activeStageDry: (state.stagePropellantKg[state.activeStage] ?? 0) <= 1e-6,
    allPropellantDepleted: state.stagePropellantKg.slice(state.activeStage).every((fuel) => fuel <= 1e-6),
  };
}

export function stepRealAscent(spec: AscentVehicleSpec, current: RealAscentState, env: RealAscentEnvironment, control: RealAscentControl, dtS = REAL_ASCENT_STEP_S): RealAscentState {
  let state = current;
  if (control.stage && (state.stagePropellantKg[state.activeStage] ?? 0) <= 1e-6 && state.activeStage < spec.stages.length - 1) {
    state = { ...state, activeStage: state.activeStage + 1, events: [...state.events, `STAGE_${state.activeStage + 1}_SEPARATION`] };
  }
  const maxPitchRateRadS = 6 * Math.PI / 180;
  const pitchError = control.targetPitchRad - state.pitchRad;
  const pitchRad = state.pitchRad + clamp(pitchError, -maxPitchRateRadS * dtS, maxPitchRateRadS * dtS);
  state = { ...state, pitchRad };
  const propellantKg = state.stagePropellantKg[state.activeStage] ?? 0;
  const k1 = derivative(spec, state, env, control, state.positionM, state.velocityMps, propellantKg);
  const a2 = advance(state, k1, dtS / 2, propellantKg);
  const k2 = derivative(spec, state, env, control, a2.position, a2.velocity, a2.propellantKg);
  const a3 = advance(state, k2, dtS / 2, propellantKg);
  const k3 = derivative(spec, state, env, control, a3.position, a3.velocity, a3.propellantKg);
  const a4 = advance(state, k3, dtS, propellantKg);
  const k4 = derivative(spec, state, env, control, a4.position, a4.velocity, a4.propellantKg);
  const weighted = (one: Vec3, two: Vec3, three: Vec3, four: Vec3) => scale(add(add(one, scale(two, 2)), add(scale(three, 2), four)), dtS / 6);
  let positionM = add(state.positionM, weighted(k1.position, k2.position, k3.position, k4.position));
  let velocityMps = add(state.velocityMps, weighted(k1.velocity, k2.velocity, k3.velocity, k4.velocity));
  const propellantUsedKg = Math.min(propellantKg, Math.max(0, -(k1.propellantKgS + 2 * k2.propellantKgS + 2 * k3.propellantKgS + k4.propellantKgS) * dtS / 6));
  const stagePropellantKg = state.stagePropellantKg.map((value, index) => index === state.activeStage ? Math.max(0, value - propellantUsedKg) : value);
  const telemetryBeforeClamp = realAscentTelemetry(spec, { ...state, positionM, velocityMps, stagePropellantKg }, env);
  const radial = radialAt(state.positionM);
  const thrustRadialN = (control.throttle > 0 ? telemetryBeforeClamp.thrustN * clamp(control.throttle, 0, 1) : 0) * Math.cos(pitchRad);
  const weightN = telemetryBeforeClamp.massKg * env.body.muM3S2 / mag(state.positionM) ** 2;
  let launched = state.launched;
  if (!launched && thrustRadialN <= weightN) {
    positionM = scale(radial, env.body.radiusM + env.launchAltitudeM);
    velocityMps = atmosphereVelocity(positionM, env);
  } else launched = true;
  const events = [...state.events];
  return {
    ...state,
    positionM,
    velocityMps,
    pitchRad,
    activeStage: state.activeStage,
    stagePropellantKg,
    launched,
    events,
    timeS: state.timeS + dtS,
    maxDynamicPressurePa: Math.max(state.maxDynamicPressurePa, telemetryBeforeClamp.dynamicPressurePa),
    gravityLossMps: state.gravityLossMps + (k1.gravityLossMps2 + 2 * k2.gravityLossMps2 + 2 * k3.gravityLossMps2 + k4.gravityLossMps2) * dtS / 6,
    dragLossMps: state.dragLossMps + (k1.dragLossMps2 + 2 * k2.dragLossMps2 + 2 * k3.dragLossMps2 + k4.dragLossMps2) * dtS / 6,
  };
}

export interface PitchProgramPoint { altitudeM: number; pitchDeg: number }

export const createPitchProgram = (points: readonly PitchProgramPoint[]) => (altitudeM: number) => {
  const altitude = Math.max(0, altitudeM);
  const upperIndex = points.findIndex((point) => point.altitudeM >= altitude);
  if (upperIndex <= 0) return (points[0]?.pitchDeg ?? 0) * Math.PI / 180;
  if (upperIndex < 0) return (points.at(-1)?.pitchDeg ?? 90) * Math.PI / 180;
  const low = points[upperIndex - 1];
  const high = points[upperIndex];
  const blend = (altitude - low.altitudeM) / Math.max(1, high.altitudeM - low.altitudeM);
  return (low.pitchDeg + (high.pitchDeg - low.pitchDeg) * blend) * Math.PI / 180;
};

export const FALCON_9_PITCH_PROGRAM = createPitchProgram([
  { altitudeM: 0, pitchDeg: 0 },
  { altitudeM: 1000, pitchDeg: 0 },
  { altitudeM: 10000, pitchDeg: 25 },
  { altitudeM: 30000, pitchDeg: 55 },
  { altitudeM: 60000, pitchDeg: 75 },
  { altitudeM: 100000, pitchDeg: 88 },
  { altitudeM: 140000, pitchDeg: 90 },
]);

export const SATURN_V_PITCH_PROGRAM = createPitchProgram([
  { altitudeM: 0, pitchDeg: 0 },
  { altitudeM: 1000, pitchDeg: 0 },
  { altitudeM: 10000, pitchDeg: 21 },
  { altitudeM: 30000, pitchDeg: 48 },
  { altitudeM: 60000, pitchDeg: 68 },
  { altitudeM: 100000, pitchDeg: 83 },
  { altitudeM: 150000, pitchDeg: 90 },
]);

export const PARKING_ORBIT_PITCH_PROGRAM = FALCON_9_PITCH_PROGRAM;

export function gravityTurnPilotPitch(program: (altitudeM: number) => number, telemetry: Pick<RealAscentTelemetry, 'altitudeM' | 'radialSpeedMps'>) {
  const verticalSpeedCorrection = clamp((telemetry.radialSpeedMps - 750) / 1500, -1, 1) * 15 * Math.PI / 180;
  return clamp(program(telemetry.altitudeM) + verticalSpeedCorrection, 0, Math.PI / 2);
}
