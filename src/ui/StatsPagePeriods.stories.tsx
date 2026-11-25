import type { Meta, StoryObj } from '@storybook/react-vite';
import { bugStatsLoaderOf } from './stats-bug-fixtures.ts';
import { expect, within } from 'storybook/test';
import { autonomyLoaderOf, qualityLoaderOf } from './stats-fixtures.ts';
import { flowLoaderOf } from './flow-fixtures.ts';
import {
  PERIOD_NOW,
  type PeriodTrend,
  monthTrend,
  monthsTrend,
  periodLoaders,
  todayTrend,
  weekTrend,
  weeksTrend,
} from './stats-period-fixtures.ts';
import { statsRouter } from './stats-story.ts';
import { StatsPage } from './StatsPage.tsx';

const meta = {
  component: StatsPage,
  args: {
    loadAutonomy: autonomyLoaderOf(),
    loadQuality: qualityLoaderOf(),
    loadFlow: flowLoaderOf(),
    loadBugStats: bugStatsLoaderOf(),
    now: PERIOD_NOW,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1024 }}>
        <Story />
      </div>
    ),
    statsRouter,
  ],
} satisfies Meta<typeof StatsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

interface Expected {
  unit: string;
  count: number;
  labels: string[];
  small: number;
}

function drawsOf(chart: HTMLElement): string[] {
  return [...chart.querySelectorAll<HTMLElement>('[data-column]')].map(
    (bar) => bar.dataset['draw'] ?? '',
  );
}

async function expectTrends(
  canvasElement: HTMLElement,
  { unit, count, labels, small }: Expected,
): Promise<void> {
  const canvas = within(canvasElement);
  const autonomy = await canvas.findByRole('img', {
    name: `Merged without a person, by ${unit}`,
  });
  const quality = canvas.getByRole('img', {
    name: `Right the first time, by ${unit}`,
  });
  const merged = canvas.getByRole('img', { name: `Merged per ${unit}` });
  for (const chart of [autonomy, quality, merged]) {
    await expect(drawsOf(chart)).toHaveLength(count);
    await expect(
      [...chart.querySelectorAll('[data-labels] > span')].map(
        (label) => label.textContent,
      ),
    ).toEqual(labels);
  }
  await expect(
    drawsOf(autonomy).filter((draw) => draw === 'small'),
  ).toHaveLength(small);
}

function trendStory(
  name: string,
  entry: string,
  trend: PeriodTrend,
  expected: Expected,
): Story {
  return {
    name,
    parameters: { entry },
    args: periodLoaders(trend),
    play: async ({ canvasElement }) => {
      await expectTrends(canvasElement, expected);
    },
  };
}

export const Today = trendStory(
  'Today, 24 hours at 1024 px',
  '/stats?period=today',
  todayTrend,
  { unit: 'hour', count: 24, labels: ['00:00', '23:00'], small: 4 },
);

export const LastSevenDays = trendStory(
  'Last 7 days, by day at 1024 px',
  '/stats?period=7d',
  weekTrend,
  {
    unit: 'day',
    count: 7,
    labels: [
      'Nov 17',
      'Nov 18',
      'Nov 19',
      'Nov 20',
      'Nov 21',
      'Nov 22',
      'today',
    ],
    small: 4,
  },
);

export const LastThirtyDays = trendStory(
  'Last 30 days, by day at 1024 px',
  '/stats?period=30d',
  monthTrend,
  { unit: 'day', count: 30, labels: ['Oct 25', 'today'], small: 15 },
);

export const AllTimeWeeks = trendStory(
  'All time, by week at 1024 px',
  '/stats?period=all',
  weeksTrend,
  { unit: 'week', count: 9, labels: ['Sep 28', 'this week'], small: 4 },
);

export const AllTimeMonths = trendStory(
  'All time, by month at 1024 px',
  '/stats?period=all',
  monthsTrend,
  { unit: 'month', count: 9, labels: ['Mar 2026', 'this month'], small: 1 },
);

export const CurrentHour: Story = {
  ...Today,
  name: 'Today, the current hour named',
  play: async ({ canvasElement }) => {
    const table = await within(canvasElement).findByRole('table', {
      name: 'Merged without a person, by hour',
    });
    const rows = within(table).getAllByRole('row');
    await expect(rows[14]).toHaveTextContent('this hour');
    await expect(rows[14]).toHaveTextContent('67% · 2 of 3');
    await expect(rows[14]).toHaveTextContent('n = 3 · small sample');
    await expect(rows[15]).toHaveTextContent('15:00');
    await expect(rows[15]).toHaveTextContent('No issue merged');
  },
};
