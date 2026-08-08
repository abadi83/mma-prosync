import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OperasionalGudangPage from './page';

describe('OperasionalGudangPage', () => {
  it('renders all tabs', () => {
    render(<OperasionalGudangPage />);
    expect(screen.getByRole('tab', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /picking/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /qc/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /packing/i })).toBeInTheDocument();
  });

  it('shows Dashboard Agregasi by default', () => {
    render(<OperasionalGudangPage />);
    expect(screen.getByText('📊 Dashboard Agregasi Pesanan')).toBeInTheDocument();
    expect(screen.getByText('📥 Upload Order')).toBeInTheDocument();
    expect(screen.getByText('📦 Upload Picking')).toBeInTheDocument();
  });

  it('switches to Picking tab', () => {
    render(<OperasionalGudangPage />);
    fireEvent.click(screen.getByRole('tab', { name: /picking/i }));
    expect(screen.getByText('📋 Daftar Picking')).toBeInTheDocument();
    expect(screen.getByText('Belum ada item picking.')).toBeInTheDocument();
  });
});
