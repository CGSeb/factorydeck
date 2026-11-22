import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { chooseOption } from './select-test.ts';
import { ProjectPill } from './ProjectPill.tsx';

const meta = {
  component: ProjectPill,
  args: {
    value: undefined,
    projects: [
      { project: '/home/dev/example-app', name: 'Example App' },
      { project: '/home/dev/example-lib', name: 'example-lib' },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof ProjectPill>;

export default meta;

type Story = StoryObj<typeof meta>;

function projectSelect(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('combobox', { name: 'Project' });
}

export const AllProjects: Story = {
  play: async ({ canvasElement, args }) => {
    const select = projectSelect(canvasElement);
    await expect(select).toHaveAttribute('data-value', '');
    await expect(select).toHaveAttribute('title', 'All projects');
    await chooseOption(select, 'example-lib');
    await expect(args.onChange).toHaveBeenCalledWith('/home/dev/example-lib');
  },
};

export const LongNameCut: Story = {
  args: {
    value: '/home/dev/long',
    projects: [{ project: '/home/dev/long', name: 'L'.repeat(70) }],
  },
  play: async ({ canvasElement }) => {
    const select = projectSelect(canvasElement);
    await expect(select).toHaveTextContent(`${'L'.repeat(60)}…`);
    await expect(select).toHaveAttribute(
      'title',
      `${'L'.repeat(70)}\n/home/dev/long`,
    );
  },
};

export const UnknownProject: Story = {
  args: { value: '/home/dev/gone' },
  play: async ({ canvasElement }) => {
    const select = projectSelect(canvasElement);
    await expect(select).toHaveAttribute('data-value', '/home/dev/gone');
    await expect(select).toHaveTextContent('gone');
  },
};
