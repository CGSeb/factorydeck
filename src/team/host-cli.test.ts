import { readdir } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type FakeHostCli,
  fakeHostCli,
  fakeRunner,
} from '../test/fake-host-cli.ts';
import { hostCliRunner } from './host-cli.ts';

let fake: FakeHostCli;

beforeEach(async () => {
  fake = await fakeHostCli();
});

afterEach(async () => {
  await fake.remove();
});

const SERVER_ENV = {
  PATH: process.env['PATH'] ?? '',
  HTTPS_PROXY: 'http://proxy.example.test:3128',
  SSL_CERT_FILE: '/etc/ssl/private-ca.pem',
  GH_TOKEN: 'server-gh-token',
  GITHUB_TOKEN: 'server-github-token',
  GITLAB_TOKEN: 'server-gitlab-token',
  DATABASE_URL: 'postgres://user:secret@localhost/db',
  FACTORYDECK_SECRET_KEY: 'server-key',
  HOME: '/home/server',
};

describe('hostCliRunner', () => {
  it('gives gh the project token and an allow-list of the server environment only', async () => {
    await fake.answer('repos/o/r', { status: 200, body: { id: 1 } });
    const run = fakeRunner(fake, SERVER_ENV);
    await expect(
      run({
        gitHost: 'github',
        host: 'github.com',
        token: 'project-token',
        args: ['api', '--hostname', 'github.com', 'repos/o/r'],
      }),
    ).resolves.toEqual({ ok: true, value: { id: 1 } });
    const [call] = await fake.calls();
    expect(call?.args).toEqual([
      'api',
      '--hostname',
      'github.com',
      'repos/o/r',
    ]);
    const { GH_CONFIG_DIR, ...env } = call?.env ?? {};
    expect(env).toEqual({
      PATH: SERVER_ENV.PATH,
      HTTPS_PROXY: SERVER_ENV.HTTPS_PROXY,
      SSL_CERT_FILE: SERVER_ENV.SSL_CERT_FILE,
      GH_TOKEN: 'project-token',
      GH_ENTERPRISE_TOKEN: 'project-token',
      GH_PROMPT_DISABLED: '1',
      NO_COLOR: '1',
    });
    expect(GH_CONFIG_DIR).toMatch(/factorydeck-host-cli-/);
    expect(call?.cwd).not.toBe(process.cwd());
    expect(call?.cwd).toMatch(/factorydeck-host-cli-/);
  });

  it('names another GitHub host and gives glab its own variables', async () => {
    const run = fakeRunner(fake, SERVER_ENV);
    await run({
      gitHost: 'github',
      host: 'ghe.example.test',
      token: 't1',
      args: ['api', 'x'],
    });
    await run({
      gitHost: 'gitlab',
      host: 'git.example.test',
      token: 't2',
      args: ['api', 'y'],
    });
    const [gh, glab] = await fake.calls();
    expect(gh?.env['GH_HOST']).toBe('ghe.example.test');
    expect(glab?.cli).toBe('glab');
    expect(glab?.env['GITLAB_TOKEN']).toBe('t2');
    expect(glab?.env['GITLAB_HOST']).toBe('git.example.test');
    expect(glab?.env['GLAB_CONFIG_DIR']).toMatch(/factorydeck-host-cli-/);
    expect(glab?.env['GH_TOKEN']).toBeUndefined();
  });

  it('classifies the failures and leaves no temporary folder', async () => {
    const run = fakeRunner(fake, SERVER_ENV);
    const call = (path: string, gitHost: 'github' | 'gitlab' = 'github') =>
      run({ gitHost, host: 'h.test', token: 't', args: ['api', path] });
    await fake.answer('a401', { status: 401 });
    await fake.answer('a403', { status: 403 });
    await fake.answer('a429', { status: 429 });
    await fake.answer('a404', { status: 404 });
    await fake.answer('a502', { status: 502 });
    await fake.answer('dns', {
      stderr:
        'error connecting to h.test: dial tcp: lookup h.test: no such host',
    });
    await fake.answer('slow', { hang: true });
    await expect(call('a401')).resolves.toEqual({
      ok: false,
      failure: 'unauthorized',
    });
    await expect(call('a401', 'gitlab')).resolves.toEqual({
      ok: false,
      failure: 'unauthorized',
    });
    await expect(call('a403')).resolves.toEqual({
      ok: false,
      failure: 'forbidden',
    });
    await expect(call('a429')).resolves.toEqual({
      ok: false,
      failure: 'forbidden',
    });
    await expect(call('a404', 'gitlab')).resolves.toEqual({
      ok: false,
      failure: 'not-found',
    });
    await expect(call('a502')).resolves.toEqual({
      ok: false,
      failure: 'unreachable',
    });
    await expect(call('dns')).resolves.toEqual({
      ok: false,
      failure: 'unreachable',
    });
    await expect(call('slow')).resolves.toEqual({
      ok: false,
      failure: 'unreachable',
    });
    const { tmpdir } = await import('node:os');
    const calls = await fake.calls();
    const left = await readdir(tmpdir());
    for (const { cwd } of calls) {
      expect(left).not.toContain(cwd.split('/').at(-2));
    }
  });

  it('answers unreachable without running the CLI when its temporary folder cannot be made', async () => {
    const run = hostCliRunner({
      ...fake.options(SERVER_ENV),
      tempRoot: `${fake.folder}/no-such-folder`,
    });
    await expect(
      run({
        gitHost: 'github',
        host: 'github.com',
        token: 't',
        args: ['api', 'x'],
      }),
    ).resolves.toEqual({ ok: false, failure: 'unreachable' });
    expect(await fake.calls()).toEqual([]);
  });

  it('answers missing when the CLI is not installed', async () => {
    const run = hostCliRunner({
      commands: { github: `${fake.folder}/no-such-gh` },
      serverEnv: SERVER_ENV,
    });
    await expect(
      run({
        gitHost: 'github',
        host: 'github.com',
        token: 't',
        args: ['api', 'x'],
      }),
    ).resolves.toEqual({ ok: false, failure: 'missing' });
  });
});
