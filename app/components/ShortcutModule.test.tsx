import React from 'react';
import { render, screen } from '@testing-library/react';
import { ShortcutModule } from './ShortcutModule';
import type { Shortcut } from '@/app/types';

const sample: Shortcut[] = [
  { title: 'Inventory', category: 'Inventory', description: 'Stok opname.', href: '/stok-barang' },
  { title: 'Input Penjualan', category: 'Operasional', description: 'Catat penjualan harian.', href: '/penjualan' },
  { title: 'Laporan', category: 'Finance', description: 'Laba rugi & arus kas.', href: '/laporan' },
  { title: 'Data Master', category: 'Master Data', description: 'Kelola SKU & supplier.', href: '/data-master' },
  { title: 'Operasional Gudang', category: 'Warehouse', description: 'Stok opname & mutasi.', href: '/operasional-gudang' },
  { title: 'Pengaturan', category: 'System', description: 'Info toko & akun.', href: '/pengaturan' },
  { title: 'Data Entry', category: 'Operasional', description: 'Input data per marketplace.', href: '/data-entry' },
];

describe('ShortcutModule', () => {
  it('renders module shortcuts from provided data', () => {
    render(<ShortcutModule data={sample} />);

    expect(screen.getByText('Pintasan Modul')).toBeInTheDocument();
    expect(screen.getAllByText('Inventory').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Input Penjualan')).toBeInTheDocument();
    expect(screen.getByText('Laporan')).toBeInTheDocument();
    expect(screen.getByText('Data Master')).toBeInTheDocument();
    expect(screen.getByText('Operasional Gudang')).toBeInTheDocument();
    expect(screen.getByText('Pengaturan')).toBeInTheDocument();
    expect(screen.getByText('Data Entry')).toBeInTheDocument();
  });

  it('shows empty state instead of mock data when no data given', () => {
    render(<ShortcutModule />);

    expect(screen.getByText('Pintasan belum tersedia.')).toBeInTheDocument();
    expect(screen.queryByText('Input Penjualan')).not.toBeInTheDocument();
  });
});
