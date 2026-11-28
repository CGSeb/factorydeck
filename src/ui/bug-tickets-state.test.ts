// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUG_TICKETS_KEY,
  storeBugTickets,
  storedBugTickets,
} from './bug-tickets-state.ts';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('stored bug tickets', () => {
  it('keeps the slugs and forgets an empty list', () => {
    storeBugTickets(['app']);
    expect(storedBugTickets()).toEqual(['app']);
    storeBugTickets([]);
    expect(window.localStorage.getItem(BUG_TICKETS_KEY)).toBeNull();
    expect(storedBugTickets()).toEqual([]);
  });

  it.each(['not json', '{"a":1}', '[1,"app"]'])(
    'reads %s as what it can',
    (value) => {
      window.localStorage.setItem(BUG_TICKETS_KEY, value);
      expect(storedBugTickets()).toEqual(value.startsWith('[') ? ['app'] : []);
    },
  );

  it('ignores a stored list of roots', () => {
    window.localStorage.setItem(
      BUG_TICKETS_KEY,
      '["/work/app","C:\\\\work\\\\lib","shop-app"]',
    );
    expect(storedBugTickets()).toEqual(['shop-app']);
  });

  it('reads nothing when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(storedBugTickets()).toEqual([]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => {
      storeBugTickets(['/work/app']);
    }).not.toThrow();
  });
});
