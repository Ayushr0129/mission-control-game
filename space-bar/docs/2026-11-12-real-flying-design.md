# Space Bar: real flying

Design, 12 November 2026. Status: waiting for approval. Nothing here is built yet.
It replaces the "Flying" part of `2026-11-09-build-and-fly-design.md`. Building, the story decisions, the poll, the newspaper and the report stay as they are.

## Why

The three flown moments are one on/off input each, and the craft barely moves on screen when it is used. Played by hand, the flying does not feel responsive. The player should steer and throttle a craft that visibly answers, the way Spaceflight Simulator does, and be taught what each control does and how to land safely. It must stay easy: a visitor at NASA Space Apps (Port Louis, 14–15 November 2026) should not be lost.

Reference: Spaceflight Simulator, and the video "How to LAND EVERYWHERE in Spaceflight Simulator!" (Heroix). Copied from it: the plain side view, the guide angle during launch, the two speed arrows with numbers beside the craft, the predicted landing spot, and the rule "point against your motion, burn in bursts, be slow at the ground".

## Goals

- The player turns the craft and fires its engine, and sees it respond at once.
- Every control is named on screen, and each moment starts with a short "how to" card.
- A first-time player can land on the plain within the two tries.
- The build still matters: a heavy ship climbs slowly and has less landing fuel.
- The game works after each of the three steps below, so it can stop at any of them.

## Not doing

- Docking, transfer windows, time warp, a map screen, separate small steering thrusters, choosing between engine types.
- Free flight between the Earth and the Moon. The coast out and the trip home stay watched.
- Spin. The craft turns while a key is held and stops when it is let go.
- Real distances and speeds. Numbers are scaled so each moment takes well under a minute.

## What would make this a failure

- A player does not know which key does what, or what to do next.
- The craft feels slow or floaty to answer.
- A player is stuck with no way forward.
- The screen is so full of dials that the craft is hard to find.

## Approaches considered

- **A. Landing only.** Real side-view flying for the landing; liftoff and the orbit burn stay as they are. Smallest.
- **B. All three moments, built in order. Chosen.** Landing, then liftoff, then the orbit burn. The game works after each step.
- **C. The whole trip as free flight with a map.** Closest to Spaceflight Simulator. Too big for two days, and new players get lost.

## Controls, the same in every moment

| Do | Keyboard | Touch screen |
|---|---|---|
| Turn left / right | ← → (or A D) | two turn buttons |
| Fire the engine | hold SPACE | hold the big ENGINE button |
| Throttle up / down | ↑ ↓ (or W S) | a slider |

- Throttle starts at 100%, so a player who never touches it can still fly. Lower throttle is for hovering gently.
- A strip at the bottom of the screen always shows these controls. The on-screen buttons work with a mouse too, for a player with no keyboard.
- Pressing anywhere on the picture no longer fires the engine. The engine has its own key and its own button.
- Each moment keeps its "Let the autopilot fly" link. The autopilot flies an average flight, never a perfect one.

## Teaching

- **A "how to" card before each moment.** Three short numbered steps and a Start button. The game waits on the card.
- **A coach while flying.** The same steps as a checklist at the side, the current one lit, each ticking off as it is done.
- **A guide arrow on the craft.** It shows which way to point right now.
- **Numbers that say what to do.** They turn green when they are safe, amber when they need attention, red when they need it now.

## Step 1: the landing

A flat side view of the Moon: grey ground, black sky, the lander the player built. The camera follows the lander and zooms in as it nears the ground.

```
  1 Cancel sideways speed  ◀ lit            fuel ▓▓▓▓▓░░
  2 Turn upright                             height 212 m
  3 Brake before the ground
  4 Touch down gently             ↗ guide
                                 ╱▔╲
                          ◀ 18 m/s ╳         (sideways speed)
                                 ▼ 6 m/s     (downward speed)

  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁◎▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁   ◎ where you will come down
  [←][→] turn   [SPACE] engine   [↑][↓] throttle 100%
```

- **The start.** The lander arrives moving sideways, as it would from orbit, and falling slowly.
- **Two speed arrows with numbers** sit beside the lander: sideways and downward.
- **A marker on the ground** shows where the lander will come down if the engine stays off. Firing the engine moves it.
- **A safe landing** is slow downward, nearly still sideways, and nearly upright. The exact limits are shown on the "how to" card.
- **The plain** is flat everywhere. **The highlands** are rocks with one marked flat pad: the lander must set down on the pad. The highlands still give more science, and are still locked if the antenna cannot carry the data.
- **The second chance stays.** On the first try, once the landing cannot be saved, or on a bad touchdown, the lander aborts back up and the player gets one more try with less fuel. A bad second try loses the lander and the crew.
- **The build matters as before.** Mass sets the fuel. Risk and unprepared news events tighten the safe limits, and are named as a warning on the card.

How to land safely, as the card will say it:
1. Cancel your sideways speed. Turn to the arrow and hold the engine until the sideways number is green.
2. Turn upright and let it fall.
3. Brake before the ground. Hold the engine until the downward number is green, and keep it green until the legs touch.

## Step 2: the liftoff

The pad scene, with the rocket the player built. Holding the engine lifts it. The camera climbs with it and the sky darkens.

- **A guide arrow** shows the angle to hold. It starts straight up and leans over as the rocket climbs. The player turns to keep the rocket on the arrow.
- **The first stage runs dry** partway up. The flame dies and the coach says so: let go and press the engine again to drop the stage and light the next.
- **The moment ends** when the rocket reaches the height marked on screen.
- **A heavy rocket climbs slowly.** A rocket over the mass limit does not lift at all, and the mission fails on the pad as it does today.
- **Liftoff cannot lose the crew.** If the rocket strays far from the arrow near the ground, or nobody touches the controls after Start, guidance takes over and finishes the climb. That counts as a rough liftoff. Rough and sloppy flying cost landing fuel, as the liftoff does today.
- **A clean liftoff** means staying close to the arrow and re-lighting quickly.

## Step 3: the burn into Moon orbit

The existing view of the ship arriving at the Moon.

- **The ship arrives nose first, going too fast.** A guide arrow points backwards, against its motion.
- **The player turns the ship to the arrow, then holds the engine.** A speed number falls. A green band marks orbit speed.
- **Stopping inside the band is clean.** Too fast or too slow costs landing fuel. Burning while pointing the wrong way wastes fuel and the number barely moves.
- **There is a time limit, shown as a bar.** If it runs out, the ship burns by itself, late, as it does today.
- **This moment cannot lose the crew.**

## What does not change

- The simulation, the session rules, the report and the endings keep their shape. Each moment still hands back the same result as today: clean, fair or rough for liftoff and orbit, and landed or lost for the landing, with tries, site, speed and fuel left.
- The physical checks (too heavy, out of power, the antenna overloaded) and the dice on the coast and the trip home.
- Reduced-motion and `?quick=1` players get the autopilot unless they choose to fly.
- Sound comes from the game's existing generated sounds. The engine roar follows the engine and the throttle.

## Constraints

- No new libraries. Same rocket and lander models as the build.
- The flying rules stay in `src/sim/flight.ts`, with no graphics, tested with robot pilots that use the same three controls a player has.
- Keyboard, mouse and touch. Readable and usable at 390 px wide and at 1280×720.
- Space never scrolls the page or presses a button. Losing focus lets go of every control.
- A frozen tab loses time; it does not throw the craft through the ground.

## Tests that must pass

- A careful robot pilot lands every rocket that can fly, on the plain, on the first try.
- A robot pilot with slow hands (0.4 s late on every control) lands the basic build on the plain within two tries.
- A careful robot pilot can land the basic build on the highlands pad.
- A pilot who never touches anything loses the lander on the second try, and nowhere earlier.
- A rocket over the mass limit never leaves the pad.
- The same build, seed and inputs give the same result.
- The browser script flies all three moments by keyboard, by autopilot, with no input, and at phone width.

## Left to the builder

- Every number: engine strength, turn rate, starting height and speeds, safe limits, fuel, the liftoff guide curve, the orbit speed band, the time limits. Tuned against the tests above.
- How the side views are drawn with the existing 3D scenes.
- The exact words on the cards, the coach and the warnings, in the game's voice.
- Updating the README, the browser script and the demo recorder.
