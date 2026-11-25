import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
import { expect, waitFor, within } from 'storybook/test';
import type { IssueKind } from '../git-host/kind.ts';
import type { BugResponse } from '../stats/types.ts';
import { flowLoaderOf } from './flow-fixtures.ts';
import type { LoadAutonomy, LoadBugStats } from './stats-api.ts';
import {
  bugStatsLoaderOf,
  bugStatsOf,
  bugStatsResponse,
  noBugTickets,
} from './stats-bug-fixtures.ts';
import {
  autonomyOf,
  autonomyResponse,
  monthCounts,
  qualityLoaderOf,
} from './stats-fixtures.ts';
import { statsRouter } from './stats-story.ts';
import { StatsPage } from './StatsPage.tsx';

const QUICK_REFRESH = 0.2;
const WAIT = { timeout: 3000 };

const ALL_SUMMARY = '24 issues merged · 18 without a person';
const BUG_SUMMARY = '6 issues merged · 5 without a person';

function recordingAutonomy(
  record: (kind: IssueKind | null) => void,
): LoadAutonomy {
  return (_filters, kind = null) => {
    record(kind);
    return Promise.resolve(
      autonomyResponse(
        kind === 'bug'
          ? autonomyOf({
              current: { ...monthCounts, merged: 6, mergedWithoutPerson: 5 },
            })
          : autonomyOf(),
      ),
    );
  };
}

function bugAnswers(first: BugResponse, then: BugResponse): LoadBugStats {
  let calls = 0;
  return () => {
    calls += 1;
    return Promise.resolve(
      calls === 1 ? { ...first, refreshSeconds: QUICK_REFRESH } : then,
    );
  };
}

function Recorded({ bugs }: { bugs: () => LoadBugStats }): ReactElement {
  const [asked, setAsked] = useState<string[]>([]);
  const [loadAutonomy] = useState(() =>
    recordingAutonomy((kind) => {
      setAsked((before) => [...before, kind ?? 'all']);
    }),
  );
  const [loadBugStats] = useState(bugs);
  return (
    <>
      <StatsPage
        loadAutonomy={loadAutonomy}
        loadQuality={qualityLoaderOf()}
        loadFlow={flowLoaderOf()}
        loadBugStats={loadBugStats}
      />
      <output aria-label="Kinds asked">{asked.join(' ')}</output>
    </>
  );
}

function askedOf(canvasElement: HTMLElement): string[] {
  return (
    within(canvasElement).getByLabelText('Kinds asked').textContent ?? ''
  ).split(' ');
}

const meta = {
  title: 'StatsPage/Live kind',
  component: StatsPage,
  args: {
    loadAutonomy: recordingAutonomy(() => undefined),
    loadQuality: qualityLoaderOf(),
    loadFlow: flowLoaderOf(),
    loadBugStats: bugStatsLoaderOf(bugStatsOf()),
  },
  parameters: { entry: '/stats?period=30d&kind=bug' },
  decorators: [statsRouter],
} satisfies Meta<typeof StatsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function kindGroup(canvasElement: HTMLElement): HTMLElement | null {
  return within(canvasElement).queryByRole('group', { name: 'Kind' });
}

export const UnreachableThenBugTickets: Story = {
  name: 'Bug answer unreachable, then bug tickets on a refresh: the panels follow the filter',
  render: () => (
    <Recorded
      bugs={() =>
        bugAnswers(
          { status: 'unreachable', refreshSeconds: QUICK_REFRESH },
          bugStatsResponse(bugStatsOf()),
        )
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(ALL_SUMMARY)).toBeVisible();
    await expect(kindGroup(canvasElement)).toBeNull();
    await expect(askedOf(canvasElement)).toEqual(['all']);
    await expect(await canvas.findByText(BUG_SUMMARY, {}, WAIT)).toBeVisible();
    await expect(
      within(canvas.getByRole('group', { name: 'Kind' })).getByRole('button', {
        name: 'Bugs 6',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(askedOf(canvasElement).at(-1)).toBe('bug');
  },
};

export const BugLabelRemoved: Story = {
  name: 'Bug label removed while the page is open: the filter goes and the panels show every kind',
  render: () => (
    <Recorded
      bugs={() =>
        bugAnswers(
          bugStatsResponse(bugStatsOf()),
          bugStatsResponse(noBugTickets),
        )
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(BUG_SUMMARY)).toBeVisible();
    await expect(askedOf(canvasElement)).toEqual(['bug']);
    await expect(await canvas.findByText(ALL_SUMMARY, {}, WAIT)).toBeVisible();
    await waitFor(async () => {
      await expect(kindGroup(canvasElement)).toBeNull();
    }, WAIT);
    await expect(askedOf(canvasElement).at(-1)).toBe('all');
    await expect(
      canvas.queryByRole('heading', { level: 2, name: 'Bugs' }),
    ).toBeNull();
  },
};
