import type { SessionDetail, SessionSummary } from '../sessions/types.ts';
import { nameOf } from './project-fixtures.ts';
import {
  sessionWithoutSubAgents,
  someSessions,
  waitingSession,
} from './session-fixtures.ts';
import { splitTokens } from './token-fixtures.ts';

const MINUTE = 60_000;

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE).toISOString();
}

export const codexSession: SessionSummary = {
  ...waitingSession,
  id: 'd0d0cafe-0000-4000-8000-000000000004',
  agent: 'codex',
  title: '',
  project: '/home/dev/example-app',
  projectName: nameOf('/home/dev/example-app'),
  gitBranches: ['feat/import'],
  workItem: 54,
  issue: { status: 'not-found' },
  tokens: 96_000,
  tokenCounts: splitTokens(96_000),
  costUsd: null,
};

export const mixedSessions = [...someSessions, codexSession];

export const codexSessionDetail: SessionDetail = {
  ...codexSession,
  issueDetail: null,
  projects: sessionWithoutSubAgents.projects,
  frictions: 0,
  cwd: '/home/dev/example-app',
  tokens: { input: 6_000, cacheWrite: 0, cacheRead: 84_000, output: 6_000 },
  skills: [
    {
      skill: null,
      launches: 0,
      sessions: 0,
      apiCalls: 6,
      tokens: 96_000,
      tokenCounts: splitTokens(96_000),
      costUsd: null,
      averageCostUsd: null,
    },
  ],
  subAgents: [
    {
      id: 'e1',
      agentType: 'worker',
      role: 'worker',
      workItem: 54,
      issue: { status: 'not-found' },
      description: '/root/import_worker',
      model: 'gpt-example',
      firstAt: minutesAgo(30),
      lastAt: minutesAgo(20),
      tokens: 40_000,
      tokenCounts: splitTokens(40_000),
      costUsd: null,
    },
  ],
};
