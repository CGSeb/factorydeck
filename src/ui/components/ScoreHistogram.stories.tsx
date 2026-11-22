import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ScoreHistogram } from './ScoreHistogram.tsx';
import type { ScoreReport } from './stats-math.ts';
import { surfaceFrame } from './story-frame.ts';

function reports(
  scores: readonly number[],
  threshold: (index: number) => number = () => 80,
): ScoreReport[] {
  return scores.map((score, index) => ({
    score,
    threshold: threshold(index),
    time: new Date(Date.UTC(2026, 10, 1 + index)).toISOString(),
  }));
}

const AROUND_80 = [
  62, 71, 74, 77, 78, 79, 81, 82, 84, 85, 86, 86, 87, 88, 90, 91, 93, 95, 97,
  100,
];

const meta = {
  title: 'Components/ScoreHistogram',
  component: ScoreHistogram,
  decorators: [surfaceFrame],
  args: {
    label: 'Serenity scores',
    reports: reports(AROUND_80),
  },
} satisfies Meta<typeof ScoreHistogram>;

export default meta;

type Story = StoryObj<typeof meta>;

function columns(canvasElement: HTMLElement): HTMLElement[] {
  return [...canvasElement.querySelectorAll<HTMLElement>('[data-column]')];
}

function thresholdLabel(canvasElement: HTMLElement): string | null {
  return (
    canvasElement.querySelector('[data-threshold-label]')?.textContent ?? null
  );
}

function rows(canvasElement: HTMLElement): string[][] {
  return within(canvasElement)
    .getAllByRole('row')
    .map((row) => [...row.children].map((cell) => cell.textContent));
}

export const AroundThreshold: Story = {
  name: 'Scores around a threshold of 80',
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement);
    await expect(bars).toHaveLength(20);
    await expect(bars[0]).toHaveStyle({ height: '2px' });
    await expect(bars[0]?.style.background).toBe('var(--fd-line)');
    await expect(bars[17]).toHaveStyle({ height: '80px' });
    await expect(bars[15]).toHaveStyle({ height: '48px' });
    await expect(bars[15]?.querySelector('[data-below]')).toHaveStyle({
      height: '48px',
    });
    await expect(thresholdLabel(canvasElement)).toBe('threshold 80');
    await expect(
      canvasElement.querySelector<HTMLElement>('[data-threshold]')?.style.left,
    ).toBe('80%');
    await expect(
      [...(canvasElement.querySelector('[data-axis]')?.children ?? [])].map(
        (tick) => tick.textContent,
      ),
    ).toEqual(['0', '50', '100']);
    await expect(rows(canvasElement)[0]).toEqual([
      '60–64',
      '1 report',
      '1 below its threshold',
    ]);
    await expect(
      within(canvasElement).getByText('threshold 80', {
        selector: 'p',
      }),
    ).toBeInTheDocument();
  },
};

export const ThresholdInsideBin: Story = {
  name: 'A threshold of 72 inside a bin',
  args: {
    reports: reports([60, 70, 71, 72, 73, 74, 80, 85, 90], () => 72),
  },
  play: async ({ canvasElement }) => {
    const bin = columns(canvasElement)[14];
    await expect(bin).toHaveStyle({ height: '80px' });
    await expect(bin?.querySelector('[data-below]')).toHaveStyle({
      height: '32px',
    });
    await expect(thresholdLabel(canvasElement)).toBe('threshold 72');
  },
};

export const ThresholdChanged: Story = {
  name: 'Thresholds that changed from 75 to 80',
  args: {
    reports: reports([70, 76, 78, 79, 82, 85, 88, 90], (index) =>
      index < 4 ? 75 : 80,
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(thresholdLabel(canvasElement)).toBe('threshold 80 · varied');
    const bin = columns(canvasElement)[15];
    await expect(bin).toHaveStyle({ height: '80px' });
    await expect(bin?.querySelector('[data-below]')).toBeNull();
    await expect(
      within(canvasElement).getByText('threshold 80 · varied', {
        selector: 'p',
      }),
    ).toBeInTheDocument();
  },
};

export const AllAbove: Story = {
  name: 'Every score above',
  args: { reports: reports([81, 84, 88, 90, 92, 95, 99]) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-below]')).toBeNull();
  },
};

export const BelowMinimum: Story = {
  name: 'Below the minimum sample',
  args: { reports: reports([70, 85, 90]) },
  play: async ({ canvasElement }) => {
    await expect(columns(canvasElement)).toHaveLength(0);
    await expect(canvasElement.querySelector('[data-empty]')?.textContent).toBe(
      'Not enough data',
    );
    await expect(canvasElement.querySelector('[data-empty]')).toHaveStyle({
      height: '80px',
    });
    await expect(within(canvasElement).queryByRole('table')).toBeNull();
  },
};

export const Hovered: Story = {
  name: 'Hovered column',
  args: {
    reports: reports([84, 86, 87, 88, 89, 92, 95], (i) => (i < 1 ? 85 : 88)),
  },
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement);
    const column = bars[17]?.parentElement;
    if (column == null) throw new Error('No column');
    await userEvent.hover(column);
    const tooltip = column.querySelector('[data-tooltip]');
    await expect(
      [...(tooltip?.children ?? [])].map((line) => line.textContent),
    ).toEqual(['85–89', '4 reports · 2 below their threshold']);
    await expect(bars[18]).toHaveStyle({ opacity: '0.45' });
  },
};
