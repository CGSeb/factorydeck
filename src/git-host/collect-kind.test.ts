import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostProject } from '../db/schema.ts';
import {
  FACTORY_WORKFLOW,
  type FakeGitHostData,
  writeFakeGitHostData,
} from '../demo/fake-git-host.ts';
import { hasFactory, factoryFile } from '../ingest/factory.ts';
import {
  addProject,
  calls,
  clock,
  ghIssue,
  T1,
  T2,
  remoteOfRoot,
} from '../test/git-host.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { fakeCollection } from '../demo/fake-git-host-token.ts';
import { collect } from './collect.ts';
import { collectionStatus, lookupOutcomes } from './query.ts';

let db: Database;
let close: () => Promise<void>;
let work: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  work = await realpath(await mkdtemp(join(tmpdir(), 'factorydeck-kind-')));
});

afterEach(async () => {
  await close();
  await rm(work, { recursive: true, force: true });
});

function issue(number: number, labels: string[], updatedAt = T1) {
  return ghIssue(number, updatedAt, {
    labels: labels.map((name) => ({ name, color: 'ededed' })),
  });
}

function data(
  issues: Record<string, unknown>[],
  factory: string,
): FakeGitHostData {
  return {
    host: 'github',
    repository: 'example-org/example-app',
    issues,
    requests: [],
    factory,
  };
}

function withBugs(bugs: string): string {
  return `${FACTORY_WORKFLOW}${bugs}`;
}

const ISSUES = [
  issue(1, ['spec', 'bug']),
  issue(2, ['spec']),
  issue(3, ['bug', 'agent:ready']),
  issue(4, ['defect']),
];

async function kinds(root: string): Promise<Record<number, string | null>> {
  const keys = ISSUES.map((row) => ({
    project: root,
    number: Number(row['number']),
  }));
  const lookup = await lookupOutcomes(db, keys);
  return Object.fromEntries(keys.map((key) => [key.number, lookup(key).kind]));
}

async function storedBugLabel(root: string): Promise<string | null> {
  const [row] = await db
    .select({ bugLabel: gitHostProject.bugLabel })
    .from(gitHostProject)
    .where(eq(gitHostProject.remote, await remoteOfRoot(db, root)));
  return row?.bugLabel ?? null;
}

async function collectedProject(factory: string): Promise<string> {
  const root = await addProject(db, work, 'app', data(ISSUES, factory));
  const result = await collect(db, {
    ...(await fakeCollection()),
    hasFactory,
    now: () => new Date(T2),
  });
  expect(result.failures).toEqual([]);
  expect((await collectionStatus(db)).failures).toEqual([]);
  return root;
}

const ONLY_FEATURES = {
  1: 'feature',
  2: 'feature',
  3: 'feature',
  4: 'feature',
};
const ONE_BUG_LABEL = { 1: 'bug', 2: 'feature', 3: 'bug', 4: 'feature' };

describe('kind of each collected issue', () => {
  it('has only features without a bugs section', async () => {
    const root = await collectedProject(FACTORY_WORKFLOW);
    expect(await storedBugLabel(root)).toBeNull();
    expect(await kinds(root)).toEqual(ONLY_FEATURES);
  });

  it.each([
    ['an empty bug label', 'bugs:\n  label: ""\n'],
    ['a blank bug label', 'bugs:\n  label: "   "\n'],
    ['a bugs section that is not a map', 'bugs: bug\n'],
    ['a bug label that is not a string', 'bugs:\n  label: 12\n'],
    ['a bugs section without a label', 'bugs:\n  other: bug\n'],
    ['a bug label equal to a flow label', 'bugs:\n  label: Agent:Ready\n'],
  ])('has no bug label, and no collection error, with %s', async (_, bugs) => {
    const root = await collectedProject(withBugs(bugs));
    expect(await storedBugLabel(root)).toBeNull();
    expect(await kinds(root)).toEqual(ONLY_FEATURES);
    const lookup = await lookupOutcomes(db, [{ project: root, number: 3 }]);
    expect(lookup({ project: root, number: 3 }).outcome?.stage).toBe('ready');
  });

  it('has no bug label when it equals the spec label', async () => {
    const factory = withBugs('bugs:\n  label: " SPEC"\n').replace(
      '  labels:\n',
      '  labels:\n    spec: spec\n',
    );
    const root = await collectedProject(factory);
    expect(await storedBugLabel(root)).toBeNull();
    expect(await kinds(root)).toEqual(ONLY_FEATURES);
  });

  it('matches the bug label after trimming and without letter case', async () => {
    const root = await collectedProject(withBugs('bugs:\n  label: "Bug "\n'));
    expect(await storedBugLabel(root)).toBe('Bug');
    expect(await kinds(root)).toEqual(ONE_BUG_LABEL);
  });

  it('follows a removed label and a changed setting without a full read', async () => {
    const root = await addProject(
      db,
      work,
      'app',
      data(ISSUES, withBugs('bugs:\n  label: bug\n')),
    );
    await collect(db, {
      ...(await fakeCollection()),
      hasFactory,
      now: clock('2026-03-03T08:00:00.500Z', T2),
    });
    expect(await kinds(root)).toEqual(ONE_BUG_LABEL);

    await writeFakeGitHostData(root, {
      ...data(
        [issue(1, ['spec'], '2026-03-04T00:00:00Z'), ...ISSUES.slice(1)],
        withBugs('bugs:\n  label: bug\n'),
      ),
      log: join(root, 'calls.log'),
    });
    await rm(join(root, 'calls.log'));
    await collect(db, {
      ...(await fakeCollection()),
      hasFactory,
      now: () => new Date(T2),
    });
    expect((await calls(root))[0]?.args).toContain(
      'sort:updated-asc updated:>=2026-03-03T08:00:00+00:00',
    );
    expect(await kinds(root)).toEqual({
      1: 'feature',
      2: 'feature',
      3: 'bug',
      4: 'feature',
    });

    const factory = await readFile(factoryFile(root), 'utf8');
    await writeFile(
      factoryFile(root),
      factory.replace('label: bug', 'label: Defect'),
    );
    await rm(join(root, 'calls.log'));
    await collect(db, {
      ...(await fakeCollection()),
      hasFactory,
      now: () => new Date(T2),
    });
    expect((await calls(root))[0]?.args).toContain(
      'sort:updated-asc updated:>=2026-03-05T10:00:00+00:00',
    );
    expect(await storedBugLabel(root)).toBe('Defect');
    expect(await kinds(root)).toEqual({
      1: 'feature',
      2: 'feature',
      3: 'feature',
      4: 'bug',
    });
  });
});
