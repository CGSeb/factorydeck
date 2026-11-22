import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { BarCell } from './BarCell.tsx';
import { countsOf } from './chart-fixtures.ts';
import { surfaceFrame } from './story-frame.ts';
import { totalTokens } from './token-amount.ts';

const ROWS = [
  { skill: 'build-feature', total: 8_000_000 },
  { skill: 'write-spec', total: 4_000_000 },
  { skill: 'check-spec', total: 1_000_000 },
  { skill: 'setup-factory', total: 0 },
].map((row) => ({ ...row, counts: countsOf(row.total) }));

const LARGEST = Math.max(...ROWS.map((row) => totalTokens(row.counts)));

const meta = {
  title: 'Components/BarCell',
  component: BarCell,
  decorators: [surfaceFrame],
  args: {
    counts: countsOf(0),
    costUsd: 0,
    largest: LARGEST,
    color: 'var(--fd-accent)',
  },
} satisfies Meta<typeof BarCell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InATable: Story = {
  name: 'In a table',
  render: (args) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <caption style={{ textAlign: 'left' }}>Tokens by skill</caption>
      <thead>
        <tr>
          <th scope="col" style={{ textAlign: 'left' }}>
            Skill
          </th>
          <th scope="col" style={{ textAlign: 'right', width: '60%' }}>
            Tokens
          </th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.skill}>
            <th scope="row" style={{ textAlign: 'left', fontWeight: 400 }}>
              {row.skill}
            </th>
            <td>
              <BarCell
                {...args}
                counts={row.counts}
                costUsd={row.total / 400_000}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
  play: async ({ canvasElement }) => {
    const cells = within(canvasElement)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getByRole('cell'));
    const widths = cells.map(
      (cell) => cell.querySelector<HTMLElement>('[data-bar]')?.style.width,
    );
    await expect(widths).toEqual(['100%', '50%', '12.5%', undefined]);
    const [first] = cells;
    const track = first?.querySelector<HTMLElement>('[data-bar-track]');
    await expect(track).toHaveStyle({ height: '10px' });
    await expect(track?.style.background).toBe('var(--fd-line)');
    await expect(cells.map((cell) => cell.textContent)).toEqual([
      expect.stringMatching(/^8\.0M/),
      expect.stringMatching(/^4\.0M/),
      expect.stringMatching(/^1\.0M/),
      expect.stringMatching(/^0/),
    ]);
  },
};
