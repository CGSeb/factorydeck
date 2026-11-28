import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  PROJECTS_NOW,
  someNoRemote,
  somePendingRemotes,
} from './projects-list-fixtures.ts';
import { NO_REMOTE, REMOTES_NOT_ADDED } from './projects-view.ts';
import { ADD_REMOTE, RemotesNotAdded } from './RemotesNotAdded.tsx';

const meta = {
  component: RemotesNotAdded,
  args: {
    pendingRemotes: somePendingRemotes,
    noRemote: someNoRemote,
    now: PROJECTS_NOW,
    onAdd: fn(),
  },
} satisfies Meta<typeof RemotesNotAdded>;

export default meta;

type Story = StoryObj<typeof meta>;

function rowTexts(canvasElement: HTMLElement): string[][] {
  return [...canvasElement.querySelectorAll('tbody tr')].map((row) =>
    [...row.children].map((cell) => cell.textContent),
  );
}

export const SeveralRemotes: Story = {
  name: 'Several remotes, then the sessions with no remote',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 2, name: REMOTES_NOT_ADDED }),
    ).toBeVisible();
    const table = canvas.getByRole('table', { name: REMOTES_NOT_ADDED });
    await expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Remote',
      'Sessions',
      'First session',
      'Last session',
      'Actions',
    ]);
    await expect(rowTexts(canvasElement)).toEqual([
      [
        'github.com/example-org/factorydeck',
        '12 sessions',
        '10 d ago',
        '20 min ago',
        ADD_REMOTE,
      ],
      [
        'gitlab.example.test/platform/tools/ledger',
        '1 session',
        '3 d ago',
        '3 d ago',
        ADD_REMOTE,
      ],
      [`${NO_REMOTE} 2 folders`, '4 sessions', '', '', ''],
    ]);
    const last = canvasElement.querySelector('tbody tr td:nth-child(4) time');
    await expect(last).toHaveAttribute(
      'title',
      expect.stringMatching(/12 Mar/),
    );
    await userEvent.click(
      canvas.getByRole('button', {
        name: `${ADD_REMOTE} gitlab.example.test/platform/tools/ledger`,
      }),
    );
    await expect(args.onAdd).toHaveBeenCalledWith(
      'gitlab.example.test/platform/tools/ledger',
    );
  },
};

export const NoRemoteOnly: Story = {
  name: 'No remote only',
  args: { pendingRemotes: [], noRemote: { sessions: 1, folders: 1 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(rowTexts(canvasElement)).toEqual([
      [`${NO_REMOTE} 1 folder`, '1 session', '', '', ''],
    ]);
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

export const Hidden: Story = {
  name: 'Hidden: every session has a project',
  args: { pendingRemotes: [], noRemote: null },
  decorators: [
    (Story) => (
      <>
        <Story />
        <p>The page ends here.</p>
      </>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('heading')).toBeNull();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};
