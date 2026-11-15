# GMAT Mission Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Mission Lab's textbook journey delta-v figures with values computed by NASA's GMAT, and add NASA-sourced, GMAT-checked Apollo 11 burn figures to the campaign report.

**Architecture:** GMAT runs offline on a developer machine. Each `gmat/*.script` writes a one-row ReportFile to `gmat/output/`; a collector turns those reports into committed JSON files the game imports. The game never runs GMAT; it reads the JSON, credits GMAT, and the tests pin the game to the JSON.

**Tech Stack:** GMAT (latest stable release, console runner), TypeScript 7 / Vite 8 / Vitest 5 (existing), Node 22 type stripping for the collector CLI.

**Spec:** `docs/superpowers/specs/2026-11-14-gmat-mission-numbers-design.md`

## Global Constraints

- GMAT never runs in the browser or at play time: the game stays a static, offline page.
- Every shipped value traces to a script in the repo; no hand-typed GMAT results.
- Parking orbit for every Mission Lab mission: 200 km circular low Earth orbit.
- Each transfer figure is rounded up to 0.1 km/s; `deltaVNeed` = `LAUNCH_DV` (9.4) + `transferNeed`.
- Saturn uses a direct transfer; the game notes real missions save fuel with gravity assists.
- Every mission's engineering baseline must still pass the existing autopilot test (`tests/physics.test.ts`, "every mission baseline").
- The campaign's flying and scoring do not change.
- Apollo 11: the game shows NASA's published figure; GMAT's recomputation sits beside it. A difference above 5% must carry a written cause, and the team is told before shipping.
- Apollo 11 figures cite NASA publications by title and page: *Apollo 11 Mission Report* (NASA MSC-00171, 1969) and *Apollo by the Numbers* (NASA SP-2000-4029).
- GMAT credit names the GMAT version and the computation date.
- GMAT itself is installed outside the repo (it is hundreds of MB).

## Review Focus

1. A GMAT report that is missing, empty or has a non-numeric value: the collector must exit with an error and leave the existing JSON untouched, never write zeros. (Task 1)
2. A transfer figure that is already a whole tenth (3.1 exactly, or 3.1000000004 from floating point) must stay 3.1, not round up to 3.2. (Task 4)
3. A launch saved in the browser before the update, now short of the new GMAT figure: the payload must stay locked and the flight tab must offer the launch again. (Task 4)
4. French mode: the new GMAT credit and the Apollo table labels must appear in French. (Tasks 4 and 5, browser check)
5. An Apollo 11 recomputation more than 5% off NASA's figure without a written cause must fail the tests. (Task 5)

---

### Task 1: GMAT toolchain and collector

**Files:**
- Create: `gmat/README.md` (GMAT version used, install path outside the repo, how to run, container fallback)
- Create: `gmat/run.sh` (runs every `gmat/*.script` except `smoke.script` through the GMAT console, then the collector)
- Create: `gmat/smoke.script` (propagates a spacecraft for one orbit, reports `Sat.Earth.SMA` to `gmat/output/smoke.txt`)
- Create: `src/lab/gmat/collect.ts` (pure parsing and JSON building, no Node APIs)
- Create: `scripts/gmat-collect.ts` (CLI: reads `gmat/output/*.txt`, writes the JSON files)
- Modify: `package.json` (add `"gmat": "bash gmat/run.sh"` and `"gmat:collect": "node --experimental-strip-types scripts/gmat-collect.ts"`)
- Modify: `.gitignore` (nothing: `gmat/output/` is committed, so results are reviewable)
- Test: `tests/gmat-collect.test.ts`

**Interfaces:**
- Produces: `parseReport(text: string): Record<string, number>` — GMAT ReportFile text with a header row of names and data rows; returns the last data row keyed by header name; throws `Error` naming the problem if there is no header, no data row, a column count mismatch, or a non-finite value.
- Produces: `GmatMeta = { version: string; computed: string /* YYYY-MM-DD */ }`.
- Produces: `buildTransfers(meta: GmatMeta, reports: Record<string, Record<string, number>>): GmatTransfers` where `GmatTransfers = { gmat: GmatMeta; missions: Record<'earth' | 'moon' | 'mars' | 'saturn', { burns: Record<string, number> /* km/s */; total: number; script: string }> }`. Burns are every report column whose name starts with `dv_` (prefix removed); `total` is their sum; throws if a mission report is missing or has no `dv_` column.
- Produces: the CLI writes `src/lab/gmat-transfers.json` (Mission Lab) and `src/data/apollo11-gmat.json` (`{ gmat: GmatMeta; burns: Record<string, number> /* m/s */ }`, from `gmat/output/apollo11.txt`) only after every report parses; otherwise it exits 1 and writes nothing.

- [ ] **Step 1: Install GMAT outside the repo**

Download the latest stable GMAT Linux release from https://sourceforge.net/projects/gmat/ into its own new folder, `~/opt/gmat` (not the repo). If its console runner does not start on Fedora 44, run it in a container instead (`podman run` with an Ubuntu image matching GMAT's supported release, the repo mounted at `/work`). Record the GMAT version string and the run command in `gmat/README.md`.

- [ ] **Step 2: Run the smoke script**

Run: `bash gmat/run.sh smoke` (the script accepts an optional script name)
Expected: `gmat/output/smoke.txt` exists with a header row and one numeric row.

- [ ] **Step 3: Write the failing collector tests**

```ts
describe('parseReport', () => {
  it('reads the last data row by header name', () => {
    expect(parseReport('dv_TLI   dv_LOI\n3.1   0.9\n3.15   0.92\n')).toEqual({ dv_TLI: 3.15, dv_LOI: 0.92 });
  });
  it('rejects an empty report', () => { expect(() => parseReport('')).toThrow(/header/); });
  it('rejects a header with no data', () => { expect(() => parseReport('dv_TLI\n')).toThrow(/data/); });
  it('rejects a non-numeric value', () => { expect(() => parseReport('dv_TLI\nNaN\n')).toThrow(/dv_TLI/); });
  it('rejects a column count mismatch', () => { expect(() => parseReport('a b\n1\n')).toThrow(/column/); });
});
describe('buildTransfers', () => {
  const meta = { version: 'R0000a', computed: '2026-11-14' };
  const ok = { earth: { dv_raise1: 0.1, dv_raise2: 0.2, epoch: 1 }, moon: { dv_TLI: 3 }, mars: { dv_TMI: 3.6 }, saturn: { dv_TSI: 7, dv_SOI: 0.6 } };
  it('sums the dv_ columns and drops the prefix', () => {
    const t = buildTransfers(meta, ok);
    expect(t.missions.earth.burns).toEqual({ raise1: 0.1, raise2: 0.2 });
    expect(t.missions.earth.total).toBeCloseTo(0.3);
    expect(t.missions.saturn.script).toBe('gmat/saturn.script');
  });
  it('refuses a missing mission', () => { const { mars, ...rest } = ok; expect(() => buildTransfers(meta, rest)).toThrow(/mars/); });
  it('refuses a mission with no burns', () => { expect(() => buildTransfers(meta, { ...ok, moon: { epoch: 1 } })).toThrow(/moon/); });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `npx vitest run tests/gmat-collect.test.ts`
Expected: FAIL, cannot resolve `../src/lab/gmat/collect`.

- [ ] **Step 5: Implement `parseReport` and `buildTransfers` in `src/lab/gmat/collect.ts`, then the CLI in `scripts/gmat-collect.ts`**

The CLI reads the GMAT version and date from `gmat/README.md`'s first line `GMAT <version>` and today's date unless `GMAT_COMPUTED` is set; it writes both JSON files with two-space indentation only after all parsing succeeds.

- [ ] **Step 6: Run the tests and the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add gmat/README.md gmat/run.sh gmat/smoke.script gmat/output/smoke.txt src/lab/gmat/collect.ts scripts/gmat-collect.ts tests/gmat-collect.test.ts package.json
git commit -m "Add GMAT toolchain notes and report collector"
```

---

### Task 2: Earth and Moon transfer scripts

**Files:**
- Create: `gmat/earth.script`, `gmat/moon.script`
- Create (generated): `gmat/output/earth.txt`, `gmat/output/moon.txt`

**Interfaces:**
- Consumes: `gmat/run.sh`, the report format `parseReport` reads (Task 1).
- Produces: reports whose `dv_` columns are in km/s: Earth `dv_raise1`, `dv_raise2`; Moon `dv_TLI`, `dv_LOI`.

Each script states its assumptions in a header comment (impulsive burns, planar launch, force models used) and uses GMAT's `Target`/`Vary`/`Achieve` with a `DifferentialCorrector`.

- [ ] **Step 1: Write `gmat/earth.script`**

Start: 200 km circular orbit (SMA 6578.137 km, ECC 0). Two impulsive burns; achieve a 705 km circular orbit (SMA 7083.137 km with GMAT's Earth radius 6378.137 km, ECC below 1e-5). Report `dv_raise1`, `dv_raise2` (burn magnitudes, km/s).

- [ ] **Step 2: Run it**

Run: `bash gmat/run.sh earth`
Expected: `gmat/output/earth.txt` with two positive values summing to about 0.28 km/s (the analytic two-burn transfer between those orbits is 0.283 km/s; within 1% means the script is right).

- [ ] **Step 3: Write `gmat/moon.script`**

Start: 200 km circular LEO; Earth, Moon and Sun point masses. Trans-lunar injection: vary the burn and the epoch of the coast, achieve a lunar periapsis altitude of 100 km. Lunar orbit insertion at periapsis: achieve a lunar apoapsis altitude of 3,000 km (Moon radius 1737.4 km). Report `dv_TLI`, `dv_LOI` (km/s). Record the departure epoch in a comment.

- [ ] **Step 4: Run it**

Run: `bash gmat/run.sh moon`
Expected: `gmat/output/moon.txt`; `dv_TLI` between 3.0 and 3.3 km/s and `dv_LOI` between 0.2 and 0.9 km/s (outside these, the targeting converged on a wrong solution: fix before going on).

- [ ] **Step 5: Commit**

```bash
git add gmat/earth.script gmat/moon.script gmat/output/earth.txt gmat/output/moon.txt
git commit -m "Compute Earth and Moon transfers with GMAT"
```

---

### Task 3: Mars and Saturn transfer scripts

**Files:**
- Create: `gmat/mars.script`, `gmat/saturn.script`
- Create (generated): `gmat/output/mars.txt`, `gmat/output/saturn.txt`

**Interfaces:**
- Produces: Mars `dv_TMI` (km/s); Saturn `dv_TSI`, `dv_SOI` (km/s).

Method for both, so GMAT's ephemerides and targeter do the work: a heliocentric spacecraft starts at Earth's position at the departure epoch; a `DifferentialCorrector` varies its heliocentric velocity to reach the target planet's position at the arrival epoch (GMAT acting as the Lambert solver). From the departure velocity relative to Earth (v∞), compute the burn from the 200 km circular orbit in the script with GMAT equations: `dv = sqrt(vinf^2 + 2*muE/r) - sqrt(muE/r)`.

- [ ] **Step 1: Write `gmat/mars.script`**

Departure epoch in the late-2026 window, searched over 2026-10-25 to 2026-12-15 in steps of 5 days with arrival 180 to 300 days later, keeping the lowest `dv_TMI`. No arrival burn (heat-shield landing). Record the chosen departure and arrival epochs in a comment.

- [ ] **Step 2: Run it**

Run: `bash gmat/run.sh mars`
Expected: `gmat/output/mars.txt`; `dv_TMI` between 3.5 and 4.2 km/s.

- [ ] **Step 3: Write `gmat/saturn.script`**

Direct transfer: search the departure epoch over one year starting 2027-01-01 (10-day steps, flight time 5 to 7 years) for the lowest `dv_TSI`. Arrival: `dv_SOI` is the burn from the arrival hyperbola into a capture orbit with periapsis radius 78,350 km (1.3 Saturn radii) and apoapsis radius 4,000,000 km, `dv = sqrt(vinf^2 + 2*muS/rp) - sqrt(muS*(2/rp - 1/a))`. State in the header that real missions (Cassini) used gravity assists to save fuel.

- [ ] **Step 4: Run it**

Run: `bash gmat/run.sh saturn`
Expected: `gmat/output/saturn.txt`; `dv_TSI` between 7.0 and 7.8 km/s and `dv_SOI` between 0.4 and 1.2 km/s.

- [ ] **Step 5: Commit**

```bash
git add gmat/mars.script gmat/saturn.script gmat/output/mars.txt gmat/output/saturn.txt
git commit -m "Compute Mars and Saturn transfers with GMAT"
```

---

### Task 4: The Mission Lab uses GMAT's numbers

**Files:**
- Create (generated): `src/lab/gmat-transfers.json` (via `npm run gmat:collect`)
- Modify: `src/lab/catalog.ts` (`profiles`, `LAUNCH_DV` moves above `profiles`, Saturn baseline)
- Modify: `src/missionlab.ts` (`briefPanel` mission cards: GMAT credit line; FR dictionary)
- Modify: `src/main.ts` (`dataScreen` rows)
- Test: `tests/lab.test.ts`, `tests/physics.test.ts` (existing baseline test must stay green)

**Interfaces:**
- Consumes: `src/lab/gmat-transfers.json` in the `GmatTransfers` shape (Task 1).
- Produces: `needFromGmat(totalKmS: number): number` in `src/lab/catalog.ts` — rounds up to the next 0.1 km/s with a 1e-9 tolerance; `profiles[i].transferNeed = needFromGmat(transfers.missions[id].total)`, `profiles[i].deltaVNeed = Math.round((LAUNCH_DV + transferNeed) * 10) / 10`.
- Produces: `gmatCredit: string` exported from `src/lab/catalog.ts`, e.g. `Δv to target computed with NASA GMAT R2025a, 2026-11-14`.

- [ ] **Step 1: Generate the JSON**

Run: `npm run gmat:collect`
Expected: `src/lab/gmat-transfers.json` with four missions.

- [ ] **Step 2: Write the failing tests in `tests/lab.test.ts`**

```ts
import transfers from '../src/lab/gmat-transfers.json';
describe('GMAT mission numbers', () => {
  it('rounds up to the next tenth, leaving exact tenths alone', () => {
    expect(needFromGmat(3.11)).toBe(3.2);
    expect(needFromGmat(3.1)).toBe(3.1);
    expect(needFromGmat(3.1000000004)).toBe(3.1);
  });
  it('every mission takes its journey figure from GMAT', () => {
    for (const p of profiles) {
      expect(p.transferNeed).toBe(needFromGmat(transfers.missions[p.id as keyof typeof transfers.missions].total));
      expect(p.deltaVNeed).toBeCloseTo(LAUNCH_DV + p.transferNeed, 6);
    }
  });
  it('a launch saved before the update that is now short stays short', () => {
    const p = profiles.find((x) => x.id === 'saturn')!;
    expect(launchMeetsMission(p, { orbit: true, left: p.transferNeed - 0.05, guided: false })).toBe(false);
  });
  it('the credit names GMAT, its version and the date', () => {
    expect(gmatCredit).toContain('GMAT'); expect(gmatCredit).toContain(transfers.gmat.version); expect(gmatCredit).toContain(transfers.gmat.computed);
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `npx vitest run tests/lab.test.ts`
Expected: FAIL, `needFromGmat` and `gmatCredit` not exported.

- [ ] **Step 4: Implement in `src/lab/catalog.ts`**

`resolveJsonModule` is already on in `tsconfig.json`. Keep `transferNeed`/`deltaVNeed` on `Profile`; only their values change.

- [ ] **Step 5: Run the whole suite; rebalance Saturn if its baseline stops flying**

Run: `npx vitest run`
Expected: all pass. If "every mission baseline" fails for Saturn because `remainingDv` is below the new `transferNeed`, raise the ion drive's xenon (`prop` on the `ion` part, keeping `mass` = dry + prop with dry 0.35 t) or add a tank to the Saturn baseline, the smallest change that passes, while budget and mass stay within the Saturn profile's limits. Re-run until green.

- [ ] **Step 6: Show the credit**

In `briefPanel`, under each mission card's science line, add `h('small', { class: 'gmat-credit' }, …)` with `Δv to target: ${transferNeed} km/s · NASA GMAT`; for Saturn append ` (direct route; real missions use gravity assists)`. Add the matching French entries to the `FR` dictionary. In `dataScreen` (`src/main.ts`), add the row `['Mission Lab Δv to target', gmatCredit, 'verified', 'Scripts and outputs in gmat/; parking orbit 200 km']`.

- [ ] **Step 7: Check in the browser**

Run: `npm run build && npx vite preview`, open the Mission Lab in English and French and the Data and sources screen.
Expected: each card shows its GMAT figure and credit in both languages; the Data and sources row is present; "Load engineering baseline" then the autopilot still reaches orbit with the Saturn mission.

- [ ] **Step 8: Commit**

```bash
git add src/lab/gmat-transfers.json src/lab/catalog.ts src/missionlab.ts src/missionlab.css src/main.ts tests/lab.test.ts
git commit -m "Mission Lab journey targets come from GMAT"
```

---

### Task 5: Apollo 11 burns in the campaign report

**Files:**
- Create: `src/data/apollo11.ts` (NASA-published figures with citations)
- Create: `gmat/apollo11.script`; generated `gmat/output/apollo11.txt`, `src/data/apollo11-gmat.json`
- Modify: `src/data/index.ts` (export), `src/main.ts` (`report()` "What really happened" section, `dataScreen` rows)
- Test: `tests/apollo11.test.ts`

**Interfaces:**
- Produces: `apollo11Burns: Apollo11Burn[]` where `Apollo11Burn = { id: 'tli' | 'loi1' | 'loi2'; label: string; labelFr: string; nasa: number /* m/s */; source: { title: string; id: string; page: string } }`.
- Produces: `apollo11Parking: { apogeeKm: number; perigeeKm: number; source: … }` and `apollo11LunarOrbit: { apoKm: number; periKm: number; source: … }` (the targets the GMAT script uses).
- Produces: `apollo11Explanations: Partial<Record<Apollo11Burn['id'], string>>` — the written cause for any burn where GMAT and NASA differ by more than 5%.
- Consumes: `src/data/apollo11-gmat.json` (`burns` keyed `tli`, `loi1`, `loi2`, m/s) from the collector (Task 1).

- [ ] **Step 1: Gather NASA's figures**

From the *Apollo 11 Mission Report* (MSC-00171) and *Apollo by the Numbers* (SP-2000-4029): the Earth parking orbit, the delta-v of the trans-lunar injection and of both lunar orbit insertion burns, and the lunar orbit after each insertion burn. Convert ft/s to m/s (× 0.3048) and record the original unit and page in a comment beside each value in `src/data/apollo11.ts`.

- [ ] **Step 2: Write the failing tests**

```ts
describe('Apollo 11 burns', () => {
  it('every burn cites a NASA publication and page', () => {
    for (const b of apollo11Burns) { expect(b.nasa).toBeGreaterThan(0); expect(b.source.title).toMatch(/Apollo/); expect(b.source.page).not.toBe(''); }
  });
  it('GMAT recomputed every burn', () => {
    for (const b of apollo11Burns) expect(gmat.burns[b.id]).toBeGreaterThan(0);
  });
  it('any burn more than 5% off NASA has a written cause', () => {
    for (const b of apollo11Burns) {
      const off = Math.abs(gmat.burns[b.id] - b.nasa) / b.nasa;
      if (off > 0.05) expect(apollo11Explanations[b.id], `${b.id} is ${(off * 100).toFixed(1)}% off`).toBeTruthy();
    }
  });
});
```
with `import gmat from '../src/data/apollo11-gmat.json'`.

- [ ] **Step 3: Run them to make sure they fail**

Run: `npx vitest run tests/apollo11.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Write `gmat/apollo11.script` and run it**

Start from `apollo11Parking` (values copied into the script with the same citation comment); Earth, Moon and Sun point masses. Trans-lunar injection: achieve the lunar periapsis of the first lunar orbit; first insertion burn: achieve that orbit's apoapsis; second insertion burn: achieve the second orbit. Report `dv_tli`, `dv_loi1`, `dv_loi2` in m/s.
Run: `bash gmat/run.sh apollo11 && npm run gmat:collect`
Expected: `src/data/apollo11-gmat.json` with three positive burns.

- [ ] **Step 5: Implement `src/data/apollo11.ts` and export it from `src/data/index.ts`**

If a burn is over 5% off, write its cause in `apollo11Explanations` (for example: the real burns were finite, lasting minutes, while the script's burns are instant) and tell the team in the task report.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Show it in the report**

In `report()`'s "What really happened" details, after the summary paragraphs, add a table: burn label, NASA figure (m/s), GMAT recomputation (m/s), difference (%), and a source line naming the publication and page. The headline number is always NASA's. In `dataScreen`, add one row per publication with status `verified`. Leave `history.source.status` as `placeholder`: the other history notes are not checked yet. Add French strings via `uiText`.

- [ ] **Step 8: Check in the browser**

Run: `npm run build && npx vite preview`; play the campaign with `?quick=1` through to the report.
Expected: the Apollo 11 table appears with NASA and GMAT figures and sources; the campaign plays exactly as before.

- [ ] **Step 9: Commit**

```bash
git add src/data/apollo11.ts src/data/apollo11-gmat.json src/data/index.ts gmat/apollo11.script gmat/output/apollo11.txt src/main.ts tests/apollo11.test.ts
git commit -m "Show NASA's Apollo 11 burns beside GMAT's recomputation in the report"
```
