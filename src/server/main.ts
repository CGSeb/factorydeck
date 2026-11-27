import {
  type Env,
  codexSessionsFolder,
  loadRootEnvFile,
  sessionsFolder,
  validateEnv,
  workflowConfigPath,
} from '../config/env.ts';
import { signInSessions } from '../auth/sessions.ts';
import { signInLimit } from '../auth/sign-in-limit.ts';
import { type Setup, firstManagerSetup } from '../auth/setup.ts';
import { type Database, createDatabase } from '../db/client.ts';
import { listBugs } from '../bugs/query.ts';
import { listFeatures, versionDetailOf } from '../features/query.ts';
import {
  frictionOccurrences,
  frictionOutput,
} from '../frictions/occurrences.ts';
import { frictionStats } from '../frictions/query.ts';
import { markFrictionReport } from '../frictions/mark-report.ts';
import { frictionReport } from '../frictions/report.ts';
import { collect } from '../git-host/collect.ts';
import { collectionStatus } from '../git-host/query.ts';
import { hasFactory } from '../ingest/factory.ts';
import { ingest } from '../ingest/ingest.ts';
import { overviewData } from '../overview/kinds.ts';
import { type WorkflowConfig, loadWorkflowConfig } from '../roles/config.ts';
import { deleteProject, factoryStatus } from '../projects/remove.ts';
import { listRoles } from '../roles/query.ts';
import { listSessions, sessionDetail } from '../sessions/query.ts';
import { readyCounts } from '../sidebar/ready.ts';
import { listSkills, skillDetail } from '../skills/query.ts';
import { autonomyStats } from '../stats/autonomy.ts';
import { bugStats } from '../stats/bugs.ts';
import { waitingIssues } from '../stats/waiting.ts';
import { flowStats } from '../stats/flow.ts';
import { qualityStats } from '../stats/quality.ts';
import { teamAccounts } from '../team/accounts.ts';
import { changeRole } from '../team/change-role.ts';
import { invitations } from '../team/invitations.ts';
import { createApp } from './app.ts';
import type { TeamSource } from './team-routes.ts';
import { type CollectLoop, startCollectLoop } from './collect-loop.ts';
import { databaseCheck } from './health.ts';
import { type IngestLoop, startIngestLoop } from './ingest-loop.ts';
import { HOST, listen } from './listen.ts';
import type { StatsSource } from './stats-routes.ts';
import { UI_DIST_DIR } from './paths.ts';

function lazyCollection(
  db: Database,
  intervalMinutes: number,
): () => CollectLoop {
  let collection: CollectLoop | undefined;
  return () => {
    collection ??= startCollectLoop({
      run: async () => {
        await collect(db, { hasFactory });
      },
      intervalMs: intervalMinutes * 60_000,
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Git host collection failed: ${message}`);
      },
    });
    return collection;
  };
}

function startIngestion(
  db: Database,
  folder: string,
  env: Pick<Env, 'FACTORYDECK_INGEST_INTERVAL_SECONDS' | 'CODEX_SESSIONS_DIR'>,
  afterRun: () => void,
): IngestLoop {
  let lastError = '';
  return startIngestLoop({
    run: async () => {
      const result = await ingest(db, folder, {
        codexFolder: codexSessionsFolder(env),
      }).finally(afterRun);
      lastError = '';
      return result.status === 'done';
    },
    intervalMs: env.FACTORYDECK_INGEST_INTERVAL_SECONDS * 1000,
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastError) console.error(`Ingestion failed: ${message}`);
      lastError = message;
    },
  });
}

function teamSource(db: Database): TeamSource {
  return {
    accounts: () => teamAccounts(db),
    changeRole: (request) => changeRole(db, request),
    invitations: invitations(db),
  };
}

function statsSource(db: Database, config: WorkflowConfig): StatsSource {
  return {
    autonomy: (query) => autonomyStats(db, query, hasFactory),
    quality: (query) => qualityStats(db, query, hasFactory),
    frictions: (query) => frictionStats(db, query, config),
    occurrences: (query) => frictionOccurrences(db, query, config),
    output: (id) => frictionOutput(db, id),
    report: (query) => frictionReport(db, query, config),
    markReport: (query) => markFrictionReport(db, query, config),
    flow: (query) => flowStats(db, query, config, hasFactory),
    bugs: (query) => bugStats(db, query, hasFactory),
    waiting: (project, kind) => waitingIssues(db, project, hasFactory, kind),
  };
}

async function startSetup(setup: Setup): Promise<void> {
  await setup.start().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not check for accounts: ${message}`);
  });
}

async function main(): Promise<void> {
  loadRootEnvFile();
  const env = validateEnv(process.env);
  const config = loadWorkflowConfig(workflowConfigPath(env));
  const { db } = createDatabase(env.DATABASE_URL);
  const folder = sessionsFolder(env);
  const stateOptions = {
    inactiveAfterMinutes: env.FACTORYDECK_INACTIVE_AFTER_MINUTES,
  };
  const collectionLoop = lazyCollection(
    db,
    env.FACTORYDECK_COLLECT_INTERVAL_MINUTES,
  );
  const ingestion = startIngestion(db, folder, env, () => collectionLoop());
  const setup = firstManagerSetup(db, { log: (line) => console.log(line) });
  const app = createApp({
    checkDatabase: databaseCheck(db),
    uiDir: UI_DIST_DIR,
    overview: {
      load: (query) => overviewData(db, query, hasFactory),
      sessionsFolder: folder,
      refreshSeconds: env.FACTORYDECK_INGEST_INTERVAL_SECONDS,
      updatedAt: ingestion.lastFinishedAt,
    },
    sessions: {
      list: (query) => listSessions(db, query, stateOptions, config),
      detail: (id) => sessionDetail(db, id, stateOptions, config),
    },
    skills: {
      list: (query) => listSkills(db, query),
      detail: (skill, query) => skillDetail(db, skill, query),
    },
    roles: {
      list: (query) => listRoles(db, query, config),
      config: { path: config.path, exists: config.exists },
    },
    features: {
      list: (query) => listFeatures(db, query, config),
      detail: (key, query) =>
        versionDetailOf(db, key, query, { config, state: stateOptions }),
      bugs: (query) => listBugs(db, query, config),
    },
    projects: {
      factoryStatus: () => factoryStatus(db, hasFactory),
      remove: (project) => deleteProject(db, project, hasFactory),
    },
    gitHost: {
      status: () => collectionStatus(db, hasFactory),
      refresh: () => collectionLoop().refresh(),
    },
    stats: statsSource(db, config),
    sidebar: { ready: (project) => readyCounts(db, project, hasFactory) },
    auth: { ...setup, ...signInSessions(db), signInLimit: signInLimit() },
    team: teamSource(db),
  });
  await listen(app, env.FACTORYDECK_PORT);
  await startSetup(setup);
  console.log(`FactoryDeck on http://${HOST}:${env.FACTORYDECK_PORT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
