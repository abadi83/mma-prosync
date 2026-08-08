'use client';

import React, { useState, useRef, useCallback } from 'react';
import { exportToCSV } from '@/app/lib/exportCsv';

/* ================================================================ */
/* Types                                                             */
/* ================================================================ */
export interface InvoicePOItem {
  sku: string;
  namaSku: string;
  qty: number;
  hargaBeli: number;
  subtotal: number;
}

export interface InvoicePOData {
  noPO: string;
  supplierNama: string;
  supplierKontak?: string;
  supplierAlamat?: string;
  tanggal: string;
  metodeBayar: string;
  items: InvoicePOItem[];
  total: number;
  dibayar: number;
  sisa: number;
  lunas: boolean;
  jatuhTempo?: string;
  catatan?: string;
}

/* ================================================================ */
/* Helpers                                                           */
/* ================================================================ */
function formatTanggal(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d} ${bulan[+m - 1] || ''} ${y}`;
}

function formatRupiah(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function generateWhatsAppText(data: InvoicePOData, tokoNama: string): string {
  const lines = [
    `📋 *INVOICE PURCHASE ORDER*`,
    `━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🏬 Dari: *${tokoNama}*`,
    `🏭 Ke: *${data.supplierNama}*`,
    ``,
    `📄 No PO: *${data.noPO}*`,
    `📅 Tanggal: ${formatTanggal(data.tanggal)}`,
    `💳 Metode: ${data.metodeBayar}`,
    ``,
    `📦 *Daftar Barang:*`,
    ...data.items.map((item, i) =>
      `${i + 1}. ${item.namaSku} (${item.sku})\n   ${item.qty} × ${formatRupiah(item.hargaBeli)} = ${formatRupiah(item.subtotal)}`
    ),
    ``,
    `💰 *Total: ${formatRupiah(data.total)}*`,
  ];

  if (data.dibayar > 0) {
    lines.push(`✅ Dibayar: ${formatRupiah(data.dibayar)}`);
    if (data.sisa > 0) lines.push(`⚠️ Sisa: ${formatRupiah(data.sisa)}`);
  }
  if (data.jatuhTempo) lines.push(`📆 Jatuh Tempo: ${formatTanggal(data.jatuhTempo)}`);
  if (data.catatan) lines.push(`📝 Catatan: ${data.catatan}`);

  lines.push(``, `🙏 Terima kasih atas kerjasamanya.`, `Mohon konfirmasi pesanan ini.`);

  return lines.join('\n');
}

function generateCSVData(data: InvoicePOData): { headers: string[]; rows: string[][] } {
  const headers = ['No PO', 'Tanggal', 'Supplier', 'SKU', 'Nama Barang', 'Qty', 'Harga Beli', 'Subtotal', 'Metode Bayar', 'Status', 'Jatuh Tempo'];
  const rows = data.items.map(item => [
    data.noPO,
    data.tanggal,
    data.supplierNama,
    item.sku,
    item.namaSku,
    String(item.qty),
    String(item.hargaBeli),
    String(item.subtotal),
    data.metodeBayar,
    data.lunas ? 'Lunas' : 'Belum Lunas',
    data.jatuhTempo || '-',
  ]);
  // Tambah row total
  rows.push(['', '', '', '', 'TOTAL', '', '', String(data.total), '', '', '']);
  return { headers, rows };
}

/* ================================================================ */
/* Invoice Preview Component (untuk capture gambar)                  */
/* ================================================================ */
interface InvoicePreviewProps {
  data: InvoicePOData;
  tokoNama?: string;
}

export function InvoicePreview({ data, tokoNama = 'MMA ProSync' }: InvoicePreviewProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 max-w-[600px] mx-auto" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="border-b-2 border-indigo-500 pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-indigo-700">{tokoNama}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Purchase Order / Invoice</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-mono font-bold text-slate-800">{data.noPO}</p>
            <p className="text-xs text-slate-400">{formatTanggal(data.tanggal)}</p>
          </div>
        </div>
      </div>

      {/* Supplier Info */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Supplier</p>
          <p className="font-semibold text-slate-800">{data.supplierNama}</p>
          {data.supplierKontak && <p className="text-xs text-slate-500">{data.supplierKontak}</p>}
          {data.supplierAlamat && <p className="text-xs text-slate-400">{data.supplierAlamat}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Metode Bayar</p>
          <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">{data.metodeBayar}</span>
          {data.jatuhTempo && (
            <p className="text-xs text-red-500 mt-1">Jatuh Tempo: {formatTanggal(data.jatuhTempo)}</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="border-b-2 border-slate-200 text-xs uppercase text-slate-400">
            <th className="py-2 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Barang</th>
            <th className="py-2 text-center font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Harga</th>
            <th className="py-2 text-right font-semibold">Subtotal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.items.map((item, i) => (
            <tr key={i}>
              <td className="py-2 text-xs text-slate-400">{i + 1}</td>
              <td className="py-2">
                <span className="font-mono text-xs text-indigo-600">{item.sku}</span>
                <span className="text-xs text-slate-600 ml-2">{item.namaSku}</span>
              </td>
              <td className="py-2 text-center text-xs font-semibold">{item.qty}</td>
              <td className="py-2 text-right text-xs">{formatRupiah(item.hargaBeli)}</td>
              <td className="py-2 text-right text-xs font-semibold">{formatRupiah(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300">
            <td colSpan={4} className="py-2 text-right text-sm font-bold text-slate-700">TOTAL</td>
            <td className="py-2 text-right text-sm font-bold text-indigo-700">{formatRupiah(data.total)}</td>
          </tr>
          {data.dibayar > 0 && (
            <>
              <tr>
                <td colSpan={4} className="py-1 text-right text-xs text-emerald-600">Dibayar</td>
                <td className="py-1 text-right text-xs font-semibold text-emerald-600">{formatRupiah(data.dibayar)}</td>
              </tr>
              {data.sisa > 0 && (
                <tr>
                  <td colSpan={4} className="py-1 text-right text-xs text-red-500">Sisa</td>
                  <td className="py-1 text-right text-xs font-semibold text-red-500">{formatRupiah(data.sisa)}</td>
                </tr>
              )}
            </>
          )}
        </tfoot>
      </table>

      {/* Footer */}
      <div className="border-t border-slate-200 pt-3 text-center">
        <p className="text-xs text-slate-400">Terima kasih atas kerjasamanya 🤝</p>
        {data.lunas && (
          <span className="inline-block mt-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-700">✅ LUNAS</span>
        )}
      </div>
    </div>
  );
}

/* ================================================================ */
/* Main Export Component with Actions                                */
/* ================================================================ */
interface InvoiceExportProps {
  data: InvoicePOData;
  tokoNama?: string;
  supplierWa?: string; // nomor WA supplier (format: 628xxx)
  onClose?: () => void;
  /** Jika true, tombol "Simpan ke Arsip Lunas" muncul */
  isLunas?: boolean;
}

export default function InvoiceExport({ data, tokoNama = 'MMA ProSync', supplierWa, onClose, isLunas }: InvoiceExportProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const waText = generateWhatsAppText(data, tokoNama);

  /* ── Copy text ── */
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(waText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text manually
      const el = document.createElement('textarea');
      el.value = waText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /* ── WhatsApp via wa.me ── */
  const handleOpenWA = () => {
    const phone = supplierWa || ''; // tanpa nomor, buka WA tanpa target
    const encoded = encodeURIComponent(waText);
    const url = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* ── Download CSV ── */
  const handleDownloadCSV = () => {
    const { headers, rows } = generateCSVData(data);
    const filename = `Invoice_${data.noPO}_${data.supplierNama.replace(/[^a-zA-Z0-9]/g, '_')}`;
    exportToCSV(filename, headers, rows);
  };

  /* ── Print Invoice ── */
  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = `Invoice_${data.noPO}_${data.supplierNama.replace(/[^a-zA-Z0-9]/g, '_')}`;
    setShowPreview(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => { document.title = prevTitle; }, 500);
    }, 300);
  };

  /* ── Capture image (via canvas) ── */
  const handleCaptureImage = useCallback(async () => {
    if (!invoiceRef.current) return;
    try {
      // Gunakan html-to-image via dynamic import untuk ukuran bundle
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(invoiceRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      // Trigger download
      const link = document.createElement('a');
      link.download = `Invoice_${data.noPO}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Fallback: buka print dialog
      window.print();
    }
  }, [data.noPO]);

  return (
    <div className="space-y-3">
      {/* Preview (hidden until needed for print/capture) */}
      <div className={`${showPreview ? '' : 'fixed left-[-9999px] top-0'}`} ref={invoiceRef}>
        <InvoicePreview data={data} tokoNama={tokoNama} />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* WhatsApp */}
        <button
          onClick={handleOpenWA}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-green-500 px-3 py-2 text-xs font-semibold text-white hover:bg-green-600 transition"
          title="Buka WhatsApp dengan teks invoice"
        >
          <span>💬</span> WhatsApp
        </button>

        {/* Copy Text */}
        <button
          onClick={handleCopyText}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
            copied ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          title="Salin teks invoice ke clipboard"
        >
          <span>{copied ? '✅' : '📋'}</span> {copied ? 'Tersalin!' : 'Copy Teks'}
        </button>

        {/* CSV */}
        <button
          onClick={handleDownloadCSV}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-200 transition"
          title="Download invoice sebagai CSV"
        >
          <span>📥</span> CSV
        </button>

        {/* Image / Print */}
        <button
          onClick={handleCaptureImage}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-purple-100 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-200 transition"
          title="Download invoice sebagai gambar PNG"
        >
          <span>🖼️</span> Gambar
        </button>
      </div>

      {/* Lunas indicator */}
      {isLunas && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 flex items-center gap-1.5">
          <span>✅</span> PO ini sudah <strong>Lunas</strong> — invoice otomatis tersimpan di <strong>Arsip Invoice</strong> tab.
        </div>
      )}

      {/* Tips */}
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-400 leading-relaxed">
        💡 <strong>Tips kirim ke Supplier:</strong> Klik <strong>Copy Teks</strong> lalu paste di WhatsApp,
        atau klik <strong>WhatsApp</strong> untuk langsung buka. Download <strong>CSV</strong> untuk data Excel,
        atau <strong>Gambar</strong> untuk invoice siap kirim.
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
        >
          Tutup
        </button>
      )}
    </div>
  );
}
