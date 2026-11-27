import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import type { AccountChangeOutcome, ChangeRole } from './role-change-api.ts';
import {
  TEAM_NOW,
  someTeam,
  teamLoaderOf,
  teamResponse,
} from './team-fixtures.ts';
import { REFUSED_MESSAGE } from './team-view.ts';
import { TeamPage } from './TeamPage.tsx';

function answering(outcome: AccountChangeOutcome): ChangeRole {
  return () => Promise.resolve(outcome);
}

function changed(id: number, role: 'manager' | 'dev'): AccountChangeOutcome {
  const row = someTeam.find((account) => account.id === id);
  if (row === undefined) throw new Error(`No account ${id}`);
  return { status: 'changed', account: { ...row, role } };
}

const meta = {
  component: TeamPage,
  args: {
    now: TEAM_NOW,
    loadTeam: teamLoaderOf(teamResponse(someTeam)),
    changeRole: answering(changed(4, 'manager')),
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

const BRUNO = 'Actions for Bruno Delacroix-Montgomery the Second';

function rowOf(canvasElement: HTMLElement, name: string): HTMLElement {
  const row = [...canvasElement.querySelectorAll('tbody tr')].find((tr) =>
    tr.textContent.startsWith(name),
  );
  if (!(row instanceof HTMLElement)) throw new Error(`No row for ${name}`);
  return row;
}

async function choose(
  canvasElement: HTMLElement,
  button: string,
  item: string,
): Promise<HTMLElement> {
  const canvas = within(canvasElement);
  const actions = await canvas.findByRole('button', { name: button });
  await userEvent.click(actions);
  await userEvent.click(canvas.getByRole('menuitem', { name: item }));
  return actions;
}

async function showsUnderTheRow(
  canvasElement: HTMLElement,
  item: string,
  message: string,
): Promise<void> {
  const canvas = within(canvasElement);
  const actions = await choose(canvasElement, BRUNO, item);
  const status = await canvas.findByRole('status');
  await expect(status).toHaveTextContent(message);
  const line = status.closest('tr');
  await expect(line?.previousElementSibling?.textContent).toContain('Bruno');
  await expect(line?.querySelector('td')?.colSpan).toBe(6);
  await expect(rowOf(canvasElement, 'Bruno').textContent).toContain('Dev');
  await waitFor(() => expect(actions).toHaveFocus());
}

export const MenuOfAnActiveDev: Story = {
  name: 'Menu of an active dev: Make manager',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: BRUNO }));
    await expect(
      within(canvas.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Make manager']);
  },
};

export const MenuOfAnActiveManager: Story = {
  name: 'Menu of an active manager: Make dev',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Actions for Chen' }),
    );
    await expect(
      within(canvas.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Make dev']);
  },
};

export const DeactivatedRowWithoutRoleAction: Story = {
  name: 'A deactivated row offers no role action',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Team' });
    await expect(
      canvas.queryByRole('button', { name: 'Actions for Eve' }),
    ).toBeNull();
    await expect(
      canvas.queryByRole('button', { name: 'Actions for Ada' }),
    ).toBeNull();
  },
};

export const Sending: Story = {
  name: 'Sending: the row’s button is busy, the others stay usable',
  args: { changeRole: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actions = await choose(canvasElement, BRUNO, 'Make manager');
    await expect(canvas.queryByRole('menu')).toBeNull();
    await expect(actions).toBeDisabled();
    await expect(actions).toHaveAttribute('aria-busy', 'true');
    const chen = canvas.getByRole('button', { name: 'Actions for Chen' });
    await expect(chen).toBeEnabled();
    await userEvent.click(chen);
    await expect(canvas.getByRole('menu')).toBeVisible();
  },
};

const sentRole = fn<ChangeRole>(answering(changed(4, 'manager')));

export const MadeManager: Story = {
  name: 'Made manager: the row and the summary change at once',
  args: { changeRole: sentRole },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('5 accounts · 2 managers');
    const actions = await choose(canvasElement, BRUNO, 'Make manager');
    await expect(sentRole).toHaveBeenCalledWith(4, 'manager');
    await canvas.findByText('5 accounts · 3 managers');
    await expect(rowOf(canvasElement, 'Bruno').textContent).toContain(
      'Manager',
    );
    await waitFor(() => expect(actions).toHaveFocus());
    await expect(actions).toBeEnabled();
    await userEvent.click(actions);
    await expect(
      canvas.getByRole('menuitem', { name: 'Make dev' }),
    ).toBeVisible();
  },
};

export const MadeDev: Story = {
  name: 'Made dev',
  args: { changeRole: answering(changed(2, 'dev')) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await choose(canvasElement, 'Actions for Chen', 'Make dev');
    await canvas.findByText('5 accounts · 1 manager');
    await expect(rowOf(canvasElement, 'Chen').textContent).toContain('Dev');
  },
};

export const LastActiveManager: Story = {
  name: 'Refused: the last active manager',
  args: {
    changeRole: answering({
      status: 'failed',
      message: 'The team needs at least one active manager',
    }),
  },
  play: async ({ canvasElement }) => {
    await showsUnderTheRow(
      canvasElement,
      'Make manager',
      'The team needs at least one active manager',
    );
  },
};

export const OwnRole: Story = {
  name: 'Refused: one’s own role',
  args: {
    changeRole: answering({
      status: 'failed',
      message: 'You cannot change your own role',
    }),
  },
  play: async ({ canvasElement }) => {
    await showsUnderTheRow(
      canvasElement,
      'Make manager',
      'You cannot change your own role',
    );
  },
};

export const DeactivatedMeanwhile: Story = {
  name: 'Refused: an account deactivated meanwhile',
  args: {
    changeRole: answering({
      status: 'failed',
      message: 'Reactivate this account first',
    }),
  },
  play: async ({ canvasElement }) => {
    await showsUnderTheRow(
      canvasElement,
      'Make manager',
      'Reactivate this account first',
    );
  },
};

export const DatabaseUnreachable: Story = {
  name: 'Database unreachable under the row',
  args: {
    changeRole: answering({ status: 'failed', message: DATABASE_UNREACHABLE }),
  },
  play: async ({ canvasElement }) => {
    await showsUnderTheRow(canvasElement, 'Make manager', DATABASE_UNREACHABLE);
  },
};

export const ServerUnreachable: Story = {
  name: 'Could not reach the server under the row',
  args: {
    changeRole: answering({ status: 'failed', message: SERVER_UNREACHABLE }),
  },
  play: async ({ canvasElement }) => {
    await showsUnderTheRow(canvasElement, 'Make manager', SERVER_UNREACHABLE);
  },
};

export const MessageClearsOnTheNextAction: Story = {
  name: 'The message stays until the next action starts',
  args: {
    changeRole: (() => {
      let call = 0;
      return (): Promise<AccountChangeOutcome> => {
        call += 1;
        return call === 1
          ? Promise.resolve({ status: 'failed', message: SERVER_UNREACHABLE })
          : new Promise(() => undefined);
      };
    })(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await choose(canvasElement, BRUNO, 'Make manager');
    await canvas.findByRole('status');
    await choose(canvasElement, 'Actions for Chen', 'Make dev');
    await expect(canvas.queryByRole('status')).toBeNull();
  },
};

export const RefusedByTheChange: Story = {
  name: 'A 403 on the change replaces the table with the refusal',
  args: { changeRole: answering({ status: 'refused' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await choose(canvasElement, BRUNO, 'Make manager');
    await canvas.findByText(REFUSED_MESSAGE);
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};
