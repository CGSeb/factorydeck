// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import type { Window as HappyWindow } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RefreshControl } from './RefreshControl.tsx';

const css = readFileSync(join(import.meta.dirname, 'controls.css'), 'utf8');
const NOW = new Date('2026-03-12T12:00:00Z');

function renderAt(
  width: number,
  collectedAt: string | null | undefined,
  refreshing = false,
): void {
  (window as unknown as HappyWindow).happyDOM.setViewport({
    width,
    height: 800,
  });
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  render(
    <RefreshControl
      collectedAt={collectedAt}
      now={NOW}
      refreshing={refreshing}
      onRefresh={() => undefined}
    />,
  );
}

function displayOf(text: string): string {
  return getComputedStyle(screen.getByText(text)).display;
}

describe('RefreshControl', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });
  afterEach(cleanup);

  it('is named Refresh beside a visible status at 480 px and more', () => {
    renderAt(480, '2026-03-12T11:57:30Z');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
    expect(displayOf('Issues updated 2 min ago')).not.toBe('none');
  });

  it('moves the status into the name below 480 px', () => {
    renderAt(479, '2026-03-12T11:57:30Z');
    expect(
      screen.getByRole('button', { name: 'Refresh, issues updated 2 min ago' }),
    ).toBeDefined();
    expect(displayOf('Issues updated 2 min ago')).toBe('none');
  });

  it('names a never collected status below 480 px', () => {
    renderAt(360, null);
    expect(
      screen.getByRole('button', { name: 'Refresh, issues not collected yet' }),
    ).toBeDefined();
  });

  it('is named Refresh alone when collection is not configured', () => {
    renderAt(360, undefined);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
  });

  it('is named Refreshing… and disabled while refreshing', () => {
    renderAt(360, '2026-03-12T11:57:30Z', true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Refreshing…' })
        .disabled,
    ).toBe(true);
  });
});
