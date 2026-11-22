import { type DemoSession, opus, sonnet } from './calls.ts';

const HOUR = 3_600_000;

export function helpSession(project: string, day: number): DemoSession {
  return {
    id: 'demo-app-help',
    folder: '-demo-example-app',
    project,
    gitBranch: 'main',
    startsAgo: 4 * day + 3 * HOUR,
    prompt: 'Build the next issues',
    calls: [opus, sonnet],
    subAgents: [
      {
        id: 'worker-24',
        agentType: 'general-purpose',
        description: 'Worker for #24',
        calls: [sonnet, sonnet],
      },
      {
        id: 'worker-25',
        agentType: 'general-purpose',
        description: 'Worker for #25',
        calls: [sonnet, opus],
      },
    ],
  };
}
