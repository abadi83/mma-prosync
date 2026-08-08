import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LaporanStokReport } from './LaporanStokReport';

const mockData = {
  totalItem: 3,
  totalNilai: 500000,
  items: [
    { nama: 'Kopi', stok: 10, nilai: 200000, kategori: 'Minuman' },
    { nama: 'Gula', stok: 20, nilai: 300000, kategori: 'Sembako' },
  ],
};

describe('LaporanStokReport', () => {
  it('renders with period and summary', () => {
    render(<LaporanStokReport data={mockData} periode="Bulan Ini" />);
    expect(screen.getByText(/Laporan Stok/)).toBeInTheDocument();
    expect(screen.getByText('Total Item')).toBeInTheDocument();
    expect(screen.getByText('Total Nilai Inventaris')).toBeInTheDocument();
  });

  it('shows all items in table', () => {
    render(<LaporanStokReport data={mockData} periode="Bulan Ini" />);
    expect(screen.getByText('Kopi')).toBeInTheDocument();
    expect(screen.getByText('Gula')).toBeInTheDocument();
  });

  it('filters by search', () => {
    render(<LaporanStokReport data={mockData} periode="Bulan Ini" />);
    fireEvent.change(screen.getByPlaceholderText('🔍 Cari produk...'), {
      target: { value: 'Kopi' },
    });
    expect(screen.getByText('Kopi')).toBeInTheDocument();
    expect(screen.queryByText('Gula')).not.toBeInTheDocument();
  });
});
