import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import type { AccountChangeOutcome } from './role-change-api.ts';
import type { CreateResetLink, ResetLinkOutcome } from './reset-api.ts';
import { DONE, RESET_ACTION, VALID_FOR } from './ResetLinkPanel.tsx';
import { COPIED, COPY_FAILED, COPY_LINK } from './invite-dialog-state.ts';
import {
  TEAM_NOW,
  someTeam,
  teamResponse,
  teamSequence,
} from './team-fixtures.ts';
import { TeamPage } from './TeamPage.tsx';

const ORIGIN = 'https://deck.example.test';
const FIRST = 'f'.repeat(43);
const SECOND = 's'.repeat(43);
const BRUNO = 'Actions for Bruno Delacroix-Montgomery the Second';
const PANEL = `${RESET_ACTION} for Bruno Delacroix-Montgomery the Second`;

function created(token: string): ResetLinkOutcome {
  return {
    status: 'created',
    link: { token, expiresAt: '2026-03-13T15:30:00.000Z' },
  };
}

function answering(...outcomes: ResetLinkOutcome[]): CreateResetLink {
  let call = 0;
  return () => {
    const outcome = outcomes[Math.min(call, outcomes.length - 1)];
    call += 1;
    if (outcome === undefined) throw new Error('No outcome');
    return Promise.resolve(outcome);
  };
}

const meta = {
  component: TeamPage,
  args: {
    now: TEAM_NOW,
    origin: ORIGIN,
    loadTeam: teamSequence([teamResponse(someTeam)]),
    changeRole: () =>
      Promise.resolve<AccountChangeOutcome>({
        status: 'failed',
        message: 'Not used',
      }),
    createResetLink: answering(created(FIRST)),
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

async function chooseReset(canvasElement: HTMLElement): Promise<HTMLElement> {
  const canvas = within(canvasElement);
  const actions = await canvas.findByRole('button', { name: BRUNO });
  await userEvent.click(actions);
  await userEvent.click(canvas.getByRole('menuitem', { name: RESET_ACTION }));
  return actions;
}

export const MenuOrder: Story = {
  name: 'Menu: role, then Reset password link; none for a deactivated row',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: BRUNO }));
    await expect(
      within(canvas.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Make manager', RESET_ACTION]);
    await userEvent.keyboard('{Escape}');
    await expect(
      canvas.queryByRole('button', { name: 'Actions for Eve' }),
    ).toBeNull();
  },
};

export const LinkCreated: Story = {
  name: 'Link just created',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await chooseReset(canvasElement);
    const panel = await canvas.findByRole('group', { name: PANEL });
    const link = within(panel).getByRole('textbox', { name: RESET_ACTION });
    await expect(link).toHaveValue(`${ORIGIN}/reset/${FIRST}`);
    await expect(link).toHaveAttribute('readonly');
    await expect(panel).toHaveTextContent(VALID_FOR);
    const copy = within(panel).getByRole('button', { name: COPY_LINK });
    await waitFor(() => expect(copy).toHaveFocus());
    await expect(copy.querySelector('[data-icon="copy"]')).not.toBeNull();
    await expect(
      panel.closest('tr')?.previousElementSibling?.textContent,
    ).toContain('Bruno');
    await userEvent.click(copy);
    await expect(args.copy).toHaveBeenCalledWith(`${ORIGIN}/reset/${FIRST}`);
    await within(panel).findByRole('button', { name: COPIED });
    await expect(within(panel).getByRole('status')).toHaveTextContent(COPIED);
    await within(panel).findByRole(
      'button',
      { name: COPY_LINK },
      { timeout: 3000 },
    );
  },
};

export const CopyFailed: Story = {
  name: 'Could not copy leaves the link selected',
  args: { copy: fn(() => Promise.reject(new Error('denied'))) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await chooseReset(canvasElement);
    const panel = await canvas.findByRole('group', { name: PANEL });
    await userEvent.click(
      within(panel).getByRole('button', { name: COPY_LINK }),
    );
    await within(panel).findByRole('button', { name: COPY_FAILED });
    const link = within(panel).getByRole('textbox', { name: RESET_ACTION });
    await expect(link).toHaveFocus();
    if (!(link instanceof HTMLInputElement)) throw new Error('No input');
    await expect((link.selectionEnd ?? 0) - (link.selectionStart ?? 0)).toBe(
      link.value.length,
    );
  },
};

export const NewLinkReplaces: Story = {
  name: 'A new link replaces the previous one; Done closes it',
  args: { createResetLink: answering(created(FIRST), created(SECOND)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await chooseReset(canvasElement);
    await canvas.findByDisplayValue(`${ORIGIN}/reset/${FIRST}`);
    const actions = await chooseReset(canvasElement);
    await canvas.findByDisplayValue(`${ORIGIN}/reset/${SECOND}`);
    await expect(canvas.getAllByRole('group', { name: PANEL })).toHaveLength(1);
    await userEvent.click(canvas.getByRole('button', { name: DONE }));
    await expect(canvas.queryByRole('group', { name: PANEL })).toBeNull();
    await expect(actions).toHaveFocus();
  },
};

export const StaysThroughRefreshes: Story = {
  name: 'The link stays through the refreshes until Done',
  args: {
    loadTeam: teamSequence([
      { ...teamResponse(someTeam), refreshSeconds: 0.05 },
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await chooseReset(canvasElement);
    await canvas.findByRole('group', { name: PANEL });
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
    await expect(canvas.getByRole('group', { name: PANEL })).toBeVisible();
  },
};

function failing(message: string): Story {
  return {
    args: {
      createResetLink: answering({ status: 'failed', message }),
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      const actions = await chooseReset(canvasElement);
      const status = canvas.getByRole('status');
      await waitFor(() => expect(status).toHaveTextContent(message));
      const line = canvasElement.querySelector('.fd-team-message-row');
      await expect(line?.textContent).toBe(message);
      await expect(line?.previousElementSibling?.textContent).toContain(
        'Bruno',
      );
      await expect(canvas.queryByRole('group', { name: PANEL })).toBeNull();
      await waitFor(() => expect(actions).toHaveFocus());
    },
  };
}

export const Deactivated: Story = {
  name: 'Failure: deactivated meanwhile (409)',
  ...failing('This account is deactivated'),
};

export const NotFound: Story = {
  name: 'Failure: unknown account (404)',
  ...failing('Not found'),
};

export const DatabaseDown: Story = {
  name: 'Failure: database unreachable (503)',
  ...failing(DATABASE_UNREACHABLE),
};

export const NetworkError: Story = {
  name: 'Failure: network error',
  ...failing(SERVER_UNREACHABLE),
};

export const OtherActionClearsTheLine: Story = {
  name: 'Another action of the menu clears a reset failure line',
  args: {
    createResetLink: answering({ status: 'failed', message: 'Not found' }),
    actionsFor: () => [{ label: 'Other action', onSelect: fn() }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await chooseReset(canvasElement);
    await waitFor(() =>
      expect(canvasElement.querySelector('.fd-team-message')).not.toBeNull(),
    );
    await userEvent.click(canvas.getByRole('button', { name: BRUNO }));
    await userEvent.click(
      canvas.getByRole('menuitem', { name: 'Other action' }),
    );
    await waitFor(() =>
      expect(canvasElement.querySelector('.fd-team-message')).toBeNull(),
    );
  },
};
