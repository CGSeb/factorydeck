import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { type FakeGitHostData } from '../demo/fake-git-host.ts';
import { hasFactory } from '../ingest/factory.ts';
import { addProject, calls, T0, T1 } from '../test/git-host.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { collect } from './collect.ts';
import { issueDetail } from './query.ts';

let db: Database;
let close: () => Promise<void>;
let work: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  work = await realpath(await mkdtemp(join(tmpdir(), 'factorydeck-collect-')));
});

afterEach(async () => {
  await close();
  await rm(work, { recursive: true, force: true });
});

function project(name: string, data: FakeGitHostData): Promise<string> {
  return addProject(db, work, name, data);
}

describe('collect from GitLab', () => {
  it('reads a GitLab project with label colours, closing issues and the head pipeline', async () => {
    const root = await project('api', {
      host: 'gitlab',
      repository: 'example-group/example-api',
      labels: [
        { name: 'backend', color: '#428BCA' },
        { name: 'triage', color: '' },
      ],
      issues: [
        {
          iid: 7,
          project_id: 1,
          title: 'Add refunds',
          state: 'opened',
          labels: ['triage', 'backend'],
          web_url: 'https://gitlab.com/example-group/example-api/-/issues/7',
          created_at: T0,
          closed_at: null,
          updated_at: T1,
        },
      ],
      requests: [
        {
          iid: 12,
          project_id: 1,
          target_project_id: 1,
          title: 'Draft: Add refunds',
          state: 'opened',
          draft: true,
          source_branch: 'feat/7-refunds',
          web_url:
            'https://gitlab.com/example-group/example-api/-/merge_requests/12',
          created_at: T0,
          merged_at: null,
          closed_at: null,
          updated_at: T1,
          head_pipeline: { status: 'failed' },
        },
        {
          iid: 13,
          project_id: 1,
          title: 'Add refunds again',
          state: 'merged',
          draft: false,
          source_branch: 'feat/7-again',
          web_url:
            'https://gitlab.com/example-group/example-api/-/merge_requests/13',
          created_at: T1,
          merged_at: T1,
          closed_at: null,
          updated_at: T1,
          head_pipeline: null,
        },
      ],
      closes: {
        '12': [
          { iid: 7, project_id: 1 },
          { iid: 8, project_id: 2 },
        ],
        '13': [{ iid: 7, project_id: 1 }],
      },
    });
    const result = await collect(db, { hasFactory });
    expect(result).toMatchObject({
      projects: 1,
      issues: 1,
      requests: 2,
      failures: [],
    });
    expect(await issueDetail(db, root, 7)).toEqual({
      gitHost: 'gitlab',
      number: 7,
      title: 'Add refunds',
      url: 'https://gitlab.com/example-group/example-api/-/issues/7',
      state: 'open',
      labels: [
        { name: 'backend', color: '#428bca' },
        { name: 'triage', color: null },
      ],
      requests: [
        expect.objectContaining({
          number: 13,
          state: 'merged',
          checks: 'none',
        }),
        expect.objectContaining({
          number: 12,
          state: 'open',
          draft: true,
          checks: 'failing',
        }),
      ],
    });
    const first = (await calls(root))[0];
    expect(first?.args).toEqual([
      'api',
      'projects/example-group%2Fexample-api/issues?order_by=updated_at&sort=asc&per_page=100&page=1',
    ]);
  });
});
