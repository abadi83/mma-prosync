import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { GlobalSyncProvider } from './GlobalSyncProvider';

/* ── Simulasi server /api/data + ukur trafik yang dikirim tiap siklus sync ── */

type Call = { url: string; method: string; body?: any };

const PUSH_DEBOUNCE_MS = 300;
const POLL_MS = 1000;
const DEFAULT_SIG = 'v0|1000|100|0';

let calls: Call[] = [];
let server: Record<string, any> = {};
let serverDeleted: Record<string, number> = {};
let serverSigs: Record<string, string> = {};
let sigCounter = 0;
let events: string[] = [];
let deviceEvents: any[] = [];
let mockDevices: any[] = [];
let originalFetch: any;

const bumpSig = (key: string) => {
  sigCounter += 1;
  serverSigs[key] = `v${sigCounter}|2000|200|0`;
};

const jsonResponse = (body: any) => ({ ok: true, status: 200, json: async () => body });

const onSharedUpdate = () => {
  events.push('shared-data-updated');
};

const onDevicesUpdate = (e: Event) => {
  deviceEvents.push((e as CustomEvent).detail);
};

const renderProvider = () =>
  render(
    <GlobalSyncProvider>
      <div />
    </GlobalSyncProvider>,
  );

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const posts = () => calls.filter(c => c.method === 'POST');
const batchPulls = () => calls.filter(c => c.method === 'GET' && c.url.includes('keys='));

describe('GlobalSyncProvider — kecepatan sinkron antar komputer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    server = {};
    serverDeleted = {};
    serverSigs = {};
    sigCounter = 0;
    events = [];
    deviceEvents = [];
    mockDevices = [];
    localStorage.clear();
    window.addEventListener('shared-data-updated', onSharedUpdate);
    window.addEventListener('sync-devices-updated', onDevicesUpdate);

    originalFetch = global.fetch;
    global.fetch = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();
      const parsed = new URL(url, 'http://localhost');
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, body });

      if (method === 'POST') {
        server[body.key] = body.data;
        bumpSig(body.key);
        return jsonResponse({ success: true, key: body.key, sig: serverSigs[body.key] });
      }
      if (method === 'DELETE') {
        const key = parsed.searchParams.get('key')!;
        delete server[key];
        bumpSig(key);
        return jsonResponse({ success: true, key, deleted: true, sig: serverSigs[key] });
      }

      const keysParam = parsed.searchParams.get('keys');
      if (keysParam) {
        const keys = keysParam.split(',');
        const sigArr = (parsed.searchParams.get('sigs') || '').split(',');
        const out: Record<string, any> = {};
        keys.forEach((k, i) => {
          const sig = serverSigs[k] || DEFAULT_SIG;
          if (sigArr[i] && sigArr[i] === sig) out[k] = { same: true, sig };
          else out[k] = { data: server[k] ?? [], sig, deletedAt: serverDeleted[k] };
        });
        return jsonResponse({ batch: true, keys: out, devices: mockDevices });
      }

      const key = parsed.searchParams.get('key')!;
      return jsonResponse({ key, data: server[key] ?? [], deletedAt: serverDeleted[key] });
    }) as any;
  });

  afterEach(() => {
    window.removeEventListener('shared-data-updated', onSharedUpdate);
    window.removeEventListener('sync-devices-updated', onDevicesUpdate);
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('tidak mengirim ulang data kalau isinya sama walau urutan itemnya beda', async () => {
    localStorage.setItem('mma_kas_kecil', JSON.stringify([{ id: 'a', jumlah: 1 }, { id: 'b', jumlah: 2 }]));
    server['mma_kas_kecil'] = [{ id: 'b', jumlah: 2 }, { id: 'a', jumlah: 1 }];

    renderProvider();
    await tick(0);

    // Siklus awal tarik data, tapi TIDAK boleh push balik hanya karena urutan beda
    expect(batchPulls()).toHaveLength(1);
    expect(posts()).toHaveLength(0);
    // Data lokal dipertahankan apa adanya (tidak ditulis ulang)
    expect(JSON.parse(localStorage.getItem('mma_kas_kecil')!)).toEqual([
      { id: 'a', jumlah: 1 },
      { id: 'b', jumlah: 2 },
    ]);

    // 3 siklus polling tanpa perubahan = 3 request batch, tanpa push & tanpa event ke UI
    events = [];
    await tick(POLL_MS * 3);
    expect(batchPulls()).toHaveLength(4);
    expect(posts()).toHaveLength(0);
    expect(events).toEqual([]);
  });

  it('perubahan lokal langsung dikirim ke server tanpa nunggu siklus polling', async () => {
    renderProvider();
    await tick(0);
    calls = [];

    await tick(0);
    await act(async () => {
      localStorage.setItem('mma_kas_kecil', JSON.stringify([{ id: 'a' }]));
      await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    });

    expect(posts()).toHaveLength(1);
    expect(server['mma_kas_kecil']).toEqual([{ id: 'a' }]);
    expect(batchPulls()).toHaveLength(0); // belum 1 detik → memang push cepat, bukan polling

    // Setelah push, data kita sendiri tidak ditarik ulang dari server
    calls = [];
    await tick(POLL_MS * 2);
    expect(batchPulls()).toHaveLength(2);
    expect(posts()).toHaveLength(0);
  });

  it('perubahan dari komputer lain masuk ke lokal + memicu update UI', async () => {
    renderProvider();
    await tick(0);

    server['mma_kas_kecil'] = [{ id: 'x' }];
    bumpSig('mma_kas_kecil');
    events = [];

    await tick(POLL_MS);

    expect(JSON.parse(localStorage.getItem('mma_kas_kecil')!)).toEqual([{ id: 'x' }]);
    expect(events).toEqual(['shared-data-updated']);
  });

  it('data yang dihapus global tetap terhapus (tidak dihidupkan kembali)', async () => {
    localStorage.setItem('mma_kas_kecil', JSON.stringify([{ id: 'a' }]));
    serverDeleted['mma_kas_kecil'] = Date.now();

    renderProvider();
    await tick(0);

    expect(localStorage.getItem('mma_kas_kecil')).toBeNull();
    expect(posts()).toHaveLength(0);

    await tick(POLL_MS * 2);
    expect(posts()).toHaveLength(0);
    expect(localStorage.getItem('mma_kas_kecil')).toBeNull();
  });

  it('setiap request sync menyertakan identitas perangkat', async () => {
    renderProvider();
    await tick(0);

    const batch = batchPulls()[0];
    expect(batch.url).toContain('device=');
    expect(batch.url).toContain('name=');

    localStorage.setItem('mma_kas_kecil', JSON.stringify([{ id: 'a' }]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    });
    const post = posts()[0];
    expect(post.body.device).toBeTruthy();
    expect(post.body.name).toBeTruthy();
  });

  it('menyimpan daftar perangkat dari server & memberitahu UI', async () => {
    mockDevices = [
      { id: 'dev-a', name: 'Andi', lastSyncAt: Date.now(), lastPushAt: Date.now() - 60000, lastKey: 'mma_kas_kecil', lastAction: 'push' },
      { id: 'dev-b', name: 'Budi', lastSyncAt: Date.now(), lastPushAt: 0, lastKey: null, lastAction: null },
    ];

    renderProvider();
    await tick(0);

    // Tersimpan ke localStorage (dibaca header saat mount/reload)
    expect(JSON.parse(localStorage.getItem('mma_sync_devices')!)).toEqual(mockDevices);
    // Event diterima UI (isi berubah → langsung emit)
    expect(deviceEvents).toHaveLength(1);
    expect(deviceEvents[0].devices).toEqual(mockDevices);
  });

  it('reset global tidak dihidupkan kembali oleh flush/poll yang berjalan bersamaan', async () => {
    localStorage.setItem('mma_kas_kecil', JSON.stringify([{ id: 'a' }]));
    server['mma_kas_kecil'] = [{ id: 'a' }];
    renderProvider();
    await tick(0); // initial sync selesai
    calls = [];

    // DELETE dibuat lambat (500ms) → flush 300ms & poll 1s sempat jalan duluan
    const prevFetch = global.fetch as any;
    global.fetch = vi.fn(async (input: any, init?: any) => {
      if ((init?.method || 'GET') === 'DELETE') {
        await new Promise((r) => setTimeout(r, 500));
      }
      return prevFetch(input, init);
    }) as any;

    await act(async () => {
      window.dispatchEvent(new CustomEvent('global-data-reset', { detail: { key: 'mma_kas_kecil' } }));
      await vi.advanceTimersByTimeAsync(2500); // lewati debounce + beberapa siklus poll
    });

    // Data harus tetap terhapus — lokal & server tidak boleh dihidupkan kembali
    expect(localStorage.getItem('mma_kas_kecil')).toBeNull();
    expect(server['mma_kas_kecil']).toBeUndefined();
    expect(posts().filter((c) => c.body?.key === 'mma_kas_kecil')).toHaveLength(0);
  });

  it('batch yang terlanjur diambil SEBELUM reset selesai tidak menghidupkan data lagi', async () => {
    localStorage.setItem('mma_kas_kecil', JSON.stringify([{ id: 'a' }]));
    server['mma_kas_kecil'] = [{ id: 'a' }];
    renderProvider();
    await tick(0); // initial sync selesai
    calls = [];

    const prevFetch = global.fetch as any;
    global.fetch = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();
      const parsed = new URL(url, 'http://localhost');
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, body });

      if (method === 'DELETE') {
        await new Promise((r) => setTimeout(r, 200));
        delete server['mma_kas_kecil'];
        serverDeleted['mma_kas_kecil'] = Date.now();
        bumpSig('mma_kas_kecil');
        return jsonResponse({ success: true, key: parsed.searchParams.get('key'), deleted: true, sig: serverSigs['mma_kas_kecil'] });
      }

      if (method === 'GET' && url.includes('keys=')) {
        // Snapshot BASI: ambil isi server SEKARANG (sebelum reset), respons baru
        // dikirim 1500ms kemudian — melewati selesainya DELETE reset.
        const stale: Record<string, any> = {};
        const sigsAtStart: Record<string, string> = {};
        const deletedAtStart: Record<string, number> = {};
        for (const k of Object.keys(server)) stale[k] = server[k];
        Object.assign(sigsAtStart, serverSigs);
        Object.assign(deletedAtStart, serverDeleted);
        await new Promise((r) => setTimeout(r, 1500));
        const keys = parsed.searchParams.get('keys')!.split(',');
        const sigArr = (parsed.searchParams.get('sigs') || '').split(',');
        const out: Record<string, any> = {};
        keys.forEach((k, i) => {
          const sig = sigsAtStart[k] || DEFAULT_SIG;
          if (sigArr[i] && sigArr[i] === sig) out[k] = { same: true, sig };
          else out[k] = { data: stale[k] ?? [], sig, deletedAt: deletedAtStart[k] };
        });
        return jsonResponse({ batch: true, keys: out, devices: [] });
      }

      return prevFetch(input, init);
    }) as any;

    await act(async () => {
      // Poll cycle ke-1 mulai (batch GET tertunda 1500ms), lalu reset jalan di tengahnya
      await vi.advanceTimersByTimeAsync(1000);
      window.dispatchEvent(new CustomEvent('global-data-reset', { detail: { key: 'mma_kas_kecil' } }));
      await vi.advanceTimersByTimeAsync(3000); // DELETE selesai (200ms) → batch basi tiba (1500ms)
    });

    // Batch basi harus dibuang: lokal tetap kosong, server tetap terhapus, tidak ada push balik
    expect(localStorage.getItem('mma_kas_kecil')).toBeNull();
    expect(server['mma_kas_kecil']).toBeUndefined();
    expect(posts().filter((c) => c.body?.key === 'mma_kas_kecil')).toHaveLength(0);

    // Siklus berikutnya (setelah guard) tetap bersih
    await tick(POLL_MS * 2);
    expect(localStorage.getItem('mma_kas_kecil')).toBeNull();
    expect(posts().filter((c) => c.body?.key === 'mma_kas_kecil')).toHaveLength(0);
  });
});
