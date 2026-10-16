import React from 'react';
import { render, screen } from '@testing-library/react';
import { SalesSummary } from './SalesSummary';
import type { SalesSummaryData } from '@/app/types';

const sample: SalesSummaryData = { today: 1845000, transactions: 14, trend: 'up' };

describe('SalesSummary', () => {
  it('renders sales overview from provided data', () => {
    render(<SalesSummary data={sample} />);

    expect(screen.getByText('Ringkasan Penjualan')).toBeInTheDocument();
    expect(screen.getByText('Rp 1.845.000')).toBeInTheDocument();
    expect(screen.getByText('14 transaksi hari ini')).toBeInTheDocument();
    expect(screen.getByText('Naik dari kemarin')).toBeInTheDocument();
  });

  it('shows empty state instead of mock data when no data given', () => {
    render(<SalesSummary />);

    expect(screen.getByText('Data penjualan belum tersedia.')).toBeInTheDocument();
    expect(screen.queryByText('Rp 1.845.000')).not.toBeInTheDocument();
  });
});
