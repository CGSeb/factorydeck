import { describe, expect, it } from 'vitest';
import { friction } from '../db/schema.ts';
import {
  frictionOccurrences,
  frictionOutput,
} from '../frictions/occurrences.ts';
import type { OccurrenceRow } from '../frictions/occurrence-types.ts';
import { frictionStats } from '../frictions/query.ts';
import { buildReport } from '../frictions/report.ts';
import { REMOTE_DETAILS } from '../frictions/report-occurrences.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { addProject, minutes } from '../test/cli-batch.ts';
import {
  HASH,
  batch,
  failedCommand,
  storedFrictions,
} from '../test/cli-frictions.ts';
import { useIngestApp } from '../test/cli-ingest-app.ts';

const app = useIngestApp();
const { send } = app;

const QUERY = {
  period: 'all',
  timeZone: 'UTC',
  project: 'shop',
  now: new Date(minutes(60)),
} as const;

function occurrences(row: OccurrenceRow) {
  return frictionOccurrences(
    app.h().db,
    { ...QUERY, row },
    DEFAULT_CONFIG,
    '/nowhere',
  );
}

describe('POST /api/cli/ingest with frictions', () => {
  it('stores a friction of each kind as the local ingestion does, shown on the Frictions page', async () => {
    await addProject(app.h().db);
    expect(await send(batch())).toEqual({
      status: 200,
      body: { sessions: 1, threads: 2, apiCalls: 3 },
    });
    const rows = await storedFrictions(app.h().db);
    expect(
      rows.map(({ id: _id, at, ...row }) => ({ ...row, at: at.toISOString() })),
    ).toEqual([
      {
        sourcePath: 'claude-code/s-1/a1',
        recordUuid: 'sub-1',
        position: 1,
        sessionId: 's-1',
        subAgentId: 'a1',
        at: minutes(7),
        agent: 'claude-code',
        kind: 'tool-error',
        tool: 'unknown',
        category: 'permission-denied',
        program: null,
        exitCode: null,
        commandHash: null,
        hookCommand: null,
        trigger: null,
        preTokens: null,
        postTokens: null,
      },
      expect.objectContaining({
        sourcePath: 'claude-code/s-1/main',
        recordUuid: 'offset:8192',
        subAgentId: null,
        kind: 'compaction',
        trigger: 'auto',
        preTokens: 160_000,
        postTokens: 20_000,
        tool: null,
      }),
      expect.objectContaining({
        recordUuid: 'rec-1',
        kind: 'tool-error',
        tool: 'Bash',
        category: 'command-failed',
        program: 'pnpm',
        exitCode: 2,
        commandHash: HASH,
        hookCommand: null,
      }),
      expect.objectContaining({
        recordUuid: 'rec-2',
        kind: 'stop-blocked',
        hookCommand: '~/.claude/hooks/check.sh',
        tool: null,
      }),
    ]);
    const stats = await frictionStats(app.h().db, QUERY, DEFAULT_CONFIG);
    expect(stats.counts).toEqual({ 'tool-error': 2, 'stop-blocked': 1 });
    expect(stats.commands).toEqual([
      expect.objectContaining({ program: 'pnpm', failures: 1, exitCodes: [2] }),
    ]);
    expect(stats.hooks.map((row) => row.command)).toEqual([
      '~/.claude/hooks/check.sh',
    ]);
    expect(stats.context.compacted).toBe(1);
  });

  it('stores the frictions of the same batch once', async () => {
    await addProject(app.h().db);
    await send(batch());
    const first = await storedFrictions(app.h().db);
    expect(await send(batch())).toMatchObject({ status: 200 });
    expect(await storedFrictions(app.h().db)).toEqual(first);
  });

  it('keeps the first friction stored for a file key, record, kind and position', async () => {
    await addProject(app.h().db);
    await send(batch([failedCommand('rec-1', 0)]));
    await send(
      batch([
        { ...failedCommand('rec-1', 0), exitCode: 9 },
        failedCommand('rec-1', 1),
      ]),
    );
    const rows = (await storedFrictions(app.h().db)).filter(
      (row) => row.subAgentId === null,
    );
    expect(rows.map((row) => [row.position, row.exitCode])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it('shows the CLI line in place of the details of a sent friction', async () => {
    await addProject(app.h().db);
    await send(batch());
    const [occurrence] = await occurrences({
      table: 'command',
      program: 'pnpm',
    });
    expect(occurrence).toMatchObject({
      details: 'remote',
      exitCode: 2,
      hasMore: false,
      texts: null,
    });
    const output = await frictionOutput(
      app.h().db,
      occurrence?.id ?? 0,
      '/nowhere',
    );
    expect(output).toEqual({ gone: true, remote: true });
  });

  it('shows the gone line for a friction whose log and file key are both unknown', async () => {
    await addProject(app.h().db);
    await send(batch());
    await app
      .h()
      .db.update(friction)
      .set({ sourcePath: '/home/dev/.claude/projects/gone.jsonl' });
    const [occurrence] = await occurrences({
      table: 'command',
      program: 'pnpm',
    });
    expect(occurrence).toMatchObject({ details: 'gone', texts: null });
    expect(
      await frictionOutput(app.h().db, occurrence?.id ?? 0, '/nowhere'),
    ).toEqual({ gone: true });
  });

  it('writes the CLI line in the report and groups a sent friction with a local one', async () => {
    await addProject(app.h().db);
    await send(batch());
    const [sent] = (await storedFrictions(app.h().db)).filter(
      (row) => row.recordUuid === 'rec-1',
    );
    if (sent === undefined) throw new Error('No friction stored');
    const { id: _id, ...fields } = sent;
    await app
      .h()
      .db.insert(friction)
      .values({
        ...fields,
        sourcePath: '/home/dev/.claude/projects/shop/s-1.jsonl',
        at: new Date(minutes(2)),
      });
    const report = await buildReport(app.h().db, QUERY, DEFAULT_CONFIG, {
      home: '/nowhere',
      reports: [],
    });
    const pnpm = report.groups.filter((group) =>
      group.rows.some((row) => row.program === 'pnpm'),
    );
    expect(pnpm.map((group) => group.rows.length)).toEqual([2]);
    expect(report.markdown).toContain(`${REMOTE_DETAILS}\n\nExit code 2`);
    expect(report.markdown).toContain(
      'The session log is no longer on this computer.',
    );
  });
});
