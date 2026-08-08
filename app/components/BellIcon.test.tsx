import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BellIcon } from './BellIcon';

describe('BellIcon', () => {
  it('shows count badge', () => {
    render(<BellIcon count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 99+ for large counts', () => {
    render(<BellIcon count={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('no badge when count is 0', () => {
    render(<BellIcon count={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('calls onClick', () => {
    const fn = vi.fn();
    render(<BellIcon count={3} onClick={fn} />);
    fireEvent.click(screen.getByRole('button'));
    expect(fn).toHaveBeenCalled();
  });
});
