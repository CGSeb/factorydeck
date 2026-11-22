import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RefreshControl } from './RefreshControl.tsx';

const NOW = new Date('2026-03-12T12:00:00Z');

const meta = {
  component: RefreshControl,
  args: {
    collectedAt: '2026-03-12T11:57:30Z',
    now: NOW,
    refreshing: false,
    onRefresh: fn(),
  },
} satisfies Meta<typeof RefreshControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Collected: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Issues updated 2 min ago')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /^Refresh/ }));
    await expect(args.onRefresh).toHaveBeenCalledOnce();
  },
};

export const NotCollectedYet: Story = {
  args: { collectedAt: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Issues not collected yet'),
    ).toBeVisible();
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

export const Narrow: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', {
        name: /^Refresh ?, issues updated 2 min ago$/,
      }),
    ).toBeEnabled();
  },
};
