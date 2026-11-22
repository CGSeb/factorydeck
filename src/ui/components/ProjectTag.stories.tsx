import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { projectColor } from '../design/palette.ts';
import { ProjectTag } from './ProjectTag.tsx';
import { surfaceFrame } from './story-frame.ts';

const LONG_NAME =
  'A synthetic project name written long enough to need the sixty character cut';

const meta = {
  title: 'Components/ProjectTag',
  component: ProjectTag,
  decorators: [surfaceFrame],
  args: { project: '/work/shop', name: 'shop', color: projectColor(0) },
} satisfies Meta<typeof ProjectTag>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ShortName: Story = {
  play: async ({ canvasElement }) => {
    const tag = within(canvasElement).getByText('shop');
    await expect(tag).toHaveAttribute('title', '/work/shop');
    await expect(tag.querySelector('[aria-hidden="true"]')).toHaveStyle({
      width: '8px',
      height: '8px',
      borderRadius: '2px',
      background: projectColor(0),
    });
  },
};

export const LongNameCut: Story = {
  args: { project: '/work/long', name: LONG_NAME, color: projectColor(1) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(`${LONG_NAME.slice(0, 60)}…`),
    ).toBeInTheDocument();
  },
};

export const DuplicatedName: Story = {
  args: {
    project: '/clients/b/shop',
    name: 'shop (/clients/b/shop)',
    color: projectColor(2),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('shop (/clients/b/shop)'),
    ).toHaveAttribute('title', '/clients/b/shop');
  },
};

export const Unassigned: Story = {
  args: { project: 'unassigned', name: 'unassigned', color: projectColor(3) },
  play: async ({ canvasElement }) => {
    const tag = within(canvasElement).getByText('unassigned');
    await expect(tag).not.toHaveAttribute('title');
    await expect(tag.querySelector('[aria-hidden="true"]')).toBeNull();
  },
};
