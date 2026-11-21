import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { SessionStateLabel } from './SessionStateLabel.tsx';

const meta = {
  component: SessionStateLabel,
} satisfies Meta<typeof SessionStateLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Working: Story = {
  args: { state: 'working' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Working')).toBeVisible();
  },
};

export const WaitingForYou: Story = {
  args: { state: 'waiting' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Waiting for you'),
    ).toBeVisible();
  },
};

export const Inactive: Story = {
  args: { state: 'inactive' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Inactive')).toBeVisible();
  },
};
