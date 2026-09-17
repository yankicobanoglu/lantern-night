/**
 * Copy deck, verbatim from SPEC section 4. M2 needs only the Light and
 * Release/watch strings; M3 completes the deck.
 */
export const COPY = {
  light: {
    idle: 'Hold to light your lantern',
    holding: 'Breathe in…',
    lit: 'Beautiful. Now breathe out, and let it rise.',
    hint: 'Swipe up to release',
    tapAlternative: 'Light it',
  },
  release: {
    gone: 'There it goes.',
    wish: 'Your light is on its way.',
    letGo: 'Lighter already.',
    watch: 'Stay as long as you like.',
    letItRise: 'Let it rise',
    lightAnother: 'Light another',
    goodnight: 'Goodnight',
  },
} as const;
