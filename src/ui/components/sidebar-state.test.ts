// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLICK_FALLBACK_MS, useAfterPointer } from './sidebar-state.ts';

function fire(type: string): void {
  act(() => {
    document.dispatchEvent(new Event(type, { bubbles: true }));
  });
}

function deferred(): { action: () => void; unmount: () => void } {
  const action = vi.fn<() => void>();
  const { result, unmount } = renderHook(() => useAfterPointer());
  fire('pointerdown');
  result.current(action);
  return { action, unmount };
}

describe('useAfterPointer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs at once when no pointer is pressed', () => {
    const action = vi.fn<() => void>();
    const { result } = renderHook(() => useAfterPointer());
    result.current(action);
    expect(action).toHaveBeenCalledOnce();
  });

  it('waits for the click of a tap that comes after pointerup', () => {
    const { action } = deferred();
    fire('pointerup');
    vi.advanceTimersByTime(300);
    expect(action).not.toHaveBeenCalled();
    fire('click');
    vi.advanceTimersByTime(0);
    expect(action).toHaveBeenCalledOnce();
  });

  it('falls back when pointerup brings no click', () => {
    const { action } = deferred();
    fire('pointerup');
    vi.advanceTimersByTime(CLICK_FALLBACK_MS - 1);
    expect(action).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    vi.runOnlyPendingTimers();
    expect(action).toHaveBeenCalledOnce();
    fire('click');
    vi.advanceTimersByTime(0);
    expect(action).toHaveBeenCalledOnce();
  });

  it('runs on pointercancel', () => {
    const { action } = deferred();
    fire('pointercancel');
    vi.advanceTimersByTime(0);
    expect(action).toHaveBeenCalledOnce();
  });

  it('drops the pending listeners on unmount', () => {
    const { action, unmount } = deferred();
    const remove = vi.spyOn(document, 'removeEventListener');
    unmount();
    expect(remove.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['click', 'pointercancel', 'pointerup']),
    );
    fire('click');
    vi.advanceTimersByTime(CLICK_FALLBACK_MS);
    expect(action).not.toHaveBeenCalled();
  });
});
