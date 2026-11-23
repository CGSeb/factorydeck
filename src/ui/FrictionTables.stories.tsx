import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { surfaceFrame } from './components/story-frame.ts';
import { LONG_HOOK, frictionStats, statsFor } from './frictions-fixtures.ts';
import { columnTexts, tableHeadings, tablesRouter } from './frictions-story.ts';
import { FrictionTables } from './FrictionTables.tsx';

const meta = {
  title: 'Frictions/FrictionTables',
  component: FrictionTables,
  decorators: [surfaceFrame, tablesRouter],
  args: {
    stats: frictionStats,
    kind: undefined,
    scope: { project: undefined, period: '30d' },
  },
} satisfies Meta<typeof FrictionTables>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Every: Story = {
  name: 'Every kind',
  play: async ({ canvasElement }) => {
    await expect(tableHeadings(canvasElement)).toEqual([
      'By category',
      'By tool',
      'Failed commands',
      'Repeated failures',
      'Stop blocked',
    ]);
  },
};

export const StopBlocked: Story = {
  name: 'Stop blocked only',
  args: { stats: statsFor('stop-blocked'), kind: 'stop-blocked' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(tableHeadings(canvasElement)).toEqual(['Stop blocked']);
    const table = canvas.getByRole('table', { name: 'Stop blocked' });
    await expect(
      within(table).getByRole('rowheader', { name: LONG_HOOK }),
    ).toBeVisible();
    await expect(columnTexts(table, 1)).toEqual(['4', '1']);
  },
};

export const EmptyHook: Story = {
  name: 'A hook without its command',
  args: {
    stats: statsFor('stop-blocked', {
      ...frictionStats,
      hooks: [
        { command: '', blocks: 1, sessions: 1, lastAt: '2026-11-20T11:00:00Z' },
      ],
    }),
    kind: 'stop-blocked',
  },
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table', {
      name: 'Stop blocked',
    });
    await expect(columnTexts(table, 0)).toEqual(['—']);
  },
};

export const ToolErrorsWithoutRows: Story = {
  name: 'Tool errors left out when empty',
  args: {
    stats: {
      ...frictionStats,
      categories: [],
      tools: [],
      commands: [],
      repeated: [],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(tableHeadings(canvasElement)).toEqual([
      'Repeated failures',
      'Stop blocked',
    ]);
  },
};
