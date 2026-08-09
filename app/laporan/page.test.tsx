import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LaporanPage from './page';
import { Providers } from '@/app/providers';

const renderWithProviders = (ui: React.ReactElement) => render(<Providers>{ui}</Providers>);

describe('LaporanPage', () => {
  it('renders header and selectors', () => {
    renderWithProviders(<LaporanPage />);
    expect(screen.getByText('Laporan')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /laba rugi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /arus kas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stok/i })).toBeInTheDocument();
  });

  it('shows Laba Rugi by default', async () => {
    renderWithProviders(<LaporanPage />);
    await waitFor(() => {
      expect(screen.getByText('Pendapatan Kotor')).toBeInTheDocument();
      expect(screen.getByText(/Laba Bersih/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('switches to Arus Kas', async () => {
    renderWithProviders(<LaporanPage />);
    fireEvent.click(screen.getByRole('button', { name: /arus kas/i }));
    await waitFor(() => {
      expect(screen.getByText('Saldo Awal')).toBeInTheDocument();
      expect(screen.getByText('Saldo Akhir')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('switches to Laporan Stok', async () => {
    renderWithProviders(<LaporanPage />);
    fireEvent.click(screen.getByRole('button', { name: /📦 Stok/i }));
    await waitFor(() => {
      expect(screen.getByText('Total Item')).toBeInTheDocument();
      expect(screen.getByText('Total Nilai Inventaris')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
