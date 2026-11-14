import * as THREE from 'three';
import { buildShip, buildStack } from './ship';
import { BuildSite } from './site';
import { World, glowSprite, moonCanvas, planet, rng, starField } from './world';

/** Moments of the opening, so the page can put words on top of the picture. */
export type Cue = 'date' | 'quote' | 'quote2' | 'ignition' | 'liftoff' | 'flash' | 'title' | 'menu';
const CUES: [Cue, number][] = [['date', 0.4], ['quote', 1.7], ['quote2', 3.3], ['ignition', 4.4], ['liftoff', 5.4], ['flash', 9.4], ['title', 9.6], ['menu', 12.0]];
const SITE_SCALE = 1.0;
const POSE_K = 0.2; // pad-scene units per metre of a flown liftoff
const T_IGN = 4.4, T_LIFT = 5.4, T_CUT = 9.4;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

type Mode = 'off' | 'intro' | 'title' | 'orbit' | 'site';

/**
 * One full-screen 3D canvas lives behind every screen. It plays the opening, then stays on as the
 * world around the ship: Earth, Moon, stars. The camera drifts toward the Moon as the decisions pile up.
 */
export class Backdrop {
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  private space = new THREE.Scene(); private pad = new THREE.Scene();
  private site = new BuildSite(); private lastT = performance.now(); private baseY = 0; private shipH = 8;
  private world = new World(); private shipRoot = new THREE.Group(); private ship = new THREE.Group();
  private mode: Mode = 'title'; private raf = 0; private t0 = performance.now();
  private pop = 1; private key: string | null = null; private tags: string[] = []; private yaw = 0.7; private yawUser = 0; private yawVel = 0; private progress = 0;
  private mx = 0; private my = 0; private kick = 0;
  onFrame?: (i: { thrust: number }) => void;

  // intro state
  private cue?: (c: Cue) => void; private fired = new Set<Cue>(); private tIntro = 0; private introStart = 0;
  private rocket = new THREE.Group(); private flame = new THREE.Group(); private flameLight = new THREE.PointLight(0xffa050, 0, 140, 1.2);
  private smoke!: THREE.Points; private smokeVel!: Float32Array; private smokeN = 160; private padMoon!: THREE.Mesh;

  constructor(host: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    const el = this.renderer.domElement; el.className = 'backdrop'; el.setAttribute('aria-hidden', 'true'); host.prepend(el);

    this.space.add(this.world.group);
    this.space.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a1c22, 0.9));
    const rim = new THREE.DirectionalLight(0x6f9bff, 1.4); rim.position.set(-5, 1, -4); this.space.add(rim);
    const key = new THREE.DirectionalLight(0xfff2dd, 2.2); key.position.set(4, 6, 5); this.space.add(key);
    this.shipRoot.add(this.ship); this.shipRoot.scale.setScalar(1.12); this.space.add(this.shipRoot);
    this.shipRoot.visible = false;
    this.buildPad();

    addEventListener('resize', this.resize); this.resize();
    addEventListener('pointermove', (e) => { this.mx = (e.clientX / innerWidth - 0.5) * 2; this.my = (e.clientY / innerHeight - 0.5) * 2; });
    this.loop();
  }

  // ------------------------------------------------------------------ the launch pad at night
  private buildPad() {
    const s = this.pad; s.background = new THREE.Color(0x03060c); s.fog = new THREE.FogExp2(0x050a14, 0.0085);
    s.add(starField(1800, 700, 21, 1.6));
    this.padMoon = planet(34, moonCanvas(), './textures/moon.jpg'); this.padMoon.position.set(-95, 78, -340); s.add(this.padMoon);
    const mg = glowSprite('200,215,255', 150); mg.position.copy(this.padMoon.position).add(new THREE.Vector3(0, 0, 12)); s.add(mg);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x0b1118, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; s.add(ground);
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 0.5, 48), new THREE.MeshStandardMaterial({ color: 0x1b222b, roughness: 0.9 })); slab.position.y = 0.25; s.add(slab);

    const black = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x59616c, roughness: 0.7, metalness: 0.5 });
    const stack = buildStack(new Set(['route-lor', 'docking-basic'])); stack.scale.setScalar(1.42); this.rocket.add(stack);
    this.rocket.position.y = 0.3; s.add(this.rocket);

    // flame
    const outer = new THREE.Mesh(new THREE.ConeGeometry(1.7, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.95, 6, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    outer.rotation.x = Math.PI; outer.position.y = -4.5; inner.rotation.x = Math.PI; inner.position.y = -3; this.flame.add(outer, inner, this.flameLight);
    this.flame.position.y = 0.6; this.flame.scale.set(0.001, 0.001, 0.001); this.rocket.add(this.flame);

    // gantry tower
    const gx = -4.6;
    for (const z of [-1.2, 1.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 26, 0.28), steel); b.position.set(gx, 13, z); s.add(b); }
    for (let i = 1; i < 13; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.6), steel); c.position.set(gx, i * 2, 0); s.add(c); }
    for (let i = 1; i < 12; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 0.12), steel); d.position.set(gx, i * 2 + 1, 0.6); d.rotation.x = 0.8 * (i % 2 ? 1 : -1); s.add(d); }
    for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xff5a4d : 0xfff0c8 })); l.position.set(gx + 0.3, 3 + i * 3.6, 1.4); s.add(l); }

    // floods
    for (const [x, z] of [[-18, 16], [18, 16], [0, 26]] as [number, number][]) {
      const sp = new THREE.SpotLight(0xfff1d8, 9, 120, 0.3, 0.7, 0); sp.position.set(x, 4, z); sp.target.position.set(0, 12, 0); s.add(sp, sp.target);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff6e0 })); lamp.position.copy(sp.position); s.add(lamp);
      const g = glowSprite('255,244,220', 9); g.position.copy(sp.position); s.add(g);
    }
    s.add(new THREE.AmbientLight(0x25344f, 0.7));

    // smoke
    const pos = new Float32Array(this.smokeN * 3); this.smokeVel = new Float32Array(this.smokeN * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.smoke = new THREE.Points(g, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: 9, color: 0x9ea6b2, transparent: true, opacity: 0, depthWrite: false }));
    this.smoke.frustumCulled = false; s.add(this.smoke);
    const r = rng(77); for (let i = 0; i < this.smokeN; i++) { const a = r() * 6.283, sp = 0.4 + r() * 2.2; this.smokeVel.set([Math.cos(a) * sp, 0.2 + r() * 1.1, Math.sin(a) * sp], i * 3); }
  }

  // ------------------------------------------------------------------ public controls
  playIntro(cue: (c: Cue) => void) {
    this.cue = cue; this.fired.clear(); this.mode = 'intro'; this.introStart = performance.now(); this.tIntro = 0;
    this.rocket.position.y = 0.3; this.flame.scale.setScalar(0.001); this.flameLight.intensity = 0;
    const p = this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute; for (let i = 0; i < this.smokeN; i++) p.setXYZ(i, 0, 0.6, 0); p.needsUpdate = true;
  }
  skipIntro() { if (this.mode !== 'intro') return; this.mode = 'title'; (['title', 'menu'] as Cue[]).forEach((c) => this.fire(c)); this.fired = new Set(CUES.map((c) => c[0])); this.cue = undefined; }
  introDone() { return this.mode !== 'intro'; }
  /** space world with no ship, behind the menu and story screens */
  showWorld() { if (this.mode === 'intro') return; this.mode = 'title'; this.shipRoot.visible = false; }
  /** the ship in space, after it has flown */
  showShip(tags: string[]) { if (this.mode === 'intro') return; this.mode = 'orbit'; this.space.add(this.shipRoot); this.shipRoot.scale.setScalar(1.12); this.shipRoot.visible = true; this.setTags(tags); }
  /** the build site on Earth. tags null = an empty pad with nothing built yet. */
  showSite(tags: string[] | null, progress: number) {
    if (this.mode === 'intro') return;
    if (this.mode !== 'site') this.site.resetLift();
    this.mode = 'site'; this.site.scene.add(this.shipRoot); this.shipRoot.scale.setScalar(SITE_SCALE); this.shipRoot.visible = tags !== null; this.progress = Math.max(0, Math.min(1, progress));
    if (tags) this.setTags(tags);
    this.site.setStackHeight(this.shipH * SITE_SCALE);
  }
  /** engines on: the ship climbs off the pad */
  liftoff() { if (this.mode === 'site') this.site.startLiftoff(); }
  /** engines off again before she has left the pad */
  abortLiftoff() { if (this.mode === 'site') this.site.resetLift(); }
  private pose: { x: number; y: number; angle: number; thrust: number } | null = null;
  private v3 = new THREE.Vector3(); private v3b = new THREE.Vector3();
  /** A flown liftoff: put the rocket where the flying rules say (metres from the pad, radians from upright), engine at thrust 0..1. */
  poseRocket(x: number, y: number, angle: number, thrust: number) { this.pose = { x: x * POSE_K, y: y * POSE_K, angle, thrust }; }
  endPose() { this.pose = null; this.site.resetLift(); }
  /** where the middle of the rocket is on screen, and how many pixels tall it is */
  rocketScreen(): { x: number; y: number; px: number } {
    const h = this.shipH * SITE_SCALE, w = innerWidth, hh = innerHeight;
    this.shipRoot.updateMatrixWorld();
    const mid = this.shipRoot.localToWorld(this.v3.set(0, h * 0.5 - this.baseY * SITE_SCALE, 0)).project(this.camera);
    const top = this.shipRoot.localToWorld(this.v3b.set(0, h - this.baseY * SITE_SCALE, 0)).project(this.camera);
    const x = (mid.x * 0.5 + 0.5) * w, y = (-mid.y * 0.5 + 0.5) * hh;
    return { x, y, px: 2 * Math.hypot((top.x * 0.5 + 0.5) * w - x, (-top.y * 0.5 + 0.5) * hh - y) };
  }
  pause() { this.mode = 'off'; }
  setProgress(p: number) { this.progress = Math.max(0, Math.min(1, p)); }
  /** On the pad the whole rocket is shown; in space only the spacecraft that flew. */
  setTags(tags: string[]) {
    const onPad = this.mode === 'site';
    const k = (onPad ? 'pad:' : 'space:') + [...tags].sort().join('|'); if (k === this.key) return;
    const sameKind = this.key !== null && this.key.startsWith(onPad ? 'pad:' : 'space:') && this.ship.children.length > 0;
    this.key = k; this.tags = tags;
    const g = onPad ? buildStack(new Set(tags)) : buildShip(new Set(tags));
    const box = new THREE.Box3().setFromObject(g); // measured before it has a parent, so this is its own size
    this.shipH = box.max.y - box.min.y;
    if (onPad) this.baseY = -box.min.y;
    else { const c = box.getCenter(new THREE.Vector3()); g.position.sub(c); this.baseY = 0; } // spin around its middle
    this.ship.clear(); this.ship.scale.setScalar(1); this.ship.add(g); this.pop = 0;
    if (sameKind && onPad) this.site.weld(this.site.padTopY + ((g.userData.workY as number) ?? this.shipH * 0.8) * SITE_SCALE);
  }
  /** drag to turn the ship */
  nudge(dx: number) { this.yawVel += dx * 0.004; }
  /** a physical jolt when a decision locks in */
  jolt() { this.kick = 1; }

  private fire(c: Cue) { this.cue?.(c); }
  private resize = () => {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h); this.camera.aspect = w / h;
    if (w >= 900) this.camera.setViewOffset(w, h, w * 0.19, 0, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  };

  // ------------------------------------------------------------------ frame loop
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (this.mode === 'off') return;
    const now = performance.now(), t = (now - this.t0) / 1000;
    let thrust = 0;
    if (this.cue) {
      this.tIntro = (now - this.introStart) / 1000;
      for (const [c, at] of CUES) if (this.tIntro >= at && !this.fired.has(c)) { this.fired.add(c); this.fire(c); }
      if (this.fired.size >= CUES.length) this.cue = undefined; // the words keep coming after the picture cuts to space
    }
    if (this.mode === 'intro') {
      if (this.tIntro >= T_CUT) this.mode = 'title';
      else thrust = this.frameIntro(this.tIntro);
    }
    const dtl = Math.min(0.1, (now - this.lastT) / 1000); this.lastT = now;
    if (this.mode === 'site') this.frameSite(t, dtl);
    else if (this.mode !== 'intro') this.frameSpace(t);
    this.onFrame?.({ thrust });
    this.renderer.render(this.mode === 'intro' ? this.pad : this.mode === 'site' ? this.site.scene : this.space, this.camera);
  };

  private frameIntro(t: number): number {
    const dt = Math.max(0, t - T_LIFT), th = t < T_IGN ? 0 : Math.min(1, (t - T_IGN) / 1.6);
    const ry = 0.3 + 4.5 * dt * dt; this.rocket.position.y = ry;
    const fl = th * (0.92 + Math.random() * 0.2);
    this.flame.scale.set(fl * (1 + 0.2 * Math.random()), fl * (1 + 0.5 * dt), fl * (1 + 0.2 * Math.random()));
    this.flameLight.intensity = th * 900 * (0.8 + Math.random() * 0.4);
    // smoke: pours out from the pad, then stays behind
    const sm = (this.smoke.material as THREE.PointsMaterial); sm.opacity = Math.min(0.5, th * 0.6);
    const p = this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (th > 0) for (let i = 0; i < this.smokeN; i++) {
      const k = Math.min(1, (t - T_IGN) * 0.5 + i / this.smokeN * 0.1);
      const bx = this.smokeVel[i * 3] * (t - T_IGN) * 3.4, bz = this.smokeVel[i * 3 + 2] * (t - T_IGN) * 3.4;
      p.setXYZ(i, bx * (0.4 + k), 0.6 + this.smokeVel[i * 3 + 1] * (t - T_IGN) * 1.2, bz * (0.4 + k));
    }
    p.needsUpdate = true;
    // camera: low and looking up, shaking as the engines wake, then chasing the rocket skyward
    let shake = th * (dt < 0.8 ? 0.22 : 0.07) * (reduced ? 0 : 1);
    const follow = Math.max(0, ry - 3) * 0.78;
    const push = Math.min(1, t / 4.4);
    this.camera.position.set(7.5 - 3 * push + (Math.random() - 0.5) * shake, 2 + follow * 0.9 + (Math.random() - 0.5) * shake, 25 - 4 * push + follow * 0.12);
    this.camera.lookAt(0, 9 + follow * 1.05 + Math.min(10, dt * 3), 0);
    this.padMoon.rotation.y = t * 0.01;
    return th;
  }

  private frameSite(t: number, dt: number) {
    this.site.update(t, this.progress, dt);
    if (this.pop < 1) { this.pop = Math.min(1, this.pop + 0.07); this.ship.scale.setScalar(0.88 + 0.12 * this.pop); }
    this.yawUser += this.yawVel; this.yawVel *= 0.93; this.yawUser *= 0.997;
    this.yaw = 0.35 + this.yawUser; // a rocket on a pad stands still; drag to look round it
    const po = this.pose;
    if (po) this.site.setFlight(po.x, po.y, po.angle, po.thrust, dt);
    const lift = this.site.liftY, lx = po ? po.x : 0;
    // yaw first, then the lean in the plane of the picture
    this.shipRoot.rotation.order = 'ZYX';
    this.shipRoot.rotation.set(0, this.yaw, po ? -po.angle : 0);
    this.shipRoot.position.set(lx, this.site.padTopY + this.baseY * SITE_SCALE + lift, 0);
    this.kick *= 0.9;
    const lt = this.site.liftT, rumble = po ? po.thrust * 0.2 : lt >= 0 ? (lt < 1.6 ? 0.1 + lt * 0.1 : Math.max(0.06, 0.3 - (lt - 1.6) * 0.08)) : 0;
    const shake = (this.kick * 0.35 + rumble) * (reduced ? 0 : 1);
    // the camera keeps the whole rocket in frame, then rides up with it
    const h = this.shipH * SITE_SCALE, follow = lift * 0.92, back = po ? Math.min(1, lift / 25) * 14 : Math.min(1, Math.max(0, lt) / 4) * 10;
    this.camera.position.set(15 + lx * 0.95 + this.mx * 1.0 + (Math.random() - 0.5) * shake, 3.2 + h * 0.18 - this.my * 0.5 + follow + (Math.random() - 0.5) * shake, 33 + back);
    this.camera.lookAt(lx * 0.95, 1 + h * 0.5 + follow + (po ? Math.min(6, lift * 0.25) : Math.min(6, Math.max(0, lt - 1.6) * 2)), 0);
  }

  private frameSpace(t: number) {
    this.world.update(t, this.mode === 'orbit' ? this.progress : 0, this.mode !== 'orbit');
    const p = this.mode === 'orbit' ? 1 : 0;
    this.shipRoot.visible = this.mode === 'orbit';
    this.shipRoot.position.x = this.mode === 'orbit' && innerWidth >= 1100 ? -2.2 : 0;
    if (this.pop < 1) { this.pop = Math.min(1, this.pop + 0.06); this.ship.scale.setScalar(0.9 + 0.1 * this.pop); }
    this.yawUser += this.yawVel; this.yawVel *= 0.93; this.yawUser *= 0.997;
    this.yaw = 0.7 + (reduced ? 0 : Math.sin(t * 0.22) * 0.3) + this.yawUser; // a calm three-quarter sway instead of a full spin
    this.shipRoot.rotation.set(0.16, this.yaw, -0.32);
    this.shipRoot.position.y = Math.sin(t * 0.6) * 0.18;
    this.kick *= 0.9;
    const kx = (Math.random() - 0.5) * this.kick * 0.5, ky = (Math.random() - 0.5) * this.kick * 0.5;
    if (this.mode === 'orbit') {
      this.camera.position.set(this.mx * 0.9 + kx, 1.4 - this.my * 0.5 + ky, 17);
      this.camera.lookAt(0, -0.4, 0);
    } else {
      // title and story screens: a slow float over the horizon of the Earth
      this.camera.position.set(Math.sin(t * 0.07) * 2.2 + this.mx * 1.2, 1.2 - this.my * 0.6 + Math.sin(t * 0.09) * 0.5 + ky, 14);
      this.camera.lookAt(0, -1.2, -60);
    }
    void p;
  }

  dispose() { cancelAnimationFrame(this.raf); removeEventListener('resize', this.resize); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
