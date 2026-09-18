# M7 plan — Two kinds of lantern in one night

Asked for, in order: (1) sky and water lanterns must coexist, with the choice made per lantern on the wish screen instead of swapping the world; (2) gentle motion always on, with the option removed; (3) a settled water lantern must not look like a settled sky lantern; (4) the watch buttons rearranged, with sharing moved to a corner button and a small prompt after the first lantern; (5) ideas for cozy living details in the scene, no code; (6) ideas for a friendlier, cozier, more manifestation-minded app, no code.

Items 1–4 are built in this milestone. Items 5 and 6 are proposals at the end of this file and in ROADMAP.md; nothing from them is implemented.

## What is wrong today

M6 made the scene kind a *setting*: `Settings.scene` chose one world, `SceneHost.swap` rebuilt it, and every stored point was reinterpreted through the new scene's field. So a sky lantern lit an hour ago became a water lantern the moment the setting changed, which is the bug reported. The kind belongs to the lantern, not to the night.

## 1. The kind belongs to the lantern

**Stored record.** `Lantern.kind: 'sky' | 'water'`, additive. Records written before this read as `sky`, in the store and in a backup, so the backup version stays 1 and old files keep working. `isLantern` accepts a record without the key and normalises it.

**Two fields, both live.** The scene keeps both fields from M6 (the sky band above the horizon, the far half of the lake) and both sets of lights at once. A light is placed through the field of *its* kind, so a sky lantern stays in the sky and a water lantern stays on the lake, in the same night.

**Two lantern sets, both live.** `Scene` holds a `LanternField` per kind, each with its own sprite set, rest point, drift tuning and wind sampling, exactly as M6 tuned them. At most one lantern waits at a time, whichever kind it is; both kinds can be on their way together, sharing the twelve-lantern budget.

**Layer order, one world.** Back to front: lake, settled water lights, boat, drifting water lanterns, rising sky lanterns near the shore, shore, fireflies; the settled sky lights and the moon stay in the layer above the shoreline, so the lake still reflects them. This is M6's two orders merged, with nothing new in the pixel rules.

**The host goes.** `SceneHost` existed to swap worlds. Nothing swaps now, so the session holds the scene directly and `src/scene/host.ts` is deleted. `?scene=sky|water` becomes the default kind for the next lantern rather than a world pin, and `Settings.scene` is reused as "the kind chosen last", so the choice is remembered between nights.

**The Scene row leaves Settings**, because the choice is now on the wish screen where it belongs.

## 2. Gentle motion, always

`Settings.motion` stops being a user choice: the app runs gentle. The Settings row goes, the stored key stays (old backups keep reading), and `Session.motion()` returns `gentle` unless `?motion=` pins it for a test. Reduced-motion visitors are unaffected by construction, since gentle *is* the reduced treatment: cross-fades, fewer particles, slower rise, no shake (SPEC section 7, Motion).

## 3. A settled water lantern looks like one

Today both kinds hand off to the same 4×4 dot, so a lantern that drifted out to the middle of the lake ends up identical to one that rose into the sky. The water light becomes its own 6×5 shape: a flatter, wider warm body with a one-pixel gap and a short dimmer reflection under it, which reads as a light sitting *on* water. It keeps the status rules (larger and brighter when it came true, dim in ember when let go), the slow rock rather than the sky's bob, and the same halo. The drifting 7×5 sprite hands off to this shape instead of the sky dot.

## 4. The watch screen

- **Light another** becomes a full-size primary button, **Goodnight** stays a small ghost button directly beside it, and the two sit on one row.
- **Share my sky** leaves that row. It becomes a corner button beside the mute toggle, drawn in code like the speaker glyph: a lantern rising out of an open box, which is the share idiom and the app's own image at once. It is visible whenever the ritual is, so the sky can be shared at any point, not only in the watch state.
- **After the first lantern of the first night**, a small line appears under that button pointing at it, in the same quiet voice as the shooting-star hint. It is one line of plain text, no panel, no border, and it fades after a few seconds. Shown once ever, recorded as `Settings.shareHintShown`.

## Copy

New strings are proposals (not in SPEC section 4's deck), marked in `copy.ts` like the earlier ones:
- Wish screen, the kind choice: "Sky lantern" / "Water lantern".
- The share hint after the first lantern: "Tap here to share your sky."
- Removed from use: the Settings rows "Gentle motion" and "Scene" (the strings stay in the deck file, unused, since the deck is SPEC's).

## Files

```
src/store/types.ts              Lantern.kind, Settings.shareHintShown, motion default
src/scene/field.ts              fieldFor per kind stays; LanternKind naming
src/scene/scene.ts              both lantern fields, both light sets, merged layer order
src/scene/skyLights.ts          per-kind sprite and bob
src/scene/sprites/waterLight.ts the settled water light
src/scene/lanternTextures.ts    the water set hands off to the water light
src/scene/host.ts               deleted
src/ui/intention.ts             the kind choice
src/ui/lightUi.ts               watch row, no share button
src/ui/shareButton.ts           the corner share button and its hint
src/ui/settings.ts              motion and scene rows removed
src/ritual/session.ts           per-lantern kind, no swap, share hint
src/ritual/copy.ts              proposals above
src/main.ts, src/debug.ts       no host, kind hooks
src/share/compose.ts            composes both kinds
tests/unit/*, e2e/*             updated and new
```

## Steps

1. Record and scene: `kind` on the lantern, both fields and both lantern sets live, host deleted.
2. The choice on the wish screen, remembered as the default for the next one.
3. The settled water light.
4. Gentle motion always; Settings rows removed.
5. Watch row, corner share button, first-lantern hint.
6. Tests, screenshots at 390×844 and 1280×800, squint check, README and ROADMAP, commit.

## Result (2026-09-18)

- **The kind belongs to the lantern.** `Lantern.kind` is stored, additive, and a record written before this reads as a sky lantern, in the store and in a backup, so the backup stays at version 1. The scene holds both lantern sets and both light sets at once, each with its own field, and a light is placed through the field of its own kind. `SceneHost` is deleted: nothing swaps any more. The twelve-lantern budget counts both kinds together.
- **The choice is on the wish screen**, under the chips, and is remembered in `Settings.scene` as the default for the next lantern. The Scene row left Settings.
- **Gentle motion always.** The Settings row is gone, `Session.motion()` returns gentle, and `?motion=` survives for tests only. The stored key stays for old data.
- **A settled water light** is its own 6×5 shape: a wide warm body, an empty row, then a short ember reflection. The drifting lantern's last stage uses it too, so a water lantern never passes through the sky lantern's 4×4 dot.
- **The watch row** is Light another (full-size primary) beside Goodnight (small ghost). Sharing is a corner button beside the mute toggle, drawn in code as a lantern rising out of an open box, with a one-line hint under it after the first lantern of the first night, no panel, shown once ever.

**Deviations and notes for review.**
- Copy proposals in use, all marked in `copy.ts`: "Sky lantern" / "Water lantern" on the wish screen, and "Tap here to share your sky." The Settings strings for motion and scene stay in the deck file, unused, because the deck is SPEC's.
- The corner button's class is `corner share-sky`, not `share`: `.share` already belongs to the share sheet, and a bare `share` made both match one selector.
- Items 5 and 6 are proposals only. Nothing from them is implemented; they are below and in ROADMAP sections 5 and 6.
- The iPhone check for this milestone is the user's: the water lantern's settled shape at arm's length, the corner share button's reach for a thumb, and whether the hint is noticed without being loud.

## 5. Ideas: life in the landscape (not built)

The soundscape lost the crickets, so the world has to show its life instead of chirping it. Everything below is drawn in code, sits in the existing pixel grid and the existing palette, and none of it asks for input or interrupts the ritual. The rule for all of them: rare enough to feel like a gift, never on a timer the eye can learn, and nothing crosses the UI panel or the active lantern.

**Already there, worth extending first.** The fireflies, the boat with its lamp, the chimney smoke and the cottage windows are the living parts today. Two cheap extensions: a second window that lights up *later in the session* (someone else is still awake), and smoke that thickens a little as the evening deepens.

1. **A heron on the shore.** Standing still in the reeds most of the time, one slow neck movement every minute or so, and once in a session it lifts off with three or four wingbeats and leaves across the lake. Two poses and a four-frame flight; the most "there is life here" for the least code.
2. **Ducks crossing the lake.** Two or three small silhouettes with a V of ripples behind them, drifting from one side to the other over a couple of minutes, low on the water so they never compete with the lanterns.
3. **A cat on the dock.** Sits at the edge, tail flicking on a slow irregular clock, occasionally looks up at a rising lantern. A companion for the seated figure already planned as P1.
4. **Moths at the lantern.** One or two pale specks that circle a *waiting* lantern before it is released and scatter when it rises. It rewards the hold, which is the quietest part of the ritual.
5. **An owl call across the water.** No sound now, so: a silhouette that crosses in front of the moon once in a while, which is the visual version of the sound we removed.
6. **A fish rising.** A single ring of ripples somewhere on the lake, spreading and fading, with no fish drawn at all. Two sprites, and the lake already has a ripple palette.
7. **A distant train.** A line of tiny warm windows crossing the far hills every several minutes, with the smoke plume the cottages already have. It also nods at the Night Train tie-in in SPEC section 14.
8. **Sheep or deer on the far hills.** Static silhouettes that move a few pixels between sessions rather than animating, so the hills look grazed rather than empty.
9. **Weather as a rare gift.** A drifting mist bank (the mist layer exists), or a few slow snowflakes in December, chosen from the real date like the meteor showers.
10. **Bats at dusk, stars later.** Two or three erratic flyers in the first minute of a session only, thinning as the evening arc deepens, so arriving early feels different from staying late.

Suggested first three: the heron, the ducks and the fish rings. Together they are one milestone, they use the lake and shore that already exist, and none of them touches the ritual.

## 6. Ideas: friendlier, cozier, more manifestation-minded (not built)

Held to the promises in SPEC section 1: nothing leaves the device, no accounts, no streaks, no guilt, no outcome promises.

**Closer to the ritual**
1. **A word for the season.** One word or short phrase kept for a month ("steady", "begin again"), shown on the arrive screen under the welcome line and offered as a starting point on the wish screen. It gives the nightly wishes a spine without a single new screen.
2. **Breathing that is actually a breath.** The four-second hold is already an inhale. Add the exhale: a ring that contracts over four seconds after the lantern lights, with the release landing at the bottom of the breath. One orchestrated moment, no new copy.
3. **A lantern for someone else.** A mode beside wish and let-go: "carry someone". The text stays private as always; the lantern is drawn with two lights inside.
4. **Gratitude as a third mode.** "Tonight I'm grateful for…", which is the most-asked-for companion to intention-setting and needs only a chip set and a heading.
5. **Return questions that go deeper.** Today a returning lantern asks "How is this one?". A second, optional line ("What moved it along?") would let people write one sentence of reflection, stored with the lantern.

**Around the ritual**
6. **Your sky by month** (already ROADMAP 4.3), with the count per month and a way to reread. The single most requested thing in apps of this kind.
7. **A year of lanterns** (already ROADMAP 4.4): one image a year, the whole sky with the count and the first date.
8. **Anniversaries, gently.** "A year ago tonight you lit your first lantern." Shown on the arrive screen, once, never as a streak or a score.
9. **The sky as a keepsake.** Export the wishes as a plain text file from Settings, for people who journal elsewhere.
10. **Companion lanterns from a shared file.** No server and no account: a backup file can be *read* by someone else's app, so a friend's sky can be shown as faint far lights for one session. Privacy stays intact because nothing is transmitted; a file is handed over deliberately.

**Warmth in the small places**
11. **A name for the night.** The moon label already tells the phase; it could also name the night in the app's own voice ("a quiet waxing night"), which costs one line of copy per phase.
12. **Slower goodnights.** An optional "stay a while" that keeps the scene running with no UI at all, for people who leave it on the nightstand. It pairs with the idle throttling in ROADMAP 2.4.
13. **Turkish first, then more** (already ROADMAP 4.2). The audience skews Turkish-speaking through the maker; the copy deck is small enough to translate well.
14. **A gentler first night.** The very first session could walk through the hold and the release with two extra lines and then never mention them again.

Suggested first three: the word for the season, gratitude as a third mode, and Your sky by month. They are the three that make the app a practice rather than a single evening, and none of them needs a server, an account or a notification.
