import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PeriodPills } from './PeriodPills.tsx';

const meta = {
  component: PeriodPills,
  args: { value: '7d', onChange: fn() },
} satisfies Meta<typeof PeriodPills>;

export default meta;

type Story = StoryObj<typeof meta>;

function pressed(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('button', { pressed: true })
    .map((button) => button.textContent);
}

export const Today: Story = {
  args: { value: 'today' },
  play: async ({ canvasElement }) => {
    await expect(pressed(canvasElement)).toEqual(['Today']);
  },
};

export const Last7Days: Story = {
  play: async ({ canvasElement, args }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Period' });
    await expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Today', 'Last 7 days', 'Last 30 days', 'All time']);
    await expect(pressed(canvasElement)).toEqual(['Last 7 days']);
    await userEvent.click(
      within(group).getByRole('button', { name: 'Last 7 days' }),
    );
    await expect(args.onChange).not.toHaveBeenCalled();
    await userEvent.click(
      within(group).getByRole('button', { name: 'Last 30 days' }),
    );
    await expect(args.onChange).toHaveBeenCalledWith('30d');
    await expect(args.onChange).toHaveBeenCalledOnce();
  },
};

export const Last30Days: Story = {
  args: { value: '30d' },
  play: async ({ canvasElement }) => {
    await expect(pressed(canvasElement)).toEqual(['Last 30 days']);
  },
};

export const AllTime: Story = {
  args: { value: 'all' },
  play: async ({ canvasElement }) => {
    await expect(pressed(canvasElement)).toEqual(['All time']);
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};
