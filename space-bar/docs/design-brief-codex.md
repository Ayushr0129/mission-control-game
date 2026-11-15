# Design pass brief (for Codex)

You are the visual designer and front-end engineer for **Space Bar**, a browser game (TypeScript, Vite, three.js) for NASA Space Apps Challenge. The player runs a 1960s Moon program: three decisions, builds the rocket on the pad, then flies the liftoff, the burn into Moon orbit and the landing.

The attached screenshots show how it looks today. Make the whole game look **more polished, cleaner and more coherent**: the interface, the typography, the panels and buttons, and the 3D planets and rocket. This is a visual pass. The game must play exactly as it does now.

## What good looks like

- A restrained, confident look: think NASA mission control and a well-made modern documentary title, not a cartoon or a sci-fi HUD. Fewer glows, fewer borders, more space, clear hierarchy.
- **Typography:** replace Impact and Georgia. Choose a small, coherent set: one display face for headings, one readable text face, one monospaced face for numbers and telemetry. Numbers that change while flying must use tabular figures.
- **Panels and buttons:** one consistent system of panels, buttons, chips and readouts across every screen: title, briefing, decisions, build, news, launch poll, the flying overlays (how-to cards, coach, readouts, the control strip), the newspaper, the report, the chapters screen and the achievements panel. Keep good contrast (WCAG AA) on the dark backgrounds.
- **Planets:** the Earth and the Moon are procedural textures today (`src/three/world.ts`). Make them look much more real: better continents, oceans and cloud cover for the Earth, a believable atmosphere rim, a proper terminator (day/night), and a cratered, grey Moon with mare regions. Real NASA textures may be dropped in later at `public/textures/earth.jpg` and `public/textures/moon.jpg`; the code already loads them if present, keep that working.
- **Rocket and spacecraft:** `src/three/ship.ts` builds the Saturn-style stack, the command and service module and the lander from simple shapes. Make them more faithful and better finished: proportions closer to the Saturn V and Apollo craft, better materials (white paint, black roll pattern, foil-gold lander, metal bells), small details that read at a distance. Every part the player can fit (lander types, docking, power, antenna, science, spent-stage kit) must still appear on the model, driven by the same tags.
- **The launch pad scene** (`src/three/site.ts`, `src/three/backdrop.ts`) and the flight scenes (`src/three/flight.ts`, `src/three/landerview.ts`): same improvements in lighting and finish.

## Hard rules

- **No gameplay changes.** Do not change any rule, number, timing or text meaning in `src/sim/`, `src/game/`, `src/data/`, `src/gmat/`, `gmat/`. Do not change what a button does or the order of screens.
- **Keep every class name, `data-*` attribute and element structure** that the tests and the browser script rely on. Read `scripts/e2e.cjs` and `tests/` first. If you must rename a class, keep the old one too.
- **The game must work offline** at the event. Do not load fonts, scripts or images from a CDN at run time. If you add fonts, bundle them in the repo (for example from `@fontsource/*` npm packages, or font files in `public/fonts/` with their licence). Only fonts with an open licence (OFL or similar).
- **Keep it fast.** It must stay smooth on a mid-range laptop. No post-processing that halves the frame rate. Texture canvases no bigger than 4096 px wide.
- **Keep both languages working:** strings go through `uiText()` in `src/prefs.ts`; keep French layouts from overflowing.
- **Keep it usable at 390 px wide** (phones) and at 1280×720.
- Respect `prefers-reduced-motion`.
- No em dashes in new player-facing text.

## How to check your work

Node is not on the system PATH. Before any npm or node command run:

```
export PATH="/c/Users/lamy4/AppData/Local/Temp/claude/a779bb8940cd5b4d/e94a2711-dc64-402b-9b15-171238f66716/scratchpad/rttm/venv/Scripts:$PATH"
```

(In PowerShell: `$env:PATH = "C:\Users\lamy4\AppData\Local\Temp\claude\a779bb8940cd5b4d\e94a2711-dc64-402b-9b15-171238f66716\scratchpad\rttm\venv\Scripts;" + $env:PATH`.)

Then all of these must pass when you finish:

- `npx tsc --noEmit`
- `npm test` (189 tests)
- `npm run build`

If a dev server is running on http://localhost:5173 you may use it to look at your work.

## When you finish

Commit your work on the current branch (`design/codex-polish`) in a few commits with clear messages, each ending with the line `Co-Authored-By: Codex <noreply@openai.com>`. Then write a short summary of what you changed, file by file, and anything you were unsure about, to `docs/design-pass-notes.md`, and commit that too.
