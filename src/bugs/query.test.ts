import { describe, expect, it } from 'vitest';
import { FACTORY_WORKFLOW, reopenedOnce } from '../demo/fake-git-host.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { T0, T1, T2, ghIssue } from '../test/git-host.ts';
import {
  type Row,
  comment,
  githubData,
  merged,
  open,
  outcomeContext,
  serenity,
} from '../test/outcome.ts';
import { listBugs } from './query.ts';
import type { BugList } from './types.ts';

const ctx = outcomeContext();

const NOW = new Date(T2);
const TODAY_MORNING = '2026-03-05T08:00:00Z';
const TODAY_LATER = '2026-03-05T09:00:00Z';

function bug(number: number, labels: string[], extra: Row = {}): Row {
  return ghIssue(number, T1, {
    labels: ['bug', ...labels].map((name) => ({ name, color: 'ededed' })),
    ...extra,
  });
}

function fixReport(rootCause: string, reproduced: string): string {
  return `${serenity(88)}Root cause: ${rootCause}\nReproduced: ${reproduced}\n`;
}

function mergedAt(
  number: number,
  closes: number[],
  at: string,
  body: string,
): Row {
  return {
    ...merged(number, closes, [comment(body, at)]),
    mergedAt: at,
    closedAt: at,
    updatedAt: at,
  };
}

const ISSUES: Row[] = [
  bug(1, []),
  bug(2, ['agent:ready'], { createdAt: '2026-02-20T10:00:00Z' }),
  bug(3, ['agent:working']),
  bug(4, [], { state: 'CLOSED', closedAt: TODAY_MORNING }),
  bug(5, [], { state: 'CLOSED', closedAt: T1 }),
  bug(6, [], { state: 'CLOSED', closedAt: TODAY_LATER }),
  bug(7, []),
  ghIssue(8, T1),
  bug(9, [], { createdAt: '2026-01-01T10:00:00Z' }),
];

const REQUESTS: Row[] = [
  open(30, [3], [comment(fixReport('a stale cache', 'passed on main'), T1)]),
  mergedAt(
    40,
    [4],
    TODAY_MORNING,
    fixReport('an empty list', 'failed on main'),
  ),
  mergedAt(50, [5], T1, serenity(90)),
  mergedAt(70, [7], TODAY_MORNING, fixReport('a race', 'no test')),
];

async function collectedBugs(factory: string): Promise<string> {
  return ctx.collected(
    githubData(ISSUES, REQUESTS, {
      factory,
      stateEvents: reopenedOnce([7], TODAY_MORNING, TODAY_LATER),
    }),
    NOW,
  );
}

const WITH_BUGS = `${FACTORY_WORKFLOW}bugs:\n  label: bug\n`;

function numbers(list: BugList) {
  return {
    open: list.groups.open.map((row) => row.number),
    fixing: list.groups.fixing.map((row) => row.number),
    fixed: list.groups.fixed.map((row) => row.number),
  };
}

const today = { period: 'today' as const, timeZone: 'UTC', now: NOW };

describe('listBugs', () => {
  it('puts each bug in its group by its stage and the period', async () => {
    await collectedBugs(WITH_BUGS);
    const list = await listBugs(ctx.db(), today, DEFAULT_CONFIG);
    expect(list.bugTickets).toBe(true);
    expect(numbers(list)).toEqual({
      open: [9, 2, 1, 7],
      fixing: [3],
      fixed: [6, 4],
    });
    expect(list.counts).toEqual({ open: 5, fixed: 1, closed: 1 });
  });

  it('keeps a bug merged before the period out of Fixed, and lists it for all time', async () => {
    await collectedBugs(WITH_BUGS);
    const all = await listBugs(
      ctx.db(),
      { ...today, period: 'all' },
      DEFAULT_CONFIG,
    );
    expect(numbers(all).fixed).toEqual([6, 4, 5]);
    expect(all.counts).toEqual({ open: 5, fixed: 2, closed: 1 });
  });

  it('gives each bug its stage, times, fix and score', async () => {
    const root = await collectedBugs(WITH_BUGS);
    const list = await listBugs(ctx.db(), today, DEFAULT_CONFIG);
    const rowOf = (number: number) =>
      [...list.groups.open, ...list.groups.fixing, ...list.groups.fixed].find(
        (row) => row.number === number,
      );
    expect(rowOf(4)).toMatchObject({
      project: root,
      projectName: 'app',
      title: 'Issue 4',
      url: 'https://github.com/example-org/example-app/issues/4',
      stage: 'merged',
      createdAt: new Date(T0).toISOString(),
      mergedAt: new Date(TODAY_MORNING).toISOString(),
      closedAt: null,
      fix: { rootCause: 'an empty list', reproduced: 'failed-on-main' },
      score: 88,
      threshold: 80,
      tokens: 0,
      lastAt: null,
    });
    expect(rowOf(6)).toMatchObject({
      stage: 'closed',
      mergedAt: null,
      closedAt: new Date(TODAY_LATER).toISOString(),
      fix: null,
      score: null,
    });
    expect(rowOf(3)).toMatchObject({
      stage: 'working',
      fix: { rootCause: 'a stale cache', reproduced: 'passed-on-main' },
    });
    expect(rowOf(1)).toMatchObject({ stage: 'open', fix: null });
  });

  it('shows a reopened bug as open again in its second version, without the fix of the first', async () => {
    await collectedBugs(WITH_BUGS);
    const list = await listBugs(ctx.db(), today, DEFAULT_CONFIG);
    const reopened = list.groups.open.find((row) => row.number === 7);
    expect(reopened).toMatchObject({
      stage: 'open',
      mergedAt: null,
      fix: null,
      score: null,
      threshold: null,
      version: {
        number: 2,
        count: 2,
        startedAt: new Date(TODAY_LATER).toISOString(),
      },
      tokens: 0,
    });
  });

  it('gives a fix with no value to a merged build-feature report', async () => {
    await collectedBugs(WITH_BUGS);
    const all = await listBugs(
      ctx.db(),
      { ...today, period: 'all' },
      DEFAULT_CONFIG,
    );
    expect(all.groups.fixed.find((row) => row.number === 5)?.fix).toEqual({
      rootCause: null,
      reproduced: null,
    });
  });

  it('says when no project of the selection uses bug tickets', async () => {
    await collectedBugs(FACTORY_WORKFLOW);
    const list = await listBugs(ctx.db(), today, DEFAULT_CONFIG);
    expect(list.bugTickets).toBe(false);
    expect(numbers(list)).toEqual({ open: [], fixing: [], fixed: [] });
  });

  it('keeps to the selected project', async () => {
    const root = await collectedBugs(WITH_BUGS);
    const other = await listBugs(
      ctx.db(),
      { ...today, project: `${root}-other` },
      DEFAULT_CONFIG,
    );
    expect(other.bugTickets).toBe(false);
    const own = await listBugs(
      ctx.db(),
      { ...today, project: root },
      DEFAULT_CONFIG,
    );
    expect(own.counts.open).toBe(5);
  });
});
