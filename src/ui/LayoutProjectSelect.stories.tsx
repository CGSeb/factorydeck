import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { DeleteProject, LoadFactory } from './factory-api.ts';
import {
  archivedLib,
  deleterOf,
  factoryLoaderOf,
  factoryResponse,
  oldApp,
} from './factory-fixtures.ts';
import {
  collectionLoaderOf,
  collectionResponse,
  refresherOf,
} from './git-host-fixtures.ts';
import { Layout } from './Layout.tsx';
import { optionsOf } from './project-fixtures.ts';

const APP = '/home/dev/example-app';
const LIB = '/home/dev/example-lib';
const ENCODED_APP = encodeURIComponent(APP);
const ENCODED_LIB = encodeURIComponent(LIB);
const twoProjects = optionsOf([APP, LIB]);

function Location(): ReactElement {
  const { pathname, search } = useLocation();
  return <output aria-label="Address">{`${pathname}${search}`}</output>;
}

function at(path: string): Decorator {
  return (Story) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Story />}>
          <Route index element={<p>Section content</p>} />
          <Route path="sessions" element={<p>Session list</p>} />
          <Route path="sessions/:id" element={<p>Session page</p>} />
          <Route path="features" element={<p>Feature list</p>} />
          <Route path="features/:number" element={<p>Issue page</p>} />
          <Route path="roles" element={<p>Role list</p>} />
        </Route>
      </Routes>
      <Location />
    </MemoryRouter>
  );
}

const meta = {
  component: Layout,
  args: {
    loadFactory: factoryLoaderOf(factoryResponse([], true, twoProjects)),
    deleteProject: deleterOf('deleted'),
    loadCollection: collectionLoaderOf(collectionResponse(null)),
    refreshCollection: refresherOf(collectionResponse()),
  },
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

function deletingStore(): {
  loadFactory: LoadFactory;
  deleteProject: DeleteProject;
} {
  let missing = [archivedLib, oldApp];
  return {
    loadFactory: () =>
      Promise.resolve(
        factoryResponse(
          missing,
          true,
          optionsOf(missing.map((row) => row.project)),
        ),
      ),
    deleteProject: (project) => {
      missing = missing.filter((row) => row.project !== project);
      return Promise.resolve('deleted');
    },
  };
}

function DeletionHarness(): ReactElement {
  const [store] = useState(deletingStore);
  return (
    <MemoryRouter
      initialEntries={[`/?project=${encodeURIComponent(oldApp.project)}`]}
    >
      <Routes>
        <Route
          element={
            <Layout
              {...store}
              loadCollection={collectionLoaderOf(collectionResponse(null))}
              refreshCollection={refresherOf(collectionResponse())}
            />
          }
        >
          <Route index element={<p>Section content</p>} />
        </Route>
      </Routes>
      <Location />
    </MemoryRouter>
  );
}

function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

function projectSelect(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('combobox', { name: 'Project' });
}

function sectionHrefs(canvasElement: HTMLElement): (string | null)[] {
  const nav = within(canvasElement).getByRole('navigation', {
    name: 'Sections',
  });
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));
}

function optionTexts(canvasElement: HTMLElement): (string | null)[] {
  return within(projectSelect(canvasElement))
    .getAllByRole('option')
    .map((option) => option.textContent);
}

const SECTION_PATHS = ['/', '/features', '/sessions', '/skills', '/roles'];

export const ProjectSelectAllProjects: Story = {
  args: {
    loadFactory: factoryLoaderOf(factoryResponse([], true, twoProjects)),
  },
  decorators: [at('/sessions?period=30d&state=waiting')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('option', { name: 'Example App' });
    const select = projectSelect(canvasElement);
    await expect(select).toHaveValue('');
    await expect(select).toHaveAttribute('title', 'All projects');
    await expect(optionTexts(canvasElement)).toEqual([
      'All projects',
      'Example App',
      'example-lib',
    ]);
    await expect(sectionHrefs(canvasElement)).toEqual(SECTION_PATHS);
    await userEvent.selectOptions(select, APP);
    await expect(address(canvasElement)).toHaveTextContent(
      `/sessions?period=30d&state=waiting&project=${ENCODED_APP}`,
    );
    await expect(sectionHrefs(canvasElement)).toEqual(
      SECTION_PATHS.map((path) => `${path}?project=${ENCODED_APP}`),
    );
    await expect(projectSelect(canvasElement)).toHaveAttribute(
      'title',
      `Example App\n${APP}`,
    );
    await userEvent.click(canvas.getByRole('link', { name: 'Features' }));
    await expect(address(canvasElement)).toHaveTextContent(
      `/features?project=${ENCODED_APP}`,
    );
    await expect(projectSelect(canvasElement)).toHaveValue(APP);
    await userEvent.selectOptions(projectSelect(canvasElement), '');
    await expect(address(canvasElement)).toHaveTextContent(/^\/features$/);
    await expect(sectionHrefs(canvasElement)).toEqual(SECTION_PATHS);
  },
};

export const ProjectSelectOneProject: Story = {
  args: {
    loadFactory: factoryLoaderOf(factoryResponse([], true, twoProjects)),
  },
  decorators: [at(`/roles?period=all&project=${ENCODED_LIB}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('option', { name: 'example-lib' });
    await expect(projectSelect(canvasElement)).toHaveValue(LIB);
    await expect(sectionHrefs(canvasElement)).toEqual(
      SECTION_PATHS.map((path) => `${path}?project=${ENCODED_LIB}`),
    );
    await expect(canvas.getByRole('link', { name: 'Roles' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.selectOptions(projectSelect(canvasElement), APP);
    await expect(address(canvasElement)).toHaveTextContent(
      `/roles?period=all&project=${ENCODED_APP}`,
    );
  },
};

export const ProjectSelectUnknownProject: Story = {
  args: {
    loadFactory: factoryLoaderOf(factoryResponse([], true, twoProjects)),
  },
  decorators: [at(`/?project=${encodeURIComponent(`${APP}/`)}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('option', { name: 'Example App' });
    await expect(projectSelect(canvasElement)).toHaveValue(`${APP}/`);
    await expect(optionTexts(canvasElement)).toEqual([
      'All projects',
      'Example App',
      'example-lib',
      'example-app',
    ]);
    await expect(sectionHrefs(canvasElement)[0]).toBe(
      `/?project=${encodeURIComponent(`${APP}/`)}`,
    );
  },
};

export const ProjectSelectEmptyParameter: Story = {
  args: {
    loadFactory: factoryLoaderOf(factoryResponse([], true, twoProjects)),
  },
  decorators: [at('/?project=')],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('option', { name: 'Example App' });
    await expect(projectSelect(canvasElement)).toHaveValue('');
    await expect(sectionHrefs(canvasElement)).toEqual(SECTION_PATHS);
  },
};

export const ProjectSelectSameNames: Story = {
  args: {
    loadFactory: factoryLoaderOf(
      factoryResponse([], true, [
        { project: '/home/dev/api', name: 'Shop (/home/dev/api)' },
        { project: '/home/dev/web', name: 'Shop (/home/dev/web)' },
      ]),
    ),
  },
  decorators: [at('/')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('option', { name: 'Shop (/home/dev/web)' });
    await userEvent.selectOptions(
      projectSelect(canvasElement),
      'Shop (/home/dev/web)',
    );
    await expect(address(canvasElement)).toHaveTextContent(
      '/?project=%2Fhome%2Fdev%2Fweb',
    );
    await expect(projectSelect(canvasElement)).toHaveAttribute(
      'title',
      'Shop (/home/dev/web)\n/home/dev/web',
    );
  },
};

export const ProjectSelectOnSessionPage: Story = {
  args: {
    loadFactory: factoryLoaderOf(factoryResponse([], true, twoProjects)),
  },
  decorators: [at('/sessions/7f3a9c21?period=30d')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('option', { name: 'Example App' });
    await expect(projectSelect(canvasElement)).toHaveValue('');
    await userEvent.selectOptions(projectSelect(canvasElement), APP);
    await canvas.findByText('Session list');
    await expect(address(canvasElement)).toHaveTextContent(
      `/sessions?period=30d&project=${ENCODED_APP}`,
    );
  },
};

export const ProjectSelectOnIssuePage: Story = {
  args: {
    loadFactory: factoryLoaderOf(factoryResponse([], true, twoProjects)),
  },
  decorators: [at(`/features/52?project=${ENCODED_APP}&period=all`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('option', { name: 'Example App' });
    await expect(projectSelect(canvasElement)).toHaveValue(APP);
    await userEvent.selectOptions(projectSelect(canvasElement), '');
    await canvas.findByText('Feature list');
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/features\?period=all$/,
    );
  },
};

export const DeletingTheSelectedProject: Story = {
  render: () => <DeletionHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('option', { name: 'Old App' });
    await expect(projectSelect(canvasElement)).toHaveValue(oldApp.project);
    const [, oldAppLine] = await canvas.findAllByRole('button', {
      name: 'Delete project',
    });
    if (oldAppLine === undefined) throw new Error('No banner line');
    await userEvent.click(oldAppLine);
    const dialog = within(canvas.getByRole('dialog'));
    await userEvent.click(
      dialog.getByRole('button', { name: 'Delete project' }),
    );
    await waitFor(() =>
      expect(canvas.queryByRole('option', { name: 'Old App' })).toBeNull(),
    );
    await expect(projectSelect(canvasElement)).toHaveValue('');
    await expect(address(canvasElement)).toHaveTextContent(/^\/$/);
    await expect(optionTexts(canvasElement)).toEqual([
      'All projects',
      'archived-lib',
    ]);
  },
};
