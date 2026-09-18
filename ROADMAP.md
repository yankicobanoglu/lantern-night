# Lantern Night — roadmap

Where the project could go after v1. Each item is a proposal with a rough size (S: an evening, M: a milestone, L: several) and a note on why it matters. Order inside each section is a suggested priority. Sections 1–3 were reviewed item by item in `PLAN-M6.md` (Part 1); the verdicts there say which items to do as written, which to reshape, and which to skip. Items marked **built** are done.

The rules that stay: all art in code, nothing leaves the device, no accounts, no ads, the copy deck governs wording, and the performance budgets in SPEC.md section 8 hold.

## 1. Architecture

**1.1 Split the session (M).** `src/ritual/session.ts` wires everything: state machine, overlays, share, install, stars, the light arc. Split it into small controllers with one job each (RitualFlow, Overlays, Sharing, Hints), each taking the same `SessionDeps`, with the session left as the composer. Why: every review fix lands in the same 600-line file; smaller units are easier to test without a browser.

**1.2 One identity for a light (S).** A light is a stored `Lantern`, a scene `SkyLight`, a rising scene `Lantern` and now a `SkyEntry` for Your sky, each with its own id rules. Define one `Light` type with an optional persisted record and derive the others from it. Why: the "0 lanterns lit" class of bug came from these four views disagreeing.

**1.3 Scene subsystems behind one interface (S).** `Scene` hand-wires sky lights, fireflies, cozy details, moon, lanterns and the star, each with slightly different `update`, `slowTick`, `resize`, `setMotion`, `setQuality`, `destroy` methods. A `SceneSystem` interface and a list would make adding a subsystem (or a whole new scene, section 5.1) a registration instead of six edits.

**1.4 Settings as an observable (S).** `applySettings()` pushes every setting to every consumer. A tiny observable store (`settings.on('sound', fn)`) lets the mute button, the sheet, the audio engine and the scene subscribe to what they need. Why: fewer "keep X in step with Y" bugs.

**1.5 Audio graph as data (M).** The ambient bed and cues are built imperatively. A declarative patch (nodes, connections, envelopes) with a scheduler that looks ahead by a few seconds would replace the `setTimeout` chains, which drift when Safari throttles a background tab, and would make the soundscape tweakable without reading Web Audio code. A per-layer mixer (wind, water, cues) falls out of it.

**1.6 Versioned storage (S).** Add `schemaVersion` to the stored settings and the backup file, with a migration step on load. Why: any change to `Lantern` or `Settings` today silently drops or misreads old data; the backup format is the only way a sky moves between devices, so it must stay readable for years.

**1.7 Copy deck as data (S).** Move `COPY` to a JSON file with the same shape, keep the typed accessor. Prerequisite for localisation (5.4) and lets copy be reviewed without touching code.

**1.8 Visual regression in CI (M).** The e2e suite saves screenshots for a human to look at. Add Playwright `toHaveScreenshot` baselines for the composition, the moon phases, the quality levels and the arc stages, with masks over the animated parts and a per-project threshold. Why: the pixel rules (palette exact, dithering, no mixed pixel sizes) are checkable by machine.

**1.9 Performance in CI, honestly (S).** GitHub runners have no GPU, so the fps budget cannot be asserted there. Keep the CPU-time assertion in CI, keep `scripts/measure-quality.mjs` as the local GPU check, and record the iPhone numbers in the plan after each milestone. Do not pretend headless numbers are device numbers.

**1.10 Branch previews (S).** Pages deploys only `main`. A workflow that builds every pull request and uploads `dist/` as an artifact (or deploys to a `preview/<branch>` path) lets a change be tried on the phone before it goes live.

## 2. Optimisations

Measured on an M4 Mac every level holds 60 fps, so these are for the phone, in the order they are likely to matter there.

**2.1 One draw for the lake (M).** The reflection is 64 one-row sprites repositioned every frame. A small displacement shader on one sprite (row offset from a sine, snapped to the art grid, darkened) does the same in one draw call and frees the CPU loop.

**2.2 Cheaper light layer (M).** Fireflies, window glows, the boat lamp and the lantern halo/core are individual additive sprites with large textures at device resolution. Put the small glows in one `ParticleContainer` (as the sky halos already are) and bake the lantern's halo and core into one two-stop texture. Add a quality step between 2 and 1 that renders the light layer at half resolution and upscales it, which halves the fill cost without removing anything visible.

**2.3 Bundle (S).** Pixi is imported whole. Import only the systems in use (no text, no graphics, no filters), lazy-load the share composer (it needs fonts and a 1080×1920 render texture only when asked) and the audio engine (only after the first tap). Target: main chunk under 80 KB gzipped, first render under 2 s on 4G as section 8 asks.

**2.4 Idle throttling (S).** When nothing has happened for a minute in arrive or goodnight, drop the ticker to 30 fps; return to 60 on the next input. Saves battery on a phone left on the nightstand, which is the use this is for.

**2.5 Texture lifetime (S).** Glow textures are cached by size and colour and never freed; the share composer builds a whole second scene per render. Free the share scene's textures immediately (mostly done) and cap the glow cache. Keep the memory budget (200 MB) measured on the phone with Safari's Web Inspector.

**2.6 Startup order (S).** Preload the two font files, register the service worker after first render rather than before, and draw the sky from the static buffer before the store has loaded so the first frame does not wait on IndexedDB.

## 3. Product polish

**3.1 The seated figure (P1 from the spec, M).** A small gender-neutral figure on the dock, seen from behind, holding the lantern before release. It gives the ritual a body and a scale.

**3.2 Haze beyond 1,000 lights (P1, S).** The oldest lights merge into a faint band instead of being dropped.

**3.3 Landscape composition (S).** iPad and desktop currently "work"; the dock should stay the centre and the sides should earn their width (a second cottage, a far shore).

**3.4 Haptics (S).** A short vibration when the lantern lights and when it releases, where the platform allows it (Android; iOS Safari has none, so nothing is lost there).

**3.5 A real device lab note (S).** Keep a short list of the phones the app has been checked on, with the quality level the governor settled at and the frame time from `?debug`.

## 4. New features

**4.1 Extra scenes (L; section 14). Partly built (M6):** the seam (a scene kind, a field for where lights settle, a scene host that swaps the world live), the Scene setting, and the first extra scene, water lanterns on the lake. Remaining: a dandelion in a field and a wishing well, each a new world for the same ritual (M each). See PLAN-M6 for why the seam is session↔scene rather than 1.3's scene↔subsystem.

**4.2 Localisation (M).** The copy deck as data (1.7) plus a language setting; Turkish first, given the audience. Dates and the moon label already use the browser locale.

**4.3 Your sky by month (M).** Browse past lanterns by month, with the count per month and a way to reread them; export the wishes as a text file from Settings for people who journal elsewhere.

**4.4 A year of lanterns (M).** A second share image once a year: the whole sky with the count and the first date, in the same style as the nightly image.

**4.5 Return reminders without a server (S).** No push (it needs a server), but an "Add to calendar" for the return date, and the home-screen badge where the Badging API exists.

**4.6 Real-night events (S). Built (M6):** the eight annual showers raise the shooting-star rate on their nights; a supermoon is drawn as a 36 px disc. All computed locally from the date. Open: a line of copy for shower and supermoon nights (proposed in PLAN-M6).

**4.7 Shortcuts and links (S).** `?mode=let-go` and `?mode=wish` open straight into the intention screen so iOS Shortcuts and home-screen bookmarks can start a specific ritual.

**4.8 Encrypted backup to a file the user owns (M).** The backup stays a file, but an optional passphrase encrypts it (WebCrypto, on device) so it can sit in iCloud Drive or be sent to oneself without the wishes being readable. Still no server, still no account.

**4.9 Night Train tie-in (L; section 14).** Lanterns drifting past the train window in the other project, read from the same backup format.

**4.10 A custom domain (S; section 14).** `base: '/'`, the manifest and the workflow follow from the single config value.

## Not planned

Accounts, a shared sky, notifications through a server, analytics, monetisation, and any network call at runtime. These stay out because the privacy promise is the product.
