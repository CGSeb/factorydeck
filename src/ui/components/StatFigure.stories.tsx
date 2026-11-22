import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { StatFigure } from './StatFigure.tsx';
import { surfaceFrame } from './story-frame.ts';

function percent(value: number): string {
  return `${String(Math.round(value * 100))}%`;
}

function hours(value: number): string {
  return `${value.toFixed(1)} h`;
}

const mergedIssues = { one: 'merged issue', other: 'merged issues' };

const meta = {
  title: 'Components/StatFigure',
  component: StatFigure,
  decorators: [surfaceFrame],
  args: {
    label: 'Merged without help',
    value: 0.62,
    format: percent,
    kind: 'share',
    n: 14,
    noun: mergedIssues,
    previous: 0.5,
    previousN: 12,
    comparison: 'previous 30 days',
    better: 'higher',
  },
} satisfies Meta<typeof StatFigure>;

export default meta;

type Story = StoryObj<typeof meta>;

function text(canvasElement: HTMLElement, selector: string): string | null {
  return canvasElement.querySelector(selector)?.textContent ?? null;
}

function changeColor(canvasElement: HTMLElement): string {
  const line = canvasElement.querySelector<HTMLElement>('[data-change]');
  if (line === null) throw new Error('No change line');
  return line.style.color;
}

export const ShareBetter: Story = {
  name: 'Share going the better way',
  play: async ({ canvasElement }) => {
    await expect(text(canvasElement, '[data-value]')).toBe('62%');
    await expect(text(canvasElement, '[data-sample]')).toBe(
      'n = 14 merged issues',
    );
    await expect(text(canvasElement, '[data-change]')).toBe(
      '▲up 12 pts vs previous 30 days',
    );
    await expect(changeColor(canvasElement)).toBe('var(--fd-success)');
  },
};

export const AmountWorse: Story = {
  name: 'Amount going the worse way',
  args: {
    label: 'Merged issues',
    value: 82,
    format: String,
    kind: 'amount',
    previous: 100,
    previousN: 20,
    n: 82,
  },
  play: async ({ canvasElement }) => {
    await expect(text(canvasElement, '[data-change]')).toBe(
      '▼down 18% vs previous 30 days',
    );
    await expect(changeColor(canvasElement)).toBe('var(--fd-danger)');
  },
};

export const LowerIsBetter: Story = {
  name: 'Lower is better and falling',
  args: {
    label: 'Median lead time',
    value: 5.2,
    format: hours,
    kind: 'amount',
    previous: 6.5,
    previousN: 11,
    better: 'lower',
  },
  play: async ({ canvasElement }) => {
    await expect(text(canvasElement, '[data-change]')).toBe(
      '▼down 20% vs previous 30 days',
    );
    await expect(changeColor(canvasElement)).toBe('var(--fd-success)');
  },
};

export const NoChange: Story = {
  name: 'No change',
  args: { value: 0.502, previous: 0.5 },
  play: async ({ canvasElement }) => {
    await expect(text(canvasElement, '[data-change]')).toBe(
      'No change vs previous 30 days',
    );
    await expect(changeColor(canvasElement)).toBe('var(--fd-muted)');
  },
};

export const NoPrevious: Story = {
  name: 'No previous value',
  args: { previous: undefined, previousN: undefined },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-change]')).toBeNull();
  },
};

export const PreviousZero: Story = {
  name: 'Previous value 0',
  args: {
    label: 'Merged issues',
    value: 6,
    format: String,
    kind: 'amount',
    n: 6,
    previous: 0,
    previousN: 5,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-change]')).toBeNull();
  },
};

export const BelowMinimum: Story = {
  name: 'Below the minimum sample',
  args: { n: 1, value: 1 },
  play: async ({ canvasElement }) => {
    await expect(text(canvasElement, '[data-value]')).toBe('—');
    await expect(text(canvasElement, '[data-sample]')).toBe('Not enough data');
    await expect(canvasElement.querySelector('[data-change]')).toBeNull();
  },
};

export const NullValue: Story = {
  name: 'Null value',
  args: { value: null },
  play: async ({ canvasElement }) => {
    await expect(text(canvasElement, '[data-value]')).toBe('—');
    await expect(text(canvasElement, '[data-sample]')).toBe('Not enough data');
    await expect(canvasElement.querySelector('[data-change]')).toBeNull();
  },
};

export const WithNote: Story = {
  name: 'With a note',
  args: { note: '2 still waiting' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('2 still waiting'),
    ).toBeInTheDocument();
  },
};

export const OneItem: Story = {
  name: 'One item, with a note',
  args: { n: 1, value: 1, note: '1 still waiting' },
  play: async ({ canvasElement }) => {
    await expect(text(canvasElement, '[data-note]')).toBe('1 still waiting');
  },
};
