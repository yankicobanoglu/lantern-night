import { lanternKindOf, type LanternKind } from '../scene/field';

/** SPEC section 6 data types, verbatim, plus the additive keys added since. */
export type LanternStatus = 'rising' | 'came-true' | 'still-growing' | 'let-go';

export type Lantern = {
  id: string; // crypto.randomUUID()
  text: string; // ≤ 120 chars
  createdAt: string; // ISO
  returnAt: string; // createdAt + 30 days
  status: LanternStatus;
  sky: { x: number; y: number }; // normalised 0–1 position in the sky layer
  seed: number; // small visual variation (hue, twinkle)
  /**
   * Which kind of lantern this was (M7). Chosen on the wish screen, kept for
   * the life of the lantern: a sky lantern stays in the sky and a water
   * lantern stays on the lake. Additive: a record written before M7 has no
   * key and reads as 'sky', so the backup format stays at version 1.
   */
  kind: LanternKind;
};

export type Settings = {
  sound: boolean; // default true, audio starts after first tap
  /**
   * Kept for old stores and backups. Since M7 the app always runs gentle and
   * there is no setting; only `?motion=` (tests) overrides it.
   */
  motion: 'system' | 'gentle' | 'full';
  textScale: 1 | 1.15 | 1.3;
  sessions: number;
  installHintCount: number; // how many times the install hint has been shown
  persistGranted: boolean | null; // result of navigator.storage.persist()
  lastBackupAt: string | null;
  /** The one-time shooting-star hint has been shown. */
  starHintShown: boolean;
  /** The one-time sound hint has been shown. */
  soundHintShown: boolean;
  /**
   * The kind chosen for the last lantern (M7), which is the default for the
   * next one. Before M7 this was the whole world's kind. Additive: old
   * settings and backups read as 'sky'.
   */
  scene: LanternKind;
  /** The one-time share hint, after the first lantern of the first night. */
  shareHintShown: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  motion: 'gentle',
  textScale: 1,
  sessions: 0,
  installHintCount: 0,
  persistGranted: null,
  lastBackupAt: null,
  starHintShown: false,
  soundHintShown: false,
  scene: 'sky',
  shareHintShown: false,
};

export const RETURN_DAYS = 30;
const DAY_MS = 86_400_000;

export function returnDate(from: Date): string {
  return new Date(from.getTime() + RETURN_DAYS * DAY_MS).toISOString();
}

/**
 * Structural check for one stored lantern (used by restore and by load). The
 * kind is not required: a record written before M7 has none and is read as a
 * sky lantern by `readLantern`, which is what every reader uses.
 */
export function isLantern(v: unknown): v is Lantern {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const sky = o['sky'] as Record<string, unknown> | undefined;
  return (
    typeof o['id'] === 'string' &&
    typeof o['text'] === 'string' &&
    typeof o['createdAt'] === 'string' &&
    typeof o['returnAt'] === 'string' &&
    (o['status'] === 'rising' || o['status'] === 'came-true' || o['status'] === 'still-growing' || o['status'] === 'let-go') &&
    typeof sky === 'object' &&
    sky !== null &&
    typeof sky['x'] === 'number' &&
    typeof sky['y'] === 'number' &&
    typeof o['seed'] === 'number'
  );
}

/**
 * One stored lantern as this version reads it: the record with its kind filled
 * in. Anything that is not a lantern is dropped (ROADMAP 1.6: readers accept
 * what older writers wrote).
 */
export function readLantern(v: unknown): Lantern | null {
  if (!isLantern(v)) return null;
  return { ...v, kind: lanternKindOf((v as unknown as Record<string, unknown>)['kind']) };
}

export function readLanterns(v: unknown): Lantern[] {
  return Array.isArray(v) ? v.flatMap((x) => { const l = readLantern(x); return l ? [l] : []; }) : [];
}
