# Lantern Night

> Light a lantern. Let it rise.

A calm, 2–3 minute evening ritual in the browser. You write a wish (or something you want to let go of), light a paper lantern, and release it over a quiet lake at dusk. Your past lanterns stay in the sky as small lights. After 30 days a lantern drifts back so you can reflect on it.

The whole thing is a static site: soft pixel art drawn in code, light and sound generated at runtime, installable to the iPhone home screen, and it works offline. Nothing you write ever leaves your device.

The full build spec is in [SPEC.md](SPEC.md); the working rules for Claude Code are in [CLAUDE.md](CLAUDE.md), the milestone plans in `PLAN-M*.md`, and what could come next in [ROADMAP.md](ROADMAP.md).

## Privacy

- Wishes are stored only on the device, in IndexedDB (via `idb-keyval`). Let-go lanterns are never stored at all.
- The site makes no network requests besides its own static files. There is no server, no analytics, no accounts.
- "Save a backup" writes a `.lantern.json` file through the browser's share sheet or a download; "Restore from backup" reads one back. That file is the only way a sky moves between devices, or between Safari and the home-screen app (which has its own storage on iOS).

## Run, test, build

```bash
npm install
npm run dev              # local dev server at http://localhost:5173/lantern-night/
npm run dev -- --host    # same, reachable from an iPhone on the same Wi-Fi
npm test                 # Vitest unit tests
npm run e2e              # Playwright (WebKit + Chromium, phone + desktop); screenshots land in e2e/output/
npm run build            # production build to dist/ (type-checks first)
npm run preview          # serve dist/ at http://localhost:4173/lantern-night/
```

Playwright browsers are installed once with `npx playwright install webkit chromium`.

## Stack

Vite + TypeScript (strict), PixiJS v8 for WebGL, plain HTML/CSS for the UI, `vite-plugin-pwa` for offline support, `idb-keyval` for storage, Vitest and Playwright for tests. No UI framework, no image assets, no audio files.

```
src/engine   render pipeline, layout, pixel buffers, wind field, adaptive quality
src/scene    sky, hills, lake, moon, lanterns, sky lights, fireflies, shooting star, sprites
src/ritual   state machine, session wiring, copy deck, hold gesture, moon phase
src/store    IndexedDB store, backup format
src/audio    Web Audio soundscape and cues
src/share    the 1080×1920 share image
src/ui       DOM screens and overlays
tests/unit   Vitest
e2e          Playwright specs and helpers
scripts      make-icons.mjs (home-screen icons drawn in code)
```

### How it renders

1. The pixel world is drawn into a low-resolution render texture (320 art px tall in portrait) and upscaled with nearest-neighbour, so one art pixel is a uniform block of screen pixels.
2. A light layer at full resolution is added on top: lantern halos, bloom, reflection streaks, the moon's halo, fireflies, the shooting star.
3. The DOM UI sits over both.

The lake is a flipped, squashed copy of the sky layer with per-row sway snapped to the pixel grid.

### Adaptive quality

If the mean frame time stays above 20 ms for 2 s the scene steps down a level: first fewer particles (sky-light halos, firefly halos and mist go), then no bloom (lantern core and streak, moon halo and window glows go). It never steps back up within a session. `?debug` shows the current level next to the frame rate. `node scripts/measure-quality.mjs` (with `npm run preview` on port 4174) opens a headed Chromium at the phone viewport and prints frame and CPU times for each pinned level.

### Session light arc

Over the first three minutes the horizon eases from apricot to plum: the three warm sky bands give up their height in turn and the night band grows. The share image is composed at the same point of the arc.

### Scenes

Settings has a Scene row. **Sky lanterns** is the ritual as specified: the lantern rises from the shore and settles in the sky. **Water lanterns** plays in the same world with a floating paper lantern that drifts out across the lake and settles as a light on the water. A stored lantern keeps one normalised point; each scene interprets it through its own field (the sky band, or the far half of the lake), so the same sky shows in either scene and backups are unchanged. Changing the scene swaps the world live and carries every light over. `src/scene/field.ts` holds the fields, `src/scene/host.ts` the swap.

### Real-night events

Computed locally from the date, nothing fetched. On the nights of the annual meteor showers (Quadrantids, Lyrids, Eta Aquariids, Perseids, Orionids, Leonids, Geminids, Ursids) shooting stars come two to three and a half times as often. On a supermoon night (a full moon within about 0.1 of an anomalistic month of perigee) the moon is drawn as a 36 px disc instead of 32, on the same pixel grid. `src/ritual/nightEvents.ts`.

## Test hooks (query parameters)

All of these are for tests and screenshots; none change what a visitor sees by default.

| Parameter | Effect |
|---|---|
| `?date=YYYY-MM-DD` | fixed clock (moon phase, returns, file names) |
| `?phase=0..7` | force a moon frame |
| `?seed=N` | scene seed |
| `?lanterns=N` | N lit lanterns already rising (up to 12) |
| `?sky=N` | N past lanterns in the sky (up to 1,000) |
| `?motion=gentle\|full` | override the motion setting |
| `?star=now` | a shooting star right away |
| `?install=ios\|prompt` | force an install-hint path |
| `?quality=1\|2\|3` | pin the quality level (the governor is off) |
| `?evening=0..1` | pin the session light arc |
| `?scene=sky\|water` | pin the scene at boot (the Scene setting still swaps it) |
| `?supermoon` | draw the larger moon regardless of the date |
| `?debug` | fps, frame and CPU times, quality level overlay |

`window.__lantern` exposes the same things to Playwright (stats, pixel sampling of the art-px world, the hold and ritual state, the store, the share image and more; see `src/debug.ts`).

## Deploy

Every push to `main` builds the site and publishes `dist/` to GitHub Pages through `.github/workflows/deploy.yml`. The repository's Pages source must be set to "GitHub Actions". The site is served under `/lantern-night/`; that base lives in one place, `BASE` in `src/config.ts`, and becomes `/` if a custom domain is added later.

## Manual iPhone checklist

From SPEC.md section 11, run on a real phone after each milestone:

- Hold-to-light feels right.
- Swipe doesn't scroll the page.
- Shooting stars are easy to notice and to tap with a thumb.
- The moon phase is readable at arm's length, including new moon.
- Sound starts after the first tap.
- Add to Home Screen works and launches full screen.
- After installing, lanterns are still there when reopened from the home screen.
- Save a backup opens the share sheet; restoring that file brings the sky back.
- Works in airplane mode.
- Text stays readable at the largest size.
- The share sheet appears.
