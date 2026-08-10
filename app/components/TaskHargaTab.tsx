'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSkus, type SkuItem } from '@/app/context/SkuContext';
import { useUser, type UserInfo } from '@/app/hooks/useUser';

/* ================================================================ */
/* TYPES                                                            */
/* ================================================================ */
export interface PriceTask {
  id: string;
  sku: string;
  namaProduk: string;
  tokoId: string;
  tokoNama: string;
  marketplace: string;
  hargaJualLama: number;        // harga jual saat ini di toko tsb
  hargaJualBaru: number;         // harga jual baru yg disarankan (dari kalkulasi)
  hargaBeliSaatIni: number;      // hargaBaru dari master SKU
  status: 'todo' | 'doing' | 'done' | 'skipped';
  assignedTo: string;            // nama user yg assigned
  assignedId: string;            // pegawaiId
  createdAt: string;             // ISO date
  completedAt: string | null;
  completedBy: string | null;
  hargaJualFinal: number | null; // harga yg akhirnya diset user
  catatan: string;
}

export interface PriceChangeHistory {
  id: string;
  sku: string;
  namaProduk: string;
  tokoId: string;
  tokoNama: string;
  marketplace: string;
  hargaJualLama: number;
  hargaJualBaru: number;
  hargaBeliSaatItu: number;
  diubahOleh: string;
  diubahOlehId: string;
  tanggal: string;
  sumber: 'task' | 'manual';     // apakah dari task system atau manual edit
  taskId: string | null;
}

const TASK_STORAGE = 'mma_price_tasks';
const HISTORY_STORAGE = 'mma_price_history';

/* ================================================================ */
/* HELPERS                                                          */
/* ================================================================ */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowISO(): string {
  return new Date().toISOString();
}

function calcSuggestedPrice(hargaBeli: number, potonganMP: number, biayaTetap: number, keuntungan: number): number {
  if (!hargaBeli || !potonganMP || !keuntungan) return hargaBeli;
  if (potonganMP >= 100) return hargaBeli;
  return Math.round((hargaBeli * (1 + keuntungan / 100) + biayaTetap) / (1 - potonganMP / 100));
}

const DEFAULT_KEUNTUNGAN = 20;
const DEFAULT_BIAYA_TETAP = 1250;

const MP_POTONGAN: Record<string, number> = {
  Shopee: 10,
  Tokopedia: 8,
  Lazada: 8,
  Bukalapak: 5,
  Blibli: 7,
  'TikTok Shop': 6,
  Lainnya: 5,
};

/* ================================================================ */
/* MAIN COMPONENT                                                   */
/* ================================================================ */
export default function TaskHargaTab() {
  const { skus } = useSkus();
  const user = useUser();

  const [tasks, setTasks] = useState<PriceTask[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(TASK_STORAGE);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const [history, setHistory] = useState<PriceChangeHistory[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // Persist
  useEffect(() => {
    try { localStorage.setItem(TASK_STORAGE, JSON.stringify(tasks)); } catch { }
  }, [tasks]);
  useEffect(() => {
    try { localStorage.setItem(HISTORY_STORAGE, JSON.stringify(history)); } catch { }
  }, [history]);

  /* ── Filter state ── */
  const [filterStatus, setFilterStatus] = useState<string>('semua');
  const [filterMP, setFilterMP] = useState<string>('semua');
  const [searchSku, setSearchSku] = useState('');
  const [viewMode, setViewMode] = useState<'tasks' | 'history' | 'performa'>('tasks');

  /* ── Settings ── */
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    if (typeof window === 'undefined') return { keuntungan: DEFAULT_KEUNTUNGAN, biayaTetap: DEFAULT_BIAYA_TETAP };
    try {
      const raw = localStorage.getItem('mma_taskharga_settings');
      return raw ? JSON.parse(raw) : { keuntungan: DEFAULT_KEUNTUNGAN, biayaTetap: DEFAULT_BIAYA_TETAP };
    } catch { return { keuntungan: DEFAULT_KEUNTUNGAN, biayaTetap: DEFAULT_BIAYA_TETAP }; }
  });
  useEffect(() => {
    try { localStorage.setItem('mma_taskharga_settings', JSON.stringify(settings)); } catch { }
  }, [settings]);

  /* ── Generate task untuk SATU SKU saja (dipicu dari SkuTab save) ── */
  const generateTaskForSku = useCallback((skuCode: string, knownOldHargaJual?: number) => {
    const skuItem = skus.find(s => s.sku === skuCode);
    if (!skuItem || skuItem.aktif !== 1) return 0;
    if (!skuItem.statusUploadToko || skuItem.statusUploadToko === 'nan') return 0;

    // Parse toko dari statusUploadToko
    const tokoList: { tokoNama: string; marketplace: string; key: string }[] = [];
    const parts = skuItem.statusUploadToko.split('|');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf('—');
      if (idx === -1) continue;
      const mp = trimmed.slice(0, idx).trim();
      const nama = trimmed.slice(idx + 1).trim();
      if (!mp || !nama) continue;
      const key = `${mp}|${nama}`;
      tokoList.push({ tokoNama: nama, marketplace: mp, key });
    }

    if (tokoList.length === 0) return 0;

    const newTasks: PriceTask[] = [];
    const masterHargaJual = skuItem.hargaJual > 0
      ? skuItem.hargaJual
      : calcSuggestedPrice(skuItem.hargaBaru, MP_POTONGAN[tokoList[0].marketplace] || 5, settings.biayaTetap, settings.keuntungan);

    for (const toko of tokoList) {
      const taskKey = `${skuCode}|${toko.marketplace}|${toko.tokoNama}`;

      // Skip kalau sudah ada task todo/doing untuk kombinasi ini
      const alreadyExists = tasks.some(
        t => t.sku === skuCode && t.marketplace === toko.marketplace &&
          t.tokoNama === toko.tokoNama && (t.status === 'todo' || t.status === 'doing')
      );
      if (alreadyExists) continue;

      // Cek history terakhir di toko ini
      const lastHistory = history
        .filter(h => h.sku === skuCode && h.marketplace === toko.marketplace && h.tokoNama === toko.tokoNama)
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
      const lastHistoryPrice = lastHistory ? lastHistory.hargaJualBaru : 0;

      // Cek task done terakhir untuk toko ini (fallback kalau history kosong)
      const lastDoneTask = !lastHistoryPrice ? tasks
        .filter(t => t.sku === skuCode && t.marketplace === toko.marketplace &&
          t.tokoNama === toko.tokoNama && t.status === 'done' && t.hargaJualFinal)
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0]
        : null;
      const lastDonePrice = lastDoneTask?.hargaJualFinal || 0;

      // ── Tentukan hargaJualLama (prioritas) ──
      // 1. knownOldHargaJual = harga sebelum edit dari SkuTab (paling akurat!)
      // 2. lastHistoryPrice = dari riwayat perubahan sebelumnya
      // 3. lastDonePrice = dari task selesai sebelumnya
      // 4. fallback: 0 → nanti di UI tampil "Baru"
      const determinedOldPrice = knownOldHargaJual && knownOldHargaJual > 0
        ? knownOldHargaJual
        : lastHistoryPrice || lastDonePrice || 0;

      // Skip kalau harga lama = harga baru (gak ada perubahan)
      if (determinedOldPrice === masterHargaJual && determinedOldPrice > 0) {
        continue;
      }

      // Skip kalau sudah ada task done untuk state ini
      const alreadyDone = tasks.some(
        t => t.sku === skuCode && t.marketplace === toko.marketplace &&
          t.tokoNama === toko.tokoNama && t.status === 'done' &&
          t.hargaJualFinal === masterHargaJual && t.hargaBeliSaatIni === skuItem.hargaBaru
      );
      if (alreadyDone) continue;

      newTasks.push({
        id: generateId('task'),
        sku: skuItem.sku,
        namaProduk: skuItem.nama,
        tokoId: toko.key,
        tokoNama: toko.tokoNama,
        marketplace: toko.marketplace,
        hargaJualLama: determinedOldPrice,
        hargaJualBaru: masterHargaJual,
        hargaBeliSaatIni: skuItem.hargaBaru,
        status: 'todo',
        assignedTo: '',
        assignedId: '',
        createdAt: nowISO(),
        completedAt: null,
        completedBy: null,
        hargaJualFinal: null,
        catatan: '',
      });
    }

    if (newTasks.length > 0) {
      setTasks(prev => [...newTasks, ...prev]);
    }
    return newTasks.length;
  }, [skus, tasks, history, settings]);

  /* ── Listen event dari SkuTab: setiap kali user save SKU ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { sku: string; oldHargaJual?: number; newHargaJual?: number };
      if (detail?.sku) {
        generateTaskForSku(detail.sku, detail.oldHargaJual);
      }
    };
    window.addEventListener('sku-saved', handler);
    return () => window.removeEventListener('sku-saved', handler);
  }, [generateTaskForSku]);

  /* ── Process pending queue dari localStorage (pas tab ini di-buka) ── */
  const queueProcessedRef = React.useRef(false);
  useEffect(() => {
    queueProcessedRef.current = false;
  }, []);
  useEffect(() => {
    if (queueProcessedRef.current || skus.length === 0) return;
    const timer = setTimeout(() => {
      if (queueProcessedRef.current) return;
      try {
        const raw = localStorage.getItem('mma_pending_task_skus');
        if (!raw) { queueProcessedRef.current = true; return; }
        const queue: (string | { sku: string; oldHargaJual?: number; newHargaJual?: number })[] = JSON.parse(raw);
        if (queue.length === 0) { queueProcessedRef.current = true; return; }

        let processed = 0;
        for (const item of queue) {
          const skuCode = typeof item === 'string' ? item : item.sku;
          const oldPrice = typeof item === 'string' ? undefined : item.oldHargaJual;
          const count = generateTaskForSku(skuCode, oldPrice);
          if (count > 0) processed += count;
        }

        localStorage.removeItem('mma_pending_task_skus');
        queueProcessedRef.current = true;

        if (processed > 0) {
          console.log(`[TaskHarga] ✅ ${processed} task baru dari ${queue.length} SKU pending`);
        }
      } catch {
        localStorage.removeItem('mma_pending_task_skus');
        queueProcessedRef.current = true;
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [skus.length, generateTaskForSku]);

  /* ── Full scan manual (tombol "Scan Semua SKU") ── */
  const generateTasks = useCallback(() => {
    let totalNew = 0;
    for (const sku of skus) {
      if (sku.aktif !== 1) continue;
      totalNew += generateTaskForSku(sku.sku);
    }
    return totalNew;
  }, [skus, generateTaskForSku]);

  /* ── Task actions ── */
  const [detailTask, setDetailTask] = useState<PriceTask | null>(null);
  const [completeForm, setCompleteForm] = useState<{
    task: PriceTask;
    hargaFinal: string;
    catatan: string;
  } | null>(null);

  const startTask = (task: PriceTask) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === task.id
          ? { ...t, status: 'doing' as const, assignedTo: user.nama, assignedId: user.pegawaiId }
          : t
      )
    );
  };

  const openComplete = (task: PriceTask) => {
    setCompleteForm({
      task,
      hargaFinal: String(task.hargaJualBaru),
      catatan: '',
    });
  };

  const completeTask = () => {
    if (!completeForm) return;
    const { task, hargaFinal, catatan } = completeForm;
    const finalPrice = +hargaFinal || task.hargaJualBaru;

    // Update task
    setTasks(prev =>
      prev.map(t =>
        t.id === task.id
          ? {
            ...t,
            status: 'done' as const,
            completedAt: nowISO(),
            completedBy: user.nama,
            hargaJualFinal: finalPrice,
            catatan: catatan.trim(),
          }
          : t
      )
    );

    // Add history
    const historyEntry: PriceChangeHistory = {
      id: generateId('hist'),
      sku: task.sku,
      namaProduk: task.namaProduk,
      tokoId: task.tokoId,
      tokoNama: task.tokoNama,
      marketplace: task.marketplace,
      hargaJualLama: task.hargaJualLama,
      hargaJualBaru: finalPrice,
      hargaBeliSaatItu: task.hargaBeliSaatIni,
      diubahOleh: user.nama,
      diubahOlehId: user.pegawaiId,
      tanggal: todayISO(),
      sumber: 'task',
      taskId: task.id,
    };
    setHistory(prev => [historyEntry, ...prev]);

    setCompleteForm(null);
  };

  const skipTask = (task: PriceTask) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === task.id
          ? { ...t, status: 'skipped' as const, catatan: 'Dilewati' }
          : t
      )
    );
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  /* ── Filters ── */
  const marketplaces = useMemo(() => {
    const mps = new Set(tasks.map(t => t.marketplace));
    return Array.from(mps).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterStatus !== 'semua' && t.status !== filterStatus) return false;
      if (filterMP !== 'semua' && t.marketplace !== filterMP) return false;
      if (searchSku && !t.sku.toLowerCase().includes(searchSku.toLowerCase()) &&
        !t.namaProduk.toLowerCase().includes(searchSku.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterStatus, filterMP, searchSku]);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    doing: tasks.filter(t => t.status === 'doing').length,
    done: tasks.filter(t => t.status === 'done').length,
    skipped: tasks.filter(t => t.status === 'skipped').length,
  }), [tasks]);

  /* ── Performance metrics ── */
  const performaUsers = useMemo(() => {
    const map = new Map<string, {
      nama: string;
      totalDone: number;
      totalSkipped: number;
      tasks: PriceTask[];
    }>();

    for (const t of tasks) {
      if (t.status === 'done' || t.status === 'skipped') {
        const name = t.completedBy || t.assignedTo || 'Unknown';
        if (!map.has(name)) {
          map.set(name, { nama: name, totalDone: 0, totalSkipped: 0, tasks: [] });
        }
        const entry = map.get(name)!;
        if (t.status === 'done') entry.totalDone++;
        else entry.totalSkipped++;
        entry.tasks.push(t);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalDone - a.totalDone);
  }, [tasks]);

  const historyStats = useMemo(() => {
    const total = history.length;
    const today = history.filter(h => h.tanggal === todayISO()).length;
    const byUser = new Map<string, number>();
    history.forEach(h => {
      byUser.set(h.diubahOleh, (byUser.get(h.diubahOleh) || 0) + 1);
    });
    return { total, today, byUser: Array.from(byUser.entries()).sort((a, b) => b[1] - a[1]) };
  }, [history]);

  /* ── Delete confirm ── */
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📋 Task Perubahan Harga Jual</h2>
          <p className="text-sm text-slate-500">
            {stats.todo} menunggu • {stats.doing} dikerjakan • {stats.done} selesai
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const count = generateTasks();
              if (count === 0) alert('✅ Tidak ada task baru. Semua harga sudah sinkron.');
              else alert(`✅ ${count} task baru berhasil dibuat!`);
            }}
            className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-300 transition"
            title="Scan ulang semua SKU (manual)"
          >
            🔍 Scan Semua SKU
          </button>
        </div>
      </div>

      {/* Info: task auto-generated saat save SKU */}
      <div className="mt-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
        💡 <strong>Task otomatis dibuat</strong> setiap kali kamu menyimpan SKU di tab Master SKU. 
        Cukup edit harga jual di Master SKU → task langsung muncul di sini untuk tiap toko marketplace.
      </div>

      {/* ── View Mode Tabs ── */}
      <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {([
          { key: 'tasks', label: '📋 Daftar Task', count: stats.todo + stats.doing },
          { key: 'history', label: '📜 Riwayat Harga', count: historyStats.total },
          { key: 'performa', label: '📊 Performa User', count: performaUsers.length },
        ] as const).map(m => (
          <button
            key={m.key}
            onClick={() => setViewMode(m.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${viewMode === m.key
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            {m.label}
            {m.count > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                {m.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ================================================================ */}
      {/* TASK LIST VIEW                                                   */}
      {/* ================================================================ */}
      {viewMode === 'tasks' && (
        <>
          {/* Stats cards */}
          <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: 'Menunggu', value: stats.todo, color: 'bg-amber-50 text-amber-700', border: 'border-amber-200' },
              { label: 'Dikerjakan', value: stats.doing, color: 'bg-blue-50 text-blue-700', border: 'border-blue-200' },
              { label: 'Selesai', value: stats.done, color: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200' },
              { label: 'Dilewati', value: stats.skipped, color: 'bg-slate-50 text-slate-500', border: 'border-slate-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border ${s.border} ${s.color} p-3 text-center`}>
                <p className="text-xl font-bold sm:text-2xl">{s.value}</p>
                <p className="text-[10px] font-semibold sm:text-xs">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={searchSku}
              onChange={e => setSearchSku(e.target.value)}
              placeholder="🔍 Cari SKU / Produk..."
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none sm:max-w-[200px]"
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600"
            >
              <option value="semua">📋 Semua Status</option>
              <option value="todo">🟡 Menunggu</option>
              <option value="doing">🔵 Dikerjakan</option>
              <option value="done">🟢 Selesai</option>
              <option value="skipped">⚪ Dilewati</option>
            </select>
            <select
              value={filterMP}
              onChange={e => setFilterMP(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600"
            >
              <option value="semua">🛒 Semua Marketplace</option>
              {marketplaces.map(mp => (
                <option key={mp} value={mp}>{mp}</option>
              ))}
            </select>
          </div>

          {/* Task list */}
          <div className="mt-3 space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
                <p className="text-4xl">📋</p>
                <p className="mt-2 text-sm text-slate-400">
                  {tasks.length === 0
                    ? 'Belum ada task. Edit & simpan SKU di tab Master SKU, task akan otomatis muncul di sini.'
                    : 'Tidak ada task dengan filter ini.'}
                </p>
                {tasks.length === 0 && (
                  <button
                    onClick={() => {
                      const count = generateTasks();
                      if (count === 0) alert('✅ Semua harga sudah sinkron. Tidak ada task baru.');
                      else alert(`✅ ${count} task berhasil dibuat!`);
                    }}
                    className="mt-3 rounded-xl bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    🔍 Scan Semua SKU Sekarang
                  </button>
                )}
              </div>
            ) : (
              filteredTasks.map(task => (
                <div
                  key={task.id}
                  className={`rounded-xl border p-3 transition cursor-pointer hover:shadow-md ${task.status === 'todo'
                    ? 'border-amber-200 bg-amber-50/30'
                    : task.status === 'doing'
                      ? 'border-blue-200 bg-blue-50/30'
                      : task.status === 'done'
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : 'border-slate-200 bg-slate-50/30'
                    }`}
                  onClick={() => setDetailTask(task)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${task.status === 'todo'
                          ? 'bg-amber-100 text-amber-700'
                          : task.status === 'doing'
                            ? 'bg-blue-100 text-blue-700'
                            : task.status === 'done'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                          {task.status === 'todo' ? '🟡 MENUNGGU' : task.status === 'doing' ? '🔵 DIKERJAKAN' : task.status === 'done' ? '🟢 SELESAI' : '⚪ DILEWATI'}
                        </span>
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                          {task.marketplace}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(task.createdAt).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-800 truncate">
                        <span className="font-mono text-brand-600">{task.sku}</span> — {task.namaProduk}
                      </p>
                      <p className="text-xs text-slate-500">
                        🏪 {task.tokoNama} ({task.marketplace})
                      </p>
                      {task.assignedTo && (
                        <p className="text-xs text-slate-400">👤 {task.assignedTo}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">Harga Jual Lama</p>
                      {task.hargaJualLama > 0 ? (
                        <p className="text-sm font-semibold text-slate-500 line-through">
                          Rp {task.hargaJualLama.toLocaleString('id-ID')}
                        </p>
                      ) : (
                        <p className="text-xs font-semibold text-amber-500">⚠ Belum ada data</p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">Harga Baru (Master)</p>
                      <p className="text-sm font-bold text-emerald-600">
                        Rp {task.hargaJualBaru.toLocaleString('id-ID')}
                      </p>
                      {/* Selisih */}
                      {task.hargaJualLama > 0 && task.hargaJualBaru !== task.hargaJualLama && (
                        <p className={`text-[10px] font-bold mt-0.5 ${task.hargaJualBaru > task.hargaJualLama ? 'text-red-500' : 'text-emerald-500'}`}>
                          {task.hargaJualBaru > task.hargaJualLama ? '📈' : '📉'} Rp {Math.abs(task.hargaJualBaru - task.hargaJualLama).toLocaleString('id-ID')} ({((task.hargaJualBaru - task.hargaJualLama) / task.hargaJualLama * 100) >= 0 ? '+' : ''}{((task.hargaJualBaru - task.hargaJualLama) / task.hargaJualLama * 100).toFixed(1)}%)
                        </p>
                      )}
                      {task.hargaJualFinal && task.hargaJualFinal !== task.hargaJualBaru && (
                        <p className="text-xs text-amber-600">
                          Final: Rp {task.hargaJualFinal.toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 w-full sm:w-auto" onClick={e => e.stopPropagation()}>
                      {task.status === 'todo' && (
                        <button
                          onClick={() => startTask(task)}
                          className="rounded-lg bg-blue-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-600 transition"
                        >
                          ▶ Kerjakan
                        </button>
                      )}
                      {(task.status === 'todo' || task.status === 'doing') && (
                        <>
                          <button
                            onClick={() => openComplete(task)}
                            className="rounded-lg bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 transition"
                          >
                            ✅ Selesai
                          </button>
                          <button
                            onClick={() => skipTask(task)}
                            className="rounded-lg bg-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-400 transition"
                          >
                            ⏭ Lewati
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* HISTORY VIEW                                                     */}
      {/* ================================================================ */}
      {viewMode === 'history' && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <p className="text-2xl font-bold text-slate-700">{historyStats.total}</p>
              <p className="text-xs text-slate-500">Total Riwayat</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{historyStats.today}</p>
              <p className="text-xs text-emerald-500">Hari Ini</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{historyStats.byUser.length}</p>
              <p className="text-xs text-blue-500">User Aktif</p>
            </div>
          </div>

          <div className="mt-3 max-h-[500px] overflow-y-auto space-y-1.5">
            {history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
                <p className="text-4xl">📜</p>
                <p className="mt-2 text-sm text-slate-400">Belum ada riwayat perubahan harga.</p>
              </div>
            ) : (
              history.map(h => (
                <div key={h.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                          {h.marketplace}
                        </span>
                        <span className="font-mono text-[11px] text-brand-600 font-semibold">{h.sku}</span>
                        <span className="text-[11px] text-slate-600 truncate max-w-[200px]">{h.namaProduk}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        🏪 {h.tokoNama} • 👤 {h.diubahOleh} • 📅 {h.tanggal}
                        {h.sumber === 'task' && (
                          <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[10px] text-emerald-600">via Task</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <p className="text-[10px] text-slate-400">Lama</p>
                        <p className="text-xs text-slate-500 line-through">Rp {h.hargaJualLama.toLocaleString('id-ID')}</p>
                      </div>
                      <span className="text-slate-300">→</span>
                      <div>
                        <p className="text-[10px] text-slate-400">Baru</p>
                        <p className={`text-xs font-bold ${h.hargaJualBaru > h.hargaJualLama ? 'text-red-600' : h.hargaJualBaru < h.hargaJualLama ? 'text-emerald-600' : 'text-slate-600'}`}>
                          Rp {h.hargaJualBaru.toLocaleString('id-ID')}
                        </p>
                      </div>
                      {h.hargaJualLama > 0 && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${h.hargaJualBaru > h.hargaJualLama
                          ? 'bg-red-100 text-red-600'
                          : h.hargaJualBaru < h.hargaJualLama
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-slate-100 text-slate-500'
                          }`}>
                          {((h.hargaJualBaru - h.hargaJualLama) / h.hargaJualLama * 100) >= 0 ? '+' : ''}
                          {((h.hargaJualBaru - h.hargaJualLama) / h.hargaJualLama * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* PERFORMANCE VIEW                                                 */}
      {/* ================================================================ */}
      {viewMode === 'performa' && (
        <>
          <div className="mt-3 space-y-3">
            {performaUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
                <p className="text-4xl">📊</p>
                <p className="mt-2 text-sm text-slate-400">Belum ada data performa. Selesaikan beberapa task dulu.</p>
              </div>
            ) : (
              performaUsers.map((pu, idx) => (
                <div key={pu.nama} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white ${idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300'
                        }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{pu.nama}</p>
                        <p className="text-xs text-slate-500">
                          {pu.totalDone} selesai • {pu.totalSkipped} dilewati • Total {pu.totalDone + pu.totalSkipped} task
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">{pu.totalDone}</p>
                      <p className="text-xs text-slate-400">Task Selesai</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Completion Rate</span>
                      <span>{pu.totalDone + pu.totalSkipped > 0 ? Math.round(pu.totalDone / (pu.totalDone + pu.totalSkipped) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                        style={{ width: `${pu.totalDone + pu.totalSkipped > 0 ? Math.round(pu.totalDone / (pu.totalDone + pu.totalSkipped) * 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Recent tasks by this user */}
                  {pu.tasks.length > 0 && (
                    <div className="mt-3 border-t pt-2">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Task Terakhir:</p>
                      <div className="space-y-1 max-h-[120px] overflow-y-auto">
                        {pu.tasks.slice(-5).reverse().map(t => (
                          <div key={t.id} className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-slate-500">{t.sku}</span>
                            <span className="text-slate-400">{t.marketplace} — {t.tokoNama}</span>
                            <span className={t.status === 'done' ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                              {t.status === 'done' ? '✅' : '⏭'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* History by user summary */}
          {historyStats.byUser.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-2">📈 Total Perubahan Harga per User (All Time)</h3>
              <div className="space-y-2">
                {historyStats.byUser.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{name}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-emerald-100 overflow-hidden" style={{ width: `${Math.min(count * 20, 200)}px` }}>
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: '100%' }} />
                      </div>
                      <span className="text-sm font-bold text-emerald-700">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/* DETAIL MODAL                                                     */}
      {/* ================================================================ */}
      {detailTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold text-slate-800">📋 Detail Task</p>
              <button onClick={() => setDetailTask(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Status', detailTask.status === 'todo' ? '🟡 Menunggu' : detailTask.status === 'doing' ? '🔵 Dikerjakan' : detailTask.status === 'done' ? '🟢 Selesai' : '⚪ Dilewati'],
                  ['SKU', detailTask.sku],
                  ['Produk', detailTask.namaProduk],
                  ['Marketplace', detailTask.marketplace],
                  ['Toko', detailTask.tokoNama],
                  ['Harga Beli Saat Ini', `Rp ${detailTask.hargaBeliSaatIni.toLocaleString('id-ID')}`],
                  ['Harga Jual Lama', detailTask.hargaJualLama > 0 ? `Rp ${detailTask.hargaJualLama.toLocaleString('id-ID')}` : '⚠ Belum ada data'],
                  ['Harga Baru (Master)', `Rp ${detailTask.hargaJualBaru.toLocaleString('id-ID')}`],
                  detailTask.hargaJualLama > 0 && detailTask.hargaJualBaru !== detailTask.hargaJualLama
                    ? ['Selisih', `${detailTask.hargaJualBaru > detailTask.hargaJualLama ? '📈 +' : '📉 '}Rp ${Math.abs(detailTask.hargaJualBaru - detailTask.hargaJualLama).toLocaleString('id-ID')} (${((detailTask.hargaJualBaru - detailTask.hargaJualLama) / detailTask.hargaJualLama * 100) >= 0 ? '+' : ''}${((detailTask.hargaJualBaru - detailTask.hargaJualLama) / detailTask.hargaJualLama * 100).toFixed(1)}%)`]
                    : null,
                  ['Dibuat', new Date(detailTask.createdAt).toLocaleString('id-ID')],
                  ['Assigned To', detailTask.assignedTo || '-'],
                  ['Diselesaikan Oleh', detailTask.completedBy || '-'],
                  ['Harga Final', detailTask.hargaJualFinal ? `Rp ${detailTask.hargaJualFinal.toLocaleString('id-ID')}` : '-'],
                  ['Catatan', detailTask.catatan || '-'],
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label as string} className="flex flex-col">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className="font-medium text-slate-800 text-xs">{val}</span>
                  </div>
                ))}
              </div>

              {/* Related history */}
              {(() => {
                const relatedHistory = history.filter(
                  h => h.sku === detailTask.sku && h.marketplace === detailTask.marketplace && h.tokoNama === detailTask.tokoNama
                );
                if (relatedHistory.length === 0) return null;
                return (
                  <div className="border-t pt-3">
                    <p className="text-xs font-bold text-slate-600 mb-1">📜 Riwayat Harga SKU Ini di Toko Ini:</p>
                    <div className="space-y-1 max-h-[150px] overflow-y-auto">
                      {relatedHistory.map(h => (
                        <div key={h.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-[11px]">
                          <span className="text-slate-500">{h.tanggal}</span>
                          <span className="text-slate-400">Rp {h.hargaJualLama.toLocaleString('id-ID')} →</span>
                          <span className="font-semibold">Rp {h.hargaJualBaru.toLocaleString('id-ID')}</span>
                          <span className="text-slate-400">{h.diubahOleh}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              {detailTask.status === 'todo' && (
                <button
                  onClick={() => { startTask(detailTask); setDetailTask(null); }}
                  className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                >
                  ▶ Kerjakan
                </button>
              )}
              {(detailTask.status === 'todo' || detailTask.status === 'doing') && (
                <button
                  onClick={() => { openComplete(detailTask); setDetailTask(null); }}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  ✅ Selesaikan
                </button>
              )}
              <button
                onClick={() => setDetailTask(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* COMPLETE FORM MODAL                                              */}
      {/* ================================================================ */}
      {completeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl mx-4">
            <p className="text-lg font-bold text-slate-800">✅ Selesaikan Task</p>
            <p className="mt-1 text-xs text-slate-500">
              {completeForm.task.sku} — {completeForm.task.namaProduk}
            </p>
            <p className="text-xs text-slate-400">
              🏪 {completeForm.task.tokoNama} ({completeForm.task.marketplace})
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Harga Jual Lama</span>
                  {completeForm.task.hargaJualLama > 0 ? (
                    <span className="text-slate-500 line-through">Rp {completeForm.task.hargaJualLama.toLocaleString('id-ID')}</span>
                  ) : (
                    <span className="text-amber-500 font-semibold">⚠ Belum ada data</span>
                  )}
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-slate-500">Harga Beli Saat Ini</span>
                  <span className="font-semibold text-slate-700">Rp {completeForm.task.hargaBeliSaatIni.toLocaleString('id-ID')}</span>
                </div>
                {completeForm.task.hargaJualLama > 0 && completeForm.task.hargaJualBaru !== completeForm.task.hargaJualLama && (
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-slate-500">Selisih</span>
                    <span className={`font-bold ${completeForm.task.hargaJualBaru > completeForm.task.hargaJualLama ? 'text-red-500' : 'text-emerald-500'}`}>
                      {completeForm.task.hargaJualBaru > completeForm.task.hargaJualLama ? '📈 +' : '📉 '}
                      Rp {Math.abs(completeForm.task.hargaJualBaru - completeForm.task.hargaJualLama).toLocaleString('id-ID')}
                      ({((completeForm.task.hargaJualBaru - completeForm.task.hargaJualLama) / completeForm.task.hargaJualLama * 100) >= 0 ? '+' : ''}
                      {((completeForm.task.hargaJualBaru - completeForm.task.hargaJualLama) / completeForm.task.hargaJualLama * 100).toFixed(1)}%)
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-emerald-600 font-semibold">💰 Master SKU (hargaJual)</span>
                  <span className="font-bold text-emerald-600">Rp {completeForm.task.hargaJualBaru.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Harga Jual Final (Rp)</span>
                <input
                  type="number"
                  value={completeForm.hargaFinal}
                  onChange={e => setCompleteForm({ ...completeForm, hargaFinal: e.target.value })}
                  className="rounded-xl border px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  autoFocus
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Catatan</span>
                <input
                  type="text"
                  value={completeForm.catatan}
                  onChange={e => setCompleteForm({ ...completeForm, catatan: e.target.value })}
                  placeholder="Opsional..."
                  className="rounded-xl border px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCompleteForm(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Batal
              </button>
              <button
                onClick={completeTask}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                ✅ Simpan & Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-bold text-slate-800">🗑️ Hapus Task</p>
            <p className="mt-2 text-sm text-slate-600">Yakin hapus task ini? Data history tidak akan terpengaruh.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={() => { deleteTask(deleteId); setDeleteId(null); }} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
