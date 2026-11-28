import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { project, projectRule } from '../db/schema.ts';
import type { Transaction } from '../ingest/store.ts';
import type { RoleRule, WorkflowConfig } from './config.ts';
import {
  DEFAULT_ROLE_RULES,
  type StoredRoleRule,
  compiledRoleRule,
} from './default-roles.ts';

export const ROLE_KIND = 'role';

export interface RoleRuleStore {
  rules: (projectId: number) => Promise<StoredRoleRule[] | undefined>;
  replace: (
    projectId: number,
    rules: readonly StoredRoleRule[],
  ) => Promise<StoredRoleRule[] | undefined>;
}

const storedColumns = {
  name: projectRule.name,
  description: projectRule.description,
  agentType: projectRule.agentType,
};

function storedOf(row: {
  name: string | null;
  description: string | null;
  agentType: string | null;
}): StoredRoleRule {
  return {
    name: row.name ?? '',
    description: row.description,
    agentType: row.agentType,
  };
}

async function insertRoleRules(
  tx: Database | Transaction,
  projectId: number,
  rules: readonly StoredRoleRule[],
): Promise<void> {
  if (rules.length === 0) return;
  await tx.insert(projectRule).values(
    rules.map((rule, position) => ({
      projectId,
      kind: ROLE_KIND,
      position,
      name: rule.name,
      description: rule.description,
      agentType: rule.agentType,
    })),
  );
}

export function insertDefaultRoleRules(
  tx: Database | Transaction,
  projectId: number,
): Promise<void> {
  return insertRoleRules(tx, projectId, DEFAULT_ROLE_RULES);
}

async function rulesOf(
  db: Database | Transaction,
  projectId: number,
): Promise<StoredRoleRule[]> {
  const rows = await db
    .select(storedColumns)
    .from(projectRule)
    .where(
      and(
        eq(projectRule.projectId, projectId),
        eq(projectRule.kind, ROLE_KIND),
      ),
    )
    .orderBy(asc(projectRule.position));
  return rows.map(storedOf);
}

export function roleRuleStore(db: Database): RoleRuleStore {
  return {
    rules: async (projectId) => {
      const [found] = await db
        .select({ id: project.id })
        .from(project)
        .where(eq(project.id, projectId))
        .limit(1);
      return found === undefined ? undefined : rulesOf(db, projectId);
    },
    replace: (projectId, rules) =>
      db.transaction(async (tx) => {
        const [found] = await tx
          .select({ id: project.id })
          .from(project)
          .where(eq(project.id, projectId))
          .for('update');
        if (found === undefined) return undefined;
        await tx
          .delete(projectRule)
          .where(
            and(
              eq(projectRule.projectId, projectId),
              eq(projectRule.kind, ROLE_KIND),
            ),
          );
        await insertRoleRules(tx, projectId, rules);
        return rulesOf(tx, projectId);
      }),
  };
}

export async function roleRulesByProject(
  db: Database,
): Promise<Map<string, RoleRule[]>> {
  const rows = await db
    .select({ slug: project.slug, ...storedColumns })
    .from(project)
    .leftJoin(
      projectRule,
      and(
        eq(projectRule.projectId, project.id),
        eq(projectRule.kind, ROLE_KIND),
      ),
    )
    .orderBy(asc(project.slug), asc(projectRule.position));
  const bySlug = new Map<string, RoleRule[]>();
  for (const row of rows) {
    const rules = bySlug.get(row.slug) ?? [];
    if (row.name !== null) rules.push(compiledRoleRule(storedOf(row)));
    bySlug.set(row.slug, rules);
  }
  return bySlug;
}

export async function withProjectRoles(
  db: Database,
  config: WorkflowConfig,
): Promise<WorkflowConfig> {
  return { ...config, projectRoles: await roleRulesByProject(db) };
}

export async function roleOrder(
  db: Database,
  slug: string | undefined,
): Promise<string[]> {
  const rows = await db
    .select({ name: projectRule.name })
    .from(projectRule)
    .innerJoin(project, eq(project.id, projectRule.projectId))
    .where(
      and(
        eq(projectRule.kind, ROLE_KIND),
        slug === undefined ? sql`true` : eq(project.slug, slug),
      ),
    )
    .orderBy(asc(project.name), asc(project.slug), asc(projectRule.position));
  return [
    ...new Set(rows.flatMap(({ name }) => (name === null ? [] : [name]))),
  ];
}
