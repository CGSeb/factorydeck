import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { hashPassword } from '../auth/secrets.ts';
import { signInSessions } from '../auth/sessions.ts';
import { type SignInLimit, signInLimit } from '../auth/sign-in-limit.ts';
import { firstManagerSetup } from '../auth/setup.ts';
import { cliConnections } from '../cli-login/connections.ts';
import { type PendingLogins, pendingLogins } from '../cli-login/pending.ts';
import type { Database } from '../db/client.ts';
import { account } from '../db/schema.ts';
import {
  type AppOptions,
  type OverviewSource,
  createApp,
} from '../server/app.ts';
import { teamAccounts } from '../team/accounts.ts';
import { teamCliConnections } from '../team/cli-connections.ts';
import { changeStatus } from '../team/account-status.ts';
import { changeRole } from '../team/change-role.ts';
import { invitations } from '../team/invitations.ts';
import { projectStore } from '../team/projects.ts';
import { resetLinks } from '../team/reset-links.ts';
import type { SessionSource } from '../server/session-routes.ts';
import { createTestDatabase } from './postgres.ts';
import {
  unusedFeatures,
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
  unusedStats,
} from './skill-source.ts';

export const START = new Date('2026-03-12T10:00:00.000Z');
export const DAY_MS = 24 * 60 * 60 * 1000;
export const PASSWORD = 'a long passphrase';

const overview: OverviewSource = {
  load: () => Promise.reject(new Error('Not used')),
  sessionsFolder: '/logs/claude',
  refreshSeconds: 10,
  updatedAt: () => undefined,
};

const sessions: SessionSource = {
  list: () => Promise.reject(new Error('Not used')),
  detail: () => Promise.reject(new Error('Not used')),
};

export type Server = ReturnType<typeof createApp>;

export interface AuthHarness {
  db: Database;
  clock: Date;
  signInLimit: SignInLimit;
  cliLogins: PendingLogins;
  app: (up?: boolean) => Server;
  addAccount: (
    email: string,
    options?: { active?: boolean; role?: 'manager' | 'dev'; name?: string },
  ) => Promise<number>;
  close: () => Promise<void>;
}

function accountSources(
  db: Database,
  harness: Pick<AuthHarness, 'clock' | 'signInLimit' | 'cliLogins'>,
): Pick<AppOptions, 'auth' | 'team' | 'resets' | 'admin' | 'cli'> {
  return {
    auth: {
      ...firstManagerSetup(db, { log: () => undefined }),
      ...signInSessions(db, { now: () => harness.clock }),
      signInLimit: harness.signInLimit,
    },
    team: {
      accounts: () => teamAccounts(db, harness.clock),
      changeRole: (request) =>
        changeRole(db, { ...request, now: harness.clock }),
      invitations: invitations(db, { now: () => harness.clock }),
      changeStatus: (request) => changeStatus(db, request),
      resetLink: resetLinks(db, () => harness.clock).create,
      cliConnections: teamCliConnections(db, () => harness.clock),
    },
    resets: resetLinks(db, () => harness.clock),
    admin: { projects: projectStore(db, () => harness.clock) },
    cli: {
      logins: harness.cliLogins,
      connections: cliConnections(db, () => harness.clock),
    },
  };
}

export async function authHarness(): Promise<AuthHarness> {
  const { db, close } = await createTestDatabase();
  const uiDir = await mkdtemp(join(tmpdir(), 'factorydeck-ui-'));
  await writeFile(
    join(uiDir, 'index.html'),
    '<!doctype html><title>UI</title>',
  );
  await writeFile(join(uiDir, 'app.js'), 'console.log(1);');
  const harness: AuthHarness = {
    db,
    clock: START,
    signInLimit: signInLimit({ now: () => harness.clock }),
    cliLogins: pendingLogins({ now: () => harness.clock.getTime() }),
    close,
    app: (up = true) =>
      createApp({
        checkDatabase: () => Promise.resolve(up),
        uiDir,
        overview,
        sessions,
        skills: unusedSkills,
        roles: unusedRoles,
        features: unusedFeatures,
        projects: unusedProjects,
        gitHost: unusedGitHost,
        stats: unusedStats,
        ...accountSources(db, harness),
      }),
    addAccount: async (email, options = {}) => {
      const [row] = await db
        .insert(account)
        .values({
          email,
          name: options.name ?? email.split('@')[0] ?? email,
          passwordHash: await hashPassword(PASSWORD),
          role: options.role ?? 'dev',
          active: options.active ?? true,
          createdAt: START,
        })
        .returning({ id: account.id });
      return row?.id ?? 0;
    },
  };
  return harness;
}

export function signIn(server: Server, body: unknown): Promise<Response> {
  return Promise.resolve(
    server.request('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

export function tokenOf(response: Response): string {
  const cookie = response.headers.get('set-cookie') ?? '';
  return /^factorydeck_session=([^;]*);/.exec(cookie)?.[1] ?? '';
}

export async function signedIn(
  server: Server,
  email = 'ada@example.test',
): Promise<string> {
  const response = await signIn(server, { email, password: PASSWORD });
  expect(response.status).toBe(200);
  return `factorydeck_session=${tokenOf(response)}`;
}

export function get(
  server: Server,
  path: string,
  cookie?: string,
): Promise<Response> {
  return Promise.resolve(
    server.request(path, { headers: cookie === undefined ? {} : { cookie } }),
  );
}
