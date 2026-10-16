import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResetPasswordPage from './page';

describe('ResetPasswordPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/reset-password');
  });

  it('resets password successfully with valid token', async () => {
    window.history.pushState({}, '', '/reset-password?token=' + 'a'.repeat(64));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Password berhasil direset.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    render(<ResetPasswordPage />);
    expect(screen.getAllByText('Reset Password').length).toBeGreaterThanOrEqual(1);
    const inputs = screen.getAllByPlaceholderText(/Min. 6 karakter|Ulangi password/);
    fireEvent.change(inputs[0], { target: { value: 'newpass123' } });
    fireEvent.change(inputs[1], { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => expect(screen.getByText(/berhasil direset/)).toBeInTheDocument());
  });

  it('shows error when token missing', async () => {
    render(<ResetPasswordPage />);
    const inputs = screen.getAllByPlaceholderText(/Min. 6 karakter|Ulangi password/);
    fireEvent.change(inputs[0], { target: { value: 'newpass123' } });
    fireEvent.change(inputs[1], { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => expect(screen.getByText(/link reset tidak valid/i)).toBeInTheDocument());
  });
});
