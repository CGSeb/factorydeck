import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { SESSION_PAGE_SIZE } from '../sessions/types.ts';
import {
  listLoader,
  listResponse,
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

function stateCounts(canvasElement: HTMLElement): string[] {
  return within(within(canvasElement).getByRole('group', { name: 'State' }))
    .getAllByRole('button')
    .map((button) => button.textContent);
}

export const AllStates: Story = {
  args: { loadSessions: listLoader(someSessions) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('3 sessions');
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Sessions' }),
    ).toBeVisible();
    await expect(stateCounts(canvasElement)).toEqual([
      'All3',
      'Working1',
      'Waiting for you1',
      'Inactive1',
    ]);
    await expect(
      canvas.getByRole('button', { name: 'All 3', pressed: true }),
    ).toBeVisible();
    const rows = within(
      canvas.getByRole('region', { name: 'Sessions' }),
    ).getAllByRole('row');
    await expect(rows[0]).toHaveTextContent(
      'StateTitleProjectBranchWork itemLast activityDurationTokens',
    );
    await expect(rows).toHaveLength(4);
    await expect(rows[1]).toHaveTextContent('WorkingAdd the export button');
    await expect(
      within(canvas.getByRole('region', { name: 'Sessions' })).getByRole(
        'link',
        { name: '#52' },
      ),
    ).toHaveAttribute(
      'href',
      '/features/52?project=%2Fhome%2Fdev%2Fexample-app&period=all',
    );
    await expect(rows[2]).toHaveTextContent('Waiting for youb81e44d0');
    await expect(rows[2]).toHaveTextContent('—');
    await expect(rows[3]).toHaveTextContent('InactiveFix the flaky test');
    await expect(
      canvas.getByRole('link', { name: 'Add the export button' }),
    ).toHaveAttribute(
      'href',
      '/sessions/7f3a9c21-0000-4000-8000-000000000001?period=all',
    );
    await expect(
      canvas.queryByRole('button', { name: 'Show more' }),
    ).toBeNull();
  },
};

export const OneStateSelected: Story = {
  args: { loadSessions: listLoader(someSessions) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('3 sessions');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Waiting for you 1' }),
    );
    await canvas.findByText('1 session');
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?period=all&state=waiting');
    await expect(
      within(canvas.getByRole('region', { name: 'Sessions' })).getAllByRole(
        'row',
      ),
    ).toHaveLength(2);
    await expect(
      canvas.getByRole('button', { name: 'Waiting for you 1', pressed: true }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'All 3' }));
    await canvas.findByText('3 sessions');
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent(/^\?period=all$/);
  },
};

export const OneProject: Story = {
  args: { loadSessions: listLoader(someSessions) },
  parameters: {
    entry: '/sessions?period=7d&project=%2Fhome%2Fdev%2Fexample-app',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('1 session');
    await expect(
      canvas.queryByRole('columnheader', { name: 'Project' }),
    ).toBeNull();
    await expect(
      canvas.getByRole('link', { name: 'Add the export button' }),
    ).toHaveAttribute(
      'href',
      '/sessions/7f3a9c21-0000-4000-8000-000000000001?project=%2Fhome%2Fdev%2Fexample-app&period=7d',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Working 1' }));
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent(
      '?period=7d&project=%2Fhome%2Fdev%2Fexample-app&state=working',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'All time' }));
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent(
      '?period=all&project=%2Fhome%2Fdev%2Fexample-app&state=working',
    );
  },
};

function moreToShowLoader(): LoadSessions {
  return (filters, limit) => {
    const list = sessionList(someSessions, filters, limit);
    const firstPage = limit <= SESSION_PAGE_SIZE;
    return Promise.resolve(
      listResponse({
        ...list,
        sessions: firstPage ? list.sessions.slice(0, 2) : list.sessions,
        total: firstPage ? 75 : list.sessions.length,
      }),
    );
  };
}

export const MoreToShow: Story = {
  args: { loadSessions: moreToShowLoader() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('75 sessions');
    await expect(canvas.getByText('2 of 75')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show more' }));
    await canvas.findByText('3 sessions');
    await expect(
      canvas.queryByRole('button', { name: 'Show more' }),
    ).toBeNull();
  },
};

export const NoMatch: Story = {
  args: { loadSessions: listLoader([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No sessions match these filters.');
    await expect(canvas.getByText('0 sessions')).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Show more' }),
    ).toBeNull();
  },
};

export const Loading: Story = {
  args: { loadSessions: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Loading…');
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
    await canvas.findByRole('button', { name: 'Working 1' });
    await canvas.findByRole('button', { name: 'Waiting for you 1' });
    await waitFor(() =>
      expect(
        within(canvas.getByRole('region', { name: 'Sessions' })).getByText(
          'Waiting for you',
        ),
      ).toBeVisible(),
    );
  },
};

export const At1024: Story = {
  args: { loadSessions: listLoader(someSessions) },
  decorators: [
    (Story) => (
      <div style={{ width: 1024 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('3 sessions');
  },
};
