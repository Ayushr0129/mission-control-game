import * as THREE from 'three';
import { Ending, phaseNames } from '../data/endings';
import { Cause, FlownResult, Mark, Outcome, Phase, PHASES, Site } from '../sim/types';
import { AUTOPILOT } from '../sim/flight';
import { OrbitBurn, OrbitSetup, gradeOrbit, inBand, offBackwards, orbitOver, orbitPilot, startOrbit as startOrbitBurn, stepOrbit } from '../sim/orbit';
import { Craft, LandingSetup, Verdict, advise, carefulPilot, heightOf, hopeless, impactX, judge, onGround, stepCraft } from '../sim/landing';
import { FlyControls } from '../ui/flycontrols';
import { LanderView } from './landerview';
import { FlightAudio, sfx } from '../ui/audio';
import { Hud, SiteChoice, aimMark, autoLink, coach, controlStrip, craftMarks, flyLayer, flyNote, howTo, landingHud, orbitBurnHud, sitePick } from '../ui/flyhud';
import { rng, earthCanvas, moonCanvas, planet, atmosphere, glowSprite, starField, flame } from './world';
import { buildShip } from './ship';

/**
 * The flight after the rocket leaves the pad. It runs as a sequence of steps:
 * launch and coast are watched, the burn into Moon orbit is flown, the landing site is picked, the landing is
 * flown (with one second try), and the trip home is watched. Before each step the scene asks the simulation
 * whether the mission has already failed there (too heavy, out of power, a part breaking on the coast), and
 * if so plays that ending instead.
 */
const WATCH: Record<'launch' | 'coast' | 'return', number> = { launch: 3, coast: 5, return: 7 };
const SEG = 5;          // seconds the picture takes to move through a phase before a failure plays out
const TAIL = 12;        // seconds of a failure playing out
const CRASH_TAIL = 8;   // a crash at the surface is quicker
const UNDOCK = 2.2;     // the lander separates and turns its legs down before the player takes over
const ABORT_CLIMB = 2.2;
const TALK = 7;         // radio after a good landing
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface FlightDeps {
  tags: string[]; commander: string; liftoff: Mark;
  /** practice: skip the trip and start at the landing site */
  startAt?: 'orbit' | 'site';
  auto(): boolean; setAuto(v: boolean): void;
  /** how the mission stands given what has been flown so far; changes nothing */
  peek(flown: FlownResult): Outcome;
  orbitSetup(): OrbitSetup;
  landingSetup(marks: { liftoff: Mark; orbit: Mark }, site: Site, attempt: 1 | 2): LandingSetup;
  sites(): SiteChoice[];
  chooseSite(id: Site): void;
  ending(cause: Cause | null): Ending;
  /** live numbers for automated tests */
  expose?(o: Record<string, unknown> | null): void;
  onDone(flown: FlownResult): void;
}

type V3 = [number, number, number];
/** Where Earth and the Moon sit at each phase boundary. The ship stays near the middle and the worlds move. */
const KEY: { e: V3; m: V3 }[] = [
  { e: [0, -64, -20], m: [300, 80, -1600] },     // leaving the pad: Earth fills the bottom of the picture
  { e: [-70, -62, -170], m: [230, 50, -1200] },  // out of the atmosphere, heading out
  { e: [-280, -40, -760], m: [70, -12, -300] },  // three days later: the Moon ahead
  { e: [-320, 30, -1000], m: [0, -25, -12] },    // in lunar orbit, Earth rising over the horizon
  { e: [-320, 30, -1000], m: [0, -27, -8] },     // on the surface
  { e: [60, -12, -170], m: [-160, -70, -500] },  // home: Earth grows, the Moon falls behind
];
const MOON_R = 20, EARTH_R = 60;
const ease = (u: number) => { const k = Math.min(1, Math.max(0, u)); return k * k * (3 - 2 * k); };
const lerp3 = (a: V3, b: V3, u: number, out: THREE.Vector3) => out.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);

type Kind = 'watch' | 'orbit' | 'site' | 'landing' | 'talk' | 'fail';
interface Step { kind: Kind; phase: Phase; t0: number; dur: number }
interface Landing {
  setup: LandingSetup; craft: Craft; attempt: 1 | 2; site: Site;
  /** undock is watched in the space view; card waits; descent is flown; abort climbs back; down is on the ground, one way or the other */
  part: 'undock' | 'card' | 'descent' | 'abort' | 'down';
  firing: boolean; throttle: number; abortT: number; from: Craft; downAt: number;
}

export class Flight {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
  private earth: THREE.Mesh; private moon: THREE.Mesh;
  private craft = new THREE.Group(); private ship: THREE.Group; private csm: THREE.Group; private lander: THREE.Group | null;
  private landerMode: 'separate' | 'whole' | 'none'; private stage = new THREE.Group(); private stageFlame: THREE.Group;
  private smFlame: THREE.Group; private ldFlame: THREE.Group | null = null; private dust: THREE.Sprite; private boom: THREE.Sprite;
  private shadow: THREE.Mesh;
  private debris: THREE.Points; private debrisVel = new Float32Array(80 * 3);
  private separated = false; private stageGone = false; private landed = false; private sepY = 0; private dustT = 0;
  private focus = new THREE.Vector3(); private tmp = new THREE.Vector3();
  private raf = 0; private t0 = 0; private last = 0; private done = false;
  private root = document.createElement('div');
  private sub: HTMLElement; private hudLine: HTMLElement; private fx: HTMLCanvasElement; private fade: HTMLElement; private title: HTMLElement; private skipBtn: HTMLElement;
  private audio = new FlightAudio(); private fired = { boom: false, power: false, stinger: false, touch: false };
  private lastSub = ''; private lastRadio = -1;

  private flown: FlownResult;
  private step: Step = { kind: 'watch', phase: 'launch', t0: 0, dur: WATCH.launch };
  private layer: HTMLElement | null = null; private hud: Hud | null = null;
  private orbit: { setup: OrbitSetup; o: OrbitBurn; part: 'card' | 'fly' | 'done'; mark: Mark | null; doneAt: number; engine: number; told: boolean } | null = null;
  private aimEl: ReturnType<typeof aimMark> | null = null; private nose = 0; // how far the ship is turned from nose-first
  private land: Landing | null = null;
  private view: LanderView | null = null; private controls: FlyControls | null = null;
  private coachEl: { set(active: number): void } | null = null; private marksEl: ReturnType<typeof craftMarks> | null = null;
  private failCause: Cause | null = null; private end: Ending | null = null;
  private keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); this.skip(); } };

  constructor(private host: HTMLElement, private deps: FlightDeps) {
    this.flown = { liftoff: deps.liftoff };
    this.root.className = 'cut';
    this.root.innerHTML = `
      <div class="cut-view"></div>
      <canvas class="cut-fx"></canvas>
      <div class="cut-bars" aria-hidden="true"></div>
      <div class="cut-hud"></div>
      <div class="cut-sub" role="status" aria-live="polite"></div>
      <div class="cut-fade"></div>
      <div class="cut-title"></div>
      <button class="cut-skip" type="button">Skip &nbsp;<kbd>Esc</kbd></button>`;
    host.appendChild(this.root);
    const view = this.root.querySelector('.cut-view') as HTMLElement;
    this.sub = this.root.querySelector('.cut-sub')!; this.hudLine = this.root.querySelector('.cut-hud')!;
    this.fx = this.root.querySelector('.cut-fx') as HTMLCanvasElement; this.fade = this.root.querySelector('.cut-fade')!;
    this.title = this.root.querySelector('.cut-title')!; this.skipBtn = this.root.querySelector('.cut-skip')!;
    this.skipBtn.onclick = () => this.skip();
    addEventListener('keydown', this.keyHandler);
    (document.activeElement as HTMLElement | null)?.blur?.(); // so the space bar never presses a leftover button

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    view.appendChild(this.renderer.domElement);
    const s = this.scene; s.background = new THREE.Color(0x01020a);
    s.add(starField(2400, 1800, 3, 1.5), starField(300, 1750, 9, 2.4));
    const sun = new THREE.DirectionalLight(0xfff4e0, 3.4); sun.position.set(-6, 3, 4); s.add(sun);
    const sunGlow = glowSprite('255,240,210', 260); sunGlow.position.set(-1200, 600, 800); s.add(sunGlow);
    s.add(new THREE.AmbientLight(0x223355, 0.55), new THREE.HemisphereLight(0x9fb8ff, 0x101018, 0.35));
    this.earth = planet(1, earthCanvas(), './textures/earth.jpg', 0x335588); this.earth.scale.setScalar(EARTH_R);
    const atm = atmosphere(1, 0x6fb4ff, 4.5); atm.scale.setScalar(1.035 / 1.12); this.earth.add(atm); s.add(this.earth); // a thin limb, not a ring
    this.moon = planet(1, moonCanvas(), './textures/moon.jpg'); this.moon.scale.setScalar(MOON_R); s.add(this.moon);

    // the ship the player built, flying nose first to the right
    this.ship = buildShip(new Set(deps.tags));
    this.csm = this.ship.userData.csm; this.lander = this.ship.userData.lander; this.landerMode = this.ship.userData.landerMode;
    const box = new THREE.Box3().setFromObject(this.ship);
    this.smFlame = flame(0.42, 2.6); this.smFlame.position.y = -0.83; this.csm.add(this.smFlame);
    if (this.lander) { this.ldFlame = flame(0.35, 1.6); this.ldFlame.position.y = 0.3; this.lander.add(this.ldFlame); }
    // the rocket's third stage, still attached for the push out of Earth orbit
    const white = new THREE.MeshStandardMaterial({ color: 0xe9eaee, roughness: 0.55 }), black = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.6 });
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 2.6, 32), white); st.position.y = -1.3; this.stage.add(st);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.73, 0.73, 0.6, 32), black); band.position.y = -2.3; this.stage.add(band);
    const ad = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.8, 32), white); ad.position.y = 0.4; this.stage.add(ad);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.7, roughness: 0.4 })); bell.position.y = -2.85; this.stage.add(bell);
    this.stageFlame = flame(0.55, 4.5); this.stageFlame.position.y = -3.1; this.stage.add(this.stageFlame);
    this.stage.position.y = box.min.y - 0.8;
    this.ship.add(this.stage);
    const c = box.getCenter(new THREE.Vector3()); this.ship.position.sub(c);
    this.craft.add(this.ship); s.add(this.craft);

    this.dust = glowSprite('200,190,170', 1); (this.dust.material as THREE.SpriteMaterial).blending = THREE.NormalBlending; this.dust.visible = false; s.add(this.dust);
    this.boom = glowSprite('255,180,90', 1); this.boom.visible = false; s.add(this.boom);
    // the lander's shadow on the ground: the gap between the two is how the eye reads height
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.visible = false; s.add(this.shadow);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(80 * 3), 3));
    this.debris = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffc080, size: 3, sizeAttenuation: false })); this.debris.visible = false; this.debris.frustumCulled = false; s.add(this.debris);
    const r = rng(12); for (let i = 0; i < 80; i++) this.debrisVel.set([(r() - 0.5) * 6, (r() - 0.5) * 6, (r() - 0.5) * 6], i * 3);

    this.resize(); addEventListener('resize', this.resizeBound);
    this.t0 = this.last = performance.now();
    if (deps.startAt === 'site') { this.flown.orbit = 'fair'; this.startSite(); } else if (deps.startAt === 'orbit') this.startOrbit(); else this.enter('launch');
    this.loop();
  }

  // ------------------------------------------------------------------ the order of things
  private begin(kind: Kind, phase: Phase, dur = Infinity) {
    this.step = { kind, phase, t0: performance.now(), dur };
    this.skipBtn.hidden = !(kind === 'watch' || kind === 'talk' || kind === 'fail');
    this.lastSub = ''; this.lastRadio = -1;
  }
  /** Start a phase, unless the mission has already failed there. */
  private enter(phase: Phase) {
    const o = this.deps.peek(this.flown);
    if (!o.success && o.failedPhase === phase) { this.fail(phase, o.cause!); return; }
    if (phase === 'launch' || phase === 'coast' || phase === 'return') this.begin('watch', phase, WATCH[phase]);
    else if (phase === 'orbit') this.startOrbit();
    else this.startSite();
  }
  private fail(phase: Phase, cause: Cause) {
    this.clearLayer();
    this.failCause = cause; this.end = this.deps.ending(cause);
    this.begin('fail', phase, cause === 'piloting' ? CRASH_TAIL : SEG + TAIL);
  }
  private afterWatch(phase: Phase) {
    if (phase === 'launch') this.enter('coast');
    else if (phase === 'coast') this.enter('orbit');
    else this.finish();
  }
  /** Esc: jump to the end of whatever is being watched. Flown moments cannot be skipped. */
  private skip() {
    const k = this.step.kind;
    if (k === 'watch' || k === 'talk' || k === 'fail') this.step.t0 = performance.now() - this.step.dur * 1000;
  }
  private get marks() { return { liftoff: this.flown.liftoff ?? 'fair', orbit: this.flown.orbit ?? 'fair' } as { liftoff: Mark; orbit: Mark }; }

  private openLayer(moment: 'orbit' | 'site' | 'landing', prompt: string, warnings: string[] = []) {
    this.clearLayer();
    this.layer = flyLayer(this.root, moment, prompt, warnings);
    if (moment !== 'site') this.drawAuto();
    return this.layer;
  }
  private drawAuto() {
    if (!this.layer) return;
    autoLink(this.layer, this.deps.auto(), () => { this.deps.setAuto(!this.deps.auto()); this.drawAuto(); });
  }
  private clearLayer() {
    this.hud = null; this.coachEl = null; this.marksEl = null; this.aimEl = null;
    this.controls?.dispose(); this.controls = null;
    this.layer?.remove(); this.layer = null; this.deps.expose?.(null);
  }

  // ------------------------------------------------------------------ Moon orbit: turn the ship around, burn until the speed is in the band
  private startOrbit() {
    const setup = this.deps.orbitSetup();
    this.orbit = { setup, o: startOrbitBurn(setup), part: 'card', mark: null, doneAt: 0, engine: 0, told: false };
    this.begin('orbit', 'orbit');
    howTo(this.openLayer('orbit', '', []), 'How to enter Moon orbit', [
      'Turn the ship around. Point the nose along the arrow, backwards along your path.',
      'Hold the engine. The speed falls.',
      'Let go when the speed is inside the green band.',
    ], [
      `You arrive at ${setup.speed0.toLocaleString('en-US')}. Orbit speed is ${Math.round(setup.lo).toLocaleString('en-US')} to ${Math.round(setup.hi).toLocaleString('en-US')}.`,
      'Burning nose first speeds you up. The window to burn is short: watch the bar.',
    ], setup.warnings, () => this.startBurn());
  }
  private startBurn() {
    const O = this.orbit!; O.part = 'fly';
    const layer = this.openLayer('orbit', '', []);
    this.controls = new FlyControls(window);
    this.hud = orbitBurnHud(layer, O.setup);
    this.coachEl = coach(layer, ['Turn the nose to the arrow', 'Hold the engine', 'Let go inside the green band']);
    this.aimEl = aimMark(layer);
    controlStrip(layer, this.controls);
  }
  private updateOrbit(lt: number, dt: number) {
    const O = this.orbit!, s = O.setup;
    if (O.part === 'card') {
      this.deps.expose?.({ moment: 'orbit', part: 'card' });
      if (this.deps.auto() && lt >= 2.5) (this.layer?.querySelector('.howto .start') as HTMLElement | null)?.click();
      return;
    }
    if (O.part === 'done') {
      if (performance.now() - O.doneAt > 2400) { this.flown.orbit = O.mark!; this.clearLayer(); this.startSite(); }
      return;
    }
    const auto = this.deps.auto() || !this.controls;
    const hands = auto ? orbitPilot(O.o, s) : this.controls!.state;
    const acting = O.o.self ? orbitPilot(O.o, s) : hands;
    O.engine = acting.engine ? acting.throttle : 0;
    O.o = stepOrbit(O.o, hands, dt, s);
    const off = offBackwards(O.o), w = this.host.clientWidth || innerWidth, hh = this.host.clientHeight || innerHeight;
    this.hud?.set({ speed: O.o.speed, left: Math.max(0, 1 - O.o.t / s.window), throttle: acting.throttle });
    this.coachEl?.set(inBand(O.o, s) ? 2 : Math.abs(off) > 0.3 ? 0 : 1);
    this.tmp.set(0, 0, 0).project(this.camera);
    this.aimEl?.set({ x: (this.tmp.x * 0.5 + 0.5) * w, y: (-this.tmp.y * 0.5 + 0.5) * hh, r: Math.min(w, hh) * 0.3, guide: -Math.PI / 2, aligned: Math.abs(off) < 0.2, show: true });
    this.deps.expose?.({ moment: 'orbit', part: 'fly', speed: O.o.speed, lo: s.lo, hi: s.hi, angle: O.o.angle, off, t: O.o.t, window: s.window });
    if (O.o.self && !O.told) { O.told = true; if (this.layer) flyNote(this.layer, 'The window is closing. The ship burns by itself.', 'bad'); this.controls?.letGo(); }
    if (orbitOver(O.o, s)) {
      O.mark = auto && !O.o.self ? AUTOPILOT.orbit : gradeOrbit(O.o, s);
      O.part = 'done'; O.doneAt = performance.now(); O.engine = 0;
      const say = O.o.self ? 'A late burn. It cost fuel.' : auto ? 'Autopilot burn' : O.mark === 'clean' ? 'Clean burn. In orbit.'
        : O.mark === 'fair' ? 'A little off. It cost fuel.' : O.o.speed > s.hi ? 'Still too fast. It cost fuel.' : 'Too slow. It cost fuel.';
      flyNote(this.openLayer('orbit', '', []), say, O.mark === 'clean' ? 'good' : O.mark === 'fair' ? 'ok' : 'bad');
      this.deps.expose?.({ moment: 'orbit', part: 'done', mark: O.mark });
      sfx.thud();
    }
  }

  // ------------------------------------------------------------------ the landing site
  private startSite() {
    const o = this.deps.peek(this.flown);
    if (!o.success && o.failedPhase === 'landing') { this.fail('landing', o.cause!); return; }
    this.begin('site', 'orbit');
    sitePick(this.openLayer('site', 'Choose where to land'), this.deps.sites(), (id) => this.pickSite(id));
  }
  private pickSite(site: Site) {
    if (this.step.kind !== 'site') return;
    this.deps.chooseSite(site);
    const o = this.deps.peek(this.flown);
    if (!o.success && o.failedPhase === 'landing') { this.fail('landing', o.cause!); return; }
    const setup = this.deps.landingSetup(this.marks, site, 1);
    this.land = { setup, craft: { ...setup.start, fuel: setup.fuel }, attempt: 1, site, part: 'undock', firing: false, throttle: 1, abortT: 0, from: setup.start, downAt: 0 };
    this.clearLayer();
    this.begin('landing', 'landing');
  }

  // ------------------------------------------------------------------ the landing: a side view, flown with turn, engine and throttle
  /** the picture cuts to the side view and waits on the "how to" card */
  private showCard() {
    const L = this.land!;
    if (!this.view) { this.view = new LanderView(this.deps.tags, this.landerMode !== 'separate'); this.resize(); }
    this.view.setup(L.setup);
    L.part = 'card';
    const s = L.setup, pad = L.site === 'rough';
    howTo(this.openLayer('landing', '', []), pad ? 'How to land on the pad' : 'How to land safely', [
      'Cancel your sideways speed. Turn to the arrow and hold the engine until the sideways number turns green.',
      'Turn upright and let it fall.',
      'Brake before the ground. Hold the engine until the downward number turns green, and keep it green until the legs touch.',
    ], [
      `A safe touchdown: under ${s.vDown.toFixed(1)} m/s down, under ${s.vSide} m/s sideways, nearly upright.`,
      pad ? 'Set down between the green lights. The orange marker shows where you will come down.' : 'The orange marker shows where you will come down.',
    ], s.warnings, () => this.startDescent());
  }
  private startDescent() {
    const L = this.land!;
    L.part = 'descent';
    const layer = this.openLayer('landing', '', []);
    this.controls = new FlyControls(window);
    this.hud = landingHud(layer, L.setup);
    this.coachEl = coach(layer, ['Cancel sideways speed', 'Turn upright', 'Brake before the ground', 'Touch down gently']);
    this.marksEl = craftMarks(layer);
    controlStrip(layer, this.controls);
  }
  private abort(why: Verdict) {
    const L = this.land!;
    L.part = 'abort'; L.abortT = 0; L.from = L.craft;
    const say = { fast: 'Too fast.', sideways: 'Drifting sideways.', tilted: 'Not upright.', rocks: 'Off the pad.', ok: '' }[why];
    flyNote(this.openLayer('landing', '', []), `${say} Abort. One more try.`, 'bad');
    this.deps.expose?.({ moment: 'abort' });
    sfx.warn();
  }
  private updateLanding(lt: number, dt: number) {
    const L = this.land!;
    if (L.part === 'undock') { if (lt >= UNDOCK) this.showCard(); return; }
    if (L.part === 'card') {
      this.deps.expose?.({ moment: 'card' });
      if (this.deps.auto() && lt >= UNDOCK + 2.5) (this.layer?.querySelector('.howto .start') as HTMLElement | null)?.click();
      return;
    }
    if (L.part === 'abort') {
      L.abortT += dt; L.firing = true; L.throttle = 1;
      const k = Math.min(1, L.abortT / ABORT_CLIMB);
      L.craft = { ...L.from, y: L.from.y + 110 * ease(k), vx: 0, vy: 10, angle: L.from.angle * (1 - k) };
      if (k >= 1) { // the second and last try, with less fuel
        L.attempt = 2; L.setup = this.deps.landingSetup(this.marks, L.site, 2);
        L.craft = { ...L.setup.start, fuel: L.setup.fuel }; L.firing = false;
        this.view!.setup(L.setup); this.startDescent();
      }
      return;
    }
    if (L.part !== 'descent') return;
    const s = L.setup, adv = advise(L.craft, s);
    const ctl = this.deps.auto() || !this.controls ? carefulPilot(L.craft, s) : this.controls.state;
    L.firing = ctl.engine && L.craft.fuel > 0 && ctl.throttle > 0; L.throttle = ctl.throttle;
    const c = L.craft = stepCraft(L.craft, ctl, dt, s);
    const hgt = heightOf(c, s), w = this.host.clientWidth || innerWidth, hh = this.host.clientHeight || innerHeight;
    this.hud?.set({ fuel: c.fuel, h: hgt, throttle: ctl.throttle, try: L.attempt });
    this.coachEl?.set(adv.step);
    const p = this.view!.screenOf(c, w, hh);
    let off = adv.angle - c.angle; while (off > Math.PI) off -= 2 * Math.PI; while (off < -Math.PI) off += 2 * Math.PI;
    this.marksEl?.set({
      x: p.x, y: p.y, scale: this.view!.pxPerMetre(hh), vx: c.vx, vy: c.vy, sideOk: Math.abs(c.vx) <= s.vSide,
      down: adv.brake === 'now' ? 'now' : adv.brake === 'soon' ? 'soon' : -c.vy <= s.vDown ? 'safe' : 'fall',
      guide: adv.angle, angle: c.angle, aligned: Math.abs(off) < 0.3, show: true,
    });
    this.deps.expose?.({
      moment: 'landing', x: c.x, y: c.y, h: hgt, vx: c.vx, vy: c.vy, angle: c.angle, fuel: c.fuel, try: L.attempt, vDown: s.vDown,
      advise: { angle: adv.angle, engine: adv.engine, step: adv.step, brake: adv.brake },
    });
    if (onGround(c, s)) {
      const why = judge(c, s);
      if (why !== 'ok' && L.attempt === 1) { this.abort(why); return; }
      this.flown.landing = { landed: why === 'ok', tries: L.attempt, site: L.site, speed: Math.hypot(c.vx, c.vy), fuelLeft: s.fuel > 0 ? c.fuel / s.fuel : 0 };
      L.part = 'down'; L.firing = false; L.downAt = performance.now();
      if (why !== 'ok') { this.fail('landing', 'piloting'); return; }
      this.clearLayer(); this.end = this.deps.ending(null);
      this.begin('talk', 'landing', TALK);
      return;
    }
    if (L.attempt === 1 && hopeless(c, s)) this.abort('fast');
  }

  // ------------------------------------------------------------------ frame loop
  private resizeBound = () => this.resize();
  private resize() {
    const w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.fx.width = 160; this.fx.height = Math.max(90, Math.round(160 * h / w));
    this.view?.resize(w, h);
  }
  private loop = () => {
    if (this.done) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const lt = (now - this.step.t0) / 1000;
    const s = this.step;
    if (s.kind === 'watch') { if (lt >= s.dur) { this.afterWatch(s.phase); if (this.done) return; } }
    else if (s.kind === 'orbit') this.updateOrbit(lt, dt);
    else if (s.kind === 'site') { if (this.deps.auto() && lt >= 2) this.pickSite(this.deps.sites().find((x) => !x.locked)?.id ?? 'flat'); }
    else if (s.kind === 'landing') this.updateLanding(lt, dt);
    else if (s.kind === 'talk') { if (lt >= s.dur) this.enter('return'); }
    else if (s.kind === 'fail') { if (lt >= s.dur) { this.finish(); return; } }
    this.frame((now - this.t0) / 1000, (performance.now() - this.step.t0) / 1000);
  };

  private surfaceY(x: number, z: number) {
    const m = this.moon.position, r = this.moon.scale.x;
    return m.y + Math.sqrt(Math.max(0, r * r - (x - m.x) ** 2 - (z - m.z) ** 2));
  }

  /** Draw one frame. t = seconds since the flight began, lt = seconds into the current step. */
  private frame(t: number, lt: number) {
    const { kind, phase, dur } = this.step;
    const i = PHASES.indexOf(phase);
    const failing = kind === 'fail', cause = this.failCause, crash = failing && cause === 'piloting';
    const L = this.land;
    const side = !!this.view && !!L && L.part !== 'undock' && (kind === 'landing' || kind === 'talk' || crash);
    // how far the worlds have moved through this phase
    let u = 1;
    if (kind === 'watch') u = ease(lt / dur);
    else if (kind === 'orbit') { // the Moon arrives as the burn goes on; the card holds it off
      const O = this.orbit!, base = Math.min(1, O.o.t / 9);
      u = ease(O.part === 'done' ? Math.max(base, (performance.now() - O.doneAt) / 2000) : base);
    }
    else if (kind === 'landing') u = 0; // the space view only shows the undocking
    else if (failing && !crash) u = ease(lt / SEG);
    const tf = failing ? (crash ? lt : Math.max(0, lt - SEG)) : 0; // seconds into the failure itself
    const boomAt = crash ? 0.25 : 6;
    lerp3(KEY[i].e, KEY[i + 1].e, u, this.earth.position);
    lerp3(KEY[i].m, KEY[i + 1].m, u, this.moon.position);
    this.earth.rotation.y = t * 0.03; this.moon.rotation.y = 0.4 + t * (phase === 'orbit' ? 0.03 : 0.006);

    // the ship
    const cr = this.craft; const sh = !reduce();
    this.focus.set(0, 0, 0);
    this.smFlame.visible = false; if (this.ldFlame) this.ldFlame.visible = false; this.stageFlame.visible = false;
    if (phase === 'launch') {
      cr.rotation.set(0, 0, -Math.PI / 2 + 0.55 * (1 - u)); cr.position.set(-1 + u * 1, -0.6 + u * 0.6, 0);
      this.stageFlame.visible = true; this.stageFlame.scale.setScalar(0.9 + Math.random() * 0.2);
    } else if (phase === 'coast') {
      cr.rotation.set(lt * 0.35, 0, -Math.PI / 2); cr.position.set(0, 0, 0);
      if (lt > 1 && !this.stageGone) { this.stageGone = true; this.scene.attach(this.stage); }
      if (this.stageGone) { this.stage.position.x -= 0.035; this.stage.position.y -= 0.012; this.stage.rotation.z += 0.01; this.stage.rotation.x += 0.006; }
    } else if (phase === 'orbit') {
      if (!this.stageGone) { this.stageGone = true; this.scene.attach(this.stage); }
      this.stage.visible = false;
      // the ship turns as the player turns it; afterwards it eases back to nose-first for the undocking
      if (kind === 'orbit') this.nose = this.orbit!.o.angle; else this.nose += (0 - this.nose) * 0.04;
      cr.rotation.set(0, 0, -Math.PI / 2 - this.nose); cr.position.set(0, 0, 0);
      // the burn that puts us into orbit: the player's, or its own if the mission dies here
      this.smFlame.visible = kind === 'orbit' ? this.orbit!.engine > 0 : kind === 'fail' && lt > 0.6 && lt < 2.6;
      if (this.smFlame.visible && kind === 'orbit') this.smFlame.scale.setScalar(0.5 + 0.6 * this.orbit!.engine);
    } else if (phase === 'landing') {
      this.stage.visible = false;
      cr.rotation.x = 0;
      // 1 at the top of the descent, 0 on the ground
      const frac = kind === 'landing' ? 1 : kind === 'talk' || crash ? 0 : 1 - 0.6 * ease(lt / (SEG + TAIL));
      const burning = kind !== 'landing' && failing && !crash && tf < 6;
      if (this.landerMode === 'separate' && this.lander) {
        cr.rotation.z += (-Math.PI / 2 - cr.rotation.z) * 0.1;
        if (!this.separated && (lt > 0.8 || kind !== 'landing')) { this.separated = true; this.scene.attach(this.lander); this.sepY = this.lander.position.y; }
        if (this.separated) {
          const Ld = this.lander, gy = this.surfaceY(0.6, 0.4);
          Ld.position.x += (0.6 - Ld.position.x) * 0.03; Ld.position.z += (0.4 - Ld.position.z) * 0.03;
          Ld.position.y = gy + (this.sepY - gy) * frac;
          Ld.rotation.set(Ld.rotation.x * 0.94, 0.3, Ld.rotation.z + (0 - Ld.rotation.z) * 0.05); // turn upright, legs down
          cr.position.y += (2.8 - cr.position.y) * 0.02; // the mother ship stays up in orbit
          this.focus.copy(Ld.position).add(this.tmp.set(0, 0.6, 0));
          if (this.ldFlame) { this.ldFlame.visible = burning; this.ldFlame.scale.setScalar(0.85 + Math.random() * 0.3); }
          this.shadow.visible = Ld.visible; this.shadow.position.set(Ld.position.x, gy + 0.03, Ld.position.z); this.shadow.scale.setScalar(0.75 + 0.5 * frac);
          (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.55 - 0.3 * frac;
          if (kind === 'talk') this.touchdown(Ld.position);
        }
      } else {
        const gy = this.surfaceY(0, 0) + 2.6; // the whole ship comes down on its own engine
        cr.rotation.z += (0 - cr.rotation.z) * 0.06;
        cr.position.x += (0 - cr.position.x) * 0.05;
        cr.position.y = gy * (1 - frac);
        this.focus.copy(cr.position);
        this.smFlame.visible = burning;
        this.shadow.visible = cr.visible; this.shadow.position.set(cr.position.x, gy - 2.6 + 0.03, cr.position.z); this.shadow.scale.setScalar(1.6 + frac);
        (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.55 - 0.3 * frac;
        if (kind === 'talk') this.touchdown(this.tmp.set(cr.position.x, gy - 2.6, cr.position.z).clone());
      }
    } else if (phase === 'return') {
      this.stage.visible = false;
      if (this.lander && this.landerMode === 'separate') this.lander.visible = lt < 1.5; // the lander stays behind on the Moon
      this.dust.visible = false; this.shadow.visible = false;
      cr.rotation.set(lt * 0.2, 0, -Math.PI / 2 + Math.max(0, 0.35 - lt * 0.2));
      cr.position.set(lt * lt * 0.12, cr.position.y + (0 - cr.position.y) * 0.03, 0);
      this.smFlame.visible = lt < 2.4;
      this.focus.copy(cr.position);
    }

    // a failure: the ship shakes, then is lost, or the lights and the signal die
    let shake = phase === 'launch' ? 0.05 * (1 - u) + 0.01 : 0;
    if (kind === 'landing' && L!.firing) shake = 0.012;
    if (failing && cause !== 'comms' && cause !== 'power') {
      if (!crash && tf > 2 && tf < boomAt) { shake = 0.02 + (tf - 2) * 0.012; cr.rotation.x += Math.sin(t * 9) * 0.01 * tf; }
      if (tf > boomAt) {
        const b = tf - boomAt;
        if (!(crash && this.landerMode === 'separate')) cr.visible = false; // a lander lost at the surface leaves the mother ship in orbit
        if (this.lander && this.separated) this.lander.visible = false;
        this.boom.visible = b < 2.5; this.boom.position.copy(this.focus); this.boom.scale.setScalar(2 + b * 18); (this.boom.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - b / 2.5);
        this.debris.visible = true; const p = this.debris.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let j = 0; j < 80; j++) p.setXYZ(j, this.focus.x + this.debrisVel[j * 3] * b, this.focus.y + Math.abs(this.debrisVel[j * 3 + 1]) * b * (crash ? 1 : 0) + (crash ? 0 : this.debrisVel[j * 3 + 1] * b), this.focus.z + this.debrisVel[j * 3 + 2] * b);
        p.needsUpdate = true;
        if (b < 0.6) shake = 0.08;
      }
    }
    // camera: beside the ship, drifting slowly, riding with whatever matters right now
    const cam = this.camera, jx = sh && shake ? (Math.random() - 0.5) * shake * 4 : 0, jy = sh && shake ? (Math.random() - 0.5) * shake * 4 : 0;
    const dist = phase === 'landing' ? 8.5 : 10.5;
    cam.position.set(this.focus.x + Math.sin(t * 0.12) * 2.2 + jx, this.focus.y + 1.4 + Math.sin(t * 0.09) * 0.5 + jy, this.focus.z + dist);
    cam.lookAt(this.focus.x, this.focus.y - (phase === 'landing' ? 1.2 : 0.3), this.focus.z);

    // status line
    const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(Math.floor(t % 60)).padStart(2, '0');
    const lamp = cause === 'power' && tf > 1 ? 'off' : cause === 'comms' && tf > 2 ? 'warn' : '';
    this.hudLine.innerHTML = `<span>T+${mm}:${ss}</span><span>${phaseNames[phase].toUpperCase()}</span><span class="lamp ${lamp}">●</span>`;

    // words: narration while flying, the radio when the mission is decided
    const lines = kind === 'talk' ? this.end!.lines.slice(-2) : failing ? this.end!.lines : [];
    const per = kind === 'talk' ? (TALK - 1) / 2 : ((crash ? CRASH_TAIL : TAIL) - 1) / Math.max(1, lines.length);
    const speaking = kind === 'talk' || (failing && (crash || lt >= SEG));
    const li = speaking ? Math.min(lines.length - 1, Math.floor((kind === 'talk' ? lt : tf) / per)) : -1;
    const key = li >= 0 ? `l${li}` : `n${kind}${phase}${kind === 'landing' ? L!.part : ''}`;
    if (key !== this.lastSub || (li >= 0 && cause === 'comms')) {
      this.lastSub = key;
      this.sub.innerHTML = li >= 0 ? `<b>${lines[li].who === 'Commander' ? this.deps.commander : lines[li].who}</b> ${this.garble(lines[li].text, tf)}`
        : kind === 'landing' && L!.part !== 'undock' ? '' : `<i>${this.narration(kind, phase)}</i>`;
    }
    if (li >= 0 && li !== this.lastRadio) { this.lastRadio = li; sfx.radio(); }

    // outcome effects on top of the picture
    const gl = this.fx.getContext('2d')!;
    gl.clearRect(0, 0, this.fx.width, this.fx.height);
    let fade = 0, staticA = 0, flash = 0;
    const tail = crash ? CRASH_TAIL : TAIL;
    if (failing) {
      if (cause === 'comms') staticA = Math.min(0.85, Math.max(0, tf - 1) / 7);
      if (cause === 'power') { fade = Math.min(1, Math.max(0, tf - 2) / 5); this.root.style.setProperty('--lamps', String(Math.max(0, 1 - tf / 5))); }
      if (cause !== 'comms' && cause !== 'power') { flash = tf > boomAt && tf < boomAt + 0.6 ? 1 - (tf - boomAt) / 0.6 : 0; fade = tf > boomAt + 2.5 ? Math.min(1, (tf - boomAt - 2.5) / 1.5) : 0; }
      if (cause === 'comms' && tf > tail - 3) fade = Math.min(1, (tf - (tail - 3)) / 2.5);
      if (tf > tail - 2) fade = Math.max(fade, Math.min(1, (tf - (tail - 2)) / 1.5));
      const msg = cause === 'comms' ? (tf > 4 ? 'SIGNAL LOST' : '') : cause === 'power' ? (tf > 3 ? 'MAIN BUS: NO POWER' : '') : crash ? (tf > 1 ? 'CONTACT LOST' : '') : (tf > 6.5 ? 'TELEMETRY ENDS' : '');
      this.title.textContent = msg; this.title.classList.toggle('bad', !!msg);
    } else {
      fade = t < 1 ? 1 - t : kind === 'watch' && phase === 'return' && lt > dur - 2.5 ? Math.min(1, (lt - (dur - 2.5)) / 2.2) : 0;
      this.title.classList.remove('bad');
      this.title.textContent = kind === 'talk' && lt > (TALK - 1) / 2 ? 'Tranquility Base here.' : '';
    }
    if (staticA > 0) {
      const img = gl.createImageData(this.fx.width, this.fx.height);
      for (let j = 0; j < img.data.length; j += 4) { const v = Math.random() * 255; img.data[j] = img.data[j + 1] = img.data[j + 2] = v; img.data[j + 3] = 255 * staticA; }
      gl.putImageData(img, 0, 0);
    }
    this.fx.style.opacity = staticA > 0 ? '1' : '0';
    this.fade.style.opacity = String(fade);
    this.fade.style.background = flash > 0 ? `rgba(255,${200 - 120 * (1 - flash)},${160 - 120 * (1 - flash)},${Math.max(fade, flash)})` : '#000';
    if (flash > 0) this.fade.style.opacity = String(flash);

    // sound follows the picture
    const burningNow = this.stageFlame.visible || this.smFlame.visible || !!this.ldFlame?.visible;
    const rumble = phase === 'launch' ? 0.95 * (1 - u) + 0.15 : burningNow ? (kind === 'landing' ? 0.42 : 0.3) : 0.08;
    const tense = kind === 'landing' && L!.part === 'descent';
    this.audio.update(failing && cause === 'power' && tf > 2 ? 0 : side ? (L!.firing ? 0.18 + 0.3 * L!.throttle : 0.06) : rumble, staticA, tense ? 70 + 40 * (1 - Math.min(1, L!.craft.y / L!.setup.start.y)) : 0);
    if (failing && cause === 'power' && tf > 2 && !this.fired.power) { this.fired.power = true; this.audio.powerDown(); }
    if (failing && cause !== 'comms' && cause !== 'power' && tf > boomAt && !this.fired.boom) { this.fired.boom = true; this.audio.boom(); }
    const stingAt = kind === 'talk' ? this.landed : failing && tf > boomAt + 0.2;
    if (stingAt && !this.fired.stinger) { this.fired.stinger = true; sfx.stinger(kind === 'talk' ? 'win' : 'loss'); }
    if (side) {
      const v = this.view!, c = L!.craft, since = L!.downAt ? (performance.now() - L!.downAt) / 1000 : 0;
      v.update(c, L!.firing, L!.throttle, L!.part === 'descent' ? impactX(c, L!.setup) : null, c.y - heightOf(c, L!.setup));
      if (kind === 'talk') { v.dust(c, since); this.touchdown(this.tmp.set(0, 0, 0)); }
      if (crash) v.boom(c, tf - boomAt);
      this.renderer.render(v.scene, v.camera);
    } else this.renderer.render(this.scene, this.camera);
  }

  private touchdown(at: THREE.Vector3) {
    this.landed = true;
    if (!this.fired.touch) { this.fired.touch = true; this.dust.visible = true; this.dust.position.copy(at); this.dustT = performance.now(); sfx.thud(); }
    const d = (performance.now() - this.dustT) / 1000;
    this.dust.scale.setScalar(1 + d * 5); (this.dust.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.6 - d * 0.3);
  }
  private narration(kind: Kind, p: Phase) {
    const whole = this.landerMode === 'whole';
    if (kind === 'site') return 'In orbit around the Moon. Earth rises over the horizon.';
    return ({
      launch: 'The rocket climbs out of the air. The third stage fires and points us at the Moon.',
      coast: 'The spent stage falls away. Three days of coasting, turning slowly so the Sun does not cook one side.',
      orbit: 'Moon ahead, and we are going too fast to stay. The engine must slow us into orbit.',
      landing: whole ? 'The whole ship turns its engine to the ground and starts down.' : 'The lander undocks and starts down to the surface.',
      return: 'The engine fires. Heading home.',
    } as Record<Phase, string>)[p];
  }
  /** for comms failures, words drop out of the dialogue */
  private garble(text: string, tf: number) {
    if (this.failCause !== 'comms' || tf < 3) return text;
    const k = Math.min(0.7, (tf - 3) / 8); const r = rng(Math.floor(tf * 3));
    return text.split(' ').map((w) => (r() < k ? '▒'.repeat(Math.max(2, w.length)) : w)).join(' ');
  }

  private finish() {
    if (this.done) return; this.done = true;
    const flown = this.flown;
    this.teardown();
    this.deps.onDone(flown);
  }
  private teardown() {
    this.clearLayer();
    this.audio.stop(); cancelAnimationFrame(this.raf); removeEventListener('keydown', this.keyHandler); removeEventListener('resize', this.resizeBound);
    this.view?.dispose(); this.renderer.dispose(); this.root.remove();
  }
  /** Leave without finishing: nothing is settled. */
  dispose() { if (this.done) return; this.done = true; this.teardown(); }
}
