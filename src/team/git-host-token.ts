import { eq, sql } from 'drizzle-orm';
import type { FieldError } from '../auth/types.ts';
import type { Database } from '../db/client.ts';
import { account, project } from '../db/schema.ts';
import type { GitHostKind } from './host-cli.ts';
import { PROJECT_LOCK } from './remove-project.ts';

export const MAX_TOKEN_LENGTH = 1000;
export const TOKEN_REQUIRED = 'Token is required';
export const TOKEN_LENGTH_ERROR = 'At most 1000 characters';
export const CHOOSE_GIT_HOST = 'Choose GitHub or GitLab';
export const NO_SECRET_KEY = 'No secret key: set FACTORYDECK_SECRET_KEY';
export const REMOTE_CHANGED = 'The remote changed during the check: try again';

const KNOWN_HOSTS: Record<string, GitHostKind> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
};

const ALWAYS: Record<GitHostKind, string> = {
  github: 'GitHub.com is always GitHub',
  gitlab: 'GitLab.com is always GitLab',
};

export function hostOf(remote: string): string {
  return remote.split('/')[0] ?? '';
}

export function repositoryPathOf(remote: string): string {
  return remote.split('/').slice(1).join('/');
}

export function isGitHostKind(value: unknown): value is GitHostKind {
  return value === 'github' || value === 'gitlab';
}

export function knownGitHost(remote: string): GitHostKind | undefined {
  return KNOWN_HOSTS[hostOf(remote)];
}

export function gitHostOf(
  remote: string,
  stored: string | null,
): GitHostKind | null {
  return knownGitHost(remote) ?? (isGitHostKind(stored) ? stored : null);
}

export type TokenFields =
  | {
      ok: true;
      token: string;
      gitHost: GitHostKind;
      storedGitHost: GitHostKind | null;
    }
  | ({ ok: false } & FieldError);

export function tokenFields(
  body: Record<string, unknown>,
  remote: string,
): TokenFields {
  const value = body['token'];
  const token = typeof value === 'string' ? value.trim() : '';
  if (token === '') return { ok: false, error: TOKEN_REQUIRED, field: 'token' };
  if (token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, error: TOKEN_LENGTH_ERROR, field: 'token' };
  }
  const chosen = body['gitHost'];
  const known = knownGitHost(remote);
  if (known !== undefined) {
    if (chosen !== undefined) {
      return { ok: false, error: ALWAYS[known], field: 'gitHost' };
    }
    return { ok: true, token, gitHost: known, storedGitHost: null };
  }
  if (!isGitHostKind(chosen)) {
    return { ok: false, error: CHOOSE_GIT_HOST, field: 'gitHost' };
  }
  return { ok: true, token, gitHost: chosen, storedGitHost: chosen };
}

export interface TokenProject {
  id: number;
  remote: string;
}

export interface SavedToken {
  gitHost: GitHostKind | null;
  tokenSet: true;
  tokenSetAt: string;
  tokenSetBy: { name: string } | null;
}

export type SaveTokenResult =
  | { status: 'saved'; token: SavedToken }
  | { status: 'missing' }
  | { status: 'remote-changed' };

export interface NewToken {
  remote: string;
  storedGitHost: GitHostKind | null;
  ciphertext: string;
  by: number;
}

export interface GitHostTokenStore {
  project: (id: number) => Promise<TokenProject | undefined>;
  save: (id: number, token: NewToken) => Promise<SaveTokenResult>;
  forget: (id: number) => Promise<boolean>;
}

async function nameOf(
  db: Pick<Database, 'select'>,
  id: number,
): Promise<{ name: string } | null> {
  const [row] = await db
    .select({ name: account.name })
    .from(account)
    .where(eq(account.id, id))
    .limit(1);
  return row ?? null;
}

export function gitHostTokenStore(
  db: Database,
  now: () => Date = () => new Date(),
): GitHostTokenStore {
  return {
    project: async (id) => {
      const [row] = await db
        .select({ id: project.id, remote: project.remote })
        .from(project)
        .where(eq(project.id, id))
        .limit(1);
      return row;
    },
    save: (id, token) =>
      db.transaction(async (tx): Promise<SaveTokenResult> => {
        await tx.execute(sql`select pg_advisory_xact_lock(${PROJECT_LOCK})`);
        const [current] = await tx
          .select({ remote: project.remote })
          .from(project)
          .where(eq(project.id, id))
          .limit(1);
        if (current === undefined) return { status: 'missing' };
        if (current.remote !== token.remote) {
          return { status: 'remote-changed' };
        }
        const at = now();
        await tx
          .update(project)
          .set({
            gitHost: token.storedGitHost,
            tokenCiphertext: token.ciphertext,
            tokenSetAt: at,
            tokenSetBy: token.by,
          })
          .where(eq(project.id, id));
        return {
          status: 'saved',
          token: {
            gitHost: gitHostOf(current.remote, token.storedGitHost),
            tokenSet: true,
            tokenSetAt: at.toISOString(),
            tokenSetBy: await nameOf(tx, token.by),
          },
        };
      }),
    forget: async (id) => {
      const rows = await db
        .update(project)
        .set({ tokenCiphertext: null, tokenSetAt: null, tokenSetBy: null })
        .where(eq(project.id, id))
        .returning({ id: project.id });
      return rows.length > 0;
    },
  };
}
