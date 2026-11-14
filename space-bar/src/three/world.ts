import * as THREE from 'three';

/** deterministic little rng for textures and star placement */
export function rng(seed: number) { let a = seed; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---- smooth value noise on the sphere, so continents and clouds have no seams or obvious blobs
const hash3 = (x: number, y: number, z: number) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
const sm = (t: number) => t * t * (3 - 2 * t);
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), xf), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), xf), yf),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), xf), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), xf), yf), zf);
}
function fbm(x: number, y: number, z: number, oct = 4) { let a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { t += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return t; }
const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const step = (a: number, b: number, x: number) => sm(Math.min(1, Math.max(0, (x - a) / (b - a))));

export function earthCanvas(): HTMLCanvasElement {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!; const img = x.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const lon = (i / W) * 6.2832, lat = (j / H - 0.5) * 3.1416, cl = Math.cos(lat);
    const px = cl * Math.cos(lon) * 2.1, py = Math.sin(lat) * 2.1, pz = cl * Math.sin(lon) * 2.1;
    // warped noise gives coastlines with bays and peninsulas instead of round blobs
    const wx = fbm(px * 1.3 + 5, py * 1.3, pz * 1.3, 3) - 0.5, wy = fbm(px * 1.3, py * 1.3 + 7, pz * 1.3, 3) - 0.5;
    const h = fbm(px + wx * 1.1, py + wy * 1.1, pz + wx * 0.8, 6) - 0.04 * Math.abs(Math.sin(lat)), land = step(0.5, 0.515, h);
    const alat = Math.abs(lat);
    // climate by latitude: green tropics, dry belts near 25 degrees, forests, then tundra
    const desert = Math.max(0, 1 - Math.abs(alat - 0.42) / 0.2) * step(0.35, 0.6, fbm(px * 2.6 + 9, py * 2.6, pz * 2.6 + 4, 3));
    const tundra = step(0.85, 1.05, alat);
    let col = mix([6, 24, 66], [14, 58, 118], step(0.2, 0.5, h));                  // ocean, deep to shallow
    col = mix(col, [30, 104, 138], step(0.47, 0.5, h) * (1 - land));             // shallow shelf
    let ground = mix([36, 78, 38], [58, 92, 46], fbm(px * 4, py * 4, pz * 4, 2));  // forest and grassland
    ground = mix(ground, [176, 148, 98], desert);                                    // deserts
    ground = mix(ground, [112, 108, 92], tundra);
    col = mix(col, mix(ground, [128, 120, 110], step(0.66, 0.76, h)), land);        // mountains
    col = mix(col, [238, 244, 250], step(1.12, 1.3, alat + (fbm(px * 3, py * 3, pz * 3, 2) - 0.5) * 0.3)); // polar ice
    // clouds: streaks along the latitudes, with storms curling
    const cw = fbm(px * 2 + 21, py * 5, pz * 2 + 3, 3) - 0.5;
    const cloud = step(0.52, 0.72, fbm(px * 1.6 + cw * 1.4 + 11, py * 3.2 + 5, pz * 1.6 + cw * 1.4, 5)) * 0.85;
    col = mix(col, [250, 252, 255], cloud);
    const k = (j * W + i) * 4; img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}
export function moonCanvas(): HTMLCanvasElement {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!; const img = x.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const lon = (i / W) * 6.2832, lat = (j / H - 0.5) * 3.1416, cl = Math.cos(lat);
    const px = cl * Math.cos(lon) * 2.4, py = Math.sin(lat) * 2.4, pz = cl * Math.sin(lon) * 2.4;
    let v = 150 + (fbm(px * 2.2, py * 2.2, pz * 2.2, 5) - 0.5) * 90;
    v -= step(0.55, 0.68, fbm(px * 0.9 + 3, py * 0.9, pz * 0.9 + 8, 3)) * 46; // dark maria
    const k = (j * W + i) * 4; img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v * 0.98; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const r = rng(5);
  for (let n = 0; n < 150; n++) { // a few soft craters, not a polka-dot pattern
    const cx = r() * W, cy = H * 0.12 + r() * H * 0.76, cr = 3 + r() * r() * 26;
    const g = x.createRadialGradient(cx, cy, cr * 0.2, cx, cy, cr); g.addColorStop(0, 'rgba(40,40,44,.35)'); g.addColorStop(0.8, 'rgba(60,60,64,.18)'); g.addColorStop(0.92, 'rgba(235,235,238,.22)'); g.addColorStop(1, 'rgba(235,235,238,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, cr, 0, 7); x.fill();
  }
  return c;
}
/** Sphere with a procedural texture; a real NASA image in public/textures replaces it when present. */
export function planet(radius: number, canvas: HTMLCanvasElement, url: string, emissive = 0): THREE.Mesh {
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, emissive: new THREE.Color(emissive), emissiveMap: tex, emissiveIntensity: emissive ? 0.25 : 0 });
  new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.emissiveMap = t; mat.needsUpdate = true; }, undefined, () => {});
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), mat);
}

export function starField(count: number, radius: number, seed = 3, size = 1.6): THREE.Points {
  const pos = new Float32Array(3 * count), col = new Float32Array(3 * count); const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const th = r() * 6.283, ph = Math.acos(2 * r() - 1);
    pos.set([radius * Math.sin(ph) * Math.cos(th), radius * Math.cos(ph), radius * Math.sin(ph) * Math.sin(th)], i * 3);
    const warm = r(), b = 0.55 + r() * 0.45; col.set([b, b * (0.85 + warm * 0.15), b * (0.8 + (1 - warm) * 0.2)], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
}

/** Blue limb glow around a planet. Rendered on the inside faces so it hugs the edge. */
export function atmosphere(radius: number, color = 0x5aa8ff, power = 3.2): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { c: { value: new THREE.Color(color) }, p: { value: power } },
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); v = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 n; varying vec3 v; uniform vec3 c; uniform float p; void main(){ float i = pow(max(0.0, 0.78 - dot(n, v)), p); gl_FragColor = vec4(c, 1.0) * clamp(i, 0.0, 1.0) * 1.6; }',
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.12, 64, 48), mat);
}

export function glowSprite(color = '255,236,200', size = 60): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, `rgba(${color},1)`); g.addColorStop(0.12, `rgba(${color},.55)`); g.addColorStop(0.4, `rgba(${color},.12)`); g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size); return s;
}

/** Earth, Moon, sun and stars. progress 0 = in Earth orbit, 1 = at the Moon. */
export class World {
  readonly group = new THREE.Group();
  readonly earth = planet(40, earthCanvas(), './textures/earth.jpg', 0x335588);
  readonly moon = planet(6, moonCanvas(), './textures/moon.jpg');
  private sun: THREE.Sprite;
  private cur = 0; private lift = 0;
  constructor() {
    this.group.add(starField(1500, 900, 3, 1.4), starField(240, 880, 8, 2.2));
    this.earth.add(atmosphere(40));
    this.group.add(this.earth, this.moon);
    this.sun = glowSprite('255,238,205', 190); this.sun.position.set(-260, 150, -420); this.group.add(this.sun);
    const sunLight = new THREE.DirectionalLight(0xfff2e0, 3.4); sunLight.position.set(-6, 3.5, 4); this.group.add(sunLight);
    this.group.add(new THREE.AmbientLight(0x1b2b4a, 0.55));
    this.place(0, 0, true);
  }
  private place(p: number, t: number, snap = false) {
    this.cur = snap ? p : this.cur + (p - this.cur) * 0.02;
    const k = this.cur, e = k * k * (3 - 2 * k);
    // Earth falls away behind us while the Moon swells ahead
    this.earth.position.set(2 + 6 * e, -61 + this.lift + 3 * e, -84 - 24 * e);
    this.moon.position.set(-46 + 12 * e, 13 - 2 * e, -190 + 50 * e);
    this.moon.scale.setScalar(1 + 0.4 * e);
    this.earth.rotation.y = t * 0.02; this.moon.rotation.y = t * 0.006;
  }
  /** hero = title and story screens, where the Earth should fill more of the frame */
  update(t: number, progress: number, hero = true) { this.lift += ((hero ? 0 : -9) - this.lift) * 0.05; this.place(progress, t); }
}

/** A flame made of nested additive cones, pointing down its parent's -y axis. Hidden until something burns. */
export function flame(r: number, len: number): THREE.Group {
  const g = new THREE.Group();
  for (const [k, c, o] of [[1, 0xff8a2c, 0.55], [0.6, 0xffd890, 0.8], [0.28, 0xffffff, 0.95]] as [number, number, number][]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * k * 0.5, r * k, len * (0.6 + k * 0.4), 20, 1, true),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.y = -len * (0.6 + k * 0.4) / 2; g.add(m);
  }
  const glow = glowSprite('255,190,110', r * 9); glow.position.y = -r * 0.6; g.add(glow);
  g.visible = false; return g;
}
