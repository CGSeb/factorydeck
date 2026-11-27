import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { formatDateTime } from './format.ts';
import { pendingInvitations } from './invitation-fixtures.ts';
import {
  NEW_LINK,
  PENDING_TITLE,
  PendingInvitations,
} from './PendingInvitations.tsx';

const meta = {
  component: PendingInvitations,
  args: {
    invitations: pendingInvitations,
    onNewLink: fn(),
    onRevoke: fn(),
  },
} satisfies Meta<typeof PendingInvitations>;

export default meta;

type Story = StoryObj<typeof meta>;

function expires(index: number): string {
  return formatDateTime(pendingInvitations[index]?.expiresAt ?? null);
}

function rowTexts(canvasElement: HTMLElement): string[][] {
  return [...canvasElement.querySelectorAll('tbody tr')].map((row) =>
    [...row.children].slice(0, 4).map((cell) => cell.textContent),
  );
}

export const PendingList: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 2, name: PENDING_TITLE }),
    ).toBeVisible();
    await expect(
      within(canvas.getByRole('table', { name: PENDING_TITLE }))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Email', 'Role', 'Invited by', 'Expires', 'Actions']);
    await expect(rowTexts(canvasElement)).toEqual([
      ['fay@example.test', 'Dev', 'Ada', expires(0)],
      [
        'gus.with-a-very-long-address@long-company-name.example.test',
        'Manager',
        '—',
        expires(1),
      ],
      ['hal@example.test', 'Dev', 'Chen', expires(2)],
    ]);
    await userEvent.click(
      canvas.getByRole('button', { name: `${NEW_LINK} for fay@example.test` }),
    );
    await expect(args.onNewLink).toHaveBeenCalledWith(pendingInvitations[0]);
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Revoke the invitation of hal@example.test',
      }),
    );
    await expect(args.onRevoke).toHaveBeenCalledWith(pendingInvitations[2]);
  },
};

export const RowError: Story = {
  args: {
    feedback: { 11: { error: 'Invitation not found' } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Invitation not found')).toBeVisible();
    const button = canvas.getByRole('button', {
      name: `${NEW_LINK} for fay@example.test`,
    });
    await expect(button).toHaveAccessibleDescription('Invitation not found');
  },
};

export const RowBusy: Story = {
  args: { feedback: { 13: { busy: true } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: `${NEW_LINK} for hal@example.test` }),
    ).toBeDisabled();
  },
};
