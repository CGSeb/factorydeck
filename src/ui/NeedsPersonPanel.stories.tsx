import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { APP } from './feature-fixtures.ts';
import { NeedsPersonPanel } from './NeedsPersonPanel.tsx';
import {
  WAITING_NOW,
  manyWaiting,
  noWaiting,
  someWaiting,
  waitingResponse,
} from './waiting-fixtures.ts';

const ALL = { period: '7d', project: undefined } as const;

const meta = {
  component: NeedsPersonPanel,
  args: {
    response: waitingResponse(someWaiting),
    filters: ALL,
    now: WAITING_NOW,
  },
} satisfies Meta<typeof NeedsPersonPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

function rowOf(canvasElement: HTMLElement, name: string): HTMLElement {
  const row = within(canvasElement).getByRole('link', { name }).closest('tr');
  if (row === null) throw new Error(`No row ${name}`);
  return row;
}

export const EachReason: Story = {
  name: 'Each reason',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Needs a person' }),
    ).toBeVisible();
    const below = rowOf(canvasElement, '#58 Retry failed exports');
    await expect(below).toHaveTextContent('Below threshold');
    await expect(below).toHaveTextContent('1 d 4 h');
    await expect(below).toHaveTextContent('Example App');
    await expect(
      rowOf(canvasElement, '#66 Webhook signatures'),
    ).toHaveTextContent('Gates failed');
    await expect(rowOf(canvasElement, '#69 Bulk tag edit')).toHaveTextContent(
      'Spec question',
    );
    const blocked = rowOf(canvasElement, '#71 Rate limit per token');
    await expect(blocked).toHaveTextContent('Blocked');
    await expect(blocked).toHaveTextContent('—');
    await expect(
      canvas.getByRole('link', { name: '#58 Retry failed exports' }),
    ).toHaveAttribute(
      'href',
      `/features/58?project=${encodeURIComponent(APP)}&period=7d`,
    );
  },
};

export const SeveralReasons: Story = {
  name: 'Several reasons',
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement, '#63 Audit log filters');
    const reasons = within(row).getAllByRole('listitem');
    await expect(reasons.map((item) => item.textContent)).toEqual([
      'Blocked',
      'Spec question',
    ]);
    await expect(row).toHaveTextContent('3 h 05 min');
  },
};

export const OneProject: Story = {
  args: {
    filters: { period: '7d', project: APP },
    response: waitingResponse({
      ...someWaiting,
      issues: someWaiting.issues.filter((issue) => issue.project === APP),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Example App')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('columnheader', { name: 'Project' }),
    ).not.toBeInTheDocument();
  },
};

export const MoreThanTen: Story = {
  name: 'More than 10 rows',
  args: { response: waitingResponse(manyWaiting) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('row')).toHaveLength(11);
    await expect(canvas.getByText('10 of 13')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show more' }));
    await expect(canvas.getAllByRole('row')).toHaveLength(14);
    await expect(
      canvas.queryByRole('button', { name: 'Show more' }),
    ).not.toBeInTheDocument();
  },
};

export const NobodyWaiting: Story = {
  name: 'Nobody waiting',
  args: { response: waitingResponse(noWaiting) },
  decorators: [
    (Story) => (
      <>
        <Story />
        <p>The next panel follows with no gap.</p>
      </>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('section')).toBeNull();
  },
};

export const Loading: Story = {
  args: { response: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading…')).toBeVisible();
  },
};

export const Unreachable: Story = {
  args: { response: { status: 'unreachable', refreshSeconds: 3600 } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        'Database unreachable. Start it with pnpm db:up.',
      ),
    ).toBeVisible();
  },
};
