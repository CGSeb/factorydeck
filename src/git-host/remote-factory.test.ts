import { describe, expect, it } from 'vitest';
import type {
  HostCliCall,
  HostCliResult,
  RunHostCli,
} from '../team/host-cli.ts';
import { readRemoteFactory } from './remote-factory.ts';

function runner(answers: Record<string, HostCliResult>): {
  run: RunHostCli;
  calls: HostCliCall[];
} {
  const calls: HostCliCall[] = [];
  return {
    calls,
    run: (call) => {
      calls.push(call);
      return Promise.resolve(
        answers[call.args.at(-1) ?? ''] ?? { ok: false, failure: 'not-found' },
      );
    },
  };
}

const GITHUB = {
  gitHost: 'github',
  host: 'github.com',
  path: 'owner/shop',
} as const;
const GITLAB = {
  gitHost: 'gitlab',
  host: 'git.example.test',
  path: 'group/sub/shop',
} as const;

const REPO = 'repos/owner/shop';
const FILE = `${REPO}/contents/docs/agents/factory.yml?ref=trunk`;
const PROJECT = 'projects/group%2Fsub%2Fshop';
const LAB_FILE = `${PROJECT}/repository/files/docs%2Fagents%2Ffactory.yml/raw?ref=trunk`;

const ok = (value: unknown): HostCliResult => ({ ok: true, value });

function factory(gitHost: string, extra = ''): string {
  return [
    'version: 2',
    'repository:',
    `  git_host: ${gitHost}`,
    'issues:',
    '  labels:',
    '    spec: spec',
    '    ready: ready-now',
    '    working: busy',
    '    needs_spec: unclear',
    '    review: in-review',
    '    blocked: stuck',
    extra,
  ].join('\n');
}

const LABELS = {
  ready: 'ready-now',
  working: 'busy',
  needs_spec: 'unclear',
  review: 'in-review',
  blocked: 'stuck',
};

function github(text: string): ReturnType<typeof runner> {
  return runner({
    [REPO]: ok({ default_branch: 'trunk' }),
    [FILE]: ok(text),
  });
}

describe('readRemoteFactory', () => {
  it('reads the labels, the bug label and auto-merge of factory.yml on the default branch of GitHub', async () => {
    const { run, calls } = github(
      factory(
        'github',
        'bugs:\n  label: defect\nbuild:\n  auto_merge: false\n',
      ),
    );
    await expect(readRemoteFactory(run, GITHUB, 'tok')).resolves.toEqual({
      ok: true,
      settings: { labels: LABELS, autoMerge: false, bugLabel: 'defect' },
    });
    expect(
      calls.map(({ args, raw, token, host }) => ({ args, raw, token, host })),
    ).toEqual([
      {
        args: ['api', '--hostname', 'github.com', REPO],
        raw: false,
        token: 'tok',
        host: 'github.com',
      },
      {
        args: [
          'api',
          '--hostname',
          'github.com',
          '-H',
          'Accept: application/vnd.github.raw',
          FILE,
        ],
        raw: true,
        token: 'tok',
        host: 'github.com',
      },
    ]);
  });

  it('reads the raw file of a GitLab project on its own host', async () => {
    const { run, calls } = runner({
      [PROJECT]: ok({ default_branch: 'trunk' }),
      [LAB_FILE]: ok(factory('GitLab')),
    });
    await expect(readRemoteFactory(run, GITLAB, 'tok')).resolves.toEqual({
      ok: true,
      settings: { labels: LABELS, autoMerge: null, bugLabel: null },
    });
    expect(calls.map((call) => call.args)).toEqual([
      ['api', '--hostname', 'git.example.test', PROJECT],
      ['api', '--hostname', 'git.example.test', LAB_FILE],
    ]);
  });

  it('refuses a factory.yml for another git host, showing the value as written', async () => {
    const { run } = github(factory('GitLab'));
    await expect(readRemoteFactory(run, GITHUB, 'tok')).resolves.toEqual({
      ok: false,
      reason: 'factory.yml says GitLab, the remote is on github',
    });
  });

  it('names what is wrong with the file', async () => {
    const cases: [string, string][] = [
      ['a: [b', 'docs/agents/factory.yml is not valid YAML'],
      ['version: 2\n', 'docs/agents/factory.yml has no repository.git_host'],
      [
        factory('bitbucket'),
        'repository.git_host is bitbucket, not github or gitlab',
      ],
      [
        factory('github').replace('    review: in-review\n', ''),
        'docs/agents/factory.yml has no issues.labels.review',
      ],
      ['', 'docs/agents/factory.yml has no repository.git_host'],
      [
        `${factory('github')}\n# ${'x'.repeat(1024 * 1024)}\n`,
        'docs/agents/factory.yml is larger than 1 MB',
      ],
    ];
    for (const [text, reason] of cases) {
      const { run } = github(text);
      await expect(readRemoteFactory(run, GITHUB, 'tok')).resolves.toEqual({
        ok: false,
        reason,
      });
    }
  });

  it('maps each failure of the git host to the token check texts', async () => {
    const cases: [Record<string, HostCliResult>, string][] = [
      [{ [REPO]: { ok: false, failure: 'unauthorized' } }, 'Bad token'],
      [
        { [REPO]: { ok: false, failure: 'forbidden' } },
        'Token cannot read this repository',
      ],
      [
        { [REPO]: { ok: false, failure: 'not-found' } },
        'Repository not found or not visible with this token',
      ],
      [
        { [REPO]: { ok: false, failure: 'unreachable' } },
        'Could not reach github.com',
      ],
      [
        { [REPO]: { ok: false, failure: 'missing' } },
        'gh not found on the server',
      ],
      [{ [REPO]: ok({}) }, 'Repository is empty'],
      [
        { [REPO]: ok({ default_branch: 'trunk' }) },
        'No docs/agents/factory.yml on trunk',
      ],
      [
        {
          [REPO]: ok({ default_branch: 'trunk' }),
          [FILE]: { ok: false, failure: 'forbidden' },
        },
        'Token cannot read this repository',
      ],
    ];
    for (const [answers, reason] of cases) {
      const { run } = runner(answers);
      await expect(readRemoteFactory(run, GITHUB, 'tok')).resolves.toEqual({
        ok: false,
        reason,
      });
    }
  });
});
