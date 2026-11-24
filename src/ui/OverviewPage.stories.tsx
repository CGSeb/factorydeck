import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { OverviewPage } from './OverviewPage.tsx';
import { APP, featuresLoaderOf } from './feature-fixtures.ts';
import { emptyOverview, fixedLoader, okResponse } from './fixtures.ts';
import { flowIssues, flowLoaderOf, flowOf } from './flow-fixtures.ts';
import { unmergedFeatures } from './overview-fixtures.ts';
import {
  address,
  column,
  overviewArgs,
  overviewRouter,
  section,
  title,
} from './overview-story.ts';
import { rolesLoader } from './role-fixtures.ts';
import { autonomyLoaderOf, autonomyOf, noCounts } from './stats-fixtures.ts';
import { noWaiting, waitingLoaderOf } from './waiting-fixtures.ts';

const meta = {
  component: OverviewPage,
  args: overviewArgs,
  decorators: [overviewRouter],
} satisfies Meta<typeof OverviewPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllProjects: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () =>
      expect(await title(canvasElement)).toHaveTextContent(
        /^24 issues merged for 12\.5MCost.* tokens$/,
      ),
    );
    await canvas.findByText('1.2M tokens per merged issue · 14 sessions');
    await expect(
      canvas.queryByText(/merged without a person ·/),
    ).not.toBeInTheDocument();
    const health = section(canvasElement, /^Health$/);
    await within(health).findByText('Merged without a person');
    await expect(
      within(health).getByText('Right the first time'),
    ).toBeVisible();
    await expect(
      within(health).getByRole('heading', { name: 'Merged per week' }),
    ).toBeVisible();
    await expect(
      within(health).getByRole('link', { name: 'Stats' }),
    ).toHaveAttribute('href', '/stats?period=7d');
    const needs = section(canvasElement, /^Needs a person$/);
    await expect(
      within(needs).getByRole('link', { name: '#58 Retry failed exports' }),
    ).toHaveAttribute(
      'href',
      `/features/58?project=${encodeURIComponent(APP)}&period=7d`,
    );
    const merged = column(canvasElement, 'Merged');
    await expect(within(merged).getAllByRole('article')).toHaveLength(5);
    await expect(
      within(merged).getByRole('link', { name: '+ 2 more' }),
    ).toHaveAttribute('href', '/features?period=7d&stage=merged');
    await expect(
      within(column(canvasElement, 'Ready')).getByText('Needs spec'),
    ).toBeVisible();
    await expect(
      within(column(canvasElement, 'In review')).getByText('13 min ago'),
    ).toBeVisible();
    await expect(
      canvas.queryByRole('heading', { name: 'Where the tokens went' }),
    ).toBeNull();
    await expect(canvas.queryByRole('link', { name: 'Roles' })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }));
    await expect(address(canvasElement)).toHaveTextContent('/?period=today');
  },
};

export const OneProject: Story = {
  parameters: { entry: `/?period=7d&project=${encodeURIComponent(APP)}` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: '#61 Bulk import' });
    await expect(canvas.queryByText('Example App')).toBeNull();
    await expect(canvas.queryByText('Retry policy')).toBeNull();
    await expect(
      canvas.queryByRole('link', { name: '#63 Audit log filters' }),
    ).toBeNull();
    await expect(
      within(section(canvasElement, /^Health$/)).getByRole('link', {
        name: 'Stats',
      }),
    ).toHaveAttribute(
      'href',
      `/stats?period=7d&project=${encodeURIComponent(APP)}`,
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await expect(address(canvasElement)).toHaveTextContent(
      `/?period=30d&project=${encodeURIComponent(APP)}`,
    );
  },
};

export const NoMergedIssue: Story = {
  args: {
    loadFeatures: featuresLoaderOf(unmergedFeatures),
    loadAutonomy: autonomyLoaderOf(autonomyOf({ current: noCounts })),
    loadFlow: flowLoaderOf(
      flowOf({ current: { ...flowOf().current, issues: [] } }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () =>
      expect(await title(canvasElement)).toHaveTextContent(
        /^No issue merged · 12\.5MCost.* tokens$/,
      ),
    );
    await canvas.findByText('14 sessions');
    await expect(
      within(column(canvasElement, 'Merged')).getByText('No issue'),
    ).toBeVisible();
  },
};

export const FewMergedWithAgentWork: Story = {
  name: 'Few merged issues with agent work',
  args: {
    loadFlow: flowLoaderOf(
      flowOf({
        current: {
          ...flowOf().current,
          issues: flowIssues([
            [20, 10, 1_000_000],
            [30, 12, 1_200_000],
            [40, 14, null],
          ]),
        },
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('14 sessions');
    await expect(canvas.queryByText(/tokens per merged issue/)).toBeNull();
  },
};

export const NoActivity: Story = {
  args: {
    loadOverview: fixedLoader(() => okResponse(emptyOverview)),
    loadFeatures: featuresLoaderOf([]),
    loadRoles: rolesLoader([]),
    loadAutonomy: autonomyLoaderOf(
      autonomyOf({
        current: { ...noCounts, merged: 2, mergedWithoutPerson: 2 },
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No activity in this period.');
    await waitFor(async () =>
      expect(await title(canvasElement)).toHaveTextContent(
        /^2 issues merged for 0Cost.* tokens$/,
      ),
    );
    await expect(
      canvas.queryByRole('button', { name: 'Where the tokens went' }),
    ).toBeNull();
    await expect(canvas.queryByRole('region', { name: 'Board' })).toBeNull();
    const health = section(canvasElement, /^Health$/);
    await expect(
      within(health).getAllByText('Not enough data').length,
    ).toBeGreaterThan(0);
    await expect(
      canvas.getByRole('heading', { name: 'Needs a person' }),
    ).toBeVisible();
  },
};

export const NobodyWaiting: Story = {
  name: 'Nobody waiting',
  args: { loadWaiting: waitingLoaderOf(noWaiting) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: '#61 Bulk import' });
    await canvas.findByText('Merged without a person');
    await expect(
      canvas.queryByRole('heading', { name: 'Needs a person' }),
    ).toBeNull();
  },
};

export const At1024: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1024 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('region', { name: 'Board' });
  },
};
