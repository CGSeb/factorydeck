import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import { someSessions } from './session-fixtures.ts';
import { SessionTable } from './SessionTable.tsx';

function SessionStub(): ReactElement {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(-1)}>
      Back
    </button>
  );
}

const meta = {
  component: SessionTable,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/sessions']}>
        <Routes>
          <Route path="/sessions" element={<Story />} />
          <Route path="/sessions/:id" element={<SessionStub />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SessionTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rows: Story = {
  args: { sessions: someSessions, now: new Date() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole('row');
    await expect(rows).toHaveLength(4);
    await expect(rows[0]).toHaveTextContent('BranchWork item');
    await expect(rows[1]).toHaveTextContent('feat/export#52');
    const issue = canvas.getByRole('link', { name: '#52' });
    await expect(issue).toHaveAttribute('title', 'Export button');
    await expect(issue).toHaveAttribute(
      'href',
      'https://github.com/example-org/example-app/issues/52',
    );
    await expect(rows[2]).toHaveTextContent('——');
    await expect(canvas.getByText('3 min ago')).toBeVisible();
    await expect(canvas.getByText('2 h 02 min')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'b81e44d0' })).toBeVisible();
    await expect(canvas.getByText('~$6.42')).toBeVisible();
    await userEvent.click(canvas.getByText('/home/dev/example-lib'));
    await userEvent.click(await canvas.findByRole('button', { name: 'Back' }));
    await userEvent.click(
      await canvas.findByRole('link', { name: 'Add the export button' }),
    );
    await userEvent.click(await canvas.findByRole('button', { name: 'Back' }));
    await expect(await canvas.findByRole('table')).toBeVisible();
  },
};
