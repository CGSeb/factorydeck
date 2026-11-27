import { describe, expect, it } from 'vitest';
import { accountChangeOf, accountIdOf } from './account-change.ts';

describe('accountIdOf', () => {
  it('reads a decimal id without leading zeros', () => {
    expect(accountIdOf('42')).toBe(42);
    for (const text of ['', 'abc', '-1', '1.5', '007', '0', '1e3', ' 1']) {
      expect(accountIdOf(text)).toBeUndefined();
    }
    expect(accountIdOf('99999999999999999999')).toBeUndefined();
  });
});

describe('accountChangeOf', () => {
  it('reads a role, an active flag, or a refusal', () => {
    expect(accountChangeOf({ role: 'dev', x: 1 })).toEqual({
      kind: 'role',
      role: 'dev',
    });
    expect(accountChangeOf({ active: 'no' })).toEqual({
      kind: 'active',
      active: 'no',
    });
    expect(accountChangeOf({ role: undefined })).toMatchObject({
      kind: 'invalid',
      refusal: { field: 'role' },
    });
    expect(accountChangeOf(null)).toMatchObject({
      refusal: { error: 'Send role or active' },
    });
    expect(accountChangeOf({ role: 'dev', active: true })).toMatchObject({
      refusal: { error: 'Change the role or the status, not both' },
    });
  });
});
