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
const TOOLTIP_WIDTH = 245;

function layOut(tooltipLeft: number, viewportWidth: number): void {
  document.documentElement.style.setProperty('--fd-space-2', '8px');
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    viewportWidth,
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const shift = Number(
        /translateX\((-?[\d.]+)px\)/.exec(this.style.transform)?.[1] ?? 0,
      );
      const left =
        this.getAttribute('role') === 'tooltip' ? tooltipLeft + shift : 0;
      return DOMRect.fromRect({
        x: left,
        y: 0,
        width: TOOLTIP_WIDTH,
        height: 150,
      });
    },
  );
}

async function openTooltip(placement: 'above' | 'below'): Promise<HTMLElement> {
  render(<TokenAmount counts={COUNTS} costUsd={27.4} placement={placement} />);
  await act(async () => {
    screen.getByText('42.1M').focus();
  });
  return screen.getByRole('tooltip');
}

describe('TokenAmount near the viewport edge', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty('--fd-space-2');
    vi.restoreAllMocks();
  });

  it('shifts a tooltip that overflows a 360 px viewport on the right back inside it', async () => {
    layOut(300, 360);
    const tooltip = await openTooltip('below');
    expect(tooltip.style.transform).toBe('translateX(-193px)');
  });

  it('shifts a tooltip that overflows on the left back inside it', async () => {
    layOut(-60, 360);
    const tooltip = await openTooltip('above');
    expect(tooltip.style.transform).toBe('translateX(68px)');
  });

  it('leaves a tooltip that fits in place', async () => {
    layOut(40, 360);
    const tooltip = await openTooltip('above');
    expect(tooltip.style.transform).toBe('');
  });
});
