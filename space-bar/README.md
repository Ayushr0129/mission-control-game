# Space Bar

Chapter 1: Race to the Moon. A browser game for NASA Space Apps Challenge, Port Louis, Mauritius.

You run a 1960s Moon program. You make three decisions, build the rocket on the pad part by part, and fly the mission yourself, on Apollo 11's real path: liftoff, the burn out of Earth orbit, the coast to the Moon in time warp, the burn into Moon orbit, the landing, the burn for home and the entry corridor. Real NASA history is behind it, and the report checks Apollo 11's burns against NASA's GMAT trajectory software.

Built with TypeScript, Vite and three.js.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Other commands

- `npm run build` checks the types and builds a static site into `dist/`. You can host that folder on GitHub Pages, Netlify or itch.io.
- `npm test` runs the simulation, flying, session, achievements and GMAT-data tests.
- `npm run gmat` reruns the NASA GMAT scripts (needs GMAT installed, see `gmat/README.md`) and rebuilds the data from their output. `npm run gmat:collect` rebuilds the data from the saved output without running GMAT.
- `npm run e2e` plays the whole game in Chrome, by autopilot and by a scripted pilot. Start `npm run dev` first.
- `npm run trajectory` recomputes the trip to the Moon and back (`src/data/trajectory.json`). The tests check the shipped file matches a fresh solve.

## How to play

- **Decide.** Three story decisions: funding, the schedule, and what to do after a cabin fire. Hold a choice to commit to it.
- **Build.** Six spots on the rocket: lander, docking, power, antenna, science and the spent stage. Click a spot, then a part. Swap freely until you roll out. A lighter ship has more landing fuel.
- **Fly.** Three controls, the same in every moment: turn with ← → (or A D), hold the space bar for the engine, set the throttle with ↑ ↓ (or W S). On-screen buttons do the same for a mouse or a finger. Each moment starts with a short "how to" card, and a coach at the side lights the step you are on.
  - Liftoff: hold the engine, turn to stay on the guide arrow as it leans over, and when the first stage runs dry let go and press again to light the next. The readout shows Apollo 11's numbers: 185 km up at 7.79 km/s, 11 minutes 49 seconds after liftoff.
  - Leaving Earth orbit: point forward along the orbit, hold the engine, and let go when the speed reaches the green band, about 10.8 km/s. The map shows the orbit stretching out to the Moon.
  - The coast: about three days, watched on a map of the Earth and Moon at true distances, with the mission clock running and time warp (‹ › buttons, or , and .). Short lines explain why the speed falls to about 1 km/s and then rises again. Esc skips ahead.
  - Moon orbit: turn the ship around to the arrow, hold the engine, and let go when the speed is inside the green band. If you do not burn at all, the free return swings the ship round the Moon and home without landing: the crew is safe, but the mission is an abort.
  - The burn for home: point forward along the lunar orbit and burn up to the speed that falls back to the Earth.
  - The entry corridor: a needle shows the angle you will hit the atmosphere at, against the corridor of -7.5° to -5.5°. Turn to the arrow and burn to move it into the green. Left alone, guidance makes the correction; burned out of the corridor, the crew is lost. Then re-entry plays out: the heat, the blackout, the parachutes, splashdown.
  - Landing: cancel your sideways speed, turn upright, brake before the ground. The numbers beside the lander turn green when they are safe. A bad first try aborts back up for one more.
- Let go of the turn keys near the guide arrow and the craft settles onto it.
- Each flying moment has a "Let the autopilot fly" link.

### Achievements

The historical campaign has 13 achievements. The **Achievements** button on the title screen shows them all, and an "Achievement earned" card pops up on the report after a flight that earns one. They are saved in this browser, and **Forget everything** clears them.

- **Landing:** The Eagle has landed; First try (land on your first run); Picture perfect (clean liftoff, clean Moon orbit, first-try landing); Rough ground (land in the highlands); On fumes (land with under 10% fuel); Hands on the stick (land without the autopilot ever flying); By the book (every decision as NASA made it); Back from the brink (land after a failed run).
- **Failure:** Signal lost, Lights out, Vehicle lost and Too fast, one for each way the mission can fail, each showing how to avoid it; Seen it all, for all four. The free return and a missed entry corridor have their own endings but no achievements.
- `?quick=1` runs and `?practice=` runs earn nothing. The autopilot's flying is marked fair, so Picture perfect needs hand flying.

## URL options

- `?intro=1` always plays the intro.
- `?seed=21` gives a repeatable run.
- `?quick=1` lets you lock in a choice with a single click instead of holding it, and hands the flying to the autopilot. Runs with it earn no achievements.
- `?fly=1` with `?quick=1` keeps the flying in your hands.
- `?fast` speeds up the launch, for testing.
- `?practice=liftoff`, `?practice=orbit` and `?practice=landing` go straight to that moment and back to it every time, for learning the controls. Nothing is saved.

## Where things are

- `src/main.ts`: the screens and game flow.
- `src/data/`: the story, the questions, events, endings and the chapter settings.
- `src/sim/`: the historical campaign's simulation, which decides whether the mission works. `ascent.ts`, `orbit.ts` (the three speed burns), `corridor.ts` and `landing.ts` hold every rule and number for the flying. `cr3bp.ts` and `trip.ts` compute the trajectory: a planar Earth-Moon three-body model integrated with RK4, tuned to Apollo 11's injection speed, its 111 km pass over the Moon and its entry at -6.48°.
- `src/three/`: the 3D launch pad, rocket and spacecraft, `flight.ts` (the flight you fly; the trip map is `src/ui/mapview.ts`) and `landerview.ts` (the side view of the landing).
- `src/ui/`: meters, sound, the flying controls (`flycontrols.ts`) and the flying overlays (`flyhud.ts`).
- `src/prefs.ts`: the English / French switch on the title screen.
- `gmat/`: the NASA GMAT scripts, their saved output and a README on rerunning them. `src/gmat/collect.ts` turns the output into data. Apollo 11's figures are shown in the campaign report (`src/data/apollo11-gmat.json`); an Earth-orbit and a Moon-orbit journey are kept in `gmat/transfers.json` as a record.
- `src/game/achievements.ts`: the campaign achievements' rules and storage. `src/ui/achievements-ui.ts` draws the pop-up and the title-screen panel; the badges are SVGs in `src/ui/badges/`, drawn by Codex from `src/ui/badges/BRIEF.md`.
- `public/textures/`: drop real NASA imagery here, credited to NASA.
