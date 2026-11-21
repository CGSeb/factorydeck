import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ProjectSelect } from './ProjectSelect.tsx';

const meta = {
  component: ProjectSelect,
  args: {
    value: undefined,
    projects: ['/home/dev/example-app', '/home/dev/example-lib'],
    onChange: fn(),
  },
} satisfies Meta<typeof ProjectSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllProjects: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Project' }),
      '/home/dev/example-lib',
    );
    await expect(args.onChange).toHaveBeenCalledWith('/home/dev/example-lib');
  },
};

export const UnknownProjectInUrl: Story = {
  args: { value: '/home/dev/gone' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('combobox', { name: 'Project' }),
    ).toHaveValue('/home/dev/gone');
  },
};
