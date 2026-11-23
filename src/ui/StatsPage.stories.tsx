import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import {
  autonomyLoaderOf,
  autonomyOf,
  monthCounts,
  previousMonthCounts,
  qualityLoaderOf,
} from './stats-fixtures.ts';
import { figureTexts, loaded, statsRouter } from './stats-story.ts';
import { StatsPage } from './StatsPage.tsx';

const meta = {
  component: StatsPage,
  args: { loadAutonomy: autonomyLoaderOf(), loadQuality: qualityLoaderOf() },
  decorators: [statsRouter],
} satisfies Meta<typeof StatsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function changeColors(canvasElement: HTMLElement): string[] {
  return [
    ...canvasElement.querySelectorAll<HTMLElement>(
      '.fd-stats-autonomy .fd-stats-figures [data-change]',
    ),
  ].map((line) => line.style.color);
}

export const RisingMonth: Story = {
  name: 'Figures rising against the previous 30 days',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await loaded(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Stats' }),
    ).toBeVisible();
    await expect(
      canvas.getByText('24 issues merged · 18 without a person'),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Last 30 days', pressed: true }),
    ).toBeVisible();
    await expect(figureTexts(canvasElement, '[data-value]')).toEqual([
      '75%',
      '25%',
      '4 h 03 min',
    ]);
    await expect(figureTexts(canvasElement, '[data-sample]')).toEqual([
      'n = 24 merged issues',
      'n = 24 merged issues',
      'n = 6 answered questions',
    ]);
    await expect(figureTexts(canvasElement, '[data-change]')).toEqual([
      '▲up 20 pts vs previous 30 days',
      '▼down 10 pts vs previous 30 days',
      '▼down 55% vs previous 30 days',
    ]);
    await expect(changeColors(canvasElement)).toEqual([
      'var(--fd-success)',
      'var(--fd-success)',
      'var(--fd-success)',
    ]);
    await expect(figureTexts(canvasElement, '[data-note]')).toEqual([
      '',
      '',
      '2 still waiting',
    ]);
    const trend = canvas.getByRole('table', {
      name: 'Merged without a person, by week',
    });
    const rows = within(trend).getAllByRole('row');
    await expect(rows).toHaveLength(12);
    await expect(rows[0]).toHaveTextContent('Sep 7');
    await expect(rows[11]).toHaveTextContent('this week');
    await expect(rows[10]).toHaveTextContent('86% · 6 of 7');
    const reasons = canvas.getAllByRole('listitem');
    await expect(reasons.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Spec question'),
      expect.stringContaining('Score below threshold'),
      expect.stringContaining('Gates failed'),
      expect.stringContaining('Auto-merge off'),
    ]);
    await expect(
      canvas.getByText('among 6 merged issues helped by a person'),
    ).toBeVisible();
  },
};

export const FallingMonth: Story = {
  name: 'Figures falling against the previous 30 days',
  args: {
    loadAutonomy: autonomyLoaderOf(
      autonomyOf({
        current: previousMonthCounts,
        previous: monthCounts,
        waitingNow: 0,
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-change]')).toEqual([
      '▼down 20 pts vs previous 30 days',
      '▲up 10 pts vs previous 30 days',
      '▲up 122% vs previous 30 days',
    ]);
    await expect(changeColors(canvasElement)).toEqual([
      'var(--fd-danger)',
      'var(--fd-danger)',
      'var(--fd-danger)',
    ]);
    await expect(
      canvasElement.querySelector(
        '.fd-stats-autonomy .fd-stats-figures [data-note]',
      ),
    ).toBeNull();
  },
};

export const BelowMinimumSample: Story = {
  name: 'Figures below the minimum sample',
  args: {
    loadAutonomy: autonomyLoaderOf(
      autonomyOf({
        current: {
          merged: 3,
          mergedWithoutPerson: 2,
          mergedAfterQuestion: 1,
          answeredWaitsMs: [3_600_000],
        },
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await loaded(canvasElement);
    await expect(
      canvas.getByText('3 issues merged · 2 without a person'),
    ).toBeVisible();
    await expect(figureTexts(canvasElement, '[data-value]')).toEqual([
      '—',
      '—',
      '—',
    ]);
    await expect(figureTexts(canvasElement, '[data-sample]')).toEqual([
      'Not enough data',
      'Not enough data',
      'Not enough data',
    ]);
    await expect(
      canvasElement.querySelector(
        '.fd-stats-autonomy .fd-stats-figures [data-change]',
      ),
    ).toBeNull();
  },
};

export const AllTime: Story = {
  name: 'All time, with no change line',
  parameters: { entry: '/stats?period=all' },
  args: {
    loadAutonomy: autonomyLoaderOf({
      current: monthCounts,
      waitingNow: 1,
      weeks: autonomyOf().weeks,
      reasons: autonomyOf().reasons,
    }),
  },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-value]')).toEqual([
      '75%',
      '25%',
      '4 h 03 min',
    ]);
    await expect(
      canvasElement.querySelector(
        '.fd-stats-autonomy .fd-stats-figures [data-change]',
      ),
    ).toBeNull();
    await expect(figureTexts(canvasElement, '[data-note]')).toEqual([
      '',
      '',
      '1 still waiting',
    ]);
  },
};
