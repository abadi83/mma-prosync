import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from './page';

describe('LoginPage', () => {
  it('renders login form', () => {
    render(<LoginPage />);
    expect(screen.getByText('MMA ProSync')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('demo@mma.id')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeInTheDocument();
  });

  it('shows error for empty fields', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email dan password wajib diisi');
  });

  it('shows demo credentials hint', () => {
    render(<LoginPage />);
    expect(screen.getByText(/demo@mma.id/)).toBeInTheDocument();
  });
});
