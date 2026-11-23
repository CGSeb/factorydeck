import { join } from 'node:path';
import { type DemoSession, type DemoSubAgent, callLines } from './calls.ts';
import { demoFrictionLines } from './frictions.ts';

type Line = Record<string, unknown>;

export interface Clock {
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

export function linesOf(session: DemoSession, clock: Clock): Line[] {
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
    ...demoFrictionLines(session.frictions ?? [], session.id, context, 0),
    ...callLines(session.calls, session.id, (step) => context(step + 1)),
  ];
}

export function subAgentLines(
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
    ...demoFrictionLines(agent.frictions ?? [], thread, context, 1),
    ...callLines(agent.calls, thread, (step) => context(step + 2)),
  ];
}

export function jsonLines(lines: readonly Line[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}
