import { createStore, del, get, set, type UseStore } from 'idb-keyval';

/**
 * Tiny async key-value store (SPEC section 6): IndexedDB via idb-keyval, with
 * an in-memory fallback when IndexedDB is missing or refuses to open (private
 * browsing modes, some embedded webviews). `available` is false on the fallback.
 */
export interface Kv {
  readonly available: boolean;
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export function memoryKv(): Kv {
  const map = new Map<string, unknown>();
  return {
    available: false,
    get: async <T>(key: string) => map.get(key) as T | undefined,
    set: async (key, value) => {
      map.set(key, value);
    },
    del: async (key) => {
      map.delete(key);
    },
  };
}

export const DB_NAME = 'lantern-night';
export const STORE_NAME = 'kv';

function idbKv(store: UseStore): Kv {
  return {
    available: true,
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
  };
}

/** Open IndexedDB and prove it works with one round trip; otherwise fall back to memory. */
export async function openKv(): Promise<Kv> {
  if (typeof indexedDB === 'undefined') return memoryKv();
  try {
    const store = createStore(DB_NAME, STORE_NAME);
    const kv = idbKv(store);
    await kv.set('__probe', 1);
    await kv.del('__probe');
    return kv;
  } catch {
    return memoryKv();
  }
}
