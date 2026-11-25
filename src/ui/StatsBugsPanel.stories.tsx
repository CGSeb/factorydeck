import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import {
  bugStatsOf,
  bugStatsResponse,
  fewBugStats,
} from './stats-bug-fixtures.ts';
import { BUGS, bugsLoaded, figureTexts } from './stats-story.ts';
import { StatsBugsPanel } from './StatsBugsPanel.tsx';

const meta = {
  component: StatsBugsPanel,
  args: {
    response: bugStatsResponse(bugStatsOf()),
    period: '30d',
    now: new Date(2026, 10, 25, 14, 0),
  },
} satisfies Meta<typeof StatsBugsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

function strip(canvasElement: HTMLElement) {
  return within(
    within(canvasElement).getByRole('group', { name: 'Time to fix' }),
  );
}

export const EnoughData: Story = {
  name: 'Bugs with enough data',
  play: async ({ canvasElement }) => {
    await bugsLoaded(canvasElement);
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Bugs' }),
    ).toBeVisible();
    await expect(figureTexts(canvasElement, '[data-value]', BUGS)).toEqual([
      '17 h 00 min',
      '25%',
      '17%',
    ]);
    await expect(figureTexts(canvasElement, '[data-sample]', BUGS)).toEqual([
      'n = 6 merged bugs',
      'n = 24 merged issues',
      'n = 6 merged bugs',
    ]);
    await expect(figureTexts(canvasElement, '[data-change]', BUGS)).toEqual([
      '▼down 37% vs previous 30 days',
      '▼down 15 pts vs previous 30 days',
      '▼down 8 pts vs previous 30 days',
    ]);
    const links = strip(canvasElement).getAllByRole('link');
    await expect(links).toHaveLength(6);
    await expect(links[0]).toHaveAttribute(
      'href',
      '/features/61?project=%2Fwork%2Fexample-app&period=30d',
    );
    await expect(links[0]).toHaveAccessibleName(/#61 Crash on empty list/);
    const rows = within(
      canvas.getByRole('table', { name: 'Bugs in delivered work, by week' }),
    ).getAllByRole('row');
    await expect(rows).toHaveLength(12);
    await expect(rows[0]).toHaveTextContent('40% · 2 of 5');
    await expect(rows[11]).toHaveTextContent('this week');
  },
};

export const NotEnoughData: Story = {
  name: 'Bugs below the minimum sample',
  args: { response: bugStatsResponse(fewBugStats) },
  play: async ({ canvasElement }) => {
    await bugsLoaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-sample]', BUGS)).toEqual([
      'Not enough data',
      'n = 24 merged issues',
      'Not enough data',
    ]);
    await expect(
      strip(canvasElement).getByText('Not enough data for median and p90'),
    ).toBeVisible();
  },
};

export const Loading: Story = {
  args: { response: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading…')).toBeVisible();
  },
};

export const Unreachable: Story = {
  args: { response: { status: 'unreachable', refreshSeconds: 3600 } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', { level: 2, name: 'Bugs' }),
    ).toBeVisible();
    await expect(canvasElement.querySelector(BUGS)).toBeNull();
  },
};
