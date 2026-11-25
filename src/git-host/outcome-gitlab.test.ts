import { describe, expect, it } from 'vitest';
import { type FakeGitHostData, reopenedOnce } from '../demo/fake-git-host.ts';
import { T0, T1, calls } from '../test/git-host.ts';
import { type Row, outcomeContext, serenity } from '../test/outcome.ts';

const { collected, outcomeOf } = outcomeContext();

describe('GitLab', () => {
  function gitlabData(): FakeGitHostData {
    const issue = (iid: number, labels: string[], state = 'opened'): Row => ({
      iid,
      project_id: 7,
      title: `Issue ${String(iid)}`,
      state,
      labels,
      web_url: `https://gitlab.com/example-group/example-api/-/issues/${String(iid)}`,
      created_at: T0,
      closed_at: state === 'closed' ? T1 : null,
      updated_at: T1,
    });
    const request = (iid: number, state: string): Row => ({
      iid,
      project_id: 7,
      target_project_id: 7,
      title: `Request ${String(iid)}`,
      state,
      draft: false,
      source_branch: `feat/${String(iid)}`,
      web_url: `https://gitlab.com/example-group/example-api/-/merge_requests/${String(iid)}`,
      created_at: T0,
      merged_at: state === 'merged' ? T1 : null,
      closed_at: state === 'opened' ? null : T1,
      updated_at: T1,
      head_pipeline: { status: 'success' },
    });
    return {
      host: 'gitlab',
      repository: 'example-group/example-api',
      labels: [],
      issues: [
        issue(1, [], 'closed'),
        issue(2, ['agent:needs-spec']),
        issue(3, ['agent:blocked'], 'closed'),
      ],
      requests: [request(10, 'merged'), request(11, 'opened')],
      closes: {
        '10': [{ iid: 1, project_id: 7 }],
        '11': [{ iid: 2, project_id: 7 }],
      },
      notes: {
        '10': [
          {
            body: serenity(64),
            system: false,
            created_at: '2026-03-02T11:00:00Z',
          },
          {
            body: serenity(99),
            system: true,
            created_at: '2026-03-02T12:00:00Z',
          },
        ],
        '11': [
          {
            body: serenity(88, 80, 'Gates: all passed.\nReview: 1 round.'),
            created_at: T1,
          },
        ],
      },
      stateEvents: reopenedOnce([3], T1, T1),
    };
  }

  it('reads reports from notes by people or agents, and reopening from state events', async () => {
    const root = await collected(gitlabData());
    expect(await outcomeOf(root, 1)).toEqual({
      stage: 'merged-by-person',
      report: { score: 64, threshold: 80, rounds: 2 },
      reworked: false,
    });
    expect(await outcomeOf(root, 2)).toEqual({
      stage: 'needs-spec',
      report: { score: 88, threshold: 80, rounds: 1 },
      reworked: false,
    });
    expect(await outcomeOf(root, 3)).toEqual({
      stage: 'closed',
      report: null,
      reworked: true,
    });
    const paths = (await calls(root)).map((call) => call.args[1] ?? '');
    expect(paths).toContainEqual(
      expect.stringContaining('/merge_requests/10/notes?'),
    );
    expect(paths).toContainEqual(
      expect.stringContaining('/issues/3/resource_state_events?'),
    );
  });
});
