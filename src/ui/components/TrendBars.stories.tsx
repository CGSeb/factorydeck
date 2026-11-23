import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { TrendBucket } from './stats-math.ts';
import { surfaceFrame } from './story-frame.ts';
import { TrendBars } from './TrendBars.tsx';

const SHARES = [
  0.4, 0.45, 0.5, 0.42, 0.55, 0.6, 0.58, 0.63, 0.7, 0.66, 0.72, 0.8,
];
const SAMPLES = [6, 8, 7, 9, 5, 10, 8, 12, 9, 11, 10, 14];
const COUNTS = [3, 5, 2, 0, 6, 8, 4, 7, 9, 5, 10, 6];

function week(index: number): string {
  return `W${String(index + 1)}`;
}

function shareWeeks(samples: readonly number[] = SAMPLES): TrendBucket[] {
  return SHARES.map((value, index) => ({
    label: week(index),
    value,
    n: samples[index] ?? 0,
    text: `${String(Math.round(value * 100))}%`,
  }));
}

function countWeeks(counts: readonly number[] = COUNTS): TrendBucket[] {
  return counts.map((value, index) => ({
    label: week(index),
    value,
    text: `${String(value)} merged`,
  }));
}

const meta = {
  title: 'Components/TrendBars',
  component: TrendBars,
  decorators: [surfaceFrame],
  args: {
    label: 'Merged without help, per week',
    buckets: shareWeeks(),
    scale: 'share',
    color: 'var(--fd-success)',
    height: 64,
  },
} satisfies Meta<typeof TrendBars>;

export default meta;

type Story = StoryObj<typeof meta>;

function columns(canvasElement: HTMLElement): HTMLElement[] {
  return [...canvasElement.querySelectorAll<HTMLElement>('[data-column]')];
}

async function tooltipOf(bar: HTMLElement | undefined): Promise<string[]> {
  const column = bar?.parentElement;
  if (column == null) throw new Error('No column');
  await userEvent.hover(column);
  const tooltip = column.querySelector('[data-tooltip]');
  if (tooltip === null) throw new Error('No tooltip');
  return [...tooltip.children].map((line) => line.textContent);
}

export const WeeksOfShares: Story = {
  name: '12 weeks of shares',
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement);
    await expect(bars).toHaveLength(12);
    await expect(bars[11]).toHaveStyle({ height: '51.2px' });
    await expect(
      [...canvasElement.querySelectorAll('[data-labels] > span')].map(
        (label) => label.textContent,
      ),
    ).toEqual(['W1', 'W12']);
    await expect(
      within(canvasElement).getByRole('img', {
        name: 'Merged without help, per week',
      }),
    ).toBeInTheDocument();
  },
};

export const WeeksOfCounts: Story = {
  name: '12 weeks of counts',
  args: {
    label: 'Issues merged per week',
    buckets: countWeeks(),
    scale: 'count',
    color: 'var(--fd-chart-bar)',
  },
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement);
    await expect(bars[10]).toHaveStyle({ height: '64px' });
    await expect(bars[3]).toHaveStyle({ height: '2px' });
  },
};

export const SomeBelowMinimum: Story = {
  name: 'Some weeks below the minimum sample',
  args: {
    buckets: shareWeeks([6, 2, 7, 9, 0, 10, 8, 12, 4, 11, 10, 14]),
  },
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement);
    await expect(bars[1]).toHaveStyle({ height: '2px' });
    await expect(bars[1]?.style.background).toBe('var(--fd-line)');
    await expect(bars[2]?.style.background).toBe('var(--fd-success)');
    const rows = within(canvasElement)
      .getAllByRole('row')
      .map((row) => [...row.children].map((cell) => cell.textContent));
    await expect(rows[1]).toEqual(['W2', 'Not enough data', 'n = 2']);
    await expect(rows[2]).toEqual(['W3', '50%', 'n = 7']);
  },
};

export const AllZero: Story = {
  name: 'All zero',
  args: {
    label: 'Issues merged per week',
    buckets: countWeeks(COUNTS.map(() => 0)),
    scale: 'count',
    color: 'var(--fd-chart-bar)',
  },
  play: async ({ canvasElement }) => {
    for (const bar of columns(canvasElement)) {
      await expect(bar).toHaveStyle({ height: '2px' });
    }
  },
};

export const Hovered: Story = {
  name: 'Hovered column',
  args: {
    buckets: shareWeeks([6, 2, 7, 9, 5, 10, 8, 12, 9, 11, 10, 14]),
  },
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement);
    await expect(await tooltipOf(bars[1])).toEqual(['W2', 'Not enough data']);
    await expect(await tooltipOf(bars[6])).toEqual(['W7', '58%', 'n = 8']);
    await expect(bars[0]).toHaveStyle({ opacity: '0.45' });
    await expect(bars[6]).toHaveStyle({ opacity: '1' });
  },
};

export const WithNoun: Story = {
  name: 'Sample size with its noun',
  args: {
    buckets: shareWeeks([6, 1, 7, 9, 5, 10, 8, 12, 9, 11, 10, 14]),
    noun: { one: 'API call', other: 'API calls' },
  },
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement);
    await expect(await tooltipOf(bars[6])).toEqual([
      'W7',
      '58%',
      'n = 8 API calls',
    ]);
    const rows = within(canvasElement)
      .getAllByRole('row')
      .map((row) => [...row.children].map((cell) => cell.textContent));
    await expect(rows[1]).toEqual(['W2', 'Not enough data', 'n = 1 API call']);
  },
};
