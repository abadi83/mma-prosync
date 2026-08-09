import React from 'react';
import { render, screen } from '@testing-library/react';
import { LabaRugiReport } from './LabaRugiReport';

const mockData = {
  pendapatan: 8450000,
  hargaPokok: 5200000,
  biayaOperasional: 1200000,
  biayaLain: 350000,
  labaKotor: 3250000,
  labaBersih: 1700000,
};

describe('LabaRugiReport', () => {
  it('renders with period title', () => {
    render(<LabaRugiReport data={mockData} periode="Bulan Ini" />);
    expect(screen.getByText(/Laporan Laba Rugi/)).toBeInTheDocument();
    expect(screen.getByText(/Bulan Ini/)).toBeInTheDocument();
  });

  it('displays pendapatan and laba bersih', () => {
    render(<LabaRugiReport data={mockData} periode="Bulan Ini" />);
    expect(screen.getByText('Pendapatan Kotor')).toBeInTheDocument();
    expect(screen.getByText(/Laba Bersih/)).toBeInTheDocument();
  });

  it('shows margin percentages', () => {
    render(<LabaRugiReport data={mockData} periode="Bulan Ini" />);
    expect(screen.getByText('Margin Kotor')).toBeInTheDocument();
    expect(screen.getByText('Margin Bersih')).toBeInTheDocument();
  });
});
