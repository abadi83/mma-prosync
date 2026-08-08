export interface StockItem {
  name: string;
  stock: number;
  minStock: number;
  category: string;
}

export interface StockSummaryData {
  totalItems: number;
  lowStockCount: number;
  items: StockItem[];
}

export interface SalesSummaryData {
  today: number;
  transactions: number;
  trend: 'up' | 'down';
}

export interface Shortcut {
  title: string;
  category: string;
  description: string;
  href: string;
}

export interface DashboardData {
  stockSummary: StockSummaryData;
  salesSummary: SalesSummaryData;
  shortcuts: Shortcut[];
}

/* ── Bukti Bayar (Finance) ── */
export interface BuktiBayar {
  id: string;
  paymentId: string;       // link ke PaymentRecord.id
  noPO: string;
  supplierNama: string;
  jumlah: number;
  nomorRef: string;
  tanggalBayar: string;
  imageBase64: string;     // gambar bukti transfer (data URL)
  ocrRawText: string;      // hasil OCR mentah
  createdAt: string;
}

export interface OcrResult {
  nomorRef: string;
  jumlah: number | null;
  tanggal: string;
  namaBank: string;
  rawText: string;
}
