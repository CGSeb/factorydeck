import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, within } from 'storybook/test';
import type { ReadyCounts } from '../sidebar/types.ts';
import { chooseOption } from './components/select-test.ts';
import { factoryLoaderOf, factoryResponse } from './factory-fixtures.ts';
import {
  collectionLoaderOf,
  collectionResponse,
  refresherOf,
} from './git-host-fixtures.ts';
import { Layout } from './Layout.tsx';
import { optionsOf } from './project-fixtures.ts';
import type { LoadSidebar } from './sidebar-api.ts';

const APP_ROOT = '/home/dev/example-app';
const LIB_ROOT = '/home/dev/example-lib';

const COUNTS: Readonly<Record<string, ReadyCounts>> = {
  '': { feature: 7, bug: 2 },
  [APP_ROOT]: { feature: 4, bug: 2 },
  [LIB_ROOT]: { feature: 3, bug: 0 },
};

function loaderOf(pending: readonly string[] = []): LoadSidebar {
  return (project) =>
    pending.includes(project ?? '')
      ? new Promise(() => undefined)
      : Promise.resolve(COUNTS[project ?? ''] ?? { feature: 0, bug: 0 });
}

function at(path: string): Decorator {
  return (Story) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Story />}>
          <Route path="*" element={<p>Section content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const meta = {
  component: Layout,
  args: {
    loadFactory: factoryLoaderOf(
      factoryResponse([], true, optionsOf([APP_ROOT, LIB_ROOT]), [APP_ROOT]),
    ),
    loadCollection: collectionLoaderOf(collectionResponse(null)),
    refreshCollection: refresherOf(collectionResponse()),
    loadSidebar: loaderOf(),
  },
  decorators: [at('/stats?period=30d')],
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CountsFollowTheProject: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'Features, 7 ready' });
    await expect(
      canvas.getByRole('link', { name: 'Bugs, 2 ready' }),
    ).toBeVisible();
    await chooseOption(
      canvas.getByRole('combobox', { name: 'Project' }),
      LIB_ROOT,
    );
    const features = await canvas.findByRole('link', {
      name: 'Features, 3 ready',
    });
    await expect(features).toHaveAttribute(
      'href',
      `/features?project=${encodeURIComponent(LIB_ROOT)}`,
    );
    await expect(canvas.queryByRole('link', { name: /^Bugs/ })).toBeNull();
  },
};

export const LastCountsStayWhileAProjectLoads: Story = {
  args: { loadSidebar: loaderOf([APP_ROOT]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'Features, 7 ready' });
    await chooseOption(
      canvas.getByRole('combobox', { name: 'Project' }),
      APP_ROOT,
    );
    await expect(
      canvas.getByRole('link', { name: 'Features, 7 ready' }),
    ).toHaveAttribute(
      'href',
      `/features?project=${encodeURIComponent(APP_ROOT)}`,
    );
    await expect(
      canvas.getByRole('link', { name: 'Bugs, 2 ready' }),
    ).toBeVisible();
  },
};

export const NoBadgeBeforeTheFirstCounts: Story = {
  args: { loadSidebar: loaderOf(['']) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('combobox', { name: 'Project' });
    await expect(canvas.getByRole('link', { name: 'Features' })).toBeVisible();
    await expect(canvasElement.querySelector('.fd-sidebar-badge')).toBeNull();
  },
};
