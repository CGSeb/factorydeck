import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { surfaceFrame } from './components/story-frame.ts';
import { frictionStats } from './frictions-fixtures.ts';
import { columnTexts, tablesRouter } from './frictions-story.ts';
import {
  CategoryTable,
  CommandTable,
  RepeatedTable,
  ToolTable,
} from './ToolErrorTables.tsx';

const meta = {
  title: 'Frictions/ToolErrorTables',
  component: CategoryTable,
  decorators: [surfaceFrame, tablesRouter],
  args: { rows: frictionStats.categories },
} satisfies Meta<typeof CategoryTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Categories: Story = {
  name: 'By category',
  args: {
    rows: [
      { category: 'command-failed', errors: 400 },
      { category: 'hook-blocked', errors: 2 },
      { category: 'other', errors: 1 },
    ],
  },
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table', {
      name: 'By category',
    });
    await expect(columnTexts(table, 0)).toEqual([
      'Command failed',
      'Blocked by a hook',
      'Other',
    ]);
    await expect(columnTexts(table, 2)).toEqual(['99%', '<1%', '<1%']);
  },
};

export const Tools: Story = {
  name: 'By tool',
  render: () => <ToolTable rows={frictionStats.tools.slice(0, 3)} />,
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table', { name: 'By tool' });
    await expect(columnTexts(table, 0)).toEqual(['Bash', 'Edit', 'Write']);
    await expect(columnTexts(table, 2)).toEqual([
      'Command failed',
      'Tool misuse',
      'Tool misuse',
    ]);
  },
};

export const Commands: Story = {
  name: 'Failed commands',
  render: () => <CommandTable rows={frictionStats.commands} />,
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table', {
      name: 'Failed commands',
    });
    await expect(columnTexts(table, 2)).toEqual(['1, 2, 4, 5, 7, …', '1', '—']);
    await expect(columnTexts(table, 3)).toEqual(['6', '2', '1']);
  },
};

export const Repeated: Story = {
  name: 'Repeated failures',
  render: () => (
    <RepeatedTable
      rows={frictionStats.repeated}
      scope={{ project: undefined, period: '7d' }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: '#41' })).toHaveAttribute(
      'href',
      '/features/41?project=%2Fwork%2Fapp&period=7d',
    );
    await expect(
      canvas.getByRole('link', { name: '0a1b2c3d' }),
    ).toHaveAttribute(
      'href',
      '/sessions/0a1b2c3d-4e5f-4a6b-8c7d-0123456789ef?period=7d',
    );
  },
};

export const NoRepeated: Story = {
  name: 'No repeated failure',
  render: () => (
    <RepeatedTable rows={[]} scope={{ project: undefined, period: '7d' }} />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        'No command failed 3 times in one thread.',
      ),
    ).toBeVisible();
  },
};
