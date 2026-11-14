# Space Bar: Build It and Fly It — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace nine of the twelve decision screens with a build screen and three space-bar flying moments, as the design describes.

**Architecture:** The player's choices stay in the existing `Decisions` map (question id → option id), so totals, the 3D rocket, lessons and share links keep working. A new pure module, `src/sim/flight.ts`, holds every flying rule. `simulate()` takes the flying results as a second argument and no longer rolls dice for the three flown phases. The pad liftoff is flown in the existing backdrop scene; orbit and landing are flown in the flight scene, which changes from a fixed timeline to a step-by-step sequence.

**Tech Stack:** TypeScript 7, Vite 8, three.js 0.187, Vitest 5. Playwright-core (dev only) for the end-to-end script.

**Spec:** `docs/2026-11-09-build-and-fly-design.md`. Read it first.

## Global Constraints

- No new runtime libraries. `playwright-core` is added as a dev dependency only.
- The flight uses the rocket and lander models from `src/three/ship.ts` (`buildStack`, `buildShip`).
- Choices are stored as `Decisions`; nothing else records the build.
- Flying rules live in `src/sim/flight.ts` with no DOM and no three.js imports. Same build, seed and inputs give the same result.
- One input for flying: the space bar, or pressing anywhere on the flying layer with mouse or finger.
- Layout works at 390 px wide and at 1280×720.
- Space never skips anything. Esc skips watched parts only.
- `?quick=1` and reduced-motion players get the autopilot unless the URL has `?fly=1` or they press "Fly it myself".
- All sound comes from `src/ui/audio.ts` (`sfx`, `FlightAudio`).
- Player-facing text is plain English in the game's existing voice. No em dashes in new copy.
- Node is not installed system-wide on this machine yet. Until it is, start every shell with:
  `export PATH="/c/Users/lamy4/AppData/Local/Temp/claude/a779bb8940cd5b4d/e94a2711-dc64-402b-9b15-171238f66716/scratchpad/rttm/venv/Scripts:$PATH"`
- Commit messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- After every task: `npx tsc --noEmit` is clean and `npm test` passes.

## Review Focus

1. **The flight ends before the landing site is picked** (overweight at liftoff, a failure on the coast). The newspaper, the report's "Who chose what", the history comparison and the share link must render with no `sci-site` answer. Pinned in Task 4 (`answered`).
2. **The player fits a docking system, then swaps to the lander that never docks.** The docking choice must be removed, not left hidden and still costing mass. Pinned in Task 4 (`setPart`).
3. **The tab freezes or loses focus mid-landing** (alt-tab, a slow frame). The lander must not fall through the ground or burn its fuel in one jump, and a held key must not stay "held" after focus is lost. Pinned in Task 2 (`advance`) and Task 5 (`HoldInput`).
4. **Keyboard auto-repeat and stray taps.** A held space bar fires `keydown` many times; a tap shorter than the ignition hold must cancel cleanly, and a second tap at the Moon must not count twice. Pinned in Task 5 and Task 7.
5. **Old saved data.** Share links, the leaderboard and saved lessons made before this change mention questions that no longer exist. They must load without errors. Pinned in Task 4.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/sim/types.ts` | modify | `Question.kind`, `slot`, `Option.part`, `Cause` gains `'piloting'`, flying result types |
| `src/data/questions.ts` | modify | kinds and slots, votes removed, live TV folded in, one conflict removed |
| `src/data/story.ts`, `history.ts`, `validate.ts`, `endings.ts` | modify | orders, vote scenes removed, new ending and front page |
| `src/sim/flight.ts` | create | every flying rule and number |
| `src/sim/simulate.ts` | modify | flown phases take results, not dice |
| `src/game/session.ts` | modify | build helpers, interruptions, `peek`, `finishFlight`, retry keeps parts |
| `src/ui/flyinput.ts` | create | the one hold/tap input |
| `src/ui/flyhud.ts` | create | DOM overlays for the three moments and the site pick |
| `src/ui/gauges.ts` | modify | Landing fuel gauge |
| `src/main.ts` | modify | build screen, new flow, liftoff moment, poll, report |
| `src/three/backdrop.ts` | modify | `abortLiftoff()` |
| `src/three/cutscene.ts` → `src/three/flight.ts` | rename, rewrite | flight scene as a sequence with two flown moments |
| `src/feel.css` | modify | build screen and flying overlays |
| `tests/flight.test.ts`, `tests/session.test.ts`, `tests/flyinput.test.ts` | create | |
| `tests/sim.test.ts`, `tests/balance.test.ts` | modify | |
| `scripts/e2e.cjs` | rewrite | plays the new flow in system Chrome |

---

### Task 0: Version control

**Files:** none changed.

- [ ] **Step 1:** In `C:\Users\lamy4\Downloads\space-bar`, run `git init`, check `.gitignore` lists `node_modules` and `dist`, then `git add -A` and commit as `chore: baseline before build-and-fly`.
- [ ] **Step 2:** Run `npx tsc --noEmit && npm test`. Expected: clean, 19 tests pass.

---

### Task 1: Content model

**Files:**
- Modify: `src/sim/types.ts`, `src/data/questions.ts`, `src/data/story.ts`, `src/data/history.ts`, `src/data/validate.ts`, `src/game/session.ts:57`
- Test: `tests/sim.test.ts`

**Interfaces — Produces:**
- `Question.kind: 'story' | 'part' | 'flight'`; `Question.slot?: string`; `Option.part?: string`
- `story.ts`: `storyOrder = ['mgr-funding', 'mgr-schedule']`, `slotOrder = ['nav-route', 'eng-docking', 'eng-power', 'sci-antenna', 'sci-instruments', 'nav-disposal']`, `CABIN = 'eng-cabin'`, `SITE = 'sci-site'`. `sceneOrder` stays for now, listing the ten remaining ids.

- [ ] **Step 1: Write the failing tests** in `tests/sim.test.ts`, under `describe('content')`:

```ts
it('has three story decisions, six parts and one flight pick', () => {
  const kinds = (k: string) => questions.filter((q) => q.kind === k).map((q) => q.id).sort();
  expect(kinds('story')).toEqual(['eng-cabin', 'mgr-funding', 'mgr-schedule']);
  expect(kinds('part')).toEqual(['eng-docking', 'eng-power', 'nav-disposal', 'nav-route', 'sci-antenna', 'sci-instruments']);
  expect(kinds('flight')).toEqual(['sci-site']);
  expect(questions.filter((q) => q.kind === 'part').every((q) => !!q.slot)).toBe(true);
});
it('live TV carries the broadcast', () => {
  const full = questions.find((q) => q.id === 'sci-instruments')!.options.find((o) => o.id === 'full')!;
  expect(full.tags).toContain('livestream'); expect(full.effects.trust).toBe(2);
});
it('no rule punishes docking on the route that never docks', () => {
  expect(conflicts.map((c) => c.id)).toEqual(['lor-docking', 'eor-docking', 'data-link', 'rush-payload']);
});
```

Also remove `'vote-livestream'` and `'vote-bold'` from the `SAFE` decisions.

- [ ] **Step 2:** Run `npm test`. Expected: the three new tests fail.
- [ ] **Step 3: Change the content.**
  - `types.ts`: `kind` becomes `'story' | 'part' | 'flight'`; add `slot?: string` to `Question` and `part?: string` to `Option`.
  - `questions.ts`: set `kind` and `slot` as in the test. Slots: `nav-route` "Lander", `eng-docking` "Docking", `eng-power` "Power", `sci-antenna` "Antenna", `sci-instruments` "Science", `nav-disposal` "Spent stage". Delete both vote questions. `sci-instruments/full` gains `trust: 2` and tag `'livestream'`. Delete the `direct-docking` conflict. Part names: `nav-route` direct "One giant lander", eor "Giant lander, built in orbit", lor "Small separate lander"; `nav-disposal` leave "Nothing: leave it in orbit", deorbit "Deorbit motors", solar "Slingshot kit".
  - `story.ts`: add the four exports above; delete the `vote-bold` and `vote-livestream` scenes; `sceneOrder` drops the two votes.
  - `history.ts`: delete the two vote entries from `optionByQuestion` and `notes`.
  - `validate.ts`: replace the crew/vote rule with "a `part` question must have a `slot`".
  - `session.ts`: `run.livestream` becomes `outcome.totals.tags.includes('livestream')` (compute after `simulate`).
- [ ] **Step 4:** Run `npx tsc --noEmit && npm test`. If the balance test's viable-share bounds fail, leave them for Task 3 and mark that test `it.skip` with a comment naming Task 3.
- [ ] **Step 5:** Commit `feat: content model for parts, story and flight pick`.

---

### Task 2: Flying rules

**Files:**
- Create: `src/sim/flight.ts`
- Modify: `src/sim/types.ts`
- Test: `tests/flight.test.ts`

**Interfaces — Produces** (types go in `types.ts`, everything else in `flight.ts`):

```ts
// types.ts
export type Mark = 'clean' | 'fair' | 'rough';
export type Site = 'flat' | 'rough';
export interface LandingResult { landed: boolean; tries: 1 | 2; site: Site; speed: number; fuelLeft: number } // fuelLeft 0..1
export interface FlownResult { liftoff?: Mark; orbit?: Mark; landing?: LandingResult }
export const FLOWN: Phase[] = ['launch', 'orbit', 'landing'];

// flight.ts
export const FLIGHT = {
  burn: 6, zoneWide: 0.20, zoneNarrow: 0.10, zoneEnd: 0.96, igniteHold: 1.0, idleIgnite: 5,
  approach: 5, windowWide: 0.5, windowNarrow: 0.25,
  loss: { clean: 0, fair: 0.04, rough: 0.08 },
  h0: 300, v0: 10, gravity: 1.62, thrust: 5,
  marginLight: 2.0, marginHeavy: 1.45, marginFloor: 1.25, lightMass: 24,
  retryFuel: 0.8, retryFloor: 1.1,
  vSafeEasy: 6, vSafeHard: 4.5, roughSite: 0.7,
  dt: 1 / 60, maxElapsed: 0.1, diffSpan: 0.25,
} as const;
export interface LiftoffSetup { burn: number; zoneStart: number; zoneEnd: number; warnings: string[] } // seconds
export interface OrbitSetup { approach: number; window: number; warnings: string[] }                  // seconds
export interface LandingSetup { fuel: number; vSafe: number; h0: number; v0: number; warnings: string[] } // fuel = seconds of burn
export interface LanderState { h: number; v: number; fuel: number; t: number }                         // v positive = falling
export type Pilot = (s: LanderState, setup: LandingSetup) => boolean;

export function difficulty(ch: Chapter, t: Totals, events: GameEvent[], phase: Phase): number;  // 0..1
export function liftoffSetup(ch: Chapter, t: Totals, events: GameEvent[]): LiftoffSetup;
export function orbitSetup(ch: Chapter, t: Totals, events: GameEvent[]): OrbitSetup;
export function landingSetup(ch: Chapter, t: Totals, events: GameEvent[], marks: { liftoff: Mark; orbit: Mark }, site: Site, attempt: 1 | 2): LandingSetup;
export function landingFuelPreview(ch: Chapter, t: Totals): number;                             // 0..1 for the build gauge
export function gradeLiftoff(setup: LiftoffSetup, releaseAt: number): Mark;                     // releaseAt = seconds of burn; burn = ran dry
export function gradeOrbit(setup: OrbitSetup, error: number | null): Mark;                      // seconds from the marker; null = never tapped
export function minBurn(vSafe: number): number;
export function startLander(setup: LandingSetup): LanderState;
export function advance(s: LanderState, firing: boolean, elapsed: number, setup: LandingSetup): LanderState;
export function touchedDown(s: LanderState): boolean;                                           // h <= 0
export function doomed(s: LanderState, setup: LandingSetup): boolean;                           // no input can still land safely
export function runTry(setup: LandingSetup, pilot: Pilot): { landed: boolean; speed: number; fuelLeft: number };
export const simplePilot: Pilot;
export function laggedPilot(lagSeconds: number): Pilot;
export const AUTOPILOT: { liftoff: Mark; orbit: Mark } = { liftoff: 'fair', orbit: 'fair' };
```

**The rules the signatures do not determine:**

- `difficulty` = clamp 0..1 of `(failProbability(ch, t, phase, eventStress(events, t.tags)[phase].hardware) - 0.005) / FLIGHT.diffSpan`.
- Liftoff zone width = `lerp(zoneWide, zoneNarrow, difficulty('launch')) * burn`; `zoneEnd = FLIGHT.zoneEnd * burn`; `zoneStart = zoneEnd - width`. Inside the zone is clean. Up to one zone-width before `zoneStart`, or after `zoneEnd`, is fair. Earlier is rough.
- Orbit window = `lerp(windowWide, windowNarrow, difficulty('orbit'))`. `|error| <= window` clean, `<= 2 * window` fair, otherwise or `null` rough.
- `warnings` = headlines of events that put hardware stress on that phase and are not mitigated by the build's tags.
- `vSafe = lerp(vSafeEasy, vSafeHard, difficulty('landing')) * (site === 'rough' ? roughSite : 1)`.
- `minBurn(vs)`: with `g = gravity`, `a = thrust`: `hb = (v0² + 2·g·h0 − vs²) / (2·a)`, `vb = sqrt(v0² + 2·g·(h0 − hb))`, result `(vb − vs) / (a − g)`.
- Landing margin: `massFrac` = clamp 0..1 of `(t.mass − lightMass) / (t.capacity − lightMass)`; `margin = max(marginFloor, lerp(marginLight, marginHeavy, massFrac) * (1 − loss[liftoff] − loss[orbit]))`. On attempt 2: `max(retryFloor, margin * retryFuel)`. `fuel = margin * minBurn(vSafe)`.
- `landingFuelPreview` = clamp 0..1 of `(lerp(marginLight, marginHeavy, massFrac) − 1) / (marginLight − 1)`.
- `advance` takes fixed steps of `FLIGHT.dt`, never more than `FLIGHT.maxElapsed` seconds per call, and stops at `h <= 0`. Firing with fuel left: `v += (g − a)·dt`, `fuel −= dt`. Otherwise `v += g·dt`. Then `h −= v·dt`.
- `doomed`: run the state forward with the engine always on. If `v` reaches 0 or less before the ground, not doomed. If it touches down at `v <= vSafe`, not doomed. Otherwise doomed.
- `runTry` flies from `startLander` with the pilot until touchdown; `landed = speed <= vSafe`.
- The test pilots:

```ts
export const simplePilot: Pilot = (s, setup) =>
  s.v > Math.sqrt(2 * 0.7 * (FLIGHT.thrust - FLIGHT.gravity) * Math.max(0, s.h)) + 0.5 * setup.vSafe;
// laggedPilot(lag) answers with what simplePilot said `lag` seconds of flight time ago.
```

- [ ] **Step 1: Write the failing tests** in `tests/flight.test.ts`. `BASIC` is the lightest sensible build: `{ 'mgr-funding': 'modest', 'mgr-schedule': 'steady', 'eng-cabin': 'fix', 'nav-route': 'lor', 'eng-docking': 'basic', 'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave' }`. `totalsOf(d)` is `computeTotals(chapter, questions, conflicts, d)`.

```ts
it('grades the liftoff release', () => {
  const s = liftoffSetup(chapter, totalsOf(BASIC), []);
  expect(s.zoneEnd).toBeCloseTo(5.76, 2);
  expect(gradeLiftoff(s, (s.zoneStart + s.zoneEnd) / 2)).toBe('clean');
  expect(gradeLiftoff(s, s.zoneStart - 0.3)).toBe('fair');
  expect(gradeLiftoff(s, 1.5)).toBe('rough');
  expect(gradeLiftoff(s, s.burn)).toBe('fair');           // ran dry
});
it('grades the orbit tap', () => {
  const s = orbitSetup(chapter, totalsOf(BASIC), []);
  expect(gradeOrbit(s, s.window * 0.5)).toBe('clean');
  expect(gradeOrbit(s, -s.window * 1.5)).toBe('fair');
  expect(gradeOrbit(s, s.window * 3)).toBe('rough');
  expect(gradeOrbit(s, null)).toBe('rough');
});
it('a riskier build narrows the windows', () => {
  const risky = totalsOf({ ...BASIC, 'mgr-schedule': 'rush', 'eng-cabin': 'test' });
  expect(liftoffSetup(chapter, risky, []).zoneStart).toBeGreaterThan(liftoffSetup(chapter, totalsOf(BASIC), []).zoneStart);
  expect(orbitSetup(chapter, risky, []).window).toBeLessThan(orbitSetup(chapter, totalsOf(BASIC), []).window);
});
it('knows the least fuel a clean landing needs', () => expect(minBurn(6)).toBeCloseTo(6.25, 1));
it('a lighter ship has more landing fuel, and the worst case keeps a quarter spare', () => {
  const marks = { liftoff: 'rough', orbit: 'rough' } as const;
  const light = landingSetup(chapter, totalsOf(BASIC), [], marks, 'flat', 1);
  const heavy = landingSetup(chapter, totalsOf({ ...BASIC, 'nav-route': 'direct', 'eng-power': 'extra', 'sci-antenna': 'large' }), [], marks, 'flat', 1);
  expect(light.fuel).toBeGreaterThan(heavy.fuel);
  expect(heavy.fuel).toBeGreaterThanOrEqual(FLIGHT.marginFloor * minBurn(heavy.vSafe) - 1e-9);
});
it('the highlands need a gentler touchdown', () => {
  const m = { liftoff: 'clean', orbit: 'clean' } as const;
  expect(landingSetup(chapter, totalsOf(BASIC), [], m, 'rough', 1).vSafe).toBeLessThan(landingSetup(chapter, totalsOf(BASIC), [], m, 'flat', 1).vSafe);
});
it('the simple pilot lands every rocket that can fly, on the plain, first try', () => {
  for (const d of everyBuild()) {                         // story × parts, generator like tests/balance.test.ts, without sci-site
    const t = totalsOf(d); if (t.mass > t.capacity) continue;
    const setup = landingSetup(chapter, t, [], { liftoff: 'rough', orbit: 'rough' }, 'flat', 1);
    expect(runTry(setup, simplePilot).landed, JSON.stringify(d)).toBe(true);
  }
});
it('a clumsy pilot lands the basic build within two tries', () => {
  const m = { liftoff: 'fair', orbit: 'fair' } as const, t = totalsOf(BASIC);
  const ok = runTry(landingSetup(chapter, t, [], m, 'flat', 1), laggedPilot(0.4)).landed
    || runTry(landingSetup(chapter, t, [], m, 'flat', 2), laggedPilot(0.4)).landed;
  expect(ok).toBe(true);
});
it('a pilot who never fires loses both tries', () => {
  const m = { liftoff: 'fair', orbit: 'fair' } as const, t = totalsOf(BASIC), idle = () => false;
  expect(runTry(landingSetup(chapter, t, [], m, 'flat', 1), idle).landed).toBe(false);
  expect(runTry(landingSetup(chapter, t, [], m, 'flat', 2), idle).landed).toBe(false);
});
it('is the same every time', () => {
  const s = landingSetup(chapter, totalsOf(BASIC), [], { liftoff: 'fair', orbit: 'fair' }, 'flat', 1);
  expect(runTry(s, simplePilot)).toEqual(runTry(s, simplePilot));
});
it('a frozen tab cannot throw the lander through the ground', () => {
  const s = landingSetup(chapter, totalsOf(BASIC), [], { liftoff: 'fair', orbit: 'fair' }, 'flat', 1), a = startLander(s);
  expect(advance(a, false, 5, s)).toEqual(advance(a, false, FLIGHT.maxElapsed, s));
  expect(advance(a, true, 5, s).fuel).toBeGreaterThan(s.fuel - FLIGHT.maxElapsed - 1e-9);
});
it('knows when a landing can no longer be saved', () => {
  const s = landingSetup(chapter, totalsOf(BASIC), [], { liftoff: 'fair', orbit: 'fair' }, 'flat', 1);
  expect(doomed(startLander(s), s)).toBe(false);
  expect(doomed({ h: 5, v: 30, fuel: s.fuel, t: 0 }, s)).toBe(true);
  expect(doomed({ h: 200, v: 20, fuel: 0, t: 0 }, s)).toBe(true);
});
```

- [ ] **Step 2:** Run `npx vitest run tests/flight.test.ts`. Expected: fails, module not found.
- [ ] **Step 3:** Implement `src/sim/flight.ts` and the types to the signatures and rules above.
- [ ] **Step 4:** Run the tests. If a pilot test fails, change numbers in `FLIGHT` (start with `marginHeavy`, `marginFloor`, `retryFloor`), never the tests. Expected: all pass.
- [ ] **Step 5:** Commit `feat: flying rules`.

---

### Task 3: The simulation takes flying results

**Files:**
- Modify: `src/sim/simulate.ts`, `src/sim/types.ts`
- Test: `tests/sim.test.ts`, `tests/balance.test.ts`

**Interfaces:**
- Consumes: `FlownResult`, `FLOWN`, `Mark` (Task 2).
- Produces:
  - `Cause` gains `'piloting'`. `PhaseResult` gains `flown?: Mark | LandingResult`. `Outcome` gains `flown: FlownResult`.
  - `simulate(inp: SimInput, flown: FlownResult = {}): Outcome`
  - `siteOverloadsLink(ch: Chapter, t: Totals, events: GameEvent[], o: Option): boolean` — `t` is the totals with no site chosen.
  - `survivalChance` multiplies over `coast` and `return` only.

**Rules:** Physical checks run in every phase exactly as today. In a flown phase there is no dice roll: `roll` stays `null`, `failProb` keeps its value (it now means difficulty), and the phase passes unless it is `landing` and `flown.landing.landed === false`, which fails with cause `'piloting'`. A flown phase with no result yet counts as passed. `coast` and `return` roll as today with the same seeds.

- [ ] **Step 1: Write the failing tests** in `tests/sim.test.ts`:

```ts
it('does not roll dice in the flown phases', () => {
  for (let seed = 0; seed < 300; seed++) {
    const o = base(SAFE, seed);
    for (const p of o.phases.filter((p) => ['launch', 'orbit', 'landing'].includes(p.phase))) expect(p.roll).toBeNull();
    if (!o.success) expect(['coast', 'return']).toContain(o.failedPhase);
  }
});
it('a lost landing fails the mission as piloting', () => {
  const landing = { landed: false, tries: 2, site: 'flat', speed: 14, fuelLeft: 0 } as const;
  const seed = [...Array(300).keys()].find((s) => base(SAFE, s).success)!;
  const o = simulate({ chapter, questions, conflicts, decisions: SAFE, seed, events: [] }, { liftoff: 'clean', orbit: 'clean', landing });
  expect(o.failedPhase).toBe('landing'); expect(o.cause).toBe('piloting'); expect(o.flown.landing).toEqual(landing);
});
it('flying cannot save a rocket that is too heavy', () => {
  const heavy = { ...SAFE, 'nav-route': 'direct', 'eng-power': 'extra', 'sci-instruments': 'full', 'sci-antenna': 'large', 'eng-cabin': 'redesign' };
  const o = simulate({ chapter, questions, conflicts, decisions: heavy, seed: 1, events: [] }, { liftoff: 'clean' });
  expect(o.failedPhase).toBe('launch'); expect(o.cause).toBe('mass');
});
it('survival covers only the coast and the trip home', () => {
  const t = computeTotals(chapter, questions, conflicts, SAFE);
  const want = (1 - failProbability(chapter, t, 'coast', 0)) * (1 - failProbability(chapter, t, 'return', 0));
  expect(survivalChance(chapter, t, [])).toBeCloseTo(want, 9);
});
it('locks the highlands when the antenna cannot carry them', () => {
  const rough = questions.find((q) => q.id === 'sci-site')!.options.find((o) => o.id === 'rough')!;
  const { 'sci-site': _s, ...noSite } = SAFE;
  const t = computeTotals(chapter, questions, conflicts, { ...noSite, 'sci-instruments': 'basic', 'sci-antenna': 'small' }); // data 3, link 4
  const storm = { ...events[0], stress: [{ phase: 'landing', kind: 'comms', amount: 1 }], mitigatedBy: [] } as typeof events[0];   // link 3
  expect(siteOverloadsLink(chapter, t, [], rough)).toBe(false);     // 4 of 4 still fits
  expect(siteOverloadsLink(chapter, t, [storm], rough)).toBe(true); // 4 of 3 does not
});
```

With today's parts the highlands only overload the link when a news event has weakened it, so the lock is rare. It still has to exist.

If the heavy build in the third test is not over capacity, pick the heaviest design the balance test prints and use that.

- [ ] **Step 2:** Run `npm test`. Expected: new tests fail.
- [ ] **Step 3:** Change `simulate`, `survivalChance` and the types; add `siteOverloadsLink`.
- [ ] **Step 4: Rewrite `tests/balance.test.ts`.** Designs run over `story` and `part` questions with `sci-site` fixed to `flat`. "Viable" keeps its meaning (no physical check fails). Keep the three tests. Un-skip anything Task 1 skipped. If the viable share lands outside 0.25–0.9, adjust the bounds to bracket the new share by at least 0.1 each side and record the measured share in a comment.
- [ ] **Step 5:** Run `npx tsc --noEmit && npm test`. Expected: all pass.
- [ ] **Step 6:** Commit `feat: simulation takes flying results`.

---

### Task 4: Session, the new ending, and the build rules

**Files:**
- Modify: `src/game/session.ts`, `src/data/endings.ts`, `src/data/story.ts`, `src/main.ts` (one call site)
- Test: `tests/session.test.ts` (create)

**Interfaces:**
- Consumes: `simulate(inp, flown)`, `storyOrder`, `slotOrder`, `CABIN`, `SITE`.
- Produces in `session.ts`:

```ts
export interface Run { /* existing fields */ fired: number }            // interruptions shown so far, 0..3
export function slotNeeded(qid: string, tags: string[]): boolean;        // false only for 'eng-docking' with 'route-direct'
export function neededSlots(s: Session): string[];
export function setPart(s: Session, qid: string, oid: string): void;     // also deletes 'eng-docking' when the lander never docks
export function filled(s: Session): number;                              // needed slots that have a part
export type Interrupt = { t: 'news'; ev: GameEvent } | { t: 'scene'; qid: string };
export function pendingInterrupt(s: Session, force?: boolean): Interrupt | null;
export function markFired(s: Session): void;
export function isReady(s: Session): boolean;                            // story + cabin answered, needed slots filled, fired === 3
export function progressOf(s: Session): number;                          // 0..1 for the calendar
export function seenEvents(s: Session): GameEvent[];
export function peek(s: Session, flown: FlownResult): Outcome;           // no side effects
export function finishFlight(s: Session, flown: FlownResult): Run;       // replaces launch()
export function answered(decisions: Decisions): { q: Question; opt: Option }[];
```

- `launch()` is removed. `retry()` starts the new run with the previous run's `part` decisions and nothing else.
- Interruptions, in order: first news event, the cabin scene, second news event. Thresholds on `filled`: `[2, 3, max(4, needed − 1)]`. `pendingInterrupt` returns the next one when `filled >= threshold[fired]` or when `force` is true; `null` when all three have fired.
- `endings.ts`: `EndingId` gains `'crash'`; `endingFor('piloting')` returns it; `lessonWatch.piloting = ['route-direct', 'route-eor', 'instruments-full', 'power-extra', 'dish-large']`.

```ts
crash: {
  id: 'crash', title: 'Too fast', headline: 'The landing was too hard',
  because: 'The lander reached the surface faster than its legs could take. The fuel that could have slowed it was already gone.',
  avoid: 'A lighter ship carries more landing fuel. Clean burns at liftoff and at the Moon save fuel for the way down. Start slowing early, and choose the plain until your hands know the way.',
  lessonTag: 'heavy-lander', lessonText: 'Last time the lander came down too fast. A lighter ship and cleaner burns leave more fuel for the landing.',
  lines: [
    { who: 'Houston', text: 'Thirty seconds of fuel.' },
    { who: 'Commander', text: 'Coming down fast. Too fast.' },
    { who: 'Houston', text: 'Abort. Abort.' },
    { who: 'Commander', text: 'No time.' },
    { who: 'Houston', text: '...do you read?' },
  ],
},
```

- `story.ts` `papers.crash`: head `'LOST AT THE SURFACE'`, sub `(c) => \`${c} reached the Moon and could not slow down in time.\``.

- [ ] **Step 1: Write the failing tests** in `tests/session.test.ts`. `fresh()` returns `newSession(seed, false)` for the first `seed` from 1 upward whose first run does not fail on the coast with the `BASIC` build (so a lost landing is what ends it):

```ts
it('the lander that never docks needs no docking, and drops one already fitted', () => {
  const s = fresh(); setPart(s, 'nav-route', 'lor'); setPart(s, 'eng-docking', 'robust');
  expect(neededSlots(s)).toContain('eng-docking');
  setPart(s, 'nav-route', 'direct');
  expect(neededSlots(s)).not.toContain('eng-docking');
  expect(s.current.decisions['eng-docking']).toBeUndefined();
});
it('interrupts the build in order and only once each', () => {
  const s = fresh(); setPart(s, 'nav-route', 'lor');
  expect(pendingInterrupt(s)).toBeNull();
  setPart(s, 'eng-power', 'standard');
  expect(pendingInterrupt(s)).toMatchObject({ t: 'news', ev: s.current.events[0] }); markFired(s);
  expect(pendingInterrupt(s)).toBeNull();
  setPart(s, 'sci-antenna', 'small');
  expect(pendingInterrupt(s)).toEqual({ t: 'scene', qid: 'eng-cabin' }); markFired(s);
  expect(pendingInterrupt(s)).toBeNull();
  expect(pendingInterrupt(s, true)).toMatchObject({ t: 'news', ev: s.current.events[1] }); markFired(s);
  expect(pendingInterrupt(s, true)).toBeNull();
});
it('is ready only when story, parts and interruptions are all done', () => {
  const s = fresh(); build(s, BASIC);                     // helper: answer() story ids, setPart() parts, markFired() x3
  expect(isReady(s)).toBe(true);
  delete s.current.decisions['sci-antenna']; expect(isReady(s)).toBe(false);
});
it('a retry keeps the rocket and nothing else', () => {
  const s = fresh(); build(s, BASIC);
  finishFlight(s, { liftoff: 'fair', orbit: 'fair', landing: { landed: false, tries: 2, site: 'flat', speed: 12, fuelLeft: 0 } });
  retry(s);
  expect(s.current.decisions).toEqual({ 'nav-route': 'lor', 'eng-docking': 'basic', 'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave' });
  expect(s.current.fired).toBe(0);
});
it('a lost landing teaches a piloting lesson and is not livestreamed without live TV', () => {
  const s = fresh(); build(s, BASIC);
  const run = finishFlight(s, { liftoff: 'fair', orbit: 'fair', landing: { landed: false, tries: 2, site: 'flat', speed: 12, fuelLeft: 0 } });
  expect(run.outcome!.cause).toBe('piloting'); expect(run.livestream).toBe(false);
  expect(s.lessons.some((l) => l.cause === 'piloting')).toBe(true);
});
it('peek changes nothing', () => {
  const s = fresh(); build(s, BASIC); const before = JSON.stringify(s);
  peek(s, { liftoff: 'clean' }); expect(JSON.stringify(s)).toBe(before);
});
it('lists only what was actually answered', () => {
  expect(answered({ 'nav-route': 'lor', 'vote-bold': 'bold', 'eng-power': 'nope' }).map((a) => a.q.id)).toEqual(['nav-route']);
});
it('still opens a share link made before the change', () => {
  const old = btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, grade: 'A', score: 80, runs: 2, day: 2000, decisions: { 'vote-bold': 'bold', 'nav-route': 'lor' }, at: 1 }))));
  expect(decodeShare(old)!.decisions['nav-route']).toBe('lor');
});
```

- [ ] **Step 2:** Run `npx vitest run tests/session.test.ts`. Expected: fails.
- [ ] **Step 3:** Implement. In `main.ts`, `doLaunch` calls `finishFlight(s, { liftoff: 'fair', orbit: 'fair', landing: { landed: true, tries: 1, site: 'flat', speed: 3, fuelLeft: 0.3 } })` for now, so the game still plays end to end.
- [ ] **Step 4:** Run `npx tsc --noEmit && npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: session rules for building and flying`.

---

### Task 5: The one input, and the flying overlays

**Files:**
- Create: `src/ui/flyinput.ts`, `src/ui/flyhud.ts`
- Modify: `src/feel.css`
- Test: `tests/flyinput.test.ts`

**Interfaces — Produces:**

```ts
// flyinput.ts — listens for Space on `keys` and pointer presses on `surface`
export class HoldInput {
  constructor(keys: EventTarget, surface: EventTarget, on: { down(): void; up(): void });
  readonly held: boolean;
  dispose(): void;
}
// flyhud.ts — DOM only; every overlay is a child of one `.fly-layer[data-moment]`
export interface Hud { el: HTMLElement; set(v: Record<string, number | string | boolean>): void; remove(): void }
export function flyLayer(host: HTMLElement, moment: 'liftoff' | 'orbit' | 'site' | 'landing', prompt: string, warnings: string[]): HTMLElement;
export function liftoffHud(layer: HTMLElement, s: LiftoffSetup): Hud;   // set({ burnt: seconds, lit: boolean })
export function orbitHud(layer: HTMLElement, s: OrbitSetup): Hud;       // set({ t: seconds since approach began })
export function landingHud(layer: HTMLElement, s: LandingSetup): Hud;   // set({ h, v, fuel, try: 1 | 2 })
export function sitePick(layer: HTMLElement, sites: SiteChoice[], onPick: (id: Site) => void): void;
export function flyNote(layer: HTMLElement, text: string, tone?: 'good' | 'ok' | 'bad'): void;   // "Clean staging", "Abort. One more try."
export function autoLink(layer: HTMLElement, auto: boolean, onToggle: () => void): void;         // .fly-auto
export interface SiteChoice { id: Site; label: string; blurb: string; locked: string | null }
```

**Rules:**
- `HoldInput`: `keydown` with `key === ' '` and `repeat` false, or `pointerdown` on the surface (not on a `button`), calls `down()` once. `keyup` of Space, `pointerup`, `pointercancel`, or `blur` on `keys` calls `up()` once. It calls `preventDefault()` on Space so the page never scrolls.
- DOM contract (the e2e script relies on it): `.fly-layer[data-moment]`, `.fly-prompt`, `.fly-warn` (one per warning), `.fly-auto`, `.fly-note`, `.site[data-site]` with `disabled` and `.site-why` when locked, `.fuelbar .zone`, `.orbit-track .marker`, `.land-readout .speed.safe`.
- Landing readout shows height in m, speed in m/s to one decimal, and a fuel bar. The speed gets class `safe` when `v <= vSafe`.
- Overlays use the existing fonts and the amber and white palette from `feel.css`; text stays readable over the picture at 390 px wide.

- [ ] **Step 1: Write the failing tests** in `tests/flyinput.test.ts` (Node's own `EventTarget` and `Event`; add `key`, `repeat`, `button` with `Object.assign`):

```ts
const ev = (type: string, extra = {}) => Object.assign(new Event(type), { key: ' ', repeat: false, button: 0, target: null }, extra);
it('a held key counts once, however often it repeats', () => {
  const k = new EventTarget(), p = new EventTarget(); let downs = 0, ups = 0;
  const i = new HoldInput(k, p, { down: () => downs++, up: () => ups++ });
  k.dispatchEvent(ev('keydown')); k.dispatchEvent(ev('keydown', { repeat: true })); k.dispatchEvent(ev('keydown'));
  expect(downs).toBe(1); expect(i.held).toBe(true);
  k.dispatchEvent(ev('keyup')); k.dispatchEvent(ev('keyup'));
  expect(ups).toBe(1); expect(i.held).toBe(false);
});
it('losing focus lets go', () => {
  const k = new EventTarget(), p = new EventTarget(); let ups = 0;
  const i = new HoldInput(k, p, { down() {}, up: () => ups++ });
  p.dispatchEvent(ev('pointerdown')); k.dispatchEvent(ev('blur'));
  expect(ups).toBe(1); expect(i.held).toBe(false);
});
it('ignores other keys and stops listening when disposed', () => {
  const k = new EventTarget(), p = new EventTarget(); let downs = 0;
  const i = new HoldInput(k, p, { down: () => downs++, up() {} });
  k.dispatchEvent(ev('keydown', { key: 'a' })); expect(downs).toBe(0);
  i.dispose(); k.dispatchEvent(ev('keydown')); expect(downs).toBe(0);
});
```

- [ ] **Step 2:** Run `npx vitest run tests/flyinput.test.ts`. Expected: fails.
- [ ] **Step 3:** Implement `flyinput.ts`, `flyhud.ts` and the CSS.
- [ ] **Step 4:** Run `npx tsc --noEmit && npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: flying input and overlays`.

---

### Task 6: The build screen and the new flow

**Files:**
- Modify: `src/main.ts`, `src/ui/gauges.ts`, `src/feel.css`, `package.json`
- Rewrite: `scripts/e2e.cjs`

**Interfaces:**
- Consumes: Task 4's session functions; `landingFuelPreview` (Task 2); `slotOrder`, `storyOrder`.
- Produces: screen `'build'` (`body[data-screen="build"]`); DOM contract `.slot[data-q]`, `.part[data-o]`, `.part.fitted`, `.conflict-warn`, `.gauge.fuel`, `.btn.rollout`; `gaugePanel` gains a Landing fuel bar; `window.__game` exposes `s`.

**What to build:**
- Flow: brief → `scene` for each id in `storyOrder` → `build`. In `build`, after each fit call `pendingInterrupt(s)`; if it returns one, show it (`news` or the cabin `scene`), call `markFired`, and return to `build`. The roll-out button calls `pendingInterrupt(s, true)` first and shows that if there is one; with none left and `isReady(s)` it goes to `poll`. It reads "Continue" while interruptions remain and "Roll out to the launch poll" otherwise, and is disabled until every needed slot is filled.
- `scene()` keeps working for the three story decisions (hold to commit). Its "Decision n / total" counts three.
- Layout: the existing `.scene` grid. Left: `stageHit()`. Right: a `.dialog.glass` panel with the six slots in `slotOrder`, the open slot's parts, conflict warnings, the gauges (always open), and the roll-out button. The top bar is `worldBar(forecast(), …)` as in `scene()`.
- Slots other than Lander are disabled until a lander is fitted. Docking shows "Not needed. Nothing docks with this lander." when `slotNeeded` is false.
- A part card shows `o.part ?? o.label`, `o.blurb`, `plainChips(o)`, the first sentence of `q.why`, and any `warningsFor(s, o.tags)` lesson. Hover or focus previews the gauges with `totalsFor(s, { [q.id]: o.id })`.
- Fitting is a click: `setPart`, `bd.setTags`, `bd.jolt()`, `sfx.thud()`, `animateWorld`, the clock note as in `scene()`, and the speaker's `scenes[q.id].react[o.id]` line with their avatar. The newly fitted part gets `.fitted`; clicking another part in the slot swaps it.
- Conflicts: for each id in `totalsFor(s).conflicts`, a `.conflict-warn` with that rule's `message`.
- Calendar: `today()` uses `progressOf(s)`; `seenEvents` comes from the session. Remove `script`, `si`, `buildScript`, `nextStep` and `sceneOrder`.
- `bd.showSite(tags, progressOf(s))`; with no lander yet, `bd.showSite([], 0)` must show the bare rocket (stages, capsule, tower). Check `buildStack(new Set())` gives that and adjust `ship.ts` only if it does not.
- `gauges.ts`: Landing fuel bar from `landingFuelPreview`: note "Comfortable" at 0.5 or more, "Tight" under 0.5, "Very tight" under 0.25; class `warn` and `bad` to match. More is better, so the fill is the value itself.
- `package.json`: `npm i -D playwright-core`; add script `"e2e": "node scripts/e2e.cjs"`.
- `scripts/e2e.cjs`: launch with `{ channel: 'chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }` against `http://localhost:4173/?seed=12345&quick=1`. It fails (exit 1) on any page error or failed assertion.

- [ ] **Step 1: Write the e2e steps** (they fail until the screen exists):
  1. Title → "Take the job" → Begin → answer the two story scenes with the first option → `body[data-screen="build"]`.
  2. `.slot[data-q="eng-power"]` is disabled; `.btn.rollout` is disabled.
  3. Fit `nav-route/lor`, then `eng-docking/basic`: a `.conflict-warn` appears. A news screen follows; continue.
  4. Swap docking to `robust`: no `.conflict-warn`. The cabin scene follows; pick the second option.
  5. Fit `eng-power/standard`, `sci-antenna/small`, `sci-instruments/min`, `nav-disposal/leave`; pass the second news screen.
  6. Swap `nav-route` to `direct`: the docking slot shows "Not needed" and `__game.s.current.decisions['eng-docking']` is undefined. Swap back to `lor` and refit `eng-docking/robust`.
  7. `.btn.rollout` reads "Roll out to the launch poll"; click → `body[data-screen="poll"]`.
  8. Repeat steps 1–2 at a 390×844 viewport: no horizontal scroll (`document.documentElement.scrollWidth <= 390`).
- [ ] **Step 2:** `npm run build`, start `npm run preview` in the background, run `npm run e2e`. Expected: fails at step 1.
- [ ] **Step 3:** Build the screen and the flow.
- [ ] **Step 4:** `npx tsc --noEmit && npm test`, rebuild, `npm run e2e`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: build screen`.

---

### Task 7: Fly the liftoff

**Files:**
- Modify: `src/main.ts` (`doLaunch`), `src/three/backdrop.ts`, `src/three/site.ts` if needed
- Modify: `scripts/e2e.cjs`

**Interfaces:**
- Consumes: `liftoffSetup`, `gradeLiftoff`, `FLIGHT`, `HoldInput`, `flyLayer`, `liftoffHud`, `flyNote`, `autoLink`.
- Produces: `Backdrop.abortLiftoff(): void` (engines off, rocket back on the pad, smoke cleared); `doLaunch` ends by starting the flight scene with `liftoff: Mark`; `window.__game.fly = { moment, burnt, zoneStart, zoneEnd }` while the moment is live; module flag `autoFly` (true when `instant` and the URL has no `fly`).

**What to build:**
- After "Hold to launch" and the "T minus 3, 2, 1" countdown, show the liftoff overlay with the prompt "Hold SPACE to ignite. Let go in the green to drop the stage."
- Press: `bd.liftoff()` and engine sound. Release before `FLIGHT.igniteHold` seconds: `bd.abortLiftoff()`, the bar resets, no penalty, the prompt stays.
- Held past `igniteHold`: the burn clock starts and the bar drains over `setup.burn` seconds. Release, or the bar emptying, ends the moment with `gradeLiftoff(setup, burnt)`. Show "Clean staging", "Early. Fuel wasted." or "Late. The stage ran dry." for 1.2 s, then start the flight scene.
- No press within `FLIGHT.idleIgnite` seconds: the engines light by themselves and burn dry.
- Autopilot (`autoFly`, or the "Let the autopilot fly" link): lights, burns to the middle of the zone on screen, and reports `AUTOPILOT.liftoff`. In autopilot the link reads "Fly it myself" and turns `autoFly` off for the rest of the flight.
- `FlightAudio.update` rumble follows the burn. Dispose the `HoldInput` when the moment ends.

- [ ] **Step 1: Add e2e steps:** open with `?seed=12345&quick=1&fly=1`, reach the poll, launch. Wait for `.fly-layer[data-moment="liftoff"]`. Tap Space for 200 ms: `__game.fly.burnt` is 0 afterwards and the layer is still there. Hold Space until `__game.fly.burnt >= (zoneStart + zoneEnd) / 2`, release: `.fly-note` contains "Clean staging".
- [ ] **Step 2:** Rebuild and run `npm run e2e`. Expected: fails at the liftoff layer.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx tsc --noEmit && npm test`, rebuild, `npm run e2e`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: fly the liftoff`.

---

### Task 8: Fly the Moon orbit and the landing

**Files:**
- Rename and rewrite: `src/three/cutscene.ts` → `src/three/flight.ts`
- Modify: `src/main.ts`, `scripts/e2e.cjs`

**Interfaces:**
- Consumes: everything from Tasks 2, 4 and 5; `Backdrop`, `buildShip`.
- Produces:

```ts
export interface FlightDeps {
  tags: string[]; commander: string; liftoff: Mark;
  auto(): boolean; setAuto(v: boolean): void;
  peek(flown: FlownResult): Outcome;                                    // session.peek
  orbitSetup(): OrbitSetup;
  landingSetup(marks: { liftoff: Mark; orbit: Mark }, site: Site, attempt: 1 | 2): LandingSetup;
  sites(): SiteChoice[];                                                // locked = reason when siteOverloadsLink
  chooseSite(id: Site): void;                                           // answers 'sci-site'
  ending(cause: Cause | null): Ending;
  onDone(flown: FlownResult): void;
}
export class Flight { constructor(host: HTMLElement, deps: FlightDeps); dispose(): void }
```

- `main.ts` calls `finishFlight(s, flown)` in `onDone`, then records `lastFlight` and `fallen` as `doLaunch` does today, then `go('paper')`. While a moment is live, `window.__game.fly = { moment, h, v, fuel, vSafe, t, approach, window }`.

**The sequence.** The fixed timeline (`segs`, `duration`, `tailStart`) goes. The scene runs these steps in order; before each one it calls `deps.peek(flownSoFar)` and, if that outcome has failed at the step's phase, plays today's failure ending for that cause in place of the step, then calls `onDone`.

1. **Launch, watched, 3 s.** Today's `launch` picture (third stage burning).
2. **Coast, watched, 5 s.** Today's `coast` picture.
3. **Orbit, flown.** The Moon grows as today. Overlay prompt: "Tap SPACE as the ship crosses the ring." The ship dot reaches the ring after `setup.approach` seconds. The first tap is the only one that counts: error = tap time − `approach`. No tap by `approach + 2·window + 0.2` s counts as `null`. The engine flame fires for 2 s from the tap. Note: "Clean burn", "A little off. It cost fuel." or "Late burn. It cost fuel."
4. **Site pick.** Only if `peek` does not already fail at `landing`. The picture holds in lunar orbit; `sitePick` shows the two sites from `deps.sites()`; picking calls `deps.chooseSite`.
5. **Landing, flown.** Overlay prompt: "Hold SPACE to slow down. Land when the speed is green." Lander height on screen follows `state.h / setup.h0` between today's separation height and the surface (for the whole-ship lander, the ship's height). The engine flame and rumble follow the held input. Each frame: `advance`, then on try 1 `doomed` → note "Abort. One more try.", the lander climbs back over 2 s, try 2 starts with `landingSetup(..., 2)`. On try 2 let it reach the ground. Touchdown at `v <= vSafe` is a landing: dust, thud, today's success radio lines and "Tranquility Base here." A failed try 2 is the crash: today's vehicle-loss picture at the surface with the `crash` ending's lines.
6. **Return, watched, 7 s.** Today's `return` picture, on success only.

- Autopilot: orbit taps at the ring and reports `AUTOPILOT.orbit`; the site pick chooses the plain after 2 s; the landing is flown on screen by `simplePilot`.
- Esc during a watched step jumps to its end. Space does nothing outside a flown step.
- The HUD line (`T+`, phase name, lamp), the narration lines, the letterbox bars, the static and power-fade effects and the failure sounds are kept.
- `Flight` owns one `HoldInput` for its lifetime and disposes it in `dispose()`.

- [ ] **Step 1: Add e2e steps.** (a) Autopilot run, `?quick=1`: launch and wait for `body[data-screen="paper"]` within 120 s; the report's heading is "The Eagle has landed" or a coast or return failure, never "The landing was too hard". (b) Flown run, `?quick=1&fly=1`: after liftoff, at `.fly-layer[data-moment="orbit"]` press Space when `__game.fly.t >= __game.fly.approach`; `.fly-note` contains "Clean burn". Click `.site[data-site="flat"]`. At `data-moment="landing"`, every 50 ms hold Space when `v > Math.sqrt(2 * 0.7 * 3.38 * Math.max(0, h)) + 0.5 * vSafe`, else release, until the layer goes; then wait for the paper and check `__game.s.runs.at(-1).outcome.flown.landing.landed === true`. (c) Idle run, `?quick=1&fly=1`: after the launch button, press nothing at all, and click the plain when the site pick appears; the report heading is "The landing was too hard" and `flown.landing.tries === 2`.
- [ ] **Step 2:** Rebuild and run `npm run e2e`. Expected: fails in (b).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx tsc --noEmit && npm test`, rebuild, `npm run e2e`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: fly the orbit burn and the landing`.

---

### Task 9: Poll, newspaper, report and words

**Files:**
- Modify: `src/main.ts`, `src/feel.css`, `index.html`, `README.md`, `scripts/e2e.cjs`

**What to build:**
- **Poll.** The odds line reads: "`X`% chance a part fails on the coast out or the trip home. The liftoff, the Moon and the landing are in your hands." Flight dynamics says "Go. Landing fuel is thin. Fly her gently." (a caution) when `landingFuelPreview < 0.25` and nothing more serious applies.
- **Newspaper.** `papers.crash` when the cause is `piloting`.
- **Report.** For `launch`, `orbit` and `landing`, show "Flown: clean / fair / rough" from `outcome.flown` in place of the "% chance of a part failing" line. Landing adds "Touched down at `S` m/s with `F`% fuel left, on the first try / second try." or, when lost, "Came down at `S` m/s." A `piloting` failure gets its own card: "What failed: the landing", `end.because`, `end.avoid`. "Who chose what" and the history comparison use `answered(run.decisions)`, so a missing site or an old id is skipped. The hardware card names only coast or return.
- **Words.** Title small print: "Build the rocket. Fly it with the space bar. Three people are counting on both." Title eyebrow and the gate: "A build-and-fly space mission game". `index.html` description: "Build a 1960s Moon rocket and fly it with one key. Real NASA history, and failures that leave a mark." README: replace the "hold to commit" lines with how to build and fly, and add `?fly=1`.

- [ ] **Step 1: Add e2e assertions:** in the idle run from Task 8, the paper headline is "LOST AT THE SURFACE" and the report contains "What failed: the landing" and "Lesson saved". In the flown run, the report contains "Flown: clean" and "on the first try". In a run started with `?seed=12345&quick=1` whose build is overweight (lander `direct`, power `extra`, antenna `large`, science `full`), the report renders with no page error and its "Who chose what" list has no "undefined".
- [ ] **Step 2:** Rebuild and run `npm run e2e`. Expected: the new assertions fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx tsc --noEmit && npm test`, rebuild, `npm run e2e`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: poll, report and copy for build-and-fly`.

---

### Task 10: Whole-game check

**Files:**
- Modify: whatever the checks turn up.

- [ ] **Step 1:** `npx tsc --noEmit && npm test && npm run build`. Expected: clean, all tests pass, build succeeds.
- [ ] **Step 2:** `npm run e2e` with the preview server running. Expected: exit 0.
- [ ] **Step 3: Play it by hand** in the dev server with sound on, without `?quick`. Check each line and fix what fails:
  - A full run from the intro to the report takes about five minutes.
  - A first landing on the plain with the basic parts is comfortable; the highlands on a heavy ship is hard but possible.
  - A short tap at liftoff resets cleanly; holding from the pad through staging feels like one motion.
  - Switching to another window mid-landing and back does not crash the lander by itself.
  - Space never scrolls the page, presses a focused button, or skips a scene.
  - At 390 px wide, the build screen, the three flying overlays and the site pick are all readable and usable by touch.
  - A failed mission, then "Fly … with what we learned": the rocket is as it was left, and the three story decisions and three interruptions come again.
- [ ] **Step 4: Bring the demo recorder into the project.** Copy `C:\Users\lamy4\AppData\Local\Temp\claude\a779bb8940cd5b4d\e94a2711-dc64-402b-9b15-171238f66716\scratchpad\rttm\record_audio.cjs` to `scripts/record.cjs`. Point its `require` at `playwright-core`, and replace its decision loop with the build steps and the flown-run pilot from `scripts/e2e.cjs` (no `?quick`, so parts are clicked and story decisions are held). Run it against the dev server. Expected: it prints "ended on: The Eagle has landed" and writes a video and an audio file.
- [ ] **Step 5:** Commit `fix: findings from the whole-game check`.

---

## What changed while building (10 November 2026)

- **Landing fuel floor raised.** `marginFloor` is 1.4 and `marginHeavy` 1.5 (planned: 1.25 and 1.45). At 1.25 a pilot with slow hands could not land a heavy ship. `retryFloor` is 1.25.
- **Two pilot rules, shown on screen.** `simplePilot` brakes at the last moment; `cautiousPilot` brakes early and drifts the last 15 m. The landing readout shows them as "Brake now" (red) and "Start slowing" (amber). `laggedPilot` follows the cautious rule, and lands with reaction delays up to 0.8 s.
- **Point of no return is exact.** `doomed` works out the best possible last-moment burn, so the abort never fires while the landing can still be saved.
- **Interruptions fire after a fit, or from the roll-out button.** They never fire by themselves on entering the build screen, so a retry with a full rocket is not hit by three in a row.
- **After fitting a part the tray moves to the next empty spot.**
- **Touch wording.** On a touch screen the prompts say "Press and hold" and "Tap" with no mention of the space bar.
- **A shadow under the lander** shows height by the gap between the two.
- **The browser checks run against the dev server** (`npm run dev`), not the preview build, and have two extra stages: `retry` and `phonefly`.
- **Phone fix found on the way:** the three world meters overflowed a 390 px screen before this work. They now share the width.
