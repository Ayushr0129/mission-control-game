# Campaign Achievements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 13 achievements for the historical campaign, with a title-screen panel, an "Achievement earned" pop-up and Codex-made SVG badges.

**Architecture:** A pure rules module (`src/game/achievements.ts`) decides what a finished run earns and keeps the earned list in `localStorage`. `src/main.ts` calls it right after `finishFlight`, records whether the autopilot flew, shows the pop-up on the report screen, and adds the panel to the title screen. Badges are 13 SVG files that Codex writes and Vite imports as raw strings.

**Tech Stack:** TypeScript, Vite, Vitest, Codex CLI (`codex exec`) for the art.

**Spec:** `docs/superpowers/specs/2026-11-14-campaign-achievements-design.md`

## Global Constraints

- Historical campaign only; the Mission Lab is untouched.
- Campaign flying, scoring and story do not change.
- Storage key `rttm.achievements.v1`; every read and write wrapped in try/catch like the other keys (`src/game/session.ts:24`).
- Runs with `?quick=1` in the URL earn nothing. Test `qs.has('quick')`, **not** `instant`: `instant` is also on for reduced-motion players, who must still earn.
- Practice runs (`?practice=…`) earn nothing. They never call `finishFlight`, so this holds as long as awarding happens only in `doLaunch`.
- Each badge is earned once; later runs neither re-award nor re-pop it.
- `on-fumes` threshold: landing `fuelLeft < 0.10`.
- `comeback`: an earlier failed run in the same `Session` (`s.runs`).
- Failure badges' English description is the ending's `avoid` text (`src/data/endings.ts`).
- EN/FR for every new string via `uiText(en, fr)` from `src/missionlab.ts`.
- Badges: 64×64 viewBox, no `<text>`, no external references (`href`, `url(http`), under 4 KB each, colours only from the palette in `src/style.css:2-3`.

## Review Focus

1. Reduced-motion player (no `?quick`) lands: badges are awarded. (Task 3 test of `quickRun`)
2. Player switches the autopilot on mid-landing, then off again: `hands-on` is not earned. (Task 1 test, Task 3 wiring)
3. Corrupt or non-array JSON under `rttm.achievements.v1`: the game loads with nothing earned, no crash. (Task 1)
4. A run that earns the 4th failure badge earns `seen-it-all` in the same pop-up. (Task 1)
5. "Forget everything" clears achievements, and the title count drops to 0/13 without a reload. (Task 3, browser check)

---

### Task 1: Achievement rules and storage

**Files:**
- Create: `src/game/achievements.ts`
- Modify: `src/game/session.ts` (`Run` gets `autopilot?: boolean`)
- Test: `tests/achievements.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AchievementId = 'landed' | 'first-try' | 'picture-perfect' | 'rough-ground' | 'on-fumes' | 'hands-on'
    | 'by-the-book' | 'comeback' | 'signal-lost' | 'lights-out' | 'vehicle-lost' | 'too-fast' | 'seen-it-all';
  export interface Achievement { id: AchievementId; failure: boolean; name: [string, string]; desc: [string, string]; hint: [string, string] } // [en, fr]
  export const achievements: Achievement[];            // the 13, in the spec's table order
  export interface Held { id: AchievementId; at: number }   // at = Date.now()
  export function loadHeld(): Held[];                  // [] on missing, corrupt or non-array data; drops unknown ids
  export function clearAchievements(): void;
  /** New ids this run earns, given what is already held. Pure. */
  export function earned(s: Session, run: Run, held: AchievementId[]): AchievementId[];
  /** Loads, computes, saves, returns the new ones. Returns [] and saves nothing when quick. */
  export function award(s: Session, run: Run, quick: boolean): AchievementId[];
  ```
- Consumes: `Session`, `Run`, `finishFlight` from `src/game/session.ts`; `endingFor`, `history` from `src/data`.

- [ ] **Step 1: Write the failing tests** in `tests/achievements.test.ts`, reusing the `build`/`BASIC`/`LANDED`/`LOST` pattern from `tests/session.test.ts` (stub `localStorage` with a `Map` in `beforeEach`). Build runs with `finishFlight` where the simulator decides; where a test needs a fixed outcome, construct the `Run`'s `outcome` directly.
  - `landed on run 1 earns landed and first-try`
  - `first-try is not earned on run 2`, and `comeback` is earned on a success after a failed run
  - `picture-perfect needs clean liftoff, clean orbit, landing tries 1`: true for `{liftoff:'clean',orbit:'clean',landing:{tries:1,…}}`, false with `orbit:'fair'` or `tries:2`
  - `rough-ground` when `landing.site === 'rough'`; `on-fumes` at `fuelLeft: 0.09`, not at `0.10`
  - `hands-on` only when `run.autopilot` is not true
  - `by-the-book` when every key of `history.optionByQuestion` matches `run.decisions`; false when one differs
  - each cause maps: `comms → signal-lost`, `power → lights-out`, `mass` and `hardware → vehicle-lost`, `piloting → too-fast`; a failed run earns no success badges
  - `seen-it-all` is returned in the same call that earns the 4th failure badge
  - `already-held ids are not returned again`
  - `award with quick=true returns [] and stores nothing`
  - `loadHeld survives corrupt data`: `'{'`, `'{}'`, `'[{"id":"nope"}]'` all give `[]`
  - `every achievement has EN and FR name, desc, hint`; failure badges' `desc[0]` equals `endingFor(cause).avoid`

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run tests/achievements.test.ts`
Expected: FAIL, cannot resolve `../src/game/achievements`.

- [ ] **Step 3: Implement `src/game/achievements.ts`** and add `autopilot?: boolean` to `Run`. Cause to badge is `endingFor(cause).id` mapped `comms/power/vehicle/crash → signal-lost/lights-out/vehicle-lost/too-fast`. `award` saves `[...held, ...new.map(id => ({ id, at: Date.now() }))]`.

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/achievements.ts src/game/session.ts tests/achievements.test.ts
git commit -m "Add campaign achievement rules and storage"
```

### Task 2: Badge art by Codex

**Files:**
- Create: `src/ui/badges/<id>.svg` × 13 (one per `AchievementId`), `src/ui/badges/BRIEF.md` (the brief given to Codex, kept for redoing a badge)
- Create: `src/ui/badges.ts`
- Test: `tests/badges.test.ts`

**Interfaces:**
- Consumes: `AchievementId`, `achievements` (Task 1).
- Produces: `export function badgeSvg(id: AchievementId): string` (raw SVG markup), built with `import.meta.glob('./badges/*.svg', { query: '?raw', import: 'default', eager: true })`.

- [ ] **Step 1: Write the failing test** `tests/badges.test.ts`, reading the files with `fs`:
  - every `achievements` id has `src/ui/badges/<id>.svg`
  - each has `viewBox="0 0 64 64"`, no `<text`, no `<script`, no `href=` and no `url(http`, and is under 4096 bytes
  - every hex colour in each file is one of the `--…` values in `src/style.css` lines 2-3 (plus `none`/`currentColor`)

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/badges.test.ts`
Expected: FAIL, files missing.

- [ ] **Step 3: Write `BRIEF.md` and run Codex**

The brief: one round mission-patch style badge per id with the name and meaning from the spec table, a 64×64 viewBox, 2px strokes, flat fills, the palette hex values copied from `src/style.css`, failure badges in `--bad`/`--amber` and success badges in `--ok`/`--blue`/`--amber`, with no text, and a shared outer ring so the 13 read as one set.
Run: `codex exec --full-auto -C ~/space-bar "Follow src/ui/badges/BRIEF.md. Write the 13 SVG files into src/ui/badges/. Touch no other files."`
Then check `git status` shows changes only in `src/ui/badges/`.

- [ ] **Step 4: Review the art**

Render all 13 to one contact sheet (`rsvg-convert` or a throwaway HTML file in the scratchpad) and look at it. Redo any badge that clashes or reads poorly with a `codex exec` naming that file only.

- [ ] **Step 5: Implement `src/ui/badges.ts`, then run the tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/badges src/ui/badges.ts tests/badges.test.ts
git commit -m "Add Codex-drawn SVG badges for campaign achievements"
```

### Task 3: Pop-up, title panel and wiring

**Files:**
- Modify: `src/main.ts` (`openFlight` `auto` callback ~line 614, `flyLiftoff` ~lines 679/716, `doLaunch` ~line 644, `report()` ~line 795, `title()` ~lines 161-167)
- Create: `src/ui/achievements-ui.ts`
- Modify: `src/style.css` (append the panel and pop-up styles)
- Test: `tests/achievements.test.ts` (add `quickRun`)

**Interfaces:**
- Consumes: `award`, `loadHeld`, `clearAchievements`, `achievements` (Task 1); `badgeSvg` (Task 2); `uiText` from `src/missionlab.ts`; `h` from `src/ui/dom.ts`.
- Produces, in `src/ui/achievements-ui.ts`:
  ```ts
  export function quickRun(search: string): boolean;       // true only when the URL has ?quick
  export function earnedToast(ids: AchievementId[]): HTMLElement | null;   // null for []
  export function achievementsPanel(onClose: () => void): HTMLElement;
  ```

- [ ] **Step 1: Write the failing test** in `tests/achievements.test.ts`: `quickRun('?quick=1')` and `quickRun('?seed=3&quick=1')` are true; `quickRun('')` and `quickRun('?fly=1')` are false.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/achievements.test.ts`
Expected: FAIL, `quickRun` not found.

- [ ] **Step 3: Record the autopilot.** Wherever a flown moment reads `autoFly` and gets `true` (the `auto: () => autoFly` callback in `openFlight`, and the `autoFly` reads in `flyLiftoff`), set `s.current.autopilot = true`. Turning it off later does not clear the flag.

- [ ] **Step 4: Award after the flight.** In `doLaunch`, right after `finishFlight`: `freshBadges = award(s, run, quickRun(location.search))`, with a module-level `let freshBadges: AchievementId[] = []`.

- [ ] **Step 5: Pop-up.** `report()` appends `earnedToast(freshBadges)` to `document.body` the first time it renders after a flight, then sets `freshBadges = []`, so coming back from the "done" screen doesn't pop it again. Each card shows the badge, "Achievement earned" / "Succès débloqué" and the name. The cards stack, fade after 5 s, have a close button, and sit in an `aria-live="polite"` region. There's no slide-in under `prefers-reduced-motion`.

- [ ] **Step 6: Title panel.** In the `.menu` of `title()`, add a button `Achievements n/13` / `Succès n/13` that opens `achievementsPanel` as a modal (`role="dialog"`, `aria-modal`, Escape and the close button both close it and return focus). The grid shows all 13: earned ones in colour with name and description; locked ones dimmed (CSS `opacity`/`grayscale`), with the name for failure badges, "???" for the others, and the hint. "Forget everything" also calls `clearAchievements()`.

- [ ] **Step 7: Run all tests, type check and build**

Run: `npx vitest run && npm run build`
Expected: all pass, build succeeds.

- [ ] **Step 8: Browser check, by hand** (headless Firefox runs out of memory on this machine). Run: `npx vite preview --port 4179`, then:
  - **No badges in quick mode:** with `?quick=1`, play to the report. No pop-up appears and the title still shows 0/13.
  - **First landing:** play without `?quick`, using the autopilot links, and land. The pop-up shows "The Eagle has landed" and "First try". "Hands on the stick" does not appear.
  - **The panel:** on the title screen the count reads 2/13, the panel opens and closes with Escape, and the FR button translates it.
  - **Forget everything:** clicking it brings the count back to 0/13.

- [ ] **Step 9: Commit**

```bash
git add src/main.ts src/ui/achievements-ui.ts src/style.css tests/achievements.test.ts
git commit -m "Show achievements: pop-up after a flight and a title-screen panel"
```
