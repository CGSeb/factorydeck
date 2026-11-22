import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
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
    (Story, { parameters }) => (
      <MemoryRouter
        initialEntries={[
          typeof parameters['entry'] === 'string'
            ? parameters['entry']
            : '/sessions?period=all',
        ]}
      >
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
    await expect(
      canvas.queryByRole('combobox', { name: 'Project' }),
    ).toBeNull();
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?period=all&state=waiting');
  },
};

export const OneProject: Story = {
  args: { loadSessions: listLoader(someSessions) },
  parameters: {
    entry: '/sessions?period=all&project=%2Fhome%2Fdev%2Fexample-app',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('1 working · 0 waiting for you · 0 inactive');
    await expect(
      canvas.queryByRole('combobox', { name: 'Project' }),
    ).toBeNull();
    const [link] = canvas.getAllByRole('link');
    await expect(link).toHaveAttribute(
      'href',
      expect.stringMatching(
        /^\/sessions\/[^?]+\?project=%2Fhome%2Fdev%2Fexample-app$/,
      ),
    );
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'State' }),
      'working',
    );
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent(
      '?period=all&project=%2Fhome%2Fdev%2Fexample-app&state=working',
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
  return (filters, limit) => {
    calls += 1;
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

function Refreshing(): ReactElement {
  const [load] = useState(refreshingLoader);
  return <SessionsPage loadSessions={load} />;
}

export const RefreshesWithoutReload: Story = {
  args: { loadSessions: refreshingLoader() },
  render: () => <Refreshing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('1 working · 0 waiting for you · 0 inactive');
    await canvas.findByText('0 working · 1 waiting for you · 0 inactive');
    await expect(
      canvas.getByText('Waiting for you', { selector: '.state' }),
    ).toBeVisible();
  },
};

function slowWideLoader(): LoadSessions {
  const load = listLoader(manySessions);
  return (filters, limit) =>
    filters.state === undefined && limit > 50
      ? new Promise((resolve) => {
          setTimeout(() => resolve(load(filters, limit)), 400);
        })
      : load(filters, limit);
}

export const NoStaleRowsFromAnotherFilter: Story = {
  args: { loadSessions: slowWideLoader() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('1 working · 1 waiting for you · 73 inactive');
    await userEvent.click(canvas.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(76));
    const state = canvas.getByRole('combobox', { name: 'State' });
    await userEvent.selectOptions(state, 'working');
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(2));
    await userEvent.selectOptions(state, '');
    await canvas.findByText('Loading…');
    await expect(canvas.queryByRole('table')).toBeNull();
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(76));
  },
};
