import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportButton } from './ExportButton';

describe('ExportButton', () => {
  it('renders export button', () => {
    render(<ExportButton filename="test" headers={['A']} rows={[['1']]} />);
    expect(screen.getByRole('button', { name: /ekspor/i })).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<ExportButton filename="test" headers={['A']} rows={[['1']]} />);
    fireEvent.click(screen.getByRole('button', { name: /ekspor/i }));
    expect(screen.getByText((content) => content.includes('CSV'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('PDF'))).toBeInTheDocument();
  });
});
