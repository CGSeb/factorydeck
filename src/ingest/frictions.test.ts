import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  categoryOf,
  commandHash,
  programOf,
  toolErrorFields,
} from './frictions.ts';
describe('tool error category', () => {
  it.each([
    ['Permission for this action was denied by the user.', 'Edit'],
    ['Permission for this command was denied.', 'Bash'],
    ['Permission to use Write has been denied because of a rule.', 'Write'],
    ["The user doesn't want to proceed with this tool use.", 'Bash'],
    ['Exit code 1\nCommand npm x was blocked by a deny rule', 'Bash'],
  ])('is permission-denied for %j', (text, tool) => {
    expect(categoryOf(text, tool)).toBe('permission-denied');
  });

  it('needs `has been denied` after `Permission to use `', () => {
    expect(categoryOf('Permission to use Write is pending.', 'Write')).toBe(
      'other',
    );
  });

  it('reads the other categories in their order', () => {
    expect(categoryOf('PreToolUse:Bash hook error: no rm', 'Bash')).toBe(
      'hook-blocked',
    );
    expect(categoryOf('PostToolUse:Edit hook error: lint', 'Edit')).toBe(
      'hook-blocked',
    );
    expect(
      categoryOf('<tool_use_error>File has not been read yet.', 'Edit'),
    ).toBe('tool-misuse');
    expect(categoryOf('Exit code 2\nfailed', 'Bash')).toBe('command-failed');
    expect(categoryOf('Exit code 2\nfailed', 'Edit')).toBe('other');
    expect(categoryOf('Something odd happened', 'Bash')).toBe('other');
    expect(categoryOf('', 'Bash')).toBe('other');
  });
});

describe('shell program', () => {
  it.each([
    ['pnpm test', 'pnpm'],
    ['cd x && pnpm test', 'pnpm'],
    ['cd x; cd y && git status', 'git'],
    ['FOO=1 BAR=two node script.ts', 'node'],
    ['./scripts/x.sh --fast', 'x.sh'],
    ['/usr/bin/env node', 'env'],
    ['cat log | grep error', 'cat'],
    ['false || echo no', 'false'],
    ['cd x\npnpm lint', 'pnpm'],
    ['(cd x && pnpm test)', 'pnpm'],
    ['{ cd x; make; }', 'make'],
    ['echo $(date)', 'echo'],
  ])('of %j is %j', (command, program) => {
    expect(programOf(command)).toBe(program);
  });

  it.each(['', '   ', 'cd x', 'FOO=1'])('of %j is none', (command) => {
    expect(programOf(command)).toBeNull();
  });
});

describe('command hash', () => {
  it('is the SHA-256 of the command without surrounding spaces', () => {
    const expected = createHash('sha256').update('pnpm test').digest('hex');
    expect(commandHash('  pnpm test \n')).toBe(expected);
    expect(commandHash('pnpm test')).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('tool error fields', () => {
  it('keep the shell program, exit code and hash, never the text', () => {
    expect(
      toolErrorFields('Exit code 127\nsecret output', {
        name: 'Bash',
        command: 'cd app && pnpm test',
      }),
    ).toEqual({
      kind: 'tool-error',
      tool: 'Bash',
      category: 'command-failed',
      program: 'pnpm',
      exitCode: 127,
      commandHash: commandHash('cd app && pnpm test'),
    });
  });

  it('keep the exit code of a denied shell command that starts with one', () => {
    expect(
      toolErrorFields('Exit code 1\nwas blocked by a deny rule', {
        name: 'Bash',
        command: 'rm -rf x',
      }),
    ).toMatchObject({ category: 'permission-denied', exitCode: 1 });
  });

  it('have no shell fields for another tool', () => {
    expect(
      toolErrorFields('Exit code 1', {
        name: 'mcp__server__tool',
        command: 'x',
      }),
    ).toEqual({
      kind: 'tool-error',
      tool: 'mcp__server__tool',
      category: 'other',
      program: null,
      exitCode: null,
      commandHash: null,
    });
  });

  it('keep the exit code of a shell call without a command', () => {
    expect(
      toolErrorFields('Exit code 5', { name: 'Bash', command: undefined }),
    ).toEqual({
      kind: 'tool-error',
      tool: 'Bash',
      category: 'command-failed',
      program: null,
      exitCode: 5,
      commandHash: null,
    });
  });

  it('have no program for an empty command', () => {
    expect(
      toolErrorFields('Exit code 1', { name: 'Bash', command: '' }),
    ).toMatchObject({ program: null, exitCode: 1 });
  });
});
