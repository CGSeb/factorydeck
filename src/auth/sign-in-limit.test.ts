import { describe, expect, it } from 'vitest';
import { SIGN_IN_EMAILS, signInLimit } from './sign-in-limit.ts';

describe('signInLimit', () => {
  it('holds at most 10,000 emails and drops the one with the oldest last attempt', () => {
    let clock = 0;
    const limit = signInLimit({ now: () => new Date(clock) });
    for (let i = 0; i < 10; i += 1) limit.begin('oldest@example.test');
    clock += 1;
    for (let i = 1; i < SIGN_IN_EMAILS; i += 1) {
      limit.begin(`user${i}@example.test`);
    }
    for (let i = 0; i < 9; i += 1) limit.begin('user1@example.test');
    expect(limit.begin('oldest@example.test').status).toBe('limited');
    expect(limit.begin('user1@example.test').status).toBe('limited');
    clock += 1;
    expect(limit.begin('newcomer@example.test').status).toBe('counted');
    expect(limit.begin('user1@example.test').status).toBe('limited');
    expect(limit.begin('oldest@example.test').status).toBe('counted');
  });

  it('frees the attempts that left the window before dropping any email', () => {
    let clock = 0;
    const limit = signInLimit({ now: () => new Date(clock), emails: 2 });
    for (let i = 0; i < 10; i += 1) limit.begin('a@example.test');
    clock = 15 * 60 * 1000 - 1;
    for (let i = 0; i < 10; i += 1) limit.begin('b@example.test');
    clock = 15 * 60 * 1000;
    limit.begin('c@example.test');
    expect(limit.begin('b@example.test').status).toBe('limited');
  });

  it('does not count an email that fails the email form', () => {
    const limit = signInLimit();
    for (let i = 0; i < 12; i += 1) {
      expect(limit.begin(' @example.test').status).toBe('uncounted');
    }
  });
});
