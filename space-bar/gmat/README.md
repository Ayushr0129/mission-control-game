# GMAT R2026a

The campaign report's Apollo 11 figures, and journey figures for an Earth-orbit and a Moon-orbit mission, are computed
with NASA's General Mission Analysis Tool (GMAT), offline, by the scripts in this folder. The game never runs GMAT: it
ships the Apollo 11 results (`src/data/apollo11-gmat.json`), and the tests check the game matches them. The other
missions' results are kept in `gmat/transfers.json` as a record; the game does not use them.

- GMAT version: **R2026a** (console build of 30 March 2026), Linux build `gmat-rhel7-x64-R2026a.tar.gz` from
  https://sourceforge.net/projects/gmat/ (Apache 2.0 licence).
- Installed outside the repo, at `~/opt/gmat/GMAT/R2026a` (it is hundreds of MB). Set `GMAT_HOME` to use another place.
- Runs natively on Fedora 44. The MATLAB and 3D-graphics plugins fail to load in console mode; they are not used.
- **Keep script paths short.** GMAT R2026a crashes (segmentation fault) on a long script path; `run.sh` copies each
  script to a short temporary path first. GMAT also needs one statement per line.

## Running

```bash
npm run gmat                 # every script, then the collector
bash gmat/run.sh moon        # one script only (no collection)
npm run gmat:collect         # rebuild the JSON from gmat/output/ without running GMAT
```

Each `<name>.script` writes `gmat/output/<name>.txt`: a header row of names and a row of numbers. Columns starting
`dv_` are burns. The collector refuses to write anything if a report is missing or malformed.

On Windows or macOS, run each script in GMAT with the `@OUT@` placeholder in its `Filename` line replaced by the full
path of this folder's `output/`, then run `npm run gmat:collect`.

## Scripts

| Script | What it computes |
|---|---|
| `smoke.script` | One orbit from 200 km, to check GMAT runs |
| `earth.script` | 200 km circular orbit to 705 km circular orbit, two burns |
| `moon.script` | 200 km orbit to a 100 × 3,000 km lunar orbit: trans-lunar injection and lunar orbit insertion |
| `apollo11.script` | Apollo 11's trans-lunar injection and both lunar orbit insertion burns, from NASA's published orbits |

Assumptions common to all: impulsive (instant) burns; the game's launch is planar, so plane changes are not counted;
the parking orbit is 200 km circular, about what the game's autopilot reaches.
