import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  githubWithToken,
  savedToken,
  selfHostedUnknown,
  tokenRemoverOf,
  tokenSaverOf,
} from './git-host-token-fixtures.ts';
import type { SaveToken } from './git-host-token-api.ts';
import type { ListedProject, LoadProjects } from './projects-api.ts';
import { pendingSave } from './projects-list-fixtures.ts';
import { ProjectSettingsPage } from './ProjectSettingsPage.tsx';
import { memoryDataRouter } from './story-router.ts';

function refreshing(
  project: ListedProject,
  secretKey = true,
  refreshSeconds = 0.05,
): LoadProjects {
  return () =>
    Promise.resolve({
      status: 'ok',
      refreshSeconds,
      secretKey,
      projects: [project],
      pendingRemotes: [],
      noRemote: null,
    });
}

const meta = {
  component: ProjectSettingsPage,
  args: {
    loadProjects: refreshing(githubWithToken),
    saveProject: pendingSave(),
    saveToken: fn(tokenSaverOf(savedToken)),
    removeToken: fn(tokenRemoverOf({ status: 'removed' })),
  },
  decorators: [
    (Story, { parameters }) =>
      memoryDataRouter(
        typeof parameters['entry'] === 'string'
          ? parameters['entry']
          : '/projects/billing-service',
        [
          { path: '/projects/:slug', element: <Story /> },
          { path: '/projects', element: <p>Project list</p> },
        ],
      ),
  ],
} satisfies Meta<typeof ProjectSettingsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AfterGeneral: Story = {
  name: 'Git host: after General, and the refresh keeps a typed token',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 2, name: 'Git host' });
    await expect(
      canvas.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['General', 'Git host']);
    await userEvent.type(canvas.getByLabelText('Token'), 'ghp_example');
    await new Promise((done) => setTimeout(done, 200));
    await expect(canvas.getByLabelText('Token')).toHaveValue('ghp_example');
  },
};

export const RefreshKeepsHost: Story = {
  name: 'Git host: the refresh keeps a changed select',
  args: { loadProjects: refreshing(selfHostedUnknown) },
  parameters: { entry: '/projects/atlas' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = await canvas.findByLabelText('Host');
    await userEvent.selectOptions(select, 'gitlab');
    await new Promise((done) => setTimeout(done, 200));
    await expect(canvas.getByLabelText('Host')).toHaveValue('gitlab');
  },
};

function tokenServer() {
  let stored = githubWithToken;
  return {
    loadProjects: () => refreshing(stored, true, 3600)(),
    saveToken: fn<SaveToken>(() => {
      if (savedToken.status === 'saved') {
        stored = { ...stored, ...savedToken.token };
      }
      return Promise.resolve(savedToken);
    }),
  };
}

export const SaveKeepsGeneralEdits: Story = {
  name: 'Git host: saving the token leaves the edits of General alone',
  args: tokenServer(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = await canvas.findByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Billing core');
    await userEvent.type(canvas.getByLabelText('Token'), 'ghp_example');
    await userEvent.click(canvas.getByRole('button', { name: 'Save token' }));
    await expect(
      await canvas.findByText(
        'Token checked: main has docs/agents/factory.yml.',
      ),
    ).toBeVisible();
    await expect(canvas.getByLabelText('Name')).toHaveValue('Billing core');
    await expect(canvas.getByText(/^Token set on/)).toHaveTextContent(
      'Token set on 12 Mar 2026 by Grace',
    );
  },
};

export const NoSecretKeyFromList: Story = {
  name: 'Git host: secretKey false in the list shows the no-key state',
  args: { loadProjects: refreshing(githubWithToken, false, 3600) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(
        'Set FACTORYDECK_SECRET_KEY on the server to store tokens.',
      ),
    ).toBeVisible();
  },
};

export const LeaveWithTypedToken: Story = {
  name: 'Leave prompt: a typed token asks Leave without saving the token?',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText('Token'), 'ghp_example');
    await userEvent.click(canvas.getByRole('link', { name: '← Projects' }));
    const dialog = await canvas.findByRole('dialog', {
      name: 'Leave without saving the token?',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(canvas.getByLabelText('Token')).toHaveValue('ghp_example');
    await userEvent.click(canvas.getByRole('link', { name: '← Projects' }));
    await userEvent.click(
      within(await canvas.findByRole('dialog')).getByRole('button', {
        name: 'Leave',
      }),
    );
    await expect(await canvas.findByText('Project list')).toBeVisible();
  },
};

export const LeaveWithChangedHost: Story = {
  name: 'Leave prompt: a changed select counts as a change',
  args: { loadProjects: refreshing(selfHostedUnknown, true, 3600) },
  parameters: { entry: '/projects/atlas' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      await canvas.findByLabelText('Host'),
      'github',
    );
    await userEvent.click(canvas.getByRole('link', { name: '← Projects' }));
    await expect(
      await canvas.findByRole('dialog', {
        name: 'Leave without saving the token?',
      }),
    ).toBeVisible();
  },
};

export const LeaveWithoutChanges: Story = {
  name: 'Leave prompt: none once the token is saved',
  args: { loadProjects: refreshing(githubWithToken, true, 3600) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText('Token'), 'ghp_example');
    await userEvent.click(canvas.getByRole('button', { name: 'Save token' }));
    await canvas.findByText('Token checked: main has docs/agents/factory.yml.');
    await userEvent.click(canvas.getByRole('link', { name: '← Projects' }));
    await expect(await canvas.findByText('Project list')).toBeVisible();
    await expect(canvas.queryByRole('dialog')).toBeNull();
  },
};
