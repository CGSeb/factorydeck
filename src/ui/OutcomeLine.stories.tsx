import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { OutcomeLine } from './OutcomeLine.tsx';

const meta = {
  component: OutcomeLine,
  args: {
    outcome: {
      stage: 'merged',
      report: { score: 86, threshold: 80, rounds: 1 },
      reworked: false,
    },
  },
} satisfies Meta<typeof OutcomeLine>;

export default meta;

type Story = StoryObj<typeof meta>;

function details(canvasElement: HTMLElement): string[] {
  const value = within(canvasElement).getByRole('definition');
  return [...value.children].map((child) => child.textContent);
}

export const Merged: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('term')).toHaveTextContent(
      'Outcome',
    );
    await expect(details(canvasElement)).toEqual([
      'Merged',
      'Serenity 86/100 (threshold 80)',
      '1 review round',
    ]);
    await expect(within(canvasElement).getByText('Merged')).toHaveClass(
      'stage-success',
    );
  },
};

export const MergedByAPerson: Story = {
  args: {
    outcome: {
      stage: 'merged-by-person',
      report: { score: 91, threshold: 80, rounds: 2 },
      reworked: false,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(details(canvasElement)).toEqual([
      'Merged by a person',
      'Serenity 91/100 (threshold 80)',
      '2 review rounds',
    ]);
  },
};

export const BelowThreshold: Story = {
  args: {
    outcome: {
      stage: 'merged-by-person',
      report: { score: 57, threshold: 80, rounds: 3 },
      reworked: false,
    },
  },
  play: async ({ canvasElement }) => {
    const score = within(canvasElement).getByText(
      'Serenity 57/100 (threshold 80) below threshold',
    );
    await expect(score).toHaveClass('serenity-below');
  },
};

export const InReviewWithoutReport: Story = {
  args: { outcome: { stage: 'in-review', report: null, reworked: false } },
  play: async ({ canvasElement }) => {
    await expect(details(canvasElement)).toEqual([
      'In review',
      'Serenity —',
      '— review rounds',
    ]);
    await expect(within(canvasElement).getByText('In review')).toHaveClass(
      'stage-neutral',
    );
  },
};

export const Reworked: Story = {
  args: {
    outcome: {
      stage: 'closed',
      report: { score: 70, threshold: 80, rounds: null },
      reworked: true,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(details(canvasElement)).toEqual([
      'Closed without merge',
      'Serenity 70/100 (threshold 80) below threshold',
      '— review rounds',
      'Reworked',
    ]);
    await expect(
      within(canvasElement).getByText('Closed without merge'),
    ).toHaveClass('stage-danger');
  },
};
