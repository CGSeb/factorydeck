import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ne, sql } from 'drizzle-orm';
import { UNASSIGNED_PROJECT, rootRemote, session } from '../db/schema.ts';
import { parseRemote } from '../team/remote.ts';
import type { Transaction } from './store.ts';

const run = promisify(execFile);

export type RemoteReader = (root: string) => Promise<string | undefined>;

export async function readOriginRemote(
  root: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await run('git', ['remote', 'get-url', 'origin'], {
      cwd: root,
      timeout: 10_000,
    });
    return parseRemote(stdout)?.remote;
  } catch {
    return undefined;
  }
}

export async function storeRootRemotes(
  tx: Transaction,
  readRemote: RemoteReader,
): Promise<void> {
  const roots = await tx
    .selectDistinct({ root: session.project })
    .from(session)
    .where(ne(session.project, UNASSIGNED_PROJECT));
  const remotes: { root: string; remote: string }[] = [];
  for (const { root } of roots) {
    const remote = await readRemote(root);
    if (remote !== undefined) remotes.push({ root, remote });
  }
  if (remotes.length === 0) return;
  await tx
    .insert(rootRemote)
    .values(remotes)
    .onConflictDoUpdate({
      target: rootRemote.root,
      set: { remote: sql`excluded.remote` },
    });
}
