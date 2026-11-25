import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { FactoryResponse } from '../projects/types.ts';
import { BUG_TICKETS_KEY, storeBugTickets } from './bug-tickets-state.ts';
import type { LoadFactory } from './factory-api.ts';
import {
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

const meta = {
  component: Layout,
  args: {
    loadFactory: factoryLoaderOf(factoryResponse()),
    deleteProject: deleterOf('deleted'),
    loadCollection: collectionLoaderOf(collectionResponse(null)),
    refreshCollection: refresherOf(collectionResponse()),
  },
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

async function deleteFirstProject(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const [line] = await canvas.findAllByRole('button', {
    name: 'Delete project',
  });
  if (line === undefined) throw new Error('No banner line');
  await userEvent.click(line);
  const dialog = within(canvas.getByRole('dialog'));
  await userEvent.click(dialog.getByRole('button', { name: 'Delete project' }));
}

function onceThenPending(response: FactoryResponse): LoadFactory {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1
      ? Promise.resolve(response)
      : new Promise<undefined>(() => undefined);
  };
}

function BugTicketsDeletion(): ReactElement {
  const [store] = useState(() => {
    storeBugTickets([]);
    return {
      loadFactory: onceThenPending(
        factoryResponse([oldApp], true, [], [oldApp.project]),
      ),
      deleteProject: deleterOf('deleted'),
      loadCollection: collectionLoaderOf(collectionResponse(null)),
      refreshCollection: refresherOf(collectionResponse()),
    };
  });
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Layout {...store} />}>
          <Route index element={<p>Section content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

export const DeletingAProjectWithBugTickets: Story = {
  render: () => <BugTicketsDeletion />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'Bugs' });
    await waitFor(() =>
      expect(window.localStorage.getItem(BUG_TICKETS_KEY)).toBe(
        JSON.stringify([oldApp.project]),
      ),
    );
    await deleteFirstProject(canvasElement);
    await waitFor(() =>
      expect(canvas.queryByRole('link', { name: 'Bugs' })).toBeNull(),
    );
    await waitFor(() =>
      expect(window.localStorage.getItem(BUG_TICKETS_KEY)).toBeNull(),
    );
  },
};
