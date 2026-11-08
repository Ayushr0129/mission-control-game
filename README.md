# MISSION CONTROL — Beyond the Launch

An offline-first Flutter / Flame space mission engineering game created for a NASA Space Apps hackathon concept. Independent project; no NASA affiliation or endorsement.

## What is playable

Four connected campaign missions: reach space, Earth orbit, lunar flyby, and robotic lunar landing. Build a modular spacecraft, review real-time engineering constraints, control an animated ascent, jettison an interstage, respond to an anomaly, execute manoeuvres, operate instruments, and transmit science. The lunar mission includes a fuel-limited interactive descent with a 5 m/s touchdown limit.

A complete campaign includes funding, public trust, reputation, science, sequential mission unlocks, eight earned achievements, and automatic local saves. Free Play unlocks all four missions and bypasses campaign spending and progression. Historical intermissions are skippable. The NASA gallery is optional, has timeouts and offline field notes, and stores discovery metadata locally. Original procedural art and synthesized sound work offline; mute and volume controls are in Settings.

## Requirements and running

- Flutter stable 3.47.9 / Dart 3.13.7 was used for verification. Minimum Dart constraint: 3.10.
- Android Studio with Android SDK / command-line tools, platform 36, current build tools, NDK 28.2.13676358, and Java 17 or newer for Android builds. Flutter provisions matching components when SDK licences are accepted.
- Xcode and CocoaPods on macOS for iOS. iOS source is included; it has not been built in this Linux environment.
- A modern browser for the web edition.

```sh
flutter pub get
flutter run                         # select a connected device
flutter run -d chrome               # browser development
flutter build apk --release --target-platform android-arm64 --no-shrink
flutter build apk --release         # configure your own signing before distribution
flutter build ios --no-codesign     # macOS only
flutter build web --release --no-web-resources-cdn --no-wasm-dry-run
flutter analyze
flutter test
```

The supplied Android APK, when present, is an ARM64 **release-mode build signed with a development key**, suitable for local sideload testing, not Play Store submission. Other device architectures require a rebuild. Android INTERNET permission is used only for the optional gallery.

To serve the prebuilt web edition, extract the web archive and run `python3 -m http.server 8080` inside it, then open http://localhost:8080. Do not open index.html directly from the filesystem. All renderer files, fonts, mission data and audio are bundled. Serving over HTTP is still required. No external request is needed to play. A service worker / installable offline PWA is not claimed; use the Android application for installation and offline relaunch.

## Quick flight guide

1. Enter mission control, choose an unlocked mission, and read or skip its historical briefing.
2. In the Vehicle Lab, choose components. A selected part can be removed by tapping it again. Alternatives replace other parts in the same subsystem; science instruments can be combined.
3. Use **Load a recommended baseline** if you want a known viable starting point. The default spacecraft is already suitable for Reach Space.
4. Resolve every readiness warning, then proceed to launch. The launch expenditure is charged immediately in campaign mode.
5. Keep throttle at 100% for liftoff. Pitch bias 0 follows the training gravity turn. After T+80 s, separate the inert interstage. Simulation time runs at 5×. You can pause at any time.
6. In mission operations, choose a response to the seeded event. Each choice has a different cost in power, manoeuvre reserve or scientific yield. Execute the mission steps and transmit data to complete the mission.
7. For lunar descent, coast to gain a little downward speed, use engine thrust to brake, then modulate near 38% throttle to balance lunar gravity. Touch down at 0–5 m/s. The lander starts 1,500 m above the surface with finite fuel. Brake early; a sustained full-throttle burn will make it climb.
8. Saves run every two seconds and on major actions. Return to the console and choose **Continue mission** to resume paused. Settings can abandon an active flight; its cost remains spent.

Budget caps are per mission; programme funds are a separate constraint. A failure costs invested funds and 18 public-trust points, but does not automatically end the programme. Campaign closure occurs below $5M funding (the minimum base launcher procurement cost), or at zero public trust. Start a new campaign or use Free Play to continue experimenting. The reset action confirms replacement of an existing campaign.

## Architecture

```
lib/main.dart                    bootstrap, imports and app definition
lib/app/controller.dart          navigation, active session orchestration, persistence
lib/screens/console.dart         responsive shell, overview, missions, briefings
lib/screens/mission_screens.dart vehicle lab, flight controls, operations, debrief
lib/screens/extras.dart          achievements, NASA gallery, settings
lib/models/models.dart          typed components, missions and programme state
lib/services/engineering.dart   mass, cost, power, rocket equation, readiness
lib/services/flight.dart        deterministic launch integrator and snapshots
lib/services/operations.dart    anomalies, mission steps, power and lunar descent
lib/services/campaign.dart      spending, outcomes, progression and achievements
lib/services/storage.dart       versioned local JSON / SharedPreferences
lib/services/audio.dart         non-blocking sound playback
lib/game/mission_game.dart      Flame animated flight rendering and time stepping
lib/widgets/                   reusable controls and original procedural artwork
assets/data/                   local mission and component JSON
assets/audio/                  original synthesized WAV files
assets/fonts/                  Space Grotesk, JetBrains Mono and OFL licences
```

Screen and controller files use Dart library `part` declarations to share session state while keeping rendering separate from testable simulation services. No backend, accounts or API keys. `pubspec.lock` is committed for reproducibility.

## Engineering and educational assumptions

- Spacecraft wet mass = dry mass + propellant mass. Cost includes a fictional $5M launcher procurement cost. All component specifications, budgets and event magnitudes are **illustrative game values**, not real NASA hardware specifications.
- Spacecraft delta-v uses the Tsiolkovsky rocket equation: `Isp × 9.80665 × ln(wet mass / dry mass)`. Readiness requires the manoeuvre budget plus a 150 m/s contingency reserve. Delta-v expenditures are additive ideal impulsive changes in velocity; this omits finite-burn and navigation details.
- Power balance = generated watts − consumed watts. Timed operations integrate the deficit/surplus into a 300 Wh battery, with upper/lower limits. Safe mode reduces draw at the cost of science. Earth–Moon distance is treated as constant for solar power.
- The **separate launch vehicle** begins with 180,000 kg propellant, 8,500 kg dry structure, 6,000 kg jettisonable inert interstage, 3 MN thrust and 390 s Isp. Liftoff TWR includes the spacecraft payload and interstage. The spacecraft's engine is for space operations, not pad liftoff. This is an intentionally idealized launcher, not a replica of any real rocket.
- Launch integrates mass flow `thrust / (Isp × g0)`, thrust acceleration, altitude-dependent gravity, simple exponential-atmosphere drag and a prescribed gravity turn. The pitch slider biases guidance by ±15°. The visual interstage is inert mass jettison, **not a fully simulated second propulsion stage**. Ascent uses small substeps and 5× time compression.
- The orbit training check requires altitude 100–450 km, horizontal velocity at least 7.6 km/s and vertical speed below 2.5 km/s, then a 250 m/s circularisation operation. **It is an insertion approximation, not proof of a closed or long-lived orbit.** A real orbit solution requires position/velocity propagation and periapsis calculation. Altitude alone never awards an orbit.
- Lunar transfer budgets are simplified total delta-v targets, with landing split 68% transfer / 32% arrival. There is no full transfer-orbit propagation or calendar-time simulation.
- Lunar descent is an abstract terminal approach with 1.62 m/s² gravity, 4.3 m/s² maximum thrust acceleration, normalized fuel and a 5 m/s touchdown limit. Its separate descent gauge abstracts the arrival propellant allowance already budgeted in spacecraft delta-v. Fuel mass, thrust changes and attitude are not fully coupled in this terminal model.
- Three anomalies are selected using a seeded Dart PRNG. Saved sessions preserve the actual selected event and its resolution, so loading does not reroll it. There are no cosmetic choices with identical state outcomes.
- Mission success requires science collection and a completed downlink, not only arrival. Campaign settlement is guarded against repeated rewards by the controller. Free Play does not award campaign achievements or grant money.

Historical notes cover Vostok 1 (12 April 1961), Sputnik 1 (4 October 1957), Luna 3 (October 1959), Luna 9 (February 1966), and Apollo 11 (July 1969). These factual intermissions are distinct from the fictional programme.

## Assets and NASA gallery

Earth, Moon, starfield, rocket, spacecraft modules and sound effects are original procedural work. Font files are distributed with their SIL Open Font License texts. NASA Image and Video Library search uses `https://images-api.nasa.gov/search`, requires no private key, displays returned titles/descriptions and centre/photographer credits, and persists metadata. Image pixels require connectivity and are not cached for guaranteed offline use. NASA search can return separately credited material; consult each entry's source and rights before redistributing it. No copyrighted mission footage is bundled.

## Verification and limitations

See `VERIFICATION.md` for the exact commands and outcomes executed for this delivery.

This is a hackathon MVP with four missions, not a comprehensive aerospace simulator. Future rover, human and Mars missions are clearly marked as future content. Technology variety is available in the workshop; there is no separate research tree. There is no account sync, cloud save, real-time mission ephemeris, APK store signing, multiplayer or production accessibility audit. Local save data can be lost when browser/site storage is cleared or the mobile app is uninstalled. A resumed flight starts paused. NASA availability never gates gameplay.

Planned improvements: computed periapsis and apogee, actual multistage propulsion, coupled lunar propellant mass, more campaigns, optional cloud backup, native device performance testing and broader accessibility verification.

Optional browser flow regression: install Python Playwright, serve the web build on port 8080, then run `python3 tool/browser_e2e.py`. Set `CHROMIUM_PATH` to a Chromium executable and optionally `MISSION_URL` and `MISSION_QA_OUTPUT`. This script blocks requests outside the local game origin to verify core offline behavior. It writes screenshots under `work/browser-qa` by default.
