import type { Database } from '../db/client.ts';
import { apiCall, session, subAgent } from '../db/schema.ts';

export const OVERVIEW_NOW = new Date('2026-11-21T12:00:00Z');
export const PARIS = 'Europe/Paris';

interface Call {
  session: string;
  at: string;
  model: string;
  tokens: [number, number, number, number];
  subAgent?: string;
}

let key = 0;
async function insertCalls(target: Database, calls: Call[]): Promise<void> {
  await target.insert(apiCall).values(
    calls.map((call) => {
      key += 1;
      return {
        sourcePath: `/synthetic/${call.session}.jsonl`,
        requestKey: `req_${key}`,
        sessionId: call.session,
        subAgentId: call.subAgent ?? null,
        at: new Date(call.at),
        model: call.model,
        inputTokens: call.tokens[0],
        cacheWriteTokens: call.tokens[1],
        cacheReadTokens: call.tokens[2],
        outputTokens: call.tokens[3],
      };
    }),
  );
}

export async function seedOverview(target: Database): Promise<void> {
  await target.insert(session).values([
    { id: 's-app-1', project: '/work/app' },
    { id: 's-app-2', project: '/work/app' },
    { id: 's-lib', project: '/work/lib' },
    { id: 's-loose', project: '/work/loose' },
    { id: 's-idle', project: '/work/idle' },
  ]);
  await target
    .insert(subAgent)
    .values({ sessionId: 's-lib', id: 'agent-1', model: 'claude-haiku-9' });
  await insertCalls(target, [
    {
      session: 's-app-1',
      at: '2026-11-20T23:30:00Z',
      model: 'claude-opus-9',
      tokens: [1_000_000, 0, 0, 0],
    },
    {
      session: 's-app-1',
      at: '2026-11-20T22:30:00Z',
      model: 'claude-sonnet-9',
      tokens: [0, 0, 0, 100_000],
    },
    {
      session: 's-app-2',
      at: '2026-11-15T10:00:00Z',
      model: 'claude-sonnet-9',
      tokens: [0, 0, 0, 100_000],
    },
    {
      session: 's-lib',
      subAgent: 'agent-1',
      at: '2026-11-21T09:15:00Z',
      model: 'claude-haiku-9',
      tokens: [1_000_000, 0, 0, 0],
    },
    {
      session: 's-loose',
      at: '2026-11-21T08:00:00Z',
      model: 'mystery-model',
      tokens: [10, 20, 30, 40],
    },
    {
      session: 's-loose',
      at: '2026-11-21T08:05:00Z',
      model: 'claude-opus-9',
      tokens: [0, 0, 0, 1000],
    },
    {
      session: 's-app-1',
      at: '2026-10-01T10:00:00Z',
      model: 'claude-opus-9',
      tokens: [0, 0, 1_000_000, 0],
    },
  ]);
}
