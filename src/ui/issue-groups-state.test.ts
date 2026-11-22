// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLLAPSED_GROUPS_KEY,
  readCollapsedGroups,
  writeCollapsedGroups,
} from './issue-groups-state.ts';

describe('collapsed issue groups', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with every group expanded', () => {
    expect([...readCollapsedGroups()]).toEqual([]);
  });

  it('keeps the folded groups in list order', () => {
    writeCollapsedGroups(new Set(['merged', 'in-review']));
    expect(window.localStorage.getItem(COLLAPSED_GROUPS_KEY)).toBe(
      '["in-review","merged"]',
    );
    expect([...readCollapsedGroups()]).toEqual(['in-review', 'merged']);
  });

  it('removes the key once every group is expanded again', () => {
    writeCollapsedGroups(new Set(['merged']));
    writeCollapsedGroups(new Set());
    expect(window.localStorage.getItem(COLLAPSED_GROUPS_KEY)).toBeNull();
  });

  it.each(['not json', '{"merged":true}', '"merged"', '["merged","sepia",3]'])(
    'ignores what is not a list group in %j',
    (value) => {
      window.localStorage.setItem(COLLAPSED_GROUPS_KEY, value);
      expect([...readCollapsedGroups()]).toEqual(
        value.startsWith('[') ? ['merged'] : [],
      );
    },
  );

  it('starts expanded when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect([...readCollapsedGroups()]).toEqual([]);
  });
});
