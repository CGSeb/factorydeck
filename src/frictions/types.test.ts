import { describe, expect, it } from 'vitest';
import { categoryOf, parseKind, parseRole } from './types.ts';

describe('parseKind', () => {
  it.each([
    ['tool-error', 'tool-error'],
    ['stop-blocked', 'stop-blocked'],
    ['compaction', undefined],
    ['', undefined],
    [null, undefined],
    [undefined, undefined],
    ['all', undefined],
    ['Compaction', undefined],
    [' compaction', undefined],
    ['stop_blocked', undefined],
    ['compactions', undefined],
  ])('reads %j as %j', (value, kind) => {
    expect(parseKind(value)).toBe(kind);
  });
});

describe('parseRole', () => {
  it.each([
    ['builder', 'builder'],
    ['unassigned', 'unassigned'],
    ['Builder', 'Builder'],
    [' builder', ' builder'],
    ['', undefined],
    [null, undefined],
    [undefined, undefined],
  ])('reads %j as %j', (value, role) => {
    expect(parseRole(value)).toBe(role);
  });
});

describe('categoryOf', () => {
  it('keeps a known category and files anything else under other', () => {
    expect(categoryOf('hook-blocked')).toBe('hook-blocked');
    expect(categoryOf('timeout')).toBe('other');
    expect(categoryOf(null)).toBe('other');
  });
});
