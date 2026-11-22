import { describe, expect, it } from 'vitest';
import { ghIssue } from '../test/git-host.ts';
import { githubReader } from './github.ts';

function node(number: number, reopened: number): Record<string, unknown> {
  return { number, timelineItems: { totalCount: reopened } };
}

describe('GitHub reopened issues', () => {
  it('pages through the timeline query from the last successful run', async () => {
    const graphql: string[][] = [];
    const pages = [
      {
        nodes: [node(1, 0), node(2, 2)],
        pageInfo: { hasNextPage: true, endCursor: 'c1' },
      },
      {
        nodes: [node(3, 1)],
        pageInfo: { hasNextPage: false, endCursor: 'c2' },
      },
    ];
    const reader = githubReader(async (args) => {
      if (args[0] === 'api') {
        graphql.push([...args.slice(0, 2), ...args.slice(4)]);
        return { data: { repository: { issues: pages[graphql.length - 1] } } };
      }
      return args[0] === 'issue'
        ? [
            ghIssue(1, '2026-03-02T10:00:00Z'),
            ghIssue(2, '2026-03-02T10:00:00Z'),
            ghIssue(3, '2026-03-02T10:00:00Z'),
          ]
        : [];
    }, 'example-org/example-app');
    const changes = await reader.changes(new Date('2026-03-01T00:00:00Z'));
    expect(
      changes.issues.map((issue) => [issue.number, issue.reopened]),
    ).toEqual([
      [1, false],
      [2, true],
      [3, true],
    ]);
    expect(graphql).toEqual([
      [
        'api',
        'graphql',
        '-f',
        'owner=example-org',
        '-f',
        'name=example-app',
        '-f',
        'since=2026-03-01T00:00:00.000Z',
      ],
      [
        'api',
        'graphql',
        '-f',
        'owner=example-org',
        '-f',
        'name=example-app',
        '-f',
        'since=2026-03-01T00:00:00.000Z',
        '-f',
        'after=c1',
      ],
    ]);
  });

  it('skips the query when no issue changed', async () => {
    const seen: string[] = [];
    const reader = githubReader(async (args) => {
      seen.push(args[0] ?? '');
      return [];
    }, 'example-org/example-app');
    await reader.changes(null);
    expect(seen).toEqual(['issue', 'pr']);
  });
});
