'use client';

import React, { useState } from 'react';
import { useSkus } from '@/app/context/SkuContext';

const KOREKSI_STORAGE = 'mma_koreksi_po';

interface KoreksiPOItem {
  id: string;
  noPO: string;
  sku: string;
  namaSku: string;
  qty: number;
  supplierNama: string;
  jenisKoreksi: 'salah_datang' | 'tidak_datang' | 'rusak' | 'tidak_lengkap';
  catatan: string;
  status: 'pending' | 'retur' | 'tukar' | 'selesai';
  diajukanOleh: string;
  diajukanPada: string;
  diprosesPada?: string;
  stokDikurangi?: boolean; // penanda stok inventory sudah dikoreksi (hindari dobel)
}

const JENIS_LABEL: Record<string, string> = {
  salah_datang: '❌ Barang Salah Datang',
  tidak_datang: '🚫 Barang Tidak Datang',
  rusak: '💔 Barang Rusak / Tidak Sesuai',
  tidak_lengkap: '📉 Barang Tidak Lengkap',
};

export default function KoreksiPOTab() {
  const { updateStok } = useSkus();
  const [koreksiList, setKoreksiList] = useState<KoreksiPOItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const r = localStorage.getItem(KOREKSI_STORAGE); return r ? JSON.parse(r) : []; } catch { return []; }
  });

  const updateStatus = (id: string, status: KoreksiPOItem['status']) => {
    const item = koreksiList.find(k => k.id === id);
    // Koreksi stok inventory otomatis:
    // retur → barang balik ke supplier (stok turun)
    // tidak_datang + selesai → barang tak pernah sampai (stok yang sudah nambah dibalikin)
    const harusKurangi = !!item && !item.stokDikurangi &&
      (status === 'retur' || (status === 'selesai' && item.jenisKoreksi === 'tidak_datang'));

    const updated = koreksiList.map(k =>
      k.id === id ? { ...k, status, diprosesPada: new Date().toISOString(), ...(harusKurangi ? { stokDikurangi: true } : {}) } : k
    );
    setKoreksiList(updated);
    localStorage.setItem(KOREKSI_STORAGE, JSON.stringify(updated));
    try { window.dispatchEvent(new Event('koreksi-updated')); } catch {}

    // Kurangi stok Inventory otomatis (sekali saja per koreksi)
    if (harusKurangi && item) {
      updateStok(item.sku, -item.qty);
    }

    if (status === 'retur') {
      if (item) {
        try {
          const refunds = JSON.parse(localStorage.getItem('mma_koreksi_refund') || '[]');
          refunds.push({
            id: `refund-${Date.now()}`,
            koreksiId: id,
            noPO: item.noPO,
            supplierNama: item.supplierNama,
            sku: item.sku,
            namaSku: item.namaSku,
            qty: item.qty,
            tanggal: new Date().toISOString().slice(0, 10),
            status: 'menunggu_refund',
          });
          localStorage.setItem('mma_koreksi_refund', JSON.stringify(refunds));
          try { window.dispatchEvent(new Event('refund-updated')); } catch {}
        } catch {}
        alert(`↩️ Retur tercatat: ${item.noPO} — ${item.namaSku} ×${item.qty}\n📦 Stok Inventory otomatis dikurangi ${item.qty}.\n\n💰 Antrean refund otomatis masuk ke Keuangan → tab "Refund / Koreksi".\nDi sana: konfirmasi nilai refund & pilih masuk Kas Besar atau Kas Kecil.`);
      }
    } else if (status === 'selesai' && item?.jenisKoreksi === 'tidak_datang') {
      alert(`✅ Koreksi selesai: ${item.noPO} — ${item.namaSku} ×${item.qty}\n📦 Stok Inventory dikurangi ${item.qty} (barang tidak datang).`);
    }
  };

  const pending = koreksiList.filter(k => k.status === 'pending');
  const processed = koreksiList.filter(k => k.status !== 'pending');

  const statusBadge = (status: KoreksiPOItem['status']) => {
    const map: Record<string, string> = {
      pending: 'bg-red-100 text-red-700',
      retur: 'bg-amber-100 text-amber-700',
      tukar: 'bg-blue-100 text-blue-700',
      selesai: 'bg-emerald-100 text-emerald-700',
    };
    const label: Record<string, string> = {
      pending: '⏳ Pending',
      retur: '↩️ Retur (Refund)',
      tukar: '🔄 Tukar Barang',
      selesai: '✅ Selesai',
    };
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status]}`}>{label[status]}</span>;
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-red-500 to-red-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">⚠️ Koreksi PO</h2>
      <p className="mt-1 text-sm text-slate-500">Tindak lanjut koreksi dari Team Inventory. Retur (refund) atau tukar barang dengan Supplier.</p>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="rounded-xl bg-red-50 p-3 text-center"><p className="text-2xl font-bold text-red-600">{koreksiList.length}</p><p className="text-xs text-red-500">Total</p></div>
        <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-2xl font-bold text-amber-600">{pending.length}</p><p className="text-xs text-amber-500">Pending</p></div>
        <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-2xl font-bold text-blue-600">{koreksiList.filter(k => k.status === 'retur').length}</p><p className="text-xs text-blue-500">Retur</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-2xl font-bold text-emerald-600">{koreksiList.filter(k => k.status === 'selesai').length}</p><p className="text-xs text-emerald-500">Selesai</p></div>
      </div>

      {pending.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold text-red-700 mb-2">⏳ Perlu Tindak Lanjut ({pending.length})</p>
          <div className="space-y-2">
            {pending.map(k => (
              <div key={k.id} className="rounded-xl border-2 border-red-200 bg-red-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">
                      <span className="font-mono text-red-600">{k.noPO}</span> — {k.sku}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{k.namaSku} ×{k.qty} · {k.supplierNama}</p>
                    <p className="text-xs font-semibold text-red-600 mt-1">{JENIS_LABEL[k.jenisKoreksi] || k.jenisKoreksi}</p>
                    {k.catatan && <p className="text-xs text-slate-500 mt-0.5">📝 {k.catatan}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">Diajukan: {new Date(k.diajukanPada).toLocaleString('id-ID')} oleh {k.diajukanOleh}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => updateStatus(k.id, 'retur')}
                      className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                      title="Barang dikembalikan, uang direfund ke Finance">
                      ↩️ Retur
                    </button>
                    <button onClick={() => updateStatus(k.id, 'tukar')}
                      className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                      title="Barang ditukar oleh Supplier">
                      🔄 Tukar
                    </button>
                    <button onClick={() => updateStatus(k.id, 'selesai')}
                      className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">✅ Selesai</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {processed.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-slate-700 mb-2">📋 Riwayat ({processed.length})</p>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
                {['No PO','SKU','Nama','Qty','Jenis','Status','Supplier','Diproses'].map(c => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {processed.map(k => (
                  <tr key={k.id}>
                    <td className="px-3 py-2 font-mono text-[10px] text-indigo-600">{k.noPO}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{k.sku}</td>
                    <td className="px-3 py-2 text-slate-700">{k.namaSku}</td>
                    <td className="px-3 py-2 text-center">{k.qty}</td>
                    <td className="px-3 py-2 text-[10px]">{JENIS_LABEL[k.jenisKoreksi]}</td>
                    <td className="px-3 py-2">{statusBadge(k.status)}</td>
                    <td className="px-3 py-2 text-[10px]">{k.supplierNama}</td>
                    <td className="px-3 py-2 text-[10px] text-slate-400">{k.diprosesPada ? new Date(k.diprosesPada).toLocaleString('id-ID') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {koreksiList.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">Tidak ada koreksi PO</p>
          <p className="text-xs text-slate-400 mt-1">Koreksi muncul jika Inventory melaporkan masalah pada barang yang diterima.</p>
        </div>
      )}
    </div>
  );
}
