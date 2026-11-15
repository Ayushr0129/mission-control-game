# GMAT-computed mission numbers: design

Status: approved 2026-11-14 (Mission Lab numbers and Apollo 11 in the campaign report).

## Intent

The Mission Lab's journey targets (delta-v needed after reaching low Earth orbit) are textbook approximations today.
Compute them with NASA's General Mission Analysis Tool (GMAT), ship the results as data, and credit GMAT in the game,
so that judges at NASA Space Apps see the numbers come from NASA's own trajectory software.

## Goals

- One GMAT script per mission computing the delta-v from a 200 km circular low Earth orbit to the mission's
  target orbit, using GMAT's propagators and targeting, not hand formulas.
- The results go into the game as data; `transferNeed` and `deltaVNeed` for each mission come from them.
- The scripts and their outputs live in the repo, so a teammate can rerun them and get the same numbers.
- The game credits GMAT where the numbers are shown.

## Non-goals

- GMAT never runs in the browser or at play time: the game stays a static, offline page.
- No new flight step. Transfers stay a number to meet (option 2, a playable transfer, comes later).
- The launch to orbit keeps its own simulation and its 9.4 km/s allowance: GMAT is not an ascent tool.
- The historical campaign's flying stays game-scale and untouched. GMAT reaches the campaign only through its
  history (see "Apollo 11 in the campaign report" below).

## Anti-goals

- Numbers that look official but are not reproducible. Every value must trace to a script in the repo.
- A baseline that no longer flies. Every mission's engineering baseline must still pass the existing
  autopilot test with the GMAT figure.

## Approaches considered

1. **GMAT sets the game's numbers** (chosen): offline scripts, results shipped as data, credited in the game.
   Small, low risk, makes the existing game more credible.
2. GMAT trajectories as a playable transfer step: medium to large; deferred, and builds on approach 1.
3. GMAT data in the observatory: visual only, no gameplay; dropped.

## What each script computes

| Mission | From | To | Burns |
|---|---|---|---|
| Earth Climate Watch | 200 km circular LEO | 705 km circular orbit | two-burn transfer |
| Lunar Far-Side Relay | 200 km circular LEO | 100 × 3,000 km lunar orbit | trans-lunar injection, lunar orbit insertion |
| Mars Sample Scout | 200 km circular LEO | Mars entry (heat-shield landing) | trans-Mars injection in the late-2026 window; no capture burn |
| Saturn Ring Surveyor | 200 km circular LEO | Saturn capture orbit | departure burn and Saturn orbit insertion, direct transfer |

## Decisions (builder's calls, open to correction)

- **Saturn uses a direct transfer.** Real missions use gravity assists, which are much harder to set up and verify
  in GMAT. The direct figure will be higher than today's 5.9 km/s, so the Saturn baseline gets more propellant
  (for example more xenon) until it flies again. The game notes that real missions save fuel with assists.
- **Simplifications are stated in the scripts and the data:** planar game launch, impulsive burns, and the
  200 km parking orbit matching what the autopilot reaches.
- **Rounding:** each figure is rounded up to 0.1 km/s; `deltaVNeed` = launch allowance (9.4) + `transferNeed`.
- **Layout:** scripts in `gmat/` with a README on how to rerun them; results in `src/lab/gmat-transfers.json`,
  which the parts catalog imports; a unit test checks the catalog matches the file.
- **Credit:** a line on each mission card and rows on the Data and sources screen, naming GMAT, its version and
  the date the numbers were computed.

## Apollo 11 in the campaign report

Why: the hackathon is NASA Space Apps, and the team wants the game's data as accurate as possible and traceable
to NASA. The campaign's "What really happened" section is hand-entered and marked placeholder today.

- **Sources:** the burn figures come from NASA's own publications, chiefly the *Apollo 11 Mission Report*
  (NASA MSC-00171, 1969) and *Apollo by the Numbers* (NASA SP-2000-4029), cited by title and page.
- **GMAT script:** `gmat/apollo11.script` starts from Apollo 11's published Earth parking orbit and recreates the
  trans-lunar injection and the lunar orbit insertion burns, targeting the published lunar orbit.
- **In the game:** the report's "What really happened" section gains a short table of Apollo 11's two big burns:
  NASA's published delta-v beside GMAT's recomputation. The Data and sources screen lists both sources; the
  history source moves from "placeholder" to "verified" only for what was actually checked against NASA.
- **How the campaign plays does not change:** no numbers in its flying or scoring move.
- **Honesty rule:** if GMAT's recomputation and NASA's published figure differ by more than a few percent, the
  game shows NASA's figure, the script records the difference and its likely cause (for example the real burns
  were finite, not instant), and the team is told before anything ships.
- **Out of scope here:** checking the campaign's other placeholder facts (cabin fire, budgets, landing site,
  and so on) against NASA. Worth doing next; it needs no GMAT.

## Constraints and risks

- GMAT is a desktop app built for Windows, macOS and Ubuntu; this machine runs Fedora 44. If the Linux build does
  not run directly, run it in a container with an Ubuntu image, or, failing that, ask a teammate on Windows or
  macOS to run the scripts. The scripts stay the same either way.
- GMAT's download is large (hundreds of MB) and goes outside the repo.
- GMAT is Apache 2.0 licensed; crediting NASA's GMAT for computed values is sufficient.

## Left to the builder

The exact GMAT targeting setup in each script (which variables the targeter varies, tolerances, the Mars launch
date inside the window), as long as it is documented in the script.
