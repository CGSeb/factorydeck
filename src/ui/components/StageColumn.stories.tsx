import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { countsOf } from './chart-fixtures.ts';
import { StageColumn } from './StageColumn.tsx';
import { card } from './work-fixtures.ts';

const meta = {
  title: 'Components/StageColumn',
  component: StageColumn,
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 320,
          padding: 'var(--fd-space-4)',
          background: 'var(--fd-page)',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    group: 'in-review',
    count: 3,
    counts: countsOf(6_400_000),
    costUsd: 16.2,
    cards: [
      card(42, 'Export the session table as CSV', {
        badge: { kind: 'rounds', rounds: 2, inReview: true },
      }),
      card(45, 'Filter sessions by model', {
        badge: { kind: 'serenity', report: { score: 91, threshold: 80 } },
      }),
      card(51, 'Show the cache hit rate', {
        badge: { kind: 'text', text: 'by a person' },
      }),
    ],
    more: { count: 0, href: '/issues?stage=in-review' },
  },
} satisfies Meta<typeof StageColumn>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThreeCards: Story = {
  name: 'Three cards',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole('heading', { level: 2 });
    await expect(heading).toHaveTextContent('In review3');
    await expect(heading.querySelector('[data-group="in-review"]')).not.toBe(
      null,
    );
    await expect(
      canvas.getByRole('region', { name: 'In review 3' }),
    ).toHaveClass('fd-stage-column');
    await expect(canvas.getByText('6.4M')).toBeInTheDocument();
    await expect(canvas.getAllByRole('article')).toHaveLength(3);
    await expect(canvas.queryByText(/more$/)).not.toBeInTheDocument();
  },
};

export const NoCard: Story = {
  name: 'No card',
  args: {
    group: 'ready',
    count: 0,
    counts: countsOf(0),
    costUsd: 0,
    cards: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No issue')).toHaveClass(
      'fd-stage-column-empty',
    );
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
  },
};

export const WithMore: Story = {
  name: 'With + 4 more',
  args: { count: 7, more: { count: 4, href: '/issues?stage=in-review' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('link', { name: '+ 4 more' }),
    ).toHaveAttribute('href', '/issues?stage=in-review');
  },
};
