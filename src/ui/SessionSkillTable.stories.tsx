import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { sessionWithSubAgents } from './session-fixtures.ts';
import { SessionSkillTable } from './SessionSkillTable.tsx';

const meta = {
  component: SessionSkillTable,
} satisfies Meta<typeof SessionSkillTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSkills: Story = {
  args: { skills: sessionWithSubAgents.skills },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('kit:write-spec')).toBeVisible();
    await expect(canvas.getByText('No skill')).toBeVisible();
    await expect(canvas.getByText('~$2.32')).toBeVisible();
  },
};
