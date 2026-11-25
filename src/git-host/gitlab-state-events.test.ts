import { describe, expect, it } from 'vitest';
import { gitlabReader } from './gitlab.ts';
import type { IssueRecord } from './types.ts';

const ISSUE = {
  iid: 3,
  title: 'Refunds fail',
  state: 'opened',
  labels: [],
  web_url: 'https://gitlab.example/example-group/example-api/-/issues/3',
  created_at: '2026-03-01T10:00:00Z',
  closed_at: null,
  updated_at: '2026-03-02T10:00:00Z',
};

function stateEvent(state: string, minute: number): Record<string, unknown> {
  return {
    state,
    created_at: new Date(Date.UTC(2026, 2, 1, 11, minute)).toISOString(),
  };
}

async function eventsOf(
  states: Record<string, unknown>[],
): Promise<{ paths: string[]; issue: IssueRecord | undefined }> {
  const paths: string[] = [];
  const reader = gitlabReader(
    async (args) => {
      const path = args[1] ?? '';
      paths.push(path);
      if (path.includes('/resource_state_events')) return states;
      if (path.includes('/resource_label_events')) return [];
      if (/\/issues\?/.test(path)) return [ISSUE];
      return [];
    },
    'example-group/example-api',
    () => '2026-03-05T10:00:00.000Z',
  );
  const changes = await reader.changes(null);
  return { paths, issue: changes.issues[0] };
}

describe('GitLab close and reopen events', () => {
  it('stores no event and no reopening for an issue never closed', async () => {
    const { issue } = await eventsOf([]);
    expect(issue).toMatchObject({ reopened: false, stateEvents: [] });
  });

  it('stores a close and a reopen with their time, oldest first', async () => {
    const { issue } = await eventsOf([
      stateEvent('reopened', 30),
      stateEvent('closed', 0),
    ]);
    expect(issue).toMatchObject({
      reopened: true,
      stateEvents: [
        { state: 'closed', at: '2026-03-01T11:00:00.000Z' },
        { state: 'reopened', at: '2026-03-01T11:30:00.000Z' },
      ],
    });
  });

  it('keeps two reopens and skips the other state events', async () => {
    const { issue } = await eventsOf([
      stateEvent('closed', 0),
      stateEvent('reopened', 10),
      stateEvent('merged', 15),
      stateEvent('closed', 20),
      stateEvent('reopened', 30),
    ]);
    expect(issue).toMatchObject({
      reopened: true,
      stateEvents: [
        { state: 'closed' },
        { state: 'reopened' },
        { state: 'closed' },
        { state: 'reopened' },
      ],
    });
  });

  it('stores a close alone without a reopening', async () => {
    const { issue } = await eventsOf([stateEvent('closed', 0)]);
    expect(issue).toMatchObject({
      reopened: false,
      stateEvents: [{ state: 'closed' }],
    });
  });

  it('reads one page of 100 state events and ignores the events after them', async () => {
    const states = Array.from({ length: 100 }, (_, index) =>
      stateEvent(index % 2 === 0 ? 'closed' : 'reopened', index),
    );
    const { paths, issue } = await eventsOf(states);
    const stateCalls = paths.filter((path) =>
      path.includes('/resource_state_events'),
    );
    expect(stateCalls).toEqual([
      'projects/example-group%2Fexample-api/issues/3/resource_state_events?per_page=100&page=1',
    ]);
    expect(issue?.stateEvents).toHaveLength(100);
  });
});
