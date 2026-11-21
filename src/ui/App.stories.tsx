import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App.tsx';
import { healthMessage } from './health-message.ts';

const meta = { component: App } satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DatabaseConnected: Story = {
  args: { healthMessage: Promise.resolve(healthMessage(true)) },
};

export const DatabaseUnreachable: Story = {
  args: { healthMessage: Promise.resolve(healthMessage(false)) },
};
