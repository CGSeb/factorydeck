#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import type { Context } from './context.ts';
import { HOME_VARIABLE, cliHome } from './home.ts';
import { run } from './run.ts';

const EXIT_INTERRUPTED = 130;
const REQUEST_TIMEOUT_MS = 10_000;

function procVersion(): string {
  try {
    return readFileSync('/proc/version', 'utf8');
  } catch {
    return '';
  }
}

function launch(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
    });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

function context(): Context {
  const source = {
    env: process.env,
    platform: process.platform,
    homedir: homedir(),
    cwd: process.cwd(),
  };
  if ((process.env[HOME_VARIABLE] ?? '').trim() !== '') {
    process.env[HOME_VARIABLE] = cliHome(source);
  }
  return {
    ...source,
    procVersion,
    fetch,
    timeoutMs: REQUEST_TIMEOUT_MS,
    hostname: hostname(),
    now: () => Date.now(),
    sleep: (ms) => delay(ms),
    launch,
    output: {
      out: (line) => process.stdout.write(`${line}\n`),
      err: (line) => process.stderr.write(`${line}\n`),
      terminal: process.stdout.isTTY === true,
    },
  };
}

process.on('SIGINT', () => process.exit(EXIT_INTERRUPTED));
process.exitCode = await run(process.argv.slice(2), context());
