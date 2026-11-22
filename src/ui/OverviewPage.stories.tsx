import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
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
import type { LoadOverview } from './overview-api.ts';
import { OverviewPage } from './OverviewPage.tsx';

function Location(): ReactElement {
  const { search } = useLocation();
  return <output aria-label="Address">{search}</output>;
}

const appOnly: LoadOverview = (_period, project) =>
  Promise.resolve(
    okResponse(
      project === undefined
        ? weekOverview
        : {
            ...weekOverview,
            totals: { ...weekOverview.totals, costUsd: 36.4, sessions: 9 },
            projects: weekOverview.projects.filter(
              (row) => row.project === project,
            ),
          },
    ),
  );

const meta = {
  component: OverviewPage,
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter
        initialEntries={[
          typeof parameters['entry'] === 'string'
            ? parameters['entry']
            : '/?period=7d',
        ]}
      >
        <Story />
        <Location />
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

export const OneProject: Story = {
  args: { loadOverview: appOnly },
  parameters: { entry: '/?period=7d&project=%2Fhome%2Fdev%2Fexample-app' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Cost per day');
    await expect(canvas.getAllByText('~$36.40')).toHaveLength(2);
    const table = canvas.getByRole('table', { name: 'By project' });
    await expect(within(table).getAllByRole('row')).toHaveLength(2);
    await expect(within(table).getByText('Example App')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }));
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?period=today&project=%2Fhome%2Fdev%2Fexample-app');
  },
};
