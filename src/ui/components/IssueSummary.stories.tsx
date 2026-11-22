import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ORCHESTRATION_COLOR } from '../design/palette.ts';
import { ROLE_SEGMENTS, countsOf } from './chart-fixtures.ts';
import { IssueSummary } from './IssueSummary.tsx';

const meta = {
  title: 'Components/IssueSummary',
  component: IssueSummary,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360, fontSize: 'var(--fd-text-md)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    total: { counts: countsOf(10_000_000), costUsd: 25 },
    orchestration: { counts: countsOf(1_200_000), costUsd: 3 },
    roles: [
      ...ROLE_SEGMENTS,
      {
        label: 'Orchestration',
        value: 1_200_000,
        color: ORCHESTRATION_COLOR,
        counts: countsOf(1_200_000),
        costUsd: 3,
      },
    ],
    serenity: { score: 88, threshold: 80 },
    rounds: 2,
    pullRequest: {
      number: 57,
      url: 'https://git.example.com/demo/pull/57',
      state: 'merged',
      draft: false,
    },
    checks: 'passing',
    labels: ['spec', 'agent:review'],
    reworked: false,
  },
} satisfies Meta<typeof IssueSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MergedAboveThreshold: Story = {
  name: 'Merged above threshold',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const blocks = canvasElement.querySelectorAll<HTMLElement>('.fd-aside > *');
    await expect(blocks).toHaveLength(4);
    await expect(blocks[0]).toHaveTextContent(/^Tokens10\.0M/);
    await expect(
      within(blocks[0] ?? canvasElement).getAllByRole('tooltip', {
        hidden: true,
      })[0]?.dataset.side,
    ).toBe('below');
    await expect(
      canvasElement.querySelector('.fd-summary-orchestration'),
    ).toHaveTextContent(/^Orchestration 1\.2M.* · 12% of the tokens$/);
    await expect(
      canvas.getByRole('group', { name: 'Tokens by role' }),
    ).toBeInTheDocument();
    await expect(blocks[2]).toHaveTextContent('Serenity88Review rounds2');
    await expect(blocks[2]?.querySelector('[data-below="true"]')).toBeNull();
    const terms = [...canvasElement.querySelectorAll('dt')].map(
      (term) => term.textContent,
    );
    await expect(terms).toEqual([
      'Pull request',
      'Checks',
      'Labels',
      'Reworked',
    ]);
    await expect(canvas.getByRole('link', { name: '#57' })).toHaveAttribute(
      'href',
      'https://git.example.com/demo/pull/57',
    );
    await expect(blocks[3]).toHaveTextContent(
      'Pull request#57 MergedChecksPassingLabelsspec, agent:reviewReworkedNo',
    );
  },
};

export const MergedByPersonBelowThreshold: Story = {
  name: 'Merged by a person below threshold',
  args: {
    serenity: { score: 64, threshold: 80 },
    rounds: 3,
    reworked: true,
  },
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector('[data-below="true"]');
    await expect(figure).toHaveTextContent('64 below threshold');
    await expect(figure).toHaveClass('fd-summary-figure');
    await expect(within(canvasElement).getByText('Yes')).toBeInTheDocument();
  },
};

export const InReviewWithoutReport: Story = {
  name: 'In review without report',
  args: {
    serenity: null,
    rounds: null,
    pullRequest: {
      number: 61,
      url: 'https://git.example.com/demo/pull/61',
      state: 'open',
      draft: false,
    },
    checks: 'pending',
    reworked: null,
    labels: [],
  },
  play: async ({ canvasElement }) => {
    const figures = canvasElement.querySelectorAll('.fd-summary-figure');
    await expect(figures[0]).toHaveTextContent('—');
    await expect(figures[1]).toHaveTextContent('—');
    const terms = [...canvasElement.querySelectorAll('dt')].map(
      (term) => term.textContent,
    );
    await expect(terms).toEqual(['Pull request', 'Checks']);
    await expect(canvasElement).toHaveTextContent('#61 Open');
  },
};

export const NoOrchestrationShare: Story = {
  name: 'No orchestration share',
  args: {
    orchestration: null,
    roles: ROLE_SEGMENTS,
    pullRequest: null,
    checks: null,
    labels: null,
    reworked: null,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).not.toHaveTextContent('Orchestration');
    await expect(canvasElement.querySelector('dl')).toBeNull();
    await expect(canvasElement.querySelectorAll('.fd-aside > *')).toHaveLength(
      3,
    );
  },
};

export const WithScorePath: Story = {
  name: 'With a score path',
  args: { serenity: { score: 88, threshold: 80, firstScore: 64 } },
  play: async ({ canvasElement }) => {
    const from = within(canvasElement).getByText('from 64');
    await expect(from).toHaveClass('fd-summary-from');
    await expect(from.closest('.fd-summary-figure')).toHaveTextContent(
      '88 from 64',
    );
  },
};
