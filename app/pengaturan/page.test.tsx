import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PengaturanPage from './page';

describe('PengaturanPage', () => {
  it('renders all 4 tabs', () => {
    render(<PengaturanPage />);
    expect(screen.getByRole('tab', { name: /profil/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /akun & role/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ubah password/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /info toko/i })).toBeInTheDocument();
  });

  it('shows Akun tab by default', () => {
    render(<PengaturanPage />);
    expect(screen.getByText('🔑 Akun & Hak Akses')).toBeInTheDocument();
    expect(screen.getByText('Bapak Arif')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tambah akun/i })).toBeInTheDocument();
  });

  it('switches to Info Toko tab', () => {
    render(<PengaturanPage />);
    fireEvent.click(screen.getByRole('tab', { name: /info toko/i }));
    expect(screen.getByDisplayValue('Toko Berkah Abadi')).toBeInTheDocument();
  });
});
