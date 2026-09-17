/** SPEC section 6 data types, verbatim. */
export type LanternStatus = 'rising' | 'came-true' | 'still-growing' | 'let-go';

export type Lantern = {
  id: string; // crypto.randomUUID()
  text: string; // ≤ 120 chars
  createdAt: string; // ISO
  returnAt: string; // createdAt + 30 days
  status: LanternStatus;
  sky: { x: number; y: number }; // normalised 0–1 position in the sky layer
  seed: number; // small visual variation (hue, twinkle)
};

export type Settings = {
  sound: boolean; // default true, audio starts after first tap
  motion: 'system' | 'gentle' | 'full'; // 'system' follows prefers-reduced-motion
  textScale: 1 | 1.15 | 1.3;
  sessions: number;
  installHintCount: number; // how many times the install hint has been shown
  persistGranted: boolean | null; // result of navigator.storage.persist()
  lastBackupAt: string | null;
  /** The one-time shooting-star hint has been shown. */
  starHintShown: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  motion: 'system',
  textScale: 1,
  sessions: 0,
  installHintCount: 0,
  persistGranted: null,
  lastBackupAt: null,
  starHintShown: false,
};

export const RETURN_DAYS = 30;
const DAY_MS = 86_400_000;

export function returnDate(from: Date): string {
  return new Date(from.getTime() + RETURN_DAYS * DAY_MS).toISOString();
}

/** Structural check for one stored lantern (used by restore and by load). */
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
