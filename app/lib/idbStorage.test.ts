import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BIG_KEYS, storageGetRaw, storageSetRaw, storageRemove, getJSON, setJSON, resetIdbForTests,
} from '@/app/lib/idbStorage';

describe('idbStorage — key besar di IndexedDB', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetIdbForTests();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('menulis & membaca key besar lewat IndexedDB', async () => {
    const ok = await storageSetRaw('mma_hpp_purchases', '[{"id":"a1"}]');
    expect(ok).toBe(true);
    const raw = await storageGetRaw('mma_hpp_purchases');
    expect(raw).toBe('[{"id":"a1"}]');
  });

  it('migrasi otomatis: nilai lama di localStorage pindah ke IndexedDB & localStorage dibersihkan', async () => {
    localStorage.setItem('mma_hpp_purchases', '[{"id":"legacy"}]');
    const raw = await storageGetRaw('mma_hpp_purchases');
    expect(raw).toBe('[{"id":"legacy"}]');
    expect(localStorage.getItem('mma_hpp_purchases')).toBeNull();
  });

  it('penulisan key besar menulis penanda dirty di localStorage', async () => {
    await storageSetRaw('mma_hpp_purchases', '[]');
    expect(localStorage.getItem('__dirty_mma_hpp_purchases')).toBe('1');
  });

  it('key kecil tetap di localStorage', async () => {
    await storageSetRaw('mma_modal', '[]');
    expect(localStorage.getItem('mma_modal')).toBe('[]');
    expect(await storageGetRaw('mma_modal')).toBe('[]');
  });

  it('storageRemove menghapus dari kedua penyimpanan', async () => {
    await storageSetRaw('mma_hpp_purchases', '[]');
    localStorage.setItem('mma_hpp_purchases', '[]'); // simulasi salinan lama
    await storageRemove('mma_hpp_purchases');
    expect(await storageGetRaw('mma_hpp_purchases')).toBeNull();
    expect(localStorage.getItem('mma_hpp_purchases')).toBeNull();
  });

  it('getJSON / setJSON roundtrip untuk key besar', async () => {
    await setJSON('mma_sku_data', [{ sku: 'A', nama: 'Produk A' }]);
    const data = await getJSON<any[]>('mma_sku_data');
    expect(data).toHaveLength(1);
    expect(data?.[0].sku).toBe('A');
  });

  it('BIG_KEYS berisi dua key berukuran besar', () => {
    expect(BIG_KEYS.has('mma_hpp_purchases')).toBe(true);
    expect(BIG_KEYS.has('mma_sku_data')).toBe(true);
    expect(BIG_KEYS.has('mma_modal')).toBe(false);
  });
});
