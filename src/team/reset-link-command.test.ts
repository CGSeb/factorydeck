import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, hashToken } from '../auth/secrets.ts';
import type { Database } from '../db/client.ts';
import { account, accountToken } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  DATABASE_UNREACHABLE,
  NO_ACCOUNT,
  USAGE,
  resetLinkArgs,
  runResetLink,
} from './reset-link-command.ts';
import { readReset } from './reset-links.ts';

const NOW = new Date('2026-03-12T10:00:00.000Z');

describe('resetLinkArgs', () => {
  it('reads the email and keeps only the origin of --origin', () => {
    expect(
      resetLinkArgs(['ada@example.test', '--origin', 'https://deck.test/x/']),
    ).toEqual({ email: 'ada@example.test', origin: 'https://deck.test' });
    expect(
      resetLinkArgs(['--origin=http://127.0.0.1:4317/', 'ada@example.test']),
    ).toEqual({ email: 'ada@example.test', origin: 'http://127.0.0.1:4317' });
  });

  it('refuses a missing email or origin, an extra argument and a bad origin', () => {
    for (const args of [
      [],
      ['ada@example.test'],
      ['--origin', 'https://deck.test'],
      ['   ', '--origin', 'https://deck.test'],
      ['ada@example.test', 'bob@example.test', '--origin', 'https://deck.test'],
      [
        'ada@example.test',
        '--origin',
        'https://a.test',
        '--origin=https://b.test',
      ],
      ['ada@example.test', '--origin', 'https://deck.test', '--force'],
      ['ada@example.test', '--origin'],
      ['ada@example.test', '--origin='],
      ['ada@example.test', '--origin', 'deck.test'],
      ['ada@example.test', '--origin', 'ftp://deck.test'],
      ['ada@example.test', '--origin', 'javascript:alert(1)'],
    ]) {
      expect(resetLinkArgs(args)).toBeUndefined();
    }
  });
});

describe('runResetLink', () => {
  let db: Database;
  let close: () => Promise<void>;
  let out: string[];
  let err: string[];
  let up: boolean;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
    out = [];
    err = [];
    up = true;
  });

  afterEach(async () => {
    await close();
  });

  function run(args: readonly string[]): Promise<number> {
    return runResetLink(args, {
      connect: () => ({
        db,
        check: () => Promise.resolve(up),
        close: () => Promise.resolve(),
      }),
      out: (line) => out.push(line),
      err: (line) => err.push(line),
      now: () => NOW,
    });
  }

  async function addAccount(email: string, active = true): Promise<number> {
    const [row] = await db
      .insert(account)
      .values({
        email,
        name: 'Ada',
        passwordHash: await hashPassword('a long passphrase'),
        role: 'manager',
        active,
        createdAt: NOW,
      })
      .returning({ id: account.id });
    return row?.id ?? 0;
  }

  it('prints a working link for the normalised email, with no creator', async () => {
    const ada = await addAccount('ada@example.test');
    const code = await run([
      '  Ada@Example.TEST ',
      '--origin',
      'https://deck.test/team',
    ]);
    expect(code).toBe(0);
    expect(err).toEqual([]);
    expect(out).toHaveLength(1);
    const match = /^https:\/\/deck\.test\/reset\/([A-Za-z0-9_-]{43})$/.exec(
      out[0] ?? '',
    );
    expect(match).not.toBeNull();
    const token = match?.[1] ?? '';
    expect(await readReset(db, token, NOW)).toEqual({
      status: 'ok',
      email: 'ada@example.test',
    });
    const rows = await db.select().from(accountToken);
    expect(rows).toEqual([
      expect.objectContaining({
        tokenHash: hashToken(token),
        accountId: ada,
        createdBy: null,
      }),
    ]);
  });

  it('replaces the previous unused link', async () => {
    await addAccount('ada@example.test');
    await run(['ada@example.test', '--origin', 'https://deck.test']);
    await run(['ada@example.test', '--origin', 'https://deck.test']);
    expect(await db.select().from(accountToken)).toHaveLength(1);
  });

  it('refuses an unknown or deactivated email', async () => {
    await addAccount('dan@example.test', false);
    for (const email of ['dan@example.test', 'nobody@example.test']) {
      expect(await run([email, '--origin', 'https://deck.test'])).toBe(1);
    }
    expect(err).toEqual([NO_ACCOUNT, NO_ACCOUNT]);
    expect(out).toEqual([]);
  });

  it('checks the arguments first, then the database, then the account', async () => {
    up = false;
    expect(await run(['nobody@example.test'])).toBe(1);
    expect(
      await run(['nobody@example.test', '--origin', 'https://d.test']),
    ).toBe(1);
    up = true;
    expect(
      await run(['nobody@example.test', '--origin', 'https://d.test']),
    ).toBe(1);
    expect(err).toEqual([USAGE, DATABASE_UNREACHABLE, NO_ACCOUNT]);
    expect(out).toEqual([]);
  });
});
