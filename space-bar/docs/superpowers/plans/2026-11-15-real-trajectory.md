# Space Bar: the real trajectory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the gimmicky trip with Apollo 11's real trajectory: real speeds and times, a true-scale map with mission clock and time warp, the free-return loop, three new flown burns (trans-lunar injection, trans-Earth injection, entry corridor) and a real re-entry.

**Architecture:** An offline Earth–Moon gravity calculation (planar restricted three-body) solves Apollo-11-like outbound free-return and return paths and ships them as JSON, like the GMAT results. A pure rules module drives every speed burn and the corridor correction with the existing turn/engine/throttle controls; the simulation gains a free-return abort and a re-entry failure. A new 2D canvas map view draws the paths in the Earth–Moon rotating frame with the clock and warp; the existing 3D view keeps the Moon-orbit and trans-Earth burns, the landing and the failure scenes.

**Tech Stack:** TypeScript, Vite, three.js, Vitest, Playwright-core (dev).

**Spec:** `docs/superpowers/specs/2026-11-15-real-trajectory-design.md`. Read it first; its "Choices for you" were approved as written.

## Global Constraints

- No new libraries. Works offline.
- Every real figure carries its NASA source in the data. Verified on 15 Nov 2026: LOI ignition 075:49:50, landing 102:45:40, TEI ignition 135:23:42, entry interface 195:03:06 at 36,194 ft/s and −6.48°, splashdown 195:18:35 (SP-4029; Apollo Flight Journal). TLI speed 35,567.3 ft/s and parking orbit already in `src/data/apollo11.ts`.
- The same three controls (turn ← →, engine SPACE, throttle ↑ ↓); warp on `,` and `.` plus on-screen buttons.
- English and French for every new string, through `uiText()`.
- Usable at 390 px wide and 1280×720; `prefers-reduced-motion` keeps the map still apart from the ship.
- A hands-off visitor (Start on each card, nothing else) finishes pad to splashdown in about six minutes.
- Node: `export PATH="/c/Users/lamy4/AppData/Local/Temp/claude/a779bb8940cd5b4d/e94a2711-dc64-402b-9b15-171238f66716/scratchpad/rttm/venv/Scripts:$PATH"`.
- After every task: `npx tsc --noEmit` clean, `npm test` passes. Commit messages end `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Warp during a burn.** Warp must drop to 1× before every burn and stay locked while flying it. Pinned in Task 4.
2. **The free return after a skipped Moon-orbit burn**: no landing site, no landing, and the report, newspaper and achievements must not break or count a death. Pinned in Task 2 and the browser checks in Task 6.
3. **A hardware failure on the coast** must still play its ending and stop the map cleanly. Pinned in Task 6's browser checks.
4. **Phone width on the map**: the readout and controls must not cover the Earth or the path. Pinned in Task 6.
5. **Old saved data and share links** with flown results that lack the new fields. Pinned in Task 2.

---

### Task 1: The trajectory, computed

**Files:** Create `src/sim/cr3bp.ts`, `scripts/trajectory.ts`, `src/data/trajectory.json`, `tests/trajectory.test.ts`. Modify `package.json` (script `trajectory`).

**Produces:**
- `cr3bp.ts`: constants `MU_E = 398600.4418`, `MU_M = 4902.8`, `D = 384400` (km), `R_E = 6378.137`, `R_M = 1737.4`; `integrate(state, tEnd, opts) → samples` (inertial Earth-centred, Moon on a circular orbit, RK4 with adaptive step), `toRotating(sample) → {x, y}`, `solveOutbound()`, `solveReturn()`.
- `trajectory.json`: `{ outbound: Path, freeReturnHome: Path, homebound: Path, meta }` where `Path = { t: number[] /* s */, x: number[], y: number[] /* km, rotating frame, Earth at 0, Moon at (D,0) */, v: number[] /* km/s inertial */ }`, sampled about every 20 minutes; `meta` holds the solved injection altitude, phase, perilune altitude, return perigee altitude, coast times, TEI Δv and the method note.

**Solve.** Outbound: inject at speed 35,567.3 ft/s (10.841 km/s, NASA) with zero flight-path angle; unknowns injection altitude and phase angle to the Moon; targets perilune altitude 111 km (Apollo 11's 60 n mi orbit) and, continuing with no burn, an Earth return with vacuum perigee between 20 and 60 km (free return). `outbound` ends at perilune; `freeReturnHome` continues from perilune to entry altitude 122 km. Return: from a 111 km circular lunar orbit, a prograde burn; unknowns burn point and Δv; targets Earth entry with flight-path angle −6.48° at 122 km. Newton or bracketed search; deterministic.

- [x] Tests: perilune altitude 111 ± 15 km; free-return vacuum perigee 20–60 km; outbound coast 60–80 h; homebound coast 50–70 h; homebound entry angle −6.48 ± 0.15°; speed falls below 1.2 km/s on the way out and is near 11 km/s at entry; `trajectory.json` equals a fresh solve (rounded).
- [x] Implement, run `npm run trajectory`, commit.

### Task 2: Rules and simulation

**Files:** Create `src/sim/burn.ts`, `tests/burn.test.ts`. Modify `src/sim/orbit.ts` (removed; its users move to `burn.ts`), `src/sim/types.ts`, `src/sim/simulate.ts`, `src/sim/meters.ts`, `src/sim/flight.ts`, `src/data/endings.ts`, `src/data/story.ts`, `src/game/achievements.ts` if needed, `tests/*`.

**Produces:**
- `burn.ts`: `BurnSetup { id: 'tli'|'loi'|'tei'; dir: 'prograde'|'retrograde'; speed0; lo; hi; rate; window; turnRate; warnings }`, `Burn { speed; angle; t; burnt; quiet; self }`, `burnSetup(id, ch, t, events)`, `startBurn`, `stepBurn`, `burnOver`, `gradeBurn → Mark`, `burnPilot`, `inBand`, `offTarget`. Angle 0 = nose prograde; retrograde target is π. Speeds in km/s from `trajectory.json` and NASA: TLI 7.79 → band around 10.841; LOI from the outbound perilune speed down to lunar-orbit speed (Δv about 0.89); TEI from lunar-orbit speed up by the solved Δv. Half-band lerp(easy, hard, difficulty) as today; window 20 s; self-burn at 70%.
- Corridor: `CorridorSetup { start; lo: -7.5; hi: -5.5; rate; window; turnRate }`, `Corridor { angle /* entry angle, deg */; shipAngle; t; burnt; self; touched }`, `corridorSetup(teiMark, seed)`, `stepCorridor`, `corridorOver`, `corridorOk`, `corridorPilot`. Start off the band by 0.6° (clean), 1.4° (fair), 2.2° (rough), steep or shallow from the seed. Untouched → guidance corrects late into the band. Touched and left outside → not ok.
- `types.ts`: `Cause` gains `'abort' | 'reentry'`; `FlownResult` gains `tli?: Mark; tei?: Mark; freeReturn?: boolean; reentry?: { angle: number; ok: boolean }`.
- `simulate.ts`: orbit phase with `freeReturn` neither fails nor rolls; landing not reached; return rolls its dice then checks `reentry`; at the end a clean free return is `success: false, failedPhase: 'orbit', cause: 'abort'`; a bad corridor is `failedPhase: 'return', cause: 'reentry'`.
- `meters.ts`: an abort costs half the failure trust and no failure debris.
- `flight.ts`: `fuelMargin` also takes `tli`.
- Endings and front pages: `abort` ("Free return", home safe, no landing) and `reentry` (steep: burned up; shallow: skipped into space; one ending, text chooses by the sign stored in the outcome). `lessonWatch` gains both.

- [x] Tests: each burn's pilot is clean on every flyable build; untouched burns self-burn and grade rough; corridor untouched ends ok via guidance; corridor actively flown out ends not ok; simulate: free return → cause abort, landing not reached, return dice still rolled; bad reentry → cause reentry; old `FlownResult` without new fields still simulates; meters: abort costs less trust than a loss.
- [x] Implement, commit.

### Task 3: The map view

**Files:** Create `src/ui/mapview.ts`, CSS in `src/mission.css`.

**Produces:** `class MapView { constructor(host: HTMLElement); setScene(s: { paths: { pts: [number, number][]; style: 'past'|'plan'|'ghost' }[]; ship: { x; y; heading } ; zoom: 'earth'|'system'|'moon'; marker?: [number, number] }); resize(); dispose() }` drawing on a 2D canvas: true-scale distances, Earth and Moon enlarged with a "not to scale" note, Earth–Moon rotating frame, smooth zoom between framings.

- [x] Visual check in the browser; commit.

### Task 4: Clock and warp, and the new flight sequence

**Files:** Modify `src/three/flight.ts`, `src/ui/flyhud.ts`, `src/main.ts`.

**Produces:** `missionClock(t) → 'HHH:MM:SS'`; warp levels `[1, 10, 100, 1000, 10000, 100000]`, default 10,000× on coasts, `,`/`.` and buttons, locked to 1× during burns. Flight steps: liftoff hand-over → **TLI** (map, Earth zoom, card, flown burn, predicted ellipse grows to the free-return path) → **coast out** (map, warp, "why" lines, dice failure at 45% plays the 3D failure) → **LOI** (3D view as now, real numbers, loss-of-signal line; untouched = free return) → [free return: **coast home on the free-return path**] or [site → landing → clock jump note → **TEI** (3D view) → **coast home** (map)] → **corridor** (map, Earth zoom, gauge) → **re-entry** (watched: glow, blackout, chutes, splashdown, clock to 195:18:35). `FlightDeps` gains `tliSetup()`, `teiSetup()`, `corridorSetup()`. Each event shows "Apollo 11: HHH:MM:SS".

- [x] Browser check by hand of each step; commit.

### Task 5: Liftoff in real numbers

**Files:** Modify `src/main.ts` (`flyLiftoff`), `src/ui/flyhud.ts` (`ascentHud`).

**Produces:** altitude (km) and speed (km/s) from the ascent progress on a smooth profile ending at Apollo 11's parking orbit (185 km, 7.79 km/s from the orbit itself) and the clock from 000:00:00 to 000:11:49. A "why" line at orbit.

- [x] Commit.

### Task 6: Report, sources, browser checks, docs

**Files:** Modify `src/main.ts` (report lines, Data and sources rows, `fallen` excludes `abort`), `scripts/e2e.cjs`, `scripts/record.cjs`, `README.md`.

- [x] Browser checks: hands-off run (free return, home alive, abort ending, no death, time under 7 minutes at default warp); keyboard pilot (clean TLI, LOI, TEI, corridor ok, landed); autopilot; overweight; phone width on the map; a coast hardware failure seed.
- [x] Commit; run the whole suite; record a demo; notify.
