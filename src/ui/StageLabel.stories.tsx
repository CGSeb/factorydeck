import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { StageLabel } from './StageLabel.tsx';

const meta = {
  component: StageLabel,
  args: { stage: 'merged' },
} satisfies Meta<typeof StageLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Merged: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Merged')).toHaveClass(
      'stage-success',
    );
  },
};

export const Blocked: Story = {
  args: { stage: 'blocked' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Blocked')).toHaveClass(
      'stage-danger',
    );
  },
};
