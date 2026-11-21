import { join } from 'node:path';
import { asc } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  session,
  skillLaunch,
  subAgent,
  userPrompt,
} from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  assistant,
  minute,
  sessionsFolder,
  skillInstructions,
  title,
  toolResult,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { SessionsFolderNotFoundError, ingest, summaryLine } from './ingest.ts';

let db: Database;
let close: () => Promise<void>;
let folder: string;
let cwd: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  folder = await sessionsFolder();
  cwd = join(folder, 'missing-workdir', 'app');
});

afterEach(async () => {
  await close();
});

const SESSION = 'session-a';

function mainLog(): string {
  return join(folder, 'project-a', `${SESSION}.jsonl`);
}

async function writeMainSession(): Promise<void> {
  const at = (n: number, extra: Record<string, unknown> = {}) => ({
    uuid: `u${n}`,
    at: n,
    cwd,
    gitBranch: n < 5 ? 'feat/old' : 'feat/new',
    ...extra,
  });
  await writeLog(mainLog(), [
    title('First title'),
    userText(at(0, { promptId: 'p1' }), 'Build it'),
    assistant(at(1), {
      requestId: 'req_1',
      stopReason: 'tool_use',
      tokens: [10, 20, 30, 40],
      content: [
        {
          type: 'tool_use',
          id: 't1',
          name: 'Skill',
          input: { skill: 'kit:write-spec' },
        },
      ],
    }),
    assistant(at(1), {
      requestId: 'req_1',
      stopReason: 'tool_use',
      tokens: [10, 20, 30, 40],
    }),
    toolResult(at(2)),
    assistant(at(3), { requestId: 'req_syn', model: '<synthetic>' }),
    userText(
      at(4, { promptId: 'p2' }),
      '<command-message>review</command-message>\n<command-name>/review</command-name>',
    ),
    skillInstructions(at(4, { uuid: 'u4m', promptId: 'p2' })),
    userText(
      at(5, { promptId: 'p3' }),
      '<command-name>/clear</command-name>\n<command-message>clear</command-message>',
    ),
    userText(at(6, { promptId: 'p4' }), 'meta note', { isMeta: true }),
    assistant(at(7), {
      requestId: 'req_2',
      model: 'claude-other-2',
      tokens: [1, 0, 0, 2],
    }),
    title('Final title'),
  ]);
}

async function writeSubAgent(id: string, withMeta: boolean): Promise<void> {
  const dir = join(folder, 'project-a', SESSION, 'subagents');
  const ctx = (n: number) => ({
    uuid: `${id}-${n}`,
    at: 10 + n,
    cwd,
    sidechain: true,
  });
  await writeLog(join(dir, `agent-${id}.jsonl`), [
    userText(ctx(0), 'Sub-agent task'),
    assistant(ctx(1), {
      requestId: `req_${id}`,
      model: 'claude-small-1',
      content: [
        {
          type: 'tool_use',
          id: 't',
          name: 'Skill',
          input: { skill: 'kit:check' },
        },
      ],
    }),
  ]);
  if (withMeta) {
    await writeLog(join(dir, `agent-${id}.meta.json`), [
      {
        agentType: 'general-purpose',
        description: 'Check #1',
        toolUseId: 'toolu_parent',
        model: 'small',
      },
    ]);
  }
}

describe('ingest', () => {
  it('stores a session with its fields', async () => {
    await writeMainSession();
    await ingest(db, folder);
    const [row] = await db.select().from(session);
    expect(row).toMatchObject({
      id: SESSION,
      project: cwd,
      cwd,
      gitBranch: 'feat/new',
      title: 'Final title',
      firstAt: new Date(minute(0)),
      lastAt: new Date(minute(7)),
      turnEnded: true,
    });
  });

  it('stores one API call per request, without synthetic records', async () => {
    await writeMainSession();
    await ingest(db, folder);
    const calls = await db.select().from(apiCall).orderBy(asc(apiCall.at));
    expect(
      calls.map((call) => [
        call.requestKey,
        call.sessionId,
        call.subAgentId,
        call.model,
        call.inputTokens,
        call.cacheWriteTokens,
        call.cacheReadTokens,
        call.outputTokens,
      ]),
    ).toEqual([
      ['req_1', SESSION, null, 'claude-test-1', 10, 20, 30, 40],
      ['req_2', SESSION, null, 'claude-other-2', 1, 0, 0, 2],
    ]);
    expect(calls[0]?.at).toEqual(new Date(minute(1)));
  });

  it('stores Skill calls and slash skills, not built-in commands', async () => {
    await writeMainSession();
    await ingest(db, folder);
    const launches = await db
      .select()
      .from(skillLaunch)
      .orderBy(asc(skillLaunch.at));
    expect(
      launches.map((launch) => [launch.skill, launch.recordUuid, launch.at]),
    ).toEqual([
      ['kit:write-spec', 'u1', new Date(minute(1))],
      ['review', 'u4', new Date(minute(4))],
    ]);
  });

  it('stores a marker for each typed prompt, without its text', async () => {
    await writeMainSession();
    await ingest(db, folder);
    const prompts = await db
      .select()
      .from(userPrompt)
      .orderBy(asc(userPrompt.at));
    expect(
      prompts.map((prompt) => [prompt.recordUuid, prompt.command]),
    ).toEqual([
      ['u0', null],
      ['u4', 'review'],
      ['u5', 'clear'],
    ]);
    expect(Object.keys(prompts[0] ?? {})).not.toContain('text');
  });

  it('stores sub-agents with their meta file, or empty without one', async () => {
    await writeMainSession();
    await writeSubAgent('a1', true);
    await writeSubAgent('a2', false);
    const result = await ingest(db, folder);
    const agents = await db.select().from(subAgent).orderBy(asc(subAgent.id));
    expect(agents).toEqual([
      {
        sessionId: SESSION,
        id: 'a1',
        toolUseId: 'toolu_parent',
        agentType: 'general-purpose',
        description: 'Check #1',
        model: 'small',
        cwd,
        gitBranch: '',
        firstAt: new Date(minute(10)),
        lastAt: new Date(minute(11)),
      },
      {
        sessionId: SESSION,
        id: 'a2',
        toolUseId: '',
        agentType: '',
        description: '',
        model: '',
        cwd,
        gitBranch: '',
        firstAt: new Date(minute(10)),
        lastAt: new Date(minute(11)),
      },
    ]);
    const calls = await db
      .select()
      .from(apiCall)
      .orderBy(asc(apiCall.requestKey));
    expect(
      calls
        .filter((call) => call.subAgentId !== null)
        .map((c) => [c.sessionId, c.subAgentId]),
    ).toEqual([
      [SESSION, 'a1'],
      [SESSION, 'a2'],
    ]);
    const launches = await db.select().from(skillLaunch);
    expect(
      launches
        .filter((launch) => launch.subAgentId === 'a1')
        .map((l) => l.skill),
    ).toEqual(['kit:check']);
    expect(await db.select().from(userPrompt)).toHaveLength(3);
    expect(summaryLine(result)).toBe(
      'Ingested 4 files: 1 sessions, 2 sub-agents, 4 API calls, 4 skill launches, 0 lines skipped.',
    );
  });

  it('puts a session without a working directory in unassigned', async () => {
    await writeLog(join(folder, 'p', 'lonely.jsonl'), [
      {
        type: 'user',
        uuid: 'x',
        timestamp: minute(0),
        message: { role: 'user', content: 'Hi' },
      },
      assistant({ uuid: 'y', at: 1 }, { requestId: 'r' }),
    ]);
    await ingest(db, folder);
    const [row] = await db.select().from(session);
    expect(row).toMatchObject({
      id: 'lonely',
      project: 'unassigned',
      cwd: null,
      gitBranch: '',
    });
    expect(await db.select().from(apiCall)).toHaveLength(1);
  });

  it('fails on a sessions folder that does not exist', async () => {
    const missing = join(folder, 'nope');
    await expect(ingest(db, missing)).rejects.toThrow(
      SessionsFolderNotFoundError,
    );
    await expect(ingest(db, missing)).rejects.toThrow(
      `Sessions folder not found: ${missing}`,
    );
  });
});
