import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { FlowStats } from '../stats/types.ts';
import {
  flowIssues,
  flowOf,
  flowResponse,
  monthTokens,
  noTokens,
} from './flow-fixtures.ts';
import { FLOW, figureTexts, flowLoaded } from './stats-story.ts';
import { StatsFlowPanel } from './StatsFlowPanel.tsx';

const meta = {
  component: StatsFlowPanel,
  args: { response: flowResponse(flowOf()), period: '30d' },
} satisfies Meta<typeof StatsFlowPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

function strip(canvasElement: HTMLElement, name: string) {
  return within(within(canvasElement).getByRole('group', { name }));
}

function responseOf(overrides: Partial<FlowStats>) {
  return flowResponse(flowOf(overrides));
}

async function expectWeeks(canvasElement: HTMLElement): Promise<void> {
  const weeks = within(
    within(canvasElement).getByRole('table', { name: 'Merged per week' }),
  ).getAllByRole('row');
  await expect(weeks).toHaveLength(12);
  await expect(weeks[10]).toHaveTextContent('7 issues');
  await expect(weeks[11]).toHaveTextContent('this week');
}

async function expectFigures(canvasElement: HTMLElement): Promise<void> {
  await expect(figureTexts(canvasElement, '[data-value]', FLOW)).toEqual([
    '1 d 18 h',
    '18 h 00 min',
    '1.2M',
    '5%',
    '15%',
    '80%',
  ]);
  await expect(figureTexts(canvasElement, '[data-sample]', FLOW)).toEqual([
    'n = 10 merged issues',
    'n = 9 merged issues with agent work',
    'n = 9 merged issues with agent work',
    'n = 1200 API calls',
    'n = 1200 API calls',
    'n = 1200 API calls',
  ]);
}

async function expectChanges(canvasElement: HTMLElement): Promise<void> {
  await expect(figureTexts(canvasElement, '[data-change]', FLOW)).toEqual([
    '▼down 35% vs previous 30 days',
    '▼down 31% vs previous 30 days',
    '▼down 20% vs previous 30 days',
    '▼down 5 pts vs previous 30 days',
    '▲up 3 pts vs previous 30 days',
    '▲up 10 pts vs previous 30 days',
  ]);
  await expect(
    [
      ...canvasElement.querySelectorAll<HTMLElement>(
        '.fd-stats-flow [data-change]',
      ),
    ].map((line) => line.style.color),
  ).toEqual([
    'var(--fd-success)',
    'var(--fd-success)',
    'var(--fd-success)',
    'var(--fd-success)',
    'var(--fd-danger)',
    'var(--fd-success)',
  ]);
}

async function expectStrips(canvasElement: HTMLElement): Promise<void> {
  const lead = strip(canvasElement, 'Lead time').getAllByRole('link');
  await expect(lead).toHaveLength(10);
  const tokens = strip(canvasElement, 'Tokens per merged issue');
  await expect(tokens.getAllByRole('link')).toHaveLength(9);
  await expect(
    tokens.getByRole('link', { name: '#50 Link sessions to issues, 9.6M' }),
  ).toHaveAttribute(
    'href',
    '/features/50?project=%2Fwork%2Fexample-app&period=30d',
  );
  await expect(
    tokens.getByRole('link', { name: '#44, 1.1M' }),
  ).toBeInTheDocument();
}

export const AboveMinimumSample: Story = {
  name: 'Figures above the minimum sample, with an outlier',
  play: async ({ canvasElement }) => {
    await flowLoaded(canvasElement);
    await expectWeeks(canvasElement);
    await expectFigures(canvasElement);
    await expectChanges(canvasElement);
    await expect(
      within(canvasElement).getByRole('heading', {
        level: 3,
        name: 'Where the tokens went',
      }),
    ).toBeVisible();
    await expectStrips(canvasElement);
  },
};

export const AllTime: Story = {
  name: 'All time, with no change line',
  args: {
    response: flowResponse({
      current: flowOf().current,
      weeks: flowOf().weeks,
    }),
    period: 'all',
  },
  play: async ({ canvasElement }) => {
    await flowLoaded(canvasElement);
    await expect(
      canvasElement.querySelector('.fd-stats-flow [data-change]'),
    ).toBeNull();
  },
};

export const Loading: Story = {
  args: { response: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'Flow and cost' }),
    ).toBeVisible();
    await expect(canvas.getByText('Loading…')).toBeVisible();
  },
};

export const Unreachable: Story = {
  args: { response: { status: 'unreachable', refreshSeconds: 3600 } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Database unreachable/),
    ).toBeVisible();
  },
};

export const ManyCloseValues: Story = {
  name: 'Strips with many close values',
  args: {
    response: responseOf({
      current: {
        issues: flowIssues(
          Array.from({ length: 24 }, (_, index) => [
            48 + index * 0.2,
            24,
            1_000_000 + index * 2_000,
          ]),
        ),
        tokens: monthTokens,
      },
    }),
  },
  play: async ({ canvasElement }) => {
    await flowLoaded(canvasElement);
    await expect(
      strip(canvasElement, 'Lead time').getAllByRole('link'),
    ).toHaveLength(24);
    await expect(
      canvasElement.querySelectorAll('.fd-stats-flow [data-pill]').length,
    ).toBeGreaterThan(0);
  },
};

export const BelowMinimumSample: Story = {
  name: 'Figures below the minimum sample',
  args: {
    response: responseOf({
      current: {
        issues: flowIssues([
          [20, 10, 900_000],
          [30, null, null],
          [40, 12, 1_100_000],
        ]),
        tokens: { ...monthTokens, apiCalls: 4 },
      },
    }),
  },
  play: async ({ canvasElement }) => {
    await flowLoaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-sample]', FLOW)).toEqual(
      Array.from({ length: 6 }, () => 'Not enough data'),
    );
    await expect(
      canvasElement.querySelector('.fd-stats-flow [data-change]'),
    ).toBeNull();
    await expect(
      strip(canvasElement, 'Lead time').getByText(
        'Not enough data for median and p90',
      ),
    ).toBeVisible();
  },
};

export const NoMergedIssue: Story = {
  name: 'No merged issue in the period',
  args: {
    response: responseOf({ current: { issues: [], tokens: monthTokens } }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await flowLoaded(canvasElement);
    await expect(
      figureTexts(canvasElement, '[data-sample]', FLOW).slice(0, 3),
    ).toEqual(['Not enough data', 'Not enough data', 'Not enough data']);
    await expect(
      strip(canvasElement, 'Lead time').getByText('No data'),
    ).toBeVisible();
    await expect(
      strip(canvasElement, 'Tokens per merged issue').getByText('No data'),
    ).toBeVisible();
    await expect(
      canvas.getByRole('table', { name: 'Merged per week' }),
    ).toBeInTheDocument();
  },
};

export const NoCallInPeriod: Story = {
  name: 'No call in the period',
  args: {
    response: responseOf({
      current: {
        issues: flowIssues(
          [30, 40, 50, 60, 70].map((lead) => [lead, null, null] as const),
        ),
        tokens: noTokens,
      },
    }),
  },
  play: async ({ canvasElement }) => {
    await flowLoaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-value]', FLOW)).toEqual([
      '2 d 2 h',
      '—',
      '—',
      '—',
      '—',
      '—',
    ]);
    await expect(figureTexts(canvasElement, '[data-sample]', FLOW)).toEqual([
      'n = 5 merged issues',
      'Not enough data',
      'Not enough data',
      'Not enough data',
      'Not enough data',
      'Not enough data',
    ]);
    await expect(
      strip(canvasElement, 'Tokens per merged issue').getByText('No data'),
    ).toBeVisible();
  },
};
