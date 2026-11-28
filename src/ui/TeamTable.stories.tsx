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
    await expect(canvas.getAllByRole('columnheader')).toHaveLength(6);
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

export const MenuKeyboard: Story = {
  name: 'Menu keyboard: arrows, Home, End, Tab',
  args: {
    actionsFor: () => [
      { label: 'First action', onSelect: fn() },
      { label: 'Second action', onSelect: fn() },
      { label: 'Third action', onSelect: fn() },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chen = canvas.getByRole('button', { name: 'Actions for Chen' });
    await userEvent.click(chen);
    const [first, second, third] = canvas.getAllByRole('menuitem');
    await expect(first).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(second).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(third).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(first).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    await expect(third).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(first).toHaveFocus();
    await expect(first).toHaveAttribute('tabindex', '-1');
    await userEvent.keyboard('{Tab}');
    await expect(canvas.queryByRole('menu')).toBeNull();
    await expect(chen).toHaveAttribute('aria-expanded', 'false');
  },
};

export const OwnRowAction: Story = {
  name: 'An action for every row, the own row included',
  args: {
    actionsFor: () => [
      { label: 'Other rows only', onSelect: fn() },
      { label: 'Every row', onSelect: fn(), forYou: true },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getAllByRole('button', { name: /^Actions for / }),
    ).toHaveLength(someTeam.length);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Actions for Ada' }),
    );
    await expect(
      canvas.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['Every row']);
  },
};
