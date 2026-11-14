/**
 * The flying controls: turn left or right, fire the engine, set the throttle.
 * Keyboard: ← → or A D turn, SPACE fires the engine while held, ↑ ↓ or W S move the throttle.
 * The on-screen buttons call hold() and setThrottle(), so a mouse or a finger does the same job.
 * Read `state` every frame. Losing focus lets go of the turn and the engine; the throttle stays where it was set.
 */
import type { Controls } from '../sim/types';
export type { Controls };
type Held = 'left' | 'right' | 'engine';
const KEYS: Record<string, Held | 'up' | 'down'> = {
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  ' ': 'engine', Spacebar: 'engine', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
};

export class FlyControls {
  /** called when the engine or the throttle changes, so the control strip can redraw */
  onChange?: () => void;
  /** called on any touch of the controls at all: "somebody is flying" */
  onTouch?: () => void;
  private key = { left: false, right: false, engine: false };  // held on the keyboard
  private btn = { left: false, right: false, engine: false };  // held on screen
  private throttle = 1;
  private off: (() => void)[] = [];

  constructor(keys: EventTarget) {
    const listen = (type: string, fn: (e: any) => void) => {
      const l = fn as EventListener; keys.addEventListener(type, l); this.off.push(() => keys.removeEventListener(type, l));
    };
    listen('keydown', (e) => {
      const k = KEYS[e.key] ?? (e.code === 'Space' ? 'engine' : undefined); if (!k) return;
      e.preventDefault?.(); this.onTouch?.();
      if (k === 'up' || k === 'down') { this.setThrottle(this.throttle + (k === 'up' ? 0.1 : -0.1)); return; }
      if (e.repeat || this.key[k]) return;
      this.key[k] = true; if (k === 'engine') this.onChange?.();
    });
    listen('keyup', (e) => {
      const k = KEYS[e.key] ?? (e.code === 'Space' ? 'engine' : undefined); if (!k) return;
      e.preventDefault?.();
      if (k === 'up' || k === 'down' || !this.key[k]) return;
      this.key[k] = false; if (k === 'engine') this.onChange?.();
    });
    listen('blur', () => this.letGo());
  }

  get state(): Controls {
    const left = this.key.left || this.btn.left, right = this.key.right || this.btn.right;
    return { turn: left === right ? 0 : left ? -1 : 1, engine: this.key.engine || this.btn.engine, throttle: this.throttle };
  }
  /** an on-screen button pressed or released */
  hold(what: Held, down: boolean) {
    if (this.btn[what] === down) return;
    this.btn[what] = down; if (down) this.onTouch?.();
    if (what === 'engine') this.onChange?.();
  }
  setThrottle(v: number) {
    const t = Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
    if (t === this.throttle) return;
    this.throttle = t; this.onChange?.();
  }
  /** release every held control; the throttle keeps its setting */
  letGo() {
    const was = this.key.engine || this.btn.engine;
    this.key = { left: false, right: false, engine: false }; this.btn = { left: false, right: false, engine: false };
    if (was) this.onChange?.();
  }
  dispose() { this.off.forEach((f) => f()); this.off = []; this.letGo(); this.onChange = undefined; this.onTouch = undefined; }
}
