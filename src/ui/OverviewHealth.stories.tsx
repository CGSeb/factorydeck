import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { flowOf, flowResponse } from './flow-fixtures.ts';
import { OverviewHealth } from './OverviewHealth.tsx';
import {
  autonomyOf,
  autonomyResponse,
  qualityOf,
  qualityResponse,
} from './stats-fixtures.ts';

const UNREACHABLE = { status: 'unreachable', refreshSeconds: 3600 } as const;

const meta = {
  component: OverviewHealth,
  args: {
    autonomy: autonomyResponse(autonomyOf()),
    quality: qualityResponse(qualityOf()),
    flow: flowResponse(flowOf()),
    period: '30d',
    statsHref: '/stats?period=30d',
    now: new Date('2026-11-24T12:00:00Z'),
  },
} satisfies Meta<typeof OverviewHealth>;

export default meta;

type Story = StoryObj<typeof meta>;

function withoutPrevious<T extends { previous?: unknown }>(stats: T): T {
  const copy = { ...stats };
  delete copy.previous;
  return copy;
}

function figure(canvasElement: HTMLElement, label: string): HTMLElement {
  const name = within(canvasElement).getByText(label);
  const found = name.closest('.fd-overview-health-figures > div');
  if (!(found instanceof HTMLElement)) throw new Error(`No figure ${label}`);
  return found;
}

export const Values: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Health' }),
    ).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Stats' })).toHaveAttribute(
      'href',
      '/stats?period=30d',
    );
    const merged = figure(canvasElement, 'Merged without a person');
    await expect(merged).toHaveTextContent('75%');
    await expect(merged).toHaveTextContent('n = 24 merged issues');
    await expect(merged).toHaveTextContent('vs previous 30 days');
    const first = figure(canvasElement, 'Right the first time');
    await expect(first).toHaveTextContent('merged issues with a report');
    await expect(
      canvas.getByRole('heading', { name: 'Merged per week' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('table', { name: 'Merged per week' }),
    ).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole('button', { name: 'About Merged without a person' }),
    );
    await waitFor(() =>
      expect(
        canvas.getByText(/merged on its own: no spec question/),
      ).toBeVisible(),
    );
  },
};

export const NotEnoughData: Story = {
  name: 'Not enough data',
  args: {
    autonomy: autonomyResponse(
      autonomyOf({
        current: {
          merged: 3,
          mergedWithoutPerson: 2,
          mergedAfterQuestion: 0,
          stopWaitsMs: [],
        },
      }),
    ),
    quality: qualityResponse(
      qualityOf({
        current: {
          merged: 3,
          mergedWithReport: 2,
          firstPassed: 1,
          roundsSum: 0,
          roundsCount: 0,
          gainSum: 0,
          gainCount: 0,
        },
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getAllByText('Not enough data'),
    ).toHaveLength(2);
  },
};

export const NoChangeLine: Story = {
  name: 'No change line',
  args: {
    period: 'all',
    autonomy: autonomyResponse(withoutPrevious(autonomyOf())),
    quality: qualityResponse(withoutPrevious(qualityOf())),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByText(/vs previous/),
    ).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { flow: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading…')).toBeVisible();
  },
};

export const Unreachable: Story = {
  args: { autonomy: UNREACHABLE },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        'Database unreachable. Start it with pnpm db:up.',
      ),
    ).toBeVisible();
  },
};
