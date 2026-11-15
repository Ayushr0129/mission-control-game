# Badge brief (for Codex)

Thirteen achievement badges for "Race to the Moon", an Apollo-era game with a
restrained flight-software look (dark panels, thin lines, monospace labels).
Each badge is one hand-written SVG file in this folder, named `<id>.svg`.
They are shown at 48 px (sometimes 64 px) on a dark background, next to the
achievement's name, which the game prints itself.

## Hard rules (a test checks these)

- Root element: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`. No `width`/`height` attributes needed.
- No `<text>`, no `<script>`, no `<image>`, no `href=` / `xlink:href=`, no `url(http…)`, no `<style>` element, no `style="…"` attributes, no `<foreignObject>`.
- Every colour is one of the exact hex values below, written as `fill="#…"` / `stroke="#…"` attributes. Otherwise only `none` is allowed. No named colours (`white`, `black`), no `rgb()`, no gradients, no filters, no opacity tricks beyond `opacity`/`fill-opacity`/`stroke-opacity` attributes if really needed.
- Do not give elements an `id` that looks like a hex number (best: no ids at all).
- Each file under 4096 bytes; aim for 1–2 KB. Round coordinates to integers or one decimal.
- No comments, no metadata, no XML declaration.

## Palette (from `src/style.css`)

| token | hex | use |
|---|---|---|
| `--bg` | `#0b0d10` | darkest background, inner disc shadow, cut-outs |
| `--panel` | `#12161b` | badge disc fill |
| `--panel2` | `#171c23` | secondary fills, lunar surface, inner shapes |
| `--line` | `#262d37` | subtle detail lines, craters |
| `--text` | `#e8ebf0` | bright highlights (sparingly: stars, a module body) |
| `--dim` | `#8b95a5` | neutral grey for hardware and secondary strokes |
| `--amber` | `#f5a524` | accent (both sets) |
| `--amber-d` | `#7a5410` | dark amber, for shading amber parts |
| `--ok` | `#3ddc84` | success accent |
| `--warn` | `#f5a524` | (same as amber) |
| `--bad` | `#ff5d5d` | failure accent |
| `--blue` | `#7fb3ff` | success accent (Earth, sky, signals) |

## Shared frame (identical in all 13 files)

So the set reads as one family of mission patches:

1. Outer disc: `<circle cx="32" cy="32" r="30" fill="#12161b"/>`
2. Outer ring: `<circle cx="32" cy="32" r="30" fill="none" stroke="ACCENT" stroke-width="2"/>`
3. Inner ring: `<circle cx="32" cy="32" r="25" fill="none" stroke="#262d37" stroke-width="1"/>`
4. Four tiny tick marks on the band between the rings at 12, 3, 6 and 9 o'clock (short 2 px `#8b95a5` lines, e.g. from r=26.5 to r=28.5) — like a gauge bezel.
5. The motif sits inside r=24 and must not cross the inner ring (clip mentally, don't use clipPath unless needed; if you use one, use a plain id like `c`).

`ACCENT` for the outer ring: success badges `#3ddc84` (`--ok`); failure badges `#ff5d5d` (`--bad`); `seen-it-all` `#f5a524` (`--amber`).

## Style

- Strokes 2 px (`stroke-width="2"`), `stroke-linecap="round"`, `stroke-linejoin="round"`. Thin 1 px only for fine detail.
- Flat fills, no gradients, no shading beyond one flat darker tone.
- Simple, bold silhouettes: the motif must read at 48 px. Prefer 3–8 shapes for the motif. Leave breathing room around it.
- Success badges: motif in `#e8ebf0` / `#8b95a5` hardware with `#3ddc84`, `#7fb3ff` or `#f5a524` accents.
- Failure badges: motif in `#8b95a5` hardware with `#ff5d5d` and `#f5a524` accents. They should look like a warning, not gore: calm, technical.
- Same lunar module silhouette wherever the LM appears (squat octagonal ascent stage on a wider descent stage with four splayed legs and footpads), so badges feel drawn by one hand.
- No text, letters or numbers anywhere (no "1", no "OK").

## The badges

| id | name | means | motif |
|---|---|---|---|
| `landed` | The Eagle has landed | land on the Moon | Lunar module standing on a grey lunar horizon (`#171c23` surface with a `#8b95a5` edge line), a small `#7fb3ff` Earth in the black sky, one or two tiny stars. |
| `first-try` | First try | land on the first run of a campaign | A single upward arrow / chevron-tipped flight path in `#3ddc84` arcing from lower left to a small Moon (grey disc) at upper right, hitting it on the first pass. One star. |
| `picture-perfect` | Picture perfect | clean liftoff, clean orbit, landing on first try | A small Moon in the centre circled by one perfect `#7fb3ff` elliptical orbit, with three small `#3ddc84` dots (or check-ticks) spaced on the orbit — three clean phases. |
| `rough-ground` | Rough ground | land on the rough site | Lunar module tilted slightly, standing among jagged boulders and craters (`#171c23`/`#262d37` with `#8b95a5` edges), an `#f5a524` small marker flag or target cross beside it. |
| `on-fumes` | On fumes | land with under 10 % landing fuel | A round fuel gauge dial: `#8b95a5` arc scale, a short `#f5a524` red-line zone at the low end, the needle (`#e8ebf0`) pointing almost to empty, plus a small `#3ddc84` check / footpad hint that it still landed (keep it subtle). |
| `hands-on` | Hands on the stick | land without ever using the autopilot | A pilot's hand controller / joystick: grey base, `#e8ebf0` stick with an `#f5a524` grip top, small `#3ddc84` dot as a "manual" lamp. |
| `by-the-book` | By the book | make every choice NASA made | An open flight manual / checklist binder seen from the front, with three `#3ddc84` tick marks on its lines (lines as short `#8b95a5` strokes, not text). |
| `comeback` | Back from the brink | land after a failed run in the same campaign | A circular return arrow (about 300° arc, `#7fb3ff`) wrapping round a small lunar module or a small Moon, arrowhead in `#3ddc84`. |
| `signal-lost` | Signal lost | ending: the radio link to Earth failed | A dish antenna (`#8b95a5`) on a short mast, emitting three concentric wave arcs, the outer arcs broken / dashed in `#ff5d5d`, a tiny `#f5a524` gap mark. |
| `lights-out` | Lights out | ending: the spacecraft ran out of power | A battery outline (`#8b95a5`) with a single low `#ff5d5d` cell and the other cells empty, or a solar panel with a `#f5a524` lightning bolt struck through. Keep it a battery. |
| `vehicle-lost` | Vehicle lost | ending: too heavy, or a part failed, and the rocket was lost | A Saturn-style rocket silhouette (`#8b95a5` body, `#e8ebf0` nose) broken in two at mid-height, the gap with a small `#ff5d5d` / `#f5a524` burst of 3–5 short spark strokes. |
| `too-fast` | Too fast | ending: crashed the landing, came in too fast | The lunar module descending nose-level, with three parallel vertical `#ff5d5d` speed streaks above it (motion down), a short `#f5a524` impact line on the surface below. |
| `seen-it-all` | Seen it all | hold all four failure badges | Four small symbols in a 2×2 grid (mini dish, mini battery, mini broken rocket, mini down-streak), each in `#ff5d5d`/`#8b95a5`, around a central `#f5a524` star or ring; outer ring `#f5a524`. |

## Check before finishing

- All 13 files exist, each starts with `<svg` and has `viewBox="0 0 64 64"`.
- Every colour is from the palette above; grep for `#` to be sure.
- Nothing crosses the inner ring; motif centred at (32,32) roughly.
