import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import {
  autonomyLoaderOf,
  emptyQualityWeeks,
  monthQuality,
  noQuality,
  previousMonthQuality,
  qualityLoaderOf,
  qualityOf,
  unreachableAutonomy,
  unreachableQuality,
} from './stats-fixtures.ts';
import {
  QUALITY,
  figureTexts,
  loaded,
  panelOf,
  qualityLoaded,
  statsRouter,
} from './stats-story.ts';
import { flowLoaderOf } from './flow-fixtures.ts';
import { StatsPage } from './StatsPage.tsx';

const meta = {
  component: StatsPage,
  args: {
    loadAutonomy: autonomyLoaderOf(),
    loadQuality: qualityLoaderOf(),
    loadFlow: flowLoaderOf(),
  },
  decorators: [statsRouter],
} satisfies Meta<typeof StatsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function changeColors(canvasElement: HTMLElement): string[] {
  return [
    ...canvasElement.querySelectorAll<HTMLElement>(
      `${QUALITY} .fd-stats-figures [data-change]`,
    ),
  ].map((line) => line.style.color);
}

export const QualityFigures: Story = {
  name: 'Quality figures against the previous 30 days',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await qualityLoaded(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Quality' }),
    ).toBeVisible();
    await expect(figureTexts(canvasElement, 'span', QUALITY)).toEqual([
      'Right the first time',
      'Review rounds',
      'Reworked',
      'Closed without merge',
    ]);
    await expect(figureTexts(canvasElement, '[data-value]', QUALITY)).toEqual([
      '68%',
      '1.4',
      '21%',
      '14%',
    ]);
    await expect(figureTexts(canvasElement, '[data-sample]', QUALITY)).toEqual([
      'n = 22 merged issues with a report',
      'n = 22 merged issues',
      'n = 24 merged issues',
      'n = 28 ended issues',
    ]);
    await expect(figureTexts(canvasElement, '[data-change]', QUALITY)).toEqual([
      '▲up 13 pts vs previous 30 days',
      '▼down 21% vs previous 30 days',
      '▼down 9 pts vs previous 30 days',
      '▲up 1 pt vs previous 30 days',
    ]);
    await expect(changeColors(canvasElement)).toEqual([
      'var(--fd-success)',
      'var(--fd-success)',
      'var(--fd-success)',
      'var(--fd-danger)',
    ]);
    const trend = canvas.getByRole('table', {
      name: 'Right the first time, by week',
    });
    const rows = within(trend).getAllByRole('row');
    await expect(rows).toHaveLength(12);
    await expect(rows[0]).toHaveTextContent('Sep 7');
    await expect(rows[2]).toHaveTextContent('50% · 3 of 6');
    await expect(rows[11]).toHaveTextContent('this week');
    await expect(
      canvas.getByRole('img', { name: 'First serenity score' }),
    ).toBeInTheDocument();
  },
};

export const MixedThresholds: Story = {
  name: 'First scores with mixed thresholds',
  play: async ({ canvasElement }) => {
    await qualityLoaded(canvasElement);
    const histogram = within(panelOf(canvasElement, 'Quality')).getByRole(
      'table',
      { name: 'First serenity score' },
    );
    await expect(histogram).toBeInTheDocument();
    await expect(
      within(panelOf(canvasElement, 'Quality')).getAllByText(
        'threshold 80 · varied',
      ).length,
    ).toBeGreaterThan(0);
  },
};

export const QualityBelowMinimum: Story = {
  name: 'Quality figures below the minimum sample',
  args: {
    loadQuality: qualityLoaderOf(
      qualityOf({
        current: {
          merged: 3,
          mergedWithReport: 3,
          firstPassed: 2,
          roundsSum: 4,
          roundsCount: 3,
          reworked: 1,
          ended: 4,
          closedWithoutMerge: 1,
        },
        firstReports: qualityOf().firstReports.slice(0, 3),
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await qualityLoaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-sample]', QUALITY)).toEqual([
      'Not enough data',
      'Not enough data',
      'Not enough data',
      'Not enough data',
    ]);
    await expect(
      canvasElement.querySelector(`${QUALITY} [data-change]`),
    ).toBeNull();
    await expect(
      within(panelOf(canvasElement, 'Quality')).getAllByText('Not enough data')
        .length,
    ).toBeGreaterThan(4);
  },
};

export const QualityNoMergedIssue: Story = {
  name: 'Quality with no merged issue',
  args: {
    loadQuality: qualityLoaderOf(
      qualityOf({
        current: { ...noQuality, ended: 6, closedWithoutMerge: 6 },
        previous: previousMonthQuality,
        weeks: emptyQualityWeeks,
        firstReports: [],
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await qualityLoaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-sample]', QUALITY)).toEqual([
      'Not enough data',
      'Not enough data',
      'Not enough data',
      'Not enough data',
    ]);
    await expect(
      canvas.getByRole('img', { name: 'Right the first time, by week' }),
    ).toBeInTheDocument();
    const histogram = canvas.getByRole('img', {
      name: 'First serenity score',
    });
    await expect(histogram.querySelector('[data-empty]')).toHaveTextContent(
      'Not enough data',
    );
    await expect(
      canvas.queryByRole('table', { name: 'First serenity score' }),
    ).toBeNull();
  },
};

export const QualityAllTime: Story = {
  name: 'Quality for all time, with no change line',
  parameters: { entry: '/stats?period=all' },
  args: {
    loadQuality: qualityLoaderOf({
      current: monthQuality,
      weeks: qualityOf().weeks,
      firstReports: qualityOf().firstReports,
    }),
  },
  play: async ({ canvasElement }) => {
    await qualityLoaded(canvasElement);
    await expect(
      canvasElement.querySelector(`${QUALITY} [data-change]`),
    ).toBeNull();
  },
};

export const QualityUnreachable: Story = {
  name: 'Quality unreachable while autonomy renders',
  args: { loadQuality: unreachableQuality },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
    await expect(
      await within(panelOf(canvasElement, 'Quality')).findByText(
        /Database unreachable/,
      ),
    ).toBeVisible();
    await expect(figureTexts(canvasElement, '[data-value]')).toEqual([
      '75%',
      '25%',
      '4 h 03 min',
    ]);
  },
};

export const AutonomyUnreachable: Story = {
  name: 'Autonomy unreachable while quality renders',
  args: { loadAutonomy: unreachableAutonomy },
  play: async ({ canvasElement }) => {
    await qualityLoaded(canvasElement);
    await expect(
      await within(panelOf(canvasElement, 'Autonomy')).findByText(
        /Database unreachable/,
      ),
    ).toBeVisible();
    await expect(figureTexts(canvasElement, '[data-value]', QUALITY)).toEqual([
      '68%',
      '1.4',
      '21%',
      '14%',
    ]);
  },
};

export const BothPanelsAt1024: Story = {
  name: 'Both panels at 1024 px',
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1024 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
    await qualityLoaded(canvasElement);
    await expect(
      canvasElement.querySelectorAll(`${QUALITY} .fd-stats-figures > div`),
    ).toHaveLength(4);
  },
};
