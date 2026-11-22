import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import {
  DataTable,
  GroupHeaderRow,
  NUMERIC_CELL,
  TotalRow,
} from './DataTable.tsx';
import type { StageGroup } from './StageDot.tsx';
import { surfaceFrame } from './story-frame.ts';

interface Row {
  feature: string;
  stage: StageGroup;
  sessions: number;
  tokens: string;
}

const ROWS: Row[] = [
  { feature: '041 · Import', stage: 'working', sessions: 3, tokens: '8.2M' },
  { feature: '042 · Export', stage: 'working', sessions: 2, tokens: '5.1M' },
  { feature: '043 · Search', stage: 'merged', sessions: 6, tokens: '19.4M' },
];

function Head(): React.ReactElement {
  return (
    <thead>
      <tr>
        <th scope="col">Feature</th>
        <th scope="col" className={NUMERIC_CELL}>
          Sessions
        </th>
        <th scope="col" className={NUMERIC_CELL}>
          Tokens
        </th>
      </tr>
    </thead>
  );
}

function BodyRow({ row }: { row: Row }): React.ReactElement {
  return (
    <tr>
      <td>{row.feature}</td>
      <td className={NUMERIC_CELL}>{row.sessions}</td>
      <td className={NUMERIC_CELL}>{row.tokens}</td>
    </tr>
  );
}

const plain = (
  <table>
    <Head />
    <tbody>
      {ROWS.map((row) => (
        <BodyRow key={row.feature} row={row} />
      ))}
    </tbody>
  </table>
);

const grouped = (
  <table>
    <Head />
    {(['working', 'merged'] as const).map((stage) => {
      const rows = ROWS.filter((row) => row.stage === stage);
      return (
        <tbody key={stage}>
          <GroupHeaderRow
            name={stage === 'working' ? 'Working' : 'Merged'}
            count={rows.length}
            colSpan={3}
            stage={stage}
          />
          {rows.map((row) => (
            <BodyRow key={row.feature} row={row} />
          ))}
        </tbody>
      );
    })}
    <tfoot>
      <TotalRow>
        <th scope="row">Total</th>
        <td className={NUMERIC_CELL}>11</td>
        <td className={NUMERIC_CELL}>32.7M</td>
      </TotalRow>
    </tfoot>
  </table>
);

const meta = {
  component: DataTable,
  args: { label: 'Features', children: plain },
  decorators: [surfaceFrame],
} satisfies Meta<typeof DataTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Plain: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole('region', { name: 'Features' });
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(within(region).getAllByRole('row')).toHaveLength(4);
  },
};

export const GroupedWithTotal: Story = {
  args: { children: grouped },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const groups = canvas
      .getAllByRole('columnheader')
      .filter((cell) => cell.getAttribute('scope') === 'colgroup');
    await expect(groups.map((cell) => cell.textContent)).toEqual([
      'Working2',
      'Merged1',
    ]);
    await expect(
      canvas.getByRole('rowheader', { name: 'Total' }).closest('tr'),
    ).toHaveClass('fd-table-total');
  },
};

export const ScrollingNarrow: Story = {
  args: {
    children: (
      <table style={{ minWidth: 640 }}>
        <Head />
        <tbody>
          {ROWS.map((row) => (
            <BodyRow key={row.feature} row={row} />
          ))}
        </tbody>
      </table>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};
