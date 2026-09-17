# M2 plan — Lanterns and light

Scope from SPEC.md section 10: lantern sprite and flicker, hold-to-light with breath guide, swipe release, wind field, rise and hand-off to the sky, halos and bloom, lake reflections, fireflies. Budget about €20. Builds on the M1 pipeline without changing its pixel rules.

## Accept when

1. 12 active lanterns hold 60 fps on desktop, measured headed (Chromium and WebKit), with the CPU-per-frame budget also asserted headless in Playwright.
2. Past lanterns in the sky are clearly distinguishable from stars at 390×844, full size and at 50% (squint).
3. It feels right on the iPhone: hold-to-light, swipe without scrolling, rise pacing. Manual check by the user at review.

## Out of scope for M2 (deliberately)

- Full state machine, copy deck beyond the Light/Release strings, modes, moon banners: M3. The hold and swipe need *some* words, so `src/ritual/copy.ts` starts with exactly the section 4 **Light** and **Release and watch** strings and M3 completes it.
- Storage: M3. Sky lights live in memory for the session; the hand-off produces the `Lantern.sky` point and `seed` that M3 will persist.
- Fonts (Nunito, Pixelify Sans): M3. The M2 hint text uses the system sans-serif and the section 7 panel/button styling, so M3 only swaps the font.
- Sound: M4. The hold/release/shimmer hooks exist as no-op callbacks.
- Adaptive quality, haze merging beyond 1,000, seated figure: M5 / P1.

## Decisions to make up front

**Where lanterns are drawn.** The `above` pass covers rows `[0, hillsEnd)` and the lake mirrors it, so a lantern above the horizon reflects for free, exactly like the moon. But the lantern starts over the dock, in the lake region, where `above` is hidden under the water rows. So every lantern has **two pixel sprites sharing one texture and position**: one in `above` (reflected, clipped at the shoreline) and one in a new `near` container in `world`, drawn after the lake rows and before the shore. Above the shoreline both draw identical opaque pixels, so nothing double-shades; below it only the `near` copy shows. One pixel grid, no special cases.

**Sizes and the pixel grid.** Section 7 fixes the lantern at 12×16 art px and the small sky lantern at 6×8; the sky light is 2×2. The rise steps through them by height progress `p` (0 at the dock, 1 at the stored sky point): big for `p < 0.4`, small for `0.4 ≤ p < 0.85`, dot after. The pops are masked by the light layer, whose halo shrinks continuously. No sprite is ever scaled.

**Lantern sprite.** Paper body tapered at the bottom, a dark opening with the flame. 4 paper frames (highlight pixels wander between lantern, lantern-core and ember) × flame frames drawn separately in the same map. While unlit the paper is `plum` with an `ember` rim; the hold **fills it from the bottom** row by row (`fill` 0→1), and the flame grows from 1 px to full over the same 4 s. All frames are generated from one base map plus a per-frame highlight table, and unit-tested for size and colour set.

**Motion.** Per lantern: position in art px (float), horizontal velocity, height progress `p`. Vertical: rise speed eases from `RISE_SPEED` to ~35% of it near the target so the light *settles*. Horizontal: constant buoyant sway (two slow sines) + a **curl-noise wind field** `wind(x, y, t)` from a 2D value-noise potential (derivatives by central difference) that drifts over ~40 s, plus a steering term `k·(targetX − x)·p²` so every lantern lands on its stored sky point. Positions are rounded only when placing pixel sprites; the light layer uses the float. With reduced motion the rise is 1.6× slower and the sway amplitude halves.

**Sky point.** Chosen at release from the lantern's `seed`: x anywhere except a 20-px moon exclusion, y in the upper 60% of the sky (bands night…violet), avoiding a 6-px neighbourhood of existing lights when possible. Normalised 0–1 as `sky: {x, y}` so it survives resizes.

**Sky lights (past lanterns).** Pixel layer: drawn into the existing star-twinkle overlay buffer on the 10 Hz slow tick, 2×2 `lantern` with one `lantern-core` pixel, a 1-px bob from a slow per-light sine. Came-true (M3) is 3×3 and brighter, let-go is `ember`. Light layer: one `ParticleContainer` (position + alpha dynamic), one small additive glow texture, up to 1,000 particles, bobbing with the pixel. This is the "warm, ≥2×2, tiny halo, slow bob" rule from section 7 made concrete, and stars stay cool white with no halo.

**Halos, bloom, reflections.** Per active lantern three light-layer sprites: a wide `glow` halo (≈4× sprite width, alpha ∝ fill × flicker), a tight `lantern-core` bloom (≈1.3× width), and a **reflection streak** (vertically elongated glow, `glow` colour) on the water below. The streak sits under the lantern while it is over the dock, and at the mirror point about the shoreline once above it (`max(y + h, hillsEnd + (hillsEnd − y)/squash)`), fading with height as the pixel mirror takes over. Streak x wobbles smoothly, so the pixel lake keeps its snapped sine and the light layer stays soft, as section 8 wants.

**Fireflies.** 10–16 points along the shore/reeds rows, 1–2 px `firefly` in a small pixel overlay updated on the slow tick (random walk ≤1 px per tick, blink envelope of ~1.5 s on, 2–5 s off), each with a tiny additive halo in the light layer that follows the float position. Halved count under reduced motion.

**Interaction (no UI framework).** `src/ritual/hold.ts` owns pointer events on the canvas: press and hold anywhere for 4 s (breath in) → lit; letting go early eases the fill back down, no failure state. Once lit, a swipe up (≥ 60 CSS px, mostly vertical) or the *Let it rise* button releases. `src/ui/lightUi.ts` is a minimal DOM overlay: a breath ring (CSS, expands over the 4 s hold around the lantern), one hint line, and the two buttons *Light it* (tap alternative; fills in 1.2 s) and *Let it rise*. Strings come from `copy.ts` verbatim. `touch-action: none` on the overlay too, so a swipe never scrolls. After release a fresh unlit lantern appears over the dock after 1.5 s, so a session can light several (M3 decides when to stop and show *Goodnight*).

**Test hooks.** `?lanterns=N` spawns N lit lanterns already rising at staggered heights (perf test). `?sky=N` seeds N past lights (legibility test). `window.__lantern` gains `lanterns()` (active count and positions), `skyLights()` (count), `light()`, `release()` and `speed(x)` (time multiplier) so Playwright can walk the hold → lit → release → hand-off path in a few seconds without pixel-diff baselines.

## Files

```
src/config.ts                  + HOLD_MS, TAP_LIGHT_MS, RISE_SPEED, MAX_ACTIVE (12), MAX_SKY (1000), firefly counts
src/ritual/copy.ts             Light + Release strings, verbatim from section 4
src/engine/noise.ts            + valueNoise2D
src/engine/wind.ts             WindField: curl of a drifting noise potential, sample(x, y, tSec)
src/engine/motion.ts           MotionLevel from prefers-reduced-motion (settings override lands in M3)
src/engine/lightTextures.ts    + streakTexture (vertical soft ellipse), + dotGlowTexture (tiny halo)
src/scene/sprites/lantern.ts   base maps (12×16, 6×8), frame generation, fill mask, palette; skyLightMap
src/scene/lantern.ts           Lantern entity: state, physics, above/near pixel sprites, 3 light sprites
src/scene/lanterns.ts          LanternField: spawn, update, sky-point choice, hand-off event, cap at 12
src/scene/skyLights.ts         SkyLights: pixel dots on the slow tick + ParticleContainer halos, bob
src/scene/fireflies.ts         Fireflies: pixel overlay + halos
src/scene/scene.ts             wires near container, field, sky lights, fireflies; exposes them
src/ritual/hold.ts             HoldController: pointer state machine (idle/holding/lit/releasing), events
src/ui/lightUi.ts              breath ring, hint, buttons; section 7 surface styles; system font for now
src/debug.ts, src/main.ts      hooks above; boot wires field ↔ hold ↔ ui
index.html                     overlay root, overlay styles
tests/unit/lanternSprite.test.ts   sizes, palette-only colours, fill monotone, 4 distinct frames
tests/unit/wind.test.ts            bounded, smooth, divergence-free-ish (numerical), deterministic
tests/unit/lanternPhysics.test.ts  a lantern reaches its sky point and hands off; x lands within 1 px
tests/unit/skyPoint.test.ts        avoids the moon, stays in the upper sky, normalised
e2e/lanterns.spec.ts           hold→lit→release→hand-off at speed 8; screenshots lit / rising / settled
e2e/skyLegibility.spec.ts      ?sky=40 at phone: warm 2×2 blocks counted, screenshots + squint
e2e/perf.spec.ts               + ?lanterns=12 case, CPU budget
```

## Steps

1. **Copy, config, motion level.** Add strings, constants, `prefers-reduced-motion` read. Check: unit tests still green.
2. **Lantern sprites.** Maps, frames, fill mask, small lantern, sky-light map. Unit tests. Check: a debug page renders the 4 frames and 5 fill levels side by side (screenshot), sizes exact.
3. **Wind field.** 2D value noise + curl. Unit tests for bounds, determinism and smoothness.
4. **Lantern entity and field.** Physics, size stages, sky-point choice, hand-off. `?lanterns=N` hook. Unit test the rise to hand-off with a fixed dt. Check: 12 lanterns rise and settle on desktop, screenshot mid-rise.
5. **Light layer.** Halo, core bloom, reflection streak per lantern; moon halo unchanged. Check: screenshots at both viewports, lit lantern over the dock reads warm at 50%.
6. **Sky lights.** Pixel dots + particle halos + bob. `?sky=N`. Check: phone screenshot with 40 lights and squint copy; count warm 2×2 blocks in e2e.
7. **Fireflies.** Pixel overlay + halos. Check: screenshot, they read as green-gold points near the reeds and not as stars or sky lights.
8. **Hold, swipe, UI.** Pointer controller, breath ring, hint line, two buttons, spawn of the next lantern. Check: Playwright walks the flow in both browsers with touch and mouse; page never scrolls; screenshots of idle, mid-hold, lit.
9. **Performance.** Headed Chromium and WebKit at 1280×800 with `?lanterns=12&sky=1000&debug`: fps and CPU ms. Headless perf spec asserts CPU ≤ 4 ms average with 12 lanterns and 1,000 sky lights. Bundle size after `npm run build` (≤ 350 KB gz).
10. **Review and commit.** Every screenshot at full and 50% against section 7; then "M2: lanterns and light". Record results below and check spend.

## Risks

- **Pixel-grid pops** at the 12×16 → 6×8 → 2×2 steps. Mitigation: switch while the halo is still bright and shrink the halo continuously; if it still jars, add a one-frame darker "in-between" frame rather than scaling.
- **1,000 halos** may cost fill rate on a phone. They are tiny (≈ 8 art px) and additive; if the headed measurement drops below 60 on desktop, cap the halo count at the 300 newest lights and leave the rest as pixel dots (still ≥ 2×2 warm, still bobbing).
- **Hold gesture vs. scroll on iOS Safari.** `touch-action: none` on both canvas and overlay, `preventDefault` on `touchmove`, and no scrollable ancestors. The manual iPhone check confirms.
- **Headless WebGL** was software-rendered in M1; perf numbers again come from headed runs, the spec asserts CPU only.

## Result (2026-09-17)

- Unit: 41 Vitest tests pass (M1's 22 plus lantern sprite, wind field, rise physics, sky point).
- End-to-end: 62 Playwright tests pass across chromium/webkit × phone/desktop (22 skips are the viewport-specific specs). Screenshots and 50% squint copies in `e2e/output/`: unlit, holding, lit, rising, settled, sky legibility.
- Flow verified with real pointer input in both engines: 4 s hold lights the lantern, letting go early eases the fill back (no failure state), a swipe of ≥ 60 CSS px releases without scrolling the page, the tap alternative and *Let it rise* button work, the lantern rises, hands off and appears as a warm 2×2 sky light.
- Squint check: with 40 past lanterns at 390×844 every light reads as a warm dot with a halo; stars stay cool 1 px points. A rising lantern is identifiable at 50% on both viewports, with its reflection dash in the lake.
- Performance, headed at 1280×800 @2x (Playwright, real GPU):

  | Engine | Scene | fps | CPU / frame (avg, p95) |
  |---|---|---|---|
  | Chromium | quiet | 60.0 | 0.34 ms, 0.70 ms |
  | Chromium | 12 lanterns + 1,000 sky lights | 60.0 | 0.49 ms, 1.00 ms |
  | WebKit | quiet | 60.0 | 0.41 ms, 1.00 ms |
  | WebKit | 12 lanterns + 1,000 sky lights | 60.0 | 1.08 ms, 2.00 ms |

- Bundle: about 158 KB gzipped of JS (PixiJS included), budget 350 KB.
- Found by the tests and fixed: the next lantern appeared 1.5 s after release and its idle hint overwrote the second release line. The next lantern now waits 4.5 s, after both lines.
- Tooling: `.claude/launch.json` now lets the dev server take an assigned port when 5173 is busy (Vite reads `PORT`).
- Not done in M2 by design: the full copy deck, modes, storage, fonts, sound (M3/M4). The rise pacing (about 15–25 s to settle) and hold feel still need the manual iPhone check (`npm run dev -- --host`).
