import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asc } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { session } from '../db/schema.ts';
import { createTestDatabase } from '../test/database.ts';
import { assistant, sessionsFolder, writeLog } from '../test/session-logs.ts';
import { ingest } from './ingest.ts';
import { gitProjectRoot, resolveProjects } from './project.ts';

function git(cwd: string, ...args: string[]): void {
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args],
    { cwd, stdio: 'ignore' },
  );
}

async function gitRepoWithWorktree(): Promise<{
  repo: string;
  worktree: string;
}> {
  const base = await realpath(
    await mkdtemp(join(tmpdir(), 'factorydeck-git-')),
  );
  const repo = join(base, 'repo');
  const worktree = join(base, 'repo-feature');
  await mkdir(join(repo, 'src'), { recursive: true });
  git(repo, 'init', '-q');
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(repo, 'worktree', 'add', '-q', worktree);
  return { repo, worktree };
}

describe('project resolution', () => {
  it('resolves a worktree and a sub-folder to the main repository', async () => {
    const base = await realpath(
      await mkdtemp(join(tmpdir(), 'factorydeck-git-')),
    );
    const repo = join(base, 'repo');
    await mkdir(join(repo, 'src'), { recursive: true });
    git(repo, 'init', '-q');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
    git(repo, 'worktree', 'add', '-q', join(base, 'repo-feature'));

    expect(await gitProjectRoot(join(repo, 'src'))).toBe(repo);
    const projects = await resolveProjects(
      [join(base, 'repo-feature'), repo],
      [],
    );
    expect(projects.get(join(base, 'repo-feature'))).toBe(repo);
    expect(projects.get(repo)).toBe(repo);
  });

  it('keeps a folder outside any repository as its own project', async () => {
    const folder = await realpath(
      await mkdtemp(join(tmpdir(), 'factorydeck-plain-')),
    );
    const projects = await resolveProjects([folder], [], async () => undefined);
    expect(projects.get(folder)).toBe(folder);
  });

  it('puts a gone folder in the known project that contains it, else in itself', async () => {
    const known = '/gone/work/shop';
    const projects = await resolveProjects(
      [
        '/gone/work/shop/.claude/worktrees/fix',
        '/gone/work/shopping',
        '/gone/elsewhere',
      ],
      ['/gone/work', known],
    );
    expect(projects.get('/gone/work/shop/.claude/worktrees/fix')).toBe(known);
    expect(projects.get('/gone/work/shopping')).toBe('/gone/work');
    expect(projects.get('/gone/elsewhere')).toBe('/gone/elsewhere');
  });

  it('lets a folder resolved in the same run make its project known', async () => {
    const base = await realpath(
      await mkdtemp(join(tmpdir(), 'factorydeck-known-')),
    );
    const projects = await resolveProjects(
      [join(base, 'gone'), base],
      [],
      async () => base,
    );
    expect(projects.get(join(base, 'gone'))).toBe(base);
  });
});

describe('project of ingested sessions', () => {
  it('stores worktree and gone-folder sessions under their repository', async () => {
    const { db, close } = await createTestDatabase();
    try {
      const { repo, worktree } = await gitRepoWithWorktree();
      const folder = await sessionsFolder();
      const log = (id: string, cwd: string) =>
        writeLog(join(folder, 'p', `${id}.jsonl`), [
          assistant({ uuid: id, at: 0, cwd }, { requestId: id }),
        ]);
      await log('in-worktree', worktree);
      await log('gone-inside', join(repo, '.claude', 'worktrees', 'removed'));
      await log('gone-outside', '/nowhere/old-app');
      await ingest(db, folder);
      const rows = await db.select().from(session).orderBy(asc(session.id));
      expect(rows.map((row) => [row.id, row.project])).toEqual([
        ['gone-inside', repo],
        ['gone-outside', '/nowhere/old-app'],
        ['in-worktree', repo],
      ]);
    } finally {
      await close();
    }
  });
});
