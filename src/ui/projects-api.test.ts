import { describe, expect, it } from 'vitest';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import {
  projectAdder,
  projectRemover,
  projectSaver,
  projectsLoader,
} from './projects-api.ts';
import { addedProject, someProjects } from './projects-list-fixtures.ts';

function answering(status: number, body: unknown): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
}

describe('projectsLoader', () => {
  it('reads the projects', async () => {
    const body = { status: 'ok', refreshSeconds: 10, projects: someProjects };
    await expect(projectsLoader(answering(200, body))()).resolves.toEqual(body);
  });

  it('turns a 403 into refused and a 503 into unreachable', async () => {
    await expect(
      projectsLoader(answering(403, { error: 'Managers only' }))(),
    ).resolves.toEqual({ status: 'refused', refreshSeconds: 10 });
    await expect(
      projectsLoader(
        answering(503, { status: 'unreachable', refreshSeconds: 10 }),
      )(),
    ).resolves.toEqual({ status: 'unreachable', refreshSeconds: 10 });
  });

  it('answers nothing for a body it cannot read', async () => {
    await expect(
      projectsLoader(
        answering(200, { status: 'ok', refreshSeconds: 10, projects: [{}] }),
      )(),
    ).resolves.toBeUndefined();
    await expect(
      projectsLoader(
        answering(200, {
          status: 'ok',
          refreshSeconds: 10,
          projects: [addedProject],
        }),
      )(),
    ).resolves.toBeUndefined();
    await expect(
      projectsLoader(() => Promise.reject(new Error('offline')))(),
    ).resolves.toBeUndefined();
  });
});

describe('projectAdder', () => {
  const input = { remote: 'git@github.com:owner/repo.git', name: '' };

  it('answers the added project', async () => {
    await expect(
      projectAdder(answering(201, addedProject))(input),
    ).resolves.toEqual({ status: 'added', project: addedProject });
  });

  it('puts a refused field and a conflict under their field', async () => {
    await expect(
      projectAdder(
        answering(400, { error: 'Not a git remote', field: 'remote' }),
      )(input),
    ).resolves.toEqual({
      status: 'invalid',
      field: 'remote',
      message: 'Not a git remote',
    });
    await expect(
      projectAdder(
        answering(400, { error: 'Name must be text', field: 'name' }),
      )(input),
    ).resolves.toEqual({
      status: 'invalid',
      field: 'name',
      message: 'Name must be text',
    });
    await expect(
      projectAdder(
        answering(409, { error: 'This remote is already the project Repo' }),
      )(input),
    ).resolves.toEqual({
      status: 'invalid',
      field: 'remote',
      message: 'This remote is already the project Repo',
    });
  });

  it('answers a form failure otherwise', async () => {
    await expect(
      projectAdder(answering(503, { status: 'unreachable' }))(input),
    ).resolves.toEqual({ status: 'failed', message: DATABASE_UNREACHABLE });
    await expect(
      projectAdder(answering(403, { error: 'Managers only' }))(input),
    ).resolves.toEqual({ status: 'failed', message: 'Managers only' });
    await expect(
      projectAdder(() => Promise.reject(new Error('offline')))(input),
    ).resolves.toEqual({ status: 'failed', message: SERVER_UNREACHABLE });
  });
});

describe('projectSaver', () => {
  const shop = someProjects[0];
  if (shop === undefined) throw new Error('No project fixture');

  it('sends the changes and answers the saved project', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const saved = projectSaver((url, init) => {
      calls.push([url instanceof Request ? url.url : url.toString(), init]);
      return answering(200, shop)('');
    });

    await expect(saved(shop.id, { name: 'Atlas' })).resolves.toEqual({
      status: 'saved',
      project: shop,
    });
    expect(calls).toEqual([
      [
        `/api/admin/projects/${String(shop.id)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: '{"name":"Atlas"}',
        },
      ],
    ]);
  });

  it('puts a refusal under its field and a 404 apart', async () => {
    await expect(
      projectSaver(
        answering(400, { error: 'Name is required', field: 'name' }),
      )(1, { name: '' }),
    ).resolves.toEqual({
      status: 'invalid',
      field: 'name',
      message: 'Name is required',
    });
    await expect(
      projectSaver(
        answering(409, { error: 'This remote is already the project Repo' }),
      )(1, { remote: 'x' }),
    ).resolves.toEqual({
      status: 'invalid',
      field: 'remote',
      message: 'This remote is already the project Repo',
    });
    await expect(
      projectSaver(answering(404, { error: 'Not found' }))(1, { name: 'x' }),
    ).resolves.toEqual({ status: 'missing' });
  });

  it('answers a form failure otherwise', async () => {
    await expect(
      projectSaver(answering(503, { status: 'unreachable' }))(1, {}),
    ).resolves.toEqual({ status: 'failed', message: DATABASE_UNREACHABLE });
    await expect(
      projectSaver(answering(200, { id: 1 }))(1, {}),
    ).resolves.toEqual({ status: 'failed', message: SERVER_UNREACHABLE });
    await expect(
      projectSaver(() => Promise.reject(new Error('offline')))(1, {}),
    ).resolves.toEqual({ status: 'failed', message: SERVER_UNREACHABLE });
  });
});

describe('projectRemover', () => {
  it.each([
    [204, 'removed'],
    [404, 'not-found'],
    [503, 'failed'],
    [403, 'failed'],
    [500, 'failed'],
  ] as const)('reads HTTP %i as %s', async (status, outcome) => {
    const requests: [string, string | undefined][] = [];
    const remove = projectRemover((input, init) => {
      requests.push([typeof input === 'string' ? input : '', init?.method]);
      return Promise.resolve(
        new Response(status === 204 ? null : '{}', { status }),
      );
    });
    await expect(remove(addedProject)).resolves.toBe(outcome);
    expect(requests).toEqual([['/api/admin/projects/4', 'DELETE']]);
  });

  it('reads a network failure as failed', async () => {
    await expect(
      projectRemover(() => Promise.reject(new Error('offline')))(addedProject),
    ).resolves.toBe('failed');
  });
});
