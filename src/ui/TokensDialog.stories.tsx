import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { todayOverview, weekOverview } from './fixtures.ts';
import { roleList, someRoles } from './role-fixtures.ts';
import { TokensDialog } from './TokensDialog.tsx';

const meta = {
  component: TokensDialog,
  args: {
    overview: weekOverview,
    roles: roleList(someRoles),
    rolesHref: '/roles?period=7d',
    onClose: fn(),
  },
} satisfies Meta<typeof TokensDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ByDay: Story = {
  name: 'By day',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', {
      name: 'Where the tokens went',
    });
    await expect(
      within(dialog).getByRole('group', { name: 'Tokens by role' }),
    ).toBeVisible();
    await expect(within(dialog).getByText('Tokens per day')).toBeVisible();
    await expect(
      within(dialog).getByRole('link', { name: 'Roles' }),
    ).toHaveAttribute('href', '/roles?period=7d');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close' }),
    );
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

export const ByHour: Story = {
  name: 'By hour',
  args: { overview: todayOverview },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Tokens per hour'),
    ).toBeVisible();
  },
};

export const Loading: Story = {
  args: { roles: 'loading' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading…')).toBeVisible();
  },
};

export const Unreachable: Story = {
  args: { roles: 'unreachable' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        'Database unreachable. Start it with pnpm db:up.',
      ),
    ).toBeVisible();
  },
};
