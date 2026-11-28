import { execFile } from 'node:child_process';
import { mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  project,
  rootRemote,
  session,
  sourceFile,
} from '../db/schema.ts';
import { ingest } from '../ingest/ingest.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  appendLog,
  assistant,
  installFactory,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { projectStore } from './projects.ts';

const git = promisify(execFile);
const AT = new Date('2026-03-12T10:00:00Z');
const REMOTE = 'github.com/example-org/shop';

let db: Database;
let close: () => Promise<void>;
let logs: string;
let root: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase({ linkRoots: false }));
  logs = await sessionsFolder();
  root = join(await realpath(await sessionsFolder()), 'shop');
  await mkdir(root, { recursive: true });
  await git('git', ['init', '--quiet'], { cwd: root });
  await git(
    'git',
    ['remote', 'add', 'origin', 'git@github.com:example-org/shop.git'],
    { cwd: root },
  );
  await installFactory(root);
});

afterEach(async () => {
  await close();
});

function lines(id: string, n: number) {
  const ctx = { uuid: `${id}-${String(n)}`, at: n, cwd: root };
  return [
    userText(ctx, 'Prompt'),
    assistant(ctx, { requestId: `${id}-req-${String(n)}` }),
  ];
}

describe('ingestion after a project is removed', () => {
  it('skips every thread of a removed session, and reads only the later sessions of the remote', async () => {
    const old = join(logs, 'p', 'old-session.jsonl');
    await writeLog(old, lines('old-session', 0));
    await ingest(db, logs);
    const [added] = await db
      .insert(project)
      .values({ name: 'Shop', slug: 'shop', remote: REMOTE, createdAt: AT })
      .returning({ id: project.id });
    const offsets = await db.select().from(sourceFile);
    expect(await projectStore(db).list()).toMatchObject([{ sessions: 1 }]);

    expect(await projectStore(db).remove(added?.id ?? 0)).toBe('removed');
    expect(await db.select().from(rootRemote)).toEqual([]);

    await appendLog(old, lines('old-session', 1));
    await writeLog(
      join(logs, 'p', 'old-session', 'subagents', 'agent-x.jsonl'),
      lines('old-session', 2),
    );
    await writeLog(join(logs, 'p', 'new-session.jsonl'), lines('new', 3));
    await ingest(db, logs);

    expect(await db.select({ id: session.id }).from(session)).toEqual([
      { id: 'new-session' },
    ]);
    expect(
      (await db.select({ id: apiCall.sessionId }).from(apiCall)).map(
        (row) => row.id,
      ),
    ).toEqual(['new-session']);
    expect(
      (await db.select().from(sourceFile)).filter((row) => row.path === old),
    ).toEqual(offsets);
    expect(await db.select().from(rootRemote)).toEqual([
      { root, remote: REMOTE },
    ]);
    expect(await projectStore(db).list()).toEqual([]);
  });
});
