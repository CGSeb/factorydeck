import { describe, expect, it, vi } from 'vitest';
import { authGate } from './auth-gate.ts';

interface Pending {
  url: string;
  answer: (response: Response) => void;
}

function controlled(): { fetchImpl: typeof fetch; pending: Pending[] } {
  const pending: Pending[] = [];
  const fetchImpl: typeof fetch = (input) =>
    new Promise<Response>((resolve) => {
      pending.push({
        url: typeof input === 'string' ? input : '',
        answer: resolve,
      });
    });
  return { fetchImpl, pending };
}

function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(
    () => {
      done = true;
    },
    () => {
      done = true;
    },
  );
  return new Promise((resolve) => {
    setTimeout(() => resolve(done), 0);
  });
}

const OK = (): Response => Response.json({ ok: true });
const SIGNED_OUT = (): Response =>
  Response.json({ error: 'Not signed in' }, { status: 401 });

describe('auth gate', () => {
  it('passes answers through while signed in', async () => {
    const { fetchImpl, pending } = controlled();
    const gate = authGate(fetchImpl);
    const answer = gate.fetch('/api/overview');
    pending[0]?.answer(OK());
    await expect((await answer).json()).resolves.toEqual({ ok: true });
  });

  it('tells its listeners once on the first 401 and drops that answer', async () => {
    const { fetchImpl, pending } = controlled();
    const gate = authGate(fetchImpl);
    const listener = vi.fn<() => void>();
    gate.onSignedOut(listener);
    const first = gate.fetch('/api/overview');
    const second = gate.fetch('/api/sessions', { method: 'DELETE' });
    pending[0]?.answer(SIGNED_OUT());
    pending[1]?.answer(SIGNED_OUT());
    expect(await settled(first)).toBe(false);
    expect(await settled(second)).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('ignores the answers of requests sent before the 401', async () => {
    const { fetchImpl, pending } = controlled();
    const gate = authGate(fetchImpl);
    const earlier = gate.fetch('/api/stats');
    const failing = gate.fetch('/api/overview');
    const rejected = gate.fetch('/api/roles');
    pending[1]?.answer(SIGNED_OUT());
    await settled(failing);
    pending[0]?.answer(OK());
    expect(await settled(earlier)).toBe(false);
    expect(await settled(rejected)).toBe(false);
  });

  it('ignores a network error of a request sent before the 401', async () => {
    const calls: string[] = [];
    let fail: (error: Error) => void = () => undefined;
    const gate = authGate((input) => {
      calls.push(typeof input === 'string' ? input : '');
      return calls.length === 1
        ? new Promise<Response>((_, reject) => {
            fail = reject;
          })
        : Promise.resolve(SIGNED_OUT());
    });
    const earlier = gate.fetch('/api/stats');
    await settled(gate.fetch('/api/overview'));
    fail(new TypeError('offline'));
    expect(await settled(earlier)).toBe(false);
  });

  it('sends no request after the 401 until it is reopened', async () => {
    const urls: string[] = [];
    let status = 401;
    const gate = authGate((input) => {
      urls.push(typeof input === 'string' ? input : '');
      return Promise.resolve(Response.json({}, { status }));
    });
    await settled(gate.fetch('/api/overview'));
    const blocked = gate.fetch('/api/stats');
    expect(await settled(blocked)).toBe(false);
    expect(urls).toEqual(['/api/overview']);
    status = 200;
    gate.reopen();
    const after = await gate.fetch('/api/sessions');
    expect(after.status).toBe(200);
    expect(urls).toEqual(['/api/overview', '/api/sessions']);
  });

  it('passes a 401 of POST /api/auth/sign-in through', async () => {
    const gate = authGate(() => Promise.resolve(SIGNED_OUT()));
    const listener = vi.fn<() => void>();
    gate.onSignedOut(listener);
    const answer = await gate.fetch('/api/auth/sign-in', { method: 'POST' });
    expect(answer.status).toBe(401);
    expect(listener).not.toHaveBeenCalled();
    await settled(gate.fetch('/api/auth/sign-in'));
    expect(listener).toHaveBeenCalledOnce();
  });

  it('stops telling a listener that unsubscribed', async () => {
    const gate = authGate(() => Promise.resolve(SIGNED_OUT()));
    const listener = vi.fn<() => void>();
    gate.onSignedOut(listener)();
    await settled(gate.fetch('/api/overview'));
    expect(listener).not.toHaveBeenCalled();
  });
});
