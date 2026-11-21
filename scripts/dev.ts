import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createServer } from 'vite';
import { loadRootEnvFile, validateEnv } from '../src/config/env.ts';
import { uiDevConfig } from './vite-config.ts';

loadRootEnvFile();
const env = validateEnv(process.env);

// Vite starts first: if it cannot listen, no API child is left running behind it.
const ui = await createServer(uiDevConfig(env.FACTORYDECK_PORT));
await ui.listen();
ui.printUrls();

const api = spawn(
  process.execPath,
  ['--watch', join(import.meta.dirname, '..', 'src', 'server', 'main.ts')],
  { stdio: 'inherit' },
);

async function stop(): Promise<void> {
  api.kill();
  await ui.close();
  process.exit(0);
}
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
