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

describe('FACTORYDECK_INGEST_INTERVAL_SECONDS', () => {
  const DATABASE_URL = 'postgres://user:secret@localhost:5434/factorydeck';
  const interval = (value?: string): number =>
    validateEnv(
      value === undefined
        ? { DATABASE_URL }
        : { DATABASE_URL, FACTORYDECK_INGEST_INTERVAL_SECONDS: value },
    ).FACTORYDECK_INGEST_INTERVAL_SECONDS;

  it('defaults to 10, also when empty', () => {
    expect(interval()).toBe(10);
    expect(interval('')).toBe(10);
  });

  it('reads a whole number of at least 1', () => {
    expect(interval('1')).toBe(1);
    expect(interval('30')).toBe(30);
  });

  it('rejects anything else', () => {
    for (const value of ['0', '-5', '2.5', 'often']) {
      expect(() => interval(value)).toThrow(
        /FACTORYDECK_INGEST_INTERVAL_SECONDS/,
      );
    }
  });
});

describe('FACTORYDECK_INACTIVE_AFTER_MINUTES', () => {
  const DATABASE_URL = 'postgres://user:secret@localhost:5434/factorydeck';
  const minutes = (value?: string): number =>
    validateEnv(
      value === undefined
        ? { DATABASE_URL }
        : { DATABASE_URL, FACTORYDECK_INACTIVE_AFTER_MINUTES: value },
    ).FACTORYDECK_INACTIVE_AFTER_MINUTES;

  it('defaults to 30, also when empty', () => {
    expect(minutes()).toBe(30);
    expect(minutes('')).toBe(30);
  });

  it('reads a whole number of at least 1', () => {
    expect(minutes('1')).toBe(1);
    expect(minutes('90')).toBe(90);
  });

  it('rejects anything else', () => {
    for (const value of ['0', '-5', '2.5', 'soon']) {
      expect(() => minutes(value)).toThrow(
        /FACTORYDECK_INACTIVE_AFTER_MINUTES/,
      );
    }
  });
});
