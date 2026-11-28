import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, secretKey } from './token-cipher.ts';

const KEY_TEXT = Buffer.alloc(32, 7).toString('base64');
const KEY = Buffer.alloc(32, 7);

describe('secretKey', () => {
  it('reads 32 bytes of standard base64, trimmed', () => {
    expect(secretKey(KEY_TEXT)).toEqual({ status: 'ok', key: KEY });
    expect(secretKey(`  ${KEY_TEXT}\n`)).toEqual({ status: 'ok', key: KEY });
  });

  it('counts an empty or blank value as unset', () => {
    expect(secretKey(undefined)).toEqual({ status: 'missing' });
    expect(secretKey('')).toEqual({ status: 'missing' });
    expect(secretKey('   ')).toEqual({ status: 'missing' });
  });

  it('refuses another length, base64url and text that is not base64', () => {
    const urlSafe = Buffer.alloc(32, 251).toString('base64url');
    for (const value of [
      Buffer.alloc(16, 1).toString('base64'),
      Buffer.alloc(33, 1).toString('base64'),
      urlSafe,
      KEY_TEXT.slice(0, -1),
      `${KEY_TEXT}=`,
      'not a key at all',
    ]) {
      expect(secretKey(value)).toEqual({ status: 'invalid' });
    }
  });
});

describe('encryptToken', () => {
  it('stores v1:<iv>:<tag>:<ciphertext> in unpadded base64url and reads it back', () => {
    const stored = encryptToken(KEY, 4, 'ghp_example');
    expect(stored).toMatch(
      /^v1:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]+$/,
    );
    expect(stored).not.toContain('ghp_example');
    expect(decryptToken(KEY, 4, stored)).toBe('ghp_example');
  });

  it('uses a new IV for each encryption', () => {
    expect(encryptToken(KEY, 4, 'same')).not.toBe(encryptToken(KEY, 4, 'same'));
  });

  it('does not decrypt for another project, another key or a changed text', () => {
    const stored = encryptToken(KEY, 4, 'ghp_example');
    expect(decryptToken(KEY, 5, stored)).toBeUndefined();
    expect(decryptToken(Buffer.alloc(32, 8), 4, stored)).toBeUndefined();
    const [version, iv, tag, ciphertext = ''] = stored.split(':');
    const changed = `${ciphertext.slice(0, -1)}${ciphertext.endsWith('A') ? 'B' : 'A'}`;
    expect(
      decryptToken(KEY, 4, [version, iv, tag, changed].join(':')),
    ).toBeUndefined();
    for (const bad of ['', 'v2:a:b:c', 'v1:a:b', 'v1:***:b:c']) {
      expect(decryptToken(KEY, 4, bad)).toBeUndefined();
    }
  });
});
