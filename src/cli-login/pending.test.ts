import { describe, expect, it } from 'vitest';
import {
  MAX_PENDING_LOGINS,
  formatUserCode,
  normalizeUserCode,
  pendingLogins,
} from './pending.ts';

function started(logins: ReturnType<typeof pendingLogins>, machine = 'laptop') {
  const outcome = logins.start(machine);
  if (outcome.status !== 'started') throw new Error('Not started');
  return outcome;
}

describe('user codes', () => {
  it('reads a code without letter case, dashes and spaces', () => {
    expect(normalizeUserCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeUserCode('ab cd\tef-gh')).toBe('ABCDEFGH');
    expect(formatUserCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });

  it('draws 8 characters of the alphabet', () => {
    const logins = pendingLogins();
    for (let i = 0; i < 50; i++) {
      expect(started(logins).userCode).toMatch(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/,
      );
    }
  });

  it('never gives a pending code twice', () => {
    const codes = ['AAAAAAAA', 'AAAAAAAA', 'BBBBBBBB'];
    const logins = pendingLogins({
      userCode: () => codes.shift() ?? 'CCCCCCCC',
    });
    expect(started(logins).userCode).toBe('AAAAAAAA');
    expect(started(logins).userCode).toBe('BBBBBBBB');
  });
});

describe('pending logins', () => {
  it('frees a place when a login closes or expires', () => {
    let at = 0;
    const logins = pendingLogins({ now: () => at });
    const first = started(logins);
    for (let i = 1; i < MAX_PENDING_LOGINS; i++) started(logins);
    expect(logins.start('full').status).toBe('full');
    expect(logins.cancel(first.userCode)).toBe(true);
    expect(logins.start('one more').status).toBe('started');
    at = 10 * 60 * 1000;
    expect(logins.start('after expiry').status).toBe('started');
  });

  it('gives the approval back when the connection could not be written', () => {
    let at = 0;
    const logins = pendingLogins({ now: () => at });
    const login = started(logins);
    expect(logins.approve(login.userCode, 7)).toBe(true);
    const first = logins.poll(login.deviceCode);
    if (first.status !== 'approved') throw new Error('Not approved');
    expect(first).toMatchObject({ accountId: 7, machine: 'laptop' });
    first.undo();
    at = 5000;
    const second = logins.poll(login.deviceCode);
    if (second.status !== 'approved') throw new Error('Not approved');
    second.done();
    at = 10_000;
    expect(logins.poll(login.deviceCode)).toEqual({ status: 'gone' });
  });

  it('cannot approve a login twice', () => {
    const logins = pendingLogins();
    const login = started(logins);
    expect(logins.approve(login.userCode, 1)).toBe(true);
    expect(logins.approve(login.userCode, 2)).toBe(false);
    expect(logins.find(login.userCode)).toBeUndefined();
  });
});
