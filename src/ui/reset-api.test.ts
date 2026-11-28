import { describe, expect, it, vi } from 'vitest';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import {
  isResetToken,
  resetLink,
  resetLinkCreator,
  resetReader,
  resetSaver,
} from './reset-api.ts';

const TOKEN = 'a'.repeat(43);

function answering(status: number, body?: unknown): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(body === undefined ? 'oops' : JSON.stringify(body), {
        status,
      }),
    );
}

const offline: typeof fetch = () => Promise.reject(new TypeError('offline'));

describe('resetLinkCreator', () => {
  it('sends a POST with no body and answers the link', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      answering(201, { token: TOKEN, expiresAt: '2026-03-13T10:00:00.000Z' }),
    );
    expect(await resetLinkCreator(fetchImpl)(4)).toEqual({
      status: 'created',
      link: { token: TOKEN, expiresAt: '2026-03-13T10:00:00.000Z' },
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/team/accounts/4/reset-link', {
      method: 'POST',
    });
  });

  it('answers the message of a refusal, or the unreachable messages', async () => {
    const conflict = { error: 'This account is deactivated' };
    expect(await resetLinkCreator(answering(409, conflict))(4)).toEqual({
      status: 'failed',
      message: 'This account is deactivated',
    });
    expect(
      await resetLinkCreator(answering(404, { error: 'Not found' }))(4),
    ).toEqual({ status: 'failed', message: SERVER_UNREACHABLE });
    expect(
      await resetLinkCreator(answering(403, { error: 'Managers only' }))(4),
    ).toEqual({ status: 'refused' });
    expect(await resetLinkCreator(answering(503, {}))(4)).toEqual({
      status: 'failed',
      message: DATABASE_UNREACHABLE,
    });
    for (const fetchImpl of [offline, answering(500), answering(201, {})]) {
      expect(await resetLinkCreator(fetchImpl)(4)).toEqual({
        status: 'failed',
        message: SERVER_UNREACHABLE,
      });
    }
  });
});

describe('resetReader', () => {
  it('posts the token and answers the email', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      answering(200, { email: 'bob@example.test' }),
    );
    expect(await resetReader(fetchImpl)(TOKEN)).toEqual({
      status: 'ok',
      email: 'bob@example.test',
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/auth/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: TOKEN }),
    });
  });

  it('answers gone on 410, unreachable on 503, a network error or another answer', async () => {
    expect(await resetReader(answering(410, {}))(TOKEN)).toEqual({
      status: 'gone',
    });
    expect(await resetReader(answering(503, {}))(TOKEN)).toEqual({
      status: 'unreachable',
      message: DATABASE_UNREACHABLE,
    });
    for (const fetchImpl of [offline, answering(500), answering(200, {})]) {
      expect(await resetReader(fetchImpl)(TOKEN)).toEqual({
        status: 'unreachable',
        message: SERVER_UNREACHABLE,
      });
    }
  });
});

describe('resetSaver', () => {
  const bob = { id: 2, email: 'bob@example.test', name: 'Bob', role: 'dev' };

  it('posts the token and the password as typed, and answers the account', async () => {
    const fetchImpl = vi.fn<typeof fetch>(answering(200, bob));
    expect(await resetSaver(fetchImpl)(TOKEN, ' pass ')).toEqual({
      status: 'saved',
      account: bob,
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/auth/reset/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, password: ' pass ' }),
    });
  });

  it('answers gone, invalid and the failure messages', async () => {
    expect(await resetSaver(answering(410, {}))(TOKEN, 'x')).toEqual({
      status: 'gone',
    });
    const invalid = { error: 'Password is required', field: 'password' };
    expect(await resetSaver(answering(400, invalid))(TOKEN, '')).toEqual({
      status: 'invalid',
      message: 'Password is required',
    });
    expect(await resetSaver(answering(503, {}))(TOKEN, 'x')).toEqual({
      status: 'failed',
      message: DATABASE_UNREACHABLE,
    });
    for (const fetchImpl of [offline, answering(500), answering(200, {})]) {
      expect(await resetSaver(fetchImpl)(TOKEN, 'x')).toEqual({
        status: 'failed',
        message: SERVER_UNREACHABLE,
      });
    }
  });
});

describe('reset tokens and links', () => {
  it('accepts only 43 base64url characters', () => {
    expect(isResetToken(TOKEN)).toBe(true);
    expect(isResetToken(`${'a'.repeat(42)}-`)).toBe(true);
    for (const token of [
      undefined,
      '',
      'a'.repeat(42),
      'a'.repeat(44),
      `${'a'.repeat(42)}+`,
      `${'a'.repeat(42)}/`,
    ]) {
      expect(isResetToken(token)).toBe(false);
    }
  });

  it('builds the link from the origin', () => {
    expect(resetLink('https://deck.test', TOKEN)).toBe(
      `https://deck.test/reset/${TOKEN}`,
    );
  });
});
