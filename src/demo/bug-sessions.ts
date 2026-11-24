import { type DemoSession, haiku, opus, replying, sonnet } from './calls.ts';

const HOUR = 3_600_000;

export const BUG_ISSUE = 41;
export const REPORTED_BUG = 42;

export function bugSessions(project: string, day: number): DemoSession[] {
  const issue = `#${String(BUG_ISSUE)}`;
  return [
    {
      id: 'demo-app-report-bug',
      folder: '-demo-example-app',
      project,
      gitBranch: 'main',
      startsAgo: 3 * day + 2 * HOUR,
      prompt: 'The export button does nothing',
      calls: [
        opus,
        replying(
          sonnet,
          `Bug reported.\n\nWork item: #${String(REPORTED_BUG)} (bug-reporter)`,
        ),
      ],
    },
    {
      id: 'demo-app-fix-bug',
      folder: '-demo-example-app',
      project,
      gitBranch: 'main',
      startsAgo: 2 * day + 6 * HOUR,
      prompt: `Fix bug ${issue}`,
      calls: [opus, sonnet],
      subAgents: [
        {
          id: 'check-bug',
          agentType: 'general-purpose',
          description: `check-bug ${issue}`,
          calls: [sonnet],
        },
        {
          id: 'debug',
          agentType: 'general-purpose',
          description: `Debug ${issue}`,
          calls: [opus, sonnet],
        },
        {
          id: 'review',
          agentType: 'general-purpose',
          description: `Review ${issue}`,
          calls: [opus],
        },
        {
          id: 'ship',
          agentType: 'general-purpose',
          description: `Ship ${issue}`,
          calls: [haiku],
        },
      ],
    },
  ];
}
