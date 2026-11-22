import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ProjectName } from './ProjectName.tsx';

const meta = {
  component: ProjectName,
  args: { project: '/home/dev/example-app', name: 'Example App' },
} satisfies Meta<typeof ProjectName>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Named: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Example App'),
    ).toHaveAttribute('title', '/home/dev/example-app');
  },
};

export const FolderName: Story = {
  args: { project: '/home/dev/example-lib', name: 'example-lib' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('example-lib'),
    ).toHaveAttribute('title', '/home/dev/example-lib');
  },
};

export const Duplicated: Story = {
  args: { project: '/home/dev/web', name: 'Shop (/home/dev/web)' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Shop (/home/dev/web)'),
    ).toHaveAttribute('title', '/home/dev/web');
  },
};

export const LongName: Story = {
  args: { project: '/home/dev/long', name: `${'A'.repeat(55)} long name here` },
  play: async ({ canvasElement }) => {
    const name = within(canvasElement).getByText(`${'A'.repeat(55)} long…`);
    await expect(name).toHaveAttribute(
      'title',
      `${'A'.repeat(55)} long name here\n/home/dev/long`,
    );
  },
};

export const Unassigned: Story = {
  args: { project: 'unassigned', name: 'unassigned' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('unassigned'),
    ).not.toHaveAttribute('title');
  },
};
