import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, waitFor, within } from 'storybook/test';
import { App } from './App.tsx';
import { loaders } from './app-fixtures.ts';
import type { LoadMe, MeResult } from './auth-api.ts';
import { aloneManager, teamLoaderOf, teamResponse } from './team-fixtures.ts';
import {
  projectsLoaderOf,
  projectsResponse,
  savingAnswer,
  someProjects,
} from './projects-list-fixtures.ts';
import { PROJECTS_REFUSED } from './projects-view.ts';

const meta = {
  component: App,
  args: {
    ...loaders,
    loadTeam: teamLoaderOf(teamResponse(aloneManager)),
    loadProjects: projectsLoaderOf(projectsResponse(someProjects)),
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
  name: 'Manager: Team follows Roles and opens /team',
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

export const ManagerSeesTheProjectsLink: Story = {
  name: 'Manager: Projects follows Team and opens /projects',
  args: { loadMe: meAs('manager') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await canvas.findByRole('link', { name: 'Projects' });
    await expect(link).toHaveAttribute('href', '/projects');
    await expect(linkNames(canvasElement).slice(-3)).toEqual([
      'Roles',
      'Team',
      'Projects',
    ]);
  },
};

export const ProjectSettingsForAManager: Story = {
  name: 'Manager: Projects stays current on a project settings page',
  parameters: { path: '/projects/atlas' },
  args: {
    loadMe: meAs('manager'),
    saveProject: savingAnswer({ status: 'missing' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 2, name: 'General' });
    await waitFor(() =>
      expect(canvas.getByRole('link', { name: 'Projects' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  },
};

export const NoProjectsLinkForADev: Story = {
  args: { loadMe: meAs('dev') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'Roles' });
    await new Promise((done) => setTimeout(done, 0));
    await expect(canvas.queryByRole('link', { name: 'Projects' })).toBeNull();
  },
};

export const NoProjectsLinkWhileMeLoads: Story = {
  args: { loadMe: never },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'Roles' });
    await expect(canvas.queryByRole('link', { name: 'Projects' })).toBeNull();
  },
};

export const ProjectsPageForAManager: Story = {
  parameters: { path: '/projects' },
  args: { loadMe: meAs('manager') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Projects' });
    await waitFor(() =>
      expect(canvas.getByRole('link', { name: 'Projects' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  },
};

export const ProjectsPageForADev: Story = {
  parameters: { path: '/projects' },
  args: {
    loadMe: meAs('dev'),
    loadProjects: projectsLoaderOf({ status: 'refused', refreshSeconds: 10 }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(PROJECTS_REFUSED)).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Projects' })).toBeNull();
  },
};
