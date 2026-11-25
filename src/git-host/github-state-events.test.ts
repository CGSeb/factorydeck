import { describe, expect, it } from 'vitest';
import { ghIssue } from '../test/git-host.ts';
import { githubReader } from './github.ts';

function event(kind: string, at: string): Record<string, unknown> {
  return { __typename: kind, createdAt: at };
}

const CLOSED = event('ClosedEvent', '2026-03-01T10:00:00Z');
const REOPENED = event('ReopenedEvent', '2026-03-01T12:00:00Z');

function node(
  number: number,
  events: Record<string, unknown>[],
): Record<string, unknown> {
  return { number, stateEvents: { nodes: events } };
}

describe('GitHub close and reopen events', () => {
  it('pages through the timeline query from the last successful run', async () => {
    const graphql: string[][] = [];
    const queries: string[] = [];
    const pages = [
      {
        nodes: [
          node(1, []),
          node(2, [
            CLOSED,
            REOPENED,
            event('ClosedEvent', '2026-03-01T14:00:00Z'),
            event('ReopenedEvent', '2026-03-01T16:00:00Z'),
          ]),
        ],
        pageInfo: { hasNextPage: true, endCursor: 'c1' },
      },
      {
        nodes: [node(3, [CLOSED, REOPENED]), node(4, [CLOSED])],
        pageInfo: { hasNextPage: false, endCursor: 'c2' },
      },
    ];
    const reader = githubReader(async (args) => {
      if (args[0] === 'api') {
        graphql.push([...args.slice(0, 2), ...args.slice(4)]);
        queries.push(args[3] ?? '');
        return { data: { repository: { issues: pages[graphql.length - 1] } } };
      }
      return args[0] === 'issue'
        ? [
            ghIssue(1, '2026-03-02T10:00:00Z'),
            ghIssue(2, '2026-03-02T10:00:00Z'),
            ghIssue(3, '2026-03-02T10:00:00Z'),
            ghIssue(4, '2026-03-02T10:00:00Z', { state: 'CLOSED' }),
          ]
        : [];
    }, 'example-org/example-app');
    const changes = await reader.changes(new Date('2026-03-01T00:00:00.750Z'));
    expect(
      changes.issues.map((issue) => [
        issue.number,
        issue.reopened,
        issue.stateEvents.map((found) => found.state),
      ]),
    ).toEqual([
      [1, false, []],
      [2, true, ['closed', 'reopened', 'closed', 'reopened']],
      [3, true, ['closed', 'reopened']],
      [4, false, ['closed']],
    ]);
    expect(changes.issues[2]?.stateEvents).toEqual([
      { state: 'closed', at: '2026-03-01T10:00:00.000Z' },
      { state: 'reopened', at: '2026-03-01T12:00:00.000Z' },
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
        'since=2026-03-01T00:00:00+00:00',
      ],
      [
        'api',
        'graphql',
        '-f',
        'owner=example-org',
        '-f',
        'name=example-app',
        '-f',
        'since=2026-03-01T00:00:00+00:00',
        '-f',
        'after=c1',
      ],
    ]);
    for (const query of queries) {
      expect(query).toContain(
        'stateEvents: timelineItems(first: 100, itemTypes: [CLOSED_EVENT, REOPENED_EVENT])',
      );
      expect(query).not.toMatch(/stateEvents[^}]*pageInfo/);
    }
  });

  it('keeps only the first 100 close and reopen events the git host gives', async () => {
    const events = Array.from({ length: 101 }, (_, index) =>
      event(
        index % 2 === 0 ? 'ClosedEvent' : 'ReopenedEvent',
        new Date(Date.UTC(2026, 2, 1, 0, index)).toISOString(),
      ),
    );
    const reader = githubReader(async (args) => {
      if (args[0] === 'api') {
        const query = args[3] ?? '';
        const size = Number(
          /stateEvents: timelineItems\(first: (\d+)/.exec(query)?.[1],
        );
        return {
          data: {
            repository: {
              issues: {
                nodes: [node(1, events.slice(0, size))],
                pageInfo: { hasNextPage: false, endCursor: 'c1' },
              },
            },
          },
        };
      }
      return args[0] === 'issue' ? [ghIssue(1, '2026-03-02T10:00:00Z')] : [];
    }, 'example-org/example-app');
    const changes = await reader.changes(null);
    expect(changes.issues[0]?.stateEvents).toHaveLength(100);
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
