import { describe, expect, it } from 'vitest';
import { issueOutcome } from './outcome.ts';
import type { SerenityReport } from './types.ts';

const AT = '2026-03-02T10:00:00.000Z';

const passing: SerenityReport = {
  score: 85,
  threshold: 80,
  rounds: 1,
  gatesPassed: true,
  at: AT,
};

describe('issueOutcome', () => {
  it('lets a merge with a passing report count as merged when build.auto_merge is not set', () => {
    expect(
      issueOutcome(
        { state: 'closed', labels: [], reopened: false },
        [{ state: 'merged', mergedAt: AT, updatedAt: AT, report: passing }],
        { labels: null, autoMerge: null },
      ).stage,
    ).toBe('merged');
  });

  it('counts the latest merge when two merged requests close the issue', () => {
    const outcome = issueOutcome(
      { state: 'closed', labels: [], reopened: false },
      [
        {
          state: 'merged',
          mergedAt: '2026-03-03T10:00:00.000Z',
          updatedAt: AT,
          report: { ...passing, score: 40 },
        },
        { state: 'merged', mergedAt: AT, updatedAt: AT, report: passing },
      ],
      { labels: null, autoMerge: true },
    );
    expect(outcome).toEqual({
      stage: 'merged-by-person',
      report: { score: 40, threshold: 80, rounds: 1 },
      reworked: true,
    });
  });

  it('is open when the labels were never read', () => {
    expect(
      issueOutcome(
        { state: 'open', labels: ['agent:ready'], reopened: false },
        [],
        {
          labels: null,
          autoMerge: null,
        },
      ),
    ).toEqual({ stage: 'open', report: null, reworked: false });
  });
});
