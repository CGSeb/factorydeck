import { mkdir, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostProject, session } from '../db/schema.ts';
import { factoryFile, hasFactory } from '../ingest/factory.ts';
import { ingest } from '../ingest/ingest.ts';
import { createTestDatabase, testRemote } from '../test/postgres.ts';
import {
  assistant,
  installFactory,
  sessionsFolder,
  skillCall,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { factoryStatus } from './remove.ts';

let db: Database;
let close: () => Promise<void>;
let logs: string;
let work: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  logs = await sessionsFolder();
  work = await realpath(await sessionsFolder());
});

afterEach(async () => {
  await close();
});

async function factoryProject(name: string): Promise<string> {
  const root = join(work, name);
  await mkdir(root, { recursive: true });
  await installFactory(root);
  return root;
}

async function writeSession(id: string, cwd: string): Promise<void> {
  const ctx = (n: number, sidechain = false) => ({
    uuid: `${id}-${String(n)}`,
    at: n,
    cwd,
    sidechain,
  });
  await writeLog(join(logs, 'p', `${id}.jsonl`), [
    userText(ctx(0), 'Build it'),
    assistant(ctx(1), { requestId: `${id}-1`, content: [skillCall('kit:a')] }),
  ]);
  const agents = join(logs, 'p', id, 'subagents');
  await writeLog(join(agents, 'agent-x.jsonl'), [
    assistant(ctx(2, true), {
      requestId: `${id}-2`,
      content: [skillCall('kit:b')],
    }),
  ]);
  await writeLog(join(agents, 'agent-x.meta.json'), [{ agentType: 'helper' }]);
}

describe('factory status', () => {
  it('lists a project without its factory', async () => {
    const gone = await factoryProject('gone-app');
    const kept = await factoryProject('kept-app');
    await writeSession('g1', gone);
    await writeSession('k1', kept);
    await ingest(db, logs);
    await rm(factoryFile(gone));
    expect(await factoryStatus(db, hasFactory)).toEqual({
      hasSessions: true,
      missing: [
        {
          project: gone,
          name: 'gone-app',
          factoryFile: factoryFile(gone),
          sessions: 1,
        },
      ],
      projects: [
        { project: gone, name: 'gone-app' },
        { project: kept, name: 'kept-app' },
      ],
      bugTickets: [],
    });
  });

  it('lists projects without their factory by name, and says when no session is stored', async () => {
    expect(await factoryStatus(db, hasFactory)).toEqual({
      hasSessions: false,
      missing: [],
      projects: [],
      bugTickets: [],
    });
    await db.insert(session).values([
      { id: 'a', project: '/gone/zeta' },
      { id: 'b', project: '/gone/alpha' },
      { id: 'c', project: '/gone/alpha' },
    ]);
    const status = await factoryStatus(db, hasFactory);
    expect(status.missing.map((row) => [row.name, row.sessions])).toEqual([
      ['alpha', 2],
      ['zeta', 1],
    ]);
    expect(status.projects).toEqual([
      { project: '/gone/alpha', name: 'alpha' },
      { project: '/gone/zeta', name: 'zeta' },
    ]);
  });

  it('lists the collected projects that have a bug label', async () => {
    const syncedFrom = new Date('2026-03-01T10:00:00Z');
    await db.insert(gitHostProject).values([
      { remote: testRemote('/work/zeta'), bugLabel: 'bug', syncedFrom },
      { remote: testRemote('/work/alpha'), bugLabel: 'defect', syncedFrom },
      { remote: testRemote('/work/plain'), bugLabel: null, syncedFrom },
      { remote: testRemote('/work/failed'), bugLabel: 'bug', syncedFrom: null },
    ]);
    expect((await factoryStatus(db, hasFactory)).bugTickets).toEqual([
      '/work/alpha',
      '/work/zeta',
    ]);
  });
});
