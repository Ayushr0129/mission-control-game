import { describe, it, expect } from 'vitest';
import { content } from '../src/data';
import { computeTotals } from '../src/sim/simulate';
import { Decisions } from '../src/sim/types';
import { FLIGHT } from '../src/sim/flight';
import {
  LAND, landingSetup, stepCraft, onGround, judge, hopeless, impactX, advise, heightOf, groundAt,
  carefulPilot, simplePilot, laggedPilot, flyLanding,
} from '../src/sim/landing';

const { chapter, questions, conflicts } = content;
const totalsOf = (d: Decisions) => computeTotals(chapter, questions, conflicts, d);
const BASIC: Decisions = {
  'mgr-funding': 'modest', 'mgr-schedule': 'steady', 'eng-cabin': 'fix', 'nav-route': 'lor', 'eng-docking': 'basic',
  'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave',
};
const HEAVY: Decisions = { ...BASIC, 'nav-route': 'direct', 'eng-power': 'extra', 'sci-antenna': 'large' };
const fair = { liftoff: 'fair', orbit: 'fair' } as const, rough = { liftoff: 'rough', orbit: 'rough' } as const;
const setup = (d: Decisions = BASIC, site: 'flat' | 'rough' = 'flat', at: 1 | 2 = 1, marks: { liftoff: any; orbit: any } = fair) => landingSetup(chapter, totalsOf(d), [], marks, site, at);
function* everyBuild(i = 0, cur: Decisions = {}): Generator<Decisions> {
  const qs = questions.filter((q) => q.kind !== 'flight');
  if (i === qs.length) { yield { ...cur }; return; }
  for (const o of qs[i].options) { cur[qs[i].id] = o.id; yield* everyBuild(i + 1, cur); }
}
const hands = { turn: 0, engine: false, throttle: 1 } as const;

describe('the craft', () => {
  it('falls under lunar gravity when nobody touches it', () => {
    const s = setup(); const c = stepCraft(s.start, hands, 0.1, s);
    expect(c.vy).toBeCloseTo(LAND.vy0 - LAND.gravity * 0.1, 3); expect(c.x).toBeGreaterThan(0); expect(c.angle).toBe(0);
  });
  it('turns only while a turn is held, and pushes the way the nose points', () => {
    const s = setup(); const start = { ...s.start, fuel: 10, vx: 0, vy: 0 };
    const leaned = stepCraft(start, { turn: 1, engine: false, throttle: 1 }, 0.1, s);
    expect(leaned.angle).toBeCloseTo(LAND.turnRate * 0.1, 3);
    const far = stepCraft(start, { turn: 1, engine: false, throttle: 1 }, 0.1, { ...s, turnRate: 6 }); // well away from the guide arrow
    expect(stepCraft(far, hands, 0.1, s).angle).toBeCloseTo(far.angle, 9); // no spin
    const pushed = stepCraft({ ...start, angle: Math.PI / 2 }, { turn: 0, engine: true, throttle: 1 }, 0.1, s);
    expect(pushed.vx).toBeCloseTo(LAND.thrust * 0.1, 2); expect(pushed.fuel).toBeCloseTo(9.9, 5);
  });
  it('settles onto the guide arrow when the turn keys are let go close to it', () => {
    const s = setup(); const near = { ...s.start, fuel: 10, vx: 0, vy: 0, angle: 0.15 }; // the arrow says upright
    expect(Math.abs(stepCraft(near, hands, 0.1, s).angle)).toBeLessThan(0.15);
    let c = near; for (let i = 0; i < 20; i++) c = stepCraft(c, hands, 0.05, s);
    expect(Math.abs(c.angle)).toBeLessThan(0.01);
  });
  it('half throttle pushes half as hard and burns half as fast', () => {
    const s = setup(); const start = { ...s.start, fuel: 10, vx: 0, vy: 0 };
    const full = stepCraft(start, { turn: 0, engine: true, throttle: 1 }, 0.1, s), half = stepCraft(start, { turn: 0, engine: true, throttle: 0.5 }, 0.1, s);
    expect(half.vy + LAND.gravity * 0.1).toBeCloseTo((full.vy + LAND.gravity * 0.1) / 2, 4);
    expect(10 - half.fuel).toBeCloseTo((10 - full.fuel) / 2, 5);
  });
  it('an empty tank does nothing', () => {
    const s = setup(); const c = stepCraft({ ...s.start, fuel: 0 }, { turn: 0, engine: true, throttle: 1 }, 0.1, s);
    expect(c.vy).toBeCloseTo(LAND.vy0 - LAND.gravity * 0.1, 3);
  });
  it('a frozen tab cannot throw it through the ground', () => {
    const s = setup(); const a = { ...s.start, fuel: s.fuel };
    expect(stepCraft(a, hands, 5, s)).toEqual(stepCraft(a, hands, LAND.maxElapsed, s));
    expect(stepCraft(a, { turn: 0, engine: true, throttle: 1 }, 5, s).fuel).toBeGreaterThan(s.fuel - LAND.maxElapsed - 1e-9);
    const low = stepCraft({ ...a, y: 0.05, vy: -40 }, hands, 0.1, s);
    expect(low.y).toBe(0); expect(onGround(low, s)).toBe(true);
  });
  it('knows where it will come down', () => {
    const s = setup();
    expect(impactX(s.start, s)).toBeGreaterThan(200);
    expect(impactX({ ...s.start, vx: 0 }, s)).toBe(0);
  });
});

describe('a touchdown', () => {
  const s = setup(), down = (over: object) => ({ ...s.start, y: 0, vx: 0, vy: -2, angle: 0, ...over });
  it('is safe when slow, still and upright', () => expect(judge(down({}), s)).toBe('ok'));
  it('is too fast', () => expect(judge(down({ vy: -(s.vDown + 0.5) }), s)).toBe('fast'));
  it('is drifting', () => expect(judge(down({ vx: s.vSide + 0.5 }), s)).toBe('sideways'));
  it('is tipped over', () => expect(judge(down({ angle: s.tilt + 0.05 }), s)).toBe('tilted'));
  it('on the highlands, both legs must be on the pad', () => {
    const r = setup(BASIC, 'rough'), mid = (r.pad!.from + r.pad!.to) / 2;
    expect(judge({ ...r.start, x: mid, y: 0, vx: 0, vy: -2 }, r)).toBe('ok');
    expect(judge({ ...r.start, x: r.pad!.from + 1, y: 0, vx: 0, vy: -2 }, r)).toBe('rocks'); // one leg off the edge
    expect(judge({ ...r.start, x: r.pad!.to + 40, y: groundAt(r, r.pad!.to + 40), vx: 0, vy: -1 }, r)).toBe('rocks');
    expect(groundAt(r, mid)).toBe(0); expect(groundAt(r, r.pad!.to + 40)).toBeGreaterThan(1);
    expect(r.vDown).toBeLessThan(s.vDown);
  });
});

describe('fuel', () => {
  it('a lighter ship has more, the second try has less, and the heaviest keeps the floor', () => {
    expect(setup(BASIC).fuel).toBeGreaterThan(setup(HEAVY).fuel);
    expect(setup(BASIC, 'flat', 2).fuel).toBeLessThan(setup(BASIC, 'flat', 1).fuel);
    expect(setup(BASIC, 'flat', 1, rough).fuel).toBeLessThan(setup(BASIC, 'flat', 1, { liftoff: 'clean', orbit: 'clean' }).fuel);
    const light = setup(BASIC, 'flat', 1, { liftoff: 'clean', orbit: 'clean' }), heavy = setup(HEAVY, 'flat', 1, rough);
    expect(light.fuel / heavy.fuel).toBeCloseTo(FLIGHT.marginLight / FLIGHT.marginFloor, 1);
  });
});

describe('pilots using only turn, engine and throttle', () => {
  it('the careful pilot lands every rocket that can fly, on the plain, first try', () => {
    let flown = 0;
    for (const d of everyBuild()) {
      const t = totalsOf(d); if (t.mass > t.capacity) continue;
      const s = landingSetup(chapter, t, [], rough, 'flat', 1); const r = flyLanding(s, carefulPilot); flown++;
      if (!r.landed) throw new Error(`${r.why} at ${r.speed.toFixed(1)} m/s, fuel left ${(r.fuelLeft * 100).toFixed(0)}%: ${JSON.stringify(d)}`);
    }
    expect(flown).toBeGreaterThan(1000);
  });
  it('a player flying engine on, engine off at full throttle lands every rocket that can fly, on the plain', () => {
    for (const d of everyBuild()) {
      const t = totalsOf(d); if (t.mass > t.capacity) continue;
      const r = flyLanding(landingSetup(chapter, t, [], rough, 'flat', 1), simplePilot);
      if (!r.landed) throw new Error(`${r.why} at ${r.speed.toFixed(1)} m/s, fuel left ${(r.fuelLeft * 100).toFixed(0)}%: ${JSON.stringify(d)}`);
    }
  });
  it('both pilots land the basic build on the highlands pad', () => {
    for (const p of [carefulPilot, simplePilot]) { const r = flyLanding(setup(BASIC, 'rough'), p); expect(r.why).toBe('ok'); }
  });
  it('slow hands land the basic build on the plain within two tries', () => {
    for (const lag of [0.2, 0.4]) {
      const ok = flyLanding(setup(BASIC, 'flat', 1), laggedPilot(lag)).landed || flyLanding(setup(BASIC, 'flat', 2), laggedPilot(lag)).landed;
      expect(ok, `lag ${lag}`).toBe(true);
    }
  });
  it('a pilot who never touches anything loses both tries', () => {
    const idle = () => ({ ...hands });
    expect(flyLanding(setup(BASIC, 'flat', 1), idle).landed).toBe(false);
    expect(flyLanding(setup(BASIC, 'flat', 2), idle).landed).toBe(false);
  });
  it('is the same every time', () => {
    expect(flyLanding(setup(), simplePilot)).toEqual(flyLanding(setup(), simplePilot));
  });
});

describe('advice and the point of no return', () => {
  it('first says cancel the sideways speed, pointing against the motion', () => {
    const s = setup(), a = advise(s.start, s);
    expect(a.step).toBe(0); expect(a.angle).toBeLessThan(-0.5); // moving right, so lean left
  });
  it('then upright, then brake, then touch down', () => {
    const s = setup();
    expect(advise({ ...s.start, vx: 0, angle: -1.2 }, s).step).toBe(1);
    expect(advise({ ...s.start, vx: 0, vy: -20, y: 60 }, s).step).toBe(2);
    expect(advise({ ...s.start, vx: 0, vy: -2, y: 4 }, s).step).toBe(3);
  });
  it('says brake now when the ground is close and the fall is fast', () => {
    const s = setup();
    expect(advise({ ...s.start, vx: 0 }, s).brake).toBe('none');
    expect(advise({ ...s.start, vx: 0, vy: -25, y: 40 }, s).brake).toBe('now');
  });
  it('the point of no return never comes for a pilot who lands', () => {
    const s = setup(); let c = { ...s.start, fuel: s.fuel };
    while (!onGround(c, s)) { expect(hopeless(c, s)).toBe(false); c = stepCraft(c, simplePilot(c, s), LAND.dt, s); }
    expect(judge(c, s)).toBe('ok');
  });
  it('comes when it is low and fast, or falling with an empty tank', () => {
    const s = setup();
    expect(hopeless({ ...s.start, fuel: s.fuel }, s)).toBe(false);
    expect(hopeless({ ...s.start, fuel: s.fuel, y: 5, vx: 0, vy: -30 }, s)).toBe(true);
    expect(hopeless({ ...s.start, fuel: 0, y: 200, vx: 0, vy: -10 }, s)).toBe(true);
    expect(hopeless({ ...s.start, fuel: 0, y: 1, vx: 0, vy: -2 }, s)).toBe(false);
    expect(heightOf({ ...s.start, y: 30 }, s)).toBe(30);
  });
});
