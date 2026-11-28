import { existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { project, rootRemote } from '../db/schema.ts';
import { fakeGitHostToken } from './fake-git-host.ts';
import { giveFakeToken } from './fake-git-host-token.ts';
import type { StoredRoleRule } from '../roles/default-roles.ts';
import {
  insertDefaultRoleRules,
  roleRuleStore,
} from '../roles/project-rules.ts';
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
    remote: `github.com/example-org/${EXAMPLE_APP}`,
  },
  {
    folder: EXAMPLE_API,
    name: EXAMPLE_API,
    slug: EXAMPLE_API,
    remote: `gitlab.com/example-group/${EXAMPLE_API}`,
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

const API_ROLE_RULES: StoredRoleRule[] = [
  { name: 'api-builder', description: '^Add ', agentType: null },
];

export async function addDemoProjects(
  db: Database,
  now: Date,
  projects?: string,
): Promise<void> {
  const added = await db
    .insert(project)
    .values(
      DEMO_PROJECTS.map(({ name, slug, remote }) => ({
        name,
        slug,
        remote,
        createdAt: now,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: project.id, slug: project.slug });
  for (const { id, slug } of added) {
    if (slug === EXAMPLE_API) {
      await roleRuleStore(db).replace(id, API_ROLE_RULES);
    } else await insertDefaultRoleRules(db, id);
  }
  if (projects !== undefined) await giveDemoTokens(db, projects);
}

export async function giveDemoTokens(
  db: Database,
  projects: string,
): Promise<void> {
  for (const name of [EXAMPLE_APP, EXAMPLE_API]) {
    const root = demoProjectRoot(projects, name);
    if (existsSync(fakeGitHostToken(root))) await giveFakeToken(db, root);
  }
}
