import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DaftarPage from './page';

describe('DaftarPage', () => {
  it('renders registration form', () => {
    render(<DaftarPage />);
    expect(screen.getByText('Daftar Akun Baru')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Toko Berkah Abadi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Daftar' })).toBeInTheDocument();
  });

  it('shows error for empty fields', () => {
    render(<DaftarPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Daftar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Semua field wajib diisi');
  });

  it('shows password mismatch error', () => {
    render(<DaftarPage />);
    fireEvent.change(screen.getByPlaceholderText('Toko Berkah Abadi'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByPlaceholderText('toko@email.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 6 karakter'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('Ulangi password'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Daftar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('tidak cocok');
  });
});
