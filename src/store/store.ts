import type { Kv } from './kv';
import { DEFAULT_SETTINGS, isLantern, returnDate, type Lantern, type LanternStatus, type Settings } from './types';

export const LANTERNS_KEY = 'lanterns';
export const SETTINGS_KEY = 'settings';

/**
 * In-memory copy of the stored lanterns and settings, written through to the
 * key-value store. Let-go text never comes here (SPEC section 6).
 */
export class Store {
  lanterns: Lantern[] = [];
  settings: Settings = { ...DEFAULT_SETTINGS };

  constructor(private readonly kv: Kv) {}

  get available(): boolean {
    return this.kv.available;
  }

  async load(): Promise<void> {
    const raw = await this.kv.get<unknown>(LANTERNS_KEY);
    this.lanterns = Array.isArray(raw) ? raw.filter(isLantern) : [];
    const s = await this.kv.get<Partial<Settings>>(SETTINGS_KEY);
    this.settings = { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
  }

  private saveLanterns(): Promise<void> {
    return this.kv.set(LANTERNS_KEY, this.lanterns);
  }

  async saveSettings(patch: Partial<Settings>): Promise<void> {
    this.settings = { ...this.settings, ...patch };
    await this.kv.set(SETTINGS_KEY, this.settings);
  }

  /** Create and store a wish lantern. */
  async add(input: { text: string; sky: { x: number; y: number }; seed: number; now: Date }): Promise<Lantern> {
    const l: Lantern = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      text: input.text,
      createdAt: input.now.toISOString(),
      returnAt: returnDate(input.now),
      status: 'rising',
      sky: input.sky,
      seed: input.seed,
    };
    this.lanterns.push(l);
    await this.saveLanterns();
    return l;
  }

  byId(id: string): Lantern | undefined {
    return this.lanterns.find((l) => l.id === id);
  }

  /**
   * Answer a return (SPEC section 6 return rules): "still growing" sets returnAt
   * another 30 days out; the other answers keep the lantern where it is.
   */
  async answerReturn(id: string, status: Exclude<LanternStatus, 'rising'>, now: Date): Promise<Lantern | undefined> {
    const l = this.byId(id);
    if (!l) return undefined;
    if (status === 'still-growing') {
      l.status = 'rising';
      l.returnAt = returnDate(now);
    } else {
      l.status = status;
    }
    await this.saveLanterns();
    return l;
  }

  /** Due lanterns, oldest first (by returnAt). */
  due(now: Date): Lantern[] {
    const t = now.getTime();
    return this.lanterns
      .filter((l) => l.status === 'rising' && Date.parse(l.returnAt) <= t)
      .sort((a, b) => Date.parse(a.returnAt) - Date.parse(b.returnAt));
  }

  /** Merge restored lanterns by id; the existing entry wins. Returns how many were added. */
  async merge(incoming: Lantern[]): Promise<number> {
    const ids = new Set(this.lanterns.map((l) => l.id));
    let added = 0;
    for (const l of incoming) {
      if (ids.has(l.id)) continue;
      ids.add(l.id);
      this.lanterns.push(l);
      added++;
    }
    if (added > 0) await this.saveLanterns();
    return added;
  }

  async clear(): Promise<void> {
    this.lanterns = [];
    await this.kv.del(LANTERNS_KEY);
  }

  /** Test hook: replace the stored lanterns. */
  async replaceAll(lanterns: Lantern[]): Promise<void> {
    this.lanterns = lanterns.filter(isLantern);
    await this.saveLanterns();
  }
}
