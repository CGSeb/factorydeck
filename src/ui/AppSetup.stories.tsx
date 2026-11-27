import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { App } from './App.tsx';
import { loaders } from './app-fixtures.ts';
import type { LoadAuthState, SetupManager } from './auth-api.ts';
import { SETUP_TITLE } from './SetupPage.tsx';

function Location(): ReactElement {
  const { pathname } = useLocation();
  return <p data-testid="location">{pathname}</p>;
}

function spied(): typeof loaders {
  return {
    loadOverview: fn(loaders.loadOverview),
    loadSessions: fn(loaders.loadSessions),
    loadSession: fn(loaders.loadSession),
    loadSkills: fn(loaders.loadSkills),
    loadSkill: fn(loaders.loadSkill),
    loadRoles: fn(loaders.loadRoles),
    loadFeatures: fn(loaders.loadFeatures),
    loadFeature: fn(loaders.loadFeature),
    loadBugs: fn(loaders.loadBugs),
    loadFactory: fn(loaders.loadFactory),
    deleteProject: fn(loaders.deleteProject),
    loadCollection: fn(loaders.loadCollection),
    refreshCollection: fn(loaders.refreshCollection),
    loadAutonomy: fn(loaders.loadAutonomy),
    loadQuality: fn(loaders.loadQuality),
    loadFrictions: fn(loaders.loadFrictions),
    loadOccurrences: fn(loaders.loadOccurrences),
    loadOutput: fn(loaders.loadOutput),
    loadFlow: fn(loaders.loadFlow),
    loadBugStats: fn(loaders.loadBugStats),
    loadWaiting: fn(loaders.loadWaiting),
  };
}

function stateOf(setup: boolean): LoadAuthState {
  return () => Promise.resolve({ setup });
}

const created: SetupManager = () => Promise.resolve({ status: 'created' });

const meta = {
  component: App,
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter
        initialEntries={[
          typeof parameters['path'] === 'string' ? parameters['path'] : '/',
        ]}
      >
        <Story />
        <Location />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SetupNeeded: Story = {
  name: 'Not set up: every page opens /setup',
  parameters: { path: '/stats' },
  args: {
    ...spied(),
    loadAuthState: stateOf(true),
    setupManager: created,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: SETUP_TITLE });
    await expect(canvas.getByTestId('location')).toHaveTextContent('/setup');
    await expect(canvas.queryByRole('navigation')).toBeNull();
    for (const [name, loader] of Object.entries(args)) {
      if (name === 'loadAuthState' || name === 'setupManager') continue;
      await expect(loader).not.toHaveBeenCalled();
    }
    await userEvent.type(canvas.getByLabelText('Setup code'), 'k7mq2xrd');
    await userEvent.type(canvas.getByLabelText('Name'), 'Ada');
    await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.test');
    await userEvent.type(
      canvas.getByLabelText('Password'),
      'a long passphrase{Enter}',
    );
    await waitFor(() =>
      expect(canvas.getByTestId('location')).toHaveTextContent(/^\/$/),
    );
    await canvas.findByRole('region', { name: 'Board' });
  },
};

export const SetUp: Story = {
  name: 'Set up: /setup opens /',
  parameters: { path: '/setup' },
  args: { ...loaders, loadAuthState: stateOf(false), setupManager: created },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('region', { name: 'Board' });
    await expect(canvas.getByTestId('location')).toHaveTextContent(/^\/$/);
    await expect(canvas.queryByText(SETUP_TITLE)).toBeNull();
  },
};
