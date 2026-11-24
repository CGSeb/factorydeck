import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, relative, isAbsolute } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Root of the main git repository of a folder that exists, so a worktree counts for its repository. */
export async function gitProjectRoot(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await run(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd, timeout: 10_000 },
    );
    const commonDir = stdout.trim();
    return commonDir === '' ? undefined : dirname(commonDir);
  } catch {
    return undefined;
  }
}

function isInside(folder: string, root: string): boolean {
  const path = relative(root, folder);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

/**
 * Resolves the project of working directories (docs/product/data.md). Folders that still
 * exist are resolved first, so that a gone folder can fall inside a project they made known.
 */
export async function resolveProjects(
  cwds: readonly string[],
  knownRoots: Iterable<string>,
  findRoot: (cwd: string) => Promise<string | undefined> = gitProjectRoot,
): Promise<Map<string, string>> {
  const roots = new Set(knownRoots);
  const projects = new Map<string, string>();
  const unique = [...new Set(cwds)];
  const gone: string[] = [];
  for (const cwd of unique) {
    if (!existsSync(cwd)) {
      gone.push(cwd);
      continue;
    }
    const root = (await findRoot(cwd)) ?? cwd;
    projects.set(cwd, root);
    roots.add(root);
  }
  for (const cwd of gone) {
    const containing = [...roots]
      .filter((root) => isInside(cwd, root))
      .sort((a, b) => b.length - a.length)[0];
    projects.set(cwd, containing ?? cwd);
  }
  return projects;
}
