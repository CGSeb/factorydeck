import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { FactoryResponse } from '../projects/types.ts';
import { BUG_TICKETS_KEY, storeBugTickets } from './bug-tickets-state.ts';
import type { LoadFactory } from './factory-api.ts';
import { factoryLoaderOf, factoryResponse } from './factory-fixtures.ts';
import {
  collectionLoaderOf,
  collectionResponse,
  refresherOf,
} from './git-host-fixtures.ts';
import { Layout } from './Layout.tsx';
import { useProjectRemoved } from './layout-outlet.ts';

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

function RemovingPage(): ReactElement {
  const projectRemoved = useProjectRemoved();
  return (
    <button type="button" onClick={() => projectRemoved?.('old-app')}>
      Remove Old App
    </button>
  );
}

function thenWithout(
  first: FactoryResponse,
  next: FactoryResponse,
): LoadFactory {
  let calls = 0;
  return () => {
    calls += 1;
    return Promise.resolve(calls === 1 ? first : next);
  };
}

function BugTicketsRemoval(): ReactElement {
  const [store] = useState(() => {
    storeBugTickets([]);
    return {
      loadFactory: thenWithout(
        factoryResponse([], true, [], ['old-app']),
        factoryResponse([], true, [], []),
      ),
      loadCollection: collectionLoaderOf(collectionResponse(null)),
      refreshCollection: refresherOf(collectionResponse()),
    };
  });
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Layout {...store} />}>
          <Route index element={<RemovingPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

export const RemovingAProjectWithBugTickets: Story = {
  render: () => <BugTicketsRemoval />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'Bugs' });
    await waitFor(() =>
      expect(window.localStorage.getItem(BUG_TICKETS_KEY)).toBe(
        JSON.stringify(['old-app']),
      ),
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove Old App' }),
    );
    await waitFor(() =>
      expect(canvas.queryByRole('link', { name: 'Bugs' })).toBeNull(),
    );
    await waitFor(() =>
      expect(window.localStorage.getItem(BUG_TICKETS_KEY)).toBeNull(),
    );
  },
};
