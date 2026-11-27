import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SkuTableScroll from './SkuTableScroll';

afterEach(() => vi.unstubAllGlobals());

describe('SkuTableScroll', () => {
  it('menampilkan scrollbar hanya saat tabel meluber dan menyinkronkan kedua arah', () => {
    let measure = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { measure = callback; }
      observe() {}
      disconnect = disconnect;
    });
    const { unmount } = render(<SkuTableScroll><table><tbody><tr><td>Contoh SKU</td></tr></tbody></table></SkuTableScroll>);
    const name = 'Gulir horizontal tabel Master SKU';
    const viewport = screen.getByRole('table').parentElement!.parentElement!;
    expect(screen.queryByRole('region', { name })).not.toBeInTheDocument();

    let clientWidth = 800;
    Object.defineProperties(viewport, {
      clientWidth: { get: () => clientWidth },
      scrollWidth: { get: () => 1200 },
    });
    act(measure);
    const top = screen.getByRole('region', { name });
    fireEvent.scroll(top, { target: { scrollLeft: 300 } });
    expect(viewport.scrollLeft).toBe(300);
    fireEvent.scroll(viewport, { target: { scrollLeft: 150 } });
    expect(top.scrollLeft).toBe(150);

    clientWidth = 1200;
    act(measure);
    expect(screen.queryByRole('region', { name })).not.toBeInTheDocument();
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
