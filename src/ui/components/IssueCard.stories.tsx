import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { IssueCard } from './IssueCard.tsx';
import { surfaceFrame } from './story-frame.ts';
import { card } from './work-fixtures.ts';

const meta = {
  title: 'Components/IssueCard',
  component: IssueCard,
  decorators: [
    surfaceFrame,
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    ...card(42, 'Export the session table as CSV'),
    showProject: true,
    badge: { kind: 'stage', stage: 'in-review' },
  },
} satisfies Meta<typeof IssueCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithProject: Story = {
  name: 'With project',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const article = canvasElement.querySelector('article');
    await expect(article).toHaveClass('fd-issue-card');
    await expect(canvas.getByText('demo-app')).toBeInTheDocument();
    const link = canvas.getByRole('link');
    await expect(link).toHaveAccessibleName(
      '#42 Export the session table as CSV',
    );
    await expect(link).toHaveAttribute('href', '/issues/demo-app/42');
    await expect(link.querySelector('.fd-issue-card-number')).toHaveTextContent(
      '#42',
    );
    await expect(article?.closest('a')).toBeNull();
    const time = canvas.getByText('Today, 14:05');
    await expect(time.tagName).toBe('TIME');
    await expect(time).toHaveAttribute('datetime', '2026-11-24T14:05:00Z');
    await expect(link.contains(time)).toBe(false);
    await expect(canvas.queryByText(/\d\.\dM/)).not.toBeInTheDocument();
    await expect(canvas.getByText('In review')).toBeInTheDocument();
  },
};

export const WithoutProject: Story = {
  name: 'Without project',
  args: { showProject: false },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByText('demo-app'),
    ).not.toBeInTheDocument();
  },
};

export const MinutesAgo: Story = {
  name: 'Minutes ago',
  args: { activity: { at: '2026-11-24T13:52:00Z', text: '13 min ago' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('13 min ago')).toBeVisible();
  },
};

export const JustNow: Story = {
  name: 'Just now',
  args: { activity: { at: '2026-11-24T14:04:30Z', text: 'just now' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('just now')).toBeVisible();
  },
};

export const EarlierDay: Story = {
  name: 'Earlier day',
  args: { activity: { at: '2026-11-22T17:33:00Z', text: '22 Nov, 17:33' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('22 Nov, 17:33'),
    ).toBeVisible();
  },
};

export const NoActivityInPeriod: Story = {
  name: 'No activity in the period',
  args: { activity: undefined },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('time')).toBeNull();
  },
};

export const StageBadgeKind: Story = {
  name: 'Stage badge',
  args: { badge: { kind: 'stage', stage: 'merged' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Merged')).toHaveAttribute(
      'data-tone',
      'success',
    );
  },
};

export const SerenityBadgeKind: Story = {
  name: 'Serenity badge',
  args: { badge: { kind: 'serenity', report: { score: 72, threshold: 80 } } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('serenity 72 · below threshold'),
    ).toHaveAttribute('data-tone', 'warning');
  },
};

export const RoundsBadgeKind: Story = {
  name: 'Rounds badge',
  args: { badge: { kind: 'rounds', rounds: 2, inReview: true } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('round 2')).toHaveAttribute(
      'data-tone',
      'warning',
    );
  },
};

export const TextBadge: Story = {
  name: 'Text badge',
  args: { badge: { kind: 'text', text: 'by a person' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('by a person'),
    ).toHaveAttribute('data-tone', 'neutral');
  },
};

export const TwoBadges: Story = {
  name: 'Two badges',
  args: {
    badge: [
      { kind: 'serenity', report: { score: 70, threshold: 80 } },
      { kind: 'text', text: 'by a person' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('serenity 70 · below threshold'),
    ).toBeVisible();
    await expect(canvas.getByText('by a person')).toBeVisible();
  },
};

export const AfterAPerson: Story = {
  name: 'After a person',
  args: {
    badge: [
      { kind: 'serenity', report: { score: 88, threshold: 80 } },
      { kind: 'text', text: 'after a person' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('serenity 88')).toBeVisible();
    await expect(canvas.getByText('after a person')).toHaveAttribute(
      'data-tone',
      'neutral',
    );
  },
};

export const TitleNotFound: Story = {
  name: 'Title not found',
  args: {
    issue: { ...card(7, '').issue, title: { status: 'not-found' } },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link')).toHaveAccessibleName(
      '#7 (not found)',
    );
  },
};

export const TitleNotCollected: Story = {
  name: 'Title not collected',
  args: {
    issue: { ...card(8, '').issue, title: { status: 'not-collected' } },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link')).toHaveTextContent(
      /^#8$/,
    );
  },
};
