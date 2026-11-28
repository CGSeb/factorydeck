import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type FakeServer, startFakeServer } from './test/fake-server.ts';

const MAIN = path.join(import.meta.dirname, 'main.ts');

let root: string;
let server: FakeServer;

interface Exited {
  code: number | null;
  stdout: string;
  stderr: string;
}

function start(argv: string[], home: string): ChildProcess {
  return spawn(process.execPath, [MAIN, ...argv], {
    cwd: root,
    env: {
      PATH: path.join(root, 'empty-path'),
      HOME: root,
      FACTORYDECK_CLI_HOME: home,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function exited(
  child: ChildProcess,
  onOut?: (text: string) => void,
): Promise<Exited> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
      onOut?.(stdout);
    });
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'factorydeck-main-'));
  await mkdir(path.join(root, 'empty-path'));
  server = await startFakeServer();
});

afterEach(async () => {
  await server.close();
  await rm(root, { recursive: true, force: true });
});

describe('the factorydeck command', () => {
  it('runs from the TypeScript sources and prints its help', async () => {
    const result = await exited(start(['--help'], 'home'));
    expect(result.code).toBe(0);
    expect(result.stdout.split('\n')[0]).toBe(
      'Usage: factorydeck <command> [options]',
    );
    expect(result.stderr).toBe('');
  });

  it('resolves a relative FACTORYDECK_CLI_HOME from the current folder', async () => {
    await mkdir(path.join(root, 'relative-home'));
    await writeFile(path.join(root, 'relative-home', 'credentials.json'), '{');
    const result = await exited(start(['status'], 'relative-home'));
    expect(result).toEqual({
      code: 1,
      stdout: '',
      stderr: `Could not read ${path.join(root, 'relative-home', 'credentials.json')}.\n`,
    });
  });

  it('exits 130 on Ctrl-C and saves nothing', async () => {
    server.route('POST /api/cli/login', [
      {
        status: 200,
        body: {
          deviceCode: 'd',
          userCode: 'WDJB-MJHT',
          verificationUrl: `${server.origin}/cli?code=WDJB-MJHT`,
          expiresIn: 600,
          interval: 5,
        },
      },
    ]);
    const child = start(['login', server.origin], path.join(root, 'home'));
    const result = await exited(child, (text) => {
      if (text.includes('check the code')) child.kill('SIGINT');
    });
    expect(result.stdout).toBe(
      `Open ${server.origin}/cli?code=WDJB-MJHT and check the code WDJB-MJHT.\n`,
    );
    expect(result.code).toBe(130);
    expect(await readdir(root)).not.toContain('home');
  });
});
