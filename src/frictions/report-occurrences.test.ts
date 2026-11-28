import { describe, expect, it } from 'vitest';
import { jsonInput, occurrenceLines } from './report-occurrences.ts';

const BASE = {
  at: '2026-03-17T08:00:00.000Z',
  role: 'worker',
  workItem: null,
  sessionId: 's-1',
  sessionTitle: 'Fix login',
  shell: false,
  exitCode: null,
};

describe('jsonInput', () => {
  it('keeps an input recorded as JSON', () => {
    expect(jsonInput('{"file_path":"a.ts"}')).toBe('{"file_path":"a.ts"}');
    expect(jsonInput(`{"content":"${'x'.repeat(10)}…`)).toBe(
      `{"content":"${'x'.repeat(10)}…`,
    );
  });

  it('writes a raw string input as a JSON string', () => {
    expect(jsonInput('*** Begin Patch\nx')).toBe('"*** Begin Patch\\nx"');
    expect(jsonInput('a'.repeat(2500))).toBe(`"${'a'.repeat(1999)}…`);
  });
});

describe('occurrenceLines', () => {
  it('fences a raw string input of another tool as JSON', () => {
    const lines = occurrenceLines(
      {
        ...BASE,
        details: 'local',
        texts: {
          kind: 'tool-error',
          input: '*** Begin Patch\nx',
          output: 'patch failed',
        },
      },
      (at) => at.slice(0, 16),
    );
    expect(lines.join('\n')).toBe(
      [
        '#### 2026-03-17T08:00 · worker · unassigned · Fix login (`s-1`)',
        '',
        '```json\n"*** Begin Patch\\nx"\n```',
        '',
        '```text\npatch failed\n```',
      ].join('\n'),
    );
  });
});
