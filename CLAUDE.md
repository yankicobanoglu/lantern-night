# Lantern Night — working rules for Claude Code

The full build spec is in `SPEC.md`. These rules are copied from its section 13 and apply to every session.

- Read SPEC.md before any work. Work on one milestone at a time and stop for review at the end of each.
- Plan first, then build. Keep changes small and commit at the end of each milestone.
- All art is created in code. Never add image assets from outside or generate images.
- Never send wish text anywhere. No network requests besides the site's own static files.
- Ask before adding any dependency not listed in section 8.
- Never handle passwords or tokens. When GitHub sign-in is needed, stop and ask the user to do it.
- Respect the performance budgets. Measure, don't guess.
- Use the copy deck verbatim. Propose wording changes instead of improvising them.
- Verify with screenshots (Playwright) before calling a visual task done.

## Where things are

- Milestones: SPEC.md section 10. Current milestone plan: `PLAN-M1.md`.
- Palette, composition and legibility rules: SPEC.md section 7.
- Stack and folder layout: SPEC.md section 8. Vite `base` is `/lantern-night/` (single config value).
- Tests: SPEC.md section 11. Unit tests with Vitest, end-to-end with Playwright (WebKit + Chromium).

## Commands (once scaffolded)

- `npm run dev` — local dev server (`npm run dev -- --host` to test on an iPhone on the same Wi-Fi)
- `npm test` — Vitest unit tests
- `npm run e2e` — Playwright tests and screenshots
- `npm run build` — production build to `dist/`
