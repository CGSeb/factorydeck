import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, within } from 'storybook/test';
import { exportFeature } from './feature-fixtures.ts';
import { FeatureSessionTable } from './FeatureSessionTable.tsx';

const meta = {
  component: FeatureSessionTable,
  args: { sessions: exportFeature.sessions, now: new Date() },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof FeatureSessionTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSessions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('link', { name: 'Build the export button' }),
    ).toHaveAttribute('href', '/sessions/6f1c2d3e-0000-4000-8000-000000000001');
    await expect(canvas.getByRole('link', { name: '6f1c2d3e' })).toBeVisible();
    await expect(canvas.getByText('3 min ago')).toBeVisible();
    await expect(canvas.getByText('3.1M')).toHaveAttribute(
      'title',
      '3,100,000',
    );
  },
};

export const NoSession: Story = {
  args: { sessions: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        'No session worked on this issue in this period.',
      ),
    ).toBeVisible();
  },
};
