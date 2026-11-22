import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { surfaceFrame } from './components/story-frame.ts';
import { unknownPricesOverview } from './fixtures.ts';
import { ModelTokensTable } from './ModelTokensTable.tsx';
import { oneModel } from './role-fixtures.ts';

const meta = {
  component: ModelTokensTable,
  decorators: [surfaceFrame],
  args: { models: unknownPricesOverview.models },
} satisfies Meta<typeof ModelTokensTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Models: Story = {
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table', {
      name: 'By model',
    });
    await expect(within(table).getAllByRole('row')).toHaveLength(6);
    await expect(
      within(table).getByRole('rowheader', { name: '—' }),
    ).toBeVisible();
  },
};

export const OneModel: Story = {
  args: { models: oneModel },
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table', {
      name: 'By model',
    });
    await expect(within(table).getAllByRole('row')).toHaveLength(2);
  },
};
