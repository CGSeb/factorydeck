import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { loadRootEnvFile } from '../config/env.ts';
import { createDatabase } from '../db/client.ts';

/** URL of the PostgreSQL server of the root `.env`, if any: some tests need a real server. */
export function postgresUrl(): string | undefined {
  loadRootEnvFile();
  return process.env['DATABASE_URL'];
}

/** A new, migrated database on the server of `url`, dropped by `drop`. */
export async function createScratchDatabase(url: string): Promise<{
  url: string;
  drop: () => Promise<void>;
}> {
  const name = `factorydeck_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`create database ${name}`);
  const scratch = new URL(url);
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
