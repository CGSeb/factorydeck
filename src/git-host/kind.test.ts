import { describe, expect, it } from 'vitest';
import { bugLabelOf, issueKind } from './kind.ts';

const RESERVED = ['spec', 'agent:ready', 'agent:working'];

describe('bugLabelOf', () => {
  it('keeps a bug label trimmed', () => {
    expect(bugLabelOf('  Bug ', RESERVED)).toBe('Bug');
  });

  it('has no bug label when it is missing or empty', () => {
    expect(bugLabelOf(undefined, RESERVED)).toBeNull();
    expect(bugLabelOf('', RESERVED)).toBeNull();
    expect(bugLabelOf('   ', RESERVED)).toBeNull();
  });

  it('has no bug label when it equals the spec or a flow label', () => {
    expect(bugLabelOf(' SPEC', RESERVED)).toBeNull();
    expect(bugLabelOf('Agent:Ready ', RESERVED)).toBeNull();
    expect(bugLabelOf('bug', [undefined, ...RESERVED])).toBe('bug');
  });
});

describe('issueKind', () => {
  it('is a bug when a label matches, after trimming and without case', () => {
    expect(issueKind(['spec', ' BUG '], 'Bug')).toBe('bug');
  });

  it('is a feature otherwise', () => {
    expect(issueKind(['spec'], 'bug')).toBe('feature');
    expect(issueKind([], 'bug')).toBe('feature');
    expect(issueKind(['bugfix'], 'bug')).toBe('feature');
  });

  it('is always a feature without a bug label', () => {
    expect(issueKind(['bug'], null)).toBe('feature');
  });
});
