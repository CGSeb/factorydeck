import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  chooseOption,
  expectValue,
  optionTexts,
  waitForOption,
} from './components/select-test.ts';
import { factoryLoaderOf, factoryResponse } from './factory-fixtures.ts';
import {
  collectionLoaderOf,
  collectionResponse,
  refresherOf,
} from './git-host-fixtures.ts';
import type { LoadFactory } from './factory-api.ts';
import { Layout } from './Layout.tsx';
import { useProjectRemoved } from './layout-outlet.ts';
import { optionsOf } from './project-fixtures.ts';
import { SECTION_PATHS } from './components/sidebar-stories.ts';

const APP = 'example-app';
const LIB = 'example-lib';
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
    loadCollection: collectionLoaderOf(collectionResponse(null)),
    refreshCollection: refresherOf(collectionResponse()),
  },
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

function removingFactory(): { loadFactory: LoadFactory; remove: () => void } {
  let projects = optionsOf(['old-app', 'archived-lib']);
  return {
    loadFactory: () => Promise.resolve(factoryResponse([], true, projects)),
    remove: () => {
      projects = projects.filter((option) => option.project !== 'old-app');
    },
  };
}

function RemovingPage({ remove }: { remove: () => void }): ReactElement {
  const projectRemoved = useProjectRemoved();
  return (
    <button
      type="button"
      onClick={() => {
        remove();
        projectRemoved?.('old-app');
      }}
    >
      Remove Old App
    </button>
  );
}

function RemovalHarness(): ReactElement {
  const [store] = useState(removingFactory);
  return (
    <MemoryRouter initialEntries={['/projects?project=old-app']}>
      <Routes>
        <Route
          element={
            <Layout
              loadFactory={store.loadFactory}
              loadCollection={collectionLoaderOf(collectionResponse(null))}
              refreshCollection={refresherOf(collectionResponse())}
            />
          }
        >
          <Route
            path="projects"
            element={<RemovingPage remove={store.remove} />}
          />
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

export const ProjectSelectAllProjects: Story = {
  args: {
    loadFactory: factoryLoaderOf(factoryResponse([], true, twoProjects)),
  },
  decorators: [at('/sessions?period=30d&state=waiting')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForOption(() => projectSelect(canvasElement), 'Example App');
    const select = projectSelect(canvasElement);
    await expect(select).toHaveAttribute('data-value', '');
    await expect(select).toHaveAttribute('title', 'All projects');
    await expect(await optionTexts(projectSelect(canvasElement))).toEqual([
      'All projects',
      'Example App',
      'example-lib',
    ]);
    await expect(sectionHrefs(canvasElement)).toEqual(SECTION_PATHS);
    await chooseOption(select, APP);
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
    await expectValue(projectSelect(canvasElement), APP);
    await chooseOption(projectSelect(canvasElement), '');
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
    await waitForOption(() => projectSelect(canvasElement), 'example-lib');
    await expectValue(projectSelect(canvasElement), LIB);
    await expect(sectionHrefs(canvasElement)).toEqual(
      SECTION_PATHS.map((path) => `${path}?project=${ENCODED_LIB}`),
    );
    await expect(canvas.getByRole('link', { name: 'Roles' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await chooseOption(projectSelect(canvasElement), APP);
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
    await waitForOption(() => projectSelect(canvasElement), 'Example App');
    await expectValue(projectSelect(canvasElement), `${APP}/`);
    await expect(await optionTexts(projectSelect(canvasElement))).toEqual([
      'All projects',
      'Example App',
      'example-lib',
      'example-app/',
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
    await waitForOption(() => projectSelect(canvasElement), 'Example App');
    await expectValue(projectSelect(canvasElement), '');
    await expect(sectionHrefs(canvasElement)).toEqual(SECTION_PATHS);
  },
};

export const ProjectSelectSameNames: Story = {
  args: {
    loadFactory: factoryLoaderOf(
      factoryResponse([], true, [
        { project: 'api', name: 'Shop (api)' },
        { project: 'web', name: 'Shop (web)' },
      ]),
    ),
  },
  decorators: [at('/')],
  play: async ({ canvasElement }) => {
    await waitForOption(() => projectSelect(canvasElement), 'Shop (web)');
    await chooseOption(projectSelect(canvasElement), 'Shop (web)');
    await expect(address(canvasElement)).toHaveTextContent('/?project=web');
    await expect(projectSelect(canvasElement)).toHaveAttribute(
      'title',
      'Shop (web)\nweb',
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
    await waitForOption(() => projectSelect(canvasElement), 'Example App');
    await expectValue(projectSelect(canvasElement), '');
    await chooseOption(projectSelect(canvasElement), APP);
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
    await waitForOption(() => projectSelect(canvasElement), 'Example App');
    await expectValue(projectSelect(canvasElement), APP);
    await chooseOption(projectSelect(canvasElement), '');
    await canvas.findByText('Feature list');
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/features\?period=all$/,
    );
  },
};

export const RemovingTheSelectedProject: Story = {
  render: () => <RemovalHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForOption(() => projectSelect(canvasElement), 'Old App');
    await expectValue(projectSelect(canvasElement), 'old-app');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove Old App' }),
    );
    await waitFor(() =>
      expect(address(canvasElement)).toHaveTextContent(/^\/projects$/),
    );
    await expectValue(projectSelect(canvasElement), '');
    await expect(await optionTexts(projectSelect(canvasElement))).toEqual([
      'All projects',
      'archived-lib',
    ]);
  },
};
