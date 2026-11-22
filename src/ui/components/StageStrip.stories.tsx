import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useState } from 'react';
import type { StageGroup } from './StageDot.tsx';
import { StageStrip, type StageStripProps } from './StageStrip.tsx';

function Controlled(props: StageStripProps) {
  const [value, setValue] = useState<StageGroup | null>(props.value);
  return (
    <StageStrip
      {...props}
      value={value}
      onChange={(group) => {
        props.onChange(group);
        setValue(group);
      }}
    />
  );
}

const meta = {
  component: StageStrip,
  args: {
    value: null,
    onChange: fn(),
    stages: [
      {
        group: 'ready',
        count: 2,
        counts: {
          input: 20_000,
          output: 80_000,
          cacheRead: 900_000,
          cacheWrite: 200_000,
        },
        costUsd: 1.84,
      },
      {
        group: 'working',
        count: 2,
        counts: {
          input: 40_000,
          output: 160_000,
          cacheRead: 2_300_000,
          cacheWrite: 300_000,
        },
        costUsd: 4.12,
      },
      {
        group: 'in-review',
        count: 3,
        counts: {
          input: 90_000,
          output: 410_000,
          cacheRead: 6_200_000,
          cacheWrite: 800_000,
        },
        costUsd: 11.3,
      },
      {
        group: 'merged',
        count: 11,
        counts: {
          input: 300_000,
          output: 1_700_000,
          cacheRead: 25_100_000,
          cacheWrite: 3_200_000,
        },
        costUsd: 42.75,
        unknownPriceCalls: 1,
      },
    ],
  },
} satisfies Meta<typeof StageStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

function buttonTexts(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('button')
    .map((button) => button.textContent);
}

export const NoneSelected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(buttonTexts(canvasElement)).toEqual([
      'Ready2',
      'Working2',
      'In review3',
      'Merged11',
    ]);
    await expect(canvas.queryByRole('button', { pressed: true })).toBeNull();
    await expect(canvas.getByText('30.3M')).toBeVisible();
  },
};

export const MergedSelected: Story = {
  args: { value: 'merged' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { pressed: true }),
    ).toHaveTextContent('Merged11');
  },
};

export const WorkingSelected: Story = {
  args: { value: 'working' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { pressed: true }),
    ).toHaveTextContent('Working2');
  },
};

export const At360px: Story = {
  name: 'At 360 px',
  decorators: [
    (Story) => (
      <div style={{ width: '360px', maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
};

export const SelectThenUnselect: Story = {
  render: (args) => <Controlled {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const working = canvas.getByRole('button', { name: 'Working 2' });
    await userEvent.click(working);
    await expect(args.onChange).toHaveBeenLastCalledWith('working');
    await expect(working).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(working);
    await expect(args.onChange).toHaveBeenLastCalledWith(null);
    await expect(canvas.queryByRole('button', { pressed: true })).toBeNull();
  },
};
