import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseOption } from './components/select-test.ts';
import { boardFeatures } from './feature-board-fixtures.ts';
import {
  APP,
  featureList,
  featuresLoaderOf,
  featuresResponse,
} from './feature-fixtures.ts';
import type { LoadFeatures } from './features-api.ts';
import { FEATURE_SORT_OPTIONS } from './features-list.ts';
import { FeaturesPage } from './FeaturesPage.tsx';
import { address, ready, routed, rowHeaders } from './features-story.ts';

const meta = {
  component: FeaturesPage,
  args: { loadFeatures: featuresLoaderOf(boardFeatures) },
  decorators: [routed('/features?period=all')],
} satisfies Meta<typeof FeaturesPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function groupHeaders(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('columnheader')
    .filter((cell) => cell.getAttribute('scope') === 'colgroup')
    .map((cell) => cell.textContent);
}

export const AllProjects: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await ready(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Features' }),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        '12 issues · 3 merged, 2 without a person · 4.7M tokens per merged issue',
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole('columnheader', { name: 'Project' }),
    ).toBeVisible();
    await expect(groupHeaders(canvasElement)).toEqual([
      'In review2',
      'Working2',
      'Ready2',
      'Merged3',
      'Closed1',
      'Unknown2',
    ]);
    await expect(rowHeaders(canvasElement)).toEqual([
      'Bulk import (#61)',
      'Retry policy (#60)',
      'Dark mode (#57)',
      'Typed errors (#58)',
      'Audit log (#63)',
      'Rate limits (#64)',
      'Config loader (#45)',
      'Export button (#52)',
      'Session list (#48)',
      'Old charts (#44)',
      '#70 (not found)',
      '#12',
      'No work item',
      'Total',
    ]);
  },
};

export const OneProject: Story = {
  parameters: {
    entry: `/features?period=all&project=${encodeURIComponent(APP)}`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await ready(canvasElement);
    await expect(
      canvas.queryByRole('columnheader', { name: 'Project' }),
    ).toBeNull();
    await expect(canvas.queryByRole('rowheader', { name: '#12' })).toBeNull();
    await expect(
      canvas.getByText(
        '7 issues · 2 merged, 1 without a person · 5.7M tokens per merged issue',
      ),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=today&project=%2Fhome%2Fdev%2Fexample-app',
    );
  },
};

export const StageSelected: Story = {
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    const merged = within(canvasElement).getByRole('button', {
      name: /^Merged/,
      pressed: false,
    });
    await userEvent.click(merged);
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=all&stage=merged',
    );
    await expect(merged).toHaveAttribute('aria-pressed', 'true');
    await expect(groupHeaders(canvasElement)).toEqual(['Merged3']);
    await expect(rowHeaders(canvasElement)).toEqual([
      'Config loader (#45)',
      'Export button (#52)',
      'Session list (#48)',
    ]);
    await userEvent.click(merged);
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/features\?period=all$/,
    );
    await expect(rowHeaders(canvasElement).at(-1)).toBe('Total');
  },
};

export const StageFromAddress: Story = {
  parameters: {
    entry: '/features?period=all&stage=in-review&stage=merged',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await ready(canvasElement);
    await expect(
      canvas.getByRole('button', { name: /^In review/, pressed: true }),
    ).toBeVisible();
    await expect(rowHeaders(canvasElement)).toEqual([
      'Bulk import (#61)',
      'Retry policy (#60)',
    ]);
  },
};

export const EmptyStageSelected: Story = {
  args: {
    loadFeatures: featuresLoaderOf(
      boardFeatures.filter((row) => row.outcome?.stage !== 'working'),
    ),
  },
  parameters: { entry: '/features?period=all&stage=working' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No issue in this stage.');
    await expect(
      canvas.getByRole('button', { name: /^Working/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

const SESSION_LIST = 'Session list (#48)';
const EXPORT_BUTTON = 'Export button (#52)';
const CONFIG_LOADER = 'Config loader (#45)';
const BY_SIZE = [SESSION_LIST, EXPORT_BUTTON, CONFIG_LOADER];

function sorted(label: string, merged: readonly string[]): Story {
  const sort = FEATURE_SORT_OPTIONS.find((option) => option.label === label);
  return {
    parameters: {
      entry: `/features?period=all&stage=merged&sort=${sort?.value ?? ''}`,
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      await canvas.findByRole('rowheader', { name: EXPORT_BUTTON });
      const sort = canvas.getByRole('combobox', { name: 'Sort by' });
      await expect(sort).toHaveTextContent(label);
      await expect(rowHeaders(canvasElement)).toEqual(merged);
    },
  };
}

export const SortedByTokens = sorted('Tokens', BY_SIZE);

export const SortedBySessions = sorted('Sessions', BY_SIZE);

export const SortedByReviewRounds = sorted('Review rounds', BY_SIZE);

export const SortedBySerenity = sorted('Serenity', BY_SIZE);

export const SortedByIssueNumber = sorted('Issue number', [
  EXPORT_BUTTON,
  SESSION_LIST,
  CONFIG_LOADER,
]);

export const SortedByLastActivity: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await ready(canvasElement);
    const select = canvas.getByRole('combobox', { name: 'Sort by' });
    await expect(select).toHaveAttribute('data-value', 'last');
    await chooseOption(select, 'Tokens');
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=all&sort=tokens',
    );
    await expect(rowHeaders(canvasElement).slice(0, 2)).toEqual([
      'Bulk import (#61)',
      'Retry policy (#60)',
    ]);
    await expect(rowHeaders(canvasElement).slice(6, 9)).toEqual(BY_SIZE);
    await chooseOption(select, 'Last activity');
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/features\?period=all$/,
    );
  },
};

export const ClosedAndUnknown: Story = {
  args: {
    loadFeatures: featuresLoaderOf(
      boardFeatures.filter((row) => [44, 70, 12].includes(row.number)),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', { name: 'Old charts (#44)' });
    await expect(groupHeaders(canvasElement)).toEqual(['Closed1', 'Unknown2']);
    await expect(canvas.getByText('3 issues')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: /^Merged/ }),
    ).toHaveTextContent('Merged0');
  },
};

export const NoActivity: Story = {
  args: { loadFeatures: featuresLoaderOf([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No activity in this period.');
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvas.queryByRole('group', { name: 'Stages' })).toBeNull();
    await expect(canvas.getByText('0 issues')).toBeVisible();
  },
};

export const Loading: Story = {
  args: { loadFeatures: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading…')).toBeVisible();
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadFeatures: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};

function refreshingLoader(): LoadFeatures {
  let calls = 0;
  return () => {
    calls += 1;
    const [first] = boardFeatures;
    const rows =
      first === undefined ? [] : [{ ...first, sessions: calls === 1 ? 4 : 9 }];
    return Promise.resolve({
      ...featuresResponse(featureList(rows, null)),
      refreshSeconds: 0.2,
    });
  };
}

export const RefreshesWithoutReload: Story = {
  args: { loadFeatures: refreshingLoader() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByRole('cell', { name: '4' });
    await waitFor(() => canvas.getAllByRole('cell', { name: '9' }));
  },
};
