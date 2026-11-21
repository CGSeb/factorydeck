import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Period } from '../overview/types.ts';
import { PeriodSelector } from './PeriodSelector.tsx';

const meta = {
  component: PeriodSelector,
  args: { value: '7d', onChange: () => undefined },
  render: function Controlled(args) {
    const [value, setValue] = useState<Period>(args.value);
    return <PeriodSelector value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof PeriodSelector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LastSevenDays: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    await expect(buttons.map((button) => button.textContent)).toEqual([
      'Today',
      'Last 7 days',
      'Last 30 days',
      'All time',
    ]);
    await expect(
      canvas.getByRole('button', { name: 'Last 7 days' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'All time' }));
    await expect(
      canvas.getByRole('button', { name: 'All time' }),
    ).toHaveAttribute('aria-pressed', 'true');
  },
};
