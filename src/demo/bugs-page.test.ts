import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listBugs } from '../bugs/query.ts';
import type { Database } from '../db/client.ts';
import { collect } from '../git-host/collect.ts';
import { hasFactory } from '../ingest/factory.ts';
import { ingest } from '../ingest/ingest.ts';
import { loadWorkflowConfig } from '../roles/config.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { sessionsFolder } from '../test/session-logs.ts';
import {
  EXAMPLE_APP,
  demoProjectRoot,
  writeDemoConfig,
  writeDemoSessions,
} from './sessions.ts';

const NOW = new Date('2026-03-12T15:30:00Z');

let db: Database;
let close: () => Promise<void>;
let projects: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  projects = await sessionsFolder();
  await writeDemoSessions(folder, NOW, projects);
  await ingest(db, folder, { codexFolder: await sessionsFolder(), wsl: false });
});

afterEach(async () => {
  await close();
});

describe('demo sessions on the bugs page', () => {
  it('cover the three groups of the bugs page and each kind of fix', async () => {
    await collect(db, { hasFactory });
    const path = join(await sessionsFolder(), 'factorydeck.yml');
    await writeDemoConfig(path, projects);
    const config = loadWorkflowConfig(path);
    const app = demoProjectRoot(projects, EXAMPLE_APP);
    const list = await listBugs(
      db,
      { period: '7d', timeZone: 'UTC', now: NOW, project: app },
      config,
    );
    const numbers = (rows: { number: number }[]) =>
      rows.map((row) => row.number);
    expect(list.bugTickets).toBe(true);
    expect(numbers(list.groups.open)).toEqual(expect.arrayContaining([14, 42]));
    expect(numbers(list.groups.fixing)).toEqual(expect.arrayContaining([44]));
    expect(numbers(list.groups.fixed)).toEqual(
      expect.arrayContaining([41, 43]),
    );
    const fixOf = (number: number) =>
      [...list.groups.fixing, ...list.groups.fixed].find(
        (row) => row.number === number,
      )?.fix;
    expect(fixOf(41)).toEqual({
      rootCause: 'The export reads the unfiltered rows.',
      reproduced: 'failed-on-main',
    });
    expect(fixOf(44)).toEqual({
      rootCause: null,
      reproduced: 'passed-on-main',
    });
    expect(list.counts.closed).toBeGreaterThan(0);
  });

  it('has a bug in its second version and one in its third', async () => {
    await collect(db, { hasFactory });
    const path = join(await sessionsFolder(), 'factorydeck.yml');
    await writeDemoConfig(path, projects);
    const config = loadWorkflowConfig(path);
    const app = demoProjectRoot(projects, EXAMPLE_APP);
    const list = await listBugs(
      db,
      { period: '7d', timeZone: 'UTC', now: NOW, project: app },
      config,
    );
    const second = list.groups.open.find((row) => row.number === 47);
    expect(second).toMatchObject({
      version: { number: 2, count: 2 },
      fix: null,
      score: null,
    });
    const third = list.groups.fixing.find((row) => row.number === 49);
    expect(third).toMatchObject({
      version: { number: 3, count: 3 },
      fix: {
        rootCause: 'A clock skew on the server.',
        reproduced: 'failed-on-main',
      },
      score: 81,
    });
  });
});
