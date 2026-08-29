import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StokBarangPage from './page';
import { Providers } from '@/app/providers';

const renderWithProviders = (ui: React.ReactElement) => render(<Providers>{ui}</Providers>);

describe('StokBarangPage', () => {
  it('renders the page header', () => {
    renderWithProviders(<StokBarangPage />);
    expect(screen.getAllByText('Inventory').length).toBeGreaterThanOrEqual(1);
  });

  it('renders all tab buttons', () => {
    renderWithProviders(<StokBarangPage />);
    expect(screen.getByRole('tab', { name: /stok opname/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /barang masuk/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /barang keluar/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /cek stok/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /riwayat mutasi/i })).toBeInTheDocument();
  });

  it('shows Stok Opname content by default', () => {
    renderWithProviders(<StokBarangPage />);
    expect(screen.getAllByText('Stok Opname').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total SKU')).toBeInTheDocument();
    expect(screen.getByText('Sudah Dihitung')).toBeInTheDocument();
  });

  it('switches to Cek Stok tab and shows summary cards', () => {
    renderWithProviders(<StokBarangPage />);
    fireEvent.click(screen.getByRole('tab', { name: /cek stok/i }));
    expect(screen.getByText('Daftar stok real-time semua produk')).toBeInTheDocument();
    expect(screen.getByText('Total Produk')).toBeInTheDocument();
    expect(screen.getByText('Stok Menipis')).toBeInTheDocument();
    expect(screen.getByText('Stok Aman')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('🔍 Cari nama produk, SKU, atau kategori...')).toBeInTheDocument();
  });

  it('filters products by search in Cek Stok', () => {
    renderWithProviders(<StokBarangPage />);
    fireEvent.click(screen.getByRole('tab', { name: /cek stok/i }));

    const searchInput = screen.getByPlaceholderText('🔍 Cari nama produk, SKU, atau kategori...');
    fireEvent.change(searchInput, { target: { value: 'Kran' } });

    expect(screen.getByText('Kran Angsa 8005 Tongkat')).toBeInTheDocument();
    expect(screen.queryByText('Paku Seng 3 Inch')).not.toBeInTheDocument();
  });

  it('shows Riwayat Mutasi with summary and filter buttons', () => {
    renderWithProviders(<StokBarangPage />);
    fireEvent.click(screen.getByRole('tab', { name: /riwayat mutasi/i }));
    expect(screen.getByText('Log kronologis pergerakan barang')).toBeInTheDocument();
    expect(screen.getByText('Total Barang Masuk')).toBeInTheDocument();
    expect(screen.getByText('Total Barang Keluar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /📥 Masuk/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /📤 Keluar/i })).toBeInTheDocument();
  });

  it('filters mutasi by tipe masuk only', () => {
    renderWithProviders(<StokBarangPage />);
    fireEvent.click(screen.getByRole('tab', { name: /riwayat mutasi/i }));
    fireEvent.click(screen.getByRole('button', { name: /📥 Masuk/i }));

    // Tabel hanya memuat baris dengan badge 📥 Masuk (bukan tombol filter)
    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.textContent).toContain('📥 Masuk');
      expect(row.textContent).not.toContain('📤 Keluar');
    }
  });
});
