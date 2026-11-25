import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { OverviewKinds } from '../overview/types.ts';
import { APP, featuresLoaderOf } from './feature-fixtures.ts';
import { okResponse, weekOverview } from './fixtures.ts';
import type { LoadOverview } from './overview-api.ts';
import { bugBoardFeatures } from './overview-fixtures.ts';
import { OverviewPage } from './OverviewPage.tsx';
import {
  address,
  overviewArgs,
  overviewRouter,
  pending,
  title,
} from './overview-story.ts';

const SUMMARY = '1.2M tokens per merged issue · 14 sessions';

function loaderOf(kinds: Partial<OverviewKinds>): LoadOverview {
  return () =>
    Promise.resolve(
      okResponse({ ...weekOverview, bugTickets: true, ...kinds }),
    );
}

const meta = {
  title: 'OverviewPage/Header',
  component: OverviewPage,
  args: {
    ...overviewArgs,
    loadOverview: loaderOf({ merged: { feature: 5, bug: 2 }, openBugs: 3 }),
    loadFeatures: featuresLoaderOf(bugBoardFeatures, true),
  },
  decorators: [overviewRouter],
} satisfies Meta<typeof OverviewPage>;

export default meta;

type Story = StoryObj<typeof meta>;

async function expectTitle(
  canvasElement: HTMLElement,
  text: RegExp,
): Promise<void> {
  await waitFor(async () =>
    expect(await title(canvasElement)).toHaveTextContent(text),
  );
}

function summary(canvasElement: HTMLElement): HTMLElement {
  const found = canvasElement.querySelector('.fd-page-summary');
  if (!(found instanceof HTMLElement)) throw new Error('No summary line');
  return found;
}

export const FeaturesAndBugs: Story = {
  name: 'Features and bugs, with open bugs',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectTitle(
      canvasElement,
      /^5 features and 2 bugs merged for 12\.5MCost.* tokens$/,
    );
    await waitFor(() =>
      expect(summary(canvasElement)).toHaveTextContent(
        `${SUMMARY} · 3 open bugs`,
      ),
    );
    await expect(
      canvas.getByRole('link', { name: '3 open bugs' }),
    ).toHaveAttribute('href', '/bugs?period=7d');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Where the tokens went' }),
    );
    await expect(
      await canvas.findByRole('dialog', { name: 'Where the tokens went' }),
    ).toBeVisible();
  },
};

export const OneOfEach: Story = {
  name: 'One feature, one bug and one open bug',
  args: {
    loadOverview: loaderOf({ merged: { feature: 1, bug: 1 }, openBugs: 1 }),
  },
  parameters: { entry: `/?period=30d&project=${encodeURIComponent(APP)}` },
  play: async ({ canvasElement }) => {
    await expectTitle(canvasElement, /^1 feature and 1 bug merged for /);
    const link = await within(canvasElement).findByRole('link', {
      name: '1 open bug',
    });
    await expect(link).toHaveAttribute(
      'href',
      `/bugs?period=30d&project=${encodeURIComponent(APP)}`,
    );
  },
};

export const OnlyBugs: Story = {
  name: 'Only bugs merged',
  args: {
    loadOverview: loaderOf({ merged: { feature: 0, bug: 4 }, openBugs: 2 }),
  },
  play: async ({ canvasElement }) => {
    await expectTitle(canvasElement, /^4 bugs merged for 12\.5MCost.* tokens$/);
    await waitFor(() =>
      expect(summary(canvasElement)).toHaveTextContent(
        `${SUMMARY} · 2 open bugs`,
      ),
    );
  },
};

export const OnlyFeatures: Story = {
  name: 'Only features merged, no open bug',
  args: {
    loadOverview: loaderOf({ merged: { feature: 6, bug: 0 }, openBugs: 0 }),
  },
  play: async ({ canvasElement }) => {
    await expectTitle(
      canvasElement,
      /^6 features merged for 12\.5MCost.* tokens$/,
    );
    await waitFor(() =>
      expect(summary(canvasElement)).toHaveTextContent(
        new RegExp(`^${SUMMARY}$`),
      ),
    );
    await expect(
      within(canvasElement).queryByRole('link', { name: /open bug/ }),
    ).toBeNull();
  },
};

export const NoMerge: Story = {
  name: 'No merge, with open bugs',
  args: {
    loadOverview: loaderOf({ merged: { feature: 0, bug: 0 }, openBugs: 5 }),
  },
  play: async ({ canvasElement }) => {
    await expectTitle(canvasElement, /^No issue merged · 12\.5MCost.* tokens$/);
    await within(canvasElement).findByRole('link', { name: '5 open bugs' });
  },
};

export const WithoutBugTickets: Story = {
  name: 'Without bug tickets',
  args: {
    loadOverview: () => Promise.resolve(okResponse(weekOverview)),
    loadFeatures: overviewArgs.loadFeatures,
  },
  play: async ({ canvasElement }) => {
    await expectTitle(
      canvasElement,
      /^24 issues merged for 12\.5MCost.* tokens$/,
    );
    await waitFor(() =>
      expect(summary(canvasElement)).toHaveTextContent(
        new RegExp(`^${SUMMARY}$`),
      ),
    );
    await expect(
      within(canvasElement).queryByRole('link', { name: /open bug/ }),
    ).toBeNull();
  },
};

export const KindFilterKeepsHeader: Story = {
  name: 'Kind filter keeps the header',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectTitle(canvasElement, /^5 features and 2 bugs merged for /);
    const board = await canvas.findByRole('region', { name: 'Board' });
    const kinds = within(
      await within(board).findByRole('group', { name: 'Kind' }),
    );
    await userEvent.click(kinds.getByRole('button', { name: /^Bugs/ }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/?period=7d&kind=bug',
    );
    await expect(await title(canvasElement)).toHaveTextContent(
      /^5 features and 2 bugs merged for /,
    );
    await expect(summary(canvasElement)).toHaveTextContent(
      `${SUMMARY} · 3 open bugs`,
    );
  },
};

export const PeriodLoading: Story = {
  name: 'Period loading keeps the header',
  args: {
    loadOverview: (period, project) =>
      period === '7d'
        ? loaderOf({ merged: { feature: 5, bug: 2 }, openBugs: 3 })(
            period,
            project,
          )
        : pending(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectTitle(canvasElement, /^5 features and 2 bugs merged for /);
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await expect(address(canvasElement)).toHaveTextContent('/?period=30d');
    await expect(await title(canvasElement)).toHaveTextContent(
      /^5 features and 2 bugs merged for /,
    );
    await expect(
      canvas.getByRole('link', { name: '3 open bugs' }),
    ).toBeVisible();
  },
};
