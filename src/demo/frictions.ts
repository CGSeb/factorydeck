import { homedir } from 'node:os';

export type DemoFriction =
  | { tool: string; command?: string; result: string }
  | { lostCall: string }
  | { hooks: readonly string[] }
  | { compaction: 'auto' | 'manual'; tokens?: readonly number[] };

type Line = Record<string, unknown>;

const STOP_REASON = 'fixture: checks of this branch fail, fix them first';

const failingTests: DemoFriction = {
  tool: 'Bash',
  command: 'cd web && pnpm test',
  result: 'Exit code 1\nfixture: 2 tests fail',
};

export const MAIN_FRICTIONS: readonly DemoFriction[] = [
  failingTests,
  failingTests,
  failingTests,
  {
    tool: 'Edit',
    result:
      '<tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>',
  },
  {
    tool: 'Bash',
    command: 'rm -rf dist',
    result: 'Permission for this command was denied.',
  },
  {
    tool: 'Bash',
    command: 'git push --force',
    result: 'PreToolUse:Bash hook error: fixture: force push is blocked',
  },
  { tool: 'mcp__docs__search', result: 'fixture: request timed out' },
  {
    hooks: [
      `[node ${homedir()}/.claude/hooks/before-stop.ts]: ${STOP_REASON}`,
      STOP_REASON,
    ],
  },
  { compaction: 'auto', tokens: [158_000, 11_000] },
];

export const SECOND_MAIN_FRICTIONS: readonly DemoFriction[] = [
  { compaction: 'manual', tokens: [92_000] },
  { compaction: 'manual' },
];

export const WORKER_FRICTIONS: readonly DemoFriction[] = [
  {
    tool: 'Bash',
    command: 'NODE_ENV=test ./scripts/lint.sh --fix',
    result: 'Exit code 2\nfixture: lint errors',
  },
  { lostCall: 'fixture: tool failed' },
  {
    tool: 'WebFetch',
    result: "The user doesn't want to proceed with this tool use.",
  },
  {
    tool: 'Edit',
    result: '<tool_use_error>String to replace not found in file.',
  },
  { hooks: ['[pnpm check]: fixture: checks fail'] },
  { compaction: 'auto', tokens: [140_000, 9_000] },
];

export const ENDPOINT_FRICTIONS: readonly DemoFriction[] = [
  {
    tool: 'Write',
    result: 'PostToolUse:Write hook error: fixture: format failed',
  },
  {
    tool: 'Bash',
    command: 'pnpm build | tail -5',
    result: 'Exit code 1\nfixture: build failed',
  },
  {
    tool: 'Bash',
    command: 'curl https://example.com',
    result: 'Permission to use Bash with command curl has been denied.',
  },
  { tool: 'Grep', result: 'fixture: unexpected failure' },
];

type ToolFriction = Extract<
  DemoFriction,
  { tool: string } | { lostCall: string }
>;

function toolErrorLines(friction: ToolFriction, base: Line): Line[] {
  const toolUseId = `toolu_${String(base['uuid'])}`;
  const result: Line = {
    type: 'user',
    ...base,
    uuid: `${String(base['uuid'])}-result`,
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          is_error: true,
          content: 'tool' in friction ? friction.result : friction.lostCall,
        },
      ],
    },
  };
  if ('lostCall' in friction) return [result];
  const input =
    friction.command === undefined ? {} : { command: friction.command };
  return [
    {
      type: 'assistant',
      ...base,
      message: {
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: toolUseId, name: friction.tool, input },
        ],
      },
    },
    result,
  ];
}

function frictionLines(friction: DemoFriction, base: Line): Line[] {
  if ('tool' in friction || 'lostCall' in friction) {
    return toolErrorLines(friction, base);
  }
  if ('hooks' in friction) {
    return [
      {
        type: 'system',
        subtype: 'stop_hook_summary',
        ...base,
        hookCount: friction.hooks.length,
        hookErrors: friction.hooks,
      },
    ];
  }
  const [preTokens, postTokens] = friction.tokens ?? [];
  return [
    {
      type: 'system',
      subtype: 'compact_boundary',
      ...base,
      content: 'Conversation compacted',
      compactMetadata: {
        trigger: friction.compaction,
        ...(preTokens === undefined ? {} : { preTokens }),
        ...(postTokens === undefined ? {} : { postTokens }),
      },
    },
  ];
}

export function demoFrictionLines(
  frictions: readonly DemoFriction[],
  thread: string,
  context: (step: number) => Line,
  from: number,
): Line[] {
  return frictions.flatMap((friction, index) =>
    frictionLines(friction, {
      ...context(from + (index + 1) / (frictions.length + 1)),
      uuid: `${thread}-friction-${String(index)}`,
    }),
  );
}
