# Space Bar design pass

Completed on the existing `design/codex-polish` branch. The visual direction is a
quiet mission-control console: warm ivory headings, a restrained amber action
color, slate panels, readable body copy and stable numeric readouts.

## Changes by file

- `src/mission.css`: shared finish for title, briefing, decisions, build, news,
  launch poll, flight instructions, coach, readouts, control strip, newspaper,
  report, chapters, sources and achievements. Removes clipped corners, heavy
  glows and grain; unifies buttons, panels, chips and status colors; adds phone
  refinements, tabular telemetry and reduced-motion overrides. Alert labels use
  a darker red background for readable light text.
- `src/feel.css`: replaces the original Impact/Georgia font definitions with the
  new bundled faces, including the former narrative serif role.
- `src/main.ts`: imports the new presentation stylesheet. No screen structure,
  selectors, handlers, strings or navigation logic changed.
- `package.json`, `package-lock.json`: pin Fontsource Barlow Condensed, Public
  Sans and IBM Plex Mono, plus World Atlas coastline data. All assets are bundled
  locally; nothing is fetched from a CDN at runtime.
- `public/fonts/README.md` and the three font license files: document the selected
  weights, French-capable Latin subsets and SIL Open Font License terms. License
  notices are included in the production output.
- `src/three/world.ts`: builds Earth's coastlines from bundled Natural Earth
  TopoJSON, with procedural terrain, ocean and cloud colors; adds broader lunar
  maria, many smaller craters and subtle bump relief. Adds a solar terminator
  that remains visible under spacecraft fill lighting and a thinner atmosphere.
  Caches generated canvases at 1024 x 512. Retains automatic NASA JPG replacement
  and disables decorative planet rotation under reduced motion.
- `src/three/ship.ts`: improves paint, aluminum and foil materials; adds service
  module radiator panels, RCS clusters, capsule windows, angular lunar cabin,
  windows, descent-stage bays, ladder and descent engine. Adds curved open engine
  bells, launcher stringers, seams and cable tunnels. Existing vehicle dimensions,
  attachment points, route variants, component tags and `userData` contracts remain.
- `src/three/site.ts`: tones down pad concrete and gantry paint/metal. Suppresses
  decorative crane sway, welding flashes and blinking lights under reduced motion.
- `src/three/backdrop.ts`: balances exposure and spacecraft rim lighting; removes
  decorative bobbing and camera drift under reduced motion.
- `src/three/flight.ts`: matches flight exposure to the shared scene treatment.
- `src/three/landerview.ts`: uses neutral gray lunar ground, a finer horizon and
  more restrained fill lighting; updates the atmosphere attachment for its new size.
- `public/textures/README.md`, `public/textures/world-atlas-LICENSE.txt`: document
  offline public-domain Natural Earth coastlines and the World Atlas redistribution
  license, and clarify where future NASA image credits belong.

## Verification

- TypeScript check (`tsc --noEmit`): passed.
- `npm test`: all 189 tests passed across 12 files.
- `npm run build`: passed; fonts and geographic data are emitted locally.
- Chrome browser checks: build, phone, manual flight and phone flight.
- Manual flight recorded clean liftoff, clean orbit burn and first-try landing;
  the report reflected those outcomes and no page errors were reported.
- Additional visual captures: desktop title, achievements, sources and chapters;
  French title, achievements and chapters at 390 x 844; reduced-motion briefing.
  French screens stayed within 390 px. The briefing opened with the browser set
  offline, with no external runtime requests or page errors in the visual review.
- Existing script screenshots in `e2e-out/` show the new build, flight and report
  at 1280 x 720. Additional review images use the `design-` prefix. This directory
  remains ignored by Git.

## Limits and choices

- The planets remain stylized procedural surfaces, not NASA photography. No NASA
  images were supplied; the JPG replacement loader remains available. Coastlines
  are geographically grounded, while cloud patterns, terrain colors and lunar
  craters are illustrative.
- Spacecraft remain efficient primitive geometry with Apollo-inspired detail,
  rather than dimensionally exact museum models. Their existing overall sizes
  and attachment positions were preserved to avoid disturbing flight framing.
- No new post-processing or large textures were added. Testing used Chrome's
  software WebGL path; actual event-laptop GPU performance was not benchmarked.
- Existing English/French coverage was preserved, including the existing English
  fallbacks. No new player-facing text was introduced.
- No files in `src/sim/`, `src/game/`, `src/data/`, `src/gmat/` or `gmat/` were changed.
