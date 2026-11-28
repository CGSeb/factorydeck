import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { project, rootRemote } from '../db/schema.ts';
import { knownGitHost } from '../team/git-host-token.ts';
import { encryptToken, secretKey } from '../team/token-cipher.ts';
import {
  type FakeGitHostData,
  FakeGitHostSchema,
  fakeGitHostCommands,
  fakeGitHostToken,
} from './fake-git-host.ts';

export const FAKE_SECRET_KEY = Buffer.alloc(32, 7).toString('base64');

export async function fakeCollection(): Promise<{
  secretKey: ReturnType<typeof secretKey>;
  hostCli: { commands: Record<FakeGitHostData['host'], string> };
}> {
  return {
    secretKey: secretKey(FAKE_SECRET_KEY),
    hostCli: { commands: await fakeGitHostCommands() },
  };
}

export async function giveFakeToken(db: Database, root: string): Promise<void> {
  const data = FakeGitHostSchema.parse(
    JSON.parse(await readFile(fakeGitHostToken(root), 'utf8')),
  );
  const [linked] = await db
    .select({ id: project.id, remote: project.remote })
    .from(rootRemote)
    .innerJoin(project, eq(project.remote, rootRemote.remote))
    .where(eq(rootRemote.root, root));
  if (linked === undefined) throw new Error(`No project for ${root}`);
  const repository = data.repository.toLowerCase();
  const remote = linked.remote.endsWith(`/${repository}`)
    ? linked.remote
    : `${data.host}-${String(linked.id)}.example.test/${repository}`;
  await db
    .update(rootRemote)
    .set({ remote })
    .where(eq(rootRemote.remote, linked.remote));
  await db
    .update(project)
    .set({
      remote,
      gitHost: knownGitHost(remote) === undefined ? data.host : null,
      tokenCiphertext: encryptToken(
        Buffer.from(FAKE_SECRET_KEY, 'base64'),
        linked.id,
        fakeGitHostToken(root),
      ),
    })
    .where(eq(project.id, linked.id));
}
