import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostProject, project, rootRemote, session } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { projectNames } from './names.ts';
import { factoryStatus } from './remove.ts';

const NOW = new Date('2026-03-12T15:30:00Z');

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase({ linkRoots: false }));
});

afterEach(async () => {
  await close();
});

async function addProject(
  slug: string,
  name: string,
  roots: string[] = [],
): Promise<void> {
  const remote = `github.com/owner/${slug}`;
  await db.insert(project).values({ name, slug, remote, createdAt: NOW });
  for (const root of roots) {
    await db.insert(rootRemote).values({ root, remote });
  }
}

describe('project names', () => {
  it('names a project by its name of /projects and lists every project by name', async () => {
    await addProject('shop', 'Shop', ['/work/shop']);
    await addProject('lib', 'alpha');
    const names = await projectNames(db);

    expect(names.label('shop')).toBe('Shop');
    expect(names.options()).toEqual([
      { project: 'lib', name: 'alpha' },
      { project: 'shop', name: 'Shop' },
    ]);
  });

  it('shows the slug after a name shared by two projects, case-insensitively', async () => {
    await addProject('web', 'Shop');
    await addProject('api', 'shop');
    await addProject('lib', 'Alpha');
    const names = await projectNames(db);

    expect(names.label('web')).toBe('Shop (web)');
    expect(names.label('api')).toBe('shop (api)');
    expect(names.options()).toEqual([
      { project: 'lib', name: 'Alpha' },
      { project: 'api', name: 'shop (api)' },
      { project: 'web', name: 'Shop (web)' },
    ]);
  });

  it('names an unknown slug by itself, and a root by its project or else its folder', async () => {
    await addProject('shop', 'Shop', ['/work/web', '/home/dev/shop']);
    const names = await projectNames(db);

    expect(names.label('nope')).toBe('nope');
    expect(names.rootLabel('/home/dev/shop')).toBe('Shop');
    expect(names.rootLabel('/work/stray')).toBe('stray');
  });
});

describe('factory status', () => {
  it('names a root whose factory is gone by its project, and lists bug tickets by slug', async () => {
    await addProject('shop', 'Shop', ['/work/web']);
    await db.insert(session).values([
      { id: 'w1', project: '/work/web' },
      { id: 's1', project: '/work/stray' },
    ]);
    await db.insert(gitHostProject).values({
      remote: 'github.com/owner/shop',
      syncedFrom: NOW,
      bugLabel: 'bug',
    });
    const status = await factoryStatus(db, () => Promise.resolve(false));

    expect(
      status.missing.map(({ project: root, name }) => [root, name]),
    ).toEqual([
      ['/work/web', 'Shop'],
      ['/work/stray', 'stray'],
    ]);
    expect(status.projects).toEqual([{ project: 'shop', name: 'Shop' }]);
    expect(status.bugTickets).toEqual(['shop']);
  });
});
