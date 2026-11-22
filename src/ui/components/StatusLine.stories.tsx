import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { StatusLine } from './StatusLine.tsx';

const meta = {
  component: StatusLine,
  args: { children: 'Loading…' },
} satisfies Meta<typeof StatusLine>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading…')).toBeVisible();
  },
};

export const Unreachable: Story = {
  args: { children: 'The FactoryDeck server is unreachable.' },
};

export const NoActivity: Story = {
  args: { children: 'No activity in this period.' },
};
