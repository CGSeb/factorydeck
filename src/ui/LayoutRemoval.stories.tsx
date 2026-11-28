import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { ProjectOption } from '../projects/label.ts';
import { optionTexts, waitForOption } from './components/select-test.ts';
import type { LoadFactory } from './factory-api.ts';
import { factoryLoaderOf, factoryResponse } from './factory-fixtures.ts';
import {
  collectionLoaderOf,
  collectionResponse,
  refresherOf,
} from './git-host-fixtures.ts';
import { Layout } from './Layout.tsx';
import { useProjectRemoved } from './layout-outlet.ts';
import { optionsOf } from './project-fixtures.ts';

const meta = {
  component: Layout,
  args: {
    loadFactory: factoryLoaderOf(factoryResponse()),
    loadCollection: collectionLoaderOf(collectionResponse(null)),
    refreshCollection: refresherOf(collectionResponse()),
  },
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

interface Store {
  loadFactory: LoadFactory;
  remove: (slug: string) => void;
  mounts: { value: number };
}

function projectStore(initial: ProjectOption[]): Store {
  let projects = initial;
  return {
    loadFactory: () =>
      Promise.resolve(factoryResponse([], projects.length > 0, projects)),
    remove: (slug) => {
      projects = projects.filter((option) => option.project !== slug);
    },
    mounts: { value: 0 },
  };
}

function RemovingPage({ store }: { store: Store }): ReactElement {
  const projectRemoved = useProjectRemoved();
  const [mount] = useState(() => {
    store.mounts.value += 1;
    return store.mounts.value;
  });
  return (
    <>
      <p>Page loaded {mount} times</p>
      <button
        type="button"
        onClick={() => {
          store.remove('old-app');
          projectRemoved?.('old-app');
        }}
      >
        Remove Old App
      </button>
    </>
  );
}

function RemovalHarness({
  initial,
}: {
  initial: ProjectOption[];
}): ReactElement {
  const [store] = useState(() => projectStore(initial));
  return (
    <MemoryRouter initialEntries={['/']}>
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
          <Route index element={<RemovingPage store={store} />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function projectSelect(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('combobox', { name: 'Project' });
}

export const RemovingOneOfTwoProjects: Story = {
  render: () => (
    <RemovalHarness initial={optionsOf(['old-app', 'archived-lib'])} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForOption(() => projectSelect(canvasElement), 'Old App');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove Old App' }),
    );
    await waitFor(async () =>
      expect(await optionTexts(projectSelect(canvasElement))).toEqual([
        'All projects',
        'archived-lib',
      ]),
    );
    await expect(canvas.getByText('Page loaded 1 times')).toBeVisible();
  },
};

export const RemovingTheLastProject: Story = {
  render: () => <RemovalHarness initial={optionsOf(['old-app'])} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Remove Old App' }),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', {
          name: 'Install the factory in a project',
        }),
      ).toBeVisible(),
    );
  },
};
