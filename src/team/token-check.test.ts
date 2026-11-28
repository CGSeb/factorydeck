import { describe, expect, it } from 'vitest';
import type { HostCliCall, HostCliResult, RunHostCli } from './host-cli.ts';
import { checkToken } from './token-check.ts';

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
const LAB_FILE = `${PROJECT}/repository/files/docs%2Fagents%2Ffactory.yml?ref=trunk`;

const ok = (value: unknown): HostCliResult => ({ ok: true, value });

describe('checkToken on GitHub', () => {
  it('reads the default branch, then the factory file on it', async () => {
    const { run, calls } = runner({
      [REPO]: ok({ default_branch: 'trunk' }),
      [FILE]: ok({ type: 'file' }),
    });
    await expect(checkToken(run, GITHUB, 'tok')).resolves.toEqual({
      status: 'ok',
      defaultBranch: 'trunk',
    });
    expect(calls.map((call) => call.args)).toEqual([
      ['api', '--hostname', 'github.com', REPO],
      ['api', '--hostname', 'github.com', FILE],
    ]);
    expect(calls.every((call) => call.token === 'tok')).toBe(true);
  });

  it('maps each failure to its fixed message', async () => {
    const cases: [HostCliResult, string][] = [
      [{ ok: false, failure: 'unauthorized' }, 'Bad token'],
      [
        { ok: false, failure: 'forbidden' },
        'Token cannot read this repository',
      ],
      [
        { ok: false, failure: 'not-found' },
        'Repository not found or not visible with this token',
      ],
      [{ ok: false, failure: 'unreachable' }, 'Could not reach github.com'],
      [ok('not json object'), 'Could not reach github.com'],
    ];
    for (const [answer, error] of cases) {
      const { run } = runner({ [REPO]: answer });
      await expect(checkToken(run, GITHUB, 'tok')).resolves.toEqual({
        status: 'refused',
        error,
      });
    }
  });

  it('refuses a missing file, a folder and a path that is not owner/repo', async () => {
    for (const file of [
      { ok: false, failure: 'not-found' } as const,
      ok([{ type: 'file' }]),
      ok({ type: 'dir' }),
    ]) {
      const { run } = runner({
        [REPO]: ok({ default_branch: 'trunk' }),
        [FILE]: file,
      });
      await expect(checkToken(run, GITHUB, 'tok')).resolves.toEqual({
        status: 'refused',
        error: 'No docs/agents/factory.yml on trunk',
      });
    }
    const { run, calls } = runner({});
    await expect(
      checkToken(run, { ...GITHUB, path: 'a/b/c' }, 'tok'),
    ).resolves.toEqual({
      status: 'refused',
      error: 'Repository not found or not visible with this token',
    });
    expect(calls).toEqual([]);
  });

  it('answers the missing CLI', async () => {
    const { run } = runner({ [REPO]: { ok: false, failure: 'missing' } });
    await expect(checkToken(run, GITHUB, 'tok')).resolves.toEqual({
      status: 'cli-missing',
      error: 'gh not found on the server',
    });
  });

  it('encodes the branch in the file query', async () => {
    const { run, calls } = runner({ [REPO]: ok({ default_branch: 'a&b' }) });
    await checkToken(run, GITHUB, 'tok');
    expect(calls[1]?.args.at(-1)).toBe(
      `${REPO}/contents/docs/agents/factory.yml?ref=a%26b`,
    );
  });
});

describe('checkToken on GitLab', () => {
  it('reads the project by its encoded path, then the factory file', async () => {
    const { run, calls } = runner({
      [PROJECT]: ok({ default_branch: 'trunk' }),
      [LAB_FILE]: ok({ file_name: 'factory.yml' }),
    });
    await expect(checkToken(run, GITLAB, 'tok')).resolves.toEqual({
      status: 'ok',
      defaultBranch: 'trunk',
    });
    expect(calls.map((call) => [call.gitHost, ...call.args])).toEqual([
      ['gitlab', 'api', '--hostname', 'git.example.test', PROJECT],
      ['gitlab', 'api', '--hostname', 'git.example.test', LAB_FILE],
    ]);
  });

  it('answers an empty project and a missing glab', async () => {
    const empty = runner({ [PROJECT]: ok({ default_branch: null }) });
    await expect(checkToken(empty.run, GITLAB, 'tok')).resolves.toEqual({
      status: 'refused',
      error: 'Repository is empty',
    });
    const missing = runner({ [PROJECT]: { ok: false, failure: 'missing' } });
    await expect(checkToken(missing.run, GITLAB, 'tok')).resolves.toEqual({
      status: 'cli-missing',
      error: 'glab not found on the server',
    });
  });

  it('answers Bad token when the file call is refused', async () => {
    const { run } = runner({
      [PROJECT]: ok({ default_branch: 'trunk' }),
      [LAB_FILE]: { ok: false, failure: 'unauthorized' },
    });
    await expect(checkToken(run, GITLAB, 'tok')).resolves.toEqual({
      status: 'refused',
      error: 'Bad token',
    });
  });
});
