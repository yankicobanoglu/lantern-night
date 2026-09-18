import { readLanterns, type Lantern, type Settings } from './types';

/** SPEC section 6 backup file. */
export type Backup = {
  app: 'lantern-night';
  version: 1;
  exportedAt: string;
  lanterns: Lantern[];
  settings: Settings;
};

export function backupFileName(now: Date): string {
  return `lantern-night-${now.toISOString().slice(0, 10)}.lantern.json`;
}

export function serializeBackup(lanterns: Lantern[], settings: Settings, now: Date): string {
  const b: Backup = { app: 'lantern-night', version: 1, exportedAt: now.toISOString(), lanterns, settings };
  return JSON.stringify(b, null, 2);
}

/** Parse and validate a backup file's text. Returns null for anything that is not ours. */
export function parseBackup(text: string): Backup | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o['app'] !== 'lantern-night' || o['version'] !== 1) return null;
  if (!Array.isArray(o['lanterns'])) return null;
  const lanterns = readLanterns(o['lanterns']);
  const settings = (typeof o['settings'] === 'object' && o['settings'] !== null ? o['settings'] : {}) as Settings;
  return { app: 'lantern-night', version: 1, exportedAt: String(o['exportedAt'] ?? ''), lanterns, settings };
}
