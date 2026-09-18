# Lantern Night — build spec (v1)

> Light a lantern. Let it rise.

## 1. What it is

A calm, 2–3 minute evening ritual in the browser. You write a wish (or something you want to let go of), light a paper lantern, and release it over a quiet lake at dusk. Your past lanterns stay in the sky as small lights. After 30 days a lantern drifts back so you can reflect on it.

**Goals**
- Feels warm, soothing and uplifting from the first second.
- Polished enough to share: soft pixel art, gentle light, calm sound.
- Installable to the iPhone/iPad home screen, works offline.
- Private by design: nothing ever leaves the device.

**Non-goals for v1**
- No accounts, no server, no shared sky, no notifications.
- Website only: no native app, no App Store build.
- No other ritual scenes (water lanterns, dandelions, wishing well).
- No credits/"inspired by" page, no monetisation, no ads.
- No AI or network calls at runtime. The finished site is fully static.

## 2. Audience and voice

**Audience:** people who enjoy intention-setting and manifestation rituals, skewing women 18–35, mostly on phones, mostly in the evening.

**Voice:** comforting, warm, positive, upward.
- Short sentences, second person, present tense.
- Upward and light imagery: rise, glow, carry, gentle, welcome, tonight.
- Never promise outcomes ("this will come true"). Frame it as intention and reflection.
- Never guilt. No streaks, no "you missed a day", no failure states.
- At most one exclamation mark per screen. No emoji in UI copy.

## 3. Session flow

States run as a simple state machine: `arrive → (return) → intention → light → release → watch → goodnight`. The **Your sky** view and **Settings** are reachable from a small corner menu at any time.

1. **Arrive.** The scene fades in at blue hour. A moon-phase banner appears on new/full moons (section 5). Button: *Begin*.
2. **Return (only if one is due).** At most one per session, oldest first (section 6).
3. **Intention.** Mode toggle *Make a wish* / *Let something go*. Text field (max 120 characters) and prompt chips.
4. **Light.** Press and hold for 4 s while a breath guide expands. The flame grows and the lantern fills. Tap alternative available (accessibility, reduced motion).
5. **Release.** Swipe up (or tap *Let it rise*). The lantern lifts, the written text glows and fades as it rises.
6. **Watch.** The lantern drifts on the wind, shrinks with height and settles into the sky as a small light. After ~6 s the buttons *Light another* and *Goodnight* fade in.
7. **Goodnight.** Short closing line, scene dims gently. Session ends.

**Shooting star event:** during arrive/watch, a shooting star crosses the sky at a random interval of 45–120 s. On a first-ever session, one appears within the first 60 s so people discover it. Tapping it shows a small sparkle and a line of copy. No input, nothing stored. Look and timing are in section 7 under "Legibility".

**Moon tap:** tapping the moon shows a small label with tonight's phase and the next new or full moon (copy in section 4).

**Session light arc (P1):** over ~3 minutes the horizon eases from apricot to plum, so the evening deepens while you're there.

## 4. Copy deck

Use these strings exactly unless a better line is clearly warmer and shorter.

**Arrive**
- First visit: "Welcome. The evening is quiet tonight."
- Returning: "Welcome back. Your lanterns are still glowing."
- Button: "Begin"

**Moon banners**
- New moon: "A new moon tonight. A lovely time to set an intention."
- Full moon: "A full moon tonight. A gentle time to let something go."

**Intention — wish**
- Heading: "What would you like to grow toward?"
- Placeholder: "I am welcoming…"
- Helper: "Write it as if it's already on its way."
- Chips: "I am becoming…", "This season, I welcome…", "I'm ready for…", "I'd love to feel…", "I trust that…", "My next brave step is…", "More of this, please:", "Something I'm growing toward…"

**Intention — let go**
- Heading: "What would you like to set down tonight?"
- Placeholder: "I'm ready to release…"
- Helper: "This stays between you and the night. It won't be saved."
- Chips: "I'm ready to release…", "I no longer need to carry…", "I forgive myself for…", "I'm letting go of the worry that…"

**Shared**
- Mode toggle: "Make a wish" / "Let something go"
- Button: "Fold my lantern"

**Light**
- Idle: "Hold to light your lantern"
- Holding: "Breathe in…"
- Lit: "Beautiful. Now breathe out, and let it rise."
- Hint: "Swipe up to release"
- Tap alternative button: "Light it"

**Release and watch**
- Wish: "There it goes." then "Your light is on its way."
- Let go: "There it goes." then "Lighter already."
- Watch: "Stay as long as you like."
- Buttons: "Let it rise", "Light another", "Goodnight"

**Goodnight**
- After a wish: "Sleep well. Your lanterns will keep glowing."
- After letting go: "Rest easy. You've made some room tonight."

**Return**
- Heading: "A lantern from {date} has drifted back to visit."
- Question: "How is this one?"
- Options and replies:
  - "It came true" → "How wonderful. It'll shine a little brighter now."
  - "It's still growing" → "Good things take their time. Back to the sky it goes."
  - "I've let it go" → "That's okay. It'll float on, lighter."

**Shooting star**
- On tap: "Quick, a wish, just for you." then "Held close."
- One-time hint after the first star passes untapped: "Tap a shooting star to make a quick wish."

**Moon label (on tap)**
- Phase names: "New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"
- Second line: "Full moon in {n} days." or "New moon in {n} days." (whichever comes first; "tomorrow" when n = 1, "Tonight" on the day itself)

**Your sky**
- Heading: "Your sky"
- Count: "{n} lanterns lit"
- Empty: "Your sky is waiting for its first light."
- Tapping a light shows the date and the wish text.

**Settings**
- "Sound", "Gentle motion", "Text size", "Save a backup", "Restore from backup", "Clear my sky"
- Backup helper: "Your sky lives on this device. Save a backup now and then to keep it safe."
- After saving: "Backup saved."
- After restoring: "Your sky is back." (with count: "{n} lanterns restored")
- Wrong file: "That file isn't a Lantern Night backup. Choose a file that ends in .lantern.json."
- Confirm clear: "This removes every lantern from this device. It can't be undone." Buttons: "Keep them" / "Clear my sky"

**Share**
- Button: "Share my sky"
- Toggle: "Include my wish" (default off)

**System messages**
- Storage unavailable: "Your lanterns can't be saved in this browser mode. They'll still rise tonight."
- Install hint (iOS/iPadOS Safari, not installed; shown on the first visit right after the first lantern has risen, then once more on the third visit if still not installed): "Keep Lantern Night on your home screen so your sky stays safe: tap Share, then Add to Home Screen."
- Install hint for other browsers that support installing: "Install Lantern Night so your sky stays safe." Button: "Install"

## 5. Moon phases

- Mean-phase model: reference new moon 2000-01-06 18:14 UTC, synodic month 29.530588853 days. `age = ((now − ref) / P) mod 1`.
- New moon when `age < 0.05` or `age > 0.95` (about ±1.5 days): default mode **wish**, show new-moon banner.
- Full moon when `|age − 0.5| < 0.05`: default mode **let go**, show full-moon banner.
- Otherwise default mode **wish**, no banner.
- Moon sprite is 32×32 art px with 8 hand-checked phase frames chosen from `age`; waxing lit on the right (northern-hemisphere convention).
- The unlit part is always drawn in earthshine `#474776`, so the full disc is visible in every phase, including new moon.
- The thinnest crescent frame is at least 4 art px wide at its widest point.
- A soft halo (light layer) scales with the lit fraction: faint at new moon, strongest at full.
- Unit test fixtures (tolerance ±1 day): new moons 2024-04-08 and 2025-03-29; full moons 2024-09-18 and 2025-03-14.

## 6. Data and privacy

- Storage: IndexedDB via `idb-keyval`, with an in-memory fallback.
- **Keeping the sky safe.** Safari can delete a website's stored data after 7 days of Safari use without a visit to that site. Home-screen web apps aren't affected. The 30-day return depends on data surviving, so:
  - Call `navigator.storage.persist()` after the first lantern is saved (where supported), and record the result.
  - Show the install hint as described in section 4.
  - Offer **Save a backup** / **Restore from backup** in Settings.
- **Backup file:** `lantern-night-YYYY-MM-DD.lantern.json`, containing `{ app: 'lantern-night', version: 1, exportedAt, lanterns, settings }`. Saving uses the Web Share API with a file where supported, otherwise a download. Restoring validates the file, then merges by `id` (the existing entry wins on conflict) and never deletes anything.
- **Let-go text is never stored**, not even as a count.
- No analytics in v1. Fonts and all assets are self-hosted: zero third-party requests.

```ts
type Lantern = {
  id: string;            // crypto.randomUUID()
  text: string;          // ≤ 120 chars
  createdAt: string;     // ISO
  returnAt: string;      // createdAt + 30 days
  status: 'rising' | 'came-true' | 'still-growing' | 'let-go';
  sky: { x: number; y: number }; // normalised 0–1 position in the sky layer
  seed: number;          // small visual variation (hue, twinkle)
};

type Settings = {
  sound: boolean;                       // default true, audio starts after first tap
  motion: 'system' | 'gentle' | 'full'; // 'system' follows prefers-reduced-motion
  textScale: 1 | 1.15 | 1.3;
  sessions: number;
  installHintCount: number;             // how many times the install hint has been shown
  persistGranted: boolean | null;       // result of navigator.storage.persist()
  lastBackupAt: string | null;
};
```

**Return rules:** due when `now ≥ returnAt` and `status === 'rising'`. Show at most one per session, oldest first. "Came true" lanterns render slightly brighter and larger. "Still growing" sets `returnAt` another 30 days out. "Let go" keeps the light but dims it.

## 7. Art direction

**Style: soft pixel.** The world is pixel art rendered at a low internal resolution and upscaled with nearest-neighbour, so one art pixel is about 3 CSS px on phones and 4 on large screens. It should read as pixel art, gentler and less chunky than Stardew Valley. **Light is the exception:** lantern halos, bloom and reflections render at full resolution on top, soft and warm. UI text is crisp, never pixelated.

All art is drawn in code (hand-authored pixel maps and procedural shapes). No external asset packs, no generated images.

**Palette**

| Token | Hex | Use |
|---|---|---|
| night | `#1B1B3A` | top of sky, UI panel base |
| dusk | `#232250` | sky band |
| twilight | `#2E2A5C` | sky band |
| violet | `#4A3B72` | sky band |
| plum | `#6B4E8C` | sky band near horizon |
| rose | `#A86A8C` | horizon band |
| blush | `#D98A84` | horizon band |
| apricot | `#E8A07A` | horizon glow |
| far-hills | `#3A3F6E` | distant hills |
| near-hills | `#262A4F` | near hills |
| shore | `#171A33` | foreground, tree silhouettes |
| lake | `#1F2E4F` | water |
| ripple | `#2B3D63` | water highlights |
| moon | `#F3EBD3` | moon, moon reflection |
| star | `#FFF4D6` | stars |
| lantern | `#FFC56B` | lantern paper, lit windows, sky lights |
| lantern-core | `#FFE7B3` | bright centre |
| ember | `#E08A3C` | lantern rim |
| flame | `#FF6A2B` | flame |
| glow | `#FFB547` | halos, reflections (with alpha) |
| firefly | `#D8F28A` | fireflies |
| wood | `#6B5238` / `#4A3A2A` | dock planks / posts |

**Sky:** flat colour bands with 2-pixel checker dithering at band edges. No smooth gradients in the pixel layer.

**Scene composition (portrait first)**

```
┌──────────────────────────┐
│  ·   *      ·     ◐      │  stars, sky lights, moon (upper right)
│      ▫        ▫          │  past lanterns as small lights
│  ▫        ▣         ▫    │  rising lanterns (active one centred)
│▁▂▃▂▁ ⌂ ▁▂▃▄▃▂ ⌂ ▂▁▂▃▂▁▂│  far hills with two lit cottage windows
│▃▄▃▃▂▂▂▂▂▂▂▂▂▂▂▂▃▃▄▃▄▄│  near hills, pine silhouettes
│ ~   ~~   ▪   ~~   ▪  ~  │  lake: ripples, moon + lantern reflections
│ ||  ·   ═══════   ·  || │  shore, reeds, fireflies, wooden dock
└──────────────────────────┘
      [ UI panel area ]        bottom third, over the shore/lake
```

- About 55% sky, 15% hills, 20% lake, 10% shore.
- Landscape (iPad/desktop) extends the scene sideways; the composition centre stays the dock.
- P1: a small seated figure on the dock, seen from behind, gender-neutral, holding the lantern before release.

**Sprites to author:** lantern (12×16 art px) with 4-frame paper flicker and flame flicker; small sky lantern (6×8); moon 32×32 with 8 phases and earthshine; cottage with lit window (2 variants); pine trees (3 variants); reeds; dock; fireflies (1–2 px).

**Legibility**

Keep one pixel grid everywhere; never mix pixel sizes. Make meaningful things readable through size, contrast and the smooth light layer instead.

- **Minimum sizes on a phone (390 px wide):** anything meaningful is at least 24 screen px; anything tappable has a hit area of at least 44×44 screen px.
- **Stars vs past lanterns:** stars are cool white, 1 art px (a few brighter ones 2×2). Past lanterns are warm `#FFC56B`, at least 2×2 art px, with a tiny halo and a slow bob, so they never look like stars.
- **Shooting stars live in the light layer, not the pixel layer:**
  - A 0.3 s twinkle at the spawn point first, to draw the eye.
  - Then a bright 9 screen px head with a soft glow and a tapered trail about 80 screen px long.
  - It crosses about 40% of the screen width in 1.4 s, easing out, then fades over 0.6 s.
  - Spawns only in clear upper sky: never behind the moon, the UI panel or the active lantern.
  - The hit area is a 64 screen px circle that follows the head and stays tappable for 0.6 s after it fades.
  - A faint shimmer sound plays on spawn (when sound is on).
  - With reduced motion it moves slower, but still appears.
- **Squint test:** every screenshot review also looks at the scene at 50% size. The moon phase, active lantern, past lanterns and a passing shooting star must all still be identifiable.

**Typography**
- Title and short headings: **Pixelify Sans**, used sparingly (title, "Your sky").
- Everything else: **Nunito** 400/600. Its rounded shapes echo the lantern softness and it stays readable in low light.
- Self-host both (subset to Latin).
- Sentence case everywhere.

**UI surfaces:** translucent night panels (`#1B1B3A` at 72% opacity), 1 px border in apricot at 20% opacity, 12 px radius. Primary button filled `#FFB547` with text `#2A1A0A`. Secondary buttons are ghost style with cream text. Text contrast ≥ 4.5:1.

**Motion:** slow and soft (400–800 ms eases), no bouncy springs. One orchestrated moment per state. With reduced motion: cross-fades only, fewer particles, lanterns rise slower, no screen shake of any kind.

**Sound (all generated with Web Audio, no files)**
- Ambient bed: soft wind (filtered noise), occasional water lapping. (Crickets were tried in M4–M6 and removed after the M6 review.)
- Lighting: a soft whoosh of flame that grows with the hold.
- Release: a single bell-like chime from C major pentatonic (C5, D5, E5, G5, A5), random note.
- Shooting star: a faint shimmer.
- Master level low (about −18 dB), fades in over 2 s. Audio starts only after the first tap (iOS requirement). A mute toggle is always visible.

## 8. Technical architecture

**Stack**
- Vite + TypeScript (strict)
- PixiJS v8 for WebGL rendering
- Plain HTML/CSS overlay for UI (crisp text, accessibility); no UI framework
- `vite-plugin-pwa` for offline support and installability
- `idb-keyval` for storage
- Vitest for unit tests, Playwright (WebKit + Chromium) for end-to-end tests

**Folders:** `src/engine` (render pipeline, wind field, particles, adaptive quality), `src/scene` (sky, hills, lake, moon, sprites), `src/ritual` (state machine, copy deck), `src/store`, `src/audio`, `src/share`, `src/ui`.

**Render pipeline**
1. **Pixel world** → low-res render texture (internal height 320 px in portrait, width from aspect ratio) → nearest-neighbour upscale.
2. **Light layer** at full resolution, additive: lantern halos, bloom from lantern cores, reflection streaks on the lake.
3. **DOM UI** on top.

**Lantern motion**
- Constant buoyancy, drag, gentle sway, plus a slowly changing 2D curl-noise wind field.
- Lanterns shrink with height. When small enough they hand off to the sky layer at their stored `sky` position.
- Up to 12 active lanterns at once.

**Sky of past lanterns:** up to 1,000 twinkling points in a particle container. Beyond 1,000, the oldest merge into a faint haze (P1).

**Lake:** a flipped, vertically squashed copy of the sky and lantern layers. Horizontal sine displacement is snapped to the art-pixel grid and darkened ~40%.

**Performance budgets**
- 60 fps on an iPhone 12-class device.
- Adaptive quality: if frame time > 20 ms for 2 s, reduce particles, then bloom.
- JS ≤ 350 KB gzipped. First render < 2 s on a mid-range phone on 4G. Memory < 200 MB.

**Browser support:** iOS/iPadOS/macOS Safari 16.4+, current Chrome/Edge/Firefox.

**Hosting paths:** the site is served from a sub-path on GitHub Pages (`https://<username>.github.io/lantern-night/`). Set Vite's `base` to `/lantern-night/` and keep every asset URL, the web app manifest (`start_url`, `scope`) and the service worker scope relative to that base. Make the base a single config value so a custom domain later only needs `base: '/'`.

**Accessibility**
- All controls are real DOM elements with labels and a visible focus ring.
- The hold gesture always has a tap alternative.
- `prefers-reduced-motion` is respected, text scaling works.
- The canvas has an `aria-label` describing the scene.

## 9. Share image

- 1080×1920 PNG composed offscreen: the current scene re-rendered at integer upscale, a small "Lantern Night" wordmark at the bottom, and optionally the wish text in a soft panel.
- Share via the Web Share API with files where supported, otherwise download.
- Filename: `lantern-night-YYYY-MM-DD.png`.

## 10. Milestones (one Claude Code session each)

Budget is about €85 of Fable credit. Check spend on the Usage page in Settings after each milestone. If M1 + M2 together exceed €40, drop all P1 items.

**M1 — The world (~€15)**
- Scaffold, render pipeline, sky bands with dithering, hills, cottages, trees, lake, moon phases, portrait and landscape layouts, palette exact.
- Accept when: Playwright screenshots at 390×844 and 1280×800 match the composition, all 8 moon phases are readable at 390×844 (including new moon) and pass the squint test, moon unit tests pass, 60 fps on desktop.

**M2 — Lanterns and light (~€20)**
- Lantern sprite and flicker, hold-to-light with breath guide, swipe release, wind field, rise and hand-off to the sky, halos and bloom, lake reflections, fireflies.
- Accept when: 12 active lanterns hold 60 fps on desktop, past lanterns are clearly distinguishable from stars at 390×844, and it feels right on the iPhone (manual check).

**M3 — The ritual (~€15)**
- State machine, full copy deck, both modes, moon banners, storage, Your sky view, returns, shooting stars, settings, save and restore backup.
- Accept when: end-to-end tests cover the wish flow, the let-go flow (asserting nothing is stored), the return flow with a mocked clock, a shooting-star tap at the edge of its hit area, and the moon label with a mocked date.

**M4 — Sound, sharing, install (~€15)**
- Web Audio soundscape, share image, offline support, install hints, persistent-storage request, accessibility pass.
- Accept when: works offline after first load, the share image renders correctly, and keyboard-only and reduced-motion runs complete.

**M5 — Polish and performance (~€15)**
- iPhone performance pass with adaptive quality, session light arc, timing polish, README, deploy to GitHub Pages (section 12).
- Accept when: the manual iPhone checklist passes and the site is live.

**Buffer:** ~€5.

**P0 (must ship):** everything in M1–M4 except items marked P1.
**P1 (cut first):** seated figure, session light arc, haze merging, landscape polish beyond "works".

## 11. Testing

- **Unit (Vitest):** moon phase, return scheduling, storage fallback, copy selection by mode/phase, 120-character limit.
- **End-to-end (Playwright, WebKit + Chromium):** full wish flow; let-go flow with an IndexedDB assertion that nothing was written; return flow with a mocked date; settings; clear my sky; backup round trip (save, clear, restore, same sky); restoring an invalid file shows the error.
- **Manual iPhone checklist:**
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
- **Test on your iPhone during development:** `npm run dev -- --host`, then open the Mac's local IP address on the iPhone (same Wi-Fi).

## 12. Deploy

- **GitHub Pages**, deployed by a GitHub Actions workflow on every push to `main` (build with Vite, publish `dist/`).
- The repository is **public** (free GitHub Pages requires it). That's fine here: the built site is readable by anyone anyway.
- HTTPS is automatic, which the service worker needs.
- Address: `https://<username>.github.io/lantern-night/`. A custom domain can be added later (then change `base` to `/`).
- Claude never handles GitHub credentials. The user signs in themselves (for example `gh auth login` in Terminal, or the browser prompt).

## 13. Working rules for Claude Code (copy into CLAUDE.md)

- Read SPEC.md before any work. Work on one milestone at a time and stop for review at the end of each.
- Plan first, then build. Keep changes small and commit at the end of each milestone.
- All art is created in code. Never add image assets from outside or generate images.
- Never send wish text anywhere. No network requests besides the site's own static files.
- Ask before adding any dependency not listed in section 8.
- Never handle passwords or tokens. When GitHub sign-in is needed, stop and ask the user to do it.
- Respect the performance budgets. Measure, don't guess.
- Use the copy deck verbatim. Propose wording changes instead of improvising them.
- Verify with screenshots (Playwright) before calling a visual task done.

## 14. Later (not v1)

- Extra scenes (water lanterns, dandelion, wishing well), each as a new setting for the same ritual.
- Tie-in with a future Night Train game: lanterns drifting past the train window.
- A custom domain.
