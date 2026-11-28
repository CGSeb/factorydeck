import type { Database } from '../db/client.ts';
import {
  apiCall,
  closingLine,
  friction,
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  session,
  skillLaunch,
  subAgent,
  userPrompt,
} from '../db/schema.ts';

const AT = new Date('2026-03-12T10:00:00Z');

export async function seedSessionRows(
  db: Database,
  id: string,
  root: string,
): Promise<void> {
  const source = { sourcePath: `/logs/p/${id}.jsonl`, recordUuid: `${id}-r` };
  await db.insert(session).values({ id, project: root, firstAt: AT });
  await db.insert(subAgent).values({ sessionId: id, id: 'a1' });
  await db.insert(apiCall).values({
    sourcePath: source.sourcePath,
    requestKey: `${id}-q`,
    sessionId: id,
    subAgentId: 'a1',
    at: AT,
    model: 'claude-sonnet-4-5',
    inputTokens: 1,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 1,
  });
  await db
    .insert(skillLaunch)
    .values({ ...source, sessionId: id, at: AT, skill: 'kit:a' });
  await db.insert(userPrompt).values({ ...source, sessionId: id, at: AT });
  await db
    .insert(closingLine)
    .values({ ...source, sessionId: id, at: AT, position: 0, line: 'Done' });
  await db.insert(friction).values({
    ...source,
    position: 0,
    sessionId: id,
    at: AT,
    agent: 'claude-code',
    kind: 'tool-error',
  });
}

export async function seedGitHostRows(
  db: Database,
  remote: string,
): Promise<void> {
  await db.insert(gitHostIssue).values({
    remote,
    number: 1,
    title: 'Issue',
    state: 'open',
    labels: [],
    url: 'https://example.invalid/issues/1',
    createdAt: AT,
    updatedAt: AT,
    needsSpec: [{ added: true, at: AT.toISOString() }],
  });
  await db.insert(gitHostRequest).values({
    remote,
    number: 2,
    title: 'Request',
    state: 'open',
    draft: false,
    headBranch: 'feat/1',
    url: 'https://example.invalid/pull/2',
    createdAt: AT,
    updatedAt: AT,
    closes: [1],
    checks: 'none',
  });
  await db
    .insert(gitHostProject)
    .values({ remote, gitHost: 'github', syncedFrom: AT });
}
