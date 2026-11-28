import { eq, sql } from 'drizzle-orm';
import type { FieldError } from '../auth/types.ts';
import type { Database } from '../db/client.ts';
import { project } from '../db/schema.ts';
import {
  type AddProjectResult,
  type NewProject,
  type ProjectFields,
  type TeamProject,
  NAME_LENGTH_ERROR,
  NAME_TYPE_ERROR,
  NOT_A_REMOTE,
} from './project-types.ts';
import { byProjectOrder } from './project-order.ts';
import { freeSlug, parseRemote, slugBase } from './remote.ts';

export const MAX_NAME_LENGTH = 80;
const PROJECT_LOCK = 1_990_002;

export interface ProjectStore {
  list: () => Promise<TeamProject[]>;
  add: (fields: NewProject, by: number) => Promise<AddProjectResult>;
}

type NameField = { ok: true; name: string } | ({ ok: false } & FieldError);

function nameOf(value: unknown, repository: string): NameField {
  if (value === undefined || value === null) {
    return { ok: true, name: repository.slice(0, MAX_NAME_LENGTH) };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: NAME_TYPE_ERROR, field: 'name' };
  }
  const name = value.trim();
  if (name === '') {
    return { ok: true, name: repository.slice(0, MAX_NAME_LENGTH) };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: NAME_LENGTH_ERROR, field: 'name' };
  }
  return { ok: true, name };
}

export function projectFields(body: Record<string, unknown>): ProjectFields {
  const remote = body['remote'];
  const parsed = typeof remote === 'string' ? parseRemote(remote) : undefined;
  if (parsed === undefined) {
    return { ok: false, error: NOT_A_REMOTE, field: 'remote' };
  }
  const name = nameOf(body['name'], parsed.repository);
  if (!name.ok) return name;
  return {
    ok: true,
    value: {
      name: name.name,
      remote: parsed.remote,
      slug: slugBase(parsed.repository),
    },
  };
}

function rowOf(row: typeof project.$inferSelect): TeamProject {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    remote: row.remote,
    createdAt: row.createdAt.toISOString(),
  };
}

export function projectStore(
  db: Database,
  now: () => Date = () => new Date(),
): ProjectStore {
  return {
    list: async () =>
      (await db.select().from(project)).map(rowOf).sort(byProjectOrder),
    add: (fields, by) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${PROJECT_LOCK})`);
        const [existing] = await tx
          .select({ name: project.name })
          .from(project)
          .where(eq(project.remote, fields.remote))
          .limit(1);
        if (existing !== undefined) {
          return { status: 'exists', name: existing.name } as const;
        }
        const taken = await tx.select({ slug: project.slug }).from(project);
        const [row] = await tx
          .insert(project)
          .values({
            name: fields.name,
            slug: freeSlug(fields.slug, new Set(taken.map(({ slug }) => slug))),
            remote: fields.remote,
            createdAt: now(),
            createdBy: by,
          })
          .returning();
        if (row === undefined) throw new Error('Project not added');
        return { status: 'added', project: rowOf(row) } as const;
      }),
  };
}
