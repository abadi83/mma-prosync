interface CashItem { sumber: string; jumlah: number; }

export interface ArusKasResponse {
  saldoAwal: number;
  pemasukan: CashItem[];
  pengeluaran: CashItem[];
  totalMasuk: number;
  totalKeluar: number;
  saldoAkhir: number;
}

const MOCK: ArusKasResponse = {
  saldoAwal: 5000000,
  pemasukan: [
    { sumber: 'Penjualan', jumlah: 8450000 },
    { sumber: 'Piutang', jumlah: 1200000 },
  ],
  pengeluaran: [
    { sumber: 'Pembelian Stok', jumlah: 4200000 },
    { sumber: 'Operasional', jumlah: 1500000 },
    { sumber: 'Lain-lain', jumlah: 500000 },
  ],
  totalMasuk: 0,
  totalKeluar: 0,
  saldoAkhir: 0,
};

export async function getArusKas(_tokoId: string, _periode?: string): Promise<ArusKasResponse> {
  const totalMasuk = MOCK.pemasukan.reduce((s, i) => s + i.jumlah, 0);
  const totalKeluar = MOCK.pengeluaran.reduce((s, i) => s + i.jumlah, 0);
  return {
    ...MOCK,
    totalMasuk,
    totalKeluar,
    saldoAkhir: MOCK.saldoAwal + totalMasuk - totalKeluar,
  };
}
