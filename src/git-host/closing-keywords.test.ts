import { describe, expect, it } from 'vitest';
import { ghRequest } from '../test/git-host.ts';
import { githubReader, githubRequest } from './github.ts';
import { gitlabRequest } from './gitlab.ts';

const NOW = '2026-03-02T10:00:00.000Z';
const REPOSITORY = 'example-org/example-app';

function github(body: string, closes: number[] = []): number[] {
  return (
    githubRequest(ghRequest(4, closes, [], { body }), REPOSITORY, NOW)
      ?.closes ?? []
  );
}

function gitlab(description: string, closes: number[] = []): number[] {
  return (
    gitlabRequest(
      {
        iid: 4,
        title: 'Request 4',
        state: 'merged',
        description,
        project_id: 7,
        target_project_id: 7,
        created_at: NOW,
        updated_at: NOW,
      },
      closes.map((iid) => ({ iid, project_id: 7 })),
      NOW,
    )?.closes ?? []
  );
}

describe('closing keywords of a request into any branch', () => {
  it('links a GitHub pull request whose body closes an issue the host does not report', () => {
    expect(github('Closes #192')).toEqual([192]);
  });

  it('links a GitLab merge request whose description closes an issue the host does not report', () => {
    expect(gitlab('Closes #192')).toEqual([192]);
  });

  it('reads every keyword form in any letter case', () => {
    expect(
      github(
        [
          'close #1',
          'CLOSES #2',
          'Closed #3',
          'fix #4',
          'Fixes #5',
          'fixed #6',
          'Resolve #7',
          'resolves #8',
          'RESOLVED #9',
          'Fixes: #10',
          'Closes #1',
        ].join('\n'),
      ),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('links nothing for a number without a closing keyword or of another repository', () => {
    expect(
      github(
        'See #192, refs #193, Closes other-org/other-app#194, Unclosed #195, prefixes #196',
      ),
    ).toEqual([]);
    expect(gitlab('Relates to #192 and Closes group/other#193')).toEqual([]);
  });

  it('keeps the closing references the host reports and adds nothing from the body', () => {
    expect(github('Closes #192', [12])).toEqual([12]);
    expect(gitlab('Closes #192', [12])).toEqual([12]);
  });

  it('asks GitHub for the pull request body', async () => {
    const row = ghRequest(4, [], [], {
      baseRefName: 'next',
      body: 'Closes #192',
    });
    const reader = githubReader(
      async (args) => {
        if (args[0] !== 'pr') return [];
        const fields = (args[args.indexOf('--json') + 1] ?? '').split(',');
        return [
          Object.fromEntries(
            Object.entries(row).filter(([key]) => fields.includes(key)),
          ),
        ];
      },
      REPOSITORY,
      () => NOW,
    );
    const changes = await reader.changes(null);
    expect(changes.requests.map((request) => request.closes)).toEqual([[192]]);
  });
});
