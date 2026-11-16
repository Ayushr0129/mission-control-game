# Space Bar

**Build a spacecraft. Fly a real trajectory. Learn why missions succeed.**

Space Bar is a bilingual educational space-mission game for students ages 10–16. It combines a part-by-part vehicle builder, mission management, historical campaigns, docking and payload operations with a deterministic SI-unit flight simulation.

The project was created for the NASA International Space Apps Challenge. It is an independent educational project and is not affiliated with or endorsed by NASA.

## What students can do

- Configure and fly a guided Saturn V mission from the launch pad to a stable Earth orbit.
- Assemble rockets from individual engines, tanks, interstages, fairings, fins, landing equipment, control systems and payload components.
- Attach repeated parts and build laterally as well as vertically for boosters, satellites, stations and rovers.
- Compare payload mass, launch mass, thrust-to-weight ratio, delta-v, power and mission cost.
- Fly manually with throttle, attitude, staging and RCS controls, or enable optional guidance.
- Observe drag, Max-Q, changing mass, gravity turns, staging, apoapsis, periapsis and orbital insertion.
- Practice rendezvous and docking, deploy scientific payloads and construct modular orbital vehicles.
- Explore five data-driven spacecraft presets: Saturn V, Falcon 9, Falcon Heavy, Space Shuttle Discovery and Starship.
- Play a historical Moon-race campaign with mission decisions, achievements, stories and sourced mission data.
- Use the game in English or French, in light or dark mode.

No account is required. Designs, preferences, achievements and supported mission progress are stored locally in the browser.

## Guided Orbit Mission

The recommended starting point is **Start Guided Orbit Mission**. It is a short classroom-friendly path through the complete engineering loop:

1. Read the mission objective.
2. Choose a payload and review its effect on mass, cost and TWR.
3. Launch a part-assembled Saturn V using the real flight model.
4. Follow a visible checklist through liftoff, gravity turn, Max-Q, staging and orbit.
5. Review maximum altitude and speed, remaining fuel, periapsis, drag loss and gravity loss.
6. Replay the flight or change the payload to compare the result.

Assisted flight runs at accelerated simulation time but uses the same fixed-step physics as manual flight. The full sandbox, historical campaign, achievements, docking, mission data and free-flight tools remain available under **Explore all game modes**.

## Flight model

The current ascent simulation is UI-independent, deterministic and calculated in SI units. It includes:

- thrust along the vehicle body axis;
- propellant mass flow using engine thrust and specific impulse;
- inverse-square gravity;
- altitude-dependent atmosphere and aerodynamic drag opposing air-relative velocity;
- Earth-rotation velocity at the launch site;
- changing vehicle mass and stage separation;
- part-derived diameter, drag coefficient and engine performance;
- rate-limited steering and an optional gravity-turn pilot;
- dynamic pressure and structural-limit checks;
- state-vector orbit calculations for apoapsis, periapsis, eccentricity and period;
- stable-orbit detection based on periapsis rather than altitude alone.

See [`space-bar/docs/PHYSICS.md`](space-bar/docs/PHYSICS.md) for equations, constants, assumptions and sources.

## Run locally

The current game lives in [`space-bar/`](space-bar/).

### Requirements

- Node.js 20 or newer
- npm
- A modern desktop or mobile browser

```bash
cd space-bar
npm install
npm run dev
```

Open the local address printed by Vite, normally <http://localhost:5173>.

### Useful commands

```bash
npm run lint       # TypeScript checks
npm test           # Vitest unit and simulation tests
npm run build      # Type-check and create the production build in dist/
npm run preview    # Preview the production build
npm run e2e        # Browser flow test; start the dev server first
```

Additional trajectory and GMAT commands are documented in [`space-bar/README.md`](space-bar/README.md) and [`space-bar/gmat/README.md`](space-bar/gmat/README.md).

## Controls

### Real-flight ascent

| Input | Action |
| --- | --- |
| `Space` | Hold engine thrust |
| `↑` / `↓` | Increase or decrease throttle |
| `←` / `→` | Rotate the vehicle |
| `Enter` | Separate a depleted stage |
| `T` | Change flight assist |
| `M` | Toggle the orbital map |

### Docking

| Input | Action |
| --- | --- |
| `W` / `A` / `S` / `D` | RCS translation |
| `Q` / `E` | Rotation |

Touch and on-screen controls are provided where applicable. Each flight lesson also includes contextual explanations and optional assistance.

## Technology

- TypeScript
- Vite
- Three.js and WebGL
- HTML and CSS
- Vitest
- Browser local storage
- Optional WebXR on compatible HTTPS-served browsers and headsets
- NASA GMAT reference scripts and saved comparison output

The simulation, data/domain layer and UI are separated so that flight behavior can be tested without rendering the game.

## Project structure

```text
space-bar/
├── src/
│   ├── data/          spacecraft, parts, missions, story and sourced truth data
│   ├── domain/        immutable vehicle calculations and simulation domain
│   ├── sim/           ascent, orbit, landing and trajectory solvers
│   ├── three/         Three.js scenes and flight rendering
│   ├── ui/            builder, campaign, guided mission, reports and controls
│   ├── main.ts        application flow and title screen
│   └── prefs.ts       language and theme preferences
├── tests/             physics, campaign, data, visuals and session tests
├── data/sources/      source registry and supporting references
├── docs/              physics, design and data-audit documentation
├── gmat/              GMAT scripts and saved comparison data
└── public/            static assets
```

## Data and educational design

Rocket dimensions, mission records and truth-layer values are kept separate from simulation results. Source records include document, location, retrieval date and status. Approximate or placeholder values remain labelled instead of being presented as verified facts.

The game is designed to make engineering trade-offs visible rather than hide them behind a success button. A heavier payload changes acceleration and fuel margin. Empty stages must be discarded. Vertical altitude alone does not create orbit; students must build sufficient horizontal speed while controlling atmospheric and gravity losses.

Educational explanations are optional and event-driven. They appear when real simulation events occur, including liftoff, drag, Max-Q, staging and stable orbit.

## Accuracy and limitations

Space Bar is an educational simulator, not certified mission-design software. Important simplifications include:

- patched-conic/two-body approximations instead of a complete n-body ephemeris;
- simplified attitude, RCS, heating, reliability and communications models;
- impulsive or compressed classroom transitions in selected campaign phases;
- no aerodynamic lift model;
- accelerated time in guided lessons.

These simplifications are documented and are kept separate from sourced historical measurements. The project should not be used for operational aerospace decisions.

## Historical campaign and other modes

The historical campaign includes briefings, vehicle selection, an encyclopedia, the rocket editor, launch confirmation, flight and results. Players can navigate back through appropriate campaign windows before committing irreversible actions. Confirmed mission transitions are autosaved.

The complete game also retains:

- the Mission Lab construction sandbox;
- campaign stories and achievements;
- the five prebuilt vehicle database;
- manual real-flight mode;
- docking and guided rendezvous practice;
- satellites, rovers and orbital construction;
- planetary and spacecraft learning views;
- data-and-sources pages;
- post-flight educational reports.

## Legacy Flutter prototype

The repository root also contains the earlier Flutter/Flame **Mission Control — Beyond the Launch** prototype (`lib/`, `android/`, `ios/`, `web/` and `pubspec.yaml`). It is preserved for reference, but the actively developed Space Bar game and the version described in this README are in [`space-bar/`](space-bar/).

## Credits and sources

Detailed source attribution is available inside the game under **Data and sources**, and in:

- [`space-bar/data/sources/`](space-bar/data/sources/)
- [`space-bar/docs/DATA-TODO.md`](space-bar/docs/DATA-TODO.md)
- [`space-bar/docs/PHYSICS.md`](space-bar/docs/PHYSICS.md)
- [`space-bar/gmat/README.md`](space-bar/gmat/README.md)

Historical names and spacecraft remain the property of their respective organizations. Project code, game systems and original interface assets are provided through this repository.
