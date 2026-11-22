import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Call,
  type DemoSession,
  type DemoSubAgent,
  haiku,
  noModel,
  opus,
  sonnet,
  unknownPrice,
} from './calls.ts';
import { factoryFile } from '../ingest/factory.ts';
import { installFakeGitHost } from './fake-git-host.ts';
import { demoGitHub, demoGitLab } from './git-host.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Line = Record<string, unknown>;

export const EXAMPLE_APP = 'example-app';
export const EXAMPLE_API = 'example-api';
export const EXAMPLE_APP_NAME = 'Example App';

export const DEMO_SESSIONS: readonly DemoSession[] = [
  ...[9, 6, 4, 3, 2, 1].map((days, index) => ({
    id: `demo-app-${String(index + 1)}`,
    folder: '-demo-example-app',
    project: EXAMPLE_APP,
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
    id: 'demo-app-queue',
    folder: '-demo-example-app',
    project: EXAMPLE_APP,
    gitBranch: 'main',
    startsAgo: DAY + 5 * HOUR,
    prompt: 'Work through the queue',
    calls: [opus, sonnet],
    subAgents: [
      {
        id: 'worker',
        agentType: 'general-purpose',
        description: 'Worker for #13',
        calls: [sonnet, sonnet],
      },
      {
        id: 'review',
        agentType: 'general-purpose',
        description: 'Review #14',
        calls: [opus],
      },
    ],
  },
  {
    id: 'demo-app-web',
    folder: '-demo-example-app',
    project: EXAMPLE_APP,
    gitBranch: 'main',
    startsAgo: 8 * DAY,
    prompt: 'Fix the layout',
    calls: [sonnet, sonnet, haiku],
  },
  ...[7, 2].map((days, index) => ({
    id: `demo-api-${String(index + 1)}`,
    folder: '-demo-example-api',
    project: EXAMPLE_API,
    gitBranch: `fix/${String(index + 21)}-endpoint`,
    startsAgo: days * DAY + 4 * HOUR,
    prompt: 'Add an endpoint',
    calls: [sonnet, unknownPrice, haiku, noModel, sonnet],
    subAgents: [
      {
        id: 'endpoint',
        agentType: 'general-purpose',
        description: 'Add the endpoint handler',
        calls: [sonnet],
      },
    ],
  })),
  {
    id: 'demo-unassigned',
    folder: '-demo-scratch',
    project: undefined,
    gitBranch: '',
    startsAgo: 3 * DAY + 6 * HOUR,
    prompt: 'Explain this error',
    calls: [haiku, sonnet],
  },
  {
    id: 'demo-today',
    folder: '-demo-example-app',
    project: EXAMPLE_APP,
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

interface Clock {
  now: number;
  projects: string;
}

function contextOf(
  session: DemoSession,
  { now, projects }: Clock,
  thread: string,
  sidechain: boolean,
): (step: number) => Line {
  const start = now - session.startsAgo;
  return (step) => ({
    uuid: `${thread}-${String(step)}`,
    timestamp: new Date(start + step * 60_000).toISOString(),
    sessionId: session.id,
    isSidechain: sidechain,
    ...(session.project === undefined
      ? {}
      : {
          cwd: join(projects, session.project),
          gitBranch: session.gitBranch,
        }),
  });
}

function linesOf(session: DemoSession, clock: Clock): Line[] {
  const context = contextOf(session, clock, session.id, false);
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
  clock: Clock,
): Line[] {
  const thread = `${session.id}-${agent.id}`;
  const context = contextOf(session, clock, thread, true);
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

export function demoProjectRoot(projects: string, name: string): string {
  return join(projects, name);
}

export async function installDemoFactory(
  projects: string,
  name: string,
): Promise<void> {
  const folder = join(demoProjectRoot(projects, name), 'docs', 'agents');
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'factory.yml'), 'version: 2\n');
}

export async function writeDemoSessions(
  folder: string,
  now: Date,
  projects: string,
  { factory = true }: { factory?: boolean } = {},
): Promise<void> {
  const clock: Clock = { now: now.getTime(), projects };
  for (const name of [EXAMPLE_APP, EXAMPLE_API]) {
    await mkdir(demoProjectRoot(projects, name), { recursive: true });
    if (factory) await installDemoFactory(projects, name);
  }
  if (factory) {
    await installFakeGitHost(
      demoProjectRoot(projects, EXAMPLE_APP),
      demoGitHub(now),
    );
    await installFakeGitHost(
      demoProjectRoot(projects, EXAMPLE_API),
      demoGitLab(now),
    );
    await appendFile(
      factoryFile(demoProjectRoot(projects, EXAMPLE_APP)),
      `project:\n  name: ${EXAMPLE_APP_NAME}\n`,
    );
  }
  for (const session of DEMO_SESSIONS) {
    const dir = join(folder, session.folder);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, `${session.id}.jsonl`),
      jsonLines(linesOf(session, clock)),
    );
    const agents = join(dir, session.id, 'subagents');
    for (const agent of session.subAgents ?? []) {
      await mkdir(agents, { recursive: true });
      await writeFile(
        join(agents, `agent-${agent.id}.jsonl`),
        jsonLines(subAgentLines(session, agent, clock)),
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

export function demoProjectOverride(projects: string): string {
  return `
projects:
  ${demoProjectRoot(projects, EXAMPLE_API)}:
    roles:
      - name: api-builder
        description: '^Add '
    work_items:
      - from: branch
        pattern: '^[a-z]+/(\\d+)-'
`;
}

export async function writeDemoConfig(
  path: string,
  projects: string,
): Promise<void> {
  await writeFile(path, `version: 1\n${demoProjectOverride(projects)}`);
}
