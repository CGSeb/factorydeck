import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { surfaceFrame } from './components/story-frame.ts';
import { KindFilter } from './KindFilter.tsx';

const meta = {
  component: KindFilter,
  decorators: [surfaceFrame],
  args: {
    kinds: { feature: 7, bug: 3 },
    value: null,
    onChange: fn(),
  },
} satisfies Meta<typeof KindFilter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllSelected: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Bugs 3' }));
    await expect(args.onChange).toHaveBeenCalledWith('bug');
  },
};

export const BugsSelected: Story = {
  args: { value: 'bug' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Bugs 3' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'All' }));
    await expect(args.onChange).toHaveBeenCalledWith(null);
  },
};

export const NoBugInPeriod: Story = {
  args: { kinds: { feature: 7, bug: 0 } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Bugs 0' }),
    ).toBeInTheDocument();
  },
};
