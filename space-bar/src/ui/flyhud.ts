import { h, fmt } from './dom';
import { Site } from '../sim/types';
import { OrbitSetup } from '../sim/orbit';
import { AscentSetup } from '../sim/ascent';
import { LandingSetup } from '../sim/landing';
import { FlyControls } from './flycontrols';
import { uiText } from '../prefs';

/** The overlays for the three flown moments and the landing-site pick. DOM only: the rules live in sim/flight.ts. */
export type Moment = 'liftoff' | 'orbit' | 'site' | 'landing' | 'tli' | 'coast' | 'corridor' | 'reentry';
/** on a touch screen there is no keyboard: the hints name the on-screen buttons */
const touch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
export interface Hud { el: HTMLElement; set(v: Record<string, number | string | boolean>): void; remove(): void }
export interface SiteChoice { id: Site; label: string; blurb: string; locked: string | null }

/** One full-screen layer per moment. Pressing anywhere on it (or the space bar) is the control. */
export function flyLayer(host: HTMLElement, moment: Moment, prompt: string, warnings: string[] = []): HTMLElement {
  const el = h('div', { class: 'fly-layer', 'data-moment': moment },
    h('div', { class: 'fly-top' },
      prompt && h('p', { class: 'fly-prompt', role: 'status', 'aria-live': 'polite' }, prompt),
      ...warnings.map((w) => h('p', { class: 'fly-warn' }, h('b', {}, 'Harder than usual. '), w))),
    h('div', { class: 'fly-note-host' }));
  host.append(el);
  return el;
}

/** A short verdict in the middle of the picture: "Clean staging", "Abort. One more try." */
export function flyNote(layer: HTMLElement, text: string, tone: 'good' | 'ok' | 'bad' = 'ok') {
  const host = layer.querySelector('.fly-note-host') as HTMLElement;
  host.replaceChildren(text ? h('p', { class: `fly-note ${tone}`, role: 'status' }, text) : '');
}

/** "Let the autopilot fly" while flying by hand, "Fly it myself" while the autopilot has it. */
export function autoLink(layer: HTMLElement, auto: boolean, onToggle: () => void) {
  layer.querySelector('.fly-auto')?.remove();
  layer.append(h('button', { class: 'fly-auto', type: 'button', onclick: (e: Event) => { e.stopPropagation(); onToggle(); } }, auto ? 'Fly it myself' : 'Let the autopilot fly'));
}

/** Apollo 11's climb to orbit: 185 km up at 7.79 km/s, reached at 000:11:49. The game's climb is mapped onto it. */
export const ASCENT_REAL = { km: 185, kms: 7.79, startKms: 0.41, met: 11 * 60 + 49 };
/** The real-world numbers for a share of the climb: altitude in km, speed in km/s (Earth's spin gives 0.41 at the pad), clock in s. */
export function ascentReal(frac: number) {
  const u = Math.max(0, Math.min(1, frac)), R = ASCENT_REAL;
  return { km: R.km * u, kms: R.startKms + (R.kms - R.startKms) * Math.pow(u, 1.3), met: R.met * u };
}
/** Liftoff: the stage's fuel, the altitude and speed against orbit, and the throttle. */
export function ascentHud(layer: HTMLElement, s: AscentSetup): Hud {
  const fuel = h('i', { class: 'fill' }), label = h('span', {}, uiText('First stage', 'Premier étage'));
  const height = h('b', {}, '0'), thr = h('b', {}, '100'), speed = h('b', {}, '0.41'), clock = h('b', { class: 'met' }, '000:00:00');
  const el = h('div', { class: 'land-readout ascent-readout' },
    h('div', { class: 'clock' }, h('span', {}, uiText('Mission elapsed time', 'Temps écoulé de mission')), clock),
    h('div', { class: 'fuel' }, label, h('div', { class: 'fuelrow', role: 'meter', 'aria-label': uiText('Stage fuel', 'Carburant de l’étage') }, fuel)),
    h('div', { class: 'height' }, h('span', {}, uiText(`Altitude / ${ASCENT_REAL.km}`, `Altitude / ${ASCENT_REAL.km}`)), height, h('em', {}, 'km')),
    h('div', { class: 'spd' }, h('span', {}, uiText(`Speed / ${ASCENT_REAL.kms}`, `Vitesse / ${ASCENT_REAL.kms}`)), speed, h('em', {}, 'km/s')),
    h('div', { class: 'thr' }, h('span', {}, uiText('Throttle', 'Poussée')), thr, h('em', {}, '%')));
  layer.append(el);
  return {
    el,
    set(v) {
      const f = Math.max(0, Math.min(1, Number(v.fuel)));
      fuel.style.width = `${f * 100}%`;
      label.textContent = Number(v.stage) === 2 ? uiText('Second stage', 'Deuxième étage') : f <= 0 ? uiText('First stage: empty', 'Premier étage : vide') : uiText('First stage', 'Premier étage');
      el.classList.toggle('low', Number(v.stage) === 1 && f < 0.2); el.classList.toggle('dry', Number(v.stage) === 1 && f <= 0);
      const r = ascentReal(Number(v.y) / s.targetY);
      height.textContent = r.km.toFixed(r.km < 10 ? 1 : 0); speed.textContent = r.kms.toFixed(2); clock.textContent = met(r.met);
      thr.textContent = fmt(Number(v.throttle) * 100);
    },
    remove() { el.remove(); },
  };
}

/** The guide arrow by itself, for a craft that has no speed labels: the rocket on its way up, the ship at the Moon. */
export function aimMark(layer: HTMLElement): { set(m: { x: number; y: number; r: number; guide: number; aligned: boolean; show: boolean }): void; remove(): void } {
  const guide = h('div', { class: 'guide', 'aria-hidden': 'true' }, h('i', {}));
  const el = h('div', { class: 'marks' }, guide);
  layer.append(el);
  return {
    set(m) {
      el.hidden = !m.show; if (!m.show) return;
      el.style.transform = `translate(${m.x}px, ${m.y}px)`;
      guide.style.transform = `rotate(${m.guide}rad)`;
      guide.className = `guide ${m.aligned ? 'aligned' : ''}`;
      (guide.firstElementChild as HTMLElement).style.height = `${Math.max(60, m.r)}px`;
    },
    remove() { el.remove(); },
  };
}

/** Moon orbit: the speed against the band to stop in, and how much of the window is left. */
export function orbitBurnHud(layer: HTMLElement, s: OrbitSetup): Hud {
  // the scale runs from a little past the start speed to a little past the target, whichever way the burn goes
  const a = Math.min(s.speed0, s.lo), b = Math.max(s.speed0, s.hi), pad = (b - a) * 0.15;
  const from = a - pad, to = b + pad, pos = (v: number) => `${Math.max(0, Math.min(1, (v - from) / (to - from))) * 100}%`;
  const km = (v: number) => v.toFixed(2);
  const goal = s.id === 'tli' ? uiText('Speed to reach the Moon', 'Vitesse pour atteindre la Lune') : s.id === 'tei' ? uiText('Speed to fall home', 'Vitesse pour rentrer') : uiText('Moon orbit speed', 'Vitesse d’orbite lunaire');
  const needle = h('i', { class: 'needle' }), speed = h('b', {}, '0'), left = h('i', { class: 'fill' }), word = h('small', { class: 'hint' }, '');
  const box = h('div', { class: 'speed' }, h('span', {}, uiText('Speed', 'Vitesse')), speed, h('em', {}, 'km/s'), word);
  const el = h('div', { class: 'land-readout orbit-readout' },
    box,
    h('div', { class: 'band' }, h('span', {}, `${goal}: ${km(s.lo)} – ${km(s.hi)} km/s`),
      h('div', { class: 'scale', role: 'meter', 'aria-label': goal }, h('i', { class: 'green', style: `left:${pos(s.lo)};width:calc(${pos(s.hi)} - ${pos(s.lo)})` }), needle)),
    h('div', { class: 'fuel' }, h('span', {}, uiText('Window to burn', 'Fenêtre de poussée')), h('div', { class: 'fuelrow', role: 'meter', 'aria-label': uiText('Time left to burn', 'Temps restant pour pousser') }, left)));
  layer.append(el);
  return {
    el,
    set(v) {
      const sp = Number(v.speed), inside = sp >= s.lo && sp <= s.hi;
      speed.textContent = km(sp); needle.style.left = pos(sp);
      box.className = `speed ${inside ? 'safe' : sp < s.lo ? 'must' : ''}`;
      word.textContent = inside ? uiText('In the band: let go', 'Dans la bande : relâchez') : sp < s.lo ? uiText('Too slow', 'Trop lent') : uiText('Too fast', 'Trop rapide');
      const l = Math.max(0, Math.min(1, Number(v.left)));
      left.style.width = `${l * 100}%`; el.classList.toggle('low', l < 0.3);
    },
    remove() { el.remove(); },
  };
}

/** Landing: fuel, height and throttle at the side. The speeds live beside the craft (craftMarks). */
export function landingHud(layer: HTMLElement, s: LandingSetup): Hud {
  const fuel = h('i', { class: 'fill' });
  const height = h('b', {}, '0'), thr = h('b', {}, '100'), tryEl = h('span', { class: 'try' }, '');
  const el = h('div', { class: 'land-readout' },
    h('div', { class: 'fuel' }, h('span', {}, 'Fuel'), h('div', { class: 'fuelrow', role: 'meter', 'aria-label': 'Landing fuel' }, fuel)),
    h('div', { class: 'height' }, h('span', {}, 'Height'), height, h('em', {}, 'm')),
    h('div', { class: 'thr' }, h('span', {}, 'Throttle'), thr, h('em', {}, '%')),
    tryEl);
  layer.append(el);
  return {
    el,
    set(v) {
      const f = Math.max(0, Math.min(1, Number(v.fuel) / s.fuel));
      fuel.style.width = `${f * 100}%`;
      el.classList.toggle('low', f < 0.2); el.classList.toggle('dry', f <= 0);
      height.textContent = fmt(Math.max(0, Number(v.h)));
      thr.textContent = fmt(Number(v.throttle) * 100);
      tryEl.textContent = Number(v.try) === 2 ? 'Second try' : '';
    },
    remove() { el.remove(); },
  };
}

/** The "how to" card before a moment. The game waits on it until Start. */
export function howTo(layer: HTMLElement, title: string, steps: string[], notes: string[], warnings: string[], onStart: () => void) {
  let started = false;
  const start = () => { if (started) return; started = true; removeEventListener('keydown', onKey, true); el.remove(); onStart(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) start(); } };
  const btn = h('button', { class: 'btn primary big start', type: 'button', onclick: (e: Event) => { e.stopPropagation(); start(); } }, 'Start');
  const el = h('div', { class: 'howto glass', role: 'dialog', 'aria-label': title },
    h('p', { class: 'eyebrow' }, 'How to'), h('h3', {}, title),
    h('ol', {}, ...steps.map((t) => h('li', {}, t))),
    ...notes.map((t) => h('p', { class: 'howto-note' }, t)),
    ...warnings.map((w) => h('p', { class: 'fly-warn' }, h('b', {}, 'Harder than usual. '), w)),
    h('div', { class: 'keys' }, ...keyHints()),
    h('div', { class: 'row' }, btn), h('p', { class: 'fine' }, 'The game waits here until you start.'));
  layer.append(el);
  addEventListener('keydown', onKey, true);
  btn.focus({ preventScroll: true });
}
const keyHints = () => (touch()
  ? [h('span', {}, h('kbd', {}, '◀ ▶'), ' turn'), h('span', {}, h('kbd', {}, 'ENGINE'), ' hold to burn'), h('span', {}, h('kbd', {}, 'slider'), ' throttle')]
  : [h('span', {}, h('kbd', {}, '←'), h('kbd', {}, '→'), ' turn'), h('span', {}, h('kbd', {}, 'SPACE'), ' hold to burn'), h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), ' throttle')]);

/** The coach: the same steps as the card, as a checklist with the current one lit. */
export function coach(layer: HTMLElement, steps: string[]): { set(active: number): void; remove(): void } {
  const items = steps.map((t, i) => h('li', {}, h('i', { 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, t)));
  const el = h('ol', { class: 'coach', 'aria-live': 'polite' }, ...items);
  layer.append(el);
  let last = -1;
  return {
    set(active) { if (active === last) return; last = active; items.forEach((li, i) => { li.className = i < active ? 'done' : i === active ? 'on' : ''; }); },
    remove() { el.remove(); },
  };
}

/** The control strip: what each key does, and buttons that do the same for a mouse or a finger. */
export function controlStrip(layer: HTMLElement, controls: FlyControls): { remove(): void } {
  const hold = (what: 'left' | 'right' | 'engine', label: string, key: string, cls = '') => {
    const b = h('button', { class: `ctl ${cls}`, type: 'button', 'data-ctl': what, tabindex: '-1', 'aria-label': what === 'engine' ? 'Engine' : `Turn ${what}` }, h('b', {}, label), h('small', {}, key));
    const down = (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ } controls.hold(what, true); b.classList.add('held'); };
    const up = () => { controls.hold(what, false); b.classList.remove('held'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };
  const engine = hold('engine', 'Engine', touch() ? 'hold' : 'SPACE', 'engine');
  const slider = h('input', { class: 'throttle', type: 'range', min: '0', max: '100', step: '5', value: '100', tabindex: '-1', 'aria-label': 'Throttle' }) as HTMLInputElement;
  const pct = h('b', {}, '100%');
  slider.addEventListener('input', () => controls.setThrottle(Number(slider.value) / 100));
  slider.addEventListener('pointerdown', (e) => e.stopPropagation());
  slider.addEventListener('pointerup', () => slider.blur());
  const el = h('div', { class: 'strip' },
    h('div', { class: 'turns' }, hold('left', '◀', touch() ? 'turn' : '←'), hold('right', '▶', touch() ? 'turn' : '→')),
    h('label', { class: 'thr' }, h('span', {}, 'Throttle ', pct, !touch() && h('small', {}, ' ↑ ↓')), slider),
    engine);
  layer.append(el);
  const draw = () => { const s = controls.state; pct.textContent = `${Math.round(s.throttle * 100)}%`; if (document.activeElement !== slider) slider.value = String(Math.round(s.throttle * 100)); engine.classList.toggle('on', s.engine); };
  controls.onChange = draw; draw();
  return { remove() { controls.onChange = undefined; el.remove(); } };
}

/** What sits beside the craft: its sideways and downward speed with arrows, and the guide arrow to point along. */
export interface MarkState {
  x: number; y: number; scale: number;            // where the craft is on screen, and pixels per metre
  vx: number; vy: number;                          // m/s; vy positive going up
  sideOk: boolean; down: 'safe' | 'fall' | 'soon' | 'now';
  guide: number; angle: number; aligned: boolean; show: boolean;
}
export function craftMarks(layer: HTMLElement): { set(m: MarkState): void; remove(): void } {
  const sideNum = h('b', {}, '0'), downNum = h('b', {}, '0');
  const side = h('div', { class: 'speed-side' }, h('i', { class: 'arr' }, '▶'), sideNum, h('small', {}, 'm/s sideways'));
  const down = h('div', { class: 'speed-down' }, h('i', { class: 'arr' }, '▼'), downNum, h('small', {}, 'm/s down'));
  const guide = h('div', { class: 'guide', 'aria-hidden': 'true' }, h('i', {}));
  const el = h('div', { class: 'marks' }, guide, side, down);
  layer.append(el);
  return {
    set(m) {
      el.hidden = !m.show; if (!m.show) return;
      el.style.transform = `translate(${m.x}px, ${m.y}px)`;
      const r = Math.max(46, 9 * m.scale); // clear of the craft's body
      const right = m.vx >= 0, sp = Math.abs(m.vx);
      side.style.transform = `translate(${right ? r : -r}px, -50%)${right ? '' : ' translateX(-100%)'}`;
      side.className = `speed-side ${m.sideOk ? 'ok' : 'bad'} ${right ? 'r' : 'l'}`;
      (side.firstElementChild as HTMLElement).textContent = sp < 0.05 ? '•' : right ? '▶' : '◀';
      sideNum.textContent = fmt(sp, 1);
      const falling = m.vy <= 0;
      // beside the craft on the side away from the sideways label, a little lower: the engine flame owns the space below
      down.style.transform = right ? `translate(calc(-100% - ${r}px), 30%)` : `translate(${r}px, 30%)`;
      down.className = `speed-down ${m.down}`;
      (down.firstElementChild as HTMLElement).textContent = falling ? '▼' : '▲';
      (down.lastElementChild as HTMLElement).textContent = falling ? 'm/s down' : 'm/s up';
      downNum.textContent = fmt(Math.abs(m.vy), 1);
      guide.style.transform = `rotate(${m.guide}rad)`;
      guide.className = `guide ${m.aligned ? 'aligned' : ''}`;
      (guide.firstElementChild as HTMLElement).style.height = `${r + 34}px`;
    },
    remove() { el.remove(); },
  };
}

/** The landing site: two cards. A locked site says why. */
export function sitePick(layer: HTMLElement, sites: SiteChoice[], onPick: (id: Site) => void) {
  const el = h('div', { class: 'site-pick' }, ...sites.map((x) => h('button', {
    class: 'site', type: 'button', 'data-site': x.id, disabled: !!x.locked,
    onclick: (e: Event) => { e.stopPropagation(); el.remove(); onPick(x.id); },
  }, h('b', {}, x.label), h('span', {}, x.blurb), x.locked && h('small', { class: 'site-why' }, x.locked))));
  layer.append(el);
  (el.querySelector('.site:not([disabled])') as HTMLElement | null)?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- the trip: clock, warp, readouts
/** Mission elapsed time the way NASA wrote it: hours, minutes, seconds, as 075:49:50. */
export function met(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${String(h).padStart(3, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}
export const WARPS = [1, 10, 100, 1000, 10000, 100000];
/** The clock, the warp control, the speed and distances, and a line comparing the moment with Apollo 11. */
export function tripHud(layer: HTMLElement, onWarp: (dir: -1 | 1) => void): { set(v: { met: number; warp: number | null; speed: number; dEarth: number; dMoon: number; apollo: string }): void; remove(): void } {
  const clock = h('b', { class: 'met' }, '000:00:00'), warpEl = h('b', {}, '1×');
  const slower = h('button', { class: 'ctl warp-btn', type: 'button', 'data-warp': 'slower', 'aria-label': uiText('Slower time warp', 'Accélération plus lente'), onclick: (e: Event) => { e.stopPropagation(); onWarp(-1); } }, h('b', {}, '‹'), h('small', {}, ','));
  const faster = h('button', { class: 'ctl warp-btn', type: 'button', 'data-warp': 'faster', 'aria-label': uiText('Faster time warp', 'Accélération plus rapide'), onclick: (e: Event) => { e.stopPropagation(); onWarp(1); } }, h('b', {}, '›'), h('small', {}, '.'));
  const warpBox = h('div', { class: 'warp' }, slower, h('div', {}, h('span', {}, uiText('Time warp', 'Accélération')), warpEl), faster);
  const speed = h('b', {}, '0'), dE = h('b', {}, '0'), dM = h('b', {}, '0'), apollo = h('p', { class: 'apollo-line' }, '');
  const top = h('div', { class: 'trip-clock' }, h('span', {}, uiText('Mission elapsed time', 'Temps écoulé de mission')), clock, apollo);
  const read = h('div', { class: 'land-readout trip-readout' },
    h('div', {}, h('span', {}, uiText('Speed', 'Vitesse')), speed, h('em', {}, 'km/s')),
    h('div', {}, h('span', {}, uiText('From Earth', 'De la Terre')), dE, h('em', {}, 'km')),
    h('div', {}, h('span', {}, uiText('From Moon', 'De la Lune')), dM, h('em', {}, 'km')));
  layer.append(top, read, warpBox);
  const n = (x: number) => Math.round(x).toLocaleString('en-US');
  return {
    set(v) {
      clock.textContent = met(v.met);
      warpBox.hidden = v.warp === null; if (v.warp !== null) warpEl.textContent = `${n(v.warp)}×`;
      speed.textContent = v.speed.toFixed(2); dE.textContent = n(v.dEarth); dM.textContent = n(v.dMoon);
      apollo.textContent = v.apollo;
    },
    remove() { top.remove(); read.remove(); warpBox.remove(); },
  };
}

/** The entry-angle gauge: a needle over a scale with the green corridor. */
export function corridorHud(layer: HTMLElement, s: { lo: number; hi: number }): Hud {
  const from = s.lo - 3.5, to = s.hi + 3.5, pos = (v: number) => `${Math.max(0, Math.min(1, (v - from) / (to - from))) * 100}%`;
  const needle = h('i', { class: 'needle' }), val = h('b', {}, '0'), word = h('small', { class: 'hint' }, '');
  const box = h('div', { class: 'speed' }, h('span', {}, uiText('Entry angle', 'Angle d’entrée')), val, h('em', {}, '°'), word);
  const el = h('div', { class: 'land-readout orbit-readout corridor-readout' }, box,
    h('div', { class: 'band' }, h('span', {}, uiText(`Corridor ${s.lo}° to ${s.hi}°`, `Couloir de ${s.lo}° à ${s.hi}°`)),
      h('div', { class: 'scale', role: 'meter', 'aria-label': uiText('Entry angle against the corridor', 'Angle d’entrée par rapport au couloir') },
        h('i', { class: 'green', style: `left:${pos(s.lo)};width:calc(${pos(s.hi)} - ${pos(s.lo)})` }), needle),
      h('div', { class: 'scale-ends' }, h('small', {}, uiText('steeper: burns up', 'trop raide : brûle')), h('small', {}, uiText('shallower: skips off', 'trop plat : rebondit')))),
  );
  layer.append(el);
  return {
    el,
    set(v) {
      const a = Number(v.angle), inside = a >= s.lo && a <= s.hi;
      val.textContent = a.toFixed(2); needle.style.left = pos(a);
      box.className = `speed ${inside ? 'safe' : 'must'}`;
      word.textContent = inside ? uiText('In the corridor', 'Dans le couloir') : a < s.lo ? uiText('Too steep', 'Trop raide') : uiText('Too shallow', 'Trop plat');
    },
    remove() { el.remove(); },
  };
}
