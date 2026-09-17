# M2b plan — Review fixes after the iPhone check

Feedback on M2 (2026-09-17) and the agreed direction. Pixel scale stays as in section 7 (about 3 CSS px per art px on phones); sprites get bigger and better drawn instead of the world getting finer.

## Changes

1. **Release from land, no dock.** The shore band becomes ground: two grass tones with a ragged edge, a few rocks, reeds on both sides. The lantern waits just above the shore at the centre, with the lake, hills and sky behind it. `Layout.dockX/dockLen` become `centreX`; the dock sprite goes.
2. **Bigger, truer lantern.** 18×24 art px (about 48×64 CSS px on a phone): wide rounded top, tapering paper, bamboo ring, visible flame in the opening, 4 flicker frames, fill from the bottom. Small lantern 9×12. Sky light 4×4 (round: `.pp. / pccp / pccp / .pp.`), came-true 5×5, let-go 4×4 in ember.
3. **Sky lights vs stars.** 4×4 warm lights with a larger, brighter halo (about 14 art px) and the slow bob. Stars unchanged (cool, 1 px, a few 2×2).
4. **Prompt styling.** Self-hosted Nunito 400/600 and Pixelify Sans (Latin subsets, OFL) in `public/fonts`. One translucent night panel (section 7 surfaces) above the lantern holds the hint line and the buttons, so nothing overlaps the lantern or the shore. Lines cross-fade instead of swapping.
5. **Cozy.** Chimney smoke (1-px puffs rising and drifting from each cottage, slow tick), a moored rowing boat on the lake that rocks one pixel, drifting mist wisps over the far water (light layer, pale, very low alpha), and two lit windows per cottage with a small warm glow in the light layer.
6. **Cottages grounded** (done): the hill is raised under each cottage so nothing floats.

## Tests

- Unit: lantern sprite sizes, sky light maps, layout `centreX` and `lanternRest`.
- E2E: composition asserts shore ground instead of dock wood; lantern specs sample the larger rest rectangle; sky legibility counts warm connected components of ≥ 10 px.
- Screenshots at both viewports, full and squint; headed fps re-measured with 12 lanterns and 1,000 sky lights.

## Result (2026-09-17)

- Unit: 41 Vitest tests pass. End-to-end: 62 Playwright tests pass across chromium/webkit × phone/desktop; screenshots and squint copies in `e2e/output/`.
- Headed at 1280×800 @2x with 12 lanterns and 1,000 sky lights: Chromium 60.0 fps (CPU 0.75 ms/frame), WebKit 60.0 fps (CPU 1.39 ms/frame).
- Sky legibility at 390×844: 40 lights all read as warm 4×4 dots with halos, full size and at 50%; stars unchanged.
- Found by the tests and fixed: the hint cross-fade timer was reset every frame while holding, so "Breathe in…" never appeared. The headless perf smoke check now asserts only that the loop is alive (frames > 30), since the software GPU runs well under 60 fps with 1,000 additive halos; fps numbers come from headed runs.
- Fonts: Nunito (variable 400–600) and Pixelify Sans, Latin subsets, OFL, self-hosted in `public/fonts`. Pixelify Sans is declared but unused until the M3 title.
- Open for the iPhone check: rise pacing, whether 1,000 additive halos hold 60 fps on the device (mitigation in PLAN-M2 risks: cap halos at the newest 300), and how the panel sits above the lantern with the home indicator.
