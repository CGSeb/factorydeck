import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, createContext, useContext, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  archivedLib,
  factoryLoaderOf,
  factoryResponse,
  oldApp,
} from './factory-fixtures.ts';
import {
  appFailure,
  collectionLoaderOf,
  collectionResponse,
  pendingRefresher,
  refresherOf,
} from './git-host-fixtures.ts';
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
    loadCollection: collectionLoaderOf(collectionResponse(null)),
    refreshCollection: refresherOf(collectionResponse()),
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
      'Features',
      'Stats',
      'Frictions',
      'Sessions',
      'Skills',
      'Roles',
      'GitHub',
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
    await expect(canvas.queryByRole('combobox')).toBeNull();
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

const MountCounter = createContext({ value: 0 });

function PageContent(): ReactElement {
  const counter = useContext(MountCounter);
  const [mount] = useState(() => {
    counter.value += 1;
    return counter.value;
  });
  return <p>Page loaded {mount} times</p>;
}

function loads(canvasElement: HTMLElement): number {
  const text = within(canvasElement).getByText(/^Page loaded/).textContent;
  return Number(/\d+/.exec(text)?.[0]);
}

export const NeverCollected: Story = {
  decorators: [at('/')],
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Issues not collected yet'),
    ).toBeVisible();
  },
};

export const RefreshClearsCollectionError: Story = {
  args: {
    loadCollection: collectionLoaderOf(
      collectionResponse(new Date().toISOString(), [appFailure]),
    ),
    refreshCollection: refresherOf(
      collectionResponse(new Date().toISOString(), []),
    ),
  },
  decorators: [at('/')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = await canvas.findByRole('region', {
      name: 'Factory configuration',
    });
    await expect(banner).toHaveTextContent(
      'Could not read GitHub for example-app: gh not found.',
    );
    await expect(canvas.getByText('Issues updated just now')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /^Refresh\b/ }));
    await waitFor(() =>
      expect(
        canvas.queryByRole('region', { name: 'Factory configuration' }),
      ).toBeNull(),
    );
  },
};

export const RefreshStillRunning: Story = {
  args: { refreshCollection: pendingRefresher() },
  decorators: [at('/')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Issues not collected yet');
    await userEvent.click(canvas.getByRole('button', { name: /^Refresh\b/ }));
    await expect(
      canvas.getByRole('button', { name: 'Refreshing…' }),
    ).toBeDisabled();
  },
};

function RefreshHarness(): ReactElement {
  const [counter] = useState(() => ({ value: 0 }));
  return (
    <MountCounter.Provider value={counter}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            element={
              <Layout
                loadFactory={factoryLoaderOf(factoryResponse())}
                loadCollection={collectionLoaderOf(collectionResponse(null))}
                refreshCollection={refresherOf(
                  collectionResponse(new Date().toISOString()),
                )}
              />
            }
          >
            <Route index element={<PageContent />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </MountCounter.Provider>
  );
}

export const RefreshReloadsThePage: Story = {
  render: () => <RefreshHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Issues not collected yet');
    const before = loads(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Refresh\b/ }));
    await canvas.findByText('Issues updated just now');
    await expect(
      canvas.getByRole('button', { name: /^Refresh\b/ }),
    ).not.toBeDisabled();
    await waitFor(() => expect(loads(canvasElement)).toBeGreaterThan(before));
  },
};
