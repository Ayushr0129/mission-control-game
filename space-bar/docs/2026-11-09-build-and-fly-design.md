# Space Bar: build it and fly it

Design, 9 November 2026. Status: waiting for approval. Nothing here is built yet.

## Why

Today the game is twelve decision screens followed by a flight you only watch. The player should instead build the spacecraft with their own hands and fly it themselves, the way Spaceflight Simulator lets you. It must stay easy to pick up: a visitor at NASA Space Apps (Port Louis, 14–15 November 2026) should be able to build, fly and land on a first try without anyone explaining it.

## Goals

- The player builds the rocket by fitting parts onto it, and sees it change.
- The player flies three moments of the mission with one key, the space bar.
- The build changes how the flying feels. A heavy, cheap or rushed ship is harder to fly.
- A first-time player can finish a run in about five minutes.
- The real history stays: every part still carries its short "why this mattered in the 1960s" line.

## Not doing

- Free stacking of parts in any shape. Parts go into fixed spots.
- Steering, throttle levels, orbits you plot yourself, or a map view.
- New chapters, new parts beyond the ones the game already has, or multiplayer.
- Voice acting or recorded audio.

## What would make this a failure

- A player flies a moment well and still loses it to a hidden dice roll.
- A player gets stuck: no fuel, no way forward, and no clear reason why.
- Flying needs fast reflexes or more than one key.
- The build screen turns into the same twelve questions with a new look.

## Approaches considered

- **A. Pick-a-part building, space-bar flying. Chosen.** Fixed spots on the rocket, two or three parts per spot. The flight plays as now, and the player takes over at three moments with one key. It stays easy, fits the game's name, and reuses the existing rocket models, gauges and simulation.
- **B. Free building, space-bar flying.** Drag parts from a tray and snap them together in any order. Closest to Spaceflight Simulator on the build side, but it needs many rules for rockets that make no sense, new players get stuck, and it is the biggest job.
- **C. Pick-a-part building, real physics flying.** Steer and throttle with gravity and orbits. Closest on the flying side, and too hard: most first-time players never reach the Moon.

## The run, start to finish

```
Title ▸ Briefing ▸ Funding ▸ Schedule
      ▸ BUILD on the pad (six spots; news and the cabin scare interrupt)
      ▸ Launch poll
      ▸ FLY: liftoff ▸ coast ▸ Moon orbit ▸ pick a site ▸ landing ▸ home
      ▸ Newspaper ▸ Report
```

## Decisions: from twelve to three

| Today | After |
|---|---|
| Funding, Schedule | Stay as story decisions, before the build |
| Cabin safety scare | Stays as a story decision, interrupting the build |
| Route, Spent stage, Docking, Power, Antenna, Instruments | Become the six build spots |
| Landing site | Becomes a quick pick during the flight |
| Live broadcast vote | Removed. Live TV is part of the "Full package with live TV" instruments, which now carries the broadcast effect: more trust on success, a costlier failure |
| Test flight around the Moon vote | Removed |

The two news events per run stay. They and the cabin scare interrupt the build, spaced so no two come back to back.

## Building

```
┌ Budget at launch ▓▓▓▓░  Trust at launch ▓▓▓░░   Today: Mar 1962 ─────┐
│                                                                      │
│        ▲            1 Lander      ▸ Small separate lander            │
│       ╱█╲           2 Docking     ▸ choose a part                    │
│       │█│  ✦ sparks 3 Power       ▸ choose a part                    │
│       │█│           4 Antenna     ▸ choose a part                    │
│       │█│           5 Science     ▸ choose a part                    │
│      ╱███╲          6 Spent stage ▸ choose a part                    │
│                                                                      │
│  Mass ▓▓▓░░  Power ▓▓░░░  Data ▓░░░░  Cost ▓▓░░░  Landing fuel ▓▓▓▓░ │
│                                        [ Roll out to the launch poll ]│
└──────────────────────────────────────────────────────────────────────┘
```

- **Six spots:** Lander (this is the route to the Moon), Docking, Power, Antenna, Science, Spent stage.
- **The rocket starts bare:** the three stages, the capsule and the escape tower, with empty spots marked.
- **Lander goes first.** It changes the rocket's shape and whether anything needs to dock. After that the spots can be filled in any order.
- **Choosing a spot** opens its two or three parts. Each part shows its name, one line on what it does, its effect on the gauges, and the existing "why it matters" history line.
- **Fitting a part is a click.** It is welded on with sparks, as today, and the person responsible says their existing one-line reaction.
- **Parts can be swapped freely until launch.** Holding to commit is kept for things that cannot be undone: the three story decisions and the launch.
- **Gauges stay visible** and move as parts go on. Hovering a part previews the change.
- **A new gauge, Landing fuel,** shows how much margin the build leaves for the landing.
- **Mismatched parts warn at once.** The existing conflict rules (for example a small lander with manual docking) show as a warning in the build, not only after the flight.
- **Docking is greyed out** when the chosen lander never docks, with a line saying so.
- **Lessons from earlier failures** show on the parts they concern, as today.
- **The top bar stays as today:** budget and trust at launch, today's date, and the date the ship will be ready, which moves as parts go on.
- **Launch unlocks** when every needed spot is filled and the two news events and the cabin scare have all happened.
- **An overweight rocket can still be launched.** The Mass gauge goes red and the launch poll warns, as today. It will not reach orbit.
- **On a retry after a failure,** the rocket starts as the player left it, and the three story decisions are asked again.

## Flying

All three moments use one input: the space bar, or pressing anywhere on the screen with a mouse or finger. Coast and the trip home play by themselves, as today.

### 1. Liftoff

"Hold SPACE to ignite." While held, the engines burn, the rocket climbs and a fuel bar drains over about six seconds. Near the bottom of the bar is a green zone. Release inside it to drop the stage cleanly.

- Release early: the stage is dropped with fuel still in it.
- Hold until empty: the stage drops by itself, late.
- Either mistake costs some landing fuel. Neither can end the mission.

### 2. Moon orbit

The ship curves in toward the Moon. A marker sits on its path. Tap SPACE as the ship crosses it to brake into orbit.

- Early or late costs some landing fuel.
- If the player never taps, the ship brakes by itself at the last safe moment, which counts as late.
- This moment cannot end the mission.

### 3. Landing

First, a quick pick of the site: the flat plain, or the highlands. The plain is the easier landing. The highlands need a gentler touchdown and give more science. If the antenna cannot carry the extra data the highlands produce, that option is locked and says why.

Then the lander comes straight down. Gravity pulls it. Holding SPACE fires the engine and burns fuel. The screen shows height, speed and fuel, and the speed turns green when it is safe to touch down.

```
   fuel ▓▓▓▓░░    height 420 m    speed 12 m/s
              ▼
            ══╩══     hold SPACE to slow down
   ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```

- Touch down at a safe speed: landed.
- Too fast, or out of fuel, on the first try: an automatic abort lifts the lander back to orbit. The player tries once more with less fuel. The second try costs nothing else.
- Too fast on the second try: the lander is lost, and the crew with it. This counts like any other failed mission.
- On the direct route, where the whole ship lands, the rules are the same.

### How the build changes the flying

- **Mass** sets the landing fuel. A lighter ship has more to spare.
- **Risk** (rushing, skipping the cabin fix, mismatched parts) narrows the liftoff green zone and the orbit marker window.
- **News events** that today add hidden stress to liftoff, orbit or landing now show as a named warning before that moment, and make it somewhat harder.
- **Flying** then decides the result. In the three flown moments there is no dice roll.

### Kept forgiving

- The easiest build has wide windows and about twice the fuel a clean landing needs.
- The worst rocket that can still fly, flown badly at liftoff and orbit, still reaches the landing with at least a quarter more fuel than a clean landing needs.
- Each moment shows a one-line prompt the first time.
- Each moment offers "Let the autopilot fly". The autopilot gets an average result, never a perfect one.

## What still decides the result besides flying

- **The physical checks stay.** Too heavy for the rocket, not enough power, or more data than the antenna can send still fail the mission at the same point as today. These are shown in red on the gauges before launch and called out in the launch poll. When one fails, the failure scene plays in place of that moment.
- **Coast and the trip home keep their dice roll,** because the player is not flying them. The launch poll's odds line now covers only these two.
- **Budget, trust and debris** work as today, and are settled when the flight ends, not at launch.

## After the flight

- **A new ending** for a landing lost to flying, with its own newspaper and report text and its own lesson for the next attempt.
- **The report** shows a flying result for each flown moment (clean, fair or rough), the fuel left at touchdown, the touchdown speed, and whether it took a second try. The watched phases keep today's margin bars.
- **The grade** still rewards science and well-matched parts.

## Constraints

- Same tools as today: TypeScript, Vite and three.js. No new libraries.
- The flight uses the same rocket and lander models the build produces.
- The build records its choices in the same form the questions do today, so the gauges, the 3D rocket, the lessons and the shared results keep working.
- The flying rules live in their own module with no graphics in it, so they can be tested. Same build, same seed and same key presses give the same result.
- It must work with a keyboard, a mouse and a touch screen, at phone width as well as on a laptop.
- Sound uses the game's existing generated sounds: the engine roar follows the held key, and warnings beep.
- Space no longer skips the flight. Only the watched parts can be skipped, with Esc.
- Reduced-motion and `?quick=1` players get the autopilot result unless they choose to fly.
- Removing two votes and the dice rolls changes the balance. The balance test is rewritten to match.

## Tests that must pass

- A simple test pilot that fires the engine whenever it is falling too fast lands every rocket that can fly, on the plain, on the first try.
- A clumsy test pilot that reacts 0.4 seconds late lands the plain build with basic parts on the first or second try.
- A pilot that never presses anything loses the lander on the second try, and nowhere earlier.
- Same build, seed and key presses give the same result.
- An overweight rocket still fails at liftoff, a starved power system and an overloaded antenna still fail where they do today.

## Left to the builder

- The exact numbers: burn times, window widths, fuel amounts, safe speeds, the cost of an abort. Tuned against the tests above.
- Whether the flight extends the existing flight scene or replaces it.
- How the simulation is split so the result can wait for the flying.
- The wording of prompts, warnings and the new ending, in the game's existing voice.
- Exactly when the news and the cabin scare interrupt the build.
- Updating the title screen's small print, the README and the recording script.
