import type { Meta, StoryObj } from '@storybook/react-vite';
import { weekOverview } from './fixtures.ts';
import { ProjectTable } from './ProjectTable.tsx';

const meta = { component: ProjectTable } satisfies Meta<typeof ProjectTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithUnassigned: Story = {
  args: { projects: weekOverview.projects },
};
