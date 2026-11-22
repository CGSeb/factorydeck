import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
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

const TOTAL = ROWS.reduce((sum, row) => sum + totalTokens(row.counts), 0);

const meta = {
  title: 'Components/BarCell',
  component: BarCell,
  decorators: [surfaceFrame],
  args: {
    label: 'build-feature',
    counts: countsOf(0),
    costUsd: 0,
    total: TOTAL,
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
                label={row.skill}
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
    await expect(widths).toEqual([
      `${String((8 / 13) * 100)}%`,
      `${String((4 / 13) * 100)}%`,
      `${String((1 / 13) * 100)}%`,
      undefined,
    ]);
    await expect(
      cells.map((cell) => cell.querySelector('[data-share]')?.textContent),
    ).toEqual(['62%', '31%', '8%', '0%']);
    const [first] = cells;
    const track = first?.querySelector<HTMLElement>('[data-bar-track]');
    await expect(track).toHaveStyle({ height: '10px' });
    await expect(track?.style.background).toBe('var(--fd-line)');
    await expect(cells.map((cell) => cell.textContent)).toEqual([
      expect.stringMatching(/^62%8\.0M/),
      expect.stringMatching(/^31%4\.0M/),
      expect.stringMatching(/^8%1\.0M/),
      expect.stringMatching(/^0%0/),
    ]);
  },
};

export const HoveredBar: Story = {
  name: 'Hovered bar',
  args: { counts: countsOf(8_000_000), costUsd: 20 },
  play: async ({ canvasElement }) => {
    const hit = canvasElement.querySelector<HTMLElement>('[data-bar-hit]');
    if (hit === null) throw new Error('No bar');
    await userEvent.hover(hit);
    const tooltip = canvasElement.querySelector('[data-tooltip]');
    await expect(tooltip).toHaveTextContent(
      /^build-feature62% of 13\.0M tokens$/,
    );
    await expect(tooltip).toHaveStyle({ position: 'fixed' });
    await userEvent.unhover(hit);
    await expect(canvasElement.querySelector('[data-tooltip]')).toBeNull();
  },
};
