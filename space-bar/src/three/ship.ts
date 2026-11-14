import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const M = {
  white: new THREE.MeshStandardMaterial({ color: 0xe9eaee, roughness: 0.55, metalness: 0.1 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.85 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x3b414b, roughness: 0.6, metalness: 0.4 }),
  black: new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.6, metalness: 0.2 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xf5a524, emissive: 0x7a4a00, roughness: 0.4 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x7fb3ff, roughness: 0.5, metalness: 0.3 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb8433a, roughness: 0.6 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.3, metalness: 0.8 }),
  bell: new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide }),
};
type Mat = keyof typeof M;

function add(g: THREE.Object3D, geo: THREE.BufferGeometry, m: Mat | THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, typeof m === 'string' ? M[m] : m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
}
const cyl = (rt: number, rb: number, h: number, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg);

// ---------------------------------------------------------------- the lunar lander
function lander(scale: number, tags: Set<string>): THREE.Group {
  const g = new THREE.Group();
  add(g, cyl(0.5, 0.55, 0.55, 8), 'gold', 0, 0.55, 0);           // descent stage
  add(g, cyl(0.42, 0.42, 0.5, 8), 'silver', 0, 1.05, 0);         // ascent stage
  add(g, new THREE.BoxGeometry(0.3, 0.2, 0.3), 'dark', 0, 1.4, 0); // hatch
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = add(g, cyl(0.03, 0.03, 0.8), 'silver', Math.cos(a) * 0.7, 0.3, Math.sin(a) * 0.7);
    leg.rotation.z = Math.cos(a) * 0.5; leg.rotation.x = -Math.sin(a) * 0.5;
    add(g, cyl(0.14, 0.14, 0.03), 'gold', Math.cos(a) * 0.9, -0.05, Math.sin(a) * 0.9);
  }
  if (tags.has('instruments-full')) {
    add(g, new THREE.BoxGeometry(0.22, 0.22, 0.22), 'amber', 0.5, 1.15, 0.15);
    add(g, new THREE.BoxGeometry(0.2, 0.2, 0.2), 'blue', -0.5, 1.15, -0.1);
    add(g, cyl(0.02, 0.1, 0.22), 'dark', 0, 1.62, 0.2).rotation.x = 0.6; // TV camera
  } else if (tags.has('instruments-basic')) {
    add(g, new THREE.BoxGeometry(0.2, 0.2, 0.2), 'blue', 0.5, 1.15, 0.15);
  }
  g.scale.setScalar(scale);
  return g;
}

// ---------------------------------------------------------------- command + service module
/** Built standing up: engine bell at y -0.83, nose at the returned noseY. */
function csm(tags: Set<string>): { g: THREE.Group; noseY: number } {
  const has = (t: string) => tags.has(t);
  const g = new THREE.Group();
  add(g, cyl(0.28, 0.5, 0.5, 24), 'bell', 0, -0.58, 0);   // engine bell
  add(g, cyl(0.6, 0.6, 1.3), 'white', 0, 0.2, 0);       // service module
  add(g, cyl(0.61, 0.61, 0.08), 'dark', 0, 0.55, 0);
  add(g, cyl(0.07, 0.6, 0.95), 'silver', 0, 1.33, 0);    // command module
  let noseY = 1.8;
  if (has('cabin-redesign')) add(g, cyl(0.64, 0.64, 0.14), 'gold', 0, 0.9, 0);
  else if (has('cabin-fix')) add(g, cyl(0.62, 0.62, 0.06), 'amber', 0, 0.9, 0);
  if (has('docking-reliable')) {
    add(g, new THREE.TorusGeometry(0.13, 0.03, 8, 24), 'amber', 0, 1.82, 0).rotation.x = Math.PI / 2;
    add(g, cyl(0.03, 0.03, 0.4), 'silver', 0, 2.0, 0);
    add(g, new THREE.SphereGeometry(0.04, 8, 8), 'amber', 0, 2.22, 0); noseY = 2.24;
  } else if (has('docking-basic')) { add(g, cyl(0.025, 0.025, 0.3), 'dark', 0, 1.95, 0); noseY = 2.1; }
  if (has('power-extra')) for (const z of [-0.4, 0.4]) add(g, cyl(0.15, 0.15, 0.85), 'blue', 0.66, 0.2, z);
  if (has('battery')) add(g, new THREE.BoxGeometry(0.26, 0.5, 0.4), 'dark', -0.7, 0.1, 0);
  // high-gain antenna on a boom at the back of the service module
  if (has('dish-large') || has('dish-small')) {
    const big = has('dish-large'), boom = big ? 0.9 : 0.45, r = big ? 0.5 : 0.22;
    add(g, cyl(0.02, 0.02, boom), 'silver', 0, -0.25, 0.6 + boom / 2).rotation.x = Math.PI / 2;
    const d = add(g, new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), 'silver', 0, -0.25, 0.65 + boom);
    d.rotation.x = Math.PI / 2;
  }
  return { g, noseY };
}

/**
 * The spacecraft as it flies in space: command/service module plus the lander for the chosen route.
 * userData.csm and userData.lander let the flight cutscene split them for the landing.
 * landerMode: 'separate' (it undocks and lands), 'whole' (the whole ship lands) or 'none'.
 */
export function buildShip(tags: Set<string>): THREE.Group {
  const ship = new THREE.Group();
  const has = (t: string) => tags.has(t);
  const c = csm(tags); ship.add(c.g);
  let l: THREE.Group | null = null; let mode: 'separate' | 'whole' | 'none' = 'none';
  if (has('route-lor')) {
    // docked nose to nose, the way the real lander rode to the Moon
    l = lander(0.9, tags); l.rotation.z = Math.PI; l.position.set(0, c.noseY + 1.5 * 0.9 - 0.02, 0); mode = 'separate';
  } else if (has('route-eor')) {
    l = lander(1.0, tags); l.position.set(0, -2.4, 0); mode = 'separate';
    add(ship, cyl(0.62, 0.62, 0.7), 'white', 0, -1.15, 0);
    add(ship, new THREE.TorusGeometry(0.62, 0.04, 8, 32), 'amber', 0, -0.82, 0).rotation.x = Math.PI / 2;
  } else if (has('route-direct')) {
    l = lander(1.9, tags); l.position.set(0, -3.2, 0); mode = 'whole';
    add(ship, cyl(0.9, 0.9, 1.4), 'white', 0, -1.55, 0);
  }
  if (l) ship.add(l);
  ship.userData = { csm: c.g, lander: l, landerMode: mode };
  return ship;
}

// ---------------------------------------------------------------- the rocket underneath
let rollTex: THREE.CanvasTexture | null = null;
/** The black and white roll pattern of a Saturn first stage, with the lettering down the side. */
function rollPattern(): THREE.CanvasTexture {
  if (rollTex) return rollTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d')!;
  x.fillStyle = '#eceef1'; x.fillRect(0, 0, 512, 512);
  x.fillStyle = '#15171b';
  for (let i = 0; i < 4; i++) x.fillRect(i * 128, i % 2 ? 330 : 0, 64, i % 2 ? 182 : 120); // alternating black panels
  x.fillRect(0, 490, 512, 22);
  x.save(); x.translate(100, 150); x.rotate(Math.PI / 2); x.font = 'bold 34px Arial, sans-serif'; x.fillStyle = '#15171b';
  x.fillText('U N I T E D   S T A T E S', 0, 0); x.restore();
  rollTex = new THREE.CanvasTexture(c); rollTex.colorSpace = THREE.SRGBColorSpace; return rollTex;
}

/** Three stages, built from y = 0 (bottom of the engines) up. Returns the height of the top. */
function launcher(g: THREE.Group, w: number, tags: Set<string>): number {
  const stage1 = new THREE.MeshStandardMaterial({ map: rollPattern(), roughness: 0.55 });
  for (let i = 0; i < 5; i++) { // five engine bells
    const a = (i * Math.PI) / 2 + Math.PI / 4, r = i === 4 ? 0 : 0.5 * w;
    add(g, cyl(0.12 * w, 0.26 * w, 0.62, 20), 'bell', Math.cos(a) * r, 0.31, Math.sin(a) * r);
  }
  let y = 0.6;
  add(g, cyl(1.0 * w, 1.0 * w, 5.2, 40), stage1, 0, y + 2.6, 0); y += 5.2;
  for (let i = 0; i < 4; i++) { // fins and engine fairings
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const fin = add(g, new THREE.BoxGeometry(0.08, 1.5, 0.8), 'black', Math.cos(a) * 1.2 * w, 1.25, Math.sin(a) * 1.2 * w); fin.rotation.y = -a;
    add(g, cyl(0.16 * w, 0.22 * w, 1.2, 12), 'white', Math.cos(a) * 0.86 * w, 1.1, Math.sin(a) * 0.86 * w);
  }
  add(g, cyl(1.0 * w, 1.0 * w, 0.4, 40), 'black', 0, y + 0.2, 0); y += 0.4;             // interstage
  add(g, cyl(1.0 * w, 1.0 * w, 3.4, 40), 'white', 0, y + 1.7, 0);
  add(g, cyl(1.005 * w, 1.005 * w, 0.35, 40), 'black', 0, y + 2.7, 0); y += 3.4;         // second stage
  add(g, cyl(0.72 * w, 1.0 * w, 0.6, 40), 'white', 0, y + 0.3, 0); y += 0.6;             // taper
  add(g, cyl(0.72 * w, 0.72 * w, 2.0, 40), 'white', 0, y + 1.0, 0);
  add(g, cyl(0.725 * w, 0.725 * w, 0.5, 40), 'black', 0, y + 0.25, 0);                     // third stage
  // what happens to this stage after it sends the ship to the Moon shows up on it
  if (tags.has('stage-deorbit')) for (let i = 0; i < 3; i++) { const a = i * 2.1; add(g, new THREE.BoxGeometry(0.22, 0.4, 0.22), 'gold', Math.cos(a) * 0.76 * w, y + 0.35, Math.sin(a) * 0.76 * w); }
  if (tags.has('stage-solar')) add(g, cyl(0.735 * w, 0.735 * w, 0.18, 40), 'gold', 0, y + 1.6, 0);
  y += 2.0;
  return y;
}

/** Open truss adapter so the lander stays visible inside it while it is stacked. */
function adapter(g: THREE.Group, y: number, h: number, rb: number, rt: number) {
  add(g, cyl(rb, rb, 0.08, 40), 'dark', 0, y + 0.04, 0);
  add(g, cyl(rt, rt, 0.08, 40), 'dark', 0, y + h - 0.04, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, b = a + Math.PI / 8;
    const p0 = new THREE.Vector3(Math.cos(a) * rb, y, Math.sin(a) * rb), p1 = new THREE.Vector3(Math.cos(b) * rt, y + h, Math.sin(b) * rt);
    const len = p0.distanceTo(p1); const s = add(g, cyl(0.025, 0.025, len, 6), 'silver');
    s.position.copy(p0).add(p1).multiplyScalar(0.5); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
  }
}

/**
 * The whole vehicle standing on the pad: rocket stages, the lander inside its adapter, the command and
 * service module and the escape tower. Grows as the player decides. Built from y = 0 at the engines.
 * userData.workY = the height where the newest work is going on (for the welding sparks).
 */
export function buildStack(tags: Set<string>): THREE.Group {
  const g = new THREE.Group(); const has = (t: string) => tags.has(t);
  const w = has('route-direct') ? 1.3 : 1;   // going direct needs a far bigger rocket
  let y = launcher(g, w, tags);
  const top = 0.72 * w, ah = has('route-direct') ? 3.0 : 1.9;
  adapter(g, y, ah, top, 0.62);
  if (has('route-lor') || has('route-eor')) { const l = lander(0.78, tags); l.position.set(0, y + 0.12, 0); g.add(l); }
  else if (has('route-direct')) { const l = lander(1.45, tags); l.position.set(0, y + 0.15, 0); g.add(l); }
  if (has('route-eor')) add(g, new THREE.TorusGeometry(0.64, 0.05, 8, 32), 'amber', 0, y + ah - 0.1, 0).rotation.x = Math.PI / 2;
  y += ah;
  const workY = y + 0.6;
  const c = csm(tags); c.g.position.y = y + 0.83; g.add(c.g);
  y += 0.83 + 1.8;
  // launch escape tower
  add(g, cyl(0.04, 0.04, 1.1, 6), 'red', 0, y + 0.55, 0);
  add(g, cyl(0.09, 0.09, 0.5, 12), 'red', 0, y + 1.3, 0);
  add(g, new THREE.ConeGeometry(0.09, 0.25, 12), 'red', 0, y + 1.67, 0);
  g.userData = { workY, height: y + 1.8 };
  return g;
}

/** Live 3D view of the ship. Placeholder geometry until Blender glTF models exist. */
export class ShipView {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private controls: OrbitControls; private ship = new THREE.Group();
  private raf = 0; private ro: ResizeObserver; private pop = 1; private key: string | null = null;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a1c22, 1.1));
    const key = new THREE.DirectionalLight(0xfff2dd, 2.4); key.position.set(4, 6, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6f9bff, 1.2); rim.position.set(-5, 1, -4); this.scene.add(rim);
    this.scene.add(this.ship);
    this.camera.position.set(6.4, 1.2, 8.2);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false; this.controls.enableDamping = true;
    this.controls.minDistance = 6; this.controls.maxDistance = 16;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.controls.autoRotate = !reduce; this.controls.autoRotateSpeed = 1.1;
    this.controls.target.set(0.3, -1.2, 0);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.resize();
    this.setTags([]);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (this.pop < 1) { this.pop = Math.min(1, this.pop + 0.08); this.ship.scale.setScalar(0.94 + 0.06 * this.pop); }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
  private resize() {
    const w = this.host.clientWidth || 300, h = this.host.clientHeight || 300;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  setTags(tags: string[]) {
    const k = [...tags].sort().join('|');
    if (k === this.key) return;
    this.key = k;
    this.ship.clear();
    this.ship.add(buildShip(new Set(tags)));
    this.pop = 0;
  }
  dispose() {
    cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls.dispose(); this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
