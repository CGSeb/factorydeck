import { describe, expect, it } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { sessionsFolder, validateEnv } from './env.ts';

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

describe('sessionsFolder', () => {
  it('defaults to ~/.claude/projects', () => {
    expect(sessionsFolder({})).toBe(join(homedir(), '.claude', 'projects'));
  });

  it('uses CLAUDE_PROJECTS_DIR, expanding a leading ~', () => {
    expect(sessionsFolder({ CLAUDE_PROJECTS_DIR: '/logs/claude' })).toBe(
      '/logs/claude',
    );
    expect(sessionsFolder({ CLAUDE_PROJECTS_DIR: '~/logs' })).toBe(
      join(homedir(), 'logs'),
    );
  });

  it('falls back to the default when CLAUDE_PROJECTS_DIR is empty', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgres://user:secret@localhost:5434/factorydeck',
      CLAUDE_PROJECTS_DIR: ' ',
    });
    expect(sessionsFolder(env)).toBe(join(homedir(), '.claude', 'projects'));
  });
});

describe('FACTORYDECK_PORT', () => {
  const DATABASE_URL = 'postgres://user:secret@localhost:5434/factorydeck';

  it('defaults to 4317', () => {
    expect(validateEnv({ DATABASE_URL }).FACTORYDECK_PORT).toBe(4317);
  });

  it('falls back to 4317 when the value is empty', () => {
    expect(
      validateEnv({ DATABASE_URL, FACTORYDECK_PORT: '' }).FACTORYDECK_PORT,
    ).toBe(4317);
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
