import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LaporanPage from './page';

describe('LaporanPage', () => {
  it('renders header and selectors', () => {
    render(<LaporanPage />);
    expect(screen.getByText('Laporan')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /laba rugi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /arus kas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stok/i })).toBeInTheDocument();
  });

  it('shows Laba Rugi by default', () => {
    render(<LaporanPage />);
    expect(screen.getByText('Laba Kotor')).toBeInTheDocument();
    expect(screen.getByText('Laba Bersih')).toBeInTheDocument();
  });

  it('switches to Arus Kas', () => {
    render(<LaporanPage />);
    fireEvent.click(screen.getByRole('button', { name: /arus kas/i }));
    expect(screen.getByText('Saldo Awal')).toBeInTheDocument();
    expect(screen.getByText('Saldo Akhir')).toBeInTheDocument();
  });

  it('switches to Laporan Stok', () => {
    render(<LaporanPage />);
    fireEvent.click(screen.getByRole('button', { name: /📦 Stok/i }));
    expect(screen.getByText('Total Item')).toBeInTheDocument();
    expect(screen.getByText('Total Nilai Inventaris')).toBeInTheDocument();
  });
});
