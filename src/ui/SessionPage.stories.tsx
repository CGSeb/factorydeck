import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
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

const SCOPE = 'period=7d&project=%2Fhome%2Fdev%2Fexample-app';

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
            tokens: { ...sessionWithSubAgents.tokens, cacheRead: 5_610_000 },
          };
    return Promise.resolve({ ...detailResponse(session), refreshSeconds: 0.2 });
  };
}

function Refreshing(): ReactElement {
  const [load] = useState(refreshingLoader);
  return <SessionPage loadSession={load} />;
}

function ListPage(): ReactElement {
  const { search } = useLocation();
  return <p>Session list {search}</p>;
}

const meta = {
  component: SessionPage,
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter
        initialEntries={[
          typeof parameters['entry'] === 'string'
            ? parameters['entry']
            : '/sessions/7f3a9c21?project=%2Fhome%2Fdev%2Fexample-app&period=7d',
        ]}
      >
        <Routes>
          <Route path="/sessions/:id" element={<Story />} />
          <Route path="/sessions" element={<ListPage />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SessionPage>;

export default meta;

type Story = StoryObj<typeof meta>;

const shuffled = {
  ...sessionWithSubAgents,
  subAgents: [...sessionWithSubAgents.subAgents].reverse(),
};

export const WithSubAgentsAndSkills: Story = {
  args: { loadSession: detailLoader(detailResponse(shuffled)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', {
      level: 1,
      name: 'Add the export button',
    });
    await expect(
      canvas.getByRole('link', { name: '← Sessions' }),
    ).toHaveAttribute('href', `/sessions?${SCOPE}`);
    await expect(canvas.getByText('Example App')).toHaveAttribute(
      'title',
      '/home/dev/example-app',
    );
    await expect(canvas.getByText('feat/export')).toBeVisible();
    const workItem = canvas.getByText(/^Work item/, { selector: 'span' });
    await expect(
      within(workItem).getByRole('link', { name: '#52' }),
    ).toHaveAttribute(
      'href',
      '/features/52?project=%2Fhome%2Fdev%2Fexample-app&period=7d',
    );
    await expect(
      canvas.getByRole('heading', { name: 'Sub-agents 3' }),
    ).toBeVisible();
    const rows = within(
      canvas.getByRole('region', { name: 'Sub-agents' }),
    ).getAllByRole('row');
    await expect(rows[0]).toHaveTextContent(
      'Sub-agentRoleWork itemStartedDurationTokens',
    );
    await expect(rows[1]).toHaveTextContent('Find the export codeExplore#52');
    await expect(rows[2]).toHaveTextContent(
      'Build #53 the export menubuilder#53',
    );
    await expect(rows[3]).toHaveTextContent('unassigned#52');
    const skills = canvas.getByRole('region', { name: 'Skills' });
    await expect(
      within(skills).getByRole('link', { name: 'kit:write-spec' }),
    ).toHaveAttribute('href', `/skills/kit%3Awrite-spec?${SCOPE}`);
    await expect(skills).toHaveTextContent('No skill');
  },
};

export const WithAnOutcome: Story = {
  args: { loadSession: detailLoader(detailResponse(sessionWithSubAgents)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Tokens, sub-agents included');
    await expect(canvas.getByText('4.2M')).toBeVisible();
    await expect(
      canvas.getByRole('group', { name: 'Tokens by kind' }),
    ).toHaveTextContent('Cache read 86%Cache write 10%Input 3%Output 2%');
    await expect(canvas.getByText('Outcome')).toBeVisible();
    await expect(canvas.getByText('Merged')).toBeVisible();
    await expect(canvas.getByText('serenity 86')).toBeVisible();
    await expect(canvas.getByText('1 review round')).toBeVisible();
    await expect(
      canvas.getByText('/home/dev/example-app/packages/web'),
    ).toBeVisible();
    await expect(canvas.getByText('First activity')).toBeVisible();
    await expect(canvas.getByText('Last activity')).toBeVisible();
  },
};

export const WithoutSubAgents: Story = {
  args: { loadSession: detailLoader(detailResponse(sessionWithoutSubAgents)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: 'b81e44d0' });
    await expect(canvas.getByText('Waiting for you')).toBeVisible();
    await expect(canvas.getByText('No sub-agents.')).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: 'Sub-agents 0' }),
    ).toBeVisible();
    await expect(canvas.queryByRole('heading', { name: 'Skills' })).toBeNull();
    await expect(
      canvas.queryByText(/^Work item/, { selector: 'span' }),
    ).toBeNull();
    await expect(canvas.queryByText('Outcome')).toBeNull();
  },
};

export const NotFound: Story = {
  args: { loadSession: detailLoader(notFoundResponse) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Session not found.');
    const back = canvas.getByRole('link', { name: '← Sessions' });
    await expect(back).toHaveAttribute('href', `/sessions?${SCOPE}`);
    await userEvent.click(back);
    await canvas.findByText(`Session list ?${SCOPE}`);
  },
};

export const Loading: Story = {
  args: { loadSession: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Loading…');
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
    await canvas.findByText('4.2M');
    await expect(canvas.getByText('Working')).toBeVisible();
    await canvas.findByText('6.2M');
    await expect(canvas.getByText('Waiting for you')).toBeVisible();
  },
};

export const At1024: Story = {
  args: { loadSession: detailLoader(detailResponse(sessionWithSubAgents)) },
  decorators: [
    (Story) => (
      <div style={{ width: 1024 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('heading', {
      level: 1,
      name: 'Add the export button',
    });
  },
};
