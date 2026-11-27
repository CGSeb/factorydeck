import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, friction, session } from '../db/schema.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { APP, LONG_HOOK, NOW, seedFrictions } from '../test/frictions.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { type ReportQuery, frictionReport } from './report.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedFrictions(db);
});

afterAll(async () => {
  await close();
});

function report(query: Partial<ReportQuery> = {}): Promise<string> {
  return frictionReport(
    db,
    { period: '7d', timeZone: 'UTC', project: APP, now: NOW, ...query },
    DEFAULT_CONFIG,
    '/home/dev',
  );
}

function section(text: string, heading: string): string {
  const start = text.indexOf(`${heading}\n`);
  if (start === -1) throw new Error(`No section ${heading}`);
  const next = text.indexOf('\n## ', start + heading.length);
  return text.slice(start, next === -1 ? undefined : next);
}

describe('frictionReport header', () => {
  it('starts with the title, the project and period, and the figures', async () => {
    const lines = (await report()).split('\n');
    expect(lines.slice(0, 5)).toEqual([
      '# Friction report',
      '',
      'app · Last 7 days · 2026-03-12 to 2026-03-18 (UTC)',
      '',
      '26 frictions · 26.0 per 100 API calls · 100 API calls',
    ]);
  });

  it('lists the active filters on their own line', async () => {
    const lines = (
      await report({
        period: '30d',
        timeZone: 'Europe/Paris',
        kind: 'tool-error',
        role: 'builder',
        filter: { issue: 21 },
      })
    ).split('\n');
    expect(lines.slice(2, 7)).toEqual([
      'app · Last 30 days · 2026-02-17 to 2026-03-18 (Europe/Paris)',
      '',
      'Kind: Tool errors · Role: builder · Issue: #21',
      '',
      '8 frictions · 20.0 per 100 API calls · 40 API calls',
    ]);
    const session = (await report({ filter: { session: 'app-1' } })).split(
      '\n',
    );
    expect(session[4]).toBe('Session: Fix login');
  });

  it('answers the header then No friction for an empty selection', async () => {
    expect(await report({ period: 'today' })).toBe(
      [
        '# Friction report',
        '',
        'app · Today · 2026-03-18 to 2026-03-18 (UTC)',
        '',
        '0 frictions · — per 100 API calls · 0 API calls',
        '',
        'No friction in this period.',
        '',
      ].join('\n'),
    );
    const empty = await report({ role: 'nobody' });
    expect(empty.split('\n').slice(4)).toEqual([
      'Role: nobody',
      '',
      '0 frictions · — per 100 API calls · 0 API calls',
      '',
      'No friction in this period.',
      '',
    ]);
  });
});

describe('frictionReport groups', () => {
  it('lists every group in a table, by frictions then key', async () => {
    const groups = section(await report(), '## Groups').split('\n');
    expect(groups.slice(2, 6)).toEqual([
      '| # | Kind | Category | Tool | Program | Hook | Frictions | Threads | Last |',
      '| --: | --- | --- | --- | --- | --- | --: | --: | --- |',
      '| 1 | Tool error | Command failed | Bash | pnpm | — | 9 | 3 | 2026-03-17 08:11 |',
      '| 2 | Tool error | Command failed | Bash | curl | — | 3 | 1 | 2026-03-17 09:45 |',
    ]);
    expect(groups[8]).toBe(
      `| 5 | Stop blocked | — | — | — | ${LONG_HOOK.slice(0, 80)}… | 2 | 2 | 2026-03-17 11:00 |`,
    );
    expect(groups.filter((line) => /^\| \d+ \|/.test(line))).toHaveLength(10);
  });

  it('writes a section per group with its key, roles, issues and times', async () => {
    const text = await report();
    const first = section(text, '## 1. Command failed · Bash · pnpm');
    expect(first.split('\n').slice(0, 13)).toEqual([
      '## 1. Command failed · Bash · pnpm',
      '',
      'Key: `tool-error/command-failed/Bash/pnpm`',
      '',
      '- Frictions: 9',
      '- Threads: 3',
      '- Roles: builder (7), main (2)',
      '- Issues: #21 (4), #9 (3), unassigned (2)',
      '- Exit codes: 1, 2, 4, 5, 7, 9, 127',
      '- Distinct commands: 6',
      '- Threads where one command failed 3 times or more: 1',
      '- First: 2026-03-15 07:00',
      '- Last: 2026-03-17 08:11',
    ]);
    expect(text).toContain(
      '## 4. Stop blocked · make check\n\nKey: `stop-blocked/make check`',
    );
    expect(text).toContain(
      '## 6. Other · Write\n\nKey: `tool-error/other/Write/-`',
    );
  });

  it('picks the latest occurrence of each distinct command, latest first', async () => {
    const first = section(await report(), '## 1. Command failed · Bash · pnpm');
    expect(first.match(/^#### .*$/gm)).toEqual([
      '#### 2026-03-17 08:11 · main · unassigned · Fix login (`app-1`)',
      '#### 2026-03-17 08:03 · builder · #9 · Fix login (`app-1`)',
      '#### 2026-03-15 07:03 · builder · #21 · app-2 (`app-2`)',
    ]);
  });

  it('fills with the next latest when fewer than 3 commands are distinct', async () => {
    const curl = section(await report(), '## 2. Command failed · Bash · curl');
    expect(curl.match(/^#### \S+ \S+/gm)).toEqual([
      '#### 2026-03-17 09:45',
      '#### 2026-03-17 09:30',
      '#### 2026-03-17 09:00',
    ]);
  });

  it('says when the session log is gone', async () => {
    const first = section(await report(), '## 1. Command failed · Bash · pnpm');
    expect(first).toContain(
      '#### 2026-03-17 08:11 · main · unassigned · Fix login (`app-1`)\n\nThe session log is no longer on this computer.\n\nExit code 127\n',
    );
  });

  it('ends with the context peaks, left out under a kind', async () => {
    expect(await report()).toMatch(
      /\n## Context\n\nMedian context peak: 1 · 2 of 2 threads compacted\n$/,
    );
    expect(await report({ kind: 'tool-error' })).not.toContain('## Context');
  });
});

describe('frictionReport past 20 groups', () => {
  it('lists the 21st group without occurrences', async () => {
    const scratch = await createTestDatabase();
    try {
      await scratch.db.insert(session).values({ id: 's-1', project: APP });
      await scratch.db.insert(apiCall).values({
        sourcePath: '/logs/s-1.jsonl',
        requestKey: 'r-1',
        sessionId: 's-1',
        at: new Date('2026-03-17T09:00:00Z'),
        model: 'claude-test-1',
        inputTokens: 1,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        outputTokens: 1,
      });
      await scratch.db.insert(friction).values(
        Array.from({ length: 21 }, (_, index) => ({
          sourcePath: '/logs/s-1.jsonl',
          recordUuid: `f-${String(index)}`,
          position: 0,
          sessionId: 's-1',
          at: new Date(`2026-03-17T10:${String(index).padStart(2, '0')}:00Z`),
          agent: 'claude-code',
          kind: 'tool-error',
          tool: `T${String(index).padStart(2, '0')}`,
          category: 'other',
        })),
      );
      const text = await frictionReport(
        scratch.db,
        { period: '7d', timeZone: 'UTC', project: APP, now: NOW },
        DEFAULT_CONFIG,
        '/home/dev',
      );
      expect(text.match(/^### Occurrences$/gm)).toHaveLength(20);
      const last = section(text, '## 21. Other · T20');
      expect(last).not.toContain('### Occurrences');
      expect(last).toContain(
        '- Last: 2026-03-17 10:20\n\n1 more group is listed without occurrences.\n',
      );
    } finally {
      await scratch.close();
    }
  });
});
