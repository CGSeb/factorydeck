import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.ts';

describe('validateEnv', () => {
  it('accepts a PostgreSQL URL', () => {
    const url = 'postgres://user:secret@localhost:5434/factorydeck';
    expect(validateEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it('rejects a missing or non-PostgreSQL URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() =>
      validateEnv({ DATABASE_URL: 'mysql://localhost/factorydeck' }),
    ).toThrow(/DATABASE_URL/);
  });
});

describe('FACTORYDECK_PORT', () => {
  const DATABASE_URL = 'postgres://user:secret@localhost:5434/factorydeck';

  it('defaults to 4317', () => {
    expect(validateEnv({ DATABASE_URL }).FACTORYDECK_PORT).toBe(4317);
  });

  it('reads a port number', () => {
    expect(
      validateEnv({ DATABASE_URL, FACTORYDECK_PORT: '5000' }).FACTORYDECK_PORT,
    ).toBe(5000);
  });

  it('rejects a value that is not a port', () => {
    for (const value of ['abc', '0', '70000', '1.5']) {
      expect(() =>
        validateEnv({ DATABASE_URL, FACTORYDECK_PORT: value }),
      ).toThrow(/FACTORYDECK_PORT/);
    }
  });
});
