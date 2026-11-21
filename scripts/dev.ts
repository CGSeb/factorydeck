import { type ChildProcess, spawn } from 'node:child_process';
import { type FSWatcher, watch } from 'node:fs';
import { join, sep } from 'node:path';
import { type ViteDevServer, createServer } from 'vite';
import { loadRootEnvFile, validateEnv } from '../src/config/env.ts';
import { uiDevConfig } from './vite-config.ts';

const SRC = join(import.meta.dirname, '..', 'src');
const API_MAIN = join(SRC, 'server', 'main.ts');
const RESTART_DELAY_MS = 100;

/**
 * Runs the API and restarts it when a server file changes. `onEarlyStop` is called when the API
 * stops on its own before any file changed (a port taken, a start-up error); after a change, a
 * failing API is reported and restarted on the next change, like `node --watch`.
 */
function runApi(onEarlyStop: (reason: string) => void): { stop: () => void } {
  let api: ChildProcess | undefined;
  let restarting = false;
  let changed = false;
  let pending: NodeJS.Timeout | undefined;

  function onExit(code: number | null, signal: NodeJS.Signals | null): void {
    api = undefined;
    const reason = signal ?? `exit code ${String(code)}`;
    if (restarting) {
      restarting = false;
      start();
    } else if (changed) {
      console.error(
        `The API stopped (${reason}). Waiting for a file change to restart it.`,
      );
    } else {
      onEarlyStop(reason);
    }
  }
  function start(): void {
    api = spawn(process.execPath, [API_MAIN], { stdio: 'inherit' });
    api.once('exit', onExit);
  }
  function restart(): void {
    changed = true;
    if (!api) return start();
    restarting = true;
    api.kill();
  }

  const watcher: FSWatcher = watch(SRC, { recursive: true }, (_event, file) => {
    if (!file || file.startsWith(`ui${sep}`) || file.includes('.test.')) return;
    clearTimeout(pending);
    pending = setTimeout(restart, RESTART_DELAY_MS);
  });
  start();

  return {
    stop: () => {
      watcher.close();
      clearTimeout(pending);
      api?.removeAllListeners('exit');
      api?.kill();
    },
  };
}

let stopping = false;

async function shutdown(
  ui: ViteDevServer,
  stopApi: () => void,
  code: number,
): Promise<void> {
  if (stopping) return;
  stopping = true;
  stopApi();
  await ui.close();
  process.exit(code);
}

loadRootEnvFile();
const env = validateEnv(process.env);

// Vite starts first: if it cannot listen, no API child is left running behind it.
const ui = await createServer(uiDevConfig(env.FACTORYDECK_PORT));
await ui.listen();
ui.printUrls();

const api = runApi((reason) => {
  if (stopping) return;
  console.error(`The API stopped (${reason}), so pnpm dev stops too.`);
  void shutdown(ui, api.stop, 1);
});
process.once('SIGINT', () => void shutdown(ui, api.stop, 0));
process.once('SIGTERM', () => void shutdown(ui, api.stop, 0));
