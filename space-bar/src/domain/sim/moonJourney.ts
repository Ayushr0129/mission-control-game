import { BODIES } from './bodies';
import { elementsToState, hohmannDeltaV, propagateKepler, stateToElements, StateVector } from './orbit';
import { add, mag, scale, sub, unit, v3 } from './units';

export type MoonJourneyPhase = 'parking-orbit' | 'trans-lunar' | 'lunar-approach' | 'lunar-orbit' | 'descent' | 'surface' | 'ascent' | 'trans-earth' | 're-entry' | 'recovered' | 'failed';
export interface MoonJourneyState { phase: MoonJourneyPhase; missionTimeS: number; frame: 'earth' | 'moon'; vessel: StateVector; deltaVRemainingMps: number; events: readonly string[] }
export interface TransferPlan { departureDeltaVMps: number; transferTimeS: number; lunarPhaseAngleRad: number }

export const planTransLunarInjection = (parkingAltitudeM: number): TransferPlan => {
  const earth = BODIES.earth, moon = BODIES.moon, r1 = earth.radiusM + parkingAltitudeM, r2 = moon.orbit!.semiMajorAxisM;
  const transfer = hohmannDeltaV(r1, r2, earth.muM3S2), lunarRate = Math.sqrt(earth.muM3S2 / r2 ** 3);
  return { departureDeltaVMps: transfer.departureMps, transferTimeS: transfer.transferTimeS, lunarPhaseAngleRad: Math.PI - lunarRate * transfer.transferTimeS };
};

export const createMoonJourney = (parkingAltitudeM: number, deltaVRemainingMps: number): MoonJourneyState => {
  const earth = BODIES.earth, r = earth.radiusM + parkingAltitudeM;
  return { phase: 'parking-orbit', missionTimeS: 0, frame: 'earth', vessel: { positionM: v3(r, 0, 0), velocityMps: v3(0, Math.sqrt(earth.muM3S2 / r), 0) }, deltaVRemainingMps, events: ['PARKING_ORBIT'] };
};

const spend = (state: MoonJourneyState, amountMps: number, event: string): MoonJourneyState | null => amountMps > state.deltaVRemainingMps ? null : { ...state, deltaVRemainingMps: state.deltaVRemainingMps - amountMps, events: [...state.events, event] };
export const executeTli = (state: MoonJourneyState): MoonJourneyState => {
  if (state.phase !== 'parking-orbit') return state;
  const altitude = mag(state.vessel.positionM) - BODIES.earth.radiusM, plan = planTransLunarInjection(altitude), paid = spend(state, plan.departureDeltaVMps, 'TLI');
  if (!paid) return { ...state, phase: 'failed', events: [...state.events, 'TLI_DELTA_V_SHORTFALL'] };
  return { ...paid, phase: 'trans-lunar', vessel: { ...state.vessel, velocityMps: add(state.vessel.velocityMps, scale(unit(state.vessel.velocityMps), plan.departureDeltaVMps)) } };
};

export const coastMoonJourney = (state: MoonJourneyState, dtS: number): MoonJourneyState => {
  if (dtS <= 0 || !['parking-orbit', 'trans-lunar', 'lunar-approach', 'lunar-orbit', 'trans-earth'].includes(state.phase)) return state;
  const body = BODIES[state.frame], elements = stateToElements(state.vessel, body.muM3S2);
  if (!(elements.semiMajorAxisM > 0) || elements.eccentricity >= 1) return { ...state, missionTimeS: state.missionTimeS + dtS };
  const vessel = propagateKepler(elements, dtS, body.muM3S2), next = { ...state, vessel, missionTimeS: state.missionTimeS + dtS };
  if (state.frame === 'earth' && state.phase === 'trans-lunar') {
    const plan = planTransLunarInjection(mag(state.vessel.positionM) - BODIES.earth.radiusM), moonAngle = plan.lunarPhaseAngleRad + Math.sqrt(BODIES.earth.muM3S2 / BODIES.moon.orbit!.semiMajorAxisM ** 3) * next.missionTimeS;
    const moonPosition = scale(v3(Math.cos(moonAngle), Math.sin(moonAngle), 0), BODIES.moon.orbit!.semiMajorAxisM);
    if (mag(sub(vessel.positionM, moonPosition)) <= BODIES.moon.soiRadiusM) return { ...next, frame: 'moon', phase: 'lunar-approach', vessel: { positionM: sub(vessel.positionM, moonPosition), velocityMps: vessel.velocityMps }, events: [...next.events, 'MOON_SOI_ENTRY'] };
  }
  return next;
};

export const executeLoi = (state: MoonJourneyState, orbitAltitudeM = 100_000): MoonJourneyState => {
  if (state.phase !== 'lunar-approach' || state.frame !== 'moon') return state;
  const moon = BODIES.moon, targetSpeed = Math.sqrt(moon.muM3S2 / (moon.radiusM + orbitAltitudeM)), speed = mag(state.vessel.velocityMps), required = Math.max(0, speed - targetSpeed), paid = spend(state, required, 'LOI');
  if (!paid) return { ...state, phase: 'failed', events: [...state.events, 'LOI_DELTA_V_SHORTFALL'] };
  return { ...paid, phase: 'lunar-orbit', vessel: elementsToState({ semiMajorAxisM: moon.radiusM + orbitAltitudeM, eccentricity: 0, inclinationRad: 0, longitudeAscendingNodeRad: 0, argumentPeriapsisRad: 0, trueAnomalyRad: 0 }, moon.muM3S2) };
};

export const beginDescent = (state: MoonJourneyState): MoonJourneyState => state.phase === 'lunar-orbit' ? { ...state, phase: 'descent', events: [...state.events, 'POWERED_DESCENT'] } : state;
export const recordLanding = (state: MoonJourneyState, safe: boolean): MoonJourneyState => state.phase === 'descent' ? { ...state, phase: safe ? 'surface' : 'failed', events: [...state.events, safe ? 'LUNAR_TOUCHDOWN' : 'LANDING_FAILURE'] } : state;
export const launchFromMoon = (state: MoonJourneyState, ascentDeltaVMps: number): MoonJourneyState => { const paid = state.phase === 'surface' ? spend(state, ascentDeltaVMps, 'LUNAR_ASCENT') : null; return paid ? { ...paid, phase: 'ascent' } : state.phase === 'surface' ? { ...state, phase: 'failed', events: [...state.events, 'ASCENT_DELTA_V_SHORTFALL'] } : state; };
export const executeTei = (state: MoonJourneyState, requiredDeltaVMps: number): MoonJourneyState => { const paid = ['lunar-orbit', 'ascent'].includes(state.phase) ? spend(state, requiredDeltaVMps, 'TEI') : null; return paid ? { ...paid, phase: 'trans-earth', frame: 'earth' } : state; };
export const assessReentry = (flightPathAngleRad: number, corridor: { shallowRad: number; steepRad: number }): 'skip-out' | 'safe' | 'overload' => flightPathAngleRad > corridor.shallowRad ? 'skip-out' : flightPathAngleRad < corridor.steepRad ? 'overload' : 'safe';
