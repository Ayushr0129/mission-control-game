/**
 * The launch to orbit, on screen: a canvas that follows the rocket (or shows the whole Earth), a control strip
 * that works with keys, mouse or touch, and a coach driven by the same guidance the autopilot flies with.
 * All the physics lives in launch.ts; this file only draws it and reads the controls.
 */
import { h, fmt } from '../ui/dom';
import {
  EARTH, ORBIT, LaunchSetup, LaunchState, altitudeOf, climbOf, launchPilot, massOf, orbitOf, remainingDv,
  speedOf, stageDry, startLaunch, stepLaunch,
} from './launch';

export interface LaunchResult {
  orbit: boolean; crashed: boolean; guided: boolean;
  /** km/s still in the tanks once the flight ended */ left: number;
  /** metres */ apo: number; peri: number;
  /** seconds of flight */ met: number;
}
export interface LaunchViewOptions {
  text: (english: string, french: string) => string;
  onEnd: (result: LaunchResult) => void;
  onClock?: (met: number) => void;
}

const WARPS = [1, 5, 10, 25, 50];
const TURN = (40 * Math.PI) / 180;        // lean rate, radians per real second
const CHUNK = 0.25;                       // seconds of flight between control updates
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const km = (m: number) => `${fmt(m / 1000, m < 100_000 ? 1 : 0)} km`;
export const metText = (s: number) => `T+ ${String(Math.floor(s / 3600)).padStart(3, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class LaunchView {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private f: LaunchState;
  private abort = new AbortController();
  private keys = new Set<string>();
  private held = new Set<string>();       // on-screen buttons
  private pitch = 0; private throttle = 0; private stageRequest = false;
  private warp = 2; private map = false; private auto = false; private guided = false;
  private advicePhase: LaunchState['phase'] = 0;
  private last = performance.now(); private ended = false;
  private path: { x: number; y: number }[] = []; private pathAge = 99;
  private strip: HTMLElement; private warpBtn!: HTMLButtonElement; private autoBtn!: HTMLButtonElement; private mapBtn!: HTMLButtonElement;

  constructor(private host: HTMLElement, private s: LaunchSetup, private o: LaunchViewOptions) {
    this.f = startLaunch(s);
    this.strip = this.buildStrip();
    host.append(this.canvas, this.strip);
    this.bind(); this.resize();
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Hand the flying to guidance from here on. */
  engageAutopilot() { this.auto = true; this.guided = true; this.autoBtn.disabled = true; this.autoBtn.textContent = this.o.text('Autopilot flying', 'Pilote automatique actif'); if (this.warp < 3) this.setWarp(3); }

  private buildStrip(): HTMLElement {
    const t = this.o.text;
    const hold = (key: string, label: string, aria: string) => {
      const b = h('button', { type: 'button', class: 'lv-key', 'aria-label': aria }, label);
      const on = (e: Event) => { e.preventDefault(); this.held.add(key); }, off = () => this.held.delete(key);
      b.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, off));
      return b;
    };
    const tap = (label: string, aria: string, fn: () => void, cls = 'lv-key') => h('button', { type: 'button', class: cls, 'aria-label': aria, onclick: fn }, label);
    this.warpBtn = tap('', t('Time warp', 'Accélération du temps'), () => this.setWarp((this.warp + 1) % WARPS.length)) as HTMLButtonElement;
    this.mapBtn = tap(t('MAP', 'CARTE'), t('Toggle map view', 'Basculer la vue carte'), () => this.toggleMap()) as HTMLButtonElement;
    this.autoBtn = tap(t('Autopilot', 'Pilote automatique'), t('Let the autopilot fly the launch', 'Confier le lancement au pilote automatique'), () => this.engageAutopilot(), 'lv-key lv-auto') as HTMLButtonElement;
    this.setWarp(this.warp);
    return h('div', { class: 'lv-strip' },
      h('div', { class: 'lv-group' }, h('span', {}, t('LEAN', 'INCLINAISON')), hold('left', '◀', t('Lean left', 'Incliner à gauche')), hold('right', '▶', t('Lean right', 'Incliner à droite'))),
      h('div', { class: 'lv-group' }, h('span', {}, t('THROTTLE', 'POUSSÉE')), tap('0', t('Cut engine', 'Couper le moteur'), () => { this.throttle = 0; }), hold('down', '−', t('Less throttle', 'Moins de poussée')), hold('up', '+', t('More throttle', 'Plus de poussée')), tap(t('FULL', 'MAX'), t('Full throttle', 'Pleine poussée'), () => { this.throttle = 1; })),
      h('div', { class: 'lv-group' }, tap(t('STAGE', 'SÉPARER'), t('Drop the current stage', "Larguer l'étage actuel"), () => { this.stageRequest = true; }, 'lv-key lv-stage'), this.warpBtn, this.mapBtn, this.autoBtn),
      h('p', { class: 'lv-keys' }, t('Keys: A/D or ←/→ lean · W/S or ↑/↓ throttle · Z full · X cut · Space stage · M map · , . time warp', 'Touches : A/D ou ←/→ inclinaison · W/S ou ↑/↓ poussée · Z max · X coupure · Espace séparation · M carte · , . accélération')));
  }

  private setWarp(i: number) { this.warp = clamp(i, 0, WARPS.length - 1); this.warpBtn.textContent = `×${WARPS[this.warp]}`; }
  private toggleMap() { this.map = !this.map; this.mapBtn.classList.toggle('on', this.map); }

  private bind() {
    const signal = this.abort.signal, map: Record<string, string> = { a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down' };
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (map[k]) { e.preventDefault(); this.keys.add(map[k]); return; }
      if (k === ' ') { e.preventDefault(); if (!e.repeat) this.stageRequest = true; }
      else if (k === 'z') this.throttle = 1;
      else if (k === 'x') this.throttle = 0;
      else if (k === 'm') this.toggleMap();
      else if (k === '.' || k === '>') this.setWarp(this.warp + 1);
      else if (k === ',' || k === '<') this.setWarp(this.warp - 1);
    }, { signal });
    addEventListener('keyup', (e) => { const k = map[e.key.toLowerCase()]; if (k) this.keys.delete(k); }, { signal });
    addEventListener('blur', () => { this.keys.clear(); this.held.clear(); }, { signal });
    const ro = new ResizeObserver(() => this.resize()); ro.observe(this.host); signal.addEventListener('abort', () => ro.disconnect());
  }

  private resize() {
    const w = this.host.clientWidth, hgt = Math.max(320, Math.min(560, w * 0.62)), d = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.max(1, w * d); this.canvas.height = hgt * d; this.canvas.style.width = `${w}px`; this.canvas.style.height = `${hgt}px`;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  private frame(now: number) {
    if (!this.host.isConnected) { this.abort.abort(); return; }
    const real = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (!this.ended) this.advance(real);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  private advance(real: number) {
    const on = (k: string) => this.keys.has(k) || this.held.has(k);
    if (!this.auto) {
      if (on('left')) this.pitch -= TURN * real;
      if (on('right')) this.pitch += TURN * real;
      this.pitch = clamp(this.pitch, -Math.PI / 2, Math.PI);
      if (on('up')) this.throttle = clamp(this.throttle + 0.6 * real, 0, 1);
      if (on('down')) this.throttle = clamp(this.throttle - 0.6 * real, 0, 1);
    }
    // a still-on-the-pad rocket waits for the pilot; nothing is lost by taking your time there
    let left = this.f.status === 'pad' && this.throttle === 0 && !this.auto ? 0 : real * WARPS[this.warp];
    while (left > 1e-6 && !this.ended) {
      const dt = Math.min(CHUNK, left); left -= dt;
      const advice = launchPilot({ ...this.f, phase: this.advicePhase }, this.s);
      this.advicePhase = advice.phase;
      if (this.auto) { this.pitch = advice.pitch; this.throttle = advice.throttle; if (advice.stage) this.stageRequest = true; }
      this.f = stepLaunch(this.f, { pitch: this.pitch, throttle: this.throttle, stage: this.stageRequest }, dt, this.s);
      this.stageRequest = false;
      this.checkEnd();
    }
    this.o.onClock?.(this.f.t);
  }

  private checkEnd() {
    const f = this.f, o = orbitOf(f);
    const settled = f.status === 'orbit' && (this.throttle === 0 || f.prop[f.stage] <= 0);
    if (!settled && f.status !== 'crashed' && f.status !== 'spent') return;
    this.ended = true;
    this.o.onEnd({ orbit: f.status === 'orbit', crashed: f.status === 'crashed', guided: this.guided, left: remainingDv(f, this.s), apo: o.apo, peri: o.peri, met: f.t });
  }

  /** Where the craft goes from here with the engine off: a few thousand seconds, or until it hits the ground. */
  private predict() {
    let { x, y, vx, vy } = this.f; const pts = [{ x, y }];
    const o = orbitOf(this.f), r0 = Math.hypot(x, y);
    const period = o.escape ? 6000 : 2 * Math.PI * Math.sqrt(((r0 + 0) ** 3) / EARTH.mu) * 1.6;
    const dt = Math.max(2, Math.min(20, period / 900));
    for (let t = 0; t < period && pts.length < 1200; t += dt) {
      const r = Math.hypot(x, y), g = EARTH.mu / (r * r);
      vx -= g * (x / r) * dt; vy -= g * (y / r) * dt; x += vx * dt; y += vy * dt;
      if (Math.hypot(x, y) < EARTH.radius) { pts.push({ x, y }); break; }
      pts.push({ x, y });
    }
    this.path = pts;
  }

  private draw() {
    const ctx = this.ctx, w = this.canvas.clientWidth, hgt = this.canvas.clientHeight, f = this.f, t = this.o.text;
    if (++this.pathAge > 8) { this.pathAge = 0; this.predict(); }
    const alt = Math.max(0, altitudeOf(f)), r = Math.hypot(f.x, f.y), ux = f.x / r, uy = f.y / r;
    // camera: near view follows the rocket with local "up" pointing up the screen; map view shows the whole planet
    const o = orbitOf(f);
    const span = this.map ? 2.3 * (EARTH.radius + Math.min(Number.isFinite(o.apo) ? Math.max(o.apo, 400_000) : 3_000_000, 3_000_000)) : clamp(alt * 2.6 + 12_000, 12_000, 2_400_000);
    const scale = Math.min(w, hgt) / span;
    const phi = this.map ? 0 : Math.PI / 2 - Math.atan2(uy, ux);
    const cx = this.map ? 0 : f.x, cy = this.map ? 0 : f.y, ox = w * 0.5, oy = hgt * (this.map ? 0.5 : 0.58);
    const cos = Math.cos(phi), sin = Math.sin(phi);
    const toScreen = (x: number, y: number) => { const dx = x - cx, dy = y - cy; return { x: ox + (dx * cos - dy * sin) * scale, y: oy - (dx * sin + dy * cos) * scale }; };

    // sky: blue near the ground, black in space
    const sky = this.map ? 0 : clamp(1 - alt / 60_000, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, hgt);
    g.addColorStop(0, `rgb(${Math.round(4 + 30 * sky)},${Math.round(9 + 70 * sky)},${Math.round(16 + 120 * sky)})`);
    g.addColorStop(1, `rgb(${Math.round(6 + 60 * sky)},${Math.round(14 + 110 * sky)},${Math.round(24 + 170 * sky)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hgt);

    // the planet, its thin atmosphere and the line that counts as space
    const c = toScreen(0, 0), R = EARTH.radius * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(110,170,230,.10)'; ctx.beginPath(); ctx.arc(c.x, c.y, R + 100_000 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(114,228,160,.35)'; ctx.beginPath(); ctx.arc(c.x, c.y, R + ORBIT.minPeri * scale, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const land = ctx.createRadialGradient(c.x, c.y, R * 0.6, c.x, c.y, R);
    land.addColorStop(0, '#1f4f74'); land.addColorStop(1, '#2d6f8f');
    ctx.fillStyle = land; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8fd0ef'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    if (!this.map) { // the launch pad
      const pad = toScreen(0, EARTH.radius);
      ctx.fillStyle = '#c9d6dc'; ctx.fillRect(pad.x - 14, pad.y - 2, 28, 4);
    }

    // where she is going if the engine stops now
    if (this.path.length > 1) {
      ctx.save(); ctx.strokeStyle = f.status === 'orbit' ? '#72e4a0' : '#e8b65b'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
      ctx.beginPath(); this.path.forEach((p, i) => { const s = toScreen(p.x, p.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }); ctx.stroke(); ctx.restore();
      this.marker(toScreen, o.apo, 'apo'); this.marker(toScreen, o.peri, 'peri');
    }

    // the rocket, and the guidance line showing where the autopilot would point
    const me = toScreen(f.x, f.y);
    const dirAt = (p: number) => { const ex = uy, ey = -ux, dx = Math.cos(p) * ux + Math.sin(p) * ex, dy = Math.cos(p) * uy + Math.sin(p) * ey; return Math.atan2(-(dx * sin + dy * cos), dx * cos - dy * sin); };
    if (f.status !== 'crashed') {
      const advice = launchPilot({ ...f, phase: this.advicePhase }, this.s), ga = dirAt(advice.pitch);
      ctx.save(); ctx.strokeStyle = 'rgba(145,228,255,.55)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(me.x, me.y); ctx.lineTo(me.x + Math.cos(ga) * 46, me.y + Math.sin(ga) * 46); ctx.stroke(); ctx.restore();
      const burning = this.throttle > 0 && f.prop[f.stage] > 0 && f.status !== 'pad' || (f.status === 'pad' && this.throttle > 0);
      this.rocket(me.x, me.y, dirAt(this.pitch), burning ? this.throttle : 0);
    }

    // readouts
    const st = this.s.stages[f.stage], m = massOf(f, this.s), twr = st ? (st.thrust * this.throttle) / (m * 9.80665) : 0;
    const fuel = st && st.prop > 0 ? f.prop[f.stage] / st.prop : 0;
    const rows: [string, string, boolean?][] = [
      ['MET', metText(f.t).slice(3)], [t('ALT', 'ALT'), km(alt)], [t('SPEED', 'VITESSE'), `${fmt(speedOf(f))} m/s`],
      [t('CLIMB', 'MONTÉE'), `${fmt(climbOf(f))} m/s`],
      [t('APOAPSIS', 'APOAPSIDE'), Number.isFinite(o.apo) ? km(Math.max(0, o.apo)) : t('escape', 'évasion'), o.apo >= ORBIT.minPeri],
      [t('PERIAPSIS', 'PÉRIAPSIDE'), o.peri < 0 ? t('below ground', 'sous le sol') : km(o.peri), o.peri >= ORBIT.minPeri],
      [t('STAGE', 'ÉTAGE'), st ? `${f.stage + 1}/${this.s.stages.length} ${st.name}` : '—'],
      [t('PROPELLANT', 'ERGOLS'), `${fmt(fuel * 100)}%`, fuel > 0.1],
      [t('THROTTLE', 'POUSSÉE'), `${fmt(this.throttle * 100)}%  ${t('TWR', 'P/P')} ${fmt(twr, 2)}`],
      [t('Δv LEFT', 'Δv RESTANT'), `${fmt(remainingDv(f, this.s), 2)} km/s`],
    ];
    ctx.save(); ctx.fillStyle = 'rgba(3,10,16,.62)'; ctx.fillRect(10, 10, 232, 18 + rows.length * 18);
    ctx.font = '12px ui-monospace, monospace';
    rows.forEach(([k, v, good], i) => { ctx.fillStyle = '#7f98a6'; ctx.fillText(k, 20, 30 + i * 18); ctx.fillStyle = good === undefined ? '#dbe6ed' : good ? '#72e4a0' : '#e8b65b'; ctx.fillText(v, 116, 30 + i * 18); });
    ctx.restore();

    // the coach: one plain instruction at a time
    const say = this.coach(fuel);
    ctx.save(); ctx.font = '600 13px ui-monospace, monospace'; const tw = ctx.measureText(say).width;
    ctx.fillStyle = 'rgba(3,10,16,.72)'; ctx.fillRect(w - tw - 34, 10, tw + 24, 30);
    ctx.fillStyle = stageDry(f, this.s) && f.stage < this.s.stages.length - 1 ? '#f0c27a' : '#c3d9e8'; ctx.fillText(say, w - tw - 22, 30);
    ctx.restore();
  }

  private coach(fuel: number): string {
    const t = this.o.text, f = this.f;
    if (f.status === 'crashed') return t('Vehicle lost', 'Véhicule perdu');
    if (f.status === 'spent') return t('Out of propellant short of orbit', "Plus d'ergols avant l'orbite");
    if (f.status === 'orbit') return this.throttle > 0 ? t('In orbit: cut the engine to confirm', "En orbite : coupez le moteur pour confirmer") : t('Orbit achieved', 'Orbite atteinte');
    if (this.auto) return t('Autopilot flying', 'Pilote automatique actif');
    if (f.status === 'pad') return t('Full throttle to lift off (Z)', 'Pleine poussée pour décoller (Z)');
    if (stageDry(f, this.s) && f.stage < this.s.stages.length - 1) return t('Stage empty: drop it (Space)', 'Étage vide : larguez-le (Espace)');
    if (this.advicePhase === 0) return fuel > 0 ? t('Climb and lean right along the dashed guide', 'Montez et inclinez à droite le long du guide') : '';
    if (this.advicePhase === 1) return t('Apoapsis high enough: cut the engine and coast', 'Apoapside suffisante : coupez et laissez monter');
    return t('Near the top: burn along the horizon', "Près du sommet : poussez le long de l'horizon");
  }

  private marker(toScreen: (x: number, y: number) => { x: number; y: number }, altM: number, which: 'apo' | 'peri') {
    if (!Number.isFinite(altM) || altM < -EARTH.radius * 0.9) return;
    // find the path point nearest that altitude at the right end of the arc
    const want = EARTH.radius + altM; let best = -1, bestErr = Infinity;
    this.path.forEach((p, i) => { const e = Math.abs(Math.hypot(p.x, p.y) - want); if (e < bestErr) { bestErr = e; best = i; } });
    if (best < 0 || bestErr > 30_000) return;
    const s = toScreen(this.path[best].x, this.path[best].y), ctx = this.ctx;
    ctx.save(); ctx.fillStyle = which === 'apo' ? '#91e4ff' : '#f0c27a'; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = '10px ui-monospace, monospace'; ctx.fillText(which === 'apo' ? 'AP' : 'PE', s.x + 7, s.y - 6); ctx.restore();
  }

  private rocket(x: number, y: number, angle: number, power: number) {
    const ctx = this.ctx; ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
    if (power > 0) { ctx.fillStyle = `rgba(255,${150 + Math.round(80 * Math.random())},60,.9)`; ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(0, 9 + 10 + 16 * power * Math.random()); ctx.lineTo(4, 9); ctx.fill(); }
    ctx.fillStyle = '#e8eef1'; ctx.strokeStyle = '#0b1d2b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(5, -6); ctx.lineTo(5, 9); ctx.lineTo(-5, 9); ctx.lineTo(-5, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
