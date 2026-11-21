import { type ChildProcess, spawn } from 'node:child_process';
import { type Server, createServer } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

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
    });
    expect(await run.exited).toBe(1);
    expect(run.output()).toContain('Invalid environment');
    expect(run.output()).toContain('DATABASE_URL');
    expect(run.output()).toContain('FACTORYDECK_PORT');
  });
});
