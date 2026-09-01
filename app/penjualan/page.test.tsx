import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkuProvider } from '@/app/context/SkuContext';
import PenjualanPage from './page';

function renderWithProviders(ui: React.ReactElement) {
  return render(<SkuProvider>{ui}</SkuProvider>);
}

describe('PenjualanPage', () => {
  it('renders header and all tab buttons', () => {
    renderWithProviders(<PenjualanPage />);
    expect(screen.getByText('Penjualan')).toBeInTheDocument();
    expect(screen.getByText('Operasional')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /kasir/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /daftar transaksi/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ringkasan penjualan/i })).toBeInTheDocument();
  });

  it('shows Kasir with product catalog and cart', () => {
    renderWithProviders(<PenjualanPage />);
    expect(screen.getByText('🧾 Kasir')).toBeInTheDocument();
    expect(screen.getByText('🛒 Keranjang (0 item)')).toBeInTheDocument();
    expect(screen.getByText('Besi AS SENTAL ST-41 5mm x 6meter')).toBeInTheDocument();
  });

  it('adds product to cart on click', () => {
    renderWithProviders(<PenjualanPage />);
    fireEvent.click(screen.getByText('Besi AS SENTAL ST-41 5mm x 6meter'));
    expect(screen.getByText('🛒 Keranjang (1 item)')).toBeInTheDocument();
  });

  it('switches to Daftar Transaksi tab', () => {
    renderWithProviders(<PenjualanPage />);
    fireEvent.click(screen.getByRole('tab', { name: /daftar transaksi/i }));
    expect(screen.getAllByText('Daftar Transaksi').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Budi')).toBeInTheDocument();
  });

  it('switches to Ringkasan Penjualan tab', () => {
    render(<PenjualanPage />);
    fireEvent.click(screen.getByRole('tab', { name: /ringkasan penjualan/i }));
    expect(screen.getByText('Total Penjualan')).toBeInTheDocument();
    expect(screen.getByText('Jml Transaksi')).toBeInTheDocument();
    expect(screen.getByText('Rata-Rata')).toBeInTheDocument();
  });
});
