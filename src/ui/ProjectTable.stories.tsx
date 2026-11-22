import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { weekOverview } from './fixtures.ts';
import { ProjectTable } from './ProjectTable.tsx';

const meta = { component: ProjectTable } satisfies Meta<typeof ProjectTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithUnassigned: Story = {
  args: { projects: weekOverview.projects },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getAllByRole('rowheader').map((cell) => cell.textContent),
    ).toEqual(['Example App', 'example-lib', 'unassigned']);
    await expect(canvas.getByText('Example App')).toHaveAttribute(
      'title',
      '/home/dev/example-app',
    );
    await expect(canvas.getByText('example-lib')).toHaveAttribute(
      'title',
      '/home/dev/example-lib',
    );
    await expect(canvas.getByText('unassigned')).not.toHaveAttribute('title');
  },
};
