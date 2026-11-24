import { categoryColor, projectColor } from '../design/palette.ts';
import { countsOf } from './chart-fixtures.ts';
import type { StageColumnCard } from './StageColumn.tsx';
import type { TimelineStep, TimelineThread } from './IssueTimeline.tsx';

export function card(
  number: number,
  title: string,
  overrides: Partial<StageColumnCard> = {},
): StageColumnCard {
  return {
    issue: {
      project: '/work/demo-app',
      projectName: 'demo-app',
      projectColor: projectColor(0),
      number,
      title: { status: 'found', title },
      href: `/issues/demo-app/${String(number)}`,
    },
    activity: { at: '2026-11-24T14:05:00Z', text: 'Today, 14:05' },
    showProject: false,
    ...overrides,
  };
}

function thread(
  id: string,
  title: string,
  date: string,
  total: number,
): TimelineThread {
  return {
    id,
    title,
    href: `/sessions/${id}`,
    date,
    counts: countsOf(total),
    costUsd: total / 400_000,
  };
}

function step({
  index,
  role,
  title,
  detail,
  threads,
}: {
  index: number;
  role: string;
  title: string;
  detail: string;
  threads: TimelineThread[];
}): TimelineStep {
  const total = threads.reduce(
    (sum, item) =>
      sum +
      item.counts.input +
      item.counts.output +
      item.counts.cacheRead +
      item.counts.cacheWrite,
    0,
  );
  return {
    id: `step-${String(index)}`,
    role,
    color: categoryColor(index),
    title,
    detail,
    counts: countsOf(total),
    costUsd: total / 400_000,
    threads,
  };
}

export const TIMELINE_STEPS: TimelineStep[] = [
  step({
    index: 0,
    role: 'spec checker',
    title: 'Spec checked',
    detail: '2 questions answered',
    threads: [thread('s1', 'Check spec 042', 'Mar 2, 09:12', 600_000)],
  }),
  step({
    index: 1,
    role: 'builder',
    title: 'Built',
    detail: 'Branch feat/042-export · 14 commits',
    threads: [
      thread('s2', 'Build issue #42', 'Mar 2, 09:40', 3_100_000),
      thread('s3', 'Fix review findings', 'Mar 2, 13:05', 900_000),
    ],
  }),
  step({
    index: 2,
    role: 'reviewer',
    title: 'Reviewed',
    detail: '2 review rounds · serenity 86',
    threads: [
      thread('s4', 'Review round 1', 'Mar 2, 11:20', 1_200_000),
      thread('s5', 'Review round 2', 'Mar 2, 14:02', 700_000),
    ],
  }),
  step({
    index: 3,
    role: 'shipper',
    title: 'Shipped',
    detail: 'Pull request #57 opened, checks passing',
    threads: [thread('s6', 'Ship feat/042-export', 'Mar 2, 14:30', 400_000)],
  }),
  step({
    index: 4,
    role: 'merger',
    title: 'Merged',
    detail: 'Squash merged into main',
    threads: [
      thread('s7', 'Merge pull request #57', 'Mar 2, 15:10', 200_000),
      thread('s8', 'Clean up worktree', 'Mar 2, 15:12', 100_000),
    ],
  }),
];
