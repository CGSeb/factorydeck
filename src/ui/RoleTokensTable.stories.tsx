import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { surfaceFrame } from './components/story-frame.ts';
import { customRoles, someRoles } from './role-fixtures.ts';
import { byTokensDescending, colorsOfRoles } from './roles-view.ts';
import { RoleTokensTable } from './RoleTokensTable.tsx';

const sorted = byTokensDescending(someRoles, (row) => row.role);

const meta = {
  component: RoleTokensTable,
  decorators: [surfaceFrame],
  args: {
    roles: sorted,
    colors: colorsOfRoles(['builder', 'reviewer'], sorted),
  },
} satisfies Meta<typeof RoleTokensTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Roles: Story = {
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table', { name: 'By role' });
    await expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Role', 'Threads', 'API calls', 'Tokens per thread', 'Tokens']);
    await expect(within(table).getAllByRole('row')).toHaveLength(7);
  },
};

export const RowWithoutThread: Story = {
  args: {
    roles: customRoles,
    colors: colorsOfRoles(['writer', 'editor'], customRoles),
  },
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table', { name: 'By role' });
    const writer = within(table).getByRole('row', { name: /^writer/ });
    await expect(within(writer).getAllByRole('cell')[2]).toHaveTextContent('—');
  },
};
