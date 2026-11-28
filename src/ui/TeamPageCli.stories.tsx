import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { cliActionsOf, twoMachines } from './team-cli-fixtures.ts';
import type { LoadTeam } from './team-api.ts';
import { TEAM_NOW, someTeam, teamResponse } from './team-fixtures.ts';
import { TeamPage } from './TeamPage.tsx';

const BRUNO = 4;
function brunoWithTwoMachines(): {
  cliActions: ReturnType<typeof cliActionsOf>;
  loadTeam: LoadTeam;
} {
  const cliActions = cliActionsOf({ [BRUNO]: twoMachines });
  const loadTeam: LoadTeam = () =>
    Promise.resolve(
      teamResponse(
        someTeam.map((account) =>
          account.id === BRUNO
            ? {
                ...account,
                cliConnections:
                  twoMachines.length - cliActions.disconnected.length,
              }
            : account,
        ),
      ),
    );
  return { cliActions, loadTeam };
}

const cancelled = brunoWithTwoMachines();

const meta = {
  component: TeamPage,
  args: {
    now: TEAM_NOW,
    ...brunoWithTwoMachines(),
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

function cliCell(canvasElement: HTMLElement, name: string): string | null {
  const row = [...canvasElement.querySelectorAll('tbody tr')].find((tr) =>
    tr.textContent.startsWith(name),
  );
  return row?.children[5]?.textContent ?? null;
}

export const OwnConnections: Story = {
  name: 'The own row offers CLI connections only',
  args: { cliActions: cliActionsOf({}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ada = await canvas.findByRole('button', { name: 'Actions for Ada' });
    await userEvent.click(ada);
    await expect(
      canvas.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['CLI connections']);
    await userEvent.click(
      canvas.getByRole('menuitem', { name: 'CLI connections' }),
    );
    const dialog = await canvas.findByRole('dialog', {
      name: "Ada's CLI connections",
    });
    await within(dialog).findByText('No machine connected.');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close' }),
    );
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(ada).toHaveFocus();
  },
};

export const DisconnectAMachine: Story = {
  name: "Disconnect a dev's machine, then the count follows",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bruno = await canvas.findByRole('button', {
      name: 'Actions for Bruno Delacroix-Montgomery the Second',
    });
    await expect(cliCell(canvasElement, 'Bruno')).toBe('2');
    await userEvent.click(bruno);
    await userEvent.click(
      canvas.getByRole('menuitem', { name: 'CLI connections' }),
    );
    await canvas.findByRole('table', {
      name: "Bruno Delacroix-Montgomery the Second's CLI connections",
    });
    await userEvent.click(
      canvas.getByRole('button', { name: 'Disconnect bruno-laptop' }),
    );
    await expect(
      canvas.getByRole('dialog', { name: 'Disconnect bruno-laptop?' }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Disconnect' }));
    const list = await canvas.findByRole('dialog', {
      name: "Bruno Delacroix-Montgomery the Second's CLI connections",
    });
    await expect(within(list).getAllByRole('row')).toHaveLength(2);
    await expect(within(list).queryByText('bruno-laptop')).toBeNull();
    await userEvent.click(within(list).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(cliCell(canvasElement, 'Bruno')).toBe('1'));
  },
};

export const CancelTheConfirmation: Story = {
  name: 'Cancel keeps the machine',
  args: cancelled,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'Actions for Bruno Delacroix-Montgomery the Second',
      }),
    );
    await userEvent.click(
      canvas.getByRole('menuitem', { name: 'CLI connections' }),
    );
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Disconnect bruno-laptop' }),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(
      await canvas.findByRole('button', { name: 'Disconnect bruno-laptop' }),
    ).toBeVisible();
    await expect(cancelled.cliActions.disconnected).toEqual([]);
  },
};
