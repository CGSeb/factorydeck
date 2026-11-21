import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  listLoader,
  listResponse,
  manySessions,
  sessionList,
  someSessions,
  workingSession,
} from './session-fixtures.ts';
import type { LoadSessions } from './sessions-api.ts';
import { SessionsPage } from './SessionsPage.tsx';

function Location(): ReactElement {
  const { search } = useLocation();
  return <output aria-label="Address">{search}</output>;
}

const meta = {
  component: SessionsPage,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/sessions?period=all']}>
        <Routes>
          <Route
            path="/sessions"
            element={
              <>
                <Story />
                <Location />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SessionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithRows: Story = {
  args: { loadSessions: listLoader(someSessions) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('1 working · 1 waiting for you · 1 inactive');
    await expect(canvas.getAllByRole('row')).toHaveLength(4);
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'State' }),
      'waiting',
    );
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(2));
    await expect(canvas.getByRole('link', { name: 'b81e44d0' })).toBeVisible();
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Project' }),
      '/home/dev/example-app',
    );
    await canvas.findByText('No sessions match these filters.');
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent(
      '?period=all&project=%2Fhome%2Fdev%2Fexample-app&state=waiting',
    );
  },
};

export const NoMatch: Story = {
  args: { loadSessions: listLoader([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No sessions match these filters.');
    await expect(
      canvas.getByText('0 working · 0 waiting for you · 0 inactive'),
    ).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Show more' }),
    ).toBeNull();
  },
};

export const MoreThanFifty: Story = {
  args: { loadSessions: listLoader(manySessions) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('1 working · 1 waiting for you · 73 inactive');
    await expect(canvas.getAllByRole('row')).toHaveLength(51);
    await userEvent.click(canvas.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(76));
    await expect(
      canvas.queryByRole('button', { name: 'Show more' }),
    ).toBeNull();
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadSessions: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};

function refreshingLoader(): LoadSessions {
  let calls = 0;
  let lastCall = 0;
  return (filters, limit) => {
    calls = Date.now() - lastCall > 1000 ? 1 : calls + 1;
    lastCall = Date.now();
    const session =
      calls === 1
        ? workingSession
        : { ...workingSession, state: 'waiting' as const };
    return Promise.resolve({
      ...listResponse(sessionList([session], filters, limit)),
      refreshSeconds: 0.2,
    });
  };
}

export const RefreshesWithoutReload: Story = {
  args: { loadSessions: refreshingLoader() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('1 working · 0 waiting for you · 0 inactive');
    await canvas.findByText('0 working · 1 waiting for you · 0 inactive');
    await expect(
      canvas.getByText('Waiting for you', { selector: '.state' }),
    ).toBeVisible();
  },
};
