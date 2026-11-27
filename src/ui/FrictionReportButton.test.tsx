// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COPIED,
  COPIED_MS,
  COPYING,
  COPY_AND_MARK,
  COPY_FAILED,
  COPY_REPORT,
  FAILED_MS,
  FrictionReportButton,
} from './FrictionReportButton.tsx';

function name(): string {
  return screen.getByRole('button').textContent;
}

function current(): string {
  return (
    screen.getByRole('button').querySelector('[data-current="true"]')
      ?.textContent ?? ''
  );
}

async function click(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
    await Promise.resolve();
  });
}

describe('FrictionReportButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('reads Copying… then Copied for 2 seconds, then its label again', async () => {
    let finish: () => void = () => undefined;
    const onCopy = vi.fn<() => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<FrictionReportButton blocked={null} onCopy={onCopy} />);
    await click();
    expect(current()).toBe(COPYING);
    await act(async () => {
      finish();
      await Promise.resolve();
    });
    expect(current()).toBe(COPIED);
    act(() => {
      vi.advanceTimersByTime(COPIED_MS - 1);
    });
    expect(current()).toBe(COPIED);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(current()).toBe(COPY_REPORT);
  });

  it('reads Could not copy for 4 seconds when the copy fails', async () => {
    render(
      <FrictionReportButton
        blocked={null}
        onCopy={() => Promise.reject(new Error('Denied'))}
      />,
    );
    await click();
    await act(async () => {
      await Promise.resolve();
    });
    expect(current()).toBe(COPY_FAILED);
    act(() => {
      vi.advanceTimersByTime(FAILED_MS - 1);
    });
    expect(current()).toBe(COPY_FAILED);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(current()).toBe(COPY_REPORT);
  });

  it('holds every label in the button, so its width never changes', () => {
    render(
      <FrictionReportButton blocked={null} onCopy={() => Promise.resolve()} />,
    );
    expect(name()).toBe(`${COPY_REPORT}${COPYING}${COPIED}${COPY_FAILED}`);
  });

  it('reads its own label when idle, and the same copy states', async () => {
    render(
      <FrictionReportButton
        blocked={null}
        label={COPY_AND_MARK}
        onCopy={() => Promise.reject(new Error('Denied'))}
      />,
    );
    expect(name()).toBe(`${COPY_AND_MARK}${COPYING}${COPIED}${COPY_FAILED}`);
    expect(current()).toBe(COPY_AND_MARK);
    await click();
    await act(async () => {
      await Promise.resolve();
    });
    expect(current()).toBe(COPY_FAILED);
    act(() => {
      vi.advanceTimersByTime(FAILED_MS);
    });
    expect(current()).toBe(COPY_AND_MARK);
  });
});
