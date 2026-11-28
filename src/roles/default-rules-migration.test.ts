import { cp, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/client.ts';
import { createScratchDatabase } from '../test/postgres.ts';
import { DEFAULT_ROLE_RULES } from './default-roles.ts';

const MIGRATIONS = join(import.meta.dirname, '..', '..', 'drizzle');
const FIRST_RULE_MIGRATION = '20261128122041_project_rules';

let url: string;
let drop: () => Promise<void>;

async function migrationsBefore(name: string): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'factorydeck-migrations-'));
  for (const entry of await readdir(MIGRATIONS)) {
    if (entry < name)
      await cp(join(MIGRATIONS, entry), join(folder, entry), {
        recursive: true,
      });
  }
  return folder;
}

async function migrated(folder: string): Promise<void> {
  const { db, close } = createDatabase(url);
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await close();
  }
}

async function query<T>(text: string): Promise<T[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(text)).rows as T[];
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  ({ url, drop } = await createScratchDatabase({ migrate: false }));
});

afterAll(async () => {
  await drop();
});

describe('the role rules migration', () => {
  it('gives every existing project the default role rules, in their order', async () => {
    await migrated(await migrationsBefore(FIRST_RULE_MIGRATION));
    await query(
      `insert into project (name, slug, remote, created_at) values
        ('Shop', 'shop', 'github.com/owner/shop', now()),
        ('Store', 'store', 'github.com/owner/store', now())`,
    );
    await migrated(MIGRATIONS);
    const rows = await query<{
      slug: string;
      kind: string;
      position: number;
      name: string;
      description: string | null;
      agent_type: string | null;
    }>(
      `select p.slug, r.kind, r.position, r.name, r.description, r.agent_type
        from project_rule r join project p on p.id = r.project_id
        order by p.slug, r.position`,
    );
    const expected = (slug: string) =>
      DEFAULT_ROLE_RULES.map((rule, position) => ({
        slug,
        kind: 'role',
        position,
        name: rule.name,
        description: rule.description,
        agent_type: rule.agentType,
      }));
    expect(rows).toEqual([...expected('shop'), ...expected('store')]);
  });
});
