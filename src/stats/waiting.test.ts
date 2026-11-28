import { describe, expect, it } from 'vitest';
import type { IssueRow, RequestRow } from '../git-host/query.ts';
import type { LabelChange, SerenityReport } from '../git-host/types.ts';
import { waitingFacts, waitingRows } from './waiting.ts';

const APP = '/work/app';
const LABELS = {
  ready: 'agent:ready',
  working: 'agent:working',
  needs_spec: 'agent:needs-spec',
  review: 'agent:review',
  blocked: 'agent:blocked',
};
const STATE = { stageLabels: LABELS, autoMerge: true, bugLabel: null };
const CREATED = new Date('2026-03-01T00:00:00Z');

function issue(
  number: number,
  {
    labels = [],
    needsSpec = [],
    state = 'open',
  }: { labels?: string[]; needsSpec?: LabelChange[]; state?: string } = {},
): IssueRow {
  return {
    project: APP,
    number,
    title: `Issue ${String(number)}`,
    state,
    labels: labels.map((name) => ({ name, color: null })),
    url: `https://git.example/issues/${String(number)}`,
    createdAt: CREATED,
    closedAt: state === 'closed' ? new Date('2026-03-10T00:00:00Z') : null,
    updatedAt: CREATED,
    reopened: false,
    stateEvents: [],
    needsSpec,
  };
}

function request(
  number: number,
  reports: SerenityReport[],
  merged: string | null = null,
): RequestRow {
  return {
    project: APP,
    number: 100 + number,
    title: `Request ${String(number)}`,
    state: merged === null ? 'open' : 'merged',
    draft: false,
    headBranch: `feat/${String(number)}`,
    url: `https://git.example/pull/${String(100 + number)}`,
    createdAt: CREATED,
    mergedAt: merged === null ? null : new Date(merged),
    closedAt: null,
    updatedAt: CREATED,
    closes: [number],
    checks: 'passing',
    report: reports.at(-1) ?? null,
    reports,
  };
}

function report(
  at: string,
  score: number,
  gatesPassed = true,
  threshold = 80,
): SerenityReport {
  return { score, threshold, rounds: 1, gatesPassed, at };
}

const ADDED: LabelChange = { added: true, at: '2026-03-05T10:00:00Z' };

describe('waitingFacts', () => {
  it('lists an open needs-spec episode as a spec question from its start', () => {
    const facts = waitingFacts(
      issue(1, { labels: ['agent:needs-spec'], needsSpec: [ADDED] }),
      [],
      STATE,
    );
    expect(facts?.reasons).toEqual(['spec-question']);
    expect(facts?.since).toBe(Date.parse(ADDED.at));
  });

  it('lists an issue at stage needs-spec with no stored episode, with no wait', () => {
    const facts = waitingFacts(
      issue(2, { labels: ['agent:needs-spec'] }),
      [],
      STATE,
    );
    expect(facts?.reasons).toEqual(['spec-question']);
    expect(facts?.since).toBeNull();
  });

  it('lists a blocked issue with no open stop, with no wait', () => {
    const facts = waitingFacts(
      issue(3, { labels: ['agent:blocked'] }),
      [],
      STATE,
    );
    expect(facts).toMatchObject({ reasons: ['blocked'], since: null });
  });

  it('names a refusing report below threshold when gates also failed', () => {
    const facts = waitingFacts(
      issue(4, { labels: ['agent:review'] }),
      [request(4, [report('2026-03-06T08:00:00Z', 60, false)])],
      STATE,
    );
    expect(facts).toMatchObject({
      reasons: ['below-threshold'],
      since: Date.parse('2026-03-06T08:00:00Z'),
      score: 60,
    });
  });

  it('gives the score of the open report below its threshold, not of an earlier one', () => {
    const facts = waitingFacts(
      issue(11, { labels: ['agent:review'] }),
      [
        request(11, [
          report('2026-03-05T08:00:00Z', 30),
          report('2026-03-06T08:00:00Z', 48),
        ]),
      ],
      STATE,
    );
    expect(facts).toMatchObject({ reasons: ['below-threshold'], score: 48 });
  });

  it('treats a score equal to the threshold as passing, with no score', () => {
    const facts = waitingFacts(
      issue(12, { labels: ['agent:review'] }),
      [request(12, [report('2026-03-06T08:00:00Z', 80, false)])],
      STATE,
    );
    expect(facts?.reasons).toEqual(['gates-failed']);
    expect(facts).not.toHaveProperty('score');
  });

  it('names a refusing report with only failed gates', () => {
    const facts = waitingFacts(
      issue(5, { labels: ['agent:review'] }),
      [request(5, [report('2026-03-06T08:00:00Z', 90, false)])],
      STATE,
    );
    expect(facts?.reasons).toEqual(['gates-failed']);
    expect(facts).not.toHaveProperty('score');
  });

  it('skips a refusing report answered by a later report', () => {
    const facts = waitingFacts(
      issue(6, { labels: ['agent:review'] }),
      [
        request(6, [
          report('2026-03-06T08:00:00Z', 60),
          report('2026-03-07T08:00:00Z', 90),
        ]),
      ],
      STATE,
    );
    expect(facts).toBeNull();
  });

  it('does not count a report refused only because auto-merge is off', () => {
    const facts = waitingFacts(
      issue(7, { labels: ['agent:review'] }),
      [request(7, [report('2026-03-06T08:00:00Z', 90)])],
      { ...STATE, autoMerge: false },
    );
    expect(facts).toBeNull();
  });

  it('shows every reason and waits from the oldest open stop', () => {
    const facts = waitingFacts(
      issue(8, {
        labels: ['agent:blocked', 'agent:needs-spec'],
        needsSpec: [{ added: true, at: '2026-03-07T00:00:00Z' }],
      }),
      [request(8, [report('2026-03-06T00:00:00Z', 70)])],
      STATE,
    );
    expect(facts?.reasons).toContain('blocked');
    expect(facts?.reasons).toContain('spec-question');
    expect(facts?.reasons).toContain('below-threshold');
    expect(facts?.score).toBe(70);
    expect(facts?.since).toBe(Date.parse('2026-03-06T00:00:00Z'));
  });

  it('never lists a closed or merged issue', () => {
    expect(
      waitingFacts(
        issue(9, { state: 'closed', needsSpec: [ADDED] }),
        [],
        STATE,
      ),
    ).toBeNull();
    expect(
      waitingFacts(
        issue(10, { state: 'closed' }),
        [
          request(
            10,
            [report('2026-03-06T00:00:00Z', 60)],
            '2026-03-05T00:00:00Z',
          ),
        ],
        STATE,
      ),
    ).toBeNull();
  });

  it('skips an open issue with no stop and no waiting stage', () => {
    expect(
      waitingFacts(issue(11, { labels: ['agent:working'] }), [], STATE),
    ).toBeNull();
  });
});

describe('waitingRows', () => {
  it('sorts by longest wait, then no wait, then highest issue number', () => {
    const fact = (number: number, since: number | null) => ({
      project: APP,
      number,
      title: `Issue ${String(number)}`,
      kind: 'feature' as const,
      reasons: ['blocked' as const],
      since,
    });
    const rows = waitingRows(
      [fact(1, null), fact(2, 3000), null, fact(3, 1000), fact(4, null)],
      () => 'app',
    );
    expect(rows.map((row) => row.number)).toEqual([3, 2, 4, 1]);
    expect(rows[0]).toMatchObject({
      projectName: 'app',
      since: new Date(1000).toISOString(),
    });
    expect(rows[2]?.since).toBeNull();
  });

  it('keeps the score of a below-threshold issue only', () => {
    const rows = waitingRows(
      [
        {
          project: APP,
          number: 1,
          title: 'Issue 1',
          kind: 'feature',
          reasons: ['below-threshold'],
          since: 1000,
          score: 48,
        },
        {
          project: APP,
          number: 2,
          title: 'Issue 2',
          kind: 'feature',
          reasons: ['gates-failed'],
          since: 2000,
        },
      ],
      () => 'app',
    );
    expect(rows[0]?.score).toBe(48);
    expect(rows[1]).not.toHaveProperty('score');
  });
});
