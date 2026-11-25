import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { IssueKind } from '../git-host/kind.ts';
import type { AutonomyStats } from '../stats/types.ts';
import {
  bugStatsLoaderOf,
  bugStatsOf,
  unreachableBugStats,
} from './stats-bug-fixtures.ts';
import { flowLoaderOf } from './flow-fixtures.ts';
import type { LoadAutonomy } from './stats-api.ts';
import {
  autonomyOf,
  autonomyResponse,
  monthCounts,
  qualityLoaderOf,
} from './stats-fixtures.ts';
import { bugsLoaded, flowLoaded, panelOf, statsRouter } from './stats-story.ts';
import { StatsPage } from './StatsPage.tsx';

const BY_KIND: Record<IssueKind | 'all', AutonomyStats> = {
  all: autonomyOf(),
  bug: autonomyOf({
    current: { ...monthCounts, merged: 6, mergedWithoutPerson: 5 },
  }),
  feature: autonomyOf({
    current: { ...monthCounts, merged: 18, mergedWithoutPerson: 13 },
  }),
};

function kindLoader(
  asked: (IssueKind | null)[],
  pending: IssueKind | null = null,
): LoadAutonomy {
  return (_filters, kind = null) => {
    asked.push(kind);
    if (pending !== null && kind === pending) {
      return new Promise(() => undefined);
    }
    return Promise.resolve(autonomyResponse(BY_KIND[kind ?? 'all']));
  };
}

const meta = {
  title: 'StatsPage/Kinds',
  component: StatsPage,
  args: {
    loadAutonomy: kindLoader([]),
    loadQuality: qualityLoaderOf(),
    loadFlow: flowLoaderOf(),
    loadBugStats: bugStatsLoaderOf(bugStatsOf()),
  },
  decorators: [statsRouter],
} satisfies Meta<typeof StatsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function kindGroup(canvasElement: HTMLElement) {
  return within(within(canvasElement).getByRole('group', { name: 'Kind' }));
}

function panelNames(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);
}

const bugAsked: (IssueKind | null)[] = [];

export const BugsSelected: Story = {
  name: 'Bugs selected',
  parameters: { entry: '/stats?period=30d&kind=bug' },
  args: { loadAutonomy: kindLoader(bugAsked) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await bugsLoaded(canvasElement);
    await flowLoaded(canvasElement);
    await expect(
      await canvas.findByText('6 issues merged · 5 without a person'),
    ).toBeVisible();
    await expect(
      kindGroup(canvasElement).getByRole('button', { name: 'Bugs 6' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      kindGroup(canvasElement).getByRole('button', { name: 'Features 18' }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(panelNames(canvasElement)).toEqual([
      'Autonomy',
      'Quality',
      'Flow and cost',
      'Bugs',
    ]);
    const flow = within(panelOf(canvasElement, 'Flow and cost'));
    await expect(flow.getByText('Tokens on dropped work')).toBeVisible();
    await expect(flow.queryByText('No work item')).toBeNull();
    await expect(bugAsked).toEqual(['bug']);
  },
};

export const FeaturesSelected: Story = {
  name: 'Features selected',
  parameters: { entry: '/stats?period=30d&kind=feature' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await flowLoaded(canvasElement);
    await expect(
      await canvas.findByText('18 issues merged · 13 without a person'),
    ).toBeVisible();
    await expect(
      kindGroup(canvasElement).getByRole('button', { name: 'Features 18' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(panelNames(canvasElement)).toEqual([
      'Autonomy',
      'Quality',
      'Flow and cost',
    ]);
    await expect(
      within(panelOf(canvasElement, 'Flow and cost')).queryByText(
        'No work item',
      ),
    ).toBeNull();
  },
};

const plainAsked: (IssueKind | null)[] = [];

export const NoBugTickets: Story = {
  name: 'A selection without bug tickets: no filter, no Bugs panel',
  parameters: { entry: '/stats?period=30d&kind=bug' },
  args: {
    loadAutonomy: kindLoader(plainAsked),
    loadBugStats: bugStatsLoaderOf(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await flowLoaded(canvasElement);
    await expect(
      await canvas.findByText('24 issues merged · 18 without a person'),
    ).toBeVisible();
    await expect(canvas.queryByRole('group', { name: 'Kind' })).toBeNull();
    await expect(panelNames(canvasElement)).toEqual([
      'Autonomy',
      'Quality',
      'Flow and cost',
    ]);
    await expect(
      within(panelOf(canvasElement, 'Flow and cost')).getByText('No work item'),
    ).toBeVisible();
    await expect(plainAsked).toEqual([null]);
  },
};

export const KeptWhileReloading: Story = {
  name: 'The filter stays with its counts while the figures reload',
  args: { loadAutonomy: kindLoader([], 'bug') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await bugsLoaded(canvasElement);
    await expect(
      await canvas.findByText('24 issues merged · 18 without a person'),
    ).toBeVisible();
    await userEvent.click(
      kindGroup(canvasElement).getByRole('button', { name: 'Bugs 6' }),
    );
    await expect(canvas.getByLabelText('Address')).toHaveTextContent(
      '?period=30d&kind=bug',
    );
    await expect(
      kindGroup(canvasElement).getByRole('button', { name: 'Bugs 6' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      canvas.getByText('24 issues merged · 18 without a person'),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Last 7 days' }));
    await waitFor(() =>
      expect(canvas.getByLabelText('Address').textContent).toBe(
        '?period=7d&kind=bug',
      ),
    );
    await expect(
      kindGroup(canvasElement).getByRole('button', { name: 'Features 18' }),
    ).toBeVisible();
  },
};

const unreachableAsked: (IssueKind | null)[] = [];

export const BugsUnreachable: Story = {
  name: 'Bug answer unreachable: no filter, every kind, the Bugs panel fails alone',
  parameters: { entry: '/stats?period=30d&kind=bug' },
  args: {
    loadAutonomy: kindLoader(unreachableAsked),
    loadBugStats: unreachableBugStats,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await flowLoaded(canvasElement);
    await expect(
      await canvas.findByText('24 issues merged · 18 without a person'),
    ).toBeVisible();
    await expect(canvas.queryByRole('group', { name: 'Kind' })).toBeNull();
    await expect(panelNames(canvasElement)).toEqual([
      'Autonomy',
      'Quality',
      'Flow and cost',
      'Bugs',
    ]);
    await expect(unreachableAsked).toEqual([null]);
  },
};
