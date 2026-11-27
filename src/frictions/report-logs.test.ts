import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { ingest } from '../ingest/ingest.ts';
import { select } from '../overview/query.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  EVERY_PROJECT_HAS_FACTORY,
  type Line,
  assistant,
  minute,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { frictionReport } from './report.ts';

function section(text: string, heading: string): string {
  const start = text.indexOf(`${heading}\n`);
  if (start === -1) throw new Error(`No section ${heading}`);
  const next = text.indexOf('\n## ', start + heading.length);
  return text.slice(start, next === -1 ? undefined : next);
}

const HOME = '/home/dev';
const CWD = `${HOME}/work/demo`;

function toolCall(
  at: number,
  id: string,
  name: string,
  input: Record<string, unknown>,
): Line {
  return assistant(
    { uuid: `a-${id}`, at, cwd: CWD },
    {
      requestId: `req-${id}`,
      stopReason: 'tool_use',
      content: [{ type: 'tool_use', id, name, input }],
    },
  );
}

function toolFailure(at: number, id: string, content: string): Line {
  return {
    ...userText({ uuid: `r-${id}`, at, cwd: CWD }, ''),
    message: {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: id, is_error: true, content },
      ],
    },
  };
}

describe('frictionReport over ingested logs', () => {
  const scratch: { db?: Database; close?: () => Promise<void> } = {};
  let text = '';

  beforeAll(async () => {
    const created = await createTestDatabase();
    scratch.db = created.db;
    scratch.close = created.close;
    const folder = await sessionsFolder();
    const a = { file_path: 'a.ts', old_string: 'x' };
    const edits: [string, Record<string, unknown>][] = [
      ['t5', a],
      ['t6', { file_path: 'c.ts', old_string: 'x' }],
      ['t7', a],
      ['t8', { file_path: 'b.ts', old_string: 'x' }],
      ['t9', a],
    ];
    const longCommand = `echo ${'c'.repeat(2100)}`;
    const output = [
      'Exit code 1',
      ...Array.from({ length: 60 }, (_, index) => `line ${String(index)}`),
      '```',
      `FAIL ${CWD}/a.test.ts`,
      '```',
    ].join('\n');
    await writeLog(join(folder, 'project', 'session-r.jsonl'), [
      userText({ uuid: 'u0', at: 0, cwd: CWD }, 'Build it'),
      toolCall(1, 't1', 'Bash', { command: 'pnpm test' }),
      toolFailure(2, 't1', output),
      toolCall(3, 't2', 'Bash', { command: 'pnpm test' }),
      toolFailure(4, 't2', 'Exit code 1\nfailed again'),
      toolCall(5, 't3', 'Bash', { command: 'pnpm lint' }),
      toolFailure(6, 't3', 'Exit code 2\n\u001b[31mlint error\u001b[0m'),
      toolCall(7, 't4', 'Bash', { command: longCommand }),
      toolFailure(8, 't4', `Exit code 3\n${'x'.repeat(5000)}`),
      ...edits.flatMap(([id, input], index) => [
        toolCall(12 + index * 2, id, 'Edit', input),
        toolFailure(
          13 + index * 2,
          id,
          id === 't9'
            ? `<tool_use_error>${Array.from({ length: 25 }, (_, line) => `edit ${String(line)}`).join('\n')}</tool_use_error>`
            : '<tool_use_error>String not found</tool_use_error>',
        ),
      ]),
      {
        type: 'system',
        subtype: 'stop_hook_summary',
        uuid: 's1',
        timestamp: minute(11),
        hookErrors: ['[make check]: checks failed\nrun make check'],
      },
    ]);
    await ingest(created.db, folder, {
      ...EVERY_PROJECT_HAS_FACTORY,
      home: HOME,
    });
    const [row] = await select(created.db, sql`select project from session`);
    text = await frictionReport(
      created.db,
      {
        period: 'all',
        timeZone: 'UTC',
        project: String(row?.['project']),
        now: new Date('2026-01-06T00:00:00Z'),
      },
      DEFAULT_CONFIG,
      HOME,
    );
  });

  afterAll(async () => {
    await scratch.close?.();
  });

  it('shows a shell failure with its command, exit code and output tail', () => {
    const pnpm = section(text, '## 2. Command failed · Bash · pnpm');
    expect(pnpm).toContain('- Exit codes: 1, 2\n- Distinct commands: 2\n');
    const occurrences = pnpm.slice(pnpm.indexOf('### Occurrences'));
    expect(occurrences.match(/^#### \S+ \S+/gm)).toEqual([
      '#### 2026-01-05 09:06',
      '#### 2026-01-05 09:04',
      '#### 2026-01-05 09:02',
    ]);
    expect(occurrences).toContain(
      '```bash\npnpm lint\n```\n\nExit code 2\n\n```text\nlint error\n```',
    );
    const tail = [
      ...Array.from({ length: 37 }, (_, index) => `line ${String(index + 23)}`),
      '```',
      'FAIL ~/work/demo/a.test.ts',
      '```',
    ].join('\n');
    expect(occurrences).toContain(
      `\`\`\`bash\npnpm test\n\`\`\`\n\nExit code 1\n\n\`\`\`\`text\n${tail}\n\`\`\`\`\n`,
    );
  });

  it('cuts a command at 2000 characters and an output tail at 4000', () => {
    const echo = section(text, '## 4. Command failed · Bash · echo');
    expect(echo).toContain(`\`\`\`bash\necho ${'c'.repeat(1995)}…\n\`\`\``);
    expect(echo).toContain(`\`\`\`text\n…${'x'.repeat(4000)}\n\`\`\``);
  });

  it('shows another tool with its input as JSON and the head of its result, one per distinct input', () => {
    const edit = section(text, '## 1. Tool misuse · Edit');
    const result = Array.from(
      { length: 20 },
      (_, index) => `edit ${String(index)}`,
    ).join('\n');
    expect(edit).toContain(
      `\`\`\`json\n{"file_path":"a.ts","old_string":"x"}\n\`\`\`\n\n\`\`\`text\n${result}\n\`\`\``,
    );
    expect(edit).not.toContain('Exit codes');
    expect(edit.match(/^#### \S+ \S+/gm)).toEqual([
      '#### 2026-01-05 09:21',
      '#### 2026-01-05 09:19',
      '#### 2026-01-05 09:15',
    ]);
    expect(edit).toContain('{"file_path":"b.ts","old_string":"x"}');
    expect(edit).toContain('{"file_path":"c.ts","old_string":"x"}');
  });

  it('shows a stop block with the hook message', () => {
    const stop = section(text, '## 3. Stop blocked · make check');
    expect(stop).toContain('```text\nchecks failed\nrun make check\n```');
  });

  it('holds no home folder', () => {
    expect(text).not.toContain(HOME);
  });
});
