import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LupaPasswordPage from './page';

describe('LupaPasswordPage', () => {
  it('renders form and sends reset link', () => {
    render(<LupaPasswordPage />);
    expect(screen.getByText('Lupa Password')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('toko@email.com'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /kirim/i }));
    expect(screen.getByText(/telah dikirim/)).toBeInTheDocument();
  });
});
