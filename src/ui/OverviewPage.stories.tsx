import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { APP, featuresLoaderOf } from './feature-fixtures.ts';
import {
  emptyOverview,
  fixedLoader,
  okResponse,
  todayOverview,
  unreachableResponse,
  weekOverview,
} from './fixtures.ts';
import { OverviewPage } from './OverviewPage.tsx';
import {
  afterPersonFeatures,
  fullBoardFeatures,
  unmergedFeatures,
} from './overview-fixtures.ts';
import { rolesLoader, someRoles } from './role-fixtures.ts';

function Location(): ReactElement {
  const { pathname, search } = useLocation();
  return <output aria-label="Address">{`${pathname}${search}`}</output>;
}

const UNREACHABLE = { status: 'unreachable', refreshSeconds: 3600 } as const;

const meta = {
  component: OverviewPage,
  args: {
    loadOverview: fixedLoader((period) =>
      okResponse(period === 'today' ? todayOverview : weekOverview),
    ),
    loadFeatures: featuresLoaderOf(fullBoardFeatures),
    loadRoles: rolesLoader(someRoles),
  },
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

function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

function column(canvasElement: HTMLElement, name: string): HTMLElement {
  const heading = within(canvasElement).getByRole('heading', {
    level: 2,
    name: new RegExp(`^${name} \\d+$`),
  });
  const section = heading.closest('section');
  if (section === null) throw new Error(`No column ${name}`);
  return section;
}

function title(canvasElement: HTMLElement): Promise<HTMLElement> {
  return within(canvasElement).findByRole('heading', { level: 1 });
}

async function expectNoOldContent(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await expect(canvas.queryByRole('region', { name: 'Totals' })).toBeNull();
  await expect(canvas.queryByText('Cost per day')).toBeNull();
  await expect(canvas.queryByRole('table', { name: 'By project' })).toBeNull();
  await expect(canvas.queryByRole('table', { name: 'By model' })).toBeNull();
}

export const AllProjects: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () =>
      expect(await title(canvasElement)).toHaveTextContent(
        /^7 issues merged for 12\.5MCost.* tokens$/,
      ),
    );
    await expect(
      canvas.getByText(
        '3.1M tokens per merged issue · 6 of 7 merged without a person · 14 sessions',
      ),
    ).toBeVisible();
    const merged = column(canvasElement, 'Merged');
    await expect(within(merged).getAllByRole('article')).toHaveLength(5);
    await expect(
      within(merged).getByRole('link', { name: '+ 2 more' }),
    ).toHaveAttribute('href', '/features?period=7d&stage=merged');
    await expect(within(merged).getAllByText('Example App')).toHaveLength(4);
    await expect(
      within(column(canvasElement, 'Ready')).getByText('Needs spec'),
    ).toBeVisible();
    await expect(
      within(column(canvasElement, 'In review')).getByText('round 2'),
    ).toBeVisible();
    await expect(canvas.queryByText('Old charts')).toBeNull();
    await expectNoOldContent(canvasElement);
    await expect(
      within(merged).getByText('serenity 70 · below threshold'),
    ).toBeVisible();
    await expect(within(merged).getByText('by a person')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Roles' })).toHaveAttribute(
      'href',
      '/roles?period=7d',
    );
    await expect(
      canvas.getByRole('group', { name: 'Tokens by role' }),
    ).toBeVisible();
    await expect(canvas.getByText('Tokens per day')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }));
    await canvas.findByText('Tokens per hour');
    await expect(address(canvasElement)).toHaveTextContent('/?period=today');
  },
};

export const MergedAfterAPerson: Story = {
  name: 'Merged after a person',
  args: { loadFeatures: featuresLoaderOf(afterPersonFeatures) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () =>
      expect(await title(canvasElement)).toHaveTextContent(
        /^7 issues merged for /,
      ),
    );
    await expect(
      canvas.getByText(
        '3.1M tokens per merged issue · 5 of 7 merged without a person · 14 sessions',
      ),
    ).toBeVisible();
    const merged = column(canvasElement, 'Merged');
    const card = within(merged)
      .getByRole('link', { name: '#30 Search filters' })
      .closest('article');
    if (card === null) throw new Error('No card for #30');
    await expect(within(card).getByText('serenity 88')).toBeVisible();
    await expect(within(card).getByText('after a person')).toBeVisible();
    await expect(within(merged).getByText('by a person')).toBeVisible();
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
      canvas.getByRole('link', { name: '#61 Bulk import' }),
    ).toHaveAttribute(
      'href',
      `/features/61?project=${encodeURIComponent(APP)}&period=7d`,
    );
    await expect(canvas.getByRole('link', { name: 'Roles' })).toHaveAttribute(
      'href',
      `/roles?period=7d&project=${encodeURIComponent(APP)}`,
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await expect(address(canvasElement)).toHaveTextContent(
      `/?period=30d&project=${encodeURIComponent(APP)}`,
    );
  },
};

export const NoMergedIssue: Story = {
  args: { loadFeatures: featuresLoaderOf(unmergedFeatures) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () =>
      expect(await title(canvasElement)).toHaveTextContent(
        /^No issue merged · 12\.5MCost.* tokens$/,
      ),
    );
    await expect(canvas.getByText('14 sessions')).toBeVisible();
    await expect(
      within(column(canvasElement, 'Merged')).getByText('No issue'),
    ).toBeVisible();
  },
};

export const NoActivity: Story = {
  args: {
    loadOverview: fixedLoader(() => okResponse(emptyOverview)),
    loadFeatures: featuresLoaderOf([]),
    loadRoles: rolesLoader([]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No activity in this period.');
    await expect(await title(canvasElement)).toHaveTextContent(
      /^No issue merged · 0Cost.* tokens$/,
    );
    await expect(canvas.queryByRole('region', { name: 'Board' })).toBeNull();
    await expect(canvas.queryByText('Where the tokens went')).toBeNull();
  },
};

export const Loading: Story = {
  args: {
    loadOverview: () => new Promise(() => undefined),
    loadFeatures: () => new Promise(() => undefined),
    loadRoles: () => new Promise(() => undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Loading…')).toHaveLength(3);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Overview' }),
    ).toBeVisible();
  },
};

export const FeaturesLoading: Story = {
  args: { loadFeatures: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Tokens per day');
    const board = canvas.getByRole('region', { name: 'Board' });
    await expect(within(board).getByText('Loading…')).toBeVisible();
    await expect(
      canvas.getByRole('group', { name: 'Tokens by role' }),
    ).toBeVisible();
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadOverview: fixedLoader(() => unreachableResponse),
    loadFeatures: () => Promise.resolve(UNREACHABLE),
    loadRoles: () => Promise.resolve(UNREACHABLE),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(
        canvas.getAllByText('Database unreachable. Start it with pnpm db:up.'),
      ).toHaveLength(3),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'All time' }));
    await expect(address(canvasElement)).toHaveTextContent('/?period=all');
  },
};

export const OverviewUnreachable: Story = {
  args: { loadOverview: fixedLoader(() => unreachableResponse) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: '#61 Bulk import' });
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Overview' }),
    ).toBeVisible();
    await expect(
      canvas.getAllByText('Database unreachable. Start it with pnpm db:up.'),
    ).toHaveLength(2);
    await expect(canvas.queryByText('Tokens per day')).toBeNull();
  },
};

export const FeaturesUnreachable: Story = {
  args: { loadFeatures: () => Promise.resolve(UNREACHABLE) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Tokens per day');
    const board = canvas.getByRole('region', { name: 'Board' });
    await expect(
      within(board).getByText(
        'Database unreachable. Start it with pnpm db:up.',
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole('group', { name: 'Tokens by role' }),
    ).toBeVisible();
  },
};

export const RolesUnreachable: Story = {
  args: { loadRoles: () => Promise.resolve(UNREACHABLE) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () =>
      expect(await title(canvasElement)).toHaveTextContent(
        /^7 issues merged for 12\.5MCost.* tokens$/,
      ),
    );
    await canvas.findByRole('link', { name: '#61 Bulk import' });
    await expect(
      canvas.getAllByText('Database unreachable. Start it with pnpm db:up.'),
    ).toHaveLength(1);
    await expect(canvas.queryByText('Tokens per day')).toBeNull();
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
