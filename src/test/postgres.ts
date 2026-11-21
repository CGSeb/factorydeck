import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { loadRootEnvFile } from '../config/env.ts';
import { type Database, createDatabase } from '../db/client.ts';

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

/** A new, migrated database on the test server, dropped by `drop`. */
export async function createScratchDatabase(): Promise<{
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
  const { db, close } = createDatabase(scratch.toString());
  await migrate(db, {
    migrationsFolder: join(import.meta.dirname, '..', '..', 'drizzle'),
  });
  await close();
  return {
    url: scratch.toString(),
    drop: async () => {
      await admin.query(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}

/** A connection to a new scratch database; `close` disconnects and drops it. */
export async function createTestDatabase(): Promise<{
  db: Database;
  close: () => Promise<void>;
}> {
  const scratch = await createScratchDatabase();
  const { db, close } = createDatabase(scratch.url);
  return {
    db,
    close: async () => {
      await close();
      await scratch.drop();
    },
  };
}
