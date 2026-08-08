import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { InvoicePreview } from './InvoicePO';
import type { InvoicePOData } from './InvoicePO';

const mockData: InvoicePOData = {
  noPO: 'PO-260806-001',
  supplierNama: 'PT Sinar Jaya Steel',
  supplierKontak: '021-5555-1234',
  tanggal: '2026-08-06',
  metodeBayar: 'Transfer',
  items: [
    { sku: 'BTJ-001', namaSku: 'Besi AS SENTAL ST-41 5mm', qty: 10, hargaBeli: 25000, subtotal: 250000 },
    { sku: '200825', namaSku: 'Downlight Endora 6W Putih', qty: 5, hargaBeli: 20000, subtotal: 100000 },
  ],
  total: 350000,
  dibayar: 350000,
  sisa: 0,
  lunas: true,
};

describe('InvoicePreview', () => {
  it('merender nomor PO dan supplier', () => {
    render(<InvoicePreview data={mockData} tokoNama="Test Toko" />);
    expect(screen.getByText('PO-260806-001')).toBeDefined();
    expect(screen.getByText('PT Sinar Jaya Steel')).toBeDefined();
  });

  it('merender daftar item', () => {
    render(<InvoicePreview data={mockData} tokoNama="Test Toko" />);
    expect(screen.getByText(/Besi AS SENTAL/)).toBeDefined();
    expect(screen.getByText(/Downlight Endora/)).toBeDefined();
  });

  it('menampilkan status lunas', () => {
    render(<InvoicePreview data={mockData} tokoNama="Test Toko" />);
    expect(screen.getByText('✅ LUNAS')).toBeDefined();
  });

  it('menampilkan total', () => {
    render(<InvoicePreview data={mockData} tokoNama="Test Toko" />);
    const totals = screen.getAllByText(/350\.000/);
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });

  it('merender nama toko', () => {
    render(<InvoicePreview data={mockData} tokoNama="Test Toko" />);
    expect(screen.getByText('Test Toko')).toBeDefined();
  });
});
