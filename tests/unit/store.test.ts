import { describe, expect, it } from 'vitest';
import { backupFileName, parseBackup, serializeBackup } from '../../src/store/backup';
import { memoryKv, type Kv } from '../../src/store/kv';
import { LANTERNS_KEY, Store } from '../../src/store/store';
import { DEFAULT_SETTINGS, returnDate, type Lantern } from '../../src/store/types';

const DAY = 86_400_000;
const now = new Date('2026-09-17T21:00:00Z');

function lantern(over: Partial<Lantern> = {}): Lantern {
  return {
    id: over.id ?? crypto.randomUUID(),
    text: 'I am welcoming calm',
    createdAt: now.toISOString(),
    returnAt: returnDate(now),
    status: 'rising',
    sky: { x: 0.3, y: 0.2 },
    seed: 7,
    ...over,
  };
}

describe('Store', () => {
  it('adds a wish lantern with a return 30 days out and writes it through', async () => {
    const kv = memoryKv();
    const s = new Store(kv);
    await s.load();
    const l = await s.add({ text: 'More of this, please: sleep', sky: { x: 0.5, y: 0.3 }, seed: 3, now });
    expect(l.status).toBe('rising');
    expect(Date.parse(l.returnAt) - Date.parse(l.createdAt)).toBe(30 * DAY);
    const stored = await kv.get<Lantern[]>(LANTERNS_KEY);
    expect(stored).toHaveLength(1);
    expect(stored?.[0]?.text).toBe('More of this, please: sleep');
  });

  it('reloads lanterns and settings, ignoring malformed entries', async () => {
    const kv = memoryKv();
    await kv.set(LANTERNS_KEY, [lantern({ id: 'a' }), { junk: true }, lantern({ id: 'b' })]);
    await kv.set('settings', { textScale: 1.3 });
    const s = new Store(kv);
    await s.load();
    expect(s.lanterns.map((l) => l.id)).toEqual(['a', 'b']);
    expect(s.settings).toEqual({ ...DEFAULT_SETTINGS, textScale: 1.3 });
  });

  it('returns: due when now ≥ returnAt and rising, oldest first, still-growing pushes 30 days', async () => {
    const s = new Store(memoryKv());
    await s.load();
    await s.replaceAll([
      lantern({ id: 'late', returnAt: new Date(now.getTime() - 5 * DAY).toISOString() }),
      lantern({ id: 'later', returnAt: new Date(now.getTime() - 40 * DAY).toISOString() }),
      lantern({ id: 'future', returnAt: new Date(now.getTime() + 2 * DAY).toISOString() }),
      lantern({ id: 'done', returnAt: new Date(now.getTime() - 9 * DAY).toISOString(), status: 'came-true' }),
    ]);
    expect(s.due(now).map((l) => l.id)).toEqual(['later', 'late']);
    const grown = await s.answerReturn('later', 'still-growing', now);
    expect(grown?.status).toBe('rising');
    expect(grown?.returnAt).toBe(returnDate(now));
    expect(s.due(now).map((l) => l.id)).toEqual(['late']);
    await s.answerReturn('late', 'came-true', now);
    expect(s.byId('late')?.status).toBe('came-true');
    expect(s.due(now)).toEqual([]);
  });

  it('merges by id with the existing entry winning and never deletes', async () => {
    const s = new Store(memoryKv());
    await s.load();
    await s.replaceAll([lantern({ id: 'a', text: 'mine' })]);
    const added = await s.merge([lantern({ id: 'a', text: 'theirs' }), lantern({ id: 'b' })]);
    expect(added).toBe(1);
    expect(s.lanterns.map((l) => l.id)).toEqual(['a', 'b']);
    expect(s.byId('a')?.text).toBe('mine');
  });

  it('clear removes everything from the store', async () => {
    const kv = memoryKv();
    const s = new Store(kv);
    await s.load();
    await s.add({ text: 'x', sky: { x: 0.1, y: 0.1 }, seed: 1, now });
    await s.clear();
    expect(s.lanterns).toEqual([]);
    expect(await kv.get(LANTERNS_KEY)).toBeUndefined();
  });

  it('keeps working on a throwing store (memory fallback semantics)', async () => {
    const broken: Kv = {
      available: false,
      get: async () => undefined,
      set: async () => {
        throw new Error('quota');
      },
      del: async () => {},
    };
    const s = new Store(broken);
    await s.load();
    await expect(s.add({ text: 'x', sky: { x: 0.1, y: 0.1 }, seed: 1, now })).rejects.toThrow('quota');
    // The in-memory list still holds it, so the lantern can rise tonight.
    expect(s.lanterns).toHaveLength(1);
    expect(s.available).toBe(false);
  });
});

describe('backup', () => {
  it('names the file by date and round-trips', () => {
    expect(backupFileName(now)).toBe('lantern-night-2026-09-17.lantern.json');
    const text = serializeBackup([lantern({ id: 'a' })], DEFAULT_SETTINGS, now);
    const b = parseBackup(text);
    expect(b?.app).toBe('lantern-night');
    expect(b?.version).toBe(1);
    expect(b?.lanterns.map((l) => l.id)).toEqual(['a']);
    expect(b?.exportedAt).toBe(now.toISOString());
  });

  it('rejects files that are not ours', () => {
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup('{"app":"other","version":1,"lanterns":[]}')).toBeNull();
    expect(parseBackup('{"app":"lantern-night","version":2,"lanterns":[]}')).toBeNull();
    expect(parseBackup('{"app":"lantern-night","version":1}')).toBeNull();
    expect(parseBackup('[]')).toBeNull();
  });
});
