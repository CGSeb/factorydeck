import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type DemoSession,
  haiku,
  launching,
  noModel,
  opus,
  sonnet,
  unknownPrice,
} from './calls.ts';
import { factoryFile } from '../ingest/factory.ts';
import {
  ENDPOINT_FRICTIONS,
  MAIN_FRICTIONS,
  SECOND_MAIN_FRICTIONS,
  WORKER_FRICTIONS,
} from './frictions.ts';
import { installFakeGitHost } from './fake-git-host.ts';
import {
  type Clock,
  jsonLines,
  linesOf,
  subAgentLines,
} from './session-lines.ts';
import { flowSessions, reworkSessions } from './flow-sessions.ts';
import { helpSession } from './help-sessions.ts';
import { markerSessions } from './marker-sessions.ts';
import { bugSessions } from './bug-sessions.ts';
import { demoGitHub } from './git-host.ts';
import { demoGitLab } from './git-host-gitlab.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const EXAMPLE_APP = 'example-app';
export const EXAMPLE_API = 'example-api';
export const EXAMPLE_APP_NAME = 'Example App';
export const BUILD_SKILL = 'kit:build-feature';
export const REVIEW_SKILL = 'kit:code-review';
export const SPEC_SKILL = 'kit:write-spec';

export const DEMO_SESSIONS: readonly DemoSession[] = [
  ...[9, 6, 4, 3, 2, 1].map((days, index) => ({
    id: `demo-app-${String(index + 1)}`,
    folder: '-demo-example-app',
    project: EXAMPLE_APP,
    gitBranch: `feat/00${String(index + 1)}-demo`,
    startsAgo: days * DAY + 2 * HOUR,
    prompt: `Build issue #${String(index + 11)}`,
    calls: [
      launching(opus, BUILD_SKILL),
      opus,
      sonnet,
      index % 2 === 1 ? launching(haiku, REVIEW_SKILL) : haiku,
      opus,
    ],
    frictions: [MAIN_FRICTIONS, SECOND_MAIN_FRICTIONS][index] ?? [],
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
        frictions: index === 0 ? WORKER_FRICTIONS : [],
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
  helpSession(EXAMPLE_APP, DAY),
  {
    id: 'demo-app-web',
    folder: '-demo-example-app',
    project: EXAMPLE_APP,
    gitBranch: 'main',
    startsAgo: 8 * DAY,
    prompt: 'Fix the layout',
    calls: [launching(sonnet, SPEC_SKILL), sonnet, haiku],
  },
  ...markerSessions(EXAMPLE_APP, DAY, SPEC_SKILL),
  ...bugSessions(EXAMPLE_APP, DAY),
  ...flowSessions(EXAMPLE_APP),
  ...reworkSessions(EXAMPLE_APP),
  ...[7, 2].map((days, index) => ({
    id: `demo-api-${String(index + 1)}`,
    folder: '-demo-example-api',
    project: EXAMPLE_API,
    gitBranch: `fix/${String(index + 21)}-endpoint`,
    startsAgo: days * DAY + 4 * HOUR,
    prompt: 'Add an endpoint',
    calls: [
      launching(sonnet, SPEC_SKILL),
      unknownPrice,
      haiku,
      noModel,
      sonnet,
    ],
    subAgents: [
      {
        id: 'endpoint',
        agentType: 'general-purpose',
        description: 'Add the endpoint handler',
        calls: [sonnet],
        frictions: index === 0 ? ENDPOINT_FRICTIONS : [],
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
    calls: [
      launching(opus, REVIEW_SKILL),
      sonnet,
      launching(opus, REVIEW_SKILL),
    ],
  },
];

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
      'bugs:\n  label: bug\n',
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
