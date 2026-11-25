import type { Meta, StoryObj } from '@storybook/react-vite';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, within } from 'storybook/test';
import {
  BUGS_NOW,
  bugList,
  bugsLoaderOf,
  openBugs,
  reopenedFixedBug,
  reopenedOpenBug,
  thirdVersionBug,
} from './bug-fixtures.ts';
import { BugsPage } from './BugsPage.tsx';

const meta = {
  title: 'BugsPage/Versions',
  component: BugsPage,
  args: { loadBugs: bugsLoaderOf(), now: BUGS_NOW },
  decorators: [
    (Story) =>
      createElement(
        MemoryRouter,
        { initialEntries: ['/bugs?period=7d'] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: '/bugs',
            element: createElement(Story),
          }),
        ),
      ),
  ],
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

export const ReopenedOpen: Story = {
  args: {
    loadBugs: bugsLoaderOf(bugList({ open: [reopenedOpenBug, ...openBugs] })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = 'Upload stalls at 99% (#80) Version 2';
    await canvas.findByRole('rowheader', { name });
    const row = within(rowOf(canvasElement, name));
    await expect(row.getByText('v2')).toBeVisible();
    await expect(row.getByText('Version 2')).toHaveClass('fd-visually-hidden');
    await expect(row.getByText('Open for 5 h 00 min')).toBeVisible();
    await expect(row.getAllByText('—')).toHaveLength(2);
    await expect(row.getAllByRole('cell').at(-1)).toHaveTextContent(/^0/);
    await expect(canvas.getByText('3 open · 0 fixed')).toBeVisible();
  },
};

export const ReopenedFixed: Story = {
  args: {
    loadBugs: bugsLoaderOf(bugList({ fixed: [reopenedFixedBug] })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = 'Totals round twice (#81) Version 2';
    await canvas.findByRole('rowheader', { name });
    const row = within(rowOf(canvasElement, name));
    await expect(row.getByText('v2')).toBeVisible();
    await expect(row.getByText('Fixed in 1 d 0 h')).toBeVisible();
    await expect(row.getByText('Failed on main')).toBeVisible();
    await expect(row.getByText('86')).toBeVisible();
    await expect(groupHeaders(canvasElement)).toEqual(['Fixed1']);
  },
};

export const ThirdVersionFixing: Story = {
  args: {
    loadBugs: bugsLoaderOf(bugList({ fixing: [thirdVersionBug] })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = 'Session expires early (#82) Version 3';
    await canvas.findByRole('rowheader', { name });
    const row = within(rowOf(canvasElement, name));
    await expect(row.getByText('v3')).toBeVisible();
    await expect(row.getByText('Working')).toBeVisible();
    await expect(row.getByText('Open for 8 h 00 min')).toBeVisible();
    await expect(groupHeaders(canvasElement)).toEqual(['Fixing1']);
  },
};

export const NeverReopened: Story = {
  args: { loadBugs: bugsLoaderOf(bugList({ open: openBugs })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = 'Export drops the last row (#72)';
    await canvas.findByRole('rowheader', { name });
    const row = rowOf(canvasElement, name);
    await expect(row.querySelector('.fd-bug-version')).toBeNull();
    await expect(within(row).queryByText(/^Version /)).toBeNull();
  },
};
