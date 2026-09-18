# M5 plan — Polish and performance

Scope from SPEC.md section 10: iPhone performance pass with adaptive quality, session light arc (P1), timing polish, README, deploy to GitHub Pages (section 12). Budget about €15. Builds on M4 without changing the ritual, the copy or the pixel rules.

## Accept when

1. The manual iPhone checklist (section 11) passes.
2. The site is live at `https://<username>.github.io/lantern-night/`.

Headless stand-ins for the iPhone part, so the work is measurable here: the quality governor is unit-tested against the section 8 rule, each quality level is screenshotted at 390×844, and the frame loop stays inside the existing CPU budget with 12 lanterns and 1,000 sky lights.

## Out of scope (deliberately)

- Haze merging beyond 1,000 lights and the seated figure (P1, cut).
- Landscape polish beyond "works".
- A custom domain (section 14).

## Decisions

**Adaptive quality (`src/engine/quality.ts`).** Section 8: if frame time > 20 ms for 2 s, reduce particles, then bloom. A small pure `QualityGovernor` keeps a 2 s rolling window of frame times; once the window is full and its mean is above 20 ms it steps the level down one notch, clears the window and waits 3 s before judging again. Single frames above 250 ms are dropped as stalls (tab switch, resume), and the first 2 s after boot and after every resize are ignored so a cold start never counts. The level never goes back up within a session; a page reload starts at full again. Three levels:

| Level | Name | What changes |
|---|---|---|
| 3 | full | everything as in M4 |
| 2 | fewer particles | the 1,000 additive sky halos are hidden (the ≥ 2×2 warm dots stay, so past lanterns remain legible), fireflies drop to the gentle count and lose their halos, the mist wisps are hidden |
| 1 | no bloom | in addition: the lantern core bloom and water streak are off and the halo is at half alpha, the moon halo and the cottage window glows are off |

`Scene.setQuality(level)` fans out to `SkyLights`, `Fireflies`, `Cozy`, `Moon` and `Lantern`; every subsystem stores the level so new lanterns and rebuilds honour it. `?quality=1|2|3` pins a level (the governor is off), `window.__lantern.quality()` reports the level and `setQuality(n)` sets it, and the `?debug` overlay shows the level next to the fps so the phone check can read it. The end-to-end helpers open pages with `quality=3` pinned so the software GPU in headless mode cannot change screenshots; only the new quality spec leaves it free.

**Session light arc (`src/scene/sky.ts`, P1, kept).** Section 3: over ~3 minutes the horizon eases from apricot to plum. The sky stays flat bands with 2 px checker dithering, so the arc is a change of band heights, not a gradient: the three warm bands lose their height one after another (apricot over the first third of the arc, then blush, then rose) and the night band at the top grows by the same amount. The lowest band with any height left is the horizon colour, so it goes apricot → blush → rose → plum with a dithered edge at every stage. `drawSky` takes `evening` 0–1; `Scene.setEvening(e)` rebuilds the static buffer only when a band boundary actually moves (about 34 rows over 180 s on a phone, so a rebuild every 5 s or so). Stars are laid out once at evening 0 and kept, so the twinkle set never changes under you. The lake mirrors the change on its own because it samples the `above` texture. The arc runs on session time from Begin, is unaffected by the motion setting (it is slow, not motion), pauses while the tab is hidden, and the share image is composed at the current evening so it matches the screen. `?evening=0..1` pins it for screenshots.

**Timing polish.** Section 7 Motion: slow and soft, 400–800 ms eases, one orchestrated moment per state. Every CSS transition and JS timer is listed in a table in the result below with its role; the ones that are UI eases are brought into 400–800 ms on the shared `--ease` curve, the orchestrated moments (scene fade-in, hold ring, wish fade, goodnight dim) keep their longer times, and the reduced-motion block keeps cross-fades only. Only durations change; no new motion.

**Performance pass.** Measured, not guessed: the governor's effect is measured on this Mac with a headed Chromium at the phone viewport (DPR 3) with 12 lanterns and 1,000 sky lights, at each pinned level, and recorded below. The iPhone run itself is the user's manual check; the `?debug` overlay gives the numbers on the phone. Any cheap CPU wins found while reading the loop (allocation in per-frame paths, work done for hidden sprites) are taken.

**README.** What it is, privacy, how to run, test and build, the test hooks (`?date`, `?phase`, `?seed`, `?lanterns`, `?sky`, `?motion`, `?star`, `?install`, `?quality`, `?evening`, `?debug`), the folder layout, and how deploy works.

**Deploy (section 12).** `.github/workflows/deploy.yml`: on every push to `main`, `npm ci`, `npm run build`, upload `dist/` with `actions/upload-pages-artifact`, publish with `actions/deploy-pages`. The Pages source must be "GitHub Actions" in the repository settings. There is no remote yet; creating the public repository and the first push are the user's call (section 13: Claude never handles GitHub credentials), so the milestone stops there with the two commands ready.

## Files

```
src/engine/quality.ts             QualityGovernor (pure) + QualityLevel
src/scene/scene.ts                setQuality, setEvening, evening-aware build
src/scene/sky.ts                  drawSky(evening): band heights, horizon colour
src/scene/skyLights.ts            halos visible per level
src/scene/fireflies.ts            count and halos per level
src/scene/cozy.ts                 wisps and window glows per level
src/scene/moon.ts                 halo per level
src/scene/lantern.ts, lanterns.ts core/streak/halo per level
src/share/compose.ts              evening passed through
src/ritual/session.ts             session clock → evening
src/main.ts, src/debug.ts         governor in the ticker, hooks, overlay
src/styles.css                    timing audit
tests/unit/quality.test.ts        governor rule
tests/unit/sky.test.ts            band heights and horizon colour per evening
e2e/quality.spec.ts               levels pinned: halos gone, bloom gone, screenshots
e2e/lightArc.spec.ts              horizon colour at evening 0, 0.5, 1; screenshots
README.md
.github/workflows/deploy.yml
```

## Steps

1. Governor and unit tests; levels wired through the scene; hooks and overlay; e2e with screenshots.
2. Light arc in `drawSky`, scene rebuild on boundary change, session clock, share pass-through; unit and e2e tests.
3. Timing audit and fixes; reduced-motion run still passes.
4. Headed measurement at each level; take cheap CPU wins.
5. README and the deploy workflow.
6. Full suites in both browsers, bundle size, commit "M5: polish and performance". Stop for review with the repo-creation commands.

## Result (2026-09-17)

- Unit: 82 Vitest tests pass (11 new: the governor rule and the light-arc band maths). End-to-end: 212 test runs across the four projects, 188 passing and 24 project-specific skips (desktop-only perf checks, the WebKit offline reload), the M1–M4 suites unchanged; headless Chromium reports 59.6–59.9 fps on the perf spec, and the governor stays at level 3 on every project. New specs: `quality.spec.ts` (each pinned level checked subsystem by subsystem, a level set at runtime reaching new lanterns, the governor live on the heavy scene) and `lightArc.spec.ts` (warm-band pixel counts at evening 0, 0.5 and 1, the session clock under `speed()`, the share image composed at the same evening). Screenshots and squint copies in `e2e/output/` (`*-quality-*`, `*-arc-*`).
- Bundle: main JS 104.7 KB gzipped (+0.1 KB over M4), all JS chunks 180 KB, CSS 3.4 KB. Budget is 350 KB (section 8).

**Measured, not guessed (step 4).** `scripts/measure-quality.mjs`, headed Chromium on this Mac (Apple M4, ANGLE Metal), 390×844 at DPR 3, 8 s per row:

| Scene | Level | fps | frame ms | CPU ms (p95) |
|---|---|---|---|---|
| quiet | 3 full | 60.0 | 16.66 | 0.39 (0.70) |
| quiet | 2 fewer particles | 60.0 | 16.67 | 0.41 (0.70) |
| quiet | 1 no bloom | 60.0 | 16.67 | 0.42 (0.70) |
| 12 lanterns + 1,000 lights | 3 full | 60.0 | 16.67 | 0.98 (2.10) |
| 12 lanterns + 1,000 lights | 2 fewer particles | 60.0 | 16.67 | 0.93 (2.00) |
| 12 lanterns + 1,000 lights | 1 no bloom | 60.0 | 16.67 | 0.86 (2.00) |

With the governor live on the heavy scene it stays at level 3 here (60 fps after 12 s). This Mac never leaves vsync, so the levels cannot be told apart on it; the CPU side of the loop is under 1 ms at full load. The GPU fill of 1,000 additive halos and the lantern bloom is what the levels remove, and only the phone can show that: the iPhone check reads the level and the frame time from `?debug`.

**Timing audit (step 3).** Section 7: slow and soft, 400–800 ms eases, one orchestrated moment per state.

| Element | Before | After | Role |
|---|---|---|---|
| `.hint` caption | 260 ms `ease` | 400 ms `--ease` | UI ease (was under the floor) |
| `.menu-sheet`, `.moon-label`, `.share-preview` | 300 ms `ease` | 400 ms `--ease` | UI ease (was under the floor) |
| `.switch` knob and colour | 300 ms | 400 ms `--ease` | UI ease |
| `.btn`, `.corner`, `.install`, `.toast`, `.star-line`, `.wish` | 400–500 ms `ease` | same length, `--ease` | UI ease, now on the shared curve |
| `.btn` background colour | 300 ms | unchanged | press feedback, not motion |
| `.screen` 600, `.overlay` 500, `.actions` 800 | | unchanged | UI eases already in range |
| `.title` 900, `.actions.fade-in` 900, `.breath` 700/4000/900, `.wish.rising` 3000, `.veil` 2000, `.goodnight-line` 1200 + 600 | | unchanged | the orchestrated moment of each state (arrive, watch, hold, release, goodnight) |
| JS timers (hint 2600 / 1800 ms, moon label 7 s, star line, toasts) | | unchanged | copy pacing, not motion |
| reduced motion block | | unchanged | cross-fades only, 300 ms |

**Deploy (step 5).** `.github/workflows/deploy.yml` builds on every push to `main` (Node 22, `npm ci`, `npm test`, `npm run build`) and publishes `dist/` with `actions/deploy-pages`. There is no remote yet, so the site is not live: creating the public repository and the first push are for the user (section 13), then Settings → Pages → Source: GitHub Actions. The commands are in the review notes.

**Deviations and notes for review.**
- The light arc runs from page open, not from Begin, so the arrive screen already deepens; it pauses with the tab (no frames, no clock) and `speed()` scales it like the rest of the scene.
- Stars are laid out for evening 0 and kept, so the rows the warm bands give up have no stars in them; the sky reads as deepening, not as a new sky.
- The governor never steps back up in a session (the spec has no rule for that); a reload starts at full.
- Screenshot tests pin `quality=3` through the helpers: the software GPU in headless mode is slow enough to trip the governor otherwise.
- `.claude/launch.json` gained a `preview` entry (port 4174) for the measurement script and manual checks of the built site.

## Review fixes after the live check (2026-09-18)

1. **Your sky showed one light where two were lit.** A lantern still on its way already had its ring at its final sky spot, so the ring sat empty until the lantern arrived. The ring now travels with the rising lantern and settles with it. (Let-go lanterns are never stored, by section 6, so they do not appear here.)
2. **Intention panel 220 px to the right on macOS Safari.** With Gentle motion on (the Settings switch, or the system's Reduce motion) the wide layout dropped its centring transform. Fixed in CSS; covered by a desktop test.
3. **Shooting-star hint.** It only appeared after a star passed untapped, once per device. It now shows as the first star appears.
4. **Moon phase** is live: the mean-phase model gives new moon 11 Sep and full moon 26 Sep 2026, matching the almanac; today is first quarter.
5. **Share text** carries the site address: "Light a lantern. Let it rise. https://…/lantern-night/" (copy proposal, `COPY.share.text`).
6. **Tap the empty scene while writing** to go back to the start (new transition intention → arrive). If the keyboard is up, the first tap only puts it away.
7. **Shooting stars** every 20–60 s instead of 45–120 s (section 7 deviation, on request).
8. **iOS silent switch.** Web Audio follows the ringer switch unless a media element is playing, so a looping one-second silent WAV, generated in code, plays alongside the soundscape and pauses with Sound off or a hidden tab. To confirm on the phone.
9. **Sound hint** once after Begin: "Turn your sound on to hear the evening." (copy proposal, `COPY.system.soundHint`; setting `soundHintShown`).
10. **Tap anywhere to close**: the corner menu closes on any tap outside it (and that tap does nothing else); Your sky, Settings and the share sheet close on a tap on their backdrop.
11. **Settings small print** (copy proposal, `COPY.settings.legal`): "Privacy: your lanterns stay on this device and never leave it. Terms: Lantern Night is offered as is, for reflection only. Back up your sky now and then." at 0.78 rem, 60 % opacity.
12. **Welcome line and moon banner** centred.
13. **Title** mid-screen (42 % down, in the sky under the moon) at 2.8 rem; a tap on it fades it out over 1.4 s with a slight lift and blur.
14. **Boat** redrawn at 24×7 art px (was 15×5) with a lamp post at the bow and two seats.

Tests: `e2e/reviewM5.spec.ts` (items 1, 2, 5, 6, 9, 10, 11, 12, 13), `starAndMoon.spec.ts` updated for item 3.
