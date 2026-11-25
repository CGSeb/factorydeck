import { describe, expect, it } from 'vitest';
import {
  bugStatsOf,
  bugStatsResponse,
  noBugTickets,
} from './stats-bug-fixtures.ts';
import { panelKind } from './stats-loading.ts';

describe('panelKind', () => {
  it('loads every kind without a kind in the URL', () => {
    expect(panelKind(null, undefined)).toBeNull();
  });

  it('waits for the bug answer before applying a kind', () => {
    expect(panelKind('bug', undefined)).toBeUndefined();
  });

  it('follows the live bug answer, so the panels match the pills', () => {
    expect(panelKind('bug', bugStatsResponse(bugStatsOf()))).toBe('bug');
    expect(panelKind('bug', bugStatsResponse(noBugTickets))).toBeNull();
    expect(
      panelKind('feature', { status: 'unreachable', refreshSeconds: 10 }),
    ).toBeNull();
  });
});
