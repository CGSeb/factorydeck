import { describe, expect, it } from 'vitest';
import type { BatchInput } from '../cli-ingest/batch-schema.ts';
import {
  closingLine,
  removedSession,
  skillLaunch,
  userPrompt,
} from '../db/schema.ts';
import { featureDetail } from '../features/query.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { loadMarkers } from '../roles/markers.ts';
import { sessionDetail } from '../sessions/query.ts';
import { listSkills } from '../skills/query.ts';
import {
  addProject,
  apiCall as call,
  mainThread,
  minutes,
  subAgentThread,
} from '../test/cli-batch.ts';
import { useIngestApp } from '../test/cli-ingest-app.ts';

const app = useIngestApp();
const { send } = app;
const NOW = new Date(minutes(60));
const state = { inactiveAfterMinutes: 30, now: NOW };

function markedBatch(): BatchInput {
  return {
    parserVersion: 1,
    threads: [
      {
        ...mainThread('s-1', {
          calls: [call('s-1-r1', minutes(2)), call('s-1-r2', minutes(4))],
        }),
        prompts: [
          {
            recordId: 'u-1',
            at: minutes(1),
            promptId: 'p-1',
            command: 'build-feature',
          },
          { recordId: 'offset:812', at: minutes(3), promptId: null },
        ],
        skillLaunches: [
          { recordId: 'u-1', at: minutes(1), skill: 'build-feature' },
          {
            recordId: 'u-4',
            at: minutes(4),
            skill: 'check-spec',
            subAgentId: null,
          },
        ],
        closingLines: [
          {
            recordId: 'u-5',
            at: minutes(20),
            position: 4000,
            line: 'Work item: #12 (Builder)',
          },
        ],
      },
      {
        ...subAgentThread('s-1', 'a1'),
        skillLaunches: [
          {
            recordId: 'a1-u-1',
            at: minutes(7),
            skill: 'check-spec',
            subAgentId: 'a1',
          },
        ],
      },
    ],
  };
}

async function storedRecords() {
  const { db } = app.h();
  const [launches, prompts, closing] = await Promise.all([
    db
      .select()
      .from(skillLaunch)
      .orderBy(skillLaunch.sourcePath, skillLaunch.recordUuid),
    db.select().from(userPrompt).orderBy(userPrompt.recordUuid),
    db.select().from(closingLine).orderBy(closingLine.recordUuid),
  ]);
  return { launches, prompts, closing };
}

function skills() {
  return listSkills(app.h().db, {
    period: 'all',
    timeZone: 'UTC',
    project: 'shop',
    now: NOW,
  });
}

async function markers() {
  const found = await loadMarkers(app.h().db, DEFAULT_CONFIG, {
    sessionIds: ['s-1'],
  });
  return found.get('s-1');
}

function issue(number: number) {
  return featureDetail(
    app.h().db,
    { project: 'shop', number },
    { period: 'all', timeZone: 'UTC', now: NOW },
    { config: DEFAULT_CONFIG, state },
  );
}

describe('POST /api/cli/ingest with skill launches, prompts and closing lines', () => {
  it('stores them as the local ingestion does, read by the Skills page, the markers and the issue story', async () => {
    await addProject(app.h().db);
    expect(await send(markedBatch())).toEqual({
      status: 200,
      body: { sessions: 1, threads: 2, apiCalls: 3 },
    });
    const { launches, prompts, closing } = await storedRecords();
    expect(
      launches.map((row) => [
        row.sourcePath,
        row.recordUuid,
        row.sessionId,
        row.subAgentId,
        row.at.toISOString(),
        row.skill,
      ]),
    ).toEqual([
      ['claude-code/s-1/a1', 'a1-u-1', 's-1', 'a1', minutes(7), 'check-spec'],
      ['claude-code/s-1/main', 'u-1', 's-1', null, minutes(1), 'build-feature'],
      ['claude-code/s-1/main', 'u-4', 's-1', null, minutes(4), 'check-spec'],
    ]);
    expect(
      prompts.map(({ sourcePath, recordUuid, promptId, command }) => ({
        sourcePath,
        recordUuid,
        promptId,
        command,
      })),
    ).toEqual([
      {
        sourcePath: 'claude-code/s-1/main',
        recordUuid: 'offset:812',
        promptId: null,
        command: null,
      },
      {
        sourcePath: 'claude-code/s-1/main',
        recordUuid: 'u-1',
        promptId: 'p-1',
        command: 'build-feature',
      },
    ]);
    expect(
      closing.map(({ sourcePath, recordUuid, at, position, line }) => [
        sourcePath,
        recordUuid,
        at.toISOString(),
        position,
        line,
      ]),
    ).toEqual([
      [
        'claude-code/s-1/main',
        'u-5',
        minutes(20),
        4000,
        'Work item: #12 (Builder)',
      ],
    ]);

    const list = await skills();
    expect(list.launches).toBe(3);
    expect(
      list.skills.map(({ skill, launches: count, sessions, apiCalls }) => ({
        skill,
        count,
        sessions,
        apiCalls,
      })),
    ).toEqual(
      expect.arrayContaining([
        { skill: 'build-feature', count: 1, sessions: 1, apiCalls: 1 },
        { skill: 'check-spec', count: 2, sessions: 1, apiCalls: 1 },
        { skill: null, count: 0, sessions: 0, apiCalls: 1 },
      ]),
    );

    expect(await markers()).toEqual([
      { at: Date.parse(minutes(20)), workItem: 12, role: 'builder' },
    ]);
    expect((await sessionDetail(app.h().db, 's-1', state))?.workItem).toBe(12);

    const story = await issue(12);
    expect(story?.sessions.map((row) => row.id)).toEqual(['s-1']);
    expect(story?.roles.map((row) => row.role)).toEqual(['builder']);
  });

  it('stores them once when the same batch comes twice, with the answer of #232', async () => {
    await addProject(app.h().db);
    await send(markedBatch());
    const first = await storedRecords();
    expect(await send(markedBatch())).toEqual({
      status: 200,
      body: { sessions: 1, threads: 2, apiCalls: 0 },
    });
    expect(await storedRecords()).toEqual(first);
    expect((await skills()).launches).toBe(3);
  });

  it('reads the marker of a session whose project is added later, without a resend', async () => {
    await send(markedBatch());
    expect(await sessionDetail(app.h().db, 's-1', state)).toBeUndefined();
    await addProject(app.h().db);
    expect((await sessionDetail(app.h().db, 's-1', state))?.workItem).toBe(12);
    expect((await skills()).launches).toBe(3);
  });

  it('keeps main for a marker of the main or unassigned role', async () => {
    await addProject(app.h().db);
    const batch = markedBatch();
    const [main] = batch.threads;
    if (main === undefined) throw new Error('No main thread');
    main.closingLines = [
      {
        recordId: 'u-5',
        at: minutes(20),
        position: 4000,
        line: 'Work item: #12 (Unassigned)',
      },
    ];
    await send(batch);
    expect(await markers()).toEqual([
      { at: Date.parse(minutes(20)), workItem: 12, role: 'main' },
    ]);
  });

  it('ignores the records of a removed session', async () => {
    await addProject(app.h().db);
    await app
      .h()
      .db.insert(removedSession)
      .values({ sessionId: 's-1', projectName: 'shop', removedAt: NOW });
    expect(await send(markedBatch())).toEqual({
      status: 200,
      body: { sessions: 0, threads: 0, apiCalls: 0 },
    });
    expect(await storedRecords()).toEqual({
      launches: [],
      prompts: [],
      closing: [],
    });
  });

  it('answers 400 with the path of a bad closing line, and stores nothing', async () => {
    const batch = markedBatch();
    const [main] = batch.threads;
    if (main === undefined) throw new Error('No main thread');
    main.closingLines = [
      { recordId: 'u-5', at: minutes(20), position: 10, line: 'Done.' },
      { recordId: 'u-6', at: minutes(21), position: 20, line: '' },
    ];
    expect(await send(batch)).toEqual({
      status: 400,
      body: { error: 'Line is empty', path: 'threads.0.closingLines.1.line' },
    });
    expect((await storedRecords()).launches).toEqual([]);
  });

  it('answers 400 to a prompt on a sub-agent thread', async () => {
    const thread = {
      ...subAgentThread('s-1', 'a1'),
      prompts: [{ recordId: 'u-1', at: minutes(1), promptId: null }],
    };
    expect(await send({ parserVersion: 1, threads: [thread] })).toEqual({
      status: 400,
      body: {
        error: 'A sub-agent log has no prompts',
        path: 'threads.0.prompts',
      },
    });
  });
});
