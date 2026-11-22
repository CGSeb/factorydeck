import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { CountBars } from './CountBars.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/CountBars',
  component: CountBars,
  decorators: [surfaceFrame],
  args: {
    rows: [
      { label: 'Failing checks', count: 3 },
      { label: 'Score below threshold', count: 5 },
      { label: 'Open question', count: 2 },
      { label: 'Rebase conflict', count: 1 },
      { label: 'Protected path', count: 4 },
    ],
    total: 12,
    noun: { one: 'merged issue', other: 'merged issues' },
  },
} satisfies Meta<typeof CountBars>;

export default meta;

type Story = StoryObj<typeof meta>;

function items(canvasElement: HTMLElement): string[][] {
  return within(canvasElement)
    .getAllByRole('listitem')
    .map((item) =>
      [...item.children]
        .filter((part) => part.getAttribute('aria-hidden') !== 'true')
        .map((part) => part.textContent),
    );
}

function bars(canvasElement: HTMLElement): (string | null)[] {
  return [...canvasElement.querySelectorAll('[data-track]')].map(
    (track) =>
      track.querySelector<HTMLElement>('[data-bar]')?.style.width ?? null,
  );
}

export const Overlapping: Story = {
  name: 'Five reasons with overlap',
  play: async ({ canvasElement }) => {
    await expect(items(canvasElement)).toEqual([
      ['Score below threshold', '5 · 42%'],
      ['Protected path', '4 · 33%'],
      ['Failing checks', '3 · 25%'],
      ['Open question', '2 · 17%'],
      ['Rebase conflict', '1 · 8%'],
    ]);
    await expect(bars(canvasElement)[1]).toBe(`${String((4 / 12) * 100)}%`);
    await expect(canvasElement.querySelector('[data-among]')?.textContent).toBe(
      'among 12 merged issues',
    );
    for (const track of canvasElement.querySelectorAll('[data-track]')) {
      await expect(track).toHaveAttribute('aria-hidden', 'true');
    }
  },
};

export const ReasonAtZero: Story = {
  name: 'A reason at 0',
  args: {
    rows: [
      { label: 'Failing checks', count: 0 },
      { label: 'Score below threshold', count: 1 },
    ],
    total: 250,
  },
  play: async ({ canvasElement }) => {
    await expect(items(canvasElement)).toEqual([
      ['Score below threshold', '1 · <1%'],
      ['Failing checks', '0 · 0%'],
    ]);
    await expect(bars(canvasElement)[1]).toBeNull();
  },
};

export const Tie: Story = {
  name: 'A tie',
  args: {
    rows: [
      { label: 'Open question', count: 2 },
      { label: 'Failing checks', count: 4 },
      { label: 'Rebase conflict', count: 2 },
    ],
    total: 8,
  },
  play: async ({ canvasElement }) => {
    await expect(items(canvasElement).map(([label]) => label)).toEqual([
      'Failing checks',
      'Open question',
      'Rebase conflict',
    ]);
  },
};

export const BelowMinimum: Story = {
  name: 'Below the minimum sample',
  args: {
    rows: [
      { label: 'Failing checks', count: 1 },
      { label: 'Open question', count: 0 },
    ],
    total: 1,
  },
  play: async ({ canvasElement }) => {
    await expect(items(canvasElement)).toEqual([
      ['Failing checks', 'Not enough data'],
      ['Open question', 'Not enough data'],
    ]);
    await expect(bars(canvasElement)).toEqual([null, null]);
    await expect(canvasElement.querySelector('[data-among]')?.textContent).toBe(
      'among 1 merged issue',
    );
  },
};
