import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  emptyOverview,
  fixedLoader,
  okResponse,
  todayOverview,
  unknownPricesOverview,
  unreachableResponse,
  weekOverview,
} from './fixtures.ts';
import { OverviewPage } from './OverviewPage.tsx';

const meta = {
  component: OverviewPage,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/?period=7d']}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof OverviewPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function pressed(canvasElement: HTMLElement, name: string): Promise<void> {
  return waitFor(() =>
    expect(within(canvasElement).getByRole('button', { name })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  );
}

export const Data: Story = {
  args: {
    loadOverview: fixedLoader((period) =>
      okResponse(period === 'today' ? todayOverview : weekOverview),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('~$48.27');
    await canvas.findByText('Cost per day');
    await expect(canvas.getByText(/^Updated \d\d:\d\d:\d\d$/)).toBeVisible();
    await expect(canvas.getByText('unassigned')).toBeVisible();
    await pressed(canvasElement, 'Last 7 days');
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }));
    await pressed(canvasElement, 'Today');
    await canvas.findByText('Cost per hour');
  },
};

export const Empty: Story = {
  args: { loadOverview: fixedLoader(() => okResponse(emptyOverview)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', {
      name: 'Install the factory in a project',
    });
    await expect(canvas.queryByText('Cost')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'All time' }));
    await pressed(canvasElement, 'All time');
  },
};

export const PeriodChangeFails: Story = {
  args: {
    loadOverview: (period) =>
      Promise.resolve(period === '7d' ? okResponse(weekOverview) : undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('~$48.27');
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await pressed(canvasElement, 'Last 30 days');
    await canvas.findByText('Loading…');
    await expect(canvas.queryByText('~$48.27')).toBeNull();
  },
};

export const DatabaseUnreachable: Story = {
  args: { loadOverview: fixedLoader(() => unreachableResponse) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Database unreachable. Start it with pnpm db:up.');
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await pressed(canvasElement, 'Last 30 days');
  },
};

export const UnknownPrices: Story = {
  args: {
    loadOverview: fixedLoader(() => okResponse(unknownPricesOverview)),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Excludes 40 calls with unknown prices.');
    await expect(canvas.getByRole('rowheader', { name: '—' })).toBeVisible();
    await expect(canvas.getAllByText('—')).toHaveLength(3);
    await userEvent.click(canvas.getByRole('button', { name: 'All time' }));
    await pressed(canvasElement, 'All time');
  },
};
