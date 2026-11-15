# Textures

Drop NASA imagery here to replace the procedural placeholders:

- `earth.jpg`  - equirectangular Earth map (e.g. NASA Visible Earth "Blue Marble")
- `moon.jpg`   - equirectangular Moon map (e.g. NASA SVS "Moon LRO color")

The game loads these automatically if present. Check each asset's usage guidelines and add the
appropriate credit to the data and sources screen in `src/main.ts`.

The procedural Earth fallback uses Natural Earth 1:110m public-domain coastlines
from `world-atlas` 2.0.2 (`land-110m.json`), bundled into the application at build
time. Surface colors, relief and clouds are generated locally. The redistribution
license is included as `world-atlas-LICENSE.txt`. The Moon is generated locally.
Both fallback canvases are cached and no larger than 1024 x 512 pixels.
