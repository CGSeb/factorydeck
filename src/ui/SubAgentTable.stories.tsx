import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { sessionWithSubAgents } from './session-fixtures.ts';
import { SubAgentTable } from './SubAgentTable.tsx';

const meta = {
  component: SubAgentTable,
} satisfies Meta<typeof SubAgentTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSubAgents: Story = {
  args: { subAgents: sessionWithSubAgents.subAgents },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole('row');
    await expect(rows).toHaveLength(4);
    await expect(rows[0]).toHaveTextContent('TypeRoleWork itemDescription');
    await expect(rows[1]).toHaveTextContent('ExploreExplore#52');
    await expect(rows[1]).toHaveTextContent('2 min');
    await expect(rows[2]).toHaveTextContent(
      'general-purposebuilder#53 (not found)',
    );
    await expect(
      within(rows[1] ?? canvasElement).getByRole('link', { name: '#52' }),
    ).toHaveAttribute('title', 'Export button');
    await expect(rows[3]).toHaveTextContent('unassigned#52');
    await expect(rows[3]).toHaveTextContent('45 min');
    await expect(canvas.getAllByText('—')).toHaveLength(4);
  },
};

export const NoSubAgents: Story = {
  args: { subAgents: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('No sub-agents.'),
    ).toBeVisible();
  },
};
