import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarangMasukForm } from './BarangMasukForm';

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

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Beras Premium' } });
    fireEvent.click(screen.getByRole('button', { name: /tambah barang masuk/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Jumlah');
  });

  it('calls onAdd with valid data and resets form', () => {
    const onAdd = vi.fn();
    render(<BarangMasukForm onAdd={onAdd} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Kopi Arabika' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '25' } });
    fireEvent.change(screen.getByPlaceholderText('Nama supplier'), { target: { value: 'PT Kopi Dunia' } });

    fireEvent.click(screen.getByRole('button', { name: /tambah barang masuk/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const entry = onAdd.mock.calls[0][0];
    expect(entry.produk).toBe('Kopi Arabika');
    expect(entry.jumlah).toBe(25);
    expect(entry.supplier).toBe('PT Kopi Dunia');
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('tanggal');
  });
});
