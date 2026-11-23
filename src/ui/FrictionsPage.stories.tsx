import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  LONG_HOOK,
  frictionStats,
  frictionsLoaderOf,
} from './frictions-fixtures.ts';
import {
  columnTexts,
  frictionsLoaded,
  frictionsRouter,
  tableHeadings,
} from './frictions-story.ts';
import { FrictionsPage } from './FrictionsPage.tsx';

const meta = {
  component: FrictionsPage,
  args: { loadFrictions: frictionsLoaderOf() },
  decorators: [frictionsRouter],
} satisfies Meta<typeof FrictionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

const EVERY_TABLE = [
  'Frictions per 100 API calls, by day',
  'By category',
  'By tool',
  'Failed commands',
  'Repeated failures',
  'Stop blocked',
  'By role',
  'Issues with the most frictions',
  'Context peaks',
];

export const AllKinds: Story = {
  name: 'All, with every table',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    await expect(
      canvas.getByText('46 frictions · 2.2 per 100 API calls'),
    ).toBeVisible();
    const kinds = canvas.getByRole('group', { name: 'Kind' });
    await expect(
      within(kinds)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['All46', 'Tool errors41', 'Stop blocked5']);
    await expect(
      within(kinds).getByRole('button', { name: 'All 46' }),
    ).toHaveAttribute('aria-pressed', 'true');
    const roles = canvas.getByRole('group', { name: 'Role' });
    await expect(
      within(roles)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([
      'All46',
      'builder26',
      'reviewer9',
      'main8',
      'shipper0',
      'unassigned3',
    ]);
    await expect(
      kinds.compareDocumentPosition(roles) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect(tableHeadings(canvasElement)).toEqual(EVERY_TABLE);
    const categories = canvas.getByRole('table', { name: 'By category' });
    await expect(columnTexts(categories, 2)).toEqual([
      '54%',
      '22%',
      '22%',
      '2%',
    ]);
    const commands = canvas.getByRole('table', { name: 'Failed commands' });
    await expect(columnTexts(commands, 0)).toEqual(['pnpm', 'git', '—']);
    await expect(columnTexts(commands, 2)).toEqual([
      '1, 2, 4, 5, 7, …',
      '1',
      '—',
    ]);
  },
};

export const RepeatedFailures: Story = {
  name: 'Repeated failures with their thread',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    const table = canvas.getByRole('table', { name: 'Repeated failures' });
    const rows = within(table).getAllByRole('row');
    await expect(
      within(rows[1] ?? table).getByRole('link', { name: '#41' }),
    ).toHaveAttribute('href', '/features/41?project=%2Fwork%2Fapp&period=30d');
    await expect(
      within(rows[1] ?? table).getByRole('link', {
        name: 'Build the frictions page',
      }),
    ).toHaveAttribute(
      'href',
      '/sessions/7f3a9c21-5b1e-4c8d-9a0f-123456789abc?period=30d',
    );
    await expect(
      within(rows[2] ?? table).getByRole('link', { name: '0a1b2c3d' }),
    ).toBeVisible();
    await expect(columnTexts(table, 3)).toEqual(['#41', '—']);
    await expect(columnTexts(table, 2)).toEqual(['builder', 'main']);
    for (const last of columnTexts(table, 5)) {
      await expect(last).toMatch(/^\d{1,2} Nov, \d{2}:\d{2}$/);
    }
  },
};

export const LongHook: Story = {
  name: 'A long hook command',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    const table = canvas.getByRole('table', { name: 'Stop blocked' });
    const hook = within(table).getByRole('rowheader', { name: LONG_HOOK });
    await expect(hook.querySelector('[title]')).toHaveAttribute(
      'title',
      LONG_HOOK,
    );
  },
};

export const ShowMoreTools: Story = {
  name: 'More than 10 tools',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    const table = canvas.getByRole('table', { name: 'By tool' });
    const panel = table.closest('section') ?? canvasElement;
    await expect(columnTexts(table, 0)).toHaveLength(10);
    await expect(within(panel).getByText('10 of 12')).toBeVisible();
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Show more' }),
    );
    await expect(columnTexts(table, 0)).toHaveLength(12);
    await expect(within(panel).queryByText('10 of 12')).toBeNull();
  },
};

export const NoRepeatedFailure: Story = {
  name: 'No repeated failure',
  args: {
    loadFrictions: frictionsLoaderOf({ ...frictionStats, repeated: [] }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    await expect(
      canvas.getByText('No command failed 3 times in one thread.'),
    ).toBeVisible();
    await expect(
      canvas.queryByRole('table', { name: 'Repeated failures' }),
    ).toBeNull();
    await expect(tableHeadings(canvasElement)).toEqual(EVERY_TABLE);
  },
};
