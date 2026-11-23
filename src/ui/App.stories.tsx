import {
  collectionLoaderOf,
  collectionResponse,
  refresherOf,
} from './git-host-fixtures.ts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import { chooseOption } from './components/select-test.ts';
import { App } from './App.tsx';
import {
  deleterOf,
  factoryLoaderOf,
  factoryResponse,
  oldApp,
} from './factory-fixtures.ts';
import { featureLoaderOf } from './feature-detail-fixtures.ts';
import { featuresLoaderOf, someFeatures } from './feature-fixtures.ts';
import { fixedLoader, okResponse, weekOverview } from './fixtures.ts';
import { optionsOf } from './project-fixtures.ts';
import { rolesLoader, someRoles } from './role-fixtures.ts';
import {
  detailLoader,
  detailResponse,
  listLoader,
  sessionWithSubAgents,
  someSessions,
} from './session-fixtures.ts';
import {
  skillLoader,
  skillsLoader,
  someSkills,
  writeSpecDetail,
} from './skill-fixtures.ts';
import { flowLoaderOf } from './flow-fixtures.ts';
import { autonomyLoaderOf, qualityLoaderOf } from './stats-fixtures.ts';
import { frictionsLoaderOf } from './frictions-fixtures.ts';

const meta = {
  component: App,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

const loaders = {
  loadOverview: fixedLoader(() => okResponse(weekOverview)),
  loadSessions: listLoader(someSessions),
  loadSession: detailLoader(detailResponse(sessionWithSubAgents)),
  loadSkills: skillsLoader(someSkills),
  loadSkill: skillLoader(writeSpecDetail),
  loadRoles: rolesLoader(someRoles),
  loadFeatures: featuresLoaderOf(someFeatures),
  loadFeature: featureLoaderOf(),
  loadFactory: factoryLoaderOf(factoryResponse()),
  deleteProject: deleterOf('deleted'),
  loadCollection: collectionLoaderOf(collectionResponse()),
  refreshCollection: refresherOf(collectionResponse()),
  loadAutonomy: autonomyLoaderOf(),
  loadQuality: qualityLoaderOf(),
  loadFrictions: frictionsLoaderOf(),
  loadFlow: flowLoaderOf(),
};

export const Home: Story = {
  args: loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('link', { name: 'Overview' }),
    ).toHaveAttribute('aria-current', 'page');
    await canvas.findByRole('region', { name: 'Board' });
    await expect(
      canvas.getByRole('button', { name: 'Last 7 days' }),
    ).toHaveAttribute('aria-pressed', 'true');
  },
};

export const Sessions: Story = {
  args: loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('link', { name: 'Sessions' }));
    await expect(
      canvas.getByRole('link', { name: 'Sessions' }),
    ).toHaveAttribute('aria-current', 'page');
    await canvas.findByText('3 sessions');
    await userEvent.click(
      canvas.getByRole('link', { name: 'Add the export button' }),
    );
    await canvas.findByRole('heading', {
      level: 1,
      name: 'Add the export button',
    });
    await expect(canvas.getByText('Find the export code')).toBeVisible();
  },
};

export const Skills: Story = {
  args: loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('link', { name: 'Skills' }));
    await expect(canvas.getByRole('link', { name: 'Skills' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(
      await canvas.findByRole('link', { name: 'kit:write-spec' }),
    );
    await canvas.findByRole('heading', { name: 'kit:write-spec' });
    await expect(canvas.getByText('Launches per day')).toBeVisible();
  },
};

export const Stats: Story = {
  args: loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sections = within(
      canvas.getByRole('navigation', { name: 'Sections' }),
    );
    await userEvent.click(sections.getByRole('link', { name: 'Stats' }));
    await expect(sections.getByRole('link', { name: 'Stats' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await canvas.findByRole('heading', { level: 1, name: 'Stats' });
    await expect(
      await canvas.findByRole('heading', { name: 'Autonomy' }),
    ).toBeVisible();
    await expect(
      await canvas.findByRole('heading', { name: 'Flow and cost' }),
    ).toBeVisible();
  },
};

export const Frictions: Story = {
  args: loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sections = within(
      canvas.getByRole('navigation', { name: 'Sections' }),
    );
    await userEvent.click(sections.getByRole('link', { name: 'Frictions' }));
    await expect(
      sections.getByRole('link', { name: 'Frictions' }),
    ).toHaveAttribute('aria-current', 'page');
    await canvas.findByRole('heading', { level: 1, name: 'Frictions' });
    await expect(
      await canvas.findByRole('heading', {
        name: 'Frictions per 100 API calls, by week',
      }),
    ).toBeVisible();
  },
};

export const Roles: Story = {
  args: loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sections = within(
      canvas.getByRole('navigation', { name: 'Sections' }),
    );
    await userEvent.click(sections.getByRole('link', { name: 'Roles' }));
    await expect(sections.getByRole('link', { name: 'Roles' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await canvas.findByRole('heading', { name: 'Roles' });
    await expect(
      await canvas.findByRole('rowheader', { name: 'builder' }),
    ).toBeVisible();
  },
};

export const Features: Story = {
  args: loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const links = canvas.getAllByRole('link').map((link) => link.textContent);
    await expect(links.slice(0, 2)).toEqual(['Overview', 'Features']);
    await userEvent.click(canvas.getByRole('link', { name: 'Features' }));
    await expect(
      canvas.getByRole('link', { name: 'Features' }),
    ).toHaveAttribute('aria-current', 'page');
    await userEvent.click(
      await canvas.findByRole('link', { name: '#52 Export button' }),
    );
    await canvas.findByRole('heading', { name: '#52 Export button' });
    await expect(
      canvas.getByRole('link', { name: 'Export button' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/example-org/example-app/issues/52',
    );
  },
};

export const NoSessionYet: Story = {
  args: {
    ...loaders,
    loadFactory: factoryLoaderOf(factoryResponse([], false)),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const section of [
      'Overview',
      'Features',
      'Stats',
      'Frictions',
      'Sessions',
      'Skills',
      'Roles',
    ]) {
      await userEvent.click(canvas.getByRole('link', { name: section }));
      await expect(
        await canvas.findByRole('heading', {
          name: 'Install the factory in a project',
        }),
      ).toBeVisible();
      await expect(canvas.queryByRole('table')).toBeNull();
    }
  },
};

export const FactoryNotFound: Story = {
  args: {
    ...loaders,
    loadFactory: factoryLoaderOf(factoryResponse([oldApp])),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/Factory configuration not found for Old App/),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('link', { name: 'Sessions' }));
    await expect(
      canvas.getByText(/Factory configuration not found for Old App/),
    ).toBeVisible();
    await canvas.findByText('3 sessions');
  },
};

export const OneProjectAcrossPages: Story = {
  args: {
    ...loaders,
    loadFactory: factoryLoaderOf(
      factoryResponse(
        [],
        true,
        optionsOf(['/home/dev/example-app', '/home/dev/example-lib']),
      ),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('~$48.27');
    await chooseOption(
      await canvas.findByRole('combobox', { name: 'Project' }),
      '/home/dev/example-app',
    );
    await userEvent.click(canvas.getByRole('link', { name: 'Sessions' }));
    await canvas.findByText('1 session');
    await expect(
      canvas.getByRole('combobox', { name: 'Project' }),
    ).toHaveAttribute('data-value', '/home/dev/example-app');
    await expect(
      canvas.getByRole('link', { name: 'Add the export button' }),
    ).toHaveAttribute(
      'href',
      expect.stringMatching(
        /\?project=%2Fhome%2Fdev%2Fexample-app&period=\w+$/,
      ),
    );
    await userEvent.click(canvas.getByRole('link', { name: 'Features' }));
    await canvas.findByRole('rowheader', { name: '#52 Export button' });
    await expect(
      canvas.queryByRole('columnheader', { name: 'Project' }),
    ).toBeNull();
    await expect(
      canvas.getByRole('combobox', { name: 'Project' }),
    ).toHaveAttribute('data-value', '/home/dev/example-app');
  },
};
