# Play Mission Control in Safari with GitHub Pages

This is the existing Flutter / Flame game, not a replacement app. All mission definitions, spacecraft components, physics, lunar descent, progression, audio, achievements, gallery and save/load systems remain in the project. Nothing needs to be installed on your Mac or iPhone: GitHub's cloud runner builds the game, then Safari opens the static website.

## Repository and intended URL

- Repository: https://github.com/Ayushr0129/mission-control-game
- Dedicated change branch: `web/github-pages-safari`
- Default branch: `main`
- Expected Pages URL **after a successful deployment**: https://ayushr0129.github.io/mission-control-game/
- Base path: `/mission-control-game/`, including both slashes.

The expected URL is not evidence of a completed deployment. Check the **deploy** job and Settings → Pages before treating it as live. The existing privately hosted game remains separate.

## Enable and merge, using only the GitHub website

1. Open the pull request from `web/github-pages-safari` into `main`. Review its changes and any available checks. The pull-request workflow builds and tests; it does not publish.
2. Under **Settings → Actions → General**, ensure GitHub Actions and the `actions/*` actions used in the workflow are permitted. The workflow declares its own minimal permissions; it does not need a personal access token, repository secret, or globally enabled write permissions.
3. Open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the Source. Do not choose a branch or `/docs` folder for this workflow.
4. Merge the pull request with **Merge pull request**. This preserves a dedicated review branch and adds the web changes to `main`. No local checkout or SDK is required.
5. Open **Actions → Web game and GitHub Pages**. The push to `main` starts the cloud build, analysis, tests, release build, browser checks and deployment.
6. Wait for **build** and **deploy** to succeed. Then use the deployment's `github-pages` environment link or **Settings → Pages → Visit site**. Open that URL in Safari on either device.

To rebuild after the workflow exists on `main`, select **Actions → Web game and GitHub Pages → Run workflow → main**. A manual run of a feature branch builds and tests but is deliberately prevented from publishing. Subsequent pushes to `main` deploy automatically after checks pass.

### Private repository and permissions

This repository is private and remains private. GitHub Pages for a private repository requires an eligible GitHub plan (for example GitHub Pro for a personal repository). If Settings → Pages reports a plan restriction, choose a plan supporting private-repository Pages, or make an explicit decision about public repository visibility yourself. This change does not change visibility or purchase a plan. A private source repository does not by itself guarantee a private Pages website; check the Pages access settings for your plan before publishing content intended to stay private.

The connected development account could push repository content but received HTTP 403 when reading Pages/Actions administration settings. Enabling Pages must therefore be done by the repository owner in GitHub's UI, unless that connection is later granted the relevant permissions. No Pages setting or successful production deployment is claimed merely because the branch was pushed.

## Cloud workflow

`.github/workflows/web-pages.yml`:

- Uses an Ubuntu cloud runner with Python and the verified Flutter 3.47.9 source revision `c197ca5199e9ee5661e865596c9c07294dfab51c`, fetched from the official Flutter repository and verified before use. SDK and public package caches stay on GitHub's runner/cache, not your Mac.
- Runs `flutter analyze`, `flutter test`, and Python packaging regression tests.
- Builds a release with `flutter build web --release --base-href /mission-control-game/ --no-web-resources-cdn --no-wasm-dry-run` for this repository.
- Computes the path from the repository name, so a normal project repository uses `/<repository>/`; a user site named `<owner>.github.io` uses `/`.
- Validates the generated base path, emits `.nojekyll`, and uploads only `build/web`, not the SDK, native build outputs, credentials, or the source tree.
- Runs full WebKit desktop, WebKit iPhone touchscreen, and Chromium release-game scenarios at the repository subpath. Every external request, including renderer/font CDNs, is blocked during those checks. It also verifies the optional NASA gallery's offline fallback.
- Retains browser evidence and Pages artifacts for seven days. The deployment uses GitHub's built-in short-lived token and OIDC with `pages: write` and `id-token: write` only in the deployment job.

The application needs no runtime API key. NASA discovery is optional and uses its public image search endpoint. Do not add credentials to Dart, web files, or GitHub commits.

## Safari, controls, and responsive layout

Use an up-to-date Safari with JavaScript and WebGL enabled. This JavaScript/CanvasKit build does not require WasmGC, cross-origin isolation headers, Xcode, Android Studio, Flutter installation, or a browser extension. Audio starts in response to a click, touch, or key; Safari may otherwise block autoplay. Muting never prevents flight.

| Input | Action |
| --- | --- |
| Mouse or touchscreen | Original spacecraft component cards, navigation, mission choices and buttons |
| Drag or tap throttle slider | Set ascent or lunar-descent throttle |
| Drag pitch slider | Change ascent guidance bias |
| Space | Ignition, pause or resume the current flight |
| Escape | Pause, without accidentally resuming |
| W / S | Increase / decrease throttle by 5 percentage points |
| A / D | Increase / decrease pitch bias by 1 degree during ascent |
| G | Separate the interstage once T+80 s is reached; unavailable during lunar descent |
| Tab, Shift+Tab, Enter | Standard Flutter focus navigation and button activation |

Keyboard shortcuts are scoped to the flight screen. The Flame canvas passes them to the same controller methods used by the on-screen controls. The on-screen buttons and sliders remain available on iPhone; a hardware keyboard is optional. Phone layouts scroll vertically instead of shrinking controls below usable sizes. Desktop layouts keep the game view and controls side by side.

## Slow connection and limited storage

The first visit still downloads a real Flutter web game; it is not a zero-data page. The prepared build measured **11.8 MB uncompressed in total**, down from **42.3 MB** before removing unused renderer variants and development maps. This is the deployable folder's size, not a guaranteed network-transfer measurement. GitHub's compression, browser choice and caching affect the actual transfer.

The full Safari-compatible CanvasKit renderer is bundled on the same origin as the game. Unused Chromium-only and WasmGC renderer files are removed from deployment output only; game code and assets are preserved. The bootstrap does not register Flutter's deprecated service worker, avoiding its startup wait and forced app cache. Safari can reuse its ordinary HTTP cache, but may evict files when storage is tight. No promise of offline relaunch or an installed PWA is made. Once loaded, core gameplay does not require NASA or another backend; NASA image discovery is only requested when you choose it.

Campaign progress is stored locally in Safari's site storage. Clearing website data can remove it. Mac and iPhone saves are separate, and saves from the earlier hosting origin do not automatically move to the GitHub Pages origin. The original host is not changed by this branch.

## Troubleshooting

- **404 at the expected URL:** Pages is not enabled, the deploy job has not succeeded, the private-repository plan is ineligible, or the URL/path is incorrect. Use the URL reported by the completed deployment.
- **HTML loads but the game does not:** use the retry button, check the connection, ensure JavaScript/WebGL are enabled, and confirm the generated `<base href="/mission-control-game/">`. Assets, fonts, audio and CanvasKit must also be under that path, not at the origin root.
- **Old version remains:** reload the tab. If necessary clear cached files for this site, remembering that clearing all website data also clears campaign progress. No deprecated Flutter service worker is registered by the new build.
- **Deploy reports 403 or Pages missing:** enable Pages with GitHub Actions as Source and check repository policy/plan. The deploy job needs the workflow's Pages/OIDC permissions. Do not solve this by committing a token.
- **Blank/error screen on old Safari:** update Safari/iOS and enable WebGL. Cloud WebKit tests are useful compatibility evidence, but are not a physical iPhone or macOS Safari certification.

## Developer verification, in the cloud

```sh
flutter pub get
flutter analyze
flutter test
python -m unittest discover -s tool -p '*_test.py'
flutter build web --release --base-href /mission-control-game/ --no-web-resources-cdn --no-wasm-dry-run
python tool/prepare_web.py --base-href /mission-control-game/
python -m pip install -r tool/browser-requirements.txt
python -m playwright install --with-deps webkit chromium
mkdir -p work/pages-root
ln -s "$PWD/build/web" work/pages-root/mission-control-game
python -m http.server 8080 --directory work/pages-root
# In another cloud terminal:
MISSION_URL=http://127.0.0.1:8080/mission-control-game/ python tool/browser_web_smoke.py
```

These are developer/cloud commands, not steps you need to run on your Mac. When serving locally in development, a root build can instead use `--base-href /`. Do not open `index.html` directly from the filesystem.
