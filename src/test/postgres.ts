import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { loadRootEnvFile } from '../config/env.ts';
import {
  CONNECTION_TIMEOUT_MS,
  type Database,
  createDatabase,
} from '../db/client.ts';

/** Connections each scratch pool keeps: test files run in parallel, often from several worktrees at once, on one server. */
const SCRATCH_POOL_SIZE = 2;

/** URL of the PostgreSQL server the database tests use: `DATABASE_URL`, from the environment or the root `.env`. */
export function postgresUrl(): string {
  loadRootEnvFile();
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error(
      'Database tests need DATABASE_URL: set it in the root .env (pnpm db:up) or in the environment.',
    );
  }
  return url;
}

const LINK_ROOTS = `
create function link_test_root() returns trigger language plpgsql as $$
declare
  remote text := 'test.invalid/' || new.project;
begin
  if new.project <> 'unassigned' then
    insert into project (name, slug, remote, created_at)
      values (coalesce(substring(new.project from '([^/\\\\]+)[/\\\\]*$'), new.project), new.project, remote, now())
      on conflict do nothing;
    insert into root_remote (root, remote) values (new.project, remote)
      on conflict do nothing;
  end if;
  return new;
end $$;
create trigger link_session_root after insert or update of project on session
  for each row execute function link_test_root();
create trigger link_git_host_root after insert on git_host_project
  for each row execute function link_test_root();
`;

export interface ScratchOptions {
  linkRoots?: boolean;
}

/** A new, migrated database on the test server, dropped by `drop`. */
export async function createScratchDatabase({
  linkRoots = true,
}: ScratchOptions = {}): Promise<{
  url: string;
  drop: () => Promise<void>;
}> {
  const server = postgresUrl();
  const name = `factorydeck_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: server });
  await admin.connect();
  await admin.query(`create database ${name}`);
  const scratch = new URL(server);
  scratch.pathname = `/${name}`;
  const { db, close } = createDatabase(
    scratch.toString(),
    CONNECTION_TIMEOUT_MS,
    SCRATCH_POOL_SIZE,
  );
  await migrate(db, {
    migrationsFolder: join(import.meta.dirname, '..', '..', 'drizzle'),
  });
  await close();
  if (linkRoots) {
    const client = new pg.Client({ connectionString: scratch.toString() });
    await client.connect();
    await client.query(LINK_ROOTS);
    await client.end();
  }
  return {
    url: scratch.toString(),
    drop: async () => {
      await admin.query(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}

/** A connection to a new scratch database; `close` disconnects and drops it. */
export async function createTestDatabase(
  options: ScratchOptions = {},
): Promise<{
  db: Database;
  close: () => Promise<void>;
}> {
  const scratch = await createScratchDatabase(options);
  const { db, close } = createDatabase(
    scratch.url,
    CONNECTION_TIMEOUT_MS,
    SCRATCH_POOL_SIZE,
  );
  return {
    db,
    close: async () => {
      await close();
      await scratch.drop();
    },
  };
}
