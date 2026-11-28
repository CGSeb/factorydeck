import { describe, expect, it } from 'vitest';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import { projectAdder, projectsLoader } from './projects-api.ts';
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
