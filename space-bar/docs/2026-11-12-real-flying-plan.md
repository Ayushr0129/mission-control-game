# Space Bar: Real Flying — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three one-button moments with flying the player steers and throttles, taught on screen, in the order landing, liftoff, orbit burn.

**Architecture:** One control object (`FlyControls`: turn, engine, throttle) feeds pure step functions in `src/sim/flight.ts`. Each moment still returns today's result (`Mark`, `LandingResult`), so `simulate.ts`, the session, the report and the endings are untouched. The landing gets its own flat side-view scene (`src/three/landerview.ts`) drawn by the flight's renderer; the liftoff poses the rocket in the existing pad scene; the orbit burn turns the ship in the existing space scene. The robot pilot that tests the rules is also the autopilot and the source of the on-screen guide arrow.

**Tech Stack:** TypeScript, Vite, three.js, Vitest, Playwright-core (dev).

**Spec:** `docs/2026-11-12-real-flying-design.md`. Read it first.

## Global Constraints

- No new libraries. Same models as the build (`buildStack`, `buildShip`).
- Flying rules stay in `src/sim/flight.ts`: no DOM, no three.js. Same build, seed and inputs give the same result.
- Controls: turn ← → / A D, engine hold SPACE, throttle ↑ ↓ / W S, plus on-screen buttons that work with mouse and touch. Throttle starts at 100%.
- The craft turns only while a turn control is held. No spin.
- Space never scrolls the page or presses a button. Losing focus lets go of everything.
- Usable at 390 px wide and at 1280×720.
- `?quick=1` and reduced motion get the autopilot unless `?fly=1`.
- The game works after Tasks 3, 5 and 6. Commit after every task.
- Commit messages end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- After every task: `npx tsc --noEmit` clean, `npm test` passes.

## Review Focus

1. **Two controls at once.** Holding a turn key and the engine together, then letting go of one, must leave the other held. Pinned in Task 1.
2. **Focus lost mid-burn.** Alt-tab with the engine held must cut the engine and stop the turn. Pinned in Task 1.
3. **A frozen tab.** One huge time step must not throw the lander through the ground or burn the tank. Pinned in Task 2.
4. **Touching down on a slope or the edge of the pad.** One leg on rock is not a landing. Pinned in Task 2.
5. **The player who does nothing after Start.** Liftoff hands over to guidance, the orbit burn fires late, the landing aborts once and is lost on the second try, and nothing gets stuck. Pinned in the browser script, Tasks 3, 5 and 6.

---

### Task 1: The controls

**Files:** Create `src/ui/flycontrols.ts`, `tests/flycontrols.test.ts`.

**Produces:**

```ts
export interface Controls { turn: -1 | 0 | 1; engine: boolean; throttle: number }   // throttle 0..1
export class FlyControls {
  constructor(keys: EventTarget);
  readonly state: Controls;                       // live; read it every frame
  hold(what: 'left' | 'right' | 'engine', down: boolean): void;   // for on-screen buttons
  setThrottle(v: number): void;                   // clamps to 0..1
  onChange?: () => void;                          // throttle or engine changed (to redraw the strip)
  dispose(): void;
}
```

Keys: ArrowLeft/A left, ArrowRight/D right, Space engine, ArrowUp/W throttle +0.1, ArrowDown/S throttle −0.1 (key repeat counts for throttle only). Left and right together cancel to 0. `blur` releases left, right and engine; throttle keeps its value. `preventDefault` on every key it handles.

- [ ] Tests: a held engine key with auto-repeat is one press; left+engine then releasing left keeps the engine; left+right is 0, releasing one turns the other way; blur clears turn and engine but not throttle; throttle steps and clamps; other keys ignored; dispose stops listening; on-screen `hold` and keys combine (either holds it, both must release).
- [ ] Implement. Run tests. Commit `feat: turn, engine and throttle controls`.

---

### Task 2: Landing rules

**Files:** Modify `src/sim/flight.ts` (the one-axis landing goes), `tests/flight.test.ts`.

**Produces:**

```ts
export interface Craft { x: number; y: number; vx: number; vy: number; angle: number; fuel: number; t: number }
// metres, m/s, vy positive up; angle in radians, 0 = nose up, positive = leaning right; fuel = seconds at full throttle
export interface LandingSetup {
  fuel: number; start: Craft; gravity: number; thrust: number; turnRate: number;
  vDown: number; vSide: number; tilt: number;          // safe touchdown limits
  site: Site; pad: { from: number; to: number } | null; // the highlands' flat pad; null on the plain
  warnings: string[];
}
export function landingSetup(ch, t, events, marks, site, attempt): LandingSetup;   // same arguments as today
export function groundAt(s: LandingSetup, x: number): number;
export function stepCraft(c: Craft, ctl: Controls, elapsed: number, s: LandingSetup): Craft;
export function onGround(c: Craft, s: LandingSetup): boolean;
export function judge(c: Craft, s: LandingSetup): 'ok' | 'fast' | 'sideways' | 'tilted' | 'rocks';
export function hopeless(c: Craft, s: LandingSetup): boolean;       // first try: abort now
export function impactX(c: Craft, s: LandingSetup): number;         // where it comes down with the engine off
export function advise(c: Craft, s: LandingSetup): { angle: number; throttle: number; engine: boolean; step: 0 | 1 | 2 | 3; brake: 'none' | 'soon' | 'now' };
export type Pilot = (c: Craft, s: LandingSetup) => Controls;
export const carefulPilot: Pilot;                                    // turns toward advise().angle, uses its throttle
export function laggedPilot(lagSeconds: number): Pilot;
export function flyLanding(s: LandingSetup, pilot: Pilot): { landed: boolean; why: ReturnType<typeof judge>; speed: number; fuelLeft: number };
```

**Rules.** Start: 260 m up, moving right at 22 m/s, falling at 4 m/s, nose up. Gravity 1.62, thrust 6.5 m/s² at full throttle, turn rate 140°/s. Safe: down ≤ lerp(6, 4.5, landing difficulty), sideways ≤ 3, tilt ≤ 15°. Highlands: down limit ×0.8, rocks up to 8 m high everywhere except a flat pad 60 m wide centred 150 m downrange; both legs (±4 m) must be on the pad. `stepCraft` takes fixed 1/60 s steps, at most 0.1 s per call, stops on the ground. `advise` is the teaching brain: wanted sideways acceleration cancels sideways speed (and on the highlands steers to the pad); wanted downward speed follows the cautious curve of the old landing; the arrow is the direction of the wanted thrust; `step` is 0 cancel sideways, 1 turn upright, 2 brake, 3 touch down. Fuel = margin × the fuel `carefulPilot` uses on that setup with a bottomless tank (memoised), with today's margins (`marginLight` 2.0, `marginHeavy` 1.5, `marginFloor` 1.4, retry ×0.8, floor 1.25). `hopeless`: tank empty and the fall alone is too fast, or full upright thrust from here still arrives too fast.

- [ ] Tests (robot pilots use only `Controls`): careful pilot lands every flyable build on the plain first try with rough marks; lands the basic build on the highlands pad; slow hands (0.4 s) land the basic build on the plain within two tries; never touching anything fails both tries; landing off the pad on the highlands is `rocks`; touching down tilted is `tilted`, drifting is `sideways`; lighter ship has more fuel, second try less, heaviest keeps the floor; a 5 s step equals a 0.1 s step; `hopeless` is false at the start and for the careful pilot all the way down, true low and fast; same inputs give the same result.
- [ ] Implement. Tune numbers in `FLIGHT`, never the tests. Commit `feat: landing rules with steering`.

---

### Task 3: The landing on screen

**Files:** Create `src/three/landerview.ts`. Modify `src/three/flight.ts`, `src/ui/flyhud.ts`, `src/feel.css`, `scripts/e2e.cjs`.

**Produces:**
- `flyhud.ts`: `howTo(layer, title, steps, warnings, onStart)`, `coach(layer, steps) → { set(active: number) }`, `controlStrip(layer, controls: FlyControls)`, `craftMarks(layer) → { set({ sx, sy, side, down, sideOk, downState, guide, angle, show }) }`, `landingHud` reworked to fuel, height and throttle. DOM contract: `.howto .btn.start`, `.coach li.on`, `.strip .ctl[data-ctl]`, `.speed-side`, `.speed-down`.
- `landerview.ts`: `class LanderView { scene; camera; constructor(tags: string[], whole: boolean); setup(s: LandingSetup); update(c: Craft, firing: boolean, throttle: number, impactX: number | null); screenOf(c: Craft, w, h): { x, y }; dust(); boom() }`. Flat grey ground, black sky with Earth, the built lander (or the whole ship on the direct route), rocks and a green pad on the highlands, a ring where it will come down. The camera follows the lander and shows `clamp(height × 1.25 + 45, 60, 360)` metres top to bottom.
- `flight.ts`: the landing step becomes undock (watched) → `howTo` card (waits) → descent flown with `FlyControls` and `stepCraft` → `hopeless` or a bad first touchdown aborts and climbs to a second try → result. `window.__game.fly = { moment: 'landing', x, y, vx, vy, angle, fuel, try, advise }`.

- [ ] Browser checks: autopilot flight lands; a keyboard pilot that turns toward `advise.angle` and holds Space when `advise.engine` lands by hand on the first try; pressing Start and nothing else aborts once and is lost on the second try; at 390 px the on-screen buttons fit and holding ENGINE burns fuel.
- [ ] Implement. Run tests and the browser checks. Commit `feat: fly the landing with steering`. **The game is playable here: tell the user.**

---

### Task 4: Liftoff rules

**Files:** Modify `src/sim/flight.ts`, `tests/flight.test.ts`.

**Produces:**

```ts
export interface AscentSetup { twr: number; burn1: number; targetY: number; gravity: number; turnRate: number; warnings: string[] }
export interface Ascent { x: number; y: number; vx: number; vy: number; angle: number; stage: 1 | 2; fuel1: number; t: number; err: number; n: number; dry: number; guided: boolean; idle: number }
export function liftoffSetup(ch, t, events): AscentSetup;                  // replaces today's
export function guideAngle(s: AscentSetup, y: number): number;             // 0 at the pad, 60° at targetY
export function startAscent(s: AscentSetup): Ascent;
export function stepAscent(a: Ascent, ctl: Controls, restage: boolean, elapsed: number, s: AscentSetup): Ascent;
export function ascentDone(a: Ascent, s: AscentSetup): boolean;
export function gradeAscent(a: Ascent, s: AscentSetup): Mark;
export const ascentPilot: (a: Ascent, s: AscentSetup) => { ctl: Controls; restage: boolean };
```

**Rules.** Thrust = `twr` × gravity; `twr` runs from 1.6 (lightest) to 1.15 (at the mass limit) and is under 1 over the limit, so that rocket never lifts. Stage one burns for `burn1` seconds of engine time, then the engine is dead until `restage` (a fresh press of the engine). `err` and `n` accumulate the angle away from the guide while burning; `dry` counts seconds between running dry and the relight. Guidance takes over (`guided = true`, the pilot is `ascentPilot`) if the rocket is more than 50° off the guide below a third of `targetY`, starts falling, or nobody has touched a control for 6 s. Grade: guided or mean error over 20° or `dry` over 4 s is rough; mean error under 8° and `dry` under 1.5 s is clean; else fair.

- [ ] Tests: the ascent pilot is clean on every flyable build; a heavier build takes longer; an overweight build has `twr < 1` and never rises; holding the engine and never turning is not clean; never touching anything is guided and rough; a late relight is fair or rough; a 5 s step equals a 0.1 s step.
- [ ] Implement. Commit `feat: liftoff rules with steering`.

---

### Task 5: The liftoff on screen

**Files:** Modify `src/main.ts` (`flyLiftoff`), `src/three/backdrop.ts`, `src/ui/flyhud.ts`, `scripts/e2e.cjs`.

**Produces:** `Backdrop.poseRocket(x: number, y: number, angle: number, burning: boolean, sky: number): void` (pad-scene units; the camera follows; `sky` 0..1 darkens it) and `Backdrop.endPose(): void`. `flyLiftoff` shows the `howTo` card, then flies with `FlyControls` and `stepAscent`: guide arrow on the rocket, height against the target, a stage-one fuel bar, the coach ("Hold the engine", "Follow the arrow", "Stage empty: press the engine again", "Hold the arrow to space"). A rocket that cannot lift shows "Too heavy to lift" after 4 s and goes on to the existing failure. `window.__game.fly = { moment: 'liftoff', y, targetY, angle, guide, stage, dry }`.

- [ ] Browser checks: keyboard pilot following `guide` and relighting at once gets "Clean liftoff"; Start and nothing else ends guided; the overweight rocket fails on the pad.
- [ ] Implement. Commit `feat: fly the liftoff with steering`. **Playable: tell the user.**

---

### Task 6: The orbit burn

**Files:** Modify `src/sim/flight.ts`, `tests/flight.test.ts`, `src/three/flight.ts`, `scripts/e2e.cjs`.

**Produces:**

```ts
export interface OrbitSetup { speed0: number; lo: number; hi: number; window: number; decel: number; turnRate: number; warnings: string[] }
export interface OrbitBurn { speed: number; angle: number; t: number; burnt: number }   // angle: 0 = nose first (prograde); π = backwards
export function orbitSetup(ch, t, events): OrbitSetup;
export function stepOrbit(o: OrbitBurn, ctl: Controls, elapsed: number, s: OrbitSetup): OrbitBurn;   // speed falls by decel × throttle × cos(angle off backwards)
export function gradeOrbit(o: OrbitBurn, s: OrbitSetup): Mark;
export const orbitPilot: (o: OrbitBurn, s: OrbitSetup) => Controls;
```

**Rules.** Arrive at 2,400, band 1,600–1,700 (narrower with difficulty: half-width lerp(50, 25)), `decel` 160 per second at full throttle, 20 s window. Clean: inside the band when the window closes or when the player stops the engine inside it and stays there. Fair: within one band-width outside. Rough: further, or the window closed before any burn (the ship then burns by itself).

- [ ] Tests: the orbit pilot is clean; burning nose-first speeds the ship up; never touching anything is rough; overshooting is fair then rough.
- [ ] `flight.ts`: the orbit step turns the ship with the controls, shows the guide arrow, the speed with its band, and the time bar. Browser checks: keyboard pilot is clean; Start and nothing else is rough.
- [ ] Commit `feat: fly the orbit burn with steering`. **Playable: tell the user.**

---

### Task 7: Clean up and check

- [ ] Delete `src/ui/flyinput.ts`, its test, and any one-button code left over. Update the README, `scripts/record.cjs` and the title's small print.
- [ ] `npx tsc --noEmit && npm test && npm run build`, then the full browser script.
- [ ] Record a demo with sound. Commit.

---

## What changed while building (13 November 2026)

- **Three rules files, not one.** The landing is `src/sim/landing.ts`, the liftoff `src/sim/ascent.ts`, the orbit burn `src/sim/orbit.ts`. `src/sim/flight.ts` keeps only what they share: difficulty, warnings, fuel margins.
- **The craft settles onto the guide arrow.** Let go of the turn keys within about 15 degrees of the arrow and the craft turns the rest of the way by itself. Without it, lining up needed fiddly taps and slow hands overshot. It applies in all three moments.
- **Turn rates were lowered** for control: 120 degrees a second for the lander, 60 for the rocket, 100 for the ship at the Moon.
- **Slow hands are modelled differently.** The slow test pilot decides late (where to point, whether to burn) but can see its own craft turning, so it stops a turn on time. A pure delay on everything made any pilot oscillate, which is not how a person flies.
- **Two landing pilots.** `carefulPilot` uses the throttle smoothly and is the autopilot and the fuel yardstick. `simplePilot` flies engine on, engine off at full throttle, the way most players will. Both must land every flyable rocket.
- **The first try aborts on a simple test:** tank empty and falling too fast, or full upright thrust from here still arrives too fast. It is not an exact point of no return.
- **Staging is let go, press again.** No extra key. Holding the engine through an empty stage does nothing; after five seconds of that, guidance takes over.
- **The first stage does not visibly fall away** at liftoff. The flame dies and relights; the model stays whole.
- **The orbit burn ends early** once the ship has sat inside the band with the engine off for 1.2 seconds, so a good burn is not followed by a long wait.
- **`?practice=landing`** goes straight to the landing and back to it every time. It was not in the plan; it is there so the feel can be tried quickly.
- **The landing readout, coach and control strip replace the top prompt.** The old "Hold SPACE" prompts and the press-anywhere input are gone, with `src/ui/flyinput.ts`.
