import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import BuktiBayarUpload from './BuktiBayarUpload';

// Mock tesseract.js agar tidak benar-benar load worker di test
vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn().mockResolvedValue({
      data: {
        text: 'Transfer Rp 500.000\nREF: ABC123XYZ\nTANGGAL: 06/08/2026\nBCA',
      },
    }),
  },
}));

describe('BuktiBayarUpload', () => {
  const onOcrResult = vi.fn();
  const onImageReady = vi.fn();

  beforeEach(() => {
    onOcrResult.mockClear();
    onImageReady.mockClear();
  });

  it('merender area upload', () => {
    render(<BuktiBayarUpload onOcrResult={onOcrResult} onImageReady={onImageReady} />);
    expect(screen.getByText(/Klik.*Drag.*Drop/i)).toBeDefined();
    expect(screen.getByText('📁 Pilih File')).toBeDefined();
    expect(screen.getByText('📷 Kamera')).toBeDefined();
  });

  it('menampilkan tips OCR', () => {
    render(<BuktiBayarUpload onOcrResult={onOcrResult} onImageReady={onImageReady} />);
    expect(screen.getByText(/Screenshot halaman konfirmasi transfer/i)).toBeDefined();
  });
});
