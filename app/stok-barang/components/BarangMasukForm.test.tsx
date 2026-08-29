import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarangMasukForm } from './BarangMasukForm';

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

describe('BarangMasukForm', () => {
  it('renders all form fields and submit button', () => {
    const onAdd = vi.fn();
    render(<BarangMasukForm onAdd={onAdd} />);

    expect(screen.getByText('📥 Catat Barang Masuk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tambah barang masuk/i })).toBeInTheDocument();
  });

  it('shows error when submitting empty form', () => {
    const onAdd = vi.fn();
    render(<BarangMasukForm onAdd={onAdd} />);

    fireEvent.click(screen.getByRole('button', { name: /tambah barang masuk/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Pilih produk terlebih dahulu');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows error when jumlah is 0', () => {
    const onAdd = vi.fn();
    render(<BarangMasukForm onAdd={onAdd} />);

    fireEvent.change(screen.getByPlaceholderText('🔍 Cari nama produk atau SKU...'), { target: { value: 'BS-001' } });
    fireEvent.click(screen.getByText('BS-001'));
    fireEvent.click(screen.getByRole('button', { name: /tambah barang masuk/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Jumlah');
  });

  it('calls onAdd with valid data and resets form', () => {
    const onAdd = vi.fn();
    render(<BarangMasukForm onAdd={onAdd} />);

    fireEvent.change(screen.getByPlaceholderText('🔍 Cari nama produk atau SKU...'), { target: { value: 'KN-001' } });
    fireEvent.click(screen.getByText('KN-001'));
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '25' } });
    fireEvent.change(screen.getByPlaceholderText('Nama supplier'), { target: { value: 'PT Kabel Dunia' } });

    fireEvent.click(screen.getByRole('button', { name: /tambah barang masuk/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const entry = onAdd.mock.calls[0][0];
    expect(entry.sku).toBe('KN-001');
    expect(entry.produk).toBe('Kabel NYM 2x1.5');
    expect(entry.jumlah).toBe(25);
    expect(entry.supplier).toBe('PT Kabel Dunia');
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('tanggal');
  });
});
