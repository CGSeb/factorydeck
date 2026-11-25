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
  it('keeps the roots and forgets an empty list', () => {
    storeBugTickets(['/work/app']);
    expect(storedBugTickets()).toEqual(['/work/app']);
    storeBugTickets([]);
    expect(window.localStorage.getItem(BUG_TICKETS_KEY)).toBeNull();
    expect(storedBugTickets()).toEqual([]);
  });

  it.each(['not json', '{"a":1}', '[1,"/work/app"]'])(
    'reads %s as what it can',
    (value) => {
      window.localStorage.setItem(BUG_TICKETS_KEY, value);
      expect(storedBugTickets()).toEqual(
        value.startsWith('[') ? ['/work/app'] : [],
      );
    },
  );

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
