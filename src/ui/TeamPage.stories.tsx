import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, waitFor, within } from 'storybook/test';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import {
  TEAM_NOW,
  aloneManager,
  pendingTeam,
  someTeam,
  teamLoaderOf,
  teamResponse,
  teamSequence,
} from './team-fixtures.ts';
import { REFUSED_MESSAGE } from './team-view.ts';
import { TeamPage } from './TeamPage.tsx';

const meta = {
  component: TeamPage,
  args: { now: TEAM_NOW, loadTeam: teamLoaderOf(teamResponse(someTeam)) },
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

function rowTexts(canvasElement: HTMLElement): string[][] {
  return [...canvasElement.querySelectorAll('tbody tr')].map((row) =>
    [...row.children].map((cell) => cell.textContent),
  );
}

export const Loading: Story = {
  args: { loadTeam: pendingTeam() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Team' }),
    ).toBeVisible();
    await expect(canvas.getByText('Loading…')).toBeVisible();
    await expect(
      canvasElement.querySelector('.fd-page-summary[aria-hidden="true"]'),
    ).not.toBeNull();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

export const OneManagerAlone: Story = {
  args: { loadTeam: teamLoaderOf(teamResponse(aloneManager)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Team' });
    await expect(canvas.getByText('1 account · 1 manager')).toBeVisible();
    await expect(rowTexts(canvasElement)).toEqual([
      ['AdaYou', 'ada@example.test', 'Manager', 'Active', 'just now', '1'],
    ]);
    await expect(canvas.queryByRole('button', { name: /^Actions/ })).toBeNull();
  },
};

export const TeamWithDeactivatedAccounts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Team' });
    await expect(canvas.getByText('5 accounts · 2 managers')).toBeVisible();
    await expect(
      within(canvas.getByRole('table'))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Name', 'Email', 'Role', 'Status', 'Last sign-in', 'CLI']);
    await expect(rowTexts(canvasElement).map((row) => row.slice(2))).toEqual([
      ['Manager', 'Active', 'just now', '1'],
      ['Dev', 'Active', '3 min ago', '2'],
      ['Manager', 'Active', '5 d ago', '—'],
      ['Dev', 'Active', 'Never', '—'],
      ['Dev', 'Deactivated', '2 h ago', '—'],
    ]);
    await expect(canvas.getAllByText('You')).toHaveLength(1);
    const deactivated = canvasElement.querySelectorAll('tr[data-deactivated]');
    await expect(deactivated).toHaveLength(1);
    await expect(deactivated[0]?.textContent).toContain('Eve');
    const minutes = canvas.getByText('3 min ago');
    await expect(minutes.getAttribute('title')).toMatch(/^\d{1,2} \w{3}, /);
  },
};

export const DevRefused: Story = {
  args: {
    loadTeam: teamLoaderOf({ status: 'refused', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(REFUSED_MESSAGE);
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvasElement.querySelector('.fd-page-summary')).toBeNull();
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadTeam: teamLoaderOf({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(UNREACHABLE_MESSAGE);
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

export const RefusedAfterTheTable: Story = {
  name: 'Made dev meanwhile: the refusal replaces the table',
  args: {
    loadTeam: teamSequence([
      { ...teamResponse(aloneManager), refreshSeconds: 0 },
      { status: 'refused', refreshSeconds: 3600 },
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText(REFUSED_MESSAGE)).toBeVisible(),
    );
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

export const KeepsTheTableOnAFailedRefresh: Story = {
  name: 'A failed refresh keeps the last table',
  args: {
    loadTeam: (() => {
      let call = 0;
      return () => {
        call += 1;
        return Promise.resolve(
          call === 1
            ? { ...teamResponse(aloneManager), refreshSeconds: 0 }
            : undefined,
        );
      };
    })(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Team' });
    await new Promise((done) => setTimeout(done, 20));
    await expect(canvas.getByRole('table', { name: 'Team' })).toBeVisible();
    await expect(canvas.getByText('1 account · 1 manager')).toBeVisible();
  },
};
