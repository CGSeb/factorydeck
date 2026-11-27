import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  STORY_ORIGIN,
  STORY_TOKEN,
  pendingInvitations,
  storyActions,
  teamWithInvitations,
} from './invitation-fixtures.ts';
import { DONE, LINK_TITLE } from './InviteDialog.tsx';
import { PENDING_TITLE } from './PendingInvitations.tsx';
import { REFUSED_MESSAGE } from './team-view.ts';
import {
  TEAM_NOW,
  someTeam,
  teamLoaderOf,
  teamResponse,
  teamSequence,
} from './team-fixtures.ts';
import { INVITE, TeamPage } from './TeamPage.tsx';

const meta = {
  title: 'TeamPage/Invitations',
  component: TeamPage,
  args: {
    now: TEAM_NOW,
    origin: STORY_ORIGIN,
    loadTeam: teamLoaderOf(teamWithInvitations(someTeam)),
    invitationActions: storyActions(),
    copy: fn(() => Promise.resolve()),
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

function invitationEmails(canvasElement: HTMLElement): string[] {
  const table = canvasElement.querySelector(
    `table[aria-label="${PENDING_TITLE}"]`,
  );
  return [...(table?.querySelectorAll('tbody th') ?? [])].map(
    (cell) => cell.textContent,
  );
}

export const WithPendingInvitations: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: PENDING_TITLE });
    await expect(canvas.getByRole('button', { name: INVITE })).toBeVisible();
    await expect(canvas.getByText('5 accounts · 2 managers')).toBeVisible();
    await expect(invitationEmails(canvasElement)).toEqual(
      pendingInvitations.map(({ email }) => email),
    );
  },
};

export const NoPendingInvitation: Story = {
  args: { loadTeam: teamLoaderOf(teamWithInvitations(someTeam, [])) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Team' });
    await expect(canvas.queryByText(PENDING_TITLE)).toBeNull();
    await expect(canvas.getByRole('button', { name: INVITE })).toBeVisible();
  },
};

export const InviteThenDone: Story = {
  args: {
    loadTeam: teamSequence([
      teamWithInvitations(someTeam, []),
      teamWithInvitations(someTeam, pendingInvitations.slice(2)),
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Team' });
    await userEvent.click(canvas.getByRole('button', { name: INVITE }));
    await userEvent.type(
      canvas.getByLabelText('Email'),
      'hal@example.test{Enter}',
    );
    const dialog = await canvas.findByRole('dialog', { name: LINK_TITLE });
    await expect(within(dialog).getByLabelText('Link')).toHaveValue(
      `${STORY_ORIGIN}/invite/${STORY_TOKEN}`,
    );
    await waitFor(() =>
      expect(invitationEmails(canvasElement)).toEqual(['hal@example.test']),
    );
    await expect(dialog).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: DONE }));
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(canvas.getByRole('button', { name: INVITE })).toHaveFocus();
  },
};

export const NewLinkShowsTheLink: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: PENDING_TITLE });
    await userEvent.click(
      canvas.getByRole('button', { name: 'New link for fay@example.test' }),
    );
    const dialog = await canvas.findByRole('dialog', { name: LINK_TITLE });
    await expect(within(dialog).getByText(/fay@example\.test/)).toBeVisible();
  },
};

export const RevokeAtOnce: Story = {
  args: {
    loadTeam: teamSequence([
      teamWithInvitations(someTeam),
      teamWithInvitations(someTeam, pendingInvitations.slice(1)),
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: PENDING_TITLE });
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Revoke the invitation of fay@example.test',
      }),
    );
    await waitFor(() =>
      expect(invitationEmails(canvasElement)).not.toContain('fay@example.test'),
    );
    await expect(canvas.queryByRole('dialog')).toBeNull();
  },
};

export const RowActionError: Story = {
  args: {
    invitationActions: storyActions({
      newLink: () =>
        Promise.resolve({ status: 'failed', message: 'Invitation not found' }),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: PENDING_TITLE });
    await userEvent.click(
      canvas.getByRole('button', { name: 'New link for fay@example.test' }),
    );
    await expect(await canvas.findByText('Invitation not found')).toBeVisible();
    await expect(canvas.queryByRole('dialog')).toBeNull();
  },
};

export const RefusedHidesInvite: Story = {
  args: {
    loadTeam: teamLoaderOf({ status: 'refused', refreshSeconds: 10 }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(REFUSED_MESSAGE);
    await expect(canvas.queryByRole('button', { name: INVITE })).toBeNull();
  },
};

export const AccountsWithoutInvitations: Story = {
  args: { loadTeam: teamLoaderOf(teamResponse(someTeam)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Team' });
    await expect(canvas.queryByText(PENDING_TITLE)).toBeNull();
  },
};
