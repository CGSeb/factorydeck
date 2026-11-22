import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  launchDays,
  tokenDays,
  tokenHours,
  zeroDays,
} from './chart-fixtures.ts';
import { DayBars } from './DayBars.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/DayBars',
  component: DayBars,
  decorators: [surfaceFrame],
  args: {
    label: 'Tokens per day',
    buckets: tokenDays(7),
    color: 'var(--fd-ink)',
    height: 56,
  },
} satisfies Meta<typeof DayBars>;

export default meta;

type Story = StoryObj<typeof meta>;

function chart(canvasElement: HTMLElement, name: string): HTMLElement {
  return within(canvasElement).getByRole('img', { name });
}

function columns(canvasElement: HTMLElement, name: string): HTMLElement[] {
  return [
    ...chart(canvasElement, name).querySelectorAll<HTMLElement>(
      '[data-column]',
    ),
  ];
}

function labels(canvasElement: HTMLElement, name: string): string[] {
  return [
    ...chart(canvasElement, name).querySelectorAll('[data-labels] > span'),
  ].map((label) => label.textContent);
}

async function tooltipOf(bar: HTMLElement | undefined): Promise<string[]> {
  const column = bar?.parentElement;
  if (column == null) throw new Error('No column');
  await userEvent.hover(column);
  const tooltip = column.querySelector('[data-tooltip]');
  if (tooltip === null) throw new Error('No tooltip');
  return [...tooltip.children].map((line) => line.textContent);
}

function spokenRows(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('row')
    .map((row) => row.textContent);
}

export const SevenDays: Story = {
  name: '7 days',
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement, 'Tokens per day');
    await expect(bars).toHaveLength(7);
    await expect(bars[5]).toHaveStyle({
      height: '56px',
      borderRadius: '4px 4px 0 0',
    });
    await expect(bars[3]).toHaveStyle({ height: '2px' });
    await expect(await tooltipOf(bars[1])).toEqual(['Nov 2', '1.9M tokens']);
    await expect(labels(canvasElement, 'Tokens per day')).toEqual([
      'Nov 1',
      'Nov 2',
      'Nov 3',
      'Nov 4',
      'Nov 5',
      'Nov 6',
      'Nov 7',
    ]);
    await expect(spokenRows(canvasElement)[0]).toBe('Nov 11.2M tokens');
    await expect(
      within(canvasElement).getByRole('table', { name: 'Tokens per day' }),
    ).toBeInTheDocument();
  },
};

export const ThirtyDays: Story = {
  name: '30 days',
  args: { buckets: tokenDays(30) },
  play: async ({ canvasElement }) => {
    await expect(columns(canvasElement, 'Tokens per day')).toHaveLength(30);
    await expect(labels(canvasElement, 'Tokens per day')).toEqual([
      'Nov 1',
      'Nov 30',
    ]);
    await expect(spokenRows(canvasElement)).toHaveLength(30);
  },
};

export const TwentyFourHours: Story = {
  name: '24 hours',
  args: { label: 'Tokens per hour', buckets: tokenHours() },
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement, 'Tokens per hour');
    await expect(bars).toHaveLength(24);
    await expect(await tooltipOf(bars[14])).toEqual(['14:00', '30.0K tokens']);
    await expect(labels(canvasElement, 'Tokens per hour')).toEqual([
      '00:00',
      '23:00',
    ]);
  },
};

export const AllZero: Story = {
  name: 'All zero',
  args: { buckets: zeroDays(7) },
  play: async ({ canvasElement }) => {
    const heights = columns(canvasElement, 'Tokens per day').map(
      (bar) => bar.style.height,
    );
    await expect(heights).toEqual(Array.from({ length: 7 }, () => '2px'));
    await expect(spokenRows(canvasElement)[0]).toBe('Nov 10 tokens');
  },
};

export const LaunchesAsCounts: Story = {
  name: 'Launches as counts',
  args: {
    label: 'Launches per day',
    buckets: launchDays(14),
    color: 'var(--fd-accent)',
    height: 80,
  },
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement, 'Launches per day');
    await expect(bars[0]).toHaveStyle({ height: '40px' });
    await expect(bars[1]).toHaveStyle({ height: '80px' });
    await expect(await tooltipOf(bars[0])).toEqual(['Nov 1', '2']);
    await expect(spokenRows(canvasElement)[1]).toBe('Nov 24');
  },
};

export const LaunchesWithCounts: Story = {
  name: 'Launches with counts',
  args: {
    label: 'Launches per day',
    buckets: launchDays(7),
    color: 'var(--fd-accent)',
    height: 80,
    showValues: true,
  },
  play: async ({ canvasElement }) => {
    const chartElement = chart(canvasElement, 'Launches per day');
    const values = [...chartElement.querySelectorAll('[data-value]')].map(
      (value) => value.textContent,
    );
    await expect(values).toEqual(
      launchDays(7).map((bucket) => String(bucket.value)),
    );
    await expect(columns(canvasElement, 'Launches per day')[1]).toHaveStyle({
      height: '80px',
    });
  },
};

export const Hovered: Story = {
  name: 'Hovered column',
  play: async ({ canvasElement }) => {
    const bars = columns(canvasElement, 'Tokens per day');
    await expect(await tooltipOf(bars[6])).toEqual(['Nov 7', '900.0K tokens']);
    await expect(bars[6]).toHaveStyle({ opacity: '1' });
    await expect(bars[0]).toHaveStyle({ opacity: '0.45' });
    const column = bars[6]?.parentElement;
    if (column == null) throw new Error('No column');
    await userEvent.unhover(column);
    await expect(
      chart(canvasElement, 'Tokens per day').querySelector('[data-tooltip]'),
    ).toBeNull();
  },
};
