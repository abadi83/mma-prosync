import React from 'react';
import { render, screen } from '@testing-library/react';
import { ArusKasReport } from './ArusKasReport';

const mockData = {
  saldoAwal: 5000000,
  pemasukan: [
    { sumber: 'Penjualan', jumlah: 8450000 },
  ],
  pengeluaran: [
    { sumber: 'Pembelian Stok', jumlah: 4200000 },
  ],
};

describe('ArusKasReport', () => {
  it('renders with period', () => {
    render(<ArusKasReport data={mockData} periode="Bulan Ini" />);
    expect(screen.getByText(/Laporan Arus Kas/)).toBeInTheDocument();
    expect(screen.getByText(/Bulan Ini/)).toBeInTheDocument();
  });

  it('shows saldo awal and akhir', () => {
    render(<ArusKasReport data={mockData} periode="Bulan Ini" />);
    const awal = screen.getAllByText(/Saldo Awal/);
    const akhir = screen.getAllByText(/Saldo Akhir/);
    expect(awal.length).toBeGreaterThanOrEqual(1);
    expect(akhir.length).toBeGreaterThanOrEqual(1);
  });

  it('shows arus kas bersih', () => {
    render(<ArusKasReport data={mockData} periode="Bulan Ini" />);
    expect(screen.getByText('Arus Kas Bersih')).toBeInTheDocument();
  });
});
