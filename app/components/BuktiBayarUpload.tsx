'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { OcrResult } from '@/app/types';

/* ================================================================ */
/* Props                                                             */
/* ================================================================ */
interface BuktiBayarUploadProps {
  onOcrResult: (result: OcrResult) => void;
  onImageReady: (base64: string) => void;
  existingImage?: string; // untuk preview gambar yang sudah ada
}

/* ================================================================ */
/* Pola regex untuk ekstraksi dari teks OCR                          */
/* ================================================================ */
const PATTERNS = {
  // No referensi: pola umum bank transfer (SN, REF, TRX, dll)
  nomorRef: [
    /(?:REF|SN|TRX|NO[.\s]*REF|REF[.\s]*NO|NO[.\s]*TRANSAKSI|TRANSACTION[.\s]*ID)[:\s#]*([A-Za-z0-9\-\/]{6,30})/i,
    /(?:REFERENSI|NOMOR[.\s]*REFERENSI|NO[.\s]*REF)[:\s#]*([A-Za-z0-9\-\/]{6,30})/i,
    /(\d{10,20})/, // fallback: angka panjang
  ],
  // Jumlah: cari nominal Rp
  jumlah: [
    /(?:Rp|IDR)[\s.]*([\d.,]+)/gi,
    /(?:TOTAL|JUMLAH|NOMINAL|AMOUNT)[:\s]*[Rr]?[Pp]?[\s.]*([\d.,]+)/gi,
  ],
  // Tanggal
  tanggal: [
    /(\d{2}[-/]\d{2}[-/]\d{4})/,
    /(\d{4}[-/]\d{2}[-/]\d{2})/,
    /(?:TANGGAL|TGL|DATE)[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})/i,
  ],
  // Nama Bank
  namaBank: [
    /(?:BCA|BNI|BRI|MANDIRI|CIMB[.\s]*NIAGA|BTN|DANAMON|PERMATA|BANK[.\s]*[A-Z]{2,})/gi,
  ],
};

function parseAmount(raw: string): number | null {
  // Bersihkan: hapus titik (ribuan), ganti koma desimal jadi titik
  const cleaned = raw.replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

function formatDateString(raw: string): string {
  // Normalisasi ke YYYY-MM-DD
  const d = raw.replace(/[\/]/g, '-');
  // Jika format DD-MM-YYYY, ubah ke YYYY-MM-DD
  const parts = d.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) return d; // sudah YYYY-MM-DD
    if (parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
    return `20${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YY
  }
  return d;
}

function extractFirstMatch(text: string, patterns: RegExp[]): string {
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      // Ambil group 1 jika ada, kalau tidak ambil full match
      const val = (m[1] || m[0]).trim();
      if (val && val.length >= 2) return val;
    }
  }
  return '';
}

function extractAllMatches(text: string, pattern: RegExp): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  // Reset lastIndex untuk regex global
  const p = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  while ((m = p.exec(text)) !== null) {
    const val = (m[1] || m[0]).trim();
    if (val && val.length >= 2 && !results.includes(val)) results.push(val);
  }
  return results;
}

/* ================================================================ */
/* Component                                                         */
/* ================================================================ */
export default function BuktiBayarUpload({ onOcrResult, onImageReady, existingImage }: BuktiBayarUploadProps) {
  const [image, setImage] = useState<string | null>(existingImage || null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrDone, setOcrDone] = useState(false);
  const [error, setError] = useState('');
  const [ocrPreview, setOcrPreview] = useState<OcrResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Gagal membaca file.'));
      reader.readAsDataURL(file);
    });

  const runOcr = useCallback(async (base64Url: string) => {
    setLoading(true);
    setOcrDone(false);
    setError('');
    setProgress(0);
    try {
      // Dynamic import tesseract.js agar tidak blocking bundle utama
      const Tesseract = (await import('tesseract.js')).default;

      const { data } = await Tesseract.recognize(base64Url, 'eng+ind', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round((m.progress || 0) * 100));
          }
        },
      });

      const rawText = data.text || '';
      if (!rawText.trim()) {
        setError('Tidak ada teks terbaca dari gambar. Silakan isi manual.');
        setLoading(false);
        return;
      }

      // Ekstraksi data
      const nomorRef = extractFirstMatch(rawText, PATTERNS.nomorRef);
      const jumlahMatches = extractAllMatches(rawText, PATTERNS.jumlah[0]);
      // Ambil nominal terbesar sebagai jumlah transaksi
      let jumlah: number | null = null;
      const amounts = jumlahMatches.map(parseAmount).filter((n): n is number => n !== null);
      if (amounts.length > 0) {
        // Pilih nominal yang paling masuk akal (bukan yang terkecil seperti biaya admin)
        jumlah = Math.max(...amounts);
      }
      const tanggalRaw = extractFirstMatch(rawText, PATTERNS.tanggal);
      const tanggal = tanggalRaw ? formatDateString(tanggalRaw) : '';
      const namaBank = extractFirstMatch(rawText, PATTERNS.namaBank);

      const result: OcrResult = {
        nomorRef,
        jumlah,
        tanggal,
        namaBank,
        rawText,
      };

      setOcrPreview(result);
      onOcrResult(result);
      setOcrDone(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal OCR';
      setError(`OCR gagal: ${msg}. Silakan isi manual.`);
    } finally {
      setLoading(false);
    }
  }, [onOcrResult]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Hanya file gambar yang didukung (JPEG/PNG/WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ukuran gambar maksimal 10 MB.');
      return;
    }
    setError('');
    try {
      const base64 = await toBase64(file);
      setImage(base64);
      onImageReady(base64);
      // Auto-run OCR
      await runOcr(base64);
    } catch {
      setError('Gagal membaca file gambar.');
    }
  }, [onImageReady, runOcr]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleFile(file);
          return;
        }
      }
    }
  }, [handleFile]);

  const resetImage = () => {
    setImage(null);
    setOcrDone(false);
    setOcrPreview(null);
    setError('');
    setProgress(0);
  };

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      <label className="block text-xs font-semibold text-slate-600">
        📸 Bukti Pembayaran (Transfer)
        <span className="ml-1 text-slate-400 font-normal">— upload screenshot, auto-baca OCR</span>
      </label>

      {/* Area upload / preview */}
      {!image ? (
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50/50"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-3xl">📤</span>
          <p className="text-sm font-medium text-slate-600">Klik / Drag & Drop / <kbd className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-mono">Ctrl+V</kbd> Paste</p>
          <p className="text-xs text-slate-400">JPEG, PNG, WebP — Maks 10 MB</p>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              📁 Pilih File
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
              className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              📷 Kamera
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div className="relative rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Bukti Bayar" className="w-full max-h-56 object-contain bg-slate-100" />
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              onClick={resetImage}
              className="rounded-full bg-red-500 p-1.5 text-white shadow hover:bg-red-600 text-xs"
              title="Hapus gambar"
            >
              ✕
            </button>
          </div>

          {/* Progress OCR */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-xl">
              <div className="bg-white rounded-xl px-4 py-3 text-center shadow-lg">
                <div className="animate-spin mx-auto mb-2 h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
                <p className="text-sm font-medium text-slate-700">Membaca bukti transfer...</p>
                <p className="text-xs text-slate-400 mt-0.5">{progress}%</p>
                <div className="mt-2 h-1.5 w-36 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Hasil OCR */}
          {ocrDone && ocrPreview && (
            <div className="border-t border-slate-100 bg-emerald-50/70 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <span>✅</span> Data Terbaca Otomatis:
              </p>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {ocrPreview.namaBank && (
                  <div><span className="text-slate-400">Bank:</span> <span className="font-mono font-medium text-slate-700">{ocrPreview.namaBank}</span></div>
                )}
                {ocrPreview.nomorRef && (
                  <div><span className="text-slate-400">No. Ref:</span> <span className="font-mono font-medium text-slate-700">{ocrPreview.nomorRef}</span></div>
                )}
                {ocrPreview.jumlah && (
                  <div><span className="text-slate-400">Jumlah:</span> <span className="font-mono font-semibold text-emerald-700">Rp {ocrPreview.jumlah.toLocaleString('id-ID')}</span></div>
                )}
                {ocrPreview.tanggal && (
                  <div><span className="text-slate-400">Tanggal:</span> <span className="font-mono font-medium text-slate-700">{ocrPreview.tanggal}</span></div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      {/* Petunjuk */}
      <p className="text-[10px] text-slate-400 leading-relaxed">
        💡 Tips: Screenshot halaman konfirmasi transfer dari mobile banking Anda. Sistem akan otomatis membaca No. Referensi, jumlah, dan tanggal. Anda juga bisa <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono">Ctrl+V</kbd> paste langsung dari clipboard.
      </p>
    </div>
  );
}
