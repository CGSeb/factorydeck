import { describe, expect, it } from 'vitest';
import type { StateEvent } from '../git-host/types.ts';
import {
  type VersionIssue,
  type VersionRequest,
  versionOfRequest,
  versionsOf,
} from './versions.ts';

const CREATED = '2026-03-01T10:00:00.000Z';

function at(hours: number): string {
  return new Date(Date.parse(CREATED) + hours * 3_600_000).toISOString();
}

function closedAt(hours: number): StateEvent {
  return { state: 'closed', at: at(hours) };
}

function reopenedAt(hours: number): StateEvent {
  return { state: 'reopened', at: at(hours) };
}

function issue(
  stateEvents: StateEvent[],
  state: 'open' | 'closed' = 'open',
  closed: string | null = null,
): VersionIssue {
  return {
    state,
    createdAt: new Date(CREATED),
    closedAt: closed === null ? null : new Date(closed),
    updatedAt: new Date(at(100)),
    stateEvents,
  };
}

function spans(found: ReturnType<typeof versionsOf>) {
  return found.map(({ number, startedAt, endedAt }) => [
    number,
    new Date(startedAt).toISOString(),
    endedAt === null ? null : new Date(endedAt).toISOString(),
  ]);
}

function request(
  created: number,
  merged: number | null = null,
): VersionRequest {
  return {
    state: merged === null ? 'open' : 'merged',
    createdAt: new Date(at(created)),
    mergedAt: merged === null ? null : new Date(at(merged)),
    updatedAt: new Date(at(merged ?? created)),
  };
}

describe('versionsOf', () => {
  it('gives one ongoing version to an open bug never reopened', () => {
    expect(spans(versionsOf(issue([])))).toEqual([[1, CREATED, null]]);
  });

  it('ends the only version of a closed bug at its close', () => {
    expect(spans(versionsOf(issue([closedAt(5)], 'closed', at(5))))).toEqual([
      [1, CREATED, at(5)],
    ]);
  });

  it('ends a closed bug with no stored event at its close time', () => {
    expect(spans(versionsOf(issue([], 'closed', at(7))))).toEqual([
      [1, CREATED, at(7)],
    ]);
  });

  it('starts a version at each reopen', () => {
    expect(
      spans(
        versionsOf(
          issue([closedAt(5), reopenedAt(6), closedAt(9), reopenedAt(10)]),
        ),
      ),
    ).toEqual([
      [1, CREATED, at(5)],
      [2, at(6), at(9)],
      [3, at(10), null],
    ]);
  });

  it('ignores a repeated reopen and a close while no version is ongoing', () => {
    expect(
      spans(
        versionsOf(
          issue(
            [
              closedAt(5),
              closedAt(6),
              reopenedAt(7),
              reopenedAt(8),
              closedAt(9),
            ],
            'closed',
            at(9),
          ),
        ),
      ),
    ).toEqual([
      [1, CREATED, at(5)],
      [2, at(7), at(9)],
    ]);
  });

  it('reads a close and a reopen at the same second as the close first', () => {
    expect(spans(versionsOf(issue([reopenedAt(5), closedAt(5)])))).toEqual([
      [1, CREATED, at(5)],
      [2, at(5), null],
    ]);
  });

  it('reads events by time whatever their stored order', () => {
    expect(
      spans(versionsOf(issue([reopenedAt(6), closedAt(9), closedAt(5)]))),
    ).toEqual([
      [1, CREATED, at(5)],
      [2, at(6), null],
    ]);
  });

  it('keeps an open bug whose last event is a close ongoing in its last version', () => {
    expect(
      spans(versionsOf(issue([closedAt(5), reopenedAt(6), closedAt(9)]))),
    ).toEqual([
      [1, CREATED, at(5)],
      [2, at(6), null],
    ]);
  });

  it('reads 100 events into 51 versions', () => {
    const events = Array.from({ length: 100 }, (_, index) =>
      index % 2 === 0 ? closedAt(index + 1) : reopenedAt(index + 1),
    );
    const found = versionsOf(issue(events));
    expect(found).toHaveLength(51);
    expect(found.at(-1)?.endedAt).toBeNull();
  });
});

describe('versionOfRequest', () => {
  const versions = versionsOf(
    issue([closedAt(5), reopenedAt(6), closedAt(9), reopenedAt(10)]),
  );

  it('gives an open request the version it was created in', () => {
    expect(versionOfRequest(versions, request(1))).toBe(1);
    expect(versionOfRequest(versions, request(7))).toBe(2);
    expect(versionOfRequest(versions, request(11))).toBe(3);
  });

  it('gives a merged request the version of its merge time', () => {
    expect(versionOfRequest(versions, request(3, 7))).toBe(2);
  });

  it('keeps a request merged between a close and the next reopen with the version that close ended', () => {
    expect(versionOfRequest(versions, request(4, 5.5))).toBe(1);
  });

  it('gives a request started at a reopen time to the version that reopen starts', () => {
    expect(versionOfRequest(versions, request(6))).toBe(2);
  });

  it('gives a request created before the bug to its first version', () => {
    expect(versionOfRequest(versions, request(-2))).toBe(1);
  });
});
