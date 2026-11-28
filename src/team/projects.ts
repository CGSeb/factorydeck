import { and, count, eq, ne, sql } from 'drizzle-orm';
import type { FieldError } from '../auth/types.ts';
import type { Database } from '../db/client.ts';
import { project, projectSession } from '../db/schema.ts';
import type { Transaction } from '../ingest/store.ts';
import {
  type AddProjectResult,
  type ListedProject,
  type NewProject,
  type ProjectChangeFields,
  type ProjectChanges,
  type ProjectFields,
  type RemoveProjectResult,
  type TeamProject,
  type UpdateProjectResult,
  NAME_LENGTH_ERROR,
  NAME_REQUIRED,
  NAME_TYPE_ERROR,
  NOT_A_REMOTE,
} from './project-types.ts';
import { insertDefaultRoleRules } from '../roles/project-rules.ts';
import { byProjectOrder } from './project-order.ts';
import { freeSlug, parseRemote, slugBase } from './remote.ts';
import { PROJECT_LOCK, removeProject } from './remove-project.ts';

export const MAX_NAME_LENGTH = 80;

export interface ProjectStore {
  list: () => Promise<ListedProject[]>;
  add: (fields: NewProject, by: number) => Promise<AddProjectResult>;
  update: (id: number, changes: ProjectChanges) => Promise<UpdateProjectResult>;
  remove: (id: number) => Promise<RemoveProjectResult>;
}

export interface ProjectStoreOptions {
  removeLockTimeoutMs?: number;
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

export function projectChanges(
  body: Record<string, unknown>,
): ProjectChangeFields {
  const changes: ProjectChanges = {};
  if ('remote' in body) {
    const remote = body['remote'];
    const parsed = typeof remote === 'string' ? parseRemote(remote) : undefined;
    if (parsed === undefined) {
      return { ok: false, error: NOT_A_REMOTE, field: 'remote' };
    }
    changes.remote = parsed.remote;
  }
  if ('name' in body) {
    const value = body['name'];
    if (typeof value !== 'string') {
      return { ok: false, error: NAME_TYPE_ERROR, field: 'name' };
    }
    const name = value.trim();
    if (name === '') return { ok: false, error: NAME_REQUIRED, field: 'name' };
    if (name.length > MAX_NAME_LENGTH) {
      return { ok: false, error: NAME_LENGTH_ERROR, field: 'name' };
    }
    changes.name = name;
  }
  return { ok: true, value: changes };
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

async function sessionCounts(
  db: Database | Transaction,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ project: projectSession.project, sessions: count() })
    .from(projectSession)
    .groupBy(projectSession.project);
  return new Map(rows.map((row) => [row.project, row.sessions]));
}

function listedOf(
  row: typeof project.$inferSelect,
  counts: Map<string, number>,
): ListedProject {
  return { ...rowOf(row), sessions: counts.get(row.slug) ?? 0 };
}

async function updateProject(
  tx: Transaction,
  id: number,
  changes: ProjectChanges,
): Promise<UpdateProjectResult> {
  await tx.execute(sql`select pg_advisory_xact_lock(${PROJECT_LOCK})`);
  const [current] = await tx
    .select({ id: project.id })
    .from(project)
    .where(eq(project.id, id))
    .limit(1);
  if (current === undefined) return { status: 'missing' };
  if (changes.remote !== undefined) {
    const [other] = await tx
      .select({ name: project.name })
      .from(project)
      .where(and(eq(project.remote, changes.remote), ne(project.id, id)))
      .limit(1);
    if (other !== undefined) return { status: 'exists', name: other.name };
  }
  const [row] =
    changes.name === undefined && changes.remote === undefined
      ? await tx.select().from(project).where(eq(project.id, id))
      : await tx
          .update(project)
          .set(changes)
          .where(eq(project.id, id))
          .returning();
  if (row === undefined) return { status: 'missing' };
  return { status: 'updated', project: listedOf(row, await sessionCounts(tx)) };
}

export function projectStore(
  db: Database,
  now: () => Date = () => new Date(),
  { removeLockTimeoutMs }: ProjectStoreOptions = {},
): ProjectStore {
  return {
    list: async () => {
      const [rows, counts] = await Promise.all([
        db.select().from(project),
        sessionCounts(db),
      ]);
      return rows.map((row) => listedOf(row, counts)).sort(byProjectOrder);
    },
    update: (id, changes) =>
      db.transaction((tx) => updateProject(tx, id, changes)),
    remove: (id) => removeProject(db, id, now(), removeLockTimeoutMs),
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
        await insertDefaultRoleRules(tx, row.id);
        return { status: 'added', project: rowOf(row) } as const;
      }),
  };
}
