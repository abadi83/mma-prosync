import React from 'react';
import { render, screen } from '@testing-library/react';
import { StockSummary } from './StockSummary';

describe('StockSummary', () => {
  it('renders the stock overview with mocked data', () => {
    render(<StockSummary />);

    expect(screen.getByText('Ringkasan Stok')).toBeInTheDocument();
    expect(screen.getByText('1 menipis')).toBeInTheDocument();
    expect(screen.getByText('Besi AS SENTAL ST-41 5mm')).toBeInTheDocument();
    expect(screen.getByText('Downlight Endora 6W Putih')).toBeInTheDocument();
  });
});
