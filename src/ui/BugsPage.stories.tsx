import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { createElement } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  BUGS_NOW,
  bugList,
  bugRow,
  bugsLoaderOf,
  fixedBugs,
  fixingBugs,
  openBugs,
} from './bug-fixtures.ts';
import { NO_BUG_TEXT, NO_BUG_TICKETS_TEXT } from './bugs-view.ts';
import { BugsPage } from './BugsPage.tsx';
import { APP } from './feature-fixtures.ts';
import { rowHeaders } from './features-story.ts';

function at(fallback: string): Decorator {
  return (Story, { parameters }) => {
    const entry: unknown = parameters['entry'];
    return createElement(
      MemoryRouter,
      { initialEntries: [typeof entry === 'string' ? entry : fallback] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/bugs', element: createElement(Story) }),
      ),
    );
  };
}

const meta = {
  component: BugsPage,
  args: { loadBugs: bugsLoaderOf(), now: BUGS_NOW },
  decorators: [at('/bugs?period=7d')],
} satisfies Meta<typeof BugsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function groupHeaders(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('columnheader')
    .filter((cell) => cell.getAttribute('scope') === 'colgroup')
    .map((cell) => cell.textContent);
}

function rowOf(canvasElement: HTMLElement, name: string): HTMLElement {
  const header = within(canvasElement).getByRole('rowheader', { name });
  const row = header.closest('tr');
  if (row === null) throw new Error(`No row for ${name}`);
  return row;
}

export const ThreeGroups: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', {
      name: 'Export drops the last row (#72)',
    });
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Bugs' }),
    ).toBeVisible();
    await expect(
      canvas.getByText('4 open · 4 fixed · 1 closed without a fix'),
    ).toBeVisible();
    await expect(groupHeaders(canvasElement)).toEqual([
      'Open2',
      'Fixing2',
      'Fixed5',
    ]);
    await expect(rowHeaders(canvasElement)).toEqual([
      'Export drops the last row (#72)',
      'Wrong total on the invoice (#75)',
      'Login loops on refresh (#77)',
      'Search ignores accents (#76)',
      'Empty state shows twice (#70)',
      'Date shifts by one day (#69)',
      'Sort order lost on reload (#68)',
      'Tooltip cut off (#67)',
      'Crash on an empty file (#66)',
    ]);
    await expect(
      canvas.getByRole('columnheader', { name: 'Project' }),
    ).toBeVisible();
    const blocked = within(
      rowOf(canvasElement, 'Export drops the last row (#72)'),
    );
    await expect(blocked.getByText('Blocked')).toBeVisible();
    await expect(blocked.getByText('Open for 3 d 4 h')).toBeVisible();
    await expect(blocked.getAllByText('—')).toHaveLength(2);
    await expect(
      within(rowOf(canvasElement, 'Empty state shows twice (#70)')).getByText(
        'Fixed in 2 d 0 h',
      ),
    ).toBeVisible();
    await expect(
      within(rowOf(canvasElement, 'Crash on an empty file (#66)')).getByText(
        'Closed after 2 d 12 h',
      ),
    ).toBeVisible();
    await expect(
      within(rowOf(canvasElement, 'Login loops on refresh (#77)')).getByText(
        '72 below threshold',
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'Empty state shows twice (#70)' }),
    ).toHaveAttribute(
      'href',
      `/features/70?project=${encodeURIComponent(APP)}&period=7d`,
    );
  },
};

export const ReproducedValues: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('rowheader', {
      name: 'Empty state shows twice (#70)',
    });
    const cases: [string, string, string | null][] = [
      ['Empty state shows twice (#70)', 'Failed on main', 'success'],
      ['Login loops on refresh (#77)', 'Passed on main', 'warning'],
      ['Date shifts by one day (#69)', 'Did not run on main', 'warning'],
      ['Sort order lost on reload (#68)', 'No test', 'warning'],
    ];
    for (const [name, text, tone] of cases) {
      const value = within(rowOf(canvasElement, name)).getByText(text);
      await expect(value).toHaveAttribute('data-tone', tone);
    }
    for (const name of [
      'Tooltip cut off (#67)',
      'Search ignores accents (#76)',
    ]) {
      const cells = within(rowOf(canvasElement, name)).getAllByRole('cell');
      await expect(cells.map((cell) => cell.textContent)).toContain('—');
    }
  },
};

export const OneProject: Story = {
  args: {
    loadBugs: bugsLoaderOf(
      bugList({
        open: openBugs.filter((row) => row.project === APP),
        fixing: fixingBugs,
        fixed: fixedBugs,
      }),
    ),
  },
  parameters: { entry: `/bugs?period=7d&project=${encodeURIComponent(APP)}` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', {
      name: 'Export drops the last row (#72)',
    });
    await expect(
      canvas.queryByRole('columnheader', { name: 'Project' }),
    ).toBeNull();
    await expect(
      canvas.getByText('3 open · 4 fixed · 1 closed without a fix'),
    ).toBeVisible();
  },
};

const manyOpen = Array.from({ length: 25 }, (_, index) =>
  bugRow(10_000 + index, `Open bug ${String(index + 1)}`),
);

export const ShowMore: Story = {
  args: { loadBugs: bugsLoaderOf(bugList({ open: manyOpen })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', { name: 'Open bug 1 (#10000)' });
    await expect(rowHeaders(canvasElement)).toHaveLength(20);
    await expect(canvas.getByText('20 of 25')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show more' }));
    await expect(rowHeaders(canvasElement)).toHaveLength(25);
    await expect(
      canvas.queryByRole('button', { name: 'Show more' }),
    ).toBeNull();
  },
};

export const ShowMoreResetsOnPeriodChange: Story = {
  args: { loadBugs: bugsLoaderOf(bugList({ open: manyOpen })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', { name: 'Open bug 1 (#10000)' });
    await userEvent.click(canvas.getByRole('button', { name: 'Show more' }));
    await expect(rowHeaders(canvasElement)).toHaveLength(25);
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await waitFor(() => expect(rowHeaders(canvasElement)).toHaveLength(20));
    await expect(canvas.getByText('20 of 25')).toBeVisible();
  },
};

export const ShowMoreResetsOnProjectChange: Story = {
  args: { loadBugs: bugsLoaderOf(bugList({ open: manyOpen })) },
  render: (args) => (
    <>
      <BugsPage {...args} />
      <Link to={`/bugs?period=7d&project=${encodeURIComponent(APP)}`}>
        Choose example-app
      </Link>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', { name: 'Open bug 1 (#10000)' });
    await userEvent.click(canvas.getByRole('button', { name: 'Show more' }));
    await expect(rowHeaders(canvasElement)).toHaveLength(25);
    await userEvent.click(
      canvas.getByRole('link', { name: 'Choose example-app' }),
    );
    await waitFor(() => expect(rowHeaders(canvasElement)).toHaveLength(20));
  },
};

export const NoBug: Story = {
  args: { loadBugs: bugsLoaderOf(bugList()) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(NO_BUG_TEXT);
    await expect(canvas.getByText('0 open · 0 fixed')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

export const NoBugTickets: Story = {
  args: { loadBugs: bugsLoaderOf(bugList({}, false)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(NO_BUG_TICKETS_TEXT);
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(
      canvasElement.querySelector('.fd-page-summary'),
    ).toHaveTextContent(/^\s*$/);
  },
};

export const Loading: Story = {
  args: { loadBugs: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading…')).toBeVisible();
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Bugs' }),
    ).toBeVisible();
    await expect(canvas.getByRole('group', { name: 'Period' })).toBeVisible();
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadBugs: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};
