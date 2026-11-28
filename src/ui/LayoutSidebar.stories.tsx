import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { type ReactNode, useEffect, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { storeBugTickets } from './bug-tickets-state.ts';
import { expect, within } from 'storybook/test';
import { withStoredFold } from './components/sidebar-stories.ts';
import {
  deleterOf,
  factoryLoaderOf,
  factoryResponse,
} from './factory-fixtures.ts';
import {
  collectionLoaderOf,
  collectionResponse,
  refresherOf,
} from './git-host-fixtures.ts';
import { Layout } from './Layout.tsx';
import { optionsOf } from './project-fixtures.ts';

function at(path: string): Decorator {
  return (Story) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Story />}>
          <Route index element={<p>Section content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const meta = {
  component: Layout,
  args: {
    loadFactory: factoryLoaderOf(
      factoryResponse(
        [],
        true,
        optionsOf(['/home/dev/example-app', '/home/dev/example-lib']),
      ),
    ),
    deleteProject: deleterOf('deleted'),
    loadCollection: collectionLoaderOf(collectionResponse(null)),
    refreshCollection: refresherOf(collectionResponse()),
  },
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoSessionYetFolded: Story = {
  args: { loadFactory: factoryLoaderOf(factoryResponse([], false)) },
  decorators: [at('/'), withStoredFold('collapsed')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', {
      name: 'Install the factory in a project',
    });
    await expect(
      canvas.getByRole('button', { name: 'Expand sidebar' }),
    ).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Project/ })).toBeNull();
  },
};

export const FoldedWithProjects: Story = {
  decorators: [at('/'), withStoredFold('collapsed')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('button', { name: 'Project: All projects' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('link', { name: 'Overview' }),
    ).toHaveAttribute('aria-current', 'page');
  },
};

const APP = 'example-app';
const LIB = 'example-lib';

function withBugTickets(bugTickets: string[]) {
  return factoryLoaderOf(
    factoryResponse([], true, optionsOf([APP, LIB]), bugTickets),
  );
}

function sectionAt(path: string): Decorator {
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

function StoredBugTickets({
  bugTickets,
  children,
}: {
  bugTickets: string[];
  children: ReactNode;
}): ReactNode {
  useState(() => {
    storeBugTickets(bugTickets);
    return bugTickets;
  });
  useEffect(
    () => () => {
      storeBugTickets([]);
    },
    [],
  );
  return children;
}

function withStoredBugTickets(bugTickets: string[]): Decorator {
  return (Story) => (
    <StoredBugTickets bugTickets={bugTickets}>
      <Story />
    </StoredBugTickets>
  );
}

function linkNames(canvasElement: HTMLElement): string[] {
  const nav = within(canvasElement).getByRole('navigation');
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

export const BugsLinkAfterFeatures: Story = {
  args: { loadFactory: withBugTickets([APP]) },
  decorators: [sectionAt('/bugs'), withStoredBugTickets([])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bugs = await canvas.findByRole('link', { name: 'Bugs' });
    await expect(bugs).toHaveAttribute('aria-current', 'page');
    await expect(bugs).toHaveAttribute('href', '/bugs');
    await expect(bugs.querySelector('[data-icon="bugs"]')).not.toBeNull();
    const names = linkNames(canvasElement);
    await expect(names.indexOf('Bugs')).toBe(names.indexOf('Features') + 1);
  },
};

export const BugsLinkOnABugPage: Story = {
  args: { loadFactory: withBugTickets([APP]) },
  decorators: [
    sectionAt(`/bugs/70?project=${encodeURIComponent(APP)}&period=7d`),
    withStoredBugTickets([]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('link', { name: 'Bugs' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      canvas.getByRole('link', { name: 'Features' }),
    ).not.toHaveAttribute('aria-current');
  },
};

export const BugsLinkFolded: Story = {
  args: { loadFactory: withBugTickets([APP]) },
  decorators: [
    sectionAt('/bugs'),
    withStoredFold('collapsed'),
    withStoredBugTickets([]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('link', { name: 'Bugs' }),
    ).toHaveAttribute('aria-current', 'page');
  },
};

export const NoBugsLinkWithoutBugTickets: Story = {
  decorators: [sectionAt('/')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('combobox', { name: 'Project' });
    await expect(canvas.getByRole('link', { name: 'Features' })).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Bugs' })).toBeNull();
  },
};

export const NoBugsLinkForAProjectWithoutBugTickets: Story = {
  args: { loadFactory: withBugTickets([APP]) },
  decorators: [
    sectionAt(`/?project=${encodeURIComponent(LIB)}`),
    withStoredBugTickets([]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('combobox', { name: 'Project' });
    await expect(canvas.getByRole('link', { name: 'Features' })).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Bugs' })).toBeNull();
  },
};

export const BugsLinkBeforeTheStatusLoads: Story = {
  args: { loadFactory: () => new Promise(() => undefined) },
  decorators: [sectionAt('/'), withStoredBugTickets([APP])],
  play: async ({ canvasElement }) => {
    const names = linkNames(canvasElement);
    await expect(names.indexOf('Bugs')).toBe(names.indexOf('Features') + 1);
  },
};

export const BugsLinkIgnoresStoredRoots: Story = {
  args: { loadFactory: () => new Promise(() => undefined) },
  decorators: [sectionAt('/'), withStoredBugTickets(['/home/dev/example-app'])],
  play: async ({ canvasElement }) => {
    await expect(linkNames(canvasElement)).not.toContain('Bugs');
  },
};

export const BugsLinkKeptWhenUnreachable: Story = {
  args: {
    loadFactory: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  decorators: [sectionAt('/'), withStoredBugTickets([APP])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    await expect(canvas.getByRole('link', { name: 'Bugs' })).toBeVisible();
  },
};
