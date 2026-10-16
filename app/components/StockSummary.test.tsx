import React from 'react';
import { render, screen } from '@testing-library/react';
import { StockSummary } from './StockSummary';
import type { StockSummaryData } from '@/app/types';

const sample: StockSummaryData = {
  totalItems: 3,
  lowStockCount: 1,
  items: [
    { name: 'Besi AS SENTAL ST-41 5mm', stock: 12, minStock: 5, category: 'Material' },
    { name: 'Amplas Duco Grit 1500', stock: 120, minStock: 20, category: 'TOOLS' },
    { name: 'Downlight Endora 6W Putih', stock: 45, minStock: 10, category: 'ELECTRICT' },
  ],
};

describe('StockSummary', () => {
  it('renders stock overview from provided data', () => {
    render(<StockSummary data={sample} />);

    expect(screen.getByText('Ringkasan Stok')).toBeInTheDocument();
    expect(screen.getByText('3 item terpantau')).toBeInTheDocument();
    expect(screen.getByText('1 menipis')).toBeInTheDocument();
    expect(screen.getByText('Besi AS SENTAL ST-41 5mm')).toBeInTheDocument();
    expect(screen.getByText('Downlight Endora 6W Putih')).toBeInTheDocument();
  });

  it('shows empty state instead of mock data when no data given', () => {
    render(<StockSummary />);

    expect(screen.getByText('Data stok belum tersedia.')).toBeInTheDocument();
    expect(screen.queryByText('Besi AS SENTAL ST-41 5mm')).not.toBeInTheDocument();
  });
});
