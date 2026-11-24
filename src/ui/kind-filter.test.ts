import { describe, expect, it } from 'vitest';
import {
  kindOf,
  kindOptions,
  noKindText,
  shownKind,
  withKind,
} from './kind-filter.ts';

describe('kindOf', () => {
  it('reads feature and bug', () => {
    expect(kindOf(new URLSearchParams('kind=feature'))).toBe('feature');
    expect(kindOf(new URLSearchParams('kind=bug'))).toBe('bug');
  });

  it('means all for an absent, empty, unknown or differently spelled value', () => {
    for (const search of [
      '',
      'kind=',
      'kind=all',
      'kind=Bug',
      'kind=BUG',
      'kind=bugs',
      'kind=features',
      'kind=%20bug',
    ]) {
      expect(kindOf(new URLSearchParams(search))).toBeNull();
    }
  });

  it('keeps the first of a repeated value', () => {
    expect(kindOf(new URLSearchParams('kind=bug&kind=feature'))).toBe('bug');
    expect(kindOf(new URLSearchParams('kind=other&kind=bug'))).toBeNull();
  });
});

describe('withKind', () => {
  it('sets the kind and keeps the other parameters', () => {
    expect(
      withKind(new URLSearchParams('period=7d&project=%2Fa'), 'bug').toString(),
    ).toBe('period=7d&project=%2Fa&kind=bug');
  });

  it('removes every kind for all', () => {
    expect(
      withKind(
        new URLSearchParams('period=7d&kind=bug&kind=feature'),
        null,
      ).toString(),
    ).toBe('period=7d');
  });

  it('replaces a repeated kind with one value', () => {
    expect(
      withKind(new URLSearchParams('kind=x&kind=bug'), 'feature').toString(),
    ).toBe('kind=feature');
  });
});

describe('shownKind', () => {
  it('ignores the kind while the selection has no bug tickets', () => {
    expect(shownKind({ bugTickets: false }, 'bug')).toBeNull();
    expect(shownKind({ bugTickets: true }, 'bug')).toBe('bug');
    expect(shownKind({ bugTickets: true }, null)).toBeNull();
  });
});

describe('kindOptions', () => {
  it('gives All without a count, then Features and Bugs with theirs', () => {
    expect(kindOptions({ feature: 4, bug: 0 })).toEqual([
      { value: 'all', label: 'All' },
      { value: 'feature', label: 'Features', count: 4 },
      { value: 'bug', label: 'Bugs', count: 0 },
    ]);
  });
});

describe('noKindText', () => {
  it('names the kind', () => {
    expect(noKindText('bug')).toBe('No bug in this period.');
    expect(noKindText('feature')).toBe('No feature in this period.');
  });
});
