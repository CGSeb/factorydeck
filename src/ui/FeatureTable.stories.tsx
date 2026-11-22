import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, fn, userEvent, within } from 'storybook/test';
import { APP, featureList, someFeatures } from './feature-fixtures.ts';
import { DEFAULT_SORT } from './features-api.ts';
import { FeatureTable } from './FeatureTable.tsx';

const list = featureList(someFeatures);

const meta = {
  component: FeatureTable,
  args: {
    rows: list.rows,
    noWorkItem: list.noWorkItem,
    totals: list.totals,
    filters: { period: '30d', project: undefined },
    sort: DEFAULT_SORT,
    onSort: fn(),
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof FeatureTable>;

export default meta;

type Story = StoryObj<typeof meta>;

function rowHeaders(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent);
}

export const AllProjects: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(rowHeaders(canvasElement)).toEqual([
      '#52 Export button',
      '#28 Session list',
      '#28',
      '#40 Dark mode',
      '#99 (not found)',
      'No work item',
      'Total',
    ]);
    await expect(
      canvas.getByRole('columnheader', { name: 'Project' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: '#52 Export button' }),
    ).toHaveAttribute(
      'href',
      '/features/52?project=%2Fhome%2Fdev%2Fexample-app&period=30d',
    );
    await expect(canvas.getByText('Merged by a person')).toBeVisible();
    await expect(
      canvas.getByRole('columnheader', { name: 'Cost' }),
    ).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(canvas.getByRole('button', { name: 'Serenity' }));
    await expect(args.onSort).toHaveBeenCalledWith({
      key: 'score',
      order: 'asc',
    });
    const total = canvas.getByRole('rowheader', { name: 'Total' });
    await expect(total.parentElement).toHaveTextContent('8.2M~$16.25');
  },
};

export const OneProject: Story = {
  args: {
    rows: list.rows.filter((row) => row.project === APP),
    filters: { period: '30d', project: APP },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole('columnheader', { name: 'Project' }),
    ).toBeNull();
    await expect(rowHeaders(canvasElement).at(-2)).toBe('No work item');
  },
};

export const SortedByScore: Story = {
  args: { sort: { key: 'score', order: 'desc' } },
  play: async ({ canvasElement, args }) => {
    await expect(rowHeaders(canvasElement)).toEqual([
      '#52 Export button',
      '#28 Session list',
      '#28',
      '#40 Dark mode',
      '#99 (not found)',
      'No work item',
      'Total',
    ]);
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Serenity' }),
    );
    await expect(args.onSort).toHaveBeenCalledWith({
      key: 'score',
      order: 'asc',
    });
  },
};

export const SortedByCostAscending: Story = {
  args: { sort: { key: 'cost', order: 'asc' } },
  play: async ({ canvasElement }) => {
    await expect(rowHeaders(canvasElement)).toEqual([
      '#40 Dark mode',
      '#28',
      '#28 Session list',
      '#52 Export button',
      '#99 (not found)',
      'No work item',
      'Total',
    ]);
  },
};
