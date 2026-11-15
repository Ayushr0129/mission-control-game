# Campaign achievements: design

Date: 2026-11-14 · Status: awaiting approval

## Why

To give players of the historical campaign (Race to the Moon) something to come back for. They earn badges for doing particular things and for reaching particular endings, failures included. A failure badge also teaches: it carries the lesson the game already gives for that ending.

## Goals

- 13 achievements, historical campaign only.
- An **Achievements** panel on the title screen, next to "Open Mission Lab" and "Play historical campaign".
- A small **"Achievement earned"** pop-up when a run earns one.
- Each badge has its own small vector design (SVG) made by Codex.
- English and French, like the rest of the game.

## Non-goals

- No achievements in the Mission Lab.
- No accounts, server or sharing. Achievements live in the player's browser.
- No change to the campaign's flying, scoring or story.

## Anti-goals

- Badges that can be farmed with one click: `?quick=1` and `?practice=…` runs earn nothing.
- Art that clashes with the game's flight-software look, or that makes the page heavy.

## Approaches considered

- **A. Codex image generation (PNG).** The richest look, but about 50–150 KB per badge, hard to keep consistent, the text can't switch to French, and changing a badge means generating it again.
- **B. Codex-written SVG.** About 2 KB each, sharp at any size, uses the game's colours, text kept outside the art, and each badge can be redone on its own. Flatter, more icon than illustration.
- **Picked: B** (user's choice, on my recommendation).

## The achievements

Checked once per run, when the run's outcome is settled (`finishFlight` in `src/game/session.ts`).

| id | Name (EN) | Earned when |
|---|---|---|
| `landed` | The Eagle has landed | the run succeeds |
| `first-try` | First try | succeeds on run 1 of a session |
| `picture-perfect` | Picture perfect | succeeds with liftoff `clean`, orbit `clean`, and landing on the first try |
| `rough-ground` | Rough ground | succeeds with landing site `rough` |
| `on-fumes` | On fumes | succeeds with landing `fuelLeft` under 10% *(threshold: my call)* |
| `hands-on` | Hands on the stick | succeeds with the autopilot never on, in any flown moment |
| `by-the-book` | By the book | succeeds, and every decision listed in `history.optionByQuestion` matches NASA's choice |
| `comeback` | Back from the brink | succeeds after at least one failed run in the same session *(same session: my call)* |
| `signal-lost` | Signal lost | ending `comms` |
| `lights-out` | Lights out | ending `power` |
| `vehicle-lost` | Vehicle lost | ending `vehicle` (causes `mass` or `hardware`) |
| `too-fast` | Too fast | ending `crash` (cause `piloting`) |
| `seen-it-all` | Seen it all | all four failure badges held |

- A badge is earned once. Later runs don't earn it again or pop it up again.
- The four failure badges' descriptions reuse that ending's `avoid` text, so the badge teaches the fix.
- The autopilot still counts for ending badges. Only `hands-on` needs it off.
- *My calls:* `picture-perfect` does not test `hands-on` directly, but the autopilot's marks are `fair` (`AUTOPILOT` in `src/sim/flight.ts`), so in practice it needs a hand-flown clean liftoff and orbit burn. The guided-ascent hint does not count as the autopilot.

## How it works

- **Rules:** a new module, `src/game/achievements.ts`. It holds the list (id, EN/FR name, EN/FR description, EN/FR hint for locked badges), a pure function `earned(session, run, flags) → id[]` that tests can call directly, and load/save under a new storage key, `rttm.achievements.v1` (ids with the date earned).
- **Autopilot tracking:** the campaign's flying code in `src/main.ts` sets a per-run flag whenever `autoFly` is on during a flown moment. It's stored on `Run`.
- **Pop-up:** on the report screen (success) or the collapse/failure screen, one card per new badge, with the badge, "Achievement earned" and the name. It stacks if several were earned, fades after about 5 seconds, can be closed, and is announced to screen readers (`aria-live="polite"`). With reduced motion, it shows without the slide.
- **Title-screen panel:** a button "Achievements 4/13" opens a grid of all 13. Earned badges are in colour with their name and description. Locked ones are dim outlines with the hint (except the failure ones, which show their name, since the endings aren't secret).
- **Forget everything** on the title screen also clears achievements.
- **Badges:** Codex (`codex exec`) writes 13 SVGs into `src/ui/badges/`, following a brief that sets the size (64×64 viewBox), stroke style, and the game's palette taken from `src/style.css`. I review each one and redo any that clash. No text inside the SVGs.

## Testing

- Unit tests for `earned()`: each badge, the once-only rule, and `?quick`/practice earning nothing.
- The storage key survives a reload, and "Forget everything" clears it.
- Browser check by hand, because headless Firefox runs out of memory on this machine: the panel, the pop-up, and French mode.

## Left to the builder

The exact layout and animation of the panel and pop-up within the existing CSS, and the wording of the hints and French strings.
