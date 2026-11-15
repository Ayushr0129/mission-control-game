# Space Bar: the real trajectory

Design, 15 November 2026. Status: waiting for approval. Nothing here is built yet.
It changes the flight between the pad and the Moon's surface, and adds the trip home. Building, the decisions, the landing, the report, the achievements and the GMAT work stay as they are.

## Why

The liftoff, the trip to the Moon and the trip home feel gimmicky. The numbers are invented for the game ("space" at 900 m, a Moon-orbit speed of 1,650), the coast out is a 5-second clip with the Earth and Moon sliding past, and the trip home is a 7-second clip with no re-entry.

The game is for NASA Space Apps, and it should teach. Someone who finishes the flight should understand two things:

1. **The free-return trajectory.** Apollo was aimed so that, if nothing more was done, the Moon's gravity would swing the ship round and send it home. That safety loop saved Apollo 13.
2. **Real orbital speeds matter.** About 7.8 km/s keeps you in Earth orbit. About 10.8 km/s sends you to the Moon. You slow to about 1 km/s on the way and speed up again as the Moon pulls. You come home at about 11 km/s and have to hit the atmosphere at just the right angle.

The trip takes eight days, so time is compressed: **time warp, with the mission clock always showing**.

## Goals

- Real distances, real speeds and real mission times, from the Apollo 11 figures the project already holds (`src/data/apollo11.ts`, checked with NASA GMAT) and NASA's publications.
- A map of the Earth–Moon system at true scale, with the ship's path drawn on it.
- The free-return loop visible as a faint "if you do nothing" path, and a real consequence for taking it.
- The player flies the burns that matter, with the controls they already know (turn, engine, throttle).
- A mission clock (mission elapsed time, as NASA wrote it: `075:49:50`) and time-warp controls. At each event the game shows when Apollo 11 did the same thing.
- Short "why" lines at the moments worth learning from, in English and French.
- The whole flight, pad to splashdown, still fits in about six minutes for a visitor who doesn't touch the warp controls.

## Not doing

- Free flight with real physics, where any burn can send you anywhere (approach A). The path is worked out in advance; the player's burns are graded against it.
- Docking, the lunar module's ascent and rendezvous, mid-course corrections other than the one before re-entry, or the Moon's uneven gravity.
- Changes to the landing, which stays the side view it is now.
- Changes to the decisions, the build, the achievements, or the GMAT scripts.

## What would make this a failure

- Numbers that look official but are not traceable. Every real figure shown must cite its NASA source, as the report's Apollo 11 table already does.
- A visitor who doesn't know what to do on the map, or who sits through long empty stretches.
- A path that looks wrong to anyone who knows the real figure-8.

## Approaches considered

- **A. Real physics, flown freely.** The game integrates Earth's and the Moon's gravity live, and the free return appears only if the burn is right. Most real, hardest to tune for a two-minute visitor, riskiest to build.
- **B. Real trajectory, flown at the key moments. Chosen.** The path comes from real Apollo 11 numbers and is shown on a true-scale map. The player flies each key burn against real targets, and a faint path always shows the free return. Real where it teaches, forgiving where it would only frustrate.
- **C. Real numbers, still watched.** The clips become a narrated map with real speeds and the clock, but nothing new is flown. Smallest; still something you watch.

## The flight, start to finish

```
Pad ─ liftoff (flown) ─ Earth parking orbit ─ trans-lunar injection (flown)
    ─ coast out (map, time warp) ─ lunar orbit insertion (flown)
    ─ landing site ─ landing (flown, as now)
    ─ trans-Earth injection (flown) ─ coast home (map, time warp)
    ─ entry corridor correction (flown) ─ re-entry ─ splashdown
```

Apollo 11's times, from NASA, are shown at each event: liftoff `000:00:00`, Earth orbit `000:11:49`, trans-lunar injection `002:44:16`, lunar orbit insertion `075:49:50`, landing `102:45:40`, trans-Earth injection `135:23:42`, splashdown `195:18:35`. The builder confirms every time against SP-4029 or MSC-00171 before it ships.

### 1. Liftoff

The controls and the guide arrow stay as they are. What changes is what the numbers mean.

- The readout shows real altitude in kilometres and real speed in kilometres per second, following Apollo 11's ascent profile: about 68 km and 2.4 km/s at first-stage cutoff, about 185 km and 7.8 km/s at Earth orbit.
- The clock runs real mission time, compressed, so the 12-minute climb takes about as long as it does now.
- When the rocket reaches orbit, the view hands over to the map.
- A "why" line at the end: "7.8 km/s. Fast enough to fall around the Earth instead of into it."

### 2. Earth parking orbit and trans-lunar injection

The map, close in on the Earth. The ship circles once in time warp.

- A marker shows where to burn. The arrow says point forward (prograde).
- Hold the engine. The speed climbs from 7.8 km/s. A green band sits around Apollo 11's figure, 10.84 km/s.
- As the speed rises, the predicted path stretches out towards the Moon. Inside the band, it becomes the free-return figure-8.
- Too slow: the path falls short and the ship curves back to Earth. It is pushed into the band by itself, and that costs fuel, as sloppy burns do now. Too fast: the path overshoots; same.
- A "why" line: "10.8 km/s. Just under escape speed. Any faster and the Moon would only bend your path, not hold you."

### 3. The coast out

The map zooms out to show the Earth, the Moon at true distance (about 384,000 km), and the ship's path between them.

- Time warp runs on its own, with controls to speed up or slow down (from 1× up to 100,000×). It drops back to 1× before every burn.
- The ship's speed falls as the Earth pulls back on it, from 10.8 km/s to about 0.9 km/s at the point where the Moon's pull takes over, then rises again.
- A faint line always shows the free-return loop: where the ship goes if no more burns are made.
- Two or three "why" lines along the way: the speed falling, the crossing into the Moon's pull, and the free-return loop and what it did for Apollo 13.
- No input is needed. A visitor can skip ahead with the warp controls.

### 4. Lunar orbit insertion

The existing orbit-burn moment, with real numbers.

- The ship passes behind the Moon. Radio contact is lost, as it was: "Loss of signal. The burn happens where nobody on Earth can see."
- Turn to point backwards (retrograde) and burn. The target is Apollo 11's measured change in speed, about 0.89 km/s. The speed band and the "window to burn" bar are as now.
- **Not burning at all takes the free return.** The ship swings round the Moon and heads home without landing. The crew is safe and the attempt ends without a landing. *(My call; see "Choices for you".)*
- A partial burn is pushed into orbit by itself and costs landing fuel, as now.

### 5. The landing

Unchanged: the site choice and the side-view landing.

### 6. Trans-Earth injection

A new flown moment, like lunar orbit insertion but pointing forward.

- Behind the Moon again, out of contact. Burn forward until the speed is in the band, about 1 km/s of change (the builder confirms Apollo 11's figure from MSC-00171).
- This burn can't lose the crew. A poor burn is pushed into the band by itself and shows up as a wider miss at the entry corridor, so step 8 has more to correct.

### 7. The coast home

Like the coast out, in reverse. The speed rises from about 1 km/s to about 11 km/s as the Earth pulls the ship in.

### 8. Entry corridor and re-entry

A new flown moment, and the last.

- A gauge shows the entry angle, the angle at which the ship will meet the atmosphere. Apollo 11 entered at about 6.5° below horizontal; the builder confirms the figure from NASA.
- A band marks the safe corridor, about two degrees wide. Too steep and the ship burns up or the crew is crushed; too shallow and it skips off the atmosphere into space.
- The player makes one small correction burn: turn, burn, and let go when the needle is in the band.
- Then a short watched re-entry: the heat glow, the communications blackout, the parachutes, splashdown.
- *Missing the corridor loses the crew (my call; see "Choices for you").*

## How the build still matters

- The build sets the fuel. A heavy ship has less to spare for every burn.
- Risk and unprepared news events narrow the green bands, as they narrow the windows now.
- The hardware dice on the coast out and the trip home stay. Parts can still fail on the way, and those failures still play their existing endings.

## The map

```
   ·                                                        ·
        ( Earth )                                  ( Moon )
          ╲ ‾ ‾ ‾ ‾ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╲  ‾ ╲
           ╲   your path                         ●───  ╱
            ‾ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ‾
                  ┄┄┄ free return (if you do nothing)

  MET 041:12:08   ▸▸ 10,000×   Speed 1.42 km/s   Distance to Moon 112,400 km
  Apollo 11 at this time: coasting, 2 days out.
```

- True scale for distance. The Earth and Moon are drawn larger than true size (a small inset or label says so), or they would be single pixels.
- The ship's past path is solid, the planned path dashed, the free-return loop faint.
- Clock, warp, speed and distance in the existing readout style.
- At phone width, the map fills the screen and the readout sits at the bottom, above the controls.

## Where the path comes from

The path must be real, and every number traceable.

- The builder computes the free-return trajectory once, offline, with a small Earth–Moon gravity calculation (restricted three-body), starting from Apollo 11's injection state. The tests check it against NASA's published figures: coast time, closest approach to the Moon, speed at the Moon.
- The result ships as data, like the GMAT results already do. The game draws the path from the data and never computes gravity live.
- If the team's GMAT installation can produce the same path (`gmat/apollo11.script` already propagates Apollo 11's coast), the data should come from GMAT instead and be credited to it. The builder notes which was used.

## What changes in the code

- `src/sim/types.ts`: the flown results gain trans-lunar injection, trans-Earth injection and the entry corridor. The five phases stay: the coast out holds the injection, and the return holds the trans-Earth burn and re-entry.
- `src/sim/simulate.ts`: re-entry can fail (new cause, if approved). Taking the free return ends the attempt without a landing (new outcome, if approved).
- `src/sim/`: new rules modules for the injection burns and the entry corridor, tested with robot pilots like the existing ones. `orbit.ts` moves to real speeds.
- `src/three/flight.ts`: the watched coast steps become the map. New flown steps: injection, trans-Earth injection, corridor correction.
- A new map view in `src/three/`, and new readouts in `src/ui/flyhud.ts`.
- `src/data/endings.ts`, `src/data/story.ts`: the endings and front pages for re-entry failure and the free-return abort, if approved.
- `main.ts`: the liftoff readout shows real altitude and speed.

## Constraints

- No new libraries. Works offline.
- Every real figure carries its NASA source in the data, and the Data and sources screen lists them.
- English and French, like the rest of the game.
- Usable at 390 px wide and at 1280×720.
- The same three controls as now. The warp controls get keys of their own (`,` and `.`) and on-screen buttons.
- `prefers-reduced-motion` keeps the map still apart from the ship.
- The design pass on `design/codex-polish` is merged first, so the new screens are built in its style.

## Choices for you

These change what the game does, so they are yours. My call is shown for each.

1. **Taking the free return** (not burning into Moon orbit): the crew comes home safe, no landing, and the attempt counts as a failure without lives lost. *My call: yes, with a gentler trust cost than losing a crew, its own ending ("Free return"), and its own front page.*
2. **Missing the entry corridor:** does it lose the crew? *My call: yes, because re-entry really is that unforgiving, but with a wide band, a clear gauge, and the autopilot available. An untouched correction is done by guidance, so only a player who actively flies it out of the band can lose the crew there.*
3. **New achievements** for the new moments (for example "Free return" and "Through the corridor")? *My call: not now. Add them later if wanted.*

## Settled after review (my calls, open to correction)

A reviewer read this as if they had to build it. These are the answers to what they asked.

- **A visitor who does nothing.** "Nothing" means pressing Start on each how-to card and nothing else; the cards still wait for Start. At each new burn, an untouched control is taken over by guidance late, as the Moon-orbit burn is today, and that costs fuel. At lunar orbit insertion, an untouched burn takes the free return instead (choice 1). The free-return path is aimed to arrive inside the entry corridor, as Apollo's was. So a hands-off visitor comes home alive unless the landing goes wrong, and the corridor can only lose the crew if the player actively flies it out of the band (choice 2).
- **The three lander routes** (separate lander, built in orbit, one giant lander) all fly the same Apollo 11 path and figures. The "Apollo 11 did this at…" line is a comparison with the real mission, not a claim about the player's route. The README notes this.
- **Fuel.** As now: sloppy burns before the landing cost landing fuel. The burns after the landing (trans-Earth injection and the corridor correction) have their own reserve and can't run dry. A second landing try doesn't take fuel from the trip home.
- **French.** Every new string goes through `uiText()` with its French. The existing flight text (cards, coach, narration, radio, endings) stays English for now; translating it is a separate piece of work, listed as a follow-up.
- **The hardware dice.** The coast-out roll happens during the coast, after the injection burn. The trip-home roll happens during the coast home, before the corridor. A failure plays on the map with its existing ending text and radio lines. After a free return the trip-home roll still happens: parts can fail on any way home.
- **The clock follows Apollo 11's timeline.** Stretches the game doesn't show (the extra parking orbit, about a day in lunar orbit before the landing, the time on the surface) are jumped with a one-line note ("27 hours in lunar orbit"), so splashdown lands near `195:18`. The trans-Earth path starts from Apollo 11's lunar orbit at Apollo 11's time.

## Tests that must pass

- The free-return path matches NASA's published coast time and closest approach to the Moon within a stated tolerance.
- Robot pilots, using only turn, engine and throttle, land in the green band on every new burn for every rocket that can fly.
- A pilot who does nothing: takes the free return at the Moon, comes home, and the outcome is recorded correctly.
- The whole flight with no warp input fits in about six minutes.
- The browser script flies the whole mission by keyboard, by autopilot, with no input, and at phone width.

## Left to the builder

- Every number not fixed above: band widths, warp speeds, the compression during burns, the scale of the drawn planets.
- How the trajectory data is computed and stored, within "Where the path comes from".
- The exact wording of the "why" lines, in the game's voice.
- How the map is drawn in three.js.
