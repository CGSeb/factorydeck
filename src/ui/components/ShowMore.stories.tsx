import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ShowMore } from './ShowMore.tsx';

const meta = {
  component: ShowMore,
  args: { shown: 50, total: 128, onShowMore: fn() },
  decorators: [
    (Story) => (
      <div>
        <p>Rows above the control</p>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShowMore>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MoreToShow: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('50 of 128')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show more' }));
    await expect(args.onShowMore).toHaveBeenCalledOnce();
  },
};

export const AllShown: Story = {
  args: { shown: 128 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(canvas.queryByText(/ of /)).toBeNull();
  },
};
