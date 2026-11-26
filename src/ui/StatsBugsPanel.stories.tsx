import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  bugStatsOf,
  bugStatsResponse,
  fewBugStats,
  openedNoFixStats,
  quietBugStats,
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

const REPORTED = 'Bugs reported and fixed, by week';

function reportedRows(canvasElement: HTMLElement): (string | null)[][] {
  return within(within(canvasElement).getByRole('table', { name: REPORTED }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent));
}

function bars(canvasElement: HTMLElement, series: string): HTMLElement[] {
  return [
    ...canvasElement.querySelectorAll<HTMLElement>(`[data-bar="${series}"]`),
  ];
}

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
      '20',
    ]);
    await expect(figureTexts(canvasElement, '[data-sample]', BUGS)).toEqual([
      'n = 6 merged bugs',
      'n = 24 merged issues',
      'n = 6 merged bugs',
      '15 created · 5 reopened',
    ]);
    await expect(figureTexts(canvasElement, '[data-change]', BUGS)).toEqual([
      '▼down 37% vs previous 30 days',
      '▼down 15 pts vs previous 30 days',
      '▼down 8 pts vs previous 30 days',
      '▲up 25% vs previous 30 days',
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

export const ReportedAndFixed: Story = {
  name: 'Bugs reported and fixed in several weeks',
  play: async ({ canvasElement }) => {
    await bugsLoaded(canvasElement);
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: REPORTED })).toBeVisible();
    await expect(
      [...canvasElement.querySelectorAll('[data-legend] li')].map(
        (item) => item.textContent,
      ),
    ).toEqual(['Reported', 'Fixed']);
    const rows = reportedRows(canvasElement);
    await expect(rows).toHaveLength(12);
    await expect(rows[0]).toEqual([expect.any(String), '3', '2']);
    await expect(rows[2]).toEqual([expect.any(String), '1', '2']);
    await expect(rows[11]).toEqual(['this week', '1', '0']);
    await expect(bars(canvasElement, 'Reported')[3]).toHaveStyle({
      height: '64px',
    });
    await expect(bars(canvasElement, 'Fixed')[11]).toHaveStyle({
      height: '2px',
    });
    const column = canvasElement.querySelectorAll<HTMLElement>(
      `${BUGS} [data-column]`,
    );
    const last = [...column].at(-1);
    if (last === undefined) throw new Error('No column');
    await userEvent.hover(last);
    await expect(last.querySelector('[data-tooltip]')).toHaveTextContent(
      '1 reported · 0 fixed',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'About Bugs reported' }),
    );
    await expect(await canvas.findByRole('tooltip')).toHaveTextContent(
      'Number of times a bug was opened in the period: each creation and each reopening counts.',
    );
  },
};

export const OpenedNoFix: Story = {
  name: 'Bugs reported with no bug merged',
  args: { response: bugStatsResponse(openedNoFixStats) },
  play: async ({ canvasElement }) => {
    await bugsLoaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-value]', BUGS)).toEqual([
      '—',
      '0%',
      '—',
      '4',
    ]);
    await expect(figureTexts(canvasElement, '[data-sample]', BUGS)).toEqual([
      'Not enough data',
      'n = 24 merged issues',
      'Not enough data',
      '3 created · 1 reopened',
    ]);
    await expect(figureTexts(canvasElement, '[data-change]', BUGS).at(-1)).toBe(
      '▲up 100% vs previous 30 days',
    );
    const rows = reportedRows(canvasElement);
    await expect(rows[9]?.slice(1)).toEqual(['3', '0']);
    await expect(rows[11]?.slice(1)).toEqual(['1', '0']);
  },
};

export const Quiet: Story = {
  name: 'No bug reported and none fixed',
  args: { response: bugStatsResponse(quietBugStats) },
  play: async ({ canvasElement }) => {
    await bugsLoaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-value]', BUGS).at(-1)).toBe(
      '0',
    );
    await expect(figureTexts(canvasElement, '[data-sample]', BUGS).at(-1)).toBe(
      '0 created · 0 reopened',
    );
    const all = [
      ...bars(canvasElement, 'Reported'),
      ...bars(canvasElement, 'Fixed'),
    ];
    await expect(all).toHaveLength(24);
    for (const bar of all) {
      await expect(bar).toHaveStyle({ height: '2px' });
    }
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
      '3 created · 1 reopened',
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
