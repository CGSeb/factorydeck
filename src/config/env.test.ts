import { describe, expect, it } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  codexSessionsFolder,
  sessionsFolder,
  validateEnv,
  workflowConfigPath,
} from './env.ts';

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

describe('codexSessionsFolder', () => {
  const DATABASE_URL = 'postgres://user:secret@localhost:5434/factorydeck';

  it('defaults to ~/.codex/sessions, also for an empty value', () => {
    expect(codexSessionsFolder({})).toBe(join(homedir(), '.codex', 'sessions'));
    const env = validateEnv({ DATABASE_URL, CODEX_SESSIONS_DIR: '' });
    expect(codexSessionsFolder(env)).toBe(
      join(homedir(), '.codex', 'sessions'),
    );
  });

  it('uses CODEX_SESSIONS_DIR, expanding a leading ~', () => {
    const env = validateEnv({ DATABASE_URL, CODEX_SESSIONS_DIR: '~/codex' });
    expect(codexSessionsFolder(env)).toBe(join(homedir(), 'codex'));
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

describe('FACTORYDECK_COLLECT_INTERVAL_MINUTES', () => {
  const DATABASE_URL = 'postgres://user:secret@localhost:5434/factorydeck';
  const minutes = (value?: string): number =>
    validateEnv(
      value === undefined
        ? { DATABASE_URL }
        : { DATABASE_URL, FACTORYDECK_COLLECT_INTERVAL_MINUTES: value },
    ).FACTORYDECK_COLLECT_INTERVAL_MINUTES;

  it('defaults to 5, also when empty', () => {
    expect(minutes()).toBe(5);
    expect(minutes('')).toBe(5);
  });

  it('reads a whole number of at least 1', () => {
    expect(minutes('1')).toBe(1);
    expect(minutes('60')).toBe(60);
  });

  it('rejects anything else', () => {
    for (const value of ['0', '-5', '2.5', 'often']) {
      expect(() => minutes(value)).toThrow(
        /FACTORYDECK_COLLECT_INTERVAL_MINUTES/,
      );
    }
  });
});

describe('workflowConfigPath', () => {
  const root = join(import.meta.dirname, '..', '..');

  it('defaults to factorydeck.yml at the repository root, also when empty', () => {
    expect(workflowConfigPath({})).toBe(join(root, 'factorydeck.yml'));
    const env = validateEnv({
      DATABASE_URL: 'postgres://user:secret@localhost:5434/factorydeck',
      FACTORYDECK_CONFIG: '',
    });
    expect(workflowConfigPath(env)).toBe(join(root, 'factorydeck.yml'));
  });

  it('uses FACTORYDECK_CONFIG, expanding a leading ~', () => {
    expect(workflowConfigPath({ FACTORYDECK_CONFIG: '/etc/fd.yml' })).toBe(
      '/etc/fd.yml',
    );
    expect(workflowConfigPath({ FACTORYDECK_CONFIG: '~/fd.yml' })).toBe(
      join(homedir(), 'fd.yml'),
    );
  });

  it('resolves a relative FACTORYDECK_CONFIG from the repository root', () => {
    expect(workflowConfigPath({ FACTORYDECK_CONFIG: 'config/fd.yml' })).toBe(
      join(root, 'config', 'fd.yml'),
    );
  });
});
