import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { ingest } from '../ingest/ingest.ts';
import { usageOverview } from '../overview/query.ts';
import { sessionDetail } from '../sessions/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  type Line,
  assistant,
  minute,
  sessionsFolder,
  skillCall,
  skillInstructions,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { listSkills, sessionSkills, skillDetail } from './query.ts';
import type { SkillUsage } from './types.ts';

const SONNET = 'claude-sonnet-example';

let db: Database;
let close: () => Promise<void>;
let folder: string;
let request = 0;

function main(
  id: string,
  project: string,
): (at: number) => {
  uuid: string;
  at: number;
  cwd: string;
} {
  return (at) => ({ uuid: `${id}-${at}`, at, cwd: join(folder, project) });
}

function call(
  ctx: { uuid: string; at: number },
  skill?: string,
): Record<string, unknown> {
  request += 1;
  return assistant(ctx, {
    requestId: `req_${request}`,
    model: SONNET,
    tokens: [100, 0, 0, 10],
    ...(skill === undefined ? {} : { content: [skillCall(skill)] }),
  });
}

async function writeSession(
  id: string,
  lines: (at: ReturnType<typeof main>) => Line[],
  project = 'app',
): Promise<void> {
  await writeLog(join(folder, 'logs', `${id}.jsonl`), lines(main(id, project)));
}

async function writeSubAgent(
  sessionId: string,
  agentId: string,
  lines: (at: (n: number) => { uuid: string; at: number }) => Line[],
): Promise<void> {
  await writeLog(
    join(folder, 'logs', sessionId, 'subagents', `agent-${agentId}.jsonl`),
    lines((at) => ({ uuid: `${agentId}-${at}`, at, sidechain: true })),
  );
}

function callsBySkill(rows: SkillUsage[]): Record<string, number> {
  return Object.fromEntries(
    rows
      .filter((row) => row.apiCalls > 0)
      .map((row) => [row.skill ?? 'No skill', row.apiCalls]),
  );
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  folder = await sessionsFolder();
  await writeSession('notification', (at) => [
    userText(at(0), 'Write the spec'),
    call(at(1), 'kit:write-spec'),
    call(at(2)),
    userText(
      at(3),
      '<task-notification>\n<task-id>b1</task-id>\n</task-notification>',
    ),
    call(at(4)),
    userText(at(5), 'Thanks'),
    call(at(6)),
  ]);
  await writeSession('two-in-a-row', (at) => [
    userText(at(0), 'Go'),
    call(at(1), 'kit:write-spec'),
    call(at(2)),
    call(at(3), 'kit:check-spec'),
    call(at(4)),
  ]);
  await writeSession('slash', (at) => [
    userText(
      { ...at(0), promptId: 'p1' },
      '<command-message>kit:review</command-message>\n<command-name>/kit:review</command-name>',
    ),
    skillInstructions({ ...at(0), uuid: 'slash-meta', promptId: 'p1' }),
    call(at(1)),
    call(at(2)),
    userText(at(3), 'Now something else'),
    call(at(4)),
  ]);
  await writeSession('sub-agent', (at) => [
    userText(at(0), 'Build'),
    call(at(1), 'kit:build'),
    call(at(2)),
    userText(at(5), 'Unrelated question'),
    call(at(6)),
  ]);
  await writeSubAgent('sub-agent', 'a1', (at) => [
    userText(at(3), 'Explore'),
    call(at(3)),
    call(at(4)),
    call(at(7)),
  ]);
  await writeSession('skill-in-sub-agent', (at) => [
    userText(at(0), 'Build'),
    call(at(1), 'kit:build'),
    call(at(2)),
  ]);
  await writeSubAgent('skill-in-sub-agent', 'a2', (at) => [
    userText(at(3), 'Check'),
    call(at(3)),
    call(at(4), 'kit:check-spec'),
    call(at(5)),
  ]);
  await writeSession('overnight', (at) => [
    userText(at(0), 'Late work'),
    call(at(1), 'kit:late'),
    call(at(24 * 60 + 1)),
  ]);
  await writeSession(
    'no-skill',
    (at) => [userText(at(0), 'Hi'), call(at(1)), call(at(2))],
    'lib',
  );
  await ingest(db, join(folder, 'logs'));
});

afterAll(async () => {
  await close();
});

describe('skill attribution', () => {
  it('keeps the skill through a task notification, until the next prompt', async () => {
    expect(callsBySkill(await sessionSkills(db, 'notification'))).toEqual({
      'kit:write-spec': 2,
      'No skill': 2,
    });
  });

  it('ends a skill at the next skill launch', async () => {
    expect(callsBySkill(await sessionSkills(db, 'two-in-a-row'))).toEqual({
      'No skill': 1,
      'kit:write-spec': 2,
      'kit:check-spec': 1,
    });
  });

  it('starts a slash skill with the prompt that types it', async () => {
    expect(callsBySkill(await sessionSkills(db, 'slash'))).toEqual({
      'kit:review': 2,
      'No skill': 1,
    });
  });

  it('gives a sub-agent started inside a skill to that skill, prompts after included', async () => {
    expect(callsBySkill(await sessionSkills(db, 'sub-agent'))).toEqual({
      'kit:build': 4,
      'No skill': 2,
    });
  });

  it('follows a skill launched inside a sub-agent from the parent skill', async () => {
    expect(callsBySkill(await sessionSkills(db, 'skill-in-sub-agent'))).toEqual(
      {
        'No skill': 1,
        'kit:build': 3,
        'kit:check-spec': 1,
      },
    );
  });

  it('gives calls before any skill to No skill', async () => {
    const rows = await sessionSkills(db, 'no-skill');
    expect(rows).toMatchObject([
      {
        skill: null,
        launches: 0,
        sessions: 0,
        apiCalls: 2,
        tokens: 220,
        averageCostUsd: null,
      },
    ]);
    expect(rows[0]?.costUsd).toBeCloseTo(0.0006, 10);
  });

  it('adds up to the session totals', async () => {
    const detail = await sessionDetail(db, 'skill-in-sub-agent', {
      inactiveAfterMinutes: 30,
    });
    const rows = detail?.skills ?? [];
    const { input, cacheWrite, cacheRead, output } = detail?.tokens ?? {
      input: 0,
      cacheWrite: 0,
      cacheRead: 0,
      output: 0,
    };
    expect(rows.reduce((sum, row) => sum + row.tokens, 0)).toBe(
      input + cacheWrite + cacheRead + output,
    );
    expect(rows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0)).toBeCloseTo(
      detail?.costUsd ?? -1,
      10,
    );
  });

  it('counts launches per skill in a session, every thread included', async () => {
    const rows = await sessionSkills(db, 'skill-in-sub-agent');
    expect(
      rows.map(({ skill, launches }) => ({ skill, launches })),
    ).toContainEqual({ skill: 'kit:check-spec', launches: 1 });
  });
});

describe('listSkills', () => {
  const query = { period: 'all', timeZone: 'UTC', now: new Date(minute(60)) };

  it('adds up to the overview totals, for all projects and for one', async () => {
    const overview = await usageOverview(db, { ...query, period: 'all' });
    const all = await listSkills(db, { ...query, period: 'all' });
    const sum = (rows: SkillUsage[], key: 'apiCalls' | 'tokens' | 'costUsd') =>
      rows.reduce((total, row) => total + (row[key] ?? 0), 0);
    expect(sum(all.skills, 'apiCalls')).toBe(overview.totals.apiCalls);
    expect(sum(all.skills, 'costUsd')).toBeCloseTo(overview.totals.costUsd, 10);
    const lib = overview.projects.find((row) => row.project.endsWith('/lib'));
    const filtered = await listSkills(db, {
      ...query,
      period: 'all',
      project: lib?.project,
    });
    expect(sum(filtered.skills, 'tokens')).toBe(lib?.tokens);
    expect(filtered.launches).toBe(0);
  });

  it('lists launches, sessions and average cost, sorted by cost', async () => {
    const { skills, launches } = await listSkills(db, {
      ...query,
      period: 'all',
    });
    expect(launches).toBe(8);
    const costs = skills.map((row) => row.costUsd ?? -1);
    expect(costs).toEqual([...costs].sort((a, b) => b - a));
    const build = skills.find((row) => row.skill === 'kit:build');
    expect(build).toMatchObject({ launches: 2, sessions: 2, apiCalls: 7 });
    expect(build?.averageCostUsd).toBeCloseTo((build?.costUsd ?? 0) / 2, 10);
  });

  it('keeps calls in the period of a skill launched before it', async () => {
    const { skills, launches } = await listSkills(db, {
      period: 'today',
      timeZone: 'UTC',
      now: new Date(minute(24 * 60 + 30)),
    });
    expect(launches).toBe(0);
    expect(skills).toEqual([
      expect.objectContaining({
        skill: 'kit:late',
        launches: 0,
        apiCalls: 1,
        averageCostUsd: null,
      }),
      expect.objectContaining({ skill: null, apiCalls: 0, costUsd: 0 }),
    ]);
  });
});

describe('skillDetail', () => {
  it('gives launches per day and the sessions that launched the skill', async () => {
    const detail = await skillDetail(db, 'kit:build', {
      period: 'all',
      timeZone: 'UTC',
      now: new Date(minute(60 * 24)),
    });
    expect(detail.series).toEqual([
      { day: '2026-01-05', launches: 2 },
      { day: '2026-01-06', launches: 0 },
    ]);
    expect(detail.launches).toBe(2);
    expect(
      detail.sessions.map(({ id, launches }) => ({ id, launches })),
    ).toEqual([
      { id: 'sub-agent', launches: 1 },
      { id: 'skill-in-sub-agent', launches: 1 },
    ]);
    expect(detail.sessions[0]?.tokens).toBe(440);
  });
});
