import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, fn, userEvent, within } from 'storybook/test';
import { featureList } from './feature-fixtures.ts';
import { OverviewBoard } from './OverviewBoard.tsx';
import { bugBoardFeatures, fullBoardFeatures } from './overview-fixtures.ts';

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

export const Loading: Story = {
  args: { features: 'loading' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading…')).toBeVisible();
  },
};
