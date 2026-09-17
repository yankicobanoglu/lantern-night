# M1 plan — The world

Scope from SPEC.md section 10: scaffold, render pipeline, sky bands with dithering, hills, cottages, trees, lake, moon phases, portrait and landscape layouts, exact palette. Budget about €15. No app code has been written yet; this is the plan for one build session.

## Accept when

1. Playwright screenshots at 390×844 and 1280×800 match the composition in section 7 (about 55% sky, 15% hills, 20% lake, 10% shore; moon upper right; dock centred).
2. All 8 moon phases are readable at 390×844, including new moon, and pass the squint test (50% size).
3. Moon phase unit tests pass against the section 5 fixtures (±1 day).
4. 60 fps on desktop, measured.

## Out of scope for M1 (deliberately)

- Lanterns, fireflies, halos beyond the moon, bloom, lake reflections of lanterns: M2.
- Any UI panel, copy, fonts (Nunito, Pixelify Sans), state machine, storage: M3.
- Sound, PWA plugin, service worker, install hints: M4. The Vite `base` is still set now.
- Adaptive quality, session light arc, seated figure: M5 / P1.
- Moon label maths (next new or full moon): M3, but it will live next to the M1 phase module.

## Decisions to make up front

**Pixel scale.** Section 7 says one art px is about 3 CSS px on phones and 4 on large screens, and section 8 says internal height 320. Those two don't both hold at non-integer scale, and nearest-neighbour at a non-integer factor gives uneven pixels. Plan: pick an integer scale in *device* pixels, `s = max(1, round(deviceHeight / 320))`, then set the internal height to `ceil(deviceHeight / s)` so the world fills the screen exactly with uniform pixels. On an iPhone 12 (844 CSS px, DPR 3) that is s = 8, internal height 317, one art px = 2.67 CSS px. On a 1280×800 desktop at DPR 2 it is s = 5, internal height 320, one art px = 4 CSS px. One pixel grid everywhere, as the spec asks.

**Where pixels are drawn.** Static layers (sky bands, stars, hills, cottages, pines, shore, reeds, dock) are baked once per resize on the CPU into a small pixel buffer and uploaded as a nearest-neighbour texture. Slow animations (window flicker, star twinkle, lake ripples) update at a low tick (about 10 Hz) into small buffers. The light layer (moon halo only in M1) is a full-resolution additive container drawn on top. This keeps per-frame GPU work to a handful of sprites, which is what makes 60 fps on a phone realistic later.

**Lake.** Two render passes. Pass 1 renders everything above the horizon (sky, moon, hills; later lanterns) to a render texture. Pass 2 composes the world: that texture, then the lake as one-art-px-high row sprites that sample the pass-1 texture flipped and vertically squashed, each row with an integer x offset from a slow sine (snapped to the grid) and a 0.6 tint (about 40% darker), then ripple highlights, then shore. This design already reflects lanterns in M2 with no changes.

**Moon frames.** 8 frames at 32×32 are generated procedurally (disc, terminator ellipse per phase), then adjusted by hand in the pixel map where needed. Rules baked in: unlit side always drawn in earthshine `#474776`, thinnest crescent at least 4 art px wide, waxing lit on the right. Halo alpha scales with the lit fraction.

**Test hooks.** Query parameters in dev and test builds only: `?date=YYYY-MM-DD` (fixed clock, drives the phase), `?phase=0..7` (force a frame), `?debug` (fps overlay). A `window.__lantern` object exposes fps stats and the layout regions so Playwright can assert on them without pixel-diff baselines, which drift between WebKit and Chromium GPUs.

## Files

```
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html, .gitignore
src/main.ts                 boot: create app, scene, debug hooks
src/config.ts               BASE ('/lantern-night/'), layout fractions, internal height target
src/palette.ts              section 7 tokens, exact hex, as numbers and as rgba tuples
src/engine/app.ts           Pixi v8 Application, DPR, resize, pixel-scale calculation
src/engine/layout.ts        internal W/H, scale, region rows (sky/hills/lake/shore), moon and dock anchors
src/engine/pixelBuffer.ts   CPU RGBA buffer: set, rect, checkerDither, blit pixel maps, toTexture (nearest)
src/engine/pipeline.ts      pass-1 texture, world texture, upscale sprite, light layer, compose order
src/engine/ticker.ts        frame loop, 10 Hz slow tick, fps stats
src/engine/rng.ts           seeded PRNG (mulberry32) so hills and stars are stable per seed
src/scene/sky.ts            8 bands top to horizon with 2-px checker dithering at edges, stars
src/scene/hills.ts          far and near hill profiles from seeded bumps, cottage and pine placement
src/scene/lake.ts           row-mirror reflection, snapped sine, ripple highlights
src/scene/shore.ts          shore band, reeds, dock
src/scene/moon.ts           phase to frame, moon sprite in the pixel layer, halo in the light layer
src/scene/sprites/moon.ts   8 × 32×32 pixel maps
src/scene/sprites/cottage.ts, pine.ts, reeds.ts, dock.ts
src/scene/scene.ts          assembles layers, handles resize and landscape extension
src/ritual/moonPhase.ts     pure maths: age, isNew, isFull, frameIndex, phaseName
src/debug.ts                query params, fps overlay, window.__lantern
tests/unit/moonPhase.test.ts
tests/unit/layout.test.ts
e2e/composition.spec.ts     screenshots + region assertions at 390×844 and 1280×800, both browsers
e2e/moonPhases.spec.ts      8 screenshots at 390×844 (full and 50% size), moon disc detected in each
e2e/perf.spec.ts            fps over 3 s in Chromium, threshold as a smoke test
```

## Steps

1. **Scaffold.** `npm create vite@latest` (vanilla-ts), strict TypeScript, add `pixi.js@8`, `vitest`, `@playwright/test` (WebKit + Chromium). Set `base: '/lantern-night/'` from `src/config.ts`. Full-screen canvas, `aria-label` describing the scene, `touch-action: none`, safe-area insets. Scripts: dev, build, preview, test, e2e. Check: blank night-coloured page loads at `/lantern-night/`.
2. **Palette and layout maths.** `palette.ts` with exact hex. `layout.ts` computing scale, internal size and region rows for portrait and landscape. Unit test the 390×844 @3x and 1280×800 @2x cases.
3. **Pixel buffer and pipeline.** Buffer helper with nearest-neighbour texture upload. Pipeline with pass-1 and world render textures, integer upscale, light layer. Check: a test pattern shows crisp uniform pixels at both viewports.
4. **Sky.** 8 bands with 2-px checker dithering at each edge, no gradients. Stars: cool white 1 px, a few 2×2, seeded, sparse near the horizon. Slow twinkle on the slow tick. Check: screenshot, band edges dither cleanly.
5. **Moon.** Phase maths + unit tests with the four fixtures. 8 frames, earthshine, halo. Frame chosen from age. Check: 8 screenshots at 390×844 plus 50% copies; new moon is a visible disc; crescent at least 4 px.
6. **Hills, cottages, pines.** Far hills with two lit cottage windows (2 cottage variants, window in lantern colour with a slow flicker). Near hills with pine silhouettes (3 variants). Profiles come from a seeded function of x so landscape widths extend naturally. Check: screenshot at both viewports.
7. **Lake and shore.** Row-mirror reflection with snapped sine and 0.6 tint, ripple dashes on the slow tick, shore band, reeds, dock centred in wood colours. Check: screenshot; the moon reflects on the water.
8. **Landscape.** Verify 1280×800 keeps the vertical split, dock centred, moon upper right, hills extended. Check: screenshot.
9. **Performance.** Frame loop with fps stats; `?debug` overlay. Measure in headed Chrome and Safari on the Mac. Aim: 60 fps with under 1 ms of CPU per frame in steady state, since nothing but the slow tick should be touching pixels.
10. **End-to-end.** Playwright config with `vite preview` as web server, two viewports, two browsers, screenshots written to `e2e/output/`. Region assertions read `window.__lantern.layout`; moon test detects the disc by sampling the moon colour and earthshine colour from the pixel buffer. Squint copies at 50% saved next to full-size ones.
11. **Review and commit.** Look at every screenshot at full and 50% size against section 7. Report fps numbers. Commit once as "M1: the world". Check spend on the Usage page.

## Risks

- **WebKit in Playwright** may not give WebGL2 headless; fall back to Pixi's WebGL1 path or run WebKit screenshots headed. Decide at step 10, not before.
- **Non-integer scale on odd screens** (for example DPR 2.625 Android) is handled by the device-pixel integer rule but leaves a sliver at the bottom; the shore band absorbs it.
- **Squint readability of new moon** depends on the halo staying faint but present and on earthshine contrast against the sky band behind the moon. If the moon sits on the `dusk` band the contrast ratio to `#474776` is low; move the moon anchor into the `night` band if needed.
- **Budget.** If step 6 or 7 balloons, ship simpler hill profiles first and polish in M5.

## Result (2026-09-17)

- Unit: 22 Vitest tests pass (moon phase fixtures, sprite frames, layout maths).
- End-to-end: 21 Playwright tests pass across chromium/webkit × phone/desktop. Screenshots and 50% squint copies land in `e2e/output/` (git-ignored).
- Squint check: all 8 moon frames identifiable at 50% on 390×844, new moon reads as an earthshine disc, crescents are 4 art px at the equator.
- Performance (headed, real GPU, 1280×800): Chromium 60.0 fps, WebKit 59.9 fps, scene CPU ≈ 0.3 ms per frame (p95 ≤ 1 ms). Headless Chromium is software-rendered (~28 fps), so the Playwright perf spec asserts only the CPU budget.
- Deviation from the spec numbers: with the integer device-pixel rule and internal height 320, a 1280×800 desktop at DPR 2 gets 2.5 CSS px per art px, not 4. The 4 CSS px figure would need a 1280 px tall screen or an internal height of 200. Kept 320 for detail.
- Not done in M1 by design: fonts, UI, PWA, sound (later milestones). Dev/test hooks `?date=`, `?phase=`, `?seed=`, `?debug` are always on for now; gate them before M5.
