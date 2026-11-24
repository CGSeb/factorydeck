import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { boardFeatures } from './feature-board-fixtures.ts';
import { featuresLoaderOf } from './feature-fixtures.ts';
import type { LoadFeatures } from './features-api.ts';
import { FeaturesPage } from './FeaturesPage.tsx';
import { address, ready, routed, rowHeaders } from './features-story.ts';
import { bugBoardFeatures } from './overview-fixtures.ts';

const meta = {
  title: 'FeaturesPage/Kinds',
  component: FeaturesPage,
  args: { loadFeatures: featuresLoaderOf(bugBoardFeatures, true) },
  decorators: [routed('/features?period=all')],
} satisfies Meta<typeof FeaturesPage>;

export default meta;

type Story = StoryObj<typeof meta>;

const BUG_ROWS = [
  'Audit log (#63) Bug',
  'Dark mode (#57) Bug',
  'Export button (#52) Bug',
  'Session list (#48) Bug',
];

function kindGroup(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('group', { name: 'Kind' });
}

export const BugsAndFeatures: Story = {
  args: { loadFeatures: featuresLoaderOf(bugBoardFeatures, true) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await ready(canvasElement);
    const kinds = within(kindGroup(canvasElement));
    await expect(kinds.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      kinds.getByRole('button', { name: 'Features 6' }),
    ).toBeVisible();
    await expect(kinds.getByRole('button', { name: 'Bugs 8' })).toBeVisible();
    const bug = canvas.getByRole('rowheader', { name: 'Dark mode (#57) Bug' });
    await expect(within(bug).getByText('Bug')).toHaveAttribute(
      'data-tone',
      'danger',
    );
    await expect(
      canvas.getByRole('rowheader', { name: 'Bulk import (#61)' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('rowheader', { name: 'Total' }),
    ).toBeInTheDocument();
    await userEvent.click(kinds.getByRole('button', { name: 'Bugs 8' }));
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/features\?period=all&kind=bug$/,
    );
    await canvas.findByText(/^8 issues · 6 merged, 5 without a person/);
    await expect(
      canvas.queryByRole('rowheader', { name: 'Bulk import (#61)' }),
    ).toBeNull();
  },
};

export const BugsSelected: Story = {
  args: { loadFeatures: featuresLoaderOf(bugBoardFeatures, true) },
  parameters: { entry: '/features?period=all&kind=bug' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', { name: 'Dark mode (#57) Bug' });
    await expect(
      within(kindGroup(canvasElement)).getByRole('button', { name: 'Bugs 8' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      canvas.getByText(/^8 issues · 6 merged, 5 without a person/),
    ).toBeVisible();
    const stages = within(canvas.getByRole('group', { name: 'Stages' }));
    await expect(
      stages.getByRole('button', { name: /^Merged/ }),
    ).toHaveTextContent(/^Merged6/);
    await expect(
      stages.getByRole('button', { name: /^In review/ }),
    ).toHaveTextContent(/^In review0/);
    await expect(rowHeaders(canvasElement)).toEqual(
      expect.arrayContaining(BUG_ROWS),
    );
    await expect(rowHeaders(canvasElement)).toHaveLength(8);
    await expect(canvas.queryByRole('rowheader', { name: 'Total' })).toBeNull();
    await expect(
      canvas.queryByRole('rowheader', { name: 'No work item' }),
    ).toBeNull();
    await userEvent.click(stages.getByRole('button', { name: /^Working/ }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=all&kind=bug&stage=working',
    );
    await expect(rowHeaders(canvasElement)).toEqual(['Dark mode (#57) Bug']);
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=30d&kind=bug&stage=working',
    );
  },
};

export const NoBugInPeriod: Story = {
  args: { loadFeatures: featuresLoaderOf(boardFeatures, true) },
  parameters: { entry: '/features?period=all&kind=bug' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No bug in this period.');
    await expect(
      within(kindGroup(canvasElement)).getByRole('button', { name: 'Bugs 0' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvas.getByText('0 issues')).toBeVisible();
  },
};

export const WithoutBugTickets: Story = {
  args: { loadFeatures: featuresLoaderOf(boardFeatures) },
  parameters: { entry: '/features?period=all&kind=bug' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await ready(canvasElement);
    await expect(canvas.queryByRole('group', { name: 'Kind' })).toBeNull();
    await expect(canvas.getByText(/^12 issues · 3 merged/)).toBeVisible();
    await expect(
      canvas.getByRole('rowheader', { name: 'Total' }),
    ).toBeInTheDocument();
  },
};

function slowBugsLoader(): LoadFeatures {
  const load = featuresLoaderOf(bugBoardFeatures, true);
  return (filters, kind) =>
    kind === 'bug' ? new Promise(() => undefined) : load(filters, kind);
}

export const FilterWhileReloading: Story = {
  args: { loadFeatures: slowBugsLoader() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await ready(canvasElement);
    const kinds = within(kindGroup(canvasElement));
    await userEvent.click(kinds.getByRole('button', { name: 'Bugs 8' }));
    await expect(address(canvasElement)).toHaveTextContent('kind=bug');
    await expect(kinds.getByRole('button', { name: 'Bugs 8' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      kinds.getByRole('button', { name: 'Features 6' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('rowheader', { name: 'Bulk import (#61)' }),
    ).toBeVisible();
  },
};
