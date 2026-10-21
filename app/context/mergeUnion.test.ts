import { describe, it, expect } from 'vitest';
import { mergeUnion } from './GlobalSyncProvider';

interface Item { id: string; v: number; updatedAt?: number; }

describe('mergeUnion — aturan updatedAt (anti ketimpa)', () => {
  it('keduanya punya updatedAt → versi terbaru menang', () => {
    const local: Item[] = [{ id: 'a', v: 2, updatedAt: 200 }];
    const server: Item[] = [{ id: 'a', v: 1, updatedAt: 100 }];
    const r = mergeUnion('k', local, server) as Item[];
    expect(r[0].v).toBe(2);
  });

  it('keduanya punya updatedAt → server lebih baru menang (edit orang lain tidak ketimpa)', () => {
    const local: Item[] = [{ id: 'a', v: 1, updatedAt: 100 }];
    const server: Item[] = [{ id: 'a', v: 2, updatedAt: 200 }];
    const r = mergeUnion('k', local, server) as Item[];
    expect(r[0].v).toBe(2);
  });

  it('lokal punya updatedAt & server tidak → lokal menang (edit baru vs salinan lama)', () => {
    const local: Item[] = [{ id: 'a', v: 2, updatedAt: 200 }];
    const server: Item[] = [{ id: 'a', v: 1 }];
    const r = mergeUnion('k', local, server) as Item[];
    expect(r[0].v).toBe(2);
  });

  it('server punya updatedAt & lokal tidak → server menang (salinan lama TIDAK menimpa edit baru)', () => {
    const local: Item[] = [{ id: 'a', v: 1 }];
    const server: Item[] = [{ id: 'a', v: 2, updatedAt: 200 }];
    const r = mergeUnion('k', local, server) as Item[];
    expect(r[0].v).toBe(2);
  });

  it('keduanya tanpa updatedAt → perilaku lama (lokal menang)', () => {
    const local: Item[] = [{ id: 'a', v: 2 }];
    const server: Item[] = [{ id: 'a', v: 1 }];
    const r = mergeUnion('k', local, server) as Item[];
    expect(r[0].v).toBe(2);
  });

  it('item berbeda tetap di-union, tidak saling menimpa', () => {
    const local: Item[] = [{ id: 'a', v: 1 }];
    const server: Item[] = [{ id: 'b', v: 2 }];
    const r = mergeUnion('k', local, server) as Item[];
    expect(r).toHaveLength(2);
  });
});
