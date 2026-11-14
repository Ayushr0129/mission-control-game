# Space Bar · Orbital Systems Lab

Chapter 1: Race to the Moon. A browser game for NASA Space Apps Challenge, Port Louis, Mauritius.

The game now has two connected experiences:

- **Orbital Systems Lab** is a modern mission-engineering sandbox. Choose an Earth, Moon, Mars or Saturn objective; assemble a launch vehicle component by component; manage live budget, wet-mass, power and delta-v margins; fly an RCS proximity approach; dock; deploy a relay satellite, rover or deep-space probe; and review the engineering evidence in a post-mission report.
- **Race to the Moon** preserves the original 1960s campaign. Make programme decisions, build the historical mission architecture and manually fly launch, lunar-orbit insertion and landing.

The new visual direction uses restrained flight-software typography, measured colour, technical gridwork and physically readable spacecraft views instead of a cartoon interface.

Built with TypeScript, Vite and three.js.

## Mission Lab

Choose a mission (Earth, Moon, Mars or Saturn), build a rocket, fly it to orbit, dock, deploy the payload, and get a debrief that scores what you actually did.

### Building the rocket

- Parts stack bottom first. Drag them into a gap in the stack, click a palette part to add another copy, and use the arrows or drag to reorder.
- The physics is real-scale. Each engine burns the propellant in the tanks stacked above it, up to the next engine. Spent stages drop away, and the fairing goes at the first staging. Delta-v comes from the rocket equation, stage by stage, so the order and mass of the stack matter. A tank with no engine below it is dead weight.
- The engineering panel lists every stage with its delta-v and thrust-to-weight.
- Solar arrays are rated at 1 AU, and their output falls with the square of distance from the Sun. Far missions need an RTG or a reactor.
- Flight is locked until the budget, mass, power, delta-v and liftoff thrust-to-weight (at least 1.2) are all within limits. **Load engineering baseline** gives a known-good rocket for each mission. Mars and Saturn rely on the ion drive.

### Flying to orbit

- Reach an orbit whose lowest point is above 150 km, with enough delta-v left for the mission's journey. The planet is a real-size Earth with no atmosphere.
- Keys: **A/D** or **←/→** lean, **W/S** or **↑/↓** throttle, **Z** full throttle, **X** cut, **Space** stage, **M** map, **,** and **.** time warp. On-screen buttons do the same for a mouse or a finger.
- The dashed line and the coach show what guidance would do. **Autopilot** flies the tested guidance, but scores less than flying it yourself.

### Docking and payload

- Docking uses **W/A/S/D** to translate and **Q/E** to rotate. Capture needs range under 8 m, closure under 0.20 m/s and alignment under 5°. Running out of RCS propellant ends the attempt. **Run guided approach** shows the technique, for fewer points.
- Payload deployment unlocks after orbit and docking, once every checklist item is green.
- Changing the rocket clears its launch, docking and deployment, so they have to be flown again.
- The debrief scores the vehicle (20), margins (15), launch (25), docking (20) and payload (20).

### Elsewhere in the lab

- The planetary observatory: drag to orbit the camera, and click a planet to fly to it. WebXR works on a compatible HTTPS-served browser and headset.
- **EN/FR** and **Light/Dark** controls sit on the title screen and the lab toolbar. Light applies to the title and the lab; the campaign stays dark.
- Designs and the flight-director log are saved locally in the browser. No account or network connection is needed.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Other commands

- `npm run build` checks the types and builds a static site into `dist/`. You can host that folder on GitHub Pages, Netlify or itch.io.
- `npm test` runs the simulation, flying and session tests, including the Mission Lab's physics. Every mission's baseline is flown to orbit by the autopilot.
- `npm run e2e` plays the whole game in Chrome, by autopilot and by a scripted pilot. Start `npm run dev` first.

## How to play

- **Decide.** Three story decisions: funding, the schedule, and what to do after a cabin fire. Hold a choice to commit to it.
- **Build.** Six spots on the rocket: lander, docking, power, antenna, science and the spent stage. Click a spot, then a part. Swap freely until you roll out. A lighter ship has more landing fuel.
- **Fly.** Three controls, the same in every moment: turn with ← → (or A D), hold the space bar for the engine, set the throttle with ↑ ↓ (or W S). On-screen buttons do the same for a mouse or a finger. Each moment starts with a short "how to" card, and a coach at the side lights the step you are on.
  - Liftoff: hold the engine, turn to stay on the guide arrow as it leans over, and when the first stage runs dry let go and press again to light the next.
  - Moon orbit: turn the ship around to the arrow, hold the engine, and let go when the speed is inside the green band.
  - Landing: cancel your sideways speed, turn upright, brake before the ground. The numbers beside the lander turn green when they are safe. A bad first try aborts back up for one more.
- Let go of the turn keys near the guide arrow and the craft settles onto it.
- Each flying moment has a "Let the autopilot fly" link.

## URL options

- `?intro=1` always plays the intro.
- `?seed=21` gives a repeatable run.
- `?quick=1` lets you lock in a choice with a single click instead of holding it, and hands the flying to the autopilot.
- `?fly=1` with `?quick=1` keeps the flying in your hands.
- `?fast` speeds up the launch, for testing.
- `?practice=liftoff`, `?practice=orbit` and `?practice=landing` go straight to that moment and back to it every time, for learning the controls. Nothing is saved.

## Where things are

- `src/main.ts`: the screens and game flow.
- `src/data/`: the story, the questions, events, endings and the chapter settings.
- `src/lab/`: the Mission Lab rules. `catalog.ts` holds the parts, missions, readiness and score; `physics.ts` the staging and rocket equation; `launch.ts` the flight to orbit and its autopilot; `launchview.ts` the flight on screen.
- `src/sim/`: the historical campaign's simulation, which decides whether the mission works. `ascent.ts`, `orbit.ts` and `landing.ts` hold every rule and number for the flying.
- `src/three/`: the 3D launch pad, rocket and spacecraft, `flight.ts` (the flight you fly) and `landerview.ts` (the side view of the landing).
- `src/ui/`: meters, sound, the flying controls (`flycontrols.ts`) and the flying overlays (`flyhud.ts`).
- `public/textures/`: drop real NASA imagery here, credited to NASA.
