import { describe, expect, it } from 'vitest';
import { FACTORY_WORKFLOW } from '../demo/fake-git-host.ts';
import { featureDetail } from '../features/query.ts';
import { withIssues } from '../git-host/work-items.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { T1, T2, ghIssue, ghRequest, success } from '../test/git-host.ts';
import {
  type Row,
  comment,
  githubData,
  merged,
  open,
  outcomeContext,
  serenity,
} from '../test/outcome.ts';

const ctx = outcomeContext();

const NOW = new Date(T2);
const EARLY = '2026-03-04T08:00:00Z';
const LATER = '2026-03-04T12:00:00Z';
const LATEST = '2026-03-04T18:00:00Z';

function bug(number: number): Row {
  return ghIssue(number, T1, { labels: [{ name: 'bug', color: 'ededed' }] });
}

function fixReport(rootCause: string, reproduced: string): string {
  return `${serenity(88)}Root cause: ${rootCause}\nReproduced: ${reproduced}\n`;
}

const ISSUES: Row[] = [bug(1), bug(2), bug(3), ghIssue(4, T1)];

const REQUESTS: Row[] = [
  {
    ...merged(
      10,
      [1],
      [
        comment(fixReport('a first guess', 'no test'), EARLY),
        comment(fixReport('an empty list', 'failed on main'), LATER),
      ],
    ),
    mergedAt: LATER,
  },
  {
    ...ghRequest(11, [1], [success], {
      state: 'CLOSED',
      closedAt: LATEST,
      updatedAt: LATEST,
      comments: [
        comment(fixReport('another request', 'passed on main'), LATEST),
      ],
    }),
  },
  open(20, [2], [comment(fixReport('a race', 'did not run on main'), LATER)]),
  merged(40, [4], [comment(serenity(90), LATER)]),
];

const WITH_BUGS = `${FACTORY_WORKFLOW}bugs:\n  label: bug\n`;

const all = { period: 'all' as const, timeZone: 'UTC', now: NOW };
const context = {
  config: DEFAULT_CONFIG,
  state: { inactiveAfterMinutes: 30, now: NOW },
};

async function fixOf(root: string, number: number) {
  const detail = await featureDetail(
    ctx.db(),
    { project: root, number },
    all,
    context,
  );
  return detail?.fix;
}

describe('the fix of an issue page', () => {
  it('comes from the last report of the request that counts', async () => {
    const root = await ctx.collected(
      githubData(ISSUES, REQUESTS, { factory: WITH_BUGS }),
      NOW,
    );
    expect(await fixOf(root, 1)).toEqual({
      rootCause: 'an empty list',
      reproduced: 'failed-on-main',
      request: {
        number: 10,
        url: 'https://github.com/example-org/example-app/pull/10',
      },
    });
    expect(await fixOf(root, 2)).toMatchObject({
      rootCause: 'a race',
      reproduced: 'did-not-run-on-main',
      request: { number: 20 },
    });
  });

  it('is null for a bug with no report and for a feature', async () => {
    const root = await ctx.collected(
      githubData(ISSUES, REQUESTS, { factory: WITH_BUGS }),
      NOW,
    );
    expect(await fixOf(root, 3)).toBeNull();
    expect(await fixOf(root, 4)).toBeNull();
  });
});

describe('withIssues', () => {
  it('gives each work item its kind, and none when it is not known', async () => {
    const root = await ctx.collected(
      githubData(ISSUES, REQUESTS, { factory: WITH_BUGS }),
      NOW,
    );
    const rows = await withIssues(
      ctx.db(),
      [{ workItem: 1 }, { workItem: 4 }, { workItem: 99 }, { workItem: null }],
      () => root,
    );
    expect(rows.map((row) => row.kind)).toEqual(['bug', 'feature', null, null]);
    const other = await withIssues(
      ctx.db(),
      [{ workItem: 1 }],
      () => `${root}-other`,
    );
    expect(other[0]).toMatchObject({
      issue: { status: 'not-collected' },
      kind: null,
    });
  });
});
