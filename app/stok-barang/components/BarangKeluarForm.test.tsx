import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarangKeluarForm } from './BarangKeluarForm';

vi.mock('@/app/context/SkuContext', () => ({
  useSkus: () => ({
    skus: [
      { id: 'm1', sku: 'BS-001', nama: 'Besi AS SENTAL ST-41 5mm' },
      { id: 'm2', sku: 'KN-001', nama: 'Kabel NYM 2x1.5' },
    ],
    setSkus: vi.fn(),
    getSku: vi.fn(),
    updateStok: vi.fn(),
    syncStatus: 'idle',
    lastSync: null,
    forceSync: vi.fn(),
  }),
}));

describe('BarangKeluarForm', () => {
  it('renders all form fields and submit button', () => {
    const onAdd = vi.fn();
    render(<BarangKeluarForm onAdd={onAdd} />);

    expect(screen.getByText('📤 Catat Barang Keluar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /catat barang keluar/i })).toBeInTheDocument();
  });

  it('shows error for empty produk', () => {
    const onAdd = vi.fn();
    render(<BarangKeluarForm onAdd={onAdd} />);

    fireEvent.click(screen.getByRole('button', { name: /catat barang keluar/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Pilih produk');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('calls onAdd with valid data', () => {
    const onAdd = vi.fn();
    render(<BarangKeluarForm onAdd={onAdd} />);

    fireEvent.change(screen.getByPlaceholderText('🔍 Cari nama produk atau SKU...'), { target: { value: 'BS-001' } });
    fireEvent.click(screen.getByText('BS-001'));
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: /catat barang keluar/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const entry = onAdd.mock.calls[0][0];
    expect(entry.sku).toBe('BS-001');
    expect(entry.produk).toBe('Besi AS SENTAL ST-41 5mm');
    expect(entry.jumlah).toBe(5);
    expect(entry.keperluan).toBe('Penjualan');
  });
});
