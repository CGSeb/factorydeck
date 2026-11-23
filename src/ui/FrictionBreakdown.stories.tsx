import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { FrictionBreakdown } from './FrictionBreakdown.tsx';
import { contextPeaks } from './friction-breakdown-fixtures.ts';
import { frictionStats } from './frictions-fixtures.ts';
import { columnTexts, tableHeadings, tablesRouter } from './frictions-story.ts';

const meta = {
  component: FrictionBreakdown,
  args: {
    stats: frictionStats,
    kind: undefined,
    scope: { project: undefined, period: '30d' },
    period: '30d',
    withTables: true,
  },
  decorators: [tablesRouter],
} satisfies Meta<typeof FrictionBreakdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EveryBlock: Story = {
  name: 'Every block',
  play: async ({ canvasElement }) => {
    await expect(tableHeadings(canvasElement)).toEqual([
      'By role',
      'Issues with the most frictions',
      'Context peaks',
    ]);
    const issues = within(canvasElement).getByRole('table', {
      name: 'Issues with the most frictions',
    });
    await expect(columnTexts(issues, 1).slice(0, 4)).toEqual([
      'app',
      'app',
      'app',
      'lib',
    ]);
  },
};

export const NoIssue: Story = {
  name: 'No issue with a friction',
  args: { stats: { ...frictionStats, issues: [] } },
  play: async ({ canvasElement }) => {
    await expect(tableHeadings(canvasElement)).toEqual([
      'By role',
      'Context peaks',
    ]);
  },
};

export const AllTime: Story = {
  name: 'All time, without a change line',
  args: { period: 'all', scope: { project: undefined, period: 'all' } },
  play: async ({ canvasElement }) => {
    const peaks = within(canvasElement).getByRole('region', {
      name: 'Context peaks',
    });
    await expect(peaks.querySelector('[data-change]')).toBeNull();
  },
};

export const FewThreads: Story = {
  name: 'One thread',
  args: {
    stats: {
      ...frictionStats,
      context: {
        threads: contextPeaks.threads.slice(0, 1),
        compacted: 1,
        medianPeak: 182_000,
        previous: { medianPeak: 90_000, threads: 1 },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const peaks = within(canvasElement).getByRole('region', {
      name: 'Context peaks',
    });
    await expect(within(peaks).getByText('Not enough data')).toBeVisible();
    await expect(
      within(peaks).getByText('1 of 1 thread compacted'),
    ).toBeVisible();
  },
};

export const OtherKind: Story = {
  name: 'Another kind leaves the peaks out',
  args: { kind: 'stop-blocked' },
  play: async ({ canvasElement }) => {
    await expect(tableHeadings(canvasElement)).toEqual([
      'By role',
      'Issues with the most frictions',
    ]);
  },
};

export const WithoutTables: Story = {
  name: 'No friction, context peaks only',
  args: { withTables: false },
  play: async ({ canvasElement }) => {
    await expect(tableHeadings(canvasElement)).toEqual(['Context peaks']);
  },
};

export const ManyRoles: Story = {
  name: 'Every role, without paging',
  args: {
    stats: {
      ...frictionStats,
      roles: Array.from({ length: 12 }, (_, index) => ({
        role: `role-${String(index + 1)}`,
        threads: 1,
        frictions: 12 - index,
        perThread: 12 - index,
        mainKind: 'tool-error' as const,
      })),
    },
  },
  play: async ({ canvasElement }) => {
    const roles = within(canvasElement).getByRole('table', { name: 'By role' });
    await expect(columnTexts(roles, 0)).toHaveLength(12);
    const panel = roles.closest('section') ?? canvasElement;
    await expect(
      within(panel).queryByRole('button', { name: 'Show more' }),
    ).toBeNull();
  },
};
