import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DataEntryPage from './page';

describe('DataEntryPage', () => {
  it('renders header and all tab buttons', () => {
    render(<DataEntryPage />);
    expect(screen.getByText('Input Data')).toBeInTheDocument();
    expect(screen.getByText('Data Entry')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pesanan marketplace/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /input operasional/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /input keuangan/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /riwayat entry/i })).toBeInTheDocument();
  });

  it('shows Pesanan Marketplace tab by default', () => {
    render(<DataEntryPage />);
    expect(screen.getAllByText(/pesanan marketplace/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('📥 Upload Excel')).toBeInTheDocument();
  });

  it('switches to Input Keuangan tab', () => {
    render(<DataEntryPage />);
    fireEvent.click(screen.getByRole('tab', { name: /input keuangan/i }));
    expect(screen.getByText('💰 Input Data Keuangan')).toBeInTheDocument();
    expect(screen.getByText('Shopee')).toBeInTheDocument();
    expect(screen.getByText('Tokopedia')).toBeInTheDocument();
    expect(screen.getByText('Lazada')).toBeInTheDocument();
  });
});
