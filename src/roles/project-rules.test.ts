import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { eq } from 'drizzle-orm';
import {
  apiCall,
  project,
  rootRemote,
  session,
  subAgent,
} from '../db/schema.ts';
import { sessionDetail } from '../sessions/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { roleRule } from '../test/role-rules.ts';
import {
  DEFAULT_CONFIG,
  DEFAULT_RULES,
  parseWorkflowConfig,
  roleOf,
  rulesFor,
} from './config.ts';
import { DEFAULT_ROLE_RULES } from './default-roles.ts';
import { roleRuleStore, withProjectRoles } from './project-rules.ts';
import { listRoles } from './query.ts';

const AT = new Date('2026-03-12T10:00:00Z');
const query = { period: 'all' as const, timeZone: 'UTC' };

let db: Database;
let close: () => Promise<void>;
let request = 0;

function call(sessionId: string, subAgentId: string | null) {
  request += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(request)}`,
    sessionId,
    subAgentId,
    at: AT,
    model: 'claude-sonnet-9',
    inputTokens: 10,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
  };
}

async function projectId(slug: string): Promise<number> {
  const rows = await db.select().from(project);
  const row = rows.find((candidate) => candidate.slug === slug);
  if (row === undefined) throw new Error(`No project ${slug}`);
  return row.id;
}

async function rolesOf(slug: string): Promise<string[]> {
  const list = await listRoles(
    db,
    { ...query, project: slug },
    await withProjectRoles(db, DEFAULT_CONFIG),
  );
  return list.roles.map((row) => row.role).sort();
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(session).values([
    { id: 'app-1', project: '/work/app', firstAt: AT, lastAt: AT },
    { id: 'lib-1', project: '/work/lib', firstAt: AT, lastAt: AT },
  ]);
  const agent = (sessionId: string, id: string, description: string) => ({
    sessionId,
    id,
    agentType: 'general-purpose',
    description,
    firstAt: AT,
  });
  await db
    .insert(subAgent)
    .values([
      agent('app-1', 'build', 'Build #12 export'),
      agent('app-1', 'review', 'Review #12'),
      agent('lib-1', 'build', 'Build #3 crash'),
    ]);
  await db
    .insert(apiCall)
    .values([
      call('app-1', null),
      call('app-1', 'build'),
      call('app-1', 'review'),
      call('lib-1', null),
      call('lib-1', 'build'),
    ]);
});

afterAll(async () => {
  await close();
});

describe('role rules of a project', () => {
  it('give a project with no role row no role rule, never the defaults', async () => {
    expect(await rolesOf('/work/app')).toEqual(['general-purpose', 'main']);
    expect(await roleRuleStore(db).rules(await projectId('/work/app'))).toEqual(
      [],
    );
  });

  it('change the roles of stored threads at once, project by project', async () => {
    const store = roleRuleStore(db);
    await store.replace(await projectId('/work/app'), DEFAULT_ROLE_RULES);
    await store.replace(await projectId('/work/lib'), [
      { name: 'maker', description: '^Build ', agentType: null },
    ]);
    expect(await rolesOf('/work/app')).toEqual(['builder', 'main', 'reviewer']);
    expect(await rolesOf('/work/lib')).toEqual(['main', 'maker']);

    await store.replace(await projectId('/work/app'), [
      { name: 'coder', description: '^(Build|Worker for) ', agentType: null },
    ]);
    expect(await rolesOf('/work/app')).toEqual([
      'coder',
      'general-purpose',
      'main',
    ]);
    expect(await rolesOf('/work/lib')).toEqual(['main', 'maker']);
    const detail = await sessionDetail(
      db,
      'app-1',
      { inactiveAfterMinutes: 30, now: AT },
      await withProjectRoles(db, DEFAULT_CONFIG),
    );
    expect(detail?.subAgents.map((agent) => agent.role).sort()).toEqual([
      'coder',
      'general-purpose',
    ]);
  });

  it('ignore the roles of factorydeck.yml and keep its work items', async () => {
    const file = parseWorkflowConfig(
      [
        'version: 1',
        'roles:',
        '  - name: filed',
        "    description: '^Build '",
        'projects:',
        '  /work/lib:',
        '    roles:',
        '      - name: filed',
        "        description: '^Build '",
        '    work_items:',
        '      - from: branch',
        "        pattern: '^[a-z]+/(\\d+)-'",
      ].join('\n'),
      '/configs/factorydeck.yml',
    );
    const config = await withProjectRoles(db, file);
    expect(
      rulesFor(config, '/work/lib', '/work/lib').roles.map((rule) => rule.name),
    ).toEqual(['maker']);
    expect(
      rulesFor(config, '/work/lib', '/work/lib').workItems.map(
        (rule) => rule.from,
      ),
    ).toEqual(['branch']);
    const list = await listRoles(db, query, config);
    expect(list.roles.map((row) => row.role)).not.toContain('filed');
  });

  it('follow a session linked to its project by its own remote', async () => {
    await db.insert(session).values({
      id: 'cli-1',
      project: '/cli/app',
      remote: 'github.com/owner/cli',
      firstAt: AT,
      lastAt: AT,
    });
    await db.delete(rootRemote).where(eq(rootRemote.root, '/cli/app'));
    await db.delete(project).where(eq(project.slug, '/cli/app'));
    const [cli] = await db
      .insert(project)
      .values({
        name: 'Cli',
        slug: 'cli',
        remote: 'github.com/owner/cli',
        createdAt: AT,
      })
      .returning({ id: project.id });
    await db.insert(subAgent).values({
      sessionId: 'cli-1',
      id: 'build',
      agentType: 'general-purpose',
      description: 'Build #5',
      firstAt: AT,
    });
    await db.insert(apiCall).values(call('cli-1', 'build'));
    await roleRuleStore(db).replace(cli?.id ?? 0, [
      { name: 'cli-maker', description: '^Build ', agentType: null },
    ]);
    expect(await rolesOf('cli')).toEqual(['cli-maker', 'main']);
  });

  it('give a session of no project the default role rules', async () => {
    const config = await withProjectRoles(db, DEFAULT_CONFIG);
    const rules = rulesFor(config, '/work/elsewhere');
    expect(rules.roles).toEqual(DEFAULT_RULES.roles);
    expect(
      roleOf(rules, { agentType: 'general-purpose', description: 'Review #1' }),
    ).toBe('reviewer');
  });

  it('match patterns case-insensitively, anywhere unless anchored, with both patterns needed', () => {
    const rules = {
      ...DEFAULT_RULES,
      roles: [
        roleRule('both', 'spec', '^general-purpose$'),
        roleRule('anywhere', 'spec'),
      ],
    };
    const of = (agentType: string, description: string) =>
      roleOf(rules, { agentType, description });
    expect(of('general-purpose', 'Run CHECK-SPEC')).toBe('both');
    expect(of('Explore', 'Run check-spec')).toBe('anywhere');
  });
});
