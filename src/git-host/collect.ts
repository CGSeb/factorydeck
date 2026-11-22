import type { Database } from '../db/client.ts';
import { UNASSIGNED_PROJECT, session } from '../db/schema.ts';
import type { FactoryCheck } from '../ingest/factory.ts';
import { folderName } from '../projects/label.ts';
import { CLI_TIMEOUT_MS, cliRunner, firstLine } from './command.ts';
import {
  type GitHostConfig,
  GitHostConfigError,
  readGitHostConfig,
} from './config.ts';
import { githubReader } from './github.ts';
import { gitlabReader } from './gitlab.ts';
import { readOutcomeSettings } from './outcome-settings.ts';
import type { Changes, GitHostReader } from './parse.ts';
import {
  pendingRequests,
  projectState,
  saveFailure,
  saveRunFinished,
  saveSuccess,
} from './store.ts';
import {
  type CollectionFailure,
  type GitHostName,
  failureMessage,
} from './types.ts';

export interface CollectOptions {
  hasFactory: FactoryCheck;
  timeoutMs?: number;
  now?: () => Date;
}

export interface CollectResult {
  projects: number;
  issues: number;
  requests: number;
  failures: CollectionFailure[];
}

function readerFor(
  config: GitHostConfig,
  root: string,
  timeoutMs: number,
): GitHostReader {
  const run = cliRunner(config.cli, root, timeoutMs);
  return config.gitHost === 'github'
    ? githubReader(run, config.repository)
    : gitlabReader(run, config.repository);
}

async function factoryProjects(
  db: Database,
  hasFactory: FactoryCheck,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ project: session.project })
    .from(session);
  const projects: string[] = [];
  for (const { project } of rows) {
    if (project !== UNASSIGNED_PROJECT && (await hasFactory(project))) {
      projects.push(project);
    }
  }
  return projects.sort();
}

async function changesOf(
  db: Database,
  project: string,
  reader: GitHostReader,
  since: Date | null,
): Promise<Changes> {
  const changes = await reader.changes(since);
  if (since === null) return changes;
  const updated = new Set(changes.requests.map((request) => request.number));
  const pending = (await pendingRequests(db, project)).filter(
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

async function collectProject(
  db: Database,
  project: string,
  timeoutMs: number,
  startedAt: Date,
): Promise<Outcome> {
  const state = await projectState(db, project);
  let gitHost: GitHostName | null = state?.gitHost ?? null;
  try {
    const config = await readGitHostConfig(project);
    gitHost = config.gitHost;
    const settings = await readOutcomeSettings(project, config.gitHost);
    const replace =
      state?.gitHost !== config.gitHost ||
      state.repository !== config.repository ||
      !state.outcomeSettings;
    const since = replace ? null : state.syncedFrom;
    const reader = readerFor(config, project, timeoutMs);
    const changes = await changesOf(db, project, reader, since);
    await saveSuccess(db, project, {
      gitHost: config.gitHost,
      repository: config.repository,
      startedAt,
      replace,
      changes,
      settings,
    });
    return { changes };
  } catch (error) {
    if (error instanceof GitHostConfigError) gitHost = error.gitHost ?? gitHost;
    const reason = reasonOf(error);
    await saveFailure(db, project, gitHost, reason);
    const name = folderName(project);
    return { failure: { project, name, gitHost, reason } };
  }
}

export async function collect(
  db: Database,
  {
    hasFactory,
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
  for (const project of await factoryProjects(db, hasFactory)) {
    const outcome = await collectProject(db, project, timeoutMs, now());
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
