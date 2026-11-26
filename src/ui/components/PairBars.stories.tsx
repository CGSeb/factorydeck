import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { type PairBucket, PairBars } from './PairBars.tsx';
import { surfaceFrame } from './story-frame.ts';

const REPORTED = [3, 0, 1, 4, 1, 2, 0];
const FIXED = [2, 1, 2, 2, 1, 0, 0];
const DAYS = [
  'Nov 19',
  'Nov 20',
  'Nov 21',
  'Nov 22',
  'Nov 23',
  'Nov 24',
  'today',
];

function days(
  reported: readonly number[] = REPORTED,
  fixed: readonly number[] = FIXED,
): PairBucket[] {
  return DAYS.map((label, index) => {
    const first = reported[index] ?? 0;
    const second = fixed[index] ?? 0;
    return {
      label,
      first,
      second,
      text: `${String(first)} reported · ${String(second)} fixed`,
    };
  });
}

const meta = {
  title: 'Components/PairBars',
  component: PairBars,
  decorators: [surfaceFrame],
  args: {
    label: 'Bugs reported and fixed, by day',
    series: [
      { label: 'Reported', color: 'var(--fd-danger)' },
      { label: 'Fixed', color: 'var(--fd-stage-merged)' },
    ],
    buckets: days(),
    height: 64,
  },
} satisfies Meta<typeof PairBars>;

export default meta;

type Story = StoryObj<typeof meta>;

function bars(canvasElement: HTMLElement, series: string): HTMLElement[] {
  return [
    ...canvasElement.querySelectorAll<HTMLElement>(`[data-bar="${series}"]`),
  ];
}

export const TwoSeries: Story = {
  name: 'Two series on one scale',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      [...canvasElement.querySelectorAll('[data-legend] li')].map(
        (item) => item.textContent,
      ),
    ).toEqual(['Reported', 'Fixed']);
    const reported = bars(canvasElement, 'Reported');
    const fixed = bars(canvasElement, 'Fixed');
    await expect(reported).toHaveLength(7);
    await expect(reported[3]).toHaveStyle({ height: '64px' });
    await expect(fixed[0]).toHaveStyle({ height: '32px' });
    await expect(reported[0]?.style.background).toBe('var(--fd-danger)');
    await expect(fixed[0]?.style.background).toBe('var(--fd-stage-merged)');
    await expect(reported[1]).toHaveStyle({ height: '2px' });
    await expect(reported[1]?.style.background).toBe('var(--fd-line)');
    const rows = within(
      canvas.getByRole('table', { name: 'Bugs reported and fixed, by day' }),
    )
      .getAllByRole('row')
      .map((row) => [...row.children].map((cell) => cell.textContent));
    await expect(rows).toHaveLength(8);
    await expect(rows[0]).toEqual(['', 'Reported', 'Fixed']);
    await expect(rows[1]).toEqual(['Nov 19', '3', '2']);
  },
};

export const Hover: Story = {
  name: 'Tooltip on hover',
  play: async ({ canvasElement }) => {
    const column =
      canvasElement.querySelectorAll<HTMLElement>('[data-column]')[2];
    if (column === undefined) throw new Error('No column');
    await userEvent.hover(column);
    const tooltip = column.querySelector('[data-tooltip]');
    await expect(
      [...(tooltip?.children ?? [])].map((line) => line.textContent),
    ).toEqual(['Nov 21', '1 reported · 2 fixed']);
    await expect(
      canvasElement.querySelectorAll<HTMLElement>('[data-column]')[0],
    ).toHaveStyle({ opacity: '0.45' });
  },
};

export const AllZero: Story = {
  name: 'Every bucket at 0',
  args: { buckets: days([0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]) },
  play: async ({ canvasElement }) => {
    const all = [
      ...bars(canvasElement, 'Reported'),
      ...bars(canvasElement, 'Fixed'),
    ];
    await expect(all).toHaveLength(14);
    for (const bar of all) {
      await expect(bar).toHaveStyle({ height: '2px' });
      await expect(bar.dataset['draw']).toBe('empty');
    }
  },
};
