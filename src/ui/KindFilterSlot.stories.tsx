import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { surfaceFrame } from './components/story-frame.ts';
import { KindFilterSlot } from './KindFilterSlot.tsx';

const meta = {
  component: KindFilterSlot,
  decorators: [surfaceFrame],
  args: {
    kinds: { feature: 7, bug: 3 },
    value: null,
    onChange: fn(),
  },
} satisfies Meta<typeof KindFilterSlot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Bugs 3' }),
    ).toBeVisible();
  },
};

export const Pending: Story = {
  name: 'Pending: holds the row height, hidden from everyone',
  args: { kinds: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole('group', { name: 'Kind' }),
    ).toBeNull();
    await expect(canvasElement.querySelector('[data-pending]')).not.toBeNull();
  },
};
