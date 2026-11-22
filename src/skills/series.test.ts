import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { ingest } from '../ingest/ingest.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  EVERY_PROJECT_HAS_FACTORY,
  assistant,
  minute,
  sessionsFolder,
  skillCall,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { skillDetail } from './query.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  const cwd = join(folder, 'app');
  const at = (value: number): { uuid: string; at: number; cwd: string } => ({
    uuid: `hourly-${String(value)}`,
    at: value,
    cwd,
  });
  await writeLog(join(folder, 'logs', 'hourly.jsonl'), [
    userText(at(0), 'Review'),
    assistant(at(1), {
      requestId: 'req_hourly_1',
      model: 'claude-sonnet-example',
      tokens: [100, 0, 0, 10],
      content: [skillCall('kit:review')],
    }),
    assistant(at(61), {
      requestId: 'req_hourly_2',
      model: 'claude-sonnet-example',
      tokens: [100, 0, 0, 10],
      content: [skillCall('kit:review')],
    }),
  ]);
  await ingest(db, join(folder, 'logs'), EVERY_PROJECT_HAS_FACTORY);
});

afterAll(async () => {
  await close();
});

describe('skillDetail series', () => {
  it('gives launches per hour for today', async () => {
    const { series } = await skillDetail(db, 'kit:review', {
      period: 'today',
      timeZone: 'UTC',
      now: new Date(minute(3 * 60)),
    });
    expect(series).toHaveLength(13);
    expect(series[0]).toEqual({ day: '2026-01-05T00:00', launches: 0 });
    expect(series.slice(9, 11)).toEqual([
      { day: '2026-01-05T09:00', launches: 1 },
      { day: '2026-01-05T10:00', launches: 1 },
    ]);
    expect(series.at(-1)).toEqual({ day: '2026-01-05T12:00', launches: 0 });
  });

  it('keeps launches per day for the other periods', async () => {
    const { series } = await skillDetail(db, 'kit:review', {
      period: '7d',
      timeZone: 'UTC',
      now: new Date(minute(3 * 60)),
    });
    expect(series).toHaveLength(7);
    expect(series.at(-1)).toEqual({ day: '2026-01-05', launches: 2 });
  });
});
