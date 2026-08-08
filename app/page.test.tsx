import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('renders dashboard summary with mocked data', () => {
    render(<HomePage />);

    expect(screen.getByText('Halo, Pengguna')).toBeInTheDocument();
    expect(screen.getByText('Ringkasan Stok')).toBeInTheDocument();
    expect(screen.getByText('Ringkasan Penjualan')).toBeInTheDocument();
    expect(screen.getByText('Pintasan Modul')).toBeInTheDocument();
  });
});
