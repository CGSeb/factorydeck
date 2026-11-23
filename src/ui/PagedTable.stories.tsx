import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { surfaceFrame } from './components/story-frame.ts';
import { columnTexts } from './frictions-story.ts';
import { PagedTable } from './PagedTable.tsx';

interface Item {
  name: string;
  count: number;
}

function items(count: number): Item[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `item-${String(index + 1)}`,
    count: count - index,
  }));
}

function ItemTable({
  rows,
  empty,
}: {
  rows: Item[];
  empty?: string;
}): React.ReactElement {
  return (
    <PagedTable
      title="Items"
      rows={rows}
      className="fd-friction-table"
      {...(empty === undefined ? {} : { empty })}
      head={
        <>
          <th scope="col">Name</th>
          <th scope="col">Count</th>
        </>
      }
      renderRow={(row) => (
        <tr key={row.name}>
          <th scope="row">{row.name}</th>
          <td>{row.count}</td>
        </tr>
      )}
    />
  );
}

const meta = {
  title: 'Frictions/PagedTable',
  component: ItemTable,
  decorators: [surfaceFrame],
  args: { rows: items(4) },
} satisfies Meta<typeof ItemTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FewRows: Story = {
  name: 'Ten rows or fewer',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      columnTexts(canvas.getByRole('table', { name: 'Items' }), 0),
    ).toHaveLength(4);
    await expect(
      canvas.queryByRole('button', { name: 'Show more' }),
    ).toBeNull();
  },
};

export const MoreRows: Story = {
  name: 'More than ten rows',
  args: { rows: items(13) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole('table', { name: 'Items' });
    await expect(columnTexts(table, 0)).toHaveLength(10);
    await expect(canvas.getByText('10 of 13')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show more' }));
    await expect(columnTexts(table, 0)).toHaveLength(13);
  },
};

export const EmptyText: Story = {
  name: 'No row, with a text',
  args: { rows: [], empty: 'Nothing to list.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Nothing to list.')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvas.getByRole('heading', { name: 'Items' })).toBeVisible();
  },
};
