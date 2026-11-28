import { gzipSync } from 'node:zlib';
import { type BatchInput, fileKeyOf } from '../cli-ingest/batch-schema.ts';
import { project } from '../db/schema.ts';
import type { Database } from '../db/client.ts';

export type ThreadInput = BatchInput['threads'][number];
type CallInput = NonNullable<ThreadInput['apiCalls']>[number];

export const REMOTE = 'git@github.com:acme/shop.git';
export const NORMAL_REMOTE = 'github.com/acme/shop';
const AT = Date.parse('2026-03-12T09:00:00.000Z');

export function minutes(offset: number): string {
  return new Date(AT + offset * 60_000).toISOString();
}

export function apiCall(
  requestKey: string,
  at = minutes(0),
  model = 'claude-sonnet-4-5',
): CallInput {
  return {
    requestKey,
    at,
    model,
    inputTokens: 100,
    cacheWriteTokens: 10,
    cacheReadTokens: 1000,
    outputTokens: 50,
  };
}

export function mainThread(
  sessionId: string,
  options: {
    remote?: string | null;
    calls?: CallInput[];
    cwd?: string | null;
    firstAt?: string;
    agent?: 'claude-code' | 'codex';
  } = {},
): ThreadInput {
  const agent = options.agent ?? 'claude-code';
  return {
    fileKey: fileKeyOf(agent, sessionId, null),
    agent,
    sessionId,
    subAgentId: null,
    remote: options.remote === undefined ? REMOTE : options.remote,
    from: 0,
    readTo: 4096,
    readerState: null,
    session: {
      cwd: options.cwd === undefined ? '/home/dev/shop' : options.cwd,
      gitBranch: 'feat/12-cart',
      gitBranches: ['main', 'feat/12-cart'],
      title: `Session ${sessionId}`,
      firstAt: options.firstAt ?? minutes(0),
      lastAt: minutes(30),
      turnEnded: true,
    },
    apiCalls: options.calls ?? [
      apiCall(`${sessionId}-r1`, minutes(1)),
      apiCall(`${sessionId}-r2`, minutes(2)),
    ],
  };
}

export function subAgentThread(
  sessionId: string,
  subAgentId: string,
  options: {
    remote?: string | null;
    calls?: CallInput[];
    cwd?: string | null;
  } = {},
): ThreadInput {
  return {
    fileKey: fileKeyOf('claude-code', sessionId, subAgentId),
    agent: 'claude-code',
    sessionId,
    subAgentId,
    remote: options.remote === undefined ? REMOTE : options.remote,
    from: 0,
    readTo: 2048,
    readerState: null,
    subAgent: {
      toolUseId: `toolu_${subAgentId}`,
      agentType: 'general-purpose',
      description: 'Build the cart',
      model: 'claude-haiku-4-5',
      cwd: options.cwd === undefined ? '/home/dev/shop' : options.cwd,
      gitBranch: 'feat/12-cart',
      firstAt: minutes(5),
      lastAt: minutes(10),
    },
    apiCalls: options.calls ?? [
      apiCall(`${sessionId}-${subAgentId}-r1`, minutes(6), 'claude-haiku-4-5'),
    ],
  };
}

export function twoSessions(): BatchInput {
  return {
    parserVersion: 1,
    threads: [
      mainThread('s-1'),
      subAgentThread('s-1', 'a1'),
      mainThread('s-2'),
      subAgentThread('s-2', 'b1'),
      subAgentThread('s-2', 'b2'),
    ],
  };
}

export function ingestRequest(
  body: unknown,
  token: string,
  options: { gzip?: boolean; headers?: Record<string, string> } = {},
): RequestInit {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(options.gzip === true ? { 'content-encoding': 'gzip' } : {}),
      ...options.headers,
    },
    body: options.gzip === true ? gzipSync(text) : text,
  };
}

export async function addProject(
  db: Database,
  remote = NORMAL_REMOTE,
  slug = 'shop',
): Promise<void> {
  await db
    .insert(project)
    .values({ name: slug, slug, remote, createdAt: new Date(AT) });
}
