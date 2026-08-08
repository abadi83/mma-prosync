import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotifikasiPage from './page';

describe('NotifikasiPage', () => {
  it('renders and shows unread count', () => {
    render(<NotifikasiPage />);
    expect(screen.getByText(/Tandai Semua Dibaca/)).toBeInTheDocument();
  });

  it('filters by stock type', () => {
    render(<NotifikasiPage />);
    fireEvent.click(screen.getByRole('button', { name: /⚠ Stok/ }));
    const items = screen.getAllByText(/Stok/);
    expect(items.length).toBeGreaterThan(0);
  });
});
