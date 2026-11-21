import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CollectionStatus } from './CollectionStatus.tsx';

const NOW = new Date('2026-03-12T12:00:00Z');

const meta = {
  component: CollectionStatus,
  args: {
    collectedAt: '2026-03-12T11:56:30Z',
    now: NOW,
    refreshing: false,
    onRefresh: fn(),
  },
} satisfies Meta<typeof CollectionStatus>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NeverCollected: Story = {
  args: { collectedAt: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Issues not collected yet'),
    ).toBeVisible();
  },
};

export const Collected: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Issues updated 3 min ago')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await expect(args.onRefresh).toHaveBeenCalledOnce();
  },
};

export const Refreshing: Story = {
  args: { refreshing: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Refreshing…' }),
    ).toBeDisabled();
  },
};
