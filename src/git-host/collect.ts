import { desc, eq, isNotNull, max, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { UNASSIGNED_PROJECT, project, projectSession } from '../db/schema.ts';
import type { FactoryCheck } from '../ingest/factory.ts';
import { folderName } from '../projects/label.ts';
import {
  NO_SECRET_KEY,
  gitHostOf,
  hostOf,
  repositoryPathOf,
} from '../team/git-host-token.ts';
import {
  CLI_OF,
  type GitHostKind,
  type HostCliOptions,
  type RunHostCli,
  hostCliRunner,
} from '../team/host-cli.ts';
import { type SecretKey, decryptToken } from '../team/token-cipher.ts';
import { CLI_TIMEOUT_MS, cliRunner, firstLine } from './command.ts';
import { githubReader } from './github.ts';
import { gitlabReader } from './gitlab.ts';
import type { Changes, GitHostReader } from './parse.ts';
import { type RemoteFactory, readRemoteFactory } from './remote-factory.ts';
import {
  type ProjectState,
  pendingRequests,
  projectState,
  saveFailure,
  saveRunFinished,
  saveSuccess,
} from './store.ts';
import { type CollectionFailure, failureMessage } from './types.ts';

export const TOKEN_UNREADABLE = 'Token cannot be decrypted: set it again';

export interface CollectOptions {
  hasFactory: FactoryCheck;
  secretKey: SecretKey;
  hostCli?: HostCliOptions;
  runHostCli?: RunHostCli;
  timeoutMs?: number;
  now?: () => Date;
}

export interface CollectResult {
  projects: number;
  issues: number;
  requests: number;
  failures: CollectionFailure[];
}

interface TokenProject {
  id: number;
  remote: string;
  gitHost: GitHostKind;
  ciphertext: string;
}

interface CollectedRoot {
  root: string;
  project: TokenProject;
}

async function tokenRoots(
  db: Database,
  hasFactory: FactoryCheck,
): Promise<CollectedRoot[]> {
  const lastAt = max(projectSession.lastAt);
  const rows = await db
    .select({
      root: projectSession.root,
      id: project.id,
      remote: project.remote,
      storedGitHost: project.gitHost,
      ciphertext: project.tokenCiphertext,
    })
    .from(projectSession)
    .innerJoin(project, eq(project.slug, projectSession.project))
    .where(isNotNull(project.tokenCiphertext))
    .groupBy(
      projectSession.root,
      project.id,
      project.remote,
      project.gitHost,
      project.tokenCiphertext,
    )
    .orderBy(sql`${desc(lastAt)} nulls last`, projectSession.root);
  const chosen = new Set<string>();
  const roots: CollectedRoot[] = [];
  for (const { root, id, remote, storedGitHost, ciphertext } of rows) {
    const gitHost = gitHostOf(remote, storedGitHost);
    if (ciphertext === null || gitHost === null || chosen.has(remote)) continue;
    if (root === UNASSIGNED_PROJECT || !(await hasFactory(root))) continue;
    chosen.add(remote);
    roots.push({ root, project: { id, remote, gitHost, ciphertext } });
  }
  return roots.sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0));
}

async function changesOf(
  db: Database,
  remote: string,
  reader: GitHostReader,
  since: Date | null,
): Promise<Changes> {
  const changes = await reader.changes(since);
  if (since === null) return changes;
  const updated = new Set(changes.requests.map((request) => request.number));
  const pending = (await pendingRequests(db, remote)).filter(
    (number) => !updated.has(number),
  );
  return {
    issues: changes.issues,
    requests: [...changes.requests, ...(await reader.requests(pending))],
  };
}

type Outcome = { changes: Changes } | { failure: CollectionFailure };

function reasonOf(error: unknown): string {
  return (
    firstLine(error instanceof Error ? error.message : String(error)) ||
    'unknown error'
  );
}

function readsInFull(
  state: ProjectState | undefined,
  gitHost: GitHostKind,
  repository: string,
): boolean {
  return (
    state?.gitHost !== gitHost ||
    state.repository !== repository ||
    !state.outcomeSettings ||
    !state.historyRead ||
    !state.fixRead ||
    !state.stateEventsRead ||
    !state.bodyClosesRead
  );
}

interface Run {
  db: Database;
  secretKey: SecretKey;
  runHostCli: RunHostCli;
  hostCli: HostCliOptions;
  timeoutMs: number;
  factories: Map<number, Promise<RemoteFactory>>;
}

function remoteFactory(
  run: Run,
  { id, remote, gitHost, ciphertext }: TokenProject,
): Promise<RemoteFactory> {
  const known = run.factories.get(id);
  if (known !== undefined) return known;
  const read = (async (): Promise<RemoteFactory> => {
    if (run.secretKey.status !== 'ok') {
      return { ok: false, reason: NO_SECRET_KEY };
    }
    const token = decryptToken(run.secretKey.key, id, ciphertext);
    if (token === undefined) return { ok: false, reason: TOKEN_UNREADABLE };
    const target = {
      gitHost,
      host: hostOf(remote),
      path: repositoryPathOf(remote),
    };
    return readRemoteFactory(run.runHostCli, target, token);
  })();
  run.factories.set(id, read);
  return read;
}

function readerFor(
  run: Run,
  { gitHost, remote }: TokenProject,
  root: string,
): GitHostReader {
  const cli = run.hostCli.commands?.[gitHost] ?? CLI_OF[gitHost];
  const runCli = cliRunner(cli, root, run.timeoutMs);
  const repository = repositoryPathOf(remote);
  return gitHost === 'github'
    ? githubReader(runCli, repository)
    : gitlabReader(runCli, repository);
}

async function collectRoot(
  run: Run,
  { root, project: target }: CollectedRoot,
  startedAt: Date,
): Promise<Outcome> {
  const { db } = run;
  const { gitHost } = target;
  try {
    const factory = await remoteFactory(run, target);
    if (!factory.ok) throw new Error(factory.reason);
    const repository = target.remote.toLowerCase();
    const state = await projectState(db, target.remote);
    const replace = readsInFull(state, gitHost, repository);
    const since = replace || state === undefined ? null : state.syncedFrom;
    const reader = readerFor(run, target, root);
    const changes = await changesOf(db, target.remote, reader, since);
    await saveSuccess(db, target.remote, {
      gitHost,
      repository,
      startedAt,
      replace,
      changes,
      settings: factory.settings,
    });
    return { changes };
  } catch (error) {
    const reason = reasonOf(error);
    await saveFailure(db, target.remote, gitHost, reason);
    const name = folderName(root);
    return { failure: { project: root, name, gitHost, reason } };
  }
}

export async function collect(
  db: Database,
  {
    hasFactory,
    secretKey,
    hostCli = {},
    runHostCli = hostCliRunner(hostCli),
    timeoutMs = CLI_TIMEOUT_MS,
    now = () => new Date(),
  }: CollectOptions,
): Promise<CollectResult> {
  const result: CollectResult = {
    projects: 0,
    issues: 0,
    requests: 0,
    failures: [],
  };
  const run: Run = {
    db,
    secretKey,
    runHostCli,
    hostCli,
    timeoutMs,
    factories: new Map(),
  };
  for (const root of await tokenRoots(db, hasFactory)) {
    const outcome = await collectRoot(run, root, now());
    if ('failure' in outcome) {
      result.failures.push(outcome.failure);
      continue;
    }
    result.projects += 1;
    result.issues += outcome.changes.issues.length;
    result.requests += outcome.changes.requests.length;
  }
  await saveRunFinished(db, now());
  return result;
}

export function collectSummary(result: CollectResult): string[] {
  return [
    `Collected ${String(result.projects)} projects: ${String(result.issues)} issues and ${String(result.requests)} pull or merge requests updated.`,
    ...result.failures.map(failureMessage),
  ];
}
