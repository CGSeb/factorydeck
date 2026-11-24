import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { BugBadge } from './BugBadge.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/BugBadge',
  component: BugBadge,
  decorators: [surfaceFrame],
} satisfies Meta<typeof BugBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Bug: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Bug')).toHaveAttribute(
      'data-tone',
      'danger',
    );
  },
};
