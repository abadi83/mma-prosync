import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkuProvider } from '@/app/context/SkuContext';
import DataMasterPage from './page';

function renderWithProviders(ui: React.ReactElement) {
  return render(<SkuProvider>{ui}</SkuProvider>);
}

describe('DataMasterPage', () => {
  it('renders all 4 new tabs', () => {
    renderWithProviders(<DataMasterPage />);
    expect(screen.getByRole('tab', { name: /master sku/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /daftar supplier/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /toko per marketplace/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /daftar pelanggan/i })).toBeInTheDocument();
  });

  it('shows SKU tab by default with Upload Excel button', () => {
    renderWithProviders(<DataMasterPage />);
    expect(screen.getByText('📦 Master SKU')).toBeInTheDocument();
    expect(screen.getByText('📥 Upload Excel')).toBeInTheDocument();
  });

  it('switches to Toko per Marketplace', () => {
    renderWithProviders(<DataMasterPage />);
    fireEvent.click(screen.getByRole('tab', { name: /toko per marketplace/i }));
    expect(screen.getByText('Shopee')).toBeInTheDocument();
  });
});
