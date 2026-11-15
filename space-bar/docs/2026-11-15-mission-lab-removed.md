# The Mission Lab was removed (15 November 2026)

The team decided the project is the historical campaign, its achievements, and the GMAT work. The "Orbital Systems Lab" game mode was removed.

## Kept

- The campaign: the three decisions, the build screen, and the flown liftoff, orbit burn and landing.
- The 13 achievements and their badges.
- Everything in `gmat/`: all the scripts and their saved output, the README, `run.sh` and `porkchop.py`.
- Apollo 11's burns beside GMAT's recomputation in the campaign report, and their rows on the Data and sources screen.
- The English / French switch. It moved from the Lab's file into `src/prefs.ts`.

## Removed

- `src/lab/`, `src/missionlab.ts`, `src/missionlab.css`, and the Lab's tests (`tests/lab.test.ts`, `tests/physics.test.ts`).
- The title screen's "Open Mission Lab" button. "Take the job" is the main button again.
- The light theme. It only applied to the title screen and the Lab.
- The Mission Lab row on the Data and sources screen.

## Moved

- The GMAT collector's code: `src/lab/gmat/collect.ts` is now `src/gmat/collect.ts`.
- The Earth, Moon, Mars and Saturn results: `src/lab/gmat-transfers.json` is now `gmat/transfers.json`. They are kept as a record. The game no longer imports them.

## Older documents

The achievements and GMAT specs and plans from 14 November mention the Lab. They are left as written, as a record of what was decided at the time.
