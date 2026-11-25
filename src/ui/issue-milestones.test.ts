import { describe, expect, it } from 'vitest';
import type { FeatureDetail, FeatureThread } from '../features/types.ts';
import type { IssueMilestone } from '../git-host/types.ts';
import { formatDateTime } from './format.ts';
import { githubIssue } from './git-host-fixtures.ts';
import { issueMilestones, issueSteps, milestoneText } from './issue-page.ts';

const COUNTS = { input: 10, cacheWrite: 20, cacheRead: 30, output: 40 };

function local(day: number, hour = 10): string {
  return new Date(2026, 10, day, hour).toISOString();
}

function thread(role: string, day: number): FeatureThread {
  return {
    sessionId: `session-${role}-${String(day)}`,
    sessionTitle: `Session of ${role}`,
    sessionAgent: 'claude-code',
    threadId: `agent-${role}-${String(day)}`,
    role,
    description: null,
    firstAt: local(day),
    lastAt: local(day, 11),
    tokens: 100,
    tokenCounts: COUNTS,
    costUsd: 1,
  };
}

const orchestration = {
  role: 'Orchestration',
  threads: 1,
  apiCalls: 4,
  tokens: 100,
  tokenCounts: COUNTS,
  costUsd: 0.5,
};

function feature(
  threads: FeatureThread[],
  withOrchestration = false,
): FeatureDetail {
  return {
    project: '/home/dev/example-app',
    projectName: 'example-app',
    number: 7,
    issue: { status: 'found', title: 'Example', url: 'https://example.test/7' },
    kind: 'feature',
    fix: null,
    version: null,
    detail: null,
    roles: [],
    orchestration: withOrchestration ? orchestration : null,
    sessions: [],
    threads,
    frictions: 0,
  };
}

function needsSpec(
  at: string,
  removedAt: string | null = null,
): IssueMilestone {
  return { kind: 'needs-spec', at, removedAt };
}

function withMilestones(
  threads: FeatureThread[],
  milestones: IssueMilestone[],
): FeatureDetail {
  return {
    ...feature(threads, true),
    detail: { ...githubIssue, milestones },
  };
}

describe('issueMilestones', () => {
  const threads = [
    thread('builder', 18),
    thread('builder', 19),
    thread('reviewer', 20),
  ];

  function placed(milestones: IssueMilestone[]): (string | null)[] {
    return issueMilestones(withMilestones(threads, milestones)).map(
      (milestone) => milestone.afterStep,
    );
  }

  it('puts a milestone earlier than every step before the first step', () => {
    expect(placed([needsSpec(local(17))])).toEqual([null]);
  });

  it('puts a milestone after the last step started at or before it', () => {
    expect(placed([needsSpec(local(19, 12))])).toEqual(['step-0']);
    expect(placed([needsSpec(local(20, 12))])).toEqual(['step-1']);
  });

  it('puts a milestone after the last step, before orchestration', () => {
    const feature = withMilestones(threads, [needsSpec(local(25))]);
    const steps = issueSteps(feature);
    expect(steps.at(-1)?.id).toBe('orchestration');
    expect(issueMilestones(feature).map((m) => m.afterStep)).toEqual([
      'step-1',
    ]);
  });

  it('keeps two milestones after one step in time order', () => {
    const milestones = issueMilestones(
      withMilestones(threads, [
        needsSpec(local(18, 12)),
        needsSpec(local(18, 14)),
      ]),
    );
    expect(milestones.map((m) => [m.id, m.afterStep])).toEqual([
      ['milestone-0', 'step-0'],
      ['milestone-1', 'step-0'],
    ]);
  });

  it('puts a milestone tied with a step after that step', () => {
    expect(placed([needsSpec(local(20))])).toEqual(['step-1']);
  });

  it('places nothing without issue detail', () => {
    expect(issueMilestones(feature(threads))).toEqual([]);
  });

  it('starts the timeline of a bug version from 2 with its reopening', () => {
    const version = {
      number: 2,
      count: 3,
      startedAt: local(17),
      endedAt: local(21),
      reopenedAt: local(22),
    };
    const reopened = issueMilestones({
      ...withMilestones(threads, [needsSpec(local(17, 12))]),
      kind: 'bug',
      version,
    });
    expect(reopened.map((m) => [m.id, m.afterStep, m.title])).toEqual([
      ['reopened', null, 'Reopened'],
      ['milestone-0', null, 'Needs spec'],
    ]);
    expect(reopened[0]).toMatchObject({
      tone: 'warning',
      detail: formatDateTime(local(17)),
    });
    const first = issueMilestones({
      ...feature(threads),
      kind: 'bug',
      version: { ...version, number: 1 },
    });
    expect(first).toEqual([]);
  });
});

describe('milestoneText', () => {
  const report = {
    kind: 'report' as const,
    at: local(18, 17),
    request: { number: 58, url: 'https://example.test/pull/58' },
    score: 64,
    threshold: 80,
  };

  it('tells a refused report with each of its reasons', () => {
    expect(
      milestoneText({
        ...report,
        refused: true,
        reasons: ['below-threshold', 'gates-failed', 'auto-merge-off'],
      }),
    ).toEqual({
      tone: 'warning',
      title:
        'Serenity 64/100 (threshold 80) · merge refused: below threshold, gates failed, auto-merge off',
      detail: formatDateTime(local(18, 17)),
      link: { href: 'https://example.test/pull/58', text: '#58' },
    });
  });

  it('tells an allowed report', () => {
    expect(
      milestoneText({ ...report, score: 88, refused: false, reasons: [] }),
    ).toMatchObject({
      tone: 'success',
      title: 'Serenity 88/100 (threshold 80) · merge allowed',
    });
  });

  it('tells a needs-spec episode waiting or answered', () => {
    expect(milestoneText(needsSpec(local(18)))).toEqual({
      tone: 'warning',
      title: 'Needs spec',
      detail: 'waiting for a person',
    });
    expect(milestoneText(needsSpec(local(18), local(19, 8))).detail).toBe(
      `answered ${formatDateTime(local(19, 8))}`,
    );
  });
});
