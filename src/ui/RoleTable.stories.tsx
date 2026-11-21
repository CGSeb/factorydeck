import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { someRoles } from './role-fixtures.ts';
import { RoleTable } from './RoleTable.tsx';

const meta = {
  component: RoleTable,
} satisfies Meta<typeof RoleTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithRoles: Story = {
  args: { roles: someRoles },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole('row');
    await expect(rows).toHaveLength(6);
    await expect(rows[1]).toHaveTextContent('main');
    await expect(rows[1]).toHaveTextContent('~$12.40');
    await expect(rows[5]).toHaveTextContent('unassigned');
    await expect(rows[5]).toHaveTextContent('—');
  },
};
