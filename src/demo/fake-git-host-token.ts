import { appendFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { project, rootRemote } from '../db/schema.ts';
import { knownGitHost } from '../team/git-host-token.ts';
import { encryptToken, secretKey } from '../team/token-cipher.ts';
import {
  type FakeGitHostData,
  FakeGitHostSchema,
  fakeFactoryAnswer,
  fakeGitHostCommands,
  fakeGitHostToken,
} from './fake-git-host.ts';
import type { HostCliResult, RunHostCli } from '../team/host-cli.ts';

export const FAKE_SECRET_KEY = Buffer.alloc(32, 7).toString('base64');

async function fakeData(path: string): Promise<FakeGitHostData | undefined> {
  try {
    return FakeGitHostSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  } catch {
    return undefined;
  }
}

export const fakeHostCli: RunHostCli = async ({
  token,
  args,
  raw,
}): Promise<HostCliResult> => {
  const data = await fakeData(token);
  if (data === undefined) return { ok: false, failure: 'unauthorized' };
  if (data.log !== undefined) {
    await appendFile(data.log, `${JSON.stringify({ args, cwd: tmpdir() })}\n`);
  }
  const answer = fakeFactoryAnswer(data, dirname(dirname(token)), args);
  if (answer?.status !== 200) return { ok: false, failure: 'not-found' };
  return {
    ok: true,
    value: raw === true ? answer.text : (JSON.parse(answer.text) as unknown),
  };
};

export async function fakeCollection(): Promise<{
  secretKey: ReturnType<typeof secretKey>;
  hostCli: { commands: Record<FakeGitHostData['host'], string> };
  runHostCli: RunHostCli;
}> {
  return {
    secretKey: secretKey(FAKE_SECRET_KEY),
    hostCli: { commands: await fakeGitHostCommands() },
    runHostCli: fakeHostCli,
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
