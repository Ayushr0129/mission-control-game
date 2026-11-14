# Space Bar · Orbital Systems Lab

Chapter 1: Race to the Moon. A browser game for NASA Space Apps Challenge, Port Louis, Mauritius.

The game now has two connected experiences:

- **Orbital Systems Lab** is a modern mission-engineering sandbox. Choose an Earth, Moon, Mars or Saturn objective; assemble a launch vehicle component by component; manage live budget, wet-mass, power and delta-v margins; fly an RCS proximity approach; dock; deploy a relay satellite, rover or deep-space probe; and review the engineering evidence in a post-mission report.
- **Race to the Moon** preserves the original 1960s campaign. Make programme decisions, build the historical mission architecture and manually fly launch, lunar-orbit insertion and landing.

The new visual direction uses restrained flight-software typography, measured colour, technical gridwork and physically readable spacecraft views instead of a cartoon interface.

Built with TypeScript, Vite and three.js.

## Mission Lab controls

- Assemble the vehicle by fitting and removing individual structure, propulsion, guidance, power, communications and payload components. The integration bay shows the actual stack order.
- Watch budget, mass, power and delta-v continuously. Flight remains locked until every mission-critical requirement and margin is satisfied.
- During docking, use **W/A/S/D** for RCS translation and **Q/E** for rotation. Safe capture requires range under 8 m, relative speed under 0.20 m/s and alignment under 5°. **Run guided approach** demonstrates the correct burn-and-cancel technique.
- Use the **EN/FR** and **Light/Dark** controls on the title screen or Mission Lab toolbar. Both preferences persist locally between visits.
- Guided approach acknowledges the command immediately, flies the rendezvous at a short training pace, and reports soft capture plus remaining RCS propellant.
- Payload operations verify separation, telemetry, power and payload compatibility before deployment.
- The planetary observatory uses a live three.js scene with compressed visual spacing and labelled real reference values. On a compatible HTTPS-served browser and headset, its WebXR control enters immersive VR; other browsers retain the interactive on-screen observatory.
- Mission designs and the flight-director log persist locally in the browser. No account or network connection is required for the simulation.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Other commands

- `npm run build` checks the types and builds a static site into `dist/`. You can host that folder on GitHub Pages, Netlify or itch.io.
- `npm test` runs the simulation, flying and session tests.
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
- `src/sim/`: the simulation that decides whether the mission works. `ascent.ts`, `orbit.ts` and `landing.ts` hold every rule and number for the flying.
- `src/three/`: the 3D launch pad, rocket and spacecraft, `flight.ts` (the flight you fly) and `landerview.ts` (the side view of the landing).
- `src/ui/`: meters, sound, the flying controls (`flycontrols.ts`) and the flying overlays (`flyhud.ts`).
- `public/textures/`: drop real NASA imagery here, credited to NASA.
