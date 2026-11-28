import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, fn, userEvent, within } from 'storybook/test';
import { featureList } from './feature-fixtures.ts';
import { OverviewBoard } from './OverviewBoard.tsx';
import {
  bugBoardFeatures,
  fullBoardFeatures,
  inReviewFeatures,
} from './overview-fixtures.ts';

const meta = {
  component: OverviewBoard,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: {
    features: featureList(bugBoardFeatures, null, { bugTickets: true }),
    filters: { period: '7d', project: undefined },
    kind: null,
    onKindChange: fn(),
    now: new Date('2026-01-07T09:13:00.000Z'),
  },
} satisfies Meta<typeof OverviewBoard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BugsAndFeatures: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Bug').length).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole('button', { name: 'Bugs 8' }));
    await expect(args.onKindChange).toHaveBeenCalledWith('bug');
  },
};

export const BugsSelected: Story = {
  args: {
    features: featureList(bugBoardFeatures, null, {
      bugTickets: true,
      kind: 'bug',
    }),
    kind: 'bug',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Bugs 8' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      canvas.getByRole('link', { name: '+ 1 more' }),
    ).toHaveAttribute('href', '/features?period=7d&stage=merged&kind=bug');
  },
};

export const NoBugInPeriod: Story = {
  args: {
    features: featureList(fullBoardFeatures, null, {
      bugTickets: true,
      kind: 'bug',
    }),
    kind: 'bug',
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('No bug in this period.'),
    ).toBeVisible();
  },
};

export const WithoutBugTickets: Story = {
  args: { features: featureList(fullBoardFeatures, null), kind: 'bug' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('group', { name: 'Kind' })).toBeNull();
    await expect(
      canvas.getByRole('link', { name: '+ 2 more' }),
    ).toHaveAttribute('href', '/features?period=7d&stage=merged');
  },
};

function badgesOf(canvasElement: HTMLElement, name: string): string[] {
  const card = within(canvasElement)
    .getByRole('link', { name: new RegExp(name) })
    .closest('article');
  if (card === null) throw new Error(`No card ${name}`);
  return Array.from(card.querySelectorAll('[data-tone]'), (badge) =>
    (badge.textContent ?? '').trim(),
  );
}

export const InReviewScores: Story = {
  name: 'In review scores',
  args: { features: featureList(inReviewFeatures, null) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('serenity 48 · below threshold'),
    ).toHaveAttribute('data-tone', 'warning');
    await expect(canvas.getByText('round 3')).toBeVisible();
    await expect(badgesOf(canvasElement, 'Retry failed exports')).toEqual([
      'serenity 48 · below threshold',
      'round 3',
    ]);
    await expect(canvas.getByText('serenity 80')).toHaveAttribute(
      'data-tone',
      'success',
    );
    await expect(badgesOf(canvasElement, 'Webhook signatures')).toEqual([
      'serenity 80',
    ]);
    await expect(badgesOf(canvasElement, 'Bulk tag edit')).toEqual([]);
  },
};

export const Loading: Story = {
  args: { features: 'loading' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading…')).toBeVisible();
  },
};
