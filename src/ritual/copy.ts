import type { MoonKind } from './moonPhase';

/** Copy deck, verbatim from SPEC section 4. */
export const COPY = {
  title: 'Lantern Night',
  arrive: {
    first: 'Welcome. The evening is quiet tonight.',
    returning: 'Welcome back. Your lanterns are still glowing.',
    begin: 'Begin',
  },
  moonBanner: {
    new: 'A new moon tonight. A lovely time to set an intention.',
    full: 'A full moon tonight. A gentle time to let something go.',
  },
  intention: {
    wish: {
      heading: 'What would you like to grow toward?',
      placeholder: 'I am welcoming…',
      helper: "Write it as if it's already on its way.",
      chips: [
        'I am becoming…',
        'This season, I welcome…',
        "I'm ready for…",
        "I'd love to feel…",
        'I trust that…',
        'My next brave step is…',
        'More of this, please:',
        "Something I'm growing toward…",
      ],
    },
    letGo: {
      heading: 'What would you like to set down tonight?',
      placeholder: "I'm ready to release…",
      helper: "This stays between you and the night. It won't be saved.",
      chips: ["I'm ready to release…", 'I no longer need to carry…', 'I forgive myself for…', "I'm letting go of the worry that…"],
    },
    modeWish: 'Make a wish',
    modeLetGo: 'Let something go',
    fold: 'Fold my lantern',
    /** The kind of lantern (not in the deck; proposed in PLAN-M7). Both kinds share one night. */
    kindLabel: 'Kind of lantern',
    kinds: { sky: 'Sky lantern', water: 'Water lantern' },
  },
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
  /** Water lanterns (not in the deck; proposed in PLAN-M6): the deck's "let it rise" reads wrong for a lantern on the water. */
  water: {
    lit: 'Beautiful. Now breathe out, and let it drift.',
    letItDrift: 'Let it drift',
  },
  goodnight: {
    wish: 'Sleep well. Your lanterns will keep glowing.',
    letGo: "Rest easy. You've made some room tonight.",
  },
  return: {
    heading: (date: string) => `A lantern from ${date} has drifted back to visit.`,
    question: 'How is this one?',
    options: {
      'came-true': { label: 'It came true', reply: "How wonderful. It'll shine a little brighter now." },
      'still-growing': { label: "It's still growing", reply: 'Good things take their time. Back to the sky it goes.' },
      'let-go': { label: "I've let it go", reply: "That's okay. It'll float on, lighter." },
    },
    continue: 'Continue',
  },
  star: {
    tapped: 'Quick, a wish, just for you.',
    held: 'Held close.',
    hint: 'Tap a shooting star to make a quick wish.',
  },
  moon: {
    /** "Full moon in {n} days." / "New moon in {n} days.", "tomorrow" when n = 1, "tonight" on the day itself. */
    next: (kind: 'new' | 'full', days: number): string => {
      const name = kind === 'full' ? 'Full moon' : 'New moon';
      if (days <= 0) return `${name} tonight.`;
      if (days === 1) return `${name} tomorrow.`;
      return `${name} in ${days} days.`;
    },
  },
  sky: {
    heading: 'Your sky',
    /** "{n} lanterns lit" in the deck; the singular is a proposal after the live check. */
    count: (n: number) => (n === 1 ? '1 lantern lit' : `${n} lanterns lit`),
    /** Card for a light whose words were never kept (not in the deck; proposed after the live check). */
    letGoCard: 'Set down tonight. Its words stayed with the night.',
    empty: 'Your sky is waiting for its first light.',
    close: 'Close',
  },
  settings: {
    heading: 'Settings',
    sound: 'Sound',
    motion: 'Gentle motion',
    textSize: 'Text size',
    save: 'Save a backup',
    restore: 'Restore from backup',
    clear: 'Clear my sky',
    backupHelper: 'Your sky lives on this device. Save a backup now and then to keep it safe.',
    saved: 'Backup saved.',
    restored: 'Your sky is back.',
    restoredCount: (n: number) => `${n} lanterns restored`,
    wrongFile: "That file isn't a Lantern Night backup. Choose a file that ends in .lantern.json.",
    confirmClear: "This removes every lantern from this device. It can't be undone.",
    keep: 'Keep them',
    close: 'Close',
    /** Mute toggle labels (not in the deck; proposed in PLAN-M4). */
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    /**
     * Unused since M7: the kind of lantern is chosen on the wish screen, and
     * gentle motion is always on. The strings stay because the deck is SPEC's.
     */
    scene: 'Scene',
    scenes: { sky: 'Sky lanterns', water: 'Water lanterns' },
    /** Small print at the foot of Settings (not in the deck; proposed after the M5 review). */
    legal: 'Privacy: your lanterns stay on this device and never leave it. Terms: Lantern Night is offered as is, for reflection only. Back up your sky now and then.',
  },
  share: {
    button: 'Share my sky',
    includeWish: 'Include my wish',
    /** Text beside the shared image (not in the deck; proposed after the M5 review). */
    text: (url: string) => `Light a lantern. Let it rise. ${url}`,
    /** One-time hint pointing at the corner share button, after the first lantern (not in the deck; proposed in PLAN-M7). */
    hint: 'Tap here to share your sky.',
  },
  system: {
    storageUnavailable: "Your lanterns can't be saved in this browser mode. They'll still rise tonight.",
    installIos: 'Keep Lantern Night on your home screen so your sky stays safe: tap Share, then Add to Home Screen.',
    installOther: 'Install Lantern Night so your sky stays safe.',
    install: 'Install',
    /** One-time sound hint after Begin (not in the deck; proposed after the M5 review). */
    soundHint: 'Turn your sound on to hear the evening.',
  },
  menu: {
    open: 'Menu',
    sky: 'Your sky',
    settings: 'Settings',
  },
} as const;

export type Mode = 'wish' | 'let-go';

/** Default mode from the moon (SPEC section 5): full moon → let go, otherwise wish. */
export function defaultMode(kind: MoonKind): Mode {
  return kind === 'full' ? 'let-go' : 'wish';
}

/** The moon banner line for tonight, or null when there is none. */
export function moonBanner(kind: MoonKind): string | null {
  return kind === 'new' ? COPY.moonBanner.new : kind === 'full' ? COPY.moonBanner.full : null;
}

export function arriveLine(hasLanterns: boolean): string {
  return hasLanterns ? COPY.arrive.returning : COPY.arrive.first;
}

export function intentionCopy(mode: Mode): (typeof COPY.intention)['wish'] | (typeof COPY.intention)['letGo'] {
  return mode === 'wish' ? COPY.intention.wish : COPY.intention.letGo;
}

export const MAX_TEXT = 120;

/** Trim and cap at 120 characters (counted as code points so an emoji is never cut in half). */
export function clampText(text: string): string {
  const chars = Array.from(text.trim());
  return chars.slice(0, MAX_TEXT).join('');
}
