import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Context } from '../context.ts';
import { run } from '../run.ts';

export interface FakeContext extends Context {
  home: string;
  credentials: string;
  stdout: string[];
  stderr: string[];
  sleeps: number[];
  launched: [string, string[]][];
  clock: number;
}

export interface Ran {
  code: number;
  stdout: string[];
  stderr: string[];
}

export async function fakeContext(): Promise<FakeContext> {
  const root = await mkdtemp(path.join(tmpdir(), 'factorydeck-cli-'));
  const home = path.join(root, 'home');
  const context: FakeContext = {
    home,
    credentials: path.join(home, 'credentials.json'),
    stdout: [],
    stderr: [],
    sleeps: [],
    launched: [],
    clock: Date.UTC(2026, 0, 2, 3, 4, 5),
    env: { FACTORYDECK_CLI_HOME: home },
    platform: 'darwin',
    homedir: root,
    cwd: root,
    procVersion: () => '',
    fetch,
    timeoutMs: 2_000,
    hostname: 'test-laptop',
    now: () => context.clock,
    sleep: (ms) => {
      context.sleeps.push(ms);
      context.clock += ms;
      return Promise.resolve();
    },
    launch: (command, args) => {
      context.launched.push([command, args]);
      return Promise.resolve(true);
    },
    output: {
      out: (line) => context.stdout.push(line),
      err: (line) => context.stderr.push(line),
      terminal: false,
    },
  };
  return context;
}

export async function runIn(
  context: FakeContext,
  argv: string[],
): Promise<Ran> {
  context.stdout.length = 0;
  context.stderr.length = 0;
  const code = await run(argv, context);
  return { code, stdout: [...context.stdout], stderr: [...context.stderr] };
}

export async function removeContext(context: FakeContext): Promise<void> {
  await rm(path.dirname(context.home), { recursive: true, force: true });
}
