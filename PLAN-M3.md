# M3 plan — The ritual

Scope from SPEC.md section 10: state machine, full copy deck, both modes, moon banners, storage, Your sky view, returns, shooting stars, settings, save and restore backup. Budget about €15. Builds on the M2/M2b scene without changing the pixel rules.

## Accept when

End-to-end tests (Playwright, WebKit + Chromium) cover:
1. the wish flow end to end, with the lantern stored;
2. the let-go flow, asserting that nothing was written to IndexedDB;
3. the return flow with a mocked clock (`?date=`);
4. a shooting-star tap at the edge of its 64 px hit area;
5. the moon label with a mocked date;
plus settings, clear my sky, a backup round trip and the wrong-file error (section 11).

## Out of scope (deliberately)

- Sound (M4): the settings toggle is stored, the always-visible mute lands with the audio.
- Install hints, `navigator.storage.persist()`, offline (M4).
- Session light arc, haze merging, seated figure (P1 / M5).

## Decisions

**Timing after release (review note after M2b).** The *Light another* / *Goodnight* buttons fade in when the released lantern has passed the middle of the sky band (or shrunk to its dot stage), the same rule that brings the next lantern in M2. That is about 16–21 s rather than the "~6 s" in section 3. Section 3's number is easy to restore: one constant.

**States.** `src/ritual/machine.ts` is a small typed state machine: `loading → arrive → (return) → intention → light → release → watch → (intention | goodnight) → arrive`. Overlays (Your sky, Settings, the corner menu, the moon label, the shooting-star line) are independent of the state and never change it. `src/ritual/session.ts` wires machine, store, scene and DOM screens, so `main.ts` only boots.

**Clock.** Everything that needs "now" (created/return dates, due returns, moon banner and label, first-session shooting star) reads `opts.now()` so `?date=YYYY-MM-DD` mocks the whole session.

**Storage.** `src/store/kv.ts` wraps `idb-keyval` (own store `lantern-night` / `kv`) behind a tiny async key-value interface with an in-memory fallback when IndexedDB is missing or throws; `available` drives the "can't be saved" message. `src/store/store.ts` keeps `lanterns` and `settings` in memory and writes through. `Lantern` and `Settings` are the section 6 types verbatim.

**Let go is never stored.** A let-go lantern rises and settles in the sky for this session only (the sky light is added on hand-off, not persisted). Its text lives only in the DOM field and is cleared when the lantern is folded.

**Returns.** Due when `now ≥ returnAt` and `status === 'rising'`; one per session, oldest `returnAt` first, shown right after *Begin*. The card shows the date, the wish text, the question and the three options; the reply replaces the question, and *Continue* goes on to intention. "Still growing" pushes `returnAt` 30 days out; the sky light for a came-true lantern grows to 5×5 and brightens, a let-go one dims to ember.

**Intention screen.** Mode toggle (two ghost buttons, `aria-pressed`), heading, one textarea with `maxlength="120"` and a counter, helper line, chips as buttons that put their text into the field (replacing an empty field or another chip's text, else appended). *Fold my lantern* is enabled once there is a non-space character. Default mode from the moon: full → let go, else wish.

**Light → release → watch.** The written text appears as a small caption on the lantern from the light state on; on release it follows the rising lantern, glows briefly and fades out over 3 s. The existing `LightUi` grows the watch buttons and the goodnight line. *Goodnight* dims the scene (a DOM veil, 2 s), shows the closing line and returns to *arrive* on the next tap.

**Your sky.** A DOM overlay: heading in Pixelify Sans, count line, and one 44×44 button positioned over every stored light (real DOM elements, so they are focusable). Tapping one shows the date and the wish text. Session-only lights (let go) are not listed; there is nothing to show for them.

**Settings.** Sound (switch, stored), Gentle motion (switch; on = `gentle`, off = `full`; untouched = `system`), Text size (three buttons, sets `--text-scale`), Save a backup (Web Share with a file where `canShare` allows, else a download), Restore from backup (file input; validates `app === 'lantern-night'`, `version === 1`, an array of lanterns; merges by id, existing wins; nothing is ever deleted), Clear my sky (confirm dialog with the section 4 copy).

**Shooting stars.** `src/scene/shootingStar.ts` lives in the light layer: a 0.3 s twinkle at the spawn point, then a 9 screen px head with a glow and an 80 px tapered trail, crossing 40 % of the width in 1.4 s easing out, fading over 0.6 s. Spawns during arrive/watch at random 45–120 s intervals (first-ever session: within the first 60 s), only in the upper clear sky, never within the moon's halo, the bottom third or the active lantern's column. The hit area is a 64 px DOM button that follows the head and stays for 0.6 s after the fade. A tap shows a sparkle and "Quick, a wish, just for you." then "Held close."; nothing is stored. The one-time hint after the first star passes untapped is stored in settings as `starHintShown`. Reduced motion: 2× slower. `?star=now` spawns one immediately for tests; the sound hook is a no-op until M4.

**Moon.** A 44×44 DOM button over the moon toggles a label with the phase name and the next event line from `nextMoonEvent(date)` ("Full moon in 3 days.", "New moon tomorrow.", "Full moon tonight.").

**Typography and surfaces.** Styles move from `index.html` to `src/styles.css`. Screens use the section 7 panel (night at 72 %, apricot border at 20 %, 12 px radius), primary/ghost buttons, Nunito for longer text, Patrick Hand for the prompts and small buttons (M2b decision), Pixelify Sans for the title and "Your sky". Everything scales with `--text-scale`.

**Test hooks.** `window.__lantern` gains `state()`, `store` (all lanterns, settings, `seed(lanterns)` for the return test), `star()` (head position in CSS px, or null) and `?star=now`.

## Files

```
package.json                      + idb-keyval (section 8)
src/styles.css                    all overlay styles (moved from index.html) + screens
src/config.ts                     + RETURN_DAYS, STAR_* timings, WATCH_BUTTONS rule
src/ritual/copy.ts                full section 4 deck, verbatim; helpers for mode/phase selection
src/ritual/machine.ts             state machine with allowed transitions
src/ritual/moonPhase.ts           + nextMoonEvent
src/ritual/session.ts             orchestrator: machine ↔ store ↔ scene ↔ ui
src/store/types.ts                Lantern, Settings, defaults
src/store/kv.ts                   idb-keyval wrapper with memory fallback
src/store/store.ts                lanterns + settings, returns, clear
src/store/backup.ts               serialize, validate, merge
src/scene/shootingStar.ts         light-layer star + spawn scheduler
src/ui/dom.ts                     tiny element helpers
src/ui/arrive.ts                  title, line, moon banner, Begin
src/ui/returnCard.ts              return card
src/ui/intention.ts               mode toggle, field, chips, fold
src/ui/lightUi.ts                 + wish caption, watch buttons, goodnight
src/ui/skyView.ts                 Your sky overlay
src/ui/settings.ts                settings sheet
src/ui/menu.ts                    corner menu
src/ui/moonLabel.ts               moon button + label
src/ui/starUi.ts                  hit button, sparkle, copy lines
src/ui/toast.ts                   system messages
src/debug.ts, src/main.ts         hooks, boot
tests/unit/{copy,machine,store,backup,returns,moonEvent}.test.ts
e2e/ritual.spec.ts                wish, let go, return, goodnight
e2e/skyAndSettings.spec.ts        Your sky, settings, clear, backup round trip, wrong file
e2e/starAndMoon.spec.ts           shooting-star edge tap, moon label
```

## Steps

1. Copy deck, types, config. Unit tests for copy selection and the 120 limit.
2. Storage: kv with fallback, store, backup. Unit tests with a fake kv and a throwing kv.
3. State machine + session orchestrator; move styles to `src/styles.css`; arrive → intention → light → watch → goodnight with the existing LightUi. Check: wish flow e2e in both browsers.
4. Let-go mode and the IndexedDB assertion.
5. Returns with the mocked clock; sky light status updates.
6. Your sky, corner menu, settings, backup save/restore, clear. E2E for each.
7. Shooting stars and the moon label. E2E for the edge tap and the label.
8. Screenshots of every screen at both viewports (full and squint), review against section 7, bundle size, then commit "M3: the ritual". Record results below.

## Result (2026-09-17)

- Unit: 57 Vitest tests pass (store, backup, returns, copy selection, 120-character limit, state machine, next moon event). End-to-end: 102 Playwright tests pass across chromium/webkit × phone/desktop, including the five acceptance flows (wish, let go with the IndexedDB assertion, return with `?date=`, shooting-star edge tap, moon label) plus Your sky, settings, clear, backup round trip and the wrong-file error. Screenshots and squint copies in `e2e/output/`.
- Bundle: main JS 98.6 KB gzipped (+0.1 KB over M2b; idb-keyval is tiny), CSS 3.2 KB.
- Found by the tests and fixed: a screen that is fading out kept `pointer-events: auto` for 600 ms and swallowed the first hold in WebKit; WebKit rounds a percentage `calc()` root font size to 20.799999px (now a px base); the moon exclusion for shooting stars was so wide on a phone that no path fit; headless WebKit advertises `navigator.share` with no sheet to show (stubbed in the backup test only).
- Deviations and proposals for review:
  - Watch buttons come in when the lantern passes the middle of the sky band (about 16–21 s) rather than "~6 s" (section 3), per the M2b review note. `WATCH_BUTTONS_SKY_FRACTION` in `src/config.ts`.
  - "{n} lanterns lit" is used verbatim, so one lantern reads "1 lanterns lit". Proposal: "1 lantern lit" for n = 1.
  - Chips drop their trailing "…" when tapped so the sentence continues ("I am becoming " + typing).
  - The written text sits to the right of the lantern while the prompt caption sits to the left; on release it glows and fades over 3 s.
  - After Goodnight the scene dims and a tap anywhere returns to Arrive (the spec ends the session without saying what a further tap does).
- Open for the iPhone check: the intention sheet with the keyboard open, the home-indicator gap under the small pills, and whether the return card should also pulse the returning light in the sky (not done).
