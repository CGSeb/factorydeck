import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { FilterPills } from './FilterPills.tsx';

const meta = {
  component: FilterPills<string>,
  args: {
    label: 'Session state',
    value: 'all',
    options: [
      { value: 'all', label: 'All', count: 12 },
      {
        value: 'working',
        label: 'Working',
        count: 3,
        dot: 'var(--fd-stage-working)',
      },
      {
        value: 'waiting',
        label: 'Waiting for you',
        count: 1,
        dot: 'var(--fd-stage-review)',
      },
      {
        value: 'inactive',
        label: 'Inactive',
        count: 8,
        dot: 'var(--fd-stage-ready)',
      },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof FilterPills<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SessionStates: Story = {
  play: async ({ canvasElement, args }) => {
    const group = within(canvasElement).getByRole('group', {
      name: 'Session state',
    });
    const buttons = within(group).getAllByRole('button');
    await expect(buttons.map((button) => button.textContent)).toEqual([
      'All12',
      'Working3',
      'Waiting for you1',
      'Inactive8',
    ]);
    await expect(
      within(group).getAllByRole('button', { pressed: true }),
    ).toHaveLength(1);
    await userEvent.click(
      within(group).getByRole('button', { name: 'Working 3' }),
    );
    await expect(args.onChange).toHaveBeenCalledWith('working');
    await expect(args.onChange).toHaveBeenCalledOnce();
  },
};

export const WorkingSelected: Story = {
  args: { value: 'working' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { pressed: true }),
    ).toHaveAccessibleName('Working 3');
  },
};
