import React from 'react';
import { render, screen } from '@testing-library/react';
import { ShortcutModule } from './ShortcutModule';

describe('ShortcutModule', () => {
  it('renders module shortcuts with mocked data', () => {
    render(<ShortcutModule />);

    expect(screen.getByText('Pintasan Modul')).toBeInTheDocument();
    expect(screen.getAllByText('Inventory').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Input Penjualan')).toBeInTheDocument();
    expect(screen.getByText('Laporan')).toBeInTheDocument();
    expect(screen.getByText('Data Master')).toBeInTheDocument();
    expect(screen.getByText('Operasional Gudang')).toBeInTheDocument();
    expect(screen.getByText('Pengaturan')).toBeInTheDocument();
    expect(screen.getByText('Data Entry')).toBeInTheDocument();
  });
});
