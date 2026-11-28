import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { account, session } from '../db/schema.ts';
import { usageOverview } from '../overview/query.ts';
import { sessionDetail } from '../sessions/query.ts';
import {
  NORMAL_REMOTE,
  addProject,
  apiCall as call,
  mainThread,
  minutes,
  subAgentThread,
  twoSessions,
} from '../test/cli-batch.ts';
import { useIngestApp } from '../test/cli-ingest-app.ts';

const app = useIngestApp();
const { send, stored } = app;

function overview() {
  return usageOverview(app.h().db, {
    period: 'all',
    timeZone: 'UTC',
    project: 'shop',
    now: new Date(minutes(60)),
  });
}

function detail(id: string) {
  return sessionDetail(app.h().db, id, {
    inactiveAfterMinutes: 30,
    now: new Date(minutes(60)),
  });
}

describe('POST /api/cli/ingest', () => {
  it('stores two sessions with their sub-agents and calls, shown on the Overview of their project', async () => {
    await addProject(app.h().db);
    expect(await send(twoSessions())).toEqual({
      status: 200,
      body: { sessions: 2, threads: 5, apiCalls: 7 },
    });
    const rows = await stored();
    expect(rows.sessions.map((row) => [row.id, row.remote])).toEqual([
      ['s-1', NORMAL_REMOTE],
      ['s-2', NORMAL_REMOTE],
    ]);
    expect(rows.subAgents.map((row) => `${row.sessionId}/${row.id}`)).toEqual([
      's-1/a1',
      's-2/b1',
      's-2/b2',
    ]);
    expect(rows.calls.map((row) => row.sourcePath)).toContain(
      'claude-code/s-2/b1',
    );
    expect(
      rows.files.map((row) => [row.fileKey, row.readTo, row.parserVersion]),
    ).toContainEqual(['claude-code/s-1/main', 4096, 1]);
    const usage = await overview();
    expect(usage.totals.sessions).toBe(2);
    expect(usage.totals.apiCalls).toBe(7);
    const shown = await detail('s-2');
    expect(shown?.project).toBe('shop');
    expect(shown?.subAgents.map((agent) => agent.id)).toEqual(['b1', 'b2']);
  });

  it('stores nothing twice when the same batch comes again', async () => {
    await addProject(app.h().db);
    await send(twoSessions());
    const first = await stored();
    expect(await send(twoSessions())).toEqual({
      status: 200,
      body: { sessions: 2, threads: 5, apiCalls: 0 },
    });
    const second = await stored();
    expect(second.calls.map((row) => row.id)).toEqual(
      first.calls.map((row) => row.id),
    );
    expect(second.subAgents).toHaveLength(3);
    expect((await overview()).totals.apiCalls).toBe(7);
  });

  it('reads a gzip body, whatever the letter case of its encoding', async () => {
    expect(
      await send(twoSessions(), {
        gzip: true,
        headers: { 'content-encoding': ' GZip ' },
      }),
    ).toMatchObject({ status: 200, body: { apiCalls: 7 } });
    expect(
      await send(
        { parserVersion: 1, threads: [mainThread('s-3')] },
        { gzip: true, headers: { 'content-encoding': 'x-gzip' } },
      ),
    ).toMatchObject({ status: 200, body: { sessions: 1 } });
    expect(
      await send(
        { parserVersion: 1, threads: [] },
        { headers: { 'content-encoding': 'Identity' } },
      ),
    ).toEqual({ status: 200, body: { sessions: 0, threads: 0, apiCalls: 0 } });
  });

  it('records the account and the machine that sent a session first', async () => {
    await addProject(app.h().db);
    await send({ parserVersion: 1, threads: [mainThread('s-1')] });
    const other = await app.connect('bob@example.test', 'Bob', 'desktop');
    expect(
      await send(
        {
          parserVersion: 1,
          threads: [
            mainThread('s-1', { calls: [call('s-1-r9', minutes(9))] }),
            subAgentThread('s-1', 'a1'),
          ],
        },
        {},
        other,
      ),
    ).toMatchObject({ status: 200, body: { apiCalls: 2 } });
    expect((await detail('s-1'))?.sentBy).toEqual({
      name: 'Ada',
      machine: 'laptop',
    });
    expect((await stored()).calls).toHaveLength(4);
    await app
      .h()
      .db.update(account)
      .set({ name: 'Ada L.' })
      .where(eq(account.email, 'ada@example.test'));
    expect((await detail('s-1'))?.sentBy?.name).toBe('Ada L.');
  });

  it('gives a session of the local ingestion the first CLI sender', async () => {
    await addProject(app.h().db);
    await app
      .h()
      .db.insert(session)
      .values({ id: 's-1', remote: NORMAL_REMOTE });
    expect((await detail('s-1'))?.sentBy).toBeNull();
    await send({ parserVersion: 1, threads: [mainThread('s-1')] });
    expect((await detail('s-1'))?.sentBy).toEqual({
      name: 'Ada',
      machine: 'laptop',
    });
  });

  it('keeps a session of a remote no project has, shown once the project is added', async () => {
    await send({
      parserVersion: 1,
      threads: [mainThread('s-1', { remote: 'https://GitHub.com/acme/shop' })],
    });
    expect((await stored()).sessions[0]?.remote).toBe(NORMAL_REMOTE);
    expect(await detail('s-1')).toBeUndefined();
    await addProject(app.h().db);
    expect((await detail('s-1'))?.project).toBe('shop');
  });

  it.each([
    ['null', null],
    ['a path', '/home/dev/shop'],
    ['a file URL', 'file:///home/dev/shop'],
  ])('stores a remote %s as no remote', async (_name, remote) => {
    expect(
      await send({
        parserVersion: 1,
        threads: [mainThread('s-1', { remote })],
      }),
    ).toMatchObject({ status: 200 });
    expect((await stored()).sessions[0]?.remote).toBeNull();
  });

  it('takes the project of the main log, and of a sub-agent only while the main log has none', async () => {
    await send({
      parserVersion: 1,
      threads: [
        subAgentThread('s-1', 'a1', {
          remote: 'git@github.com:acme/other.git',
        }),
        mainThread('s-1', { remote: null }),
      ],
    });
    expect((await stored()).sessions[0]?.remote).toBe('github.com/acme/other');
    await send({ parserVersion: 2, threads: [mainThread('s-1')] });
    expect((await stored()).sessions[0]?.remote).toBe(NORMAL_REMOTE);
    await send({
      parserVersion: 2,
      threads: [
        subAgentThread('s-1', 'a2', {
          remote: 'git@github.com:acme/other.git',
        }),
      ],
    });
    expect((await stored()).sessions[0]?.remote).toBe(NORMAL_REMOTE);
  });

  it('replaces the fields of a thread but keeps its earliest first time', async () => {
    await send({ parserVersion: 1, threads: [mainThread('s-1')] });
    const later = mainThread('s-1', { firstAt: minutes(3) });
    if (later.session !== undefined) later.session.title = 'Renamed';
    await send({ parserVersion: 1, threads: [later] });
    const [row] = (await stored()).sessions;
    expect(row?.title).toBe('Renamed');
    expect(row?.firstAt?.toISOString()).toBe(minutes(0));
    await send({
      parserVersion: 1,
      threads: [mainThread('s-1', { firstAt: minutes(-5) })],
    });
    expect((await stored()).sessions[0]?.firstAt?.toISOString()).toBe(
      minutes(-5),
    );
  });

  it('takes the working directory of the earliest sub-agent when the main log has none', async () => {
    await send({
      parserVersion: 1,
      threads: [
        mainThread('s-1', { cwd: null }),
        subAgentThread('s-1', 'a1', { cwd: '/home/dev/shop/web' }),
      ],
    });
    const [row] = (await stored()).sessions;
    expect(row?.cwd).toBe('/home/dev/shop/web');
    expect(row?.cwdFromMain).toBe(false);
    expect(row?.gitBranches).toEqual(['feat/12-cart']);
  });

  it('counts one Codex response once per session, whatever thread sends it', async () => {
    const codexSub = {
      ...mainThread('c-1', { agent: 'codex', calls: [call('resp-1')] }),
      fileKey: 'codex/c-1/sub',
      subAgentId: 'sub',
      session: undefined,
      subAgent: { model: 'gpt-5' },
    };
    expect(
      await send({
        parserVersion: 1,
        threads: [
          mainThread('c-1', { agent: 'codex', calls: [call('resp-1')] }),
          codexSub,
        ],
      }),
    ).toMatchObject({ status: 200, body: { apiCalls: 1 } });
  });
});
