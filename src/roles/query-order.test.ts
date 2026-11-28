import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { project } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { DEFAULT_CONFIG } from './config.ts';
import { roleRuleStore } from './project-rules.ts';
import { listRoles } from './query.ts';

const query = { period: 'all' as const, timeZone: 'UTC' };

let db: Database;
let close: () => Promise<void>;

async function addProject(name: string, slug: string): Promise<number> {
  const [row] = await db
    .insert(project)
    .values({
      name,
      slug,
      remote: `github.com/owner/${slug}`,
      createdAt: new Date(),
    })
    .returning({ id: project.id });
  if (row === undefined) throw new Error('Project not added');
  return row.id;
}

function rule(name: string) {
  return { name, description: `^${name} `, agentType: null };
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase({ linkRoots: false }));
  const store = roleRuleStore(db);
  await store.replace(await addProject('Zeta', 'zeta'), [
    rule('writer'),
    rule('builder'),
  ]);
  await store.replace(await addProject('Alpha', 'alpha'), [
    rule('builder'),
    rule('reviewer'),
  ]);
  await addProject('Empty', 'empty');
});

afterAll(async () => {
  await close();
});

describe('order of the role list', () => {
  it('gives the roles of all projects by project name, then position, once each, even with no activity', async () => {
    const list = await listRoles(db, query, DEFAULT_CONFIG);
    expect(list.order).toEqual(['builder', 'reviewer', 'writer']);
  });

  it('gives the role rules of the selected project in their order', async () => {
    const zeta = await listRoles(
      db,
      { ...query, project: 'zeta' },
      DEFAULT_CONFIG,
    );
    expect(zeta.order).toEqual(['writer', 'builder']);
    const empty = await listRoles(
      db,
      { ...query, project: 'empty' },
      DEFAULT_CONFIG,
    );
    expect(empty.order).toEqual([]);
  });
});
