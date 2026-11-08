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
