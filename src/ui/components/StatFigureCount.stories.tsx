import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { StatFigure } from './StatFigure.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/StatFigure/Count',
  component: StatFigure,
  decorators: [surfaceFrame],
  args: {
    label: 'Bugs reported',
    value: 3,
    format: String,
    kind: 'amount',
    n: 3,
    noun: { one: 'opening', other: 'openings' },
    comparison: 'previous 30 days',
    better: 'lower',
  },
} satisfies Meta<typeof StatFigure>;

export default meta;

type Story = StoryObj<typeof meta>;

function text(canvasElement: HTMLElement, selector: string): string | null {
  return canvasElement.querySelector(selector)?.textContent ?? null;
}

export const Count: Story = {
  name: 'A count below the minimum sample',
  args: {
    label: 'Bugs reported',
    value: 3,
    format: String,
    kind: 'amount',
    n: 3,
    previous: 2,
    previousN: 2,
    better: 'lower',
    sample: '2 created · 1 reopened',
  },
  play: async ({ canvasElement }) => {
    await expect(text(canvasElement, '[data-value]')).toBe('3');
    await expect(text(canvasElement, '[data-sample]')).toBe(
      '2 created · 1 reopened',
    );
    await expect(text(canvasElement, '[data-change]')).toBe(
      '▲up 50% vs previous 30 days',
    );
  },
};

export const CountZero: Story = {
  name: 'A count at 0',
  args: {
    label: 'Bugs reported',
    value: 0,
    format: String,
    kind: 'amount',
    n: 0,
    previous: 0,
    previousN: 0,
    better: 'lower',
    sample: '0 created · 0 reopened',
  },
  play: async ({ canvasElement }) => {
    await expect(text(canvasElement, '[data-value]')).toBe('0');
    await expect(text(canvasElement, '[data-sample]')).toBe(
      '0 created · 0 reopened',
    );
    await expect(canvasElement.querySelector('[data-change]')).toBeNull();
  },
};
