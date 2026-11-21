import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import {
  detailLoader,
  detailResponse,
  notFoundResponse,
  sessionWithSubAgents,
  sessionWithoutSubAgents,
} from './session-fixtures.ts';
import type { LoadSession } from './sessions-api.ts';
import { SessionPage } from './SessionPage.tsx';

function refreshingLoader(): LoadSession {
  let calls = 0;
  return () => {
    calls += 1;
    const session =
      calls === 1
        ? sessionWithSubAgents
        : {
            ...sessionWithSubAgents,
            state: 'waiting' as const,
            costUsd: 7.5,
          };
    return Promise.resolve({ ...detailResponse(session), refreshSeconds: 0.2 });
  };
}

function Refreshing(): ReactElement {
  const [load] = useState(refreshingLoader);
  return <SessionPage loadSession={load} />;
}

const meta = {
  component: SessionPage,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/sessions/7f3a9c21']}>
        <Routes>
          <Route path="/sessions/:id" element={<Story />} />
          <Route path="/sessions" element={<p>Session list</p>} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SessionPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSubAgents: Story = {
  args: { loadSession: detailLoader(detailResponse(sessionWithSubAgents)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'Add the export button' });
    await expect(canvas.getByText('Working')).toBeVisible();
    await expect(
      canvas.getByText('/home/dev/example-app/packages/web'),
    ).toBeVisible();
    await expect(canvas.getByText('feat/export')).toBeVisible();
    await expect(
      canvas.getByRole('region', { name: 'Session' }),
    ).toHaveTextContent('Work item#52');
    const subAgentRows = within(
      canvas.getByRole('table', { name: 'Sub-agents' }),
    ).getAllByRole('row');
    await expect(subAgentRows[0]).toHaveTextContent('TypeRoleWork item');
    await expect(subAgentRows[2]).toHaveTextContent('builder#53');
    await expect(canvas.getByText('4.2M')).toBeVisible();
    await expect(canvas.getByText('Cache read')).toBeVisible();
    await expect(canvas.getByText('~$6.42')).toBeVisible();
    await expect(canvas.getByText('Find the export code')).toBeVisible();
    await expect(
      canvas.getByRole('table', { name: 'Skills' }),
    ).toHaveTextContent('kit:write-spec');
    await expect(canvas.getByText('~$2.32')).toBeVisible();
  },
};

export const WithoutSubAgents: Story = {
  args: { loadSession: detailLoader(detailResponse(sessionWithoutSubAgents)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'b81e44d0' });
    await expect(canvas.getByText('Waiting for you')).toBeVisible();
    await expect(canvas.getByText('No sub-agents.')).toBeVisible();
    await expect(
      canvas.getByRole('region', { name: 'Session' }),
    ).toHaveTextContent('Work item—');
  },
};

export const NotFound: Story = {
  args: { loadSession: detailLoader(notFoundResponse) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Session not found.');
    await userEvent.click(
      canvas.getByRole('link', { name: 'Back to sessions' }),
    );
    await canvas.findByText('Session list');
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadSession: detailLoader({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};

export const RefreshesWithoutReload: Story = {
  args: { loadSession: refreshingLoader() },
  render: () => <Refreshing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('~$6.42');
    await expect(canvas.getByText('Working')).toBeVisible();
    await canvas.findByText('~$7.50');
    await expect(canvas.getByText('Waiting for you')).toBeVisible();
  },
};
