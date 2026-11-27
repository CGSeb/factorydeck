import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type AuthHarness,
  PASSWORD,
  START,
  authHarness,
  get,
  signIn,
  signedIn,
} from '../test/auth-app.ts';

const MINUTE_MS = 60 * 1000;
const ADA = 'ada@example.test';
const WRONG = { email: ADA, password: 'not the passphrase' };
const RIGHT = { email: ADA, password: PASSWORD };

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

function at(ms: number) {
  h.clock = new Date(START.getTime() + ms);
}

async function fail(times: number, body: unknown = WRONG, up = true) {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    statuses.push((await signIn(h.app(up), body)).status);
  }
  return statuses;
}

describe('failed sign-in limit', () => {
  it('answers 401 to the 10th failure and 429 to the 11th attempt, even with the right password', async () => {
    await h.addAccount(ADA);
    expect(await fail(10)).toEqual(Array(10).fill(401));
    at(3 * MINUTE_MS + 30 * 1000);
    const response = await signIn(h.app(), RIGHT);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'Too many attempts, try again in 12 minutes',
    });
    expect(response.headers.get('retry-after')).toBe(String(11 * 60 + 30));
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('reads 1 minute in the singular and gives Retry-After in seconds rounded up', async () => {
    await h.addAccount(ADA);
    await fail(10);
    at(15 * MINUTE_MS - 1500);
    const response = await signIn(h.app(), RIGHT);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'Too many attempts, try again in 1 minute',
    });
    expect(response.headers.get('retry-after')).toBe('2');
  });

  it('counts from the oldest attempt and checks again at exactly 15 minutes', async () => {
    await h.addAccount(ADA);
    await fail(1);
    at(5 * MINUTE_MS);
    await fail(9);
    at(15 * MINUTE_MS - 1);
    expect((await signIn(h.app(), WRONG)).status).toBe(429);
    at(15 * MINUTE_MS);
    expect((await signIn(h.app(), WRONG)).status).toBe(401);
    expect((await signIn(h.app(), RIGHT)).status).toBe(429);
    const response = await signIn(h.app(), RIGHT);
    expect(await response.json()).toEqual({
      error: 'Too many attempts, try again in 5 minutes',
    });
  });

  it('lets the right password in once the window has passed', async () => {
    await h.addAccount(ADA);
    await fail(10);
    at(15 * MINUTE_MS);
    expect((await signIn(h.app(), RIGHT)).status).toBe(200);
  });

  it('does not count an attempt answered 429', async () => {
    await h.addAccount(ADA);
    await fail(10);
    at(10 * MINUTE_MS);
    expect(await fail(5)).toEqual(Array(5).fill(429));
    at(15 * MINUTE_MS);
    expect((await signIn(h.app(), RIGHT)).status).toBe(200);
  });

  it('clears the count of its email on a successful sign-in', async () => {
    await h.addAccount(ADA);
    await fail(9);
    expect((await signIn(h.app(), RIGHT)).status).toBe(200);
    expect(await fail(10)).toEqual(Array(10).fill(401));
    expect((await signIn(h.app(), WRONG)).status).toBe(429);
  });

  it('counts an email with no account the same way', async () => {
    const ghost = { email: 'nobody@example.test', password: PASSWORD };
    expect(await fail(10, ghost)).toEqual(Array(10).fill(401));
    expect((await signIn(h.app(), ghost)).status).toBe(429);
  });

  it('counts a deactivated account', async () => {
    await h.addAccount(ADA, { active: false });
    expect(await fail(10, RIGHT)).toEqual(Array(10).fill(401));
    expect((await signIn(h.app(), RIGHT)).status).toBe(429);
  });

  it('counts two emails apart and normalises the email', async () => {
    await h.addAccount(ADA);
    await h.addAccount('bob@example.test');
    await fail(5, { email: '  ADA@Example.TEST ', password: 'nope' });
    await fail(5, { email: 'ada@example.test', password: 'nope' });
    expect((await signIn(h.app(), RIGHT)).status).toBe(429);
    expect(
      (await signIn(h.app(), { email: 'bob@example.test', password: PASSWORD }))
        .status,
    ).toBe(200);
  });

  it.each([
    ['a missing email', { password: 'nope' }],
    ['a non-string email', { email: 42, password: 'nope' }],
    ['an email without @', { email: 'ada.example.test', password: 'nope' }],
    [
      'an email over 254 characters',
      { email: `${'a'.repeat(250)}@b.cd`, password: 'nope' },
    ],
  ])('answers 401 to %s and does not count it', async (_, body) => {
    expect(await fail(15, body)).toEqual(Array(15).fill(401));
  });

  it('counts a wrong attempt whose password is missing', async () => {
    await h.addAccount(ADA);
    await fail(10, { email: ADA });
    expect((await signIn(h.app(), RIGHT)).status).toBe(429);
  });

  it('answers 429 before 503 while the database is unreachable', async () => {
    await h.addAccount(ADA);
    await fail(10);
    const response = await signIn(h.app(false), RIGHT);
    expect(response.status).toBe(429);
  });

  it('does not count an attempt that ends in 503', async () => {
    await h.addAccount(ADA);
    expect(await fail(12, WRONG, false)).toEqual(Array(12).fill(503));
    expect(await fail(10)).toEqual(Array(10).fill(401));
    expect((await signIn(h.app(), WRONG)).status).toBe(429);
  });

  it('gives at most 10 password checks to 20 wrong attempts sent at once', async () => {
    await h.addAccount(ADA);
    const server = h.app();
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => signIn(server, WRONG)),
    );
    const count = (status: number) =>
      responses.filter((response) => response.status === status).length;
    expect([count(401), count(429)]).toEqual([10, 10]);
  });

  it('keeps open sessions working while the email is limited', async () => {
    await h.addAccount(ADA);
    const cookie = await signedIn(h.app());
    await fail(10);
    expect((await signIn(h.app(), RIGHT)).status).toBe(429);
    expect((await get(h.app(), '/api/auth/me', cookie)).status).toBe(200);
  });

  it('leaves the setup route out of the count', async () => {
    await fail(10, { email: 'first@example.test', password: 'nope' });
    const response = await h.app().request('/api/auth/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'first@example.test', password: 'nope' }),
    });
    expect(response.status).not.toBe(429);
  });
});
