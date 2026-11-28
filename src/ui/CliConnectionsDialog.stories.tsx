import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CliConnectionsDialog } from './CliConnectionsDialog.tsx';
import { connectionsOf, laptop, twoMachines } from './team-cli-fixtures.ts';
import { TEAM_NOW } from './team-fixtures.ts';

const meta = {
  component: CliConnectionsDialog,
  args: {
    name: 'Bruno',
    view: connectionsOf(twoMachines),
    now: TEAM_NOW,
    onDisconnect: fn(),
    onConfirm: fn(),
    onCancelConfirm: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof CliConnectionsDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SeveralMachines: Story = {
  args: { onDisconnect: fn(), onClose: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', {
      name: "Bruno's CLI connections",
    });
    const table = within(dialog).getByRole('table');
    await expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Machine', 'Connected', 'Last used', 'Actions']);
    await expect(
      [...table.querySelectorAll('tbody tr')].map((row) =>
        [...row.children].slice(0, 3).map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['bruno-laptop', '28 Feb', '4 min ago'],
      [
        'build-box-with-a-rather-long-host-name.internal.example.test',
        '20 Feb',
        '3 d ago',
      ],
    ]);
    await expect(canvas.getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Disconnect bruno-laptop' }),
    );
    await expect(args.onDisconnect).toHaveBeenCalledWith(laptop);
    await userEvent.keyboard('{Escape}');
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

export const NoMachine: Story = {
  args: { view: connectionsOf([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No machine connected.')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

export const Loading: Story = {
  args: { view: 'loading' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading…')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Close' })).toBeVisible();
  },
};

export const LoadFailed: Story = {
  args: {
    view: {
      status: 'failed',
      message: 'Database unreachable. Start it with pnpm db:up.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};

export const ConfirmDisconnect: Story = {
  args: {
    confirming: { connection: laptop, sending: false },
    onConfirm: fn(),
    onCancelConfirm: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', {
      name: 'Disconnect bruno-laptop?',
    });
    await expect(dialog).toHaveAccessibleDescription(
      'Its CLI stops sending until you log in again.',
    );
    await expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Cancel', 'Disconnect']);
    await userEvent.click(canvas.getByRole('button', { name: 'Disconnect' }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    await expect(args.onCancelConfirm).toHaveBeenCalledTimes(1);
  },
};

export const Disconnecting: Story = {
  args: {
    confirming: { connection: laptop, sending: true },
    onCancelConfirm: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Disconnecting…' }),
    ).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await expect(args.onCancelConfirm).not.toHaveBeenCalled();
  },
};

export const DisconnectFailed: Story = {
  args: {
    confirming: {
      connection: laptop,
      sending: false,
      error: 'Could not reach the server',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Could not reach the server',
    );
    await expect(
      canvas.getByRole('button', { name: 'Disconnect' }),
    ).toBeEnabled();
  },
};
