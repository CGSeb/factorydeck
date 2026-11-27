import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TEAM_NOW, someTeam } from './team-fixtures.ts';
import { TeamTable } from './TeamTable.tsx';

const meta = {
  component: TeamTable,
  args: { accounts: someTeam, now: TEAM_NOW },
} satisfies Meta<typeof TeamTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithoutActions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('columnheader')).toHaveLength(5);
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

const select = fn();

export const WithRowActions: Story = {
  name: 'With an action: a menu on every other row',
  args: { actionsFor: () => [{ label: 'Sample action', onSelect: select }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button', { name: /^Actions for / });
    await expect(buttons).toHaveLength(someTeam.length - 1);
    await expect(
      canvas.queryByRole('button', { name: 'Actions for Ada' }),
    ).toBeNull();
    const chen = canvas.getByRole('button', { name: 'Actions for Chen' });
    await userEvent.click(chen);
    await expect(chen).toHaveAttribute('aria-expanded', 'true');
    const item = canvas.getByRole('menuitem', { name: 'Sample action' });
    await expect(item).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('menu')).toBeNull();
    await expect(chen).toHaveFocus();
    await userEvent.click(chen);
    await userEvent.click(
      canvas.getByRole('menuitem', { name: 'Sample action' }),
    );
    await expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Chen' }),
    );
    await expect(canvas.queryByRole('menu')).toBeNull();
  },
};
