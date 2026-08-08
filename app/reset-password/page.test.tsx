import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResetPasswordPage from './page';

describe('ResetPasswordPage', () => {
  it('resets password successfully', () => {
    render(<ResetPasswordPage />);
    expect(screen.getAllByText('Reset Password').length).toBeGreaterThanOrEqual(1);
    const inputs = screen.getAllByPlaceholderText(/Min. 6 karakter|Ulangi password/);
    fireEvent.change(inputs[0], { target: { value: 'newpass123' } });
    fireEvent.change(inputs[1], { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    expect(screen.getByText(/berhasil direset/)).toBeInTheDocument();
  });
});
