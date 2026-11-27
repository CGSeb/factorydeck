import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { friction, markedReport, session } from '../db/schema.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { API, APP, NOW, seedFrictions } from '../test/frictions.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { markFrictionReport } from './mark-report.ts';
import { type ReportQuery, frictionReport } from './report.ts';
import { lastReportAt } from './reported.ts';

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  await seedFrictions(db);
});

afterEach(async () => {
  await close();
});

const FIRST = new Date('2026-03-17T18:00:00Z');
const SECOND = new Date('2026-03-17T19:00:00Z');

function query(overrides: Partial<ReportQuery> = {}): ReportQuery {
  return {
    period: '7d',
    timeZone: 'UTC',
    project: APP,
    now: NOW,
    ...overrides,
  };
}

function report(overrides: Partial<ReportQuery> = {}): Promise<string> {
  return frictionReport(db, query(overrides), DEFAULT_CONFIG, '/home/dev');
}

function mark(overrides: Partial<ReportQuery> = {}): Promise<string> {
  return markFrictionReport(db, query(overrides), DEFAULT_CONFIG, '/home/dev');
}

let sequence = 0;

async function addFrictions(
  rows: { at: string; tool?: string; category?: string; program?: string }[],
): Promise<void> {
  await db.insert(friction).values(
    rows.map((row) => {
      sequence += 1;
      return {
        sourcePath: '/logs/app-1.jsonl',
        recordUuid: `later-${String(sequence)}`,
        position: 0,
        sessionId: 'app-1',
        at: new Date(row.at),
        agent: 'claude-code',
        kind: 'tool-error',
        tool: row.tool ?? 'Bash',
        category: row.category ?? 'command-failed',
        program: row.program ?? null,
        exitCode: 1,
        commandHash: `later-${String(sequence)}`,
      };
    }),
  );
}

const LATER_PNPM = ['09:00', '09:05', '09:10'].map((time) => ({
  at: `2026-03-18T${time}:00Z`,
  program: 'pnpm',
}));

function section(text: string, heading: string): string {
  const start = text.indexOf(`${heading}\n`);
  if (start === -1) throw new Error(`No section ${heading}`);
  const next = text.indexOf('\n## ', start + heading.length);
  return text.slice(start, next === -1 ? undefined : next);
}

function tableRows(text: string): string[] {
  return section(text, '## Groups')
    .split('\n')
    .filter((line) => /^\| \d+ \|/.test(line));
}

describe('a first report marked as reported', () => {
  it('tags every group New and answers the report GET answers', async () => {
    const before = await report({ now: FIRST });
    const marked = await mark({ now: FIRST });
    expect(marked).toBe(before);
    const rows = tableRows(marked);
    expect(rows).toHaveLength(10);
    expect(rows.every((row) => row.split(' | ')[1] === 'New')).toBe(true);
    expect(marked).not.toContain('## Reported before, not seen since');
  });

  it('records the time, the project, the period, the filters and the group counts only', async () => {
    await mark({
      now: FIRST,
      period: '30d',
      kind: 'tool-error',
      role: 'builder',
      filter: { issue: 21 },
    });
    const recorded = await db.select().from(markedReport);
    expect(recorded).toEqual([
      {
        id: expect.any(Number) as number,
        project: APP,
        reportedAt: FIRST,
        period: '30d',
        filters: {
          kind: 'tool-error',
          role: 'builder',
          session: null,
          issue: 21,
        },
        groups: [
          { key: 'tool-error/command-failed/Bash/pnpm', frictions: 4 },
          { key: 'tool-error/command-failed/Bash/curl', frictions: 3 },
          { key: 'tool-error/command-failed/Bash/git', frictions: 1 },
        ],
      },
    ]);
  });

  it('records a report with no group when the selection has no friction', async () => {
    await mark({ now: FIRST, role: 'nobody' });
    const recorded = await db
      .select({ groups: markedReport.groups })
      .from(markedReport);
    expect(recorded).toEqual([{ groups: [] }]);
  });
});

describe('a report after a marked one', () => {
  it('counts the frictions since and shows only their occurrences', async () => {
    await mark({ now: FIRST });
    await addFrictions(LATER_PNPM);
    const text = await report();
    const pnpm = section(text, '## 1. Command failed · Bash · pnpm');
    expect(pnpm.split('\n').slice(0, 5)).toEqual([
      '## 1. Command failed · Bash · pnpm',
      '',
      'Reported on 2026-03-17 18:00 · 3 since',
      '',
      'Key: `tool-error/command-failed/Bash/pnpm`',
    ]);
    expect(pnpm).toContain('- Frictions: 12');
    expect(pnpm.match(/^#### \S+ \S+/gm)).toEqual([
      '#### 2026-03-18 09:10',
      '#### 2026-03-18 09:05',
      '#### 2026-03-18 09:00',
    ]);
    expect(tableRows(text)).toEqual([
      '| 1 | Reported on 2026-03-17 18:00 · 3 since | Tool error | Command failed | Bash | pnpm | — | 12 | 3 | 2026-03-18 09:10 |',
    ]);
  });

  it('moves the groups with nothing since to their own section, by frictions then key', async () => {
    await mark({ now: FIRST });
    await addFrictions(LATER_PNPM);
    const notSeen = section(
      await report(),
      '## Reported before, not seen since',
    ).split('\n');
    expect(notSeen.slice(0, 4)).toEqual([
      '## Reported before, not seen since',
      '',
      '- `tool-error/command-failed/Bash/curl` · reported on 2026-03-17 18:00 · 3 before',
      '- `tool-error/command-failed/Bash/git` · reported on 2026-03-17 18:00 · 3 before',
    ]);
    expect(notSeen.filter((line) => line.startsWith('- '))).toHaveLength(9);
  });

  it('lists the new groups first, then the reported ones', async () => {
    await mark({ now: FIRST });
    await addFrictions([
      ...LATER_PNPM,
      { at: '2026-03-18T10:00:00Z', tool: 'Read', category: 'other' },
    ]);
    const rows = tableRows(await report());
    expect(rows.map((row) => row.split(' | ').slice(0, 2))).toEqual([
      ['| 1', 'New'],
      ['| 2', 'Reported on 2026-03-17 18:00 · 3 since'],
    ]);
  });

  it('names the latest report and how many held the group', async () => {
    await mark({ now: FIRST });
    await mark({ now: SECOND });
    await mark({ now: SECOND });
    await addFrictions(LATER_PNPM);
    const text = await report();
    expect(text).toContain(
      '## 1. Command failed · Bash · pnpm\n\nReported on 2026-03-17 19:00 (3 times) · 3 since\n',
    );
    expect(text).toContain(
      '- `tool-error/command-failed/Bash/curl` · reported on 2026-03-17 19:00 · 3 before',
    );
  });

  it('counts a filtered report for an unfiltered one', async () => {
    await mark({ now: FIRST, kind: 'stop-blocked' });
    const text = await report();
    expect(tableRows(text)).toHaveLength(8);
    expect(tableRows(text).every((row) => row.split(' | ')[1] === 'New')).toBe(
      true,
    );
    const notSeen = section(text, '## Reported before, not seen since');
    expect(notSeen.match(/^- `stop-blocked\/.*` · /gm)).toHaveLength(2);
  });

  it('ignores the reports of another project', async () => {
    await mark({ now: FIRST });
    const text = await report({ project: API });
    expect(tableRows(text)).toEqual([
      '| 1 | New | Tool error | Other | Bash | — | — | 1 | 1 | 2026-03-17 09:00 |',
    ]);
  });

  it('keeps only the section of groups not seen since when every group is', async () => {
    await mark({ now: FIRST });
    const text = await report();
    expect(text).not.toContain('## Groups');
    expect(text).not.toContain('No friction in this period.');
    expect(text).toContain('## Reported before, not seen since');
  });
});

describe('recording reports', () => {
  it('records nothing for the report GET answers', async () => {
    await report();
    expect(await db.select().from(markedReport)).toEqual([]);
    expect(await lastReportAt(db, APP)).toBeNull();
  });

  it('gives the time of the latest report of the project', async () => {
    await mark({ now: SECOND });
    await mark({ now: FIRST });
    expect(await lastReportAt(db, APP)).toBe(SECOND.toISOString());
    expect(await lastReportAt(db, API)).toBeNull();
    expect(await lastReportAt(db, undefined)).toBeNull();
  });

  it('keeps a report when its sessions are deleted', async () => {
    await mark({ now: FIRST });
    await db.delete(session);
    expect(await db.select().from(markedReport)).toHaveLength(1);
  });
});
