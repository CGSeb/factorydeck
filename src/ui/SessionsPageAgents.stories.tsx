import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, within } from 'storybook/test';
import { mixedSessions } from './codex-session-fixtures.ts';
import { listLoader, someSessions } from './session-fixtures.ts';
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

export const BothAgents: Story = {
  args: { loadSessions: listLoader(mixedSessions) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('4 sessions');
    const rows = within(
      canvas.getByRole('region', { name: 'Sessions' }),
    ).getAllByRole('row');
    await expect(rows[0]).toHaveTextContent(
      'StateTitleAgentProjectWork itemLast activityDurationTokens',
    );
    await expect(rows[1]).toHaveTextContent(
      'WorkingAdd the export buttonClaude Code',
    );
    const codex = canvas.getByRole('link', { name: 'Codex session d0d0cafe' });
    await expect(codex.closest('tr')).toHaveTextContent(
      'Codex session d0d0cafeCodex',
    );
  },
};

export const OneAgent: Story = {
  args: { loadSessions: listLoader(someSessions) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('3 sessions');
    await expect(
      canvas.queryByRole('columnheader', { name: 'Agent' }),
    ).toBeNull();
    await expect(canvas.queryByText('Claude Code')).toBeNull();
  },
};
