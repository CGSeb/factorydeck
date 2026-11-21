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
});
