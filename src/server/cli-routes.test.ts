import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { account, cliConnection } from '../db/schema.ts';
import { type AuthHarness, authHarness, signedIn } from '../test/auth-app.ts';
import { bearer, cliClient } from '../test/cli-client.ts';

let h: AuthHarness;
let cookie: string;
const { post, get, login, poll, approve, later } = cliClient(() => h);

const GONE = {
  error: 'This login is no longer valid. Run factorydeck login again.',
};
const INVALID = { error: 'This code is not valid or has expired.' };

beforeEach(async () => {
  h = await authHarness();
  await h.addAccount('ada@example.test', { name: 'Ada' });
  cookie = await signedIn(h.app(), 'ada@example.test');
});

afterEach(async () => {
  await h.close();
});

async function connections() {
  return h.db
    .select({
      machine: cliConnection.machine,
      tokenHash: cliConnection.tokenHash,
    })
    .from(cliConnection);
}

describe('POST /api/cli/login', () => {
  it('starts a login with a user code and its verification URL', async () => {
    const response = await post('/api/cli/login', { machine: '  my laptop ' });
    expect(response.status).toBe(200);
    const started = (await response.json()) as Record<string, unknown>;
    const userCode = String(started['userCode']);
    expect(userCode).toMatch(
      /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/,
    );
    expect(
      Buffer.from(String(started['deviceCode']), 'base64url'),
    ).toHaveLength(32);
    expect(started).toEqual({
      deviceCode: started['deviceCode'],
      userCode,
      verificationUrl: `http://localhost/cli?code=${userCode}`,
      expiresIn: 600,
      interval: 5,
    });
    const read = await post('/api/auth/cli', { code: userCode }, { cookie });
    expect(await read.json()).toEqual({
      machine: 'my laptop',
      userCode,
      account: { name: 'Ada', email: 'ada@example.test' },
    });
  });

  it('builds the URL from the host and an HTTPS proxy', async () => {
    const response = await post(
      '/api/cli/login',
      { machine: 'laptop', extra: true },
      { host: 'deck.example.test', 'x-forwarded-proto': 'https' },
    );
    const body = (await response.json()) as { verificationUrl: string };
    expect(body.verificationUrl).toMatch(
      /^https:\/\/deck\.example\.test\/cli\?code=[A-Z2-9]{4}-[A-Z2-9]{4}$/,
    );
  });

  it.each([
    [{}, 'Machine is required'],
    [{ machine: '   ' }, 'Machine is required'],
    [{ machine: 3 }, 'Machine is required'],
    [{ machine: 'é'.repeat(81) }, 'Machine must be at most 80 characters'],
  ])('refuses the machine of %j', async (body, error) => {
    const response = await post('/api/cli/login', body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error, field: 'machine' });
  });

  it('answers 415 to a body that is not JSON', async () => {
    const response = await post('/api/cli/login', 'machine=laptop', {
      'content-type': 'application/x-www-form-urlencoded',
    });
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: 'JSON body expected' });
  });

  it('accepts a machine of 80 characters', async () => {
    const response = await post('/api/cli/login', { machine: 'é'.repeat(80) });
    expect(response.status).toBe(200);
  });
});

describe('the login flow', () => {
  it('logs in, waits, gets the token once and reads me', async () => {
    const started = await login();
    const pending = await poll(started.deviceCode);
    expect(pending.status).toBe(202);
    expect(await pending.json()).toEqual({ status: 'pending' });
    later(5000);
    const code = started.userCode.toLowerCase().replace('-', ' ');
    expect((await approve(code, cookie)).status).toBe(204);
    const done = await poll(started.deviceCode);
    expect(done.status).toBe(200);
    const body = (await done.json()) as { token: string; account: unknown };
    expect(body.token).toMatch(/^fdk_[A-Za-z0-9_-]{43}$/);
    expect(body.account).toMatchObject({
      email: 'ada@example.test',
      name: 'Ada',
      role: 'dev',
    });
    const stored = await connections();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).not.toContain(body.token);
    expect(stored[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    later(5000);
    const again = await poll(started.deviceCode);
    expect(again.status).toBe(410);
    expect(await again.json()).toEqual(GONE);
    const me = await get('/api/cli/me', bearer(body.token));
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({
      account: body.account,
      machine: 'laptop',
    });
  });

  it('answers 429 on a poll sooner than 5 seconds', async () => {
    const started = await login();
    expect((await poll(started.deviceCode)).status).toBe(202);
    later(4999);
    const fast = await poll(started.deviceCode);
    expect(fast.status).toBe(429);
    expect(await fast.json()).toEqual({ error: 'Slow down' });
    later(1);
    expect((await poll(started.deviceCode)).status).toBe(202);
  });

  it('checks the body before the rate, and the rate before the code', async () => {
    const started = await login();
    expect((await poll(started.deviceCode)).status).toBe(202);
    const empty = await post('/api/cli/login/poll', { deviceCode: '' });
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({
      error: 'Device code is required',
      field: 'deviceCode',
    });
    await post('/api/auth/cli/cancel', { code: started.userCode }, { cookie });
    expect((await poll(started.deviceCode)).status).toBe(429);
    later(5000);
    expect((await poll(started.deviceCode)).status).toBe(410);
    expect((await poll('unknown')).status).toBe(410);
  });

  it('cancels a login from the browser', async () => {
    const started = await login();
    const cancel = await post(
      '/api/auth/cli/cancel',
      { code: started.userCode },
      { cookie },
    );
    expect(cancel.status).toBe(204);
    const polled = await poll(started.deviceCode);
    expect(polled.status).toBe(410);
    expect(await polled.json()).toEqual(GONE);
    const read = await post(
      '/api/auth/cli',
      { code: started.userCode },
      { cookie },
    );
    expect(read.status).toBe(410);
    expect(await read.json()).toEqual(INVALID);
    expect((await approve(started.userCode, cookie)).status).toBe(410);
  });

  it('expires a login at 10 minutes', async () => {
    const started = await login();
    later(10 * 60 * 1000 - 1);
    const read = await post(
      '/api/auth/cli',
      { code: started.userCode },
      { cookie },
    );
    expect(read.status).toBe(200);
    later(1);
    expect((await approve(started.userCode, cookie)).status).toBe(410);
    const polled = await poll(started.deviceCode);
    expect(polled.status).toBe(410);
    expect(await polled.json()).toEqual(GONE);
  });

  it('needs a session in the browser', async () => {
    const started = await login();
    const read = await post('/api/auth/cli', { code: started.userCode });
    expect(read.status).toBe(401);
    expect((await approve(started.userCode, '')).status).toBe(401);
  });

  it('answers 503 beyond 1000 pending logins', async () => {
    for (let i = 0; i < 1000; i++) h.cliLogins.start(`machine ${i}`);
    const response = await post('/api/cli/login', { machine: 'one more' });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Too many pending logins, try again later',
    });
  });

  it('refuses the token of an account deactivated before the poll', async () => {
    const started = await login();
    await approve(started.userCode, cookie);
    await h.db
      .update(account)
      .set({ active: false })
      .where(eq(account.email, 'ada@example.test'));
    const polled = await poll(started.deviceCode);
    expect(polled.status).toBe(410);
    expect(await connections()).toHaveLength(0);
  });
});
