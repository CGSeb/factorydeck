// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenAmount } from './TokenAmount.tsx';

const COUNTS = {
  input: 1_200,
  output: 950,
  cacheRead: 41_800_000,
  cacheWrite: 320_000,
};
const TOOLTIP = { width: 245, height: 150 };

function layOut(anchor: { left: number; top: number }, viewport = 360): void {
  document.documentElement.style.setProperty('--fd-space-2', '8px');
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    viewport,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    640,
  );
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(
    TOOLTIP.width,
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(
    TOOLTIP.height,
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: anchor.left, y: anchor.top, width: 40, height: 20 }),
  );
}

async function openTooltip(placement: 'above' | 'below'): Promise<HTMLElement> {
  render(<TokenAmount counts={COUNTS} costUsd={27.4} placement={placement} />);
  await act(async () => {
    screen.getByText('42.1M').focus();
  });
  return screen.getByRole('tooltip');
}

describe('TokenAmount tooltip position', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty('--fd-space-2');
    vi.restoreAllMocks();
  });

  it('is fixed to the viewport so a clipping container cannot cut it', async () => {
    layOut({ left: 40, top: 300 });
    const tooltip = await openTooltip('below');
    expect(tooltip.style.position).toBe('fixed');
    expect(tooltip.style.top).toBe('320px');
    expect(tooltip.style.left).toBe('40px');
  });

  it('keeps a tooltip that would overflow on the right inside a 360 px viewport', async () => {
    layOut({ left: 300, top: 300 });
    const tooltip = await openTooltip('below');
    expect(tooltip.style.left).toBe('107px');
  });

  it('keeps a tooltip that would overflow on the left inside the viewport', async () => {
    layOut({ left: 0, top: 300 });
    const tooltip = await openTooltip('above');
    expect(tooltip.style.left).toBe('8px');
    expect(tooltip.style.top).toBe('150px');
  });

  it('opens below when there is no room above', async () => {
    layOut({ left: 200, top: 40 });
    const tooltip = await openTooltip('above');
    expect(tooltip.dataset.side).toBe('below');
    expect(tooltip.style.top).toBe('60px');
  });
});
