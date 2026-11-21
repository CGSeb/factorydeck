import { type ChildProcess, spawn } from 'node:child_process';
import { type Server, createServer } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createScratchDatabase } from '../test/postgres.ts';
import {
  appendLog,
  assistant,
  sessionsFolder,
  writeLog,
} from '../test/session-logs.ts';

const MAIN = join(import.meta.dirname, 'main.ts');
const DATABASE_URL = 'postgres://user:secret@127.0.0.1:1/factorydeck';

interface Run {
  child: ChildProcess;
  output: () => string;
  exited: Promise<number | null>;
}

function start(env: Record<string, string>): Run {
  const child = spawn(process.execPath, [MAIN], {
    env: { PATH: process.env.PATH, ...env },
  });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const exited = new Promise<number | null>((resolve) =>
    child.once('exit', resolve),
  );
  return { child, output: () => output, exited };
}

function occupy(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer().listen(0, '127.0.0.1', () => resolve(server));
  });
}

function portOf(server: Server): number {
  const address = server.address();
  return typeof address === 'object' && address ? address.port : 0;
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !check(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const running: Run[] = [];
const occupied: Server[] = [];

afterEach(() => {
  for (const run of running.splice(0)) run.child.kill();
  for (const server of occupied.splice(0)) server.close();
});

describe('pnpm start', () => {
  it('listens on 127.0.0.1 and prints its URL', async () => {
    const free = await occupy();
    const port = portOf(free);
    await new Promise((resolve) => free.close(resolve));
    const run = start({ DATABASE_URL, FACTORYDECK_PORT: String(port) });
    running.push(run);
    await waitFor(() => run.output().includes('FactoryDeck on'));
    expect(run.output()).toContain(`FactoryDeck on http://127.0.0.1:${port}`);
    for (let request = 0; request < 2; request++) {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        status: 'degraded',
        database: 'unreachable',
      });
    }
    expect(run.child.exitCode).toBeNull();
  });

  it('exits with code 1 when the port is already in use', async () => {
    const taken = await occupy();
    occupied.push(taken);
    const port = portOf(taken);
    const run = start({ DATABASE_URL, FACTORYDECK_PORT: String(port) });
    expect(await run.exited).toBe(1);
    expect(run.output()).toContain(
      `Port ${port} is already in use. Set FACTORYDECK_PORT in .env.`,
    );
  });

  it('exits with code 1 listing every invalid variable', async () => {
    const run = start({
      DATABASE_URL: 'mysql://localhost/x',
      FACTORYDECK_PORT: 'abc',
      FACTORYDECK_INGEST_INTERVAL_SECONDS: '0',
      FACTORYDECK_INACTIVE_AFTER_MINUTES: '0',
    });
    expect(await run.exited).toBe(1);
    expect(run.output()).toContain('Invalid environment');
    expect(run.output()).toContain('DATABASE_URL');
    expect(run.output()).toContain('FACTORYDECK_PORT');
    expect(run.output()).toContain('FACTORYDECK_INGEST_INTERVAL_SECONDS');
    expect(run.output()).toContain('FACTORYDECK_INACTIVE_AFTER_MINUTES');
  });

  it('ingests the session logs at start-up, then at every interval', async () => {
    const scratch = await createScratchDatabase();
    const folder = await sessionsFolder();
    const log = join(folder, 'p', 'session-live.jsonl');
    await writeLog(log, [
      assistant({ uuid: 'a1', at: 0 }, { requestId: 'r1' }),
    ]);
    const free = await occupy();
    const port = portOf(free);
    await new Promise((resolve) => free.close(resolve));
    const run = start({
      DATABASE_URL: scratch.url,
      FACTORYDECK_PORT: String(port),
      CLAUDE_PROJECTS_DIR: folder,
      FACTORYDECK_INGEST_INTERVAL_SECONDS: '1',
    });
    running.push(run);
    const apiCalls = async (): Promise<unknown> => {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/overview?period=all&tz=UTC`,
      ).catch(() => undefined);
      const body: unknown = await response?.json();
      return typeof body === 'object' && body !== null && 'overview' in body
        ? body
        : undefined;
    };
    try {
      let body: unknown;
      await waitFor(() => run.output().includes('FactoryDeck on'));
      for (let i = 0; i < 50; i++) {
        body = await apiCalls();
        if (JSON.stringify(body).includes('"apiCalls":1')) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(body).toMatchObject({
        status: 'ok',
        sessionsFolder: folder,
        refreshSeconds: 1,
        overview: { totals: { apiCalls: 1 } },
      });
      expect(body).not.toMatchObject({ updatedAt: null });
      await appendLog(log, [
        assistant({ uuid: 'a2', at: 1 }, { requestId: 'r2' }),
      ]);
      for (let i = 0; i < 50; i++) {
        body = await apiCalls();
        if (JSON.stringify(body).includes('"apiCalls":2')) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(body).toMatchObject({ overview: { totals: { apiCalls: 2 } } });
      const sessions: unknown = await (
        await fetch(`http://127.0.0.1:${port}/api/sessions?period=all&tz=UTC`)
      ).json();
      expect(sessions).toMatchObject({
        status: 'ok',
        list: { total: 1, sessions: [{ id: 'session-live' }] },
      });
    } finally {
      run.child.kill();
      await run.exited;
      await scratch.drop();
    }
  }, 20_000);
});
