/**
 * The trip map: the Earth–Moon system drawn at true distances, in the frame that turns with the Moon (so the Moon
 * stays put on the right and Apollo's figure-8 shows). The Earth and the Moon are drawn larger than true size,
 * or they would be dots; a note says so. Coordinates are km, Earth at (0, 0), Moon at (D, 0), y up.
 */
import { D, R_E, R_M } from '../sim/cr3bp';
import { uiText } from '../prefs';

export interface MapPath { x: number[]; y: number[] }
export interface PathDraw { p: MapPath; style: 'past' | 'plan' | 'ghost'; from?: number; to?: number }
export interface MapState {
  paths: PathDraw[];
  /** heading: radians in the map frame, 0 = towards +x */
  ship?: { x: number; y: number; heading: number; burning: number };
  /** the guide arrow, radians in the map frame; ok = the nose is on it */
  aim?: { heading: number; ok: boolean } | null;
  /** a two-body ellipse from the ship's point, while the injection burn stretches the orbit */
  ellipse?: { perigee: number; apogee: number; angle: number } | null;
  /** a ring marking where to burn */
  marker?: { x: number; y: number } | null;
  /** the parking orbit, drawn as a thin circle */
  parking?: number | null;
  /** the atmosphere's edge, with the incoming path at an exaggerated angle */
  entry?: EntryDraw | null;
}
/** The entry close-up. ship.at: how far along the incoming path (0 = its far end, 1 = the air); nose: radians from the path, + is up. */
export interface EntryDraw { angle: number; lo: number; hi: number; glow: number; ship?: { at: number; nose: number; burning: number; aim?: { nose: number; ok: boolean } | null } }
export type Framing = 'earth' | 'system' | 'moon' | 'entry';

const FRAMES: Record<Framing, { cx: number; cy: number; span: number }> = {
  earth: { cx: 0, cy: 0, span: 34000 },
  system: { cx: D * 0.5, cy: 0, span: D * 1.32 },
  moon: { cx: D, cy: 0, span: 30000 },
  entry: { cx: -R_E * 0.2, cy: R_E * 1.3, span: R_E * 2.2 }, // the Earth's limb low on the screen, the path in from the upper left
};

export class MapView {
  readonly el = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private cx = 0; private cy = 0; private span = FRAMES.earth.span;
  private want = { ...FRAMES.earth };
  private w = 1; private h = 1; private dpr = 1;
  private stars: [number, number, number][] = [];
  private note = document.createElement('p');

  constructor(private host: HTMLElement) {
    this.el.className = 'trip-map';
    this.note.className = 'trip-map-note';
    host.append(this.el, this.note);
    this.ctx = this.el.getContext('2d')!;
    let seed = 7; const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 220; i++) this.stars.push([r(), r(), 0.2 + r() * 0.6]);
    this.resize();
  }
  /** Ease towards a framing; `instant` jumps. `span` can widen it, for an orbit that is stretching out. */
  frame(f: Framing, instant = false, span?: number) {
    this.want = { ...FRAMES[f], span: Math.max(FRAMES[f].span, span ?? 0) };
    if (f === 'earth' && span && span > FRAMES.earth.span) this.want.cx = Math.min(D * 0.5, span * 0.35);
    if (instant) { this.cx = this.want.cx; this.cy = this.want.cy; this.span = this.want.span; }
  }
  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = this.host.clientWidth || innerWidth; this.h = this.host.clientHeight || innerHeight;
    this.el.width = Math.round(this.w * this.dpr); this.el.height = Math.round(this.h * this.dpr);
    this.el.style.width = `${this.w}px`; this.el.style.height = `${this.h}px`;
  }
  /** pixels per km */
  private get k() { return Math.min(this.w, this.h * 1.55) / this.span; }
  screenOf(x: number, y: number): [number, number] { return [this.w / 2 + (x - this.cx) * this.k, this.h * 0.46 - (y - this.cy) * this.k]; }

  draw(s: MapState, dt: number) {
    const ease = 1 - Math.pow(0.04, dt); // smooth framing changes
    this.cx += (this.want.cx - this.cx) * ease; this.cy += (this.want.cy - this.cy) * ease;
    this.span *= Math.pow(this.want.span / this.span, ease);
    const c = this.ctx, k = this.k;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#03060c'; c.fillRect(0, 0, this.w, this.h);
    for (const [x, y, a] of this.stars) { c.fillStyle = `rgba(220,230,255,${a})`; c.fillRect(x * this.w, y * this.h, 1.2, 1.2); }
    // a faint grid of 100,000 km rings round the Earth gives the distances a scale
    c.strokeStyle = 'rgba(140,170,210,.08)'; c.lineWidth = 1;
    for (let r = 100000; r <= 400000; r += 100000) { const [ex, ey] = this.screenOf(0, 0); c.beginPath(); c.arc(ex, ey, r * k, 0, Math.PI * 2); c.stroke(); }

    // bodies, larger than life when they would be too small to see
    const er = Math.max(R_E * k, 13), mr = Math.max(R_M * k, 8);
    this.note.textContent = R_E * k < 12 ? uiText('Distances to scale. Earth and Moon drawn larger than scale.', 'Distances à l’échelle. La Terre et la Lune sont agrandies.') : '';
    const [ex, ey] = this.screenOf(0, 0), [mx, my] = this.screenOf(D, 0);
    if (s.entry) { // the atmosphere, thickened so the corridor can be seen
      c.strokeStyle = `rgba(120,180,255,${0.35 + 0.4 * s.entry.glow})`; c.lineWidth = Math.max(6, er * 0.06); c.beginPath(); c.arc(ex, ey, er * 1.05, 0, Math.PI * 2); c.stroke();
    }
    this.body(ex, ey, er, '#2f6fb3', '#9cc8f2');
    this.body(mx, my, mr, '#7d7a75', '#c9c4bb');
    if (s.parking) { c.strokeStyle = 'rgba(200,215,235,.35)'; c.setLineDash([3, 4]); c.beginPath(); c.arc(ex, ey, Math.max(er * 1.03, s.parking * k), 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
    c.fillStyle = '#9fb0c8'; c.font = '600 11px var(--mono, monospace)'; c.textAlign = 'center';
    c.fillText(uiText('EARTH', 'TERRE'), ex, ey + er + 16); c.fillText(uiText('MOON', 'LUNE'), mx, my + mr + 16);

    for (const d of s.paths) this.path(d);
    if (s.ellipse) this.ellipse(s.ellipse);
    if (s.entry) this.entry(s.entry, ex, ey, er);
    if (s.marker) { const [x, y] = this.screenOf(s.marker.x, s.marker.y); c.strokeStyle = '#3ddc84'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.stroke(); }
    if (s.ship) this.ship(s.ship, s.aim ?? null);
  }

  private body(x: number, y: number, r: number, dark: string, light: string) {
    const c = this.ctx, g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, light); g.addColorStop(1, dark);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  private path(d: PathDraw) {
    const c = this.ctx, n = d.p.x.length, a = Math.max(0, d.from ?? 0), b = Math.min(n - 1, d.to ?? n - 1);
    if (b - a < 1) return;
    c.lineWidth = d.style === 'past' ? 2.2 : 1.6;
    c.strokeStyle = d.style === 'past' ? '#f2b23a' : d.style === 'plan' ? 'rgba(242,178,58,.75)' : 'rgba(170,200,235,.38)';
    c.setLineDash(d.style === 'past' ? [] : d.style === 'plan' ? [7, 6] : [3, 6]);
    c.beginPath();
    for (let i = a; i <= b; i++) { const [x, y] = this.screenOf(d.p.x[i], d.p.y[i]); if (i === a) c.moveTo(x, y); else c.lineTo(x, y); }
    c.stroke(); c.setLineDash([]);
  }
  private ellipse(e: { perigee: number; apogee: number; angle: number }) {
    const c = this.ctx, k = this.k, a = (e.perigee + e.apogee) / 2, f = a - e.perigee, b = Math.sqrt(Math.max(0, a * a - f * f));
    // perigee at the ship's side; centre on the far side of the Earth by f
    const cxw = -Math.cos(e.angle) * f, cyw = -Math.sin(e.angle) * f;
    const [x, y] = this.screenOf(cxw, cyw);
    c.strokeStyle = 'rgba(242,178,58,.75)'; c.setLineDash([7, 6]); c.lineWidth = 1.6;
    c.beginPath(); c.ellipse(x, y, a * k, b * k, -e.angle, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  }
  private entry(en: EntryDraw, ex: number, ey: number, er: number) {
    // the incoming path drawn at three times its real angle, so a degree reads
    const c = this.ctx, top = ey - er * 1.05, hitX = ex - er * 0.35, hitY = top + er * 0.05;
    const ang = (deg: number) => (Math.abs(deg) * 3 * Math.PI) / 180;
    const ray = (deg: number, col: string, w: number, dash: number[]) => {
      const a = ang(deg), L = er * 2.4;
      c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash);
      c.beginPath(); c.moveTo(hitX - Math.cos(a) * L, hitY - Math.sin(a) * L); c.lineTo(hitX, hitY); c.stroke(); c.setLineDash([]);
    };
    // the corridor between its two edges
    const a1 = ang(en.lo), a2 = ang(en.hi), L = er * 2.4;
    c.fillStyle = 'rgba(61,220,132,.13)'; c.beginPath(); c.moveTo(hitX, hitY);
    c.lineTo(hitX - Math.cos(a1) * L, hitY - Math.sin(a1) * L); c.lineTo(hitX - Math.cos(a2) * L, hitY - Math.sin(a2) * L); c.closePath(); c.fill();
    ray(en.lo, 'rgba(61,220,132,.6)', 1, [4, 4]); ray(en.hi, 'rgba(61,220,132,.6)', 1, [4, 4]);
    const inside = en.angle >= en.lo && en.angle <= en.hi;
    ray(en.angle, inside ? '#3ddc84' : '#ffb23a', 2.4, []);
    if (en.ship) { // the ship on the incoming path, at its real angle drawn three times over
      const a = ang(en.angle), d = (1 - en.ship.at) * L, sx = hitX - Math.cos(a) * d, sy = hitY - Math.sin(a) * d;
      const aim = en.ship.aim ? { heading: -a + en.ship.aim.nose, ok: en.ship.aim.ok } : null;
      this.shipAt(sx, sy, -a + en.ship.nose, en.ship.burning, aim);
    }
    if (en.glow > 0) { const g = c.createRadialGradient(hitX, hitY, 2, hitX, hitY, 40); g.addColorStop(0, `rgba(255,190,110,${en.glow})`); g.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = g; c.beginPath(); c.arc(hitX, hitY, 40, 0, Math.PI * 2); c.fill(); }
  }
  private ship(sh: { x: number; y: number; heading: number; burning: number }, aim: { heading: number; ok: boolean } | null) {
    const [x, y] = this.screenOf(sh.x, sh.y);
    this.shipAt(x, y, sh.heading, sh.burning, aim);
  }
  private shipAt(x: number, y: number, heading: number, burning: number, aim: { heading: number; ok: boolean } | null) {
    const c = this.ctx, sh = { heading, burning };
    if (aim) { // the guide arrow, from the ship
      const L = 46, ax = x + Math.cos(aim.heading) * L, ay = y - Math.sin(aim.heading) * L;
      c.strokeStyle = aim.ok ? '#3ddc84' : '#f5a524'; c.fillStyle = c.strokeStyle; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(x, y); c.lineTo(ax, ay); c.stroke();
      const h = aim.heading; c.beginPath(); c.moveTo(ax + Math.cos(h) * 8, ay - Math.sin(h) * 8);
      c.lineTo(ax + Math.cos(h + 2.5) * 8, ay - Math.sin(h + 2.5) * 8); c.lineTo(ax + Math.cos(h - 2.5) * 8, ay - Math.sin(h - 2.5) * 8); c.closePath(); c.fill();
    }
    c.save(); c.translate(x, y); c.rotate(-sh.heading);
    if (sh.burning > 0) { // flame out of the back
      const g = c.createLinearGradient(-6, 0, -6 - 26 * sh.burning, 0); g.addColorStop(0, 'rgba(255,240,200,.95)'); g.addColorStop(1, 'rgba(255,120,30,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(-5, -3.5); c.lineTo(-6 - 26 * sh.burning, 0); c.lineTo(-5, 3.5); c.closePath(); c.fill();
    }
    c.fillStyle = '#f4f1e8'; c.strokeStyle = '#03060c'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -6); c.lineTo(-3, 0); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
  dispose() { this.el.remove(); this.note.remove(); }
}
