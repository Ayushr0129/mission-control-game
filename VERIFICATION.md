# Verification report

## Executed successfully

- Flutter 3.47.9 / Dart 3.13.7 installed in an isolated workspace.
- `flutter analyze`: **No issues found**.
- `flutter test`: **25 tests passed**.
- `flutter build web --release --no-web-resources-cdn --no-wasm-dry-run`: **passed**.
- Real Chromium / Playwright browser tests, with all external requests blocked:
  - Desktop startup with bundled renderer and fonts.
  - Mission selection, briefing, spacecraft design and readiness.
  - Launch expenditure saved, browser reloaded, active flight restored paused.
  - Animated ascent, throttle interface and actual interstage separation.
  - Real flight transition to mission operations.
  - Navigation-error response, manoeuvre, approach, science collection and downlink.
  - Mission success, $16M reward, 20 science points, public trust and next-mission unlock.
  - Second reload restored $50.2M and one completed mission.
  - NASA search failure recovered to offline field notes.
  - Phone viewport at 390 × 844 and desktop at 1440 × 1100.
  - **No uncaught browser JavaScript errors.**

## Automated test coverage

Independent spacecraft mass, fuel, cost, power and delta-v expectations; payload trade-offs; readiness for every recommended mission design; four complete guided launches; zero-duration frame regression; low-throttle failure; velocity-based orbit qualification; flight snapshots; all three seeded events and distinct responses; complete operations for all four mission types across ten seeds; safe/hard lunar touchdown and an actually controlled coast-and-brake descent; battery failure; campaign spending/rewards and achievements; save/load of programme and active operations; campaign closure thresholds; phone and desktop UI navigation; interactive component removal/replacement; paused flight restoration.

Browser QA caught a zero-duration first-frame division by zero; the model now ignores nonpositive/nonfinite timesteps and has a regression test. Low-frame-rate motion uses bounded physical substeps. UI tests caught and resolved narrow layout overflows and Material ink containment.

## Limits of verification

The browser's full UI-to-outcome flow was exercised for Reach Space. The remaining three mission simulations and lunar descent were verified by automated model tests, not full manual device campaigns. NASA's live service was not required or verified; failure handling was verified with network requests blocked. No Android hardware, Android emulator, iOS simulator, App Store signing or Play Store distribution was tested. No production accessibility or battery/performance audit is claimed. iOS source is included but has not been built on Linux.

## Android build

See the final build result below. The delivered ARM64 APK uses release-mode compilation and a development signing key; it is for sideload testing, not store submission.

**Passed:** `flutter build apk --release --target-platform android-arm64 --no-shrink` produced `app-release.apk` (18.2 MB). The isolated build additionally constrained library CMake ABIs to ARM64 to match the provisioned SDK and the requested artifact. A normal full SDK can build the other architectures from the included source.

**Passed:** Android `apksigner verify --verbose` verified the APK's v2 signature. `aapt dump badging` confirmed package `org.spaceapps.mission_control`, version 1.0.0, minimum Android API 24, target API 36, and the Mission Control application label.

SHA-256: `f953608b0d16325fcfade96a686be3fcfc6c13f24b56966eae1a4c696badc17e`.

The APK was not installed on a physical device or emulator. It is development-signed, not store-signed. The public store release process and iOS compilation remain outside this verified delivery.

## Safari and GitHub Pages branch — 8 November 2026

The original MVP verification above remains a record of that delivery. The browser migration on `web/github-pages-safari` additionally verified:

- `flutter analyze`: **No issues found**.
- `flutter test`: **26 tests passed**, including the new real-controller keyboard and pointer regression test.
- `python -m unittest discover -s tool -p '*_test.py'`: **3 packaging tests passed**. They verify the repository base path, preservation of game code/data, and refusal to trim an incompatible future Wasm build.
- `actionlint .github/workflows/web-pages.yml`: **passed**.
- `flutter build web --release --base-href /mission-control-game/ --no-web-resources-cdn --no-wasm-dry-run`: **passed in the cloud**.
- `python tool/prepare_web.py --base-href /mission-control-game/`: **passed**. The output has the required base path and `.nojekyll`, preserves game assets, and retains the full Safari-compatible CanvasKit renderer. Uncompressed deployment size fell from 42,269,908 bytes to 11,789,301 bytes. These are folder sizes, not measured network transfers.

Release browser scenarios were exercised at the actual `/mission-control-game/` subpath with all external requests blocked:

- **WebKit desktop:** builder component removal/replacement and live readiness; real mouse throttle drag; W/S throttle and A/D pitch shortcuts; Space ignition/pause/resume and Escape pause; G staging; complete flight and mission operations; returned science, funding, unlocks, achievement and reload persistence; optional NASA fallback; loading-error retry UI. **Passed, with no uncaught browser errors.**
- **Chromium desktop:** the same complete release-game flow and controls. **Passed, with no uncaught browser errors.**
- **WebKit iPhone 13 touch emulation:** real browser taps on builder and throttle, full-throttle endpoint, saved-flight restoration, touch ignition and staging, flight, anomaly response, manoeuvre, approach, science, downlink, reward, unlock, achievement and reload persistence, optional NASA fallback and retry UI. **Passed, with no uncaught browser errors.** Scripted finger-scroll events reveal off-screen Flutter controls because Playwright does not expose a public swipe API for mobile WebKit; the buttons and throttle use trusted browser touchscreen taps.

The Flutter canvas now forwards focused keys to the shared flight controller rather than consuming them. Safari's page viewport is fixed while Flutter's own panels remain scrollable; the browser test harness scrolls the real game instead of moving only its accessibility mirror.

These are Linux Chromium/WebKit cloud checks and iPhone input/viewport emulation, **not a physical Mac Safari or iPhone hardware test**. The other mission models and lunar descent retain their automated model coverage from the existing game. Native Android and iOS project files remain; no new native build was needed for this web-only branch. Browser saves remain origin-local; the previous hosting origin is not modified or automatically migrated.

The GitHub Actions workflow also runs these checks on pull requests and before deployment from `main`; see the PR checks for the exact remote commit's status. This branch does not deploy from pull requests. GitHub Pages configuration queries returned HTTP 403 for the connected account, so owner enablement/eligible private-repository plan and a merge are still required. **A successful GitHub Pages production deployment is not claimed.** Instructions and the expected post-deployment URL are in `docs/GITHUB_PAGES.md`.

## Startup, storage and browser audio hardening

The follow-up preserves mission data, physics, builder, flight controls, staging, mission operations, campaign saves and original WAV assets. Flutter now starts before asynchronous game-data loading; a failed or timed-out load displays Retry instead of hanging. Preference initialization is bounded and inaccessible storage falls back to a clearly labelled tab-only session; the save format is unchanged. Quota failures preserve the session copy and can recover on later autosaves.

Web audio uses the browser AudioContext directly, resuming synchronously from the original user gesture before asset loading/decoding. It preserves separate effects and looping engine gains, mute and volume, and cancels delayed playback after stop/mute. Settings exposes an activation retry and status. Native builds retain the original audioplayers implementation. HTML bootstrap failures can also recreate the retry overlay after the first frame.

Cloud verification: `flutter analyze` passed; all **31 Flutter tests** and **3 Python packaging tests** passed; `actionlint` passed; the release build and repository-path packaging passed. Five new Flutter regressions cover denied/timed-out storage, durable normal saves, loading-error retry and playable session-only builder/flight continuation. Browser automation additionally exercises real native Web Audio decoding/start/stop and injected asset, storage and activation failures; these probes exist only in test scripts. Physical Safari hardware and audible output still require device validation.

## Mission-control visual redesign

The `design/mission-control-console` branch introduces a restrained graphite/blue-grey console, squared panels, tabular telemetry, operational headings, explicit flight/stage/guidance states and a vertical-speed readout. The payload drawing now follows the selected component IDs: bus, tanks, propulsion, solar arrays, communications, instruments and landing hardware. Launch visuals add stage joints, service-tower trusses, atmosphere/horizon transition and live altitude/velocity display rails. All illustrations remain local vector drawing; no new downloads, packages or runtime services are required.

Simulation rules, mission data, save format, audio and shared keyboard/mouse/touch handlers remain unchanged. This is a visual treatment inspired by mission-control instrumentation, not a claim of NASA affiliation or engineering fidelity. Existing educational assumptions still apply. Browser checks retain complete mission/control coverage and now capture builder/ascent screenshots for visual review. Home-page assertions were updated to the new operational heading.

Cloud checks: 31 Flutter tests passed, Flutter analysis clean, 3 Python packaging tests passed. Release-build and browser outcomes for the exact pushed commit are recorded in its PR checks. Production is unchanged until this branch is merged.

## Mission planning and launcher trade-offs

Added mission requirements, explicit resource margins, session-only pinned design comparison, three launcher choices with actual procurement/flight consequences, and engineering debriefs. The original launcher remains the default for old campaigns/flights. New snapshots include launcher identity. Readiness TWR now includes the inert interstage consistently with the flight integrator. Payload-capacity checks apply in Free Play; only financial limits are waived. Model regressions cover costs/capacity, live dynamics, snapshot continuation and legacy migration; a phone widget regression covers comparison, launcher selection and campaign debit. Browser scenarios also select and compare launchers before completing the existing mission. Exact release and browser results are available in PR checks.

This iteration retains the four authored destinations and mission operations. It does not introduce arbitrary orbit selection, real-world launcher data, multiplayer, or network collaboration.
