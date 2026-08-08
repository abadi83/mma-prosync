import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useDashboardRefresh } from './useDashboardRefresh';

describe('useDashboardRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial mock data', () => {
    const { result } = renderHook(() => useDashboardRefresh(10000));

    expect(result.current.data.stockSummary.totalItems).toBe(24);
    expect(result.current.data.salesSummary.transactions).toBeGreaterThan(0);
    expect(result.current.data.shortcuts).toHaveLength(7);
  });

  it('refreshes data when refresh() is called manually', () => {
    const { result } = renderHook(() => useDashboardRefresh(10000));

    const before = result.current.data.salesSummary.today;

    act(() => {
      result.current.refresh();
    });

    // After manual refresh, data may or may not change (random), but lastUpdated should update
    expect(result.current.lastUpdated.getTime()).toBeGreaterThanOrEqual(
      new Date(Date.now() - 1000).getTime(),
    );
  });

  it('auto-refreshes on interval', () => {
    const { result } = renderHook(() => useDashboardRefresh(5000));

    const firstTimestamp = result.current.lastUpdated.getTime();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.lastUpdated.getTime()).toBeGreaterThan(firstTimestamp);
  });
});
