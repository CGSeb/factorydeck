import { describe, expect, it } from 'vitest';
import type { FeatureDetail, FeatureThread } from '../features/types.ts';
import type { ClosingRequest } from '../git-host/types.ts';
import {
  ORCHESTRATION_DETAIL,
  dateRange,
  formatDay,
  issueActivity,
  issuePullRequest,
  issueSteps,
  issueTotal,
  threadTitle,
} from './issue-page.ts';

const COUNTS = { input: 10, cacheWrite: 20, cacheRead: 30, output: 40 };

function local(day: number, hour = 10): string {
  return new Date(2026, 10, day, hour).toISOString();
}

function thread(
  role: string,
  day: number,
  overrides: Partial<FeatureThread> = {},
): FeatureThread {
  return {
    sessionId: `session-${role}-${String(day)}`,
    sessionTitle: `Session of ${role}`,
    threadId: `agent-${role}-${String(day)}`,
    role,
    description: `${role} on day ${String(day)}`,
    firstAt: local(day),
    lastAt: local(day, 11),
    tokens: 100,
    tokenCounts: COUNTS,
    costUsd: 1,
    ...overrides,
  };
}

function feature(
  threads: FeatureThread[],
  orchestration: FeatureDetail['orchestration'] = null,
): FeatureDetail {
  return {
    project: '/home/dev/example-app',
    projectName: 'example-app',
    number: 7,
    issue: { status: 'found', title: 'Example', url: 'https://example.test/7' },
    detail: null,
    roles: [],
    orchestration,
    sessions: [],
    threads,
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

describe('formatDay and dateRange', () => {
  it('writes a day and its short month', () => {
    expect(formatDay(local(18))).toBe('18 Nov');
    expect(formatDay(new Date(2026, 0, 3).toISOString())).toBe('3 Jan');
  });

  it('writes one date when both ends fall on the same day', () => {
    expect(dateRange(local(18, 9), local(18, 22))).toBe('18 Nov');
  });

  it('writes a range across days', () => {
    expect(dateRange(local(18), local(21))).toBe('18 Nov → 21 Nov');
  });

  it('writes the known end when the other is missing', () => {
    expect(dateRange(local(18), null)).toBe('18 Nov');
    expect(dateRange(null, null)).toBe('—');
  });
});

describe('issueSteps', () => {
  it('groups consecutive threads of one role only', () => {
    const steps = issueSteps(
      feature([
        thread('builder', 18),
        thread('reviewer', 19),
        thread('reviewer', 20),
        thread('builder', 21),
      ]),
    );
    expect(steps.map((step) => step.title)).toEqual([
      'builder',
      'reviewer ×2',
      'builder',
    ]);
    expect(steps.map((step) => step.detail)).toEqual([
      'builder · 1 thread · 18 Nov',
      'reviewer · 2 threads · 19 Nov → 20 Nov',
      'builder · 1 thread · 21 Nov',
    ]);
    expect(steps[1]?.counts).toEqual({
      input: 20,
      cacheWrite: 40,
      cacheRead: 60,
      output: 80,
    });
    expect(steps[1]?.costUsd).toBe(2);
    expect(steps[1]?.threads.map((row) => row.title)).toEqual([
      'reviewer on day 19',
      'reviewer on day 20',
    ]);
  });

  it('makes one step of a single thread, linked to its session', () => {
    const steps = issueSteps(feature([thread('builder', 18)]));
    expect(steps).toHaveLength(1);
    expect(steps[0]?.threads).toEqual([
      {
        id: 'session-builder-18:agent-builder-18',
        title: 'builder on day 18',
        href: '/sessions/session-builder-18?project=%2Fhome%2Fdev%2Fexample-app',
        date: '18 Nov',
        counts: COUNTS,
        costUsd: 1,
      },
    ]);
  });

  it('adds the orchestration share as a last step without threads', () => {
    const steps = issueSteps(feature([thread('builder', 18)], orchestration));
    expect(steps.at(-1)).toMatchObject({
      title: 'Orchestration',
      detail: ORCHESTRATION_DETAIL,
      counts: COUNTS,
      costUsd: 0.5,
      threads: [],
    });
  });

  it('makes the orchestration step alone when no thread ran', () => {
    const steps = issueSteps(feature([], orchestration));
    expect(steps.map((step) => step.title)).toEqual(['Orchestration']);
  });

  it('makes no step with no thread and no orchestration', () => {
    expect(issueSteps(feature([]))).toEqual([]);
  });

  it('keeps a cost unknown only when every thread has no price', () => {
    const steps = issueSteps(
      feature([
        thread('builder', 18, { costUsd: null }),
        thread('builder', 19, { costUsd: null }),
      ]),
    );
    expect(steps[0]?.costUsd).toBeNull();
  });
});

describe('threadTitle', () => {
  it('uses the session title for a main thread', () => {
    expect(threadTitle(thread('builder', 18, { description: null }))).toBe(
      'Session of builder',
    );
  });

  it('uses the session title for a blank description', () => {
    expect(threadTitle(thread('builder', 18, { description: '   ' }))).toBe(
      'Session of builder',
    );
  });

  it('falls back to the short session id without a title', () => {
    expect(
      threadTitle(
        thread('builder', 18, {
          description: null,
          sessionTitle: '',
          sessionId: '7f3a9c21-0000-4000-8000-000000000001',
        }),
      ),
    ).toBe('7f3a9c21');
  });
});

describe('issueActivity', () => {
  it('writes the date range of the threads and the session count', () => {
    const detail = feature([thread('builder', 18), thread('reviewer', 21)]);
    detail.sessions = [
      {
        id: 'a',
        title: 'A',
        state: 'inactive',
        lastAt: null,
        tokens: 0,
        tokenCounts: COUNTS,
        costUsd: null,
      },
    ];
    expect(issueActivity(detail)).toBe('18 Nov → 21 Nov · 1 session');
  });

  it('writes only the session count without threads', () => {
    expect(issueActivity(feature([]))).toBe('0 sessions');
  });
});

describe('issueTotal', () => {
  it('adds the roles and the orchestration share', () => {
    const detail = feature([], orchestration);
    detail.roles = [
      { ...orchestration, role: 'builder', costUsd: null },
      { ...orchestration, role: 'reviewer', costUsd: 2 },
    ];
    expect(issueTotal(detail)).toEqual({
      counts: { input: 30, cacheWrite: 60, cacheRead: 90, output: 120 },
      costUsd: 2.5,
    });
  });
});

describe('issuePullRequest', () => {
  const request = (
    number: number,
    state: ClosingRequest['state'],
    createdAt: string,
  ): ClosingRequest => ({
    number,
    title: `Request ${String(number)}`,
    url: `https://example.test/pull/${String(number)}`,
    state,
    draft: false,
    checks: 'passing',
    createdAt,
  });

  it('prefers the merged request', () => {
    const merged = request(3, 'merged', local(18));
    expect(
      issuePullRequest({
        gitHost: 'github',
        number: 7,
        title: 'Example',
        url: 'https://example.test/7',
        state: 'closed',
        labels: [],
        requests: [request(5, 'open', local(20)), merged],
        outcome: { stage: 'merged', report: null, reworked: false },
      }),
    ).toBe(merged);
  });

  it('takes the latest request otherwise, and none without detail', () => {
    const latest = request(5, 'open', local(20));
    expect(
      issuePullRequest({
        gitHost: 'github',
        number: 7,
        title: 'Example',
        url: 'https://example.test/7',
        state: 'open',
        labels: [],
        requests: [request(4, 'closed', local(18)), latest],
        outcome: { stage: 'in-review', report: null, reworked: false },
      }),
    ).toBe(latest);
    expect(issuePullRequest(null)).toBeNull();
  });
});
