import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Line = Record<string, unknown>;

interface Call {
  model: string | undefined;
  tokens: [number, number, number, number];
}

interface DemoSession {
  id: string;
  folder: string;
  cwd: string | undefined;
  gitBranch: string;
  startsAgo: number;
  prompt: string;
  calls: readonly Call[];
  subAgents?: readonly DemoSubAgent[];
}

interface DemoSubAgent {
  id: string;
  agentType: string;
  description: string;
  calls: readonly Call[];
}

const opus: Call = {
  model: 'claude-opus-demo',
  tokens: [800, 12_000, 90_000, 2_500],
};
const sonnet: Call = {
  model: 'claude-sonnet-demo',
  tokens: [600, 8_000, 60_000, 1_800],
};
const haiku: Call = {
  model: 'claude-haiku-demo',
  tokens: [400, 3_000, 20_000, 900],
};
const unknownPrice: Call = {
  model: 'example-model-x',
  tokens: [300, 2_000, 10_000, 700],
};
const noModel: Call = { model: undefined, tokens: [200, 1_000, 5_000, 300] };

export const DEMO_SESSIONS: readonly DemoSession[] = [
  ...[9, 6, 4, 3, 2, 1].map((days, index) => ({
    id: `demo-app-${String(index + 1)}`,
    folder: '-demo-example-app',
    cwd: '/demo/example-app',
    gitBranch: `feat/00${String(index + 1)}-demo`,
    startsAgo: days * DAY + 2 * HOUR,
    prompt: `Build issue #${String(index + 11)}`,
    calls: [opus, opus, sonnet, haiku, opus],
    subAgents: [
      {
        id: 'explore',
        agentType: 'Explore',
        description: 'Find the code to change',
        calls: [haiku],
      },
      {
        id: 'worker',
        agentType: 'general-purpose',
        description: `Worker for #${String(index + 11)}`,
        calls: [sonnet, sonnet],
      },
      {
        id: 'review',
        agentType: 'general-purpose',
        description: `Review #${String(index + 11)}`,
        calls: [opus],
      },
      {
        id: 'other',
        agentType: '',
        description: '',
        calls: [haiku],
      },
    ],
  })),
  {
    id: 'demo-app-web',
    folder: '-demo-example-app',
    cwd: '/demo/example-app',
    gitBranch: 'main',
    startsAgo: 8 * DAY,
    prompt: 'Fix the layout',
    calls: [sonnet, sonnet, haiku],
  },
  ...[7, 2].map((days, index) => ({
    id: `demo-api-${String(index + 1)}`,
    folder: '-demo-example-api',
    cwd: '/demo/example-api',
    gitBranch: 'main',
    startsAgo: days * DAY + 4 * HOUR,
    prompt: 'Add an endpoint',
    calls: [sonnet, unknownPrice, haiku, noModel, sonnet],
  })),
  {
    id: 'demo-unassigned',
    folder: '-demo-scratch',
    cwd: undefined,
    gitBranch: '',
    startsAgo: 3 * DAY + 6 * HOUR,
    prompt: 'Explain this error',
    calls: [haiku, sonnet],
  },
  {
    id: 'demo-today',
    folder: '-demo-example-app',
    cwd: '/demo/example-app',
    gitBranch: 'feat/007-demo',
    startsAgo: 20 * 60_000,
    prompt: 'Review the branch',
    calls: [opus, sonnet, opus],
  },
];

function callLines(
  calls: readonly Call[],
  prefix: string,
  context: (step: number) => Line,
): Line[] {
  return calls.map((call, index) => {
    const [input, cacheWrite, cacheRead, output] = call.tokens;
    const requestId = `${prefix}-req-${String(index)}`;
    return {
      type: 'assistant',
      ...context(index + 1),
      requestId,
      message: {
        id: `msg_${requestId}`,
        role: 'assistant',
        ...(call.model === undefined ? {} : { model: call.model }),
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Done.' }],
        usage: {
          input_tokens: input,
          cache_creation_input_tokens: cacheWrite,
          cache_read_input_tokens: cacheRead,
          output_tokens: output,
        },
      },
    };
  });
}

function contextOf(
  session: DemoSession,
  now: number,
  thread: string,
  sidechain: boolean,
): (step: number) => Line {
  const start = now - session.startsAgo;
  return (step) => ({
    uuid: `${thread}-${String(step)}`,
    timestamp: new Date(start + step * 60_000).toISOString(),
    sessionId: session.id,
    isSidechain: sidechain,
    ...(session.cwd === undefined
      ? {}
      : { cwd: session.cwd, gitBranch: session.gitBranch }),
  });
}

function linesOf(session: DemoSession, now: number): Line[] {
  const context = contextOf(session, now, session.id, false);
  return [
    {
      type: 'custom-title',
      customTitle: session.prompt,
      sessionId: session.id,
    },
    {
      type: 'user',
      ...context(0),
      promptId: `${session.id}-prompt`,
      message: { role: 'user', content: session.prompt },
    },
    ...callLines(session.calls, session.id, (step) => context(step + 1)),
  ];
}

function subAgentLines(
  session: DemoSession,
  agent: DemoSubAgent,
  now: number,
): Line[] {
  const thread = `${session.id}-${agent.id}`;
  const context = contextOf(session, now, thread, true);
  return [
    {
      type: 'user',
      ...context(1),
      message: { role: 'user', content: agent.description },
    },
    ...callLines(agent.calls, thread, (step) => context(step + 2)),
  ];
}

function jsonLines(lines: readonly Line[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

export async function writeDemoSessions(
  folder: string,
  now: Date,
): Promise<void> {
  for (const session of DEMO_SESSIONS) {
    const dir = join(folder, session.folder);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, `${session.id}.jsonl`),
      jsonLines(linesOf(session, now.getTime())),
    );
    const agents = join(dir, session.id, 'subagents');
    for (const agent of session.subAgents ?? []) {
      await mkdir(agents, { recursive: true });
      await writeFile(
        join(agents, `agent-${agent.id}.jsonl`),
        jsonLines(subAgentLines(session, agent, now.getTime())),
      );
      await writeFile(
        join(agents, `agent-${agent.id}.meta.json`),
        JSON.stringify({
          agentType: agent.agentType,
          description: agent.description,
        }),
      );
    }
  }
}
