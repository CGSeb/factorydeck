import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, waitFor, within } from 'storybook/test';
import { App } from './App.tsx';
import { loaders } from './app-fixtures.ts';
import type { LoadMe, MeResult } from './auth-api.ts';
import { aloneManager, teamLoaderOf, teamResponse } from './team-fixtures.ts';

const meta = {
  component: App,
  args: {
    ...loaders,
    loadTeam: teamLoaderOf(teamResponse(aloneManager)),
  },
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter
        initialEntries={[
          typeof parameters['path'] === 'string' ? parameters['path'] : '/',
        ]}
      >
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

function meAs(role: 'manager' | 'dev'): LoadMe {
  return () =>
    Promise.resolve({
      status: 'account',
      account: { id: 1, email: 'ada@example.test', name: 'Ada', role },
    });
}

function meAnswering(result: MeResult): LoadMe {
  return () => Promise.resolve(result);
}

const never: LoadMe = () => new Promise<MeResult>(() => undefined);

function linkNames(canvasElement: HTMLElement): string[] {
  const navigation = within(canvasElement).getByRole('navigation');
  return within(navigation)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

export const ManagerSeesTheTeamLink: Story = {
  name: 'Manager: Team is the last link and opens /team',
  args: { loadMe: meAs('manager') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await canvas.findByRole('link', { name: 'Team' });
    await expect(link).toHaveAttribute('href', '/team');
    const names = linkNames(canvasElement).filter((name) =>
      ['Roles', 'Team'].includes(name),
    );
    await expect(names).toEqual(['Roles', 'Team']);
  },
};

export const NoTeamLinkWhileMeLoads: Story = {
  args: { loadMe: never },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'Roles' });
    await expect(canvas.queryByRole('link', { name: 'Team' })).toBeNull();
  },
};

export const NoTeamLinkForADev: Story = {
  args: { loadMe: meAs('dev') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'Roles' });
    await new Promise((done) => setTimeout(done, 0));
    await expect(canvas.queryByRole('link', { name: 'Team' })).toBeNull();
  },
};

export const NoTeamLinkWhenMeFails: Story = {
  name: 'me answers 401 or 503: no Team link',
  args: { loadMe: meAnswering({ status: 'signed-out' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'Roles' });
    await new Promise((done) => setTimeout(done, 0));
    await expect(canvas.queryByRole('link', { name: 'Team' })).toBeNull();
  },
};

export const TeamPageForAManager: Story = {
  parameters: { path: '/team' },
  args: { loadMe: meAs('manager') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Team' });
    await waitFor(() =>
      expect(canvas.getByRole('link', { name: 'Team' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  },
};
