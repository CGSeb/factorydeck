import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { chooseOption } from './select-test.ts';
import { SortSelect } from './SortSelect.tsx';

const meta = {
  component: SortSelect<string>,
  args: {
    value: 'stage',
    options: [
      { value: 'stage', label: 'Stage' },
      { value: 'tokens', label: 'Tokens' },
      { value: 'activity', label: 'Last activity' },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof SortSelect<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const select = within(canvasElement).getByRole('combobox', {
      name: 'Sort by',
    });
    await expect(select).toHaveAttribute('data-value', 'stage');
    await chooseOption(select, 'Tokens');
    await expect(args.onChange).toHaveBeenCalledWith('tokens');
    await expect(args.onChange).toHaveBeenCalledOnce();
  },
};
