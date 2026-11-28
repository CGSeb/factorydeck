import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { project, rootRemote } from '../db/schema.ts';
import {
  EXAMPLE_API,
  EXAMPLE_APP,
  EXAMPLE_APP_NAME,
  demoProjectRoot,
} from './sessions.ts';

export const DEMO_PROJECTS = [
  {
    folder: EXAMPLE_APP,
    name: EXAMPLE_APP_NAME,
    slug: EXAMPLE_APP,
    remote: `github.com/example/${EXAMPLE_APP}`,
  },
  {
    folder: EXAMPLE_API,
    name: EXAMPLE_API,
    slug: EXAMPLE_API,
    remote: `gitlab.com/example/${EXAMPLE_API}`,
  },
] as const;

export async function recordDemoRemotes(
  db: Database,
  projects: string,
): Promise<void> {
  await db
    .insert(rootRemote)
    .values(
      DEMO_PROJECTS.map(({ folder, remote }) => ({
        root: demoProjectRoot(projects, folder),
        remote,
      })),
    )
    .onConflictDoUpdate({
      target: rootRemote.root,
      set: { remote: sql`excluded.remote` },
    });
}

export async function addDemoProjects(db: Database, now: Date): Promise<void> {
  await db
    .insert(project)
    .values(
      DEMO_PROJECTS.map(({ name, slug, remote }) => ({
        name,
        slug,
        remote,
        createdAt: now,
      })),
    )
    .onConflictDoNothing();
}
