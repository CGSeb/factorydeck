import { describe, expect, it } from 'vitest';
import type { IssueKind } from '../git-host/kind.ts';
import type { StateEvent } from '../git-host/types.ts';
import {
  type BugFacts,
  bugOpenings,
  openingsOf,
  summarizeBugs,
} from './bugs.ts';
import type { StatsBounds } from './bounds.ts';

const DAY = 86_400_000;
const START = Date.parse('2026-03-12T00:00:00Z');
const PREVIOUS = START - 7 * DAY;
const at = (days: number): string => new Date(START + days * DAY).toISOString();

interface Issue {
  number: number;
  kind?: IssueKind;
  created: number;
  events?: [StateEvent['state'], number][];
  state?: 'open' | 'closed';
  closed?: number;
}

function facts({
  number,
  kind = 'bug',
  created,
  events = [],
  state = 'open',
  closed,
}: Issue): BugFacts {
  const createdAt = new Date(at(created));
  return {
    project: '/work/app',
    number,
    title: `Issue ${String(number)}`,
    kind,
    mergedAt: null,
    leadMs: 0,
    reopened: events.some(([event]) => event === 'reopened'),
    openings: openingsOf({
      state,
      createdAt,
      closedAt: closed === undefined ? null : new Date(at(closed)),
      updatedAt: createdAt,
      stateEvents: events.map(([event, days]) => ({
        state: event,
        at: at(days),
      })),
    }),
  };
}

const period = { from: START, to: null };

function bounds(start: number | null, days: number[]): StatsBounds {
  return {
    start,
    previousStart: start === null ? null : PREVIOUS,
    unit: 'day',
    buckets: days.map((day) => ({
      start: START + day * DAY,
      key: at(day).slice(0, 10),
    })),
  };
}

describe('bug openings', () => {
  it('counts a bug created in the period as one creation', () => {
    expect(bugOpenings([facts({ number: 1, created: 2 })], period)).toEqual({
      created: 1,
      reopened: 0,
    });
  });

  it('counts a bug created before the period and reopened in it as one reopening', () => {
    const bug = facts({
      number: 1,
      created: -10,
      events: [
        ['closed', -9],
        ['reopened', 1],
      ],
    });
    expect(bugOpenings([bug], period)).toEqual({ created: 0, reopened: 1 });
    expect(bugOpenings([bug], { from: PREVIOUS, to: START })).toEqual({
      created: 0,
      reopened: 0,
    });
  });

  it('counts a bug created and reopened in the same period twice', () => {
    const bug = facts({
      number: 1,
      created: 1,
      events: [
        ['closed', 2],
        ['reopened', 3],
      ],
    });
    expect(bugOpenings([bug], period)).toEqual({ created: 1, reopened: 1 });
  });

  it('counts each reopening of a bug reopened twice', () => {
    const bug = facts({
      number: 1,
      created: -10,
      events: [
        ['closed', 1],
        ['reopened', 2],
        ['closed', 3],
        ['reopened', 4],
      ],
    });
    expect(bugOpenings([bug], period)).toEqual({ created: 0, reopened: 2 });
  });

  it('ignores a reopen event while a version is ongoing', () => {
    const bug = facts({
      number: 1,
      created: 1,
      events: [
        ['reopened', 2],
        ['closed', 3],
        ['reopened', 4],
        ['reopened', 5],
      ],
    });
    expect(bugOpenings([bug], period)).toEqual({ created: 1, reopened: 1 });
  });

  it('reads a close and a reopen at the same second as close first', () => {
    const bug = facts({
      number: 1,
      created: 1,
      events: [
        ['reopened', 2],
        ['closed', 2],
      ],
    });
    expect(bugOpenings([bug], period)).toEqual({ created: 1, reopened: 1 });
  });

  it('counts the openings of a bug closed without a fix', () => {
    const bug = facts({
      number: 1,
      created: 1,
      events: [['closed', 2]],
      state: 'closed',
      closed: 2,
    });
    expect(bugOpenings([bug], period)).toEqual({ created: 1, reopened: 0 });
  });

  it('counts no opening of a feature, even reopened', () => {
    const feature = facts({
      number: 1,
      kind: 'feature',
      created: 1,
      events: [
        ['closed', 2],
        ['reopened', 3],
      ],
    });
    expect(bugOpenings([feature], period)).toEqual({ created: 0, reopened: 0 });
  });

  it('counts only the creation of a bug whose state events were not collected', () => {
    const bug = { ...facts({ number: 1, created: 1 }), reopened: true };
    expect(bugOpenings([bug], period)).toEqual({ created: 1, reopened: 0 });
  });

  it('counts an opening in the bucket that starts at its time, not the one before', () => {
    const issues = [
      facts({ number: 1, created: 1 }),
      facts({ number: 2, created: 2 - 1 / DAY }),
      facts({ number: 3, created: 2 }),
    ];
    const { buckets, current, previous } = summarizeBugs(
      issues,
      bounds(START, [0, 1, 2]),
      true,
    );
    expect(buckets.map((bucket) => bucket.opened)).toEqual([0, 2, 1]);
    expect(current.openings).toEqual({ created: 3, reopened: 0 });
    expect(previous?.openings).toEqual({ created: 0, reopened: 0 });
  });

  it('leaves the openings before the period out of its first bucket', () => {
    const issues = [facts({ number: 1, created: -1 })];
    const { buckets, previous } = summarizeBugs(
      issues,
      bounds(START, [0, 1]),
      true,
    );
    expect(buckets.map((bucket) => bucket.opened)).toEqual([0, 0]);
    expect(previous?.openings).toEqual({ created: 1, reopened: 0 });
  });

  it('counts the openings before the first bucket of all time in that bucket', () => {
    const issues = [
      facts({ number: 1, created: -30 }),
      facts({ number: 2, created: 8 }),
    ];
    const stats = summarizeBugs(issues, bounds(null, [0, 7]), true);
    expect(stats.buckets.map((bucket) => bucket.opened)).toEqual([1, 1]);
    expect(stats.current.openings).toEqual({ created: 2, reopened: 0 });
    expect(stats).not.toHaveProperty('previous');
  });
});
