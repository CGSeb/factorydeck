import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { featureDetail, listFeatures } from '../features/query.ts';
import { collect } from '../git-host/collect.ts';
import { hasFactory } from '../ingest/factory.ts';
import { ingest } from '../ingest/ingest.ts';
import { usageOverview } from '../overview/query.ts';
import { loadWorkflowConfig } from '../roles/config.ts';
import { listRoles } from '../roles/query.ts';
import { sessionDetail } from '../sessions/query.ts';
import { listSkills, skillDetail } from '../skills/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { sessionsFolder } from '../test/session-logs.ts';
import {
  BUILD_SKILL,
  EXAMPLE_API,
  EXAMPLE_APP,
  EXAMPLE_APP_NAME,
  REVIEW_SKILL,
  SPEC_SKILL,
  demoProjectRoot,
  writeDemoConfig,
  writeDemoSessions,
} from './sessions.ts';
import {
  CODEX_BUILD_CALLS,
  CODEX_DEMO_CALLS,
  writeDemoCodexSessions,
} from './codex-sessions.ts';

const NOW = new Date('2026-03-12T15:30:00Z');
const STATE = { inactiveAfterMinutes: 30, now: NOW };

let db: Database;
let close: () => Promise<void>;
let projects: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  const codexFolder = await sessionsFolder();
  projects = await sessionsFolder();
  await writeDemoSessions(folder, NOW, projects);
  await writeDemoCodexSessions(
    codexFolder,
    NOW,
    demoProjectRoot(projects, EXAMPLE_APP),
  );
  await ingest(db, folder, { codexFolder, wsl: false });
});

afterEach(async () => {
  await close();
});

describe('demo sessions', () => {
  it('cover every case the overview shows', async () => {
    const all = await usageOverview(db, {
      period: 'all',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(all.projects.map((row) => row.project).sort()).toEqual([
      demoProjectRoot(projects, EXAMPLE_API),
      demoProjectRoot(projects, EXAMPLE_APP),
    ]);
    expect(
      Object.fromEntries(
        all.projects.map((row) => [row.project, row.projectName]),
      ),
    ).toEqual({
      [demoProjectRoot(projects, EXAMPLE_API)]: EXAMPLE_API,
      [demoProjectRoot(projects, EXAMPLE_APP)]: EXAMPLE_APP_NAME,
    });
    expect(all.totals.unknownPriceCalls).toBe(4 + CODEX_DEMO_CALLS);
    expect(all.models.map((row) => row.model)).toEqual(
      expect.arrayContaining(['', 'example-model-x', 'claude-haiku-demo']),
    );
    const week = await usageOverview(db, {
      period: '7d',
      timeZone: 'UTC',
      now: NOW,
    });
    const days = week.series.filter(
      (point) => point.opus + point.sonnet + point.haiku + point.other > 0,
    );
    expect(days.length).toBeGreaterThanOrEqual(5);
    expect(days.length).toBeLessThan(7);
    const today = await usageOverview(db, {
      period: 'today',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(today.totals.apiCalls).toBe(3 + CODEX_BUILD_CALLS);
  });

  it('cover roles, work items, a project override and a branch rule with the demo configuration', async () => {
    const path = join(await sessionsFolder(), 'factorydeck.yml');
    await writeDemoConfig(path, projects);
    const config = loadWorkflowConfig(path);
    const list = await listRoles(
      db,
      { period: 'all', timeZone: 'UTC', now: NOW },
      config,
    );
    expect(list.roles.map((row) => row.role).sort()).toEqual([
      'Explore',
      'api-builder',
      'bug-checker',
      'bug-reporter',
      'builder',
      'debugger',
      'explorer',
      'main',
      'reviewer',
      'shipper',
      'spec-writer',
      'unassigned',
      'worker',
    ]);
    const overview = await usageOverview(db, {
      period: 'all',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(list.apiCalls).toBe(overview.totals.apiCalls);
    const detail = await sessionDetail(db, 'demo-app-1', STATE, config);
    expect(detail?.workItem).toBe(11);
    expect(
      detail?.subAgents.map((agent) => [agent.role, agent.workItem]),
    ).toEqual([
      ['Explore', 11],
      ['unassigned', 11],
      ['reviewer', 11],
      ['builder', 11],
    ]);
    const api = await sessionDetail(db, 'demo-api-1', STATE, config);
    expect(api?.workItem).toBe(21);
    expect(api?.subAgents.map((agent) => [agent.role, agent.workItem])).toEqual(
      [['api-builder', 21]],
    );
    const spec = await sessionDetail(db, 'demo-app-spec', STATE, config);
    expect(spec?.workItem).toBe(31);
    const specs = await sessionDetail(db, 'demo-app-specs', STATE, config);
    expect(specs?.workItem).toBe(34);
    expect(
      specs?.subAgents.map((agent) => [agent.role, agent.workItem]),
    ).toEqual([['Explore', 33]]);
  });

  it('cover issues and requests of a GitHub and a GitLab project', async () => {
    const result = await collect(db, { hasFactory });
    expect(result).toMatchObject({ projects: 2, failures: [] });
    const options = { inactiveAfterMinutes: 30, now: NOW };
    const app = await sessionDetail(db, 'demo-app-2', options);
    expect(app?.issueDetail).toMatchObject({
      gitHost: 'github',
      number: 12,
      state: 'open',
      requests: [
        { number: 19, state: 'open', checks: 'failing' },
        { number: 18, state: 'closed', checks: 'failing' },
      ],
    });
    const draft = await sessionDetail(db, 'demo-app-3', options);
    expect(draft?.issueDetail?.requests).toMatchObject([
      { number: 20, draft: true, checks: 'pending' },
    ]);
    const missing = await sessionDetail(db, 'demo-app-6', options);
    expect(missing?.issue).toEqual({ status: 'not-found' });
    const none = await sessionDetail(db, 'demo-app-5', options);
    expect(none?.issueDetail?.requests).toEqual([]);
    const config = loadWorkflowConfig(join(await sessionsFolder(), 'none.yml'));
    const api = await sessionDetail(db, 'demo-api-1', options, {
      ...config,
      rules: {
        roles: [],
        workItems: [{ from: 'branch', pattern: /^[a-z]+\/(\d+)-/ }],
      },
    });
    expect(api?.issueDetail).toMatchObject({
      gitHost: 'gitlab',
      number: 21,
      state: 'closed',
      requests: [{ number: 3, state: 'merged', checks: 'passing' }],
    });
  });

  it('cover each kind of outcome', async () => {
    await collect(db, { hasFactory });
    const options = { inactiveAfterMinutes: 30, now: NOW };
    const outcomes = [];
    for (const id of [1, 2, 3, 4, 5].map((n) => `demo-app-${String(n)}`)) {
      outcomes.push(
        (await sessionDetail(db, id, options))?.issueDetail?.outcome,
      );
    }
    expect(outcomes).toEqual([
      {
        stage: 'merged',
        report: { score: 86, threshold: 80, rounds: 1 },
        reworked: false,
      },
      {
        stage: 'in-review',
        report: { score: 72, threshold: 80, rounds: 2 },
        reworked: true,
      },
      { stage: 'ready', report: null, reworked: false },
      { stage: 'blocked', report: null, reworked: false },
      { stage: 'open', report: null, reworked: false },
    ]);
    const config = loadWorkflowConfig(join(await sessionsFolder(), 'none.yml'));
    const branchRule = {
      ...config,
      rules: {
        roles: [],
        workItems: [{ from: 'branch' as const, pattern: /^[a-z]+\/(\d+)-/ }],
      },
    };
    const api = await sessionDetail(db, 'demo-api-1', options, branchRule);
    expect(api?.issueDetail?.outcome).toEqual({
      stage: 'merged-by-person',
      report: { score: 64, threshold: 80, rounds: 3 },
      reworked: false,
    });
  });
});

describe('demo sessions on the skills pages', () => {
  it('cover several skills, No skill, and launches today', async () => {
    const week = { period: '7d' as const, timeZone: 'UTC', now: NOW };
    const { skills, launches } = await listSkills(db, week);
    expect(skills.map((row) => row.skill)).toEqual(
      expect.arrayContaining([BUILD_SKILL, REVIEW_SKILL, SPEC_SKILL, null]),
    );
    expect(skills).toHaveLength(4);
    expect(launches).toBeGreaterThan(5);
    const build = await skillDetail(db, BUILD_SKILL, week);
    expect(build.series).toHaveLength(7);
    expect(
      build.series.filter((point) => point.launches > 0).length,
    ).toBeGreaterThanOrEqual(5);
    const today = await skillDetail(db, REVIEW_SKILL, {
      ...week,
      period: 'today',
    });
    expect(today.series).toHaveLength(16);
    expect(today.launches).toBe(2);
  });
});

describe('demo sessions on the features page', () => {
  it('cover an orchestration share across two issues', async () => {
    await collect(db, { hasFactory });
    const path = join(await sessionsFolder(), 'factorydeck.yml');
    await writeDemoConfig(path, projects);
    const config = loadWorkflowConfig(path);
    const app = demoProjectRoot(projects, EXAMPLE_APP);
    const query = { period: 'all' as const, timeZone: 'UTC', now: NOW };
    const list = await listFeatures(db, query, config);
    const shared = list.rows
      .filter((row) => row.orchestrationCostUsd !== null)
      .map((row) => [row.project, row.number, row.kind]);
    expect(shared).toEqual(
      expect.arrayContaining([
        [app, 13, 'feature'],
        [app, 14, 'bug'],
      ]),
    );
    expect(list.merged.issues).toBeGreaterThan(0);
    const helped = list.rows
      .filter((row) => row.outcome?.stage === 'merged-after-person')
      .map((row) => [row.project, row.number]);
    expect(helped).toEqual(
      expect.arrayContaining([
        [app, 24],
        [app, 25],
      ]),
    );
    expect(list.noWorkItem).not.toBeNull();
    const detail = await featureDetail(
      db,
      { project: app, number: 13 },
      query,
      { config, state: { inactiveAfterMinutes: 30, now: NOW } },
    );
    expect(detail?.orchestration?.threads).toBe(1);
    expect(detail?.sessions.map((row) => row.id)).toContain('demo-app-queue');
  });
});
