import * as THREE from 'three';
import { glowSprite, moonCanvas, planet, rng } from './world';

/** Where the spacecraft is built: a launch complex on Earth, dusk turning to night as the work goes on. */
export class BuildSite {
  readonly scene = new THREE.Scene();
  private skyU = { n: { value: 0 } };
  private sun = new THREE.DirectionalLight(0xffb878, 2.4); private hemi = new THREE.HemisphereLight(0xffc89a, 0x1a1512, 0.7);
  private floods: THREE.SpotLight[] = []; private glows: THREE.Sprite[] = [];
  private stars: THREE.Points; private jib = new THREE.Group(); private hook = new THREE.Group();
  private weldLight = new THREE.PointLight(0xffb050, 0, 36, 1.6); private weldT = 9; private swing = 0;
  private sparks: THREE.Points; private sparkVel = new Float32Array(90 * 3); private sparkN = 90;
  private flame = new THREE.Group(); private flameLight = new THREE.PointLight(0xffa050, 0, 160, 1.2);
  private smoke: THREE.Points; private smokeVel = new Float32Array(140 * 3); private smokeN = 140;
  private moon: THREE.Mesh; private moonGlow!: THREE.Sprite; private windows!: THREE.CanvasTexture;
  private exhaustGlow!: THREE.Sprite; private stackH = 18;
  liftT = -1; liftY = 0;

  constructor() {
    const s = this.scene; s.fog = new THREE.FogExp2(0x6b4a45, 0.0042);
    // sky: a gradient dome with a low sun and a night that rises with progress
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP; uniform float n;
        void main(){
          vec3 hor = mix(vec3(1.0,.52,.22), vec3(.09,.07,.17), n), mid = mix(vec3(.42,.27,.46), vec3(.025,.04,.12), n), top = mix(vec3(.05,.11,.28), vec3(.008,.015,.05), n);
          float h = clamp(vP.y, 0.0, 1.0);
          vec3 c = mix(hor, mid, smoothstep(0.0, .2, h)); c = mix(c, top, smoothstep(.14, .7, h));
          float g = pow(max(dot(vP, normalize(vec3(-.6,.06,-.8))), 0.0), 22.0); c += vec3(1.0,.62,.3) * g * (1.0 - n * .85);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    sky.renderOrder = -10; s.add(sky);
    // stars only in the upper sky, fading in as it darkens
    const r = rng(31), sp = new Float32Array(900 * 3); let k = 0;
    while (k < 900) { const th = r() * 6.283, y = 0.22 + r() * 0.78, rr = Math.sqrt(1 - y * y); sp.set([900 * rr * Math.cos(th), 900 * y, 900 * rr * Math.sin(th)], k * 3); k++; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })); s.add(this.stars);
    this.moon = planet(22, moonCanvas(), './textures/moon.jpg', 0xffffff); this.moon.position.set(-420, 150, -330);
    const mm = this.moon.material as THREE.MeshStandardMaterial; mm.fog = false; mm.emissiveIntensity = 0.85; s.add(this.moon);
    this.moonGlow = glowSprite('215,225,255', 150); this.moonGlow.position.copy(this.moon.position).multiplyScalar(0.97); (this.moonGlow.material as THREE.SpriteMaterial).fog = false; s.add(this.moonGlow);

    // ground, pad and the ship's stand
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; s.add(ground);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x8b8a86, roughness: 0.92 });
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(10, 10.6, 0.5, 56), concrete); slab.position.y = 0.25; s.add(slab);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.07, 6, 80), new THREE.MeshBasicMaterial({ color: 0xf5a524 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.52; s.add(ring);
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.7, metalness: 0.4 });
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.5, 8), dark); stand.position.y = 0.75; s.add(stand);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.35), dark); arm.position.set(Math.cos(a) * 1.5, 1.2, Math.sin(a) * 1.5); s.add(arm); }

    // service gantry with swing arms, and a taller one beside it
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a919c, roughness: 0.6, metalness: 0.55 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.6 });
    const tower = (x: number, z: number, h: number, w: number) => {
      for (const dx of [-w / 2, w / 2]) for (const dz of [-w / 2, w / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, h, 0.26), steel); b.position.set(x + dx, h / 2, z + dz); s.add(b); }
      for (let y = 2; y < h; y += 2) {
        for (const [dx, dz, sx, sz] of [[0, -w / 2, w, 0.14], [0, w / 2, w, 0.14], [-w / 2, 0, 0.14, w], [w / 2, 0, 0.14, w]] as number[][]) { const c = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.14, sz), steel); c.position.set(x + dx, y, z + dz); s.add(c); }
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.1), steel); d.position.set(x + w / 2, y + 1, z); d.rotation.z = 0.0; d.rotation.x = (y / 2) % 2 ? 0.7 : -0.7; s.add(d);
      }
    };
    tower(-5.2, -0.5, 23, 2.4); tower(-9.5, -6, 13, 2.2);
    for (const y of [4, 8, 11.6, 14.6, 17.2]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.22, 1.1), red); arm.position.set(-2.75, y, -0.5); s.add(arm); }
    for (let i = 0; i < 11; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xff5a4d : 0xfff0c8 })); l.position.set(-6.4, 2 + i * 2, 0.9); s.add(l); }

    // crane: its jib swings to the ship whenever something new is fitted
    const yellow = new THREE.MeshStandardMaterial({ color: 0xe0a21c, roughness: 0.55, metalness: 0.3 });
    const cx = 22, cz = -34; const mast = new THREE.Mesh(new THREE.BoxGeometry(0.9, 24, 0.9), yellow); mast.position.set(cx, 12, cz); s.add(mast);
    this.jib.position.set(cx, 24, cz); s.add(this.jib);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(22, 0.7, 0.7), yellow); beam.position.x = -7; this.jib.add(beam);
    const cw = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 1.6), dark); cw.position.x = 5.4; this.jib.add(cw);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.2), yellow); cab.position.set(0.6, -0.9, 0); this.jib.add(cab);
    this.hook.position.set(-14, -0.4, 0); this.jib.add(this.hook);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 8, 4), dark); cable.position.y = -4; this.hook.add(cable);
    const hk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), dark); hk.position.y = -8; this.hook.add(hk);
    const beacon = glowSprite('255,70,60', 3); beacon.position.set(cx, 24.9, cz); s.add(beacon); this.glows.push(beacon);

    // the world beyond the fence: a big assembly hall with lit windows, low sheds, dark hills
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d')!;
    x.fillStyle = '#2b3038'; x.fillRect(0, 0, 256, 128); const rw = rng(4);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 7; j++) if (rw() > 0.22) { x.fillStyle = rw() > 0.3 ? '#ffd88a' : '#9ec4ff'; x.fillRect(8 + i * 15, 8 + j * 17, 9, 9); }
    this.windows = new THREE.CanvasTexture(cv); this.windows.colorSpace = THREE.SRGBColorSpace;
    const hall = new THREE.Mesh(new THREE.BoxGeometry(70, 46, 40), new THREE.MeshStandardMaterial({ color: 0xdcdcdc, map: this.windows, emissive: 0xffffff, emissiveMap: this.windows, emissiveIntensity: 0.15, roughness: 0.9 }));
    hall.position.set(-85, 23, -170); s.add(hall);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(70.2, 4, 40.2), new THREE.MeshStandardMaterial({ color: 0x1b3d8c })); stripe.position.set(-85, 40, -170); s.add(stripe);
    for (const [bx, bz, bw] of [[40, -120, 16], [60, -150, 24], [-30, -110, 12], [90, -190, 30]] as number[][]) {
      const shed = new THREE.Mesh(new THREE.BoxGeometry(bw, 6 + bw * 0.18, bw * 0.7), new THREE.MeshStandardMaterial({ color: 0x58585c, roughness: 1 })); shed.position.set(bx, 3 + bw * 0.09, bz); s.add(shed);
    }
    for (const [hx, hz, hs] of [[-260, -520, 160], [-60, -560, 190], [180, -540, 150], [380, -500, 180], [-460, -480, 140]] as number[][]) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(hs, hs * 0.38, 7), new THREE.MeshStandardMaterial({ color: 0x151219, roughness: 1 })); hill.position.set(hx, hs * 0.12, hz); s.add(hill);
    }

    // lights: low sun, warm hemisphere, floods that take over as night falls
    this.sun.position.set(-40, 14, -60); s.add(this.sun, this.hemi, new THREE.AmbientLight(0x3a3044, 0.5));
    for (const [fx, fz] of [[-16, 10], [-7, 20], [28, -26]] as number[][]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 9, 6), dark); pole.position.set(fx, 4.5, fz); s.add(pole);
      const sp = new THREE.SpotLight(0xfff0d8, 0, 110, 0.42, 0.7, 0); sp.position.set(fx, 9, fz); sp.target.position.set(0, 9, 0); s.add(sp, sp.target); this.floods.push(sp);
      const g = glowSprite('255,244,220', 7); g.position.set(fx, 9.2, fz); s.add(g); this.glows.push(g);
    }
    this.weldLight.position.set(0, 5, 2.5); s.add(this.weldLight);

    // sparks from welding and fitting
    const spg = new THREE.BufferGeometry(); spg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.sparkN * 3), 3));
    this.sparks = new THREE.Points(spg, new THREE.PointsMaterial({ color: 0xffc060, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.sparks.frustumCulled = false; s.add(this.sparks);

    // engine flame and smoke for the lift-off
    const plume = (r: number, len: number, color: number, op: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r, len, 28, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      m.position.y = -len / 2; this.flame.add(m); return m;
    };
    plume(2.1, 12, 0xff6a1c, 0.35); plume(1.5, 9, 0xff9a3c, 0.6); plume(0.9, 6, 0xffe0a0, 0.85); plume(0.45, 3.4, 0xffffff, 0.95);
    this.exhaustGlow = glowSprite('255,190,110', 16); this.exhaustGlow.position.y = -1.5; (this.exhaustGlow.material as THREE.SpriteMaterial).fog = false; this.flame.add(this.exhaustGlow);
    this.flame.add(this.flameLight);
    this.flame.visible = false; s.add(this.flame);
    const sg2 = new THREE.BufferGeometry(); sg2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.smokeN * 3), 3));
    const c = document.createElement('canvas'); c.width = c.height = 64; const px = c.getContext('2d')!; const gr = px.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); px.fillStyle = gr; px.fillRect(0, 0, 64, 64);
    this.smoke = new THREE.Points(sg2, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: 8, color: 0xb9b2aa, transparent: true, opacity: 0, depthWrite: false })); this.smoke.frustumCulled = false; s.add(this.smoke);
    const rs = rng(77); for (let i = 0; i < this.smokeN; i++) { const a = rs() * 6.283, v = 0.4 + rs() * 2; this.smokeVel.set([Math.cos(a) * v, 0.2 + rs() * 1.0, Math.sin(a) * v], i * 3); }
    const rv = rng(5); for (let i = 0; i < this.sparkN; i++) { const a = rv() * 6.283, v = 2 + rv() * 5; this.sparkVel.set([Math.cos(a) * v, 1 + rv() * 5, Math.sin(a) * v], i * 3); }
  }
  padTopY = 1;

  /** A new part was fitted: the crane swings in, sparks fly, the work light flashes. */
  weld(y: number) { this.weldT = 0; this.swing = 1; this.weldLight.position.set(0, y, 2.6); }
  /** taller rockets get longer swing arms and a bigger plume */
  setStackHeight(h: number) { this.stackH = h; }
  startLiftoff() { this.liftT = 0; this.liftY = 0; this.flame.visible = true; }
  resetLift() { this.liftT = -1; this.liftY = 0; this.liftX = 0; this.flightT = 0; this.flame.visible = false; this.flame.rotation.z = 0; this.flameLight.intensity = 0; this.flightKey.intensity = 0; if (this.fog0 >= 0) (this.scene.fog as THREE.FogExp2).density = this.fog0; (this.smoke.material as THREE.PointsMaterial).opacity = 0; }
  liftX = 0; private flightT = 0; private fog0 = -1; private flightKey = new THREE.DirectionalLight(0xfff2e0, 0);
  /** A flown liftoff: the rocket's base is at (x, y) above the pad, leaning by angle, with the engine at thrust 0..1. */
  setFlight(x: number, y: number, angle: number, thrust: number, dtl: number) {
    this.liftT = -1; this.liftY = y; this.liftX = x;
    // the pad's floodlights and haze stay on the ground: light the rocket as it climbs out of them
    const fog = this.scene.fog as THREE.FogExp2;
    if (this.fog0 < 0) { this.fog0 = fog.density; this.flightKey.position.set(14, 8, 24); this.scene.add(this.flightKey, this.flightKey.target); }
    fog.density = this.fog0 * Math.max(0.1, 1 - y / 45);
    this.flightKey.intensity = Math.min(2.6, 0.3 + y / 10); this.flightKey.target.position.set(x, this.padTopY + y + 8, 0);
    const on = thrust > 0; this.flame.visible = on;
    if (on) this.flightT = Math.min(6, this.flightT + dtl);
    const fl = (0.6 + 0.4 * thrust) * (0.9 + Math.random() * 0.22);
    this.flame.position.set(x, this.padTopY + y, 0); this.flame.rotation.z = -angle;
    this.flame.scale.set(fl, fl * (1.1 + Math.min(1, y / 20)), fl);
    this.exhaustGlow.scale.setScalar(16 + 6 * Math.random());
    this.flameLight.intensity = on ? 900 * thrust * (0.8 + Math.random() * 0.4) : 0;
    // the cloud the engines blow across the pad, thinning as the rocket leaves it behind
    const lt = this.flightT, k = Math.min(1, lt * 0.5);
    (this.smoke.material as THREE.PointsMaterial).opacity = Math.min(0.6, lt) * Math.max(0, 1 - y / 70);
    const p = this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.smokeN; i++) p.setXYZ(i, this.smokeVel[i * 3] * lt * 3.4 * (0.4 + k), 0.8 + this.smokeVel[i * 3 + 1] * lt * 1.2, this.smokeVel[i * 3 + 2] * lt * 3.4 * (0.4 + k));
    p.needsUpdate = true;
  }

  /** progress 0..1 is also the time of evening: dusk at the start, floodlit night by the launch poll. */
  update(t: number, progress: number, dtl: number) {
    const n = Math.min(1, progress * 0.9 + 0.05); this.skyU.n.value = n;
    (this.scene.fog as THREE.FogExp2).color.setRGB(0.42 - 0.38 * n, 0.29 - 0.26 * n, 0.27 - 0.22 * n);
    this.sun.intensity = 2.6 * (1 - n) + 0.25; this.hemi.intensity = 0.75 - 0.4 * n;
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, (n - 0.3) * 1.4);
    for (const f of this.floods) f.intensity = 3 + 14 * n;
    this.windows.needsUpdate = false;
    // crane
    this.swing *= 0.985;
    this.jib.rotation.y = 0.55 + Math.sin(t * 0.22) * 0.18 + this.swing * 0.55;
    this.hook.position.x = -14 + this.swing * 3; this.hook.scale.y = 1 - this.swing * 0.35;
    this.glows[0].visible = Math.floor(t * 1.4) % 2 === 0;
    // welding flash and sparks
    this.weldT += dtl; const w = Math.max(0, 1 - this.weldT * 1.6);
    this.weldLight.intensity = w * 140 * (0.7 + Math.random() * 0.6);
    const sm = this.sparks.material as THREE.PointsMaterial; sm.opacity = w;
    if (w > 0) {
      const p = this.sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.sparkN; i++) p.setXYZ(i, this.sparkVel[i * 3] * this.weldT * 0.6, this.weldLight.position.y + this.sparkVel[i * 3 + 1] * this.weldT - 6 * this.weldT * this.weldT, 2.6 + this.sparkVel[i * 3 + 2] * this.weldT * 0.6);
      p.needsUpdate = true;
    }
    this.moon.rotation.y = t * 0.01;
    // lift-off
    if (this.liftT >= 0) {
      this.liftT += dtl; const lt = this.liftT, th = Math.min(1, lt / 1.2);
      const up = Math.max(0, lt - 1.6);
      this.liftY = 2.2 * up * up + 1.2 * up; // slow at first, the way a heavy rocket clears the tower
      const fl = th * (0.9 + Math.random() * 0.22);
      this.flame.position.set(0, this.padTopY + this.liftY, 0); this.flame.scale.set(fl, fl * (1 + 0.5 * Math.min(2, up)), fl);
      this.exhaustGlow.scale.setScalar(16 + 6 * Math.random());
      this.flameLight.intensity = th * 900 * (0.8 + Math.random() * 0.4);
      const smk = this.smoke.material as THREE.PointsMaterial; smk.opacity = Math.min(0.6, th);
      const p = this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute;
      const half = this.smokeN >> 1;
      for (let i = 0; i < this.smokeN; i++) {
        if (i < half || up <= 0) { const k = Math.min(1, lt * 0.5); p.setXYZ(i, this.smokeVel[i * 3] * lt * 3.4 * (0.4 + k), 0.8 + this.smokeVel[i * 3 + 1] * lt * 1.2, this.smokeVel[i * 3 + 2] * lt * 3.4 * (0.4 + k)); }
        else { // the column of exhaust the rocket leaves behind it
          const f = (i - half) / half, yy = this.liftY * f, age = (1 - f) * up;
          p.setXYZ(i, this.smokeVel[i * 3] * age * 0.6, this.padTopY + yy, this.smokeVel[i * 3 + 2] * age * 0.6);
        }
      }
      p.needsUpdate = true;
    }
  }
}
