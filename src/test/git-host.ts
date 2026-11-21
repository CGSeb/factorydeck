import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import { session } from '../db/schema.ts';
import {
  type FakeGitHostData,
  installFakeGitHost,
} from '../demo/fake-git-host.ts';

export async function addProject(
  db: Database,
  work: string,
  name: string,
  data: FakeGitHostData,
): Promise<string> {
  const root = join(work, name);
  await mkdir(root, { recursive: true });
  await installFakeGitHost(root, { ...data, log: join(root, 'calls.log') });
  await db.insert(session).values({ id: `session-${name}`, project: root });
  return root;
}

const CallSchema = z.object({ args: z.array(z.string()), cwd: z.string() });

export async function calls(
  root: string,
): Promise<{ args: string[]; cwd: string }[]> {
  const text = await readFile(join(root, 'calls.log'), 'utf8').catch(() => '');
  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => CallSchema.parse(JSON.parse(line)));
}

export const T0 = '2026-03-01T10:00:00Z';
export const T1 = '2026-03-02T10:00:00Z';
export const T2 = '2026-03-05T10:00:00Z';

export function ghIssue(
  number: number,
  updatedAt: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    number,
    title: `Issue ${String(number)}`,
    state: 'OPEN',
    labels: [
      { name: 'spec', color: '1D76DB' },
      { name: 'plain', color: '' },
    ],
    url: `https://github.com/example-org/example-app/issues/${String(number)}`,
    createdAt: T0,
    closedAt: null,
    updatedAt,
    ...extra,
  };
}

export function ghRequest(
  number: number,
  closes: number[],
  checks: unknown[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    number,
    title: `Request ${String(number)}`,
    state: 'OPEN',
    isDraft: false,
    headRefName: `feat/${String(number)}`,
    url: `https://github.com/example-org/example-app/pull/${String(number)}`,
    createdAt: T0,
    mergedAt: null,
    closedAt: null,
    updatedAt: T1,
    closingIssuesReferences: closes.map((closed) => ({
      number: closed,
      repository: { name: 'example-app', owner: { login: 'example-org' } },
    })),
    statusCheckRollup: checks,
    ...extra,
  };
}

export const success = {
  __typename: 'CheckRun',
  status: 'COMPLETED',
  conclusion: 'SUCCESS',
};
export const running = {
  __typename: 'CheckRun',
  status: 'IN_PROGRESS',
  conclusion: '',
};

export function github(extra: Partial<FakeGitHostData> = {}): FakeGitHostData {
  return {
    host: 'github',
    repository: 'example-org/example-app',
    issues: [ghIssue(1, T1), ghIssue(2, T1, { state: 'CLOSED', closedAt: T1 })],
    requests: [
      ghRequest(3, [1], [success], {
        state: 'MERGED',
        mergedAt: T1,
        closedAt: T1,
      }),
      ghRequest(4, [1], [running], { isDraft: true, createdAt: T1 }),
      ghRequest(5, [2, 9], [], {
        closingIssuesReferences: [
          {
            number: 2,
            repository: {
              name: 'example-app',
              owner: { login: 'example-org' },
            },
          },
          {
            number: 9,
            repository: { name: 'other', owner: { login: 'example-org' } },
          },
        ],
      }),
    ],
    ...extra,
  };
}

export function clock(...times: string[]): () => Date {
  let index = 0;
  return () => new Date(times[Math.min(index++, times.length - 1)] ?? T2);
}
