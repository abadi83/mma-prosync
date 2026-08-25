'use client';

/** Utils kompresi gambar client-side (canvas) — dipakai untuk bukti bayar, nota PO, dsb.
 *  Tujuan: foto dari HP jangan disimpan ukuran penuh (3-8MB) ke localStorage/sync,
 *  cukup ~100-300KB dengan kualitas tetap terbaca (termasuk untuk OCR). */

export function downscaleDataUrl(
  dataUrl: string,
  maxW = 1600,
  maxH = 1600,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.width;
          let h = img.height;
          if (w > maxW) { h = (h * maxW) / w; w = maxW; }
          if (h > maxH) { w = (w * maxH) / h; h = maxH; }
          // Kalau sudah kecil, kembalikan apa adanya (hindari re-encode)
          if (Math.round(w) >= img.width && Math.round(h) >= img.height) { resolve(dataUrl); return; }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w));
          canvas.height = Math.max(1, Math.round(h));
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch { resolve(dataUrl); }
  });
}

export function compressImageFile(
  file: File,
  maxW = 1600,
  maxH = 1600,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      downscaleDataUrl(String(reader.result), maxW, maxH, quality)
        .then(resolve)
        .catch(reject);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}
