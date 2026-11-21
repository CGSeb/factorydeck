import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import {
  detailLoader,
  detailResponse,
  notFoundResponse,
  sessionWithSubAgents,
  sessionWithoutSubAgents,
} from './session-fixtures.ts';
import { SessionPage } from './SessionPage.tsx';

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
    await expect(canvas.getByText('4.2M')).toBeVisible();
    await expect(canvas.getByText('Cache read')).toBeVisible();
    await expect(canvas.getByText('~$6.42')).toBeVisible();
    await expect(canvas.getByText('Find the export code')).toBeVisible();
  },
};

export const WithoutSubAgents: Story = {
  args: { loadSession: detailLoader(detailResponse(sessionWithoutSubAgents)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'b81e44d0' });
    await expect(canvas.getByText('Waiting for you')).toBeVisible();
    await expect(canvas.getByText('No sub-agents.')).toBeVisible();
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
