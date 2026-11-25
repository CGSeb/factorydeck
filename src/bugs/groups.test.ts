import { describe, expect, it } from 'vitest';
import type { IssueRow } from '../git-host/query.ts';
import { type BugProject, type BugUsage, bugGroups } from './groups.ts';

const PROJECT: BugProject = {
  project: '/work/app',
  name: 'app',
  stageLabels: {
    ready: 'agent:ready',
    working: 'agent:working',
    needs_spec: 'agent:needs-spec',
    review: 'agent:review',
    blocked: 'agent:blocked',
  },
  autoMerge: true,
  bugLabel: 'Bug',
};

function issue(number: number, labels: string[]): IssueRow {
  return {
    project: PROJECT.project,
    number,
    title: `Issue ${String(number)}`,
    state: 'open',
    labels: labels.map((name) => ({ name, color: null })),
    url: `https://example.test/issues/${String(number)}`,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    closedAt: null,
    updatedAt: new Date('2026-03-01T10:00:00Z'),
    reopened: false,
    stateEvents: [],
    needsSpec: [],
  };
}

function used(lastAt: string, tokens: number): BugUsage {
  return {
    tokens,
    tokenCounts: { input: tokens, cacheWrite: 0, cacheRead: 0, output: 0 },
    costUsd: 0.5,
    lastAt,
  };
}

describe('bugGroups', () => {
  it('orders Fixing by latest activity, bugs without activity last, ties to the highest number', () => {
    const usage = new Map<number, BugUsage>([
      [1, used('2026-03-02T10:00:00Z', 100)],
      [2, used('2026-03-04T10:00:00Z', 200)],
    ]);
    const { groups } = bugGroups({
      projects: [PROJECT],
      issues: [
        issue(1, ['bug', 'agent:working']),
        issue(2, ['bug', 'agent:review']),
        issue(3, ['bug', 'agent:working']),
        issue(4, ['bug', 'agent:working']),
        issue(5, ['agent:working']),
      ],
      requests: [],
      usage: (_, number) => usage.get(number),
      startAt: '2026-03-01T00:00:00Z',
    });
    expect(groups.fixing.map((row) => [row.number, row.stage])).toEqual([
      [2, 'in-review'],
      [1, 'working'],
      [4, 'working'],
      [3, 'working'],
    ]);
    expect(groups.fixing[0]).toMatchObject({
      tokens: 200,
      costUsd: 0.5,
      lastAt: '2026-03-04T10:00:00Z',
    });
    expect(groups.fixing[3]).toMatchObject({
      tokens: 0,
      tokenCounts: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 },
      lastAt: null,
    });
  });

  it('puts the needs-spec and blocked bugs in Open', () => {
    const { groups } = bugGroups({
      projects: [PROJECT],
      issues: [
        issue(1, ['bug', 'agent:needs-spec']),
        issue(2, ['bug', 'agent:blocked']),
      ],
      requests: [],
      usage: () => undefined,
      startAt: null,
    });
    expect(groups.open.map((row) => row.stage)).toEqual([
      'blocked',
      'needs-spec',
    ]);
  });
});
