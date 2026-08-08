import React from 'react';
import { render, screen } from '@testing-library/react';
import { SalesSummary } from './SalesSummary';

describe('SalesSummary', () => {
  it('renders the sales overview with mocked data', () => {
    render(<SalesSummary />);

    expect(screen.getByText('Ringkasan Penjualan')).toBeInTheDocument();
    expect(screen.getByText('Rp 1.845.000')).toBeInTheDocument();
    expect(screen.getByText('14 transaksi hari ini')).toBeInTheDocument();
  });
});
