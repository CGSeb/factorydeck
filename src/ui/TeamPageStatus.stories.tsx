import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  changeAnswering,
  changeApplied,
  changeFailing,
  pendingChange,
} from './account-status-fixtures.ts';
import type { AccountChangeOutcome } from './role-change-api.ts';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import {
  TEAM_NOW,
  someTeam,
  teamLoaderOf,
  teamResponse,
} from './team-fixtures.ts';
import { REFUSED_MESSAGE } from './team-view.ts';
import { TeamPage } from './TeamPage.tsx';

const pendingRoleChange = (): Promise<AccountChangeOutcome> =>
  new Promise(() => undefined);

const meta = {
  title: 'TeamPage/Deactivation',
  component: TeamPage,
  args: {
    now: TEAM_NOW,
    loadTeam: teamLoaderOf(teamResponse(someTeam)),
    changeActive: changeApplied(),
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/team']}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof TeamPage>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openMenu(root: HTMLElement, name: string): Promise<HTMLElement> {
  const canvas = within(root);
  const button = await canvas.findByRole('button', {
    name: `Actions for ${name}`,
  });
  await userEvent.click(button);
  return button;
}

function rowOf(root: HTMLElement, name: string): HTMLElement {
  const canvas = within(root);
  const row = canvas.getByText(name).closest('tr');
  if (row === null) throw new Error(`No row for ${name}`);
  return row;
}

function statusOf(root: HTMLElement, name: string): string {
  return rowOf(root, name).children[3]?.textContent ?? '';
}

async function deactivate(
  root: HTMLElement,
  name: string,
): Promise<HTMLElement> {
  const canvas = within(root);
  const button = await openMenu(root, name);
  await userEvent.click(canvas.getByRole('menuitem', { name: 'Deactivate' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Deactivate' }));
  return button;
}

async function expectMessageUnder(
  root: HTMLElement,
  name: string,
  message: string,
): Promise<void> {
  const canvas = within(root);
  await waitFor(() =>
    expect(canvas.getByRole('status')).toHaveTextContent(message),
  );
  const line = rowOf(root, name).nextElementSibling;
  await expect(line).toHaveClass('fd-team-message-row');
  await expect(line).toHaveTextContent(message);
  await expect(canvas.queryByRole('dialog')).toBeNull();
}

export const MenuOfAnActiveAccount: Story = {
  name: 'Menu of an active account: Deactivate, in the danger colour',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openMenu(canvasElement, 'Dara');
    const items = canvas.getAllByRole('menuitem');
    await expect(items.map((item) => item.textContent)).toEqual(['Deactivate']);
    await expect(items[0]).toHaveAttribute('data-danger', 'true');
  },
};

export const MenuOfADeactivatedAccount: Story = {
  name: 'Menu order: role, other actions, Deactivate last; a deactivated account offers only Reactivate',
  args: {
    actionsFor: () => [{ label: 'Other action', onSelect: () => undefined }],
    changeRole: pendingRoleChange,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openMenu(canvasElement, 'Eve');
    const items = canvas.getAllByRole('menuitem');
    await expect(items.map((item) => item.textContent)).toEqual(['Reactivate']);
    await expect(items[0]).not.toHaveAttribute('data-danger');
    await userEvent.keyboard('{Escape}');
    await openMenu(canvasElement, 'Dara');
    await expect(
      canvas.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['Make manager', 'Other action', 'Deactivate']);
  },
};

export const Confirmation: Story = {
  name: 'Deactivate asks to confirm; Cancel gives the focus back',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await openMenu(canvasElement, 'Dara');
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Deactivate' }));
    const dialog = canvas.getByRole('dialog', { name: 'Deactivate Dara?' });
    await expect(dialog).toHaveAccessibleDescription(
      'They are signed out at once.',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(button).toHaveFocus();
    await expect(statusOf(canvasElement, 'Dara')).toBe('Active');
  },
};

export const Deactivating: Story = {
  name: 'While deactivating, the dialog stays open',
  args: { changeActive: pendingChange() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await deactivate(canvasElement, 'Dara');
    const sending = canvas.getByRole('button', { name: 'Deactivating…' });
    await expect(sending).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('dialog')).toBeVisible();
  },
};

export const Deactivated: Story = {
  name: 'Deactivated: the row shows the new status, the focus comes back',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await deactivate(canvasElement, 'Dara');
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(statusOf(canvasElement, 'Dara')).toBe('Deactivated');
    await expect(button).toHaveFocus();
    await userEvent.click(button);
    await expect(
      canvas.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['Reactivate']);
  },
};

export const Reactivating: Story = {
  name: 'While reactivating, the actions button is busy',
  args: { changeActive: pendingChange() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openMenu(canvasElement, 'Eve');
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Reactivate' }));
    await expect(canvas.queryByRole('dialog')).toBeNull();
    const busy = canvas.getByRole('button', { name: 'Reactivating…' });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute('title', 'Reactivating…');
  },
};

export const Reactivated: Story = {
  name: 'Reactivated: the row shows Active, the focus comes back',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openMenu(canvasElement, 'Eve');
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Reactivate' }));
    await waitFor(() => expect(statusOf(canvasElement, 'Eve')).toBe('Active'));
    await expect(
      canvas.getByRole('button', { name: 'Actions for Eve' }),
    ).toHaveFocus();
  },
};

function refusal(message: string, name = 'Chen'): Story {
  return {
    args: { changeActive: changeFailing(message) },
    play: async ({ canvasElement }) => {
      const button = await deactivate(canvasElement, name);
      await expectMessageUnder(canvasElement, name, message);
      await expect(statusOf(canvasElement, name)).toBe('Active');
      await expect(button).toHaveFocus();
    },
  };
}

export const LastActiveManager: Story = {
  name: 'Refused: the last active manager',
  ...refusal('The team needs at least one active manager'),
};

export const Yourself: Story = {
  name: 'Refused: yourself',
  ...refusal('You cannot deactivate yourself'),
};

export const DatabaseUnreachable: Story = {
  name: 'Failed: database unreachable',
  ...refusal(DATABASE_UNREACHABLE, 'Dara'),
};

export const ServerUnreachable: Story = {
  name: 'Failed: could not reach the server',
  ...refusal(SERVER_UNREACHABLE, 'Dara'),
};

export const ReactivationFailed: Story = {
  name: 'Failed: a reactivation, under the row',
  args: { changeActive: changeFailing(SERVER_UNREACHABLE) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openMenu(canvasElement, 'Eve');
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Reactivate' }));
    await expectMessageUnder(canvasElement, 'Eve', SERVER_UNREACHABLE);
    await expect(statusOf(canvasElement, 'Eve')).toBe('Deactivated');
    await expect(
      canvas.getByRole('button', { name: 'Actions for Eve' }),
    ).toHaveFocus();
  },
};

export const MessageClearedByTheNextAction: Story = {
  name: 'The next action on any row clears the message',
  args: { changeActive: changeFailing(SERVER_UNREACHABLE) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await deactivate(canvasElement, 'Dara');
    await expectMessageUnder(canvasElement, 'Dara', SERVER_UNREACHABLE);
    await openMenu(canvasElement, 'Eve');
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Reactivate' }));
    await expectMessageUnder(canvasElement, 'Eve', SERVER_UNREACHABLE);
    await expect(
      canvasElement.querySelectorAll('.fd-team-message-row'),
    ).toHaveLength(1);
    await expect(
      rowOf(canvasElement, 'Dara').nextElementSibling,
    ).not.toHaveClass('fd-team-message-row');
  },
};

export const ManagersOnly: Story = {
  name: 'Refused with 403: the refusal replaces the table',
  args: { changeActive: changeAnswering({ status: 'refused' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await deactivate(canvasElement, 'Dara');
    await canvas.findByText(REFUSED_MESSAGE);
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvas.queryByRole('dialog')).toBeNull();
  },
};
