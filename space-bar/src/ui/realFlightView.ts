import { ROCKET_PRESETS } from '../data/rockets';
import { ExplainerState, RealFlightMoment, explainerRuleFor } from '../data/realFlightExplainer';
import { ascentVehicleSpec } from '../domain/sim/vehicleSpec';
import { BODIES, LAUNCH_SITES } from '../domain/sim/bodies';
import { h } from './dom';
import { FALCON_9_PITCH_PROGRAM, REAL_ASCENT_STEP_S, SATURN_V_PITCH_PROGRAM, createRealAscent, gravityTurnPilotPitch, realAscentTelemetry, stepRealAscent } from '../sim/realAscent';

const format = (value: number, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '—';

export function realFlightView(onExit: () => void): HTMLElement {
  const params = new URLSearchParams(location.search);
  const requested = params.get('rocket') ?? 'saturn-v';
  const blueprint = ROCKET_PRESETS.find((rocket) => rocket.id === requested) ?? ROCKET_PRESETS.find((rocket) => rocket.id === 'saturn-v')!;
  const spec = ascentVehicleSpec(blueprint);
  const earth = BODIES.earth;
  const cape = LAUNCH_SITES.find((site) => site.id === 'cape')!;
  const environment = { body: earth, launchLatitudeRad: cape.latitudeRad, launchAltitudeM: cape.altitudeM, dragEnabled: true };
  let state = createRealAscent(spec, environment);
  let throttle = 0;
  let manualPitch = 0;
  let guidance = true;
  let demoSpeed = 1;
  let running = true;
  let ascentCutoff = false;
  let circularizing = false;
  let priorStage = state.activeStage;
  let maxQAnnounced = false;
  let lastMoment: RealFlightMoment = 'countdown';
  let lastFrame = performance.now();
  let accumulator = 0;
  const trace: string[] = [];

  const rocket = h('div', { class: 'real-rocket', 'aria-label': `${blueprint.name} flight marker` }, h('i'), h('b'));
  const trajectory = h('div', { class: 'real-trajectory', role: 'img', 'aria-label': 'Live ascent trajectory', html: '<svg viewBox="0 0 1000 620" aria-hidden="true"><defs><linearGradient id="sky" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#16405b"/><stop offset="1" stop-color="#02050a"/></linearGradient></defs><rect width="1000" height="620" fill="url(#sky)"/><circle cx="500" cy="1040" r="470" class="real-earth"/><polyline class="real-path" points=""/></svg>' });
  const path = trajectory.querySelector<SVGPolylineElement>('.real-path')!;
  const numbers = h('div', { class: 'real-number-grid' });
  const nowTitle = h('h3', {}, 'Countdown');
  const nowText = h('p', { class: 'real-now-text' });
  const whyText = h('p', { class: 'real-why' });
  const detailText = h('p', { class: 'real-detail', hidden: true });
  const status = h('span', { class: 'real-status' }, 'CLAMPED');
  const guidanceButton = h('button', { type: 'button', class: 'btn', onclick: () => { guidance = !guidance; guidanceButton.textContent = `Guidance: ${guidance ? 'ON' : 'MANUAL'}`; } }, 'Guidance: ON');
  const detailButton = h('button', { type: 'button', class: 'btn', onclick: () => { detailText.hidden = !detailText.hidden; detailButton.textContent = detailText.hidden ? 'Detailed' : 'Simple'; } }, 'Detailed');
  const igniteButton = h('button', { type: 'button', class: 'btn primary', onclick: () => { throttle = throttle > 0 ? 0 : 1; } }, 'Ignite / cutoff');
  const speedButton = h('button', { type: 'button', class: 'btn', onclick: () => { demoSpeed = demoSpeed >= 8 ? 1 : demoSpeed * 2; speedButton.textContent = `Demo ${demoSpeed}×`; } }, 'Demo 1×');

  const root = h('main', { class: 'real-flight-screen' },
    h('header', { class: 'real-flight-header' }, h('div', {}, h('span', { class: 'eyebrow' }, 'REAL ASCENT · OPT-IN'), h('h1', {}, blueprint.name)), status, h('button', { class: 'btn ghost', onclick: onExit }, 'Exit to start')),
    h('section', { class: 'real-flight-layout' },
      h('div', { class: 'real-stage' }, trajectory, rocket, h('div', { class: 'real-horizon-label' }, 'EARTH'), h('div', { class: 'real-controls' }, igniteButton, guidanceButton, speedButton, detailButton), h('p', { class: 'real-key-help' }, '← → turn · SPACE engine · ENTER stage · G guidance · , . demo speed')),
      h('aside', { class: 'real-panels' },
        h('section', { class: 'real-panel now' }, h('span', { class: 'eyebrow' }, 'NOW'), nowTitle, nowText, whyText, detailText),
        h('section', { class: 'real-panel' }, h('span', { class: 'eyebrow' }, 'NUMBERS'), numbers),
        h('section', { class: 'real-panel history' }, h('span', { class: 'eyebrow' }, 'COMPARE WITH HISTORY'), h('h3', {}, blueprint.name), h('p', {}, 'Your flight is calculated from your live state. Historical milestone comparison will use sourced mission timelines when those records are added.'), h('span', { class: 'badge placeholder' }, 'timeline pending source')))),
    h('div', { class: 'real-warning', hidden: true }));

  const sourceRule = (moment: RealFlightMoment, explainer: ExplainerState) => {
    const rule = explainerRuleFor(moment);
    if (!rule) return;
    nowTitle.textContent = moment.replace('-', ' ').toUpperCase();
    nowText.textContent = rule.text(explainer);
    whyText.textContent = `Why: ${rule.why}`;
    detailText.textContent = rule.detail;
  };

  const update = () => {
    const telemetry = realAscentTelemetry(spec, state, environment);
    const massKg = telemetry.massKg;
    const localGravity = earth.muM3S2 / Math.max(1, Math.hypot(state.positionM.x, state.positionM.y)) ** 2;
    const explainer: ExplainerState = { moment: lastMoment, thrustN: telemetry.thrustN * throttle, weightN: massKg * localGravity, altitudeM: telemetry.altitudeM, horizontalSpeedMps: telemetry.horizontalSpeedMps, dynamicPressurePa: telemetry.dynamicPressurePa, dragN: telemetry.dragN, stage: state.activeStage + 1 };
    let moment: RealFlightMoment = 'countdown';
    if (telemetry.stableParkingOrbit) moment = 'orbit';
    else if (circularizing || (ascentCutoff && telemetry.altitudeM > 100000)) moment = 'coast';
    else if (state.activeStage !== priorStage) moment = 'staging';
    else if (throttle === 0 && state.launched) moment = 'cutoff';
    else if (!state.launched && throttle > 0) moment = telemetry.thrustN * throttle > massKg * localGravity ? 'liftoff' : 'ignition';
    else if (!maxQAnnounced && telemetry.dynamicPressurePa >= state.maxDynamicPressurePa && telemetry.dynamicPressurePa > 1000) moment = 'max-q';
    else if (state.pitchRad > 0.05) moment = telemetry.dragN > 1000 ? 'drag' : 'pitch-over';
    else if (state.launched) moment = 'liftoff';
    if (moment === 'max-q') maxQAnnounced = true;
    if (moment !== lastMoment || moment === 'liftoff' || moment === 'pitch-over') { lastMoment = moment; sourceRule(moment, { ...explainer, moment }); }
    priorStage = state.activeStage;
    status.textContent = telemetry.stableParkingOrbit ? 'ORBIT' : state.launched ? `STAGE ${state.activeStage + 1}` : throttle > 0 ? 'IGNITION' : 'CLAMPED';
    numbers.replaceChildren(...[
      ['Altitude', `${format(telemetry.altitudeM / 1000)} km`], ['Speed', `${format(telemetry.speedMps / 1000, 2)} km/s`], ['Horizontal', `${format(telemetry.horizontalSpeedMps / 1000, 2)} km/s`],
      ['Dynamic pressure', `${format(telemetry.dynamicPressurePa / 1000)} kPa`], ['Drag', `${format(telemetry.dragN / 1000)} kN`], ['Mass', `${format(telemetry.massKg / 1000)} t`],
      ['Apoapsis', `${format(telemetry.apoapsisM / 1000)} km`], ['Periapsis', `${format(telemetry.periapsisM / 1000)} km`], ['Eccentricity', format(telemetry.eccentricity, 3)], ['MET', `${format(state.timeS, 1)} s`],
    ].map(([label, value]) => h('div', {}, h('span', {}, label), h('b', {}, value))));
    const altitudeScale = Math.min(1, Math.max(0, telemetry.altitudeM / 300000));
    const horizontalScale = Math.max(-.45, Math.min(.45, telemetry.horizontalSpeedMps / 9000 * .45));
    const x = 500 + horizontalScale * 850;
    const y = 565 - altitudeScale * 500;
    const stageBox = trajectory.getBoundingClientRect();
    const markerX = stageBox.width * (x / 1000);
    const markerY = stageBox.height * (0.5 - altitudeScale * 0.42);
    rocket.style.transform = `translate(${markerX}px, ${markerY}px) rotate(${state.pitchRad * 180 / Math.PI}deg)`;
    trace.push(`${x.toFixed(1)},${y.toFixed(1)}`); if (trace.length > 700) trace.shift();
    path.setAttribute('points', trace.join(' '));
  };

  const keys = new Set<string>();
  const keydown = (event: KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'KeyG', 'Comma', 'Period'].includes(event.code)) event.preventDefault();
    if (event.code === 'Space' && !event.repeat) throttle = throttle > 0 ? 0 : 1;
    if (event.code === 'KeyG' && !event.repeat) { guidance = !guidance; guidanceButton.textContent = `Guidance: ${guidance ? 'ON' : 'MANUAL'}`; }
    if (event.code === 'Enter' && !event.repeat) state = stepRealAscent(spec, state, environment, { throttle, targetPitchRad: manualPitch, stage: true });
    if (event.code === 'Period' && !event.repeat) demoSpeed = Math.min(8, demoSpeed * 2);
    if (event.code === 'Comma' && !event.repeat) demoSpeed = Math.max(1, demoSpeed / 2);
    keys.add(event.code);
  };
  const keyup = (event: KeyboardEvent) => keys.delete(event.code);
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  const frame = (time: number) => {
    if (!root.isConnected) { running = false; removeEventListener('keydown', keydown); removeEventListener('keyup', keyup); return; }
    const frameSeconds = Math.min(0.1, (time - lastFrame) / 1000) * demoSpeed;
    lastFrame = time;
    accumulator += frameSeconds;
    while (accumulator >= REAL_ASCENT_STEP_S) {
      const telemetry = realAscentTelemetry(spec, state, environment);
      if (telemetry.apoapsisM >= 200000) ascentCutoff = true;
      if (ascentCutoff && telemetry.radialSpeedMps <= 0) circularizing = true;
      if (guidance) {
        const program = blueprint.id === 'saturn-v' ? SATURN_V_PITCH_PROGRAM : FALCON_9_PITCH_PROGRAM;
        manualPitch = circularizing ? Math.PI / 2 : gravityTurnPilotPitch(program, telemetry);
        throttle = !ascentCutoff || (circularizing && telemetry.periapsisM < 155000) ? 1 : 0;
      } else {
        if (keys.has('ArrowLeft')) manualPitch = Math.max(0, manualPitch - 0.7 * REAL_ASCENT_STEP_S);
        if (keys.has('ArrowRight')) manualPitch = Math.min(Math.PI / 2, manualPitch + 0.7 * REAL_ASCENT_STEP_S);
      }
      state = stepRealAscent(spec, state, environment, { throttle, targetPitchRad: manualPitch, stage: false });
      accumulator -= REAL_ASCENT_STEP_S;
    }
    update();
    if (running) requestAnimationFrame(frame);
  };
  sourceRule('countdown', { moment: 'countdown', thrustN: 0, weightN: 0, altitudeM: 0, horizontalSpeedMps: 0, dynamicPressurePa: 0, dragN: 0, stage: 1 });
  update();
  requestAnimationFrame(frame);
  return root;
}
