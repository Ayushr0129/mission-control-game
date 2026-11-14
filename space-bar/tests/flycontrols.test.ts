import { describe, it, expect } from 'vitest';
import { FlyControls } from '../src/ui/flycontrols';

const ev = (type: string, key = ' ', extra = {}) => Object.assign(new Event(type), { key, repeat: false }, extra);
const make = () => { const k = new EventTarget(); return { k, c: new FlyControls(k) }; };

describe('the flying controls', () => {
  it('starts hands-off at full throttle', () => {
    expect(make().c.state).toEqual({ turn: 0, engine: false, throttle: 1 });
  });
  it('a held engine key is one press, however often it repeats', () => {
    const { k, c } = make(); let changes = 0; c.onChange = () => changes++;
    k.dispatchEvent(ev('keydown')); k.dispatchEvent(ev('keydown', ' ', { repeat: true })); k.dispatchEvent(ev('keydown'));
    expect(c.state.engine).toBe(true); expect(changes).toBe(1);
    k.dispatchEvent(ev('keyup')); k.dispatchEvent(ev('keyup'));
    expect(c.state.engine).toBe(false); expect(changes).toBe(2);
  });
  it('turning and burning at once: letting go of one keeps the other', () => {
    const { k, c } = make();
    k.dispatchEvent(ev('keydown', 'ArrowLeft')); k.dispatchEvent(ev('keydown', ' '));
    expect(c.state).toMatchObject({ turn: -1, engine: true });
    k.dispatchEvent(ev('keyup', 'ArrowLeft'));
    expect(c.state).toMatchObject({ turn: 0, engine: true });
    k.dispatchEvent(ev('keydown', 'd')); k.dispatchEvent(ev('keyup', ' '));
    expect(c.state).toMatchObject({ turn: 1, engine: false });
  });
  it('left and right together cancel, and releasing one turns the other way', () => {
    const { k, c } = make();
    k.dispatchEvent(ev('keydown', 'ArrowLeft')); k.dispatchEvent(ev('keydown', 'ArrowRight'));
    expect(c.state.turn).toBe(0);
    k.dispatchEvent(ev('keyup', 'ArrowLeft')); expect(c.state.turn).toBe(1);
  });
  it('losing focus lets go of the turn and the engine, and keeps the throttle', () => {
    const { k, c } = make();
    k.dispatchEvent(ev('keydown', 'ArrowDown')); k.dispatchEvent(ev('keydown', 'ArrowDown'));
    k.dispatchEvent(ev('keydown', 'A')); k.dispatchEvent(ev('keydown', ' ')); c.hold('right', true);
    k.dispatchEvent(ev('blur'));
    expect(c.state).toEqual({ turn: 0, engine: false, throttle: 0.8 });
  });
  it('the throttle steps, repeats while held, and stops at the ends', () => {
    const { k, c } = make();
    for (let i = 0; i < 4; i++) k.dispatchEvent(ev('keydown', 's', { repeat: i > 0 }));
    expect(c.state.throttle).toBeCloseTo(0.6, 5);
    for (let i = 0; i < 30; i++) k.dispatchEvent(ev('keydown', 'ArrowDown'));
    expect(c.state.throttle).toBe(0);
    for (let i = 0; i < 30; i++) k.dispatchEvent(ev('keydown', 'w'));
    expect(c.state.throttle).toBe(1);
    c.setThrottle(0.37); expect(c.state.throttle).toBe(0.37);
    c.setThrottle(5); expect(c.state.throttle).toBe(1);
  });
  it('a key and an on-screen button together are still one hold', () => {
    const { k, c } = make();
    k.dispatchEvent(ev('keydown', ' ')); c.hold('engine', true);
    k.dispatchEvent(ev('keyup', ' ')); expect(c.state.engine).toBe(true);
    c.hold('engine', false); expect(c.state.engine).toBe(false);
  });
  it('stops space and the arrows from scrolling the page, and ignores other keys', () => {
    const { k, c } = make(); let stopped = 0; const pd = { preventDefault: () => stopped++ };
    for (const key of [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) k.dispatchEvent(ev('keydown', key, pd));
    expect(stopped).toBe(5);
    k.dispatchEvent(ev('keydown', 'q', pd)); k.dispatchEvent(ev('keydown', 'Enter', pd));
    expect(stopped).toBe(5); expect(c.state.turn).toBe(0); // left and right are both still down
  });
  it('says when somebody touches a control, and stops listening when disposed', () => {
    const { k, c } = make(); let touched = 0; c.onTouch = () => touched++;
    k.dispatchEvent(ev('keydown', 'ArrowLeft')); c.hold('engine', true);
    expect(touched).toBe(2);
    c.dispose(); k.dispatchEvent(ev('keydown', ' '));
    expect(c.state).toMatchObject({ turn: 0, engine: false });
  });
});
