import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarangKeluarForm } from './BarangKeluarForm';

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

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Minyak Goreng' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: /catat barang keluar/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const entry = onAdd.mock.calls[0][0];
    expect(entry.produk).toBe('Minyak Goreng');
    expect(entry.jumlah).toBe(5);
    expect(entry.keperluan).toBe('Penjualan');
  });
});
