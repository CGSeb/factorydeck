import type { Database } from '../db/client.ts';
import { apiCall, session, subAgent } from '../db/schema.ts';

export const NOW = new Date('2026-11-21T12:00:00Z');
const MINUTE = 60_000;
export const options = { inactiveAfterMinutes: 30, now: NOW };

export function ago(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * MINUTE);
}

let key = 0;

function call(
  sessionId: string,
  model: string,
  tokens: [number, number, number, number],
  subAgentId: string | null = null,
): typeof apiCall.$inferInsert {
  key += 1;
  return {
    sourcePath: `/synthetic/${sessionId}.jsonl`,
    requestKey: `req_${key}`,
    sessionId,
    subAgentId,
    at: ago(40),
    model,
    inputTokens: tokens[0],
    cacheWriteTokens: tokens[1],
    cacheReadTokens: tokens[2],
    outputTokens: tokens[3],
  };
}

const SESSIONS: (typeof session.$inferInsert)[] = [
  {
    id: 'working-1',
    project: '/work/app',
    cwd: '/work/app',
    gitBranch: 'feat/x',
    gitBranches: ['main', 'feat/x'],
    title: 'Build the thing',
    firstAt: ago(120),
    lastAt: ago(29.9),
    turnEnded: false,
  },
  {
    id: 'waiting-1',
    project: '/work/app',
    firstAt: ago(10),
    lastAt: ago(1),
    turnEnded: true,
  },
  {
    id: 'edge-inactive',
    project: '/work/lib',
    firstAt: ago(60),
    lastAt: ago(30),
    turnEnded: false,
  },
  {
    id: 'old-ended',
    project: '/work/lib',
    firstAt: ago(60 * 24 * 20),
    lastAt: ago(60 * 24 * 20 - 5),
    turnEnded: true,
  },
  {
    id: 'agent-busy',
    firstAt: ago(90),
    lastAt: ago(80),
    turnEnded: false,
  },
];

const SUB_AGENTS: (typeof subAgent.$inferInsert)[] = [
  {
    sessionId: 'agent-busy',
    id: 'b-second',
    agentType: 'Explore',
    description: 'Look around',
    model: 'claude-haiku-9',
    firstAt: ago(70),
    lastAt: ago(5),
  },
  {
    sessionId: 'agent-busy',
    id: 'a-first',
    agentType: '',
    description: '',
    model: '',
    firstAt: ago(85),
    lastAt: ago(75),
  },
];

export async function seedSessions(db: Database): Promise<void> {
  await db.insert(session).values(SESSIONS);
  await db.insert(subAgent).values(SUB_AGENTS);
  await db
    .insert(apiCall)
    .values([
      call('working-1', 'claude-opus-9', [1_000_000, 0, 0, 0]),
      call('working-1', 'mystery-model', [5, 5, 5, 5]),
      call('agent-busy', 'claude-sonnet-9', [0, 0, 0, 100_000]),
      call('agent-busy', 'claude-haiku-9', [1_000_000, 0, 0, 0], 'b-second'),
      call('agent-busy', 'mystery-model', [1, 2, 3, 4], 'a-first'),
      call('old-ended', 'mystery-model', [10, 0, 0, 0]),
    ]);
}
