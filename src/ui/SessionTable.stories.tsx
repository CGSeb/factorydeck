import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import { someSessions } from './session-fixtures.ts';
import { SessionTable } from './SessionTable.tsx';

const meta = {
  component: SessionTable,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/sessions']}>
        <Routes>
          <Route path="/sessions" element={<Story />} />
          <Route path="/sessions/:id" element={<p>Session page</p>} />
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
    await expect(canvas.getAllByRole('row')).toHaveLength(4);
    await expect(canvas.getByText('3 min ago')).toBeVisible();
    await expect(canvas.getByText('2 h 02 min')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'b81e44d0' })).toBeVisible();
    await expect(canvas.getByText('~$6.42')).toBeVisible();
    await userEvent.click(canvas.getByText('/home/dev/example-lib'));
    await canvas.findByText('Session page');
  },
};
