import * as THREE from 'three';
import { Craft, LandingSetup, groundAt } from '../sim/landing';
import { earthCanvas, moonCanvas, planet, atmosphere, glowSprite, starField, flame } from './world';
import { buildShip } from './ship';

/**
 * The landing, seen from the side: flat grey ground, black sky, and the lander the player built.
 * Everything here is in metres, the same numbers the rules use. The camera follows the craft and
 * draws back as it climbs, so the craft is always big enough to read which way it points.
 */
const MODEL_SCALE = 7;   // the lander is drawn larger than life so its tilt is easy to see
const GROUND = 0x8a857c, GROUND_DARK = 0x5e5a53;

export class LanderView {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 1, 6000);
  private craft = new THREE.Group(); private model: THREE.Object3D; private fire: THREE.Group;
  private pivot = 3;                       // metres above the feet that the craft turns about
  private marker = new THREE.Group(); private rocks: THREE.Mesh | null = null; private pad: THREE.Group | null = null;
  private dustS: THREE.Sprite; private boomS: THREE.Sprite; private bits: THREE.Points; private bitV = new Float32Array(60 * 3);
  private viewH = 200; private fxAt = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  /** whole = the direct route, where the entire ship comes down, not a separate lander */
  constructor(tags: string[], whole: boolean) {
    const s = this.scene; s.background = new THREE.Color(0x01020a);
    s.add(starField(1800, 2400, 3, 1.4), starField(240, 2300, 9, 2.2));
    const sun = new THREE.DirectionalLight(0xfff4e0, 3.2); sun.position.set(-6, 5, 8); s.add(sun);
    s.add(new THREE.AmbientLight(0x334466, 0.7), new THREE.HemisphereLight(0x9fb8ff, 0x3a3630, 0.5));
    const earth = planet(1, earthCanvas(), './textures/earth.jpg', 0x335588); earth.scale.setScalar(95); earth.position.set(-520, 560, -1500);
    const atm = atmosphere(1, 0x6fb4ff, 4.5); atm.scale.setScalar(1.035 / 1.12); earth.add(atm); s.add(earth);

    // the ground: a wall of regolith below y = 0, with a paler line along the top
    const tex = new THREE.CanvasTexture(moonCanvas()); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(26, 4); tex.colorSpace = THREE.SRGBColorSpace;
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(9000, 900), new THREE.MeshBasicMaterial({ map: tex, color: GROUND })); soil.position.set(0, -450, 0); s.add(soil);
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(9000, 1.2), new THREE.MeshBasicMaterial({ color: 0xcfc9bd })); lip.position.set(0, -0.6, 0.2); s.add(lip);

    // the craft
    const ship = buildShip(new Set(tags));
    let model: THREE.Object3D = ship;
    if (!whole && ship.userData.lander) { model = ship.userData.lander as THREE.Object3D; model.removeFromParent(); model.position.set(0, 0, 0); model.rotation.set(0, 0.3, 0); model.scale.setScalar(0.9); }
    const holder = new THREE.Group(); holder.add(model); holder.scale.setScalar(MODEL_SCALE);
    const box = new THREE.Box3().setFromObject(holder);
    holder.position.y = -box.min.y - 0.15; holder.position.x = -(box.min.x + box.max.x) / 2; // feet at y = 0, centred
    const tall = box.max.y - box.min.y; this.pivot = Math.min(6, tall * 0.42);
    this.model = holder;
    this.fire = flame(whole ? 2.6 : 1.9, whole ? 13 : 9); this.fire.position.y = whole ? 0.6 : 1.4;
    const body = new THREE.Group(); body.add(holder, this.fire); body.position.y = -this.pivot;
    this.craft.add(body); s.add(this.craft);

    // where it will come down if the engine stays off
    const amber = new THREE.MeshBasicMaterial({ color: 0xf5a524, transparent: true, opacity: 0.9, depthTest: false });
    const post = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 9), amber); post.position.y = 4.5;
    const tip = new THREE.Mesh(new THREE.CircleGeometry(2.2, 3), amber); tip.rotation.z = -Math.PI / 2; tip.position.y = 11; // points down at the spot
    const foot = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 28), amber); foot.position.y = 0.2;
    this.marker.add(post, tip, foot); this.marker.position.z = 2; this.marker.renderOrder = 5; s.add(this.marker);

    this.dustS = glowSprite('205,198,184', 1); (this.dustS.material as THREE.SpriteMaterial).blending = THREE.NormalBlending; this.dustS.visible = false; s.add(this.dustS);
    this.boomS = glowSprite('255,180,90', 1); this.boomS.visible = false; s.add(this.boomS);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
    this.bits = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xffc080, size: 3, sizeAttenuation: false })); this.bits.visible = false; this.bits.frustumCulled = false; s.add(this.bits);
    for (let i = 0; i < 60; i++) this.bitV.set([(Math.sin(i * 12.9898) * 43758.5453 % 1) * 30, 8 + Math.abs(Math.sin(i * 78.233) * 30), 0], i * 3);
  }

  /** Lay out the ground for this landing: nothing extra on the plain, rocks and a marked pad on the highlands. */
  setup(s: LandingSetup) {
    this.rocks?.removeFromParent(); this.pad?.removeFromParent(); this.rocks = null; this.pad = null;
    this.craft.visible = true; this.dustS.visible = false; this.boomS.visible = false; this.bits.visible = false;
    if (!s.pad) return;
    const shape = new THREE.Shape(); const from = -700, to = 1100;
    shape.moveTo(from, -2);
    for (let x = from; x <= to; x += 2) shape.lineTo(x, groundAt(s, x));
    shape.lineTo(to, -2); shape.closePath();
    this.rocks = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: GROUND_DARK })); this.rocks.position.z = 0.4; this.scene.add(this.rocks);
    const pad = new THREE.Group(), w = s.pad.to - s.pad.from, green = new THREE.MeshBasicMaterial({ color: 0x3ddc84 });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.4), green); strip.position.set((s.pad.from + s.pad.to) / 2, 0.1, 0.6); pad.add(strip);
    for (const x of [s.pad.from, s.pad.to]) { const light = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 7), green); light.position.set(x, 3.5, 0.6); pad.add(light); const g = glowSprite('61,220,132', 9); g.position.set(x, 7.5, 1); pad.add(g); }
    this.pad = pad; this.scene.add(pad);
  }

  resize(w: number, h: number) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  /** Draw the craft where the rules say it is. impactX = where it will come down, or null to hide the marker. */
  update(c: Craft, burning: boolean, throttle: number, impactX: number | null, ground = 0) {
    this.craft.position.set(c.x, c.y + this.pivot, 1);
    this.craft.rotation.z = -c.angle;
    this.fire.visible = burning;
    if (burning) this.fire.scale.set(0.8 + 0.3 * throttle, (0.45 + 0.75 * throttle) * (0.9 + Math.random() * 0.2), 0.8 + 0.3 * throttle);
    const h = Math.max(0, c.y - ground);
    // draw back as it climbs; keep the craft in the upper part of the picture so the ground arrives from below
    const want = Math.min(230, Math.max(74, h * 0.8 + 74));
    this.viewH += (want - this.viewH) * 0.08;
    const dist = this.viewH / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const cy = Math.max(this.viewH * 0.5 - 24, c.y + this.pivot - this.viewH * (this.camera.aspect < 0.8 ? 0.2 : 0.32)); // the ground stays in view from about 160 m down; on a tall phone the craft sits clear of the panels
    this.camera.position.set(c.x, cy, dist); this.camera.lookAt(c.x, cy, 0);
    this.marker.visible = impactX !== null && h > 6;
    if (impactX !== null) this.marker.position.x = impactX;
  }

  /** where the craft is on screen, in pixels from the top left of a w by h picture */
  screenOf(c: Craft, w: number, h: number): { x: number; y: number } {
    this.tmp.set(c.x, c.y + this.pivot, 1).project(this.camera);
    return { x: (this.tmp.x * 0.5 + 0.5) * w, y: (-this.tmp.y * 0.5 + 0.5) * h };
  }
  /** pixels per metre at the craft, for sizing things drawn around it */
  pxPerMetre(h: number) { return h / this.viewH; }

  /** dust kicked up by a touchdown; call every frame with the seconds since it happened */
  dust(c: Craft, since: number) {
    this.dustS.visible = since < 2.5; this.dustS.position.set(c.x, c.y + 1, 1.5);
    this.dustS.scale.setScalar(8 + since * 26); (this.dustS.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.55 - since * 0.22);
  }
  /** the lander is lost; call every frame with the seconds since impact */
  boom(c: Craft, since: number) {
    if (since <= 0) return;
    this.craft.visible = false; this.fxAt.set(c.x, c.y + 2, 1.5);
    this.boomS.visible = since < 2.2; this.boomS.position.copy(this.fxAt); this.boomS.scale.setScalar(12 + since * 80); (this.boomS.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - since / 2.2);
    this.bits.visible = true; const p = this.bits.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let j = 0; j < 60; j++) p.setXYZ(j, this.fxAt.x + this.bitV[j * 3] * since, Math.max(0.2, this.fxAt.y + this.bitV[j * 3 + 1] * since - 0.81 * since * since), 1.5);
    p.needsUpdate = true;
  }
  dispose() { this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); }); }
}
