import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { project, rootRemote } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { DEFAULT_CONFIG, parseWorkflowConfig } from './config.ts';
import { listRoles } from './query.ts';

const config = parseWorkflowConfig(
  [
    'version: 1',
    'roles:',
    '  - name: builder',
    "    description: '^Build '",
    'projects:',
    '  /work/lib:',
    '    roles:',
    '      - name: writer',
    "        description: '^Write '",
  ].join('\n'),
  '/configs/factorydeck.yml',
);

const query = { period: 'all' as const, timeZone: 'UTC' };

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(project).values({
    name: 'Lib',
    slug: 'lib',
    remote: 'github.com/owner/lib',
    createdAt: new Date(),
  });
  await db
    .insert(rootRemote)
    .values({ root: '/work/lib', remote: 'github.com/owner/lib' });
});

afterAll(async () => {
  await close();
});

describe('order of the role list', () => {
  it('gives the configured roles of all projects, even with no activity', async () => {
    const list = await listRoles(db, query, config);
    expect(list.order).toEqual(['builder', 'writer']);
  });

  it('gives the roles that apply to the roots of the selected project', async () => {
    const lib = await listRoles(db, { ...query, project: 'lib' }, config);
    expect(lib.order).toEqual(['writer']);
    const app = await listRoles(db, { ...query, project: '/work/app' }, config);
    expect(app.order).toEqual(['builder']);
  });

  it('gives the default roles without a configuration file', async () => {
    const list = await listRoles(db, query, DEFAULT_CONFIG);
    expect(list.order).toEqual([
      'builder',
      'reviewer',
      'shipper',
      'reworker',
      'spec-checker',
      'debugger',
      'bug-checker',
    ]);
  });
});
