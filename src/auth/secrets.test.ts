import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  hashToken,
  newSessionToken,
  newSetupCode,
  sameSetupCode,
  verifyPassword,
} from './secrets.ts';

describe('setup code', () => {
  it('is 8 characters of the unambiguous alphabet', () => {
    const codes = Array.from({ length: 200 }, newSetupCode);
    for (const code of codes) {
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
    expect(new Set(codes).size).toBeGreaterThan(190);
  });

  it('compares without letter case, with spaces around it trimmed', () => {
    expect(sameSetupCode('AB23CD45', 'AB23CD45')).toBe(true);
    expect(sameSetupCode('AB23CD45', '  ab23cD45\n')).toBe(true);
    expect(sameSetupCode('AB23CD45', 'AB23 CD45')).toBe(false);
    expect(sameSetupCode('AB23CD45', 'AB23CD4')).toBe(false);
    expect(sameSetupCode('AB23CD45', '')).toBe(false);
    expect(sameSetupCode('AB23CD45', undefined)).toBe(false);
    expect(sameSetupCode('AB23CD45', 12_345_678)).toBe(false);
  });
});

describe('passwords', () => {
  it('hashes with scrypt and a random salt per hash', async () => {
    const password = 'correct horse battery';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).toMatch(/^scrypt\$[\w-]+\$[\w-]+$/);
    expect(first).not.toContain(password);
    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(password, second)).toBe(true);
    expect(await verifyPassword('correct horse batterY', first)).toBe(false);
    expect(await verifyPassword(password, 'plain')).toBe(false);
  });
});

describe('session tokens', () => {
  it('are 32 random bytes, stored as their SHA-256', () => {
    const token = newSessionToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(newSessionToken()).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
