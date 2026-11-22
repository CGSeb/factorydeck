import { asc } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import type { FakeGitHostData } from '../demo/fake-git-host.ts';
import { hasFactory } from '../ingest/factory.ts';
import { T0, T1, T2, addProject, calls, ghRequest } from '../test/git-host.ts';
import {
  type Row,
  closed,
  comment,
  githubData,
  merged,
  open,
  outcomeContext,
  serenity,
} from '../test/outcome.ts';
import { collect } from './collect.ts';

const ctx = outcomeContext();
const { collected, outcomeOf } = ctx;

const BEFORE = '2026-03-02T08:00:00Z';
const AFTER = '2026-03-03T10:00:00Z';

function labeled(name: string, createdAt: string, added = true): Row {
  return {
    __typename: added ? 'LabeledEvent' : 'UnlabeledEvent',
    createdAt,
    label: { name },
  };
}

function episode(name = 'agent:needs-spec'): Row[] {
  return [labeled(name, T0), labeled(name, BEFORE, false)];
}

describe('merged after a person', () => {
  it('follows the rules of a person helping', async () => {
    const root = await collected(
      githubData(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => closed(number)),
        [
          merged(
            20,
            [1],
            [comment(serenity(60), T0), comment(serenity(88), BEFORE)],
          ),
          ghRequest(21, [2], [], {
            state: 'CLOSED',
            closedAt: T0,
            comments: [comment(serenity(90, 80, 'Gates: one failed.'), T0)],
          }),
          merged(22, [2], [comment(serenity(85), BEFORE)]),
          merged(23, [3], [comment(serenity(85), BEFORE)]),
          merged(24, [4], [comment(serenity(70), BEFORE)]),
          merged(
            25,
            [5],
            [comment(serenity(82), T0), comment(serenity(91), BEFORE)],
          ),
          merged(26, [6], [comment(serenity(85), BEFORE)]),
          merged(27, [7]),
          merged(28, [8], [comment(serenity(85), BEFORE)]),
          merged(29, [9], [comment(serenity(85), BEFORE)]),
          open(30, [9], [comment(serenity(40), AFTER)], AFTER),
        ],
        {
          labelEvents: {
            '3': episode(),
            '4': episode(),
            '6': [labeled('agent:needs-spec', AFTER)],
            '7': episode(' Agent:Needs-Spec'),
            '8': episode('agent:blocked'),
          },
        },
      ),
    );
    const stages = [];
    for (const number of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      stages.push((await outcomeOf(root, number))?.stage);
    }
    expect(stages).toEqual([
      'merged-after-person',
      'merged-after-person',
      'merged-after-person',
      'merged-by-person',
      'merged',
      'merged',
      'merged-after-person',
      'merged',
      'merged',
    ]);
    expect(await outcomeOf(root, 1)).toEqual({
      stage: 'merged-after-person',
      report: { score: 88, threshold: 80, rounds: 2 },
      reworked: false,
    });
  });

  it('stores every report in time order and only the needs-spec label events', async () => {
    await collected(
      githubData(
        [closed(1)],
        [
          merged(
            20,
            [1],
            [
              comment(serenity(88), BEFORE),
              comment('Thanks, merging.', T0),
              comment(serenity(60), T0),
            ],
          ),
        ],
        {
          labelEvents: {
            '1': [
              labeled('agent:working', T0),
              labeled('agent:needs-spec', BEFORE, false),
              labeled('agent:needs-spec', T0),
            ],
          },
        },
      ),
    );
    const [request] = await ctx.db().select().from(gitHostRequest);
    expect(request?.reports).toEqual([
      {
        score: 60,
        threshold: 80,
        rounds: 2,
        gatesPassed: true,
        at: new Date(T0).toISOString(),
      },
      {
        score: 88,
        threshold: 80,
        rounds: 2,
        gatesPassed: true,
        at: new Date(BEFORE).toISOString(),
      },
    ]);
    const [issue] = await ctx.db().select().from(gitHostIssue);
    expect(issue?.needsSpec).toEqual([
      { added: true, at: new Date(T0).toISOString() },
      { added: false, at: new Date(BEFORE).toISOString() },
    ]);
  });

  it('reads every label event of an issue page by page', async () => {
    const events = Array.from({ length: 250 }, (_, index) =>
      labeled(
        'agent:needs-spec',
        new Date(Date.parse(T0) + index * 60_000).toISOString(),
        index % 2 === 0,
      ),
    );
    const root = await collected(
      githubData([closed(1)], [merged(20, [1])], {
        labelEvents: { '1': events },
      }),
    );
    const [issue] = await ctx.db().select().from(gitHostIssue);
    expect(issue?.needsSpec).toHaveLength(250);
    const queries = (await calls(root)).filter((call) =>
      call.args.includes('number=1'),
    );
    expect(queries.map((call) => call.args.at(-1))).toEqual([
      'events=100',
      'events=200',
    ]);
  });

  it('reads the history of a project collected before it was stored', async () => {
    const root = await addProject(
      ctx.db(),
      ctx.work(),
      'app',
      githubData(
        [closed(1)],
        [merged(20, [1], [comment(serenity(85), BEFORE)])],
        { labelEvents: { '1': episode() } },
      ),
    );
    await ctx
      .db()
      .insert(gitHostProject)
      .values({
        project: root,
        gitHost: 'github',
        repository: 'example-org/example-app',
        syncedFrom: new Date(T2),
        stageLabels: {
          ready: 'agent:ready',
          working: 'agent:working',
          needs_spec: 'agent:needs-spec',
          review: 'agent:review',
          blocked: 'agent:blocked',
        },
        autoMerge: true,
      });
    await collect(ctx.db(), { hasFactory, now: () => new Date(T2) });
    const [first] = await calls(root);
    expect(first?.args.join(' ')).not.toContain('updated:');
    expect(await outcomeOf(root, 1)).toMatchObject({
      stage: 'merged-after-person',
    });
    const [state] = await ctx
      .db()
      .select({ historyRead: gitHostProject.historyRead })
      .from(gitHostProject);
    expect(state?.historyRead).toBe(true);
  });
});

describe('GitLab label events', () => {
  function gitlabData(): FakeGitHostData {
    const issue = (iid: number): Row => ({
      iid,
      project_id: 7,
      title: `Issue ${String(iid)}`,
      state: 'closed',
      labels: [],
      web_url: `https://gitlab.com/example-group/example-api/-/issues/${String(iid)}`,
      created_at: T0,
      closed_at: T1,
      updated_at: T1,
    });
    const request = (iid: number): Row => ({
      iid,
      project_id: 7,
      target_project_id: 7,
      title: `Request ${String(iid)}`,
      state: 'merged',
      draft: false,
      source_branch: `feat/${String(iid)}`,
      web_url: `https://gitlab.com/example-group/example-api/-/merge_requests/${String(iid)}`,
      created_at: T0,
      merged_at: T1,
      closed_at: T1,
      updated_at: T1,
      head_pipeline: { status: 'success' },
    });
    const event = (action: string, name: string | null, at: string): Row => ({
      action,
      created_at: at,
      label: name === null ? null : { name },
    });
    return {
      host: 'gitlab',
      repository: 'example-group/example-api',
      labels: [],
      issues: [issue(1), issue(2)],
      requests: [request(10), request(11)],
      closes: {
        '10': [{ iid: 1, project_id: 7 }],
        '11': [{ iid: 2, project_id: 7 }],
      },
      notes: {
        '10': [{ body: serenity(85), system: false, created_at: BEFORE }],
        '11': [{ body: serenity(85), system: false, created_at: BEFORE }],
      },
      labelEvents: {
        '1': [
          event('add', 'agent:needs-spec', T0),
          event('remove', 'agent:needs-spec', BEFORE),
          event('add', 'backend', T0),
          event('add', null, T0),
        ],
        '2': Array.from({ length: 120 }, (_, index) =>
          event(
            index % 2 === 0 ? 'add' : 'remove',
            'backend',
            new Date(Date.parse(T0) + index * 60_000).toISOString(),
          ),
        ),
      },
    };
  }

  it('reads the needs-spec episodes from the resource label events', async () => {
    const root = await collected(gitlabData());
    expect(await outcomeOf(root, 1)).toMatchObject({
      stage: 'merged-after-person',
    });
    expect(await outcomeOf(root, 2)).toMatchObject({ stage: 'merged' });
    const issues = await ctx
      .db()
      .select()
      .from(gitHostIssue)
      .orderBy(asc(gitHostIssue.number));
    expect(issues.map((row) => row.needsSpec)).toEqual([
      [
        { added: true, at: new Date(T0).toISOString() },
        { added: false, at: new Date(BEFORE).toISOString() },
      ],
      [],
    ]);
    const paths = (await calls(root)).map((call) => call.args[1] ?? '');
    expect(
      paths.filter((path) => path.includes('/issues/2/resource_label_events?')),
    ).toHaveLength(2);
  });
});
