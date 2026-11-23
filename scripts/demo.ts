import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { loadRootEnvFile, validateEnv } from '../src/config/env.ts';
import { createDatabase } from '../src/db/client.ts';
import { writeDemoCodexSessions } from '../src/demo/codex-sessions.ts';
import {
  EXAMPLE_API,
  EXAMPLE_APP,
  demoProjectRoot,
  writeDemoConfig,
  writeDemoSessions,
} from '../src/demo/sessions.ts';
import { collect, collectSummary } from '../src/git-host/collect.ts';
import { factoryFile, hasFactory } from '../src/ingest/factory.ts';
import { ingest, summaryLine } from '../src/ingest/ingest.ts';

const ROOT = join(import.meta.dirname, '..');

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '4318' },
    'no-factory': { type: 'boolean', default: false },
    'lost-factory': { type: 'boolean', default: false },
  },
});

const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`--port must be a port number, not ${values.port}`);
}
const DATABASE = `factorydeck_demo_${String(port)}`;

loadRootEnvFile();
const env = validateEnv(process.env);

const admin = new pg.Client({ connectionString: env.DATABASE_URL });
await admin.connect();
await admin.query(`drop database if exists ${DATABASE} with (force)`);
await admin.query(`create database ${DATABASE}`);
await admin.end();

const url = new URL(env.DATABASE_URL);
url.pathname = `/${DATABASE}`;
const demoUrl = url.toString();

const folder = join(tmpdir(), `factorydeck-demo-sessions-${String(port)}`);
const projects = join(tmpdir(), `factorydeck-demo-projects-${String(port)}`);
const codexFolder = join(tmpdir(), `factorydeck-demo-codex-${String(port)}`);
await rm(folder, { recursive: true, force: true });
await rm(projects, { recursive: true, force: true });
await rm(codexFolder, { recursive: true, force: true });
const now = new Date();
await writeDemoSessions(folder, now, projects, {
  factory: !values['no-factory'],
});
await writeDemoCodexSessions(
  codexFolder,
  now,
  demoProjectRoot(projects, EXAMPLE_APP),
);
const config = join(folder, 'factorydeck.yml');
await writeDemoConfig(config, projects);

const { db, close } = createDatabase(demoUrl);
try {
  await migrate(db, { migrationsFolder: join(ROOT, 'drizzle') });
  console.log(summaryLine(await ingest(db, folder, { codexFolder })));
  console.log(collectSummary(await collect(db, { hasFactory })).join('\n'));
  if (values['lost-factory']) {
    await rm(factoryFile(demoProjectRoot(projects, EXAMPLE_API)));
  }
} finally {
  await close();
}

const server = spawn(
  process.execPath,
  [join(ROOT, 'src', 'server', 'main.ts')],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: demoUrl,
      CLAUDE_PROJECTS_DIR: folder,
      CODEX_SESSIONS_DIR: codexFolder,
      FACTORYDECK_CONFIG: config,
      FACTORYDECK_PORT: String(port),
    },
  },
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.kill(signal));
}
server.once('exit', (code) => {
  process.exitCode = code ?? 0;
});
