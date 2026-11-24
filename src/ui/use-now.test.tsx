// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './use-now.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useNow', () => {
  it('moves forward at least once a minute without a reload', () => {
    vi.useFakeTimers({ now: new Date('2026-11-24T14:05:00Z') });
    const { result } = renderHook(() => useNow());
    expect(result.current.toISOString()).toBe('2026-11-24T14:05:00.000Z');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.toISOString()).toBe('2026-11-24T14:06:00.000Z');
  });

  it('keeps a fixed time', () => {
    vi.useFakeTimers({ now: new Date('2026-11-24T14:05:00Z') });
    const fixed = new Date('2026-01-01T00:00:00Z');
    const { result } = renderHook(() => useNow(fixed));
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(result.current).toBe(fixed);
  });
});
