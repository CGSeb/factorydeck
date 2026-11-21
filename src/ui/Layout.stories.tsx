import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { MissingFactory } from '../projects/types.ts';
import type { DeleteProject, LoadFactory } from './factory-api.ts';
import {
  archivedLib,
  deleterOf,
  factoryLoaderOf,
  factoryResponse,
  oldApp,
} from './factory-fixtures.ts';
import { Layout } from './Layout.tsx';

function at(path: string): Decorator {
  return (Story) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Story />}>
          <Route index element={<p>Section content</p>} />
          <Route path="sessions" element={<p>Session list</p>} />
          <Route path="roles" element={<p>Role list</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const meta = {
  component: Layout,
  args: {
    loadFactory: factoryLoaderOf(factoryResponse()),
    deleteProject: deleterOf('deleted'),
  },
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OverviewActive: Story = {
  decorators: [at('/')],
};

export const SessionsActive: Story = {
  decorators: [at('/sessions')],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('link', { name: 'Sessions' }),
    ).toHaveAttribute('aria-current', 'page');
  },
};

export const RolesActive: Story = {
  decorators: [at('/roles')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const links = canvas.getAllByRole('link');
    await expect(links.map((link) => link.textContent)).toEqual([
      'Overview',
      'Sessions',
      'Skills',
      'Roles',
    ]);
    await expect(canvas.getByRole('link', { name: 'Roles' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};

export const NoSessionYet: Story = {
  args: { loadFactory: factoryLoaderOf(factoryResponse([], false)) },
  decorators: [at('/sessions')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', {
      name: 'Install the factory in a project',
    });
    await expect(canvas.queryByText('Session list')).toBeNull();
  },
};

export const OneProjectWithoutFactory: Story = {
  args: { loadFactory: factoryLoaderOf(factoryResponse([oldApp])) },
  decorators: [at('/')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = await canvas.findByRole('region', {
      name: 'Factory configuration',
    });
    await expect(within(banner).getAllByRole('listitem')).toHaveLength(1);
    await expect(canvas.getByText('Section content')).toBeVisible();
  },
};

export const TwoProjectsWithoutFactory: Story = {
  args: {
    loadFactory: factoryLoaderOf(factoryResponse([archivedLib, oldApp])),
  },
  decorators: [at('/')],
  play: async ({ canvasElement }) => {
    const banner = await within(canvasElement).findByRole('region', {
      name: 'Factory configuration',
    });
    await expect(within(banner).getAllByRole('listitem')).toHaveLength(2);
  },
};

function lastProjectStore(): {
  loadFactory: LoadFactory;
  deleteProject: DeleteProject;
} {
  let missing: MissingFactory[] = [oldApp];
  return {
    loadFactory: () =>
      Promise.resolve(factoryResponse(missing, missing.length > 0)),
    deleteProject: (project) => {
      missing = missing.filter((row) => row.project !== project);
      return Promise.resolve('deleted');
    },
  };
}

export const DeletingTheLastProject: Story = {
  args: lastProjectStore(),
  decorators: [at('/')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Delete project' }),
    );
    const dialog = within(canvas.getByRole('dialog'));
    await userEvent.click(
      dialog.getByRole('button', { name: 'Delete project' }),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', {
          name: 'Install the factory in a project',
        }),
      ).toBeVisible(),
    );
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(
      canvas.queryByRole('region', { name: 'Factory configuration' }),
    ).toBeNull();
  },
};
