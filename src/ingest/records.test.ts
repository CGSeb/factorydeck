import { describe, expect, it } from 'vitest';
import {
  assistant,
  skillInstructions,
  toolResult,
  userText,
} from '../test/session-logs.ts';
import {
  type LogRecord,
  type TurnState,
  isSlashSkillInstructions,
  isTypedPrompt,
  nextTurnState,
  parseLines,
  skillCalls,
  slashCommandOf,
  turnEnded,
  usageOf,
} from './records.ts';

function record(value: Record<string, unknown>): LogRecord {
  return value as LogRecord;
}

const ctx = { uuid: 'u1', at: 0 };

function endedAfter(records: Record<string, unknown>[]): boolean {
  const start: TurnState = {
    lastStopReason: null,
    userAfterLastAssistant: false,
    lastUserInterrupted: false,
  };
  return turnEnded(
    records
      .map(record)
      .reduce((state, next) => nextTurnState(state, next), start),
  );
}

describe('parseLines', () => {
  it('skips and counts malformed lines and unknown types', () => {
    const chunk = Buffer.from(
      '{"type":"user"}\nnot json\n{"type":"brand-new"}\n["array"]\n\n{"type":"assistant"}\n',
    );
    const { records, skipped, consumed } = parseLines(chunk);
    expect(records.map((entry) => entry.record.type)).toEqual([
      'user',
      'assistant',
    ]);
    expect(skipped).toBe(3);
    expect(consumed).toBe(chunk.length);
  });

  it('leaves a last line without a newline unread', () => {
    const chunk = Buffer.from('{"type":"user"}\n{"type":"assi');
    const { records, skipped, consumed } = parseLines(chunk);
    expect(records).toHaveLength(1);
    expect(skipped).toBe(0);
    expect(consumed).toBe('{"type":"user"}\n'.length);
  });

  it('counts offsets in bytes', () => {
    const first = '{"type":"user","note":"é"}\n';
    const { records, consumed } = parseLines(
      Buffer.from(`${first}{"type":"user"}\n`),
    );
    expect(records[1]?.offset).toBe(Buffer.byteLength(first));
    expect(consumed).toBe(Buffer.byteLength(first) + 16);
  });
});

describe('usageOf', () => {
  it('reads the four token kinds and the request id', () => {
    const usage = usageOf(
      record(assistant(ctx, { requestId: 'req_1', tokens: [10, 20, 30, 40] })),
    );
    expect(usage).toEqual({
      requestKey: 'req_1',
      model: 'claude-test-1',
      input: 10,
      cacheWrite: 20,
      cacheRead: 30,
      output: 40,
    });
  });

  it('ignores records of the <synthetic> model', () => {
    expect(
      usageOf(record(assistant(ctx, { requestId: 'r', model: '<synthetic>' }))),
    ).toBeUndefined();
  });
});

describe('skills and prompts', () => {
  it('names skills as written in the Skill call', () => {
    const call = assistant(ctx, {
      requestId: 'r',
      content: [
        skillCall('plugin:write-spec'),
        { type: 'tool_use', id: 't', name: 'Bash', input: { command: 'ls' } },
      ],
    });
    expect(skillCalls(record(call))).toEqual(['plugin:write-spec']);
  });

  it('recognises typed prompts only', () => {
    expect(isTypedPrompt(record(userText(ctx, 'Hello')))).toBe(true);
    expect(isTypedPrompt(record(toolResult(ctx)))).toBe(false);
    expect(isTypedPrompt(record(userText(ctx, 'x', { isMeta: true })))).toBe(
      false,
    );
    expect(
      isTypedPrompt(record(userText({ ...ctx, sidechain: true }, 'x'))),
    ).toBe(false);
    expect(
      isTypedPrompt(
        record(userText(ctx, '<task-notification>\n<task-id>a</task-id>')),
      ),
    ).toBe(false);
    expect(
      isTypedPrompt(
        record(userText(ctx, 'Summary', { isCompactSummary: true })),
      ),
    ).toBe(false);
  });

  it.each([
    '<task-notification>\n<task-id>a</task-id>',
    '<local-command-stdout>Compacted</local-command-stdout>',
    '<local-command-stderr>Failed</local-command-stderr>',
    '<local-command-caveat>Caveat</local-command-caveat>',
    '<bash-stdout>ok</bash-stdout>',
    '<bash-stderr>error</bash-stderr>',
    '[Request interrupted by user]',
    '[Request interrupted by user for tool use]',
  ])('does not count %s as a typed prompt', (text) => {
    expect(isTypedPrompt(record(userText(ctx, text)))).toBe(false);
    const blocks = { role: 'user', content: [{ type: 'text', text }] };
    expect(isTypedPrompt(record(userText(ctx, '', { message: blocks })))).toBe(
      false,
    );
  });

  it('counts a prompt of images alone', () => {
    const image = { type: 'image', source: { type: 'base64', data: 'AA==' } };
    expect(
      isTypedPrompt(
        record(
          userText(ctx, '', { message: { role: 'user', content: [image] } }),
        ),
      ),
    ).toBe(true);
    expect(
      isTypedPrompt(
        record(
          userText(ctx, '', {
            message: {
              role: 'user',
              content: [
                { type: 'tool_result', tool_use_id: 't', content: [image] },
                image,
              ],
            },
          }),
        ),
      ),
    ).toBe(false);
  });

  it('reads the slash command a prompt holds', () => {
    const prompt = userText(
      ctx,
      '<command-message>review</command-message>\n<command-name>/review</command-name>',
    );
    expect(slashCommandOf(record(prompt))).toBe('review');
    expect(slashCommandOf(record(userText(ctx, 'plain')))).toBeUndefined();
  });

  it('tells skill instructions from other meta records', () => {
    expect(isSlashSkillInstructions(record(skillInstructions(ctx)))).toBe(true);
    expect(
      isSlashSkillInstructions(
        record({ ...skillInstructions(ctx), sourceToolUseID: 'toolu_1' }),
      ),
    ).toBe(false);
    expect(
      isSlashSkillInstructions(
        record(
          userText(ctx, '<local-command-caveat>x</local-command-caveat>', {
            isMeta: true,
          }),
        ),
      ),
    ).toBe(false);
  });
});

function skillCall(skill: string): Record<string, unknown> {
  return {
    type: 'tool_use',
    id: `toolu_${skill}`,
    name: 'Skill',
    input: { skill },
  };
}

describe('turn ended', () => {
  const ask = userText(ctx, 'Do it');
  it.each(['end_turn', 'stop_sequence', 'max_tokens', 'refusal'])(
    'has ended after stop reason %s',
    (stopReason) => {
      expect(
        endedAfter([ask, assistant(ctx, { requestId: 'r', stopReason })]),
      ).toBe(true);
    },
  );

  it.each(['tool_use', 'pause_turn', null])(
    'is still going after stop reason %s',
    (stopReason) => {
      expect(
        endedAfter([ask, assistant(ctx, { requestId: 'r', stopReason })]),
      ).toBe(false);
    },
  );

  it('is reopened by a typed prompt or a slash skill', () => {
    const done = assistant(ctx, { requestId: 'r' });
    expect(endedAfter([done, userText(ctx, 'Next')])).toBe(false);
    expect(
      endedAfter([
        done,
        userText(ctx, '<command-name>/review</command-name>'),
        skillInstructions(ctx),
      ]),
    ).toBe(false);
  });

  it('stays ended after built-in commands and records Claude Code writes', () => {
    const done = assistant(ctx, { requestId: 'r' });
    expect(
      endedAfter([
        done,
        userText(ctx, '<local-command-caveat>x</local-command-caveat>', {
          isMeta: true,
        }),
        userText(ctx, '<command-name>/model</command-name>'),
        userText(ctx, '<local-command-stdout>Set model</local-command-stdout>'),
        userText(ctx, '<task-notification>\n<task-id>a</task-id>'),
        userText(ctx, 'Another session sent a message', { isMeta: true }),
        toolResult(ctx),
      ]),
    ).toBe(true);
  });

  it('has ended when the last user record is an interruption', () => {
    const interruption = {
      ...userText(ctx, ''),
      message: {
        role: 'user',
        content: [
          { type: 'text', text: '[Request interrupted by user for tool use]' },
        ],
      },
    };
    expect(
      endedAfter([
        ask,
        assistant(ctx, { requestId: 'r', stopReason: 'tool_use' }),
        interruption,
      ]),
    ).toBe(true);
  });

  it('is still going with no assistant record', () => {
    expect(endedAfter([ask])).toBe(false);
  });
});
