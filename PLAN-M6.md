# M6 plan — Roadmap review, extra scenes, real-night events

Asked for: a critical read of ROADMAP.md sections 1–3 as a software architect before building anything; then, from section 4, only 4.1 (extra scenes) and 4.6 (real-night events); and the crickets a little lower. Builds on M5 without changing the ritual, the pixel rules or the storage format.

## Part 1 — Review of the roadmap (sections 1–3)

Read against the code as it is after M5. Each item: the verdict, the reason, and what to do instead when the item as written is not the right move.

### 1. Architecture

**1.1 Split the session — agree with the symptom, not the cut.** `session.ts` is 621 lines and every review fix lands in it. But "RitualFlow, Overlays, Sharing, Hints, each taking the same `SessionDeps`" recreates the problem: four classes sharing one deps bag and the same mutable cross-state (`released`, `watchShown`, `mode`, `lastWish`, `shareWish`). A shared deps bag is a service locator; it hides coupling instead of removing it, and units that take a Pixi renderer are not "testable without a browser". Cut by *state ownership* instead: (a) an `Overlays` controller that owns which sheet is open, the `overlay-open` class and where focus returns (today that bookkeeping is spread over eight methods, and it is the one piece with real internal state, `shareReturnTo`); (b) `Backup` (save, restore, clear are store + toast and already independent); (c) a `StarScheduler` (the interval, the first-session rule, the rate, the hint) that takes `now`, an rng and a `spawn` callback, which *is* unit-testable. The ritual flow (begin → fold → release → watch → goodnight) stays in the session, because it is the session. Keep `update()` in one place: it is the per-frame hot path.

**1.2 One identity for a light — agree; it is the most valuable small item, and "S" undersells it.** The four views exist because they live in different coordinate systems and lifetimes (stored: normalised and persisted; `SkyLight`: normalised with status; scene `Lantern`: art px with rise state; `SkyEntry`: CSS px with text). One `Light` type will not remove those. What removes the bug class is one *source of truth* for "what is in tonight's sky" and one derivation from it. The M5 fix already made Your sky read the scene; but two call sites still bypass the derivation (`restoreBackup` and `clearSky` pass `store.lanterns` straight to `skyView.show`), so a let-go light vanishes from Your sky right after a restore. Also the session-only id `night-${i}` is index-based and changes when the oldest light is dropped past 1,000; use the seed. Both are fixed in this milestone because the scene work touches those lines anyway.

**1.3 Scene subsystems behind one interface — disagree as written.** The six subsystems have different lifecycles on purpose: `SkyLights` keeps data across a resize, `Fireflies` rebuilds, `Cozy` needs the hill features, `Lake` needs the `above` render texture, the star lives in CSS px. A uniform `SceneSystem` forces no-op methods and an untypeable `build(layout, ???)`. And the real wiring in `Scene` is not the method fan-out; it is the *z-order* (which layer each sprite goes into, in what order), which a list of systems does not express and which the pixel rules depend on (lake rows sample `aboveRT`, lanterns split above/near the shoreline). The seam 4.1 needs is not scene↔subsystem but **session↔scene**: what the ritual needs from a scene is small (a resting lantern, release, the rising set, the lights, a field mapping, moon, star, evening, quality, motion). That is defined in this milestone. Water lanterns reuse the whole world with a different *field* and lantern set, which is why the first extra scene costs S, not L; a dandelion field or a wishing well needs a new world (M each), which is the honest size.

**1.4 Settings as an observable — right goal, wrong mechanism for five consumers.** An event bus adds subscription lifetimes and "who subscribed first" ordering bugs. The "keep X in step with Y" bugs came from the mute button and the sheet each caching state; `applySettings()` as the single writer that derives every consumer from the store already fixes that pattern. Keep it, and add a unit-level table test that every `Settings` key is applied. An observable earns its place only with localisation (4.2), when copy re-render subscribes everywhere. Defer 1.4 to 4.2.

**1.5 Audio graph as data — agree on the scheduler, not on the DSL.** The `setTimeout` chains do drift, and there is a worse case: the context is suspended while the tab is hidden but the timers are only throttled, so on return the queued cricket bouts fire in a burst. The fix is the standard Web Audio pattern: one look-ahead scheduler that books events ~2 s ahead on the audio clock from a single 250 ms timer, and skips what fell behind. A declarative patch format is a DSL to maintain for one soundscape with no second consumer; ~40 nodes built once is fine imperative code. The per-layer mixer is worth having and is 20 lines: this milestone adds the first layer gain (crickets), which is also how "a little lower" is done here, as a mix decision instead of a change to the envelope.

**1.6 Versioned storage — strongly agree; the highest-value S item.** Two sharp edges today: `parseBackup` rejects any `version !== 1`, so a v2 writer strands v1 readers on old installs (the rule must be "readers accept ≤ current and migrate; writers write current"); and `load()` spreads unknown keys over defaults with no version, so a renamed key silently resets, while `isLantern` drops a record with an unknown status instead of migrating it. Add `schemaVersion` to settings and a `migrate(raw)` step. This milestone adds one settings key (`scene`), which is additive and safe under the current spread; nothing here changes the lantern record or the backup version.

**1.7 Copy deck as data — mild disagree on timing.** `COPY` carries functions with logic (`return.heading(date)`, `moon.next(kind, days)`, `sky.count(n)`); JSON forces an interpolation mini-language and loses the `as const` types that make a copy typo a compile error. copy.ts already *is* a data file that can be reviewed on its own. If 4.2 comes, do `copy/en.ts` and `copy/tr.ts` typed as `typeof en`: the same one-file-per-language review, with missing keys caught by the compiler.

**1.8 Visual regression in CI — agree, with a warning and a cheaper first step.** Headless Chromium on a Linux runner draws with software GL; baselines must be generated in CI, and the light layer (additive blending) is the least stable part, so it needs masks. Cheaper and more precise for this project's rules: a *palette audit* on the art-px world (every pixel of `worldRT` is in `PALETTE`, per state, quality and evening) using the `sampleRect` hook that already exists. That checks "palette exact, no mixed pixel sizes" by machine with no baseline. Then screenshot baselines only for the composition at 390×844 with the light layer masked.

**1.9 Performance in CI, honestly — agree fully.** The M5 table shows this Mac never leaves vsync, so the levels cannot be told apart on it. Add: the CPU budget in `perf.spec.ts` should be a p95, not a mean; and the device-lab note (3.5) should record the level the governor settled at.

**1.10 Branch previews — agree.** `BASE` is one value, but a preview at `/lantern-night/preview/<branch>/` also needs the manifest `start_url`/`scope` and the service-worker scope to follow (they do, via `BASE`), so build with `BASE` from an env var. Distinct scopes also stop the main and preview service workers from fighting on one origin.

### 2. Optimisations

The section says it plainly: measured on a Mac, everything holds 60 fps, and these are guesses about the phone. The right first step is a phone profile (Safari Web Inspector timeline) before any of 2.1/2.2; the CPU side of the loop is under 1 ms at full load, so the frame budget on a phone is GPU fill.

**2.1 One draw for the lake — skip unless a profile says otherwise.** The 64 row sprites share one texture, so Pixi batches them into one or two draws already; repositioning 64 sprites is microseconds. A displacement shader is per-pixel, while the current sway is per-row and snapped to the art grid, which is the pixel rule. This is a rewrite for no measured gain that changes the look.

**2.2 Cheaper light layer — the plausible one.** Additive full-resolution fill is the classic mobile cost: each lantern halo is a ~300 css px quad, up to 12 of them, plus 1,000 halos at 14 css px. Do the *half-resolution light layer* step first: render `light` into a render texture at 0.5× and draw it scaled up with linear filtering. It is cheap in Pixi, keeps everything visible, halves the fill, and can be measured on the phone through `?debug`. Baking halo and core into one texture saves one sprite per lantern (12 at most): negligible.

**2.3 Bundle — the stated target is not reachable, and the need is small.** Pixi v8's core with the WebGL renderer is ~90–100 KB gzipped on its own; M5 measured the main chunk at 104.7 KB, 30% of the 350 KB budget. "Under 80 KB" would need deep imports that v8 only partly supports, and the extract system (tests, share) pulls more in. What is worth doing: lazy-load the share composer and the audio engine (both sit behind a user gesture; two more precached chunks, offline unchanged). "First render < 2 s on 4G" is not JS-bound: 105 KB gzipped is well under a second on 4G; first render is the render-texture build and the fonts.

**2.4 Idle throttling — agree; the item most likely to matter for the real use.** A phone on the nightstand in arrive or goodnight. `ticker.maxFPS = 30` after a minute without input, back to 60 on the next pointer or key event; the arc and star clocks use `deltaMS`, so nothing else changes. Battery is the win; on iOS the screen stays awake either way.

**2.5 Texture lifetime — the cache cap solves a problem that cannot occur; the share scene is the real one.** The glow cache is keyed by size, colour and alpha, so it holds about ten entries for the life of the page. The spike is `composeShareCanvas` building a whole `Scene`, including a fresh `LanternTextures` (4 frames × 29 fills × 2 sizes = 232 uploads) per render. Fix: share the sprite sets between scenes and stop `scene.destroy()` from destroying them. Done in this milestone, because a scene swap would otherwise rebuild them as well.

**2.6 Startup order — only the font preload is real.** The sky is already drawn before the store resolves (`Scene` builds and the ticker runs before `session.start()` awaits `store.load()`), so that premise is wrong. Moving `registerSW` after first render gains nothing measurable: the worker installs on its own thread. `<link rel="preload">` for the two font files is cheap and removes the late title-font swap.

### 3. Product polish

**3.1 The seated figure — agree it is the missing body; two notes the item lacks.** Draw order: the figure sits *on* the shore and *behind* the lantern, so it goes after `shoreSprite` and before `lanterns.nearLayer` in the world layer, which is not today's order (lake, boat, near lanterns, shore, fireflies). Size: a figure under 9 art px on a phone fails the 24 screen px rule; make it 12–14 art px tall. With the water scene it kneels at the water's edge: a second pose map.

**3.2 Haze beyond 1,000 — agree, and note the count bug it hides.** `SkyLights.add` drops the oldest light but the stored record stays, so above 1,000 "N lanterns lit" and the sky disagree, which is 1.2's bug class again. Compute the haze from the stored count, not from the displayed lights.

**3.3 Landscape composition — agree; cheaper than M.** Hills and shore are seed-driven and the cottages already branch on `layout.landscape`. What the item misses: the light field also stretches on landscape, so lights spread thin; give the field a maximum width around the dock.

**3.4 Haptics — agree; four lines.** `navigator.vibrate` works on Android only after a user gesture, and the hold is one.

**3.5 Device lab note — agree.** Record the browser version, the governor's settled level and the `?debug` frame time.

**Suggested order after this milestone:** 1.6 and 1.2 (data safety, small), then 2.4 and the half-resolution light layer from 2.2 measured on the phone, 3.1 when the budget allows. Skip 1.3 and 2.1 as written, keep 1.7 in TypeScript, defer 1.4 to 4.2, do only the lazy-load half of 2.3.

## Part 2 — What this milestone builds

**4.6 Real-night events (S), whole.** `src/ritual/nightEvents.ts`, pure and unit-tested:
- Meteor showers on their calendar dates (Quadrantids, Lyrids, Eta Aquariids, Perseids, Orionids, Leonids, Geminids, Ursids), each with a peak day, a window of ±1–2 days and a rate factor. On a shower night the shooting-star interval is divided by the factor (Perseids ×3: 7–20 s instead of 20–60 s). The first-session rule is unchanged.
- Supermoon: a full moon (section 5 rule) within 0.1 of an anomalistic month (27.554550 days, reference perigee 2024-10-17 00:51 UTC) of perigee, which is the usual "within 90% of the closest approach" definition under the mean model. Fixtures: 2023-08-31, 2024-09-18, 2024-10-17, 2024-11-15, 2025-11-05 are supermoons; 2024-02-24 and 2025-04-13 (near apogee) are not.
- Drawn "a little larger": the moon map generator takes a size, and a supermoon uses a 36×36 disc instead of 32×32 (the same pixel grid; never a scaled sprite), with the halo following. `?supermoon` pins it for screenshots; `window.__lantern.night()` reports shower, rate and supermoon.
- No new copy: the item asks for a rate and a size, and the deck has no line for either. Proposals for later are listed under "Copy" below.

**4.1 Extra scenes (L), first scene and the seam.** The roadmap sizes this as several milestones, and CLAUDE.md asks for one milestone per session, so this session builds the seam, the setting, and the first scene end to end; the dandelion field and the wishing well are follow-ups (each needs a new world: M each).
- **Field** (`src/scene/field.ts`): where lights settle. A scene has a field (art px band, normalised range, avoid zones). `sky` is the upper sky band avoiding the moon (today's rule, unchanged numbers); `water` is the far half of the lake. The stored `Lantern.sky` point is interpreted through the current scene's field, so the same sky moves between scenes and storage is untouched.
- **Lantern sprite sets** (`src/scene/lanternTextures.ts`): the sky lantern and the water lantern (a tōrō-nagashi style floating lantern: paper box on a wooden float, 20×15 art px at rest, 14×10, 7×5 and the 4×4 dot as it drifts off; paper lit from the bottom while holding, flame above the rim once lit). Sets are built once per kind and shared between scenes (2.5).
- **Scene kind** (`Scene(..., kind)`): same world (sky, hills, cottages, lake, shore, moon, fireflies, boat, mist, star); the kind chooses the field, the sprite set, the rest point, the drift tuning (slower, wind damped, gentle sway) and the layer the lights draw in (sky: above the shoreline, reflected by the lake; water: on the lake, in front of the reflection).
- **SceneHost** (`src/scene/host.ts`): owns the live scene and swaps it when the setting changes, carrying over moon, quality, evening, speed, motion and every light. Mid-ritual rules: a lantern still waiting is placed again in the new scene with its words (hold again); lanterns on their way settle at once and their lights carry over; the watch buttons show if they had not yet.
- **Setting**: `Settings.scene: 'sky' | 'water'` (default `sky`, additive, old backups fine). Settings sheet gets a "Scene" row with two choices. `?scene=sky|water` pins the boot scene for tests.
- **Your sky** projects light positions through the scene's field, and the two bypassing call sites now use the one derivation (1.2).
- **Share image** composes the current scene kind and the supermoon flag.

**Crickets a little lower.** A `CRICKET_LEVEL` layer gain (0.7, about −3 dB) on the cricket bus in `ambient.ts`, as the first per-layer mix control (1.5), leaving the envelopes as they are.

## Copy

New strings are proposals (not in the deck), marked in `copy.ts` like the earlier ones:
- Settings row: "Scene"; choices "Sky lanterns" / "Water lanterns".
- Water scene only: lit line "Beautiful. Now breathe out, and let it drift." and the release button "Let it drift" (the deck's "let it rise" reads wrong for a lantern on the water). Every other line is shared verbatim.
- Not built, for a decision: a moon-label line on shower nights ("The Perseids are passing tonight.") and "Supermoon" as the phase name on those nights.

## Files

```
src/ritual/nightEvents.ts        showers, supermoon (pure)
src/scene/sprites/moon.ts        moonPixelMap(frame, size)
src/scene/moon.ts                setSupermoon
src/scene/field.ts               Field, skyField, lakeField, pickFieldPoint, fieldToArt
src/scene/skyPoint.ts            SkyPoint type only
src/scene/sprites/waterLantern.ts water lantern maps
src/scene/lanternTextures.ts     LanternSpriteSet, shared per kind
src/scene/lantern.ts, lanterns.ts sprite set, rest point, field, kind tuning, wellOnItsWay, settleNow
src/scene/skyLights.ts           field-based placement
src/scene/scene.ts               kind, field, layer order
src/scene/host.ts                SceneHost
src/audio/cues.ts, ambient.ts    CRICKET_LEVEL
src/store/types.ts               Settings.scene
src/ritual/copy.ts               proposals above
src/ui/settings.ts, lightUi.ts, skyView.ts
src/ritual/session.ts            host, star rate, scene switch, entries
src/share/compose.ts             kind, supermoon
src/main.ts, src/debug.ts        host, ?scene, ?supermoon, night()
tests/unit/nightEvents.test.ts, moonSprite.test.ts, skyPoint.test.ts, waterLantern.test.ts
e2e/scenes.spec.ts, nightEvents.spec.ts
README.md, ROADMAP.md
```

## Steps

1. Night events: pure module and tests; moon size; hooks; session rate; e2e.
2. Field and sprite sets; lantern/field/lights take them; sky scene unchanged pixel for pixel (existing suites).
3. Water lantern sprite; water kind; host and swap; setting, sheet, copy; Your sky projection; share.
4. Crickets.
5. Screenshots at 390×844 and 1280×800, squint check; full suites; README, ROADMAP; commit.

## Result (2026-09-18)

- Unit: 96 Vitest tests pass (14 new: showers and supermoon fixtures, the 36 px moon disc, the water lantern maps, the two fields). End-to-end: 280 test runs across the four projects, 250 passing and 30 project-specific skips (the M1–M5 suites unchanged); the keyboard-only run is untouched because the Scene row sits below Text size. New specs: `scenes.spec.ts` (the water lantern waits, lights from the bottom, drifts inside the lake band, settles as a light on the water; Your sky rings land on the lake; the setting is stored, swaps the world live with every light carried over, survives a reload; a swap mid-watch settles the lantern and keeps the buttons; the share image composes the water scene) and `nightEvents.spec.ts` (the Perseids divide the scheduled interval by 3; an ordinary night does not; 2024-10-17 draws a 36 px full moon and 2024-02-24 a 32 px one; `?supermoon` pins it). Screenshots and squint copies in `e2e/output/` (`*-water-*`, `*-supermoon`, `*-settings-scene`).
- Bundle: main JS 110.2 KB gzipped (+5.5 KB over M5: the second sprite set, the fields, the host and the night events). Budget is 350 KB.
- Crickets: the cricket bus now sits at `CRICKET_LEVEL` 0.7 (about −3 dB); envelopes unchanged.

**Deviations and notes for review.**
- Copy proposals in use (all marked in `copy.ts`): Settings "Scene", "Sky lanterns", "Water lanterns"; water scene only: "Beautiful. Now breathe out, and let it drift." and "Let it drift". Not built, for a decision: a moon-label line on shower and supermoon nights.
- 4.1 is one scene of three. The seam is in; a dandelion field and a wishing well each need a new world and are their own milestones.
- The scene setting is additive to `Settings`; old backups and stores read as `sky`. The lantern record and the backup version are unchanged.
- Fixes taken in passing from the review (1.2): Your sky after a restore or a clear now uses the one derivation, and a session-only light's id is its seed, not its index.
- The supermoon rule uses a mean anomalistic month from a reference perigee; the five almanac supermoons and two micromoons in the fixtures agree. A night either way is possible in edge years and is invisible to a visitor.
- The iPhone check for this milestone is the user's: the water lantern at arm's length, the drift's pace, and the crickets' new level with the phone speaker.
