import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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
    await expect(select).toHaveValue('stage');
    await userEvent.selectOptions(select, 'Tokens');
    await expect(args.onChange).toHaveBeenCalledWith('tokens');
    await expect(args.onChange).toHaveBeenCalledOnce();
  },
};
