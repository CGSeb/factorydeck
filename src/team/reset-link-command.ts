import { parseArgs } from 'node:util';
import type { Database } from '../db/client.ts';
import type { DatabaseCheck } from '../server/health.ts';
import { activeAccountId, createResetLink } from './reset-links.ts';

export const USAGE = 'Usage: pnpm account:reset-link <email> --origin <url>';
export const NO_ACCOUNT = 'No active account with this email';
export const DATABASE_UNREACHABLE =
  'Database unreachable. Start it with pnpm db:up.';

export interface ResetLinkArgs {
  email: string;
  origin: string;
}

export interface ResetLinkIo {
  connect: () => {
    db: Database;
    check: DatabaseCheck;
    close: () => Promise<void>;
  };
  out: (line: string) => void;
  err: (line: string) => void;
  now?: () => Date;
}

function originOf(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

export function resetLinkArgs(
  args: readonly string[],
): ResetLinkArgs | undefined {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      options: { origin: { type: 'string', multiple: true } },
      allowPositionals: true,
      strict: true,
    });
  } catch {
    return undefined;
  }
  const { positionals, values } = parsed;
  const [email] = positionals;
  const [given, ...more] = values.origin ?? [];
  if (positionals.length !== 1 || email === undefined || email.trim() === '') {
    return undefined;
  }
  if (given === undefined || more.length > 0) return undefined;
  const origin = originOf(given);
  return origin === undefined ? undefined : { email, origin };
}

async function linkFor(
  db: Database,
  { email, origin }: ResetLinkArgs,
  now: Date,
): Promise<string | undefined> {
  const accountId = await activeAccountId(db, email);
  if (accountId === undefined) return undefined;
  const outcome = await createResetLink(
    db,
    { accountId, createdBy: null },
    now,
  );
  return outcome.status === 'created'
    ? `${origin}/reset/${outcome.token}`
    : undefined;
}

type Answer = { line: string; code: 0 | 1 };

async function answerFor(
  db: Database,
  check: DatabaseCheck,
  args: ResetLinkArgs,
  now: Date,
): Promise<Answer> {
  if (!(await check())) return { line: DATABASE_UNREACHABLE, code: 1 };
  let link: string | undefined;
  try {
    link = await linkFor(db, args, now);
  } catch (error) {
    if (await check()) throw error;
    return { line: DATABASE_UNREACHABLE, code: 1 };
  }
  return link === undefined
    ? { line: NO_ACCOUNT, code: 1 }
    : { line: link, code: 0 };
}

export async function runResetLink(
  args: readonly string[],
  io: ResetLinkIo,
): Promise<number> {
  const parsed = resetLinkArgs(args);
  if (parsed === undefined) {
    io.err(USAGE);
    return 1;
  }
  const { db, check, close } = io.connect();
  try {
    const answer = await answerFor(db, check, parsed, io.now?.() ?? new Date());
    if (answer.code === 0) io.out(answer.line);
    else io.err(answer.line);
    return answer.code;
  } finally {
    await close();
  }
}
