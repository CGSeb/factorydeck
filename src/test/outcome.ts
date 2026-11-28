import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect } from 'vitest';
import type { Database } from '../db/client.ts';
import type { FakeGitHostData } from '../demo/fake-git-host.ts';
import { fakeCollection } from '../demo/fake-git-host-token.ts';
import { collect } from '../git-host/collect.ts';
import { issueDetail } from '../git-host/query.ts';
import type { IssueOutcome } from '../git-host/types.ts';
import { hasFactory } from '../ingest/factory.ts';
import { T1, T2, addProject, ghIssue, ghRequest, success } from './git-host.ts';
import { createTestDatabase } from './postgres.ts';

export type Row = Record<string, unknown>;

const PASSED = 'Gates: all passed. Review: 2 rounds, confidence high.';

export function serenity(
  score: number,
  threshold = 80,
  gates = PASSED,
): string {
  return `## Serenity: ${String(score)}/100 (threshold ${String(threshold)})\n\n- −10: a note\n\n${gates}\n`;
}

export function comment(body: string, createdAt = T1): Row {
  return { author: { login: 'factory-bot' }, body, createdAt };
}

export function labelled(number: number, ...names: string[]): Row {
  return ghIssue(number, T1, {
    labels: names.map((name) => ({ name, color: 'ededed' })),
  });
}

export function closed(number: number, ...names: string[]): Row {
  return { ...labelled(number, ...names), state: 'CLOSED', closedAt: T1 };
}

export function merged(
  number: number,
  closes: number[],
  comments: Row[] = [],
): Row {
  return ghRequest(number, closes, [success], {
    state: 'MERGED',
    mergedAt: T1,
    closedAt: T1,
    comments,
  });
}

export function open(
  number: number,
  closes: number[],
  comments: Row[] = [],
  updatedAt = T1,
): Row {
  return ghRequest(number, closes, [success], { comments, updatedAt });
}

export function githubData(
  issues: Row[],
  requests: Row[],
  extra: Partial<FakeGitHostData> = {},
): FakeGitHostData {
  return {
    host: 'github',
    repository: 'example-org/example-app',
    issues,
    requests,
    ...extra,
  };
}

export interface OutcomeContext {
  db: () => Database;
  work: () => string;
  collected: (data: FakeGitHostData, now?: Date) => Promise<string>;
  outcomeOf: (
    root: string,
    number: number,
  ) => Promise<IssueOutcome | undefined>;
}

export function outcomeContext(): OutcomeContext {
  let db: Database | undefined;
  let close: () => Promise<void> = () => Promise.resolve();
  let work = '';
  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
    work = await realpath(
      await mkdtemp(join(tmpdir(), 'factorydeck-outcome-')),
    );
  });
  afterEach(async () => {
    await close();
    await rm(work, { recursive: true, force: true });
  });
  const database = (): Database => {
    if (db === undefined) throw new Error('No test database');
    return db;
  };
  return {
    db: database,
    work: () => work,
    collected: async (data, now = new Date(T2)) => {
      const root = await addProject(database(), work, 'app', data);
      const result = await collect(database(), {
        ...(await fakeCollection()),
        hasFactory,
        now: () => now,
      });
      expect(result.failures).toEqual([]);
      return root;
    },
    outcomeOf: async (root, number) =>
      (await issueDetail(database(), root, number))?.outcome,
  };
}
