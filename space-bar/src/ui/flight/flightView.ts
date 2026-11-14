import { RocketBlueprint } from '../../data/rockets';
import { storyForEvents } from '../../data/story/flightScripts';
import { FlightState, FlightTelemetry, createFlight, flightTelemetry, recoverFlight, setControl, setGuidanceMode, setWarp, stepFlight, trainingManeuver } from '../../domain/sim/flight';
import { v3 } from '../../domain/sim/units';
import { fmt, h } from '../dom';

export interface FlightViewOptions { blueprint: RocketBlueprint; seed: number; initialState?: FlightState; onAutosave: (state: FlightState) => void; onComplete: (state: FlightState) => void; onPause: () => void }
const SAS = ['stability', 'prograde', 'retrograde', 'normal', 'radial-out', 'maneuver'] as const;

export function flightView(options: FlightViewOptions): HTMLElement {
  let state = options.initialState?.physicsVersion===2 ? options.initialState : createFlight(options.blueprint, options.seed), running = true, last = performance.now(), lastAutosave = -1, debugVisible=false;
  const root = h('section', { class: 'flight-console' }), map = h('canvas', { class: 'orbit-map', 'aria-label': 'Orbital map' }) as HTMLCanvasElement;
  const hud = h('div', { class: 'flight-hud' }), radio = h('div', { class: 'radio-log', 'aria-live': 'polite' }, 'CAPCOM: Vehicle telemetry is nominal.'), controls = h('div', { class: 'flight-controls' }),debug=h('pre',{class:'flight-debug',hidden:'true'});
  root.append(h('header', {}, h('b', {}, 'MISSION FLIGHT · FORWARD ONLY'), h('button', { onclick: options.onPause }, 'Ⅱ Pause')), map, hud, controls, debug, radio);

  const draw = (t: FlightTelemetry) => {
    const ctx = map.getContext('2d');
    if (ctx) {
      const ratio = devicePixelRatio || 1, width = map.width = Math.max(1, map.clientWidth * ratio), height = map.height = Math.max(1, map.clientHeight * ratio), bodyRadius = Math.min(width, height) / 7;
      const angle = Math.atan2(state.positionM.y, state.positionM.x), orbitRadius = Math.min(Math.min(width, height) * .43, bodyRadius * (1 + Math.max(0, t.apoapsisM) / 6.371e6));
      ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#173b56'; ctx.beginPath(); ctx.arc(width / 2, height / 2, bodyRadius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#78c6e8'; ctx.beginPath(); ctx.ellipse(width / 2, height / 2, Math.max(bodyRadius + 8, orbitRadius), Math.max(bodyRadius + 8, orbitRadius * .72), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(width / 2 + Math.cos(angle) * orbitRadius, height / 2 + Math.sin(angle) * orbitRadius * .72, 5 * ratio, 0, Math.PI * 2); ctx.fill();
    }
    const values = [['PHASE', state.phase], ['MET', `${Math.floor(state.missionTimeS / 60)}:${String(Math.floor(state.missionTimeS % 60)).padStart(2, '0')}`], ['ALT', `${fmt(t.altitudeM / 1000, 1)} km`], ['VEL', `${fmt(t.surfaceSpeedMps, 0)} m/s`], ['HORIZ',`${fmt(t.horizontalSpeedMps,0)} m/s`],['AP / PE', `${fmt(t.apoapsisM / 1000, 0)} / ${fmt(t.periapsisM / 1000, 0)} km`], ['ECC', fmt(t.eccentricity, 3)], ['ΔV', `${fmt(t.deltaVRemainingMps, 0)} m/s`], ['TWR', fmt(t.twr, 2)], ['FUEL', `${fmt(t.fuelKg / 1000, 1)} t`], ['Q', `${fmt(t.qPa / 1000, 1)} kPa`], ['ATT',`${fmt(t.attitudeDeg,1)}°`],['COMMS', t.comm ? 'LINK' : 'BLACKOUT'], ['WARP', `${state.warp}×`]];
    hud.replaceChildren(...values.map(([key, value]) => h('div', {}, h('small', {}, key), h('b', {}, value))));
    debug.textContent=`ALT       ${fmt(t.altitudeM,1)} m\nSPEED     ${fmt(t.surfaceSpeedMps,1)} m/s\nHORIZONTAL ${fmt(t.horizontalSpeedMps,1)} m/s\nTWR       ${fmt(t.twr,3)}\nTHRUST    ${fmt(t.thrustN/1000,1)} kN\nDRAG      ${fmt(t.dragN/1000,3)} kN\nQ         ${fmt(t.qPa/1000,3)} kPa\nMASS      ${fmt(t.massKg,0)} kg\nFUEL      ${fmt(t.fuelKg,0)} kg\nAP / PE   ${fmt(t.apoapsisM/1000,2)} / ${fmt(t.periapsisM/1000,2)} km\nPERIOD    ${fmt(t.periodS,1)} s\nSTAGE     ${t.activeStage}\n${t.structuralWarning?'⚠ STRUCTURAL LIMIT EXCEEDED':''}`;
  };

  const showManual = () => {
    const modal = h('div', { class: 'flight-manual-modal' }, h('article', {}, h('p', { class: 'eyebrow' }, 'FLIGHT SCHOOL'), h('h2', {}, 'How to fly to the Moon'), h('ol', {}, h('li', {}, 'Throttle up and establish a shallow eastward gravity turn.'), h('li', {}, 'Circularize prograde at apoapsis.'), h('li', {}, 'Plan about 3.1 km/s prograde for trans-lunar injection.'), h('li', {}, 'Coast under time warp and correct closest approach.'), h('li', {}, 'Burn retrograde for lunar orbit, descend, land, ascend and rendezvous.'), h('li', {}, 'Burn home and protect the heat shield during re-entry.')), h('button', { onclick: () => modal.remove() }, 'Close / Continue')));
    root.append(modal);
  };
  const updateControls = () => {
    const command = (kind: 'orbit' | 'tli' | 'loi' | 'land' | 'return') => { state = trainingManeuver(state, kind); radio.textContent = `GUIDANCE: ${kind.toUpperCase()} command accepted.`; };
    controls.replaceChildren(
      h('div', { class: 'throttle-row' }, h('label', {}, 'THROTTLE', h('input', { type: 'range', min: '0', max: '1', step: '.05', value: String(state.controls.throttle), oninput: (event: Event) => { state = setControl(state, { throttle: Number((event.target as HTMLInputElement).value) }); } })), h('button', { onclick: () => { state = setControl(state, { stage: true }); } }, 'STAGE')),
      h('div', { class: 'sas-row' }, ...SAS.map(mode => h('button', { class: state.controls.sas === mode ? 'active' : '', onclick: () => { state = setControl(state, { sas: mode }); updateControls(); } }, mode))),
      h('div',{class:'guidance-row'},h('button',{class:state.guidanceMode==='assist'?'active':'',onclick:()=>{state=setGuidanceMode(state,'assist');updateControls();}},'Gravity-turn assist'),h('button',{class:state.guidanceMode==='manual'?'active':'',onclick:()=>{state=setGuidanceMode(state,'manual');updateControls();}},'Manual steering'),h('button',{onclick:()=>{debugVisible=!debugVisible;debug.hidden=!debugVisible;}},'Debug telemetry')),
      h('div', { class: 'maneuver-row' }, h('button', { onclick: () => command('orbit') }, 'Plan orbit'), h('button', { onclick: () => command('tli') }, 'Plan TLI'), h('button', { onclick: () => command('loi') }, 'Plan LOI'), h('button', { onclick: () => command('land') }, 'Begin landing'), h('button', { onclick: () => command('return') }, 'Return home'), h('button', { onclick: () => { state=recoverFlight(state); radio.textContent='RECOVERY: Crew and vehicle secured.'; } }, 'Recover crew')),
      h('div', { class: 'warp-row' }, ...[1, 10, 100, 1000, 100000].map(warp => h('button', { onclick: () => { state = setWarp(state, warp); updateControls(); } }, `${warp}×`))), h('button', { class: 'flight-manual', onclick: showManual }, 'Flight Manual'));
  };

  const keys: Record<string, Partial<FlightState['controls']>> = { ArrowUp: { pitch: -1 }, ArrowDown: { pitch: 1 }, ArrowLeft: { pitch: -1 }, ArrowRight: { pitch: 1 }, q: { yaw: -1 }, e: { yaw: 1 }, r: { rcs: v3(0, 1, 0) }, f: { rcs: v3(0, -1, 0) } };
  const onKey = (event: KeyboardEvent) => { if (!running) return; if(event.key.startsWith('Arrow'))event.preventDefault();if (event.key === ' ') state = setControl(state, { stage: true }); else if (keys[event.key]) state = setControl(state, keys[event.key]); };
  const onKeyUp=(event:KeyboardEvent)=>{if(event.key.startsWith('Arrow'))state=setControl(state,{pitch:0});};
  addEventListener('keydown', onKey);addEventListener('keyup',onKeyUp); updateControls();
  const loop = (now: number) => {
    if (!running) return; const result = stepFlight(state, Math.min(.1, (now - last) / 1000)); last = now; state = result.state; draw(result.telemetry); const story=storyForEvents(state.events)[0]; if(story)radio.textContent=`${story.speaker}: ${story.text}`;
    const second = Math.floor(state.missionTimeS); if (second > 0 && second % 10 === 0 && second !== lastAutosave) { lastAutosave = second; options.onAutosave(state); }
    if (state.failed || state.phase === 'recovery') { running = false; removeEventListener('keydown', onKey);removeEventListener('keyup',onKeyUp); options.onComplete(state); return; } requestAnimationFrame(loop);
  };
  draw(flightTelemetry(state)); requestAnimationFrame(loop); return root;
}
